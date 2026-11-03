// NÚMERO GRANDE (big number) padrão: faixa colorida à esquerda, ícone num quadrado da cor, rótulo, número grande e
// um detalhe embaixo. Tocar filtra/abre; o que está ligado fica com borda e anel. Usado em Compras, Triagem e Estoque.

import type { ReactNode } from 'react'
import { cx } from './base'
import { useT } from './i18n'

export interface Selo { texto: string; tom?: 'ruim' | 'bom' | 'alerta' | 'marca' }
const COR_SELO: Record<string, string> = {
  ruim: 'bg-[var(--ruim)]/15 text-[var(--ruim)]',
  bom: 'bg-[var(--bom)]/15 text-[var(--bom)]',
  alerta: 'bg-[var(--alerta)]/15 text-[var(--alerta)]',
  marca: 'bg-[var(--marca-suave)] text-[var(--marca)]',
  neutro: 'bg-[var(--fundo)] text-[var(--suave)]',
}

/** `selos`: os detalhes embaixo como selos coloridos ("21 lotes", "⏰ 1 parado") — mais legível que um texto cinza */
export function NumeroGrande({ rotulo, valor, sub, selos, icone, cor, ativo, onClick, colorirValor, role }: { rotulo: string; valor: ReactNode; sub?: ReactNode; selos?: Selo[]; icone: string; cor: string; ativo?: boolean; onClick?(): void; colorirValor?: boolean; role?: 'tab' }) {
  const t = useT()
  return (
    <button type="button" role={role} onClick={onClick} aria-pressed={role ? undefined : ativo} aria-selected={role ? !!ativo : undefined}
      className={cx('relative min-w-0 overflow-hidden rounded-2xl border bg-[var(--cartao)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-4', ativo ? 'border-[var(--marca)] ring-2 ring-[var(--marca-suave)]' : 'border-[var(--borda)]')}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--suave)]">
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)` }}>{icone}</span>
        {/* rótulo em até 2 linhas (3 cartões lado a lado no celular: "Sem etiqueta" inteiro, sem "Sem eti…") */}
        <span className="line-clamp-2 min-w-0 leading-tight">{t(rotulo)}</span>
      </span>
      <span className="num mt-1.5 block truncate text-xl font-bold sm:text-2xl" style={colorirValor ? { color: cor } : undefined}>{valor}</span>
      {sub && <span className="num block truncate text-xs text-[var(--suave)]">{sub}</span>}
      {selos && selos.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {selos.map((s, k) => <span key={k} className={cx('num inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold', COR_SELO[s.tom ?? 'neutro'])}>{s.texto}</span>)}
        </span>
      )}
    </button>
  )
}
