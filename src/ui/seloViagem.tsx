// VIAGEM À VISTA — o mesmo selo e o mesmo filtro em toda lista (Compras, Triagem, Estoque, Vender):
//   · SeloViagem: "✈️ VG-0001 · Feira de Oruro" (um toque abre a viagem). A viagem vem do servidor junto com a linha.
//   · FiltroViagem: o botão "✈️ Todas as viagens ▾" ao lado da busca (sempre à vista) que abre a janela de escolher a
//     viagem, com busca, destino e período. Ex.: 2 dias de viagem, um monte de cabelo → escolhe a viagem e vê só o que veio dela.

import { useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { ViagemCurta } from '../core/services/viagemCurta'
import { Janela, cx, dataBR } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

export function SeloViagem({ v, curto, className }: { v?: ViagemCurta; curto?: boolean; className?: string }) {
  const t = useT()
  const { ir } = useApp()
  if (!v) return null
  return (
    <button type="button" title={`${t('Viagem')} ${v.codigo} · ${v.nome}`} onClick={(e) => (e.stopPropagation(), ir('viagem', { id: v.id }))}
      className={cx('inline-flex min-h-6 max-w-full shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2 text-xs font-semibold text-sky-700 ring-1 ring-sky-500/25 hover:bg-sky-500/20 dark:text-sky-300', className)}>
      <span aria-hidden>✈️</span><span className="font-mono">{v.codigo}</span>{!curto && <span className="truncate font-normal">· {v.nome}</span>}
    </button>
  )
}

/** os vários selos (um pacote juntado pode vir de duas viagens) */
export function SelosViagem({ vs, curto }: { vs?: ViagemCurta[]; curto?: boolean }) {
  if (!vs?.length) return null
  return <span className="inline-flex flex-wrap gap-1">{vs.map((v) => <SeloViagem key={v.id} v={v} curto={curto} />)}</span>
}

/** "" = todas · "sem" = sem viagem · id = a viagem */
export const passaViagem = (valor: string, vs: (ViagemCurta | undefined)[]) =>
  !valor ? true : valor === 'sem' ? !vs.some(Boolean) : vs.some((v) => v?.id === valor)

/** as viagens (sem repetir, mais nova primeiro pelo código) que aparecem nas linhas */
export function viagensDasLinhas(vs: (ViagemCurta | undefined)[]): ViagemCurta[] {
  return [...new Map(vs.filter((v): v is ViagemCurta => !!v).map((v) => [v.id, v])).values()].sort((a, b) => (a.codigo < b.codigo ? 1 : -1))
}

/** período da viagem (pela data de início) */
const PERIODOS = [
  { id: '', nome: 'Qualquer data' },
  { id: 'abertas', nome: 'Em andamento' },
  { id: '30', nome: 'Últimos 30 dias' },
  { id: '90', nome: 'Últimos 90 dias' },
  { id: 'ano', nome: 'Este ano' },
] as const

/**
 * FILTRO DE VIAGEM — o componente único (Compras, Triagem, Estoque, Vender): um botão "✈️ Todas as viagens ▾" ao lado
 * da busca que abre uma JANELA simples para escolher a viagem, com filtros que se montam sozinhos pelas viagens que
 * existem: 🔎 busca (código, nome, destino) · 📍 destino · 📅 quando (em andamento, 30/90 dias, este ano). Cada viagem
 * mostra destino, datas, se está aberta e QUANTOS desta lista vieram dela. "Sem viagem" também é uma escolha.
 * As viagens vêm do servidor (viagensParaFiltro); a contagem vem das linhas da tela (`nasLinhas`).
 */
export function FiltroViagem({ valor, onChange, nasLinhas }: { valor: string; onChange(id: Id | ''): void; nasLinhas: (ViagemCurta | undefined)[][] }) {
  const t = useT()
  const { dados } = useConsulta('viagensParaFiltro', {})
  const [aberta, setAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const [destino, setDestino] = useState('')
  const [periodo, setPeriodo] = useState('')
  const viagens = dados ?? []
  const conta = new Map<string, number>()
  let semViagem = 0
  for (const vs of nasLinhas) {
    const ids = [...new Set(vs.filter(Boolean).map((v) => v!.id))]
    if (!ids.length) semViagem++
    for (const id of ids) conta.set(id, (conta.get(id) ?? 0) + 1)
  }
  const atual = viagens.find((v) => v.id === valor)
  const destinos = [...new Set(viagens.map((v) => v.destino).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const hoje = new Date().toISOString().slice(0, 10)
  const desde = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  const b = busca.trim().toLowerCase()
  const lista = viagens.filter((v) =>
    (!b || [v.codigo, v.nome, v.destino].filter(Boolean).join(' ').toLowerCase().includes(b)) &&
    (!destino || v.destino === destino) &&
    (!periodo || (periodo === 'abertas' ? v.status === 'aberta' : periodo === 'ano' ? v.inicio.slice(0, 4) === hoje.slice(0, 4) : v.inicio >= desde(Number(periodo)))),
  )
  const escolher = (id: Id | '') => (onChange(id), setAberta(false))
  const chip = (on: boolean) => cx('min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold transition', on ? 'bg-sky-600 text-white' : 'bg-[var(--fundo)] text-[var(--texto)] ring-1 ring-[var(--borda)] hover:ring-sky-500')
  const nome = valor === 'sem' ? t('Sem viagem') : atual ? atual.codigo : t('Todas as viagens')
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`${t('Viagem')}: ${nome}`} onClick={() => setAberta(true)}
        className={cx('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', valor ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-sky-500')}>
        <span aria-hidden>✈️</span><span className={cx('max-w-[9rem] truncate', !valor && 'hidden sm:inline')}>{nome}</span><span aria-hidden className="text-xs">▾</span>
      </button>
      {aberta && (
        <Janela aberta titulo={`✈️ ${t('Filtrar por viagem')}`} onFechar={() => setAberta(false)}>
          <div className="space-y-3">
            {/* as duas escolhas gerais */}
            <div className="grid grid-cols-2 gap-2">
              {([['', 'Todas as viagens', nasLinhas.length], ['sem', 'Sem viagem', semViagem]] as const).map(([id, n, q]) => (
                <button key={id || 'todas'} type="button" aria-pressed={valor === id} onClick={() => escolher(id)}
                  className={cx('flex min-h-12 items-center justify-between gap-2 rounded-2xl border-2 px-3 text-left text-sm font-semibold', valor === id ? 'border-sky-500 bg-sky-500/10' : 'border-[var(--borda)] hover:border-sky-500')}>
                  <span>{t(n)}</span><span className="num rounded-full bg-[var(--fundo)] px-2 text-xs">{q}</span>
                </button>
              ))}
            </div>
            {/* os filtros (montados pelas viagens que existem) */}
            {viagens.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-[var(--fundo)] p-3">
                <input type="search" aria-label={t('Buscar viagem')} placeholder={t('Buscar código, nome ou destino')} value={busca} onChange={(e) => setBusca(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 outline-none focus:border-sky-500" />
                {destinos.length > 1 && (
                  <div role="group" aria-label={t('Destino')} className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                    <span aria-hidden className="flex shrink-0 items-center text-sm">📍</span>
                    <button type="button" aria-pressed={!destino} onClick={() => setDestino('')} className={chip(!destino)}>{t('Todos')}</button>
                    {destinos.map((d) => <button key={d} type="button" aria-pressed={destino === d} onClick={() => setDestino(destino === d ? '' : d)} className={chip(destino === d)}>{d}</button>)}
                  </div>
                )}
                <div role="group" aria-label={t('Quando')} className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                  <span aria-hidden className="flex shrink-0 items-center text-sm">📅</span>
                  {PERIODOS.map((p) => <button key={p.id || 'qq'} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)} className={chip(periodo === p.id)}>{t(p.nome)}</button>)}
                </div>
              </div>
            )}
            {/* as viagens */}
            {!dados ? <p className="text-sm text-[var(--suave)]">{t('Carregando…')}</p>
              : !viagens.length ? <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t('Nenhuma viagem cadastrada ainda.')}</p>
                : !lista.length ? <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t('Nenhuma viagem com esses filtros.')}</p>
                  : (
                    <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                      {lista.map((v) => {
                        const n = conta.get(v.id) ?? 0
                        const on = valor === v.id
                        return (
                          <li key={v.id}>
                            <button type="button" aria-pressed={on} onClick={() => escolher(v.id)}
                              className={cx('flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition', on ? 'border-sky-500 bg-sky-500/10' : 'border-[var(--borda)] hover:border-sky-500', !n && 'opacity-70')}>
                              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-lg">✈️</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2"><b className="font-mono">{v.codigo}</b><span className={cx('rounded-full px-2 text-[11px] font-semibold', v.status === 'aberta' ? 'bg-[var(--bom)]/12 text-[var(--bom)]' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{t(v.status === 'aberta' ? 'em andamento' : 'encerrada')}</span></span>
                                <b className="block truncate text-sm">{v.nome}</b>
                                <span className="num block truncate text-xs text-[var(--suave)]">{[v.destino && `📍 ${v.destino}`, `📅 ${dataBR(v.inicio)}${v.fim ? ` – ${dataBR(v.fim)}` : ''}`].filter(Boolean).join(' · ')}</span>
                              </span>
                              <span className="shrink-0 text-right">
                                <b className="num block text-lg leading-none">{n}</b>
                                <span className="text-[11px] text-[var(--suave)]">{t('nesta lista')}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
          </div>
        </Janela>
      )}
    </>
  )
}
