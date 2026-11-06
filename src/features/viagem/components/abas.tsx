// VIAGENS › ABAS DA FICHA: histórico, resumo, gastos, compras, rateio (custo/kg antes e depois) e contas.
import { useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { LigarCompras } from '../../compra'
import { formatar } from '../../../core/domain/dinheiro'
import { dataLocal } from '../../../core/domain/datas'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Campo, Cartao, Confirmar, Entrada, Escolha, Janela, Pilula, Selecao, ValorInput, Vazio, cx, dataBR, gramasTexto, pctBp } from '../../../shared/ui/base'
import { useApp, useComando } from '../../../shared/ui/contexto'
import { Anexos, clicavel, useCotacoes } from '../../../shared/ui/compartilhados'
import { Barras } from '../../../shared/ui/graficos'
import { useT } from '../../../shared/ui/i18n'
import { LinhaDoTempo } from '../../../shared/ui/linhaTempo'
import { NumeroGrande, NumeroPequeno } from '../../../shared/ui/numeroGrande'
import { AvisoNoAparelho, BarraOrcamento, CarteiraViagem, LinhaGasto } from '../../../shared/ui/viagem'
import { NOME_STATUS, type Dados } from '../model/tipos'

/**
 * HISTÓRICO DA VIAGEM: em cima, a vida da viagem em 4 blocos (quando abriu · gastos lançados · dinheiro levado ·
 * compras ligadas) e a situação; embaixo, a linha do tempo completa (cada ação com quem e quando, e o link).
 */
export function AbaHistorico({ d }: { d: Dados }) {
  const t = useT()
  const v = d.viagem
  const gastos = d.despesas.filter((x) => !x.anulada)
  const anulados = d.despesas.length - gastos.length
  return (
    <div className="space-y-3">
      <div className="num grid grid-cols-2 gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm lg:grid-cols-4">
        <NumeroPequeno rotulo="Abriu" valor={dataBR(v.inicio)} sub={v.fim ? `${t('volta')} ${dataBR(v.fim)}` : t('sem data de volta')} />
        <NumeroPequeno rotulo="Gastos lançados" valor={String(gastos.length)} sub={anulados ? t('{n} anulado(s)', { n: anulados }) : formatar(d.kpis.gasto, d.moeda)} />
        <NumeroPequeno rotulo="Compras ligadas" valor={String(d.compras.length)} sub={gramasTexto(d.kpis.gramas)} />
        <NumeroPequeno rotulo="Situação" valor={t(NOME_STATUS[v.status])} sub={v.status === 'encerrada' ? t('contas prestadas') : t('em andamento')} cor={v.status === 'aberta' ? 'var(--marca)' : undefined} />
      </div>
      <Cartao titulo={t('Tudo o que aconteceu')} ajuda="Cada ação da viagem, da mais nova para a mais antiga, com quem fez e quando: gastos lançados ou anulados, adiantamentos, compras ligadas, encerramento. Toque na referência para abrir. Ex.: 03/11 · Paula lançou gasolina Bs 150 ↗">
        <LinhaDoTempo id={v.id} />
      </Cartao>
    </div>
  )
}

