// Casca do app: escolhe o armazenamento (uma vez), guarda quem está usando, navega entre telas, mostra avisos,
// atualiza o câmbio, oferece os dados de exemplo no primeiro uso e avisa quando há versão nova.

import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TELAS_LIBERAVEIS, type TelaLiberavel, useLiberado } from './ui/liberado'
import { useIdiomaAparelho } from './ui/idiomaAparelho'
import { NovoFuncionarioTela } from './screens/cadastros/CadastroFuncionario'
import { NovaPessoaTela } from './screens/cadastros/CadastroPessoa'
import { Auditoria } from './screens/Auditoria'
import type { BackendNoAparelho } from './adapters/noAparelho'
import { atualizarCambio } from './app/cambio'
import { criarBackend } from './app/criarBackend'
import { carregarDemo } from './app/demo'
import type { Sessao } from './core/ports/portas'
import { Botao, Carregando, Confirmar, definirPadroes } from './ui/base'
import { Conversor } from './ui/compartilhados'
import { type AppCtx, Ctx, type Navegacao, type Params, useApp, useConsulta } from './ui/contexto'
import { IdiomaContexto, type Idioma, localeDe, traduzir, useT } from './ui/i18n'
import { MENU, Shell } from './ui/Shell'
import { Agenda } from './screens/Agenda'
import { Caixa } from './screens/Caixa'
import { Comprar, NovaCompraTela, Pedido } from './screens/Comprar'
import { destinoVoltar, hashParaNav, navParaHash, normalizarNav } from './app/rotas'
import { Config } from './screens/Configuracoes'
import { Entrar } from './screens/Entrar'
import { Emprestimos, FichaEmprestimo } from './screens/Emprestimos'
import { CadastroEmprestimo } from './screens/cadastros/CadastroEmprestimo'
import { Equipe } from './screens/Equipe'
import { Estoque, FichaLote, Rastreio } from './screens/Estoque'
import { SepararTela } from './screens/triagem/Separar'
import { Etiquetas } from './screens/Etiquetas'
import { Painel } from './screens/Painel'
import { Triagem } from './screens/Triagem'
import { Livro } from './screens/Livro'
import { FichaPessoa, Pessoas } from './screens/Pessoas'
import { Precos } from './screens/Precos'
import { Relatorios } from './screens/Relatorios'
import { Novidades } from './screens/Novidades'
import { DetalheVenda } from './screens/Vendas'
import { Vender } from './screens/Vender'
import { VendaRapida } from './screens/VendaRapida'
import { PacoteVenda } from './screens/PacoteVenda'
import { FichaViagem, Viagens, NovaViagemTela } from './screens/Viagens'
import { Financiamentos, FichaFinanciamento } from './screens/Financiamentos'
import { CadastroAdiantamento } from './screens/cadastros/CadastroAdiantamento'

const TELAS: Record<string, () => JSX.Element> = {
  painel: Painel,
  vender: Vender,
  vendaRapida: VendaRapida,
  comprar: Comprar,
  pedido: Pedido,
  novaCompra: NovaCompraTela,
  triagem: Triagem,
  etiquetas: Etiquetas,
  livro: Livro,
  estoque: Estoque,
  lote: FichaLote,
  rastreio: Rastreio,
  caixa: Caixa,
  agenda: Agenda,
  equipe: Equipe,
  pessoas: Pessoas,
  pessoa: FichaPessoa,
  emprestimos: Emprestimos,
  emprestimo: FichaEmprestimo,
  novoEmprestimo: CadastroEmprestimo,
  separar: SepararTela,
  precos: Precos,
  tabelaPreco: Precos,
  relatorios: Relatorios,
  novidades: Novidades,
  auditoria: Auditoria,
  config: Config,
  configSecao: Config,
  vendas: Vender,
  venda: DetalheVenda,
  viagens: Viagens,
  viagem: FichaViagem,
  adiantamentos: Financiamentos,
  financiamento: FichaFinanciamento,
  novoFinanciamento: CadastroAdiantamento,
  novaPessoa: NovaPessoaTela,
  novoFuncionario: NovoFuncionarioTela,
  novaViagem: NovaViagemTela,
}
const SO_ADMIN = new Set([...MENU.filter((m) => m.admin).map((m) => m.tela), 'rastreio', 'emprestimo', 'vendas', 'pedido', 'novaCompra', 'tabelaPreco', 'novoEmprestimo', 'separar', 'novoFuncionario', 'viagem', 'novaViagem', 'novoFinanciamento'])

