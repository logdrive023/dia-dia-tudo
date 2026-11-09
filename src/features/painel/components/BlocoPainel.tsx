// BLOCO DO PAINEL: uma pergunta por bloco — o título em linguagem simples, um resumo curto ao lado e o conteúdo embaixo.
import type { ReactNode } from 'react'
import { Info } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

export function BlocoPainel({ titulo, resumo, ajuda, children }: { titulo: string; resumo?: ReactNode; ajuda?: string; children: ReactNode }) {
  const t = useT()
  return (
    <section className="mb-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="flex items-center text-base font-bold">{t(titulo)}{ajuda && <Info texto={ajuda} />}</h2>
        {resumo && <span className="num text-xs text-[var(--suave)]">{resumo}</span>}
      </div>
      {children}
    </section>
  )
}
