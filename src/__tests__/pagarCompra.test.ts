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

describe('compra já paga sem valor (só catalogar)', () => {
  it('marcou "já paga" numa compra sem valor: entra concluída, sem mexer no caixa', async () => {
    const { b, r } = await novoBackend()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', semValor: true, linhas: [{ id: 'l', quantidade: 2000, moeda: 'BOB', total: 0, campos: { estado: 'Bruto', semValor: true } }], pagarNoAto: [] })
    expect((await b.consulta('pedido', { id: 'c1' })).compra.etapa).toBe('concluido')
    expect((await b.consulta('caixaDoDia', { data: r.hoje })).contas.reduce((s, c) => s + c.total, 0)).toBe(0)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })
})

describe('linha já paga (por linha)', () => {
  it('3 linhas, só a 1ª paga: sai do caixa agora, pedido em aberto; a etapa Pago cobra só o resto; conta do fornecedor zera', async () => {
    const { b, r } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(50000), descricao: 'ini' })
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('criarCompra', {
      id: 'c1', moduloId: 'cabelo', pessoaId: 'f',
      linhas: [
        { id: 'a', quantidade: 1000, moeda: 'BOB', total: bs(5000), campos: { estado: 'Bruto', jaPaga: true } },
        { id: 'b', quantidade: 1000, moeda: 'BOB', total: bs(4000), campos: { estado: 'Bruto' } },
        { id: 'c', quantidade: 1000, moeda: 'BOB', total: bs(3000), campos: { estado: 'Bruto' } },
      ],
      pagoParcial: [{ id: 'pp', forma: 'dinheiro', moeda: 'BOB', valor: bs(5000) }],
    })
    const caixa = async () => (await b.consulta('caixaDoDia', { data: r.hoje })).contas.find((c) => c.moeda === 'BOB')!.total
    let p = await b.consulta('pedido', { id: 'c1' })
    expect(p.compra.etapa).not.toBe('concluido')
    expect(p.pago).toBe(bs(5000))
    expect(await caixa()).toBe(bs(45000))
    // depois: "Pagar e concluir" só com o que falta (7.000)
    await b.comando('pagarCompra', { compraId: 'c1', pagamentos: [{ id: 'p2', forma: 'dinheiro', moeda: 'BOB', valor: bs(7000) }] })
    p = await b.consulta('pedido', { id: 'c1' })
    expect(p.compra.etapa).toBe('concluido')
    expect(p.pago).toBe(bs(12000))
    expect(p.saldoConta ?? 0).toBe(0)
    expect(await caixa()).toBe(bs(38000))
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })
})
