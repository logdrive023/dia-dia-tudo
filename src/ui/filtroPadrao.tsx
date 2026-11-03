// FILTRO PADRÃO (o mesmo jeito em todas as listas): uma linha com a busca + "⚙ Filtros · N"; embaixo, os filtros
// ligados em chips com ✕ ("👤 Maria ✕") e "Limpar filtros"; o botão abre o painel no lugar, com os campos em
// GRUPOS separados (bloco com título e ícone: "🛒 De onde veio", "👤 Quem", "💇 O cabelo") e um rodapé
// "Limpar · Ver N resultados". Celular: dois campos por linha; computador: quatro. Tudo no endereço (quem usa decide).
// Variação permitida: atalhos (chips de período, abas) ficam fora do painel, mas o painel e os chips são sempre estes.

import type { ReactNode } from 'react'
import { Botao, Entrada, cx } from './base'
import { useT } from './i18n'

export interface FiltroAtivo {
  /** chave(s) do endereço que o ✕ apaga, separadas por vírgula ("de,ate") */
  k: string
  rotulo: string
}

/** Busca + botão "⚙ Filtros · N" (mesma altura, mesma ordem em toda tela). `extra` vai entre os dois (ex.: 📷). */
export function BarraFiltros({ busca, onBusca, placeholder, ativos, aberto, onAlternar, extra }: { busca: string; onBusca(v: string): void; placeholder: string; ativos: number; aberto: boolean; onAlternar(): void; extra?: ReactNode }) {
  const t = useT()
  return (
    <div className="flex items-center gap-2">
      <Entrada type="search" aria-label={t(placeholder)} className="w-auto min-w-0 flex-1" placeholder={t(placeholder)} value={busca} onChange={(e) => onBusca(e.target.value)} />
      {extra}
      <button type="button" aria-expanded={aberto} aria-label={t('Filtros')} onClick={onAlternar}
        className={cx('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', aberto || ativos ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)]')}>
        <span aria-hidden>⚙︎</span>
        <span className="hidden sm:inline">{t('Filtros')}</span>
        {ativos > 0 && <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--marca)] px-1 text-xs text-white">{ativos}</span>}
        <span aria-hidden className={cx('text-xs transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>
    </div>
  )
}

/** Os filtros ligados, um chip cada (✕ tira só aquele) + "Limpar filtros". Nada ligado: não mostra nada. */
export function ChipsFiltros({ itens, onTirar, onLimpar }: { itens: FiltroAtivo[]; onTirar(k: string): void; onLimpar(): void }) {
  const t = useT()
  if (!itens.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {itens.map((a) => (
        <button key={a.k} type="button" onClick={() => onTirar(a.k)} aria-label={`${t('Tirar filtro')} ${a.rotulo}`}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-[var(--marca)] bg-[var(--marca-suave)] pl-3 pr-2 font-semibold text-[var(--marca)] hover:brightness-95">
          <span className="truncate">{a.rotulo}</span><span aria-hidden className="text-xs">✕</span>
        </button>
      ))}
      <button type="button" onClick={onLimpar} className="min-h-9 rounded-lg px-2 font-semibold text-[var(--suave)] hover:text-[var(--marca)]">{t('Limpar filtros')}</button>
    </div>
  )
}

/** O painel: grupos (GrupoFiltro) + rodapé "Limpar · Ver N resultados" (fecha o painel). */
export function PainelFiltros({ children, resultados, onFechar, onLimpar, temAtivos }: { children: ReactNode; resultados?: number; onFechar(): void; onLimpar(): void; temAtivos: boolean }) {
  const t = useT()
  return (
    <section aria-label={t('Filtros')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="space-y-2 p-2 sm:p-3">{children}</div>
      <div className="flex items-center justify-end gap-2 border-t border-[var(--borda)] bg-[var(--fundo)] px-3 py-2">
        <Botao variante="leve" disabled={!temAtivos} onClick={onLimpar}>{t('Limpar filtros')}</Botao>
        <Botao onClick={onFechar}>{resultados === undefined ? t('Pronto') : t(resultados === 1 ? 'Ver 1 resultado' : 'Ver {n} resultados', { n: resultados })}</Botao>
      </div>
    </section>
  )
}

/** Um grupo do painel: bloco com fundo, título com ícone e os campos em grade (2 no celular, 4 no computador). */
export function GrupoFiltro({ titulo, icone, children }: { titulo: string; icone: string; children: ReactNode }) {
  const t = useT()
  return (
    <fieldset className="rounded-xl bg-[var(--fundo)] p-3">
      <legend className="sr-only">{t(titulo)}</legend>
      <p aria-hidden className="mb-2 flex items-center gap-1.5 text-sm font-bold"><span>{icone}</span>{t(titulo)}</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  )
}

/** De–até (datas, números): dois campos lado a lado, ocupando a linha inteira no celular. */
export function CampoFaixa({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const t = useT()
  return (
    <div className="col-span-2 lg:col-span-1">
      <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t(rotulo)}</span>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </div>
  )
}
