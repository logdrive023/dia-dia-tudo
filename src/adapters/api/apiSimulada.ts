// API SIMULADA: um "servidor" de mentira que responde pelo contrato da API usando as mesmas regras.
// Serve para provar (nos testes de contrato) que o adaptador API funciona antes de o servidor existir.

import { ErroNegocio } from '../../core/domain/erros'
import type { Backend } from '../../core/ports/backend'
import type { NomeComando, NomeConsulta } from '../../core/services'

export function criarFetchSimulado(servidor: Backend): typeof fetch {
  const idempotencia = new Map<string, unknown>()
  const responder = (status: number, corpo?: unknown) =>
    new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

  return (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada))
    const chave = (init?.headers as Record<string, string> | undefined)?.['Idempotency-Key']
    try {
      if (chave && idempotencia.has(chave)) return responder(200, idempotencia.get(chave))
      let corpo: unknown
      const comando = /^\/v1\/comandos\/(\w+)$/.exec(url.pathname)
      const consulta = /^\/v1\/consultas\/(\w+)$/.exec(url.pathname)
      if (comando && init?.method === 'POST') corpo = await servidor.comando(comando[1] as NomeComando, JSON.parse(String(init.body)))
      else if (consulta) corpo = await servidor.consulta(consulta[1] as NomeConsulta, JSON.parse(url.searchParams.get('p') ?? '{}'))
      else if (url.pathname === '/v1/backup' && init?.method === 'POST') corpo = await servidor.importar(JSON.parse(String(init.body)))
      else if (url.pathname === '/v1/backup') corpo = await servidor.exportar()
      else if (url.pathname === '/v1/arquivos' && init?.method === 'POST') corpo = { ok: true }
      else if (url.pathname === '/v1/auth/entrar') {
        const { login, senha } = JSON.parse(String(init?.body))
        corpo = { token: `token-${login}`, sessao: await servidor.entrar(login, senha) }
      }
      else return responder(404, { erro: { mensagem: 'Rota não existe.' } })
      // JSON de ida e volta: garante que tudo que trafega é JSON puro
      const json = corpo === undefined ? undefined : JSON.parse(JSON.stringify(corpo))
      if (chave) idempotencia.set(chave, json)
      return responder(200, json)
    } catch (e) {
      if (e instanceof ErroNegocio) return responder(422, { erro: { mensagem: e.message, campo: e.campo } })
      return responder(500, { erro: { mensagem: String(e) } })
    }
  }) as typeof fetch
}
