// ÚNICO ponto que escolhe onde os dados ficam. Trocar para a API: VITE_STORAGE=api + VITE_API_URL.
// Telas e regras não mudam: todas falam só com a porta Backend.

import { BackendApi } from '../adapters/api/backendApi'
import { ArquivosMemoria, criarReposMemoria } from '../adapters/memory/memoria'
import { abrirBanco, criarReposLocal } from '../adapters/local/indexeddb'
import { BackendNoAparelho } from '../adapters/noAparelho'
import { dataLocal } from '../core/domain/datas'
import type { TipoArmazenamento } from '../core/ports/backend'
import type { Relogio, Sessao } from '../core/ports/portas'
import { criarRegistro } from '../modules'
import { lerAtraso } from './simularApi'

export const relogioReal: Relogio = { agora: () => new Date().toISOString(), hoje: () => dataLocal() }

/** Sessão da demonstração: começa como administrador; dá para "entrar como" um funcionário pelo Menu. */
export function sessaoDemo(): Sessao {
  return { empresaId: 'demo', usuarioId: 'admin', nome: 'Administrador', perfil: 'admin' }
}

export function criarBackend(opcoes: { tipo?: TipoArmazenamento; relogio?: Relogio; sessao?: Sessao; nomeBanco?: string; apiUrl?: string; fetch?: typeof fetch } = {}) {
  const tipo = opcoes.tipo ?? ((import.meta.env.VITE_STORAGE as TipoArmazenamento | undefined) || 'local')
  const sessao = opcoes.sessao ?? sessaoDemo()
  const relogio = opcoes.relogio ?? relogioReal
  if (tipo === 'api') {
    const url = opcoes.apiUrl ?? (import.meta.env.VITE_API_URL as string | undefined)
    if (!url) throw new Error('Defina VITE_API_URL para usar a API.')
    // canal cifrado; com VITE_API_CHAVE_PUBLICA o app só aceita o servidor que assina com essa chave
    const chavePublica = (import.meta.env.VITE_API_CHAVE_PUBLICA as string | undefined) || undefined
    return { backend: new BackendApi({ url, fetch: opcoes.fetch, chavePublica }), sessao }
  }
  if (tipo === 'memory') {
    const { repos, transacao } = criarReposMemoria()
    return { backend: new BackendNoAparelho('memory', repos, new ArquivosMemoria(), transacao, relogio, sessao, criarRegistro()), sessao }
  }
  const db = abrirBanco(opcoes.nomeBanco)
  const { repos, transacao, arquivos } = criarReposLocal(db)
  const backend = new BackendNoAparelho('local', repos, arquivos, transacao, relogio, sessao, criarRegistro())
  backend.atrasoSimulado = lerAtraso
  return { backend, sessao }
}