function lerSessao(padrao: Sessao): Sessao {
  try {
    const s = JSON.parse(localStorage.getItem('tudo.sessao') ?? 'null') as Sessao | null
    return s?.usuarioId ? { ...padrao, ...s } : padrao
  } catch {
    return padrao
  }
}

export default function App() {
  // o backend é criado uma vez só (a sessão é o mesmo objeto que as regras usam)
  const inicial = useMemo(() => {
    const c = criarBackend()
    // ninguém entrou ainda, a não ser que a sessão tenha ficado salva neste aparelho
    Object.assign(c.sessao, lerSessao({ ...c.sessao, usuarioId: '', nome: '' }))
    return c
  }, [])
  const backend = inicial.backend
  const [sessao, setSessao] = useState<Sessao>({ ...inicial.sessao })
  // abre direto no endereço da barra (ex.: #/pedidos/P-0007), se houver
  const [pilha, setPilha] = useState<Navegacao[]>(() => [hashParaNav(window.location.hash) ?? { tela: sessao.perfil === 'admin' ? 'painel' : 'agenda', params: {} }])
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'erro' }>()
  const nav = pilha[pilha.length - 1]

  const ir = useCallback((tela: string, params: Params = {}) => {
    const n = normalizarNav({ tela, params })
    // a tela de agora guarda onde a pessoa estava (o "voltar" devolve a rolagem)
    history.replaceState({ ...(history.state ?? {}), rolagem: window.scrollY }, '', window.location.hash)
    setPilha((p) => [...p.slice(-30), n])
    history.pushState(null, '', navParaHash(n))
    window.scrollTo(0, 0)
  }, [])
  // voltar: pelo histórico; se a tela foi aberta direto por um link, vai para a lista "pai" (nunca sai do app)
  const pilhaRef = useRef(pilha)
  pilhaRef.current = pilha
  // regra IR E VOLTAR: veio de outra tela (lista ou detalhe) → volta para ela (com a aba e os filtros); veio de um
  // formulário (ex.: Nova compra → Pedido) → vai para a lista da área (Pedido → Compras), nunca para o formulário enviado
  // (a regra fica em destinoVoltar: a trilha de navegação usa a mesma para mostrar para onde volta)
  const voltar = useCallback(() => {
    const d = destinoVoltar(pilhaRef.current)
    if (d.modo === 'anterior') return history.back()
    // a lista já está mais atrás no histórico: volta até ela (mantém filtros)
    if (d.modo === 'pular') return history.go(d.passos)
    setPilha((p) => [...p.slice(0, -1), d.alvo])
    history.replaceState(null, '', navParaHash(d.alvo))
  }, [])
  const origem = useMemo(() => (pilha.length ? destinoVoltar(pilha).alvo : undefined), [pilha])
  const avisar = useCallback((texto: string, tipo: 'ok' | 'erro' = 'ok') => setAviso({ texto, tipo }), [])
  const ajustarParams = useCallback((p: Params) => {
    setPilha((pl) => {
      const atual = pl[pl.length - 1]
      const params = { ...atual.params, ...p }
      for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k]
      const n = { tela: atual.tela, params }
      history.replaceState(null, '', navParaHash(n))
      return [...pl.slice(0, -1), n]
    })
  }, [])
  // dado não salvo: menu, voltar e voltar do celular pedem confirmação antes de sair
  const sujoRef = useRef(false)
  const [saida, setSaida] = useState<() => void>()
  const marcarSujo = useCallback((s: boolean) => {
    sujoRef.current = s
  }, [])
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (sujoRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [])
  const protegido = useCallback(<A extends unknown[]>(acao: (...a: A) => void) => (...a: A) => {
    if (!sujoRef.current) return acao(...a)
    setSaida(() => () => {
      sujoRef.current = false
      acao(...a)
    })
  }, [])
  const trocarSessao = useCallback(
    (s: Sessao) => {
      Object.assign(inicial.sessao, s)
      setSessao({ ...s })
      try {
        localStorage.setItem('tudo.sessao', JSON.stringify(s))
      } catch {
        /* ignora */
      }
    },
    [inicial],
  )
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(undefined), aviso.tipo === 'erro' ? 6000 : 2500)
    return () => clearTimeout(id)
  }, [aviso])
  // "voltar"/"avançar" do navegador e do celular seguem o endereço (a rolagem quem devolve é o app, depois de carregar)
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const f = () => {
      if (sujoRef.current) {
        const ali = pilhaRef.current[pilhaRef.current.length - 1]
        history.pushState(null, '', navParaHash(ali))
        setSaida(() => () => {
          sujoRef.current = false
          history.go(-2)
        })
        return
      }
      const n = hashParaNav(window.location.hash)
      if (n) setPilha((p) => (p.length > 1 ? p.slice(0, -1) : [n]).map((x, i, a) => (i === a.length - 1 ? n : x)))
      // devolve a rolagem de quando saiu desta tela: a página carrega aos poucos, então tenta até caber (até ~2 s)
      const y = (history.state as { rolagem?: number } | null)?.rolagem
      if (y) {
        let k = 0
        const tentar = () => {
          if (document.documentElement.scrollHeight - window.innerHeight >= y || k > 40) return window.scrollTo(0, y)
          k++
          setTimeout(tentar, 50)
        }
        setTimeout(tentar, 0)
      }
    }
    window.addEventListener('popstate', f)
    return () => window.removeEventListener('popstate', f)
  }, [])
  useEffect(() => {
    if (!window.location.hash) history.replaceState(null, '', navParaHash(nav))
  }, [nav])
  useEffect(() => {
    if (backend.tipo !== 'api') atualizarCambio(backend).catch(() => undefined)
  }, [backend])

  const irSeguro = useMemo(() => protegido(ir), [protegido, ir])
  const voltarSeguro = useMemo(() => protegido(voltar), [protegido, voltar])
  const ctx: AppCtx = { backend, sessao, trocarSessao, nav, origem, ir: irSeguro, voltar: voltarSeguro, avisar, ajustarParams, marcarSujo }
  return (
    <Ctx.Provider value={ctx}>
      <ComIdioma>
        <Preparar>
          {!sessao.usuarioId ? (
            <Entrar onEntrou={(s) => (trocarSessao(s), setPilha([hashParaNav(window.location.hash) ?? { tela: s.perfil === 'admin' ? 'painel' : 'agenda', params: {} }]))} />
          ) : (
            <>
              <Shell>
                <Recuperacao chave={nav.tela}>
                  <Tela />
                </Recuperacao>
              </Shell>
              <Conversor />
            </>
          )}
        </Preparar>
        <NovaVersao />
        {saida && (
          <Confirmar titulo="Sair sem salvar?" texto="O que você digitou nesta tela ainda não foi salvo e vai ser perdido." rotulo="Sair sem salvar" perigo onConfirmar={() => saida()} onFechar={() => setSaida(undefined)} />
        )}
        {/* aviso no ALTO (abaixo da faixa da demonstração): nunca cobre os botões das barras fixas nem das folhas de baixo */}
        {aviso && (
          <div role="status" className={`nao-imprimir fixed inset-x-4 top-[calc(env(safe-area-inset-top)+2.25rem)] z-50 mx-auto max-w-md rounded-2xl px-3 py-2 text-center text-sm font-semibold text-white shadow-lg ${aviso.tipo === 'erro' ? 'bg-[var(--ruim)]' : 'bg-[var(--bom)]'}`} onClick={() => setAviso(undefined)}>
            <Traduz texto={aviso.texto} />
          </div>
        )}
      </ComIdioma>
    </Ctx.Provider>
  )
}

