// AVISO "GUARDADO": o mesmo selo verde sempre que o sistema salva sozinho (ex.: a venda do caixa guardada em aberto).
// Diz O QUE foi guardado, QUANDO e o que isso garante ("pode sair, nada se perde"). Fica à vista, sem cobrir nada.
import { cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

export function AvisoGuardado({ titulo, quando, texto, className }: { titulo: string; quando?: string; texto?: string; className?: string }) {
  const t = useT()
  return (
    <p role="status" className={cx('flex items-center gap-3 rounded-2xl border border-[var(--bom)]/40 bg-[var(--bom)]/10 px-3 py-2 text-sm', className)}>
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bom)] text-base font-bold text-white">✓</span>
      <span className="min-w-0">
        <b className="block text-[var(--bom)]">{t(titulo)}{quando && <span className="num font-semibold"> · {quando}</span>}</b>
        {texto && <span className="block text-xs text-[var(--suave)]">{t(texto)}</span>}
      </span>
    </p>
  )
}
