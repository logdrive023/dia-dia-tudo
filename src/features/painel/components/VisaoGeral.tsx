// VISÃO GERAL DO PAINEL — uma composição só (não cartões soltos) que responde em um olhar às duas perguntas de quem abre
// o sistema: "como foi o período?" e "como está a operação agora?".
//   · à esquerda, O PERÍODO: o faturamento grande, a variação e a tendência (linha fina), e embaixo, numa fileira com
//     divisores, o lucro (margem), as vendas (ticket) e as compras concluídas (+ as em aberto);
//   · à direita, AGORA (não depende do período): o caminho do cabelo em passos (compras em aberto → para separar →
//     pronto para vender → sem etiqueta) e o caixa. Cada linha abre a tela de onde o número vem.
// Computador: as duas colunas lado a lado com um divisor; celular: uma embaixo da outra. Cor só com função (NN/g:
// atributos pré-atentivos com moderação): verde/vermelho na variação, âmbar/vermelho só no que trava.
import type { ReactNode } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Cartao as CartaoDados } from '../../../core/modulos'
import type { ResultadoConsulta } from '../../../core/services'
import { Info, cx, fmt, gramasTexto, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
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
        {detalhe}
      </span>
    </button>
  )
}

export function VisaoGeral({ p, comparar, periodoTexto, comCabelo }: { p: DadosPainel; comparar: boolean; periodoTexto: string; comCabelo: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const c = (id: string) => p.cartoes.find((x) => x.id === id)
  const fat = c('faturamento')
  const v = fat && variacao(fat.valor, fat.anterior)
  const abrirFat = () => fat?.detalhe && ir(fat.detalhe.tela, fat.detalhe.filtro)
  const m = moedaPadrao()
  return (
    <section aria-label={t('Visão geral')} className="mb-6 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className={cx('grid divide-y divide-[var(--borda)]', comCabelo && 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0')}>
        {/* O PERÍODO */}
        <div className="min-w-0 p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t('No período')} · <span className="num font-semibold normal-case tracking-normal">{periodoTexto}</span></p>
          {fat && (
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
              {/* div com papel de botão (o mesmo padrão do NumeroGrande): o ⓘ também é botão, e botão dentro de botão não vale */}
              <div role="button" tabIndex={0} onClick={abrirFat} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), abrirFat())} className="min-w-0 cursor-pointer text-left">
                <span className="flex items-center text-sm text-[var(--suave)]">{t('Faturamento')}<Info texto={fat.ajuda ?? ''} /></span>
                <span className="num block text-3xl font-black leading-tight sm:text-4xl">{fmt(fat.valor, fat.formato, fat.moeda)}</span>
                {comparar && <span className={cx('num text-sm font-semibold', !v ? 'text-[var(--suave)]' : v.sobe ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{v ? `${v.texto} ${t('vs. período anterior')}` : t('sem base anterior')}</span>}
              </div>
              <div className="min-w-[8rem] flex-1"><Tendencia serie={p.serie} anterior={comparar ? p.serieAnterior : undefined} /></div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--borda)] border-t border-[var(--borda)] pt-2">
            <Metrica c={c('lucro')} detalhe={c('margem') && `${t('margem')} ${fmt(c('margem')!.valor, 'percentual')}`} />
            <Metrica c={c('vendas')} detalhe={c('ticket') && `${t('ticket')} ${fmt(c('ticket')!.valor, 'dinheiro', c('ticket')!.moeda)}`} />
            <Metrica c={c('compras')} neutro detalhe={p.comprasAbertas.n ? `+ ${t('{n} em aberto', { n: p.comprasAbertas.n })}` : undefined} />
          </div>
        </div>
        {/* AGORA */}
        {comCabelo && <Agora caixa={c('caixa')} moeda={m} />}
      </div>
    </section>
  )
}

