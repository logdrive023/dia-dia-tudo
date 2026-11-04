// COMPRAR — a alma do negócio.
//  /pedidos           lista em TABELA (ordenável, busca, filtros de situação e pendência) — "Comprar"
//  /pedidos/novo      tela de NOVA COMPRA (formulário + resumo ao lado: total, peso, custo/kg, conta do fornecedor)
//  /pedidos/:id       tela do PEDIDO (etapas, o que falta, itens, pagamento, conta, lotes, arquivos, linha do tempo)
// O cabelo entra na Triagem assim que a compra é registrada ("Aguardando triagem"); as etapas do pedido ficam para o
// pagamento e a entrega (quem fez fica registrado). A conferência de peso é um lançamento no lote, sem mudar o comprado.

import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { PagamentoCompra, Progresso } from './PagamentoCompra'
import { CaminhoDoCabelo } from '../ui/caminhoCabelo'
import { Paginacao, usePaginacao } from '../ui/paginacao'
import { TabelaDados, SeloCodigo, SeloSituacao, type TomLista } from '../ui/tabelaDados'
import { AcaoIcone } from '../ui/acoesPagina'
import { CabecalhoFicha } from '../ui/cabecalhoFicha'
import { formatar, multiplicarFator, fatorValido, moeda as moedaDe } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { CategoriaAnexo, Campos, Id, Linha, Transacao } from '../core/domain/tipos'
import type { ModoCompra } from '../core/services/codigos'
import { CAMPOS_FORM, type CampoFormId, FORM_COMPRA_PADRAO, type FormCompraConfig } from '../core/services/formCompra'
import { fatorDaTabela } from '../core/services/precos'
import { CATEGORIAS_CABELO } from '../modules/cabelo'
import { Abas, Botao, Campo, Carregando, Cartao, Confirmar, Entrada, GramasInput, Info, Janela, Pilula, Selecao, ValorInput, Vazio, cx, dataBR, gramasTexto, loc, moedaPadrao, ehToque, ErroTela, TituloSecao, Titulo } from '../ui/base'
import { useApp, useAvisoSaida, useParamTela, useComando, useConsulta, useFiltrosTela } from '../ui/contexto'
import { type PagamentoTela, SeletorPessoa, ValoresConvertidos, useCotacoes, EditorPagamentos } from '../ui/compartilhados'
import { LinhaCotacao, PesoInput, ValorMoedaInput, converterDigitado, cotacaoSistema, moedasDoCampo } from '../ui/valorMoeda'
import { AbaAnexos, AnexosCurtos } from '../ui/anexos'
import { CamposDinamicos, resumoCampos } from '../ui/camposDinamicos'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { FiltroPendencia, SeloPendencias } from '../ui/pendencias'
import { useT } from '../ui/i18n'
import { Trilha } from '../ui/trilha'
import { CampoCodigoCompra, TrocarCodigo, CodigoTexto } from '../ui/codigos'
import { BuscaPessoa } from '../ui/buscaPessoa'
import { MenuAcoes } from '../ui/menuAcoes'
import { MiniaturaLote, marcadorLote } from '../ui/fotos'
import { NumeroGrande, type Selo, GrupoNumeros } from '../ui/numeroGrande'
import { Passo } from '../ui/passoAPasso'
import { CampoFaixa, GrupoFiltro, FiltroLista, VazioFiltro } from '../ui/filtroPadrao'

const ENCERRADAS = ['concluido', 'recusado', 'cancelado']
const codigoDe = (c: { codigo?: string; id: string }) => c.codigo ?? `#${c.id.slice(-5)}`

type Ordem = 'data' | 'total' | 'parada'

export function Comprar() {
  const t = useT()
  const { nav, ir, sessao, ajustarParams } = useApp()
  const { tirar: tirarFiltro } = useFiltrosTela()
  // lista no endereço: voltar do pedido reencontra a mesma aba, filtro, busca e ordem
  const [aba, setAba] = useParamTela<'abertas' | 'encerradas' | 'todas'>('aba', nav.params.encerradas ? 'encerradas' : 'abertas')
  const [pendencia, setPendencia] = useParamTela('pendencia', nav.params.semComprovante ? 'semComprovanteOrigem' : '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [ordemTxt, setOrdemTxt] = useParamTela('ordem', 'data-desc')
  const ordem = { por: ordemTxt.split('-')[0] as Ordem, desc: ordemTxt.endsWith('-desc') }
  const setOrdem = (o: { por: Ordem; desc: boolean }) => setOrdemTxt(`${o.por}-${o.desc ? 'desc' : 'asc'}`)
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: true })
  const { dados: cfg } = useConsulta('configuracoes', {})
  // celular: lista de linhas curtas que abrem no lugar; computador/tablet: a tabela
  const [abertos, setAbertos] = useState<Set<Id>>(new Set())
  const alternarAberto = (id: Id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  if (nav.params.id) return <Pedido />
  const etapasDo = (moduloId: string) => cfg?.modulos.find((m) => m.id === moduloId)?.etapas ?? []
  const todas = fila ?? []
  const daAba = todas.filter((c) => (aba === 'todas' ? true : aba === 'abertas' ? !ENCERRADAS.includes(c.etapa) : ENCERRADAS.includes(c.etapa)))
  const tem = (c: (typeof daAba)[number], id: string) => (id === 'qualquer' ? c.pendencias.length > 0 : c.pendencias.some((x) => x.id === id))
  const b = busca.trim().toLowerCase()
  const forn = nav.params.forn === undefined ? '' : String(nav.params.forn)
  const de = nav.params.de === undefined ? '' : String(nav.params.de)
  const ate = nav.params.ate === undefined ? '' : String(nav.params.ate)
  const fornecedores = [...new Set(todas.map((c) => c.pessoa).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const lista = daAba
    .filter((c) => !pendencia || tem(c, pendencia))
    .filter((c) => (!forn || c.pessoa === forn) && (!de || c.data >= de) && (!ate || c.data <= ate))
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
    ...(de || ate ? [{ k: 'de,ate', rotulo: `📅 ${de ? dataBR(de) : '…'} – ${ate ? dataBR(ate) : '…'}` }] : []),
  ]
  const limparCompra = () => ajustarParams({ pendencia: undefined, forn: undefined, de: undefined, ate: undefined, busca: undefined })
  const pag = usePaginacao(lista, { reiniciar: JSON.stringify([aba, busca, pendencia, forn, de, ate, ordem]) })
  const tomEtapa = (e: string): TomLista => (e === 'concluido' ? 'bom' : ENCERRADAS.includes(e) ? 'ruim' : 'marca')
  const contaAba = { abertas: abertas.length, encerradas: todas.length - abertas.length, todas: todas.length }
  return (
    <div>
      {/* CABEÇALHO PADRÃO: nome da tela · para que serve · a ação principal à direita */}
      <Titulo subtitulo={t('O cabelo vai para a Triagem assim que a compra é registrada; aqui ficam o pagamento e a entrega.')} acao={<Botao onClick={() => ir('novaCompra')}>+ {t('Nova compra')}</Botao>}>
        {t('Pedidos de compra')}
      </Titulo>

      {/* NÚMEROS GRANDES (fileira padrão): tocar filtra a lista (o que está ligado fica destacado) */}
      <GrupoNumeros colunas={4}>
        {resumo.map((r) => <NumeroGrande key={r.nome} rotulo={r.nome} icone={r.icone} cor={r.cor} valor={r.valor} selos={r.selos} colorirValor={r.tom} ativo={r.ativo} onClick={r.abrir} carregando={!fila} />)}
      </GrupoNumeros>

      {/* FILTRO PADRÃO: situação à vista (segmentos) + busca + ⚙ Filtros (o que falta, fornecedor, período) → chips ✕ */}
      <FiltroLista
        className="mb-3"
        situacao={{ valor: aba, onChange: (id) => setAba(id as typeof aba), opcoes: [
          { id: 'abertas', nome: 'Em aberto', n: fila ? contaAba.abertas : undefined },
          { id: 'encerradas', nome: 'Encerradas', n: fila ? contaAba.encerradas : undefined },
          { id: 'todas', nome: 'Todas', n: fila ? contaAba.todas : undefined },
        ] }}
        periodo={{ de, ate, onChange: (d, a) => ajustarParams({ de: d, ate: a }) }}
        acaoTopo={sessao.perfil === 'admin' && <button type="button" onClick={() => ir('config', { aba: 'etapas' })} className="min-h-10 whitespace-nowrap rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">⚙ {t('Etapas e regras')}</button>}
        busca={busca} onBusca={setBusca} placeholder="Buscar código (atual ou antigo), sigla, fornecedor, item…"
        ativos={ativosCompra} onTirar={tirarFiltro} onLimpar={limparCompra}
        resultados={fila ? lista.length : undefined} total={contaAba[aba]} unidade="pedido(s)"
        painel={<>
            <GrupoFiltro titulo="O que falta" icone="⚠️">
              <div className="col-span-2 lg:col-span-4"><FiltroPendencia valor={pendencia} onChange={setPendencia} contagem={contagem} opcoes={opcoesPend.filter((o) => contagem[o.id] || pendencia === o.id)} /></div>
            </GrupoFiltro>
            <GrupoFiltro titulo="De quem e quando" icone="👤">
              <Campo rotulo="Fornecedor"><Selecao valor={forn} onChange={(v) => ajustarParams({ forn: v || undefined })} vazio="Todos" opcoes={fornecedores.map((x) => ({ id: x, nome: x }))} /></Campo>
              <CampoFaixa rotulo="Data da compra">
                <Entrada type="date" aria-label={t('De')} value={de} onChange={(e) => ajustarParams({ de: e.target.value || undefined })} />
                <Entrada type="date" aria-label={t('Até')} value={ate} onChange={(e) => ajustarParams({ ate: e.target.value || undefined })} />
              </CampoFaixa>
            </GrupoFiltro>
        </>}
      />

      {/* LISTAGEM PADRÃO (TabelaDados): colunas · ordem · o que falta abre numa linha embaixo; celular = linha curta */}
      <TabelaDados
        linhas={pag.itens}
        chave={(c) => c.id}
        carregando={!fila}
        vazio={<VazioFiltro texto="Nenhum pedido com esse filtro." filtrando={ativosCompra.length > 0 || !!busca.trim()} onLimpar={limparCompra} />}
        onAbrir={(c) => ir('pedido', { id: c.id })}
        rotuloAbrir="Abrir pedido"
        rotuloLinha={(c) => `${codigoDe(c)} · ${c.pessoa ?? ''}`}
        ordem={ordem}
        onOrdenar={(por) => setOrdem({ por: por as Ordem, desc: ordem.por === por ? !ordem.desc : true })}
        detalhe={(c) => abertos.has(c.id) && c.pendencias.length > 0 && <><span className="mr-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('O que falta')}</span><SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} /></>}
        colunas={[
          { id: 'pedido', titulo: 'Pedido', ordenar: 'data', classe: 'whitespace-nowrap', celula: (c) => <><span title={c.codigosAnteriores?.length ? `${t('antes')}: ${c.codigosAnteriores.join(', ')}` : undefined}><SeloCodigo codigo={codigoDe(c)} /></span><span className="num mt-1 block text-xs text-[var(--suave)]">{dataBR(c.data)}</span></> },
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
          valorSub: (c) => gramasTexto(c.linhas.reduce((s, l) => s + l.quantidade, 0)),
          codigo: (c) => codigoDe(c),
          situacao: (c) => ({ texto: c.nomeEtapa, tom: tomEtapa(c.etapa) }),
          alerta: (c) => c.pendencias.length
            ? { texto: t(c.pendencias.length === 1 ? '1 pendência' : '{n} pendências', { n: c.pendencias.length }), tom: c.pendencias.some((p) => p.nivel === 'urgente') ? 'ruim' : 'alerta' }
            : { texto: `✓ ${t('Completa')}`, tom: 'bom' },
          progresso: (c) => <Progresso etapas={etapasDo(c.moduloId)} atual={c.etapa} mini />,
          fatos: (c) => [`📅 ${dataBR(c.data)}`, `📦 ${t('{n} item(ns)', { n: c.linhas.length })}`, !ENCERRADAS.includes(c.etapa) && `⏱ ${t('parada há {n} d', { n: c.diasParada })}`],
          aberto: (c) => c.pendencias.length > 0 && <SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} />,
        }}
      />
      {fila && <Paginacao {...pag} unidade="pedido(s)" />}
    </div>
  )
}

const CAMPOS_FIXOS = ['estado', 'comprimento', 'categoria', 'obs']
const SELETOR_CAMPO = 'input:not([type=file]):not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
const CAMPOS_TIRAR = ['fator', 'tabelaId', 'colunaId', 'calculo']

interface LinhaNova {
  id: Id
  modo: 'bruto' | 'tabela' | 'item'
  itemId?: Id
  quantidade?: number
  total?: number
  medida?: number
  fator?: string
  /** fator da compra repetida (vale quando a tabela de hoje não tem fator para a medida) */
  fatorAntigo?: string
  /** valor como foi digitado (bruto: o total; produto: o custo unitário), na moeda digitada */
  digitado?: number
  /** moeda em que o valor foi digitado (vazio = a do pedido); o total da linha fica convertido */
  moedaDig?: string
  /** cotação digitada "1 US$ = 6,96" (vazio = a do sistema) */
  cotacao?: string
  campos: Campos
}

/** linha nova segue a moeda (e a cotação) digitada na anterior */
const moedaDaAnterior = (ant?: LinhaNova) => (ant?.moedaDig ? { moedaDig: ant.moedaDig, cotacao: ant.cotacao } : {})

/** Linhas de uma compra anterior (repetir): mesma medida, peso e valor; o fator vem da tabela de hoje. */
function deLinhas(ls: Linha[], cabelo: boolean): LinhaNova[] {
  return ls.map((l) => {
    const fator = typeof l.campos.fator === 'string' ? l.campos.fator : undefined
    return {
      id: novoId(),
      modo: fator ? 'tabela' : cabelo ? 'bruto' : 'item',
      itemId: cabelo ? undefined : l.itemId,
      quantidade: l.quantidade,
      total: fator ? undefined : l.total,
      digitado: fator ? undefined : !cabelo && l.quantidade > 0 ? Math.round(l.total / l.quantidade) : l.total,
      medida: typeof l.campos.comprimento === 'number' ? l.campos.comprimento : undefined,
      fatorAntigo: fator,
      campos: Object.fromEntries(Object.entries(l.campos).filter(([k]) => !CAMPOS_TIRAR.includes(k))),
    }
  })
}

/** Tela de NOVA COMPRA (também usada para "repetir" uma compra: os campos vêm preenchidos). O jeito da tela vem de Configurações › Formulário de compra. */
export function NovaCompraTela() {
  const { nav } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: form, erro: erroForm } = useConsulta('formCompra', {})
  const repetir = nav.params.repetir as Id | undefined
  const { dados: base } = useConsulta('compra', { id: repetir ?? '' }, !!repetir)
  const f = form ?? (erroForm ? FORM_COMPRA_PADRAO : undefined)
  if (!cfg || !f || (repetir && !base)) return <Carregando />
  const modulos = cfg.modulos.filter((m) => m.temCompra && cfg.config.modulosAtivos.includes(m.id))
  return <NovaCompra key={repetir ?? 'nova'} modulos={modulos} base={base?.compra} form={f} />
}

