// OPERAÇÃO CAOS — compra → triagem → estoque. Cada teste afirma o comportamento CORRETO; teste que falha = bug.
// Dados 100% fictícios, backends em memória isolados.
// Rodar: npx vitest run --config vitest.caos.config.ts caos/compras-estoque.caos.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../src/adapters/noAparelho'
import { bs, novoBackend } from '../src/__tests__/ajuda'
import { carregarDemo, SENHA_DEMO } from '../src/app/demo'
import { criarBackend } from '../src/app/criarBackend'
import { ErroNegocio } from '../src/core/domain/erros'
import { conferir, reposDe } from './integridade'

type B = BackendNoAparelho
const SEP = { estado: 'Separado', comprimento: 60, categoria: 'Normal' }
const saida = (id: string, quantidade: number, extra: Record<string, unknown> = {}) => ({ id, quantidade, campos: { ...SEP }, ...extra })

async function base() {
  const { b, r, sessao } = await novoBackend()
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(10_000_000), descricao: 'ini' } as any)
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora Ficticia', papeis: ['fornecedor'] } as any)
  return { b, r, sessao, repos: reposDe(b) }
}
const comprar = (b: B, id: string, g: number, valor: number, extra: Record<string, unknown> = {}) =>
  b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(valor), campos: { estado: 'Bruto' } }], ...extra } as any)
const loteDe = async (b: B, compraId: string): Promise<string> => (await reposDe(b).transacoes.obter(compraId)).linhas[0].itemId
const item = (b: B, id: string) => reposDe(b).itens.obter(id)
const vender = (b: B, id: string, itemId: string, q: number) =>
  b.comando('concluirVenda', { id, linhas: [{ id: id + 'l', itemId, quantidade: q, moeda: 'BOB', total: bs(q) }], pagamentos: [{ id: id + 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(q) }] } as any)
const pagar = (b: B, compraId: string, valor: number) => b.comando('pagarCompra', { compraId, pagamentos: [{ id: compraId + 'pg', forma: 'dinheiro', moeda: 'BOB', valor: bs(valor) }] } as any)
const caixaBOB = async (b: B) => (await reposDe(b).movCaixa.listar()).filter((m: any) => m.moeda === 'BOB').reduce((s: number, m: any) => s + m.delta, 0)
const somaSaldo = async (b: B, modulo = 'cabelo') => (await reposDe(b).itens.listar()).filter((i: any) => i.moduloId === modulo && i.controlaEstoque).reduce((s: number, i: any) => s + i.saldo, 0)

/** tenta; ErroNegocio (recusa do negócio) é aceito e devolvido; qualquer outro erro sobe */
async function tentar<T>(p: Promise<T>): Promise<{ ok: true; r: T } | { ok: false; e: ErroNegocio }> {
  try {
    return { ok: true, r: await p }
  } catch (e) {
    if (e instanceof ErroNegocio || (e as Error)?.name === 'ErroNegocio' || (e as any)?.constructor?.name === 'ErroNegocio') return { ok: false, e: e as ErroNegocio }
    throw e
  }
}

/** reconstrói o saldo de cada item pelo histórico: soma dos deltas e a corrente saldoAntes → saldoDepois sem buracos */
async function reconstruir(b: B): Promise<string[]> {
  const repos = reposDe(b)
  const probs: string[] = []
  const movs: any[] = await repos.movEstoque.listar()
  for (const i of (await repos.itens.listar()) as any[]) {
    if (!i.controlaEstoque) continue
    // ordem de gravação (id ULID): a demo grava movimentos com data retroativa, então criadoEm não serve de ordem
    const ms = movs.filter((m) => m.itemId === i.id).sort((a, c) => (a.id < c.id ? -1 : a.id > c.id ? 1 : 0))
    const soma = ms.reduce((s, m) => s + m.delta, 0)
    if (soma !== i.saldo) probs.push(`${i.codigo ?? i.id}: saldo ${i.saldo} ≠ Σmov ${soma}`)
    let ant = 0
    for (const m of ms) {
      if (m.saldoAntes !== ant) probs.push(`${i.codigo ?? i.id}: mov ${m.id} saldoAntes ${m.saldoAntes} ≠ anterior ${ant}`)
      if (m.saldoAntes + m.delta !== m.saldoDepois) probs.push(`${i.codigo ?? i.id}: mov ${m.id} conta errada`)
      ant = m.saldoDepois
    }
    if (ms.length && ant !== i.saldo) probs.push(`${i.codigo ?? i.id}: último saldoDepois ${ant} ≠ saldo ${i.saldo}`)
  }
  return probs
}

async function integro(b: B) {
  expect(await conferir(b)).toEqual([])
  expect(await reconstruir(b)).toEqual([])
}

