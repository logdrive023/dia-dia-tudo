// PAGAR E CONCLUIR: a compra normal é paga no ato — um toque paga e leva até Concluído (o caixa e a conta batem);
// "pagar no ato" já no registro; pagar depois continua possível (etapa por etapa).
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('compra paga no ato', () => {
  it('registrar já pago: vai direto para Concluído, o caixa sai e nada fica pendente de pagamento', async () => {
    const { b, r } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(20000), descricao: 'ini' })
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 3000, moeda: 'BOB', total: bs(15000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(15000) }] })
    const p = await b.consulta('pedido', { id: 'c1' })
    expect(p.compra.etapa).toBe('concluido')
    expect(p.pago).toBe(bs(15000))
    expect((await b.consulta('caixaDoDia', { data: r.hoje })).contas.find((c) => c.moeda === 'BOB')!.total).toBe(bs(5000))
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('"Pagar e concluir" de uma compra que chegou sem pagar: um comando só, repetido não paga duas vezes', async () => {
    const { b, r } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(20000), descricao: 'ini' })
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 3000, moeda: 'BOB', total: bs(15000), campos: { estado: 'Bruto' } }] })
    expect((await b.consulta('pedido', { id: 'c1' })).compra.etapa).not.toBe('concluido')
    const pag = { compraId: 'c1', pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(15000) }] }
    await b.comando('pagarCompra', pag)
    await b.comando('pagarCompra', pag)
    expect((await b.consulta('pedido', { id: 'c1' })).compra.etapa).toBe('concluido')
    expect((await b.consulta('caixaDoDia', { data: r.hoje })).contas.find((c) => c.moeda === 'BOB')!.total).toBe(bs(5000))
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })
})
