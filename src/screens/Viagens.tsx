// VIAGENS DE COMPRA (#/viagens e #/viagens/:id): a lista/histórico com o resultado de cada viagem, a comparação por
// viajante e a ficha da viagem (Resumo/DRE · Gastos · Compras · Rateio · Prestação de contas).
// Funcionária que viaja vê só o painel do viajante (lança os gastos dela; sem custos nem resultado).

import { useState } from 'react'
import { Trilha } from '../ui/trilha'
import { CabecalhoFicha } from '../ui/cabecalhoFicha'
import { BarraFiltros, ChipsFiltros, PainelFiltros, GrupoFiltro } from '../ui/filtroPadrao'
import { CodigoTexto } from '../ui/codigos'
import { BarraLimite } from '../ui/barras'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, Viagem } from '../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, Confirmar, Entrada, ErroTela, Escolha, Info, Janela, Pagina, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, gramasTexto, pctBp } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { Anexos, clicavel, useCotacoes } from '../ui/compartilhados'
import { Barras } from '../ui/graficos'
import { useT } from '../ui/i18n'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { NumeroGrande, NumeroPequeno } from '../ui/numeroGrande'
import { MenuAcoes } from '../ui/menuAcoes'
import { Passo } from '../ui/passoAPasso'
import { AvisoNoAparelho, BarraOrcamento, CarteiraViagem, FolhaDespesa, LinhaGasto, PainelViajante } from '../ui/viagem'

const TOM_STATUS = { aberta: 'marca', encerrada: 'neutro' } as const
const NOME_STATUS = { aberta: 'Aberta', encerrada: 'Encerrada' } as const
/** "Por viajante" (quem compra mais barato): desligado por enquanto — a aba aparece "em breve" */
const COMPARATIVO_LIGADO = false as boolean

// ---------- lista ----------

export function Viagens() {
  const { sessao } = useApp()
  return sessao.perfil === 'admin' ? <ViagensAdmin /> : <MinhaViagem />
}

