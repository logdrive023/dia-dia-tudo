// AS PEÇAS QUE ENVOLVEM AS TELAS (cada uma com um papel só):
//   ComIdioma    — o idioma (aparelho › perfil › sistema), o formato de número/data e a moeda padrão
//   Preparar     — primeiro uso no aparelho: monta os dados de exemplo antes de mostrar o login
//   Tela         — a tela da rota, respeitando quem pode abrir (funcionária cai na agenda)
//   NovaVersao   — versão nova publicada: um selo discreto; no toque, a janela com quando saiu e o resumo; "Atualizar"
//                  mostra o carregando e só então recarrega (nunca abre sozinho na cara de quem está vendendo)
//   Recuperacao  — erro numa tela vira aviso com "Tentar de novo" (nunca tela branca)
import { Component, type ReactNode, useContext, useEffect, useRef, useState, Suspense } from 'react'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { type ProgressoDemo, aoProgressoDemo, carregarDemo } from '../adapters/demo'
import { montandoCenario } from '../adapters/cenarios'
import { Botao, Carregando, Janela, dataBR, definirPadroes } from '../shared/ui/base'
import { useApp, useConsulta } from '../shared/ui/contexto'
import { IdiomaContexto, type Idioma, localeDe, traduzir, useT, useDicionario } from '../shared/ui/i18n'
import { useIdiomaAparelho } from '../shared/ui/idiomaAparelho'
import { TELAS_LIBERAVEIS, type TelaLiberavel, useLiberado } from '../shared/ui/liberado'
import { navParaHash } from '../shared/navegacao/rotas'
import { NaoEncontrada } from './NaoEncontrada'
import { Agenda, PacoteVenda, Painel, SO_ADMIN, TELAS } from './telas'

export function ComIdioma({ children }: { children: ReactNode }) {
  const { dados } = useConsulta('configuracoes', {})
  // a escolha deste aparelho (funcionária) vale por cima do idioma do sistema
  const doAparelho = useIdiomaAparelho()
  const { sessao } = useApp()
  // funcionária: o idioma da equipe (espanhol no padrão — Configurações › O que a funcionária faz); admin: o do sistema
  const doPerfil = sessao.usuarioId && sessao.perfil === 'funcionario' ? dados?.config.funcionariaIdioma : dados?.config.idioma
  const idioma = (doAparelho ?? doPerfil ?? 'pt') as Idioma
  const pronto = useDicionario(idioma)
  // antes de desenhar as telas: números/datas no formato do idioma e a moeda principal como padrão
  definirPadroes({ locale: localeDe(idioma), moeda: dados?.config.moedaPrincipal ?? 'BOB' })
  useEffect(() => {
    document.documentElement.lang = idioma === 'es' ? 'es' : 'pt-BR'
  }, [idioma])
  if (!pronto) return <Carregando tela />
  return <IdiomaContexto.Provider value={idioma}>{children}</IdiomaContexto.Provider>
}

export function Tela() {
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
  // endereço que não existe → a tela 404; sem tela nenhuma ainda → o início do perfil
  const T = nome === 'lote' && sessao.perfil !== 'admin' ? PacoteVenda : TELAS[nome] ?? (nome ? NaoEncontrada : sessao.perfil === 'admin' ? Painel : Agenda)
  return <Suspense fallback={<Carregando linhas={6} />}><T /></Suspense>
}

/**
 * Primeiro uso no aparelho: já deixa tudo pronto para testar — dados fictícios de 45 dias e usuários de teste.
 * Depois mostra a tela de entrar. (Com a API não faz nada: quem tem os dados é o servidor.)
 */
