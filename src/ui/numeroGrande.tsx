// NÚMEROS (padrão do sistema todo), em dois tamanhos:
//  · NumeroGrande: o cartão de resumo — faixa colorida à esquerda, ícone num quadrado da cor (opcional), rótulo,
//    número grande, detalhe e selos embaixo. Tocar filtra/abre; o que está ligado fica com borda e anel.
//  · NumeroPequeno: o bloco cinza de dentro de um cartão ("Gastos Bs 550 · Comprou 2,9 kg").

import type { ReactNode } from 'react'
import { Info, Pilula, type Tom, cx } from './base'
import { useT } from './i18n'

export interface Selo { texto: string; tom?: Exclude<Tom, 'neutro'> }

/** cor do tom (faixa, ícone e número) */
const COR: Record<'bom' | 'ruim' | 'alerta' | 'marca', string> = { bom: 'var(--bom)', ruim: 'var(--ruim)', alerta: 'var(--alerta)', marca: 'var(--marca)' }

/**
 * `selos`: os detalhes embaixo como selos coloridos ("21 lotes", "⏰ 1 parado") — mais legível que um texto cinza.
 * `tom`: atalho para cor + número colorido (bom/ruim/alerta). `ajuda`: o ⓘ ao lado do rótulo (só quando não é clicável:
 * botão dentro de botão não pode).
 */
export function NumeroGrande({ rotulo, valor, sub, selos, icone, cor, tom, ativo, onClick, colorirValor, role, ajuda, carregando }: {
  rotulo: string; valor: ReactNode; sub?: ReactNode; selos?: Selo[]; icone?: string; cor?: string; tom?: 'bom' | 'ruim' | 'alerta' | 'marca'
  ativo?: boolean; onClick?(): void; colorirValor?: boolean; role?: 'tab'; ajuda?: string
  /** os dados ainda não chegaram: mostra o cartão com o número em espera (nada de "0" falso) */
  carregando?: boolean
}) {
  const t = useT()
  const c = cor ?? (tom ? COR[tom] : 'var(--borda)')
  const pintar = colorirValor || (!!tom && tom !== 'marca')
  const clicavel = !!onClick || !!role
  const dentro = (
    <>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: c }} />
      <span className="flex items-center gap-2 text-xs font-semibold text-[var(--suave)]">
        {icone && <span aria-hidden className="icone-num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: `color-mix(in srgb, ${c} 15%, transparent)` }}>{icone}</span>}
        {/* rótulo em até 2 linhas (3 cartões lado a lado no celular: "Sem etiqueta" inteiro, sem "Sem eti…") */}
        <span className="line-clamp-2 min-w-0 leading-tight">{t(rotulo)}</span>
        {ajuda && <Info texto={ajuda} />}
      </span>
      {carregando
        ? <span aria-label={t('Carregando…')} className="mt-2 block h-7 w-24 animate-pulse rounded-lg bg-[var(--fundo)]" />
        : <span className="num mt-1.5 block truncate text-xl font-bold sm:text-2xl" style={pintar ? { color: c } : undefined}>{valor}</span>}
      {!carregando && sub && <span className="num block truncate text-xs text-[var(--suave)]">{sub}</span>}
      {!carregando && selos && selos.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {selos.map((s, k) => <Pilula key={k} pequena tom={s.tom ?? 'suave'}>{s.texto}</Pilula>)}
        </span>
      )}
    </>
  )
  const base = cx('relative min-w-0 overflow-hidden rounded-2xl border bg-[var(--cartao)] p-3 text-left shadow-sm sm:p-4', ativo ? 'border-[var(--marca)] ring-2 ring-[var(--marca-suave)]' : 'border-[var(--borda)]')
  // com ⓘ e clicável: div com papel de botão (o ⓘ também é botão, e botão dentro de botão não vale)
  if (clicavel && ajuda)
    return (
      <div role={role ?? 'button'} tabIndex={0} aria-pressed={role ? undefined : ativo} aria-selected={role ? !!ativo : undefined} onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onClick?.())}
        className={cx(base, 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md')}>{dentro}</div>
    )
  return clicavel ? (
    <button type="button" role={role} onClick={onClick} aria-pressed={role ? undefined : ativo} aria-selected={role ? !!ativo : undefined} className={cx(base, 'transition hover:-translate-y-0.5 hover:shadow-md')}>{dentro}</button>
  ) : (
    <div className={base}>{dentro}</div>
  )
}

/** bloco de número de dentro de um cartão (fundo cinza): rótulo pequeno, valor em negrito e um detalhe opcional */
export function NumeroPequeno({ rotulo, valor, sub, cor, className }: { rotulo: string; valor: ReactNode; sub?: ReactNode; cor?: string; className?: string }) {
  const t = useT()
  return (
    <span className={cx('num block min-w-0 rounded-xl bg-[var(--fundo)] px-2.5 py-2', className)}>
      <span className="block truncate text-[11px] text-[var(--suave)]">{t(rotulo)}</span>
      <b className="block truncate text-sm" style={cor ? { color: cor } : undefined}>{valor}</b>
      {sub && <span className="block truncate text-[11px] text-[var(--suave)]">{sub}</span>}
    </span>
  )
}

const COLUNAS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

/**
 * A FILEIRA DE NÚMEROS GRANDES do topo de cada tela (o mesmo espaçamento e alinhamento em todo módulo): 2 por linha no
 * celular (ou 3 com `celular={3}`, aí sem o ícone para o nome caber), todos numa linha no computador. `abas`: os cartões trocam a lista (role tablist).
 */
export function GrupoNumeros({ children, colunas, celular = 2, abas, rotulo, className }: { children: ReactNode; colunas: 2 | 3 | 4 | 5; celular?: 2 | 3; abas?: boolean; rotulo?: string; className?: string }) {
  const t = useT()
  return (
    <div role={abas ? 'tablist' : undefined} aria-label={rotulo ? t(rotulo) : undefined}
      className={cx('mb-4 grid gap-2 sm:gap-3', celular === 3 ? 'grid-cols-3 max-sm:[&_.icone-num]:hidden' : 'grid-cols-2', COLUNAS[colunas], className)}>
      {children}
    </div>
  )
}
