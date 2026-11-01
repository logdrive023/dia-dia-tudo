// VENDAS e ATENDIMENTOS: uma venda tem linhas (cabelo em gramas, serviço, produto) e pagamentos em qualquer moeda.
// Agendado não mexe em estoque nem caixa; só ao concluir.

import { converter, formatar, multiplicarFator, proporcao, type CodigoMoeda } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import { dataDeInstante } from '../domain/datas'
import type { Id, Linha, Transacao } from '../domain/tipos'
import { auditar, cotacoesAtuais, type Ctx, exigirInteiroPositivo, formaPagamento, lerConfig, novo, paraPrincipal, tocar } from './contexto'
import { moverCaixa } from './caixa'
import { custoDe, moverEstoque } from './estoque'
import { montarPagamentos, type PagamentoEntrada } from './pagamentos'
import { moverConta } from './contas'

export interface LinhaVendaEntrada {
  id: Id
  itemId: Id
  quantidade: number
  moeda: CodigoMoeda
  total: number
  profissionalId?: Id
  comissaoBp?: number
  descricao?: string
  /**
   * Conta do caderno: medida | quantidade × fator. Ex.: 40 cm, 2.000 g × 3,5 = Bs 7.000.
   * Com fator, o total é calculado aqui (o "total" enviado é ignorado).
   */
  calculo?: { medida?: number; fator: string; categoria?: string; tabelaId?: Id; colunaId?: string }
}

export interface VendaEntrada {
  id: Id
  pessoaId?: Id
  localId?: Id
  profissionalId?: Id
  /** ISO: vira atendimento agendado */
  agendadoPara?: string
  linhas: LinhaVendaEntrada[]
  pagamentos: PagamentoEntrada[]
  obs?: string
  /** agenda: marcar mesmo com horário ocupado (a tela pergunta antes) */
  ignorarConflito?: boolean
}

async function montarLinhas(ctx: Ctx, entrada: LinhaVendaEntrada[], profissionalPadrao?: Id): Promise<Linha[]> {
  exigir(entrada?.length, 'Coloque pelo menos um item na venda.')
  const linhas: Linha[] = []
  for (const l of entrada) {
    const item = await ctx.repos.itens.obter(l.itemId)
    exigir(item && item.ativo, 'Item não encontrado.')
    exigirInteiroPositivo(l.quantidade, `Quantidade de ${item.nome}`)
    const total = l.calculo?.fator ? multiplicarFator(l.quantidade, l.calculo.fator, l.moeda) : l.total
    exigirInteiroPositivo(total, `Valor de ${item.nome}`, true)
    const conv = await paraPrincipal(ctx, total, l.moeda)
    const profissionalId = l.profissionalId ?? (item.controlaEstoque ? undefined : profissionalPadrao)
    let comissaoBp = l.comissaoBp
    if (comissaoBp === undefined && profissionalId) comissaoBp = (await ctx.repos.pessoas.obter(profissionalId))?.comissaoBp
    if (comissaoBp !== undefined) exigir(Number.isInteger(comissaoBp) && comissaoBp >= 0 && comissaoBp <= 10000, 'Comissão inválida.')
    linhas.push({
      id: l.id,
      itemId: item.id,
      descricao: l.descricao?.trim() || item.nome,
      quantidade: l.quantidade,
      moeda: l.moeda,
      total,
      totalPrincipal: conv.valorPrincipal,
      cotacao: conv.cotacao,
      custoPrincipal: item.controlaEstoque ? custoDe(item, l.quantidade) : undefined,
      profissionalId,
      comissaoBp: profissionalId ? comissaoBp : undefined,
      comissaoPrincipal: profissionalId && comissaoBp ? proporcao(conv.valorPrincipal, comissaoBp, 10000) : undefined,
      campos: l.calculo?.fator
        ? {
            medida: l.calculo.medida,
            fator: l.calculo.fator,
            categoria: l.calculo.categoria,
            tabelaId: l.calculo.tabelaId,
            colunaId: l.calculo.colunaId,
            calculo: `${l.calculo.medida ?? ''}${l.calculo.categoria ? ' ' + l.calculo.categoria : ''} | ${l.quantidade.toLocaleString('pt-BR')} × ${l.calculo.fator} = ${formatar(total, l.moeda)}`,
          }
        : {},
    })
  }
  return linhas
}

