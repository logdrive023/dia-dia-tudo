// COMPRAR — a alma do negócio.
//  /pedidos           lista em TABELA (ordenável, busca, filtros de situação e pendência) — "Comprar"
//  /pedidos/novo      tela de NOVA COMPRA (formulário + resumo ao lado: total, peso, custo/kg, conta do fornecedor)
//  /pedidos/:id       tela do PEDIDO (etapas, o que falta, itens, pagamento, conta, lotes, arquivos, linha do tempo)
// O cabelo entra na Triagem assim que a compra é registrada ("Aguardando triagem"); as etapas do pedido ficam para o
// pagamento e a entrega (quem fez fica registrado). A conferência de peso é um lançamento no lote, sem mudar o comprado.

import { useState } from 'react'
import { PainelSelecao } from '../../../shared/ui/painelSelecao'
import { FiltroViagem, SeloViagem, passaViagem, viagensDasLinhas } from '../../../shared/ui/seloViagem'
import { LigarCompras } from '../components/LigarCompras'
import { Progresso } from './PagamentoCompra'
import { GrupoVisao, useVisaoLista } from '../../../shared/ui/visaoLista'
import { AreaPaginada, Paginacao, usePaginacao } from '../../../shared/ui/paginacao'
import { TabelaDados, SeloCodigo, SeloSituacao, type TomLista } from '../../../shared/ui/tabelaDados'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Campo, Confirmar, Selecao, cx, dataBR, gramasTexto, moedaPadrao, Titulo } from '../../../shared/ui/base'
import { AcaoIcone } from '../../../shared/ui/acoesPagina'
import { useApp, useParamTela, useComando, useConsulta, useFiltrosTela } from '../../../shared/ui/contexto'
import { FiltroPendencia, SeloPendencias } from '../../../shared/ui/pendencias'
import { useT } from '../../../shared/ui/i18n'
import { NumeroGrande, type Selo, GrupoNumeros } from '../../../shared/ui/numeroGrande'
import { codigoDe } from '../model/pecas'
import { GrupoFiltro, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { ENCERRADAS } from '../model/comum'
import { Pedido } from '../components/Pedido'

/** compra cancelada ou recusada não entra em viagem (nem na seleção para ligar) */
const FORA_VIAGEM = ['recusado', 'cancelado']

type Ordem = 'data' | 'total' | 'parada'

/** A tela Comprar: com ?id= abre a compra (Pedido); sem, a lista. Separados para os hooks da lista rodarem sempre na
 *  mesma ordem (antes o "return <Pedido />" vinha no meio dos hooks da lista). */
export function Comprar() {
  const { nav } = useApp()
  return nav.params.id ? <Pedido /> : <ListaCompras />
}

function ListaCompras() {
  const t = useT()
  const { nav, ir, sessao, ajustarParams } = useApp()
  const { tirar: tirarFiltro } = useFiltrosTela()
  // lista no endereço: voltar do pedido reencontra a mesma aba, filtro, busca e ordem
  const [aba, setAba] = useParamTela<'abertas' | 'encerradas' | 'todas'>('aba', nav.params.encerradas ? 'encerradas' : 'abertas')
  const [pendencia, setPendencia] = useParamTela('pendencia', nav.params.semComprovante ? 'semComprovanteOrigem' : '')
  const [busca, setBusca] = useParamTela('busca', '')
  // VER COMO (padrão das listagens): tabela ou cartões, no ⚙ Filtros
  const vis = useVisaoLista('comprar')
  const [ordemTxt, setOrdemTxt] = useParamTela('ordem', 'data-desc')
  const ordem = { por: ordemTxt.split('-')[0] as Ordem, desc: ordemTxt.endsWith('-desc') }
  const setOrdem = (o: { por: Ordem; desc: boolean }) => setOrdemTxt(`${o.por}-${o.desc ? 'desc' : 'asc'}`)
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: true })
  const { dados: cfg } = useConsulta('configuracoes', {})
  // celular: lista de linhas curtas que abrem no lugar; computador/tablet: a tabela
  const [abertos, setAbertos] = useState<Set<Id>>(new Set())
  const alternarAberto = (id: Id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // SELEÇÃO EM MASSA (admin): marcar várias compras e ligar/mover/tirar de viagem de uma vez (o painel padrão)
  const [sel, setSel] = useState<Set<Id>>(new Set())
  const [ligarSel, setLigarSel] = useState(false)
  const [tirarSel, setTirarSel] = useState(false)
  const { executar: executarLista, ocupado: ocupadoLista } = useComando()
  const etapasDo = (moduloId: string) => cfg?.modulos.find((m) => m.id === moduloId)?.etapas ?? []
  const todas = fila ?? []
  const daAba = todas.filter((c) => (aba === 'todas' ? true : aba === 'abertas' ? !ENCERRADAS.includes(c.etapa) : ENCERRADAS.includes(c.etapa)))
  const tem = (c: (typeof daAba)[number], id: string) => (id === 'qualquer' ? c.pendencias.length > 0 : c.pendencias.some((x) => x.id === id))
  const b = busca.trim().toLowerCase()
  const forn = nav.params.forn === undefined ? '' : String(nav.params.forn)
  const de = nav.params.de === undefined ? '' : String(nav.params.de)
  const ate = nav.params.ate === undefined ? '' : String(nav.params.ate)
  const fornecedores = [...new Set(todas.map((c) => c.pessoa).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  // VIAGEM: o filtro que mais ajuda depois de uma viagem de compra (vg = id · 'sem' = sem viagem)
  const vg = nav.params.vg === undefined ? '' : String(nav.params.vg)
  const viagensLista = viagensDasLinhas(todas.map((c) => c.viagem))
  const lista = daAba
    .filter((c) => !pendencia || tem(c, pendencia))
    .filter((c) => (!forn || c.pessoa === forn) && (!de || c.data >= de) && (!ate || c.data <= ate) && passaViagem(vg, [c.viagem]))
    .filter((c) => !b || `${codigoDe(c)} ${c.busca} ${c.linhas.map((l) => l.descricao).join(' ')} ${c.obs ?? ''}`.toLowerCase().includes(b))
    .sort((x, y) => {
      const v = ordem.por === 'total' ? x.totalPrincipal - y.totalPrincipal : ordem.por === 'parada' ? x.diasParada - y.diasParada : x.data + x.criadoEm < y.data + y.criadoEm ? -1 : 1
      return ordem.desc ? -v : v
    })
  const opcoesPend = [{ id: 'paradaTriagem', nome: 'Parada na triagem' }, { id: 'semFotos', nome: 'Sem fotos' }, { id: 'semComprovanteOrigem', nome: 'Sem comprovante de origem' }, { id: 'faltaPagar', nome: 'Falta pagar' }, { id: 'semValor', nome: 'Sem valor' }]
  const contagem = Object.fromEntries([['', daAba.length], ['qualquer', daAba.filter((c) => tem(c, 'qualquer')).length], ...opcoesPend.map((o) => [o.id, daAba.filter((c) => tem(c, o.id)).length])])
  const abertas = todas.filter((c) => !ENCERRADAS.includes(c.etapa))
  const filtrar = (a: typeof aba, p: string) => ajustarParams({ aba: a === 'abertas' ? undefined : a, pendencia: p || undefined })
  const moedaP = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const comPend = todas.filter((c) => c.pendencias.length)
  const urgentes = comPend.filter((c) => c.pendencias.some((p) => p.nivel === 'urgente')).length
  const pesoAberto = abertas.reduce((s, c) => s + c.linhas.reduce((x, l) => x + l.quantidade, 0), 0)
  const valorAberto = abertas.reduce((s, c) => s + c.totalPrincipal, 0)
  const paradas = abertas.filter((c) => c.pendencias.some((p) => p.id === 'paradaTriagem')).length
  const resumo: { nome: string; valor: string; selos: Selo[]; icone: string; cor: string; tom?: boolean; ativo: boolean; abrir(): void }[] = [
    { nome: 'Em aberto', valor: String(abertas.length), selos: paradas ? [{ texto: `⏰ ${t('{n} parada(s) na triagem', { n: paradas })}`, tom: 'ruim' }] : [{ texto: t('nada parado'), tom: 'bom' }], icone: '🛒', cor: 'var(--marca)', ativo: aba === 'abertas' && !pendencia, abrir: () => filtrar('abertas', '') },
    { nome: 'Valor em aberto', valor: formatar(valorAberto, moedaP), selos: pesoAberto ? [{ texto: `${formatar(Math.round((valorAberto * 1000) / pesoAberto), moedaP)}/kg`, tom: 'bom' }] : [], icone: '💵', cor: 'var(--bom)', ativo: false, abrir: () => filtrar('abertas', '') },
    { nome: 'Peso em aberto', valor: gramasTexto(pesoAberto), selos: [{ texto: t('{n} pedido(s)', { n: abertas.length }), tom: 'alerta' }], icone: '⚖️', cor: 'var(--alerta)', ativo: false, abrir: () => filtrar('abertas', '') },
    { nome: 'Com pendência', valor: String(comPend.length), selos: urgentes ? [{ texto: `● ${t('{n} urgente(s)', { n: urgentes })}`, tom: 'ruim' }] : [{ texto: t('nada urgente'), tom: 'bom' }], icone: '⚠️', cor: urgentes ? 'var(--ruim)' : 'var(--alerta)', tom: urgentes > 0, ativo: pendencia === 'qualquer', abrir: () => filtrar('todas', 'qualquer') },
  ]
  const nomePend = (id: string) => (id === 'qualquer' ? 'Com pendência' : opcoesPend.find((o) => o.id === id)?.nome ?? id)
  const ativosCompra = [
    ...(pendencia ? [{ k: 'pendencia', rotulo: `⚠️ ${t(nomePend(pendencia))}` }] : []),
    ...(forn ? [{ k: 'forn', rotulo: `👤 ${forn}` }] : []),
    ...(vg ? [{ k: 'vg', rotulo: `✈️ ${vg === 'sem' ? t('Sem viagem') : viagensLista.find((v) => v.id === vg)?.codigo ?? vg}` }] : []),
    ...(de || ate ? [{ k: 'de,ate', rotulo: `📅 ${de ? dataBR(de) : '…'} – ${ate ? dataBR(ate) : '…'}` }] : []),
  ]
  const limparCompra = () => ajustarParams({ pendencia: undefined, forn: undefined, de: undefined, ate: undefined, vg: undefined, busca: undefined })
  const marcadas = todas.filter((c) => sel.has(c.id))
  const semViagemSel = marcadas.filter((c) => !c.viagem).length
  const comViagemSel = marcadas.length - semViagemSel
  const pag = usePaginacao(lista, { reiniciar: JSON.stringify([aba, busca, pendencia, forn, de, ate, vg, ordem]) })
  const tomEtapa = (e: string): TomLista => (e === 'concluido' ? 'bom' : ENCERRADAS.includes(e) ? 'ruim' : 'marca')
  const contaAba = { abertas: abertas.length, encerradas: todas.length - abertas.length, todas: todas.length }
  return (
    <div>
      {/* CABEÇALHO PADRÃO: nome da tela · para que serve · a ação principal à direita */}
      <Titulo subtitulo={t('O cabelo vai para a Triagem assim que a compra é registrada; aqui ficam o pagamento e a entrega.')} acao={<>
          <Botao onClick={() => ir('novaCompra')}>+ {t('Nova compra')}</Botao>
          {sessao.perfil === 'admin' && <AcaoIcone icone="⚙️" rotulo="Etapas e regras" dica="O caminho do pedido: as etapas da compra e o que cada uma pede." lado="direita" onClick={() => ir('config', { aba: 'etapas' })} />}
        </>}>
        {t('Pedidos de compra')}
      </Titulo>

      {/* NÚMEROS GRANDES (fileira padrão): tocar filtra a lista (o que está ligado fica destacado) */}
      <GrupoNumeros colunas={4}>
        {resumo.map((r) => <NumeroGrande key={r.nome} rotulo={r.nome} icone={r.icone} cor={r.cor} valor={r.valor} selos={r.selos} colorirValor={r.tom} ativo={r.ativo} onClick={r.abrir} carregando={!fila} />)}
      </GrupoNumeros>

      {/* FILTRO PADRÃO: situação à vista (segmentos) + busca + ⚙ Filtros (o que falta, fornecedor, período, como mostrar) → chips ✕ */}
      <FiltroLista
        className="mb-3"
        situacao={{ valor: aba, onChange: (id) => setAba(id as typeof aba), opcoes: [
          { id: 'abertas', nome: 'Em aberto', n: fila ? contaAba.abertas : undefined },
          { id: 'encerradas', nome: 'Encerradas', n: fila ? contaAba.encerradas : undefined },
          { id: 'todas', nome: 'Todas', n: fila ? contaAba.todas : undefined },
        ] }}
        periodo={{ de, ate, onChange: (d, a) => ajustarParams({ de: d, ate: a }) }}
        extra={<FiltroViagem nasLinhas={daAba.map((c) => [c.viagem])} valor={vg} onChange={(v) => ajustarParams({ vg: v || undefined })} />}
        busca={busca} onBusca={setBusca} placeholder="Buscar código (atual ou antigo), sigla, fornecedor, item…"
        ativos={ativosCompra} onTirar={tirarFiltro} onLimpar={limparCompra}
        resultados={fila ? lista.length : undefined} total={contaAba[aba]} unidade="pedido(s)"
        painel={<>
            <GrupoFiltro titulo="O que falta" icone="⚠️">
              <div className="col-span-2 lg:col-span-4"><FiltroPendencia valor={pendencia} onChange={setPendencia} contagem={contagem} opcoes={opcoesPend.filter((o) => contagem[o.id] || pendencia === o.id)} /></div>
            </GrupoFiltro>
            <GrupoFiltro titulo="De quem" icone="👤">
              <Campo rotulo="Fornecedor"><Selecao valor={forn} onChange={(v) => ajustarParams({ forn: v || undefined })} vazio="Todos" opcoes={fornecedores.map((x) => ({ id: x, nome: x }))} /></Campo>
            </GrupoFiltro>
            <GrupoVisao visao={vis.visao} onVisao={vis.setVisao} />
        </>}
      />

      {/* LISTAGEM PADRÃO (TabelaDados): colunas · ordem · o que falta abre numa linha embaixo; celular = linha curta */}
      <AreaPaginada pag={pag}>
      <TabelaDados
        cartoes={vis.cartoes}
        linhas={pag.itens}
        chave={(c) => c.id}
        carregando={!fila}
        vazio={<VazioFiltro texto="Nenhum pedido com esse filtro." filtrando={ativosCompra.length > 0 || !!busca.trim()} onLimpar={limparCompra} />}
        onAbrir={(c) => ir('pedido', { id: c.id })}
        selecao={sessao.perfil === 'admin' ? {
          marcados: sel,
          onAlternar: (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }),
          onTodos: () => setSel((s) => (lista.filter((c) => !FORA_VIAGEM.includes(c.etapa)).every((c) => s.has(c.id)) ? new Set() : new Set(lista.filter((c) => !FORA_VIAGEM.includes(c.etapa)).map((c) => c.id)))),
          desabilitado: (id) => (FORA_VIAGEM.includes(todas.find((c) => c.id === id)?.etapa ?? '') ? t('Compra cancelada ou recusada') : undefined),
          rotulo: (id) => `${t('Selecionar')} ${codigoDe(todas.find((c) => c.id === id) ?? { id })}`,
        } : undefined}
        rotuloAbrir="Abrir pedido"
        rotuloLinha={(c) => `${codigoDe(c)} · ${c.pessoa ?? ''}`}
        ordem={ordem}
        onOrdenar={(por) => setOrdem({ por: por as Ordem, desc: ordem.por === por ? !ordem.desc : true })}
        detalhe={(c) => abertos.has(c.id) && c.pendencias.length > 0 && <><span className="mr-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('O que falta')}</span><SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} /></>}
        colunas={[
          { id: 'pedido', titulo: 'Pedido', ordenar: 'data', classe: 'whitespace-nowrap', celula: (c) => <><span title={c.codigosAnteriores?.length ? `${t('antes')}: ${c.codigosAnteriores.join(', ')}` : undefined}><SeloCodigo codigo={codigoDe(c)} /></span><span className="num mt-1 block text-xs text-[var(--suave)]">{dataBR(c.data)}</span>{c.viagem && <span className="mt-1 block"><SeloViagem v={c.viagem} curto /></span>}</> },
          { id: 'fornecedor', titulo: 'Fornecedor', classe: 'font-semibold', celula: (c) => c.pessoa ?? t('Sem fornecedor') },
          { id: 'itens', titulo: 'Itens', celula: (c) => <><span className="block max-w-[16rem] truncate">{c.linhas.map((l) => l.descricao).join(' · ')}</span><span className="num text-xs text-[var(--suave)]">{c.linhas.length} {t('item(ns)')} · {gramasTexto(c.linhas.reduce((s, l) => s + l.quantidade, 0))}</span></> },
          { id: 'etapa', titulo: 'Etapa', celula: (c) => <><SeloSituacao texto={c.nomeEtapa} tom={tomEtapa(c.etapa)} /><Progresso etapas={etapasDo(c.moduloId)} atual={c.etapa} mini /></> },
          // o que falta: um resumo ("○ 2 pendências ▸"); tocar abre a lista numa linha embaixo
          { id: 'falta', titulo: 'O que falta', celula: (c) => c.pendencias.length ? (
            <button type="button" aria-expanded={abertos.has(c.id)} onClick={(e) => (e.stopPropagation(), alternarAberto(c.id))}
              className={cx('inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold hover:bg-[var(--fundo)]', c.pendencias.some((p) => p.nivel === 'urgente') ? 'text-[var(--ruim)]' : 'text-[var(--alerta)]')}>
              {c.pendencias.some((p) => p.nivel === 'urgente') ? '●' : '○'} {t(c.pendencias.length === 1 ? '1 pendência' : '{n} pendências', { n: c.pendencias.length })}
              <span aria-hidden className={cx('transition-transform', abertos.has(c.id) && 'rotate-90')}>›</span>
            </button>
          ) : <SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} /> },
          { id: 'parada', titulo: 'Parada', ordenar: 'parada', direita: true, classe: 'text-[var(--suave)]', celula: (c) => (ENCERRADAS.includes(c.etapa) ? '—' : `${c.diasParada} d`) },
          { id: 'total', titulo: 'Total', ordenar: 'total', direita: true, celula: (c) => <b>{formatar(c.totalPrincipal, c.moedaPrincipal)}</b> },
        ]}
        // LINHA PADRÃO do celular: quem · valor / código · etapa · o que falta / o peso; aberta: progresso, fatos, o que falta
        celular={{
          titulo: (c) => c.pessoa ?? t('Sem fornecedor'),
          valor: (c) => formatar(c.totalPrincipal, c.moedaPrincipal),
          resumo: (c) => `${c.linhas[0]?.descricao ?? '—'}${c.linhas.length > 1 ? ` + ${t('{n} item(ns)', { n: c.linhas.length - 1 })}` : ''}`,
          valorSub: (c) => gramasTexto(c.linhas.reduce((s, l) => s + l.quantidade, 0)),
          codigo: (c) => codigoDe(c),
          situacao: (c) => ({ texto: c.nomeEtapa, tom: tomEtapa(c.etapa) }),
          alerta: (c) => c.pendencias.length
            ? { texto: t(c.pendencias.length === 1 ? '1 pendência' : '{n} pendências', { n: c.pendencias.length }), tom: c.pendencias.some((p) => p.nivel === 'urgente') ? 'ruim' : 'alerta' }
            : undefined,
          marca: (c) => <SeloViagem v={c.viagem} curto soLeitura />,
          progresso: (c) => <Progresso etapas={etapasDo(c.moduloId)} atual={c.etapa} mini />,
          fatos: (c) => [`📅 ${dataBR(c.data)}`, `📦 ${t('{n} item(ns)', { n: c.linhas.length })}`, !ENCERRADAS.includes(c.etapa) && `⏱ ${t('parada há {n} d', { n: c.diasParada })}`],
          aberto: (c) => c.pendencias.length > 0 && <SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} />,
        }}
      />
      </AreaPaginada>
      {fila && <Paginacao {...pag} unidade="pedido(s)" />}
      {marcadas.length > 0 && (
        <PainelSelecao
          unidade="compra"
          itens={marcadas.map((c) => ({ id: c.id, codigo: codigoDe(c), peso: c.linhas.reduce((s, l) => s + l.quantidade, 0), detalhe: c.viagem ? `✈️ ${c.viagem.codigo}` : t('sem viagem') }))}
          fatos={[{ icone: '✈️', texto: semViagemSel === marcadas.length ? t('todas sem viagem') : !semViagemSel ? t('todas já têm viagem') : t('{n} sem viagem · {m} com viagem', { n: semViagemSel, m: marcadas.length - semViagemSel }) }]}
          topo={lista.length > marcadas.length ? <button type="button" onClick={() => setSel(new Set(lista.filter((c) => !FORA_VIAGEM.includes(c.etapa)).map((c) => c.id)))} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Selecionar as {n} filtradas', { n: lista.filter((c) => !FORA_VIAGEM.includes(c.etapa)).length })}</button> : undefined}
          onTirar={(id) => setSel((s) => { const n = new Set(s); n.delete(id); return n })}
          onLimpar={() => setSel(new Set())}
          ocupado={ocupadoLista}
          opcoes={[{ id: 'ligar', icone: '✈️', principal: true, onClick: () => setLigarSel(true),
            titulo: marcadas.length === 1 ? t('Ligar a uma viagem') : t('Ligar as {n} a uma viagem', { n: marcadas.length }),
            legenda: 'Escolhe a viagem e confere antes: quantas entram, quantas já estão nela e quantas estão em outra.',
            ajuda: 'Esqueceu de ligar na hora? Marque as compras e ligue de uma vez. As que já estão em outra viagem só mudam se você escolher mover. Dá para desfazer.' }]}
          mais={comViagemSel ? [{ rotulo: t('Tirar {n} da viagem', { n: comViagemSel }), icone: '✈️', perigo: true, descricao: t('As compras continuam existindo: só deixam de contar na viagem.'), onClick: () => setTirarSel(true) }] : undefined}
        />
      )}
      {ligarSel && <LigarCompras compraIds={marcadas.map((c) => c.id)} onFechar={() => setLigarSel(false)} onFeito={() => setSel(new Set())} />}
      {tirarSel && <Confirmar titulo={t('Tirar {n} compra(s) da viagem?', { n: comViagemSel })} texto="As compras continuam existindo: só deixam de contar no resultado da viagem. Se o gasto já estava no custo dos pacotes, ele é dividido de novo sozinho." rotulo="Tirar" onFechar={() => setTirarSel(false)}
        onConfirmar={async () => {
          let n = 0
          for (const c of marcadas.filter((x) => x.viagem)) if (await executarLista('desvincularCompra', { viagemId: c.viagem!.id, compraId: c.id })) n++
          if (n) setSel(new Set())
        }} />}
    </div>
  )
}
