// AGENDA EM CALENDÁRIO: junta numa lista só os atendimentos do salão (vendas agendadas), as viagens de compra, os
// compromissos/lembretes (coleção "eventos") e as PARCELAS DE EMPRÉSTIMO (receber/pagar no dia do vencimento).
// QUEM VÊ O QUÊ (regra do servidor):
//   · administrador: tudo (e filtra por pessoa, unidade e tipo)
//   · funcionária: o que é dela — atendimentos em que ela atende, compromissos dela (criados por ela ou para ela),
//     viagens em que está e os empréstimos que ela registrou
//   · funcionária com "agenda da equipe" (verAgendaEquipe): também o das colegas da unidade dela (e filtra por colega)
// Atendimento continua sendo venda: agendar = concluirVenda com agendadoPara; Feito = atenderAgendamento (vendas.ts).

import { converter, type CodigoMoeda } from '../domain/dinheiro'
import { dataDeInstante, horaCurta, somarDias } from '../domain/datas'
import { exigir } from '../domain/erros'
import type { Evento, Id, Transacao } from '../domain/tipos'
import { auditar, type Ctx, cotacoesAtuais, lerConfig, novo, tocar } from './contexto'
import { registrarAcerto } from './contas'
import { pendenciasVenda } from './pendencias'
import { situacaoDe } from './emprestimos'

export type TipoCalendario = 'atendimento' | 'viagem' | 'compromisso' | 'emprestimo'

export interface ItemCalendario {
  /** id da ocorrência (compromisso semanal: "id@AAAA-MM-DD") */
  id: string
  tipo: TipoCalendario
  titulo: string
  /** serviços do atendimento, destino da viagem, nota do compromisso */
  detalhe?: string
  /** dia (AAAA-MM-DD) em que começa e em que termina (viagem atravessa dias) */
  data: string
  ateData: string
  /** "HH:MM" local (sem hora = o dia todo) */
  hora?: string
  horaFim?: string
  /** instante (ISO) quando tem hora; senão o dia */
  inicio: string
  fim?: string
  diaTodo: boolean
  pessoaId?: Id
  pessoa?: string
  /** atendimento: a cliente */
  cliente?: string
  localId?: Id
  local?: string
  status: 'agendado' | 'feito' | 'cancelado'
  /** atendimento: valor e se já está pago (na hora ou depois, na conta da cliente) */
  valor?: number
  moeda?: string
  pago?: boolean
  /** quanto falta receber (moeda principal) */
  falta?: number
  conflito?: boolean
  /** compromisso: posso editar/excluir (sou dono ou administrador) */
  meu?: boolean
  semanal?: boolean
  /** registro de origem */
  ref: { tela: 'venda' | 'viagem' | 'evento' | 'emprestimo'; id: Id }
  /** empréstimo: receber (eu emprestei) ou pagar (eu peguei) · parcela atrasada */
  sentido?: 'receber' | 'pagar'
  atrasada?: boolean
}

export interface FiltroCalendario {
  de: string
  ate: string
  /** profissional / pessoa (admin). Funcionária: sempre ela. */
  pessoaId?: Id
  localId?: Id
  tipos?: TipoCalendario[]
}

const eu = (ctx: Ctx) => ctx.sessao.pessoaId ?? ctx.sessao.usuarioId
const admin = (ctx: Ctx) => ctx.sessao.perfil === 'admin'

/** O compromisso é da sessão? (criou ou é para ela) */
function ehMeu(ctx: Ctx, e: Evento) {
  return e.criadoPor === ctx.sessao.usuarioId || (!!e.pessoaId && e.pessoaId === eu(ctx))
}

