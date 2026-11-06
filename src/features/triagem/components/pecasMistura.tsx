// PEÇAS das janelas de MISTURA (Juntar e Desfazer mistura): o mesmo desenho nas duas, uma é o contrário da outra.
//   Juntar:   [L-0021 1,2 kg] + [L-0022 3,3 kg]  =  [L-0030 4,5 kg · Bs 4.285/kg · Preto]
//   Desfazer: [L-0030 4,5 kg]  ↩  [☑ L-0021 1,2 kg] [☐ L-0022 3,3 kg]  →  "fica 3,3 kg" ou "deixa de existir"
// Os cartões dos pacotes de origem são os mesmos nas duas (código · peso · compra/fornecedor · custo).
import type { ReactNode } from 'react'
import { SeloCodigo } from '../../../shared/ui/tabelaDados'
import { cx, gramasTexto } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

export interface PacoteMistura { id: string; codigo?: string; g: number; custo?: string; compras: { codigo?: string; fornecedor?: string }[] }

/** O pacote de origem num cartão curto: código · peso / compra · fornecedor · custo. Com `onMarcar`, vira caixa de marcar. */
export function CartaoPacote({ p, marcado, onMarcar, nota }: { p: PacoteMistura; marcado?: boolean; onMarcar?(v: boolean): void; nota?: ReactNode }) {
  const t = useT()
  const fornecedores = [...new Set(p.compras.map((c) => c.fornecedor).filter(Boolean))].join(', ')
  const compras = p.compras.map((c) => c.codigo).filter(Boolean).join(' + ')
  const corpo = (
    <>
      <span className="flex items-center gap-2">
        {onMarcar && <input type="checkbox" className="h-5 w-5 shrink-0" checked={!!marcado} onChange={(e) => onMarcar(e.target.checked)} aria-label={t('Tirar {c} da mistura', { c: p.codigo ?? '' })} />}
        <SeloCodigo codigo={p.codigo} />
        <b className="num ml-auto whitespace-nowrap text-base">{gramasTexto(p.g)}</b>
      </span>
      <span className="mt-0.5 block truncate text-xs text-[var(--suave)]">🛒 {[compras || t('sem compra'), fornecedores, p.custo].filter(Boolean).join(' · ')}</span>
      {nota && <span className="mt-0.5 block text-xs font-semibold">{nota}</span>}
    </>
  )
  const classe = cx('block min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-left transition', marcado ? 'border-[var(--marca)] bg-[var(--marca-suave)] ring-1 ring-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)]')
  return onMarcar ? <label className={cx(classe, 'cursor-pointer hover:border-[var(--marca)]')}>{corpo}</label> : <div className={classe}>{corpo}</div>
}

/** O pacote misturado (resultado): código · peso grande · custo/kg · atributos. `riscado` = deixa de existir. */
export function CartaoResultado({ rotulo, codigo, g, linhas = [], riscado, tom = 'bom' }: { rotulo: string; codigo?: string; g: number; linhas?: (string | undefined)[]; riscado?: boolean; tom?: 'bom' | 'marca' }) {
  const t = useT()
  const cor = riscado ? 'var(--suave)' : tom === 'bom' ? 'var(--bom)' : 'var(--marca)'
  return (
    <div className="num min-w-0 rounded-2xl p-3" style={{ background: riscado ? 'var(--fundo)' : `color-mix(in srgb, ${cor} 10%, transparent)`, boxShadow: `inset 0 0 0 2px ${cor}` }}>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: cor }}>{t(rotulo)}</span>
        <b className="font-mono text-sm">{codigo ?? '…'}</b>
        <b className={cx('ml-auto whitespace-nowrap text-2xl font-black', riscado && 'line-through opacity-60')}>{gramasTexto(g)}</b>
      </span>
      {linhas.filter(Boolean).map((l, k) => <span key={k} className="block truncate text-xs text-[var(--suave)]">{l}</span>)}
    </div>
  )
}

/** O sinal entre os cartões (+ · = · ↩), centralizado e grande: a conta se lê de relance. */
export function Sinal({ children, rotulo }: { children: ReactNode; rotulo?: string }) {
  const t = useT()
  return (
    <span className="flex items-center justify-center gap-2 text-lg font-black leading-none text-[var(--suave)]">
      <span aria-hidden>{children}</span>
      {rotulo && <span className="text-xs font-semibold">{t(rotulo)}</span>}
    </span>
  )
}

/** Os cartões das origens com o "+" entre eles (em pé no celular, lado a lado com espaço). */
export function SomaPacotes({ children }: { children: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
      {children.map((c, k) => (
        <span key={k} className="contents">
          {k > 0 && <Sinal>+</Sinal>}
          {c}
        </span>
      ))}
    </div>
  )
}

/** Seção numerada (passo): número na bolinha + título curto; o conteúdo embaixo. */
export function SecaoMistura({ n, titulo, extra, children }: { n: number; titulo: string; extra?: ReactNode; children: ReactNode }) {
  const t = useT()
  return (
    <section aria-label={t(titulo)} className="space-y-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--marca)] text-xs text-white">{n}</span>
        <span className="linha-texto min-w-0 flex-1">{t(titulo)}</span>
        {extra}
      </h3>
      {children}
    </section>
  )
}