async function concluir(ctx: Ctx, v: Transacao, pagamentosEntrada: PagamentoEntrada[]): Promise<Transacao> {
  // com cliente identificado pode pagar em partes: o resto vai para a conta dela (fiado)
  const pagamentos = await montarPagamentos(ctx, pagamentosEntrada, v.totalPrincipal, v.linhas, !!v.pessoaId)
  const hoje = ctx.relogio.hoje()
  for (const l of v.linhas) {
    const item = await ctx.repos.itens.obter(l.itemId!)
    if (item?.controlaEstoque) {
      // custo na hora da saída (o lote pode ter mudado desde o agendamento)
      l.custoPrincipal = custoDe(item, l.quantidade)
      await moverEstoque(ctx, { itemId: item.id, delta: -l.quantidade, motivo: v.agendadoPara ? 'uso' : 'venda', origemId: v.id, descricao: 'Venda' })
    }
  }
  const resumo = v.linhas.map((l) => l.descricao).join(', ')
  for (const p of pagamentos)
    await moverCaixa(ctx, { data: hoje, moeda: p.moeda, forma: p.forma, delta: p.valor, tipo: 'venda', origemId: v.id, descricao: `Venda · ${resumo}` })
  if (v.pessoaId) {
    await moverConta(ctx, { pessoaId: v.pessoaId, delta: v.totalPrincipal, tipo: 'venda', origemId: v.id, descricao: `Venda · ${resumo}` })
    const pago = pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
    await moverConta(ctx, { pessoaId: v.pessoaId, delta: -pago, tipo: 'recebimento', origemId: v.id, descricao: 'Pago na hora' })
  }
  return {
    ...v,
    data: hoje,
    etapa: 'concluido',
    pagamentos,
    historico: [...v.historico, { de: v.etapa, para: 'concluido', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome }],
  }
}

/** Vende agora (ou agenda o atendimento). Toque repetido devolve a mesma venda. */
export async function concluirVenda(ctx: Ctx, d: VendaEntrada) {
  if (await ctx.repos.transacoes.obter(d.id)) return { id: d.id }
  const cfg = await lerConfig(ctx)
  const linhas = await montarLinhas(ctx, d.linhas, d.profissionalId)
  const primeiro = await ctx.repos.itens.obter(linhas[0].itemId!)
  let v = novo<Transacao>(ctx, {
    id: d.id,
    tipo: 'venda',
    moduloId: primeiro!.moduloId,
    data: d.agendadoPara ? dataDeInstante(d.agendadoPara) : ctx.relogio.hoje(),
    etapa: d.agendadoPara ? 'agendado' : 'novo',
    pessoaId: d.pessoaId,
    localId: d.localId,
    profissionalId: d.profissionalId,
    agendadoPara: d.agendadoPara,
    linhas,
    pagamentos: [],
    moedaPrincipal: cfg.moedaPrincipal,
    totalPrincipal: linhas.reduce((s, l) => s + l.totalPrincipal, 0),
    historico: [],
    obs: d.obs,
    campos: {},
  })
  if (d.agendadoPara) {
    exigir(d.pessoaId, 'Diga quem é a cliente do agendamento.', 'pessoaId')
    if (!d.ignorarConflito && d.profissionalId) {
      const c = await conflitosAgenda(ctx, { profissionalId: d.profissionalId, inicio: d.agendadoPara, itens: d.linhas.map((l) => l.itemId) })
      if (c.length) throw new ErroNegocio(`Horário ocupado: ${c.map((x) => `${x.cliente ?? 'cliente'} ${x.inicio.slice(11, 16)}–${x.fim.slice(11, 16)}`).join(', ')}.`, 'conflito')
    }
    v.historico = [{ de: '', para: 'agendado', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome }]
  } else {
    v = await concluir(ctx, v, d.pagamentos)
  }
  await ctx.repos.transacoes.salvar(v)
  await auditar(ctx, d.agendadoPara ? 'agendar' : 'concluirVenda', v.id, linhas.map((l) => l.descricao).join(', '), [v.pessoaId!, v.profissionalId!, ...linhas.map((l) => l.itemId!)])
  return { id: v.id }
}

