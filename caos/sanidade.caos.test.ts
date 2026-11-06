// confere que o ambiente da Operação Caos funciona: demo carregada, conferidor de integridade limpo
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../src/adapters/noAparelho'
import { carregarDemo } from '../src/adapters/demo'
import { criarBackend } from '../src/app/criarBackend'
import { conferir } from './integridade'

describe('ambiente caos', () => {
  it('demo íntegra no início', async () => {
    const { backend } = criarBackend({ tipo: 'memory' })
    await carregarDemo(backend as BackendNoAparelho)
    expect(await conferir(backend as BackendNoAparelho)).toEqual([])
  })
})
