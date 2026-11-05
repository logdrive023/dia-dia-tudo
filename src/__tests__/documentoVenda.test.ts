// NOTA DE VENTA (documentoVenda): os dados do papel saem da venda, sem conta nova — totais, desconto, pagamentos,
// saldo e os impostos ESTIMADOS (o registro do dia). Não é factura: o que falta (NIT, CI) é avisado, nunca inventado.
import { describe, expect, it } from 'vitest'
import { porExtenso, totalPorExtenso } from '../core/dados/documentos'
import { bs, novoBackend } from './ajuda'

async function montar() {
  const { b } = await novoBackend()
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Ana Paula', papeis: ['cliente'] })
  await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 10 })
  await b.comando('salvarItem', { id: 'y', moduloId: 'produtos', tipoItem: 'peca', nome: 'Pente', saldoInicial: 10 })
  return b
}

describe('nota de venta', () => {
  it('um item, pago: total, por extenso, pagamento e impostos estimados (dentro do preço)', async () => {
    const b = await montar()
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(60) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(60) }] })
    const d = await b.consulta('documentoVenda', { id: 'v' })
    expect(d.linhas).toEqual([expect.objectContaining({ descricao: 'Escova', quantidade: 2, unidade: 'Unidad', precoUnitario: bs(30), desconto: 0, subtotal: bs(60) })])
    expect(d.totais).toMatchObject({ subtotal: bs(60), descontos: 0, total: bs(60), pago: bs(60), saldo: 0, emPalavras: 'Son: Sesenta 00/100 Bolivianos' })
    expect(d.comprador.nome).toBe('Ana Paula')
    // o IVA 13% e o IT 3% do dia da venda (guardados na venda), não recalculados
    expect(d.impostos.doDia).toBe(true)
    expect(d.impostos.linhas.map((l) => [l.sigla, l.valor])).toEqual([['IVA', bs(7.8)], ['IT', bs(1.8)]])
    expect(d.impostosNaNota).toBe(true)
    // sem dados fiscais da empresa e sem CI da cliente: avisa (o papel mostra "—")
    expect(d.faltando).toEqual(expect.arrayContaining(['NIT da empresa', 'NIT/CI da cliente']))
  })

  it('vários itens com desconto: subtotal cheio − desconto = total da venda', async () => {
    const b = await montar()
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', desconto: { moeda: 'BOB', pct: 10 }, linhas: [{ id: 'l1', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100) }, { id: 'l2', itemId: 'y', quantidade: 1, moeda: 'BOB', total: bs(50) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(135) }] })
    const d = await b.consulta('documentoVenda', { id: 'v' })
    expect(d.linhas).toHaveLength(2)
    expect(d.totais.total).toBe(bs(135))
    expect(d.totais.subtotal - d.totais.descontos).toBe(d.totais.total)
    expect(d.totais.descontos).toBe(bs(15))
  })

  it('pagamento parcial: o saldo pendente é o que falta', async () => {
    const b = await montar()
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos: [{ id: 'p', forma: 'qr', moeda: 'BOB', valor: bs(60) }] })
    const d = await b.consulta('documentoVenda', { id: 'v' })
    expect(d.totais).toMatchObject({ total: bs(100), pago: bs(60), saldo: bs(40) })
  })

  it('dados da empresa e do papel vêm da configuração; RTS: sem imposto por venda (com o aviso)', async () => {
    const b = await montar()
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Ana Paula', papeis: ['cliente'], documento: '1234567 LP' })
    await b.comando('salvarConfig', { modeloNota: 'rollo', impostosNaNota: false, fiscal: { razaoSocial: 'Cabelos SRL', nit: '1020304050', endereco: 'Av. Arce 100, La Paz', regimeBO: 'rts' } as never })
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(1) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1) }] })
    const d = await b.consulta('documentoVenda', { id: 'v' })
    expect(d).toMatchObject({ modeloPadrao: 'rollo', impostosNaNota: false, emisor: { razaoSocial: 'Cabelos SRL', nit: '1020304050' }, comprador: { documento: '1234567 LP' }, faltando: [] })
    expect(d.impostos.linhas).toEqual([])
    expect(d.impostos.aviso).toMatch(/RTS/)
    expect(d.totais.emPalavras).toBe('Son: Uno 00/100 Boliviano')
    await expect(b.comando('salvarConfig', { modeloNota: 'factura' as never })).rejects.toThrow(/Modelo de nota/)
  })

  it('por extenso (espanhol)', () => {
    expect(porExtenso(21)).toBe('veintiuno')
    expect(porExtenso(21000)).toBe('veintiún mil')
    expect(porExtenso(1250)).toBe('mil doscientos cincuenta')
    expect(porExtenso(100)).toBe('cien')
    expect(porExtenso(1_000_000)).toBe('un millón')
    expect(porExtenso(345_678)).toBe('trescientos cuarenta y cinco mil seiscientos setenta y ocho')
    expect(totalPorExtenso(3426150, 'BOB')).toBe('Son: Treinta y cuatro mil doscientos sesenta y uno 50/100 Bolivianos')
  })
})
