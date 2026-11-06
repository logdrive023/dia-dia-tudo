// MODO CAIXA › VENDAS EM ABERTO: as vendas que começaram e ficaram guardadas (até 3), cada uma com "Retomar".
import { formatar } from '../../../core/domain/dinheiro'
import { Botao } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import type { EstadoModoCaixa } from '../hooks/useModoCaixa'

export function VendasEmAberto({ abertas, onRetomar }: { abertas: EstadoModoCaixa['outrasAbertas']; onRetomar(id: string): void }) {
  const t = useT()
  return (
    <section aria-label={t('Vendas em aberto')} className="mb-3 rounded-2xl border border-[var(--marca)] bg-[var(--marca-suave)]/50 p-3">
      <p className="mb-2 text-sm font-bold">🗂 {t('{n} venda(s) em aberto', { n: abertas.length })} <span className="font-normal text-[var(--suave)]">· {t('começou e saiu: está guardada')}</span></p>
      <ul className="space-y-1.5">
        {abertas.slice(0, 3).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--cartao)] px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate"><b>{a.cliente ?? t('Sem cliente')}</b> · {a.linhas.map((l) => l.codigo ?? '—').join(', ')}</span>
            {a.total !== undefined && a.moedaTotal && <b className="num">{formatar(a.total, a.moedaTotal)}</b>}
            <Botao variante="secundario" onClick={() => onRetomar(a.id)}>{t('Retomar')}</Botao>
          </li>
        ))}
      </ul>
    </section>
  )
}
