// CONFIGURAÇÕES (casca): #/config = índice com os 4 grupos e a busca "O que você quer configurar?";
// #/config/<seção> = a seção, com endereço próprio. Celular: uma coisa por vez (índice → seção → "← Configurações").
// Desktop (≥1024px): na seção, a lista de tudo fica fixa à esquerda (busca no topo: "/" foca, Esc limpa).
// As seções e os grupos vêm de uma lista só (configSecoes.ts).

import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Trilha } from '../ui/trilha'
import { Titulo, Vazio, cx } from '../ui/base'
import { useApp, useConsulta } from '../ui/contexto'
import { TrocarMinhaSenha } from './config/Usuarios'
import { useT } from '../ui/i18n'
import { PreferenciasCabecalho } from '../ui/preferencias'
import { GRUPOS_CONFIG, type SecaoConfig, buscarSecoes, grupoConfig, secaoConfig, secoesDoPerfil } from './configSecoes'

export function Config() {
  const { nav, sessao } = useApp()
  // endereço antigo (?aba=x) também abre a seção
  const s = secaoConfig(String(nav.tela === 'configSecao' ? nav.params.id ?? '' : nav.params.aba ?? ''))
  // POR PERFIL: admin vê tudo; funcionária (e gerente) vê tema, idioma, a própria senha e o que o admin liberou
  if (sessao.perfil !== 'admin') return <ConfigFuncionaria s={s} />
  return s ? <Secao s={s} /> : <Indice />
}

/** Configurações de quem não é admin: o básico (tema, idioma, senha) e as seções liberadas em "O que a funcionária faz" */
function ConfigFuncionaria({ s }: { s?: SecaoConfig }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const [senha, setSenha] = useState(false)
  const liberadas = secoesDoPerfil(false, dados?.config.funcionariaConfig)
  if (s && liberadas.includes(s)) {
    const C = s.componente
    return (
      <div className="mx-auto max-w-5xl">
        <Trilha niveis={[]} atual={t(s.nome)} />
        <Titulo subtitulo={t(s.descricao)}>{t(s.nome)}</Titulo>
        <C key={s.id} />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Titulo acao={<PreferenciasCabecalho />} subtitulo={t('Tema e idioma valem para este aparelho.')}>{t('Configurações')}</Titulo>
      <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <button type="button" onClick={() => setSenha(true)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-[var(--fundo)]">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--marca-suave)] text-xl">🔑</span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">{t('Trocar minha senha')}</span><span className="block text-sm text-[var(--suave)]">{t('Só a sua: ninguém mais vê.')}</span></span>
          <span aria-hidden className="text-xl text-[var(--suave)]">›</span>
        </button>
        {liberadas.map((x) => <div key={x.id} className="border-t border-[var(--borda)]"><LinhaSecao s={x} grupo onClick={() => ir('configSecao', { id: x.id })} /></div>)}
      </section>
      {senha && <TrocarMinhaSenha onFechar={() => setSenha(false)} />}
    </div>
  )
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
      <Titulo acao={<PreferenciasCabecalho />}>{t('Configurações')}</Titulo>
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
        <>
          {/* as áreas num toque (vai direto para a faixa da área) */}
          <nav aria-label={t('Áreas das configurações')} className="sem-barra -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {GRUPOS_CONFIG.map((g) => (
              <a key={g.id} href={`#cfg-${g.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(`cfg-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold ring-1" style={{ background: `color-mix(in srgb, ${g.cor} 12%, transparent)`, color: g.cor, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${g.cor} 35%, transparent)` }}>
                <span aria-hidden>{g.icone}</span>{t(g.nome)}
              </a>
            ))}
          </nav>
          <div className="space-y-6">
            {GRUPOS_CONFIG.map((g) => {
              const secoes = achadas.filter((x) => x.grupo === g.id)
              if (!secoes.length) return null
              return (
                <section key={g.id} id={`cfg-${g.id}`} aria-labelledby={`cfg-t-${g.id}`} className="scroll-mt-4">
                  {/* a faixa da área: ícone na cor da área, nome e o que tem */}
                  <div className="mb-3 flex items-center gap-3 rounded-2xl p-3" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${g.cor} 16%, transparent), transparent)` }}>
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl text-white shadow-sm" style={{ background: g.cor }}>{g.icone}</span>
                    <span className="linha-texto">
                      <h2 id={`cfg-t-${g.id}`} className="text-lg font-bold leading-tight">{t(g.nome)}</h2>
                      <span className="text-sm text-[var(--suave)]">{t(g.descricao)}</span>
                    </span>
                    <span className="num shrink-0 rounded-full bg-[var(--cartao)] px-2.5 py-0.5 text-xs font-semibold text-[var(--suave)] ring-1 ring-[var(--borda)]">{secoes.length}</span>
                  </div>
                  {/* as seções em blocos (dá para ver tudo de uma vez) */}
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-2">
                    {secoes.map((x) => (
                      <li key={x.id}>
                        <button type="button" onClick={() => abrir(x)} className="group flex h-full min-h-[5.5rem] w-full items-start gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderLeft: `4px solid ${g.cor}` }}>
                          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `color-mix(in srgb, ${g.cor} 14%, transparent)` }}>{x.icone}</span>
                          <span className="min-w-0 flex-1">
                            <b className="block leading-tight">{t(x.nome)}</b>
                            <span className="mt-0.5 block text-sm leading-snug text-[var(--suave)]">{t(x.descricao)}</span>
                          </span>
                          <span aria-hidden className="self-center text-xl text-[var(--suave)] transition group-hover:translate-x-0.5">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}
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
        {/* computador: a área vira um selo com a cor dela dentro do cabeçalho (a lista ao lado já mostra a seção) */}
        <Titulo subtitulo={<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold lg:inline-flex" style={{ color: g.cor, background: `color-mix(in srgb, ${g.cor} 12%, transparent)` }}><span aria-hidden>{g.icone}</span>{t(g.nome)}</span>
          <span>{t(s.descricao)}</span>
        </span>}>{t(s.nome)}</Titulo>
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
                <div className="flex items-center gap-1.5 px-2 pb-1 text-xs font-bold uppercase tracking-wide" style={{ color: g.cor }}><span aria-hidden>{g.icone}</span>{t(g.nome)}</div>
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
                          {ativo && <span aria-hidden className="absolute left-0 top-2 h-6 w-1 rounded-r-full" style={{ background: g.cor }} />}
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
