// VIAGENS DE COMPRA (#/viagens e #/viagens/:id): a lista/histórico com o resultado de cada viagem, a comparação por
// viajante e a ficha da viagem (Resumo/DRE · Gastos · Compras · Rateio · Prestação de contas).
// Funcionária que viaja vê só o painel do viajante (lança os gastos dela; sem custos nem resultado).

import { useState } from 'react'
import { FiltroViagem } from '../../../shared/ui/seloViagem'
import { Trilha } from '../../../shared/ui/trilha'
import { CabecalhoFicha } from '../../../shared/ui/cabecalhoFicha'
import { BarraFiltros, ChipsFiltros, EscolhaVista, PainelFiltros, GrupoFiltro, type Vista } from '../../../shared/ui/filtroPadrao'
import { useLembrado } from '../../../shared/ui/filtros'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id, Viagem } from '../../../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, Confirmar, ErroTela, Info, Pilula, Selecao, Titulo, Vazio, dataBR, gramasTexto } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { NumeroGrande } from '../../../shared/ui/numeroGrande'
import { MenuAcoes } from '../../../shared/ui/menuAcoes'
import { FolhaDespesa, PainelViajante } from '../components/PainelViajante'
import { NOME_STATUS, TOM_STATUS } from '../model/tipos'
import { Comparativo, ListaViagens, TabelaViagens } from '../components/ListaViagens'
import { FormViagem } from '../components/FormViagem'
import { AbaCompras, AbaContas, AbaGastos, AbaHistorico, AbaRateio, AbaResumo } from '../components/abas'
import { FormAdiantamento } from '../components/FormAdiantamento'
import { Paginada } from '../../../shared/ui/paginacao'
import { focarBusca, useAtalhos } from '../hooks/useAtalhos'
import { baixarCSV } from '../../../shared/ui/csv'
import { GuiaPrimeiraViagem } from '../components/GuiaViagem'

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
  // duas vistas (o mesmo seletor dos Preços): CARTÕES (barra do orçamento e números em destaque) ou LISTA (tabela) — lembrada neste aparelho
  const [vista, setVista] = useLembrado<Vista>('viagens.vista', 'cartoes')
  // Por viajante: o filtro padrão de viagem (uma viagem → a comparação conta só ela)
  const [vgComparar, setVgComparar] = useParamTela('vg', '')
  const comparando = aba === 'comparar'
  const { dados } = useConsulta('viagens', { status: status || undefined, viajanteId: viajanteId || undefined, busca: busca || undefined, viagemId: comparando && vgComparar && vgComparar !== 'sem' ? vgComparar : undefined })
  const { dados: painel } = useConsulta('painelViajante', {})
  // contagem de abertas/encerradas sem o filtro de situação (os números grandes não somem ao filtrar)
  const { dados: semStatus } = useConsulta('viagens', { viajanteId: viajanteId || undefined, busca: busca || undefined })
  const todasViagens = semStatus?.linhas
  const [folha, setFolha] = useState<Id>()
  const abertas = painel?.abertas ?? []
  const nova = () => ir('novaViagem')
  // ATALHOS (computador, para quem viaja muito): / busca · Alt+N nova viagem · Alt+G gasto na viagem aberta (a 1ª)
  useAtalhos({ '/': focarBusca, 'alt+n': nova, 'alt+g': () => abertas[0] && setFolha(abertas[0].id) })
  const filtrando = !!(busca || status || viajanteId)
  // AÇÃO EM LOTE: a planilha de TODAS as viagens da lista (com os filtros), não só da página
  const planilha = () => baixarCSV(`viagens-${new Date().toISOString().slice(0, 10)}`, (dados?.linhas ?? []).map((v) => ({
    [t('Código')]: v.codigo, [t('Viagem')]: v.nome, [t('Situação')]: t(NOME_STATUS[v.status]), [t('Destino')]: v.destino ?? '',
    [t('Quem viajou')]: v.viajantes.map((x) => x.nome).join(', '), [t('Início')]: v.inicio, [t('Fim')]: v.fim ?? '', [t('Dias')]: v.dias,
    [t('Orçamento')]: v.orcamento ? v.orcamento / 100 : '', [t('Gastos')]: v.gasto / 100, [t('Comprou (g)')]: v.gramas, [t('Compras')]: v.compras,
    [t('Custo/kg real')]: v.custoKgReal !== undefined ? v.custoKgReal / 100 : '', [t('Resultado')]: v.prospeccao ? '' : v.resultado / 100,
  })))
  const cabecalho = (
    <Titulo
      subtitulo={<>{t('Gastos, compras e resultado de cada viagem de compra.')}{/* teclado só no computador */}<span className="ml-2 hidden items-center text-xs md:inline-flex">⌨ {t('Atalhos')}<Info texto="/ busca · Alt+N nova viagem · Alt+G lança um gasto na viagem aberta." /></span></>}
      acao={<div className="flex items-center gap-2">
        <Botao onClick={nova}>+ {t('Nova viagem')}</Botao>
        <MenuAcoes acoes={[{ icone: '📥', rotulo: 'Baixar planilha', descricao: t('As {n} viagens da lista (com os filtros): gastos, kg, custo/kg real e resultado.', { n: dados?.linhas.length ?? 0 }), onClick: planilha }]} />
      </div>}
    >{t('Viagens de compra')}</Titulo>
  )
  // as viagens abertas e os números chegam juntos: antes disso, só o cabeçalho (nada empurra a tela depois)
  if (!painel || !semStatus) return <div>{cabecalho}<Carregando /></div>
  return (
    <div>
      {cabecalho}
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
      <Abas atual={aba} onChange={(x) => setAba(x as typeof aba)} abas={[{ id: 'lista', nome: 'Viagens' }, { id: 'viajante', nome: 'Painel do viajante' }, { id: 'comparar', nome: 'Por viajante' }]} />
      {aba === 'viajante' ? (
        <div className="mx-auto max-w-2xl"><PainelViajante /></div>
      ) : (
        <>
          {/* NÚMEROS GRANDES (padrão): tocar em Abertas/Encerradas filtra; gasto e resultado somam o que está na lista */}
          {aba === 'lista' && todasViagens && (
            <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <NumeroGrande rotulo="Abertas" icone="✈️" cor="var(--marca)" valor={String(todasViagens.filter((v) => v.status === 'aberta').length)} ativo={status === 'aberta'} onClick={() => setStatus(status === 'aberta' ? '' : 'aberta')} selos={todasViagens.some((v) => v.status === 'aberta' && v.acimaOrcamento) ? [{ texto: t('Acima do orçamento'), tom: 'ruim' }] : [{ texto: t('Em andamento'), tom: 'marca' }]} />
              <NumeroGrande rotulo="Encerradas" icone="🏁" cor="var(--suave)" valor={String(todasViagens.filter((v) => v.status === 'encerrada').length)} ativo={status === 'encerrada'} onClick={() => setStatus(status === 'encerrada' ? '' : 'encerrada')} />
              <NumeroGrande rotulo="Gastos" icone="⛽" cor="var(--alerta)" valor={formatar((dados?.linhas ?? []).reduce((s, v) => s + v.gasto, 0), dados?.moeda ?? 'BOB')} selos={[{ texto: gramasTexto((dados?.linhas ?? []).reduce((s, v) => s + v.gramas, 0)) }]} />
              <NumeroGrande rotulo="Resultado" icone="📈" cor={(dados?.linhas ?? []).reduce((s, v) => s + v.resultado, 0) < 0 ? 'var(--ruim)' : 'var(--bom)'} colorirValor valor={formatar((dados?.linhas ?? []).reduce((s, v) => s + v.resultado, 0), dados?.moeda ?? 'BOB')} />
            </div>
          )}
          <div className="mb-3 space-y-2">
            <BarraFiltros busca={busca} onBusca={setBusca} placeholder="Buscar código, nome, destino ou viajante" ativos={viajanteId ? 1 : 0} aberto={verFiltros} onAlternar={() => setVerFiltros(!verFiltros)}
              extra={comparando ? <FiltroViagem valor={vgComparar === 'sem' ? '' : vgComparar} onChange={(v) => setVgComparar(v === 'sem' ? '' : v)} nasLinhas={(semStatus?.linhas ?? []).map((r) => [{ id: r.id, codigo: r.codigo, nome: r.nome }])} /> : <EscolhaVista vista={vista} onChange={setVista} />} />
            <ChipsFiltros itens={viajanteId ? [{ k: 'viajante', rotulo: `👤 ${(dados?.viajantesPossiveis ?? []).find((x) => x.id === viajanteId)?.nome ?? viajanteId}` }] : []} onTirar={() => setViajante('')} onLimpar={() => setViajante('')} />
            {verFiltros && (
              <PainelFiltros resultados={dados?.linhas.length} temAtivos={!!viajanteId} onLimpar={() => setViajante('')} onFechar={() => setVerFiltros(false)}>
                <GrupoFiltro titulo="Quem" icone="👤">
                  <Campo rotulo="Quem viajou"><Selecao valor={viajanteId} onChange={setViajante} vazio="Todos" opcoes={dados?.viajantesPossiveis ?? []} /></Campo>
                </GrupoFiltro>
              </PainelFiltros>
            )}
          </div>
          {!dados ? <Carregando /> : comparando ? <Comparativo linhas={dados.comparativo} moeda={dados.moeda} uma={vgComparar && vgComparar !== 'sem' ? dados.linhas[0] : undefined} /> : !dados.linhas.length ? (
            filtrando ? <Vazio texto="Nenhuma viagem com esse filtro." /> : <GuiaPrimeiraViagem onNova={nova} />
          ) : (
            <Paginada itens={dados.linhas} unidade="viagem(ns)" reiniciar={String(dados.linhas.length)}>{(pagina) => (vista === 'lista' ? <TabelaViagens linhas={pagina} onGasto={setFolha} /> : <ListaViagens linhas={pagina} />)}</Paginada>
          )}
        </>
      )}
      {folha && painel && <FolhaDespesa aberta onFechar={() => setFolha(undefined)} viagemId={folha} categorias={painel.categorias} moedas={painel.moedas} moedaPadrao={painel.moeda} />}
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

// ---------- ficha ----------

export function FichaViagem() {
  const t = useT()
  const { nav, voltar, ir } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('viagem', { id })
  const [aba, setAba] = useParamTela<'resumo' | 'gastos' | 'compras' | 'rateio' | 'contas' | 'historico'>('aba', 'resumo')
  const [folha, setFolha] = useState(false)
  const [adiantar, setAdiantar] = useState(false)
  const [apagar, setApagar] = useState(false)
  const { executar: executarFicha } = useComando()
  const { dados: cfg } = useConsulta('configuracoes', {})
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const v = dados.viagem
  const aberta = v.status === 'aberta'
  // apagar só viagem vazia (nada fica órfão): o servidor confere de novo
  const impedeApagar = dados.compras.length ? 'Tem compras: tire ou mova as compras antes de apagar.' : dados.despesas.some((x) => !x.anulada) ? 'Tem gastos lançados: anule os gastos antes de apagar.' : v.carteira.some((m) => !m.anulada) ? 'Tem dinheiro adiantado ou devolvido: não dá para apagar.' : ''
  return (
    <div className="mx-auto max-w-4xl pb-4">
      {apagar && (impedeApagar
        ? <Confirmar titulo={t('Não dá para apagar {v}', { v: v.codigo })} texto={impedeApagar} rotulo="Entendi" onFechar={() => setApagar(false)} onConfirmar={() => undefined} />
        : <Confirmar perigo titulo={t('Apagar a viagem {v}?', { v: v.codigo })} texto="Ela não tem compras, gastos nem dinheiro: some das listas e dos filtros. Fica no histórico que foi apagada." rotulo="Apagar" onFechar={() => setApagar(false)} onConfirmar={async () => { if (await executarFicha('apagarViagem', { viagemId: v.id, motivo: 'apagada pela ficha' }, t('Viagem {v} apagada.', { v: v.codigo }))) ir('viagens') }} />)}
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
            <Botao className="flex-1 whitespace-nowrap px-3 sm:flex-none sm:px-6" onClick={() => setFolha(true)}>⛽ {t('Gasto')}</Botao>
            <Botao variante="secundario" className="flex-1 whitespace-nowrap px-3 sm:flex-none sm:px-6" onClick={() => setAdiantar(true)}>💵 {t('Adiantamento')}</Botao>
            {/* voltou da viagem: a prestação de contas em um toque (antes ficava escondida no fim da aba Contas) */}
            <Botao variante="secundario" className="flex-1 whitespace-nowrap px-3 sm:flex-none sm:px-6" onClick={() => { setAba('contas'); setTimeout(() => document.getElementById('prestacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250) }}>🏁 {t('Encerrar')}</Botao>
          </>
        ) : <Botao variante="secundario" className="flex-1 whitespace-nowrap px-3 sm:flex-none sm:px-6" onClick={() => ir('novaViagem', { editar: v.id })}>✎ {t('Editar')}</Botao>}
        <MenuAcoes comRotulo className="shrink-0" acoes={[
          ...(aberta ? [{ rotulo: 'Editar viagem', icone: '✎', onClick: () => ir('novaViagem', { editar: v.id }) }] : []),
          { rotulo: 'Apagar viagem', icone: '🗑', perigo: true, separar: aberta, descricao: impedeApagar ? t(impedeApagar) : t('Ex.: criada repetida por engano. Some das listas e dos filtros.'), onClick: () => setApagar(true) },
        ]} />
        </>}
      />
      <Abas variante="sublinhado" atual={aba} onChange={(x) => setAba(x as typeof aba)} abas={[
        { id: 'resumo', nome: 'Resumo' },
        { id: 'gastos', nome: 'Gastos', extra: <span className="text-xs">({dados.despesas.filter((x) => !x.anulada).length})</span> },
        { id: 'compras', nome: 'Compras', extra: <span className="text-xs">({dados.compras.length})</span> },
        { id: 'rateio', nome: 'Divisão do gasto' },
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
