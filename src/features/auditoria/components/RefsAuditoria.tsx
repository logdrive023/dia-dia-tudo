// AUDITORIA › as REFERÊNCIAS de uma ação (compra, venda, pacote, pessoa, viagem…): cada uma abre a tela dela.
import type { RefAuditoria } from '../../../core/services/auditoria'
import { ICONE_REF } from '../model/auditoria'

export function RefsAuditoria({ refs, onAbrir }: { refs: RefAuditoria[]; onAbrir(r: RefAuditoria): void }) {
  if (!refs.length) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {refs.map((r) => (
        <button key={r.id} type="button" onClick={(e) => (e.stopPropagation(), onAbrir(r))}
          className="alvo-amplo inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg bg-[var(--marca-suave)] px-2 text-xs font-semibold text-[var(--marca)] transition active:scale-[0.97] hover:ring-1 hover:ring-[var(--marca)]">
          <span aria-hidden>{ICONE_REF[r.tipo] ?? '🔗'}</span><span className="num truncate">{r.rotulo}</span>
        </button>
      ))}
    </span>
  )
}
