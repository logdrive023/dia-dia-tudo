// IMPOSTOS DESTA OPERAÇÃO — o mesmo quadro na compra e na venda (caixa, assistente de venda, atendimento, nova compra)
// e o DETALHE único (DetalheImpostos) que explica DE ONDE VEM cada centavo:
//   IVA · Impuesto al Valor Agregado · alíquota vigente 13% (Ley 843, arts. 1 y 15 · desde 20/05/1986)
//   13% × Bs 4.100,00 = Bs 533,00 · "va incluido en el precio…"
// SÓ INFORMA: nunca muda o preço cobrado. "Somado ao preço" mostra o custo final (60 → 70); "embutido" mostra quanto
// do preço é imposto. Tudo vem da lista de Configurações › Fiscal; desligado lá = nada aparece.
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import type { LinhaImposto } from '../../core/dados/impostos'
import { Janela, cx, dataBR } from './base'
import { useConsulta } from './contexto'
import { useT } from './i18n'

const pct = (bp: number) => `${(bp / 100).toLocaleString('pt-BR')}%`

interface Calculo { linhas: LinhaImposto[]; venda: number; compra: number; base: number; precoFinal: number; modoPreco: 'dentro' | 'fora' }

/** O DETALHE dos impostos às claras (peça única): cada imposto com a alíquota vigente, a fonte, a conta e a soma.
 *  Usado na janela (DetalheImpostos) e no quadro da venda/compra (QuadroImpostosOperacao). */