function NovaCompra({ modulos, base, form }: { modulos: { id: string; nome: string; icone: string }[]; base?: Transacao; form: FormCompraConfig }) {
  const t = useT()
  const { ir, marcarSujo, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { executar, ocupado } = useComando()
  // id do rascunho (as fotos já anexadas ficam nele); começar de novo = id novo
  const [id, setId] = useState(() => novoId())
  const cfgCampo = (c: CampoFormId) => form.campos.find((x) => x.id === c)
  const visivel = (c: CampoFormId) => !!cfgCampo(c)?.visivel
  const obrig = (c: CampoFormId) => !!cfgCampo(c)?.obrigatorio
  const [moduloId, setModuloId] = useState(base?.moduloId ?? (form.padroes.moduloId && modulos.some((m) => m.id === form.padroes.moduloId) ? form.padroes.moduloId : modulos[0]?.id ?? 'cabelo'))
  const ehCabelo = moduloId === 'cabelo'
  const modulo = modulos.find((m) => m.id === moduloId)
  const [pessoaId, setPessoaIdBruto] = useState<Id | undefined>(base?.pessoaId)
  const [compradorId, setCompradorId] = useState<Id | undefined>(sessao.pessoaId)
  const moeda = form.padroes.moeda ?? moedaPadrao()

  // código do pedido: o tipo vem da regra (ou do formulário) e dá para trocar só nesta compra
  const { dados: codigos } = useConsulta('codigos', {}, admin)
  const regraCompra = codigos?.regras.compra
  const [modoEscolhido, setModoEscolhido] = useState<ModoCompra | undefined>(form.padroes.modoCodigo)
  const modoCodigo: ModoCompra = modoEscolhido ?? regraCompra?.modo ?? 'incremental'
  const [codigo, setCodigo] = useState('')
  const [codigoOk, setCodigoOk] = useState(true)
  const marcarCodigo = useCallback((ok: boolean) => setCodigoOk(ok), [])
  const porComprador = modoCodigo === 'porPessoa' && regraCompra?.base === 'comprador'
  const { dados: previsto } = useConsulta('codigoDisponivel', { tipo: 'compra', codigo: '', modoCodigo, pessoaId, compradorId }, admin)
  const codigoMostrado = modoCodigo === 'manual' && codigo.trim() ? codigo.trim() : previsto?.sugestao

  const [obs, setObs] = useState('')
  const [estado, setEstado] = useState<string[]>([])
  // VIAGEM: as abertas (funcionária vê só as dela); vem escolhida a viagem aberta de quem comprou (ou de quem registra)
  const { dados: vgs } = useConsulta('viagens', { status: 'aberta' })
  const viagensAbertas = vgs?.linhas ?? []
  const [viagemEscolhida, setViagemEscolhida] = useState<string>()
  const quemViaja = compradorId ?? sessao.pessoaId
  const viagemSugerida = quemViaja ? viagensAbertas.find((v) => v.viajantes.some((x) => x.id === quemViaja)) : undefined
  const viagemId = viagemEscolhida === undefined ? viagemSugerida?.id : viagemEscolhida || undefined
  const viagemAtual = viagensAbertas.find((v) => v.id === viagemId)
  const nomeViagem = (v: (typeof viagensAbertas)[number]) => [v.codigo, v.nome, v.destino].filter(Boolean).join(' · ')
  const [tentou, setTentou] = useState(false)
  const [abertos, setAbertos] = useState<Set<CampoFormId>>(() => new Set(form.campos.filter((c) => c.aberto || c.obrigatorio).map((c) => c.id)))
  const [focarCampo, setFocarCampo] = useState<CampoFormId>()
  const [attrAbertos, setAttrAbertos] = useState<Set<Id>>(new Set())
  // PASSO A PASSO (como o Separar): 1 Fornecedor · 2 O que veio · 3 Detalhes; repetir compra já começa no 2
  const [passosAbertos, setPassosAbertos] = useState<Set<number>>(() => new Set([base?.pessoaId ? 2 : 1]))
  // um passo aberto por vez (abrir outro fecha o de antes); o Passo rola até o que abriu
  const alternarPasso = (n: number) => setPassosAbertos((s) => (s.has(n) ? new Set([...s].filter((x) => x !== n)) : new Set([n])))
  const irPasso = (n: number) => setPassosAbertos(new Set([n]))
  // com várias linhas, só uma fica aberta (as outras numa linha: "2 · Bruto · 2 kg · Bs 3.000")
  const [linhaAberta, setLinhaAberta] = useState<Id>()

  const novaLinha = (cabelo: boolean, ant?: LinhaNova): LinhaNova =>
    cabelo
      ? { id: novoId(), modo: ant?.modo === 'tabela' || ant?.modo === 'bruto' ? ant.modo : form.padroes.modoLinha, medida: ant?.modo === 'tabela' ? ant.medida : undefined, ...moedaDaAnterior(ant), campos: { categoria: (ant?.campos.categoria as string | undefined) ?? 'Normal', ...(ant?.campos.cor ? { cor: ant.campos.cor } : {}) } }
      : { id: novoId(), modo: 'item', ...moedaDaAnterior(ant), campos: {} }
  const [linhas, setLinhas] = useState<LinhaNova[]>(() => (base ? deLinhas(base.linhas, ehCabelo) : [novaLinha(ehCabelo)]))
  const att = (i: number, d: Partial<LinhaNova>) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...d } : l)))
  // VALOR EM OUTRA MOEDA: digita em US$/R$ (cotação de compra do sistema, dá para mudar) e a linha fica na moeda do pedido
  const { cot: cotCompra, cfg: cfgMoedas } = useCotacoes('compra')
  const moedasValor = moedasDoCampo(moeda, cfgMoedas?.moedasAtivas)
  const moedaDig = (l: LinhaNova) => (l.moedaDig && moedasValor.includes(l.moedaDig) ? l.moedaDig : moeda)
  const textoCot = (l: LinhaNova) => (moedaDig(l) === moeda ? '' : l.cotacao ?? cotacaoSistema(moedaDig(l), moeda, cotCompra))
  /** total da linha (moeda do pedido) a partir do digitado: bruto = o valor; produto = custo unitário × quantidade */
  const totalDigitado = (l: LinhaNova) => {
    if (l.modo === 'tabela' || l.digitado === undefined) return l.total
    const bruto = l.modo === 'item' ? (l.quantidade ? l.digitado * l.quantidade : undefined) : l.digitado
    return bruto === undefined ? undefined : converterDigitado(bruto, moedaDig(l), moeda, textoCot(l), cotCompra)
  }
  /** muda peso/quantidade/valor/moeda/cotação e recalcula o total da linha */
  const attValor = (i: number, d: Partial<LinhaNova>) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...d, total: totalDigitado({ ...l, ...d }) } : l)))

  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { dados: catalogo } = useConsulta('catalogo', { moduloId })
  const { dados: cfgApp } = useConsulta('configuracoes', {})
  // PAGO NO ATO (o normal): a compra já sai paga e concluída; "Pagar depois" deixa em aberto (etapa por etapa)
  const [pagoAgoraEscolhido, setPagoAgora] = useState<boolean>()
  const pagoAgora = pagoAgoraEscolhido ?? cfgApp?.config.compraPagaNoAto !== false
  const [pagsNovos, setPagsNovos] = useState<PagamentoTela[]>([])
  const pagsEditados = useRef(false)
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: true })
  const { dados: conta } = useConsulta('contaPessoa', { pessoaId: pessoaId ?? '' }, !!pessoaId)
  const { dados: anexos } = useConsulta('anexosDe', { donoId: id })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  const modCfg = cfgApp?.modulos.find((m) => m.id === moduloId)
  const etapasFluxo = modCfg?.etapas ?? []
  // atributos do tipo de item (os do código + os criados em Configurações › Atributos)
  const camposTipo = modCfg?.tiposItem.find((x) => x.controlaEstoque)?.campos ?? []
  const extras = camposTipo.filter((c) => !CAMPOS_FIXOS.includes(c.id))

  // fornecedor: recentes, sigla, última compra e a coluna de costume
  const recentes = [...new Set((fila ?? []).map((c) => c.pessoaId).filter((x): x is Id => !!x))].slice(0, 5)
  const siglas: Record<Id, string> = Object.fromEntries([...(fila ?? []).filter((c) => c.pessoaId && c.sigla).map((c) => [c.pessoaId!, c.sigla!]), ...(codigos?.pessoas ?? []).map((p) => [p.id, p.sigla])])
  const ultima = pessoaId ? (fila ?? []).find((c) => c.pessoaId === pessoaId) : undefined
  const [coluna, setColuna] = useState<string>()
  const colunaUsual = tabela?.colunas.find((c) => c.pessoaId && c.pessoaId === pessoaId)?.id ?? (ultima?.linhas.map((l) => l.campos.colunaId).find((x) => typeof x === 'string') as string | undefined) ?? form.padroes.colunaId
  const existeColuna = (c?: string) => !!c && !!tabela?.colunas.some((x) => x.id === c)
  const col = existeColuna(coluna) ? coluna : existeColuna(colunaUsual) ? colunaUsual : tabela?.colunas[0]?.id
  const nomeColuna = tabela?.colunas.find((c) => c.id === col)?.nome
  const aplicarPessoa = (p?: Id) => (setPessoaIdBruto(p), setColuna(undefined))

  const fatorDaLinha = (l: LinhaNova) => {
    if (l.fator?.trim()) return fatorValido(l.fator) ? l.fator.trim() : undefined
    return (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined) ?? l.fatorAntigo
  }
  const totalLinha = (l: LinhaNova) => {
    if (l.campos.semValor) return 0
    if (l.modo === 'tabela') {
      const f = fatorDaLinha(l)
      return l.quantidade && f ? multiplicarFator(l.quantidade, f, moeda) : undefined
    }
    return l.total
  }
  const total = linhas.reduce((s, l) => s + (totalLinha(l) ?? 0), 0)
  useEffect(() => {
    if (pagsEditados.current) return
    setPagsNovos((ps) => (total > 0 ? [{ id: ps[0]?.id ?? novoId(), forma: ps[0]?.forma ?? 'dinheiro', moeda, valor: total }] : []))
  }, [total, moeda])
  const pesoTotal = linhas.reduce((s, l) => s + (l.quantidade ?? 0), 0)
  const custoKg = ehCabelo && pesoTotal > 0 && total > 0 ? Math.round((total * 1000) / pesoTotal) : undefined
  const descLinha = (l: LinhaNova) =>
    l.modo === 'tabela' ? `${l.medida ?? '?'} cm · ${t(String(l.campos.categoria ?? 'Normal'))}` : l.modo === 'bruto' ? `${t('Bruto')}${l.campos.cor ? ` · ${t(String(l.campos.cor))}` : ''}` : catalogo?.find((x) => x.id === l.itemId)?.nome ?? '—'

  // o que falta (o botão diz; cada campo mostra o seu depois da primeira tentativa)
  const faltasLinha = (l: LinhaNova, i: number) => {
    const n = i + 1
    const r: string[] = []
    if (l.modo === 'item' && !l.itemId) r.push(t('item da linha {n}', { n }))
    if (!l.quantidade) r.push(t(ehCabelo ? 'peso da linha {n}' : 'quantidade da linha {n}', { n }))
    if (l.modo === 'tabela') {
      if (l.fator?.trim() && !fatorValido(l.fator)) r.push(t('fator da linha {n}', { n }))
      else if (!l.medida) r.push(t('medida da linha {n}', { n }))
      else if (!l.campos.semValor && !fatorDaLinha(l)) r.push(t('fator da linha {n}', { n }))
    } else if (!l.campos.semValor && !l.total) r.push(t('valor da linha {n}', { n }))
    if (l.modo !== 'item') for (const c of extras.filter((x) => x.obrigatorio)) if (l.campos[c.id] === undefined || l.campos[c.id] === '') r.push(`${t(c.nome)} (${t('linha {n}', { n })})`)
    return r
  }
  const mostrarCodigo = visivel('codigo') && admin && !!codigos
  const faltas = [
    ...(obrig('fornecedor') && !pessoaId ? [t('fornecedor')] : []),
    ...(!linhas.length ? [t('o que veio')] : linhas.flatMap(faltasLinha)),
    ...(obrig('comprador') && !compradorId ? [t('quem comprou')] : []),
    ...(mostrarCodigo && modoCodigo === 'manual' && !codigoOk ? [t('código livre')] : []),
    ...(obrig('estado') && !estado.length ? [t('estado na chegada')] : []),
    ...(obrig('obs') && !obs.trim() ? [t('observação')] : []),
    ...(obrig('fotos') && !anexos?.length ? [t('fotos')] : []),
    ...(obrig('viagem') && !viagemId ? [t('viagem')] : []),
  ]
  const pode = !faltas.length && !ocupado

  // os dois jeitos da tela (Configurações › Formulário) usam o passo a passo vertical; "passo a passo" acrescenta o passo
  // Revisar no fim (confere tudo antes de registrar)
  const comRevisar = form.layout === 'passos'
  const aplicavel = (c: CampoFormId) => (c === 'coluna' ? ehCabelo && !!tabela : c === 'codigo' ? mostrarCodigo : c === 'viagem' ? viagensAbertas.length > 0 || obrig('viagem') : c !== 'atributos')
  const campos = form.campos.filter((c) => c.visivel && aplicavel(c.id))

  // algo digitado e não registrado: sair pede confirmação
  useAvisoSaida(!ocupado && (linhas.some((l) => l.quantidade || l.total) || !!obs.trim() || estado.length > 0))

  const caixa = useRef<HTMLDivElement>(null)
  // começa no primeiro campo
  useEffect(() => {
    if (!ehToque()) caixa.current?.querySelector<HTMLElement>(SELETOR_CAMPO)?.focus()
  }, [])
  // campo aberto pelo "+": o cursor vai para ele
  useEffect(() => {
    if (!focarCampo) return
    caixa.current?.querySelector<HTMLElement>(`[data-campo="${focarCampo}"] :is(${SELETOR_CAMPO})`)?.focus()
    setFocarCampo(undefined)
  }, [focarCampo])

  const abrir = (c: CampoFormId) => (setAbertos(new Set([...abertos, c])), setFocarCampo(c))
  const estaAberto = (c: CampoFormId) => abertos.has(c) || (c === 'comprador' && porComprador) || (c === 'viagem' && !!viagemSugerida)
  // TROCAR fornecedor ou módulo com algo preenchido: pergunta e começa limpo (só o módulo/fornecedor novo fica)
  const preenchido = linhas.some((l) => l.quantidade || l.total || l.itemId) || estado.length > 0 || !!obs.trim() || (anexos?.length ?? 0) > 0 || !!codigo.trim()
  const limparRascunho = (cabelo: boolean) => {
    setLinhas([novaLinha(cabelo)])
    setEstado([])
    setObs('')
    setCodigo('')
    setTentou(false)
    setAttrAbertos(new Set())
    setColuna(undefined)
    setId(novoId())
  }
  /** último fornecedor escolhido ("Trocar" limpa a escolha antes de escolher outro) */
  const ultimoFornecedor = useRef<Id | undefined>(base?.pessoaId)
  const [trocando, setTrocando] = useState<{ tipo: 'fornecedor' | 'modulo'; valor?: string; antes?: Id }>()
  const confirmou = useRef(false)
  const setPessoaId = (p?: Id) => {
    const antes = ultimoFornecedor.current
    if (p && antes && p !== antes && preenchido) {
      aplicarPessoa(p)
      confirmou.current = false
      return setTrocando({ tipo: 'fornecedor', valor: p, antes })
    }
    if (p) ultimoFornecedor.current = p
    aplicarPessoa(p)
    // escolheu: o passo 1 fecha (fica o nome no resumo) e abre "O que veio"
    const k = listaPassos.findIndex((x) => x.id === 'itens')
    if (p && k >= 0) irPasso(k + 1)
  }
  const trocarModulo = (m: string) => {
    if (m === moduloId) return
    if (preenchido) {
      confirmou.current = false
      return setTrocando({ tipo: 'modulo', valor: m })
    }
    setModuloId(m)
    setLinhas([novaLinha(m === 'cabelo')])
  }
  const confirmarTroca = () => {
    if (!trocando) return
    confirmou.current = true
    if (trocando.tipo === 'fornecedor') {
      ultimoFornecedor.current = trocando.valor
      limparRascunho(ehCabelo)
    } else {
      setModuloId(trocando.valor!)
      limparRascunho(trocando.valor === 'cabelo')
    }
  }
  const fecharTroca = () => {
    // "Voltar": fica o fornecedor de antes (e o módulo de antes) com tudo o que foi preenchido
    if (!confirmou.current && trocando?.tipo === 'fornecedor') aplicarPessoa(trocando.antes)
    setTrocando(undefined)
  }

  // valor digitado em outra moeda: o original e a cotação ficam na observação ("Linha 1: US$ 100,00 (1 US$ = 6,96 Bs)")
  const notasMoeda = linhas.flatMap((l, i) => {
    const m = moedaDig(l)
    if (m === moeda || l.modo === 'tabela' || l.digitado === undefined) return []
    const qtd = l.modo === 'item' && l.quantidade ? `${l.quantidade} × ` : ''
    return [`${t('Linha {n}', { n: i + 1 })}: ${qtd}${formatar(l.digitado, m)} (1 ${moedaDe(m).simbolo} = ${textoCot(l)} ${moedaDe(moeda).simbolo})`]
  })
  const salvar = async () => {
    if (!pode) {
      setTentou(true)
      // abre o passo onde está o que falta e rola até ele
      const alvo = obrig('fornecedor') && !pessoaId ? 'fornecedor' : !linhas.length || linhas.some((l, i) => faltasLinha(l, i).length) ? 'itens' : 'detalhes'
      const k = listaPassos.findIndex((p) => p.id === alvo)
      if (k >= 0) irPasso(k + 1)
      // a linha com falta abre (as outras ficam fechadas)
      const lf = linhas.find((l, i) => faltasLinha(l, i).length)
      if (lf) setLinhaAberta(lf.id)
      setTimeout(() => document.querySelector<HTMLElement>('[data-falta]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 50)
      return
    }
    const r = await executar('criarCompra', {
      id,
      moduloId,
      pessoaId,
      compradorId,
      modoCodigo: modoEscolhido,
      codigo: modoCodigo === 'manual' ? codigo.trim() || undefined : undefined,
      viagemId,
      pagarNoAto: pagoAgora && total > 0 ? pagsNovos.filter((p) => p.valor).map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })) : undefined,
      obs: [estado.length ? `${t('Estado na chegada')}: ${estado.map((x) => t(x)).join(', ')}` : '', obs.trim(), ...notasMoeda].filter(Boolean).join(' · ') || undefined,
      linhas: linhas.map((l) => {
        const fator = l.modo === 'tabela' && !l.campos.semValor ? fatorDaLinha(l) : undefined
        return {
          id: l.id,
          itemId: l.itemId,
          quantidade: l.quantidade ?? 0,
          moeda,
          total: l.campos.semValor ? 0 : l.total ?? 0,
          campos: { ...l.campos, estado: l.modo === 'bruto' ? 'Bruto' : ehCabelo ? 'Separado' : undefined },
          calculo: fator ? { medida: l.medida, fator, tabelaId: tabela?.id, colunaId: col, categoria: l.campos.categoria as string | undefined } : undefined,
        }
      }),
    }, t('Compra registrada ✓'))
    if (r) {
      marcarSujo(false)
      // padrão = separar depois (quase sempre se compra em viagem): o pedido abre com o aviso e um "Separar agora" discreto
      ir('pedido', { id: r.id, registrada: true })
    }
  }

  // teclado (desktop): Enter vai para o próximo campo; no último, faz o botão principal. Ctrl+Enter registra.
  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.defaultPrevented) return
    const el = e.target as HTMLElement
    if (e.ctrlKey || e.metaKey) return (e.preventDefault(), void salvar())
    if (!['INPUT', 'SELECT'].includes(el.tagName) || el.dataset.enter === 'proprio') return
    e.preventDefault()
    const todos = [...e.currentTarget.querySelectorAll<HTMLElement>(SELETOR_CAMPO)].filter((x) => x.tagName !== 'TEXTAREA')
    const k = todos.indexOf(el)
    if (k >= 0 && k < todos.length - 1) todos[k + 1].focus()
    else void salvar()
  }

  // o botão não descreve o erro: aponta para ele (os campos que faltam ficam em vermelho ao tocar; a lista fica no title)
  const rotuloFalta = faltas.length ? t(faltas.length === 1 ? 'Preencha o que falta' : 'Preencha o que falta ({n})', { n: faltas.length }) : ''
  const botaoRegistrar = (extra?: string) => (
    <Botao grande aria-disabled={!pode} disabled={ocupado} onClick={salvar} className={cx('leading-tight', !pode && 'opacity-60', extra)} title={faltas.join(', ')}>
      {pode ? t('Registrar pedido') : rotuloFalta}
    </Botao>
  )

  // ---------- cada campo ----------
  const sigla = pessoaId ? siglas[pessoaId] : undefined
  const saldo = conta?.saldo ?? 0
  const detalheFornecedor = pessoaId ? (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
      {sigla && <span className="rounded bg-[var(--cartao)] px-1.5 py-0.5 font-mono font-bold text-[var(--marca)]">{sigla}</span>}
      {conta && <span className={cx('font-semibold', saldo < 0 ? 'text-[var(--ruim)]' : saldo > 0 ? 'text-[var(--bom)]' : 'text-[var(--suave)]')}>{saldo < 0 ? `${t('Devo')} ${formatar(-saldo, conta.moeda)}` : saldo > 0 ? `${t('Me deve')} ${formatar(saldo, conta.moeda)}` : t('Conta em dia')}</span>}
      {ultima && (
        <a href={`#/pedidos/${encodeURIComponent(ultima.id)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[var(--suave)] hover:text-[var(--marca)] hover:underline">
          {t('Última')}: {dataBR(ultima.data)} · {gramasTexto(ultima.linhas.reduce((s, l) => s + l.quantidade, 0))} · {formatar(ultima.totalPrincipal, ultima.moedaPrincipal)} ↗
        </a>
      )}
      {ultima && ultima.moduloId === moduloId && (
        <button type="button" className="min-h-11 font-semibold text-[var(--marca)]" onClick={() => setLinhas(deLinhas(ultima.linhas, ehCabelo))}>⟳ {t('Repetir a última')}</button>
      )}
    </div>
  ) : undefined


  const linhaTela = (l: LinhaNova, i: number) => {
    const fator = l.modo === 'tabela' ? fatorDaLinha(l) : undefined
    const fatorTabela = tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined
    const tl = totalLinha(l)
    const faltam = faltasLinha(l, i)
    const tocado = tentou || !!l.quantidade || !!l.total || !!l.medida
    const resumoAttr = resumoCampos(camposTipo, l.campos, CAMPOS_FIXOS)
    const mostrarAttr = l.modo !== 'item' && extras.length > 0 && (visivel('atributos') || extras.some((c) => c.obrigatorio))
    const attrAberto = attrAbertos.has(l.id) || (visivel('atributos') && !!cfgCampo('atributos')?.aberto && !attrAbertos.has(`-${l.id}`)) || (tentou && faltam.some((x) => x.includes('(')))
    const alternarAttr = () => {
      const s = new Set(attrAbertos)
      if (attrAberto) (s.delete(l.id), s.add(`-${l.id}`))
      else (s.add(l.id), s.delete(`-${l.id}`))
      setAttrAbertos(s)
    }
    const mDig = moedaDig(l)
    const outraMoeda = l.modo !== 'tabela' && mDig !== moeda
    const campoValor = (rotulo: string) => (
      <Campo rotulo={rotulo} ajuda={moedasValor.length > 1 ? 'Pagou em outra moeda? Toque no símbolo dentro do campo (Bs → US$ → R$): converte pela cotação de compra. Ex.: US$ 100 × 6,96 = Bs 696,00.' : undefined}>
        <ValorMoedaInput rotulo={rotulo} moeda={mDig} moedas={moedasValor} valor={l.digitado} onChange={(v) => attValor(i, { digitado: v })} onMoeda={(m) => attValor(i, { moedaDig: m === moeda ? undefined : m, cotacao: undefined })} />
      </Campo>
    )
    const tirar = linhas.length > 1 && <button type="button" className="ml-auto h-11 w-11 shrink-0 rounded-xl text-xl text-[var(--suave)] hover:bg-[var(--ruim)]/10 hover:text-[var(--ruim)]" aria-label={t('Tirar a linha {n}', { n: i + 1 })} onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}>×</button>
    const numero = <span aria-label={t('Linha {n}', { n: i + 1 })} className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-xs font-bold text-[var(--marca)]">{i + 1}</span>
    // várias linhas: só a aberta mostra os campos; as outras ficam numa linha (tocar abre)
    const aberta = linhas.length < 2 || (linhaAberta ?? linhas[linhas.length - 1].id) === l.id
    if (!aberta)
      return (
        <button key={l.id} type="button" aria-expanded={false} onClick={() => setLinhaAberta(l.id)} className={cx('flex min-h-12 w-full items-center gap-2 rounded-xl border bg-[var(--cartao)] px-2.5 text-left text-sm', tentou && faltam.length ? 'border-[var(--ruim)]/60' : 'border-[var(--borda)]')}>
          <span aria-hidden className={cx('num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', faltam.length ? 'bg-[var(--marca-suave)] text-[var(--marca)]' : 'bg-[var(--bom)] text-white')}>{faltam.length ? i + 1 : '✓'}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{descLinha(l)}</span>
          <span className="num shrink-0">{ehCabelo ? gramasTexto(l.quantidade ?? 0) : l.quantidade ?? 0} · <b className={cx(!!l.campos.semValor && 'text-[var(--alerta)]')}>{l.campos.semValor ? t('sem valor') : tl !== undefined ? formatar(tl, moeda) : '—'}</b></span>
          <span aria-hidden className="shrink-0 text-[var(--suave)]">›</span>
        </button>
      )
    return (
      <div key={l.id} className={cx('space-y-3 rounded-xl border bg-[var(--cartao)] p-2.5 sm:p-3', tentou && faltam.length ? 'border-[var(--ruim)]/60' : 'border-[var(--borda)]')}>
        {l.modo === 'item' ? (
          <div className="flex items-end gap-2">
            <span className="mb-2">{numero}</span>
            <Campo rotulo="Produto" className="min-w-0 flex-1">
              <Selecao valor={l.itemId} onChange={(v) => att(i, { itemId: v || undefined })} vazio="Escolha…" opcoes={(catalogo ?? []).map((x) => ({ id: x.id, nome: x.nome }))} />
            </Campo>
            {tirar}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {numero}
            {ehCabelo && (
              <div role="radiogroup" aria-label={t('Como veio')} className="flex min-w-0 flex-1 gap-1 rounded-xl bg-[var(--marca-suave)] p-1 sm:flex-none">
                {(['bruto', 'tabela'] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={l.modo === m} onClick={() => attValor(i, { modo: m })} className={cx('min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold sm:flex-initial', l.modo === m ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
                    {t(m === 'bruto' ? 'Bruto' : 'Pela tabela')}
                  </button>
                ))}
              </div>
            )}
            {ehCabelo && <Info texto="Bruto: veio tudo junto, separa depois. Pela tabela: já veio separado por medida. Ex.: 10 kg bruto · ou · 60 cm | 2 kg × 17,5." />}
            {tirar}
          </div>
        )}

        {l.modo === 'tabela' && (
          <div>
            <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Medida (cm)')}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {form.medidas.map((m) => (
                <button key={m} type="button" aria-pressed={l.medida === m} onClick={() => att(i, { medida: m })} className={cx('num min-h-11 min-w-11 rounded-xl border px-2 text-sm font-bold', l.medida === m ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
                  {m}
                </button>
              ))}
              <Entrada aria-label={t('Outra medida (cm)')} inputMode="numeric" className="num w-20" placeholder={t('outra')} value={l.medida && !form.medidas.includes(l.medida) ? l.medida : ''} onChange={(e) => att(i, { medida: Number(e.target.value.replace(/\D/g, '')) || undefined })} />
            </div>
          </div>
        )}

        {l.modo === 'item' ? (
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,0.8fr)]">
            <Campo rotulo="Qtd">
              <Entrada aria-label={t('Quantidade')} inputMode="numeric" className="num" placeholder="1" value={l.quantidade ?? ''} onChange={(e) => attValor(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || undefined })} />
            </Campo>
            {campoValor('Custo unitário')}
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-[var(--fundo)] px-3 sm:col-span-1 sm:block sm:bg-transparent sm:px-0">
              <span className="text-sm font-semibold text-[var(--suave)] sm:mb-1 sm:block">{t('Total')}</span>
              <span className={cx('num flex min-h-11 items-center justify-end text-base font-black sm:rounded-xl sm:bg-[var(--fundo)] sm:px-3', tl === undefined && 'text-[var(--suave)]')} aria-live="polite">{tl !== undefined ? formatar(tl, moeda) : '—'}</span>
            </div>
          </div>
        ) : (
          <div className={cx('grid grid-cols-2 items-end gap-2', l.modo === 'tabela' && 'sm:grid-cols-3')}>
            {l.modo === 'tabela' && (
              <Campo rotulo="Categoria" className="col-span-2 sm:col-span-1">
                <Selecao valor={String(l.campos.categoria ?? 'Normal')} onChange={(v) => att(i, { campos: { ...l.campos, categoria: v } })} opcoes={CATEGORIAS_CABELO.map((c) => ({ id: c, nome: c }))} />
              </Campo>
            )}
            <Campo rotulo={ehCabelo ? 'Peso' : 'Quantidade'} ajuda={ehCabelo ? 'O peso total que veio, mesmo misturado. Toque no g para digitar em kg. Ex.: 10 kg bruto da Maria.' : undefined}>
              {ehCabelo ? <PesoInput rotulo="Peso" valor={l.quantidade} onChange={(q) => attValor(i, { quantidade: q })} /> : <Entrada inputMode="numeric" value={l.quantidade ?? ''} onChange={(e) => attValor(i, { quantidade: Number(e.target.value.replace(/\D/g, '')) || undefined })} />}
            </Campo>
            {l.modo === 'tabela' ? (
              <Campo rotulo="Fator">
                <Entrada inputMode="decimal" className={cx('num', l.fator?.trim() && !fatorValido(l.fator) && 'border-[var(--ruim)]')} value={l.fator ?? ''} placeholder={fatorTabela ?? l.fatorAntigo ?? '?'} onChange={(e) => att(i, { fator: e.target.value })} />
              </Campo>
            ) : (
              campoValor('Valor total')
            )}
          </div>
        )}

        {outraMoeda && (
          <LinhaCotacao moeda={mDig} principal={moeda} texto={textoCot(l)} sistema={cotacaoSistema(mDig, moeda, cotCompra)} resultado={tl} onChange={(c) => attValor(i, { cotacao: c })} />
        )}

        {l.modo === 'tabela' && (l.medida || l.quantidade) ? (
          <p className={cx('num break-words text-xl font-black leading-tight sm:text-2xl', tl === undefined && 'text-[var(--suave)]')} aria-live="polite">
            {l.medida ?? '?'} | {l.quantidade ? l.quantidade.toLocaleString(loc()) : '?'} × {fator ?? '?'} = {tl !== undefined ? formatar(tl, moeda) : '?'}
          </p>
        ) : null}
        {l.modo === 'tabela' && !l.fator?.trim() && !fatorTabela && l.fatorAntigo && <p className="text-xs text-[var(--suave)]">{t('Fator da compra repetida (a tabela não tem esta medida).')}</p>}
        {ehCabelo && l.quantidade && tl ? (
          <p className="num text-right text-sm text-[var(--suave)]">
            = <b className="text-[var(--texto)]">{formatar(Math.round(tl / l.quantidade), moeda)}/g</b> · {formatar(Math.round((tl * 1000) / l.quantidade), moeda)}/kg
          </p>
        ) : null}

        {/* SEM VALOR desta linha (as outras da mesma compra podem ter): registra só o peso; o valor vem depois no pedido */}
        <label className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm', l.campos.semValor ? 'bg-[var(--alerta)]/10 font-semibold text-[var(--alerta)]' : 'text-[var(--suave)]')}>
          <input type="checkbox" className="h-5 w-5" checked={!!l.campos.semValor} onChange={(e) => att(i, { campos: { ...l.campos, semValor: e.target.checked || undefined } })} />
          <span className="min-w-0 flex-1">{t('Esta linha ainda não tem valor (pôr depois)')}</span>
          <Info texto="Marque só a linha que ainda não tem preço; as outras da mesma compra seguem com o valor. Ex.: 20 kg a Bs 30.000 + 10 kg sem preço → a compra fica com Bs 30.000 e a pendência Sem valor. Depois, no pedido: ✎ Pôr o valor na linha — o custo vai para os pacotes, mesmo já separados." />
        </label>

        {mostrarAttr && (
          <div className="rounded-xl bg-[var(--fundo)]">
            <button type="button" aria-expanded={attrAberto} onClick={alternarAttr} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm">
              <span aria-hidden className="text-xs">{attrAberto ? '▾' : '▸'}</span>
              <b className="shrink-0">{t('Atributos')}</b>
              <span className="min-w-0 truncate text-[var(--suave)]">{resumoAttr.length ? resumoAttr.map((x) => x.valor).join(' · ') : t('nenhum')}</span>
            </button>
            {attrAberto && <div className="px-3 pb-3"><CamposDinamicos campos={camposTipo} valores={l.campos} pular={CAMPOS_FIXOS} onChange={(v) => att(i, { campos: v })} /></div>}
          </div>
        )}
        {tocado && faltam.length > 0 && (tentou || l.quantidade) ? <p data-falta={tentou ? '' : undefined} className={cx('text-xs font-semibold', tentou ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>{t('Falta')}: {faltam.map((x) => x.replace(` ${t('da linha {n}', { n: i + 1 })}`, '')).join(', ')}</p> : null}
      </div>
    )
  }

  // PASSOS: 1 Fornecedor · 2 O que veio · 3 Detalhes (o resto, aberto ou no "+") · [4 Revisar]
  const PRINCIPAIS: CampoFormId[] = ['fornecedor', 'itens']
  const numeroDe: Partial<Record<CampoFormId, number>> = {}
  for (const c of campos) if (PRINCIPAIS.includes(c.id) && estaAberto(c.id)) numeroDe[c.id] = Object.keys(numeroDe).length + 1
  // DETALHES: cada campo aberto pelo "+" tem ✕ (fecha e limpa) e um exemplo do que é; obrigatório e o que a regra
  // abriu sozinho (quem comprou para o código por pessoa, viagem sugerida) ficam sem ✕
  const EXEMPLO: Partial<Record<CampoFormId, string>> = {
    codigo: 'Ex.: P-0008 (incremental) · M3 (sigla da Maria + 3ª compra dela) · ou um código digitado à mão.',
    coluna: 'Ex.: coluna P.W. → 60 cm | 2.008 g × 17,5 = Bs 35.140. Muda o preço das linhas pela tabela.',
    comprador: 'Ex.: Paula comprou na viagem → a compra fica no nome dela (código por pessoa e o que ela trouxe).',
    estado: 'Ex.: Úmido · Embaraçado → fica no histórico e explica a perda na triagem.',
    obs: 'Ex.: veio em 3 sacos, 1 com fios mais curtos.',
    fotos: 'Ex.: foto do pedido, do cabelo e o comprovante de origem (nota ou recibo de quem vendeu).',
    viagem: 'Ex.: viagem a Cochabamba → os gastos da viagem são divididos entre as compras dela.',
  }
  const forcado = (c: CampoFormId) => (c === 'comprador' && porComprador) || (c === 'viagem' && !!viagemSugerida && viagemEscolhida === undefined)
  const fechar = (c: CampoFormId) => {
    setAbertos((s) => { const n = new Set(s); n.delete(c); return n })
    if (c === 'comprador') setCompradorId(undefined)
    else if (c === 'estado') setEstado([])
    else if (c === 'obs') setObs('')
    else if (c === 'viagem') setViagemEscolhida('')
    else if (c === 'codigo') (setCodigo(''), setModoEscolhido(form.padroes.modoCodigo))
    else if (c === 'coluna') setColuna(undefined)
  }
  const fechoEExemplo = (c: CampoFormId) => (!numeroDe[c] ? { exemplo: EXEMPLO[c], onFechar: !obrig(c) && !forcado(c) ? () => fechar(c) : undefined } : {})
  const campoTela = (c: CampoFormId): ReactNode => {
    switch (c) {
      case 'fornecedor':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)}>
            <BuscaPessoa rotulo={obrig('fornecedor') ? 'De quem? *' : 'De quem?'} valor={pessoaId} onChange={setPessoaId} papel="fornecedor" recentes={recentes} siglas={siglas} detalhe={detalheFornecedor} erro={tentou && obrig('fornecedor') && !pessoaId ? `${t('Falta')}: ${t('fornecedor')}` : undefined} />
          </Bloco>
        )
      case 'itens':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="O que veio" acao={<span className="num text-sm font-bold">{formatar(total, moeda)}</span>}>
            <div className="space-y-2">
              {linhas.map(linhaTela)}
              <Botao variante="secundario" className="min-h-11 w-full sm:w-auto" onClick={() => { const n = novaLinha(ehCabelo, linhas[linhas.length - 1]); setLinhas([...linhas, n]); setLinhaAberta(n.id) }}>+ {t('Outra linha')}</Botao>
            </div>
          </Bloco>
        )
      case 'codigo':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Código do pedido" acao={<Info texto="Como este pedido vai ser chamado (e os lotes dele). Escolha o tipo só para esta compra; a regra fica em Configurações › Códigos." />}>
            <CampoCodigoCompra
              modo={modoCodigo}
              onModo={(m) => (setModoEscolhido(m), setCodigo(''))}
              valor={codigo}
              onChange={setCodigo}
              contexto={{ pessoaId, compradorId }}
              onEstado={marcarCodigo}
              semPessoa={(regraCompra?.base === 'comprador' ? !compradorId : !pessoaId) ? (regraCompra?.base === 'comprador' ? 'Sem quem comprou: sai o incremental.' : 'Sem fornecedor: sai o incremental.') : undefined}
            />
          </Bloco>
        )
      case 'coluna':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Coluna da tabela" acao={<Info texto="Compra pela tabela: medida | gramas × fator da coluna do fornecedor. Vem a coluna ligada ao fornecedor (ou a da última compra dele)." />}>
            <Selecao valor={col} onChange={setColuna} opcoes={(tabela?.colunas ?? []).map((x) => ({ id: x.id, nome: x.id === colunaUsual ? `${x.nome} · ${t('do fornecedor')}` : x.nome }))} />
          </Bloco>
        )
      case 'comprador':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)}>
            <SeletorPessoa rotulo={obrig('comprador') || porComprador ? 'Quem comprou? *' : 'Quem comprou?'} valor={compradorId} onChange={setCompradorId} papel="funcionario" opcional={!obrig('comprador') && !porComprador} />
            <Falta se={tentou && obrig('comprador') && !compradorId} texto={t('quem comprou')} />
          </Bloco>
        )
      case 'estado':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Estado na chegada">
            <div className="flex flex-wrap gap-2">
              {form.estados.map((e) => (
                <button key={e} type="button" aria-pressed={estado.includes(e)} onClick={() => setEstado(estado.includes(e) ? estado.filter((x) => x !== e) : [...estado, e])} className={cx('min-h-11 rounded-full border px-3 text-sm', estado.includes(e) ? 'border-[var(--marca)] bg-[var(--marca)] font-semibold text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}>
                  {t(e)}
                </button>
              ))}
            </div>
            <Falta se={tentou && obrig('estado') && !estado.length} texto={t('estado na chegada')} />
          </Bloco>
        )
      case 'obs':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Observação">
            <textarea rows={2} aria-label={t('Observação')} value={obs} onChange={(e) => setObs(e.target.value)} placeholder={t('Ex.: veio em 3 sacos, 1 com fios mais curtos.')} className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-base outline-none focus:border-[var(--marca)]" />
            <Falta se={tentou && obrig('obs') && !obs.trim()} texto={t('observação')} />
          </Bloco>
        )
      case 'fotos':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Fotos e arquivos">
            <AnexosCurtos donoId={id} categorias={CATEGORIAS_COMPRA} padrao="pedido" />
            <Falta se={tentou && obrig('fotos') && !anexos?.length} texto={t('fotos')} />
          </Bloco>
        )
      case 'viagem':
        return (
          <Bloco obrigatorio={obrig(c)} campo={c} numero={numeroDe[c]} plano={!numeroDe[c]} {...fechoEExemplo(c)} titulo="Viagem" acao={<Info texto="Compra feita numa viagem de compra: os gastos da viagem são divididos entre as compras dela e o resultado da viagem conta com esta." />}>
            <Selecao valor={viagemId ?? ''} onChange={(v) => setViagemEscolhida(v)} vazio={t('Sem viagem')} opcoes={viagensAbertas.map((v) => ({ id: v.id, nome: nomeViagem(v) }))} />
            {viagemSugerida && viagemId === viagemSugerida.id && viagemEscolhida === undefined && <p className="mt-1 text-xs text-[var(--suave)]">{t('Escolhida porque quem comprou está nesta viagem.')}</p>}
            <Falta se={tentou && obrig('viagem') && !viagemId} texto={t('viagem')} />
          </Bloco>
        )
      default:
        return null
    }
  }
  /** rótulo do "+" de um campo fechado (com o valor que já vale, quando tem) */
  const rotuloFechado = (c: CampoFormId) => {
    if (c === 'codigo') return `# ${codigoMostrado ?? t('Código do pedido')}`
    if (c === 'coluna') return `${t('Coluna')}: ${nomeColuna ?? '—'}`
    if (c === 'fotos') return `+ ${t('Fotos')}${anexos?.length ? ` (${anexos.length})` : ''}`
    if (c === 'estado') return `+ ${t('Estado na chegada')}`
    if (c === 'obs') return `+ ${t('Observação')}`
    return `+ ${t(CAMPOS_FORM[c].nome)}`
  }

  // DETALHES em duas partes fixas (nada "pula para o meio"): em cima, os campos ABERTOS, cada um no seu cartão e na
  // ordem do formulário; embaixo, num bloco só, os "+" do que ainda não foi usado. Abrir um campo leva ele para cima.
  const principais: ReactNode[] = []
  const partes: ReactNode[] = []
  const abertosDet: ReactNode[] = []
  const fechados: CampoFormId[] = []
  const principalDe: Partial<Record<CampoFormId, ReactNode>> = {}
  for (const c of campos) {
    if (numeroDe[c.id]) (principais.push(<Fragment key={c.id}>{campoTela(c.id)}</Fragment>), (principalDe[c.id] = campoTela(c.id)))
    else if (estaAberto(c.id)) abertosDet.push(<Fragment key={c.id}>{campoTela(c.id)}</Fragment>)
    else fechados.push(c.id)
  }
  if (abertosDet.length) partes.push(<div key="abertos" className="space-y-2">{abertosDet}</div>)
  if (fechados.length)
    partes.push(
      <div key="mais" className="rounded-xl border border-dashed border-[var(--borda)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t(abertosDet.length ? 'Adicionar mais' : 'Adicionar ao pedido')}</p>
        <div className="flex flex-wrap gap-2">
          {fechados.map((c) => (
            <button key={c} type="button" data-campo-fechado={c} onClick={() => abrir(c)} className={cx('min-h-11 max-w-full truncate rounded-full border bg-[var(--cartao)] px-4 text-sm font-semibold', c === 'codigo' ? 'font-mono' : '', 'border-[var(--borda)] text-[var(--marca)] hover:border-[var(--marca)] hover:bg-[var(--marca-suave)]')}>
              {c === 'comprador' && compradorId ? <NomeComprador id={compradorId} /> : rotuloFechado(c)}
            </button>
          ))}
        </div>
      </div>,
    )
  const detalhesObrigatorios = campos.some((c) => !numeroDe[c.id] && c.obrigatorio)
  // PASSO A PASSO (aprendido no Separar): cada passo fecha numa linha com o resumo; o aberto explica para que serve
  const nomeForn = pessoaId ? (ultima?.pessoa ?? conta?.pessoa?.nome) : undefined
  const linhasResumo = linhas.map((l) => ({ id: l.id, texto: descLinha(l), qtd: ehCabelo ? gramasTexto(l.quantidade ?? 0) : String(l.quantidade ?? 0), valor: totalLinha(l) }))
  const nomeFornecedor = ultima?.pessoa ?? (pessoaId ? conta?.pessoa?.nome : undefined)
  const linhasOk = linhas.length > 0 && linhas.every((l, i) => !faltasLinha(l, i).length)
  const preenchidosDetalhe = [
    mostrarCodigo && codigoMostrado ? `# ${codigoMostrado}` : '',
    viagemAtual ? `✈️ ${viagemAtual.codigo}` : '',
    estado.length ? estado.map((x) => t(x)).join(', ') : '',
    obs.trim() ? `“${obs.trim()}”` : '',
    anexos?.length ? `📎 ${anexos.length}` : '',
  ].filter(Boolean)
  const faltaDetalhe = faltas.some((x) => ![t('fornecedor'), t('o que veio')].includes(x) && !linhas.some((l, i) => faltasLinha(l, i).includes(x)))
  const somaPags = pagsNovos.reduce((s, p) => s + (p.moeda === moeda ? p.valor ?? 0 : 0), 0)
  const nomeFormaNova = (id: string) => cfgApp?.config.formas.find((f) => f.id === id)?.nome ?? id
  const listaPassos: { id: CampoFormId | 'detalhes' | 'revisar' | 'pagamento'; titulo: string; resumo: ReactNode; ajuda: string; exemplo?: string; feito: boolean; opcional?: boolean; falta?: boolean; conteudo: ReactNode }[] = [
    ...(principalDe.fornecedor ? [{
      id: 'fornecedor' as const, titulo: 'Fornecedor', opcional: !obrig('fornecedor'), feito: !!pessoaId, falta: tentou && obrig('fornecedor') && !pessoaId,
      resumo: nomeForn ? [nomeForn, sigla, conta ? (saldo < 0 ? `${t('Devo')} ${formatar(-saldo, conta.moeda)}` : saldo > 0 ? `${t('Me deve')} ${formatar(saldo, conta.moeda)}` : t('Conta em dia')) : ''].filter(Boolean).join(' · ') : t('ninguém escolhido'),
      ajuda: 'De quem você comprou. Mostra a sigla, quanto você deve a ela e a última compra (dá para repetir).',
      exemplo: 'Ex.: Helena · HE · Devo Bs 1.000 → ⟳ Repetir a última',
      conteudo: principalDe.fornecedor,
    }] : []),
    ...(principalDe.itens ? [{
      id: 'itens' as const, titulo: 'Itens da compra', feito: linhasOk, falta: tentou && !linhasOk,
      resumo: `${t('{n} linha(s)', { n: linhas.length })} · ${ehCabelo ? gramasTexto(pesoTotal) : `${linhas.length} ${t('item(ns)')}`} · ${formatar(total, moeda)}${linhas.some((l) => l.campos.semValor) ? ` · ${t('{n} sem valor', { n: linhas.filter((l) => l.campos.semValor).length })}` : ''}`,
      ajuda: ehCabelo ? 'O cabelo que chegou: cada linha vira um pacote que vai para a triagem. Bruto = veio misturado (separa depois). Pela tabela = já veio por medida.' : 'O que chegou: cada linha é um produto, com a quantidade e o custo.',
      exemplo: ehCabelo ? 'Ex.: 10 kg bruto por Bs 30.000 · ou · 60 cm | 2 kg × 17,5 = Bs 35.000' : 'Ex.: 12 × shampoo a Bs 45 = Bs 540',
      conteudo: principalDe.itens,
    }] : []),
    // PAGAMENTO: pago agora (o normal) ou pagar depois — um toque; pago agora já vem com o total em dinheiro
    ...(total > 0 ? [{
      id: 'pagamento' as const, titulo: 'Pagamento', feito: !pagoAgora || somaPags > 0, falta: false,
      resumo: pagoAgora ? `💵 ${t('Pago agora')} · ${pagsNovos.filter((p) => p.valor).map((p) => `${t(nomeFormaNova(p.forma))} ${formatar(p.valor!, p.moeda)}`).join(' + ') || '—'}` : `⏳ ${t('Pagar depois (fica em aberto)')}`,
      ajuda: 'Compra paga na hora é o normal: o pedido já fica pago e concluído. Vai pagar depois? Escolha "Pagar depois" e pague na aba Pagamento do pedido.',
      exemplo: 'Ex.: Pago agora · Dinheiro Bs 15.000 · ou · Bs 10.000 em dinheiro + Bs 5.000 no QR',
      conteudo: (
        <div className="space-y-3">
          <div role="radiogroup" aria-label={t('Pagamento')} className="grid grid-cols-2 gap-2">
            {([[true, '💵', 'Pago agora', 'fica pago e concluído'], [false, '⏳', 'Pagar depois', 'fica em aberto']] as const).map(([v, ic, nome, sub]) => (
              <button key={String(v)} type="button" role="radio" aria-checked={pagoAgora === v} onClick={() => setPagoAgora(v)}
                className={cx('flex min-h-14 items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm', pagoAgora === v ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
                <span aria-hidden className="text-xl">{ic}</span>
                <span><b className="block">{t(nome)}</b><span className="text-xs text-[var(--suave)]">{t(sub)}</span></span>
              </button>
            ))}
          </div>
          {pagoAgora && <EditorPagamentos uso="compra" total={total} moedaTotal={moeda} pagamentos={pagsNovos} onChange={(ps) => { pagsEditados.current = true; setPagsNovos(ps) }} permiteFiado={!!pessoaId} />}
        </div>
      ),
    }] : []),
    ...(partes.length ? [{
      id: 'detalhes' as const, titulo: 'Detalhes', opcional: !detalhesObrigatorios, feito: preenchidosDetalhe.length > 0 && !faltaDetalhe, falta: tentou && faltaDetalhe,
      resumo: preenchidosDetalhe.length ? preenchidosDetalhe.join(' · ') : t('nada — toque para abrir'),
      ajuda: 'Só se precisar: quem comprou, código, viagem, estado na chegada, fotos e observação. Toque no + do que quiser.',
      exemplo: 'Ex.: + Fotos para anexar a foto do pedido · + Estado na chegada: Úmido',
      conteudo: <div className="space-y-3">{partes}</div>,
    }] : []),
    ...(comRevisar ? [{
      id: 'revisar' as const, titulo: 'Revisar e registrar', feito: pode, falta: tentou && !pode,
      resumo: pode ? t('tudo certo para registrar') : t('Falta preencher: {x}', { x: faltas[0] ?? '' }),
      ajuda: 'Confira o pedido inteiro antes de registrar: fornecedor, o que veio, valores e detalhes.',
      exemplo: 'Ex.: Helena · Bruto 10 kg · Bs 30.000 → Registrar pedido',
      conteudo: (
        <ul className="divide-y divide-[var(--borda)] rounded-xl bg-[var(--cartao)] px-3 text-sm">
          {mostrarCodigo && <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Código do pedido')}</span><b className="font-mono">{codigoMostrado ?? '…'}</b></li>}
          <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Tipo')}</span><b>{modulo?.icone} {t(modulo?.nome ?? moduloId)}</b></li>
          <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Fornecedor')}</span><b>{nomeFornecedor ?? t('Sem fornecedor')}</b></li>
          {viagemAtual && <li className="flex justify-between gap-3 py-2"><span className="text-[var(--suave)]">{t('Viagem')}</span><b className="min-w-0 truncate">✈️ {nomeViagem(viagemAtual)}</b></li>}
          {linhasResumo.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{l.texto}</span><span className="num shrink-0">{l.qtd} · <b>{formatar(l.valor ?? 0, moeda)}</b></span></li>
          ))}
          {(estado.length > 0 || obs.trim()) && <li className="py-2"><span className="text-[var(--suave)]">{t('Estado na chegada')}:</span> {[...estado.map((x) => t(x)), obs.trim()].filter(Boolean).join(' · ')}</li>}
        </ul>
      ),
    }] : []),
  ]
  const corpo: ReactNode = (
    <ol className="space-y-3" aria-label={t('Passos da compra')}>
      {listaPassos.map((p, k) => (
        <Passo key={p.id} n={k + 1} de={listaPassos.length} titulo={p.titulo} resumo={p.resumo} ajuda={p.ajuda} exemplo={p.exemplo} feito={p.feito} opcional={p.opcional} falta={p.falta} aberto={passosAbertos.has(k + 1)} onAlternar={() => alternarPasso(k + 1)}>
          {p.conteudo}
          {k < listaPassos.length - 1 && <div className="flex justify-end"><Botao variante="secundario" onClick={() => irPasso(k + 2)}>{t('Próximo')}: {t(listaPassos[k + 1].titulo)} →</Botao></div>}
        </Passo>
      ))}
    </ol>
  )


  return (
    <div>
      <Trilha atual={t(base ? 'Repetir compra' : 'Nova compra')} />
      <Titulo subtitulo={t('De quem, o que veio e os detalhes. Ao registrar, o cabelo já vai para a triagem.')} acao={admin && <AcaoIcone icone="⚙️" rotulo="Personalizar" dica="Escolher os campos e o jeito do formulário de compra (vale para todos)." lado="direita" onClick={() => ir('config', { aba: 'formCompra' })} />}>
        {t(base ? 'Repetir compra' : 'Nova compra')}
      </Titulo>

      {trocando && (
        <Confirmar
          titulo={trocando.tipo === 'fornecedor' ? 'Trocar o fornecedor?' : 'Trocar o que está comprando?'}
          texto={trocando.tipo === 'fornecedor' ? 'Trocar o fornecedor apaga o que foi preenchido. Continuar?' : 'Trocar o que está comprando apaga o que foi preenchido. Continuar?'}
          rotulo="Continuar"
          onConfirmar={confirmarTroca}
          onFechar={fecharTroca}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div ref={caixa} onKeyDown={aoTeclar} className="min-w-0 space-y-3">
          {modulos.length > 1 && (
            modulos.length <= 4 ? (
              <div role="radiogroup" aria-label={t('O que está comprando?')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {modulos.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={m.id === moduloId} onClick={() => trocarModulo(m.id)} className={cx('flex min-h-14 min-w-0 items-center gap-2 rounded-2xl border-2 px-2 py-2 text-left text-sm font-semibold', m.id === moduloId ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
                    <span className="text-2xl" aria-hidden>{m.icone}</span>
                    <span className="min-w-0 break-words leading-tight [overflow-wrap:anywhere]">{t(m.nome)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Campo rotulo="O que está comprando?"><Selecao valor={moduloId} onChange={trocarModulo} opcoes={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} /></Campo>
            )
          )}

          {corpo}

          {/* celular: total e o botão principal sempre à mão */}
          <div className="sticky bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-10 flex items-center gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-2 pl-3 shadow-lg md:bottom-4 lg:hidden">
            <div className="min-w-0 flex-1">
              <div className="num truncate text-lg font-black leading-tight">{formatar(total, moeda)}</div>
              {/* peso total · custo médio por kg (cabelo) — o que diz se a compra vale a pena */}
              <div className="num truncate text-xs text-[var(--suave)]">{ehCabelo ? gramasTexto(pesoTotal) : `${linhas.length} ${t('item(ns)')}`}{custoKg !== undefined ? ` · ${formatar(custoKg, moeda)}/kg` : ''}{codigoMostrado && mostrarCodigo ? ` · ${codigoMostrado}` : ''}</div>
            </div>
            {botaoRegistrar('max-w-[60%] shrink-0 px-4 text-sm')}
          </div>
        </div>

        {/* resumo fixo ao lado (desktop) */}
        <aside className="hidden h-fit lg:sticky lg:top-4 lg:block">
          <Cartao titulo={t('Resumo do pedido')}>
            <dl className="space-y-2 text-sm">
              {mostrarCodigo && <div className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t('Código')}</dt><dd className="truncate font-mono font-bold text-[var(--marca)]">{codigoMostrado ?? '…'}</dd></div>}
              <div className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t('Fornecedor')}</dt><dd className="truncate font-semibold">{nomeFornecedor ?? '—'}</dd></div>
              {viagemAtual && <div className="flex justify-between gap-2"><dt className="text-[var(--suave)]">{t('Viagem')}</dt><dd className="truncate font-semibold">✈️ {nomeViagem(viagemAtual)}</dd></div>}
            </dl>
            <ul className="my-3 space-y-1 border-y border-[var(--borda)] py-2 text-sm">
              {linhasResumo.map((l, i) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate"><span className="text-[var(--suave)]">{i + 1}.</span> {l.texto}</span>
                  <span className="num shrink-0 text-right">{l.qtd} · {l.valor !== undefined ? formatar(l.valor, moeda) : '—'}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 text-sm">
              {ehCabelo && <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Peso')}</dt><dd className="num">{gramasTexto(pesoTotal)}</dd></div>}
              {custoKg !== undefined && <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Custo por kg')}</dt><dd className="num">{formatar(custoKg, moeda)}</dd></div>}
              <div className="flex justify-between border-t border-[var(--borda)] pt-2 text-lg font-black"><dt>{t('Total')}</dt><dd className="num">{formatar(total, moeda)}</dd></div>
              {total > 0 && <div className="flex justify-end"><ValoresConvertidos valor={total} moeda={moeda} uso="compra" /></div>}
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              {botaoRegistrar('w-full')}
            </div>
            {!pode && tentou && faltas.length > 1 && <p className="mt-2 text-xs text-[var(--ruim)]">{t('Falta')}: {faltas.join(', ')}</p>}
            <p className="mt-2 text-xs text-[var(--suave)]">{ehCabelo ? `${t('Ao registrar, o cabelo já fica na Triagem, esperando para separar.')} ` : ''}{t('Pagamento e entrega')}: {etapasFluxo.map((e) => t(e.nome)).join(' → ')}.</p>
            <p className="mt-1 hidden text-xs text-[var(--suave)] lg:block">{t('Enter: próximo campo · Ctrl+Enter: registrar')}</p>
          </Cartao>
        </aside>
      </div>
    </div>
  )
}

/** compra recusada/cancelada não entra em viagem */
const encerradaSemViagem = (etapa: string) => etapa === 'recusado' || etapa === 'cancelado'

/** Ligar a compra a uma viagem aberta (admin): usa o "ligar compras" da viagem (uma viagem por compra). */
function LigarViagem({ compraId, onFechar }: { compraId: Id; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('viagens', { status: 'aberta' })
  const { executar, ocupado } = useComando()
  const [viagemId, setViagemId] = useState('')
  const abertas = dados?.linhas ?? []
  return (
    <Janela aberta titulo={t('Ligar a uma viagem')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !viagemId} onClick={async () => (await executar('vincularCompras', { viagemId, compraIds: [compraId] }, t('Compra ligada à viagem.'))) && onFechar()}>✈️ {t('Ligar')}</Botao>
    }>
      {!dados ? <Carregando /> : !abertas.length ? <Vazio compacto texto="Nenhuma viagem aberta." /> : (
        <Campo rotulo="Viagem"><Selecao valor={viagemId} onChange={setViagemId} vazio={t('Escolha…')} opcoes={abertas.map((v) => ({ id: v.id, nome: [v.codigo, v.nome, v.destino].filter(Boolean).join(' · ') }))} /></Campo>
      )}
    </Janela>
  )
}

/** Um campo do formulário de compra (cartão com título; * quando obrigatório). */
/**
 * Um campo da nova compra. `onFechar`: ✕ no canto (campo opcional aberto pelo "+": fecha e limpa o que tinha).
 * `exemplo`: uma linha "Ex.: …" embaixo, dizendo para que serve em um caso real.
 */
function Bloco({ campo, titulo, obrigatorio, children, acao, numero, plano, onFechar, exemplo }: { campo: CampoFormId; titulo?: string; obrigatorio?: boolean; children: ReactNode; acao?: ReactNode; numero?: number; plano?: boolean; onFechar?(): void; exemplo?: string }) {
  const t = useT()
  if (plano && (onFechar || exemplo))
    return (
      <section data-campo={campo} className="relative rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
        <div className={cx('mb-2 flex items-center gap-2', !titulo && !acao && onFechar && 'absolute right-2 top-2 mb-0')}>
          {titulo && <h2 className="flex min-w-0 flex-1 items-center text-sm font-bold">{t(titulo)}{obrigatorio && <span className="text-[var(--ruim)]"> *</span>}{exemplo && !acao && <Info texto={exemplo} />}</h2>}
          {acao}
          {onFechar && <button type="button" onClick={onFechar} aria-label={`${t('Tirar')} ${t(titulo ?? CAMPOS_FORM[campo].nome)}`} title={t('Tirar este campo (limpa o que foi preenchido)')} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-[var(--suave)] hover:bg-[var(--fundo)] hover:text-[var(--ruim)]">✕</button>}
        </div>
        <div className={cx(!titulo && !acao && onFechar && 'pr-10')}>{children}</div>
        {exemplo && (!titulo || acao) && <p className="mt-2 text-xs text-[var(--suave)]">{t(exemplo)}</p>}
      </section>
    )
  // campo principal (numerado): já está dentro do passo, que tem o número e o título — só o conteúdo
  if (numero) return <section data-campo={campo}>{children}</section>
  return (
    <section data-campo={campo} className={plano ? 'rounded-xl bg-[var(--cartao)] p-3' : 'rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 sm:p-4'}>
      {(titulo || acao) && (
        <div className={cx('flex flex-wrap items-center justify-between gap-2', numero ? 'mb-3' : 'mb-2')}>
          <h2 className={cx('flex items-center gap-2 font-bold', numero ? 'text-base' : 'text-sm')}>{numero && <NumeroSecao n={numero} />}<span>{titulo && t(titulo)}{titulo && obrigatorio && <span className="text-[var(--ruim)]"> *</span>}</span></h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/** Número da seção da nova compra (1 De quem · 2 O que veio · 3 Detalhes). */
function NumeroSecao({ n }: { n: number }) {
  return <span aria-hidden className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black text-white bg-[var(--marca)]">{n}</span>
}

/** "Falta: …" embaixo do campo (aparece depois da primeira tentativa de registrar). */
function Falta({ se, texto }: { se: boolean; texto: string }) {
  const t = useT()
  return se ? <p data-falta className="mt-1 text-xs font-semibold text-[var(--ruim)]">{t('Falta')}: {texto}</p> : null
}

function NomeComprador({ id }: { id: Id }) {
  const t = useT()
  const { dados } = useConsulta('pessoas', { papel: 'funcionario' })
  return <>{t('Quem comprou')}: {dados?.find((p) => p.id === id)?.nome ?? '…'}</>
}


/** Tela do PEDIDO (pedidos/:id): tudo de uma compra num lugar. */
/**
 * ITENS DA COMPRA (peça própria): um cartão por linha — o que é, peso em destaque, a conta (60 | 2.008 × 17,5) e o
 * custo por kg; as conferências de peso aparecem dentro da própria linha; total embaixo.
 */
function ItensCompra({ dados, admin, cancelada, onConferir, onAjustarValor }: { dados: DadosPedido; admin: boolean; cancelada: boolean; onConferir(l: Linha): void; onAjustarValor?(l: Linha): void }) {
  const t = useT()
  const c = dados.compra
  const m = c.moedaPrincipal
  const loteDaLinha = (l: Linha) => dados.lotes.find((x) => x.daCompra && x.linhaId === l.id)
  return (
    <section aria-label={t('Itens')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <h2 className="flex items-center justify-between border-b border-[var(--borda)] px-4 py-3 font-bold">
        <span>🧺 {t('Itens')}</span>
        <span className="num text-sm font-normal text-[var(--suave)]">{t('{n} item(ns)', { n: c.linhas.length })}</span>
      </h2>
      {/* dá para corrigir aqui: o peso (pesou diferente na chegada) e o valor (enquanto não pagou) */}
      {admin && !cancelada && (
        <p className="border-b border-[var(--borda)] bg-[var(--marca-suave)] px-4 py-2 text-xs text-[var(--marca)]">
          ✎ {t('Errou? Corrija aqui: ⚖ peso (pesou diferente) e ✎ valor (mesmo depois de pagar ou separar: o custo dos pacotes acompanha).')}
        </p>
      )}
      <ul className="divide-y divide-[var(--borda)]">
        {c.linhas.map((l) => {
          const lote = loteDaLinha(l)
          const confs = dados.conferencias.filter((x) => x.itemId === lote?.id)
          const porKg = l.quantidade ? Math.round((l.totalPrincipal ?? l.total) * 1000 / l.quantidade) : 0
          const conta = l.campos.calculo ? String(l.campos.calculo).split(' = ')[0] : ''
          return (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="block [overflow-wrap:anywhere]">{l.descricao}</b>
                  <span className="num block text-xs text-[var(--suave)]">{[conta, porKg ? `${formatar(porKg, m)}/kg` : ''].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="shrink-0 text-right">
                  <b className="num block whitespace-nowrap text-lg">{gramasTexto(l.quantidade)}</b>
                  {l.campos.semValor && !l.totalPrincipal
                    ? <Pilula tom="alerta">{t('sem valor')}</Pilula>
                    : <span className="num block whitespace-nowrap text-sm text-[var(--suave)]">{formatar(l.total, l.moeda)}</span>}
                </div>
              </div>
              {confs.map((x) => (
                <p key={x.id} className={cx('num mt-2 rounded-lg px-2 py-1 text-xs', x.delta < 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : 'bg-[var(--bom)]/10 text-[var(--bom)]')}>⚖ {dataBR(x.data)} · {x.descricao}</p>
              ))}
              {!cancelada && admin && (lote || onAjustarValor) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {lote && <button type="button" onClick={() => onConferir(l)} title={t('Pesou na chegada e deu diferente? Ex.: comprou 10.000 g, pesou 9.850 g → 150 g de diferença.')} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--marca)]/40 bg-[var(--cartao)] px-3 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">⚖ {t('Corrigir peso')}</button>}
                  {onAjustarValor && <button type="button" onClick={() => onAjustarValor(l)} title={t('Ex.: combinou Bs 9.500 em vez de 10.000. Vale mesmo depois de pagar ou separar.')} className={cx('inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-sm font-semibold hover:bg-[var(--marca-suave)]', l.total ? 'border-[var(--marca)]/40 bg-[var(--cartao)] text-[var(--marca)]' : 'border-[var(--alerta)] bg-[var(--alerta)]/10 text-[var(--alerta)]')}>✎ {t(l.total ? 'Corrigir valor' : 'Pôr o valor')}</button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="num flex items-center justify-between border-t-2 border-[var(--borda)] bg-[var(--fundo)] px-4 py-2.5 font-bold">
        <span>{t('Total')}</span>
        <span className="text-right">{gramasTexto(dados.gramas)} · {formatar(c.totalPrincipal, m)}</span>
      </div>
    </section>
  )
}

/**
 * PARA ONDE FOI A COMPRA (peça própria): a barra de cada grama (pacotes · vendido · perda · diferença), os números em
 * blocos e os pacotes que saíram dela, cada um com situação e saldo — tocar abre o pacote. Rastreio completo no fim.
 */
function DestinoCompra({ dados, admin, onTrocarLote }: { dados: DadosPedido; admin: boolean; onTrocarLote(l: { id: Id; codigo?: string }): void }) {
  const t = useT()
  const { ir } = useApp()
  const f = dados.fechamento
  const c = dados.compra
  if (!f) return null
  const partes = [
    { nome: 'Em pacotes', g: f.pacotes, cor: 'var(--alerta)' },
    { nome: 'Aguardando triagem', g: f.aguardando, cor: 'var(--marca)' },
    { nome: 'Vendido', g: f.vendido, cor: 'var(--bom)' },
    { nome: 'Perda', g: f.perda, cor: 'var(--ruim)' },
    { nome: 'Diferença de peso', g: f.diferenca, cor: 'var(--suave)' },
  ].filter((x) => x.g > 0)
  const total = partes.reduce((s, x) => s + x.g, 0) || 1
  return (
    <section aria-label={t('Para onde foi esta compra')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <h2 className="flex items-center justify-between gap-2 border-b border-[var(--borda)] px-4 py-3 font-bold">
        <span>📍 {t('Para onde foi')}</span>
        <span className={cx('num text-sm', f.confere ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>{gramasTexto(f.comprado)} {f.confere ? '✓' : `⚠ ${t('falta {g}', { g: gramasTexto(f.falta) })}`}<Info texto="Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6." /></span>
      </h2>
      <div className="space-y-3 px-4 py-3">
        <div className="flex h-3 overflow-hidden rounded-full bg-[var(--fundo)]">
          {partes.map((x) => <span key={x.nome} title={`${t(x.nome)} ${gramasTexto(x.g)}`} style={{ width: `${(x.g * 100) / total}%`, background: x.cor }} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {partes.map((x) => (
            <div key={x.nome} className="min-w-0 rounded-xl bg-[var(--fundo)] px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs text-[var(--suave)]"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.cor }} />{t(x.nome)}</span>
              <b className="num block whitespace-nowrap">{gramasTexto(x.g)}</b>
            </div>
          ))}
        </div>
      </div>
      {dados.lotes.length > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-[var(--borda)] px-4 pb-1 pt-3">
            <TituloSecao>{t('Pacotes desta compra')} · {dados.lotes.length}</TituloSecao>
            <button type="button" onClick={() => ir('etiquetas', { f: 'todas', compra: codigoDe(c), sel: (dados.lotes.some((l) => l.saldo > 0) ? dados.lotes.filter((l) => l.saldo > 0) : dados.lotes).map((l) => l.id).join(',') })} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">🏷 {t('Etiquetas')}</button>
          </div>
          <ul className="divide-y divide-[var(--borda)]">
            {dados.lotes.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-4 py-2">
                <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} tamanho="sm" />
                <button type="button" onClick={() => ir('lote', { id: l.id })} className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 text-left hover:text-[var(--marca)]">
                  <span className="min-w-0">
                    <CodigoTexto codigo={l.codigo} className="block text-sm" />
                    <span className="block truncate text-xs text-[var(--suave)]">{l.nome}{l.aguardando ? ` · ${t('aguardando triagem · há {n} dias', { n: l.aguardando.dias })}` : l.saldo <= 0 ? ` · ${t('esgotado')}` : ''}</span>
                  </span>
                  <span className="num shrink-0 font-semibold">{l.unidade === 'grama' ? gramasTexto(l.saldo) : l.saldo}</span>
                </button>
                {l.aguardando && admin && <button type="button" onClick={() => irSeparar(ir, [l.id])} className="min-h-10 shrink-0 rounded-lg px-2 text-xs font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">✂ {t('Separar')}</button>}
                {admin && <button type="button" aria-label={t('Trocar código')} title={t('Trocar código')} onClick={() => onTrocarLote({ id: l.id, codigo: l.codigo })} className="h-10 w-9 shrink-0 rounded-lg font-mono text-sm text-[var(--marca)] hover:bg-[var(--marca-suave)]">#</button>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="border-t border-[var(--borda)] px-4 py-1">
        <button type="button" onClick={() => ir('rastreio', { compraId: c.id })} className="min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">🔎 {t('Rastreio completo (cada grama)')}</button>
      </div>
    </section>
  )
}

/** tipos de anexo de uma compra (as pendências sem fotos / sem comprovante de origem saem da categoria) */
const CATEGORIAS_COMPRA: CategoriaAnexo[] = ['pedido', 'produto', 'comprovante', 'origem', 'outro']

type DadosPedido = NonNullable<ReturnType<typeof useConsulta<'pedido'>>['dados']>

/** Abre a separação do bruto desta compra: um lote → separar; vários → juntar e separar. */
function irSeparar(ir: (tela: string, params?: Record<string, string | number | boolean | undefined>) => void, ids: Id[]) {
  if (ids.length === 1) ir('separar', { id: ids[0] })
  else if (ids.length > 1) ir('separar', { ids: ids.join(',') })
}

/** Depois de registrar: confirma sem perguntar nada (o padrão é separar depois) e deixa um "Separar agora" discreto. */
function AvisoRegistrada({ dados, onFechar }: { dados: DadosPedido; onFechar(): void }) {
  const t = useT()
  const { ir, sessao } = useApp()
  const brutos = dados.lotes.filter((l) => l.daCompra && l.aguardando)
  // em viagem (ou quem registrou está viajando): só a confirmação e "Ver na Triagem"
  const emViagem = dados.viagem?.status === 'aberta' || (!!sessao.pessoaId && dados.comprador?.id === sessao.pessoaId && !!dados.viagem)
  return (
    // texto em cima (largura toda), botões embaixo (quebram) e o × no canto: no celular nada vira coluna estreita
    <div role="status" className="mb-4 rounded-2xl border border-[var(--bom)]/40 bg-[var(--bom)]/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 pt-2 font-semibold">
          {brutos.length ? t('Compra registrada ✓ · o cabelo ficou na Triagem, esperando para separar') : t('Compra registrada ✓')}
          {brutos.length > 0 && <Info texto="Pode separar quando voltar; o cabelo fica esperando na Triagem. Ex.: comprou na viagem, separa em casa." />}
        </p>
        <button type="button" aria-label={t('Fechar')} onClick={onFechar} className="-mr-1 -mt-1 h-10 w-10 shrink-0 rounded-xl text-lg hover:bg-[var(--fundo)]">×</button>
      </div>
      {brutos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!emViagem && <Botao variante="secundario" onClick={() => irSeparar(ir, brutos.map((l) => l.id))}>✂ {t('Separar agora')}</Botao>}
          <Botao variante="leve" onClick={() => ir('triagem')}>{t('Ver na Triagem')}</Botao>
        </div>
      )}
    </div>
  )
}

/** Conferência de peso (um toque, vale mesmo depois de pago): lança a diferença no lote, sem mudar o comprado. */
function ConferirPeso({ compraId, linha, onFechar }: { compraId: Id; linha: Linha; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [pesado, setPesado] = useState<number>()
  const [motivo, setMotivo] = useState('')
  const dif = pesado !== undefined ? pesado - linha.quantidade : 0
  const pode = pesado !== undefined && !!motivo.trim() && !ocupado
  return (
    <Janela aberta titulo={<span className="flex items-center">{t('Conferência de peso')}<Info texto="Pesou na chegada e deu diferente? Ex.: comprou 10.000 g, pesou 9.850 g → 150 g de diferença." /></span>} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={!pode} onClick={async () => (await executar('conferirPesoCompra', { compraId, linhaId: linha.id, pesado: pesado ?? 0, motivo }, t('Diferença de peso lançada.'))) && onFechar()}>⚖ {t('Lançar diferença')}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm">{linha.descricao} · {t('comprou')} <b className="num">{gramasTexto(linha.quantidade)}</b></p>
        <Campo rotulo="Pesou"><GramasInput valor={pesado} onChange={setPesado} /></Campo>
        {pesado !== undefined && dif !== 0 && <p className={cx('num text-sm font-semibold', dif < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{dif > 0 ? '+' : '−'}{gramasTexto(Math.abs(dif))} {t('de diferença')}</p>}
        <Campo rotulo="Motivo *"><Entrada value={motivo} placeholder={t('Ex.: balança da loja, veio úmido')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('O que foi comprado não muda: a diferença fica no histórico do lote.')}</p>
      </div>
    </Janela>
  )
}

const AJUDA_VALOR =
  'Corrigir o valor (ou pôr o valor de uma compra "sem valor"): vale mesmo depois de pagar, separar ou vender. A diferença segue o cabelo: o custo dos pacotes que saíram dele e das vendas que já levaram parte. Se já lançou na conta do fornecedor, a conta acompanha. Ex.: entrou 3 kg sem valor, separou 2 + 1 kg; pôs Bs 3.000 → os pacotes ficam com Bs 2.000 e Bs 1.000.'

function CorrigirValor({ compraId, linha, onFechar }: { compraId: Id; linha: Linha; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [valor, setValor] = useState<number | undefined>(linha.total || undefined)
  const [motivo, setMotivo] = useState('')
  const pode = valor !== undefined && valor !== linha.total && !!motivo.trim() && !ocupado
  const porKg = valor && linha.quantidade ? Math.round((valor * 1000) / linha.quantidade) : 0
  return (
    <Janela aberta titulo={<span className="flex items-center">{t(linha.total ? 'Corrigir valor' : 'Pôr o valor')}<Info texto={AJUDA_VALOR} /></span>} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={!pode} onClick={async () => (await executar('definirValorCompra', { compraId, linhaId: linha.id, total: valor ?? 0, motivo }, t('Valor corrigido: o custo dos pacotes acompanhou.'))) && onFechar()}>✎ {t('Salvar valor')}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm">{linha.descricao} · <b className="num">{gramasTexto(linha.quantidade)}</b> · {t('antes')}: <b className="num">{formatar(linha.total, linha.moeda)}</b></p>
        <Campo rotulo="Valor certo"><ValorInput moeda={linha.moeda} valor={valor} onChange={setValor} /></Campo>
        {porKg > 0 && <p className="num text-xs text-[var(--suave)]">= {formatar(porKg, linha.moeda)}/kg</p>}
        <Campo rotulo="Motivo *"><Entrada value={motivo} placeholder={t('Ex.: chegou a nota, valor combinado')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('Os pacotes e as vendas deste cabelo recebem o custo novo. Fica no histórico.')}</p>
      </div>
    </Janela>
  )
}

export function Pedido() {
  const t = useT()
  const { nav, ir, sessao, ajustarParams } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('pedido', { id })
  const { executar } = useComando()
  const [trocar, setTrocar] = useState(false)
  const [trocarLote, setTrocarLote] = useState<{ id: Id; codigo?: string }>()
  const [conferir, setConferir] = useState<Linha>()
  const [corrigirValor, setCorrigirValor] = useState<Linha>()
  const [ligarViagem, setLigarViagem] = useState(false)
  // sub-abas (no endereço: #/pedidos/P1?aba=anexos): Resumo · Anexos (N) · Histórico
  const [aba, setAba] = useParamTela<'resumo' | 'pagamento' | 'anexos' | 'historico'>('aba', 'resumo')
  const { dados: anexos } = useConsulta('anexosDe', { donoId: id })
  if (erro) return <ErroTela texto={erro} />
  if (!dados) return <Carregando />
  const c = dados.compra
  const m = c.moedaPrincipal
  const admin = sessao.perfil === 'admin'
  const encerrado = ENCERRADAS.includes(c.etapa)
  const cancelada = c.etapa === 'recusado' || c.etapa === 'cancelado'
  const loteDaLinha = (l: Linha) => dados.lotes.find((x) => x.daCompra && x.linhaId === l.id)
  return (
    <div>
      {/* ONDE ESTOU: "← 🛒 Compras › Pedido P-0007" — forte, no alto (Compras leva à lista) */}
      <Trilha atual={<>{t('Pedido')} <span className="font-mono">{codigoDe(c)}</span>{dados.pessoa ? <span className="font-normal text-[var(--suave)]"> · {dados.pessoa.nome}</span> : null}</>} />

      {nav.params.registrada && !cancelada && <AvisoRegistrada dados={dados} onFechar={() => ajustarParams({ registrada: undefined })} />}

      {/* CABEÇALHO DE FICHA (o mesmo do pacote e da viagem): fornecedor · código + etapa · detalhes · total · ações */}
      <CabecalhoFicha
        className="mb-4"
        titulo={dados.pessoa?.nome ?? t('Sem fornecedor')}
        codigo={codigoDe(c)} anteriores={c.codigosAnteriores}
        valor={formatar(c.totalPrincipal, m)}
        valorDetalhe={<>{gramasTexto(dados.gramas)}{dados.custoKg ? ` · ${formatar(dados.custoKg, m)}/kg` : ''}</>}
        detalhes={[dataBR(c.data), dados.comprador && `${t('comprou')}: ${dados.comprador.nome}`, c.obs, !encerrado && t('parada há {n} dias', { n: c.diasParada })]}
        selos={<>
            <Pilula tom={c.etapa === 'concluido' ? 'bom' : encerrado ? 'ruim' : 'marca'}>{t(c.nomeEtapa)}</Pilula>
            <span className="text-sm text-[var(--suave)]">{dados.modulo.icone} {t(dados.modulo.nome)}</span>
            {dados.viagem && (
              <button type="button" onClick={() => ir('viagem', { id: dados.viagem!.id })} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-[var(--marca-suave)] px-2 text-xs font-semibold text-[var(--marca)] hover:brightness-95" title={t('Abrir a viagem')}>
                ✈️ <span className="truncate">{t('Viagem')} {dados.viagem.codigo}{dados.viagem.destino ? ` · ${dados.viagem.destino}` : ''}</span>
              </button>
            )}
        </>}
        acoes={
          // Repetir e Rastrear ficam só aqui (uma vez cada)
          <MenuAcoes comRotulo acoes={[
            ...(dados.pessoa ? [{ rotulo: 'Ver fornecedor', icone: '👤', onClick: () => ir('pessoa', { id: dados.pessoa!.id }) }] : []),
            ...(dados.lotes.length ? [{ rotulo: 'Rastrear: para onde foi', icone: '🔎', onClick: () => ir('rastreio', { compraId: c.id }) }] : []),
            { rotulo: 'Repetir esta compra', icone: '⟳', onClick: () => ir('novaCompra', { repetir: c.id }) },
            ...(admin ? [{ rotulo: 'Trocar código', icone: '#', onClick: () => setTrocar(true), separar: true }] : []),
            ...(admin && !dados.viagem && !encerradaSemViagem(c.etapa) ? [{ rotulo: 'Ligar a uma viagem', icone: '✈️', onClick: () => setLigarViagem(true) }] : []),
            ...(admin && dados.viagem?.status === 'aberta' ? [{ rotulo: 'Tirar da viagem', icone: '✈️', perigo: true, onClick: () => void executar('desvincularCompra', { viagemId: dados.viagem!.id, compraId: c.id }, t('Compra tirada da viagem.')) }] : []),
          ]} />
        }
      />
      {trocar && <TrocarCodigo tipo="compra" id={c.id} atual={c.codigo} onFechar={() => setTrocar(false)} />}
      {trocarLote && <TrocarCodigo tipo="lote" id={trocarLote.id} atual={trocarLote.codigo} onFechar={() => setTrocarLote(undefined)} />}
      {conferir && <ConferirPeso compraId={c.id} linha={conferir} onFechar={() => setConferir(undefined)} />}
      {corrigirValor && <CorrigirValor compraId={c.id} linha={corrigirValor} onFechar={() => setCorrigirValor(undefined)} />}
      {ligarViagem && <LigarViagem compraId={c.id} onFechar={() => setLigarViagem(false)} />}

      {/* ABAS (nomes iguais em toda ficha): Resumo · Pagamento (com a conta do fornecedor) · Arquivos · Histórico */}
      <Abas variante="sublinhado" atual={aba} onChange={(x) => setAba(x as typeof aba)} abas={[
        { id: 'resumo', nome: 'Resumo' },
        { id: 'pagamento', nome: 'Pagamento', extra: c.pendencias.length ? <span aria-hidden className="text-[var(--alerta)]">●</span> : undefined },
        { id: 'anexos', nome: 'Arquivos', extra: anexos?.length ? <span className="num text-xs opacity-70">{anexos.length}</span> : undefined },
        { id: 'historico', nome: 'Histórico' },
      ]} />

      {aba === 'anexos' && <AbaAnexos donoId={c.id} categorias={CATEGORIAS_COMPRA} padrao="pedido" />}
      {/* UM bloco só: o caminho do cabelo (com o registro deste pedido dentro, na etapa Compra) */}
      {aba === 'historico' && <CaminhoDoCabelo de={{ compraId: c.id }} atual="compra" semCadeia={<LinhaDoTempo id={c.id} />} />}

      {aba === 'resumo' && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ItensCompra dados={dados} admin={admin} cancelada={cancelada} onConferir={setConferir} onAjustarValor={setCorrigirValor} />
          {!cancelada && <DestinoCompra dados={dados} admin={admin} onTrocarLote={setTrocarLote} />}
        </div>
      )}

      {/* PAGAMENTO: um componente só (a conta deste pedido · pagar agora · a conta do fornecedor · as etapas) */}
      {(aba === 'pagamento' || (aba as string) === 'conta') && <PagamentoCompra dados={dados} comLote={(linhaId) => c.linhas.some((l) => l.id === linhaId && !!loteDaLinha(l))} />}
    </div>
  )
}