export function AbaResumo({ d }: { d: Dados }) {
  const t = useT()
  const { ir } = useApp()
  const k = d.kpis
  const m = d.moeda
  return (
    <div className="space-y-3">
      {d.prospeccao && (
        <div className="rounded-2xl border border-[var(--alerta)] bg-[var(--alerta)]/10 p-3 text-sm">
          <b>🔎 {t('Viagem sem compra (prospecção)')}</b>
          <p>{t('Os gastos desta viagem ({v}) são custo de prospecção: não há cabelo para dividir, então não existe ROI. Se alguma compra foi feita, ligue em "Compras".', { v: formatar(k.gasto, m) })}</p>
        </div>
      )}
      {d.prospeccao ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <NumeroGrande rotulo="Gastos da viagem" tom="ruim" valor={formatar(k.gasto, m)} ajuda="Custo de prospecção: combustível, hospedagem, comida… sem cabelo comprado." />
          <NumeroGrande rotulo="Dias" valor={k.dias} />
          <NumeroGrande rotulo="Custo por dia" valor={formatar(k.custoDia, m)} ajuda="Gastos da viagem ÷ dias de viagem." />
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {k.gramasEstoque > 0 ? (
          <NumeroGrande rotulo="Resultado contando o estoque" tom={k.resultadoPotencial < 0 ? 'ruim' : 'bom'} valor={formatar(k.resultadoPotencial, m)} ajuda="O que já entrou das vendas + o que o estoque desta viagem vale pela tabela − (cabelo + gastos). É o número para julgar a viagem enquanto ainda tem cabelo para vender." sub={`${t('realizado até agora')}: ${formatar(k.resultado, m)}`} />
        ) : <NumeroGrande rotulo="Resultado" tom={d.prospeccao ? undefined : k.resultado < 0 ? 'ruim' : 'bom'} valor={formatar(k.resultado, m)} ajuda="Receita das vendas do cabelo desta viagem − (custo do cabelo + gastos da viagem). Enquanto houver estoque ele tende a ser negativo: veja o potencial. Ex.: vendeu Bs 8.000 de Bs 14.800 investidos = −Bs 6.800." />}
        {k.gramasEstoque > 0 && k.roiPotencialBp !== undefined
          ? <NumeroGrande rotulo="ROI contando o estoque" tom={k.roiPotencialBp < 0 ? 'ruim' : 'bom'} valor={pctBp(k.roiPotencialBp)} ajuda="Resultado contando o estoque ÷ o que foi investido (cabelo + gastos)." sub={`${t('realizado até agora')}: ${pctBp(k.roiBp)}`} />
          : <NumeroGrande rotulo="ROI" tom={k.roiBp === undefined ? undefined : k.roiBp < 0 ? 'ruim' : 'bom'} valor={pctBp(k.roiBp)} ajuda="Resultado ÷ o que foi investido (cabelo + gastos). Ex.: −6.800 ÷ 14.800 = −45,9%." />}
        <NumeroGrande rotulo="Receita gerada" valor={formatar(k.receita, m)} ajuda="Vendas do cabelo que veio desta viagem (pela genealogia: compra → triagem → lote → venda), proporcional às gramas." sub={`${gramasTexto(k.gramasVendidas)} ${t('vendidos')}`} />
        <NumeroGrande rotulo="Investido" valor={formatar(k.investido, m)} ajuda="Custo do cabelo comprado na viagem + gastos operacionais da viagem." sub={`${t('cabelo')} ${formatar(k.custoCabelo, m)} · ${t('gastos')} ${formatar(k.gasto, m)}`} />
        <NumeroGrande rotulo="Custo/kg sem logística" valor={k.custoKg !== undefined ? formatar(k.custoKg, m) : '—'} ajuda="Só o que se pagou pelo cabelo ÷ kg comprados." sub={k.custoGrama !== undefined ? `${formatar(Math.round(k.custoGrama), m)}/g` : undefined} />
        <NumeroGrande rotulo="Custo/kg real" valor={k.custoKgReal !== undefined ? formatar(k.custoKgReal, m) : '—'} ajuda="(Cabelo + gastos da viagem) ÷ kg comprados: o custo de verdade de cada grama. Ex.: (14.000 + 800) ÷ 4 kg = Bs 3.700/kg." sub={k.custoGramaReal !== undefined ? `${formatar(Math.round(k.custoGramaReal), m)}/g` : undefined} />
        <NumeroGrande rotulo="Comprado" valor={gramasTexto(k.gramas)} sub={`${t('capital pago')} ${formatar(k.capitalPago, m)}`} />
        <NumeroGrande rotulo="Ainda em estoque" valor={`${pctBp(k.pctEstoqueBp)}`} ajuda="Gramas desta viagem que ainda estão no estoque e quanto valem pela tabela de preço (sem preço na tabela: pelo custo)." sub={`${gramasTexto(k.gramasEstoque)} · ${t('potencial')} ${formatar(k.potencial, m)}`} />
        <NumeroGrande rotulo="Dias" valor={k.dias} />
        <NumeroGrande rotulo="Custo por dia" valor={formatar(k.custoDia, m)} ajuda="Gastos da viagem ÷ dias de viagem." />
        <NumeroGrande rotulo="Lucro sobre o vendido" tom={k.lucroVendido < 0 ? 'ruim' : 'bom'} valor={formatar(k.lucroVendido, m)} ajuda="Receita − (custo do cabelo + gastos) proporcional às gramas já vendidas. Mostra se o que já saiu deu lucro." />
      </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {!d.prospeccao && <Cartao titulo={t('Resultado da viagem (DRE)')}>
          <table className="w-full text-sm">
            <tbody>
              {d.dre.filter((l) => l.nivel < 2 || l.valor).map((l) => (
                <tr key={l.conta} className={cx('border-t border-[var(--borda)] first:border-t-0', l.nivel === 0 && 'font-bold')}>
                  <td className={cx('py-1.5', l.nivel === 1 && 'pl-3', l.nivel === 2 && 'pl-6 text-[var(--suave)]')}>{t(l.conta)}</td>
                  <td className={cx('num py-1.5 text-right', l.valor < 0 && 'text-[var(--ruim)]')}>{formatar(l.valor, m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {k.semPreco > 0 && <p className="mt-2 text-xs text-[var(--suave)]">{t('{n} lote(s) sem preço na tabela: entram no potencial pelo custo.', { n: k.semPreco })}</p>}
        </Cartao>}
        <div className="space-y-3">
          <Cartao titulo={t('Orçamento')}>
            <div className="space-y-3">
              <BarraOrcamento rotulo="Gastos da viagem" usado={k.gasto} previsto={d.viagem.orcamento} moeda={m} />
              <BarraOrcamento rotulo="Cabelo comprado" usado={k.custoCabelo} previsto={d.viagem.orcamentoCompra} moeda={m} />
            </div>
          </Cartao>
          <Cartao titulo={t('Gastos por categoria')}>
            <Barras formato="dinheiro" moeda={m} itens={d.porCategoria.map((c) => ({ rotulo: `${c.icone} ${t(c.nome)}`, valor: c.valor }))} />
          </Cartao>
          {!d.prospeccao && (
            <Cartao titulo={t('Onde está cada grama')}>
              <Barras formato="gramas" itens={[
                { rotulo: t('Vendido'), valor: k.gramasVendidas, onClick: () => undefined },
                { rotulo: t('Em estoque'), valor: k.gramasEstoque, onClick: () => ir('estoque') },
                { rotulo: t('Na triagem (compra não entrou)'), valor: k.aguardando },
                { rotulo: t('Perda'), valor: k.perda },
              ].filter((x) => x.valor > 0)} />
            </Cartao>
          )}
        </div>
      </div>
    </div>
  )
}

export function AbaGastos({ d, onNovo }: { d: Dados; onNovo(): void }) {
  const t = useT()
  const { executar } = useComando()
  const [anular, setAnular] = useState<Id>()
  const [aberto, setAberto] = useState<Id>()
  const aberta = d.viagem.status === 'aberta'
  return (
    <Cartao titulo={`${t('Gastos operacionais da viagem')} · ${formatar(d.kpis.gasto, d.moeda)}`} acao={aberta ? <Botao onClick={onNovo}>+ {t('Gasto')}</Botao> : undefined} ajuda="Custo da logística (sai da carteira da viagem). O dinheiro pago pelo cabelo é o capital de compra e fica em Compras.">
      {!d.despesas.length ? <Vazio texto="Nenhum gasto ainda." /> : (
        <ul className="divide-y divide-[var(--borda)]">
          {d.despesas.map((g) => (
            <div key={g.id}>
              <div {...clicavel(() => setAberto(aberto === g.id ? undefined : g.id))} className="cursor-pointer">
                <LinhaGasto g={g} onAnular={aberta ? () => setAnular(g.id) : undefined} />
              </div>
              {aberto === g.id && (
                <div className="pb-2 pl-12 text-sm">
                  {g.moeda !== d.moeda && <p className="num text-xs text-[var(--suave)]">= {formatar(g.valorPrincipal, d.moeda)}</p>}
                  <Anexos donoId={g.id} categorias={['comprovante']} />
                </div>
              )}
            </div>
          ))}
        </ul>
      )}
      {anular && <Confirmar titulo="Anular gasto?" texto="O gasto fica riscado no histórico (nada é apagado)." rotulo="Anular" perigo pedirMotivo onFechar={() => setAnular(undefined)} onConfirmar={(motivo) => executar('anularDespesaViagem', { viagemId: d.viagem.id, despesaId: anular, motivo }, t('Gasto anulado.'))} />}
    </Cartao>
  )
}

export function AbaCompras({ d }: { d: Dados }) {
  const t = useT()
  const { ir } = useApp()
  const { executar, ocupado } = useComando()
  const [vincular, setVincular] = useState(false)
  const [todas, setTodas] = useState(false)
  const [marcadas, setMarcadas] = useState<Id[]>([])
  const [tirar, setTirar] = useState<Id>()
  // ligar e tirar valem com a viagem aberta OU encerrada (o rateio do gasto é refeito sozinho)
  const [conferir, setConferir] = useState(false)
  const lista = d.candidatas.filter((c) => todas || c.sugerida)
  const marcadasDados = d.candidatas.filter((c) => marcadas.includes(c.id))
  const quem = [...new Set(marcadasDados.map((c) => c.comprador).filter(Boolean))]
  const datas = marcadasDados.map((c) => c.data).sort()
  return (
    <Cartao
      titulo={`${t('Capital de compra')} · ${formatar(d.kpis.custoCabelo, d.moeda)}`}
      ajuda="Compras feitas na viagem (vários lugares e fornecedores). O que se pagou por elas é o capital de compra; os gastos de logística ficam em Gastos."
      acao={<Botao variante="secundario" onClick={() => (setMarcadas(d.candidatas.filter((c) => c.sugerida).map((c) => c.id)), setVincular(true))}>✈️ {t('Ligar compras')}</Botao>}
    >
      {!d.compras.length ? <Vazio texto="Nenhuma compra ligada. Viagem sem compra conta como prospecção." /> : (
        <ul className="divide-y divide-[var(--borda)] text-sm">
          {d.compras.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
              <button type="button" onClick={() => ir('pedido', { id: c.id })} className="min-h-10 min-w-0 flex-1 text-left hover:underline">
                <b>{c.codigo}</b> · {c.fornecedor ?? t('Sem fornecedor')}
                <span className="block text-xs text-[var(--suave)]">{dataBR(c.data)}{c.comprador ? ` · ${t('comprou')}: ${c.comprador}` : ''}{!c.noEstoque ? ` · ${t('ainda na triagem')}` : ''}</span>
              </button>
              <span className="num shrink-0 text-right">
                {gramasTexto(c.gramas)} · <b>{formatar(c.valor, d.moeda)}</b>
                <span className="block text-xs text-[var(--suave)]">{t('pago')} {formatar(c.pago, d.moeda)}</span>
              </span>
              <Botao variante="leve" onClick={() => setTirar(c.id)}>{t('tirar')}</Botao>
            </li>
          ))}
        </ul>
      )}
      <Janela aberta={vincular && !conferir} titulo={t('Ligar compras a {v}', { v: d.viagem.codigo })} onFechar={() => setVincular(false)} larga rodape={
        <div className="space-y-2">
          {/* o que está marcado, num resumo (as sugeridas já vêm marcadas: a pessoa vê antes de ligar) */}
          {marcadas.length > 0 && <p className="num text-sm text-[var(--suave)]">{t('{n} marcada(s)', { n: marcadas.length })}{quem.length ? ` · ${t('de')} ${quem.join(', ')}` : ''}{datas.length ? ` · ${dataBR(datas[0])}${datas.length > 1 && datas[datas.length - 1] !== datas[0] ? ` – ${dataBR(datas[datas.length - 1])}` : ''}` : ''}</p>}
          <Botao grande className="w-full" disabled={ocupado || !marcadas.length} onClick={() => setConferir(true)}>{t('Conferir e ligar {n} compra(s)', { n: marcadas.length })} →</Botao>
        </div>
      }>
        <p className="mb-2 text-sm text-[var(--suave)]">{t('Sugeridas: compras no período da viagem feitas (ou registradas) por quem viajou.')}</p>
        <label className="mb-2 flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> {t('Mostrar todas as compras sem viagem')}</label>
        {!lista.length ? <Vazio texto="Nenhuma compra sugerida." /> : (
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {lista.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
                  <input type="checkbox" checked={marcadas.includes(c.id)} onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, c.id] : marcadas.filter((x) => x !== c.id))} />
                  <span className="min-w-0 flex-1"><b>{c.codigo}</b> · {c.fornecedor ?? t('Sem fornecedor')} {c.sugerida && <Pilula tom="marca">{t('sugerida')}</Pilula>}<span className="block text-xs text-[var(--suave)]">{dataBR(c.data)}{c.comprador ? ` · ${c.comprador}` : ''}</span></span>
                  <span className="num shrink-0">{gramasTexto(c.gramas)} · {formatar(c.valor, d.moeda)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Janela>
      {vincular && conferir && <LigarCompras compraIds={marcadas} viagemId={d.viagem.id} onFechar={() => (setConferir(false), setVincular(false))} />}
      {tirar && <Confirmar titulo="Tirar a compra da viagem?" texto="A compra continua existindo: só deixa de contar no resultado desta viagem. Se o gasto já estava no custo dos pacotes, ele é dividido de novo sozinho." rotulo="Tirar" onFechar={() => setTirar(undefined)} onConfirmar={() => executar('desvincularCompra', { viagemId: d.viagem.id, compraId: tirar }, t('Compra tirada da viagem.'))} />}
    </Cartao>
  )
}

export function AbaRateio({ d }: { d: Dados }) {
  const t = useT()
  const { ir } = useApp()
  const { executar, ocupado } = useComando()
  const [confirmar, setConfirmar] = useState(false)
  const v = d.viagem
  const m = d.moeda
  const mudarRateio = (rateio: 'grama' | 'valor') => executar('salvarViagem', { id: v.id, nome: v.nome, destino: v.destino, naBolivia: v.naBolivia, viajantes: v.viajantes, inicio: v.inicio, fim: v.fim, orcamento: v.orcamento, orcamentoCompra: v.orcamentoCompra, rateio, obs: v.obs, versaoBase: v.versao }, t('Rateio mudado.'))
  if (d.prospeccao) return <Vazio texto="Sem compra na viagem: não há o que ratear." />
  return (
    <div className="space-y-3">
      <Cartao titulo={t('Gasto da viagem dividido pelas compras')} ajuda="Cada compra leva uma parte do gasto da viagem: pelas gramas (todas iguais por grama) ou pelo valor (o cabelo mais caro leva mais). Custo/kg real = (valor + parte) ÷ kg.">
        <div className="mb-3 max-w-sm">
          <Escolha<'grama' | 'valor'> valor={v.rateio} onChange={(x) => !v.incorporacao && x !== v.rateio && mudarRateio(x)} opcoes={[{ id: 'grama', nome: 'Por gramas' }, { id: 'valor', nome: 'Por valor' }]} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-[var(--suave)]">
              <tr><th className="py-1">{t('Compra')}</th><th className="py-1 text-right">{t('Gramas')}</th><th className="py-1 text-right">{t('Valor')}</th><th className="py-1 text-right">{t('Parte do gasto')}</th><th className="py-1 text-right">{t('Custo/kg')}</th><th className="py-1 text-right">{t('Custo/kg real')}</th></tr>
            </thead>
            <tbody>
              {d.compras.map((c) => (
                <tr key={c.id} className="border-t border-[var(--borda)]">
                  <td className="py-1.5"><button type="button" className="text-left font-semibold text-[var(--marca)] hover:underline" onClick={() => ir('pedido', { id: c.id })}>{c.codigo}</button> <span className="text-xs text-[var(--suave)]">{c.fornecedor}</span></td>
                  <td className="num py-1.5 text-right">{gramasTexto(c.gramas)}</td>
                  <td className="num py-1.5 text-right">{formatar(c.valor, m)}</td>
                  <td className="num py-1.5 text-right">{formatar(c.parte, m)}</td>
                  <td className="num py-1.5 text-right">{formatar(c.custoKg, m)}</td>
                  <td className="num py-1.5 text-right font-bold">{formatar(c.custoKgReal, m)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--borda)] font-bold">
                <td className="py-1.5">{t('Total')}</td>
                <td className="num py-1.5 text-right">{gramasTexto(d.kpis.gramas)}</td>
                <td className="num py-1.5 text-right">{formatar(d.kpis.custoCabelo, m)}</td>
                <td className="num py-1.5 text-right">{formatar(d.kpis.gasto, m)}</td>
                <td className="num py-1.5 text-right">{d.kpis.custoKg !== undefined ? formatar(d.kpis.custoKg, m) : '—'}</td>
                <td className="num py-1.5 text-right">{d.kpis.custoKgReal !== undefined ? formatar(d.kpis.custoKgReal, m) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Cartao>
      <Cartao titulo={t('Incorporar ao custo dos lotes')} ajuda="Soma a cada lote em estoque a parte do gasto que cabe a ele. Daí em diante a triagem, a margem e o lucro das vendas já contam com a logística. O que já foi vendido não muda (fica como gasto realizado). Reabrir a viagem desfaz.">
        {v.incorporacao ? (
          <>
            <p className="mb-2 text-sm"><Pilula tom="bom">✓ {t('Incorporado')}</Pilula> {dataBR(v.incorporacao.em)} · {v.incorporacao.porNome} · <b className="num">{formatar(v.incorporacao.total, m)}</b></p>
            <TabelaLotes linhas={v.incorporacao.lotes.map((l) => ({ id: l.itemId, codigo: l.codigo, gramas: l.gramas, extra: l.extra, antes: Math.round((l.antes * 1000) / Math.max(1, l.inicial)), depois: Math.round((l.depois * 1000) / Math.max(1, l.inicial)) }))} moeda={m} />
          </>
        ) : (
          <>
            <p className="mb-2 text-sm">
              {t('Vai para os lotes')}: <b className="num">{formatar(d.incorporacao.incorporavel, m)}</b> · {t('já realizado (vendido/perda)')}: <span className="num">{formatar(d.incorporacao.realizado, m)}</span>
            </p>
            {!d.incorporacao.lotes.length ? <Vazio compacto texto="Nenhum lote desta viagem em estoque." /> : (
              <TabelaLotes linhas={d.incorporacao.lotes.map((l) => ({ id: l.itemId, codigo: l.codigo, gramas: l.saldo, extra: l.extra, antes: l.custoKgAtual, depois: l.custoKgNovo }))} moeda={m} />
            )}
            {v.status !== 'encerrada' ? (
              <p className="mt-2 text-sm text-[var(--suave)]">{t('Encerre a viagem (Prestação de contas) para incorporar.')}</p>
            ) : (
              <Botao className="mt-3" disabled={ocupado || !d.incorporacao.incorporavel} onClick={() => setConfirmar(true)}>{t('Incorporar ao custo dos lotes')}</Botao>
            )}
          </>
        )}
      </Cartao>
      {confirmar && <Confirmar titulo="Incorporar ao custo dos lotes?" texto={t('{v} entra no custo de {n} lote(s). Fica no histórico com o antes → depois de cada lote; reabrir a viagem desfaz.', { v: formatar(d.incorporacao.incorporavel, m), n: d.incorporacao.lotes.filter((l) => l.extra > 0).length })} rotulo="Incorporar" onFechar={() => setConfirmar(false)} onConfirmar={() => executar('incorporarCustoViagem', { viagemId: v.id }, t('Gasto somado ao custo dos lotes.'))} />}
    </div>
  )
}

function TabelaLotes({ linhas, moeda }: { linhas: { id: Id; codigo?: string; gramas: number; extra: number; antes: number; depois: number }[]; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead className="text-left text-xs text-[var(--suave)]">
          <tr><th className="py-1">{t('Lote')}</th><th className="py-1 text-right">{t('Em estoque')}</th><th className="py-1 text-right">{t('Soma ao custo')}</th><th className="py-1 text-right">{t('Custo/kg antes')}</th><th className="py-1 text-right">{t('Custo/kg depois')}</th></tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-t border-[var(--borda)]">
              <td className="py-1.5"><button type="button" className="font-semibold text-[var(--marca)] hover:underline" onClick={() => ir('lote', { id: l.id })}>{l.codigo ?? l.id.slice(-4)}</button></td>
              <td className="num py-1.5 text-right">{gramasTexto(l.gramas)}</td>
              <td className="num py-1.5 text-right">{formatar(l.extra, moeda)}</td>
              <td className="num py-1.5 text-right">{formatar(l.antes, moeda)}</td>
              <td className="num py-1.5 text-right font-bold">{formatar(l.depois, moeda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AbaContas({ d, onAdiantar }: { d: Dados; onAdiantar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const v = d.viagem
  const aberta = v.status === 'aberta'
  const [contado, setContado] = useState<Record<string, number | undefined>>(() => Object.fromEntries(d.carteira.map((c) => [c.moeda, Math.max(0, c.saldo)])))
  const [forma, setForma] = useState('dinheiro')
  const [reembolsar, setReembolsar] = useState(true)
  const [incorporar, setIncorporar] = useState(!d.prospeccao)
  const [fim, setFim] = useState(v.fim ?? dataLocal())
  const [obs, setObs] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [reabrir, setReabrir] = useState(false)
  const temNegativo = d.carteira.some((c) => c.saldo < 0)
  const nomeForma = new Map((cfg?.formas ?? []).map((f) => [f.id, f.nome]))
  return (
    <div className="space-y-3">
      <Cartao titulo={t('Carteira da viagem')} acao={aberta ? <Botao variante="secundario" onClick={onAdiantar}>+ {t('Adiantamento')}</Botao> : undefined} ajuda="Adiantamento sai do caixa da loja e vai para a carteira da viagem; os gastos saem da carteira. Na prestação de contas a sobra volta ao caixa.">
        <CarteiraViagem carteira={d.carteira} />
        {!!d.caixa.length && (
          <ul className="mt-3 divide-y divide-[var(--borda)] text-sm">
            {d.caixa.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-1.5">
                <span className={cx('min-w-0', m.estornadoPor && 'line-through opacity-60')}>{m.descricao} <span className="text-xs text-[var(--suave)]">{dataBR(m.data)} · {t(nomeForma.get(m.forma) ?? m.forma)}</span></span>
                {/* aqui é a carteira DA VIAGEM: o que saiu do caixa da loja entrou nela (+), o que voltou ao caixa saiu dela (−) */}
                <span className={cx('num shrink-0 text-right font-semibold', m.delta < 0 ? 'text-[var(--bom)]' : 'text-[var(--texto)]')}>
                  {m.delta < 0 ? '+' : '−'}{formatar(Math.abs(m.delta), m.moeda)}
                  <span className="block text-[11px] font-normal text-[var(--suave)]">{t(m.delta < 0 ? 'levou' : 'voltou ao caixa')}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {aberta ? (
        <div id="prestacao" className="scroll-mt-4"><Cartao titulo={t('Prestação de contas (encerrar a viagem)')}>
          <div className="space-y-3">
            {!d.carteira.length && <p className="text-sm text-[var(--suave)]">{t('Sem adiantamento nem gasto: é só encerrar.')}</p>}
            {d.carteira.map((c) => (
              <Campo key={c.moeda} rotulo={`${t('Dinheiro que voltou')} (${c.moeda})`} comoDiv ajuda="Conte o dinheiro que sobrou e digite. Ele volta ao caixa da loja. A diferença para o esperado fica registrada.">
                <ValorInput moeda={c.moeda} valor={contado[c.moeda]} onChange={(x) => setContado({ ...contado, [c.moeda]: x })} />
                <p className="num mt-1 text-xs text-[var(--suave)]">
                  {t('Esperado')}: {formatar(Math.max(0, c.saldo), c.moeda)}
                  {(contado[c.moeda] ?? 0) !== Math.max(0, c.saldo) && c.saldo >= 0 && <b className={(contado[c.moeda] ?? 0) < c.saldo ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}> · {(contado[c.moeda] ?? 0) < c.saldo ? t('faltam') : t('sobram')} {formatar(Math.abs((contado[c.moeda] ?? 0) - c.saldo), c.moeda)}</b>}
                  {c.saldo < 0 && <b className="text-[var(--ruim)]"> · {t('pagou do bolso')} {formatar(-c.saldo, c.moeda)}</b>}
                </p>
              </Campo>
            ))}
            {!!d.carteira.length && <Campo rotulo="Volta ao caixa como"><Selecao valor={forma} onChange={setForma} opcoes={formasEmUso(cfg?.formas).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>}
            {temNegativo && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={reembolsar} onChange={(e) => setReembolsar(e.target.checked)} /> {t('Reembolsar quem pagou do bolso (sai do caixa)')}</label>}
            {!d.prospeccao && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={incorporar} onChange={(e) => setIncorporar(e.target.checked)} /> {t('Incorporar o gasto ao custo dos lotes em estoque')}</label>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo rotulo="Volta (data)"><Entrada type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
              <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
            </div>
            <Botao grande className="w-full" disabled={ocupado} onClick={() => setConfirmar(true)}>{t('Encerrar a viagem')}</Botao>
          </div>
        </Cartao></div>
      ) : (
        <Cartao titulo={t('Prestação de contas')}>
          <p className="text-sm">✓ {t('Encerrada em {d} por {p}.', { d: dataBR(v.encerramento?.em), p: v.encerramento?.porNome ?? '' })}{v.encerramento?.obs ? ` · ${v.encerramento.obs}` : ''}</p>
          <ul className="mt-2 text-sm">
            {v.carteira.filter((m) => m.tipo === 'diferenca' && !m.anulada).map((m) => (
              <li key={m.id} className={cx('num', m.delta < 0 ? 'text-[var(--ruim)]' : '')}>⚠️ {t(m.obs ?? 'Diferença')}: {formatar(Math.abs(m.delta), m.moeda)}</li>
            ))}
          </ul>
          <Botao variante="secundario" className="mt-3" onClick={() => setReabrir(true)}>{t('Reabrir a viagem')}</Botao>
        </Cartao>
      )}
      {confirmar && (
        <Confirmar
          titulo="Encerrar a viagem?"
          texto={t('O dinheiro contado volta ao caixa de hoje e a diferença fica registrada. Depois de encerrada, ninguém lança gasto (dá para reabrir).')}
          rotulo="Encerrar"
          onFechar={() => setConfirmar(false)}
          onConfirmar={() => executar('encerrarViagem', { viagemId: v.id, contado: Object.fromEntries(Object.entries(contado).map(([k, x]) => [k, x ?? 0])), forma, reembolsar, incorporar: incorporar && !d.prospeccao && d.incorporacao.incorporavel > 0, fim, obs }, t('Viagem encerrada.'))}
        />
      )}
      {reabrir && <Confirmar titulo="Reabrir a viagem?" texto="O custo somado aos lotes é desfeito e a diferença é anulada. O dinheiro já devolvido ao caixa fica como está." rotulo="Reabrir" pedirMotivo onFechar={() => setReabrir(false)} onConfirmar={(motivo) => executar('reabrirViagem', { viagemId: v.id, motivo }, t('Viagem reaberta.'))} />}
      <AvisoNoAparelho />
    </div>
  )
}