/** AGORA: o caminho do cabelo em passos ligados (o mesmo número de cada tela) + o caixa. Não depende do período. */
function Agora({ caixa, moeda }: { caixa?: CartaoDados; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados: o } = useConsulta('operacao', {})
  type Passo = { id: string; icone: string; nome: string; valor: string; sub?: string; aviso?: { texto: string; tom: 'ruim' | 'alerta' }; ok?: string; abrir(): void }
  const passos: Passo[] = o ? [
    { id: 'compras', icone: '🛒', nome: 'Compras em aberto', valor: String(o.compras.abertas), sub: o.compras.abertas ? `${gramasTexto(o.compras.gramas)} · ${formatar(o.compras.valor, moeda)}` : undefined, aviso: o.compras.urgentes ? { texto: t('{n} urgente(s)', { n: o.compras.urgentes }), tom: 'ruim' } : undefined, ok: t('nada pendente'), abrir: () => ir('comprar') },
    { id: 'separar', icone: '✂️', nome: 'Para separar', valor: o.triagem.separar ? gramasTexto(o.triagem.gramas) : '0', sub: o.triagem.separar ? t('{n} pacote(s)', { n: o.triagem.separar }) : undefined, aviso: o.triagem.parados ? { texto: t('{n} parado(s)', { n: o.triagem.parados }), tom: 'ruim' } : o.triagem.paraDepois ? { texto: t('{n} para depois', { n: o.triagem.paraDepois }), tom: 'alerta' } : undefined, ok: t('tudo separado'), abrir: () => ir('triagem') },
    { id: 'pronto', icone: '📦', nome: 'Pronto para vender', valor: gramasTexto(o.estoque.disponivel), sub: [t('{n} lote(s)', { n: o.estoque.lotes }), o.estoque.prontoValor ? formatar(o.estoque.prontoValor, moeda) : ''].filter(Boolean).join(' · '), abrir: () => ir('estoque', { status: 'separado' }) },
    { id: 'etiqueta', icone: '🏷', nome: 'Sem etiqueta', valor: String(o.etiqueta.sem), aviso: o.etiqueta.velhas ? { texto: t('{n} peso mudou', { n: o.etiqueta.velhas }), tom: 'ruim' } : o.etiqueta.sem ? { texto: t('Falta imprimir'), tom: 'alerta' } : undefined, ok: t('tudo em dia'), abrir: () => ir('etiquetas') },
  ] : []
  return (
    <div className="min-w-0 bg-[var(--fundo)]/40 p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t('Agora')} · <span className="font-semibold normal-case tracking-normal">{t('O caminho do cabelo')}</span></p>
      {!o ? <p className="mt-3 text-sm text-[var(--suave)]">{t('Carregando…')}</p> : (
        <ol className="mt-2">
          {passos.map((x, k) => (
            <li key={x.id} className="relative">
              {/* a linha que liga os passos */}
              {k < passos.length - 1 && <span aria-hidden className="absolute bottom-0 left-[19px] top-10 w-px bg-[var(--borda)]" />}
              <button type="button" onClick={x.abrir} className="flex w-full items-center gap-3 rounded-xl py-1.5 pr-1 text-left transition hover:bg-[var(--cartao)]">
                <span aria-hidden className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--borda)] bg-[var(--cartao)] text-base">{x.icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t(x.nome)}</span>
                  <span className="block truncate text-xs" style={{ color: x.aviso ? (x.aviso.tom === 'ruim' ? 'var(--ruim)' : 'var(--alerta)') : 'var(--suave)' }}>
                    {x.aviso ? `${x.aviso.tom === 'ruim' ? '●' : '○'} ${x.aviso.texto}` : x.sub || (x.ok ? `✓ ${x.ok}` : '')}
                  </span>
                </span>
                <b className="num shrink-0 text-base">{x.valor}</b>
                <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {caixa && (
        <button type="button" onClick={() => ir('caixa')} className="mt-2 flex w-full items-center gap-3 rounded-xl border-t border-[var(--borda)] pt-3 text-left">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bom)]/12 text-base">💵</span>
          <span className="min-w-0 flex-1 text-sm font-semibold">{t('Caixa agora')}<span className="block text-xs font-normal text-[var(--suave)]">{t('Na mão + no banco')}</span></span>
          <b className="num shrink-0 text-base">{fmt(caixa.valor, caixa.formato, caixa.moeda)}</b>
          <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
        </button>
      )}
    </div>
  )
}