/** Funcionária: o painel da viagem aberta e as viagens dela (sem custos). */
function MinhaViagem() {
  const t = useT()
  const { dados } = useConsulta('viagens', {})
  return (
    <div className="mx-auto max-w-2xl">
      <Titulo subtitulo={t('Lance cada gasto na hora: leva segundos e funciona sem internet.')}>{t('Minha viagem')}</Titulo>
      <PainelViajante />
      {!!dados?.linhas.length && (
        <Cartao titulo={t('Minhas viagens')} className="mt-3">
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {dados.linhas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0"><b>{v.codigo}</b> · {v.nome} <span className="text-xs text-[var(--suave)]">{dataBR(v.inicio)}{v.fim ? ` – ${dataBR(v.fim)}` : ''}</span></span>
                <span className="num flex items-center gap-2">{gramasTexto(v.gramas)} · {formatar(v.gasto, v.moeda)} <Pilula tom={TOM_STATUS[v.status]}>{t(NOME_STATUS[v.status])}</Pilula></span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  )
}

function ViagensAdmin() {
  const t = useT()
  const { ir } = useApp()
  const [aba, setAba] = useParamTela<'lista' | 'viajante' | 'comparar'>('aba', 'lista')
  const [status, setStatus] = useParamTela<'' | 'aberta' | 'encerrada'>('status', '')
  const [viajanteId, setViajante] = useParamTela('viajante', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [verFiltros, setVerFiltros] = useState(false)
  const { dados } = useConsulta('viagens', { status: status || undefined, viajanteId: viajanteId || undefined, busca: busca || undefined })
  const { dados: painel } = useConsulta('painelViajante', {})
  // contagem de abertas/encerradas sem o filtro de situação (os números grandes não somem ao filtrar)
  const { dados: semStatus } = useConsulta('viagens', { viajanteId: viajanteId || undefined, busca: busca || undefined })
  const todasViagens = semStatus?.linhas
  const [folha, setFolha] = useState<Id>()
  const abertas = painel?.abertas ?? []
  return (
    <div>
      <Titulo subtitulo={t('Gastos, compras e resultado de cada viagem de compra.')} acao={<Botao onClick={() => ir('novaViagem')}>+ {t('Nova viagem')}</Botao>}>{t('Viagens de compra')}</Titulo>
      {/* no Painel do viajante o cartão "Em viagem" seria repetido: some */}
      {abertas.length > 0 && aba !== 'viajante' && (
        <ul className="mb-4 grid gap-2 md:grid-cols-2">
          {abertas.map((v) => (
            <li key={v.id} className="flex items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-3">
              <button type="button" onClick={() => ir('viagem', { id: v.id })} className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-semibold text-[var(--marca)]">✈️ {t('Em viagem')} · {v.codigo}</span>
                <span className="block truncate font-semibold">{v.nome}</span>
              </button>
              <Botao variante="secundario" className="shrink-0 px-3" onClick={() => setFolha(v.id)}>⛽ {t('Gasto')}</Botao>
            </li>
          ))}
        </ul>
      )}
      {/* "Por viajante" (comparativo) fica desativado por enquanto: a ideia está guardada, volta depois */}
      <Abas atual={aba === 'comparar' ? 'lista' : aba} onChange={(x) => setAba(x as typeof aba)} abas={[{ id: 'lista', nome: 'Viagens' }, { id: 'viajante', nome: 'Painel do viajante' }, { id: 'comparar', nome: 'Por viajante', desativada: true }]} />
      {aba === 'viajante' ? (
        <div className="mx-auto max-w-2xl"><PainelViajante /></div>
      ) : (
        <>
          {/* NÚMEROS GRANDES (padrão): tocar em Abertas/Encerradas filtra; gasto e resultado somam o que está na lista */}
          {aba === 'lista' && todasViagens && (
            <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <NumeroGrande rotulo="Abertas" icone="✈️" cor="var(--marca)" valor={String(todasViagens.filter((v) => v.status === 'aberta').length)} ativo={status === 'aberta'} onClick={() => setStatus(status === 'aberta' ? '' : 'aberta')} selos={todasViagens.some((v) => v.status === 'aberta' && v.acimaOrcamento) ? [{ texto: t('acima do orçamento'), tom: 'ruim' }] : [{ texto: t('em andamento'), tom: 'marca' }]} />
              <NumeroGrande rotulo="Encerradas" icone="🏁" cor="var(--suave)" valor={String(todasViagens.filter((v) => v.status === 'encerrada').length)} ativo={status === 'encerrada'} onClick={() => setStatus(status === 'encerrada' ? '' : 'encerrada')} />
              <NumeroGrande rotulo="Gastos" icone="⛽" cor="var(--alerta)" valor={formatar((dados?.linhas ?? []).reduce((s, v) => s + v.gasto, 0), dados?.moeda ?? 'BOB')} selos={[{ texto: gramasTexto((dados?.linhas ?? []).reduce((s, v) => s + v.gramas, 0)) }]} />
              <NumeroGrande rotulo="Resultado" icone="📈" cor={(dados?.linhas ?? []).reduce((s, v) => s + v.resultado, 0) < 0 ? 'var(--ruim)' : 'var(--bom)'} colorirValor valor={formatar((dados?.linhas ?? []).reduce((s, v) => s + v.resultado, 0), dados?.moeda ?? 'BOB')} />
            </div>
          )}
          <div className="mb-3 space-y-2">
            <BarraFiltros busca={busca} onBusca={setBusca} placeholder="Buscar código, nome, destino ou viajante" ativos={viajanteId ? 1 : 0} aberto={verFiltros} onAlternar={() => setVerFiltros(!verFiltros)} />
            <ChipsFiltros itens={viajanteId ? [{ k: 'viajante', rotulo: `👤 ${(dados?.viajantesPossiveis ?? []).find((x) => x.id === viajanteId)?.nome ?? viajanteId}` }] : []} onTirar={() => setViajante('')} onLimpar={() => setViajante('')} />
            {verFiltros && (
              <PainelFiltros resultados={dados?.linhas.length} temAtivos={!!viajanteId} onLimpar={() => setViajante('')} onFechar={() => setVerFiltros(false)}>
                <GrupoFiltro titulo="Quem" icone="👤">
                  <Campo rotulo="Quem viajou"><Selecao valor={viajanteId} onChange={setViajante} vazio="Todos" opcoes={dados?.viajantesPossiveis ?? []} /></Campo>
                </GrupoFiltro>
              </PainelFiltros>
            )}
          </div>
          {!dados ? <Carregando /> : COMPARATIVO_LIGADO && aba === 'comparar' ? <Comparativo linhas={dados.comparativo} moeda={dados.moeda} /> : !dados.linhas.length ? (
            <Vazio texto="Nenhuma viagem por aqui."><Botao variante="secundario" onClick={() => ir('novaViagem')}>+ {t('Nova viagem')}</Botao></Vazio>
          ) : (
            <ListaViagens linhas={dados.linhas} />
          )}
        </>
      )}
      {folha && painel && <FolhaDespesa aberta onFechar={() => setFolha(undefined)} viagemId={folha} categorias={painel.categorias} moedas={painel.moedas} moedaPadrao={painel.moeda} />}
    </div>
  )
}

type LinhaLista = NonNullable<ReturnType<typeof useConsulta<'viagens'>>['dados']>['linhas'][number]

/**
 * LISTA DAS VIAGENS (bateu o olho, entendeu): um cartão por viagem, igual no celular e no computador —
 * cabeçalho (código, nome, destino, situação), quem foi e quando, a barra do orçamento e 4 blocos
 * (Gastos · Comprou · Custo/kg real · Resultado). Prospecção (sem compra) diz isso em vez de "−Bs".
 */
function ListaViagens({ linhas }: { linhas: LinhaLista[] }) {
  const t = useT()
  const { ir } = useApp()
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {linhas.map((v) => {
        const usoOrc = v.orcamento ? Math.min(100, Math.round((v.gasto * 100) / v.orcamento)) : undefined
        const aberta = v.status === 'aberta'
        return (
          <li key={v.id}>
            <button type="button" onClick={() => ir('viagem', { id: v.id })} className={cx('flex h-full w-full flex-col gap-3 rounded-2xl border bg-[var(--cartao)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', aberta ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
              <div className="flex items-start gap-3">
                <span aria-hidden className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl', aberta ? 'bg-[var(--marca-suave)]' : 'bg-[var(--fundo)]')}>{aberta ? '✈️' : '🏁'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <CodigoTexto codigo={v.codigo} className="text-sm" />
                    <Pilula tom={TOM_STATUS[v.status]}>{t(NOME_STATUS[v.status])}</Pilula>
                    {v.prospeccao && <Pilula>{t('prospecção')}</Pilula>}
                  </span>
                  <b className="mt-0.5 block text-base leading-tight [overflow-wrap:anywhere]">{v.nome}</b>
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

function Comparativo({ linhas, moeda }: { linhas: NonNullable<ReturnType<typeof useConsulta<'viagens'>>['dados']>['comparativo']; moeda: string }) {
  const t = useT()
  if (!linhas.length) return <Vazio texto="Nenhuma viagem por aqui." />
  return (
    <div>
      <p className="mb-2 flex items-center text-sm text-[var(--suave)]">
        {t('Quem compra mais barato (custo por kg com a logística) e com melhor retorno.')}
        <Info texto="Custo/kg real = (cabelo + gastos da viagem) ÷ kg comprados. ROI médio = média do retorno das viagens com compra. Viagem com várias pessoas conta para cada uma. Ex.: Bs 14.800 por 4 kg = Bs 3.700/kg." />
      </p>
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {linhas.map((x, k) => (
          <li key={x.id} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
            <div className="flex items-center justify-between gap-2">
              <b>{k === 0 && x.custoKgReal !== undefined ? '🏆 ' : ''}{x.nome}</b>
              <span className="text-xs text-[var(--suave)]">{t('{n} viagem(ns)', { n: x.viagens })}{x.prospeccao ? ` · ${t('{n} sem compra', { n: x.prospeccao })}` : ''}</span>
            </div>
            <div className="num mt-2 grid grid-cols-2 gap-2 text-sm">
              <span>{t('Custo/kg real')}<br /><b className="text-lg">{x.custoKgReal !== undefined ? formatar(x.custoKgReal, moeda) : '—'}</b></span>
              <span>{t('ROI médio')}<br /><b className={cx('text-lg', (x.roiMedioBp ?? 0) < 0 && 'text-[var(--ruim)]')}>{pctBp(x.roiMedioBp)}</b></span>
              <span>{t('Logística por kg')}<br /><b>{x.gastoKg !== undefined ? formatar(x.gastoKg, moeda) : '—'}</b></span>
              <span>{t('Comprou')}<br /><b>{gramasTexto(x.gramas)}</b></span>
              <span>{t('Gastos')}<br /><b>{formatar(x.gasto, moeda)}</b></span>
              <span>{t('Resultado')}<br /><b className={x.resultado < 0 ? 'text-[var(--ruim)]' : ''}>{formatar(x.resultado, moeda)}</b></span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- criar / editar ----------

/** Tela (não janela): #/viagens/nova e #/viagens/nova?editar=VG1 */
export function NovaViagemTela() {
  const { nav, voltar } = useApp()
  const editar = nav.params.editar as Id | undefined
  const { dados, erro } = useConsulta('viagem', { id: editar ?? '' }, !!editar)
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (editar && !dados) return <Carregando />
  return <FormViagem key={editar ?? 'nova'} viagem={dados?.viagem as Viagem | undefined} />
}

function FormViagem({ viagem }: { viagem?: Viagem }) {
  const t = useT()
  const { ir, voltar, marcarSujo } = useApp()
  const { executar, ocupado } = useComando()
  const { dados } = useConsulta('viagens', {})
  const { cfg } = useCotacoes()
  const moeda = cfg?.moedaPrincipal ?? 'BOB'
  const [id] = useState(() => viagem?.id ?? novoId())
  const [nome, setNome] = useState(viagem?.nome ?? '')
  const [destino, setDestino] = useState(viagem?.destino ?? '')
  const [viajantes, setViajantes] = useState<Id[]>(viagem?.viajantes ?? [])
  const [inicio, setInicio] = useState(viagem?.inicio ?? dataLocal())
  const [fim, setFim] = useState(viagem?.fim ?? '')
  const [orcamento, setOrcamento] = useState<number | undefined>(viagem?.orcamento)
  const [orcamentoCompra, setOrcamentoCompra] = useState<number | undefined>(viagem?.orcamentoCompra)
  const [rateio, setRateio] = useState<'grama' | 'valor'>(viagem?.rateio ?? 'grama')
  const [obs, setObs] = useState(viagem?.obs ?? '')
  useAvisoSaida(!viagem && !ocupado && (!!nome || viajantes.length > 0))
  const salvar = async () => {
    const r = await executar('salvarViagem', { id, nome, destino, viajantes, inicio, fim: fim || undefined, orcamento, orcamentoCompra, rateio, obs }, t(viagem ? 'Viagem salva.' : 'Viagem criada.'))
    if (!r) return
    marcarSujo(false)
    if (viagem) voltar()
    else ir('viagem', { id: r.id })
  }
  const pessoas = dados?.viajantesPossiveis ?? []
  // PASSO A PASSO (como Separar e Nova compra): 1 Para onde · 2 Quem vai · 3 Quanto pode gastar · 4 Como dividir
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set([1]))
  const alternar = (n: number) => setAbertos((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x })
  const ir_ = (n: number) => setAbertos(new Set([n]))
  const dias = inicio && fim && fim >= inicio ? Math.round((new Date(`${fim}T12:00:00`).getTime() - new Date(`${inicio}T12:00:00`).getTime()) / 86400000) + 1 : undefined
  const nomesViajantes = pessoas.filter((p) => viajantes.includes(p.id)).map((p) => p.nome)
  const proximo = (n: number, rotulo: string) => <div className="flex justify-end"><Botao variante="secundario" onClick={() => ir_(n + 1)}>{t('Próximo')}: {t(rotulo)} →</Botao></div>
  const falta = !nome.trim() ? t('o nome da viagem') : !viajantes.length ? t('quem vai') : ''
  return (
    <Pagina titulo={t(viagem ? 'Editar viagem' : 'Nova viagem de compra')} subtitulo={viagem?.codigo} onVoltar={voltar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={salvar}>{falta ? t('Falta: {x}', { x: falta }) : t(viagem ? 'Salvar' : 'Criar viagem')}</Botao>
    }>
      <ol className="mx-auto max-w-2xl space-y-3" aria-label={t('Passos da viagem')}>
        <Passo n={1} de={4} titulo="Para onde e quando" feito={!!nome.trim()} aberto={abertos.has(1)} onAlternar={() => alternar(1)}
          resumo={nome.trim() ? [nome.trim(), destino ? `📍 ${destino}` : '', `📅 ${dataBR(inicio)}${fim ? ` → ${dataBR(fim)}` : ''}${dias ? ` · ${t('{n} dia(s)', { n: dias })}` : ''}`].filter(Boolean).join(' · ') : t('falta o nome')}
          ajuda="Um nome curto para achar a viagem depois, para onde vai e as datas. A volta pode ficar em branco."
          exemplo="Ex.: Feira de Oruro · novembro · Oruro · 02/11 → 07/11 (6 dias)">
          <Campo rotulo="Nome da viagem *"><Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('Ex.: Feira de Oruro · novembro')} autoFocus={!viagem} /></Campo>
          <Campo rotulo="Destino"><Entrada value={destino} onChange={(e) => setDestino(e.target.value)} placeholder={t('Ex.: Oruro')} /></Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Ida"><Entrada type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
            <Campo rotulo="Volta (prevista)"><Entrada type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
          </div>
          {dias !== undefined && <p className="num text-sm font-semibold text-[var(--marca)]">= {t('{n} dia(s)', { n: dias })}</p>}
          {proximo(1, 'Quem vai')}
        </Passo>
        <Passo n={2} de={4} titulo="Quem vai" feito={viajantes.length > 0} aberto={abertos.has(2)} onAlternar={() => alternar(2)}
          resumo={nomesViajantes.length ? `👤 ${nomesViajantes.join(', ')}` : t('ninguém escolhido')}
          ajuda="Quem viaja lança os gastos pelo celular (gasolina, hotel, comida), só nesta viagem, e as compras dela ficam ligadas aqui."
          exemplo="Ex.: Paula e Wagner → os dois lançam gastos e o resultado conta para os dois">
          {!pessoas.length ? <p className="text-sm text-[var(--suave)]">{t('Cadastre a equipe (papel funcionária ou sócia) em Pessoas.')}</p> : (
            <div className="flex flex-wrap gap-2">
              {pessoas.map((p) => {
                const on = viajantes.includes(p.id)
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => setViajantes(on ? viajantes.filter((x) => x !== p.id) : [...viajantes, p.id])} className={cx('min-h-11 rounded-full px-4 text-sm font-semibold', on ? 'bg-[var(--marca)] text-white' : 'bg-[var(--cartao)] text-[var(--marca)] ring-1 ring-[var(--marca)]/40')}>
                    {on ? '✓ ' : ''}{p.nome}
                  </button>
                )
              })}
            </div>
          )}
          {proximo(2, 'Quanto pode gastar')}
        </Passo>
        <Passo n={3} de={4} titulo="Quanto pode gastar" opcional feito={!!orcamento || !!orcamentoCompra} aberto={abertos.has(3)} onAlternar={() => alternar(3)}
          resumo={[orcamento ? `⛽ ${formatar(orcamento, moeda)}` : '', orcamentoCompra ? `💇 ${formatar(orcamentoCompra, moeda)}` : ''].filter(Boolean).join(' · ') || t('sem limite')}
          ajuda="Dois limites, se quiser: o dos gastos da viagem (gasolina, hotel, comida) e o do cabelo. O painel avisa quando passar."
          exemplo="Ex.: gastos até Bs 1.500 · cabelo até Bs 40.000">
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Gastos da viagem (até)"><ValorInput moeda={moeda} valor={orcamento} onChange={setOrcamento} /></Campo>
            <Campo rotulo="Compra de cabelo (até)"><ValorInput moeda={moeda} valor={orcamentoCompra} onChange={setOrcamentoCompra} /></Campo>
          </div>
          {proximo(3, 'Como dividir o gasto')}
        </Passo>
        <Passo n={4} de={4} titulo="Como dividir o gasto" opcional feito aberto={abertos.has(4)} onAlternar={() => alternar(4)}
          resumo={`${t(rateio === 'grama' ? 'Por gramas' : 'Por valor')}${obs.trim() ? ` · “${obs.trim()}”` : ''}`}
          ajuda="No fim, o gasto da viagem vai para o custo do cabelo comprado nela. Por gramas: cada grama leva o mesmo. Por valor: o cabelo mais caro leva mais."
          exemplo="Ex.: Bs 800 de gasto em 4 kg = Bs 200 por kg (por gramas)">
          <Escolha<'grama' | 'valor'> valor={rateio} onChange={setRateio} opcoes={[{ id: 'grama', nome: 'Por gramas' }, { id: 'valor', nome: 'Por valor' }]} />
          <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} placeholder={t('Ex.: levar balança e sacos')} /></Campo>
        </Passo>
      </ol>
    </Pagina>
  )
}

// ---------- ficha ----------

type Dados = NonNullable<ReturnType<typeof useConsulta<'viagem'>>['dados']>

export function FichaViagem() {
  const t = useT()
  const { nav, voltar, ir } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('viagem', { id })
  const [aba, setAba] = useParamTela<'resumo' | 'gastos' | 'compras' | 'rateio' | 'contas' | 'historico'>('aba', 'resumo')
  const [folha, setFolha] = useState(false)
  const [adiantar, setAdiantar] = useState(false)
  const { dados: cfg } = useConsulta('configuracoes', {})
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const v = dados.viagem
  const aberta = v.status === 'aberta'
  return (
    <div className="mx-auto max-w-4xl pb-4">
      <Trilha atual={v.codigo} />
      {/* CABEÇALHO DE FICHA (o mesmo do pacote e do pedido): nome · código + situação · quem/quando/onde · ações */}
      <CabecalhoFicha
        className="mb-3"
        titulo={v.nome}
        codigo={v.codigo}
        selos={<><Pilula tom={TOM_STATUS[v.status]}>{t(NOME_STATUS[v.status])}</Pilula>{dados.acimaOrcamento && <Pilula tom="ruim">{t('Acima do orçamento')}</Pilula>}</>}
        detalhes={[dados.viajantes.map((x) => x.nome).join(', '), `${dataBR(v.inicio)}${v.fim ? ` – ${dataBR(v.fim)}` : ''} · ${dados.kpis.dias} d`, v.destino]}
        acoes={<>
        {aberta ? (
          <>
            <Botao className="min-w-0 flex-1 sm:flex-none sm:px-6" onClick={() => setFolha(true)}>⛽ {t('Gasto')}</Botao>
            <Botao variante="secundario" className="min-w-0 flex-1 sm:flex-none sm:px-6" onClick={() => setAdiantar(true)}>💵 {t('Adiantamento')}</Botao>
            {/* voltou da viagem: a prestação de contas em um toque (antes ficava escondida no fim da aba Contas) */}
            <Botao variante="secundario" className="min-w-0 flex-1 sm:flex-none sm:px-6" onClick={() => { setAba('contas'); setTimeout(() => document.getElementById('prestacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250) }}>🏁 {t('Encerrar')}</Botao>
          </>
        ) : <Botao variante="secundario" className="min-w-0 flex-1 sm:flex-none sm:px-6" onClick={() => ir('novaViagem', { editar: v.id })}>✎ {t('Editar')}</Botao>}
        {aberta && <MenuAcoes comRotulo className="shrink-0" acoes={[{ rotulo: 'Editar viagem', icone: '✎', onClick: () => ir('novaViagem', { editar: v.id }) }]} />}
        </>}
      />
      <Abas variante="sublinhado" atual={aba} onChange={(x) => setAba(x as typeof aba)} abas={[
        { id: 'resumo', nome: 'Resumo' },
        { id: 'gastos', nome: 'Gastos', extra: <span className="text-xs">({dados.despesas.filter((x) => !x.anulada).length})</span> },
        { id: 'compras', nome: 'Compras', extra: <span className="text-xs">({dados.compras.length})</span> },
        { id: 'rateio', nome: 'Rateio' },
        { id: 'contas', nome: 'Contas' },
        { id: 'historico', nome: 'Histórico' },
      ]} />
      {aba === 'resumo' && <AbaResumo d={dados} />}
      {aba === 'gastos' && <AbaGastos d={dados} onNovo={() => setFolha(true)} />}
      {aba === 'compras' && <AbaCompras d={dados} />}
      {aba === 'rateio' && <AbaRateio d={dados} />}
      {aba === 'contas' && <AbaContas d={dados} onAdiantar={() => setAdiantar(true)} />}
      {/* HISTÓRICO numa aba só dele (antes aparecia embaixo de todas as abas) */}
      {aba === 'historico' && <AbaHistorico d={dados} />}
      {folha && <FolhaDespesa aberta onFechar={() => setFolha(false)} viagemId={v.id} categorias={dados.categorias} moedas={cfg?.config.moedasAtivas ?? [dados.moeda]} moedaPadrao={dados.moeda} />}
      {adiantar && <FormAdiantamento viagemId={v.id} onFechar={() => setAdiantar(false)} />}
    </div>
  )
}

/**
 * HISTÓRICO DA VIAGEM: em cima, a vida da viagem em 4 blocos (quando abriu · gastos lançados · dinheiro levado ·
 * compras ligadas) e a situação; embaixo, a linha do tempo completa (cada ação com quem e quando, e o link).
 */
function AbaHistorico({ d }: { d: Dados }) {
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

function AbaResumo({ d }: { d: Dados }) {
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

function AbaGastos({ d, onNovo }: { d: Dados; onNovo(): void }) {
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

function AbaCompras({ d }: { d: Dados }) {
  const t = useT()
  const { ir } = useApp()
  const { executar, ocupado } = useComando()
  const [vincular, setVincular] = useState(false)
  const [todas, setTodas] = useState(false)
  const [marcadas, setMarcadas] = useState<Id[]>([])
  const [tirar, setTirar] = useState<Id>()
  const aberta = d.viagem.status === 'aberta'
  const lista = d.candidatas.filter((c) => todas || c.sugerida)
  return (
    <Cartao
      titulo={`${t('Capital de compra')} · ${formatar(d.kpis.custoCabelo, d.moeda)}`}
      ajuda="Compras feitas na viagem (vários lugares e fornecedores). O que se pagou por elas é o capital de compra; os gastos de logística ficam em Gastos."
      acao={aberta ? <Botao variante="secundario" onClick={() => (setMarcadas(d.candidatas.filter((c) => c.sugerida).map((c) => c.id)), setVincular(true))}>🔗 {t('Vincular compras')}</Botao> : undefined}
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
              {aberta && <Botao variante="leve" onClick={() => setTirar(c.id)}>{t('tirar')}</Botao>}
            </li>
          ))}
        </ul>
      )}
      <Janela aberta={vincular} titulo={t('Vincular compras')} onFechar={() => setVincular(false)} larga rodape={
        <Botao grande className="w-full" disabled={ocupado || !marcadas.length} onClick={async () => {
          const r = await executar('vincularCompras', { viagemId: d.viagem.id, compraIds: marcadas }, t('Compras ligadas à viagem.'))
          if (r) setVincular(false)
        }}>{t('Ligar {n} compra(s)', { n: marcadas.length })}</Botao>
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
      {tirar && <Confirmar titulo="Tirar a compra da viagem?" texto="A compra continua existindo; só deixa de contar no rateio e no resultado desta viagem." rotulo="Tirar" onFechar={() => setTirar(undefined)} onConfirmar={() => executar('desvincularCompra', { viagemId: d.viagem.id, compraId: tirar }, t('Compra tirada da viagem.'))} />}
    </Cartao>
  )
}

function AbaRateio({ d }: { d: Dados }) {
  const t = useT()
  const { ir } = useApp()
  const { executar, ocupado } = useComando()
  const [confirmar, setConfirmar] = useState(false)
  const v = d.viagem
  const m = d.moeda
  const mudarRateio = (rateio: 'grama' | 'valor') => executar('salvarViagem', { id: v.id, nome: v.nome, destino: v.destino, viajantes: v.viajantes, inicio: v.inicio, fim: v.fim, orcamento: v.orcamento, orcamentoCompra: v.orcamentoCompra, rateio, obs: v.obs }, t('Rateio mudado.'))
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

function AbaContas({ d, onAdiantar }: { d: Dados; onAdiantar(): void }) {
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
            {!!d.carteira.length && <Campo rotulo="Volta ao caixa como"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>}
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

function FormAdiantamento({ viagemId, onFechar }: { viagemId: Id; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? 'BOB'
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [obs, setObs] = useState('')
  return (
    <Janela aberta titulo={t('Adiantamento para a viagem')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => {
        const r = await executar('adiantarViagem', { id, viagemId, moeda, forma, valor: valor!, obs }, t('Adiantamento registrado.'))
        if (r) onFechar()
      }}>{t('Dar adiantamento')} {valor ? formatar(valor, moeda) : ''}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm text-[var(--suave)]">{t('Sai do caixa da loja hoje e vai para a carteira da viagem.')}</p>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Selecao valor={moeda} onChange={setMoeda} opcoes={(cfg?.moedasAtivas ?? [moeda]).map((x) => ({ id: x, nome: x }))} />
          <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
        </div>
        <Campo rotulo="Saiu do caixa como"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}

