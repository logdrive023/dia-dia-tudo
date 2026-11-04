// TRIAGEM: o passo mais importante — daqui saem as vendas. Tela BEM SIMPLES: bater o olho e saber o que fazer.
// Topo: uma frase ("2 pacotes para separar · 4,2 kg") + 🔍 📷 ⚙. Três chips que filtram. UMA lista "Para separar"
// (bruto + não identificado, o mais antigo primeiro) com um botão grande "Separar" por linha; "Pronto para vender"
// fechado numa linha; o quadro (colunas do negócio, arrastar) fica atrás de "Ver quadro" (lembrado no aparelho).
// Seleção (juntar e separar, mover, etiquetas) só aparece ao tocar "Selecionar". O resto fica no "⋯" de cada linha.

import { type DragEvent, type KeyboardEvent, type ReactNode, useCallback, useState } from 'react'
import { AcaoIcone } from '../ui/acoesPagina'
import { NumeroGrande, NumeroPequeno, GrupoNumeros, type Selo } from '../ui/numeroGrande'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import { COLUNA_VENDIDO, type ColunaTriagem, camposUnificados } from '../core/services/triagem'
import { Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, GramasInput, Info, Janela, Pilula, Selecao, cx, dataBR, fmt, gramasTexto, moedaPadrao, Vazio, TituloSecao, BotaoExpandir, Titulo } from '../ui/base'
import { resumoCampos } from '../ui/camposDinamicos'
import { clicavel } from '../ui/compartilhados'
import { type Params, useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { type Acao, MenuAcoes, acoesLote } from '../ui/menuAcoes'
import { EditarAtributos, useCamposModulo } from './Estoque'
import { CampoCodigo, TrocarCodigo, CodigoTexto } from '../ui/codigos'
import { CadeiaChips, RastreioTotal } from '../ui/rastreioTotal'
import { LinkTirarFoto, MiniaturaLote, marcadorLote, useTirarFoto } from '../ui/fotos'
import { AvisoPacotesNovos, ImprimirEtiquetas, SeloEtiqueta } from '../ui/etiquetas'
import { LeitorCodigo } from '../ui/estoqueUi'
import { usePistola } from '../ui/leitorPistola'
import { useLembrado } from '../ui/filtros'
import { Icone } from '../ui/icones'
import { GrupoFiltro, FiltroLista, VazioFiltro, AtalhosChips } from '../ui/filtroPadrao'
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

/** De onde veio, por extenso: "de P-0003 · Helena · separado de L-0001" (unificado: "de P-0001 + P-0004 · unificado de L-1 + L-2"). */
function origemTexto(l: Lote, t: T) {
  const fornecedores = [...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))]
  const compras = l.compras.length ? `${t('de')} ${l.compras.map((c) => c.codigo ?? '?').join(' + ')}${fornecedores.length ? ` · ${fornecedores.join(', ')}` : ''}` : t('sem compra (cadastro)')
  const pai = l.pai ? ` · ${t('separado de')} ${l.pai.codigo ?? '?'}` : ''
  const uni = l.unificadoDe?.length ? ` · ${t('unificado de')} ${l.unificadoDe.map((x) => x.codigo ?? '?').join(' + ')}` : ''
  return compras + pai + uni
}

/** Rótulo curto: só o que se sabe (medida · cor · categoria); se nada, "Bruto". */
function rotuloCurto(l: Lote, t: T) {
  const c = l.campos
  const partes = [c.comprimento ? `${c.comprimento} cm` : '', c.cor ? t(String(c.cor)) : '', c.categoria && c.categoria !== 'Normal' ? t(String(c.categoria)) : ''].filter(Boolean)
  return partes.join(' · ') || t('Bruto')
}

