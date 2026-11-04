// A VIAGEM ACOMPANHA O CABELO: comprou numa viagem → a viagem aparece na lista de compras, no pedido (com o que veio
// nela), na triagem, no estoque (também nos pacotes separados dela) e nas vendas. Tudo vem do servidor com a linha.

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('viagem à vista em todo o caminho', () => {
  it('compra → triagem → estoque → venda: cada lista traz a viagem', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p', nome: 'Paula', papeis: ['funcionario'] })
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p'], inicio: r.hoje })
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', viagemId: 'vg', linhas: [{ id: 'l', quantidade: 2000, moeda: 'BOB', total: bs(10000), campos: { estado: 'Bruto' } }] })
    await b.comando('criarCompra', { id: 'c2', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 500, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }] })
    const vg = { id: 'vg', codigo: 'VG-0001', nome: 'Feira de Oruro' }

    // lista de compras e o pedido (com o resumo da viagem)
    const fila = await b.consulta('filaTriagem', { incluirEncerradas: true })
    expect(fila.find((c) => c.id === 'c1')?.viagem).toEqual(vg)
    expect(fila.find((c) => c.id === 'c2')?.viagem).toBeUndefined()
    expect((await b.consulta('pedido', { id: 'c1' })).viagem).toMatchObject({ ...vg, destino: 'Oruro', compras: 1, gramas: 2000 })

    // triagem e estoque (o bruto)
    const bruto = (await b.consulta('pedido', { id: 'c1' })).lotes[0].id
    expect((await b.consulta('triagem', {})).lotes.find((l) => l.id === bruto)?.compras[0].viagem).toEqual(vg)
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === bruto)?.compras[0].viagem).toEqual(vg)

    // separa: o pacote novo continua sabendo da viagem
    const sep = await b.comando('triarLotes', { id: 't', ids: [bruto], quantidadeUsada: 2000, saidas: [{ id: 's', quantidade: 1900, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] })
    const novo = sep.lotes[0]
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === novo)?.compras[0].viagem).toEqual(vg)

    // venda: a lista e a venda dizem de que viagem veio o cabelo
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'vl', itemId: novo, quantidade: 500, moeda: 'BOB', total: bs(4000) }], pagamentos: [{ id: 'vp', forma: 'dinheiro', moeda: 'BOB', valor: bs(4000) }] })
    expect((await b.consulta('vendas', {})).find((x) => x.id === 'v')?.viagens).toEqual([vg])
    expect((await b.consulta('venda', { id: 'v' })).viagens).toEqual([vg])
  })
})
