// PRECISA DE VOCÊ — as pendências (urgente/atenção/acompanhar), fechadas numa linha cada (contagem · o quê · o que
// fazer); tocar abre os registros. Até 3 à vista; o resto em "Mais N pendência(s)".
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Alerta } from '../../../core/services/painel'
import { cx } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { somaAlertas } from '../model/calculos'

const NIVEL = {
  urgente: { cor: 'var(--ruim)', nome: 'Urgente' },
  atencao: { cor: 'var(--alerta)', nome: 'Atenção' },
  info: { cor: 'var(--suave)', nome: 'Para acompanhar' },
} as const

const MAX_ALERTAS = 3

export function AtencaoAgora({ alertas, moeda }: { alertas: Alerta[]; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState<string>()
  const [todos, setTodos] = useState(false)
  if (!alertas.length)
    return <p className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-sm text-[var(--bom)]">✓ {t('Nada pendente. Tudo em dia.')}</p>
  const visiveis = todos ? alertas : alertas.slice(0, MAX_ALERTAS)
  return (
    <>
    <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
      {visiveis.map((a) => {
        const abrir = aberto === a.id
        return (
          <li key={a.id} className="relative">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: NIVEL[a.nivel].cor }} aria-hidden />
            <button type="button" onClick={() => setAberto(abrir ? undefined : a.id)} aria-expanded={abrir} className="flex w-full items-center gap-3 py-3 pl-5 pr-4 text-left hover:bg-[var(--fundo)]">
              <span className="num flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold" style={{ background: `color-mix(in srgb, ${NIVEL[a.nivel].cor} 15%, transparent)`, color: NIVEL[a.nivel].cor }}>{a.quantidade}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(a.titulo)}</span>
                {a.acao && <span className="block text-sm text-[var(--suave)]">{t(a.acao)}</span>}
              </span>
              {a.valor !== undefined && <span className="num hidden shrink-0 font-semibold sm:block">{formatar(a.valor, moeda)}</span>}
              <span className={cx('text-[var(--suave)] transition-transform', abrir && 'rotate-90')} aria-hidden>›</span>
            </button>
            {abrir && (
              <div className="pb-3 pl-5 pr-4">
                {a.itens.length > 0 && (
                  <ul className="mb-2 overflow-hidden rounded-xl border border-[var(--borda)]">
                    {a.itens.slice(0, 5).map((i, k) => (
                      <li key={k}>
                        <button type="button" onClick={() => ir(i.detalhe.tela, i.detalhe.filtro)} className="flex w-full items-center gap-3 border-t border-[var(--borda)] px-3 py-2 text-left text-sm first:border-t-0 hover:bg-[var(--marca-suave)]">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{i.texto}</span>
                            {i.sub && <span className="block truncate text-xs text-[var(--suave)]">{i.sub}</span>}
                          </span>
                          {i.valor !== undefined && <span className="num shrink-0">{formatar(i.valor, moeda)}</span>}
                          <span className="shrink-0 text-[var(--marca)]" aria-hidden>→</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {a.detalhe && (
                  <button type="button" onClick={() => ir(a.detalhe!.tela, a.detalhe!.filtro)} className="text-sm font-semibold text-[var(--marca)]">
                    {a.quantidade > 5 ? t('Ver todos ({n}) →', { n: a.quantidade }) : t('Abrir a lista →')}
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
    {alertas.length > MAX_ALERTAS && (
      <button type="button" onClick={() => setTodos(!todos)} aria-expanded={todos} className="mt-1 min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
        {todos ? t('Mostrar menos') : t('Mais {n} pendência(s)', { n: alertas.length - MAX_ALERTAS })}
      </button>
    )}
    </>
  )
}

/** "2 urgentes · 3 atenção" (o resumo da seção fechada) */
export function resumoAlertas(t: ReturnType<typeof useT>, alertas: Alerta[]) {
  const u = somaAlertas(alertas, 'urgente')
  const a = somaAlertas(alertas, 'atencao')
  return [u && t('{n} urgente(s)', { n: u }), a && t('{n} de atenção', { n: a })].filter(Boolean).join(' · ') || t('{n} pendência(s)', { n: somaAlertas(alertas, 'info') })
}
