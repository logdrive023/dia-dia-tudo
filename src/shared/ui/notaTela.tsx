// NOTA DA TELA (padrão do sistema): a orientação curta logo abaixo de uma lista ou de um bloco — como usar a tela ou o
// que aquele número quer dizer. Sempre à vista e curta: explicação longa vai no ⓘ (Info); aviso de problema, em Aviso/Pilula.
import type { ReactNode } from 'react'
import { cx } from './base'

export function NotaTela({ children, icone = '💡', className }: { children: ReactNode; icone?: string; className?: string }) {
  return (
    <p role="note" className={cx('flex items-start gap-2 rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-xs leading-relaxed text-[var(--texto)]', className)}>
      <span aria-hidden className="shrink-0">{icone}</span>
      <span className="min-w-0">{children}</span>
    </p>
  )
}
