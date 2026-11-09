// COMO ESTÁ INDO: o faturamento do período em destaque, a comparação com o período anterior e, embaixo, lucro, vendas e
// compras. Cada número abre a tela de onde ele vem. No celular fica só o essencial; a linha da tendência e o detalhe
// de margem e ticket aparecem do sm para cima.
import type { ReactNode } from 'react'
import type { Cartao as CartaoDados } from '../../../core/modulos'
import type { ResultadoConsulta } from '../../../core/services'
import { Info, cx, fmt } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { variacaoPct } from '../model/calculos'

type DadosPainel = NonNullable<ResultadoConsulta<'painel'>>

/** "↑ 12%" / "↓ 8%" (comparado ao período anterior); sem base anterior, nada */
function variacao(atual: number, anterior?: number) {
  const v = variacaoPct(atual, anterior)
  if (v === undefined) return undefined
  return { sobe: v >= 0, texto: `${v >= 0 ? '↑' : '↓'} ${Math.abs(v) > 500 ? '>500' : Math.abs(v)}%` }
}

/** a tendência do período numa linha fina (sem eixo: o gráfico completo fica em "Evolução no período") */
function Tendencia({ serie, anterior }: { serie: { faturamento: number }[]; anterior?: number[] }) {
  if (serie.length < 2) return null
  const L = 240
  const A = 48
  const max = Math.max(1, ...serie.map((s) => s.faturamento), ...(anterior ?? []))
  const pts = (vs: number[]) => vs.map((v, i) => `${((i / (vs.length - 1)) * L).toFixed(1)},${(A - 4 - (Math.max(0, v) / max) * (A - 8)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      {anterior && anterior.length > 1 && <polyline points={pts(anterior)} fill="none" stroke="var(--borda)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      <polyline points={pts(serie.map((s) => s.faturamento))} fill="none" stroke="var(--marca)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** um número secundário da fileira do período (rótulo · valor · detalhe), clicável */
function Metrica({ c, detalhe, neutro }: { c?: CartaoDados; detalhe?: ReactNode; neutro?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  if (!c) return null
  const v = variacao(c.valor, c.anterior)
  return (
    <button type="button" onClick={c.detalhe ? () => ir(c.detalhe!.tela, c.detalhe!.filtro) : undefined} className="min-w-0 rounded-xl px-2 py-1.5 text-left transition hover:bg-[var(--fundo)]">
      <span className="block truncate text-xs text-[var(--suave)]">{t(c.nome)}</span>
      <span className={cx('num block truncate text-lg font-bold', c.destaque === 'ruim' && 'text-[var(--ruim)]')}>{fmt(c.valor, c.formato, c.moeda)}</span>
      <span className="num block truncate text-[11px] text-[var(--suave)]">
        {v && <span className={cx('mr-1 font-semibold', !neutro && (v.sobe ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'))}>{v.texto}</span>}
        <span className="hidden sm:inline">{detalhe}</span>
      </span>
    </button>
  )
}

export function ResumoPeriodo({ p, comparar }: { p: DadosPainel; comparar: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const c = (id: string) => p.cartoes.find((x) => x.id === id)
  const fat = c('faturamento')
  const v = fat && variacao(fat.valor, fat.anterior)
  const abrirFat = () => fat?.detalhe && ir(fat.detalhe.tela, fat.detalhe.filtro)
  return (
    <section aria-label={t('Resumo do período')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm sm:p-5">
          {fat && (
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              {/* div com papel de botão (o mesmo padrão do NumeroGrande): o ⓘ também é botão, e botão dentro de botão não vale */}
              <div role="button" tabIndex={0} onClick={abrirFat} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), abrirFat())} className="min-w-0 cursor-pointer text-left">
                <span className="flex items-center text-sm text-[var(--suave)]">{t('Faturamento')}<Info texto={fat.ajuda ?? ''} /></span>
                <span className="num block text-3xl font-black leading-tight sm:text-4xl">{fmt(fat.valor, fat.formato, fat.moeda)}</span>
                {comparar && <span className={cx('num text-sm font-semibold', !v ? 'text-[var(--suave)]' : v.sobe ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{v ? `${v.texto} ${t('vs. período anterior')}` : t('sem base anterior')}</span>}
              </div>
              <div className="hidden min-w-[8rem] flex-1 sm:block"><Tendencia serie={p.serie} anterior={comparar ? p.serieAnterior : undefined} /></div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--borda)] border-t border-[var(--borda)] pt-2">
            <Metrica c={c('lucro')} detalhe={c('margem') && `${t('margem')} ${fmt(c('margem')!.valor, 'percentual')}`} />
            <Metrica c={c('vendas')} detalhe={c('ticket') && `${t('ticket')} ${fmt(c('ticket')!.valor, 'dinheiro', c('ticket')!.moeda)}`} />
            <Metrica c={c('compras')} neutro detalhe={p.comprasAbertas.n ? `+ ${t('{n} em aberto', { n: p.comprasAbertas.n })}` : undefined} />
          </div>
    </section>
  )
}
