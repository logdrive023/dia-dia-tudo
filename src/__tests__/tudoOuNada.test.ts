// TUDO OU NADA: um comando que falha no meio (página atualizada, bateria, erro inesperado) não deixa nada pela
// metade — nem no aparelho (IndexedDB) nem na memória. Ex.: ligar 2 compras e a gravação da 2ª falhar → nenhuma ligada.
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { criarBackend } from '../app/criarBackend'
import { bs, relogioFixo } from './ajuda'

async function montar(tipo: 'memory' | 'local') {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
  const r = relogioFixo()
  const b = criarBackend({ tipo, relogio: r.relogio, nomeBanco: `tudo-ou-nada-${tipo}-${Math.random()}` }).backend as BackendNoAparelho
  await b.comando('salvarConfig', { moedaPrincipal: 'BOB' })
  await b.comando('salvarCotacao', { id: 'cot-bob', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
  await b.comando('salvarPessoa', { id: 'p', nome: 'P', papeis: ['funcionario'] })
  await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
  await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', viajantes: ['p'], inicio: r.hoje })
  for (const id of ['c1', 'c2']) await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: 1000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }] })
  return b
}

describe.each(['memory', 'local'] as const)('comando tudo ou nada (%s)', (tipo) => {
  it('falha na 2ª gravação → a 1ª também é desfeita', async () => {
    const b = await montar(tipo)
    const repos = (b as unknown as { repos: { transacoes: { salvar(x: unknown): Promise<void> } } }).repos
    const original = repos.transacoes.salvar.bind(repos.transacoes)
    let n = 0
    repos.transacoes.salvar = async (x) => { if (++n === 2) throw new Error('bateria acabou'); return original(x) }
    await expect(b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1', 'c2'] })).rejects.toThrow('bateria acabou')
    repos.transacoes.salvar = original
    expect((await b.consulta('pedido', { id: 'c1' })).viagem).toBeUndefined()
    expect((await b.consulta('pedido', { id: 'c2' })).viagem).toBeUndefined()
    // e depois funciona normalmente
    await b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1', 'c2'] })
    expect((await b.consulta('pedido', { id: 'c2' })).viagem?.id).toBe('vg')
  })
})
