// Backend que roda as regras NO APARELHO (usado pelos adaptadores "memory" e "local").
// Cada comando: fila (um por vez) → transação (tudo ou nada) → registro na fila de saída (outbox) → avisa as telas.

import type { Base, Id, Outbox } from '../core/domain/tipos'
import { nomeAcao } from '../core/services/historico'
import { ErroNegocio } from '../core/domain/erros'
import type { RegistroModulos } from '../core/modulos'
import type { Backend, Backup, TipoArmazenamento } from '../core/ports/backend'
import { type ArquivosStore, type ExecutarEmTransacao, NOMES_COLECOES, type Relogio, type Repos, type Sessao } from '../core/ports/portas'
import { comandos, consultas, type DadosComando, type NomeComando, type NomeConsulta, type ParamsConsulta, type ResultadoComando, type ResultadoConsulta } from '../core/services'
import { type Ctx, novo, auditar } from '../core/services/contexto'
import { type ModuloConfig, moduloDeConfig } from '../core/modulosConfig'
import type { AtributosConfig, FluxoCompraConfig } from '../core/modulos'
import { SEM_LOGIN, podeComando, podeConsulta } from '../core/services/permissoes'
import { entrar, hashSenha, prepararSenhas } from '../core/services/usuarios'

/** comandos cuja recusa não vai para o log (senha: o aviso basta e não se guarda rastro) */
const SEM_LOG_RECUSA = new Set(['trocarMinhaSenha', 'salvarUsuario'])

export class BackendNoAparelho implements Backend {
  private fila: Promise<unknown> = Promise.resolve()
  private ouvintes = new Set<() => void>()

  constructor(
    readonly tipo: TipoArmazenamento,
    private repos: Repos,
    private arquivos: ArquivosStore,
    private transacao: ExecutarEmTransacao,
    private relogio: Relogio,
    private sessao: Sessao,
    private modulos: RegistroModulos,
  ) {}

  private ctx(relogio: Relogio = this.relogio): Ctx {
    return { repos: this.repos, relogio, sessao: this.sessao, modulos: this.modulos }
  }

  /** modalidades criadas pela tela ficam guardadas na configuração: carrega antes de usar */
  private async carregarModulos() {
    const r = await this.repos.config.obter('modulosPersonalizados')
    this.modulos.definirPersonalizados(((r?.valor as ModuloConfig[]) ?? []).map(moduloDeConfig))
    const f = await this.repos.config.obter('fluxosCompra')
    this.modulos.definirFluxos((f?.valor as Record<string, FluxoCompraConfig>) ?? {})
    const a = await this.repos.config.obter('atributosItem')
    this.modulos.definirAtributos((a?.valor as Record<string, AtributosConfig>) ?? {})
  }

  private enfileirar<R>(fn: () => Promise<R>): Promise<R> {
    const r = this.fila.then(fn, fn)
    this.fila = r.catch(() => undefined)
    return r
  }

  comando<N extends NomeComando>(nome: N, dados: DadosComando<N>, relogio?: Relogio): Promise<ResultadoComando<N>> {
    const handler = comandos[nome] as unknown as (ctx: Ctx, d: unknown) => Promise<ResultadoComando<N>>
    if (!handler) return Promise.reject(new ErroNegocio(`Comando desconhecido: ${String(nome)}`))
    if (!this.sessao.usuarioId) return Promise.reject(new ErroNegocio('Sem permissão para isso. Peça a um administrador.'))
    const ctx = this.ctx(relogio)
    if (!podeComando(this.sessao.perfil, nome)) {
      const erro = new ErroNegocio('Sem permissão para isso. Peça a um administrador.')
      return this.enfileirar(async () => { await this.registrarRecusa(ctx, nome, dados, erro); throw erro })
    }
    return this.enfileirar(async (): Promise<ResultadoComando<N>> => {
      await this.carregarModulos()
      // criptografia antes da transação (o IndexedDB não espera); a senha em texto não segue adiante
      const prontos = await prepararSenhas(ctx, nome, (dados ?? {}) as Record<string, unknown>)
      let r: ResultadoComando<N>
      try {
        r = await this.transacao<ResultadoComando<N>>(async () => {
          const res: ResultadoComando<N> = await handler(ctx, prontos)
          // fila de saída: hoje só fica guardada; com a API, um sincronizador envia (nunca com senha)
          const { _senha: _a, _atualHash: _b, ...semSegredo } = prontos as Record<string, unknown>
          await this.repos.outbox.salvar(novo<Outbox>(ctx, { comando: nome, dados: JSON.parse(JSON.stringify(semSegredo)) }))
          return res
        })
      } catch (e) {
        // TENTATIVA RECUSADA (regra do negócio): a transação desfez tudo; o registro da tentativa fica (fora dela)
        if (e instanceof ErroNegocio) await this.registrarRecusa(ctx, nome, dados, e)
        throw e
      }
      this.avisar()
      return r
    })
  }

