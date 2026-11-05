// TRIAGEM: o passo mais importante — daqui saem as vendas. Tela BEM SIMPLES: bater o olho e saber o que fazer.
// Topo: uma frase ("2 pacotes para separar · 4,2 kg") + 🔍 📷 ⚙. Três chips que filtram. UMA lista "Para separar"
// (bruto + não identificado, o mais antigo primeiro) com um botão grande "Separar" por linha; "Pronto para vender"
// fechado numa linha; o quadro (colunas do negócio, arrastar) fica atrás de "Ver quadro" (lembrado no aparelho).
// Seleção (juntar e separar, mover, etiquetas) só aparece ao tocar "Selecionar". O resto fica no "⋯" de cada linha.

import { type DragEvent, type KeyboardEvent, type ReactNode, useState } from 'react'
import { FiltroViagem, SelosViagem, passaViagem, viagensDasLinhas } from '../ui/seloViagem'
import { TabelaDados, SeloCodigo } from '../ui/tabelaDados'
import { CaminhoDoCabelo } from '../ui/caminhoCabelo'
import { PainelSelecao } from '../ui/painelSelecao'
import { Paginada } from '../ui/paginacao'
import { AcaoIcone } from '../ui/acoesPagina'
import { NumeroGrande, GrupoNumeros, type Selo } from '../ui/numeroGrande'
import { formatar } from '../core/domain/dinheiro'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import { COLUNA_VENDIDO, type ColunaTriagem } from '../core/services/triagem'
import { Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, GramasInput, Info, Janela, Pilula, Selecao, cx, dataBR, fmt, gramasTexto, moedaPadrao, Vazio, TituloSecao, BotaoExpandir, Titulo } from '../ui/base'
import { clicavel } from '../ui/compartilhados'
import { type Params, useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { type Acao, MenuAcoes, acoesLote } from '../ui/menuAcoes'
import { EditarAtributos, useCamposModulo } from './Estoque'
import { TrocarCodigo, CodigoTexto } from '../ui/codigos'
import { CadeiaChips, RastreioTotal } from '../ui/rastreioTotal'
import { LinkTirarFoto, MiniaturaLote, marcadorLote, useTirarFoto } from '../ui/fotos'
import { ImprimirEtiquetas, SeloEtiqueta } from '../ui/etiquetas'
import { Unificar } from './triagem/Unificar'
import { DesfazerMistura } from './triagem/DesfazerMistura'
import { DepoisDeSeparar, ProximoPasso } from './triagem/guia'
import { LeitorCodigo } from '../ui/estoqueUi'
import { usePistola } from '../ui/leitorPistola'
import { useLembrado } from '../ui/filtros'
import { Icone } from '../ui/icones'
import { GrupoFiltro, FiltroLista, VazioFiltro } from '../ui/filtroPadrao'
import { FiltrosProntos, PARAMS_PRONTOS, agruparProntos, filtrarProntos, useFiltroProntos, ativosProntos } from '../ui/filtrosProntos'

const NAO_ID = 'Não identificado'
/** ainda precisa separar: bruto ou "não identificado" (ficou para depois) */
const precisaSeparar = (l: { campos: { estado?: unknown } }) => l.campos.estado === 'Bruto' || l.campos.estado === NAO_ID
const DICA_JUNTAR = 'Junta pacotes de compras diferentes; a origem de cada grama fica guardada. Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.'
const DICA_SEPARAR = 'Digite o peso e o que é cada parte; o que sobrar é perda. Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.'
const DICA_PRONTOS = 'Lotes já triados, agrupados por medida, com o preço pela tabela. Ex.: 60 cm · 4 lotes · 9 kg · Bs 137.000. Toque na linha para ver os lotes.'
const DICA_LAVAGEM = 'Opcional. Se lavar, digite o peso depois. Ex.: 6.000 g → 5.700 g (−300 g).'

type Dados = ResultadoConsulta<'triagem'>
type Lote = Dados['lotes'][number]
type T = ReturnType<typeof useT>

const MAX_COLUNA = 20
const MAX_PRONTOS = 12
/** colunas da tabela "Prontos para vender": grupo | lotes | peso | valor | ⋯ (iguais no cabeçalho, nas linhas e no total) */
const GRADE_PRONTOS = 'grid grid-cols-[minmax(0,1fr)_3.75rem_6rem_2.5rem] items-center gap-x-1.5 sm:grid-cols-[minmax(0,1fr)_3.5rem_6rem_8rem_2.75rem] sm:gap-x-3'
const NOME_GRUPO: Record<string, string> = { medida: 'Medida', faixa: 'Faixa', categoria: 'Categoria', cor: 'Cor' }
const corDe = (c?: ColunaTriagem) => c?.cor ?? 'var(--marca)'

/** Rótulo curto: só o que se sabe (medida · cor · categoria); se nada, "Bruto". */
function rotuloCurto(l: Lote, t: T) {
  const c = l.campos
  const partes = [c.comprimento ? `${c.comprimento} cm` : '', c.cor ? t(String(c.cor)) : '', c.categoria && c.categoria !== 'Normal' ? t(String(c.categoria)) : ''].filter(Boolean)
  return partes.join(' · ') || t('Bruto')
}

export function Triagem() {
  const t = useT()
  const { ir, ajustarParams, nav, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const [visaoP, setVisao] = useParamTela<'' | 'quadro' | 'lista'>('visao', '')
  const [quadroLembrado, setQuadroLembrado] = useLembrado('triagem.quadro', false)
  const visao = visaoP || (quadroLembrado ? 'quadro' : 'lista')
  const [filtro] = useParamTela('f', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [buscaAberta, setBuscaAberta] = useState(!!busca)
  const [trocar, setTrocar] = useState<Lote>()
  const medida = nav.params.m === undefined ? '' : String(nav.params.m)
  const [colunaPreco, setColunaPreco] = useParamTela('coluna', '')
  const [vendidos, setVendidos] = useParamTela('vendidos', '')
  const { dados, erro } = useConsulta('triagem', { moduloId: 'cabelo', colunaId: colunaPreco || undefined, vendidosDias: vendidos === 'todos' ? 0 : 30 })
  const campos = useCamposModulo('cabelo', 'lote')
  const { executar, ocupado } = useComando()
  const [sel, setSel] = useState<Set<Id>>(new Set())
  const [selecionando, setSelecionando] = useState(false)
  const [janela, setJanela] = useState<'unificar' | 'triado' | 'regras'>()
  // sair de uma coluna de lavagem ("pedir peso depois"): pergunta o peso depois, opcional
  const [pesar, setPesar] = useState<{ ids: Id[]; fase: string }>()
  const [editar, setEditar] = useState<Lote>()
  // ↩ desfazer a mistura de um pacote juntado (janela própria, a mesma da ficha do pacote)
  const [desfazer, setDesfazer] = useState<Id>()
  // etiquetas dos prontos que ainda não têm (o próximo passo quando não há nada para separar)
  const [imprimirProntos, setImprimirProntos] = useState<Id[]>()
  const [arrastando, setArrastando] = useState<Id[]>()
  const [opcoes, setOpcoes] = useState(false)
  const [aba] = useParamTela('aba', 'separar')
  const [alvo, setAlvo] = useState<string>()
  const [lendo, setLendo] = useState(false)
  const { tirar } = useTirarFoto()
  // leitor pistola: Enter com o código exato abre o pacote
  const pistola = usePistola(dados?.lotes, (l) => ir('lote', { id: l.id }))
  if (erro) return <ErroTela texto={erro} />
  if (!dados) return <Carregando />

  const cols = dados.colunas
  const colDe = (id: string) => cols.find((c) => c.id === id)
  const trabalho = cols.filter((c) => c.id !== COLUNA_VENDIDO)
  const primeiraPronta = cols.find((c) => c.pronto)
  const naFila = (l: Lote) => l.fase !== COLUNA_VENDIDO && !colDe(l.fase)?.pronto
  const ehPronto = (l: Lote) => !!colDe(l.fase)?.pronto
  const tt = dados.totais
  const termo = busca.trim().toLowerCase()
  const passaBusca = (l: Lote) => (!termo || l.busca.includes(termo)) && (!medida || String(l.campos.comprimento ?? '') === medida)
  const passaFiltro = (l: Lote) =>
    !filtro ||
    (filtro === 'atrasados' ? l.atrasado
      : filtro === 'depois' ? l.campos.estado === NAO_ID
        : filtro === 'semana' ? ehPronto(l) && !!l.triadoEm && l.triadoEm >= dados.semanaDesde
          : filtro === 'mes' ? ehPronto(l) && !!l.triadoEm && l.triadoEm >= dados.mesDesde
            : filtro === 'pronto' ? ehPronto(l)
              : l.fase === filtro)
  const filtroDePronto = filtro === 'pronto' || filtro === 'semana' || filtro === 'mes' || !!colDe(filtro)?.pronto
  const lotes = dados.lotes.filter((l) => passaBusca(l) && passaFiltro(l))
  const selecionados = dados.lotes.filter((l) => sel.has(l.id))
  const brutos = selecionados.length > 0 && selecionados.every((l) => precisaSeparar(l) && l.fase !== COLUNA_VENDIDO)
  const marcar = (id: Id, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n })
  // REGRA (na tela): juntar/separar só pacotes da MESMA ETAPA do quadro — a seleção fica presa à etapa do 1º marcado
  const etapaSel = selecionados[0]?.fase
  // as regras vêm de Configurações (o ⚙ do quadro de regras muda): etapa única ligada/desligada e o limite da sobra
  const mesmaEtapa = dados.regras.mesmaEtapa
  const SALDO_PEQUENO = dados.regras.saldoPequeno
  const foraDaEtapa = (l: Lote) => mesmaEtapa && sel.size > 0 && !!etapaSel && l.fase !== etapaSel && !sel.has(l.id)
  const sobraPequena = (l: Lote) => SALDO_PEQUENO > 0 && l.saldo < SALDO_PEQUENO
  const limparSel = () => setSel(new Set())
  const comSelecao = selecionando || sel.size > 0

  // ---------- ações ----------
  const mover = async (ids: Id[], fase: string, pesos?: Record<Id, number | undefined>) => {
    const c = colDe(fase)
    // saindo de uma coluna de lavagem: antes, pergunta o peso depois (opcional)
    if (!pesos && ids.some((id) => { const l = dados.lotes.find((x) => x.id === id); return !!l && l.fase !== fase && !!colDe(l.fase)?.pedirPeso })) return setPesar({ ids, fase })
    const r = await executar('moverFaseTriagem', { ids, fase, pesos }, t('Movido para “{c}”.', { c: c?.nome ?? fase }))
    if (r) limparSel()
  }
  const separar = (id: Id) => ir('separar', { id, volta: 'triagem' })
  const vender = (p: Params) => ir('vender', { modulo: 'cabelo', coluna: dados.colunaPrecoId, ...p })
  /** entrar na coluna: "separar ao entrar" abre a separação (lote bruto); senão muda de coluna */
  const entrar = (col: ColunaTriagem, ids: Id[]) => {
    const ls = ids.map((id) => dados.lotes.find((x) => x.id === id)).filter((l): l is Lote => !!l && l.fase !== col.id && l.fase !== COLUNA_VENDIDO)
    if (!ls.length) return
    if (col.separarAoEntrar && ls.length === 1 && precisaSeparar(ls[0])) return separar(ls[0].id)
    mover(ls.map((l) => l.id), col.id)
  }
  const zona = (col: ColunaTriagem) =>
    col.id === COLUNA_VENDIDO
      ? {}
      : {
          onDragOver: (e: DragEvent) => { if (arrastando) { e.preventDefault(); setAlvo(col.id) } },
          onDragLeave: () => setAlvo((a) => (a === col.id ? undefined : a)),
          onDrop: (e: DragEvent) => { e.preventDefault(); const ids = arrastando ?? [e.dataTransfer.getData('text/plain')]; setAlvo(undefined); setArrastando(undefined); entrar(col, ids) },
        }
  const menuDe = (l: Lote): Acao[] =>
    acoesLote(
      { id: l.id, saldo: l.saldo, compras: l.compras, origens: l.pai ? [l.pai] : l.unificadoDe, vendavel: !!colDe(l.fase)?.pronto, etiquetaImpressa: !!l.etiqueta.impressaEm },
      {
        ir: (tela, p) => (tela === 'vender' ? vender(p ?? {}) : ir(tela, p)),
        t,
        admin: true,
        separarParams: { volta: 'triagem' },
        // o que já é o botão da linha (Separar) não se repete no ⋯
        sem: acaoDe(l)?.rotulo === 'Separar' ? ['Separar'] : [],
        onTrocarCodigo: () => setTrocar(l),
        extras: [
          { grupo: 'Foto', rotulo: 'Tirar foto', icone: '📷', onClick: () => tirar(l.id) },
          { grupo: 'Foto', rotulo: 'Escolher foto da galeria', icone: '🖼', onClick: () => tirar(l.id, { galeria: true }) },
          ...(l.saldo > 0 ? [{ rotulo: 'Editar atributos', icone: '✎', onClick: () => setEditar(l), separar: true }] : []),
          ...(l.mistura ? [{ rotulo: 'Desfazer mistura', icone: '↩', descricao: l.mistura.pode ? t('Os pacotes de origem voltam com o peso deles.') : t(l.mistura.porque ?? ''), onClick: () => setDesfazer(l.id) }] : []),
          // "Marcar como triado" e "Mover para…" ficam aqui (o caminho principal é Separar; arrastar continua no quadro)
          ...(primeiraPronta && precisaSeparar(l) && l.saldo > 0 ? [{ grupo: 'Mover na triagem', rotulo: 'Marcar como triado', icone: '✓', onClick: () => (setSel(new Set([l.id])), setJanela('triado')) }] : []),
          ...(l.fase === COLUNA_VENDIDO ? [] : trabalho.filter((c) => c.id !== l.fase).map((c) => ({ grupo: 'Mover na triagem', rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', onClick: () => entrar(c, [l.id]) }))),
        ],
      },
    )

  /** o caminho principal do lote: Separar (bruto / não identificado); Vender (pronto); senão a próxima coluna */
  const acaoDe = (l: Lote): { rotulo: string; f(): void } | undefined => {
    const k = trabalho.findIndex((c) => c.id === l.fase)
    const prox = naFila(l) ? trabalho[k + 1] : undefined
    return ehPronto(l)
      ? { rotulo: '💰 Vender', f: () => vender({ lote: l.id }) }
      : precisaSeparar(l) && l.saldo > 0
        ? { rotulo: 'Separar', f: () => separar(l.id) }
        : prox
          ? { rotulo: `→ ${prox.nome}`, f: () => mover([l.id], prox.id) }
          : undefined
  }

  const cartao = (l: Lote) => (
    <CartaoLote
      key={l.id}
      l={l}
      col={colDe(l.fase)}
      marcado={sel.has(l.id)}
      selecionavel={comSelecao}
      onMarcar={(v) => marcar(l.id, v)}
      arrastavel={l.fase !== COLUNA_VENDIDO}
      onArrastar={(e) => {
        e.dataTransfer.setData('text/plain', l.id)
        e.dataTransfer.effectAllowed = 'move'
        setArrastando(sel.has(l.id) ? [...sel] : [l.id])
      }}
      onSoltar={() => (setArrastando(undefined), setAlvo(undefined))}
      onAbrir={() => ir('lote', { id: l.id })}
      acao={acaoDe(l)}
      menu={menuDe(l)}
      ocupado={ocupado}
    />
  )

  // ---------- o que mostrar ----------
  // a aba: ?aba=prontos|depois|triagens (endereços antigos: ?f=pronto/semana/mes e ?m= abrem Prontos; ?f=depois, Para depois)
  const abaReal: 'separar' | 'prontos' | 'depois' | 'triagens' =
    aba === 'triagens' ? 'triagens'
      : aba === 'prontos' || filtroDePronto || !!medida || PARAMS_PRONTOS.some((k) => nav.params[k] !== undefined) ? 'prontos'
        : aba === 'depois' || filtro === 'depois' ? 'depois'
          : 'separar'
  // a busca fica no FILTRO PADRÃO de cada lista (Para separar, Prontos, Triagens feitas); a 🔍 do topo é só do quadro
  const buscaNaLista = !((abaReal === 'separar' || abaReal === 'depois') && visao === 'quadro')
  const irAba = (id: string) => ajustarParams({ aba: id === 'separar' ? undefined : id, f: undefined, m: undefined, t: undefined, ...Object.fromEntries(PARAMS_PRONTOS.map((k) => [k, undefined])) })
  const aguardando = dados.lotes.filter(naFila)
  // "para separar" e "para depois" (não identificado) são abas diferentes
  const separarTodos = aguardando.filter((l) => l.campos.estado !== NAO_ID)
  const gSeparar = separarTodos.reduce((s, l) => s + l.saldo, 0)
  const paradosN = separarTodos.filter((l) => l.atrasado).length
  const daAba = abaReal === 'depois' ? aguardando.filter((l) => l.campos.estado === NAO_ID) : separarTodos
  // filtro padrão das abas Para separar / Para depois (no endereço): fornecedor, compra, parado há N dias, etiqueta
  const fp = (k: string) => (nav.params[k] === undefined ? '' : String(nav.params[k]))
  const fornecedoresFila = [...new Set(daAba.flatMap((l) => l.compras.map((c) => c.fornecedor).filter((x): x is string => !!x)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const passaFiltroPadrao = (l: Lote) =>
    (!fp('sf') || l.compras.some((c) => c.fornecedor === fp('sf'))) &&
    (!fp('sc') || l.compras.some((c) => (c.codigo ?? '').toLowerCase().includes(fp('sc').toLowerCase()))) &&
    (!fp('sd') || l.dias >= Number(fp('sd'))) &&
    (!fp('set') || (fp('set') === 'sem' ? !l.etiqueta.impressaEm : !!l.etiqueta.impressaEm)) &&
    passaViagem(fp('sv'), l.compras.map((c) => c.viagem))
  const ativosFila = [
    ...(fp('sf') ? [{ k: 'sf', rotulo: `👤 ${fp('sf')}` }] : []),
    ...(fp('sc') ? [{ k: 'sc', rotulo: `🛒 ${fp('sc')}` }] : []),
    ...(fp('sd') ? [{ k: 'sd', rotulo: t('parado há {n}+ dias', { n: fp('sd') }) }] : []),
    ...(fp('set') ? [{ k: 'set', rotulo: t(fp('set') === 'sem' ? 'Sem etiqueta' : 'Com etiqueta') }] : []),
  ]
  const viagensFila = viagensDasLinhas(daAba.flatMap((l) => l.compras.map((c) => c.viagem)))
  if (fp('sv')) ativosFila.push({ k: 'sv', rotulo: `✈️ ${((id: string, vs: { id: string; codigo: string; nome: string }[]) => (id === 'sem' ? 'Sem viagem' : vs.find((v) => v.id === id)?.codigo ?? id))(fp('sv'), viagensFila)}` })
  const limparFila = () => ajustarParams({ sf: undefined, sc: undefined, sd: undefined, set: undefined, sv: undefined, busca: undefined })
  const paraSeparar = daAba.filter((l) => passaBusca(l) && passaFiltroPadrao(l) && (filtro === 'depois' || filtroDePronto || passaFiltro(l))).sort((a, b) => b.dias - a.dias)
  const prontos = dados.lotes.filter((l) => ehPronto(l) && passaBusca(l) && (!filtroDePronto || passaFiltro(l)))
  const nomeFiltro = (f: string) => colDe(f)?.nome ?? { atrasados: 'Esperando há mais tempo', depois: 'Para depois', semana: 'Triado nesta semana', mes: 'Triado neste mês', pronto: 'Pronto para vender' }[f] ?? f
  const verPronto = () => irAba('prontos')
  // a página da fila em SEÇÕES POR ETAPA, na ordem do quadro (todos = a etapa inteira, para "Selecionar todos desta etapa")
  const etapasDaPagina = (pagina: Lote[]) => {
    const fases = [...new Set(paraSeparar.map((l) => l.fase))]
    const varias = fases.length > 1
    return trabalho.filter((c) => pagina.some((l) => l.fase === c.id)).map((c) => ({ fase: c.id, nome: c.nome, varias, ls: pagina.filter((l) => l.fase === c.id), todos: paraSeparar.filter((l) => l.fase === c.id) }))
      .concat(pagina.some((l) => !trabalho.some((c) => c.id === l.fase)) ? [{ fase: '?', nome: 'Outras', varias, ls: pagina.filter((l) => !trabalho.some((c) => c.id === l.fase)), todos: [] }] : [])
  }
  const prontosSemEtiqueta = dados.lotes.filter((l) => ehPronto(l) && !l.etiqueta.impressaEm)
  const maisAntigo = [...separarTodos].sort((a, b) => b.dias - a.dias)[0]
  /** a dica do próximo passo de cada linha (abre no celular): o que fazer com ESTE pacote */
  const proximoDoLote = (l: Lote) => l.campos.estado === NAO_ID ? t('Próximo passo: separar o que ficou para depois.') : precisaSeparar(l) ? t('Próximo passo: separar por medida (cada parte vira um pacote com etiqueta).') : t('Próximo passo: mover para a próxima etapa.')
  /** o selo do pacote juntado: "🔗 Misturado de 2 · ↩ Desfazer mistura" (apagado, com o porquê, se já mexeram nele) */
  const seloMistura = (l: Lote) => l.mistura && (
    <button type="button" onClick={(e) => (e.stopPropagation(), setDesfazer(l.id))} title={l.mistura.pode ? t('Os pacotes de origem voltam com o peso deles.') : t(l.mistura.porque ?? '')}
      className={cx('inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold', l.mistura.pode ? 'border-[var(--marca)]/40 bg-[var(--marca-suave)] text-[var(--marca)] hover:border-[var(--marca)]' : 'border-dashed border-[var(--borda)] text-[var(--suave)]')}>
      🔗 {t('Misturado de {n}', { n: l.unificado })} · {l.mistura.pode ? `↩ ${t('Desfazer mistura')}` : `🔒 ${t('não dá para desfazer')}`}
    </button>
  )
  const alternarQuadro = () => { setQuadroLembrado(visao !== 'quadro'); if (visaoP) setVisao('') }

  return (
    <div className="space-y-5 pb-24">
      {/* acabou de separar: "✓ 3 pacotes novos · Imprimir etiquetas · Depois" */}
      <DepoisDeSeparar onProntos={() => irAba('prontos')} />
      {/* topo: o que fazer agora */}
      {/* CABEÇALHO PADRÃO: nome · para que serve · ações com nome e dica (📷 ler etiqueta, ⚙ opções da tela) */}
      <Titulo subtitulo={t('Separe o cabelo bruto por medida; o que fica pronto vai para o estoque.')} acao={<>
          {!buscaNaLista && <AcaoIcone icone="🔍" rotulo="Buscar" dica="Buscar um pacote no quadro pelo código, compra ou fornecedor." ativo={buscaAberta || !!busca} onClick={() => { if (buscaAberta && busca) setBusca(''); setBuscaAberta(!(buscaAberta || !!busca)) }} />}
          <AcaoIcone comNome icone="📷" rotulo="Ler código" dica="Aponte a câmera para a etiqueta do pacote: o código vai para a busca e o pacote aparece." onClick={() => setLendo(true)} />
          <AcaoIcone icone="⚙️" rotulo="Opções" dica="Opções desta tela: qual preço mostrar, lista ou quadro e as colunas da triagem." ativo={opcoes} lado="direita" onClick={() => setOpcoes(!opcoes)} />
        </>}>
        {t('Triagem')}
      </Titulo>

      {/* OPÇÕES (⚙): cada uma diz o que muda na prática e para quem (só esta tela, este aparelho ou todo mundo) */}
      {opcoes && (
        <section aria-label={t('Opções')} className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
          {dados.colunasPreco.length > 1 && (
            <div className="grid gap-2 p-3 sm:grid-cols-[16rem_1fr] sm:items-center">
              <Selecao valor={dados.colunaPrecoId} onChange={(v) => setColunaPreco(v === dados.colunasPreco[0]?.id ? '' : v)} opcoes={dados.colunasPreco.map((c) => ({ id: c.id, nome: `${t('Preço de')} ${c.nome}` }))} />
              <p className="text-sm text-[var(--suave)]"><b className="text-[var(--texto)]">{t('Qual preço mostrar nos prontos.')}</b> {t('Muda o valor e a margem desta tela (ex.: 2.000 g × 17,5 da coluna P.W. = Bs 35.000). Não muda vendas feitas nem a tabela. Só nesta tela.')}</p>
            </div>
          )}
          <div className="grid gap-2 p-3 sm:grid-cols-[16rem_1fr] sm:items-center">
            <Botao variante="secundario" onClick={alternarQuadro}>▦ {t(visao === 'quadro' ? 'Ver lista' : 'Ver quadro')}</Botao>
            <p className="text-sm text-[var(--suave)]"><b className="text-[var(--texto)]">{t(visao === 'quadro' ? 'Agora: quadro.' : 'Agora: lista.')}</b> {t('Lista: um pacote por linha com o botão Separar. Quadro: as colunas da triagem para arrastar os pacotes. Só muda a visão; fica lembrado neste aparelho.')}</p>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-[16rem_1fr] sm:items-center">
            <Botao variante="secundario" onClick={() => ir('config', { aba: 'triagem' })}>⚙ {t('Personalizar colunas')}</Botao>
            <p className="text-sm text-[var(--suave)]"><b className="text-[var(--texto)]">{t('Etapas da triagem (para todos).')}</b> {t('Nome, ordem e cor de cada coluna e qual conta como "pronto para vender". Muda o quadro e as abas de todos os usuários; os pacotes não mudam de lugar sozinhos.')}</p>
          </div>
        </section>
      )}

      {!buscaNaLista && (buscaAberta || !!busca) && (
        <Entrada type="search" autoFocus={buscaAberta && !busca} focoSempre className="w-full" aria-label={t('Buscar lote por código (atual ou antigo), compra, sigla ou fornecedor')} placeholder={t('Código, compra ou fornecedor')} value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={pistola.onKeyDown} />
      )}

      {/* abas = NÚMEROS GRANDES na fileira padrão (mesmo cartão de Compras, Estoque e Etiquetas): tocar troca a lista */}
      <GrupoNumeros colunas={4} abas rotulo="Triagem" className="!mb-0 !mt-0">
        {([
          { id: 'separar', nome: 'Para separar', icone: '⏳', cor: paradosN ? 'var(--ruim)' : 'var(--alerta)', valor: separarTodos.length ? gramasTexto(gSeparar) : t('Tudo separado ✓'), selos: separarTodos.length ? [{ texto: t('{n} pacote(s)', { n: separarTodos.length }) }, ...(paradosN ? [{ texto: `⏰ ${t('{n} parado(s)', { n: paradosN })}`, tom: 'ruim' }] : [])] : [{ texto: t('nada esperando'), tom: 'bom' }] },
          { id: 'prontos', nome: 'Prontos', icone: '✅', cor: 'var(--bom)', valor: gramasTexto(tt.pronto), selos: [{ texto: t('{n} pacote(s)', { n: dados.lotes.filter(ehPronto).length }) }, ...(tt.prontoValor ? [{ texto: formatar(tt.prontoValor, moedaPadrao()), tom: 'bom' }] : [])] },
          { id: 'depois', nome: 'Para depois', icone: '❓', cor: '#a78bfa', valor: gramasTexto(tt.naoIdentificado.g), selos: [{ texto: t('{n} pacote(s)', { n: tt.naoIdentificado.n }), ...(tt.naoIdentificado.n ? { tom: 'alerta' } : {}) }] },
          { id: 'triagens', nome: 'Triagens feitas', icone: '✂️', cor: 'var(--marca)', valor: gramasTexto(tt.triadoSemana), selos: [{ texto: t('nesta semana'), tom: 'marca' }] },
        ] as { id: string; nome: string; icone: string; cor: string; valor: string; selos: { texto: string; tom?: string }[] }[]).map((a) => (
          <NumeroGrande key={a.id} role="tab" rotulo={a.nome} icone={a.icone} cor={a.cor} valor={a.valor} selos={a.selos as Selo[]} ativo={abaReal === a.id} colorirValor={abaReal === a.id} onClick={() => irAba(a.id)} />
        ))}
      </GrupoNumeros>

      {abaReal === 'triagens' ? (
        <ListaTriagens aberta={nav.params.t as string | undefined} />
      ) : abaReal === 'prontos' ? (
        <ProntoParaVender
          lotes={prontos}
          totalLotes={dados.lotes.filter(ehPronto).length}
          busca={busca} onBusca={setBusca} onKeyDown={pistola.onKeyDown}
          total={prontos.length === dados.lotes.filter(ehPronto).length ? tt.pronto : prontos.reduce((s, l) => s + l.saldo, 0)}
          valor={prontos.length === dados.lotes.filter(ehPronto).length ? tt.prontoValor : prontos.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)}
          menuDe={menuDe}
          onLote={(id) => ir('lote', { id })}
          onVender={vender}
          onEstoque={(med) => ir('estoque', { modulo: 'cabelo', 'min.comprimento': med, 'max.comprimento': med })}
          onFiltrar={(med) => ajustarParams({ f: 'pronto', m: med || undefined })}
        />
      ) : <>

      {(filtro || medida) && filtro !== 'depois' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--suave)]">{t('Mostrando')}:</span>
          {filtro && <Pilula tom="marca">{t(nomeFiltro(filtro))}</Pilula>}
          {medida && <Pilula tom="marca">{medida} cm</Pilula>}
          <button type="button" onClick={() => ajustarParams({ f: undefined, m: undefined })} className="min-h-10 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">✕ {t('Ver tudo')}</button>
        </div>
      )}

      {/* a lista principal (ou o quadro, para quem escolher) */}
      <section id="triagem-separar" aria-label={t(visao === 'quadro' ? 'Quadro' : abaReal === 'depois' ? 'Para depois' : 'Para separar')} className="scroll-mt-4">
        <div className="mb-2 flex items-center gap-1">
          <h2 className="min-w-0 truncate text-lg font-bold">{t(visao === 'quadro' ? 'Quadro' : abaReal === 'depois' ? 'Para depois' : 'Para separar')}</h2>
          {visao !== 'quadro' && <Info texto={DICA_SEPARAR} />}
          {/* LEGENDA dos selos da lista (parado, etiqueta, para depois) */}
          {visao !== 'quadro' && <span className="ml-1 inline-flex items-center text-xs font-semibold text-[var(--suave)]">{t('Legenda')}<Info texto={t('parado: esperando para separar há mais de {n} dias (muda em Configurações › Etapas da compra). ✓ Etiqueta: já foi impressa (toque para ver ou reimprimir). 🏷 Sem etiqueta: ainda não imprimiu (toque para imprimir). ❓ para depois: ficou sem identificar numa separação. Ex.: “parado” + há 12 dias = está esperando faz tempo, separe primeiro.', { n: dados.diasParado })} /></span>}
          {/* os dois botões nunca quebram no meio da palavra ("Seleciona / r") no celular */}
          <span className="ml-auto flex shrink-0 items-center [&>button]:whitespace-nowrap [&>button]:px-2 sm:[&>button]:px-3">
            <Botao variante="leve" className="px-3" aria-pressed={comSelecao} onClick={() => { if (comSelecao) limparSel(); setSelecionando(!comSelecao) }}>{t(comSelecao ? 'Cancelar' : 'Selecionar')}</Botao>
            {/* no celular "Ver quadro" fica no ⚙ do topo (o título precisa do espaço) */}
            <Botao variante="leve" className="hidden px-3 sm:inline-flex" onClick={alternarQuadro}>{t(visao === 'quadro' ? 'Ver lista' : 'Ver quadro')}</Botao>
          </span>
        </div>

        {/* MISTURAR COMPRAS: com 2+ pacotes, mostra como juntar (ex.: compra 1 + compra 2 numa separação só); a origem
            de cada grama fica guardada (a ligação aparece no pacote novo e na triagem feita) */}
        {/* AS REGRAS DE JUNTAR, à vista (cada uma com ícone): mesma etapa · compras diferentes pode · saldo pequeno avisa */}
        {/* PRÓXIMO PASSO (sempre à vista): separar o mais antigo; juntar antes é opcional */}
        {visao !== 'quadro' && !comSelecao && abaReal === 'separar' && maisAntigo && (
          <div className="mb-3">
            <ProximoPasso agora="separar" titulo={t('Próximo passo: separar {c}', { c: maisAntigo.codigo ?? '' })}
              texto={<span className="text-[var(--suave)]">{t('É o que espera há mais tempo ({g}). Diga as partes por medida; o que sobrar é perda.', { g: gramasTexto(maisAntigo.saldo) })}{separarTodos.length >= 2 ? ` ${t('Mesma qualidade? Junte antes (opcional, logo abaixo).')}` : ''}</span>}
              acoes={<>
                <Botao disabled={ocupado} onClick={() => separar(maisAntigo.id)}>✂️ {t('Separar {c}', { c: maisAntigo.codigo ?? '' })}</Botao>
              </>} />
          </div>
        )}
        {visao !== 'quadro' && daAba.length >= 2 && (!comSelecao || sel.size < 2) && (
          <section aria-label={t('Como juntar pacotes')} className="mb-3 rounded-2xl border border-[var(--marca)]/40 bg-[var(--marca-suave)] p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {/* o título nunca espreme: os botões descem de linha quando não cabem */}
              <b className="min-w-[min(100%,14rem)] flex-1 text-sm">🔗 {t(comSelecao ? 'Marque os pacotes que vão juntos (2 ou mais)' : 'Juntar pacotes numa separação só')}</b>
              {/* as regras são de quem usa: o ⚙ muda aqui mesmo (vale para todos, na tela e no servidor) */}
              {admin && <Botao variante="leve" className="shrink-0" onClick={() => setJanela('regras')}>⚙ {t('Mudar regras')}</Botao>}
              {!comSelecao && <Botao variante="secundario" className="shrink-0" onClick={() => setSelecionando(true)}>☑ {t('Começar a marcar')}</Botao>}
            </div>
            <ul className="grid gap-1.5 text-xs sm:grid-cols-3">
              {[
                { icone: '📍', titulo: mesmaEtapa ? 'Uma etapa por vez' : 'Etapas misturadas: liberado', texto: mesmaEtapa ? 'Só junta quem está na mesma etapa do quadro. Ex.: todos em “Aguardando triagem”.' : 'Pode juntar pacotes de etapas diferentes (a regra está desligada).', ligado: mesmaEtapa },
                { icone: '🧬', titulo: 'Compras diferentes, pode', texto: 'Cada grama guarda de qual compra veio. Ex.: 2 kg da P-0005 + 4 kg da P-0007.', ligado: true },
                { icone: '⚠️', titulo: SALDO_PEQUENO > 0 ? t('Menos de {n} g: aviso', { n: SALDO_PEQUENO }) : 'Aviso de sobra: desligado', texto: SALDO_PEQUENO > 0 ? 'Sobra pequena: junte com outro ou ajuste como perda.' : 'Nenhum pacote é marcado como sobra pequena.', ligado: SALDO_PEQUENO > 0 },
              ].map((r) => (
                <li key={r.icone} className={cx('flex min-w-0 items-start gap-2.5 rounded-xl bg-[var(--cartao)] p-2.5', !r.ligado && 'opacity-70')}>
                  {/* o ícone num quadrado fixo: nunca encavala no texto, em qualquer largura */}
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fundo)] text-base leading-none">{r.icone}</span>
                  <span className="min-w-0 flex-1"><b className="block text-[var(--texto)] break-words">{t(r.titulo)}</b><span className="block text-[var(--suave)]">{t(r.texto)}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* FILTRO PADRÃO (o mesmo de Compras, Estoque e Etiquetas): busca + ⚙ Filtros → painel em grupos → resultado + chips ✕ */}
        {visao !== 'quadro' && daAba.length > 0 && (
          <FiltroLista
            className="mb-3"
            busca={busca} onBusca={setBusca} placeholder="Código, compra ou fornecedor" onKeyDown={pistola.onKeyDown}
            extra={<FiltroViagem nasLinhas={daAba.map((l) => l.compras.map((c) => c.viagem))} valor={fp('sv')} onChange={(v) => ajustarParams({ sv: v || undefined })} />}
            ativos={ativosFila} onTirar={(k) => ajustarParams({ [k]: undefined })} onLimpar={limparFila}
            resultados={paraSeparar.length} total={daAba.length} unidade="pacote(s)"
            painel={<>
                <GrupoFiltro titulo="De onde veio" icone="🛒">
                  <Campo rotulo="Fornecedor"><Selecao valor={fp('sf')} onChange={(v) => ajustarParams({ sf: v || undefined })} vazio="Todos" opcoes={fornecedoresFila.map((x) => ({ id: x, nome: x }))} /></Campo>
                  <Campo rotulo="Compra (código)"><Entrada placeholder={t('Ex.: P-0003')} value={fp('sc')} onChange={(e) => ajustarParams({ sc: e.target.value || undefined })} /></Campo>
                </GrupoFiltro>
                <GrupoFiltro titulo="Situação" icone="⏳">
                  <Campo rotulo="Parado há"><Selecao valor={fp('sd')} onChange={(v) => ajustarParams({ sd: v || undefined })} vazio="Qualquer tempo" opcoes={[{ id: '3', nome: t('3 dias ou mais') }, { id: '7', nome: t('7 dias ou mais') }, { id: '15', nome: t('15 dias ou mais') }]} /></Campo>
                  <Campo rotulo="Etiqueta"><Selecao valor={fp('set')} onChange={(v) => ajustarParams({ set: v || undefined })} vazio="Todas" opcoes={[{ id: 'sem', nome: t('Sem etiqueta') }, { id: 'com', nome: t('Com etiqueta') }]} /></Campo>
                </GrupoFiltro>
            </>}
          />
        )}

        {visao === 'quadro' ? (
          <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-2">
            {cols.map((c) => (
              <Coluna key={c.id} col={c} lotes={lotes.filter((l) => l.fase === c.id)} alvo={alvo === c.id} {...zona(c)} rodape={c.id === COLUNA_VENDIDO ? <VerVendidos dados={dados} todos={vendidos === 'todos'} onTodos={(v) => setVendidos(v ? 'todos' : '')} /> : undefined}>
                {(ls) => ls.map(cartao)}
              </Coluna>
            ))}
          </div>
        ) : !aguardando.length ? (
          // VAZIO que explica o que vem depois: de onde chega cabelo bruto (compra) e onde estão os pacotes prontos
          <div className="space-y-3 rounded-2xl border border-dashed border-[var(--borda)] px-4 py-6">
            <p className="text-center text-2xl font-bold">{t('Nada para separar 🎉')}</p>
            {prontosSemEtiqueta.length > 0 ? (
              <ProximoPasso agora="etiqueta" titulo={t(prontosSemEtiqueta.length === 1 ? 'Próximo passo: gerar 1 etiqueta' : 'Próximo passo: gerar {n} etiquetas', { n: prontosSemEtiqueta.length })}
                texto={<span className="text-[var(--suave)]">{t('Já separados, mas ainda sem etiqueta: com a etiqueta ficam prontos para vender.')}</span>}
                acoes={<Botao onClick={() => setImprimirProntos(prontosSemEtiqueta.map((l) => l.id))}>🏷 {t('Gerar as etiquetas')}</Botao>} />
            ) : (
              <ProximoPasso agora="pronto" tom="bom" titulo={t('Tudo pronto ✓ — os pacotes estão no estoque para vender')}
                texto={<span className="text-[var(--suave)]">{t('Cabelo bruto novo chega por uma compra: registre a compra e ele aparece aqui para separar.')}</span>}
                acoes={<>
                  {prontos.length > 0 && <Botao onClick={verPronto}>✅ {t('Ver os prontos')}</Botao>}
                  <Botao variante="secundario" onClick={() => ir('estoque', { modulo: 'cabelo' })}>📦 {t('Estoque')}</Botao>
                  {admin && <Botao variante="secundario" onClick={() => ir('novaCompra')}>🛒 {t('Nova compra')}</Botao>}
                </>} />
            )}
          </div>
        ) : !paraSeparar.length ? (
          <p className="rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>
        ) : (
          <Paginada itens={paraSeparar} unidade="pacote(s)" reiniciar={JSON.stringify([abaReal, busca, fp('sf'), fp('sc'), fp('sd'), fp('set'), filtro, medida])}>{(pagina) => (
            <div className="space-y-3">{etapasDaPagina(pagina).map((grupo) => (
            <section key={grupo.fase} aria-label={grupo.nome}>
              {/* a ETAPA: nome · quantos e quanto pesa · selecionar todos desta etapa (só quando há mais de uma etapa) */}
              {grupo.varias && (
                <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 text-sm">
                  <b className="flex items-center gap-1.5">📍 {t(grupo.nome)}</b>
                  <span className="num text-xs text-[var(--suave)]">{t('{n} pacote(s)', { n: grupo.todos.length })} · {gramasTexto(grupo.todos.reduce((x, l) => x + l.saldo, 0))}</span>
                  {grupo.todos.length >= 2 && <Botao variante="leve" className="ml-auto" onClick={() => (setSelecionando(true), setSel(new Set(grupo.todos.map((l) => l.id))))}>☑ {t('Selecionar todos desta etapa')}</Botao>}
                </div>
              )}
            {/* LISTAGEM PADRÃO (TabelaDados, como Compras): colunas no computador, a linha padrão no celular */}
            <TabelaDados
              linhas={grupo.ls}
              chave={(l) => l.id}
              onAbrir={(l) => ir('lote', { id: l.id })}
              rotuloAbrir="Abrir lote"
              rotuloLinha={(l) => `${l.codigo ?? ''} · ${rotuloCurto(l, t)}`}
              acoes={menuDe}
              acaoRapida={(l) => { const acao = acaoDe(l); return acao ? <Botao className="min-h-10 whitespace-nowrap px-4" disabled={ocupado} onClick={acao.f}>{t(acao.rotulo)}</Botao> : null }}
              realce={(l) => (sel.has(l.id) ? 'marcada' : undefined)}
              selecao={comSelecao ? {
                marcados: sel,
                onAlternar: (id) => marcar(id, !sel.has(id)),
                onTodos: () => setSel(grupo.ls.every((l) => sel.has(l.id)) ? new Set() : new Set(grupo.todos.map((l) => l.id))),
                rotulo: (id) => t('Selecionar {c}', { c: grupo.ls.find((l) => l.id === id)?.codigo ?? '' }),
                desabilitado: (id) => { const l = grupo.ls.find((x) => x.id === id); return l && foraDaEtapa(l) ? t('Está em “{a}”; a seleção é de “{b}”. Só junta quem está na mesma etapa.', { a: colDe(l.fase)?.nome ?? l.fase, b: colDe(etapaSel ?? '')?.nome ?? '' }) : undefined },
              } : undefined}
              colunas={[
                { id: 'foto', titulo: '', classe: 'w-14', celula: (l) => <FotoOuIcone l={l} /> },
                { id: 'pacote', titulo: 'Pacote', classe: 'min-w-[12rem]', celula: (l) => {
                  const col = colDe(l.fase)
                  return <>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><SeloCodigo codigo={l.codigo} /><b>{rotuloCurto(l, t)}</b></span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {comSelecao && foraDaEtapa(l) && <button type="button" onClick={(e) => (e.stopPropagation(), setSel(new Set([l.id])))} title={t('Está em “{a}”; a seleção é de “{b}”. Só junta quem está na mesma etapa.', { a: colDe(l.fase)?.nome ?? l.fase, b: colDe(etapaSel ?? '')?.nome ?? '' })} className="inline-flex min-h-7 items-center gap-1 rounded-full border border-dashed border-[var(--borda)] bg-[var(--cartao)] px-2 text-xs font-semibold text-[var(--suave)] hover:border-[var(--marca)] hover:text-[var(--marca)]">🔒 {t('outra etapa')} · {t('começar com este')}</button>}
                      {sobraPequena(l) && <span title={t('Sobra pequena: junte com outro ou ajuste como perda.')}><Pilula pequena tom="alerta">⚠️ {t('só {g}', { g: gramasTexto(l.saldo) })}</Pilula></span>}
                      {l.campos.estado === NAO_ID && <Pilula pequena tom="alerta">❓ {t('para depois')}</Pilula>}
                      {col && !col.entrada && <Pilula pequena>{t(col.nome)}</Pilula>}
                      {seloMistura(l)}
                    </span>
                  </>
                } },
                { id: 'peso', titulo: 'Peso', direita: true, celula: (l) => <b>{gramasTexto(l.saldo)}</b> },
                { id: 'origem', titulo: 'Veio de', classe: 'max-w-[14rem]', celula: (l) => <span className="block truncate">{[...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))].join(', ') || '—'}<span className="block truncate text-xs text-[var(--suave)]">{l.compras.map((c) => c.codigo).filter(Boolean).join(' + ')}</span><span className="mt-1 block"><SelosViagem vs={viagensDasLinhas(l.compras.map((c) => c.viagem))} curto /></span></span> },
                { id: 'espera', titulo: 'Esperando', direita: true, celula: (l) => <span className={cx('whitespace-nowrap', l.atrasado ? 'font-semibold text-[var(--ruim)]' : 'text-[var(--suave)]')} title={l.atrasado ? t('Esperando para separar há mais de {n} dias', { n: dados.diasParado }) : undefined}>{l.atrasado && '⏰ '}{!l.dias ? t('hoje') : l.dias === 1 ? t('há 1 dia') : t('há {n} dias', { n: l.dias })}</span> },
                { id: 'etiqueta', titulo: 'Etiqueta', classe: 'whitespace-nowrap', celula: (l) => <SeloEtiqueta id={l.id} impressaEm={l.etiqueta.impressaEm} por={l.etiqueta.por} via={l.etiqueta.via} /> },
              ]}
              // celular: a mesma linha padrão do Comprar e do Vender (a etiqueta sempre à vista; Separar ao abrir)
              celular={{
                titulo: (l) => rotuloCurto(l, t),
                valor: (l) => gramasTexto(l.saldo),
                valorSub: (l) => (!l.dias ? t('hoje') : l.dias === 1 ? t('há 1 dia') : t('há {n} dias', { n: l.dias })),
                resumo: (l) => [...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))].join(', ') || undefined,
                codigo: (l) => l.codigo,
                situacao: (l) => { const col = colDe(l.fase); return col && !col.entrada ? { texto: col.nome, tom: 'marca' } : undefined },
                alerta: (l) => (l.atrasado ? { texto: t('parado'), tom: 'ruim' } : sobraPequena(l) ? { texto: t('só {g}', { g: gramasTexto(l.saldo) }), tom: 'alerta' } : l.campos.estado === NAO_ID ? { texto: t('para depois'), tom: 'alerta' } : undefined),
                marca: (l) => <><SelosViagem vs={viagensDasLinhas(l.compras.map((c) => c.viagem))} curto soLeitura /><SeloEtiqueta soLeitura id={l.id} impressaEm={l.etiqueta.impressaEm} por={l.etiqueta.por} via={l.etiqueta.via} /></>,
                fatos: (l) => [...l.compras.map((c) => `🛒 ${c.codigo ?? ''}`), l.pai && `🧬 ${t('separado de')} ${l.pai.codigo ?? '?'}`],
                aberto: (l) => !(comSelecao && foraDaEtapa(l)) ? <div className="space-y-2">{seloMistura(l)}<p className="text-xs font-semibold text-[var(--marca)]">👉 {proximoDoLote(l)}</p></div> : <button type="button" onClick={() => setSel(new Set([l.id]))} className="min-h-10 rounded-full border border-dashed border-[var(--borda)] px-3 text-xs font-semibold text-[var(--suave)]">🔒 {t('outra etapa')} · {t('começar com este')}</button>,
              }}
            />
            </section>
          ))}</div>
          )}</Paginada>
        )}
      </section>

      </>}
      {/* PAINEL DA SELEÇÃO (padrão): o que foi marcado — cor, código, peso e compra de cada pacote — e as opções explicadas */}
      {sel.size > 0 && (() => {
        const varios = selecionados.length > 1
        const temVendido = selecionados.some((l) => l.fase === COLUNA_VENDIDO)
        const compras = [...new Map(selecionados.flatMap((l) => l.compras).map((c) => [c.id, c])).values()]
        const gSel = selecionados.reduce((s, l) => s + l.saldo, 0)
        const custoKg = gSel && selecionados.every((l) => l.custo !== undefined) ? Math.round((selecionados.reduce((s, l) => s + (l.custo ?? 0), 0) * 1000) / gSel) : undefined
        return (
          <PainelSelecao
            itens={selecionados.map((l) => ({ id: l.id, codigo: l.codigo, peso: l.saldo, alerta: sobraPequena(l), detalhe: [l.compras[0]?.codigo, l.compras[0]?.fornecedor].filter(Boolean).join(' · ') }))}
            fatos={[{ icone: '📍', texto: `${t('Etapa')}: ${colDe(etapaSel ?? '')?.nome ?? '—'}` }, ...(compras.length ? [{ icone: '🛒', texto: t(compras.length === 1 ? 'de 1 compra' : 'de {n} compras', { n: compras.length }) }] : []), ...(custoKg !== undefined ? [{ icone: '💵', texto: `${t('custo médio')} ${formatar(custoKg, moedaPadrao())}/kg` }] : [])]}
            aviso={[
              ...(selecionados.some(sobraPequena) ? [`⚠️ ${t('Sobra pequena em {c}: junte com outro ou ajuste como perda.', { c: selecionados.filter(sobraPequena).map((l) => `${l.codigo ?? ''} (${gramasTexto(l.saldo)})`).join(', ') })}`] : []),
              ...(varios && compras.length > 1 ? [`🧬 ${t('Misturando compras: cada grama guarda de qual compra veio (aparece no pacote novo e na venda).')}`] : []),
            ].join('  ') || undefined}
            ocupado={ocupado}
            onTirar={(id) => marcar(id, false)}
            onLimpar={() => (limparSel(), setSelecionando(false))}
            opcoes={[
              { id: 'separar', icone: '✂️', principal: true, onClick: () => ir('separar', { ids: selecionados.map((l) => l.id).join(','), volta: 'triagem' }),
                titulo: varios ? 'Juntar e separar' : 'Separar',
                legenda: varios ? 'Tudo numa separação só: você diz as partes por medida.' : 'Diga as partes por medida; o que sobra é perda.',
                ajuda: varios ? DICA_JUNTAR : DICA_SEPARAR, desligado: temVendido ? 'Tem pacote já vendido na seleção.' : undefined },
              { id: 'juntar', icone: '🔗', onClick: () => setJanela('unificar'),
                titulo: 'Só juntar', legenda: 'Vira um pacote só agora, com o peso somado; separa depois.',
                ajuda: 'Junta sem separar: nasce um pacote novo com o peso de todos. Ex.: 1,2 kg + 3 kg → um pacote de 4,2 kg. Cada grama continua sabendo de qual compra veio.',
                desligado: !varios ? 'Marque 2 ou mais pacotes para juntar.' : temVendido ? 'Tem pacote já vendido na seleção.' : undefined },
              { id: 'etiquetas', icone: '🏷', onClick: () => ir('etiquetas', { f: 'todas', sel: [...sel].join(',') }),
                titulo: 'Etiquetas', legenda: 'Imprimir (ou reimprimir) as etiquetas destes pacotes.',
                ajuda: 'Abre a tela Etiquetas com estes pacotes já marcados. Ex.: 2 pacotes sem etiqueta → imprime as 2 de uma vez.' },
            ]}
            ajudaMais="Mudam só a ETAPA dos pacotes no quadro da triagem (não dividem nem mudam o peso). Ex.: foi lavar → Mover para “Lavando”; já veio separado → Marcar como triado."
            mais={[
              ...(primeiraPronta && brutos ? [{ rotulo: 'Marcar como triado', icone: '✓', descricao: `${t('Vão para')} “${primeiraPronta.nome}” ${t('sem dividir: ficam prontos para vender.')}`, onClick: () => setJanela('triado') }] : []),
              ...trabalho.map((c, k) => ({ rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', descricao: c.pronto ? t('Conta como pronto para vender. O peso não muda.') : t('Só muda a etapa no quadro (ex.: foi lavar). O peso não muda.'), separar: k === 0 && !!primeiraPronta && brutos, onClick: () => { const ids = selecionados.filter((l) => l.fase !== c.id && l.fase !== COLUNA_VENDIDO).map((l) => l.id); if (ids.length) mover(ids, c.id) } })),
            ]}
          />
        )
      })()}

      {janela === 'regras' && <RegrasJuntar mesmaEtapa={mesmaEtapa} saldoPequeno={SALDO_PEQUENO} onFechar={() => setJanela(undefined)} />}
      {janela === 'unificar' && <Unificar lotes={selecionados} campos={campos} onFechar={() => setJanela(undefined)} onFeito={limparSel} />}
      {janela === 'triado' && primeiraPronta && (
        <Confirmar
          titulo="Marcar como triado?"
          texto={t('{n} lote(s) vão para “{c}” sem dividir: ficam prontos para vender. Fica no histórico.', { n: selecionados.length, c: primeiraPronta.nome })}
          rotulo="Marcar como triado"
          onConfirmar={() => mover(selecionados.map((l) => l.id), primeiraPronta.id)}
          onFechar={() => setJanela(undefined)}
        />
      )}
      {pesar && <PesoDepois lotes={pesar.ids.map((id) => dados.lotes.find((l) => l.id === id)).filter((l): l is Lote => !!l)} destino={colDe(pesar.fase)?.nome ?? pesar.fase} ocupado={ocupado} onFechar={() => setPesar(undefined)} onMover={async (pesos) => { setPesar(undefined); await mover(pesar.ids, pesar.fase, pesos) }} />}
      {desfazer && <DesfazerMistura loteId={desfazer} onFechar={() => setDesfazer(undefined)} onFeito={limparSel} />}
      {imprimirProntos && <ImprimirEtiquetas ids={imprimirProntos} onFechar={() => setImprimirProntos(undefined)} />}
      {editar && <EditarAtributos id={editar.id} campos={campos} valores={editar.campos} onFechar={() => setEditar(undefined)} />}
      {trocar && <TrocarCodigo tipo="lote" id={trocar.id} atual={trocar.codigo} onFechar={() => setTrocar(undefined)} />}
      {lendo && <LeitorCodigo onLer={(c) => (setLendo(false), setBuscaAberta(true), setBusca(c))} onFechar={() => setLendo(false)} />}
    </div>
  )
}


/** Foto do lote; sem foto, um ícone neutro (tocar abre a câmera). */
function FotoOuIcone({ l }: { l: Lote }) {
  const t = useT()
  const { tirar, enviando } = useTirarFoto()
  if (l.foto) return <MiniaturaLote itemId={l.id} foto={l.foto} />
  return (
    <button type="button" disabled={enviando} onClick={(e) => (e.stopPropagation(), tirar(l.id))} title={t('Tirar a primeira foto deste lote')} aria-label={t('Tirar a primeira foto deste lote')} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-[var(--suave)] hover:text-[var(--marca)]">
      {enviando ? '…' : <Icone nome="estoque" className="h-6 w-6" />}
    </button>
  )
}

/**
 * PRONTO PARA VENDER: fechado numa linha ("✅ 19,4 kg prontos · Bs 183.972 ›"); aberto, por medida (abre e fecha) e cada
 * LOTE numa linha com origem, gramas, valor, margem, Vender e "⋯".
 */
function ProntoParaVender({ lotes, totalLotes, busca, onBusca, onKeyDown, total, valor, onLote, onVender, onEstoque, onFiltrar }: { lotes: Lote[]; totalLotes: number; busca: string; onBusca(v: string): void; onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void; total: number; valor: number; menuDe?(l: Lote): Acao[]; onLote(id: Id): void; onVender(p: Params): void; onEstoque(med: string): void; onFiltrar(med: string): void }) {
  const t = useT()
  const { ajustarParams } = useApp()
  const m = moedaPadrao()
  const secaoAberta = true
  const filtro = useFiltroProntos()
  // filtros abertos quando já há algum ligado (vindo de um link) ou quando a pessoa toca em "⚙ Filtros"
  const [verFiltrosEscolha, setVerFiltros] = useState<boolean>()
  const verFiltros = verFiltrosEscolha ?? filtro.ativo
  const todosFiltrados = filtrarProntos(lotes, filtro.f)
  // etiqueta à vista: 'N sem etiqueta' filtra (?se=1) e 'Imprimir N' imprime de uma vez
  const [soSem, setSoSem] = useParamTela('se', '')
  const [imprimir, setImprimir] = useState<Id[]>()
  const semEtiqueta = todosFiltrados.filter((l) => !l.etiqueta.impressaEm)
  const filtrados = soSem && semEtiqueta.length ? semEtiqueta : todosFiltrados
  const ordem = agruparProntos(filtrados, filtro.f, t)
  // o que está ligado (chips) e o "Limpar filtros" (medida, faixa, peso, só sem etiqueta e a busca)
  const ativosP = [...ativosProntos(filtro.f), ...(soSem ? [{ k: 'se', rotulo: `🏷 ${t('Sem etiqueta')}` }] : [])]
  const filtrando = ativosP.length > 0 || !!busca.trim()
  const limparP = () => ajustarParams({ ...Object.fromEntries(PARAMS_PRONTOS.map((k) => [k, undefined])), se: undefined, busca: undefined })
  const gFiltrado = filtrados.reduce((s, l) => s + l.saldo, 0)
  const vFiltrado = filtrados.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
  // grupos fechados (o resto abre sozinho quando há poucos lotes); muda de "Agrupar por" → recomeça
  const [fechados, setFechados] = useState<{ por: string; k: Set<string> }>({ por: '', k: new Set() })
  const fechadosAgora = fechados.por === filtro.f.agrupar + filtro.f.passo ? fechados.k : new Set<string>()
  const poucos = filtrados.length <= MAX_PRONTOS || ordem.length === 1
  const abertos = new Set(ordem.map((g) => g.chave).filter((k) => (poucos ? !fechadosAgora.has(k) : fechadosAgora.has(k))))
  const [todos, setTodos] = useState<Set<string>>(new Set())
  const semPreco = lotes.filter((l) => l.semPreco).length
  // em "fechados" fica o que o usuário inverteu (fechou quando abre sozinho; abriu quando começa fechado)
  const alternar = (k: string) => setFechados(() => { const n = new Set(fechadosAgora); if (n.has(k)) n.delete(k); else n.add(k); return { por: filtro.f.agrupar + filtro.f.passo, k: n } })
  return (
    // aba "Prontos": o total numa linha e os filtros (medida, peso, agrupar) atrás do botão padrão "⚙ Filtros"
    <section id="triagem-pronto" aria-label={t('Pronto para vender')} className="scroll-mt-4">
      <div className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="num flex min-h-14 items-center gap-2 px-3 sm:px-4">
        <span className="min-w-0 flex-1 truncate text-base">
          {/* a aba já diz "Prontos": aqui só o peso e o valor (cabe no celular) */}
          <b>{gramasTexto(total)}</b>
          {valor > 0 && <span className="text-[var(--suave)]"> · {formatar(valor, m)}</span>}
        </span>
        <Info texto={DICA_PRONTOS} />
        {semPreco > 0 && <Pilula tom="alerta">⚠️ {semPreco}</Pilula>}
      </div>
      {secaoAberta && <div className="px-2 pb-2 sm:px-4 sm:pb-4">
      {/* FILTRO PADRÃO: busca + ⚙ Filtros (medida · peso · como mostrar) → resultado (peso e valor do filtrado) + chips ✕ */}
      {totalLotes > 0 && (
        <FiltroLista
          className="mb-3"
          busca={busca} onBusca={onBusca} placeholder="Código, compra ou fornecedor" onKeyDown={onKeyDown}
          ativos={ativosP} onTirar={(k) => ajustarParams(Object.fromEntries(k.split(',').map((x) => [x, undefined])))} onLimpar={limparP}
          resultados={filtrados.length} total={totalLotes} unidade="lote(s)"
          detalhe={filtrando && <>{gramasTexto(gFiltrado)}{vFiltrado > 0 && ` · ${formatar(vFiltrado, m)}`}</>}
          aberto={verFiltros} onAberto={setVerFiltros}
          painel={<FiltrosProntos todos={lotes} filtro={filtro} />}
        />
      )}
      {todosFiltrados.length > 0 && (
        // ETIQUETAS dos prontos numa faixa que se explica: o que falta · ver só eles · imprimir todos de uma vez
        semEtiqueta.length ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--alerta)]/40 bg-[var(--alerta)]/10 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 font-semibold text-[var(--alerta)]">🏷 {t(semEtiqueta.length === 1 ? '1 pacote pronto está sem etiqueta' : '{n} pacotes prontos estão sem etiqueta', { n: semEtiqueta.length })}</span>
            <Botao variante="leve" aria-pressed={!!soSem} onClick={() => setSoSem(soSem ? '' : '1')}>{t(soSem ? 'Ver todos' : 'Ver só eles')}</Botao>
            <Botao onClick={() => setImprimir(semEtiqueta.map((l) => l.id))}>🖨 {t(semEtiqueta.length === 1 ? 'Imprimir a etiqueta' : 'Imprimir as {n}', { n: semEtiqueta.length })}</Botao>
          </div>
        ) : <p className="mb-3 rounded-xl bg-[var(--bom)]/10 px-3 py-2 text-sm font-semibold text-[var(--bom)]">✓ {t('Todos com etiqueta')}</p>
      )}
      {imprimir && <ImprimirEtiquetas ids={imprimir} onImpresso={() => setSoSem('')} onFechar={() => setImprimir(undefined)} />}
      {semPreco > 0 && <p className="mb-2 rounded-xl bg-[var(--alerta)]/10 p-2 text-sm font-semibold text-[var(--alerta)]">⚠️ {t('{n} lote(s) triado(s) sem preço na tabela', { n: semPreco })}</p>}
      {!totalLotes ? <Vazio compacto texto="Nada triado ainda: separe um lote para começar a vender." /> : !filtrados.length ? <VazioFiltro texto="Nenhum lote com esses filtros." filtrando={filtrando} onLimpar={limparP} /> : (
        // tabela por grupo: Medida | Lotes | Peso | Valor | ⋯ (cabeçalho em cima, total embaixo); tocar na linha abre os lotes
        <div className="overflow-hidden rounded-xl border border-[var(--borda)]">
          {filtro.f.agrupar !== 'nenhum' && (
            <p className="bg-[var(--fundo)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Por {g}', { g: t(NOME_GRUPO[filtro.f.agrupar] ?? 'Grupo').toLowerCase() })} · {t('toque para ver os lotes')}</p>
          )}
          {ordem.map(({ chave: med, rotulo, medida, lotes: ls }) => {
            const aberto = abertos.has(med)
            const semCabecalho = filtro.f.agrupar === 'nenhum'
            const mostrar = todos.has(med) ? ls : ls.slice(0, MAX_PRONTOS)
            const g = ls.reduce((s, l) => s + l.saldo, 0)
            const v = ls.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
            return (
              <div key={med} className="border-t border-[var(--borda)] first:border-t-0">
                {!semCabecalho && <div className={cx('num flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3', aberto ? 'bg-[var(--marca-suave)]' : 'hover:bg-[var(--marca-suave)]/50')}>
                  <button type="button" aria-expanded={aberto} onClick={() => alternar(med)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left">
                    {/* a medida em destaque */}
                    <span className="flex h-11 min-w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--cartao)] px-2 text-base font-black shadow-sm ring-1 ring-[var(--borda)]">{rotulo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm text-[var(--suave)]"><b className="text-[var(--texto)]">{gramasTexto(g)}</b> · {t('{n} lote(s)', { n: ls.length })}</span>
                        <b className="whitespace-nowrap text-base">{v ? formatar(v, m) : '—'}</b>
                      </span>
                      {/* quanto este grupo pesa no total do que está pronto */}
                      <span aria-hidden className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--fundo)]"><span className="block h-full rounded-full bg-[var(--bom)]" style={{ width: `${Math.max(2, Math.round((g * 100) / Math.max(gFiltrado, 1)))}%` }} /></span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--borda)] bg-[var(--cartao)] px-2.5 py-1 text-xs font-semibold text-[var(--marca)] sm:inline-flex">{t(aberto ? 'Esconder' : 'Ver lotes')} <span aria-hidden className={cx('transition-transform', aberto && 'rotate-180')}>▾</span></span>
                    <span aria-hidden className={cx('shrink-0 text-[var(--suave)] transition-transform sm:hidden', aberto && 'rotate-90')}>›</span>
                  </button>
                  <MenuAcoes acoes={[
                    { rotulo: aberto ? 'Esconder os lotes' : 'Mostrar os lotes', icone: aberto ? '▴' : '▾', onClick: () => alternar(med) },
                    ...(medida ? [
                      { rotulo: 'Ver lotes desta medida no estoque', icone: '📦', onClick: () => onEstoque(medida) },
                      { rotulo: 'Só esta medida no quadro', icone: '🔍', onClick: () => onFiltrar(medida) },
                      { rotulo: 'Vender esta medida', icone: '💰', onClick: () => onVender({ medida, categoria: String(ls[0].campos.categoria || 'Normal') }) },
                    ] : []),
                  ]} />
                </div>}
                {(aberto || semCabecalho) && (
                  <ul className={cx('divide-y divide-[var(--borda)]', !semCabecalho && 'border-t border-[var(--borda)] sm:pl-5')}>
                    {/* um lote = uma linha nas mesmas colunas da tabela: código · peso · valor · 💰 (tocar abre o pacote,
                        onde estão foto, origem, margem e o resto) */}
                    {mostrar.map((l) => {
                      const valorLote = l.preco
                        ? <span className="whitespace-nowrap">{formatar(l.preco.valor, l.preco.moeda)}</span>
                        : <span className="text-xs font-semibold text-[var(--alerta)]">⚠️ {t(l.semPreco === 'medida' ? 'sem medida' : 'sem preço')}</span>
                      const semEtq = !l.etiqueta.impressaEm && <span title={t('Sem etiqueta')} aria-label={t('Sem etiqueta')} className="shrink-0 text-xs">🏷</span>
                      const vender = <button type="button" aria-label={`${t('Vender')} ${l.codigo ?? ''}`} title={t('Vender')} onClick={(e) => (e.stopPropagation(), onVender({ lote: l.id }))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--marca-suave)]">💰</button>
                      return (
                        <li key={l.id} {...clicavel(() => onLote(l.id))} className="num cursor-pointer px-2 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
                          {/* celular: código inteiro + peso embaixo | valor + 💰 */}
                          <span className="flex min-h-12 items-center gap-2 py-1 pl-3.5 sm:hidden">
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1"><b className="font-mono">{l.codigo}</b>{semEtq}</span>
                              <span className="block text-xs text-[var(--suave)]">{gramasTexto(l.saldo)}</span>
                            </span>
                            <span className="text-right">{valorLote}</span>
                            {vender}
                          </span>
                          {/* computador: nas colunas da tabela */}
                          <span className={cx(GRADE_PRONTOS, 'hidden min-h-11 sm:grid')}>
                            <span className="flex min-w-0 items-center gap-1 pl-5"><b className="truncate font-mono">{l.codigo}</b>{semEtq}</span>
                            <span />
                            <span className="whitespace-nowrap text-right">{gramasTexto(l.saldo)}</span>
                            <span className="text-right">{valorLote}</span>
                            {vender}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {(aberto || semCabecalho) && ls.length > MAX_PRONTOS && (
                  <button type="button" onClick={() => setTodos((s) => { const n = new Set(s); if (n.has(med)) n.delete(med); else n.add(med); return n })} className="min-h-10 w-full text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                    {todos.has(med) ? t('Mostrar menos') : t('Ver todos ({n})', { n: ls.length })}
                  </button>
                )}
              </div>
            )
          })}
          {/* total de tudo o que está na tabela */}
          {/* TOTAL em destaque (bloco próprio, não mais uma linha grudada na tabela) */}
          {ordem.length > 1 && (
            <div className="num flex items-center justify-between gap-3 border-t-2 border-[var(--marca)] bg-[var(--marca-suave)] px-4 py-3">
              <span>
                <b className="block text-base text-[var(--marca)]">{t('Total')}</b>
                <span className="block text-xs text-[var(--suave)]">{t('{n} lote(s)', { n: filtrados.length })}</span>
              </span>
              <span className="text-right">
                <b className="block whitespace-nowrap text-lg">{formatar(filtrados.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0), m)}</b>
                <span className="block whitespace-nowrap text-sm text-[var(--suave)]">{gramasTexto(filtrados.reduce((s, l) => s + l.saldo, 0))}</span>
              </span>
            </div>
          )}
        </div>
      )}
      </div>}
      </div>
    </section>
  )
}


function Coluna({ col, lotes, children, alvo, lista, rodape, ...zona }: { col: ColunaTriagem; lotes: Lote[]; children(ls: Lote[]): ReactNode; alvo?: boolean; lista?: boolean; rodape?: ReactNode; onDragOver?(e: DragEvent): void; onDragLeave?(): void; onDrop?(e: DragEvent): void }) {
  const t = useT()
  const [mais, setMais] = useState(false)
  const visiveis = mais ? lotes : lotes.slice(0, MAX_COLUNA)
  const vazio = col.ajuda || (col.entrada ? 'Os lotes brutos das compras caem aqui.' : col.pronto ? 'Lotes prontos para vender aparecem aqui.' : col.id === COLUNA_VENDIDO ? 'Lotes que acabaram nos últimos 30 dias aparecem aqui.' : 'Arraste lotes para cá.')
  return (
    <section
      aria-label={t(col.nome)}
      {...zona}
      className={cx('min-w-0 rounded-2xl border-2 p-2 transition', lista ? '' : 'w-[17rem] shrink-0 bg-[var(--fundo)] xl:w-auto xl:min-w-[17rem] xl:flex-1', alvo ? 'border-dashed border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-transparent')}
    >
      <header className="mb-2 flex items-start gap-2 px-1">
        <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: corDe(col) }} />
        <h2 className="min-w-0 flex-1 font-bold leading-tight">{t(col.nome)}{col.pronto && <span className="ml-1 text-xs font-semibold text-[var(--bom)]">💰</span>}</h2>
        <span className="num shrink-0 whitespace-nowrap text-sm text-[var(--suave)]">{lotes.length} · {gramasTexto(lotes.reduce((s, l) => s + l.saldo, 0))}</span>
      </header>
      {!lotes.length ? (
        <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t(vazio)}</p>
      ) : (
        <ul className={cx(lista ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2')}>{children(visiveis)}</ul>
      )}
      {lotes.length > MAX_COLUNA && (
        <button type="button" onClick={() => setMais(!mais)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{mais ? t('Mostrar menos') : t('Ver mais ({n})', { n: lotes.length - MAX_COLUNA })}</button>
      )}
      {rodape}
    </section>
  )
}

function VerVendidos({ dados, todos, onTodos }: { dados: Dados; todos: boolean; onTodos(v: boolean): void }) {
  const t = useT()
  if (!todos && !dados.vendidosOcultos) return null
  return (
    <button type="button" onClick={() => onTodos(!todos)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
      {todos ? t('Só os últimos 30 dias') : t('Ver mais ({n} mais antigos)', { n: dados.vendidosOcultos })}
    </button>
  )
}

function CartaoLote(p: {
  l: Lote
  col?: ColunaTriagem
  marcado: boolean
  arrastavel: boolean
  ocupado: boolean
  acao?: { rotulo: string; f(): void }
  selecionavel: boolean
  menu: Acao[]
  onMarcar(v: boolean): void
  onArrastar(e: DragEvent): void
  onSoltar(): void
  onAbrir(): void
}) {
  const t = useT()
  const { l, col } = p
  const m = moedaPadrao()
  const vendido = l.fase === COLUNA_VENDIDO
  const pct = l.preco && l.margem !== undefined && l.preco.valorPrincipal ? Math.round((l.margem * 10000) / l.preco.valorPrincipal) : undefined
  return (
    <li
      draggable={p.arrastavel}
      onDragStart={p.onArrastar}
      onDragEnd={p.onSoltar}
      className={cx('min-w-0 list-none rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm transition', p.marcado ? 'border-[var(--marca)] ring-2 ring-[var(--marca)]' : 'border-[var(--borda)]', p.arrastavel && 'cursor-grab active:cursor-grabbing', vendido && 'opacity-75')}
    >
      <div className="flex items-center gap-2">
        {!vendido && p.selecionavel && <input type="checkbox" className="h-5 w-5 shrink-0" checked={p.marcado} onChange={(e) => p.onMarcar(e.target.checked)} aria-label={t('Selecionar {c}', { c: l.codigo ?? l.nome })} />}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="font-mono text-xs text-[var(--suave)]">{l.codigo}</span>
          {l.unificado > 0 && <Pilula tom="marca">🔗 {t('{n} lotes', { n: l.unificado })}</Pilula>}
          {l.campos.estado === NAO_ID && <Pilula tom="alerta">❓ {t('Não identificado')}</Pilula>}
          {l.atrasado && <Pilula tom="ruim">⏳ {t('{n} d', { n: l.dias })}</Pilula>}
          {!vendido && <SeloEtiqueta id={l.id} impressaEm={l.etiqueta.impressaEm} por={l.etiqueta.por} via={l.etiqueta.via} />}
        </span>
        <span className="num shrink-0 whitespace-nowrap text-xl font-black">{gramasTexto(l.saldo)}</span>
        <MenuAcoes acoes={p.menu} />
      </div>
      <div className="mt-1 flex items-start gap-2">
        <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} />
        <button type="button" onClick={p.onAbrir} className="block min-w-0 flex-1 text-left font-semibold leading-tight break-words hover:underline">{l.nome}</button>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-[var(--suave)]">
        <CadeiaChips cadeia={l.cadeia} />
        {(l.pai || l.unificadoDe?.length) && <p className="break-words">{l.pai ? `${t('separado de')} ${l.pai.codigo ?? '?'}` : `${t('unificado de')} ${l.unificadoDe!.map((x) => x.codigo ?? '?').join(' + ')}`}</p>}
        <p className="num">
          {vendido ? `${t('vendido em')} ${dataBR(l.vendidoEm)}` : col?.pronto ? `${t('desde')} ${dataBR(l.desde)}` : t('há {n} dia(s) nesta coluna', { n: l.dias })}
          {l.custoKg !== undefined && !col?.pronto && !vendido && ` · ${formatar(l.custoKg, m)}/kg`}
        </p>
        {l.obs && <p className="italic">“{l.obs}”</p>}
        {col?.exigirFoto && !l.fotosProprias && !vendido ? (
          <p className="font-semibold text-[var(--ruim)]"><LinkTirarFoto itemId={l.id}>📷 {t('Foto obrigatória para sair daqui: tirar agora')}</LinkTirarFoto></p>
        ) : col?.lembrarFotos && !l.fotosProprias && !vendido ? (
          <p className="font-semibold text-[var(--alerta)]"><LinkTirarFoto itemId={l.id}>📷 {t('Lembre das fotos: tirar agora')}</LinkTirarFoto></p>
        ) : null}
      </div>
      {col?.pronto && (
        <div className="mt-2 rounded-xl bg-[var(--fundo)] p-2">
          {l.preco ? (
            <>
              <p className="num text-sm"><b className="whitespace-nowrap text-base">{formatar(l.preco.valor, l.preco.moeda)}</b> <span className="whitespace-nowrap text-xs text-[var(--suave)]">{gramasTexto(l.saldo)} × {l.preco.fator} · {l.preco.coluna}</span></p>
              {l.margem !== undefined && <p className={cx('num text-xs font-semibold', l.margem < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{t('margem')} <span className="whitespace-nowrap">{formatar(l.margem, m)}</span>{pct !== undefined && <span className="whitespace-nowrap"> ({fmt(pct, 'percentual')})</span>}</p>}
            </>
          ) : (
            <p className="text-xs font-semibold text-[var(--alerta)]">⚠️ {l.semPreco === 'medida' ? t('sem medida: edite para ter preço') : t('sem preço na tabela')}</p>
          )}
        </div>
      )}
      {p.acao && (
        <div className="mt-2 flex">
          <Botao className="min-w-0 flex-1 break-words" disabled={p.ocupado} onClick={p.acao.f}>{t(p.acao.rotulo)}</Botao>
        </div>
      )}
    </li>
  )
}

/** Saiu da lavagem: peso depois de cada lote (opcional). A diferença vira "perda de lavagem" no livro (antes → depois). */
function PesoDepois({ lotes, destino, ocupado, onFechar, onMover }: { lotes: Lote[]; destino: string; ocupado: boolean; onFechar(): void; onMover(pesos: Record<Id, number | undefined>): void }) {
  const t = useT()
  const [pesos, setPesos] = useState<Record<Id, number | undefined>>({})
  return (
    <Janela aberta titulo={<span className="inline-flex items-center">{t('Peso depois da lavagem')}<Info texto={DICA_LAVAGEM} /></span>} onFechar={onFechar} rodape={
      <div className="flex gap-2">
        <Botao variante="leve" className="flex-1" disabled={ocupado} onClick={() => onMover({})}>{t('Pular')}</Botao>
        <Botao grande className="flex-1" disabled={ocupado} onClick={() => onMover(pesos)}>→ {destino}</Botao>
      </div>
    }>
      <div className="space-y-3">
        <p className="text-sm text-[var(--suave)]">{t('Opcional: pese de novo e a diferença fica registrada como perda de lavagem.')}</p>
        {lotes.map((l) => (
          <Campo key={l.id} rotulo={`${l.codigo ?? l.nome} · ${t('antes')} ${gramasTexto(l.saldo)}`}>
            <GramasInput valor={pesos[l.id]} onChange={(g) => setPesos({ ...pesos, [l.id]: g })} />
            {pesos[l.id] !== undefined && pesos[l.id]! < l.saldo && <span className="num mt-1 block text-sm text-[var(--ruim)]">{gramasTexto(l.saldo)} → {gramasTexto(pesos[l.id]!)} (−{gramasTexto(l.saldo - pesos[l.id]!)})</span>}
          </Campo>
        ))}
      </div>
    </Janela>
  )
}

type TriagemFeita = ResultadoConsulta<'triagens'>[number]
const ORDENS = [{ id: '', nome: 'Mais recentes' }, { id: 'perda', nome: 'Mais perda (%)' }, { id: 'peso', nome: 'Mais peso' }]
const AJUDA_PERDA = 'Perda = o que entrou − o que saiu. Ex.: 10 kg → 9,6 kg = 400 g (4%).'

/** "o que se busca" de uma triagem: código, quem, compras (código e fornecedor) e pacotes que saíram */
const buscaTriagem = (x: TriagemFeita) => [x.codigo, x.por, ...x.compras.flatMap((c) => [c.codigo, c.fornecedor]), ...x.saidas.map((s) => s.codigo)].filter(Boolean).join(' ').toLowerCase()

/**
 * TRIAGENS FEITAS: números de resumo (do que está filtrado), filtros (período, quem, compra, perda acima de X%,
 * busca, ordenar; tudo no endereço) e UMA linha por triagem — T-0003 · 03/11 · Paula · 10 kg → 9,6 kg · perda 4% ·
 * 3 pacotes · etiquetas. Tocar abre no lugar: compras → pacotes → vendas e o rastreio em gramas.
 */
function ListaTriagens({ aberta }: { aberta?: string }) {
  const t = useT()
  const { ir, ajustarParams } = useApp()
  const { dados } = useConsulta('triagens', { moduloId: 'cabelo' })
  const [tde, setTde] = useParamTela('tde', '')
  const [tate, setTate] = useParamTela('tate', '')
  const periodo = tde || tate
  const [quem, setQuem] = useParamTela('tq', '')
  const [compra, setCompra] = useParamTela('tc', '')
  const [perdaMin, setPerdaMin] = useParamTela('tperda', '')
  const [busca, setBusca] = useParamTela('tb', '')
  const [ordem, setOrdem] = useParamTela('to', '')
  const [maisFiltros, setMaisFiltros] = useState(!!(quem || compra || perdaMin))
  const [imprimir, setImprimir] = useState<Id[]>()
  if (!dados) return <Carregando />
  if (!dados.length) return <p className="rounded-xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nenhuma triagem ainda. Selecione lotes no quadro e toque em “Separar” ou “Juntar e separar”.')}</p>

  const pessoas = [...new Set(dados.map((x) => x.por).filter((p): p is string => !!p))].sort()
  const termo = busca.trim().toLowerCase()
  const termoCompra = compra.trim().toLowerCase()
  const minBp = perdaMin ? Math.round(Number(perdaMin.replace(',', '.')) * 100) : undefined
  const lista = dados
    .filter((x) =>
      (!tde || x.em.slice(0, 10) >= tde) && (!tate || x.em.slice(0, 10) <= tate) &&
      (!quem || x.por === quem) &&
      (!termoCompra || x.compras.some((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' ').toLowerCase().includes(termoCompra))) &&
      (minBp === undefined || !Number.isFinite(minBp) || x.perdaPct > minBp) &&
      (!termo || buscaTriagem(x).includes(termo)))
    .sort((a, b) => (ordem === 'perda' ? b.perdaPct - a.perdaPct : ordem === 'peso' ? b.pesoEntrada - a.pesoEntrada : 0) || (a.em < b.em ? 1 : -1))
  const entrou = lista.reduce((s, x) => s + x.pesoEntrada, 0)
  const saiu = lista.reduce((s, x) => s + x.pesoSaida, 0)
  const perdaBp = entrou ? Math.round(((entrou - saiu) * 10000) / entrou) : 0
  const ativos = [quem, compra, perdaMin].filter(Boolean).length
  const ativosT = [
    ...(quem ? [{ k: 'tq', rotulo: `👤 ${quem}` }] : []),
    ...(compra ? [{ k: 'tc', rotulo: `🛒 ${compra}` }] : []),
    ...(perdaMin ? [{ k: 'tperda', rotulo: `📉 ${t('perda')} > ${perdaMin}%` }] : []),
  ]
  const limpar = () => ajustarParams({ tde: undefined, tate: undefined, tq: undefined, tc: undefined, tperda: undefined, tb: undefined, to: undefined })

  return (
    <div className="space-y-3">
      {imprimir && <ImprimirEtiquetas ids={imprimir} onFechar={() => setImprimir(undefined)} />}
      {/* resumo do que está filtrado */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        <NumeroGrande rotulo="Triagens" valor={String(lista.length)} />
        <NumeroGrande rotulo="Entrou" valor={gramasTexto(entrou)} />
        <NumeroGrande rotulo="Saiu" valor={gramasTexto(saiu)} />
        <NumeroGrande rotulo="Perda" ajuda={AJUDA_PERDA} valor={fmt(perdaBp, 'percentual')} sub={gramasTexto(entrou - saiu)} tom={perdaBp > 500 ? 'ruim' : undefined} />
      </div>

      {/* FILTRO PADRÃO: período em atalhos (no topo) · busca · ⚙ Filtros (quem, compra, perda, ordem) → resultado + chips ✕ */}
      <FiltroLista
        periodo={{ de: tde, ate: tate, onChange: (d, a) => (setTde(d ?? ''), setTate(a ?? '')) }}
        busca={busca} onBusca={setBusca} placeholder="T-0003, compra, fornecedor, pacote…"
        ativos={ativosT} onTirar={(k) => ajustarParams({ [k]: undefined })} onLimpar={limpar} temAtivos={!!(periodo || ativos > 0 || termo || ordem)}
        resultados={lista.length} total={dados.length} unidade="triagem(ns)"
        aberto={maisFiltros} onAberto={setMaisFiltros}
        painel={<>
          <GrupoFiltro titulo="Quem e de onde" icone="👤">
            <Campo rotulo="Quem triou"><Selecao valor={quem} onChange={setQuem} vazio="Todos" opcoes={pessoas.map((p) => ({ id: p, nome: p }))} /></Campo>
            <Campo rotulo="Compra"><Entrada placeholder={t('Ex.: P-0003 ou Maria')} value={compra} onChange={(e) => setCompra(e.target.value)} /></Campo>
          </GrupoFiltro>
          <GrupoFiltro titulo="Perda e ordem" icone="📉">
            <Campo rotulo="Perda acima de (%)"><Entrada inputMode="decimal" placeholder={t('Ex.: 5')} value={perdaMin} onChange={(e) => setPerdaMin(e.target.value.replace(/[^\d,.]/g, ''))} /></Campo>
            <Campo rotulo="Ordenar"><Selecao valor={ordem} onChange={setOrdem} opcoes={ORDENS} /></Campo>
          </GrupoFiltro>
        </>}
      />

      {!lista.length ? (
        <VazioFiltro texto="Nenhuma triagem com esses filtros." filtrando={!!(periodo || ativos > 0 || termo)} onLimpar={limpar} />
      ) : (
        <ul className="space-y-3">
          {lista.map((x) => <LinhaTriagem key={x.id} x={x} aberta={aberta === x.id} t={t} ir={ir} onAlternar={() => ajustarParams({ t: aberta === x.id ? undefined : x.id })} onImprimir={setImprimir} />)}
        </ul>
      )}
    </div>
  )
}

/** Uma triagem numa linha; tocar abre no lugar (compras → pacotes → vendas, etiquetas e rastreio). */
function LinhaTriagem({ x, aberta, t, ir, onAlternar, onImprimir }: { x: TriagemFeita; aberta: boolean; t: T; ir: ReturnType<typeof useApp>['ir']; onAlternar(): void; onImprimir(ids: Id[]): void }) {
  // etiquetas desta separação: '3 de 4 com etiqueta' e imprimir as que faltam (só das que ainda têm peso)
  const faltam = x.saidas.filter((s) => !s.etiquetaImpressaEm && s.saldo > 0)
  const com = x.saidas.filter((s) => s.etiquetaImpressaEm).length
  const fornecedores = [...new Set(x.compras.map((c) => c.fornecedor).filter(Boolean))]
  const rotuloImprimir = t(faltam.length === 1 ? 'Imprimir a que falta' : 'Imprimir as {n} que faltam', { n: faltam.length })
  const [verRastreio, setVerRastreio] = useState(false)
  const corPerda = x.perdaPct > 500 ? 'var(--ruim)' : x.perda > 0 ? 'var(--alerta)' : undefined
  const titulo = (s: string) => <TituloSecao className="mb-1.5">{t(s)}</TituloSecao>
  return (
    // cada triagem é um CARTÃO próprio (espaço entre um e outro): cabeçalho, 3 números e, aberto, seções com título
    <li className={cx('overflow-hidden rounded-2xl border bg-[var(--cartao)] shadow-sm', aberta ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
      <div {...clicavel(onAlternar)} aria-expanded={aberta} className="cursor-pointer px-4 py-3.5 outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
        {/* CABEÇALHO: ícone · código e quando · de quem veio e quem fez · ›  */}
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] text-lg text-white shadow-sm">✂️</span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-baseline gap-2">
              <b className="font-mono text-base">{x.codigo}</b>
              <span className="num shrink-0 text-xs text-[var(--suave)]">{dataBR(x.em)}</span>
            </span>
            <span className="block truncate text-xs text-[var(--suave)]">{[fornecedores.join(', '), x.por && `${t('por')} ${x.por}`].filter(Boolean).join(' · ') || '—'}</span>
          </span>
          <span aria-hidden className={cx('shrink-0 text-lg text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
        </div>
        {/* O FLUXO: entrou → saiu, a perda em destaque e a barra do que virou pacote × perda */}
        <div className="mt-3 rounded-xl bg-[var(--fundo)] p-3">
          <div className="num flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><span className="block text-[11px] uppercase tracking-wide text-[var(--suave)]">{t('Entrou')}</span><b className="text-lg">{gramasTexto(x.pesoEntrada)}</b></span>
            <span aria-hidden className="text-lg text-[var(--suave)]">→</span>
            <span><span className="block text-[11px] uppercase tracking-wide text-[var(--suave)]">{t('Saiu')}</span><b className="text-lg text-[var(--bom)]">{gramasTexto(x.pesoSaida)}</b></span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `color-mix(in srgb, ${corPerda ?? 'var(--bom)'} 14%, transparent)`, color: corPerda ?? 'var(--bom)' }}>
              {t('perda')} {fmt(x.perdaPct, 'percentual')}{x.perda > 0 && <span className="font-medium opacity-80">· {gramasTexto(x.perda)}</span>}
            </span>
          </div>
          <div aria-hidden className="mt-2 flex h-2 w-full gap-px overflow-hidden rounded-full bg-[var(--cartao)]">
            <span style={{ flexGrow: Math.max(x.pesoSaida, 0), flexBasis: 0, background: 'var(--bom)' }} />
            {x.perda > 0 && <span style={{ flexGrow: x.perda, flexBasis: 0, minWidth: 3, background: corPerda ?? 'var(--alerta)' }} />}
          </div>
        </div>
        {/* O QUE SAIU: os pacotes (códigos) e a situação das etiquetas */}
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-[var(--suave)]">📦 {t('{n} pacote(s)', { n: x.saidas.length })}</span>
          {x.saidas.slice(0, 4).map((s) => <span key={s.id} className="rounded-md bg-[var(--marca-suave)] px-1.5 py-0.5 font-mono font-bold text-[var(--marca)]">{s.codigo ?? '—'}</span>)}
          {x.saidas.length > 4 && <span className="text-[var(--suave)]">+{x.saidas.length - 4}</span>}
          {x.saidas.length > 0 && <span className={cx('ml-auto rounded-full px-2 py-0.5 font-semibold', faltam.length ? 'bg-[var(--alerta)]/12 text-[var(--alerta)]' : 'bg-[var(--bom)]/12 text-[var(--bom)]')}>{faltam.length ? '🏷' : '✓'} {t('{c} de {n} com etiqueta', { c: com, n: x.saidas.length })}</span>}
        </div>
      </div>
      {faltam.length > 0 && (
        <div className="border-t border-[var(--borda)] px-4 py-2">
          <Botao variante="secundario" className="w-full sm:w-auto" onClick={() => onImprimir(faltam.map((s) => s.id))}>🖨 {rotuloImprimir}</Botao>
        </div>
      )}
      {aberta && (
        <div className="space-y-4 border-t border-[var(--borda)] bg-[var(--fundo)] px-4 py-3">
          <CaminhoDoCabelo de={{ triagemId: x.id }} atual="triagem" compacto />
          <section>
            {titulo('Veio de')}
            <CadeiaChips cadeia={{ compras: x.compras, triagens: [], vendas: [] }} max={6} />
          </section>
          <section>
            {titulo('Virou')}
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
              {x.saidas.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => ir('lote', { id: s.id })} className="num flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-[var(--fundo)]">
                    <CodigoTexto codigo={s.codigo} />
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--suave)]">{s.nome}</span>
                    <b className="whitespace-nowrap">{gramasTexto(s.g)}</b>
                    <span aria-label={t(s.etiquetaImpressaEm ? 'Etiqueta' : 'Sem etiqueta')} className={s.etiquetaImpressaEm ? 'text-[var(--bom)]' : 'text-[var(--alerta)]'}>{s.etiquetaImpressaEm ? '✓' : '🏷'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {x.vendasLista.length > 0 && (
            <section>
              {/* cada venda numa linha (como o "Virou"): data, cliente, de quais pacotes, quanto e por quanto; total embaixo */}
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                {titulo('Vendido em')}
                <span className="num text-xs text-[var(--suave)]">{t('{n} venda(s)', { n: x.vendasLista.length })} · <b className="text-[var(--bom)]">{gramasTexto(x.vendasLista.reduce((s, v) => s + v.g, 0))}</b> {t('de {g}', { g: gramasTexto(x.pesoSaida) })}</span>
              </div>
              <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
                {x.vendasLista.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => ir('venda', { id: v.id })} className="num flex min-h-12 w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--fundo)]">
                      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bom)]/15 text-sm">💰</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2"><b className="font-mono text-[var(--bom)]">{v.codigo}</b><span className="text-xs text-[var(--suave)]">{dataBR(v.data)}</span></span>
                        <span className="block truncate text-xs text-[var(--suave)]">{v.cliente ?? t('Sem cliente')}{v.lotes.length ? ` · ${v.lotes.join(', ')}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <b className="block whitespace-nowrap">{gramasTexto(v.g)}</b>
                        {v.valor > 0 && <span className="block whitespace-nowrap text-xs text-[var(--suave)]">{formatar(v.valor, v.moeda)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <BotaoExpandir aberto={verRastreio} onClick={() => setVerRastreio(!verRastreio)} rotuloAberto={t('Fechar o rastreio')} className="-ml-2">{t('Ver rastreio completo (gramas)')}</BotaoExpandir>
          {verRastreio && <RastreioDaTriagem id={x.id} />}
          <DesfazerTriagem x={x} t={t} />
        </div>
      )}
    </li>
  )
}

const AJUDA_DESFAZER =
  'Desfazer: volta tudo como era antes da triagem. O peso volta para o pacote de entrada e os pacotes que saíram somem (ficam no histórico como desfeitos). Use quando pesou ou separou errado. Ex.: separou 10 kg, mas eram 9,5 kg → desfaz, corrige o peso na compra e separa de novo. Só dá enquanto nada que saiu foi vendido, separado de novo ou ajustado.'

/** "Errei a triagem": desfaz (só se nada do que saiu foi mexido); senão explica o caminho (ajustar o pacote que sobrou). */
function DesfazerTriagem({ x, t }: { x: TriagemFeita; t: T }) {
  const { executar } = useComando()
  const [aberto, setAberto] = useState(false)
  const comEtiqueta = x.saidas.filter((s) => s.etiquetaImpressaEm).map((s) => s.codigo)
  if (!x.podeDesfazer)
    return <p className="flex items-center text-xs text-[var(--suave)]">{t('Errou? Já venderam ou mexeram num pacote desta triagem: corrija pelo pacote (⋯ › Ajustar).')}<Info texto={AJUDA_DESFAZER} /></p>
  return (
    <div className="flex items-center border-t border-[var(--borda)] pt-3">
      <Botao variante="leve" onClick={() => setAberto(true)}>↩ {t('Errou? Desfazer esta triagem')}</Botao>
      <Info texto={AJUDA_DESFAZER} />
      {aberto && (
        <Confirmar
          perigo
          pedirMotivo
          titulo="Desfazer a triagem?"
          texto={`${t('{g} voltam para o pacote de entrada e {n} pacote(s) somem da lista.', { g: gramasTexto(x.pesoEntrada), n: x.saidas.length })}${comEtiqueta.length ? ` ${t('Jogue fora as etiquetas de {c}.', { c: comEtiqueta.join(', ') })}` : ''}`}
          rotulo="Desfazer"
          onConfirmar={(motivo) => executar('desfazerTriagem', { triagemId: x.id, motivo }, t('Triagem desfeita: o peso voltou para separar.'))}
          onFechar={() => setAberto(false)}
        />
      )}
    </div>
  )
}

function RastreioDaTriagem({ id }: { id: string }) {
  const { dados } = useConsulta('genealogia', { triagemId: id })
  return dados ? <div className="mt-2"><RastreioTotal g={dados} /></div> : <Carregando />
}

/**
 * REGRAS DE JUNTAR (o ⚙ do quadro de regras): o dono decide sem mexer em código. Liga/desliga "uma etapa por vez" e o
 * limite da "sobra pequena". Vale para todos, na tela e no servidor (guardado na configuração geral).
 */
function RegrasJuntar({ mesmaEtapa, saldoPequeno, onFechar }: { mesmaEtapa: boolean; saldoPequeno: number; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [etapa, setEtapa] = useState(mesmaEtapa)
  const [limite, setLimite] = useState(String(saldoPequeno))
  const n = Number(limite)
  const valido = limite.trim() !== '' && Number.isInteger(n) && n >= 0
  const salvar = async () => {
    const r = await executar('salvarConfig', { juntarMesmaEtapa: etapa, saldoPequenoG: n }, t('Regras salvas ✓'))
    if (r) onFechar()
  }
  return (
    <Janela aberta titulo={t('Regras para juntar pacotes')} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Cancelar')}</Botao><Botao disabled={ocupado || !valido} onClick={salvar}>{t('Salvar regras')}</Botao></div>}>
      <p className="mb-3 text-sm text-[var(--suave)]">{t('Valem para todos, nesta tela e ao registrar. Dá para mudar quando quiser.')}</p>
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--borda)] p-3 hover:border-[var(--marca)]">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-lg">📍</span>
          <span className="min-w-0 flex-1">
            <b className="block">{t('Juntar só pacotes da mesma etapa')}</b>
            <span className="block text-xs text-[var(--suave)]">{t('Ligado: quem está em “Lavando” não entra junto com quem está em “Aguardando triagem”. Desligado: pode misturar etapas.')}</span>
          </span>
          {/* liga/desliga */}
          <input type="checkbox" role="switch" className="peer sr-only" checked={etapa} onChange={(e) => setEtapa(e.target.checked)} aria-label={t('Juntar só pacotes da mesma etapa')} />
          <span aria-hidden className={cx('relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--marca)]', etapa ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
            <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', etapa ? 'left-[22px]' : 'left-0.5')} />
          </span>
        </label>
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--borda)] p-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-lg">⚠️</span>
          <span className="min-w-0 flex-1">
            <b className="block">{t('Avisar sobra pequena')}</b>
            <span className="block text-xs text-[var(--suave)]">{t('Pacote com menos que isso ganha ⚠ na lista e no painel (não bloqueia). 0 desliga o aviso.')}</span>
            <span className="mt-2 flex items-center gap-2">
              <Entrada inputMode="numeric" className="w-28" aria-label={t('Limite em gramas')} value={limite} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))} />
              <span className="text-sm text-[var(--suave)]">g</span>
            </span>
          </span>
        </div>
      </div>
    </Janela>
  )
}
