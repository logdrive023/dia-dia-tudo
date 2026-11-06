// PASSO A PASSO vertical (padrão do Separar, da Nova compra e da Nova viagem): todos os passos à vista; o aberto mostra
// os campos e o "para que serve" (explicação + exemplo) fica no ⓘ ao lado do título; os fechados ficam numa linha com o resumo.
// Número vira ✓ quando o passo está feito. Tocar no título abre/fecha; "Próximo →" fecha este e abre o seguinte.

import { type ReactNode, useEffect, useRef, useState } from 'react'
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
            <span className="block font-bold leading-snug">{t(titulo)}{opcional && !feito && <span className="ml-1 whitespace-nowrap text-xs font-normal text-[var(--suave)]">({t('opcional')})</span>}</span>
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

/**
 * O ESTADO DO ASSISTENTE (wizard), igual em todo cadastro: qual passo está aberto, abrir/fechar um e "Próximo →".
 * Ex.: const w = useAssistente() → <Passo aberto={w.aberto(1)} onAlternar={() => w.alternar(1)}> … {w.proximo(1, 'Quem vai')}
 */
export function useAssistente(primeiro = 1) {
  const t = useT()
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set([primeiro]))
  const alternar = (n: number) => setAbertos((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x })
  const ir = (n: number) => setAbertos(new Set([n]))
  /** "Próximo: Quem vai →" (fecha este, abre o seguinte); `pode` falso = ainda falta algo aqui */
  const proximo = (n: number, rotulo: string, pode = true) => (
    <div className="flex justify-end">
      <button type="button" disabled={!pode} onClick={() => ir(n + 1)} className="min-h-11 rounded-xl bg-[var(--marca-suave)] px-4 text-sm font-semibold text-[var(--marca)] hover:brightness-95 disabled:opacity-50">{t('Próximo')}: {t(rotulo)} →</button>
    </div>
  )
  return { aberto: (n: number) => abertos.has(n), alternar, ir, proximo }
}

/** a lista dos passos (o mesmo espaçamento e largura em todo cadastro) */
export function Passos({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const t = useT()
  return <ol className="mx-auto max-w-2xl space-y-3" aria-label={t(rotulo)}>{children}</ol>
}
