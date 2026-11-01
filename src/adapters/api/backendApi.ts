// Adaptador API (pronto para quando o servidor existir). Implementa a MESMA porta Backend das telas:
//   comandos → POST {url}/v1/comandos/{nome}   (cabeçalho Idempotency-Key = id da operação)
//   consultas → GET  {url}/v1/consultas/{nome}?p={json}
//   arquivos  → POST {url}/v1/arquivos (multipart) e GET {url}/v1/arquivos/{id}
// Erros de regra voltam como { erro: { mensagem, campo } } e viram ErroNegocio (mesma mensagem amigável).
// Contrato completo: api-contract/openapi.yaml. Ligar: VITE_STORAGE=api e VITE_API_URL=https://…

import { ErroNegocio } from '../../core/domain/erros'
import type { Id } from '../../core/domain/tipos'
import type { Backend, Backup } from '../../core/ports/backend'
import type { Sessao } from '../../core/ports/portas'
import type { DadosComando, NomeComando, NomeConsulta, ParamsConsulta, ResultadoComando, ResultadoConsulta } from '../../core/services'

export interface OpcoesApi {
  url: string
  /** TODO(login): devolver o token da sessão quando houver autenticação */
  token?: () => string | undefined
  fetch?: typeof fetch
  tempoLimiteMs?: number
  tentativas?: number
}

export class BackendApi implements Backend {
  readonly tipo = 'api' as const
  private ouvintes = new Set<() => void>()
  private f: typeof fetch

  constructor(private op: OpcoesApi) {
    this.f = op.fetch ?? ((...a) => fetch(...a))
  }

  private async pedir<R>(caminho: string, init: RequestInit = {}, idempotencia?: string): Promise<R> {
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) }
    const token = this.tokenAtual ?? this.op.token?.()
    if (token) headers.Authorization = `Bearer ${token}`
    if (idempotencia) headers['Idempotency-Key'] = idempotencia
    const tentativas = this.op.tentativas ?? 3
    let ultimoErro: unknown
    for (let i = 0; i < tentativas; i++) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), this.op.tempoLimiteMs ?? 15000)
      try {
        const res = await this.f(`${this.op.url}${caminho}`, { ...init, headers, signal: ctrl.signal })
        const corpo = res.status === 204 ? undefined : await res.json().catch(() => undefined)
        if (res.ok) return corpo as R
        if (res.status >= 400 && res.status < 500) throw new ErroNegocio(corpo?.erro?.mensagem ?? `Pedido recusado (${res.status}).`, corpo?.erro?.campo)
        ultimoErro = new Error(`Servidor respondeu ${res.status}`)
      } catch (e) {
        if (e instanceof ErroNegocio) throw e
        ultimoErro = e
      } finally {
        clearTimeout(timer)
      }
      // só repete o que é seguro repetir: consultas e comandos com chave de idempotência
      if (init.method === 'POST' && !idempotencia) break
      await new Promise((r) => setTimeout(r, 300 * 2 ** i))
    }
    throw new ErroNegocio('Sem conexão com o servidor. Tente de novo.', String(ultimoErro ?? ''))
  }

  async comando<N extends NomeComando>(nome: N, dados: DadosComando<N>): Promise<ResultadoComando<N>> {
    const id = (dados as { id?: string })?.id
    const r = await this.pedir<ResultadoComando<N>>(`/v1/comandos/${nome}`, { method: 'POST', body: JSON.stringify(dados), headers: { 'Content-Type': 'application/json' } }, id ? `${nome}:${id}` : undefined)
    this.avisar()
    return r
  }

  consulta<N extends NomeConsulta>(nome: N, params: ParamsConsulta<N>): Promise<ResultadoConsulta<N>> {
    return this.pedir(`/v1/consultas/${nome}?p=${encodeURIComponent(JSON.stringify(params ?? {}))}`)
  }

  async anexar(d: { id: Id; donoId: Id; categoria: Parameters<Backend['anexar']>[0]['categoria']; nome: string; arquivo: Blob }) {
    const form = new FormData()
    form.append('id', d.id)
    form.append('arquivo', d.arquivo, d.nome)
    await this.pedir(`/v1/arquivos`, { method: 'POST', body: form }, `arquivo:${d.id}`)
    return this.comando('registrarAnexo', { id: d.id, donoId: d.donoId, categoria: d.categoria, nome: d.nome, mime: d.arquivo.type, tamanho: d.arquivo.size || 1 })
  }

  async urlDoAnexo(id: Id) {
    return `${this.op.url}/v1/arquivos/${id}`
  }

  aoMudar(fn: () => void) {
    this.ouvintes.add(fn)
    // TODO(api): ouvir mudanças feitas por outros aparelhos (SSE/WebSocket ou consulta periódica)
    return () => {
      this.ouvintes.delete(fn)
    }
  }

  private avisar() {
    this.ouvintes.forEach((f) => f())
  }

  exportar(): Promise<Backup> {
    return this.pedir('/v1/backup')
  }

  async importar(b: Backup) {
    await this.pedir('/v1/backup', { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'application/json' } }, `backup:${b.exportadoEm}`)
    this.avisar()
  }

  private tokenAtual?: string

  /** POST /v1/auth/entrar → { token, sessao }. O token vai no cabeçalho Authorization de todo pedido. */
  async entrar(login: string, senha: string): Promise<Sessao> {
    const r = await this.pedir<{ token: string; sessao: Sessao }>('/v1/auth/entrar', { method: 'POST', body: JSON.stringify({ login, senha }), headers: { 'Content-Type': 'application/json' } })
    this.tokenAtual = r.token
    this.avisar()
    return r.sessao
  }

  async sair() {
    this.tokenAtual = undefined
    this.avisar()
  }

  async limparTudo() {
    throw new ErroNegocio('Zerar os dados só existe no modo demonstração.')
  }
}