function Traduz({ texto }: { texto: string }) {
  const t = useT()
  return <>{t(texto)}</>
}

function ComIdioma({ children }: { children: ReactNode }) {
  const { dados } = useConsulta('configuracoes', {})
  // a escolha deste aparelho (funcionária) vale por cima do idioma do sistema
  const doAparelho = useIdiomaAparelho()
  const { sessao } = useApp()
  // funcionária: o idioma da equipe (espanhol no padrão — Configurações › O que a funcionária faz); admin: o do sistema
  const doPerfil = sessao.usuarioId && sessao.perfil === 'funcionario' ? dados?.config.funcionariaIdioma : dados?.config.idioma
  const idioma = (doAparelho ?? doPerfil ?? 'pt') as Idioma
  // antes de desenhar as telas: números/datas no formato do idioma e a moeda principal como padrão
  definirPadroes({ locale: localeDe(idioma), moeda: dados?.config.moedaPrincipal ?? 'BOB' })
  useEffect(() => {
    document.documentElement.lang = idioma === 'es' ? 'es' : 'pt-BR'
  }, [idioma])
  return <IdiomaContexto.Provider value={idioma}>{children}</IdiomaContexto.Provider>
}

function Tela() {
  const { nav, sessao } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const liberado = useLiberado()
  // Pessoas, Viagens, Adiantamentos: só com a liberação do admin — Configurações › O que a funcionária faz
  const naoLiberada = !!cfg && (TELAS_LIBERAVEIS as string[]).includes(nav.tela) && !liberado(nav.tela as TelaLiberavel)
  const proibida = sessao.perfil !== 'admin' && (SO_ADMIN.has(nav.tela) || naoLiberada)
  const nome = proibida ? 'agenda' : nav.tela
  // endereço e tela sempre juntos: se a tela não é permitida, o endereço também vira a agenda
  useEffect(() => {
    if (proibida) history.replaceState(null, '', navParaHash({ tela: 'agenda', params: {} }))
  }, [proibida])
  // funcionária abrindo um pacote (QR): a visão enxuta para VENDER (a ficha completa é do administrador)
  const T = nome === 'lote' && sessao.perfil !== 'admin' ? PacoteVenda : TELAS[nome] ?? (sessao.perfil === 'admin' ? Painel : Agenda)
  return <T />
}

