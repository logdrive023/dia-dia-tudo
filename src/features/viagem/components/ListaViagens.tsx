// VIAGENS › LISTA: as viagens (código, destino, datas, gasto × orçamento) e o comparativo entre elas.
import { TabelaDados, corDoNome, iniciais } from '../../../shared/ui/tabelaDados'
import { CodigoTexto } from '../../../shared/ui/codigos'
import { BarraLimite } from '../../../shared/ui/barras'
import { formatar } from '../../../core/domain/dinheiro'
import { Botao, Info, Pilula, Vazio, cx, dataBR, gramasTexto, pctBp } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { NumeroPequeno } from '../../../shared/ui/numeroGrande'
import { NOME_STATUS, TOM_STATUS, type LinhaLista } from '../model/tipos'

/**
 * LISTA DAS VIAGENS (bateu o olho, entendeu): um cartão por viagem, igual no celular e no computador —
 * cabeçalho (código, nome, destino, situação), quem foi e quando, a barra do orçamento e 4 blocos
 * (Gastos · Comprou · Custo/kg real · Resultado). Prospecção (sem compra) diz isso em vez de "−Bs".
 */
/**
 * VISTA "LISTA" (tabela padrão): uma linha por viagem — no computador, colunas que dá para comparar de cima a baixo
 * (gastos × orçamento, kg, custo/kg real, resultado); no celular, a linha curta padrão que abre no lugar.
 * A vista "Cartões" (ListaViagens) continua com a barra do orçamento e os 4 números em destaque.
 */
/** `onGasto`: o "⛽ Gasto" direto na linha da viagem aberta (lança sem abrir a ficha) */
export function TabelaViagens({ linhas, onGasto }: { linhas: LinhaLista[]; onGasto?(id: string): void }) {
  const t = useT()
  const { ir } = useApp()
  const resultado = (v: LinhaLista) => (v.prospeccao ? <span className="text-[var(--suave)]">{t('sem compra')}</span> : <b style={{ color: v.resultado < 0 ? 'var(--ruim)' : 'var(--bom)' }}>{formatar(v.resultado, v.moeda)}</b>)
  const periodo = (v: LinhaLista) => `${dataBR(v.inicio)}${v.fim ? ` → ${dataBR(v.fim)}` : ''}`
  return (
    <TabelaDados
      linhas={linhas}
      chave={(v) => v.id}
      onAbrir={(v) => ir('viagem', { id: v.id })}
      rotuloLinha={(v) => `${v.codigo} · ${v.nome}`}
      acaoRapida={(v) => (v.status === 'aberta' && onGasto ? <Botao variante="secundario" className="whitespace-nowrap px-3" onClick={(e) => (e.stopPropagation(), onGasto(v.id))}>⛽ {t('Gasto')}</Botao> : null)}
      colunas={[
        { id: 'viagem', titulo: 'Viagem', classe: 'w-full min-w-[12rem]', celula: (v) => (
          <span className="block min-w-0">
            <span className="flex flex-wrap items-center gap-1.5"><CodigoTexto codigo={v.codigo} className="text-xs" />{v.prospeccao && <Pilula pequena>{t('prospecção')}</Pilula>}</span>
            <b className="block truncate">{v.nome}</b>
            <span className="block truncate text-xs text-[var(--suave)]">{[v.destino ? `📍 ${v.destino}` : '', `👤 ${v.viajantes.map((x) => x.nome).join(', ')}`].filter(Boolean).join(' · ')}</span>
          </span>
        ) },
        { id: 'situacao', titulo: 'Situação', classe: 'whitespace-nowrap', celula: (v) => <Pilula tom={TOM_STATUS[v.status]}>{t(NOME_STATUS[v.status])}</Pilula> },
        { id: 'periodo', titulo: 'Período', classe: 'whitespace-nowrap', larga: true, celula: (v) => <span className="num text-sm">{periodo(v)}<span className="block text-xs text-[var(--suave)]">{t('{n} dia(s)', { n: v.dias })}</span></span> },
        { id: 'gastos', titulo: 'Gastos', direita: true, classe: 'whitespace-nowrap', celula: (v) => (
          <span className="num">{formatar(v.gasto, v.moeda)}{v.orcamento ? <span className={cx('block text-xs', v.acimaOrcamento ? 'font-semibold text-[var(--ruim)]' : 'text-[var(--suave)]')}>{t('de')} {formatar(v.orcamento, v.moeda)}{v.acimaOrcamento ? ` · ${t('passou')}` : ''}</span> : null}</span>
        ) },
        { id: 'comprou', titulo: 'Comprou', direita: true, classe: 'whitespace-nowrap', celula: (v) => <span className="num">{gramasTexto(v.gramas)}<span className="block text-xs text-[var(--suave)]">{t('{n} compra(s)', { n: v.compras })}</span></span> },
        { id: 'custoKg', titulo: 'Custo/kg real', direita: true, classe: 'whitespace-nowrap', larga: true, celula: (v) => <span className="num">{v.custoKgReal !== undefined ? formatar(v.custoKgReal, v.moeda) : '—'}</span> },
        { id: 'resultado', titulo: 'Resultado', direita: true, classe: 'whitespace-nowrap', celula: (v) => <span className="num">{resultado(v)}{!v.prospeccao && <span className="block text-xs text-[var(--suave)]">ROI {pctBp(v.roiBp)}</span>}</span> },
      ]}
      celular={{
        titulo: (v) => v.nome,
        valor: (v) => resultado(v),
        valorSub: (v) => `${t('Gastos')} ${formatar(v.gasto, v.moeda)}`,
        codigo: (v) => v.codigo,
        situacao: (v) => ({ texto: NOME_STATUS[v.status], tom: v.status === 'aberta' ? 'marca' : 'suave' }),
        alerta: (v) => (v.acimaOrcamento ? { texto: 'passou do orçamento', tom: 'ruim' } : v.prospeccao ? { texto: 'prospecção', tom: 'suave' } : undefined),
        tom: (v) => (v.acimaOrcamento ? 'ruim' : v.status === 'aberta' ? 'marca' : undefined),
        fatos: (v) => [
          v.destino ? `📍 ${v.destino}` : undefined,
          `👤 ${v.viajantes.map((x) => x.nome).join(', ')}`,
          `📅 ${periodo(v)} · ${t('{n} dia(s)', { n: v.dias })}`,
          `⚖ ${gramasTexto(v.gramas)} · ${t('{n} compra(s)', { n: v.compras })}`,
          v.custoKgReal !== undefined ? `💵 ${t('Custo/kg real')} ${formatar(v.custoKgReal, v.moeda)}` : undefined,
          v.orcamento ? `🎯 ${formatar(v.gasto, v.moeda)} ${t('de')} ${formatar(v.orcamento, v.moeda)}` : undefined,
        ].filter(Boolean),
      }}
    />
  )
}