/** Atende um agendamento: pode trocar as linhas (o que realmente foi feito) e recebe o pagamento. */
export async function atenderAgendamento(ctx: Ctx, d: { id: Id; linhas?: LinhaVendaEntrada[]; pagamentos: PagamentoEntrada[] }) {
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Atendimento não encontrado.')
  if (t.etapa === 'concluido') return { id: t.id }
  exigir(t.etapa === 'agendado', 'Esse atendimento não está agendado.')
  let v: Transacao = { ...t, linhas: t.linhas.map((l) => ({ ...l })) }
  if (d.linhas) {
    v.linhas = await montarLinhas(ctx, d.linhas, t.profissionalId)
    v.totalPrincipal = v.linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  }
  v = await concluir(ctx, v, d.pagamentos)
  await ctx.repos.transacoes.salvar(tocar(ctx, v))
  await auditar(ctx, 'atenderAgendamento', v.id, '')
  return { id: v.id }
}

/** Cancela: devolve ao estoque e estorna cada pagamento. Nada é apagado. */
export async function cancelarVenda(ctx: Ctx, d: { id: Id; motivo: string }) {
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Venda não encontrada.')
  exigir(t.etapa !== 'cancelado', 'Essa venda já foi cancelada.')
  exigir(d.motivo?.trim(), 'Diga o motivo do cancelamento.', 'motivo')
  if (t.etapa === 'concluido') {
    for (const l of t.linhas) {
      const item = l.itemId ? await ctx.repos.itens.obter(l.itemId) : undefined
      if (item?.controlaEstoque)
        await moverEstoque(ctx, { itemId: item.id, delta: l.quantidade, motivo: 'cancelamento', origemId: t.id, descricao: 'Venda cancelada' })
    }
    for (const p of t.pagamentos)
      await moverCaixa(ctx, { data: ctx.relogio.hoje(), moeda: p.moeda, forma: p.forma, delta: -p.valor, tipo: 'estorno', origemId: t.id, descricao: `Venda cancelada · ${d.motivo}` })
    await estornarConta(ctx, t.id, `Venda cancelada · ${d.motivo}`)
  }
  await ctx.repos.transacoes.salvar(
    tocar(ctx, { ...t, etapa: 'cancelado', historico: [...t.historico, { de: t.etapa, para: 'cancelado', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo }] }),
  )
  await auditar(ctx, 'cancelarVenda', t.id, d.motivo)
  return { id: t.id }
}

/** Desfaz na conta corrente tudo o que uma venda/compra lançou (com um movimento inverso). */
export async function estornarConta(ctx: Ctx, origemId: Id, descricao: string) {
  const movs = await ctx.repos.movConta.listar({ origemId })
  const porPessoa = new Map<Id, number>()
  for (const m of movs) porPessoa.set(m.pessoaId, (porPessoa.get(m.pessoaId) ?? 0) + m.delta)
  for (const [pessoaId, soma] of porPessoa) await moverConta(ctx, { pessoaId, delta: -soma, tipo: 'estorno', origemId, descricao })
}

// ---------- correção de venda (a qualquer momento, com histórico) ----------

export interface CorrecaoLinha {
  linhaId: Id
  quantidade?: number
  total?: number
  /** com fator, o total é recalculado (gramas × fator) */
  fator?: string
}

/**
 * Corrige quantidade, valor ou fator de uma venda já feita, quantas vezes precisar. Nada é apagado:
 * o histórico guarda antes → depois, quem corrigiu e o motivo. O estoque acerta a diferença de quantidade,
 * custo e comissão são recalculados, e a diferença de dinheiro vai para o caixa (forma escolhida)
 * ou para a conta da cliente.
 */
