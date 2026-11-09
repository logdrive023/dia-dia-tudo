// PREÇOS › ⓘ "Como calcula o preço": a explicação desenhada (não um parágrafo).
//   1) a fórmula em peças:  [Gramas] × [Fator] = [Valor]
//   2) uma mini-grade mostrando ONDE está o fator (a linha da medida cruza a coluna do comprador)
//   3) dois exemplos que usam os MESMOS números da mini-grade (16 e 20), com o valor alinhado à direita
//   4) o "–" (sem preço)
// O fator aparece sempre com a mesma cor (na fórmula, na grade e nos exemplos): o olho liga uma coisa à outra.
import type { ReactNode } from 'react'
import { moeda } from '../../../core/domain/dinheiro'
import { Info, cx, moedaPadrao } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

/** os exemplos saem da mini-grade: 60 cm × Helena = 16 · 80 cm × Henrique = 20 */
const GRADE = { compradores: ['Helena', 'Henrique'], linhas: [{ cm: 60, fatores: [16, 17] }, { cm: 80, fatores: [18, 20] }] }
const EXEMPLOS = [
  { cm: 60, comprador: 'Helena', gramas: '500 g', fator: '16', valor: '8.000' },
  { cm: 80, comprador: 'Henrique', gramas: '1.200 g', fator: '20', valor: '24.000' },
]
const DESTAQUE = new Set(['60|Helena', '80|Henrique'])

export function AjudaConta({ moeda: codigo }: { moeda?: string }) {
  return <Info conteudo={<ComoCalcula simbolo={moeda(codigo ?? moedaPadrao()).simbolo} />} />
}

function ComoCalcula({ simbolo }: { simbolo: string }) {
  const t = useT()
  return (
    <span className="block space-y-3">
      {/* 1) a fórmula */}
      <span className="block">
        <Titulinho>{t('Como calcula o preço')}</Titulinho>
        <span className="flex flex-wrap items-center gap-1.5 font-semibold">
          <Peca>{t('Gramas')}</Peca>
          <span aria-hidden className="text-[var(--suave)]">×</span>
          <Peca tom="fator">{t('Fator')}</Peca>
          <span aria-hidden className="text-[var(--suave)]">=</span>
          <Peca tom="valor">{t('Valor')}</Peca>
        </span>
      </span>

      {/* 2) onde está o fator */}
      <span className="block rounded-xl border border-[var(--borda)] p-2.5">
        <span className="num grid grid-cols-[auto_1fr_1fr] items-center gap-x-2 gap-y-1 text-center text-xs" aria-hidden>
          <span />
          {GRADE.compradores.map((c) => <span key={c} className="truncate font-semibold text-[var(--suave)]">{c} →</span>)}
          {GRADE.linhas.map((l) => (
            <span key={l.cm} className="contents">
              <span className="whitespace-nowrap text-left font-semibold text-[var(--suave)]">↓ {l.cm} cm</span>
              {l.fatores.map((f, j) => (
                <span key={j} className={cx('rounded-md py-1', DESTAQUE.has(`${l.cm}|${GRADE.compradores[j]}`) ? 'bg-[var(--marca-suave)] font-bold text-[var(--marca)] ring-1 ring-[var(--marca)]' : 'text-[var(--suave)]')}>{f}</span>
              ))}
            </span>
          ))}
        </span>
        <span className="mt-2 block text-xs leading-relaxed text-[var(--suave)]">{t('O fator é o número onde a linha da medida cruza a coluna do comprador.')}</span>
      </span>

      {/* 3) exemplos com os mesmos números */}
      <span className="block">
        <Titulinho>{t('Exemplos')}</Titulinho>
        <span className="block divide-y divide-[var(--borda)]">
          {EXEMPLOS.map((e) => (
            <span key={e.cm} className="flex items-end justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <span className="block text-xs text-[var(--suave)]">{e.cm} cm · {e.comprador}</span>
                <span className="num font-semibold">{e.gramas} × <span className="rounded bg-[var(--marca-suave)] px-1 text-[var(--marca)]">{e.fator}</span></span>
              </span>
              <b className="num whitespace-nowrap text-base">{simbolo} {e.valor}</b>
            </span>
          ))}
        </span>
      </span>

      {/* 4) sem preço */}
      <span className="flex items-start gap-2 rounded-lg bg-[var(--fundo)] px-2.5 py-2 text-xs leading-relaxed text-[var(--suave)]">
        <b className="text-sm leading-none text-[var(--texto)]">–</b>
        <span><b className="text-[var(--texto)]">{t('Sem preço')}</b>: {t('digite o valor na hora da venda')}</span>
      </span>
    </span>
  )
}

function Titulinho({ children }: { children: ReactNode }) {
  return <b className="mb-1.5 block text-[11px] uppercase tracking-wide text-[var(--marca)]">{children}</b>
}

function Peca({ children, tom }: { children: ReactNode; tom?: 'fator' | 'valor' }) {
  return (
    <span className={cx('rounded-lg px-2 py-1 text-sm', tom === 'fator' ? 'bg-[var(--marca-suave)] text-[var(--marca)]' : tom === 'valor' ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)] text-[var(--texto)]')}>
      {children}
    </span>
  )
}
