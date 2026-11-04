// PASSO A PASSO vertical (padrão do Separar, da Nova compra e da Nova viagem): todos os passos à vista; o aberto mostra
// os campos e o "para que serve" (explicação + exemplo) fica no ⓘ ao lado do título; os fechados ficam numa linha com o resumo.
// Número vira ✓ quando o passo está feito. Tocar no título abre/fecha; "Próximo →" fecha este e abre o seguinte.

import { type ReactNode, useEffect, useRef } from 'react'
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
  // ABRIU (tocou no título ou "Próximo →"): a tela rola até o começo deste passo, para mostrar o que abriu (na primeira
  // vez não rola: a tela começa no topo)
  const raiz = useRef<HTMLLIElement>(null)
  const antes = useRef(aberto)
  useEffect(() => {
    if (aberto && !antes.current) requestAnimationFrame(() => raiz.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }))
    antes.current = aberto
  }, [aberto])
  return (
    <li ref={raiz} className={cx('scroll-mt-4 overflow-hidden rounded-2xl border shadow-sm', falta ? 'border-[var(--ruim)]' : aberto ? 'border-[var(--marca)] bg-[var(--fundo)]' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
      <div className="flex min-h-14 items-center gap-1 pr-2 sm:pr-3">
        <button type="button" aria-expanded={aberto} onClick={onAlternar} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 pl-2 text-left xs:gap-3 xs:pl-3">
          <span aria-hidden className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black', feito ? 'bg-[var(--bom)] text-white' : aberto ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{feito ? '✓' : n}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold leading-snug">{t(titulo)}{opcional && <span className="ml-1 whitespace-nowrap text-xs font-normal text-[var(--suave)]">({t('opcional')})</span>}</span>
            {!aberto && <span className="num block truncate text-xs text-[var(--suave)]">{resumo}</span>}
          </span>
        </button>
        {/* a explicação com exemplo: no ⓘ (fora do botão do título: botão dentro de botão não vale) */}
        {aberto && <Info texto={ajuda} exemplo={exemplo} />}
        <button type="button" tabIndex={-1} aria-hidden onClick={onAlternar} className="flex min-h-14 shrink-0 items-center gap-2 pl-1 sm:pl-2">
          <span className="num hidden whitespace-nowrap text-xs text-[var(--suave)] sm:inline">{t('passo {n} de {t}', { n, t: de })}</span>
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
