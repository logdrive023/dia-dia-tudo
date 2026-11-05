// VISIBILIDADE DO "JUNTADO" NA TRIAGEM: o pacote misturado aparece como misturado (de quantos) e a semana conta as
// triagens e quantas juntaram pacotes — uma operação que juntou e separou conta UMA vez.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('triagem: juntados × sem juntar', () => {
  it('misturado de 2 conta como juntado; separar um pacote simples conta como triagem sem junção', async () => {
    const { b } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(1_000_000), descricao: 'ini' } as any)
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    const repos = (b as any).repos
    const comprar = async (id: string, g: number) => {
      await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(g), campos: { estado: 'Bruto' } }] } as any)
      return (await repos.transacoes.obter(id)).linhas[0].itemId as string
    }
    const A = await comprar('c1', 1200)
    const B = await comprar('c2', 3300)
    const C = await comprar('c3', 2000)

    const antes = await b.consulta('triagem', { moduloId: 'cabelo' })
    expect(antes.totais.triagensSemana).toEqual({ n: 0, juntando: 0 })

    // juntar A + B: o misturado é "unificado de 2" e vem de duas compras
    await b.comando('unificarLotes', { id: 'u1', ids: [A, B] } as any)
    const t1 = await b.consulta('triagem', { moduloId: 'cabelo' })
    const u = t1.lotes.find((l) => l.id === 'u1')!
    expect(u.unificado).toBe(2)
    expect(u.compras).toHaveLength(2)
    expect(t1.lotes.find((l) => l.id === C)!.unificado).toBe(0)

    // separar o pacote simples C: mais uma triagem, sem junção
    await b.comando('separarLote', { id: 's1', loteId: C, quantidadeUsada: 2000, saidas: [{ id: 'c3a', quantidade: 1900, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } }] } as any)
    const t2 = await b.consulta('triagem', { moduloId: 'cabelo' })
    expect(t1.totais.triagensSemana).toEqual({ n: 1, juntando: 1 })
    expect(t2.totais.triagensSemana).toEqual({ n: 2, juntando: 1 })
  })
})