// =====================================================================================================================
describe('CAOS compras', () => {
  it('C01 mesma compra (mesmo id) duas vezes: 1 transação, 1 lote, saldo não dobra', async () => {
    const { b, repos } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c1', 5000, 9000) // retentativa com dados diferentes: deve ser ignorada
    const compras = (await repos.transacoes.listar({ tipo: 'compra' })).filter((t: any) => t.id === 'c1')
    expect(compras).toHaveLength(1)
    expect(compras[0].totalPrincipal).toBe(bs(1000))
    expect(await somaSaldo(b)).toBe(1000)
    expect((await repos.itens.listar()).filter((i: any) => i.origem?.id === 'c1')).toHaveLength(1)
    await integro(b)
  })

  it('C02 duas compras com o mesmo código digitado: a 2ª é recusada; lotes com código repetido idem', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000, { codigo: 'ZZ9' })
    const r2 = await tentar(comprar(b, 'c2', 1000, 1000, { codigo: 'ZZ9' }))
    expect(r2.ok).toBe(false)
    const r3 = await tentar(b.comando('criarCompra', { id: 'c3', moduloId: 'cabelo', pessoaId: 'f', codigosLotes: { a: 'LX1', b2: 'LX1' }, linhas: [{ id: 'a', quantidade: 10, moeda: 'BOB', total: 0, campos: { estado: 'Bruto' } }, { id: 'b2', quantidade: 10, moeda: 'BOB', total: 0, campos: { estado: 'Bruto' } }] } as any))
    expect(r3.ok).toBe(false)
    expect(await reposDe(b).transacoes.obter('c2')).toBeFalsy()
    expect(await reposDe(b).transacoes.obter('c3')).toBeFalsy()
    await integro(b)
  })

  it('C03 valores zero/negativo/fração/enormes são recusados e nada fica gravado', async () => {
    const { b, repos } = await base()
    const casos: [number, number][] = [[0, 10], [-5, 10], [10.5, 10], [10_000_000_001, 10], [Number.MAX_SAFE_INTEGER, 10], [100, -1], [100, 0.5], [100, 100_000_000_001], [NaN, 10]]
    for (const [k, [g, v]] of casos.entries()) {
      const r = await tentar(b.comando('criarCompra', { id: `x${k}`, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: g, moeda: 'BOB', total: v, campos: { estado: 'Bruto' } }] } as any))
      expect(r.ok, `caso ${g} g / ${v}`).toBe(false)
    }
    expect(await repos.transacoes.listar({ tipo: 'compra' })).toHaveLength(0)
    expect(await somaSaldo(b)).toBe(0)
    await integro(b)
  })

  it('C04 conferirPesoCompra acima e abaixo do comprado: saldo acompanha o último peso, fechamento confere', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 1100, motivo: 'balança' } as any)
    expect((await item(b, L)).saldo).toBe(1100)
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 900, motivo: 'repesou' } as any)
    expect((await item(b, L)).saldo).toBe(900)
    // mesmo peso de novo: recusado (não lança de novo)
    expect((await tentar(b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 900, motivo: 'repetido' } as any))).ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(900)
    const p = await b.consulta('pedido' as any, { id: 'c1' } as any)
    expect(p.fechamento.confere).toBe(true)
    await integro(b)
  })

  it('C05 conferirPesoCompra com peso absurdo (acima do limite de quantidade da compra) é recusado', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    const r = await tentar(b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 9_000_000_000_000_000, motivo: 'dedo gordo' } as any))
    expect(r.ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(1000)
  })

  it('C06 peso a mais na conferência NÃO pode criar custo do nada (custo dos pacotes ≤ valor pago)', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 1100, motivo: 'veio mais' } as any)
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1100, saidas: [saida('s1', 1100)] } as any)
    const s1 = await item(b, 's1')
    expect(s1.saldo).toBe(1100)
    // pagou Bs 1.000 por todo o cabelo: o custo total do que saiu da triagem não pode passar disso
    expect(s1.custoPrincipal).toBeLessThanOrEqual(bs(1000))
    await integro(b)
  })

  it('C07 peso a menos na conferência: o custo pago segue inteiro para os pacotes (não some)', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 900, motivo: 'veio menos' } as any)
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 900, saidas: [saida('s1', 900)] } as any)
    expect((await item(b, 's1')).custoPrincipal).toBe(bs(1000))
  })

  it('C08 avançar até concluído duas vezes / pagarCompra duas vezes: caixa sai uma vez só', async () => {
    const { b } = await base()
    const antes = await caixaBOB(b)
    await comprar(b, 'c1', 1000, 1000)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido' } as any)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido' } as any)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [{ id: 'p1', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [{ id: 'p1', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'concluido' } as any)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'concluido' } as any)
    await pagar(b, 'c1', 1000)
    expect(await caixaBOB(b)).toBe(antes - bs(1000))
    expect(await somaSaldo(b)).toBe(1000)
    const t = await reposDe(b).transacoes.obter('c1')
    expect(t.etapa).toBe('concluido')
    expect(t.pagamentos).toHaveLength(1)
    // depois de concluída não volta etapa
    expect((await tentar(b.comando('avancarTriagem', { compraId: 'c1', para: 'recebido' } as any))).ok).toBe(false)
    await integro(b)
  })

  it('C09 cancelar compra paga e intacta: caixa volta, conta zera, lote zera; cancelar 2× é recusado', async () => {
    const { b, repos } = await base()
    const antes = await caixaBOB(b)
    await comprar(b, 'c1', 1000, 1000)
    await pagar(b, 'c1', 1000)
    await b.comando('cancelarCompra', { compraId: 'c1', motivo: 'desistiu' } as any)
    expect((await tentar(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'de novo' } as any))).ok).toBe(false)
    expect(await caixaBOB(b)).toBe(antes)
    expect(await somaSaldo(b)).toBe(0)
    const conta = (await repos.movConta.listar({ pessoaId: 'f' })).reduce((s: number, m: any) => s + m.delta, 0)
    expect(conta).toBe(0)
    await integro(b)
  })

  it('C10 cancelar compra com lote já separado ou parte vendida: recusado, nada muda', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await pagar(b, 'c1', 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 600, saidas: [saida('s1', 580)] } as any)
    await vender(b, 'v1', L, 100) // vende direto do bruto
    const caixa = await caixaBOB(b)
    expect((await tentar(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'x' } as any))).ok).toBe(false)
    expect((await tentar(b.comando('avancarTriagem', { compraId: 'c1', para: 'recusado', motivo: 'x' } as any))).ok).toBe(false)
    expect((await reposDe(b).transacoes.obter('c1')).etapa).toBe('concluido')
    expect(await caixaBOB(b)).toBe(caixa)
    expect((await item(b, L)).saldo).toBe(300)
    expect((await item(b, 's1')).saldo).toBe(580)
    await integro(b)
  })

  it('C11 desfez a triagem ("volta tudo como estava"): a compra pode ser cancelada de novo', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1000, saidas: [saida('s1', 500), saida('s2', 450)] } as any)
    await b.comando('desfazerTriagem', { triagemId: 't1', motivo: 'pesei errado' } as any)
    expect((await item(b, L)).saldo).toBe(1000)
    const r = await tentar(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'fornecedora levou de volta' } as any))
    expect(r.ok ? 'ok' : (r as any).e.message).toBe('ok')
    expect(await somaSaldo(b)).toBe(0)
    await integro(b)
  })

  it('C12 vendeu do lote e cancelou a venda (saiu e voltou = zero): a compra pode ser cancelada', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await vender(b, 'v1', L, 200)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'cliente desistiu' } as any)
    expect((await item(b, L)).saldo).toBe(1000)
    const r = await tentar(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'devolvida' } as any))
    expect(r.ok ? 'ok' : (r as any).e.message).toBe('ok')
    await integro(b)
  })

  it('C13 corrigir valor (definirValorCompra) depois de separar e vender: o custo da venda acompanha a fração', async () => {
    const { b, repos } = await base()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', semValor: true, linhas: [{ id: 'c1l', quantidade: 3000, moeda: 'BOB', total: 0, campos: { estado: 'Bruto', semValor: true } }] } as any)
    const L = await loteDe(b, 'c1')
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 3000, saidas: [saida('s1', 2000), saida('s2', 1000)] } as any)
    await vender(b, 'v1', 's1', 500)
    await b.comando('definirValorCompra', { compraId: 'c1', linhaId: 'c1l', total: bs(3000), motivo: 'chegou a nota' } as any)
    expect((await item(b, 's1')).custoPrincipal).toBe(bs(2000))
    expect((await item(b, 's2')).custoPrincipal).toBe(bs(1000))
    expect((await repos.transacoes.obter('v1')).linhas[0].custoPrincipal).toBe(bs(500))
    await integro(b)
  })

  it('C14 compra de catálogo: recebimento parcial (8 de 10) entra 8; cancelar com parte vendida é recusado', async () => {
    const { b } = await base()
    await b.comando('salvarItem', { id: 'p1', moduloId: 'produtos', tipoItem: 'peca', nome: 'Peça Ficticia' } as any)
    await b.comando('criarCompra', { id: 'k1', moduloId: 'produtos', pessoaId: 'f', linhas: [{ id: 'k1l', itemId: 'p1', quantidade: 10, moeda: 'BOB', total: bs(100) }] } as any)
    await b.comando('avancarTriagem', { compraId: 'k1', para: 'pago', ajustes: [{ linhaId: 'k1l', quantidade: 8 }], motivo: 'vieram 8', pagamentos: [{ id: 'kp', forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] } as any)
    await b.comando('avancarTriagem', { compraId: 'k1', para: 'concluido' } as any)
    expect((await item(b, 'p1')).saldo).toBe(8)
    await vender(b, 'v1', 'p1', 3)
    expect((await tentar(b.comando('cancelarCompra', { compraId: 'k1', motivo: 'x' } as any))).ok).toBe(false)
    expect((await item(b, 'p1')).saldo).toBe(5)
    await integro(b)
  })

  it('C15 catálogo: cancelar a 2ª compra tira o custo dela do custo médio (venda seguinte com o custo certo)', async () => {
    const { b, repos } = await base()
    await b.comando('salvarItem', { id: 'p1', moduloId: 'produtos', tipoItem: 'peca', nome: 'Peça Ficticia' } as any)
    for (const [id, v] of [['k1', 100], ['k2', 300]] as const) {
      await b.comando('criarCompra', { id, moduloId: 'produtos', pessoaId: 'f', linhas: [{ id: id + 'l', itemId: 'p1', quantidade: 10, moeda: 'BOB', total: bs(v) }] } as any)
      await pagar(b, id, v)
    }
    expect((await item(b, 'p1')).saldo).toBe(20)
    await b.comando('cancelarCompra', { compraId: 'k2', motivo: 'devolvi as 10 caras' } as any)
    expect((await item(b, 'p1')).saldo).toBe(10)
    await vender(b, 'v1', 'p1', 10)
    // as 10 que ficaram custaram Bs 100 no total
    expect((await repos.transacoes.obter('v1')).linhas[0].custoPrincipal).toBe(bs(100))
    await integro(b)
  })

  it('C16 compra parcialmente paga no registro e depois cancelada: estorno exato, conta zerada', async () => {
    const { b, repos } = await base()
    const antes = await caixaBOB(b)
    await b.comando('criarCompra', {
      id: 'c1', moduloId: 'cabelo', pessoaId: 'f',
      linhas: [{ id: 'a', quantidade: 1000, moeda: 'BOB', total: bs(500), campos: { estado: 'Bruto', jaPaga: true } }, { id: 'b2', quantidade: 1000, moeda: 'BOB', total: bs(700), campos: { estado: 'Bruto' } }],
      pagoParcial: [{ id: 'pp', forma: 'dinheiro', moeda: 'BOB', valor: bs(500) }],
    } as any)
    expect((await tentar(b.comando('avancarTriagem', { compraId: 'c1', para: 'recusado', motivo: 'x' } as any))).ok).toBe(false)
    await b.comando('cancelarCompra', { compraId: 'c1', motivo: 'desfeito' } as any)
    expect(await caixaBOB(b)).toBe(antes)
    expect((await repos.movConta.listar({ pessoaId: 'f' })).reduce((s: number, m: any) => s + m.delta, 0)).toBe(0)
    expect(await somaSaldo(b)).toBe(0)
    await integro(b)
  })
})

