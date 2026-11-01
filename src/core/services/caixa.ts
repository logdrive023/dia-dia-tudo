// CAIXA: todo dinheiro que entra ou sai vira um movimento. A conta do dia, por moeda:
//   Veio de ontem (na mão · no banco) + movimentos de hoje = Total.   Na mão = só forma "dinheiro".

import { MOEDAS, type CodigoMoeda } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import type { Id, MovCaixa, TipoCaixa } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, formaPagamento, garantirDiaAberto, lerConfig, novo, tocar } from './contexto'

export async function moverCaixa(
  ctx: Ctx,
  m: { id?: Id; data: string; moeda: CodigoMoeda; forma: string; delta: number; tipo: TipoCaixa; origemId?: Id; descricao: string; categoria?: string; estornaId?: Id; socioId?: Id; localId?: Id; pessoaId?: Id; valorPrincipal?: number },
) {
  await garantirDiaAberto(ctx, m.data)
  const f = await formaPagamento(ctx, m.forma)
  exigir(f.moedas.includes(m.moeda), `${f.nome} não aceita ${m.moeda}.`)
  const mov = novo<MovCaixa>(ctx, { ...m })
  await ctx.repos.movCaixa.salvar(mov)
  return mov
}

const SINAL: Partial<Record<TipoCaixa, 1 | -1>> = { entrada: 1, saldoInicial: 1, despesa: -1, retirada: -1, dar: -1 }

export const NOMES_TIPO_CAIXA: Record<TipoCaixa, string> = {
  venda: 'Venda',
  compra: 'Compra',
  entrada: 'Entrada',
  despesa: 'Despesa',
  retirada: 'Retirada',
  dar: 'Dei dinheiro',
  emprestimo: 'Empréstimo',
  recebimento: 'Recebimento',
  estorno: 'Estorno',
  saldoInicial: 'Saldo inicial',
  correcao: 'Correção',
}

/** Lançamento manual (o que não é venda nem compra). */
export async function lancarCaixa(
  ctx: Ctx,
  d: { id: Id; tipo: 'entrada' | 'despesa' | 'retirada' | 'dar' | 'saldoInicial'; moeda: CodigoMoeda; forma: string; valor: number; descricao: string; categoria?: string; socioId?: Id; localId?: Id },
) {
  if (await ctx.repos.movCaixa.obter(d.id)) return { id: d.id }
  const sinal = SINAL[d.tipo]
  exigir(sinal, 'Tipo de lançamento inválido.')
  exigirInteiroPositivo(d.valor, 'Valor')
  const descricao = d.descricao?.trim() || NOMES_TIPO_CAIXA[d.tipo]
  const mov = await moverCaixa(ctx, {
    id: d.id,
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: sinal * d.valor,
    tipo: d.tipo,
    descricao,
    categoria: d.categoria,
    socioId: d.tipo === 'retirada' ? d.socioId : undefined,
    localId: d.localId,
  })
  await auditar(ctx, 'lancarCaixa', mov.id, `${NOMES_TIPO_CAIXA[d.tipo]}: ${descricao}`)
  return { id: mov.id }
}

/** Desfaz um lançamento manual: cria o inverso ligado ao original (nada é apagado). */
export async function estornarLancamento(ctx: Ctx, d: { lancamentoId: Id; motivo?: string }) {
  const orig = await ctx.repos.movCaixa.obter(d.lancamentoId)
  exigir(orig, 'Lançamento não encontrado.')
  exigir(SINAL[orig.tipo], 'Só lançamentos manuais são desfeitos aqui. Vendas e compras se cancelam na própria venda/compra.')
  exigir(!orig.estornadoPor, 'Esse lançamento já foi desfeito.')
  const inv = await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: orig.moeda,
    forma: orig.forma,
    delta: -orig.delta,
    tipo: 'estorno',
    descricao: `Desfeito: ${orig.descricao}`,
    estornaId: orig.id,
    categoria: orig.categoria,
    localId: orig.localId,
    pessoaId: orig.pessoaId,
    socioId: orig.socioId,
  })
  await ctx.repos.movCaixa.salvar(tocar(ctx, { ...orig, estornadoPor: inv.id }))
  await auditar(ctx, 'estornarLancamento', orig.id, d.motivo ?? orig.descricao)
  return { id: inv.id }
}