/** hora "HH:MM" + minutos (vira o dia seguinte? fica 23:59) */
function somarMin(hora: string, min: number) {
  const [h, m] = hora.split(':').map(Number)
  const t = Math.min(23 * 60 + 59, h * 60 + m + min)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Dias do compromisso dentro do intervalo (semanal: um por semana). */
function ocorrencias(e: Evento, de: string, ate: string): string[] {
  if (!e.semanal) return e.data >= de && e.data <= ate ? [e.data] : []
  const fim = e.repetirAte && e.repetirAte < ate ? e.repetirAte : ate
  const dias: string[] = []
  let d = e.data
  // pula semanas inteiras até o começo do intervalo
  while (d < de) d = somarDias(d, 7)
  for (; d <= fim; d = somarDias(d, 7)) dias.push(d)
  return dias
}

/**
 * As pessoas cuja agenda a sessão pode ver: admin = todas (undefined); funcionária = ela e, com "agenda da equipe",
 * as colegas da unidade (funcionárias/profissionais; sem unidade = a equipe toda).
 */
export async function visiveis(ctx: Ctx, pessoas: Map<Id, import('../domain/tipos').Pessoa>): Promise<Set<Id> | undefined> {
  if (admin(ctx)) return undefined
  const euId = eu(ctx)
  const euP = pessoas.get(euId)
  const s = new Set<Id>([euId])
  if (euP?.verAgendaEquipe)
    for (const p of pessoas.values())
      if (p.papeis.some((x) => x === 'funcionario' || x === 'profissional') && (!euP.localId || !p.localId || p.localId === euP.localId)) s.add(p.id)
  return s
}

/** os filtros que a sessão pode usar (o servidor decide): pessoas e unidades */
export async function agendaFiltros(ctx: Ctx, _p: object = {}) {
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const vis = await visiveis(ctx, pessoas)
  const equipe = [...pessoas.values()].filter((p) => p.papeis.some((x) => x === 'profissional' || x === 'funcionario' || x === 'socio'))
  const podeVer = vis ? equipe.filter((p) => vis.has(p.id)) : equipe
  return {
    admin: admin(ctx),
    /** a funcionária vê a equipe? (sem isso, a agenda é só dela e não há filtro de pessoa) */
    equipe: !vis || vis.size > 1,
    pessoas: podeVer.map((p) => ({ id: p.id, nome: p.nome, localId: p.localId })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    unidades: admin(ctx) ? (await ctx.repos.locais.listar()).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome })) : [],
  }
}

