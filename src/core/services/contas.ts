// CONTA CORRENTE por pessoa: quem me deve e a quem eu devo (fiado, adiantamento, "falta", pagamento em partes).
// + = a pessoa me deve; − = eu devo a ela. Tudo na moeda principal. Saldo = soma dos movimentos.

import { formatar, type CodigoMoeda } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id, MovConta } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, novo, paraPrincipal } from './contexto'
import { moverCaixa } from './caixa'

export async function moverConta(ctx: Ctx, m: { id?: Id; pessoaId: Id; delta: number; tipo: MovConta['tipo']; origemId?: Id; forma?: string; descricao: string }) {
  if (m.delta === 0) return
  const cfg = await lerConfig(ctx)
  await ctx.repos.movConta.salvar(novo<MovConta>(ctx, { ...m, data: ctx.relogio.hoje(), moeda: cfg.moedaPrincipal }))
}

/**
 * Acerto de conta: recebi da pessoa ou paguei a ela (inclusive adiantamento antes de a mercadoria chegar).
 * Ex.: Henry deve Bs 89.420 → recebi Bs 70.000 → falta Bs 19.420.
 */
export async function registrarAcerto(
  ctx: Ctx,
  d: { id: Id; pessoaId: Id; direcao: 'recebi' | 'paguei'; adiantamento?: boolean; valor: number; moeda: CodigoMoeda; forma: string; descricao?: string },
) {
  if ((await ctx.repos.movConta.listar({ origemId: d.id })).length) return { id: d.id }
  const pessoa = await ctx.repos.pessoas.obter(d.pessoaId)
  exigir(pessoa, 'Escolha a pessoa.', 'pessoaId')
  exigirInteiroPositivo(d.valor, 'Valor')
  const { valorPrincipal } = await paraPrincipal(ctx, d.valor, d.moeda, d.direcao === 'recebi' ? 'venda' : 'compra')
  const recebi = d.direcao === 'recebi'
  const rotulo = d.adiantamento ? (recebi ? 'Adiantamento recebido' : 'Adiantamento dado') : recebi ? 'Recebi' : 'Paguei'
  const descricao = `${rotulo} · ${pessoa.nome}${d.descricao?.trim() ? ` · ${d.descricao.trim()}` : ''}`
  await moverConta(ctx, {
    pessoaId: pessoa.id,
    delta: recebi ? -valorPrincipal : valorPrincipal,
    tipo: d.adiantamento ? 'adiantamento' : recebi ? 'recebimento' : 'pagamento',
    origemId: d.id,
    forma: d.forma,
    descricao,
  })
  await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: recebi ? d.valor : -d.valor,
    tipo: recebi ? 'recebimento' : 'compra',
    origemId: d.id,
    descricao,
  })
  await auditar(ctx, 'registrarAcerto', pessoa.id, `${descricao}: ${d.valor} ${d.moeda}`)
  return { id: d.id }
}

/** Ajuste manual (ex.: desconto combinado, arredondamento, "não se fez conta"). Não mexe no caixa. */
export async function ajustarConta(ctx: Ctx, d: { id: Id; pessoaId: Id; delta: number; descricao: string }) {
  if ((await ctx.repos.movConta.listar({ origemId: d.id })).length) return { id: d.id }
  exigir(Number.isSafeInteger(d.delta) && d.delta !== 0, 'Valor inválido.')
  exigir(d.descricao?.trim(), 'Diga o motivo do ajuste.', 'descricao')
  await moverConta(ctx, { pessoaId: d.pessoaId, delta: d.delta, tipo: 'ajuste', origemId: d.id, descricao: d.descricao.trim() })
  await auditar(ctx, 'ajustarConta', d.pessoaId, `${d.delta} · ${d.descricao}`)
  return { id: d.id }
}

// ---------- consultas ----------

/** Todas as contas com saldo: quem me deve (a receber) e a quem devo (a pagar). */
export async function contas(ctx: Ctx, p: { somenteAbertas?: boolean } = {}) {
  const movs = await ctx.repos.movConta.listar()
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const porPessoa = new Map<Id, { saldo: number; ultimo: string; movimentos: number }>()
  for (const m of movs) {
    const a = porPessoa.get(m.pessoaId) ?? { saldo: 0, ultimo: '', movimentos: 0 }
    a.saldo += m.delta
    a.ultimo = m.data > a.ultimo ? m.data : a.ultimo
    a.movimentos++
    porPessoa.set(m.pessoaId, a)
  }
  const lista = [...porPessoa]
    .map(([pessoaId, a]) => ({ pessoaId, nome: pessoas.get(pessoaId)?.nome ?? '—', telefone: pessoas.get(pessoaId)?.telefone, ...a }))
    .filter((x) => !p.somenteAbertas || x.saldo !== 0)
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
  return {
    lista,
    aReceber: lista.filter((x) => x.saldo > 0).reduce((s, x) => s + x.saldo, 0),
    aPagar: -lista.filter((x) => x.saldo < 0).reduce((s, x) => s + x.saldo, 0),
  }
}

/** Extrato da conta de uma pessoa, com saldo linha a linha (como o caderno). */
export async function contaPessoa(ctx: Ctx, p: { pessoaId: Id }) {
  const cfg = await lerConfig(ctx)
  const movs = (await ctx.repos.movConta.listar({ pessoaId: p.pessoaId })).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  let saldo = 0
  const linhas = movs.map((m) => {
    saldo += m.delta
    return { ...m, saldo }
  })
  const pessoa = await ctx.repos.pessoas.obter(p.pessoaId)
  const texto =
    saldo > 0 ? `${pessoa?.nome} deve ${formatar(saldo, cfg.moedaPrincipal)}` : saldo < 0 ? `Você deve ${formatar(-saldo, cfg.moedaPrincipal)} a ${pessoa?.nome}` : 'Conta em dia'
  return { pessoa, linhas: linhas.reverse(), saldo, texto, moeda: cfg.moedaPrincipal }
}
