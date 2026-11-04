// A TRIAGEM NO RESUMO DO PEDIDO: o servidor diz se a compra já foi separada (falta · parcial · feita · sem bruto),
// quanto ainda espera e quais triagens usaram o cabelo dela.
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('triagem da compra (pedido.triagem)', () => {
  it('falta → parcial → feita', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 2000, moeda: 'BOB', total: bs(10000), campos: { estado: 'Bruto' } }] })
    let p = await b.consulta('pedido', { id: 'c1' })
    expect(p.triagem).toMatchObject({ situacao: 'falta', feitas: [], esperando: { gramas: 2000 } })
    const bruto = p.triagem.esperando.ids[0]

    // separa metade: parcial, com a triagem listada e o resto esperando
    await b.comando('triarLotes', { id: 't1', ids: [bruto], quantidadeUsada: 1000, saidas: [{ id: 's1', quantidade: 950, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] })
    p = await b.consulta('pedido', { id: 'c1' })
    expect(p.triagem.situacao).toBe('parcial')
    expect(p.triagem.esperando.gramas).toBe(1000)
    expect(p.triagem.feitas).toHaveLength(1)
    expect(p.triagem.feitas[0]).toMatchObject({ pacotes: 1, entrou: 1000, saiu: 950, perda: 50 })

    // separa o resto: feita
    await b.comando('triarLotes', { id: 't2', ids: [bruto], quantidadeUsada: 1000, saidas: [{ id: 's2', quantidade: 1000, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } }] })
    p = await b.consulta('pedido', { id: 'c1' })
    expect(p.triagem).toMatchObject({ situacao: 'feita', esperando: { ids: [], gramas: 0 } })
    expect(p.triagem.feitas).toHaveLength(2)
  })

  it('compra que já veio separada: sem triagem', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('criarCompra', { id: 'c2', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 500, moeda: 'BOB', total: bs(1000), campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] })
    expect((await b.consulta('pedido', { id: 'c2' })).triagem.situacao).toBe('sem')
  })
})