  /**
   * LOG DAS TENTATIVAS RECUSADAS: quem tentou o quê, quando, e por que o sistema não deixou ("Vender: só tem 1.000 g
   * no L-0002"). Fica no registro e na linha do tempo do que foi tentado (pacote, venda, compra). Nunca guarda senha.
   */
  private async registrarRecusa(ctx: Ctx, nome: string, dados: unknown, e: ErroNegocio) {
    if (SEM_LOG_RECUSA.has(nome)) return
    try {
      const d = (dados ?? {}) as Record<string, unknown>
      const ids = (x: unknown) => (typeof x === 'string' && x ? [x] : [])
      const alvo = [d.itemId, d.compraId, d.vendaId, d.triagemId, d.viagemId, d.id].find((x) => typeof x === 'string' && x) as Id | undefined
      const linhas = Array.isArray(d.linhas) ? (d.linhas as Record<string, unknown>[]).flatMap((l) => ids(l.itemId)) : []
      const ligados = [...ids(d.itemId), ...(Array.isArray(d.ids) ? (d.ids as unknown[]).flatMap(ids) : []), ...linhas]
      await this.transacao(() => auditar(ctx, 'recusado', alvo, `${nomeAcao(nome)} · ${e.message}`, ligados))
    } catch {
      // o registro da tentativa nunca atrapalha o aviso para a pessoa
    }
  }

  /** Só para os dados de exemplo: roda um comando "como se fosse" outra data. */
  comandoEm<N extends NomeComando>(instante: string, nome: N, dados: DadosComando<N>) {
    const d = new Date(instante)
    const p = (n: number) => String(n).padStart(2, '0')
    const hoje = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    return this.comando(nome, dados, { agora: () => instante, hoje: () => hoje })
  }

  async consulta<N extends NomeConsulta>(nome: N, params: ParamsConsulta<N>): Promise<ResultadoConsulta<N>> {
    const handler = consultas[nome] as unknown as (ctx: Ctx, p: unknown) => Promise<ResultadoConsulta<N>>
    if (!handler) throw new ErroNegocio(`Consulta desconhecida: ${String(nome)}`)
    if (!this.sessao.usuarioId && !SEM_LOGIN.has(nome)) throw new ErroNegocio('Entre com seu usuário.')
    if (this.sessao.usuarioId && !podeConsulta(this.sessao.perfil, nome)) throw new ErroNegocio('Sem permissão para ver isso.')
    await this.carregarModulos()
    return handler(this.ctx(), params ?? {})
  }

  async anexar(d: { id: Id; donoId: Id; categoria: Parameters<Backend['anexar']>[0]['categoria']; nome: string; arquivo: Blob }) {
    await this.arquivos.guardar(d.id, d.arquivo)
    return this.comando('registrarAnexo', { id: d.id, donoId: d.donoId, categoria: d.categoria, nome: d.nome, mime: d.arquivo.type || 'application/octet-stream', tamanho: d.arquivo.size || 1 })
  }

  private urls = new Map<Id, string>()
  async urlDoAnexo(id: Id) {
    if (this.urls.has(id)) return this.urls.get(id)
    const b = await this.arquivos.obter(id)
    if (!b || typeof URL.createObjectURL !== 'function') return undefined
    const url = URL.createObjectURL(b)
    this.urls.set(id, url)
    return url
  }

