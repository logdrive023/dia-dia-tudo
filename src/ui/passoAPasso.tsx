// PASSO A PASSO vertical (padrão do Separar, da Nova compra e da Nova viagem): todos os passos à vista; o aberto mostra
// os campos e o "para que serve" (explicação + exemplo) fica no ⓘ ao lado do título; os fechados ficam numa linha com o resumo.
// Número vira ✓ quando o passo está feito. Tocar no título abre/fecha; "Próximo →" fecha este e abre o seguinte.

import type { ReactNode } from 'react'
import { Info, cx } from './base'
import { useT } from './i18n'

export function Passo({ n, de, titulo, resumo, ajuda, exemplo, aberto, feito, opcional, falta, onAlternar, children }: {
  n: number
  /** total de passos ("passo 2 de 3") */
  de: number
  titulo: string
  resumo: ReactNode
  ajuda: string
  exemplo?: string
  aberto: boolean
  feito?: boolean
  opcional?: boolean
  /** tentou registrar e falta algo aqui: borda vermelha */
  falta?: boolean
  onAlternar(): void
  children: ReactNode
}) {
  const t = useT()
  return (
    <li className={cx('overflow-hidden rounded-2xl border shadow-sm', falta ? 'border-[var(--ruim)]' : aberto ? 'border-[var(--marca)] bg-[var(--fundo)]' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
      <div className="flex min-h-14 items-center gap-1 pr-3">
        <button type="button" aria-expanded={aberto} onClick={onAlternar} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 pl-3 text-left">
          <span aria-hidden className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black', feito ? 'bg-[var(--bom)] text-white' : aberto ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{feito ? '✓' : n}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{t(titulo)}{opcional && <span className="ml-1 text-xs font-normal text-[var(--suave)]">({t('opcional')})</span>}</span>
            {!aberto && <span className="num block truncate text-xs text-[var(--suave)]">{resumo}</span>}
          </span>
        </button>
        {/* a explicação com exemplo: no ⓘ (fora do botão do título: botão dentro de botão não vale) */}
        {aberto && <Info texto={ajuda} exemplo={exemplo} />}
        <button type="button" tabIndex={-1} aria-hidden onClick={onAlternar} className="flex min-h-14 shrink-0 items-center gap-2 pl-2">
          <span className="num text-xs text-[var(--suave)]">{t('passo {n} de {t}', { n, t: de })}</span>
          <span className={cx('text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
        </button>
      </div>
      {aberto && (
        <div className="space-y-3 border-t border-[var(--borda)] px-3 pb-3 pt-3">
          {children}
        </div>
      )}
    </li>
  )
}