export function Preparar({ children }: { children: ReactNode }) {
  const { backend, avisar, nav } = useApp()
  // QR de etiqueta ou vitrine aberta num aparelho de fora: não monta dados de exemplo (nada do negócio aparece)
  const publico = nav.tela === 'qr' || nav.tela === 'loja'
  const { dados } = useConsulta('usuariosDemo', {}, backend.tipo !== 'api' && !publico)
  const [montando, setMontando] = useState(false)
  // a barra da abertura: o que a montagem (esta ou a do Modo teste) já fez, de verdade
  const [progresso, setProgresso] = useState<ProgressoDemo>()
  useEffect(() => aoProgressoDemo(setProgresso), [])
  const montou = useRef(false)
  useEffect(() => {
    // Modo teste trocando os dados (sem usuários por um instante): não é o primeiro uso, não monta por cima
    if (publico || backend.tipo === 'api' || !dados || dados.length || montando || montou.current || montandoCenario()) return
    montou.current = true
    setMontando(true)
    carregarDemo(backend as BackendNoAparelho)
      .catch((e) => avisar(e instanceof Error ? e.message : String(e), 'erro'))
      .finally(() => setMontando(false))
  }, [backend, dados, montando, avisar, publico])
  if (!publico && backend.tipo !== 'api' && (!dados || !dados.length))
    return (
      <div className="flex min-h-screen items-center justify-center">
        {/* ainda conferindo se há dados: a abertura simples; montando: o cartão com a barra que enche */}
        {progresso ? <Carregando tela texto="Preparando a demonstração com dados de exemplo…" progresso={progresso.pct} detalhe={progresso.etapa} /> : <Carregando tela texto={dados ? 'Preparando a demonstração com dados de exemplo…' : 'Carregando…'} />}
      </div>
    )
  return <>{children}</>
}

type Texto2 = { pt: string; es: string }
/** o que o build publica em versao.json (vite.config.ts › versaoPublicada) */
interface VersaoPublicada { publicadoEm: string; novidade?: { data: string; titulo: Texto2; resumo?: Texto2; itens: Texto2[]; total: number } }

/** "hoje às 14:32" · "ontem às 09:10" · "08/11/2026 às 18:00" */
function quandoSaiu(iso: string, t: ReturnType<typeof useT>) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hora = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const dia = (x: Date) => x.toDateString()
  const ontem = new Date(Date.now() - 86_400_000)
  if (dia(d) === dia(new Date())) return t('hoje às {h}', { h: hora })
  if (dia(d) === dia(ontem)) return t('ontem às {h}', { h: hora })
  return t('{d} às {h}', { d: dataBR(d.toISOString().slice(0, 10)), h: hora })
}

const PASSOS_ATUALIZAR = [
  { ate: 45, texto: 'Baixando a versão nova…' },
  { ate: 90, texto: 'Instalando…' },
  { ate: 101, texto: 'Pronto! Abrindo…' },
]

/**
 * Versão nova publicada: um SELO discreto embaixo (não abre nada sozinho — não atrapalha uma venda no meio). No toque, a
 * janela: quando saiu, o resumo do que mudou e "Ver novidades". "Atualizar" mostra o carregando e então recarrega.
 * Para ver sem publicar nada: ?simular-atualizacao no endereço.
 */
