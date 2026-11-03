import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

/** Compra de cabelo bruto que vai até o estoque (vira um lote bruto). */
async function comprar(b: B, id: string, fornecedor: string, gramas: number) {
  await b.comando('salvarPessoa', { id: fornecedor, nome: fornecedor, papeis: ['fornecedor'] })
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: fornecedor, linhas: [{ id: `${id}-l`, quantidade: gramas, moeda: 'BOB', total: bs(gramas), campos: { estado: 'Bruto' } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(gramas) }] : undefined })
  return (await b.consulta('pedido', { id })).lotes[0].id
}
const parte = (id: string, g: number, cm = 60) => ({ id, quantidade: g, campos: { estado: 'Separado', comprimento: cm, categoria: 'Normal' } })
const vender = (b: B, id: string, linhas: [string, number][]) =>
  b.comando('concluirVenda', { id, linhas: linhas.map(([itemId, q], k) => ({ id: `${id}-${k}`, itemId, quantidade: q, moeda: 'BOB', total: bs(q) })), pagamentos: [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(linhas.reduce((s, [, q]) => s + q, 0)) }] })
const resumo = (o: { compraId: string; gramas: number }[]) => Object.fromEntries(o.map((x) => [x.compraId, x.gramas]))

describe('origem em gramas: de quais compras veio cada grama', () => {
  it('C1 10 kg → P1 2 kg, P2 2 kg, P3 6 kg; P4 = 2 kg do P3 + 4 kg de C2; venda 1 kg do P1 + 1,5 kg do P4', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'C1', 'Maria', 10000)
    const l2 = await comprar(b, 'C2', 'Celso', 4000)
    await b.comando('triarLotes', { id: 't1', ids: [l1], saidas: [parte('P1', 2000), parte('P2', 2000), parte('P3', 6000)] })
    // 2 kg do P3 vão para a mistura (o resto fica em P3b)
    await b.comando('triarLotes', { id: 't1b', ids: ['P3'], saidas: [parte('P3a', 2000), parte('P3b', 4000)] })
    await b.comando('triarLotes', { id: 't2', ids: ['P3a', l2] })
    const p4 = 't2'
    expect(resumo(await b.consulta('origemDoPacote', { itemId: p4 }))).toEqual({ C1: 2000, C2: 4000 })
    expect(resumo(await b.consulta('origemDoPacote', { itemId: 'P1' }))).toEqual({ C1: 2000 })
    expect(resumo(await b.consulta('origemDoPacote', { itemId: p4, gramas: 1500 }))).toEqual({ C1: 500, C2: 1000 })
    await vender(b, 'V9', [['P1', 1000], [p4, 1500]])
    const o = await b.consulta('origemDaVenda', { vendaId: 'V9' })
    // 1 kg via P1 + 0,5 kg via P4 = 1,5 kg de C1; 1 kg de C2 (via P4)
    expect(resumo(o)).toEqual({ C1: 1500, C2: 1000 })
    expect(o[0]).toMatchObject({ compraId: 'C1', fornecedor: 'Maria' })
    expect(o.find((x) => x.compraId === 'C2')?.fornecedor).toBe('Celso')
  })

  it('separar um lote juntado: cada parte herda a proporção da mistura (arredonda fechando o total)', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'C1', 'Maria', 6000)
    const l2 = await comprar(b, 'C2', 'Celso', 4000)
    // junta 6 + 4 e separa em 5 kg + 4,5 kg (perda 500 g)
    await b.comando('triarLotes', { id: 't', ids: [l1, l2], saidas: [parte('A', 5000), parte('B', 4500, 50)] })
    expect(resumo(await b.consulta('origemDoPacote', { itemId: 'A' }))).toEqual({ C1: 3000, C2: 2000 })
    expect(resumo(await b.consulta('origemDoPacote', { itemId: 'B' }))).toEqual({ C1: 2700, C2: 1800 })
    // separa A de novo e vende 333 g: 199,8 + 133,2 → 200 + 133
    await b.comando('triarLotes', { id: 't3', ids: ['A'], saidas: [parte('A1', 2500), parte('A2', 2500)] })
    await vender(b, 'v', [['A1', 333]])
    const o = await b.consulta('origemDaVenda', { vendaId: 'v' })
    expect(resumo(o)).toEqual({ C1: 200, C2: 133 })
    expect(o.reduce((s, x) => s + x.gramas, 0)).toBe(333)
  })

  it('venda sem lote de compra (serviço/cadastro) não tem origem; venda inexistente devolve vazio', async () => {
    const { b } = await novoBackend()
    expect(await b.consulta('origemDaVenda', { vendaId: 'nada' })).toEqual([])
    expect(await b.consulta('origemDoPacote', { itemId: 'nada' })).toEqual([])
  })
})