export async function corrigirVenda(
  ctx: Ctx,
  d: { id: Id; linhas: CorrecaoLinha[]; motivo: string; diferenca?: { forma: string; moeda: CodigoMoeda } | 'conta' },
) {
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Venda não encontrada.')
  exigir(t.etapa === 'concluido' || t.etapa === 'agendado', 'Só dá para corrigir venda concluída ou agendada.')
  exigir(d.motivo?.trim(), 'Diga o motivo da correção.', 'motivo')
  const v: Transacao = { ...t, linhas: t.linhas.map((l) => ({ ...l, campos: { ...l.campos } })), pagamentos: [...t.pagamentos] }
  const ajustes: string[] = []
  const antes = v.totalPrincipal
  for (const c of d.linhas) {
    const l = v.linhas.find((x) => x.id === c.linhaId)
    exigir(l, 'Linha não encontrada.')
    const qtd = c.quantidade ?? l.quantidade
    exigirInteiroPositivo(qtd, `Quantidade de ${l.descricao}`)
    const fator = c.fator?.trim() || (l.campos.fator as string | undefined)
    const total = c.fator?.trim() || (fator && c.quantidade !== undefined && c.total === undefined) ? multiplicarFator(qtd, fator!, l.moeda) : c.total ?? l.total
    exigirInteiroPositivo(total, `Valor de ${l.descricao}`, true)
    if (qtd === l.quantidade && total === l.total) continue
    const item = l.itemId ? await ctx.repos.itens.obter(l.itemId) : undefined
    if (t.etapa === 'concluido' && item?.controlaEstoque && qtd !== l.quantidade)
      await moverEstoque(ctx, { itemId: item.id, delta: l.quantidade - qtd, motivo: 'correcao', origemId: v.id, descricao: `Correção da venda: ${l.quantidade} → ${qtd}` })
    ajustes.push(`${l.descricao}: ${l.quantidade.toLocaleString('pt-BR')} = ${formatar(l.total, l.moeda)} → ${qtd.toLocaleString('pt-BR')}${fator ? ` × ${fator}` : ''} = ${formatar(total, l.moeda)}`)
    const conv = await paraPrincipal(ctx, total, l.moeda)
    l.quantidade = qtd
    l.total = total
    l.totalPrincipal = conv.valorPrincipal
    l.cotacao = conv.cotacao
    if (fator) {
      l.campos.fator = fator
      l.campos.calculo = `${l.campos.medida ?? ''}${l.campos.categoria && l.campos.categoria !== 'Normal' ? ' ' + l.campos.categoria : ''} | ${qtd.toLocaleString('pt-BR')} × ${fator} = ${formatar(total, l.moeda)}`
    }
    if (item?.controlaEstoque) l.custoPrincipal = custoDe(item, qtd)
    if (l.comissaoBp) l.comissaoPrincipal = proporcao(l.totalPrincipal, l.comissaoBp, 10000)
  }
  exigir(ajustes.length, 'Nada mudou.')
  v.totalPrincipal = v.linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  const diff = v.totalPrincipal - antes
  if (t.etapa === 'concluido' && diff !== 0) {
    if (d.diferenca === 'conta' || (!d.diferenca && v.pessoaId)) {
      exigir(v.pessoaId, 'Venda sem cliente: diga como a diferença foi paga ou devolvida.')
      await moverConta(ctx, { pessoaId: v.pessoaId, delta: diff, tipo: 'ajuste', origemId: v.id, descricao: `Correção da venda · ${d.motivo}` })
    } else {
      const dif = d.diferenca
      exigir(typeof dif === 'object', 'Diga como a diferença foi paga ou devolvida.')
      const f = await formaPagamento(ctx, dif.forma)
      exigir(f.moedas.includes(dif.moeda), `${f.nome} não aceita ${dif.moeda}.`)
      const cfg = await lerConfig(ctx)
      const valor = converter(diff, cfg.moedaPrincipal, dif.moeda, await cotacoesAtuais(ctx))
      await moverCaixa(ctx, { data: ctx.relogio.hoje(), moeda: dif.moeda, forma: dif.forma, delta: valor, tipo: 'correcao', origemId: v.id, descricao: `Correção da venda · ${d.motivo}` })
      v.pagamentos.push({ id: `${v.id}-corr-${v.historico.length}`, forma: dif.forma, moeda: dif.moeda, valor, valorPrincipal: diff })
    }
  }
  v.historico = [
    ...v.historico,
    { de: t.etapa, para: t.etapa, tipo: 'correcao', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo, ajustes, totalAntes: antes, totalDepois: v.totalPrincipal },
  ]
  await ctx.repos.transacoes.salvar(tocar(ctx, v))
  await auditar(ctx, 'corrigirVenda', v.id, `${d.motivo}: ${ajustes.join(' · ')}`, [v.pessoaId!])
  return { id: v.id, diferenca: diff }
}