export async function calendario(ctx: Ctx, f: FiltroCalendario): Promise<ItemCalendario[]> {
  exigir(f.de && f.ate && f.de <= f.ate, 'Período inválido.')
  const func = !admin(ctx)
  const tipos = new Set<TipoCalendario>(f.tipos?.length ? f.tipos : ['atendimento', 'viagem', 'compromisso', 'emprestimo'])
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const vis = await visiveis(ctx, pessoas)
  // de quem mostrar: a pessoa do filtro (se a sessão pode ver) · admin sem filtro = todos · funcionária = as que pode ver
  const alvo: Set<Id> | undefined = f.pessoaId && (!vis || vis.has(f.pessoaId)) ? new Set([f.pessoaId]) : vis
  const pessoaId = alvo?.size === 1 ? [...alvo][0] : undefined
  /** o filtro de pessoa só vale se a sessão pode ver essa pessoa (senão é ignorado) */
  const filtroOk = f.pessoaId && (!vis || vis.has(f.pessoaId)) ? f.pessoaId : undefined
  const locais = new Map((await ctx.repos.locais.listar()).map((x) => [x.id, x]))
  const itens: ItemCalendario[] = []

  if (tipos.has('atendimento')) {
    const cfg = await lerConfig(ctx)
    const vivas = new Set(cfg.formas.filter((x) => x.vivo).map((x) => x.id))
    const saldo = new Map<Id, number>()
    for (const m of await ctx.repos.movConta.listar()) saldo.set(m.pessoaId, (saldo.get(m.pessoaId) ?? 0) + m.delta)
    const itensCat = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
    const duracao = (t: Transacao) => Math.max(15, t.linhas.reduce((s, l) => s + ((l.itemId && itensCat.get(l.itemId)?.duracaoMin) || 0), 0) || 60)
    const daPessoa = (t: Transacao, p: Id) => t.profissionalId === p || t.linhas.some((l) => l.profissionalId === p)
    const ags = (await ctx.repos.transacoes.listar({ tipo: 'venda' }))
      .filter((t) => t.agendadoPara && t.etapa !== 'cancelado')
      .filter((t) => {
        const d = dataDeInstante(t.agendadoPara!)
        return d >= f.de && d <= f.ate
      })
      .filter((t) => !alvo || [...alvo].some((p) => daPessoa(t, p)))
      .filter((t) => !f.localId || t.localId === f.localId)
    for (const t of ags) {
      const ini = t.agendadoPara!
      const fimMs = Date.parse(ini) + duracao(t) * 60000
      const pend = t.etapa === 'concluido' ? pendenciasVenda(t, [], vivas, t.pessoaId ? saldo.get(t.pessoaId) : undefined).find((p) => p.id === 'faltaReceber') : undefined
      const cliente = t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined
      itens.push({
        id: t.id,
        tipo: 'atendimento',
        titulo: cliente ?? t.linhas.map((l) => l.descricao).join(', '),
        detalhe: t.linhas.map((l) => l.descricao).join(', '),
        data: dataDeInstante(ini),
        ateData: dataDeInstante(ini),
        hora: horaCurta(ini),
        horaFim: horaCurta(new Date(fimMs).toISOString()),
        inicio: ini,
        fim: new Date(fimMs).toISOString(),
        diaTodo: false,
        pessoaId: t.profissionalId,
        pessoa: t.profissionalId ? pessoas.get(t.profissionalId)?.nome : undefined,
        cliente,
        localId: t.localId,
        local: t.localId ? locais.get(t.localId)?.nome : undefined,
        status: t.etapa === 'concluido' ? 'feito' : 'agendado',
        valor: t.totalPrincipal,
        moeda: t.moedaPrincipal,
        pago: t.etapa === 'concluido' && !pend,
        falta: pend?.valor,
        conflito:
          t.etapa === 'agendado' &&
          ags.some((o) => o.id !== t.id && o.etapa === 'agendado' && !!o.profissionalId && o.profissionalId === t.profissionalId && Math.abs(Date.parse(o.agendadoPara!) - Date.parse(ini)) < 60 * 60000),
        ref: { tela: 'venda', id: t.id },
      })
    }
  }

  // viagem não é de unidade: com filtro de unidade fica de fora
  if (tipos.has('viagem') && !f.localId) {
    const hoje = ctx.relogio.hoje()
    for (const v of await ctx.repos.viagens.listar()) {
      const viajantes = v.viajantes ?? []
      if (alvo && !viajantes.some((x) => alvo.has(x))) continue
      // aberta sem fim: vai até hoje (ainda está acontecendo)
      const fim = v.fim || (v.status === 'aberta' && hoje > v.inicio ? hoje : v.inicio)
      if (fim < f.de || v.inicio > f.ate) continue
      itens.push({
        id: v.id,
        tipo: 'viagem',
        titulo: v.nome,
        detalhe: [v.codigo, v.destino].filter(Boolean).join(' · '),
        data: v.inicio,
        ateData: fim,
        inicio: v.inicio,
        fim,
        diaTodo: true,
        pessoa: viajantes.map((x) => pessoas.get(x)?.nome ?? '—').join(', '),
        status: v.status === 'encerrada' ? 'feito' : 'agendado',
        ref: { tela: 'viagem', id: v.id },
      })
    }
  }

  if (tipos.has('compromisso')) {
    for (const e of await ctx.repos.eventos.listar()) {
      // funcionária: o dela (criou ou é para ela) e, com agenda da equipe, o marcado para as colegas
      if (func) {
        const dela = ehMeu(ctx, e)
        const daEquipe = !!e.pessoaId && !!alvo?.has(e.pessoaId)
        if (!dela && !daEquipe) continue
        // filtrou uma colega: só o que é para ela (o dela mesma, quando filtrou a si)
        if (filtroOk && filtroOk !== eu(ctx) && e.pessoaId !== filtroOk) continue
        if (filtroOk === eu(ctx) && !dela) continue
      }
      if (!func && pessoaId && e.pessoaId !== pessoaId) continue
      if (f.localId && e.localId !== f.localId) continue
      for (const d of ocorrencias(e, f.de, f.ate)) {
        const pessoa = e.pessoaId ? pessoas.get(e.pessoaId)?.nome : undefined
        itens.push({
          id: e.semanal ? `${e.id}@${d}` : e.id,
          tipo: 'compromisso',
          titulo: e.titulo,
          detalhe: e.nota,
          data: d,
          ateData: d,
          hora: e.hora,
          horaFim: e.hora && e.duracaoMin ? somarMin(e.hora, e.duracaoMin) : undefined,
          inicio: e.hora ? `${d}T${e.hora}` : d,
          fim: e.hora && e.duracaoMin ? `${d}T${somarMin(e.hora, e.duracaoMin)}` : undefined,
          diaTodo: !e.hora,
          pessoaId: e.pessoaId,
          pessoa,
          localId: e.localId,
          local: e.localId ? locais.get(e.localId)?.nome : undefined,
          status: (e.feitos ?? []).includes(d) ? 'feito' : 'agendado',
          meu: admin(ctx) || e.criadoPor === ctx.sessao.usuarioId,
          semanal: e.semanal,
          ref: { tela: 'evento', id: e.id },
        })
      }
    }
  }

  // EMPRÉSTIMOS: cada parcela no dia do vencimento ("Receber 2/4 · Wagner · Bs 1.250"). Admin vê todos; funcionária,
  // os que ela registrou. Com filtro de pessoa/unidade ficam de fora (não são de profissional nem de unidade).
  if (tipos.has('emprestimo') && !f.localId && (!f.pessoaId || func)) {
    for (const e of await ctx.repos.emprestimos.listar()) {
      if (e.situacao === 'cancelado') continue
      if (func && e.criadoPor !== ctx.sessao.usuarioId) continue
      const s = await situacaoDe(ctx, e)
      const quem = pessoas.get(e.pessoaId)?.nome ?? '—'
      const sentido = e.direcao === 'dado' ? 'receber' : 'pagar'
      for (const p of s.parcelas) {
        if (p.vencimento < f.de || p.vencimento > f.ate) continue
        itens.push({
          id: `${e.id}#${p.id}`,
          tipo: 'emprestimo',
          titulo: `${sentido === 'receber' ? 'Receber' : 'Pagar'} parcela ${p.numero}/${s.parcelas.length} · ${quem}`,
          detalhe: p.status === 'paga' ? 'paga' : p.status === 'atrasada' ? `atrasada há ${p.diasAtraso} dia(s)` : undefined,
          data: p.vencimento,
          ateData: p.vencimento,
          inicio: p.vencimento,
          diaTodo: true,
          pessoa: quem,
          status: p.status === 'paga' ? 'feito' : 'agendado',
          valor: p.falta || p.valor,
          moeda: e.moeda,
          pago: p.status === 'paga',
          falta: p.falta,
          sentido,
          atrasada: p.status === 'atrasada',
          ref: { tela: 'emprestimo', id: e.id },
        })
      }
    }
  }

  // dia todo primeiro, depois pela hora
  return itens.sort((a, b) => (a.data !== b.data ? (a.data < b.data ? -1 : 1) : a.diaTodo !== b.diaTodo ? (a.diaTodo ? -1 : 1) : (a.hora ?? '') < (b.hora ?? '') ? -1 : (a.hora ?? '') > (b.hora ?? '') ? 1 : 0))
}

