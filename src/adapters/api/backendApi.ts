// Adaptador API (pronto para quando o servidor existir). Implementa a MESMA porta Backend das telas.
// TODO pedido passa pelo canal cifrado (canalSeguro.ts): aperto de mão em POST /v1/k e tudo o mais em POST /v1/r.
// Na aba Rede não aparece nome de comando, parâmetro, token, valor nem mensagem: só bytes cifrados.
//   comando  → { tipo: 'comando',  nome, dados, chave: 'nome:id' }   (chave = idempotência: toque duplo não duplica)
//   consulta → { tipo: 'consulta', nome, dados: params }
//   login    → { tipo: 'auth', nome: 'entrar' } → { token, sessao }; o token viaja DENTRO de cada mensagem
//   backup   → { tipo: 'backup', nome: 'exportar' | 'importar' }
//   arquivos → { tipo: 'arquivo', nome: 'enviar' | 'baixar' } (conteúdo em base64, também cifrado)
// Erros de regra voltam dentro do envelope { ok: false, erro: { mensagem, campo } } e viram ErroNegocio.
// Falha de transporte vira só "Sem conexão…" ou "Erro no servidor…", sem detalhe técnico.
// Contrato completo: api-contract/openapi.yaml. Ligar: VITE_STORAGE=api e VITE_API_URL=https://…

import { ErroNegocio } from '../../core/domain/erros'
import type { Id } from '../../core/domain/tipos'
import type { Backend, Backup } from '../../core/ports/backend'
import type { Sessao } from '../../core/ports/portas'
import { bytes, deBase64, paraBase64, type TipoMensagem } from '../../core/seguranca/envelope'
import type { DadosComando, NomeComando, NomeConsulta, ParamsConsulta, ResultadoComando, ResultadoConsulta } from '../../core/services'
import { CanalSeguro, ErroCanal } from './canalSeguro'

export interface OpcoesApi {
  url: string
  /** TODO(login): devolver o token da sessão quando houver autenticação */
  token?: () => string | undefined
  fetch?: typeof fetch
  tempoLimiteMs?: number
  tentativas?: number
  /** base64 da chave pública fixa do servidor (VITE_API_CHAVE_PUBLICA): o aperto de mão tem de vir assinado por ela */
  chavePublica?: string
}

export const MSG_SEM_CONEXAO = 'Sem conexão com o servidor. Tente de novo.'
export const MSG_ERRO_SERVIDOR = 'Erro no servidor. Tente de novo.'

/** Blob → bytes (FileReader como reserva para ambientes sem Blob.arrayBuffer) */
async function lerArquivo(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') return bytes(await b.arrayBuffer())
  return new Promise((ok, falhou) => {
    const r = new FileReader()
    r.onload = () => ok(bytes(r.result as ArrayBuffer))
    r.onerror = () => falhou(new Error('arquivo'))
    r.readAsArrayBuffer(b)
  })
}

export class BackendApi implements Backend {
  readonly tipo = 'api' as const
  private ouvintes = new Set<() => void>()
  private canal: CanalSeguro
  private urlsAnexos = new Map<Id, string>()

  constructor(private op: OpcoesApi) {
    const f = op.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
    this.canal = new CanalSeguro({ url: op.url, fetch: f, chavePublica: op.chavePublica, tempoLimiteMs: op.tempoLimiteMs })
  }

  /** repetivel: só repete o que é seguro repetir (consultas e comandos com chave de idempotência) */
  private async pedir<R>(tipo: TipoMensagem, nome: string, dados: unknown, opcoes: { chave?: string; repetivel?: boolean } = {}): Promise<R> {
    const token = this.tokenAtual ?? this.op.token?.()
    const tentativas = opcoes.repetivel || opcoes.chave ? (this.op.tentativas ?? 3) : 1
    let falha: 'rede' | 'servidor' = 'rede'
    for (let i = 0; i < tentativas; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300 * 2 ** (i - 1)))
      try {
        const r = await this.canal.enviar({ tipo, nome, dados, token, chave: opcoes.chave })
        if (r.ok) return r.r as R
        throw new ErroNegocio(r.erro?.mensagem ?? MSG_ERRO_SERVIDOR, r.erro?.campo)
      } catch (e) {
        if (e instanceof ErroNegocio) throw e
        falha = e instanceof ErroCanal ? e.tipo : 'servidor'
      }
    }
    // mensagem genérica, sem o erro técnico (nada de endereço, status ou pilha)
    throw new ErroNegocio(falha === 'rede' ? MSG_SEM_CONEXAO : MSG_ERRO_SERVIDOR)
  }

  async comando<N extends NomeComando>(nome: N, dados: DadosComando<N>): Promise<ResultadoComando<N>> {
    const id = (dados as { id?: string })?.id
    const r = await this.pedir<ResultadoComando<N>>('comando', nome, dados, { chave: id ? `${nome}:${id}` : undefined })
    this.avisar()
    return r
  }

  consulta<N extends NomeConsulta>(nome: N, params: ParamsConsulta<N>): Promise<ResultadoConsulta<N>> {
    return this.pedir('consulta', nome, params ?? {}, { repetivel: true })
  }

  async anexar(d: { id: Id; donoId: Id; categoria: Parameters<Backend['anexar']>[0]['categoria']; nome: string; arquivo: Blob }) {
    const conteudo = paraBase64(await lerArquivo(d.arquivo))
    await this.pedir('arquivo', 'enviar', { id: d.id, nome: d.nome, mime: d.arquivo.type, conteudo }, { chave: `arquivo:${d.id}` })
    return this.comando('registrarAnexo', { id: d.id, donoId: d.donoId, categoria: d.categoria, nome: d.nome, mime: d.arquivo.type, tamanho: d.arquivo.size || 1 })
  }

  /** Baixa pelo canal cifrado e devolve um endereço blob: local (o id do arquivo nunca vai no endereço). */
  async urlDoAnexo(id: Id) {
    const pronto = this.urlsAnexos.get(id)
    if (pronto) return pronto
    const a = await this.pedir<{ mime: string; conteudo: string } | null>('arquivo', 'baixar', { id }, { repetivel: true })
    if (!a) return undefined
    const url = URL.createObjectURL(new Blob([deBase64(a.conteudo)], { type: a.mime || 'application/octet-stream' }))
    this.urlsAnexos.set(id, url)
    return url
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
    return this.pedir('backup', 'exportar', {}, { repetivel: true })
  }

  async importar(b: Backup) {
    await this.pedir('backup', 'importar', b, { chave: `backup:${b.exportadoEm}` })
    this.avisar()
  }

  private tokenAtual?: string

  /** { tipo: 'auth', nome: 'entrar' } → { token, sessao }. O token fica só na memória e viaja dentro de cada envelope. */
  async entrar(login: string, senha: string): Promise<Sessao> {
    const r = await this.pedir<{ token: string; sessao: Sessao }>('auth', 'entrar', { login, senha })
    this.tokenAtual = r.token
    this.avisar()
    return r.sessao
  }

  async sair() {
    this.tokenAtual = undefined
    this.canal.esquecer()
    this.urlsAnexos.forEach((u) => URL.revokeObjectURL(u))
    this.urlsAnexos.clear()
    this.avisar()
  }

  async limparTudo() {
    throw new ErroNegocio('Zerar os dados só existe no modo demonstração.')
  }
}
