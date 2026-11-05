// ABA "DIVISÃO DE VALORES" DA VENDA (administrador):
//  1. O DETALHE DO VALOR, em escada: bruto − desconto = cobrado − impostos = líquido − custo − insumos − comissão = lucro,
//     cada degrau com o seu ⓘ; embaixo, "Por item" abre o mesmo detalhe linha a linha.
//  2. DIVIDIR O VALOR: com quem (nome, com sugestão das pessoas cadastradas), por % de uma base (total cobrado,
//     líquido ou lucro) ou por valor fixo; mostra quanto cada parte leva e o que fica com a casa (barra); "Salvar
//     divisão" grava na venda (fica no histórico). Só registro: não mexe no caixa nem na venda.
import { useState } from 'react'
import { calcularDivisao } from '../../core/domain/divisao'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { Id, ParteDivisao } from '../../core/domain/tipos'
import { Botao, Carregando, Entrada, Escolha, Info, Selecao, ValorInput, cx, dataBR } from '../../ui/base'
import { useAvisoSaida, useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

/** as bases do % (os mesmos nomes do estado de resultado) */
const BASES = [
  { id: 'total', nome: 'Total faturado' },
  { id: 'liquido', nome: 'Vendas líquidas (sem IVA)' },
  { id: 'lucro', nome: 'Resultado da venda' },
] as const

/** valor contábil: negativo entre parênteses — "(Bs 3.600,00)" */
const contabil = (n: number, m: string) => (n < 0 ? `(${formatar(-n, m)})` : formatar(n, m))
const pctTexto = (bp: number) => { const v = Math.round(bp / 10) / 10; return `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` }
/** as cores das partes na barra (a casa fica cinza) */
const CORES = ['#8b5cf6', '#0ea5e9', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1']

export function DivisaoValores({ vendaId }: { vendaId: Id }) {
  const t = useT()
  const { dados: d } = useConsulta('divisaoVenda', { id: vendaId })
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { executar, ocupado } = useComando()
  const [editando, setEditando] = useState<ParteDivisao[]>()
  const [porItem, setPorItem] = useState(false)
  const sujo = editando !== undefined
  useAvisoSaida(sujo)
  if (!d) return <Carregando />
  const m = d.moeda
  const v = (n: number) => formatar(n, m)
  const partes = editando ?? d.divisao.partes.map(({ calculado: _c, ...p }) => p)
  const calc = calcularDivisao(partes, d.bases)
  const acima = calc.dividido > d.bases.total
  const mudar = (i: number, p: Partial<ParteDivisao>) => setEditando(partes.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const nomes = [...new Set((pessoas ?? []).map((p) => p.nome))].sort((a, b) => a.localeCompare(b))
  const tot = d.totais
  const comercial = d.estado.filter((x) => ['lista', 'desconto', 'facturado'].includes(x.id))
  const contabilL = d.estado.filter((x) => !['lista', 'desconto', 'facturado'].includes(x.id))
  const linha = (x: (typeof d.estado)[number]) => (
    <li key={x.id} className={cx('num grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-baseline gap-x-3 px-4 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto_4.5rem]',
      x.tipo === 'subtotal' && 'mt-1 border-t border-[var(--borda)] pt-2',
      x.tipo === 'total' && 'mt-1 border-t border-[var(--borda)] pt-2.5')}>
      <span className="min-w-0">
        <span className={cx('flex items-center gap-1 text-sm', x.tipo === 'conta' ? 'text-[var(--suave)]' : 'font-bold')}>{t(x.pt)}<Info texto={x.ajuda} /></span>
        <span lang="es" className="block truncate text-[11px] italic text-[var(--suave)] opacity-80">{x.es}</span>
      </span>
      <span className={cx('whitespace-nowrap text-right', x.tipo === 'conta' ? 'text-sm' : 'text-base font-bold', x.tipo === 'total' && 'border-b-[3px] border-double border-[var(--texto)] pb-0.5 font-black', x.tipo === 'total' && (x.valor < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'))}>{contabil(x.valor, m)}</span>
      <span className="whitespace-nowrap text-right text-xs text-[var(--suave)]">{pctTexto(x.pctBp)}</span>
    </li>
  )
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* 1. O ESTADO DE RESULTADO DA VENDA (padrão boliviano do relatório contábil) */}
      <section aria-label={t('Estado de resultado da venda')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--borda)] px-4 py-3">
          <b>{t('Estado de resultado da venda')}</b>
          <span className="text-xs text-[var(--suave)]">{t('padrão boliviano · NC (CTNAC) e Ley 843')}</span>
          <Info texto="A mesma ordem do Estado de Resultados do relatório contábil, para uma venda só: primeiro o que está na factura (preço de lista, descontos, total faturado); depois o IVA (do fisco), o custo e o IT. O IUE é anual (sobre o lucro do ano) e por isso não se reparte por venda. Impostos estimados." />
        </div>
        {/* cabeçalho das colunas */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] gap-x-3 bg-[var(--fundo)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)] sm:grid-cols-[minmax(0,1fr)_auto_4.5rem]">
          <span>{t('Conceito')}</span><span className="text-right">{m}</span><span className="text-right"><span className="sm:hidden">%</span><span className="hidden sm:inline">{t('% do faturado')}</span></span>
        </div>
        <p className="px-4 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--marca)]">{t('Comercial · como na factura')}</p>
        <ol className="pb-1">{comercial.map(linha)}</ol>
        {contabilL.length > 0 && <>
          <p className="border-t border-dashed border-[var(--borda)] px-4 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--marca)]">{t('Contábil')}</p>
          <ol className="pb-3">{contabilL.map(linha)}</ol>
        </>}
        {tot.lucroPainel !== undefined && <p className="num border-t border-[var(--borda)] px-4 py-2 text-xs text-[var(--suave)]">{t('No Painel, o lucro é antes de qualquer imposto: {v}.', { v: formatar(tot.lucroPainel, m) })}</p>}
        <div className="border-t border-[var(--borda)]">
          <button type="button" aria-expanded={porItem} onClick={() => setPorItem(!porItem)} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-[var(--marca)] hover:bg-[var(--fundo)]">
            <span aria-hidden className={cx('transition-transform', porItem && 'rotate-90')}>›</span>{t('Por item')} <span className="font-normal text-[var(--suave)]">· {t('{n} item(ns)', { n: d.linhas.length })}</span>
          </button>
          {porItem && (
            <div className="overflow-x-auto border-t border-[var(--borda)]">
              <table className="num w-full text-sm">
                <thead className="bg-[var(--fundo)] text-left text-[11px] uppercase tracking-wide text-[var(--suave)]">
                  <tr><th className="px-4 py-1.5 font-semibold">{t('Item')}</th><th className="px-2 py-1.5 text-right font-semibold">{t('Faturado')}</th>{d.verCusto && <><th className="px-2 py-1.5 text-right font-semibold">{t('Custo')}</th><th className="px-2 py-1.5 text-right font-semibold">{t('Resultado')}</th><th className="px-4 py-1.5 text-right font-semibold">{t('Margem')}</th></>}</tr>
                </thead>
                <tbody className="divide-y divide-[var(--borda)]">
                  {d.linhas.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2"><span className="block font-semibold">{l.descricao}</span>{l.desconto > 0 && <span className="block text-xs text-[var(--suave)]">{t('desconto')} {formatar(l.desconto, m)}</span>}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">{formatar(l.facturado, m)}</td>
                      {d.verCusto && <>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-[var(--suave)]">{contabil(-(l.custo ?? 0) - (l.servicos ?? 0), m)}</td>
                        <td className={cx('whitespace-nowrap px-2 py-2 text-right font-bold', (l.resultado ?? 0) < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{contabil(l.resultado ?? 0, m)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">{pctTexto(l.margemBp ?? 0)}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 2. DIVIDIR O VALOR */}
      <section aria-label={t('Dividir o valor')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--borda)] px-4 py-3">
          <b>{t('Dividir o valor')}</b>
          <span className="text-xs text-[var(--suave)]">{t('com quem, por % ou valor fixo')}</span>
          <Info texto="Só registro: grava com quem esta venda é dividida (ex.: 30% do lucro para a sócia, Bs 200 fixos para quem indicou). Não mexe no caixa nem muda a venda. Fica no histórico." />
        </div>
        <div className="space-y-3 p-4">
          {!partes.length && <p className="rounded-xl bg-[var(--fundo)] px-3 py-3 text-sm text-[var(--suave)]">{t('Sem divisão: o valor todo fica com a casa. Precisa dividir? Adicione uma parte.')}</p>}
          <datalist id="divisao-pessoas">{nomes.map((n) => <option key={n} value={n} />)}</datalist>
          {partes.map((p, i) => {
            const c = calc.partes[i]
            return (
              <div key={p.id} className="rounded-xl border border-[var(--borda)] p-3" style={{ boxShadow: `inset 3px 0 0 ${CORES[i % CORES.length]}` }}>
                <div className="flex items-center gap-2">
                  <Entrada list="divisao-pessoas" aria-label={t('Com quem')} placeholder={t('Com quem (nome)')} value={p.nome} onChange={(e) => mudar(i, { nome: e.target.value, pessoaId: (pessoas ?? []).find((x) => x.nome === e.target.value)?.id })} className="min-w-0 flex-1" />
                  <button type="button" aria-label={`${t('Tirar')} ${p.nome}`} onClick={() => setEditando(partes.filter((_, k) => k !== i))} className="h-11 w-11 shrink-0 rounded-xl text-lg text-[var(--suave)] hover:bg-[var(--ruim)]/10 hover:text-[var(--ruim)]">×</button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="w-24 shrink-0"><Escolha rotulo="Como" valor={p.modo} onChange={(x) => mudar(i, { modo: x as ParteDivisao['modo'] })} opcoes={[{ id: 'pct', nome: '%' }, { id: 'valor', nome: 'Bs' }]} /></div>
                  {p.modo === 'pct' ? (
                    <>
                      <div className="relative w-24"><Entrada inputMode="decimal" aria-label={t('Porcentagem')} value={p.pctBp !== undefined ? String(p.pctBp / 100).replace('.', ',') : ''} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); mudar(i, { pctBp: e.target.value.trim() && Number.isFinite(n) ? Math.round(n * 100) : undefined }) }} className="num pr-7" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--suave)]">%</span></div>
                      <span className="text-sm text-[var(--suave)]">{t('de')}</span>
                      <div className="min-w-[9rem] flex-1"><Selecao valor={p.base} onChange={(x) => mudar(i, { base: x as ParteDivisao['base'] })} opcoes={BASES.filter((b) => b.id !== 'lucro' || d.verCusto).map((b) => ({ id: b.id, nome: `${t(b.nome)} (${v(d.bases[b.id])})` }))} /></div>
                    </>
                  ) : <div className="min-w-[9rem] flex-1"><ValorInput moeda={m} valor={p.valor} onChange={(x) => mudar(i, { valor: x })} /></div>}
                  <b className="num ml-auto whitespace-nowrap text-base">= {v(c?.calculado ?? 0)}</b>
                </div>
                <Entrada aria-label={t('Observação')} placeholder={t('Observação (opcional)')} value={p.obs ?? ''} onChange={(e) => mudar(i, { obs: e.target.value })} className="mt-2" />
              </div>
            )
          })}
          <Botao variante="secundario" className="w-full" onClick={() => setEditando([...partes, { id: novoId(), nome: '', modo: 'pct', base: 'total' }])}>+ {t('Adicionar parte')}</Botao>

          {/* O RESULTADO: a barra das partes + a casa, e os números */}
          {partes.length > 0 && (
            <div className="space-y-2 rounded-xl bg-[var(--fundo)] p-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-[var(--borda)]" role="img" aria-label={t('Divisão do total')}>
                {calc.partes.map((p, i) => <span key={p.id} style={{ width: `${d.bases.total ? Math.max(0, Math.min(100, (p.calculado / d.bases.total) * 100)) : 0}%`, background: CORES[i % CORES.length] }} />)}
              </div>
              <ul className="num space-y-1 text-sm">
                {calc.partes.map((p, i) => <li key={p.id} className="flex justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CORES[i % CORES.length] }} /><span className="truncate">{p.nome || t('(sem nome)')}</span></span><b>{v(p.calculado)}</b></li>)}
                <li className="flex justify-between gap-2 border-t border-[var(--borda)] pt-1 font-bold"><span>🏠 {t('Fica com a casa')}</span><span className={cx(acima && 'text-[var(--ruim)]')}>{v(calc.casa)}</span></li>
              </ul>
              {acima && <p className="text-sm font-semibold text-[var(--ruim)]">{t('As partes passam do total cobrado. Diminua alguma.')}</p>}
            </div>
          )}

          {(sujo || d.divisao.em) && (
            <div className="flex flex-wrap items-center gap-2">
              {d.divisao.em && !sujo && <span className="text-xs text-[var(--suave)]">✓ {t('Gravada por {q} em {d}', { q: d.divisao.porNome ?? '', d: dataBR(d.divisao.em) })}</span>}
              {sujo && <Botao variante="leve" onClick={() => setEditando(undefined)}>{t('Desfazer')}</Botao>}
              {sujo && <Botao className="ml-auto" disabled={ocupado || acima} onClick={async () => { if (await executar('salvarDivisaoVenda', { id: vendaId, partes, versaoBase: d.versao }, t('Divisão gravada.'))) setEditando(undefined) }}>{t('Salvar divisão')}</Botao>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