  /** Entrar: confere usuário e senha e passa a agir em nome dele (toda ação fica no nome dele). */
  async entrar(login: string, senha: string) {
    // confere o hash fora da transação; depois registra o acesso
    const u = (await this.repos.usuarios.listar({ login: login.trim().toLowerCase() }))[0]
    const hash = u ? await hashSenha(senha, u.sal) : ''
    const s = await this.enfileirar(() => this.transacao(() => entrar(this.ctx(), { login, senha: '', hashConferido: hash })))
    Object.assign(this.sessao, s)
    this.avisar()
    return { ...this.sessao }
  }

  async sair() {
    Object.assign(this.sessao, { usuarioId: '', nome: '', login: undefined, perfil: 'funcionario', pessoaId: undefined, localId: undefined })
    this.avisar()
  }

  /** Só para montar a demonstração: age como "Sistema" e depois volta para quem estava. */
  async comoSistema<R>(fn: () => Promise<R>): Promise<R> {
    const antes = { ...this.sessao }
    Object.assign(this.sessao, { usuarioId: 'sistema', nome: 'Sistema (dados de exemplo)', perfil: 'admin' })
    try {
      return await fn()
    } finally {
      // se alguém entrou enquanto montava, mantém quem entrou
      if (this.sessao.usuarioId === 'sistema') Object.assign(this.sessao, antes)
    }
  }

  get sessaoAtual() {
    return { ...this.sessao }
  }

  aoMudar(fn: () => void) {
    this.ouvintes.add(fn)
    return () => {
      this.ouvintes.delete(fn)
    }
  }

  private avisar() {
    this.ouvintes.forEach((f) => f())
  }

  async exportar(): Promise<Backup> {
    const colecoes: Record<string, unknown[]> = {}
    for (const n of NOMES_COLECOES) colecoes[n] = await this.repos[n].listar()
    const arquivos: Record<Id, string> = {}
    for (const id of await this.arquivos.listarIds()) {
      const b = await this.arquivos.obter(id)
      if (b) arquivos[id] = await blobParaDataUrl(b)
    }
    return { formato: 'tudo-backup', versao: 1, exportadoEm: this.relogio.agora(), colecoes, arquivos }
  }

  async importar(b: Backup) {
    if (b?.formato !== 'tudo-backup' || b.versao !== 1 || typeof b.colecoes !== 'object') throw new ErroNegocio('Esse arquivo não é um backup deste app.')
    for (const n of NOMES_COLECOES) {
      const regs = b.colecoes[n] ?? []
      if (!Array.isArray(regs) || regs.some((r) => !r || typeof (r as Base).id !== 'string')) throw new ErroNegocio(`Backup com defeito em "${n}". Nada foi mudado.`)
    }
    await this.enfileirar(() =>
      this.transacao(async () => {
        for (const n of NOMES_COLECOES) {
          await this.repos[n].limpar()
          await (this.repos[n] as { salvarVarios(r: unknown[]): Promise<void> }).salvarVarios(b.colecoes[n] ?? [])
        }
      }),
    )
    await this.arquivos.limpar()
    for (const [id, url] of Object.entries(b.arquivos ?? {})) await this.arquivos.guardar(id, dataUrlParaBlob(url))
    this.urls.clear()
    this.avisar()
  }

  async limparTudo() {
    await this.enfileirar(() =>
      this.transacao(async () => {
        for (const n of NOMES_COLECOES) await this.repos[n].limpar()
      }),
    )
    await this.arquivos.limpar()
    this.urls.clear()
    this.avisar()
  }
}

async function blobParaDataUrl(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${b.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

function dataUrlParaBlob(url: string): Blob {
  const [cab, dados] = url.split(',')
  const mime = /data:([^;]+)/.exec(cab)?.[1] ?? 'application/octet-stream'
  const bin = atob(dados ?? '')
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return new Blob([buf], { type: mime })
}