export function Triagem() {
  const t = useT()
  const { ir, ajustarParams, nav } = useApp()
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
  const [janela, setJanela] = useState<'unificar' | 'triado'>()
  // sair de uma coluna de lavagem ("pedir peso depois"): pergunta o peso depois, opcional
  const [pesar, setPesar] = useState<{ ids: Id[]; fase: string }>()
  const [editar, setEditar] = useState<Lote>()
  const [arrastando, setArrastando] = useState<Id[]>()
  const [opcoes, setOpcoes] = useState(false)
  const [aba] = useParamTela('aba', 'separar')
  const [alvo, setAlvo] = useState<string>()
  const [lendo, setLendo] = useState(false)
  const [maisSeparar, setMaisSeparar] = useState(false)
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
      { id: l.id, saldo: l.saldo, compras: l.compras, origens: l.pai ? [l.pai] : l.unificadoDe, vendavel: !!colDe(l.fase)?.pronto },
      {
        ir: (tela, p) => (tela === 'vender' ? vender(p ?? {}) : ir(tela, p)),
        t,
        admin: true,
        separarParams: { volta: 'triagem' },
        onTrocarCodigo: () => setTrocar(l),
        extras: [
          { rotulo: 'Tirar foto', icone: '📷', onClick: () => tirar(l.id), separar: true },
          { rotulo: 'Escolher foto da galeria', icone: '🖼', onClick: () => tirar(l.id, { galeria: true }) },
          ...(l.saldo > 0 ? [{ rotulo: 'Editar atributos', icone: '✎', onClick: () => setEditar(l), separar: true }] : []),
          // "Marcar como triado" e "Mover para…" ficam aqui (o caminho principal é Separar; arrastar continua no quadro)
          ...(primeiraPronta && precisaSeparar(l) && l.saldo > 0 ? [{ rotulo: 'Marcar como triado', icone: '✓', onClick: () => (setSel(new Set([l.id])), setJanela('triado')), separar: true }] : []),
          ...(l.fase === COLUNA_VENDIDO ? [] : trabalho.filter((c) => c.id !== l.fase).map((c, k) => ({ rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', onClick: () => entrar(c, [l.id]), separar: k === 0 && !(primeiraPronta && precisaSeparar(l)) }))),
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
    (!fp('set') || (fp('set') === 'sem' ? !l.etiqueta.impressaEm : !!l.etiqueta.impressaEm))
  const ativosFila = [
    ...(fp('sf') ? [{ k: 'sf', rotulo: `👤 ${fp('sf')}` }] : []),
    ...(fp('sc') ? [{ k: 'sc', rotulo: `🛒 ${fp('sc')}` }] : []),
    ...(fp('sd') ? [{ k: 'sd', rotulo: t('parado há {n}+ dias', { n: fp('sd') }) }] : []),
    ...(fp('set') ? [{ k: 'set', rotulo: t(fp('set') === 'sem' ? 'Sem etiqueta' : 'Com etiqueta') }] : []),
  ]
  const limparFila = () => ajustarParams({ sf: undefined, sc: undefined, sd: undefined, set: undefined, busca: undefined })
  const paraSeparar = daAba.filter((l) => passaBusca(l) && passaFiltroPadrao(l) && (filtro === 'depois' || filtroDePronto || passaFiltro(l))).sort((a, b) => b.dias - a.dias)
  const visiveis = maisSeparar ? paraSeparar : paraSeparar.slice(0, MAX_COLUNA)
  const prontos = dados.lotes.filter((l) => ehPronto(l) && passaBusca(l) && (!filtroDePronto || passaFiltro(l)))
  const nomeFiltro = (f: string) => colDe(f)?.nome ?? { atrasados: 'Esperando há mais tempo', depois: 'Para depois', semana: 'Triado nesta semana', mes: 'Triado neste mês', pronto: 'Pronto para vender' }[f] ?? f
  const verPronto = () => irAba('prontos')
  const alternarQuadro = () => { setQuadroLembrado(visao !== 'quadro'); if (visaoP) setVisao('') }

  return (
    <div className="space-y-5 pb-24">
      {/* acabou de separar: "✓ 3 pacotes novos · Imprimir etiquetas · Depois" */}
      <AvisoPacotesNovos />
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
        {visao !== 'quadro' && daAba.length >= 2 && !comSelecao && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--marca)] bg-[var(--marca-suave)] px-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm">
              <b className="block">🔗 {t('Misturar compras numa separação só?')}</b>
              <span className="block text-xs text-[var(--suave)]">{t('Marque 2 ou mais pacotes e toque em “Juntar e separar”. Ex.: 2 kg da compra P-0005 + 4 kg da P-0007 → uma separação, cada grama sabe de onde veio.')}</span>
            </span>
            <Botao variante="secundario" className="shrink-0" onClick={() => setSelecionando(true)}>🔗 {t('Juntar pacotes')}</Botao>
          </div>
        )}
        {comSelecao && sel.size < 2 && daAba.length >= 2 && <p className="mb-2 rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm text-[var(--marca)]">☑ {t('Marque os pacotes que vão juntos (2 ou mais). A barra de baixo mostra “Juntar e separar”.')}</p>}
        {/* FILTRO PADRÃO (o mesmo de Compras, Estoque e Etiquetas): busca + ⚙ Filtros → painel em grupos → resultado + chips ✕ */}
        {visao !== 'quadro' && daAba.length > 0 && (
          <FiltroLista
            className="mb-3"
            busca={busca} onBusca={setBusca} placeholder="Código, compra ou fornecedor" onKeyDown={pistola.onKeyDown}
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
          <div className="rounded-2xl border border-dashed border-[var(--borda)] px-4 py-10 text-center">
            <p className="text-2xl font-bold">{t('Nada para separar 🎉')}</p>
            {prontos.length > 0 && <button type="button" onClick={verPronto} className="mt-2 min-h-11 px-3 font-semibold text-[var(--marca)] hover:underline">{t('Ver o que está pronto para vender →')}</button>}
          </div>
        ) : !paraSeparar.length ? (
          <p className="rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>
        ) : (
          <>
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
              {visiveis.map((l) => {
                const col = colDe(l.fase)
                const acao = acaoDe(l)
                const fornecedores = [...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))]
                return (
                  // celular: foto · código e peso · ⋯ em cima, o botão principal com a largura toda embaixo
                  <li key={l.id} className={cx('flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-3 sm:flex-nowrap sm:gap-3', sel.has(l.id) && 'bg-[var(--marca-suave)]')}>
                    {comSelecao && <input type="checkbox" className="h-5 w-5 shrink-0" checked={sel.has(l.id)} onChange={(e) => marcar(l.id, e.target.checked)} aria-label={t('Selecionar {c}', { c: l.codigo ?? l.nome })} />}
                    <FotoOuIcone l={l} />
                    <div {...clicavel(() => ir('lote', { id: l.id }))} className="min-w-0 flex-1 cursor-pointer rounded-lg outline-none focus-visible:bg-[var(--marca-suave)]">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-base font-bold">{l.codigo ?? '—'}</span>
                        <span className="min-w-0 truncate text-base">{rotuloCurto(l, t)}</span>
                        {l.atrasado && <span title={t('Esperando para separar há mais de {n} dias', { n: dados.diasParado })}><Pilula tom="ruim">⏰ {t('parado')}</Pilula></span>}
                        {l.campos.estado === NAO_ID && <Pilula tom="alerta">❓ {t('para depois')}</Pilula>}
                        {col && !col.entrada && <Pilula>{t(col.nome)}</Pilula>}
                        <SeloEtiqueta id={l.id} impressaEm={l.etiqueta.impressaEm} por={l.etiqueta.por} via={l.etiqueta.via} />
                      </div>
                      {/* peso e dias sempre aparecem; o fornecedor vai ao lado (computador) ou embaixo (celular) */}
                      <div className="num mt-0.5 min-w-0 text-sm text-[var(--suave)] sm:flex sm:items-center sm:gap-1">
                        <span className="shrink-0 whitespace-nowrap"><b className="font-semibold text-[var(--texto)]">{gramasTexto(l.saldo)}</b> · {!l.dias ? t('hoje') : l.dias === 1 ? t('há 1 dia') : t('há {n} dias', { n: l.dias })}</span>
                        {fornecedores.length > 0 && <span className="block min-w-0 truncate"><span className="hidden sm:inline">· </span>{fornecedores.join(', ')}</span>}
                      </div>
                    </div>
                    <MenuAcoes className="sm:order-last" acoes={menuDe(l)} />
                    {acao && <Botao className="order-last min-h-11 w-full shrink-0 text-base sm:order-none sm:min-h-12 sm:w-auto sm:px-6" disabled={ocupado} onClick={acao.f}>{t(acao.rotulo)}</Botao>}
                  </li>
                )
              })}
            </ul>
            {paraSeparar.length > MAX_COLUNA && (
              <button type="button" onClick={() => setMaisSeparar(!maisSeparar)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{maisSeparar ? t('Mostrar menos') : t('Ver mais ({n})', { n: paraSeparar.length - MAX_COLUNA })}</button>
            )}
          </>
        )}
      </section>

      </>}
      {/* ações em massa: só com algo selecionado */}
      {sel.size > 0 && (
        <div role="toolbar" aria-label={t('Ações nos selecionados')} className="fixed inset-x-2 bottom-20 z-30 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-xl md:bottom-4">
          <span className="px-2 text-sm font-bold">{t('{n} selecionado(s)', { n: sel.size })} · <span className="num">{gramasTexto(selecionados.reduce((s, l) => s + l.saldo, 0))}</span></span>
          <span className="inline-flex items-center"><Botao disabled={ocupado || !selecionados.length || selecionados.some((l) => l.fase === COLUNA_VENDIDO)} onClick={() => ir('separar', { ids: selecionados.map((l) => l.id).join(','), volta: 'triagem' })}>✂️ {t(sel.size > 1 ? 'Juntar e separar' : 'Separar')}</Botao><Info texto={sel.size > 1 ? DICA_JUNTAR : DICA_SEPARAR} /></span>
          <Botao variante="secundario" disabled={ocupado || sel.size < 2 || selecionados.some((l) => l.fase === COLUNA_VENDIDO)} title={t('Junta 2 ou mais lotes num lote só')} onClick={() => setJanela('unificar')}>🔗 {t('Só juntar')}</Botao>
          <Botao variante="secundario" onClick={() => ir('etiquetas', { f: 'todas', sel: [...sel].join(',') })}>🏷 {t('Etiquetas')}</Botao>
          <MenuAcoes comRotulo acoes={[
            ...(primeiraPronta && brutos ? [{ rotulo: 'Marcar como triado', icone: '✓', onClick: () => setJanela('triado') }] : []),
            ...trabalho.map((c, k) => ({ rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', separar: k === 0 && !!primeiraPronta && brutos, onClick: () => { const ids = selecionados.filter((l) => l.fase !== c.id && l.fase !== COLUNA_VENDIDO).map((l) => l.id); if (ids.length) mover(ids, c.id) } })),
          ]} />
          <Botao variante="leve" className="ml-auto" onClick={() => (limparSel(), setSelecionando(false))}>{t('Limpar')}</Botao>
        </div>
      )}

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
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          {semEtiqueta.length ? (
            <>
              <button type="button" aria-pressed={!!soSem} onClick={() => setSoSem(soSem ? '' : '1')} className={cx('inline-flex min-h-10 items-center rounded-full px-3 font-semibold text-[var(--alerta)]', soSem ? 'bg-[color-mix(in_srgb,var(--alerta)_28%,transparent)] ring-2 ring-[var(--alerta)]' : 'bg-[color-mix(in_srgb,var(--alerta)_16%,transparent)]')}>🏷 {t('{n} sem etiqueta', { n: semEtiqueta.length })}</button>
              <Botao variante="secundario" onClick={() => setImprimir(semEtiqueta.map((l) => l.id))}>🖨 {t('Imprimir {n}', { n: semEtiqueta.length })}</Botao>
            </>
          ) : <span className="font-semibold text-[var(--bom)]">✓ {t('Todos com etiqueta')}</span>}
        </div>
      )}
      {imprimir && <ImprimirEtiquetas ids={imprimir} onImpresso={() => setSoSem('')} onFechar={() => setImprimir(undefined)} />}
      {semPreco > 0 && <p className="mb-2 rounded-xl bg-[var(--alerta)]/10 p-2 text-sm font-semibold text-[var(--alerta)]">⚠️ {t('{n} lote(s) triado(s) sem preço na tabela', { n: semPreco })}</p>}
      {!totalLotes ? <Vazio compacto texto="Nada triado ainda: separe um lote para começar a vender." /> : !filtrados.length ? <VazioFiltro texto="Nenhum lote com esses filtros." filtrando={filtrando} onLimpar={limparP} /> : (
        // tabela por grupo: Medida | Lotes | Peso | Valor | ⋯ (cabeçalho em cima, total embaixo); tocar na linha abre os lotes
        <div className="overflow-hidden rounded-xl border border-[var(--borda)]">
          {filtro.f.agrupar !== 'nenhum' && (
            <div aria-hidden className={cx(GRADE_PRONTOS, 'bg-[var(--fundo)] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]')}>
              <span className="truncate pl-3.5 sm:pl-5">{t(NOME_GRUPO[filtro.f.agrupar] ?? 'Grupo')}</span>
              <span className="hidden text-right sm:block">{t('Lotes')}</span>
              <span className="text-right">{t('Peso')}</span>
              <span className="text-right">{t('Valor')}</span>
              <span aria-hidden />
            </div>
          )}
          {ordem.map(({ chave: med, rotulo, medida, lotes: ls }) => {
            const aberto = abertos.has(med)
            const semCabecalho = filtro.f.agrupar === 'nenhum'
            const mostrar = todos.has(med) ? ls : ls.slice(0, MAX_PRONTOS)
            const g = ls.reduce((s, l) => s + l.saldo, 0)
            const v = ls.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
            return (
              <div key={med} className="border-t border-[var(--borda)] first:border-t-0">
                {!semCabecalho && <div className={cx(GRADE_PRONTOS, 'num px-2 text-sm', aberto ? 'bg-[var(--marca-suave)]' : 'hover:bg-[var(--marca-suave)]')}>
                  <button type="button" aria-expanded={aberto} onClick={() => alternar(med)} className="flex min-h-11 min-w-0 items-center gap-1 text-left sm:gap-2">
                    <span aria-hidden className={cx('inline-block w-2.5 shrink-0 text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
                    <span className="min-w-0"><b className="block truncate text-sm sm:text-base">{rotulo}</b><span className="block text-xs text-[var(--suave)] sm:hidden">{t('{n} lote(s)', { n: ls.length })}</span></span>
                  </button>
                  <span className="hidden text-right sm:block">{ls.length}</span>
                  <span className="whitespace-nowrap text-right">{gramasTexto(g)}</span>
                  <b className="whitespace-nowrap text-right">{v ? formatar(v, m) : '—'}</b>
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
        <button type="button" onClick={p.onAbrir} className="block min-w-0 flex-1 text-left font-semibold leading-tight [overflow-wrap:anywhere] hover:underline">{l.nome}</button>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-[var(--suave)]">
        <CadeiaChips cadeia={l.cadeia} />
        {(l.pai || l.unificadoDe?.length) && <p className="[overflow-wrap:anywhere]">{l.pai ? `${t('separado de')} ${l.pai.codigo ?? '?'}` : `${t('unificado de')} ${l.unificadoDe!.map((x) => x.codigo ?? '?').join(' + ')}`}</p>}
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
          <Botao className="min-w-0 flex-1 [overflow-wrap:anywhere]" disabled={p.ocupado} onClick={p.acao.f}>{t(p.acao.rotulo)}</Botao>
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

/** Confirmação da unificação: o que entra, o total (peso e custo) e como fica o lote novo. */
function Unificar({ lotes, campos, onFechar, onFeito }: { lotes: Lote[]; campos: ReturnType<typeof useCamposModulo>; onFechar(): void; onFeito(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [motivo, setMotivo] = useState('')
  const { dados: regras } = useConsulta('codigos', {})
  const [digitar, setDigitar] = useState<boolean>()
  const [codigo, setCodigo] = useState('')
  const [codigoOk, setCodigoOk] = useState(true)
  const marcarCodigo = useCallback((ok: boolean) => setCodigoOk(ok), [])
  const digitarCodigo = digitar ?? regras?.regras.lote.modo === 'manual'
  const m = moedaPadrao()
  const total = lotes.reduce((s, l) => s + l.saldo, 0)
  const custo = lotes.reduce((s, l) => s + (l.custo ?? 0), 0)
  const resultado = resumoCampos(campos, camposUnificados(campos, lotes.map((l) => l.campos)))
  const compras = [...new Set(lotes.flatMap((l) => l.compras.map((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' · '))))]
  return (
    <Janela aberta larga titulo={<span className="inline-flex items-center">{t('Unificar {n} lotes', { n: lotes.length })}<Info texto={DICA_JUNTAR} /></span>} onFechar={onFechar} rodape={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="num text-sm text-[var(--suave)]">{t('Vira 1 lote de')} <b className="text-[var(--texto)]">{gramasTexto(total)}</b></span>
        <div className="flex gap-2">
          <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
          <Botao grande disabled={ocupado || (digitarCodigo && !codigoOk)} onClick={async () => { const r = await executar('triarLotes', { id, ids: lotes.map((l) => l.id), motivo, codigo: digitarCodigo ? codigo.trim() || undefined : undefined }, t('Lotes juntados.')); if (r) (onFechar(), onFeito()) }}>🔗 {t('Unificar')}</Botao>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <div className="rounded-xl bg-[var(--fundo)] p-3">
          <CampoCodigo tipo="lote" rotulo="Código do lote juntado" valor={codigo} onChange={setCodigo} bloqueado={!digitarCodigo} contexto={{ comprasUnificadas: [...new Set(lotes.flatMap((l) => l.compras.map((c) => c.id)))] }} onEstado={marcarCodigo} />
          {regras?.regras.lote.modo !== 'manual' && <button type="button" className="min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => (setDigitar(!digitarCodigo), setCodigo(''))}>{digitarCodigo ? t('Usar o código automático') : `✎ ${t('Digitar outro código')}`}</button>}
        </div>
        <ul className="divide-y divide-[var(--borda)] rounded-xl border border-[var(--borda)]">
          {lotes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
              <span className="min-w-0"><span className="font-mono text-xs">{l.codigo}</span> · <b>{l.nome}</b><span className="block text-xs text-[var(--suave)]">{origemTexto(l, t)}</span></span>
              <span className="num whitespace-nowrap">{gramasTexto(l.saldo)}{l.custo !== undefined ? ` · ${formatar(l.custo, m)}` : ''}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--fundo)] p-3"><div className="text-xs text-[var(--suave)]">{t('Peso total')}</div><div className="num whitespace-nowrap text-xl font-black">{gramasTexto(total)}</div></div>
          <div className="rounded-xl bg-[var(--fundo)] p-3"><div className="text-xs text-[var(--suave)]">{t('Custo total')}</div><div className="num whitespace-nowrap text-xl font-black">{formatar(custo, m)}</div></div>
          <div className="rounded-xl bg-[var(--fundo)] p-3"><div className="text-xs text-[var(--suave)]">{t('Custo por kg')}</div><div className="num whitespace-nowrap text-xl font-black">{total ? formatar(Math.round((custo * 1000) / total), m) : '—'}</div></div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-bold">{t('Como fica o lote novo')}</h3>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            {resultado.map((a) => <div key={a.id} className="contents"><dt className="text-[var(--suave)]">{t(a.nome)}</dt><dd className="font-semibold">{t(a.valor)}</dd></div>)}
            <dt className="text-[var(--suave)]">{t('Compras')}</dt><dd className="font-semibold">{compras.join(' + ') || '—'}</dd>
          </dl>
          <p className="mt-1 text-xs text-[var(--suave)]">{t('O que é igual em todos fica; o que é diferente vira “Misturado” (ou fica vazio). Dá para editar depois.')}</p>
        </div>
        <Campo rotulo="Motivo (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: mesma qualidade, lavar junto')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('Os lotes de origem ficam zerados e o lote novo guarda de onde veio cada grama (compras, quem e quando).')}</p>
      </div>
    </Janela>
  )
}

type TriagemFeita = ResultadoConsulta<'triagens'>[number]
const PERIODOS = [{ id: '', nome: 'Tudo' }, { id: '7', nome: '7 dias' }, { id: '30', nome: '30 dias' }, { id: 'mes', nome: 'Mês' }]
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
  const [periodo, setPeriodo] = useParamTela('tp', '')
  const [quem, setQuem] = useParamTela('tq', '')
  const [compra, setCompra] = useParamTela('tc', '')
  const [perdaMin, setPerdaMin] = useParamTela('tperda', '')
  const [busca, setBusca] = useParamTela('tb', '')
  const [ordem, setOrdem] = useParamTela('to', '')
  const [maisFiltros, setMaisFiltros] = useState(!!(quem || compra || perdaMin))
  const [imprimir, setImprimir] = useState<Id[]>()
  if (!dados) return <Carregando />
  if (!dados.length) return <p className="rounded-xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nenhuma triagem ainda. Selecione lotes no quadro e toque em “Separar” ou “Juntar e separar”.')}</p>

  const agora = new Date()
  const desde = periodo === 'mes' ? new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString() : periodo ? new Date(agora.getTime() - Number(periodo) * 86400000).toISOString() : ''
  const pessoas = [...new Set(dados.map((x) => x.por).filter((p): p is string => !!p))].sort()
  const termo = busca.trim().toLowerCase()
  const termoCompra = compra.trim().toLowerCase()
  const minBp = perdaMin ? Math.round(Number(perdaMin.replace(',', '.')) * 100) : undefined
  const lista = dados
    .filter((x) =>
      (!desde || x.em >= desde) &&
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
  const limpar = () => ajustarParams({ tp: undefined, tq: undefined, tc: undefined, tperda: undefined, tb: undefined, to: undefined })

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
        topo={<AtalhosChips rotulo="Período" icone="📅" valor={periodo} onChange={setPeriodo} opcoes={PERIODOS} />}
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
      <div {...clicavel(onAlternar)} aria-expanded={aberta} className="cursor-pointer px-4 py-3 outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={cx('inline-block w-3 shrink-0 text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
          <b className="font-mono text-base">{x.codigo}</b>
          <span className="min-w-0 flex-1 truncate text-right text-xs text-[var(--suave)]">{dataBR(x.em)}{x.por ? ` · ${x.por}` : ''}</span>
        </div>
        <div className="num mt-2 grid grid-cols-3 gap-1.5 text-center">
          <NumeroPequeno rotulo="Entrou" valor={gramasTexto(x.pesoEntrada)} />
          <NumeroPequeno rotulo="Saiu" valor={gramasTexto(x.pesoSaida)} />
          <NumeroPequeno rotulo="Perda" valor={fmt(x.perdaPct, 'percentual')} cor={corPerda} sub={x.perda > 0 ? gramasTexto(x.perda) : undefined} />
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-[var(--suave)]">{t('{n} pacote(s)', { n: x.saidas.length })}</span>
          {x.saidas.length > 0 && <span className={cx('font-semibold', faltam.length ? 'text-[var(--alerta)]' : 'text-[var(--bom)]')}>{faltam.length ? '🏷' : '✓'} {t('{c} de {n} com etiqueta', { c: com, n: x.saidas.length })}</span>}
          {fornecedores.length > 0 && <span className="min-w-0 truncate text-[var(--suave)]">· {fornecedores.join(', ')}</span>}
        </div>
      </div>
      {faltam.length > 0 && (
        <div className="border-t border-[var(--borda)] px-4 py-2">
          <Botao variante="secundario" className="w-full sm:w-auto" onClick={() => onImprimir(faltam.map((s) => s.id))}>🖨 {rotuloImprimir}</Botao>
        </div>
      )}
      {aberta && (
        <div className="space-y-4 border-t border-[var(--borda)] bg-[var(--fundo)] px-4 py-3">
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
