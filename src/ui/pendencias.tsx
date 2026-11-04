// Selo do que falta num registro: "✓ Completa" ou a lista do que falta (com o valor, quando é dinheiro).

import { formatar } from '../core/domain/dinheiro'
import type { Pendencia } from '../core/services/pendencias'
import { cx, Pilula } from './base'
import { useT } from './i18n'

const CURTO: Record<string, string> = { semFotos: 'Fotos', semComprovanteOrigem: 'Origem', semComprovante: 'Comprovante', paradaTriagem: 'Parada', faltaPagar: 'A pagar', faltaReceber: 'A receber' }

export function SeloPendencias({ pendencias, moeda, compacto }: { pendencias: Pendencia[]; moeda: string; compacto?: boolean }) {
  const t = useT()
  if (!pendencias.length)
    return <Pilula tom="bom">✓ {t('Completa')}</Pilula>
  return (
    <span className="inline-flex flex-wrap gap-1" title={pendencias.map((p) => t(p.texto)).join(' · ')}>
      {pendencias.map((p) => (
        <Pilula key={p.id} tom={p.nivel === 'urgente' ? 'ruim' : 'alerta'}>
          {p.nivel === 'urgente' ? '●' : '○'} {t(compacto ? CURTO[p.id] ?? p.texto : p.texto)}
          {!compacto && p.valor !== undefined && <span className="num">{formatar(p.valor, moeda)}</span>}
        </Pilula>
      ))}
    </span>
  )
}

/** Filtro rápido por situação: Todas · Com pendência · cada tipo. */
export function FiltroPendencia({ valor, onChange, opcoes, contagem }: { valor: string; onChange(v: string): void; opcoes: { id: string; nome: string }[]; contagem?: Record<string, number> }) {
  const t = useT()
  return (
    <div className="sem-barra flex gap-1.5 overflow-x-auto pb-1">
      {[{ id: '', nome: 'Todas' }, { id: 'qualquer', nome: 'Com pendência' }, ...opcoes].map((o) => (
        <button key={o.id} type="button" aria-pressed={valor === o.id} onClick={() => onChange(o.id)} className={cx('min-h-10 shrink-0 rounded-full border px-3 text-sm', valor === o.id ? 'border-[var(--marca)] bg-[var(--marca)] font-semibold text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
          {t(o.nome)}
          {contagem?.[o.id] !== undefined && <span className="num ml-1 opacity-80">{contagem[o.id]}</span>}
        </button>
      ))}
    </div>
  )
}