/**
 * Primeiro uso no aparelho: já deixa tudo pronto para testar — dados fictícios de 45 dias e usuários de teste.
 * Depois mostra a tela de entrar. (Com a API não faz nada: quem tem os dados é o servidor.)
 */
function Preparar({ children }: { children: ReactNode }) {
  const t = useT()
  const { backend, avisar } = useApp()
  const { dados } = useConsulta('usuariosDemo', {}, backend.tipo !== 'api')
  const [montando, setMontando] = useState(false)
  const montou = useRef(false)
  useEffect(() => {
    if (backend.tipo === 'api' || !dados || dados.length || montando || montou.current) return
    montou.current = true
    setMontando(true)
    carregarDemo(backend as BackendNoAparelho)
      .catch((e) => avisar(e instanceof Error ? e.message : String(e), 'erro'))
      .finally(() => setMontando(false))
  }, [backend, dados, montando, avisar])
  if (backend.tipo !== 'api' && (!dados || !dados.length))
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">💇‍♀️✂️🤝</div>
        <p className="font-semibold">{t('Preparando a demonstração com dados de exemplo…')}</p>
        {!dados && <Carregando />}
      </div>
    )
  return <>{children}</>
}

/** Versão nova publicada: avisa, mas só recarrega quando a pessoa tocar (não perde uma venda no meio). */
function NovaVersao() {
  const t = useT()
  const [atualizar, setAtualizar] = useState<() => void>()
  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const up = registerSW({
          onNeedRefresh: () => setAtualizar(() => () => up(true)),
          onRegisteredSW: (_u, reg) => reg && setInterval(() => reg.update(), 3600_000),
        })
      })
      .catch(() => undefined)
  }, [])
  const [indo, setIndo] = useState(false)
  if (!atualizar) return null
  // pede para a versão nova assumir; se o navegador não recarregar sozinho (outra aba aberta, desktop), força o recarregamento
  const clicar = async () => {
    setIndo(true)
    atualizar()
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(() => window.location.reload(), 1500)
  }
  return (
    // embaixo (acima do menu no celular, no canto no computador): não cobre título nem botões
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl bg-[var(--marca)] p-3 text-white shadow-lg md:inset-x-auto md:bottom-4 md:right-4">
      <span className="text-sm font-semibold">🆕 {t('Nova versão disponível')}</span>
      <Botao variante="secundario" disabled={indo} onClick={clicar}>{indo ? t('Atualizando…') : t('Atualizar')}</Botao>
    </div>
  )
}

/** Erro numa tela vira aviso com "Tentar de novo" (nunca tela branca). */
class Recuperacao extends Component<{ children: ReactNode; chave: string }, { erro?: string; chave: string }> {
  static contextType = IdiomaContexto
  declare context: Idioma
  state: { erro?: string; chave: string } = { chave: this.props.chave }
  static getDerivedStateFromError(e: Error) {
    return { erro: e.message }
  }
  static getDerivedStateFromProps(p: { chave: string }, s: { erro?: string; chave: string }) {
    return p.chave !== s.chave ? { erro: undefined, chave: p.chave } : null
  }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="mx-auto max-w-md space-y-3 pt-10 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="font-semibold">{traduzir(this.context, 'Algo deu errado nesta tela.')}</p>
        <p className="text-xs text-[var(--suave)]">{this.state.erro}</p>
        <Botao onClick={() => this.setState({ erro: undefined })}>{traduzir(this.context, 'Tentar de novo')}</Botao>
      </div>
    )
  }
}
