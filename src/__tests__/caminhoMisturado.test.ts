// O CAMINHO DO CABELO de um pacote MISTURADO (unificado de compras diferentes) chega até TODAS as compras de origem
// (antes mostrava "Compra: ainda não" porque não seguia os pacotes de origem da mistura).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { caminhoProprio } from '../ui/caminhoCabelo'
import { bs, novoBackend } from './ajuda'

describe('caminho do cabelo de um pacote misturado', () => {
  it('a mistura de 2 compras mostra as 2 compras e os 2 pacotes de origem no caminho próprio', async () => {
    const { b } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'ini' } as any)
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    const repos = (b as any).repos
    const comprar = async (id: string, g: number) => {
      await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }] } as any)
      return (await repos.transacoes.obter(id)).linhas[0].itemId as string
    }
    const L1 = await comprar('c1', 1000)
    const L2 = await comprar('c2', 2000)
    await b.comando('unificarLotes', { id: 'mix', ids: [L1, L2] } as any)
    const g = await b.consulta('genealogia', { itemId: 'mix' })
    const ids = caminhoProprio(g as any, { itemId: 'mix' })
    expect(ids.has('c1')).toBe(true)
    expect(ids.has('c2')).toBe(true)
    expect(ids.has(L1)).toBe(true)
    expect(ids.has(L2)).toBe(true)
  })
})

describe('caminho do cabelo a partir da compra', () => {
  it('da compra chega ao pacote misturado (para frente), mesmo com a triagem de mesmo id', async () => {
    const { b } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'ini' } as any)
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    const repos = (b as any).repos
    for (const [id, g] of [['c1', 1000], ['c2', 2000]] as const) await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }] } as any)
    const L1 = (await repos.transacoes.obter('c1')).linhas[0].itemId
    const L2 = (await repos.transacoes.obter('c2')).linhas[0].itemId
    await b.comando('unificarLotes', { id: 'mix', ids: [L1, L2] } as any)
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    const ids = caminhoProprio(g as any, { compraId: 'c1' })
    expect(ids.has(L1)).toBe(true)
    expect(ids.has('mix')).toBe(true)
  })
})
