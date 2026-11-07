// AS PEÇAS QUE ENVOLVEM AS TELAS (cada uma com um papel só):
//   ComIdioma    — o idioma (aparelho › perfil › sistema), o formato de número/data e a moeda padrão
//   Preparar     — primeiro uso no aparelho: monta os dados de exemplo antes de mostrar o login
//   Tela         — a tela da rota, respeitando quem pode abrir (funcionária cai na agenda)
//   NovaVersao   — versão nova publicada: avisa e só recarrega no toque
//   Recuperacao  — erro numa tela vira aviso com "Tentar de novo" (nunca tela branca)
import { Component, type ReactNode, useEffect, useRef, useState } from 'react'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { carregarDemo } from '../adapters/demo'
import { PacoteVenda } from '../features/lote'
import { Agenda } from '../features/agenda'
import { Painel } from '../features/painel'
import { Botao, Carregando, definirPadroes } from '../shared/ui/base'
import { useApp, useConsulta } from '../shared/ui/contexto'
import { IdiomaContexto, type Idioma, localeDe, traduzir, useT } from '../shared/ui/i18n'
import { useIdiomaAparelho } from '../shared/ui/idiomaAparelho'
import { TELAS_LIBERAVEIS, type TelaLiberavel, useLiberado } from '../shared/ui/liberado'
import { navParaHash } from '../shared/navegacao/rotas'
import { NaoEncontrada } from './NaoEncontrada'
import { SO_ADMIN, TELAS } from './telas'

export function ComIdioma({ children }: { children: ReactNode }) {
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
  return <T />
}

/**
 * Primeiro uso no aparelho: já deixa tudo pronto para testar — dados fictícios de 45 dias e usuários de teste.
 * Depois mostra a tela de entrar. (Com a API não faz nada: quem tem os dados é o servidor.)
 */
export function Preparar({ children }: { children: ReactNode }) {
  const t = useT()
  const { backend, avisar, nav } = useApp()
  // QR de etiqueta ou vitrine aberta num aparelho de fora: não monta dados de exemplo (nada do negócio aparece)
  const publico = nav.tela === 'qr' || nav.tela === 'loja'
  const { dados } = useConsulta('usuariosDemo', {}, backend.tipo !== 'api' && !publico)
  const [montando, setMontando] = useState(false)
  const montou = useRef(false)
  useEffect(() => {
    if (publico || backend.tipo === 'api' || !dados || dados.length || montando || montou.current) return
    montou.current = true
    setMontando(true)
    carregarDemo(backend as BackendNoAparelho)
      .catch((e) => avisar(e instanceof Error ? e.message : String(e), 'erro'))
      .finally(() => setMontando(false))
  }, [backend, dados, montando, avisar, publico])
  if (!publico && backend.tipo !== 'api' && (!dados || !dados.length))
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">💇‍♀️✂️🤝</div>
        <p className="font-semibold">{t('Preparando a demonstração com dados de exemplo…')}</p>
        {!dados && <Carregando tela />}
      </div>
    )
  return <>{children}</>
}

/** Versão nova publicada: avisa, mas só recarrega quando a pessoa tocar (não perde uma venda no meio). */
export function NovaVersao() {
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