// ---------- agenda: horário ocupado ----------

/** Atendimentos da mesma profissional que se sobrepõem ao horário pedido (duração = soma dos serviços; padrão 60 min). */
export async function conflitosAgenda(ctx: Ctx, p: { profissionalId: Id; inicio: string; itens?: Id[]; duracaoMin?: number; ignorarId?: Id }) {
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const dur = (ids: (Id | undefined)[]) => Math.max(15, ids.reduce((s, id) => s + ((id && itens.get(id)?.duracaoMin) || 0), 0) || 60)
  const ini = Date.parse(p.inicio)
  const fim = ini + (p.duracaoMin ?? dur(p.itens ?? [])) * 60000
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  return (await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    .filter((t) => t.id !== p.ignorarId && t.agendadoPara && t.etapa === 'agendado')
    .filter((t) => t.profissionalId === p.profissionalId || t.linhas.some((l) => l.profissionalId === p.profissionalId))
    .map((t) => {
      const a = Date.parse(t.agendadoPara!)
      const b = a + dur(t.linhas.map((l) => l.itemId)) * 60000
      const local = (ms: number) => {
        const x = new Date(ms)
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
      }
      return { id: t.id, cliente: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, a, b, inicio: local(a), fim: local(b) }
    })
    .filter((x) => x.a < fim && ini < x.b)
    .map(({ id, cliente, inicio, fim }) => ({ id, cliente, inicio, fim }))
}

// ---------- consultas ----------

export interface FiltroVendas {
  de?: string
  ate?: string
  moduloId?: string
  pessoaId?: Id
  profissionalId?: Id
  localId?: Id
  itemId?: Id
  forma?: string
  moeda?: string
  etapa?: string
  /** quem registrou (usuário) — "o que a funcionária 1 fez do dia X ao Y" */
  usuarioId?: Id
}

/**
 * Recorta uma venda pelas linhas de um módulo/profissional (venda mista: cabelo + serviço).
 * Os pagamentos ficam proporcionais à parte recortada. Usado pelo painel E pela lista: por isso a soma bate.
 */
export function recortarVenda(t: Transacao, f: { moduloId?: string; profissionalId?: Id }, moduloDoItem: (id: Id) => string | undefined): Transacao | null {
  let linhas = t.linhas
  if (f.moduloId) linhas = linhas.filter((l) => (l.itemId ? moduloDoItem(l.itemId) : t.moduloId) === f.moduloId)
  if (f.profissionalId) linhas = linhas.filter((l) => l.profissionalId === f.profissionalId)
  if (!linhas.length) return null
  if (linhas.length === t.linhas.length) return t
  const parte = linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  const fator = t.totalPrincipal ? parte / t.totalPrincipal : 0
  return {
    ...t,
    linhas,
    totalPrincipal: parte,
    pagamentos: t.pagamentos.map((p) => ({ ...p, valor: Math.round(p.valor * fator), valorPrincipal: Math.round(p.valorPrincipal * fator) })),
  }
}

/** Valor que a venda soma: convertido (moeda principal) ou só o que foi pago numa moeda. */
export function valorEm(t: Transacao, moeda: string | undefined) {
  if (!moeda || moeda === 'convertido') return t.totalPrincipal
  return t.pagamentos.filter((p) => p.moeda === moeda).reduce((s, p) => s + p.valor, 0)
}

/** Lista de vendas (é a mesma lista que forma os números do painel: soma de "valor" = cartão). */
export async function vendas(ctx: Ctx, f: FiltroVendas = {}) {
  const todas = await ctx.repos.transacoes.listar({ tipo: 'venda' })
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p]))
  const etapa = f.etapa ?? 'concluido'
  return todas
    .filter((t) => t.etapa === etapa)
    .filter((t) => (!f.de || t.data >= f.de) && (!f.ate || t.data <= f.ate))
    .filter((t) => !f.pessoaId || t.pessoaId === f.pessoaId)
    .filter((t) => !f.localId || t.localId === f.localId)
    .filter((t) => !f.itemId || t.linhas.some((l) => l.itemId === f.itemId))
    .filter((t) => !f.forma || t.pagamentos.some((p) => p.forma === f.forma))
    .filter((t) => !f.moeda || t.pagamentos.some((p) => p.moeda === f.moeda))
    .filter((t) => !f.usuarioId || t.criadoPor === f.usuarioId || t.historico.some((h) => h.por === f.usuarioId))
    .map((t) => ({ original: t, recorte: recortarVenda(t, { moduloId: f.moduloId, profissionalId: f.profissionalId }, (id) => itens.get(id)?.moduloId) }))
    .filter((x): x is { original: Transacao; recorte: Transacao } => !!x.recorte)
    .map(({ original, recorte }) => ({
      ...original,
      cliente: original.pessoaId ? pessoas.get(original.pessoaId)?.nome : undefined,
      feitoPor: original.historico.find((h) => h.para === 'concluido')?.porNome ?? original.historico[0]?.porNome,
      valor: valorEm(recorte, f.moeda),
      lucroPrincipal: recorte.linhas.reduce((s, l) => s + l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0), 0),
    }))
    .sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? 1 : -1))
}

