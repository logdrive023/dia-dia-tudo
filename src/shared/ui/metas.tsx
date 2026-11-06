// METAS DO MÊS (cartão): Painel (administrador) e Vender (funcionária, as dela). Cada meta: nome, o que mede e a barra
// de quanto já foi; com valor (Bs 750 de Bs 1.000 · faltam Bs 250 · Bs 13/dia) ou só a % — o administrador decide em
// Configurações › Metas. Some sozinho quando não há meta ou está desligado.
import { formatar } from '../../core/domain/dinheiro'
import { cx } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

const INDICADOR: Record<string, { nome: string; icone: string }> = {
  faturamento: { nome: 'Faturamento', icone: '💰' },
  vendas: { nome: 'Vendas', icone: '🛒' },
  atendimentos: { nome: 'Atendimentos', icone: '✂️' },
}

export function MetasDoMes({ className }: { className?: string }) {
  const t = useT()
  const { ir, sessao } = useApp()
  const { dados } = useConsulta('metas', {})
  if (!dados?.mostrar || !dados.metas.length) return null
  const fmt = (ind: string, v: number) => (ind === 'faturamento' ? formatar(v, dados.moeda) : v.toLocaleString())
  return (
    <section aria-label={t('Metas do mês')} className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">🎯 {t('Metas do mês')}</h2>
        <span className="text-xs text-[var(--suave)]">{t('faltam {n} dia(s)', { n: dados.diasRestantes })}{sessao.perfil === 'admin' && <> · <button type="button" className="font-semibold text-[var(--marca)]" onClick={() => ir('configSecao', { id: 'metas' })}>{t('ajustar')}</button></>}</span>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {dados.metas.map((m) => {
          const pct = Math.min(100, m.pctBp / 100)
          return (
            <li key={m.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate"><b>{m.nome}</b> <span className="text-[var(--suave)]">· {INDICADOR[m.indicador]?.icone} {t(INDICADOR[m.indicador]?.nome ?? m.indicador)}</span></span>
                <b className={cx('num shrink-0', m.batida ? 'text-[var(--bom)]' : 'text-[var(--texto)]')}>{m.batida ? '✓ ' : ''}{(m.pctBp / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}%</b>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--fundo)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={m.nome}>
                <div className={cx('h-full rounded-full transition-all', m.batida ? 'bg-[var(--bom)]' : 'bg-[var(--marca)]')} style={{ width: `${pct}%` }} />
              </div>
              {m.valor !== undefined && m.realizado !== undefined && (
                <p className="num mt-1 text-xs text-[var(--suave)]">
                  {fmt(m.indicador, m.realizado)} {t('de')} {fmt(m.indicador, m.valor)}
                  {!m.batida && m.falta !== undefined && <> · {t('faltam')} {fmt(m.indicador, m.falta)}{m.porDia ? ` (${fmt(m.indicador, m.porDia)}/${t('dia')})` : ''}</>}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
