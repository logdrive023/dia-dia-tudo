// SEM VALOR POR LINHA: na mesma compra, 20 kg com preço e 10 kg ainda sem preço. A compra soma só o que tem valor,
// fica com a pendência "Sem valor" até pôr o valor na linha marcada; o lote não herda a marca.

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('sem valor por linha', () => {
  it('uma linha com valor e outra sem: pendência até pôr o valor; depois some', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedora', papeis: ['fornecedor'] })
    await b.comando('criarCompra', {
      id: 'c', moduloId: 'cabelo', pessoaId: 'forn',
      linhas: [
        { id: 'l1', quantidade: 20000, moeda: 'BOB', total: bs(30000), campos: { estado: 'Bruto' } },
        { id: 'l2', quantidade: 10000, moeda: 'BOB', total: 0, campos: { estado: 'Bruto', semValor: true } },
      ],
    })
    const compra = async () => (await b.consulta('filaTriagem', { incluirEncerradas: true })).find((x) => x.id === 'c')!
    let c = await compra()
    expect(c.totalPrincipal).toBe(bs(30000))
    expect(c.pendencias.map((p) => p.id)).toContain('semValor')

    // o lote da linha sem valor não carrega a marca (é da compra, não do cabelo)
    const lotes = (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.compraId === 'c')
    expect(lotes).toHaveLength(2)
    expect(lotes.every((i) => i.campos.semValor === undefined)).toBe(true)

    // corrigir a linha QUE TEM valor não tira a pendência (a outra continua sem valor)
    await b.comando('definirValorCompra', { compraId: 'c', linhaId: 'l1', total: bs(31000), motivo: 'desconto revisto' })
    expect((await compra()).pendencias.map((p) => p.id)).toContain('semValor')

    // pôr o valor na linha marcada: a pendência some e o total soma as duas
    await b.comando('definirValorCompra', { compraId: 'c', linhaId: 'l2', total: bs(12000), motivo: 'chegou o preço' })
    c = await compra()
    expect(c.totalPrincipal).toBe(bs(43000))
    expect(c.pendencias.map((p) => p.id)).not.toContain('semValor')
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })
})