// =====================================================================================================================
describe('CAOS triagem', () => {
  it('T01 triarLotes repetido (mesmo id): uma triagem só', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    const cmd = { id: 't1', ids: [L], quantidadeUsada: 600, saidas: [saida('s1', 590)] }
    await b.comando('triarLotes', cmd as any)
    await b.comando('triarLotes', cmd as any)
    expect((await item(b, L)).saldo).toBe(400)
    expect(await somaSaldo(b)).toBe(990)
    await integro(b)
  })

  it('T02 separarLote repetido com o MESMO id de separação (ids das partes regerados na retentativa): não separa duas vezes', async () => {
    const { b, repos } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('separarLote', { id: 'sep1', loteId: L, quantidadeUsada: 400, saidas: [saida('a1', 400)] } as any)
    await tentar(b.comando('separarLote', { id: 'sep1', loteId: L, quantidadeUsada: 400, saidas: [saida('a2', 400)] } as any))
    expect((await item(b, L)).saldo).toBe(600)
    expect((await repos.itens.listar()).filter((i: any) => i.campos?.separacaoId === 'sep1')).toHaveLength(1)
    await integro(b)
  })

  it('T03 separar mais do que o lote tem / partes > usado: recusado, nada muda', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    expect((await tentar(b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1001, saidas: [saida('s1', 1001)] } as any))).ok).toBe(false)
    expect((await tentar(b.comando('triarLotes', { id: 't2', ids: [L], quantidadeUsada: 500, saidas: [saida('s2', 300), saida('s3', 201)] } as any))).ok).toBe(false)
    expect((await tentar(b.comando('triarLotes', { id: 't3', ids: [L], quantidadeUsada: 500, saidas: [saida('s4', 0)] } as any))).ok).toBe(false)
    expect((await tentar(b.comando('triarLotes', { id: 't4', ids: [L], quantidadeUsada: 500, saidas: [saida('s5', -10)] } as any))).ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(1000)
    expect(await item(b, 's1')).toBeFalsy()
    expect(await item(b, 's2')).toBeFalsy()
    await integro(b)
  })

  it('T04 partes < usado: a diferença é perda e as gramas fecham (entrou = saiu + estoque + perda)', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1000, saidas: [saida('s1', 333), saida('s2', 333), saida('s3', 300)] } as any)
    expect(await somaSaldo(b)).toBe(966)
    // custo dividido sem perder centavo: soma dos custos = custo do usado
    const custos = await Promise.all(['s1', 's2', 's3'].map(async (x) => (await item(b, x)).custoPrincipal))
    expect(custos.reduce((s, c) => s + c, 0)).toBe(bs(1000))
    const p = await b.consulta('pedido' as any, { id: 'c1' } as any)
    expect(p.fechamento).toMatchObject({ comprado: 1000, pacotes: 966, perda: 34, confere: true })
    await integro(b)
  })

  it('T05 partes com o MESMO id repetido: recusado ou as gramas se conservam (nunca some cabelo)', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await tentar(b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1000, saidas: [saida('dup', 600), saida('dup', 400)] } as any))
    expect(await somaSaldo(b)).toBe(1000)
    await integro(b)
  })

  it('T06 parte com o id de um pacote que JÁ EXISTE (outra compra): recusado; o pacote existente fica intacto', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c2', 2000, 2000)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    await tentar(b.comando('triarLotes', { id: 't1', ids: [L1], quantidadeUsada: 500, saidas: [saida(L2, 500)] } as any))
    const l2 = await item(b, L2)
    expect(l2.saldo).toBe(2000)
    expect(l2.origem).toMatchObject({ tipo: 'compra', id: 'c2' })
    expect(await somaSaldo(b)).toBe(3000)
    await integro(b)
  })

  it('T07 parte com o id do PRÓPRIO pacote de entrada: recusado; nada some', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await tentar(b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 500, saidas: [saida(L, 500)] } as any))
    expect(await somaSaldo(b)).toBe(1000)
    expect((await item(b, L)).origem).toMatchObject({ tipo: 'compra', id: 'c1' })
    await integro(b)
  })

  it('T08 separarLote com id de parte que já existe (pacote de outra compra): não pode dizer "ok" sem separar', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c2', 2000, 2000)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    const r = await tentar(b.comando('separarLote', { id: 'sepX', loteId: L1, quantidadeUsada: 500, saidas: [saida(L2, 500)] } as any))
    // correto: ou recusa, ou separou de verdade (o lote L1 baixou)
    if (r.ok) expect((await item(b, L1)).saldo).toBe(500)
    expect((await item(b, L2)).saldo).toBe(2000)
    await integro(b)
  })

  it('T09 unificarLotes com id de um pacote existente: não pode dizer "ok" sem unificar', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c2', 2000, 2000)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    const r = await tentar(b.comando('unificarLotes', { id: L1, ids: [L1, L2] } as any))
    if (r.ok) expect((await item(b, L2)).saldo).toBe(0)
    await integro(b)
  })

  it('T10 separar lote que está numa venda em aberto: a venda em aberto não fecha com mais do que sobrou', async () => {
    const { b, repos } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('salvarVendaAberta', { id: 'va1', linhas: [{ id: 'x', itemId: L, quantidade: 800 }] } as any)
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 500, saidas: [saida('s1', 500)] } as any)
    expect((await tentar(vender(b, 'va1', L, 800))).ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(500)
    expect(await repos.transacoes.obter('va1')).toBeFalsy()
    await integro(b)
  })

  it('T11 separar lote que acabou de ser vendido inteiro: recusado', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await vender(b, 'v1', L, 1000)
    expect((await tentar(b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 100, saidas: [saida('s1', 100)] } as any))).ok).toBe(false)
    expect(await somaSaldo(b)).toBe(0)
    await integro(b)
  })

  it('T12 unificar e depois vender uma das fontes: recusado (a fonte ficou sem saldo)', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c2', 500, 800)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    await b.comando('unificarLotes', { id: 'u1', ids: [L1, L2] } as any)
    expect((await tentar(vender(b, 'v1', L1, 10))).ok).toBe(false)
    const u = await item(b, 'u1')
    expect(u.saldo).toBe(1500)
    expect(u.custoPrincipal).toBe(bs(1800))
    for (const c of ['c1', 'c2']) expect((await b.consulta('pedido' as any, { id: c } as any)).fechamento.confere).toBe(true)
    await integro(b)
  })

  it('T13 cancelar compra cujo lote foi dividido em filhos: recusado; filhos e mãe intactos', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await pagar(b, 'c1', 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1000, saidas: [saida('s1', 600), saida('s2', 400)] } as any)
    const caixa = await caixaBOB(b)
    expect((await tentar(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'x' } as any))).ok).toBe(false)
    expect(await caixaBOB(b)).toBe(caixa)
    expect(await somaSaldo(b)).toBe(1000)
    await integro(b)
  })

  it('T14 desfazer triagem com filho vendido é recusado; cancelando a venda, desfaz e as gramas voltam', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1000, saidas: [saida('s1', 600), saida('s2', 350)] } as any)
    await vender(b, 'v1', 's1', 100)
    expect((await tentar(b.comando('desfazerTriagem', { triagemId: 't1', motivo: 'x' } as any))).ok).toBe(false)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'voltou' } as any)
    await b.comando('desfazerTriagem', { triagemId: 't1', motivo: 'pesei errado' } as any)
    expect((await item(b, L)).saldo).toBe(1000)
    expect(await somaSaldo(b)).toBe(1000)
    expect((await tentar(b.comando('desfazerTriagem', { triagemId: 't1', motivo: '2x' } as any))).ok).toBe(false)
    expect((await b.consulta('pedido' as any, { id: 'c1' } as any)).fechamento.confere).toBe(true)
    await integro(b)
  })

  it('T15 triar juntando + separando (2 compras) e desfazer: tudo volta às fontes', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c2', 700, 700)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    await b.comando('triarLotes', { id: 't1', ids: [L1, L2], quantidadeUsada: 1700, saidas: [saida('s1', 1000), saida('s2', 650)] } as any)
    expect(await somaSaldo(b)).toBe(1650)
    for (const c of ['c1', 'c2']) expect((await b.consulta('pedido' as any, { id: c } as any)).fechamento.confere).toBe(true)
    await b.comando('desfazerTriagem', { triagemId: 't1', motivo: 'errado' } as any)
    expect((await item(b, L1)).saldo).toBe(1000)
    expect((await item(b, L2)).saldo).toBe(700)
    expect(await somaSaldo(b)).toBe(1700)
    await integro(b)
  })

  it('T16 ordem aleatória (semente fixa, 150 passos): gramas conservadas, histórico bate, fechamento de cada compra confere', async () => {
    const { b, repos } = await base()
    let s = 20261105
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
    let comprado = 0
    for (let k = 0; k < 5; k++) {
      const g = 500 + Math.floor(rnd() * 3000)
      await comprar(b, `c${k}`, g, 100 + Math.floor(rnd() * 5000))
      comprado += g
    }
    let vendido = 0
    let perda = 0
    const perdaTriagem = new Map<string, number>()
    const vendas = new Map<string, number>()
    let n = 0
    for (let passo = 0; passo < 150; passo++) {
      const itens = ((await repos.itens.listar()) as any[]).filter((i) => i.moduloId === 'cabelo' && i.ativo && i.saldo > 0)
      if (!itens.length) break
      const op = rnd()
      if (op < 0.35) {
        const lote = pick(itens)
        const usado = 1 + Math.floor(rnd() * lote.saldo)
        const perdaAqui = Math.floor(rnd() * usado * 0.1)
        const partes = 1 + Math.floor(rnd() * 3)
        let resto = usado - perdaAqui
        const saidas = []
        for (let p = 0; p < partes && resto > 0; p++) {
          const q = p === partes - 1 ? resto : Math.max(1, Math.floor(resto / 2))
          saidas.push(saida(`s${n++}`, q))
          resto -= q
        }
        const id = `t${n++}`
        const r = await tentar(b.comando('triarLotes', { id, ids: [lote.id], quantidadeUsada: usado, saidas } as any))
        if (r.ok) { perda += perdaAqui; perdaTriagem.set(id, perdaAqui) }
      } else if (op < 0.45) {
        const brutos = itens.filter((i) => i.campos.estado === 'Bruto')
        if (brutos.length >= 2) {
          const a = pick(brutos)
          const c = pick(brutos.filter((x) => x.id !== a.id))
          const id = `t${n++}`
          const r = await tentar(b.comando('triarLotes', { id, ids: [a.id, c.id] } as any))
          if (r.ok) perdaTriagem.set(id, 0)
        }
      } else if (op < 0.7) {
        const lote = pick(itens)
        const q = 1 + Math.floor(rnd() * lote.saldo)
        const id = `v${n++}`
        const r = await tentar(vender(b, id, lote.id, q))
        if (r.ok) { vendido += q; vendas.set(id, q) }
      } else if (op < 0.8) {
        if (vendas.size) {
          const id = pick([...vendas.keys()])
          const r = await tentar(b.comando('cancelarVenda', { id, motivo: 'caos' } as any))
          if (r.ok) { vendido -= vendas.get(id)!; vendas.delete(id) }
        }
      } else if (op < 0.9) {
        if (perdaTriagem.size) {
          const id = pick([...perdaTriagem.keys()])
          const r = await tentar(b.comando('desfazerTriagem', { triagemId: id, motivo: 'caos' } as any))
          if (r.ok) { perda -= perdaTriagem.get(id)!; perdaTriagem.delete(id) }
        }
      } else {
        const lote = pick(itens)
        const x = 1 + Math.floor(rnd() * Math.min(50, lote.saldo))
        const r = await tentar(b.comando('ajustarEstoque', { itemId: lote.id, novoSaldo: lote.saldo - x, motivo: 'perda', descricao: 'caos' } as any))
        if (r.ok) perda += x
      }
    }
    expect(await somaSaldo(b)).toBe(comprado - vendido - perda)
    for (let k = 0; k < 5; k++) {
      const f = (await b.consulta('pedido' as any, { id: `c${k}` } as any)).fechamento
      expect(f.confere, `fechamento c${k}: ${JSON.stringify(f)}`).toBe(true)
    }
    await integro(b)
  })

  it('T17 cadeia separar → juntar → separar → vender → cancelar venda: gramas e custo conservados', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 2000, 2000)
    await comprar(b, 'c2', 1000, 3000)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    // 1ª separação deixa parte "para depois" (não identificado = bruto, pode juntar)
    await b.comando('triarLotes', { id: 't1', ids: [L1], quantidadeUsada: 2000, saidas: [saida('a1', 1200)], paraDepois: { id: 'nd1', quantidade: 700 } } as any)
    await b.comando('triarLotes', { id: 't2', ids: ['nd1', L2] } as any)
    await b.comando('triarLotes', { id: 't3', ids: ['t2'], quantidadeUsada: 1700, saidas: [saida('b1', 900), saida('b2', 750)] } as any)
    await vender(b, 'v1', 'b1', 900)
    await vender(b, 'v2', 'a1', 200)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'voltou' } as any)
    // entrou 3000; perdas 100 (t1) + 50 (t3); vendido 200
    expect(await somaSaldo(b)).toBe(3000 - 150 - 200)
    for (const c of ['c1', 'c2']) {
      const f = (await b.consulta('pedido' as any, { id: c } as any)).fechamento
      expect(f.confere, JSON.stringify(f)).toBe(true)
    }
    // custo: o que sobrou + vendido não passa do total pago (Bs 5.000)
    const itens = ((await reposDe(b).itens.listar()) as any[]).filter((i) => i.moduloId === 'cabelo')
    const custoEstoque = itens.reduce((s, i) => s + (i.saldo && i.quantidadeInicial ? Math.round((i.custoPrincipal * i.saldo) / i.quantidadeInicial) : 0), 0)
    const custoVendido = (await reposDe(b).transacoes.obter('v2')).linhas[0].custoPrincipal
    expect(custoEstoque + custoVendido).toBeLessThanOrEqual(bs(5000) + 5)
    await integro(b)
  })
})

