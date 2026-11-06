// TRIAGEM: o passo mais importante — daqui saem as vendas. Tela BEM SIMPLES: bater o olho e saber o que fazer.
// Topo: uma frase ("2 pacotes para separar · 4,2 kg") + 🔍 📷 ⚙. Três chips que filtram. UMA lista "Para separar"
// (bruto + não identificado, o mais antigo primeiro) com um botão grande "Separar" por linha; "Pronto para vender"
// fechado numa linha; o quadro (colunas do negócio, arrastar) fica atrás de "Ver quadro" (lembrado no aparelho).
// Seleção (juntar e separar, mover, etiquetas) só aparece ao tocar "Selecionar". O resto fica no "⋯" de cada linha.

import { type DragEvent, useState } from 'react'
import { FiltroViagem, SelosViagem, passaViagem, viagensDasLinhas } from '../../../shared/ui/seloViagem'
import { TabelaDados, SeloCodigo } from '../../../shared/ui/tabelaDados'
import { GrupoVisao, useVisaoLista } from '../../../shared/ui/visaoLista'
import { PainelSelecao } from '../../../shared/ui/painelSelecao'
import { Paginada } from '../../../shared/ui/paginacao'
import { AcaoIcone } from '../../../shared/ui/acoesPagina'
import { NumeroGrande, GrupoNumeros, type Selo } from '../../../shared/ui/numeroGrande'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { COLUNA_VENDIDO, type ColunaTriagem } from '../../../core/services/triagem'
import { Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, Info, Pilula, Selecao, cx, gramasTexto, moedaPadrao, Titulo } from '../../../shared/ui/base'
import { type Params, useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { type Acao, acoesLote } from '../../../shared/ui/menuAcoes'
import { useCamposModulo } from '../../estoque'
import { EditarAtributos } from '../../lote'
import { TrocarCodigo } from '../../../shared/ui/codigos'
import { MiniaturaLote, useTirarFoto } from '../../../shared/ui/fotos'
import { ImprimirEtiquetas, SeloEtiqueta } from '../../../shared/ui/etiquetas'
import { Unificar } from '../components/Unificar'
import { DesfazerMistura } from '../components/DesfazerMistura'
import { DepoisDeSeparar, PainelTriagem, TriagemVazia, type RegraJuntar } from '../components/guia'
import { LeitorCodigo } from '../../../shared/ui/estoqueUi'
import { usePistola } from '../../../shared/ui/leitorPistola'
import { useLembrado } from '../../../shared/ui/filtros'
import { Icone } from '../../../shared/ui/icones'
import { GrupoFiltro, FiltroLista } from '../../../shared/ui/filtroPadrao'
import { PARAMS_PRONTOS } from '../../../shared/ui/filtrosProntos'
import { NAO_ID, type Lote, type T } from '../model/comum'
import { ProntoParaVender } from '../components/ProntoParaVender'
import { CartaoLote, Coluna, PesoDepois, VerVendidos } from '../components/Quadro'
import { ListaTriagens } from '../components/ListaTriagens'
import { RegrasJuntar } from '../components/RegrasJuntar'

/** ainda precisa separar: bruto ou "não identificado" (ficou para depois) */
const precisaSeparar = (l: { campos: { estado?: unknown } }) => l.campos.estado === 'Bruto' || l.campos.estado === NAO_ID
const DICA_JUNTAR = 'Junta pacotes de compras diferentes; a origem de cada grama fica guardada. Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.'
const DICA_SEPARAR = 'Digite o peso e o que é cada parte; o que sobrar é perda. Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.'

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
  // VER COMO (padrão das listagens): tabela ou cartões, no ⚙ Filtros
  const vis = useVisaoLista('triagem')
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
  // JUNTADO = pacote misturado (2+ pacotes viraram um) ou com cabelo de mais de uma compra (veio de uma mistura)
  const juntado = (l: Lote) => l.unificado > 0 || l.compras.length > 1
  const seloJuntados = (ls: Lote[]): { texto: string; tom?: string }[] => {
    const j = ls.filter(juntado).length
    return !ls.length ? [] : [{ texto: j ? `🔗 ${t('{j} juntado(s) · {s} sem juntar', { j, s: ls.length - j })}` : t('nenhum juntado'), ...(j ? { tom: 'marca' } : {}) }]
  }
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
    (!fp('sit') || (fp('sit') === 'parados' ? l.atrasado : fp('sit') === 'juntados' ? juntado(l) : !juntado(l))) &&
    passaViagem(fp('sv'), l.compras.map((c) => c.viagem))
  const ativosFila = [
    ...(fp('sf') ? [{ k: 'sf', rotulo: `👤 ${fp('sf')}` }] : []),
    ...(fp('sc') ? [{ k: 'sc', rotulo: `🛒 ${fp('sc')}` }] : []),
    ...(fp('sd') ? [{ k: 'sd', rotulo: t('parado há {n}+ dias', { n: fp('sd') }) }] : []),
    ...(fp('set') ? [{ k: 'set', rotulo: t(fp('set') === 'sem' ? 'Sem etiqueta' : 'Com etiqueta') }] : []),
  ]
  const viagensFila = viagensDasLinhas(daAba.flatMap((l) => l.compras.map((c) => c.viagem)))
  if (fp('sv')) ativosFila.push({ k: 'sv', rotulo: `✈️ ${((id: string, vs: { id: string; codigo: string; nome: string }[]) => (id === 'sem' ? 'Sem viagem' : vs.find((v) => v.id === id)?.codigo ?? id))(fp('sv'), viagensFila)}` })
  const limparFila = () => ajustarParams({ sf: undefined, sc: undefined, sd: undefined, set: undefined, sit: undefined, sv: undefined, busca: undefined })
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
  // O PAINEL: o próximo passo (separar o mais antigo) e o juntar (com 2+ pacotes) — as regras com ícone, ligadas ou não
  const temPasso = !comSelecao && abaReal === 'separar' && !!maisAntigo
  const temJuntar = daAba.length >= 2 && (!comSelecao || sel.size < 2)
  const regrasJuntar: RegraJuntar[] = [
    { icone: '📍', titulo: mesmaEtapa ? 'Uma etapa por vez' : 'Etapas misturadas: liberado', texto: mesmaEtapa ? 'Só junta quem está na mesma etapa do quadro. Ex.: todos em “Aguardando triagem”.' : 'Pode juntar pacotes de etapas diferentes (a regra está desligada).', ligado: mesmaEtapa },
    { icone: '🧬', titulo: 'Compras diferentes, pode', texto: 'Cada grama guarda de qual compra veio. Ex.: 2 kg da P-0005 + 4 kg da P-0007.', ligado: true },
    { icone: '⚠️', titulo: SALDO_PEQUENO > 0 ? t('Menos de {n} g: aviso', { n: SALDO_PEQUENO }) : 'Aviso de sobra: desligado', texto: SALDO_PEQUENO > 0 ? 'Sobra pequena: junte com outro ou ajuste como perda.' : 'Nenhum pacote é marcado como sobra pequena.', ligado: SALDO_PEQUENO > 0 },
  ]
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
          { id: 'separar', nome: 'Para separar', icone: '⏳', cor: paradosN ? 'var(--ruim)' : 'var(--alerta)', valor: separarTodos.length ? gramasTexto(gSeparar) : t('Tudo separado ✓'), selos: separarTodos.length ? [{ texto: t('{n} pacote(s)', { n: separarTodos.length }) }, ...seloJuntados(separarTodos), ...(paradosN ? [{ texto: `⏰ ${t('{n} parado(s)', { n: paradosN })}`, tom: 'ruim' }] : [])] : [{ texto: t('nada esperando'), tom: 'bom' }] },
          { id: 'prontos', nome: 'Prontos', icone: '✅', cor: 'var(--bom)', valor: gramasTexto(tt.pronto), selos: [{ texto: t('{n} pacote(s)', { n: dados.lotes.filter(ehPronto).length }) }, ...seloJuntados(dados.lotes.filter(ehPronto)), ...(tt.prontoValor ? [{ texto: formatar(tt.prontoValor, moedaPadrao()), tom: 'bom' }] : [])] },
          { id: 'depois', nome: 'Para depois', icone: '❓', cor: '#a78bfa', valor: gramasTexto(tt.naoIdentificado.g), selos: [{ texto: t('{n} pacote(s)', { n: tt.naoIdentificado.n }), ...(tt.naoIdentificado.n ? { tom: 'alerta' } : {}) }, ...seloJuntados(aguardando.filter((l) => l.campos.estado === NAO_ID))] },
          { id: 'triagens', nome: 'Triagens feitas', icone: '✂️', cor: 'var(--marca)', valor: gramasTexto(tt.triadoSemana), selos: [{ texto: t('nesta semana'), tom: 'marca' }, { texto: t('{n} triagem(ns)', { n: tt.triagensSemana.n }) }, ...(tt.triagensSemana.n ? [{ texto: `🔗 ${t('{j} juntando', { j: tt.triagensSemana.juntando })}`, ...(tt.triagensSemana.juntando ? { tom: 'marca' } : {}) }] : [])] },
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
          {visao !== 'quadro' && <span className="ml-1 inline-flex items-center text-xs font-semibold text-[var(--suave)]">{t('Legenda')}<Info texto={t('parado: esperando para separar há mais de {n} dias (muda em Configurações › Etapas da compra). ✓ Etiqueta: já foi impressa (toque para ver ou reimprimir). 🏷 Sem etiqueta: ainda não imprimiu (toque para imprimir). ❓ para depois: ficou sem identificar numa separação. 🔗 juntado: pacote misturado (2 ou mais viraram um) ou com cabelo de mais de uma compra. Ex.: “parado” + há 12 dias = está esperando faz tempo, separe primeiro.', { n: dados.diasParado })} /></span>}
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
        {/* O PAINEL DA TRIAGEM (um só): o próximo passo (separar o mais antigo) e, ao lado, juntar antes (opcional) */}
        {visao !== 'quadro' && (temPasso || temJuntar) && (
          <div className="mb-3">
            <PainelTriagem agora={temPasso ? 'separar' : 'juntar'}
              titulo={temPasso ? t('Separar {c}', { c: maisAntigo!.codigo ?? '' }) : undefined}
              texto={temPasso ? <>{t('É o que espera há mais tempo ({g}). Diga as partes por medida; o que sobrar é perda.', { g: gramasTexto(maisAntigo!.saldo) })}{temJuntar ? ` ${t('Mesma qualidade? Dá para juntar antes (opcional).')}` : ''}</> : undefined}
              acoes={temPasso ? <Botao disabled={ocupado} onClick={() => separar(maisAntigo!.id)}>✂️ {t('Separar {c}', { c: maisAntigo!.codigo ?? '' })}</Botao> : undefined}
              juntar={temJuntar ? {
                titulo: comSelecao ? 'Marque os pacotes que vão juntos (2 ou mais)' : 'Juntar pacotes numa separação só',
                regras: regrasJuntar,
                acoes: <>
                  {!comSelecao && <Botao variante="secundario" onClick={() => setSelecionando(true)}>☑ {t('Começar a marcar')}</Botao>}
                  {/* as regras são de quem usa: o ⚙ muda aqui mesmo (vale para todos, na tela e no servidor) */}
                  {admin && <Botao variante="leve" onClick={() => setJanela('regras')}>⚙ {t('Mudar regras')}</Botao>}
                </>,
              } : undefined} />
          </div>
        )}
        {/* FILTRO PADRÃO (o mesmo de Compras, Estoque e Etiquetas): busca + ⚙ Filtros → painel em grupos → resultado + chips ✕ */}
        {visao !== 'quadro' && daAba.length > 0 && (
          <FiltroLista
            className="mb-3"
            // SITUAÇÃO da fila à vista (o mesmo trilho do Vender e do Estoque): todos · parados · juntados · sem juntar
            situacao={{ valor: fp('sit'), onChange: (id) => ajustarParams({ sit: id || undefined }), opcoes: [
              { id: '', nome: 'Todos', n: daAba.length },
              { id: 'parados', nome: '⏰ Parados', n: daAba.filter((l) => l.atrasado).length, tom: daAba.some((l) => l.atrasado) ? 'alerta' as const : undefined },
              { id: 'juntados', nome: '🔗 Juntados', n: daAba.filter(juntado).length },
              { id: 'simples', nome: 'Sem juntar', n: daAba.filter((l) => !juntado(l)).length },
            ] }}
            busca={busca} onBusca={setBusca} placeholder="Código, compra ou fornecedor" onKeyDown={pistola.onKeyDown}
            extra={<FiltroViagem nasLinhas={daAba.map((l) => l.compras.map((c) => c.viagem))} valor={fp('sv')} onChange={(v) => ajustarParams({ sv: v || undefined })} />}
            ativos={ativosFila} onTirar={(k) => ajustarParams({ [k]: undefined })} onLimpar={limparFila}
            resultados={paraSeparar.length} total={daAba.length} unidade="pacote(s)"
            painel={<>
                <GrupoFiltro titulo="De onde veio" icone="🛒">
                  <Campo rotulo="Fornecedor"><Selecao valor={fp('sf')} onChange={(v) => ajustarParams({ sf: v || undefined })} vazio="Todos" opcoes={fornecedoresFila.map((x) => ({ id: x, nome: x }))} /></Campo>
                  <Campo rotulo="Compra"><Entrada placeholder={t('Ex.: P-0003')} value={fp('sc')} onChange={(e) => ajustarParams({ sc: e.target.value || undefined })} /></Campo>
                </GrupoFiltro>
                <GrupoFiltro titulo="Situação" icone="⏳">
                  <Campo rotulo="Parado há"><Selecao valor={fp('sd')} onChange={(v) => ajustarParams({ sd: v || undefined })} vazio="Qualquer tempo" opcoes={[{ id: '3', nome: t('3 dias ou mais') }, { id: '7', nome: t('7 dias ou mais') }, { id: '15', nome: t('15 dias ou mais') }]} /></Campo>
                  <Campo rotulo="Etiqueta"><Selecao valor={fp('set')} onChange={(v) => ajustarParams({ set: v || undefined })} vazio="Todas" opcoes={[{ id: 'sem', nome: t('Sem etiqueta') }, { id: 'com', nome: t('Com etiqueta') }]} /></Campo>
                </GrupoFiltro>
                <GrupoVisao visao={vis.visao} onVisao={vis.setVisao} />
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
          prontosSemEtiqueta.length > 0 ? (
            <TriagemVazia agora="etiqueta" tom="marca" icone="🏷" titulo={t('Nada para separar — falta só a etiqueta')}
              texto={t(prontosSemEtiqueta.length === 1 ? '1 pacote já separado está sem etiqueta. Com a etiqueta, ele fica pronto para vender.' : '{n} pacotes já separados estão sem etiqueta. Com a etiqueta, ficam prontos para vender.', { n: prontosSemEtiqueta.length })}
              fatos={[t('{n} sem etiqueta', { n: prontosSemEtiqueta.length }), gramasTexto(prontosSemEtiqueta.reduce((x, l) => x + l.saldo, 0))]}
              acoes={<Botao onClick={() => setImprimirProntos(prontosSemEtiqueta.map((l) => l.id))}>🏷 {t(prontosSemEtiqueta.length === 1 ? 'Gerar a etiqueta' : 'Gerar as {n} etiquetas', { n: prontosSemEtiqueta.length })}</Botao>} />
          ) : (
            <TriagemVazia agora="pronto" icone="✅" titulo={t('Nada para separar')}
              texto={t('Tudo o que chegou já foi separado e está no estoque para vender. Cabelo bruto novo entra por uma compra e aparece aqui.')}
              fatos={prontos.length ? [t('{n} pacote(s) pronto(s)', { n: prontos.length }), gramasTexto(tt.pronto), ...(tt.prontoValor ? [formatar(tt.prontoValor, moedaPadrao())] : [])] : []}
              acoes={<>
                {prontos.length > 0 && <Botao onClick={verPronto}>✅ {t('Ver os prontos')}</Botao>}
                <Botao variante="secundario" onClick={() => ir('estoque', { modulo: 'cabelo' })}>📦 {t('Estoque')}</Botao>
                {admin && <Botao variante="secundario" onClick={() => ir('novaCompra')}>🛒 {t('Nova compra')}</Botao>}
              </>} />
          )
        ) : !paraSeparar.length ? (
          <p className="rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>
        ) : (
          <Paginada itens={paraSeparar} unidade="pacote(s)" reiniciar={JSON.stringify([abaReal, busca, fp('sf'), fp('sc'), fp('sd'), fp('set'), fp('sit'), filtro, medida])}>{(pagina) => (
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
              cartoes={vis.cartoes}
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
                // bruto ainda não tem etiqueta (sai na separação): o selo só aparece depois de separado; 🔗 = juntado
                marca: (l) => <>{juntado(l) && <span className="font-semibold text-[var(--marca)]">🔗 {l.unificado > 0 ? t('{n} lotes', { n: l.unificado }) : t('juntado')}</span>}<SelosViagem vs={viagensDasLinhas(l.compras.map((c) => c.viagem))} curto soLeitura />{!precisaSeparar(l) && <SeloEtiqueta soLeitura id={l.id} impressaEm={l.etiqueta.impressaEm} por={l.etiqueta.por} via={l.etiqueta.via} />}</>,
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
