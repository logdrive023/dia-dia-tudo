// CAIXA › FITA DOS DIAS: os últimos dias com a situação de cada um (aberto, encerrado, sem movimento); tocar escolhe.
import { useEffect, useRef } from 'react'
import { somarDias } from '../../core/domain/datas'
import { Entrada, cx, dataBR, loc } from '../../ui/base'
import { useT } from '../../ui/i18n'
import { NOME_STATUS } from './caixaDia'

/** Fita de dias (QUA 28 · QUI 29 · … · HOJE 3): ponto nos dias com movimento; 📅 escolhe qualquer data. */
export function FitaDias({ data, hoje, dias, onEscolher }: { data: string; hoje: string; dias: { data: string; status: string }[]; onEscolher(d: string): void }) {
  const t = useT()
  const fita = useRef<HTMLDivElement>(null)
  const status = new Map(dias.map((d) => [d.data, d.status]))
  // 14 dias até hoje; se o dia escolhido é mais antigo, a fita vai até ele (+3)
  const fim = data > hoje ? data : data >= somarDias(hoje, -13) ? hoje : somarDias(data, 3)
  const lista = Array.from({ length: 14 }, (_, i) => somarDias(fim, i - 13))
  useEffect(() => {
    const el = fita.current
    const sel = el?.querySelector<HTMLElement>('[aria-current="date"]')
    if (el && sel) el.scrollLeft = sel.offsetLeft - el.clientWidth + sel.offsetWidth + 8
  }, [data, fim])
  const semana = (d: string) => {
    const [a, m, dd] = d.split('-').map(Number)
    return new Date(a, m - 1, dd, 12).toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '').toUpperCase()
  }
  return (
    <div className="mb-4 flex min-w-0 items-stretch gap-2">
      <div ref={fita} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label={t('Dias')}>
        {lista.map((d) => {
          const escolhido = d === data
          const st = status.get(d)
          return (
            <button
              key={d}
              type="button"
              aria-current={escolhido ? 'date' : undefined}
              aria-label={`${dataBR(d)}${st ? ` · ${t(NOME_STATUS[st] ?? st)}` : ''}`}
              onClick={() => onEscolher(d)}
              className={cx(
                'flex min-h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-xs font-semibold',
                escolhido ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] bg-[var(--cartao)]',
                d === hoje && !escolhido && 'border-[var(--marca)] text-[var(--marca)]',
              )}
            >
              <span className="text-[10px] opacity-80">{d === hoje ? t('HOJE') : semana(d)}</span>
              <span className="num text-base font-black leading-tight">{Number(d.slice(8))}</span>
              <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', st ? (st === 'encerrado' ? 'bg-[var(--suave)]' : escolhido ? 'bg-white' : 'bg-[var(--marca)]') : 'bg-transparent')} />
            </button>
          )
        })}
      </div>
      <label className="relative grid min-h-14 w-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-xl" title={t('Escolher dia')}>
        <span aria-hidden>📅</span>
        <Entrada type="date" aria-label={t('Dia')} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={data} onChange={(e) => e.target.value && onEscolher(e.target.value)} />
      </label>
    </div>
  )
}
