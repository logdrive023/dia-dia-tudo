// TURNO COM CONFERÊNCIA CEGA — o dinheiro da mão de cada pessoa.
// No fim do turno a pessoa CONTA o dinheiro (em cada moeda) e informa. Ela NÃO vê quanto "deveria" ter: o sistema
// calcula sozinho (o esperado) e guarda a diferença no nome dela. Só o administrador vê esperado e diferença.
//
// DOIS JEITOS (Configurações › O que a funcionária faz › Controle de turno):
//   desligado (padrão) — o turno começa sozinho no fim do turno anterior da pessoa (no primeiro: no começo do dia);
//                        vender não depende de turno.
//   ligado             — a pessoa ABRE o turno (com o TROCO INICIAL que recebeu, por moeda) e só então vende ou lança
//                        dinheiro (a trava fica em moverCaixa: todo dinheiro passa por lá). O turno vai da abertura ao
//                        fechamento. O administrador não precisa de turno.
//
// O ESPERADO de um turno = o troco inicial + tudo o que entrou e saiu em DINHEIRO VIVO (formas "vivo", ex.: efectivo)
// lançado por ESSA pessoa no turno, mais os estornos desses lançamentos (mesmo feitos por outra pessoa). QR, Pix,
// cartão e transferência não entram: não estão na mão dela.
// Ex.: troco Bs 100, vendeu Bs 300 + Bs 150 em efectivo e US$ 20 → esperado Bs 550 e US$ 20. Contou Bs 530 → falta Bs 20.
//
// Guardado na coleção de configurações ("turno:<id>" fechado · "turnoAberto:<usuário>" aberto); não muda o caixa.
// A diferença vai para a auditoria e para o Caixa › Turnos (com as horas, as vendas e a média por hora).
import type { CodigoMoeda } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import type { Id } from '../domain/tipos'
import { auditar, type Ctx, lerConfig, novo, ehAdmin, tocar } from './contexto'

const CHAVE = 'turno:'
const CHAVE_ABERTO = 'turnoAberto:'

type PorMoeda = Partial<Record<CodigoMoeda, number>>

/** uma anotação do administrador num turno fechado (conferiu, explicou a diferença…) — vai para a auditoria */
export interface NotaTurno {
  em: string
  por: string
  nota: string
}

export interface Turno {
  id: Id
  usuarioId: Id
  nome: string
  /** começo e fim do turno (instantes) */
  inicio: string
  fim: string
  /** por moeda, em centavos */
  esperado: PorMoeda
  contado: PorMoeda
  diferenca: PorMoeda
  /** o troco que a pessoa recebeu ao abrir (controle de turno ligado) */
  trocoInicial?: PorMoeda
  /** quantos lançamentos em dinheiro entraram na conta */
  lancamentos: number
  /** VENDAS concluídas por ela no turno (todas as formas), na moeda principal — para o relatório (vendas/hora) */
  vendas?: { n: number; total: number; moeda: CodigoMoeda }
  situacao: 'confere' | 'falta' | 'sobra' | 'falta e sobra'
  obs?: string
  notas?: NotaTurno[]
}

/** o turno ABERTO de uma pessoa (controle de turno ligado) */
export interface TurnoAberto {
  id: Id
  usuarioId: Id
  nome: string
  inicio: string
  trocoInicial: PorMoeda
}

export const MSG_ABRA_O_TURNO = 'Abra o seu turno antes de vender ou lançar dinheiro (Vender › Abrir turno).'

async function todos(ctx: Ctx): Promise<Turno[]> {
  return (await ctx.repos.config.listar()).filter((r) => r.id.startsWith(CHAVE) && !r.apagadoEm).map((r) => r.valor as Turno)
}

/** o turno aberto da pessoa, se houver */
export async function turnoAberto(ctx: Ctx, usuarioId: Id): Promise<TurnoAberto | undefined> {
  const r = await ctx.repos.config.obter(CHAVE_ABERTO + usuarioId)
  return r && !r.apagadoEm ? (r.valor as TurnoAberto) : undefined
}

/** TRAVA (moverCaixa): com o controle de turno ligado, a funcionária sem turno aberto não lança dinheiro nem vende */
export async function exigirTurnoAberto(ctx: Ctx) {
  if (ehAdmin(ctx) || !ctx.sessao.usuarioId) return
  if (!(await lerConfig(ctx)).controleTurno) return
  if (!(await turnoAberto(ctx, ctx.sessao.usuarioId))) throw new ErroNegocio(MSG_ABRA_O_TURNO)
}

/** o começo do turno: a abertura (se aberto) ou o fim do último turno da pessoa (ou o começo do dia) */
async function inicioDoTurno(ctx: Ctx, usuarioId: Id) {
  const aberto = await turnoAberto(ctx, usuarioId)
  if (aberto) return aberto.inicio
  const meus = (await todos(ctx)).filter((x) => x.usuarioId === usuarioId).sort((a, b) => (a.fim < b.fim ? 1 : -1))
  return meus[0]?.fim ?? new Date(`${ctx.relogio.hoje()}T00:00:00`).toISOString()
}

