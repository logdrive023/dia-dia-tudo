// CONFIGURAÇÕES (casca): #/config = índice com os 4 grupos e a busca "O que você quer configurar?";
// #/config/<seção> = a seção, com endereço próprio. Celular: uma coisa por vez (índice → seção → "← Configurações").
// Desktop (≥1024px): na seção, a lista de tudo fica fixa à esquerda (busca no topo: "/" foca, Esc limpa).
// As seções e os grupos vêm de uma lista só (configSecoes.ts).

import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Trilha } from '../ui/trilha'
import { Titulo, Vazio, cx } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { type Tema, TEMAS, lerTema, salvarTema } from '../ui/tema'
import { GRUPOS_CONFIG, type SecaoConfig, buscarSecoes, grupoConfig, secaoConfig } from './configSecoes'

export function Config() {
  const { nav } = useApp()
  // endereço antigo (?aba=x) também abre a seção
  const s = secaoConfig(String(nav.tela === 'configSecao' ? nav.params.id ?? '' : nav.params.aba ?? ''))
  return s ? <Secao s={s} /> : <Indice />
}

/** "/" em qualquer lugar (fora de campo) foca a busca; Esc limpa; Enter abre a primeira encontrada. */
function useBusca() {
  const ref = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    const f = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      if (!ref.current || ref.current.offsetParent === null) return
      e.preventDefault()
      ref.current.focus()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  return { ref, q, setQ }
}

function CaixaBusca({ busca, onEnter, compacta }: { busca: ReturnType<typeof useBusca>; onEnter(): void; compacta?: boolean }) {
  const t = useT()
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (busca.q) {
        e.stopPropagation()
        busca.setQ('')
      } else busca.ref.current?.blur()
    } else if (e.key === 'Enter') onEnter()
  }
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--suave)]">🔎</span>
      <input
        ref={busca.ref}
        type="text"
        inputMode="search"
        autoComplete="off"
        enterKeyHint="go"
        aria-label={t('O que você quer configurar?')}
        placeholder={t(compacta ? 'Buscar configuração' : 'O que você quer configurar?')}
        value={busca.q}
        onChange={(e) => busca.setQ(e.target.value)}
        onKeyDown={tecla}
        className={cx('w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] pl-10 pr-10 outline-none focus:border-[var(--marca)]', compacta ? 'min-h-11 text-sm' : 'min-h-12 text-base shadow-sm')}
      />
      {busca.q ? (
        <button type="button" aria-label={t('Limpar')} onClick={() => (busca.setQ(''), busca.ref.current?.focus())} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--suave)] hover:bg-[var(--fundo)]">×</button>
      ) : (
        <kbd aria-hidden className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--borda)] px-1.5 text-xs text-[var(--suave)] lg:block">/</kbd>
      )}
    </div>
  )
}

/** Uma linha tocável: ícone + nome + descrição de uma linha + ›. */
function LinhaSecao({ s, onClick, grupo }: { s: SecaoConfig; onClick(): void; grupo?: boolean }) {
  const t = useT()
  const g = grupoConfig(s.grupo)
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-[var(--fundo)] active:bg-[var(--marca-suave)]">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--marca-suave)] text-xl">{s.icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{t(s.nome)}</span>
        <span className="block truncate text-sm text-[var(--suave)]">{grupo ? `${t(g.nome)} · ` : ''}{t(s.descricao)}</span>
      </span>
      <span aria-hidden className="text-xl text-[var(--suave)]">›</span>
    </button>
  )
}

