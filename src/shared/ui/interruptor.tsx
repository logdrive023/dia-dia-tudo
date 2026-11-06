// INTERRUPTOR (liga/desliga): o mesmo desenho em todas as opções do sistema.
//   <Interruptor>  cartão com nome e explicação (ex.: Firmas no fim do relatório)
//   <Chave>        só a chave, para pôr no fim de uma linha (ex.: cada forma de pagamento)
import { useT } from './i18n'
import { cx } from './base'

export function Chave({ ligado, onChange, rotulo, travado }: { ligado: boolean; onChange(v: boolean): void; rotulo: string; travado?: boolean }) {
  const t = useT()
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={t(rotulo)} disabled={travado} onClick={() => onChange(!ligado)}
      className={cx('relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center', travado && 'cursor-not-allowed opacity-60')}>
      <BolinhaChave ligado={ligado} />
    </button>
  )
}

function BolinhaChave({ ligado }: { ligado: boolean }) {
  return (
    <span aria-hidden className={cx('relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors', ligado ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', ligado ? 'left-[22px]' : 'left-0.5')} />
    </span>
  )
}

/** interruptor com nome e explicação */
export function Interruptor({ ligado, onChange, titulo, texto }: { ligado: boolean; onChange(v: boolean): void; titulo: string; texto: string }) {
  const t = useT()
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => onChange(!ligado)} className="flex w-full items-start gap-3 rounded-2xl bg-[var(--fundo)] p-3 text-left">
      <span className="mt-0.5 flex shrink-0"><BolinhaChave ligado={ligado} /></span>
      <span className="min-w-0 flex-1 text-sm"><b className="block">{t(titulo)}</b><span className="text-[var(--suave)]">{t(texto)}</span></span>
    </button>
  )
}