/** Agenda: atendimentos agendados num intervalo (por profissional e local). */
export async function agenda(ctx: Ctx, p: { de: string; ate: string; profissionalId?: Id; localId?: Id }) {
  if (ctx.sessao.perfil === 'funcionario') p = { ...p, profissionalId: ctx.sessao.usuarioId }
  const todas = await ctx.repos.transacoes.listar({ tipo: 'venda' })
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const locais = new Map((await ctx.repos.locais.listar()).map((x) => [x.id, x]))
  return todas
    .filter((t) => t.agendadoPara && t.etapa !== 'cancelado')
    .filter((t) => {
      const d = dataDeInstante(t.agendadoPara!)
      return d >= p.de && d <= p.ate
    })
    .filter((t) => !p.profissionalId || t.profissionalId === p.profissionalId)
    .filter((t) => !p.localId || t.localId === p.localId)
    .map((t, _i, todos) => ({
      ...t,
      conflito: t.etapa === 'agendado' && todos.some((o) => o.id !== t.id && o.etapa === 'agendado' && o.profissionalId && o.profissionalId === t.profissionalId && Math.abs(Date.parse(o.agendadoPara!) - Date.parse(t.agendadoPara!)) < 60 * 60000),
      cliente: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
      profissional: t.profissionalId ? pessoas.get(t.profissionalId)?.nome : undefined,
      local: t.localId ? locais.get(t.localId)?.nome : undefined,
    }))
    .sort((a, b) => (a.agendadoPara! < b.agendadoPara! ? -1 : 1))
}

export async function venda(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.transacoes.obter(p.id)
  exigir(t, 'Venda não encontrada.')
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const anexos = await ctx.repos.anexos.listar({ donoId: t.id })
  const local = t.localId ? await ctx.repos.locais.obter(t.localId) : undefined
  return { venda: t, cliente: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, profissional: t.profissionalId ? pessoas.get(t.profissionalId) : undefined, local, anexos }
}