export function ListaViagens({ linhas }: { linhas: LinhaLista[] }) {
  const t = useT()
  const { ir } = useApp()
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {linhas.map((v) => {
        const usoOrc = v.orcamento ? Math.min(100, Math.round((v.gasto * 100) / v.orcamento)) : undefined
        const aberta = v.status === 'aberta'
        return (
          <li key={v.id}>
            <button type="button" onClick={() => ir('viagem', { id: v.id })} className={cx('flex h-full w-full flex-col gap-3 rounded-2xl border bg-[var(--cartao)] p-3 text-left xs:p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', aberta ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
              <div className="flex items-start gap-3">
                <span aria-hidden className={cx('hidden h-11 w-11 shrink-0 items-center xs:flex justify-center rounded-xl text-xl', aberta ? 'bg-[var(--marca-suave)]' : 'bg-[var(--fundo)]')}>{aberta ? '✈️' : '🏁'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <CodigoTexto codigo={v.codigo} className="text-sm" />
                    <Pilula tom={TOM_STATUS[v.status]}>{t(NOME_STATUS[v.status])}</Pilula>
                    {v.prospeccao && <Pilula>{t('prospecção')}</Pilula>}
                  </span>
                  <b className="mt-0.5 block text-base leading-tight break-words">{v.nome}</b>
                  <span className="mt-0.5 block text-xs text-[var(--suave)]">{[v.destino ? `📍 ${v.destino}` : '', `👤 ${v.viajantes.map((x) => x.nome).join(', ')}`, `📅 ${dataBR(v.inicio)}${v.fim ? ` → ${dataBR(v.fim)}` : ''} · ${t('{n} dia(s)', { n: v.dias })}`].filter(Boolean).join('  ·  ')}</span>
                </span>
                <span aria-hidden className="text-xl text-[var(--suave)]">›</span>
              </div>
              {usoOrc !== undefined && (
                <div>
                  <div className="num flex justify-between text-xs"><span className="text-[var(--suave)]">{t('Orçamento dos gastos')}</span><span className={v.acimaOrcamento ? 'font-semibold text-[var(--ruim)]' : 'text-[var(--suave)]'}>{formatar(v.gasto, v.moeda)} {t('de')} {formatar(v.orcamento!, v.moeda)}{v.acimaOrcamento ? ` · ${t('passou')}` : ''}</span></div>
                  <BarraLimite className="mt-1" altura="h-2" usado={v.gasto} previsto={v.orcamento} />
                </div>
              )}
              <div className="num grid grid-cols-2 gap-2 sm:grid-cols-4">
                <NumeroPequeno rotulo="Gastos" valor={formatar(v.gasto, v.moeda)} />
                <NumeroPequeno rotulo="Comprou" valor={gramasTexto(v.gramas)} sub={t('{n} compra(s)', { n: v.compras })} />
                <NumeroPequeno rotulo="Custo/kg real" valor={v.custoKgReal !== undefined ? formatar(v.custoKgReal, v.moeda) : '—'} />
                <NumeroPequeno rotulo="Resultado" valor={v.prospeccao ? t('sem compra') : formatar(v.resultado, v.moeda)} sub={v.prospeccao ? undefined : `ROI ${pctBp(v.roiBp)}`} cor={v.prospeccao ? undefined : v.resultado < 0 ? 'var(--ruim)' : 'var(--bom)'} />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * POR VIAJANTE — quem compra mais barato: um cartão por pessoa (a melhor primeiro, com 🏆), o custo por kg real em
 * destaque e o resto em selos. Com o filtro de viagem, compara só quem foi naquela viagem.
 */
export function Comparativo({ linhas, moeda, uma }: { linhas: NonNullable<ReturnType<typeof useConsulta<'viagens'>>['dados']>['comparativo']; moeda: string; uma?: { codigo: string; nome: string } }) {
  const t = useT()
  if (!linhas.length) return <Vazio texto="Nenhuma viagem por aqui." />
  return (
    <div>
      <p className="mb-2 flex flex-wrap items-center gap-1 text-sm text-[var(--suave)]">
        {uma ? t('Na viagem {v}: quem comprou mais barato.', { v: `${uma.codigo} · ${uma.nome}` }) : t('Quem compra mais barato, somando todas as viagens.')}
        <Info texto="Custo/kg real = (cabelo + gastos da viagem) ÷ kg comprados. Viagem com várias pessoas conta para cada uma." exemplo="Ex.: Bs 14.800 por 4 kg = Bs 3.700/kg" />
      </p>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {linhas.map((x, k) => {
          const melhor = k === 0 && x.custoKgReal !== undefined && linhas.length > 1
          return (
            <li key={x.id} className={cx('rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm', melhor ? 'border-[var(--bom)] ring-2 ring-[var(--bom)]/20' : 'border-[var(--borda)]')}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: corDoNome(x.nome) }}>{iniciais(x.nome)}</span>
                <span className="linha-texto">
                  <b className="block leading-tight">{melhor && '🏆 '}{x.nome}</b>
                  <span className="text-xs text-[var(--suave)]">{t('{n} viagem(ns)', { n: x.viagens })}{x.prospeccao ? ` · ${t('{n} sem compra', { n: x.prospeccao })}` : ''}</span>
                </span>
                <span className="ml-auto shrink-0 text-right">
                  <b className={cx('num block text-xl leading-tight', melhor && 'text-[var(--bom)]')}>{x.custoKgReal !== undefined ? formatar(x.custoKgReal, moeda) : '—'}</b>
                  <span className="text-[11px] text-[var(--suave)]">{t('por kg (real)')}</span>
                </span>
              </div>
              <div className="num mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-[var(--fundo)] px-2 py-1">⚖️ {gramasTexto(x.gramas)}</span>
                <span className="rounded-full bg-[var(--fundo)] px-2 py-1">⛽ {formatar(x.gasto, moeda)}{x.gastoKg !== undefined ? ` · ${formatar(x.gastoKg, moeda)}/kg` : ''}</span>
                <span className={cx('rounded-full px-2 py-1', x.resultado < 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : 'bg-[var(--bom)]/10 text-[var(--bom)]')}>📈 {formatar(x.resultado, moeda)}{x.roiMedioBp !== undefined ? ` · ROI ${pctBp(x.roiMedioBp)}` : ''}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
