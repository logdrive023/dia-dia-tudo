// A TELA DO PEDIDO só lê a compra dela (não monta a fila de todas) e continua mostrando as outras compras da mesma
// fornecedora, com o nome da etapa.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('pedido: outras compras da mesma pessoa', () => {
  it('lista as outras compras da fornecedora (sem a própria e sem as de outra pessoa), com a etapa', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    await b.comando('salvarPessoa', { id: 'g', nome: 'Outra', papeis: ['fornecedor'] } as any)
    const comprar = (id: string, pessoaId: string) => b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId, linhas: [{ id: id + 'l', quantidade: 100, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } }] } as any)
    await comprar('c1', 'f')
    await comprar('c2', 'g')
    await comprar('c3', 'f')
    const p = await b.consulta('pedido', { id: 'c3' })
    expect(p.compra.id).toBe('c3')
    expect(p.outras.map((x: any) => x.id)).toEqual(['c1'])
    expect(p.outras[0].etapa).toBeTruthy()
  })
})
