// FALHA SIMULADA (Configurações › Dados): testar o erro das telas hoje — só consultas e nunca as que o app precisa para abrir
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { SENHA_DEMO, carregarDemo } from '../adapters/demo'
import { ERRO_SIMULADO } from '../adapters/api/simularApi'
import { criarBackend } from '../app/criarBackend'

async function comAdmin() {
  const { backend, sessao } = criarBackend({ tipo: 'memory' })
  const b = backend as BackendNoAparelho
  await carregarDemo(b)
  Object.assign(sessao, await b.entrar('admin', SENHA_DEMO))
  return b
}

describe('falha simulada', () => {
  it('desligada (padrão): nada falha', async () => {
    const b = await comAdmin()
    await expect(b.consulta('estoque', {})).resolves.toBeTruthy()
  })

  it('100%: a consulta comum falha com o aviso de simulação; as configurações (casca do app) não', async () => {
    const b = await comAdmin()
    b.falhaSimulada = () => 100
    await expect(b.consulta('estoque', {})).rejects.toThrow(ERRO_SIMULADO)
    await expect(b.consulta('configuracoes', {})).resolves.toBeTruthy()
  })

  it('nunca derruba um comando (nada fica gravado pela metade)', async () => {
    const b = await comAdmin()
    b.falhaSimulada = () => 100
    await expect(b.comando('salvarConfig', { avisarVendaBruto: true })).resolves.not.toThrow()
  })
})