/** o que a pessoa deveria ter na mão, por moeda, entre `inicio` e `ate` (sem o troco inicial) */
async function esperadoDe(ctx: Ctx, usuarioId: Id, inicio: string, ate: string) {
  const cfg = await lerConfig(ctx)
  const vivas = new Set(cfg.formas.filter((f) => f.vivo).map((f) => f.id))
  const movs = (await ctx.repos.movCaixa.listar()).filter((m) => !m.apagadoEm && vivas.has(m.forma))
  const dela = new Set(movs.filter((m) => m.criadoPor === usuarioId).map((m) => m.id))
  const conta = movs.filter((m) => m.criadoEm > inicio && m.criadoEm <= ate && (dela.has(m.id) || (m.estornaId && dela.has(m.estornaId))))
  const esperado: PorMoeda = {}
  for (const m of conta) esperado[m.moeda] = (esperado[m.moeda] ?? 0) + m.delta
  return { esperado, lancamentos: conta.length }
}

/** as vendas concluídas que a pessoa registrou no turno (para o relatório: vendas por hora) */
async function vendasDe(ctx: Ctx, usuarioId: Id, inicio: string, ate: string): Promise<NonNullable<Turno['vendas']>> {
  const moeda = (await lerConfig(ctx)).moedaPrincipal
  const vs = (await ctx.repos.transacoes.listar()).filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && !t.apagadoEm && t.criadoPor === usuarioId && t.criadoEm > inicio && t.criadoEm <= ate)
  return { n: vs.length, total: vs.reduce((s, t) => s + t.totalPrincipal, 0), moeda }
}

function somar(a: PorMoeda, b: PorMoeda): PorMoeda {
  const r: PorMoeda = { ...a }
  for (const [m, v] of Object.entries(b)) r[m as CodigoMoeda] = (r[m as CodigoMoeda] ?? 0) + (v ?? 0)
  return r
}

function lerValores(v: PorMoeda | undefined, rotulo: string): PorMoeda {
  const r: PorMoeda = {}
  for (const [m, x] of Object.entries(v ?? {})) {
    exigir(Number.isInteger(x) && (x as number) >= 0, `${rotulo} em ${m}: use um valor de 0 para cima.`, rotulo === 'Contado' ? 'contado' : 'trocoInicial')
    if (x) r[m as CodigoMoeda] = x as number
  }
  return r
}

const texto = (r: PorMoeda) => Object.entries(r).map(([m, v]) => `${m} ${((v ?? 0) / 100).toFixed(2)}`).join(' · ') || '0'

/** ABRIR O TURNO (controle de turno): a hora de começo e o troco que a pessoa recebeu. Já aberto → devolve o mesmo. */
export async function abrirTurno(ctx: Ctx, d: { id: Id; trocoInicial?: PorMoeda }) {
  exigir(d.id, 'Turno sem id.')
  const ja = await turnoAberto(ctx, ctx.sessao.usuarioId)
  if (ja) return { id: ja.id }
  const trocoInicial = lerValores(d.trocoInicial, 'Troco inicial')
  const t: TurnoAberto = { id: d.id, usuarioId: ctx.sessao.usuarioId, nome: ctx.sessao.nome, inicio: ctx.relogio.agora(), trocoInicial }
  const r = await ctx.repos.config.obter(CHAVE_ABERTO + t.usuarioId)
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor: t, apagadoEm: undefined }) : novo(ctx, { id: CHAVE_ABERTO + t.usuarioId, valor: t }))
  await auditar(ctx, 'abrirTurno', d.id, `Turno de ${t.nome} aberto · troco ${texto(trocoInicial)}`)
  return { id: d.id }
}