/** Um compromisso (para editar). */
export async function evento(ctx: Ctx, p: { id: Id }) {
  const e = await ctx.repos.eventos.obter(p.id)
  exigir(e && !e.apagadoEm, 'Compromisso não encontrado.')
  exigir(admin(ctx) || ehMeu(ctx, e), 'Esse compromisso não é seu.')
  return e
}

// ---------- comandos ----------

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const DIA = /^\d{4}-\d{2}-\d{2}$/

export interface EventoEntrada {
  id: Id
  titulo: string
  data: string
  hora?: string
  duracaoMin?: number
  nota?: string
  /** para quem (admin pode marcar para outra pessoa; funcionária: sempre ela) */
  pessoaId?: Id
  localId?: Id
  semanal?: boolean
  repetirAte?: string
}

/** Cria ou edita um compromisso/lembrete. Funcionária: só os dela e sempre para ela. */
export async function salvarEvento(ctx: Ctx, d: EventoEntrada) {
  const titulo = d.titulo?.trim()
  exigir(titulo, 'Diga o que é. Ex.: Buscar mechas no correio.', 'titulo')
  exigir(DIA.test(d.data ?? ''), 'Escolha o dia.', 'data')
  const hora = d.hora?.trim() || undefined
  if (hora) exigir(HORA.test(hora), 'Hora inválida. Ex.: 15:00.', 'hora')
  if (d.duracaoMin !== undefined) exigir(Number.isSafeInteger(d.duracaoMin) && d.duracaoMin > 0 && d.duracaoMin <= 24 * 60, 'Duração inválida.', 'duracaoMin')
  if (d.repetirAte) exigir(DIA.test(d.repetirAte) && d.repetirAte >= d.data, 'Repetir até: dia depois do começo.', 'repetirAte')
  const pessoaId = admin(ctx) ? d.pessoaId || undefined : ctx.sessao.pessoaId
  if (pessoaId) exigir(await ctx.repos.pessoas.obter(pessoaId), 'Pessoa não encontrada.', 'pessoaId')
  if (d.localId) exigir(await ctx.repos.locais.obter(d.localId), 'Unidade não encontrada.', 'localId')
  const campos = {
    titulo,
    data: d.data,
    hora,
    duracaoMin: hora ? d.duracaoMin : undefined,
    nota: d.nota?.trim() || undefined,
    pessoaId,
    localId: d.localId || undefined,
    semanal: !!d.semanal || undefined,
    repetirAte: d.semanal ? d.repetirAte || undefined : undefined,
  }
  const antes = await ctx.repos.eventos.obter(d.id)
  if (antes && !antes.apagadoEm) {
    exigir(admin(ctx) || antes.criadoPor === ctx.sessao.usuarioId, 'Só quem marcou (ou o administrador) muda este compromisso.')
    await ctx.repos.eventos.salvar(tocar(ctx, { ...antes, ...campos }))
    await auditar(ctx, 'salvarEvento', d.id, `${titulo} · ${d.data}${hora ? ' ' + hora : ''} (alterado)`, [pessoaId!])
    return { id: d.id }
  }
  exigir(!antes, 'Compromisso excluído.')
  await ctx.repos.eventos.salvar(novo<Evento>(ctx, { id: d.id, ...campos, feitos: [] }))
  await auditar(ctx, 'salvarEvento', d.id, `${titulo} · ${d.data}${hora ? ' ' + hora : ''}`, [pessoaId!])
  return { id: d.id }
}

