// MAIS DETALHES DO PAINEL: o que é análise fica guardado aqui, um toque só. A tela abre leve para quem está começando;
// quem usa sempre deixa aberto (fica lembrado no aparelho).
import { type ReactNode } from 'react'
import { useLembrado } from '../../../shared/ui/filtros'
import { useT } from '../../../shared/ui/i18n'

export function MaisDetalhes({ children }: { children: ReactNode }) {
  const t = useT()
  const [aberto, setAberto] = useLembrado('painel.maisDetalhes', false)
  return (
    <div>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="mb-4 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-4 py-2 text-left shadow-sm transition hover:border-[var(--marca)]">
        <span aria-hidden className="text-lg">📊</span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm">{t(aberto ? 'Esconder os detalhes' : 'Ver mais detalhes')}</b>
          <span className="block text-xs text-[var(--suave)]">{t('Dinheiro, evolução, de onde vem, viagens e áreas')}</span>
        </span>
        <span aria-hidden className={aberto ? 'rotate-180 text-[var(--suave)] transition-transform' : 'text-[var(--suave)] transition-transform'}>▾</span>
      </button>
      {aberto && children}
    </div>
  )
}
