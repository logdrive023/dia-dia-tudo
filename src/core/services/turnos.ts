// FECHAMENTO DE TURNO COM CONFERÊNCIA CEGA — o dinheiro da mão de cada pessoa.
// No fim do turno a pessoa CONTA o dinheiro (em cada moeda) e informa. Ela NÃO vê quanto "deveria" ter: o sistema
// calcula sozinho (o esperado) e guarda a diferença no nome dela. Só o administrador vê esperado e diferença.
//
// O ESPERADO de um turno = tudo o que entrou e saiu em DINHEIRO VIVO (formas "vivo", ex.: efectivo) lançado por ESSA
// pessoa desde o fim do turno anterior dela (no primeiro turno: desde o começo do dia), mais os estornos desses
// lançamentos (mesmo feitos por outra pessoa). QR, Pix, cartão e transferência não entram: não estão na mão dela.
// Ex.: vendeu Bs 300 + Bs 150 em efectivo e US$ 20 → esperado Bs 450 e US$ 20. Contou Bs 430 → falta Bs 20 (no nome dela).
//
// Guardado na coleção de configurações (chave "turno:<id>"), como as vendas em aberto; não muda o caixa (o caixa do dia
// continua sendo o encerrado pelo administrador). A diferença vai para a auditoria e para o Caixa › Turnos.
import type { CodigoMoeda } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id } from '../domain/tipos'
import { auditar, type Ctx, lerConfig, novo, ehAdmin } from './contexto'

const CHAVE = 'turno:'

export interface Turno {
  id: Id
  usuarioId: Id
  nome: string
  /** começo e fim do turno (instantes) */
  inicio: string
  fim: string
  /** por moeda, em centavos */
  esperado: Partial<Record<CodigoMoeda, number>>
  contado: Partial<Record<CodigoMoeda, number>>
  diferenca: Partial<Record<CodigoMoeda, number>>
  /** quantos lançamentos em dinheiro entraram na conta */
  lancamentos: number
  situacao: 'confere' | 'falta' | 'sobra' | 'falta e sobra'
  obs?: string
}


async function todos(ctx: Ctx): Promise<Turno[]> {
  return (await ctx.repos.config.listar()).filter((r) => r.id.startsWith(CHAVE) && !r.apagadoEm).map((r) => r.valor as Turno)
}

/** o fim do último turno da pessoa (ou o começo do dia, se ela nunca fechou) */
async function inicioDoTurno(ctx: Ctx, usuarioId: Id) {
  const meus = (await todos(ctx)).filter((x) => x.usuarioId === usuarioId).sort((a, b) => (a.fim < b.fim ? 1 : -1))
  return meus[0]?.fim ?? new Date(`${ctx.relogio.hoje()}T00:00:00`).toISOString()
}

/** o que a pessoa deveria ter na mão, por moeda, entre `inicio` e `ate` */
async function esperadoDe(ctx: Ctx, usuarioId: Id, inicio: string, ate: string) {
  const cfg = await lerConfig(ctx)
  const vivas = new Set(cfg.formas.filter((f) => f.vivo).map((f) => f.id))
  const movs = (await ctx.repos.movCaixa.listar()).filter((m) => !m.apagadoEm && vivas.has(m.forma))
  const dela = new Set(movs.filter((m) => m.criadoPor === usuarioId).map((m) => m.id))
  const conta = movs.filter((m) => m.criadoEm > inicio && m.criadoEm <= ate && (dela.has(m.id) || (m.estornaId && dela.has(m.estornaId))))
  const esperado: Partial<Record<CodigoMoeda, number>> = {}
  for (const m of conta) esperado[m.moeda] = (esperado[m.moeda] ?? 0) + m.delta
  return { esperado, lancamentos: conta.length }
}

export async function fecharTurno(ctx: Ctx, d: { id: Id; contado: Partial<Record<CodigoMoeda, number>>; obs?: string }) {
  exigir(d.id, 'Turno sem id.')
  if (await ctx.repos.config.obter(CHAVE + d.id)) return { id: d.id }
  const contado: Partial<Record<CodigoMoeda, number>> = {}
  for (const [m, v] of Object.entries(d.contado ?? {})) {
    exigir(Number.isInteger(v) && (v as number) >= 0, `Contado em ${m}: use um valor de 0 para cima.`, 'contado')
    contado[m as CodigoMoeda] = v as number
  }
  const usuarioId = ctx.sessao.usuarioId
  const inicio = await inicioDoTurno(ctx, usuarioId)
  const fim = ctx.relogio.agora()
  const { esperado, lancamentos } = await esperadoDe(ctx, usuarioId, inicio, fim)
  const moedas = [...new Set([...Object.keys(esperado), ...Object.keys(contado)])] as CodigoMoeda[]
  const diferenca: Partial<Record<CodigoMoeda, number>> = {}
  for (const m of moedas) {
    const dif = (contado[m] ?? 0) - (esperado[m] ?? 0)
    if (dif) diferenca[m] = dif
  }
  const difs = Object.values(diferenca) as number[]
  const situacao: Turno['situacao'] = !difs.length ? 'confere' : difs.every((x) => x < 0) ? 'falta' : difs.every((x) => x > 0) ? 'sobra' : 'falta e sobra'
  const t: Turno = { id: d.id, usuarioId, nome: ctx.sessao.nome, inicio, fim, esperado, contado, diferenca, lancamentos, situacao, obs: d.obs?.trim() || undefined }
  await ctx.repos.config.salvar(novo(ctx, { id: CHAVE + d.id, valor: t }))
  const texto = (r: Partial<Record<string, number>>) => Object.entries(r).map(([m, v]) => `${m} ${((v ?? 0) / 100).toFixed(2)}`).join(' · ') || '0'
  await auditar(ctx, 'fecharTurno', d.id, `Turno de ${t.nome}: contou ${texto(contado)} · esperado ${texto(esperado)} · ${situacao === 'confere' ? 'confere' : `diferença ${texto(diferenca)}`}`)
  // CEGO: a pessoa não recebe o esperado nem a diferença
  return { id: d.id }
}

/**
 * O turno em andamento de quem está usando (sem valores: é conferência cega). Serve para a tela mostrar "desde 08:12 ·
 * 5 lançamentos em dinheiro" e para avisar ao sair sem fechar.
 */
export async function turnoAtual(ctx: Ctx, _p: object = {}) {
  const inicio = await inicioDoTurno(ctx, ctx.sessao.usuarioId)
  const { lancamentos, esperado } = await esperadoDe(ctx, ctx.sessao.usuarioId, inicio, ctx.relogio.agora())
  return { inicio, lancamentos, moedas: Object.keys(esperado) as CodigoMoeda[], pendente: lancamentos > 0 }
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
