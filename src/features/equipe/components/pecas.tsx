// PEÇAS DA EQUIPE (organograma, comissões, entradas × saídas): o avatar com a cor da pessoa e a LINHA DA CONTA
// (rótulo · barra do quanto pesa · valor), a mesma em toda conta de "entra − sai = sobra".
import type { ReactNode } from 'react'
import { cx } from '../../../shared/ui/base'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'

export const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** avatar redondo com as iniciais na cor do nome (a mesma em toda a Equipe) */
export function Avatar({ nome, tamanho = 'h-11 w-11' }: { nome: string; tamanho?: string }) {
  const cor = corDoNome(nome)
  return (
    <span aria-hidden className={cx('flex shrink-0 items-center justify-center rounded-full text-sm font-bold', tamanho)}
      style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>
      {iniciais(nome)}
    </span>
  )
}

/**
 * uma linha da conta: "− Salários (2 · Bs 6.000/mês)   −Bs 1.200" com uma barra fina do quanto ela pesa sobre a base.
 * `tom`: entra (verde), sai (vermelho) ou resultado (negrito, com traço em cima).
 */
export function LinhaConta({ rotulo, detalhe, valor, parte, tom, onClick }: {
  rotulo: ReactNode
  detalhe?: ReactNode
  valor: string
  /** 0 a 1: quanto desta linha sobre a base (barra) */
  parte?: number
  tom: 'entra' | 'sai' | 'resultado' | 'ruim'
  onClick?(): void
}) {
  const cor = tom === 'entra' ? 'var(--bom)' : tom === 'sai' || tom === 'ruim' ? 'var(--ruim)' : 'var(--texto)'
  const dentro = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className={cx('min-w-0', tom === 'resultado' ? 'text-base font-bold' : 'text-sm', tom === 'entra' && 'font-semibold')}>
          {rotulo}{onClick && <span aria-hidden className="ml-1 text-[var(--suave)]">›</span>}
          {detalhe && <span className="num block text-xs font-normal text-[var(--suave)]">{detalhe}</span>}
        </span>
        <b className={cx('num shrink-0 whitespace-nowrap', tom === 'resultado' && 'text-lg')} style={{ color: cor }}>{valor}</b>
      </span>
      {parte !== undefined && parte > 0 && (
        <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--fundo)]">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, parte * 100))}%`, background: cor, opacity: tom === 'entra' ? 0.9 : 0.6 }} />
        </span>
      )}
    </>
  )
  const caixa = cx('block w-full px-1 py-1.5', tom === 'resultado' && 'mt-1 border-t-2 border-[var(--texto)]/70 pt-2')
  return onClick
    ? <button type="button" onClick={onClick} className={cx(caixa, 'rounded-lg text-left hover:bg-[var(--fundo)]')}>{dentro}</button>
    : <div className={caixa}>{dentro}</div>
}