export async function encerrarDia(ctx: Ctx, d: { data: string; contado: Record<CodigoMoeda, number> }) {
  const dia = await garantirDiaAberto(ctx, d.data)
  for (const [m, v] of Object.entries(d.contado)) exigirInteiroPositivo(v, `Contado em ${m}`, true)
  await ctx.repos.dias.salvar(tocar(ctx, { ...dia, status: 'encerrado', contado: d.contado }))
  await auditar(ctx, 'encerrarDia', dia.id, d.data)
  return { id: dia.id }
}

export async function reabrirDia(ctx: Ctx, d: { data: string }) {
  const dia = await ctx.repos.dias.obter(d.data)
  if (!dia) throw new ErroNegocio('Esse dia não tem movimento.')
  await ctx.repos.dias.salvar(tocar(ctx, { ...dia, status: 'aberto' }))
  await auditar(ctx, 'reabrirDia', dia.id, d.data)
  return { id: dia.id }
}

// ---------- consultas ----------

export interface LinhaConta {
  rotulo: string
  valor: number
  vivo: boolean
  tipo: TipoCaixa | 'grupo'
}

export interface ContaMoeda {
  moeda: CodigoMoeda
  ontemMao: number
  ontemBanco: number
  linhas: LinhaConta[]
  hoje: number
  total: number
  mao: number
  banco: number
  contado?: number
}

/** A conta do caixa de um dia, por moeda (mesma ordem na tela, no WhatsApp e no CSV). */
export async function caixaDoDia(ctx: Ctx, p: { data: string }) {
  const cfg = await lerConfig(ctx)
  const vivo = new Set(cfg.formas.filter((f) => f.vivo).map((f) => f.id))
  const nomeForma = new Map(cfg.formas.map((f) => [f.id, f.nome]))
  const todos = await ctx.repos.movCaixa.listar()
  const dia = await ctx.repos.dias.obter(p.data)
  const contas: ContaMoeda[] = []
  for (const m of MOEDAS) {
    const daMoeda = todos.filter((x) => x.moeda === m.codigo)
    const antes = daMoeda.filter((x) => x.data < p.data)
    const hoje = daMoeda.filter((x) => x.data === p.data)
    if (!antes.length && !hoje.length) continue
    const ontemMao = antes.filter((x) => vivo.has(x.forma)).reduce((s, x) => s + x.delta, 0)
    const ontemBanco = antes.filter((x) => !vivo.has(x.forma)).reduce((s, x) => s + x.delta, 0)
    const linhas: LinhaConta[] = []
    // vendas e recebimentos agrupados por forma; o resto linha por linha
    for (const tipo of ['venda', 'recebimento'] as const) {
      const porForma = new Map<string, number>()
      for (const x of hoje.filter((h) => h.tipo === tipo)) porForma.set(x.forma, (porForma.get(x.forma) ?? 0) + x.delta)
      for (const [forma, valor] of porForma)
        linhas.push({ rotulo: `${NOMES_TIPO_CAIXA[tipo]}s · ${nomeForma.get(forma) ?? forma}`, valor, vivo: vivo.has(forma), tipo: 'grupo' })
    }
    for (const x of hoje.filter((h) => h.tipo !== 'venda' && h.tipo !== 'recebimento'))
      linhas.push({ rotulo: x.descricao, valor: x.delta, vivo: vivo.has(x.forma), tipo: x.tipo })
    const somaHoje = hoje.reduce((s, x) => s + x.delta, 0)
    const maoHoje = hoje.filter((x) => vivo.has(x.forma)).reduce((s, x) => s + x.delta, 0)
    const total = ontemMao + ontemBanco + somaHoje
    contas.push({
      moeda: m.codigo,
      ontemMao,
      ontemBanco,
      linhas,
      hoje: somaHoje,
      total,
      mao: ontemMao + maoHoje,
      banco: total - ontemMao - maoHoje,
      contado: dia?.contado?.[m.codigo],
    })
  }
  const movimentos = todos.filter((x) => x.data === p.data).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  return { data: p.data, status: dia?.status ?? 'sem movimento', contas, movimentos }
}

/** Dias com movimento (para o calendário do caixa). */
export async function diasDoCaixa(ctx: Ctx, _p: object = {}) {
  const dias = await ctx.repos.dias.listar()
  return dias.map((d) => ({ data: d.data, status: d.status })).sort((a, b) => (a.data < b.data ? 1 : -1))
}
