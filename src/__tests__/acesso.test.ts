// SENHA DE ACESSO da demonstração: só o resumo fica no código; a certa libera, a errada não.
import { describe, expect, it } from 'vitest'
import { HASH_ACESSO, liberarAcesso, resumo } from '../app/acesso'

describe('senha de acesso', () => {
  it('confere pelo resumo (a senha não fica no código)', async () => {
    expect(HASH_ACESSO).toMatch(/^[0-9a-f]{64}$/)
    expect(await liberarAcesso('errada')).toBe(false)
    expect(await resumo('qualquer')).not.toBe(HASH_ACESSO)
    expect(await liberarAcesso(process.env.SENHA_ACESSO_TESTE ?? 'senhaSistema2390')).toBe(true)
  })
})