// =====================================================================================================================
describe('CAOS estoque', () => {
  it('E01 ajustarEstoque para negativo, fração, acima do limite: recusado', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    for (const v of [-1, 1.5, 10_000_000_001, NaN]) expect((await tentar(b.comando('ajustarEstoque', { itemId: L, novoSaldo: v, motivo: 'ajuste' } as any))).ok, String(v)).toBe(false)
    expect((await tentar(b.comando('ajustarEstoque', { itemId: L, novoSaldo: 1200, motivo: 'perda' } as any))).ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(1000)
    await integro(b)
  })

  it('E02 o mesmo ajuste duas vezes (toque repetido): um movimento só', async () => {
    const { b, repos } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('ajustarEstoque', { itemId: L, novoSaldo: 950, motivo: 'perda', descricao: 'caiu' } as any)
    await tentar(b.comando('ajustarEstoque', { itemId: L, novoSaldo: 950, motivo: 'perda', descricao: 'caiu' } as any))
    expect((await item(b, L)).saldo).toBe(950)
    expect((await repos.movEstoque.listar({ itemId: L })).filter((m: any) => m.motivo === 'perda')).toHaveLength(1)
    await integro(b)
  })

  it('E03 ajuste com venda em aberto: a venda não fecha acima do saldo novo', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    await b.comando('salvarVendaAberta', { id: 'va1', linhas: [{ id: 'x', itemId: L, quantidade: 900 }] } as any)
    await b.comando('ajustarEstoque', { itemId: L, novoSaldo: 500, motivo: 'perda' } as any)
    expect((await tentar(vender(b, 'va1', L, 900))).ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(500)
    await integro(b)
  })

  it('E04 venda com 2 linhas do mesmo pacote passando do saldo: recusada inteira (tudo ou nada)', async () => {
    const { b, repos } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    const caixa = await caixaBOB(b)
    const r = await tentar(b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'a', itemId: L, quantidade: 600, moeda: 'BOB', total: bs(600) }, { id: 'b', itemId: L, quantidade: 600, moeda: 'BOB', total: bs(600) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1200) }] } as any))
    expect(r.ok).toBe(false)
    expect((await item(b, L)).saldo).toBe(1000)
    expect(await caixaBOB(b)).toBe(caixa)
    expect(await repos.transacoes.obter('v1')).toBeFalsy()
    await integro(b)
  })

  it('E05 funcionária não separa, não junta, não ajusta, não cancela compra (demo)', async () => {
    const { backend, sessao } = criarBackend({ tipo: 'memory' })
    const b = backend as B
    await carregarDemo(b)
    Object.assign(sessao, await b.entrar('admin', SENHA_DEMO))
    const lote = ((await reposDe(b).itens.listar()) as any[]).find((i) => i.moduloId === 'cabelo' && i.ativo && i.saldo > 100)
    const compra = ((await reposDe(b).transacoes.listar({ tipo: 'compra' })) as any[]).find((t) => t.etapa !== 'cancelado')
    Object.assign(sessao, await b.entrar('sofia', SENHA_DEMO))
    const saldo = lote.saldo
    for (const [nome, d] of [
      ['ajustarEstoque', { itemId: lote.id, novoSaldo: 1, motivo: 'perda' }],
      ['triarLotes', { id: 'tx', ids: [lote.id], quantidadeUsada: 10, saidas: [saida('sx', 10)] }],
      ['separarLote', { id: 'sx2', loteId: lote.id, quantidadeUsada: 10, saidas: [saida('sx3', 10)] }],
      ['cancelarCompra', { compraId: compra.id, motivo: 'x' }],
      ['conferirPesoCompra', { compraId: compra.id, linhaId: compra.linhas[0].id, pesado: 1, motivo: 'x' }],
      ['criarCompra', { id: 'cx', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10, moeda: 'BOB', total: 0, campos: { estado: 'Bruto' } }] }],
    ] as const) expect((await tentar(b.comando(nome as any, d as any))).ok, nome).toBe(false)
    expect((await reposDe(b).itens.obter(lote.id)).saldo).toBe(saldo)
  })

  it('E06 demo + caos: saldo de TODO item reconstruído pelo histórico de movimentos e conferidor limpo', async () => {
    const { backend, sessao } = criarBackend({ tipo: 'memory' })
    const b = backend as B
    await carregarDemo(b)
    Object.assign(sessao, await b.entrar('admin', SENHA_DEMO))
    await integro(b)
    // mexe: separa o 1º bruto com saldo, vende parte de um separado, ajusta, cancela a venda
    const itens = ((await reposDe(b).itens.listar()) as any[]).filter((i) => i.moduloId === 'cabelo' && i.ativo && i.saldo > 50)
    const bruto = itens.find((i) => i.campos.estado === 'Bruto')
    if (bruto) await b.comando('triarLotes', { id: 'tcaos', ids: [bruto.id], quantidadeUsada: bruto.saldo, saidas: [saida('scaos1', Math.floor(bruto.saldo / 2)), saida('scaos2', Math.floor(bruto.saldo / 3))] } as any)
    const sep = itens.find((i) => i.campos.estado === 'Separado')
    if (sep) {
      await vender(b, 'vcaos', sep.id, Math.min(30, sep.saldo))
      await b.comando('cancelarVenda', { id: 'vcaos', motivo: 'caos' } as any)
      await b.comando('ajustarEstoque', { itemId: sep.id, novoSaldo: sep.saldo - 1, motivo: 'perda' } as any)
    }
    await integro(b)
    // fechamento de toda compra de cabelo não cancelada confere
    for (const t of ((await reposDe(b).transacoes.listar({ tipo: 'compra' })) as any[]).filter((t) => t.moduloId === 'cabelo' && !['cancelado', 'recusado'].includes(t.etapa))) {
      const f = (await b.consulta('pedido' as any, { id: t.id } as any)).fechamento
      if (f) expect(f.confere, `${t.codigo}: ${JSON.stringify(f)}`).toBe(true)
    }
  })

  it('E07 lavagem (moverFaseTriagem com peso depois) maior que o antes: recusada; menor vira perda', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    const L = await loteDe(b, 'c1')
    const cols = (await b.consulta('fluxosTriagem' as any, {} as any)) as any
    const colunas: any[] = (Array.isArray(cols) ? cols : cols?.fluxos ?? []).flatMap((f: any) => f.colunas ?? [])
    const destino = colunas.find((c) => c.id !== 'vendido' && !c.entrada)?.id
    expect(destino, 'há uma coluna de destino').toBeTruthy()
    expect((await tentar(b.comando('moverFaseTriagem', { ids: [L], fase: destino, pesos: { [L]: 1200 } } as any))).ok).toBe(false)
    await b.comando('moverFaseTriagem', { ids: [L], fase: destino, pesos: { [L]: 940 } } as any)
    expect((await item(b, L)).saldo).toBe(940)
    expect((await b.consulta('pedido' as any, { id: 'c1' } as any)).fechamento.confere).toBe(true)
    await integro(b)
  })

  it('E08 unificar lote com peso conferido a mais: custo do juntado ≤ valor pago', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 1000, 1000)
    await comprar(b, 'c2', 1000, 1000)
    const L1 = await loteDe(b, 'c1')
    const L2 = await loteDe(b, 'c2')
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 1500, motivo: 'veio mais' } as any)
    await b.comando('unificarLotes', { id: 'u1', ids: [L1, L2] } as any)
    const u = await item(b, 'u1')
    expect(u.saldo).toBe(2500)
    expect(u.custoPrincipal).toBeLessThanOrEqual(bs(2000))
  })
})