export function NovaVersao() {
  const t = useT()
  const idioma = useContext(IdiomaContexto)
  const { sessao } = useApp()
  const [atualizar, setAtualizar] = useState<() => void>()
  const [info, setInfo] = useState<VersaoPublicada | null>()
  const [aberta, setAberta] = useState(false)
  const [pct, setPct] = useState<number>()
  useEffect(() => {
    const simular = new URLSearchParams(window.location.search).has('simular-atualizacao')
    if (simular) return setAtualizar(() => () => window.location.replace(window.location.pathname + window.location.hash))
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
  // o resumo da versão nova: lido só quando há uma (versao.json fica fora do cache offline)
  useEffect(() => {
    if (!atualizar || info !== undefined) return
    fetch(`${import.meta.env.BASE_URL}versao.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((x: VersaoPublicada | null) => setInfo(x?.publicadoEm ? x : null))
      .catch(() => setInfo(null))
  }, [atualizar, info])
  if (!atualizar) return null
  const lingua = (x: Texto2) => (idioma === 'es' ? x.es : x.pt)
  const admin = sessao.perfil === 'admin'
  /** o carregando (~1,6 s) e então a versão nova assume; com "Ver novidades", abre direto na tela de novidades */
  const comecar = (abrirNovidades: boolean) => {
    if (pct !== undefined) return
    if (abrirNovidades) window.location.hash = '#/novidades'
    setPct(0)
    let p = 0
    const passo = window.setInterval(() => {
      p = Math.min(100, p + 7 + Math.round(Math.random() * 8))
      setPct(p)
      if (p < 100) return
      window.clearInterval(passo)
      window.setTimeout(async () => {
        atualizar()
        // se o navegador não recarregar sozinho (outra aba aberta, computador), força
        const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
        window.setTimeout(() => window.location.reload(), 1500)
      }, 350)
    }, 110)
  }
  const n = info?.novidade
  const passo = pct === undefined ? undefined : PASSOS_ATUALIZAR.find((x) => pct < x.ate)
  return (
    <>
      {/* o SELO: pequeno, embaixo (acima do menu no celular, no canto no computador) — não cobre nada */}
      {!aberta && (
        <button type="button" onClick={() => setAberta(true)}
          className="fixed bottom-24 left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--borda)] bg-[var(--cartao)] py-1.5 pl-2 pr-4 text-sm shadow-lg transition active:scale-95 md:bottom-4 md:left-auto md:right-4 md:translate-x-0">
          <span aria-hidden className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[var(--marca)] text-xs text-white">
            ↑<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--ruim)] ring-2 ring-[var(--cartao)]" />
          </span>
          <span className="font-semibold">{t('Atualização disponível')}</span>
          <span className="font-semibold text-[var(--marca)]">{t('Ver')} ›</span>
        </button>
      )}
      <Janela aberta={aberta} titulo={t('Atualização disponível')} onFechar={() => pct === undefined && setAberta(false)}
        rodape={pct !== undefined ? undefined : (
          <div className="flex flex-wrap gap-2">
            {admin && <Botao variante="secundario" className="flex-1" onClick={() => comecar(true)}>✨ {t('Ver novidades')}</Botao>}
            <Botao grande className="flex-1" onClick={() => comecar(false)}>{t('Atualizar agora')}</Botao>
          </div>
        )}>
        {/* cabeçalho como na loja de apps: ícone, nome e quando saiu */}
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-14 w-14 shrink-0 rounded-2xl shadow" />
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight">Tudo</p>
            <p className="text-xs text-[var(--suave)]">
              {info === undefined ? t('Conferindo…') : info ? `${t('Publicada')} ${quandoSaiu(info.publicadoEm, t)}` : t('Versão nova pronta para instalar')}
            </p>
          </div>
        </div>
        {pct !== undefined ? (
          <div className="mt-5 space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{t(passo?.texto ?? 'Pronto! Abrindo…')}</span>
              <span className="num text-[var(--suave)]">{Math.min(100, pct)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--fundo)]">
              <div className="h-full rounded-full bg-[var(--marca)] transition-[width] duration-150" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="text-xs text-[var(--suave)]">{t('Não feche o aplicativo. Seus dados continuam no aparelho.')}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('O que há de novo')}</p>
            {n ? (
              <>
                <p className="font-semibold leading-snug">{lingua(n.titulo)}</p>
                {n.resumo && <p className="text-sm leading-relaxed text-[var(--suave)]">{lingua(n.resumo)}</p>}
                {!n.resumo && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--suave)]">
                    {n.itens.map((x, k) => <li key={k}>{lingua(x)}</li>)}
                  </ul>
                )}
                {n.total > 1 && <p className="text-xs text-[var(--suave)]">{t('{n} mudança(s) nesta versão.', { n: n.total })}</p>}
              </>
            ) : <p className="text-sm text-[var(--suave)]">{t('Melhorias e correções.')}</p>}
          </div>
        )}
      </Janela>
    </>
  )
}

/** Erro numa tela vira aviso com "Tentar de novo" (nunca tela branca). */
export class Recuperacao extends Component<{ children: ReactNode; chave: string }, { erro?: string; chave: string }> {
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
