// BARRA DE SALVAR: enquanto há alteração não salva, gruda no pé da tela (acima do menu do celular) com o aviso e os
// botões; sem alteração, fica parada no fim do conteúdo. Cada tela continua com a própria lógica de salvar.

import type { ReactNode } from 'react'
import { cx } from './base'
import { useT } from './i18n'

export function BarraSalvar({ sujo, aviso, children }: { sujo: boolean; aviso?: ReactNode; children: ReactNode }) {
  const t = useT()
  return (
    <div
      className={cx(
        'z-20 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-2xl border bg-[var(--cartao)] p-3',
        sujo ? 'sticky bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] border-[var(--marca)] shadow-lg md:bottom-4' : 'border-[var(--borda)]',
      )}
    >
      <span role="status" className={cx('mr-auto min-w-0 text-sm', sujo ? 'font-semibold text-[var(--marca)]' : 'text-[var(--suave)]')}>
        {aviso ?? (sujo ? `● ${t('Alterações não salvas')}` : `✓ ${t('Tudo salvo')}`)}
      </span>
      {children}
    </div>
  )
}