export function QuadroImpostos({ calculo, moeda, ehCompra }: { calculo: Calculo; moeda: string; ehCompra: boolean }) {
  const t = useT()
  const total = ehCompra ? calculo.compra : calculo.venda
  const f = (v: number) => formatar(v, moeda)
  return (
      <div className="space-y-3">
        <div className="rounded-xl bg-[var(--alerta)]/10 px-3 py-2 text-xs">
          <p className="font-semibold text-[var(--alerta)]">⚠️ {t('Estimativa desta venda — não é exatamente o que você vai pagar.')}</p>
          <p className="mt-0.5 text-[var(--suave)]">{t('O imposto de verdade é calculado no período, com créditos e compensações (na Bolívia: o IVA das compras com fatura abate o das vendas e o IUE pago abate o IT). Só informativo: não muda o valor cobrado.')}</p>
        </div>
        <ul className="space-y-2">
          {calculo.linhas.map((l) => (
            <li key={l.id} className="rounded-2xl border border-[var(--borda)] p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <b>{l.sigla} <span className="font-normal text-[var(--suave)]">· {l.nome}</span></b>
                <b className={cx('num', l.credito ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>{f(l.valor)}{l.credito ? ` (${t('crédito')})` : ''}</b>
              </div>
              {/* a conta: de onde saiu o valor */}
              <p className="num mt-1 rounded-lg bg-[var(--fundo)] px-2 py-1 text-sm">{pct(l.taxaBp)} × {f(l.base)} = <b>{f(l.valor)}</b></p>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-[var(--suave)]">{t('Alíquota vigente')}</dt><dd className="font-semibold">{pct(l.taxaBp)}{l.vigenteDesde ? ` · ${t('desde')} ${dataBR(l.vigenteDesde)}` : ''}</dd>
                {l.fonte && <><dt className="text-[var(--suave)]">{t('Fonte')}</dt><dd>{l.fonte}</dd></>}
                {l.conferidoEm && <><dt className="text-[var(--suave)]">{t('Conferido em')}</dt><dd>{dataBR(l.conferidoEm)}</dd></>}
              </dl>
              {l.explica && <p className="mt-1.5 text-xs text-[var(--suave)]">{l.explica}</p>}
              {(l.porQue || l.naPratica) && (
                <details className="mt-1.5 rounded-lg bg-[var(--fundo)] px-2 py-1 text-xs">
                  <summary className="cursor-pointer font-semibold text-[var(--marca)]">{t('O que é e por que existe')}</summary>
                  {l.porQue && <p className="mt-1"><b>{t('Por que existe')}:</b> {t(l.porQue)}</p>}
                  {l.naPratica && <p className="mt-1"><b>{t('Na prática')}:</b> {t(l.naPratica)}</p>}
                </details>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-1 rounded-2xl bg-[var(--fundo)] p-3 text-sm">
          <div className="flex justify-between"><span>{t(ehCompra ? 'Valor da compra' : 'Preço cobrado')}</span><b className="num">{f(calculo.base)}</b></div>
          <div className="flex justify-between"><span>{t('Impostos (estimado)')}</span><b className="num">{f(total)}</b></div>
          {calculo.modoPreco === 'fora'
            ? <div className="flex justify-between border-t border-[var(--borda)] pt-1 text-base"><span className="font-semibold">{t('Custo final com impostos (informativo)')}</span><b className="num">{f(calculo.precoFinal)}</b></div>
            : <p className="border-t border-[var(--borda)] pt-1 text-xs text-[var(--suave)]">{t('Embutido no preço: dos {p} cobrados, {i} é imposto.', { p: f(calculo.base), i: f(total) })}</p>}
        </div>
      </div>
  )
}

/** a janela com o detalhe (aberta pela linha embaixo do total) */
export function DetalheImpostos({ calculo, moeda, ehCompra, onFechar }: { calculo: Calculo; moeda: string; ehCompra: boolean; onFechar(): void }) {
  const t = useT()
  return (
    <Janela aberta titulo={`🧾 ${t(ehCompra ? 'Impostos desta compra' : 'Impostos desta venda')}`} onFechar={onFechar}>
      <QuadroImpostos calculo={calculo} moeda={moeda} ehCompra={ehCompra} />
    </Janela>
  )
}

/** o QUADRO às claras embaixo de "Nesta venda" (ou dos itens da compra) — aparece se ligado em Configurações › Fiscal */
export function QuadroImpostosOperacao({ produto, servico, compra, moeda, className }: { produto?: number; servico?: number; compra?: number; moeda: string; className?: string }) {
  const t = useT()
  // começa FECHADO (não ocupa o caixa), mas deixa claro que abre: "ver detalhe ▾"
  const [aberto, setAberto] = useState(false)
  const tem = (produto ?? 0) + (servico ?? 0) + (compra ?? 0) > 0
  const { dados } = useConsulta('impostosOperacao', { produto: produto || undefined, servico: servico || undefined, compra: compra || undefined }, tem)
  if (!tem || !dados?.ligado || !dados.quadro) return null
  if (!dados.linhas.length) return dados.aviso ? <p className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-4 py-3 text-sm text-[var(--suave)] shadow-sm', className)}>🧾 {t(dados.aviso)}</p> : null
  const ehCompra = (compra ?? 0) > 0 && !produto && !servico
  const total = ehCompra ? dados.compra : dados.venda
  return (
    <section aria-label={t('Impostos')} className={cx('overflow-hidden rounded-2xl border border-[var(--alerta)]/40 bg-[var(--cartao)] shadow-sm', className)}>
      {/* 2 linhas que cabem em qualquer celular: [🧾] título ········ valor / siglas · estimado ···· ver detalhe ▾ */}
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-14 w-full items-center gap-3 bg-[var(--alerta)]/10 px-3 py-2 text-left">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--alerta)]/15 text-lg">🧾</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <b className="min-w-0 text-sm">{t(ehCompra ? 'Impostos desta compra' : 'Impostos desta venda')}</b>
            <b className="num shrink-0 text-base text-[var(--alerta)]">{formatar(total, moeda)}</b>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-[var(--suave)]">{dados.linhas.map((l) => `${l.sigla} ${pct(l.taxaBp)}`).join(' · ')} · {t('estimado')}</span>
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--marca)]">
              {t(aberto ? 'fechar' : 'ver detalhe')}
              <span aria-hidden className={cx('transition-transform', aberto && 'rotate-180')}>▾</span>
            </span>
          </span>
        </span>
      </button>
      {aberto && <div className="border-t border-[var(--borda)] p-3"><QuadroImpostos calculo={dados} moeda={moeda} ehCompra={ehCompra} /></div>}
    </section>
  )
}

export function ImpostosDaOperacao({ produto, servico, compra, moeda, compacto, className }: {
  /** valores na moeda `moeda` (centavos) */
  produto?: number
  servico?: number
  compra?: number
  moeda: string
  /** uma linha só (barras e rodapés) — um toque abre o detalhe */
  compacto?: boolean
  className?: string
}) {
  const t = useT()
  const [detalhe, setDetalhe] = useState(false)
  const tem = (produto ?? 0) + (servico ?? 0) + (compra ?? 0) > 0
  const { dados } = useConsulta('impostosOperacao', { produto: produto || undefined, servico: servico || undefined, compra: compra || undefined }, tem)
  if (!tem || !dados?.ligado || !dados.linhas.length) return null
  if (compacto && !dados.noTotal) return null
  const ehCompra = (compra ?? 0) > 0 && !produto && !servico
  const credito = dados.linhas.some((l) => l.lado === 'compra' && l.credito)
  const total = ehCompra ? dados.compra : dados.venda
  const fora = dados.modoPreco === 'fora'
  const abrir = <DetalheImpostos calculo={dados} moeda={moeda} ehCompra={ehCompra} onFechar={() => setDetalhe(false)} />
  if (compacto)
    return (
      <>
        <button type="button" onClick={() => setDetalhe(true)} className={cx('num text-left text-xs font-semibold text-[var(--alerta)] underline decoration-dotted underline-offset-2', className)} title={t('Ver de onde vem o valor')}>
          🧾 {fora ? `${t('com impostos')} ${formatar(dados.precoFinal, moeda)}` : `${t(ehCompra && credito ? 'crédito fiscal' : 'impostos')} ${formatar(total, moeda)}`} ›
        </button>
        {detalhe && abrir}
      </>
    )
  return (
    <section aria-label={t('Impostos estimados')} className={cx('rounded-xl border px-3 py-2', ehCompra && credito ? 'border-[var(--bom)]/40 bg-[var(--bom)]/8' : 'border-[var(--alerta)]/40 bg-[var(--alerta)]/10', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <b className="text-sm">🧾 {t(ehCompra ? 'Impostos desta compra (estimado)' : 'Impostos desta venda (estimado)')}</b>
        <b className={cx('num text-base', ehCompra && credito ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>{formatar(total, moeda)}</b>
      </div>
      <ul className="num mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--suave)]">
        {dados.linhas.map((l) => <li key={l.id}>{l.sigla} {pct(l.taxaBp)} × {formatar(l.base, moeda)} = <b className="text-[var(--texto)]">{formatar(l.valor, moeda)}</b>{l.lado === 'compra' && l.credito ? ` (${t('crédito')})` : ''}</li>)}
      </ul>
      {fora && <p className="num mt-1 text-sm font-semibold">{t('Custo final com impostos (informativo)')}: {formatar(dados.precoFinal, moeda)}</p>}
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--suave)]">{t('Estimativa — não é exatamente o que você vai pagar.')}</p>
        <button type="button" onClick={() => setDetalhe(true)} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Ver de onde vem o valor')} ›</button>
      </div>
      {detalhe && abrir}
    </section>
  )
}
