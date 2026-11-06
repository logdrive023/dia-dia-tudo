// SEÇÃO DO PAINEL que abre e fecha (lembrada no aparelho).
import type { ReactNode } from 'react'
import { cx } from '../../ui/base'
import { useLembrado } from '../../ui/filtros'
import { useT } from '../../ui/i18n'

export interface SecaoProps {
  id: string
  titulo: string
  /** uma linha do que ela responde (só aberta) */
  subtitulo?: string
  /** o que aparece ao lado do título com ela fechada */
  resumo?: ReactNode
  /** à direita do título (ex.: "Abrir →") */
  acao?: ReactNode
  /** secundária: começa fechada (abrir fica lembrado) */
  fechadaPadrao?: boolean
  children: ReactNode
}

export function Secao({ id, titulo, subtitulo, resumo, children, acao, fechadaPadrao }: SecaoProps) {
  const t = useT()
  const [fechadas, setFechadas] = useLembrado<string[]>('painel.fechadas', [])
  const [abertas, setAbertas] = useLembrado<string[]>('painel.abertas', [])
  const aberta = fechadaPadrao ? abertas.includes(id) : !fechadas.includes(id)
  const alternar = () => (fechadaPadrao
    ? setAbertas(aberta ? abertas.filter((x) => x !== id) : [...abertas, id])
    : setFechadas(aberta ? [...fechadas, id] : fechadas.filter((x) => x !== id)))
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={alternar} aria-expanded={aberta} className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg pr-2 text-left">
          <span className={cx('inline-block text-[var(--suave)] transition-transform', aberta ? 'rotate-90' : '')} aria-hidden>›</span>
          <span className="min-w-min">
            <h2 className="text-base font-bold">{t(titulo)}</h2>
            {aberta && subtitulo && <span className="block text-xs text-[var(--suave)]">{t(subtitulo)}</span>}
          </span>
        </button>
        {!aberta && resumo && <span className="num truncate text-sm text-[var(--suave)]">{resumo}</span>}
        <span className="ml-auto">{acao}</span>
      </div>
      {aberta && children}
    </section>
  )
}