function Indice() {
  const t = useT()
  const { ir } = useApp()
  const busca = useBusca()
  const achadas = buscarSecoes(busca.q, t)
  const abrir = (s?: SecaoConfig) => s && ir('configSecao', { id: s.id })
  return (
    <div className="mx-auto max-w-5xl">
      <Titulo acao={<div className="flex flex-wrap justify-end gap-2"><TemaEscolha /><Idioma /></div>}>{t('Configurações')}</Titulo>
      <div className="mb-5 lg:max-w-xl">
        <CaixaBusca busca={busca} onEnter={() => abrir(achadas[0])} />
      </div>
      {busca.q.trim() ? (
        achadas.length ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
            <h2 className="sr-only">{t('Resultados')}</h2>
            <ul className="divide-y divide-[var(--borda)]">{achadas.map((s) => <li key={s.id}><LinhaSecao s={s} grupo onClick={() => abrir(s)} /></li>)}</ul>
          </section>
        ) : (
          <Vazio texto={t('Nada encontrado para “{q}”. Tente outra palavra, ex.: câmbio, senha, coluna.', { q: busca.q.trim() })} />
        )
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {GRUPOS_CONFIG.map((g) => (
            <section key={g.id} aria-labelledby={`cfg-${g.id}`} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
              <h2 id={`cfg-${g.id}`} className="flex items-center gap-2 border-b border-[var(--borda)] px-4 py-3 text-base font-bold">
                <span aria-hidden className="text-xl">{g.icone}</span>
                {t(g.nome)}
              </h2>
              <ul className="divide-y divide-[var(--borda)]">
                {achadas.filter((s) => s.grupo === g.id).map((s) => <li key={s.id}><LinhaSecao s={s} onClick={() => abrir(s)} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tema claro / escuro / automático, ao lado do idioma (vale para este aparelho). */
function TemaEscolha() {
  const t = useT()
  const [atual, setAtual] = useState<Tema>(lerTema)
  return (
    <div role="radiogroup" aria-label={t('Tema')} title={t('Vale para este aparelho')} className="flex gap-1 rounded-xl bg-[var(--marca-suave)] p-1">
      {TEMAS.map((x) => (
        <button key={x.id} type="button" role="radio" aria-checked={atual === x.id} aria-label={t(x.nome)} title={t(x.nome)} onClick={() => (salvarTema(x.id), setAtual(x.id))} className={cx('min-h-11 rounded-lg px-3 text-sm font-semibold', atual === x.id ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
          <span aria-hidden>{x.icone}</span><span className="hidden sm:inline"> {t(x.nome)}</span>
        </button>
      ))}
    </div>
  )
}

/** Idioma à mão logo no topo (quem não entende a língua da tela acha sem procurar). */
function Idioma() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar } = useComando()
  const atual = dados?.config.idioma ?? 'pt'
  return (
    <div role="radiogroup" aria-label={t('Idioma')} className="flex flex-wrap gap-1 rounded-xl bg-[var(--marca-suave)] p-1">
      {(['pt', 'es'] as const).map((i) => (
        <button key={i} type="button" role="radio" aria-checked={atual === i} onClick={() => atual !== i && executar('salvarConfig', { idioma: i })} className={cx('min-h-11 min-w-max flex-1 rounded-lg px-3 text-sm font-semibold', atual === i ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
          {i === 'pt' ? '🇧🇷 Português' : '🇧🇴 Español'}
        </button>
      ))}
    </div>
  )
}

function Secao({ s }: { s: SecaoConfig }) {
  const t = useT()
  const g = grupoConfig(s.grupo)
  const C = s.componente
  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <ListaLateral atual={s.id} />
      <div className="min-w-0">
        {/* celular: a trilha (← Configurações › grupo › seção); no computador a lista ao lado já mostra onde está */}
        <div className="lg:hidden"><Trilha niveis={[{ rotulo: <><span aria-hidden>{g.icone} </span>{t(g.nome)}</> }]} atual={t(s.nome)} /></div>
        <p className="hidden text-xs font-medium text-[var(--suave)] lg:block">
          <span aria-hidden>{g.icone} </span>{t(g.nome)} <span aria-hidden>›</span> {t(s.nome)}
        </p>
        <Titulo subtitulo={t(s.descricao)}>{t(s.nome)}</Titulo>
        <C key={s.id} />
      </div>
    </div>
  )
}

/** Desktop: todas as seções, agrupadas, com a atual marcada; a busca filtra a lista. */
function ListaLateral({ atual }: { atual: string }) {
  const t = useT()
  const { ir } = useApp()
  const busca = useBusca()
  const achadas = buscarSecoes(busca.q, t)
  const abrir = (s?: SecaoConfig) => {
    if (!s) return
    busca.setQ('')
    if (s.id !== atual) ir('configSecao', { id: s.id })
  }
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-3 overflow-y-auto pb-4">
        <button type="button" onClick={() => ir('config')} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-bold hover:bg-[var(--fundo)]">
          <span aria-hidden>⚙️</span> {t('Configurações')}
        </button>
        <CaixaBusca compacta busca={busca} onEnter={() => abrir(achadas[0])} />
        <nav aria-label={t('Seções das configurações')}>
          {!achadas.length && <p className="px-2 py-3 text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>}
          {GRUPOS_CONFIG.map((g) => {
            const itens = achadas.filter((s) => s.grupo === g.id)
            if (!itens.length) return null
            return (
              <div key={g.id} className="mt-3 first:mt-0">
                <div className="px-2 pb-1 text-xs font-medium text-[var(--suave)]"><span aria-hidden>{g.icone} </span>{t(g.nome)}</div>
                <ul className="space-y-0.5">
                  {itens.map((s) => {
                    const ativo = s.id === atual
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => abrir(s)}
                          aria-current={ativo ? 'page' : undefined}
                          className={cx('relative flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm', ativo ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : 'hover:bg-[var(--fundo)]')}
                        >
                          {ativo && <span aria-hidden className="absolute left-0 top-2 h-6 w-1 rounded-r-full bg-[var(--marca)]" />}
                          <span aria-hidden className="w-5 text-center">{s.icone}</span>
                          <span className="min-w-0 flex-1 truncate">{t(s.nome)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