/** Exclui (some da agenda; fica no log). */
export async function excluirEvento(ctx: Ctx, d: { id: Id }) {
  const e = await ctx.repos.eventos.obter(d.id)
  exigir(e, 'Compromisso não encontrado.')
  if (e.apagadoEm) return { id: e.id }
  exigir(admin(ctx) || e.criadoPor === ctx.sessao.usuarioId, 'Só quem marcou (ou o administrador) exclui este compromisso.')
  await ctx.repos.eventos.salvar(tocar(ctx, { ...e, apagadoEm: ctx.relogio.agora() }))
  await auditar(ctx, 'excluirEvento', e.id, `${e.titulo} · ${e.data}`, [e.pessoaId!])
  return { id: e.id }
}

/** Marca feito (ou desfaz). No semanal, vale para o dia da ocorrência. */
export async function concluirEvento(ctx: Ctx, d: { id: Id; data?: string; desfazer?: boolean }) {
  const e = await ctx.repos.eventos.obter(d.id)
  exigir(e && !e.apagadoEm, 'Compromisso não encontrado.')
  exigir(admin(ctx) || ehMeu(ctx, e), 'Esse compromisso não é seu.')
  const dia = d.data ?? e.data
  exigir(DIA.test(dia) && (e.semanal ? ocorrencias(e, dia, dia).length > 0 : dia === e.data), 'Esse compromisso não cai nesse dia.')
  const feitos = new Set(e.feitos ?? [])
  if (d.desfazer) feitos.delete(dia)
  else feitos.add(dia)
  await ctx.repos.eventos.salvar(tocar(ctx, { ...e, feitos: [...feitos].sort() }))
  await auditar(ctx, 'concluirEvento', e.id, `${e.titulo} · ${dia}${d.desfazer ? ' (desfeito)' : ''}`, [e.pessoaId!])
  return { id: e.id }
}

/**
 * "Pago" depois de "Feito, pagar depois": recebe da cliente o que falta DESTE atendimento (vai para o caixa e abate a
 * conta dela, como um acerto). Funcionária: só nos atendimentos dela e no máximo o que falta.
 */
export async function receberAtendimento(ctx: Ctx, d: { id: Id; vendaId: Id; forma: string; moeda: CodigoMoeda; valor: number }) {
  if ((await ctx.repos.movConta.listar({ origemId: d.id })).length) return { id: d.id }
  const t = await ctx.repos.transacoes.obter(d.vendaId)
  exigir(t && t.tipo === 'venda' && t.etapa === 'concluido' && t.pessoaId, 'Atendimento não encontrado ou ainda não feito.')
  if (!admin(ctx)) exigir(t.profissionalId === eu(ctx) || t.linhas.some((l) => l.profissionalId === eu(ctx)), 'Esse atendimento não é seu.')
  const cfg = await lerConfig(ctx)
  const vivas = new Set(cfg.formas.filter((x) => x.vivo).map((x) => x.id))
  const saldo = (await ctx.repos.movConta.listar({ pessoaId: t.pessoaId })).reduce((s, m) => s + m.delta, 0)
  const falta = pendenciasVenda(t, [], vivas, saldo).find((p) => p.id === 'faltaReceber')?.valor ?? 0
  exigir(falta > 0, 'Esse atendimento já está pago.')
  const principal = converter(d.valor, d.moeda, cfg.moedaPrincipal, await cotacoesAtuais(ctx, 'venda'))
  exigir(principal <= falta + 1, 'Valor maior do que falta receber deste atendimento.')
  await registrarAcerto(ctx, { id: d.id, pessoaId: t.pessoaId, direcao: 'recebi', valor: d.valor, moeda: d.moeda, forma: d.forma, descricao: `Atendimento ${t.codigo ?? ''}`.trim() })
  return { id: d.id }
}