export async function fecharTurno(ctx: Ctx, d: { id: Id; contado: PorMoeda; obs?: string }) {
  exigir(d.id, 'Turno sem id.')
  if (await ctx.repos.config.obter(CHAVE + d.id)) return { id: d.id }
  const contado = lerValores(d.contado, 'Contado')
  const usuarioId = ctx.sessao.usuarioId
  const aberto = await turnoAberto(ctx, usuarioId)
  // com o controle ligado, só fecha o que foi aberto (sem abrir, não há turno)
  if ((await lerConfig(ctx)).controleTurno && !ehAdmin(ctx)) exigir(aberto, 'Seu turno não está aberto.')
  const inicio = await inicioDoTurno(ctx, usuarioId)
  const fim = ctx.relogio.agora()
  const mov = await esperadoDe(ctx, usuarioId, inicio, fim)
  const trocoInicial = aberto?.trocoInicial ?? {}
  const esperado = somar(trocoInicial, mov.esperado)
  const moedas = [...new Set([...Object.keys(esperado), ...Object.keys(contado)])] as CodigoMoeda[]
  const diferenca: PorMoeda = {}
  for (const m of moedas) {
    const dif = (contado[m] ?? 0) - (esperado[m] ?? 0)
    if (dif) diferenca[m] = dif
  }
  const difs = Object.values(diferenca) as number[]
  const situacao: Turno['situacao'] = !difs.length ? 'confere' : difs.every((x) => x < 0) ? 'falta' : difs.every((x) => x > 0) ? 'sobra' : 'falta e sobra'
  const vendas = await vendasDe(ctx, usuarioId, inicio, fim)
  const t: Turno = { id: d.id, usuarioId, nome: ctx.sessao.nome, inicio, fim, esperado, contado, diferenca, trocoInicial: Object.keys(trocoInicial).length ? trocoInicial : undefined, lancamentos: mov.lancamentos, vendas, situacao, obs: d.obs?.trim() || undefined }
  await ctx.repos.config.salvar(novo(ctx, { id: CHAVE + d.id, valor: t }))
  // o turno aberto termina aqui (o próximo é aberto de novo)
  if (aberto) {
    const r = await ctx.repos.config.obter(CHAVE_ABERTO + usuarioId)
    if (r) await ctx.repos.config.salvar(tocar(ctx, { ...r, apagadoEm: fim }))
  }
  await auditar(ctx, 'fecharTurno', d.id, `Turno de ${t.nome}: contou ${texto(contado)} · esperado ${texto(esperado)} · ${situacao === 'confere' ? 'confere' : `diferença ${texto(diferenca)}`}`)
  // CEGO: a pessoa não recebe o esperado nem a diferença
  return { id: d.id }
}

/** ANOTAR (administrador): conferiu o turno, explicou a diferença… Fica no turno e na auditoria; nada é apagado. */
export async function anotarTurno(ctx: Ctx, d: { id: Id; nota: string }) {
  exigir(ehAdmin(ctx), 'Só o administrador anota turnos.')
  const nota = d.nota?.trim()
  exigir(nota, 'Escreva a anotação.', 'nota')
  const r = await ctx.repos.config.obter(CHAVE + d.id)
  exigir(r && !r.apagadoEm, 'Turno não encontrado.')
  const t = r.valor as Turno
  const valor: Turno = { ...t, notas: [...(t.notas ?? []), { em: ctx.relogio.agora(), por: ctx.sessao.nome, nota }] }
  await ctx.repos.config.salvar(tocar(ctx, { ...r, valor }))
  await auditar(ctx, 'anotarTurno', d.id, `Turno de ${t.nome}: ${nota}`)
  return { id: d.id }
}

/**
 * O turno em andamento de quem está usando (sem valores: é conferência cega). Serve para a tela mostrar "desde 08:12 ·
 * 5 lançamentos em dinheiro", pedir para ABRIR (controle ligado) e avisar ao sair sem fechar.
 */
export async function turnoAtual(ctx: Ctx, _p: object = {}) {
  const controle = (await lerConfig(ctx)).controleTurno && !ehAdmin(ctx)
  const aberto = await turnoAberto(ctx, ctx.sessao.usuarioId)
  const inicio = await inicioDoTurno(ctx, ctx.sessao.usuarioId)
  const { lancamentos, esperado } = await esperadoDe(ctx, ctx.sessao.usuarioId, inicio, ctx.relogio.agora())
  const moedas = [...new Set([...Object.keys(aberto?.trocoInicial ?? {}), ...Object.keys(esperado)])] as CodigoMoeda[]
  return {
    /** controle de turno ligado para quem está usando (o administrador não precisa) */
    controle,
    aberto: !!aberto,
    /** controle ligado e turno fechado: precisa ABRIR antes de vender */
    precisaAbrir: controle && !aberto,
    inicio,
    lancamentos,
    moedas,
    pendente: lancamentos > 0 || !!aberto,
  }
}

/** os turnos fechados: administrador vê todos com esperado e diferença; a funcionária vê só os dela, sem valores */
export async function turnos(ctx: Ctx, p: { de?: string; ate?: string; usuarioId?: Id } = {}) {
  const lista = (await todos(ctx))
    .filter((t) => (!p.de || t.fim.slice(0, 10) >= p.de) && (!p.ate || t.fim.slice(0, 10) <= p.ate))
    .filter((t) => !p.usuarioId || t.usuarioId === p.usuarioId)
    .sort((a, b) => (a.fim < b.fim ? 1 : -1))
  if (ehAdmin(ctx)) return lista
  return lista.filter((t) => t.usuarioId === ctx.sessao.usuarioId).map((t) => ({ id: t.id, usuarioId: t.usuarioId, nome: t.nome, inicio: t.inicio, fim: t.fim, contado: t.contado, lancamentos: t.lancamentos }))
}
