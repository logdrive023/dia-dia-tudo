// PONTA A PONTA com o SERVIDOR GO (../dia-dia-tudo-backend): o adaptador de VERDADE do app (BackendApi + canal
// cifrado) falando com o servidor de verdade. Prova que os dois lados falam o mesmo protocolo (envelope.ts ×
// internal/canal) e que a funcionalidade-modelo (Unidades) funciona inteira.
// NÃO roda na suíte normal (precisa do servidor no ar). Rodar:
//   no backend:  scripts/rodar.ps1            (ou o script ponta-a-ponta do backend, que sobe, testa e derruba)
//   aqui:        npm run test:ponta
// Variáveis: TUDO_API_URL (padrão http://127.0.0.1:8080) · TUDO_API_LOGIN / TUDO_API_SENHA (o admin do .env do servidor)
import { describe, expect, it } from 'vitest'
import { BackendApi } from '../src/adapters/api/backendApi'
import { ErroNegocio } from '../src/core/domain/erros'
import { novoId } from '../src/core/domain/ids'
import { MSG_ALTERADO_POR_OUTRA } from '../src/core/services/contexto'

const url = process.env.TUDO_API_URL ?? 'http://127.0.0.1:8080'
const login = process.env.TUDO_API_LOGIN ?? 'admin'
const senha = process.env.TUDO_API_SENHA ?? 'trocar-esta-senha'

async function conectado() {
  const api = new BackendApi({ url, tentativas: 1 })
  await api.entrar(login, senha)
  return api
}

describe('servidor Go × app (canal cifrado de verdade)', () => {
  it('login errado volta como erro de regra, com a mensagem do app', async () => {
    const api = new BackendApi({ url, tentativas: 1 })
    await expect(api.entrar(login, 'senha-errada')).rejects.toThrow('Usuário ou senha não conferem.')
  })

  it('entra, cria uma unidade, lista e edita com a trava de versão', async () => {
    const api = await conectado()
    const id = novoId()
    const nome = `Unidade teste ${id.slice(-5)}`
    expect(await api.comando('salvarLocal', { id, nome, tipo: 'ponto', cidade: 'La Paz' } as never)).toEqual({ id })

    const lista = await api.consulta('locais', {})
    const criada = lista.find((l) => l.id === id)
    expect(criada).toMatchObject({ nome, tipo: 'ponto', cidade: 'La Paz', versao: 1 })
    expect(criada?.criadoEm).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)

    // edita com a versão que carregou → versão 2
    await api.comando('salvarLocal', { ...criada!, nome: `${nome} (editada)`, versaoBase: 1 } as never)
    const editada = (await api.consulta('locais', {})).find((l) => l.id === id)
    expect(editada).toMatchObject({ nome: `${nome} (editada)`, versao: 2 })

    // formulário velho (versão 1) → a MESMA recusa do app, no campo versaoBase
    const velho = api.comando('salvarLocal', { ...criada!, nome: 'por cima', versaoBase: 1 } as never)
    await expect(velho).rejects.toThrow(MSG_ALTERADO_POR_OUTRA)
    await velho.catch((e: ErroNegocio) => expect(e.campo).toBe('versaoBase'))
  })

  it('regra do formulário volta com o campo (a tela destaca)', async () => {
    const api = await conectado()
    const e = await api.comando('salvarLocal', { id: novoId(), nome: '  ', tipo: 'salao' } as never).catch((x: ErroNegocio) => x)
    expect(e).toBeInstanceOf(ErroNegocio)
    expect((e as ErroNegocio).campo).toBe('nome')
  })

  it('o que ainda não foi portado responde com mensagem clara (a tela não quebra)', async () => {
    const api = await conectado()
    await expect(api.consulta('estoque', {})).rejects.toThrow(/Ainda não existe no servidor/)
  })

  it('sem login: o servidor recusa', async () => {
    const api = new BackendApi({ url, tentativas: 1 })
    await expect(api.consulta('locais', {})).rejects.toThrow('Entre com seu usuário.')
  })
})
