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

const BASES = [
  { id: 'total', nome: 'Total cobrado' },
  { id: 'liquido', nome: 'Líquido' },
  { id: 'lucro', nome: 'Lucro' },
] as const
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
  const degraus: { rot: string; valor: number; sinal?: '−' | '='; forte?: boolean; tom?: 'bom' | 'ruim'; ajuda: string }[] = [
    { rot: 'Bruto (preço cheio)', valor: tot.bruto, ajuda: 'O preço de tabela de cada item, antes do desconto. Ex.: 2 kg × 17,5 = Bs 35.000.' },
    { rot: 'Desconto', valor: tot.desconto, sinal: '−', ajuda: 'O desconto dado na venda (em % ou valor), já repartido entre os itens.' },
    { rot: 'Cobrado (total da venda)', valor: tot.cobrado, sinal: '=', forte: true, ajuda: 'O que a cliente pagou (ou vai pagar). É o total da venda.' },
    { rot: `Impostos estimados${d.impostos.length ? ` (${d.impostos.map((x) => `${x.sigla} ${x.taxaBp / 100}%`).join(' · ')})` : ''}`, valor: tot.imposto, sinal: '−', ajuda: 'Os impostos estimados no dia da venda (Configurações › Fiscal). Estimativa: o valor real sai da declaração do período.' },
    { rot: 'Líquido', valor: tot.liquido, sinal: '=', forte: true, ajuda: 'Cobrado − impostos estimados: o que fica para o negócio antes dos custos.' },
    ...(d.verCusto && tot.custo !== undefined ? [
      { rot: 'Custo do cabelo / produto', valor: tot.custo, sinal: '−' as const, ajuda: 'Quanto custou o que saiu do estoque (pela compra).' },
      { rot: 'Insumos', valor: tot.insumos ?? 0, sinal: '−' as const, ajuda: 'Tinta, produtos e o que o serviço gastou (do catálogo ou da linha).' },
      { rot: 'Comissão', valor: tot.comissao ?? 0, sinal: '−' as const, ajuda: 'A parte da profissional nos serviços.' },
      { rot: 'Lucro (antes dos impostos)', valor: tot.lucro ?? 0, sinal: '=' as const, forte: true, tom: (tot.lucro ?? 0) < 0 ? 'ruim' as const : 'bom' as const, ajuda: 'Cobrado − custo − insumos − comissão. O mesmo lucro do Painel.' },
    ] : []),
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* 1. O DETALHE DO VALOR */}
      <section aria-label={t('Detalhe do valor')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <p className="border-b border-[var(--borda)] px-4 py-3"><b>{t('Detalhe do valor')}</b> <span className="text-xs text-[var(--suave)]">{t('do preço cheio ao lucro')}</span></p>
        <ol className="px-4 py-2">
          {degraus.map((x) => (
            <li key={x.rot} className={cx('num flex items-center gap-2 py-1.5', x.forte && 'mt-1 border-t border-[var(--borda)] pt-2.5')}>
              <span aria-hidden className="w-4 shrink-0 text-center font-bold text-[var(--suave)]">{x.sinal ?? ''}</span>
              <span className={cx('flex min-w-0 flex-1 items-center gap-1 text-sm', x.forte ? 'font-bold' : 'text-[var(--suave)]')}>{t(x.rot)}<Info texto={x.ajuda} /></span>
              <span className={cx('shrink-0 whitespace-nowrap', x.forte ? 'text-base font-black' : 'text-sm', x.tom === 'bom' && 'text-[var(--bom)]', x.tom === 'ruim' && 'text-[var(--ruim)]')}>{v(x.valor)}</span>
            </li>
          ))}
        </ol>
        <div className="border-t border-[var(--borda)]">
          <button type="button" aria-expanded={porItem} onClick={() => setPorItem(!porItem)} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-[var(--marca)] hover:bg-[var(--fundo)]">
            <span aria-hidden className={cx('transition-transform', porItem && 'rotate-90')}>›</span>{t('Por item')} <span className="font-normal text-[var(--suave)]">· {t('{n} item(ns)', { n: d.linhas.length })}</span>
          </button>
          {porItem && (
            <ul className="divide-y divide-[var(--borda)] border-t border-[var(--borda)] text-sm">
              {d.linhas.map((l) => (
                <li key={l.id} className="px-4 py-2.5">
                  <p className="font-semibold">{l.descricao}</p>
                  <dl className="num mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
                    {[['Bruto', l.bruto], ['Desconto', -l.desconto], ['Cobrado', l.cobrado], ['Impostos', -l.imposto], ['Líquido', l.liquido], ...(l.custo !== undefined ? [['Custo', -l.custo], ['Insumos', -(l.insumos ?? 0)], ['Comissão', -(l.comissao ?? 0)], ['Lucro', l.lucro ?? 0]] : [])].map(([r, n]) => (
                      <div key={r as string} className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t(r as string)}</dt><dd className={cx(r === 'Lucro' || r === 'Cobrado' || r === 'Líquido' ? 'font-bold' : '')}>{v(n as number)}</dd></div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
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
