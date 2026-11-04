// ESTOQUE: lista inteligente (filtros no endereço, favoritos, colunas escolhidas, tabela ou cartões, seleção em massa,
// CSV), SEPARAR lote bruto em N lotes, ajustar, PRONTUÁRIO do lote (compra → triagem → venda) e RASTREIO.

import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Campos, Id } from '../core/domain/tipos'
import type { CampoDef } from '../core/modulos'
import type { ResultadoConsulta } from '../core/services'
import { fatorDaTabela } from '../core/services/precos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Escolha, GramasInput, Info, Janela, Pagina, Selecao, Titulo, Vazio, cx, dataBR, fmt, gramasTexto, ErroTela, moedaPadrao } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { clicavel } from '../ui/compartilhados'
import { AnexosCurtos } from '../ui/anexos'
import { CamposDinamicos, resumoCampos } from '../ui/camposDinamicos'
import { BarraFluxo, LeitorCodigo, STATUS_LOTE, StatusBadge, useTelaLarga } from '../ui/estoqueUi'
import { usePistola } from '../ui/leitorPistola'
import { useLembrado } from '../ui/filtros'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { HistoricoPacote } from '../ui/historicoPacote'
import { CadeiaChips, Caminho, RastreioTotal } from '../ui/rastreioTotal'
import { LinhaDaVida } from '../ui/linhaVida'
import { NumeroGrande } from '../ui/numeroGrande'
import { MenuAcoes, acoesLote } from '../ui/menuAcoes'
import { CampoCodigo, CodigoSelo, TrocarCodigo } from '../ui/codigos'
import { useT } from '../ui/i18n'
import { Trilha } from '../ui/trilha'
import { FotosDoLote, MiniaturaLote, marcadorLote, useTirarFoto } from '../ui/fotos'
import { AvisoPacotesNovos, RefazerEtiqueta } from '../ui/etiquetas'
import { ReservarLote, SeloReserva, reservado } from '../ui/reserva'
import { Passo } from '../ui/passoAPasso'
import { baixarCSV } from './Relatorios'

type Linha = ResultadoConsulta<'estoque'>[number]
interface Coluna { id: string; nome: string; num?: boolean; texto(i: Linha): string; celula?(i: Linha): ReactNode }
interface Favorito { nome: string; params: Record<string, string> }

const STATUS_FILTRO = [
  { id: '', nome: 'Com saldo' },
  { id: 'disponivel', nome: 'Disponível' },
  { id: 'separado', nome: 'Separado / triado' },
  { id: 'bruto', nome: 'Bruto · para separar' },
  { id: 'parcial', nome: 'Parcial' },
  { id: 'esgotado', nome: 'Esgotado' },
  { id: 'todos', nome: 'Todos' },
]

const parar = (e: React.SyntheticEvent) => e.stopPropagation()
/** ainda precisa separar: bruto, em preparação ou "não identificado" (ficou para depois numa separação) */
const ehBruto = (s: string) => s === 'bruto' || s === 'preparando' || s === 'naoIdentificado'
const custoAgora = (i: Linha) => (i.custoPrincipal && i.quantidadeInicial ? Math.round((i.custoPrincipal * i.saldo) / i.quantidadeInicial) : undefined)
const qtd = (i: Pick<Linha, 'unidade'>, n?: number) => (n === undefined ? '' : fmt(n, i.unidade === 'grama' ? 'gramas' : 'numero'))
/** atributos que viram "chips" ao lado do nome (curtos, nunca quebram no meio) */
const CHIPS = ['comprimento', 'categoria', 'cor']
const chip = 'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-[var(--fundo)] px-2 py-0.5 text-xs'

/** "Veio de" por extenso, para o CSV: "P-0003 · Helena · separado de L-0001" */
function origemTexto(i: Linha, t: (s: string) => string) {
  return [
    ...i.compras.map((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' · ')),
    i.pai ? `${t('separado de')} ${i.pai.codigo ?? i.pai.nome}` : '',
    i.unificadoDe?.length ? `${t('juntado de')} ${i.unificadoDe.join(' + ')}` : '',
  ].filter(Boolean).join(' · ')
}

/** link discreto dentro de uma linha clicável (não abre o lote junto) */
const linkLeve = 'rounded hover:text-[var(--marca)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--marca)]'

/**
 * De onde veio o lote, numa linha curta: "🛒 P-0002 · Cecília" (código abre a compra, nome abre o fornecedor) e, se for
 * filho de uma separação, "✂ de L-0001" (abre o lote-mãe). Compra sem código mostra só o fornecedor (nada de "?").
 */
function VeioDe({ i }: { i: Linha }) {
  const t = useT()
  const { ir } = useApp()
  const vazio = !i.compras.length && !i.pai && !i.unificadoDe?.length
  const abrir = (tela: string, id: Id) => (e: React.MouseEvent) => (e.stopPropagation(), ir(tela, { id }))
  return (
    <div className="min-w-0 space-y-0.5 text-xs leading-snug">
      {i.compras.map((c) => (
        <div key={c.id} className="flex min-w-0 items-center gap-1">
          <span aria-hidden className="shrink-0">🛒</span>
          <button type="button" onClick={abrir('pedido', c.id)} onKeyDown={parar} className={cx(linkLeve, 'shrink-0 font-mono font-semibold')} title={t('Abrir a compra')}>{c.codigo ?? t('Compra')}</button>
          {c.fornecedor && (
            <>
              <span aria-hidden className="text-[var(--suave)]">·</span>
              {c.fornecedorId
                ? <button type="button" onClick={abrir('pessoa', c.fornecedorId)} onKeyDown={parar} className={cx(linkLeve, 'min-w-0 truncate')} title={`${t('Ver fornecedor')} · ${c.fornecedor}`}>{c.fornecedor}</button>
                : <span className="min-w-0 truncate">{c.fornecedor}</span>}
            </>
          )}
        </div>
      ))}
      {i.pai && (
        <div className="flex min-w-0 items-center gap-1 text-[var(--suave)]">
          <span aria-hidden className="shrink-0">✂</span>{t('de')}
          <button type="button" onClick={abrir('lote', i.pai.id)} onKeyDown={parar} className={cx(linkLeve, 'font-mono')} title={t('Ver lote de origem')}>{i.pai.codigo ?? i.pai.nome}</button>
        </div>
      )}
      {!!i.unificadoDe?.length && <div className="truncate text-[var(--suave)]" title={i.unificadoDe.join(' + ')}><span aria-hidden>🔗</span> {t('juntado de')} <span className="font-mono">{i.unificadoDe.join(' + ')}</span></div>}
      {vazio && <span className="text-[var(--suave)]">{t('cadastro')}</span>}
    </div>
  )
}

/** Peso: o que TEM agora em destaque; "de 7,8 kg" e a barrinha só quando já saiu alguma coisa (senão é ruído). */
function Peso({ i, esquerda }: { i: Linha; esquerda?: boolean }) {
  const t = useT()
  const ini = i.quantidadeInicial ?? 0
  const mudou = ini > 0 && ini !== i.saldo
  const pct = mudou ? Math.max(0, Math.min(100, (i.saldo / ini) * 100)) : 100
  return (
    <div className={cx('min-w-[5.5rem]', !esquerda && 'text-right')}>
      <div className="num whitespace-nowrap text-base font-bold leading-tight">{qtd(i, i.saldo)}</div>
      {mudou && (
        <>
          <div className="num whitespace-nowrap text-xs text-[var(--suave)]">{t('de {q}', { q: qtd(i, ini) })}</div>
          <div className={cx('mt-0.5 h-1 w-full max-w-[6rem] overflow-hidden rounded-full bg-[var(--borda)]', !esquerda && 'ml-auto')} role="img" aria-label={`${Math.round(pct)}%`}><div className="h-full rounded-full bg-[var(--marca)]" style={{ width: `${pct}%` }} /></div>
        </>
      )}
    </div>
  )
}

const COR_TOM = { bom: 'var(--bom)', alerta: 'var(--alerta)', marca: 'var(--marca)', neutro: 'var(--suave)' } as const
/** Status em bolinha colorida + texto (lê de longe, ocupa pouco). */
function StatusPonto({ status }: { status: Linha['status'] }) {
  const t = useT()
  const s = STATUS_LOTE[status]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold" style={{ color: s.tom === 'neutro' ? 'var(--suave)' : COR_TOM[s.tom] }}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR_TOM[s.tom] }} />
      {t(s.nome)}
    </span>
  )
}

/** atributos de todos os tipos com estoque do módulo (os do código + os criados em Configurações › Atributos) */
export function useCamposModulo(moduloId: string, tipoItem?: string): CampoDef[] {
  const { dados: cfg } = useConsulta('configuracoes', {})
  return useMemo(() => {
    const tipos = cfg?.modulos.find((m) => m.id === moduloId)?.tiposItem.filter((x) => (tipoItem ? x.id === tipoItem : x.controlaEstoque)) ?? []
    const vistos = new Map<string, CampoDef>()
    for (const c of tipos.flatMap((x) => x.campos)) if (!vistos.has(c.id)) vistos.set(c.id, c)
    return [...vistos.values()]
  }, [cfg, moduloId, tipoItem])
}

export function Estoque() {
  const t = useT()
  const { ir, nav, ajustarParams, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const larga = useTelaLarga()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const modulos = (cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.tiposItem.some((x) => x.controlaEstoque))
  const [modulo] = useParamTela('modulo', 'cabelo')
  const campos = useCamposModulo(modulo)
  const p = (k: string) => (nav.params[k] === undefined ? '' : String(nav.params[k]))
  const setP = (k: string, v: string) => ajustarParams({ [k]: v || undefined, ...(k === 'status' ? { bruto: undefined } : {}) })
  const busca = p('busca')
  const status = p('status') || (nav.params.bruto ? 'bruto' : '')
  const repor = !!nav.params.repor
  const { dados } = useConsulta('estoque', { moduloId: modulo })
  const [visao, setVisao] = useLembrado<'tabela' | 'cartoes'>('estoque.visao', 'tabela')
  const [colunasSalvas, setColunasSalvas] = useLembrado<Record<string, string[]>>('estoque.colunas.v2', {})
  const [favoritos, setFavoritos] = useLembrado<Favorito[]>('estoque.favoritos', [])
  const [sel, setSel] = useState<Set<Id>>(new Set())
  const [ajustar, setAjustar] = useState<Id>()
  const [trocar, setTrocar] = useState<Linha>()
  const [reservar, setReservar] = useState<Linha>()
  const [janela, setJanela] = useState<'colunas' | 'favorito' | 'marcar' | 'camera'>()
  const { tirar } = useTirarFoto()
  const [abrirFiltros, setAbrirFiltros] = useState(false)

  // ---------- filtros ----------
  const chavesFiltro = Object.keys(nav.params).filter((k) => k !== 'modulo')
  const avancados = chavesFiltro.filter((k) => !['busca', 'status', 'bruto', 'repor'].includes(k)).length
  const limpar = () => ajustarParams(Object.fromEntries(chavesFiltro.map((k) => [k, undefined])))
  const termo = busca.trim().toLowerCase()
  const passaCampos = (i: Linha) =>
    campos.every((c) => {
      const v = i.campos[c.id]
      if (c.tipo === 'numero') {
        const mn = p(`min.${c.id}`)
        const mx = p(`max.${c.id}`)
        if (!mn && !mx) return true
        const n = Number(v)
        return v !== undefined && v !== null && v !== '' && Number.isFinite(n) && (!mn || n >= Number(mn)) && (!mx || n <= Number(mx))
      }
      const f = p(`f.${c.id}`)
      return !f || (c.tipo === 'simNao' ? String(v === true) === f : String(v ?? '') === f)
    })
  const base = (dados ?? []).filter(
    (i) =>
      (!repor || i.repor > 0) &&
      (!termo || i.busca.includes(termo) || [i.nome, i.fornecedor, ...Object.values(i.campos)].some((v) => v !== undefined && v !== null && String(v).toLowerCase().includes(termo))) &&
      (!p('de') || i.entrada >= p('de')) &&
      (!p('ate') || i.entrada <= p('ate')) &&
      (!p('compra') || i.busca.includes(p('compra').trim().toLowerCase())) &&
      passaCampos(i),
  )
  const passaStatus = (i: Linha) =>
    status === 'todos' ? true : status === 'esgotado' ? i.saldo <= 0 : status === 'separado' ? i.saldo > 0 && !ehBruto(i.status) : status === 'bruto' ? ehBruto(i.status) : status ? i.status === status : repor || i.saldo > 0
  const lista = base.filter(passaStatus)
  const unidade = dados?.[0]?.unidade ?? (modulo === 'cabelo' ? 'grama' : 'peca')
  const fq = (n: number) => qtd({ unidade }, n)
  const comSaldo = base.filter((i) => i.saldo > 0)
  const somar = (xs: Linha[]) => xs.reduce((s, i) => s + i.saldo, 0)
  const disponiveis = comSaldo.filter((i) => !ehBruto(i.status))
  const brutos = comSaldo.filter((i) => ehBruto(i.status))

  // ---------- colunas ----------
  const textoCampo = (c: CampoDef, v: Campos[string]) => (v === undefined || v === null || v === '' ? '' : c.tipo === 'simNao' ? t(v ? 'Sim' : 'Não') : `${typeof v === 'string' ? t(v) : v}${c.unidade ? ` ${c.unidade}` : ''}`)
  // código e lote são fixos (sempre na frente); o resto se escolhe em "Colunas" (Veio de, peso e status vêm ligados)
  const colunas: Coluna[] = [
    { id: 'origem', nome: 'Veio de', texto: (i) => origemTexto(i, t), celula: (i) => <VeioDe i={i} /> },
    { id: 'peso', nome: 'Peso', num: true, texto: (i) => [qtd(i, i.saldo), qtd(i, i.quantidadeInicial)].filter(Boolean).join(' / '), celula: (i) => <Peso i={i} /> },
    { id: 'status', nome: 'Status', texto: (i) => t(STATUS_LOTE[i.status].nome), celula: (i) => <StatusPonto status={i.status} /> },
    ...campos.map((c): Coluna => ({ id: `c.${c.id}`, nome: c.nome, num: c.tipo === 'numero', texto: (i) => textoCampo(c, i.campos[c.id]) })),
    { id: 'vendido', nome: 'Vendido', num: true, texto: (i) => (i.vendido ? qtd(i, i.vendido) : '') },
    { id: 'caminho', nome: 'Caminho', texto: (i) => [i.cadeia.compras.map((c) => c.codigo).join(' + '), i.cadeia.triagens.map((x) => x.codigo).join(' + '), i.cadeia.vendas.map((v) => v.codigo).join(', ')].filter(Boolean).join(' → '), celula: (i) => <CadeiaChips cadeia={i.cadeia} /> },
    { id: 'entrada', nome: 'Entrada', texto: (i) => dataBR(i.entrada) },
    ...(admin ? [{ id: 'custo', nome: 'Custo', num: true, texto: (i: Linha) => { const c = custoAgora(i); return c === undefined ? '' : formatar(c, moedaPadrao()) } }] : []),
  ]
  const padrao = ['origem', 'peso', 'status']
  const escolhidas = colunasSalvas[modulo] ?? padrao
  // chips só do que o nome NÃO diz (o nome já é "38 cm · Normal · Castanho": repetir em chips é ruído)
  const chipsDe = (i: Linha) => {
    const noNome = new Set(i.nome.toLowerCase().split(/\s*·\s*/).map((x) => x.trim()))
    return CHIPS.map((id) => campos.find((c) => c.id === id)).filter((c): c is CampoDef => !!c)
      .map((c) => ({ id: c.id, bruto: String(i.campos[c.id] ?? '').toLowerCase(), texto: textoCampo(c, i.campos[c.id]) }))
      .filter((x) => x.texto && !noNome.has(x.texto.toLowerCase()) && !noNome.has(x.bruto) && ![...noNome].some((n) => n.startsWith(`${x.bruto} `)))
  }
  const visiveis = colunas.filter((c) => escolhidas.includes(c.id))
  const modo = larga ? visao : 'cartoes'

  // ---------- seleção e ações em massa ----------
  const selecionados = lista.filter((i) => sel.has(i.id))
  const todos = lista.length > 0 && selecionados.length === lista.length
  const alternar = (id: Id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const exportar = (linhas: Linha[]) =>
    baixarCSV(`estoque-${modulo}-${new Date().toISOString().slice(0, 10)}`, linhas.map((i) => Object.fromEntries([[t('Código'), i.codigo ?? ''], [t('Lote / item'), i.nome], ...visiveis.map((c) => [t(c.nome), c.texto(i)])])))
  // leu um código: se é o código de um lote (atual ou antigo), abre o lote; senão vira a busca
  const lerCodigo = useCallback((c: string) => {
    setJanela(undefined)
    const k = c.trim().toLowerCase()
    const achado = (dados ?? []).find((i) => [i.codigo, ...(i.codigosAnteriores ?? [])].some((x) => x?.toLowerCase() === k))
    if (achado) ir('lote', { id: achado.id })
    else ajustarParams({ busca: c })
  }, [ajustarParams, dados, ir])
  // leitor pistola: Enter com o código exato de um pacote abre o pacote
  const pistola = usePistola(dados, (l) => ir('lote', { id: l.id }))

  const acoes = (i: Linha) => (
    <div className="flex flex-nowrap justify-end gap-0.5" onClick={parar} onKeyDown={parar}>
      {admin && ehBruto(i.status) && i.saldo > 0 && <BotaoIcone rotulo={t('Separar')} onClick={() => ir('separar', { id: i.id })}>✂️</BotaoIcone>}
      <MenuAcoes acoes={acoesLote(
        { id: i.id, saldo: i.saldo, compras: i.compras, vendavel: !ehBruto(i.status), etiquetaImpressa: !!i.etiquetaImpressaEm, reservado: reservado(i), origens: i.pai ? [i.pai] : i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).map((id, k) => ({ id, codigo: i.unificadoDe?.[k] })) : [] },
        { ir, t, admin, onAjustar: () => setAjustar(i.id), onTrocarCodigo: () => setTrocar(i), onReservar: () => setReservar(i), extras: [
          { rotulo: 'Tirar foto', icone: '📷', onClick: () => tirar(i.id), separar: true },
          { rotulo: 'Escolher foto da galeria', icone: '🖼', onClick: () => tirar(i.id, { galeria: true }) },
          ...(ehBruto(i.status) && i.saldo > 0 ? [{ rotulo: 'Abrir na triagem', icone: '🧺', onClick: () => ir('triagem'), separar: true }] : []),
        ] },
      )} />
    </div>
  )
  /** nome numa linha só (inteiro no "title"); chips só para medida/categoria/cor que o nome não mostra */
  const nomeLote = (i: Linha, quebrar?: boolean) => {
    const chips = chipsDe(i)
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={cx('min-w-0 max-w-full font-semibold', quebrar ? 'line-clamp-2 leading-snug' : 'truncate')} title={i.nome}>{i.nome}</span>
        {chips.map((x) => <span key={x.id} className={chip}>{x.texto}</span>)}
        <SeloReserva i={i} />
      </div>
    )
  }
  const caixa = (i: Linha) => <input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={`${t('Selecionar')} ${i.codigo ?? i.nome}`} checked={sel.has(i.id)} onChange={() => alternar(i.id)} onClick={parar} onKeyDown={parar} />

  return (
    <div>
      <Titulo subtitulo={t('Cada número é a soma dos movimentos: nada some, tudo tem histórico.')}>{t('Estoque')}</Titulo>
      {modulos.length > 1 && <Abas atual={modulo} onChange={(m) => (setSel(new Set()), ajustarParams({ ...Object.fromEntries(chavesFiltro.map((k) => [k, undefined])), modulo: m === 'cabelo' ? undefined : m }))} abas={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />}

      {/* BIG NUMBERS (padrão NumeroGrande): tocar filtra a lista pela situação; o filtro ligado fica destacado */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <NumeroGrande rotulo="Em estoque" icone="📦" cor="var(--marca)" valor={fq(somar(comSaldo))} selos={[{ texto: t('{n} lote(s)', { n: comSaldo.length }), tom: 'marca' }]} ativo={!status} onClick={() => setP('status', '')} />
        <NumeroGrande rotulo="Disponível" icone="✅" cor="var(--bom)" colorirValor valor={fq(somar(disponiveis))} selos={[{ texto: t('{n} lote(s)', { n: disponiveis.length }) }, { texto: t('pronto para vender'), tom: 'bom' }]} ativo={status === 'separado'} onClick={() => setP('status', status === 'separado' ? '' : 'separado')} />
        <NumeroGrande rotulo="Para separar" icone="⏳" cor="var(--alerta)" colorirValor={brutos.length > 0} valor={fq(somar(brutos))} selos={[{ texto: t('{n} lote(s)', { n: brutos.length }) }, ...(brutos.length ? [{ texto: t('bruto'), tom: 'alerta' as const }] : [])]} ativo={status === 'bruto'} onClick={() => setP('status', status === 'bruto' ? '' : 'bruto')} />
        <NumeroGrande rotulo="Esgotados" icone="⭕" cor="var(--suave)" valor={String(base.length - comSaldo.length)} selos={[{ texto: t('sem saldo') }]} ativo={status === 'esgotado'} onClick={() => setP('status', status === 'esgotado' ? '' : 'esgotado')} />
        {admin && <NumeroGrande rotulo="Valor em estoque" icone="💵" cor="#0ea5e9" valor={formatar(comSaldo.reduce((s, i) => s + (custoAgora(i) ?? 0), 0), moedaPadrao())} selos={[{ texto: t('a custo'), tom: 'marca' }, { texto: t('o que ainda tem') }]} />}
      </div>

      {/* barra única: no celular a busca ocupa a linha e os botões vão embaixo (só ícone no que é raro); na tela larga, tudo numa linha */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Entrada type="search" aria-label={t('Buscar por código, nome ou atributo')} className="w-auto min-w-0 flex-1 basis-full sm:basis-48" placeholder={t('Buscar por código, nome ou atributo')} value={busca} onChange={(e) => setP('busca', e.target.value)} onKeyDown={pistola.onKeyDown} />
        <div className="flex flex-1 flex-nowrap items-center gap-1.5 sm:flex-none">
          <Botao variante="secundario" className="whitespace-nowrap px-3" onClick={() => setJanela('camera')}>📷 {t('Ler código')}</Botao>
          <Botao variante={abrirFiltros || avancados ? 'secundario' : 'leve'} className="whitespace-nowrap px-3" aria-expanded={abrirFiltros} onClick={() => setAbrirFiltros(!abrirFiltros)}>⚙︎ {t('Filtros')}{avancados ? ` · ${avancados}` : ''}</Botao>
          <Botao variante="leve" className="whitespace-nowrap px-3" title={t('Colunas')} onClick={() => setJanela('colunas')}>▦<span className="sr-only sm:not-sr-only"> {t('Colunas')}</span></Botao>
          {larga && <div className="shrink-0 [&_button]:whitespace-nowrap"><Escolha rotulo="Ver como" valor={visao} onChange={setVisao} opcoes={[{ id: 'tabela', nome: 'Tabela' }, { id: 'cartoes', nome: 'Cartões' }]} /></div>}
          <Botao variante="leve" className="ml-auto whitespace-nowrap px-3 sm:ml-0" disabled={!lista.length} title={selecionados.length ? t('Exportar CSV dos {n} selecionados', { n: selecionados.length }) : t('Exportar CSV')} aria-label={t('Exportar CSV')} onClick={() => exportar(selecionados.length ? selecionados : lista)}>⬇<span className="hidden sm:inline"> CSV</span></Botao>
        </div>
      </div>

      {abrirFiltros && (
        <div className="mb-2 grid gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Status"><Selecao valor={status} onChange={(v) => setP('status', v)} opcoes={STATUS_FILTRO.slice(1)} vazio={STATUS_FILTRO[0].nome} /></Campo>
          {campos.filter((c) => c.tipo === 'numero').map((c) => (
            <Campo key={c.id} comoDiv rotulo={`${c.nome}${c.unidade ? ` (${c.unidade})` : ''}`}>
              <div className="flex items-center gap-1">
                <Entrada inputMode="numeric" aria-label={`${t(c.nome)} · ${t('mínimo')}`} placeholder={t('mín.')} value={p(`min.${c.id}`)} onChange={(e) => setP(`min.${c.id}`, e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
                <span className="text-[var(--suave)]">–</span>
                <Entrada inputMode="numeric" aria-label={`${t(c.nome)} · ${t('máximo')}`} placeholder={t('máx.')} value={p(`max.${c.id}`)} onChange={(e) => setP(`max.${c.id}`, e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
              </div>
            </Campo>
          ))}
          {campos.filter((c) => c.tipo === 'lista' || c.tipo === 'simNao').map((c) => (
            <Campo key={c.id} rotulo={c.nome}>
              <Selecao valor={p(`f.${c.id}`)} onChange={(v) => setP(`f.${c.id}`, v)} vazio="Todos" opcoes={c.tipo === 'simNao' ? [{ id: 'true', nome: 'Sim' }, { id: 'false', nome: 'Não' }] : (c.opcoes ?? []).map((o) => ({ id: o, nome: o }))} />
            </Campo>
          ))}
          <Campo rotulo="Lote de origem / compra"><Entrada placeholder="P-0003 / L-0001" value={p('compra')} onChange={(e) => setP('compra', e.target.value)} /></Campo>
          <Campo comoDiv rotulo="Entrada (período)">
            <div className="flex items-center gap-1">
              <Entrada type="date" aria-label={t('De')} value={p('de')} onChange={(e) => setP('de', e.target.value)} />
              <Entrada type="date" aria-label={t('Até')} value={p('ate')} onChange={(e) => setP('ate', e.target.value)} />
            </div>
          </Campo>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="num text-xs text-[var(--suave)]" aria-live="polite">{t('{n} de {total} lote(s)', { n: lista.length, total: dados?.length ?? 0 })}</span>
        {favoritos.map((f, k) => (
          <span key={k} className="inline-flex items-center rounded-full bg-[var(--marca-suave)] text-[var(--marca)]">
            <button type="button" className="min-h-10 rounded-l-full pl-3 pr-1 font-semibold" onClick={() => ajustarParams({ ...Object.fromEntries(chavesFiltro.map((x) => [x, undefined])), ...f.params })}>★ {f.nome}</button>
            <button type="button" className="min-h-10 min-w-10 rounded-r-full" aria-label={`${t('Tirar favorito')} ${f.nome}`} onClick={() => setFavoritos(favoritos.filter((_, j) => j !== k))}>×</button>
          </span>
        ))}
        {chavesFiltro.length > 0 && (
          <>
            <Botao variante="leve" onClick={() => setJanela('favorito')}>☆ {t('Salvar filtro')}</Botao>
            <Botao variante="leve" onClick={limpar}>× {t('Limpar filtros')}</Botao>
          </>
        )}
      </div>

      {!dados ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio texto="Nada no estoque com esse filtro.">{chavesFiltro.length > 0 && <Botao variante="secundario" onClick={limpar}>{t('Limpar filtros')}</Botao>}</Vazio>
      ) : modo === 'tabela' ? (
        <div id="lista-estoque" className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--fundo)] text-left text-xs text-[var(--suave)]">
              <tr>
                <th className="w-10 px-2 py-1.5"><input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={t('Selecionar todos os filtrados')} checked={todos} onChange={() => setSel(todos ? new Set() : new Set(lista.map((i) => i.id)))} /></th>
                <th className="w-12 px-1 py-1.5"><span className="sr-only">{t('Foto')}</span></th>
                <th className="whitespace-nowrap px-2 py-1.5">{t('Código')}</th>
                <th className="px-2 py-1.5">{t('Lote / item')}</th>
                {visiveis.map((c) => <th key={c.id} className={cx('whitespace-nowrap px-2 py-1.5', c.num && 'text-right')}>{t(c.nome)}</th>)}
                <th className="relative w-10 px-2 py-1.5"><span className="sr-only">{t('Ações')}</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id} {...clicavel(() => ir('lote', { id: i.id }))} className={cx('cursor-pointer border-t border-[var(--borda)] align-middle outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]', sel.has(i.id) && 'bg-[var(--marca-suave)]', i.saldo <= 0 && 'text-[var(--suave)]')}>
                  <td className="px-2 py-1">{caixa(i)}</td>
                  <td className="px-1 py-1"><MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} tamanho="sm" iconeSemFoto /></td>
                  <td className="whitespace-nowrap px-2 py-1"><CodigoSelo codigo={i.codigo} anteriores={i.codigosAnteriores} /></td>
                  <td className="w-full min-w-[11rem] max-w-0 px-2 py-1">{nomeLote(i)}</td>
                  {visiveis.map((c) => <td key={c.id} className={cx('px-2 py-1', c.id === 'origem' && 'min-w-[10rem] max-w-[16rem]', c.id === 'status' && 'whitespace-nowrap', c.num && 'num whitespace-nowrap text-right')}>{c.celula ? c.celula(i) : c.texto(i) || '—'}</td>)}
                  <td className="px-1 py-1">{acoes(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul id="lista-estoque" className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((i) => {
            const extras = visiveis.filter((c) => !['origem', 'peso', 'status'].includes(c.id)).map((c) => [c, c.texto(i)] as const).filter(([, v]) => v)
            return (
              // cartão: [☐ foto | nome (linha toda) | ⋯] · embaixo código + status à esquerda e o peso à direita · de onde veio, pequeno
              <li key={i.id} {...clicavel(() => ir('lote', { id: i.id }))} className={cx('min-w-0 cursor-pointer rounded-2xl border bg-[var(--cartao)] p-2.5 shadow-sm outline-none transition hover:border-[var(--marca)] focus-visible:border-[var(--marca)]', sel.has(i.id) ? 'border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-[var(--borda)]', i.saldo <= 0 && 'text-[var(--suave)]')}>
                {/* em cima: seleção · foto · nome · ⋯ ; embaixo, com a largura TODA do cartão: código · situação · peso e de onde veio */}
                <div className="flex items-center gap-2">
                  <div className="flex h-10 shrink-0 items-center">{caixa(i)}</div>
                  <MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} tamanho="sm" iconeSemFoto />
                  <div className="flex min-h-10 min-w-0 flex-1 items-center">{nomeLote(i, true)}</div>
                  <div className="-mr-1 shrink-0">{acoes(i)}</div>
                </div>
                <div className="mt-2 flex items-start gap-2 border-t border-[var(--borda)] pt-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"><CodigoSelo codigo={i.codigo} anteriores={i.codigosAnteriores} /><StatusPonto status={i.status} /></div>
                  <Peso i={i} />
                </div>
                <div className="mt-1"><VeioDe i={i} /></div>
                {extras.length > 0 && <p className="mt-1 text-xs text-[var(--suave)] [overflow-wrap:anywhere]">{extras.map(([c, v]) => `${t(c.nome)}: ${v}`).join(' · ')}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {selecionados.length > 0 && (
        <div className="sticky bottom-20 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-lg md:bottom-4" role="region" aria-label={t('Ações em massa')}>
          <b className="px-2 text-sm">{t('{n} selecionado(s)', { n: selecionados.length })}</b>
          {!todos && <Botao variante="leve" onClick={() => setSel(new Set(lista.map((i) => i.id)))}>{t('Selecionar todos os {n} filtrados', { n: lista.length })}</Botao>}
          <Botao variante="secundario" onClick={() => exportar(selecionados)}>⬇ {t('Exportar CSV')}</Botao>
          <Botao variante="secundario" onClick={() => ir('etiquetas', { f: 'todas', sel: selecionados.map((i) => i.id).join(',') })}>🏷 {t('Imprimir etiquetas')}</Botao>
          {admin && <Botao variante="secundario" onClick={() => setJanela('marcar')}>✎ {t('Mudar atributo')}</Botao>}
          <Botao variante="leve" onClick={() => setSel(new Set())}>{t('Limpar seleção')}</Botao>
        </div>
      )}

      {ajustar && <Ajustar itemId={ajustar} onFechar={() => setAjustar(undefined)} />}
      {trocar && <TrocarCodigo tipo="lote" id={trocar.id} atual={trocar.codigo} onFechar={() => setTrocar(undefined)} />}
      {reservar && <ReservarLote id={reservar.id} codigo={reservar.codigo} atual={reservar.reserva} onFechar={() => setReservar(undefined)} />}
      {janela === 'camera' && <LeitorCodigo onLer={lerCodigo} onFechar={() => setJanela(undefined)} />}
      {janela === 'colunas' && (
        <Janela aberta titulo={t('Colunas')} onFechar={() => setJanela(undefined)} rodape={<Botao variante="leve" className="w-full" onClick={() => setColunasSalvas({ ...colunasSalvas, [modulo]: padrao })}>{t('Voltar ao padrão')}</Botao>}>
          <p className="mb-2 text-sm text-[var(--suave)]">{t('Escolha o que aparece na lista e no CSV. Fica guardado neste aparelho.')}</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {colunas.map((c) => (
              <label key={c.id} className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={escolhidas.includes(c.id)} onChange={(e) => setColunasSalvas({ ...colunasSalvas, [modulo]: e.target.checked ? colunas.map((x) => x.id).filter((x) => x === c.id || escolhidas.includes(x)) : escolhidas.filter((x) => x !== c.id) })} />
                {t(c.nome)}
              </label>
            ))}
          </div>
        </Janela>
      )}
      {janela === 'favorito' && <SalvarFavorito onFechar={() => setJanela(undefined)} onSalvar={(nome) => setFavoritos([...favoritos.filter((f) => f.nome !== nome), { nome, params: Object.fromEntries(Object.entries(nav.params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) }])} />}
      {janela === 'marcar' && <MarcarLotes ids={selecionados.map((i) => i.id)} campos={campos} onFechar={() => setJanela(undefined)} onFeito={() => setSel(new Set())} />}
    </div>
  )
}

function BotaoIcone({ rotulo, onClick, children }: { rotulo: string; onClick(): void; children: ReactNode }) {
  return <button type="button" title={rotulo} aria-label={rotulo} onClick={onClick} className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl text-base text-[var(--marca)] hover:bg-[var(--marca-suave)]">{children}</button>
}

function SalvarFavorito({ onSalvar, onFechar }: { onSalvar(nome: string): void; onFechar(): void }) {
  const t = useT()
  const [nome, setNome] = useState('')
  const salvar = () => nome.trim() && (onSalvar(nome.trim()), onFechar())
  return (
    <Janela aberta titulo={t('Salvar filtro')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={!nome.trim()} onClick={salvar}>{t('Salvar')}</Botao>}>
      <Campo rotulo="Nome do filtro"><Entrada autoFocus value={nome} placeholder={t('Ex.: 60 cm loiro para separar')} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()} /></Campo>
      <p className="mt-2 text-xs text-[var(--suave)]">{t('Fica guardado neste aparelho; um toque aplica de novo.')}</p>
    </Janela>
  )
}

/** Mudar um atributo (situação, cor, categoria…) de vários lotes de uma vez; cada lote fica com o "antes → depois" no log. */
function MarcarLotes({ ids, campos, onFechar, onFeito }: { ids: Id[]; campos: CampoDef[]; onFechar(): void; onFeito(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const opcoes = campos.filter((c) => c.tipo === 'lista' || c.tipo === 'simNao')
  const [campoId, setCampoId] = useState(opcoes[0]?.id ?? '')
  const [valor, setValor] = useState('')
  const c = opcoes.find((x) => x.id === campoId)
  const enviar = async () => {
    if (!c) return
    const v = valor === '' ? null : c.tipo === 'simNao' ? valor === 'true' : valor
    const r = await executar('marcarLotes', { ids, campos: { [c.id]: v } }, t('{n} lote(s) alterado(s).', { n: ids.length }))
    if (r) (onFeito(), onFechar())
  }
  return (
    <Janela aberta titulo={t('Mudar atributo de {n} lote(s)', { n: ids.length })} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !c} onClick={enviar}>{t('Aplicar')}</Botao>}>
      <div className="space-y-3">
        <Campo rotulo="Atributo"><Selecao valor={campoId} onChange={(v) => (setCampoId(v), setValor(''))} opcoes={opcoes.map((x) => ({ id: x.id, nome: x.nome }))} /></Campo>
        {c && <Campo rotulo="Novo valor"><Selecao valor={valor} onChange={setValor} vazio="— sem valor —" opcoes={c.tipo === 'simNao' ? [{ id: 'true', nome: 'Sim' }, { id: 'false', nome: 'Não' }] : (c.opcoes ?? []).map((o) => ({ id: o, nome: o }))} /></Campo>}
        <p className="text-xs text-[var(--suave)]">{t('Cada lote fica com o antes → depois no histórico. O nome do lote acompanha a mudança.')}</p>
      </div>
    </Janela>
  )
}

/**
 * TRIAGEM em um passo (#/separar?id=… ou ?ids=a,b): um ou vários lotes (de compras diferentes, se quiser) → junta e
 * separa nas partes digitadas; o que sobrar é perda. Gera UM id de triagem (T-0004). Dá também para só juntar.
 * Vindo da Triagem (&volta=triagem), volta para o quadro depois.
 */
export function SepararTela() {
  const { nav, voltar, ir, marcarSujo } = useApp()
  const ids =(nav.params.ids ? String(nav.params.ids).split(',') : [nav.params.id as Id]).filter(Boolean)
  const daTriagem = nav.params.volta === 'triagem'
  // depois de separar: volta na hora (quadro ou pacote) e lá aparece no alto "✓ 3 pacotes novos · 🏷 Imprimir etiquetas · Depois"
  // (?novos=…, cartão AvisoPacotesNovos). Nada de janela por cima de uma tela vazia.
  const seguir = (feitos: Id[]) => {
    marcarSujo(false)
    const novos = feitos.length ? feitos.join(',') : undefined
    // 1 pacote novo (vindo do pacote ou da compra): abre ele; senão a Triagem, onde estão todos os novos — nunca o
    // bruto que acabou de zerar (0 g · Esgotado confundia)
    if (daTriagem || feitos.length !== 1) ir('triagem', { novos })
    else ir('lote', { id: feitos[0], novos })
  }
  return <Separar ids={ids} onFechar={voltar} voltarRotulo={daTriagem ? 'Voltar à triagem' : undefined} onSeparou={seguir} />
}

const DICA_SEPARAR = 'Digite o peso e o que é cada parte; o que sobrar é perda. Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.'
const DICA_JUNTAR = 'Junta pacotes de compras diferentes; a origem de cada grama fica guardada. Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.'
const DICA_PERDA = 'O que não virou pacote. Ex.: separou 10.000 g, saíram 9.400 g → 600 g (6%) de perda.'
const DICA_REFERENCIA = 'Divide o custo pelo valor de mercado. Ex.: 60 cm vale mais que 30 cm, então leva mais do custo.'

function Separar({ ids, onFechar, onSeparou, voltarRotulo }: { ids: Id[]; onFechar(): void; onSeparou(lotes: Id[]): void; voltarRotulo?: string }) {
  const t = useT()
  const { dados: primeiro, erro } = useConsulta('fichaItem', { id: ids[0] })
  const { dados: todos } = useConsulta('estoque', { moduloId: primeiro?.item.moduloId ?? '' }, !!primeiro)
  const campos = useCamposModulo(primeiro?.item.moduloId ?? '', primeiro?.item.tipoItem)
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [usada, setUsada] = useState<number>()
  const [pesado, setPesado] = useState<number>()
  const [motivo, setMotivo] = useState('')
  const [partes, setPartes] = useState<{ id: Id; quantidade?: number; campos: Campos; ref?: string; codigo?: string }[]>([{ id: novoId(), campos: { estado: 'Separado', categoria: 'Normal' } }])
  // "Deixar para depois": vira um pacote "Não identificado" (pendência), não perda
  const [depois, setDepois] = useState<{ id: Id; quantidade?: number; codigo?: string }>(() => ({ id: novoId() }))
  // rateio do custo, preço de referência e códigos manuais ficam no "Avançado ▸"
  const [avancado, setAvancado] = useState(false)
  // passo a passo: começa no passo 2 (as partes), com a primeira parte aberta
  const [passosAbertos, setPassosAbertos] = useState<Set<number>>(() => new Set([2]))
  const [parteAberta, setParteAberta] = useState<Id | undefined>(() => partes[0]?.id)
  const { dados: regrasCodigos } = useConsulta('codigos', {})
  const [digitarCodigos, setDigitarCodigos] = useState<boolean>()
  const [codigosOk, setCodigosOk] = useState<Record<Id, boolean>>({})
  const marcarCodigo = useCallback((pid: Id, ok: boolean) => setCodigosOk((m) => (m[pid] === ok ? m : { ...m, [pid]: ok })), [])
  const [porValor, setPorValor] = useState(true)
  const [coluna, setColuna] = useState<string>()
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  useAvisoSaida(usada !== undefined || coluna !== undefined || !!depois.quantidade || partes.length > 1 || partes.some((p) => p.quantidade || p.ref || p.campos.comprimento || p.campos.cor))
  const col = coluna ?? tabela?.colunas.find((c) => /p\.?w|paragu/i.test(c.nome))?.id ?? tabela?.colunas[0]?.id
  const refDe = (p: { campos: Campos; ref?: string }) => {
    if (p.ref) return p.ref
    const med = Number(p.campos.comprimento)
    const tb = tabelas?.find((x) => (x.categoria ?? 'Normal') === String(p.campos.categoria ?? 'Normal')) ?? tabela
    return tb && med && col ? fatorDaTabela(tb, med, col).fator : undefined
  }
  if (erro) return <ErroTela texto={erro} onVoltar={onFechar} />
  if (!primeiro || (ids.length > 1 && !todos)) return null
  const lotes = ids.length > 1 ? ids.map((x) => todos!.find((i) => i.id === x)).filter((i): i is NonNullable<typeof i> => !!i) : [{ ...primeiro.item, cadeia: undefined }]
  const juntar = lotes.length > 1
  // RECEBIMENTO na triagem: pacote bruto da compra, ainda inteiro → "Pesei e deu diferente" lança a diferença antes
  const compraDoLote = !juntar && primeiro.item.origem?.tipo === 'compra' && primeiro.item.saldo === primeiro.item.quantidadeInicial ? primeiro.item.origem.id : undefined
  const total = pesado ?? lotes.reduce((s, l) => s + l.saldo, 0)
  const usar = usada ?? total
  const somaPartes = partes.reduce((s, p) => s + (p.quantidade ?? 0), 0)
  const gDepois = depois.quantidade ?? 0
  const soma = somaPartes + gDepois
  const perda = Math.max(0, usar - soma)
  const digitar = digitarCodigos ?? regrasCodigos?.regras.lote.modo === 'manual'
  const codigosDigitados = [...partes.map((p) => p.codigo), gDepois ? depois.codigo : undefined].map((c) => (c ?? '').trim().toUpperCase()).filter(Boolean)
  const codigosValidos = !digitar || ([...partes, ...(gDepois ? [depois] : [])].every((p) => codigosOk[p.id] !== false) && new Set(codigosDigitados).size === codigosDigitados.length)
  // exemplo apagado (não parece peso digitado)
  const exemploPeso = { g: t('Ex.: 500'), kg: t('Ex.: 0,5') }
  const att = (i: number, d: Partial<(typeof partes)[number]>) => setPartes(partes.map((p, k) => (k === i ? { ...p, ...d, campos: { ...p.campos, ...(d.campos ?? {}) } } : p)))
  const triar = async (comPartes: boolean) => {
    // pesou diferente do comprado: a diferença entra primeiro (fica como "Diferença de peso" da compra, não como perda)
    if (compraDoLote && pesado !== undefined && pesado !== primeiro.item.saldo) {
      const ok = await executar('conferirPesoCompra', { compraId: compraDoLote, itemId: primeiro.item.id, pesado, motivo: t('Pesado na triagem') })
      if (!ok) return
    }
    const r = await executar('triarLotes', {
      id,
      ids: lotes.map((l) => l.id),
      motivo,
      quantidadeUsada: comPartes ? usar : undefined,
      saidas: comPartes ? partes.filter((p) => p.quantidade).map((p) => ({ id: p.id, quantidade: p.quantidade!, campos: p.campos, valorReferencia: porValor ? refDe(p) : undefined, codigo: digitar ? p.codigo?.trim() || undefined : undefined })) : undefined,
      paraDepois: comPartes && gDepois ? { id: depois.id, quantidade: gDepois, codigo: digitar ? depois.codigo?.trim() || undefined : undefined } : undefined,
    }, comPartes ? t('Triagem feita.') : t('Lotes juntados.'))
    if (r) onSeparou(r.lotes)
  }
  // PASSO A PASSO (wizard vertical): os 4 passos sempre à vista; o aberto mostra "para que serve" + os campos, os outros
  // ficam fechados com um resumo de uma linha. Abre/fecha tocando no título; "Próximo" fecha este e abre o seguinte.
  const partesOk = partes.filter((p) => p.quantidade)
  const resumoParte = (p: (typeof partes)[number]) => [p.campos.comprimento ? `${p.campos.comprimento} cm` : '', p.campos.categoria && p.campos.categoria !== 'Normal' ? t(String(p.campos.categoria)) : '', p.campos.cor ? t(String(p.campos.cor)) : ''].filter(Boolean).join(' · ')
  const abrirPasso = (n: number) => setPassosAbertos((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x })
  const proximo = (de: number) => setPassosAbertos(new Set([de + 1]))
  const pctPerda = usar ? Math.round((perda * 10000) / usar) : 0
  return (
    <Pagina
      titulo={<span className="inline-flex flex-wrap items-center">{juntar ? `${t('Juntar e separar')} ${lotes.map((l) => l.codigo ?? '').join(' + ')}` : `${t('Separar')} ${lotes[0].codigo ?? ''}`}<Info texto={juntar ? DICA_JUNTAR : DICA_SEPARAR} /></span>}
      subtitulo={juntar ? undefined : lotes[0].nome}
      onVoltar={onFechar}
      voltarRotulo={voltarRotulo}
      trilha={`${t(juntar ? 'Juntar e separar' : 'Separar')} ${lotes.map((l) => l.codigo ?? '').join(' + ')}`}
      rodape={
        // barra curta: a conta numa linha (rótulos longos só na tela larga) e o botão à direita
        <div className="flex items-center gap-2">
          <span className={cx('num min-w-0 flex-1 text-xs font-semibold leading-snug sm:text-sm', soma > usar ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>
            <span className="hidden sm:inline">{t('Peso bruto')} </span><b className="text-[var(--texto)]">{gramasTexto(usar)}</b> → <span className="hidden sm:inline">{t('partes')} </span><b className="text-[var(--texto)]">{gramasTexto(somaPartes)}</b>
            {gDepois > 0 && <> + <b className="text-[var(--texto)]">{gramasTexto(gDepois)}</b><span className="hidden sm:inline"> {t('para depois')}</span></>}
            {' · '}{t('perda')} <b className={perda > 0 ? 'text-[var(--ruim)]' : undefined}>{gramasTexto(perda)}{usar ? ` (${fmt(pctPerda, 'percentual')})` : ''}</b>
            <Info texto={DICA_PERDA} />
          </span>
          {juntar && <Botao variante="secundario" className="shrink-0 px-3" disabled={ocupado} onClick={() => triar(false)}>🔗<span className="hidden sm:inline"> {t('Só juntar')}</span><span className="sr-only sm:hidden">{t('Só juntar')}</span></Botao>}
          <Botao className="shrink-0" disabled={ocupado || !soma || soma > usar || !codigosValidos} onClick={() => triar(true)}>{juntar ? t('Juntar e separar') : t('Separar')}</Botao>
        </div>
      }
    >
      <ol className="space-y-3" aria-label={t('Passos da separação')}>
        {/* 1 · O QUE VAI SEPARAR */}
        <PassoSeparar n={1} titulo="O que vai separar" feito aberto={passosAbertos.has(1)} onAlternar={() => abrirPasso(1)}
          resumo={`${juntar ? lotes.map((l) => l.codigo ?? '').join(' + ') : lotes[0].codigo ?? ''} · ${gramasTexto(usar)}${usar !== total ? ` ${t('de')} ${gramasTexto(total)}` : ''}`}
          ajuda={juntar ? 'Os pacotes que vão virar um só antes de separar. A origem de cada grama fica guardada.' : 'O pacote bruto que você vai dividir. Normalmente separa tudo; se for só uma parte agora, diga quanto.'}
          exemplo={juntar ? 'Ex.: 2 kg da compra da Maria + 4 kg da do Celso = 6 kg para separar.' : 'Ex.: chegou 10 kg, hoje vai separar só 4 kg → o resto continua bruto.'}>
          {juntar ? (
            <ul className="divide-y divide-[var(--borda)] rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-sm">
              {lotes.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                  <span className="min-w-0"><span className="font-mono text-xs">{l.codigo}</span> · <b>{l.nome}</b>{l.cadeia && <CadeiaChips className="mt-1" cadeia={l.cadeia} />}</span>
                  <span className="num whitespace-nowrap font-semibold">{gramasTexto(l.saldo)}</span>
                </li>
              ))}
              <li className="flex justify-between p-2 font-bold"><span>{t('Total')}</span><span className="num">{gramasTexto(total)}</span></li>
            </ul>
          ) : (
            <div className="space-y-2">
              <p className="num rounded-xl bg-[var(--cartao)] px-3 py-2 text-sm"><b className="font-mono">{lotes[0].codigo}</b> · {lotes[0].nome} · <b>{gramasTexto(lotes[0].saldo)}</b></p>
              {compraDoLote && (
                <>
                  <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" className="h-5 w-5" checked={pesado !== undefined} onChange={(e) => (setPesado(e.target.checked ? lotes[0].saldo : undefined), setUsada(undefined))} />
                    {t('Pesei na balança e deu diferente')}
                    <Info texto="Recebimento: o fornecedor disse um peso e a balança deu outro. A diferença fica na compra (dá para cobrar do fornecedor), separada da perda da triagem. Ex.: comprou 10 kg, pesou 9,6 kg → −400 g de diferença; a perda da separação conta a partir dos 9,6 kg." />
                  </label>
                  {pesado !== undefined && (
                    <Campo rotulo="Quanto deu na balança?">
                      <GramasInput valor={pesado} onChange={(v) => setPesado(v ?? 0)} />
                      {pesado !== lotes[0].saldo && <span className={cx('num mt-1 block text-xs font-semibold', pesado < lotes[0].saldo ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{pesado > lotes[0].saldo ? '+' : '−'}{gramasTexto(Math.abs(pesado - lotes[0].saldo))} {t('de diferença (fica na compra)')}</span>}
                    </Campo>
                  )}
                </>
              )}
              <label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={usada !== undefined && usada !== total} onChange={(e) => setUsada(e.target.checked ? Math.round(total / 2) : undefined)} /> {t('Vou separar só uma parte agora')}</label>
              {usada !== undefined && usada !== total && <Campo rotulo="Quanto vai separar agora?"><GramasInput valor={usar} onChange={setUsada} /></Campo>}
            </div>
          )}
          <div className="flex justify-end"><Botao variante="secundario" onClick={() => proximo(1)}>{t('Próximo')} →</Botao></div>
        </PassoSeparar>

        {/* 2 · AS PARTES */}
        <PassoSeparar n={2} titulo="As partes" feito={partesOk.length > 0} aberto={passosAbertos.has(2)} onAlternar={() => abrirPasso(2)}
          resumo={partesOk.length ? `${t('{n} parte(s)', { n: partesOk.length })} · ${gramasTexto(somaPartes)}` : t('nenhuma ainda')}
          ajuda="Cada parte vira um pacote novo, com etiqueta. Digite o peso e o que é: a medida e a categoria definem o preço pela tabela."
          exemplo="Ex.: 3 kg de 60 cm Preto + 1,9 kg de 40 cm Castanho = 2 pacotes novos.">
          {digitar && new Set(codigosDigitados).size !== codigosDigitados.length && <p className="text-sm text-[var(--ruim)]">{t('Há dois lotes com o mesmo código.')}</p>}
          <ul className="space-y-2">
            {partes.map((p, i) => {
              const aberta = parteAberta === p.id
              return (
                <li key={p.id} className={cx('overflow-hidden rounded-xl border bg-[var(--cartao)]', aberta ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
                  <button type="button" aria-expanded={aberta} onClick={() => setParteAberta(aberta ? undefined : p.id)} className="flex min-h-12 w-full items-center gap-2 px-3 text-left">
                    <span aria-hidden className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', p.quantidade ? 'bg-[var(--bom)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{p.quantidade ? '✓' : i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm"><b>{t('Parte {n}', { n: i + 1 })}</b>{resumoParte(p) && <span className="text-[var(--suave)]"> · {resumoParte(p)}</span>}</span>
                    <b className="num shrink-0 text-sm">{p.quantidade ? gramasTexto(p.quantidade) : '—'}</b>
                    <span aria-hidden className={cx('shrink-0 text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
                  </button>
                  {aberta && (
                    <div className="space-y-2 border-t border-[var(--borda)] p-3">
                      <Campo rotulo="Peso"><GramasInput valor={p.quantidade} placeholder={exemploPeso} onChange={(q) => att(i, { quantidade: q })} /></Campo>
                      {/* à vista só o que muda o preço e o nome (medida, categoria, cor); o resto em "+ mais" */}
                      <CamposDinamicos campos={campos} valores={p.campos} onChange={(v) => att(i, { campos: v })} pular={['estado']} principais={['comprimento', 'categoria', 'cor']} />
                      {avancado && porValor && <Campo rotulo="Valor de referência" ajuda="Vem da tabela (medida × coluna escolhida). Pode mudar."><Entrada inputMode="decimal" value={p.ref ?? ''} placeholder={refDe(p) ?? '?'} onChange={(e) => att(i, { ref: e.target.value })} /></Campo>}
                      {digitar && <CampoCodigo tipo="lote" rotulo="Código deste lote" valor={p.codigo ?? ''} onChange={(v) => att(i, { codigo: v })} contexto={{ paiId: juntar ? undefined : lotes[0].id, posicao: i }} onEstado={(ok) => marcarCodigo(p.id, ok)} />}
                      {partes.length > 1 && <button type="button" onClick={() => (setPartes(partes.filter((_, k) => k !== i)), setParteAberta(undefined))} className="min-h-10 rounded-lg px-1 text-sm font-semibold text-[var(--ruim)] hover:underline">✕ {t('Tirar esta parte')}</button>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap justify-between gap-2">
            <Botao variante="secundario" onClick={() => { const nova = { id: novoId(), campos: { ...partes[partes.length - 1]?.campos, comprimento: undefined } }; setPartes([...partes, nova]); setParteAberta(nova.id) }}>+ {t('Outra parte')}</Botao>
            <Botao variante="secundario" onClick={() => proximo(2)}>{t('Próximo')} →</Botao>
          </div>
        </PassoSeparar>

        {/* 3 · PARA DEPOIS (opcional) */}
        <PassoSeparar n={3} titulo="Para depois" opcional feito={gDepois > 0} aberto={passosAbertos.has(3)} onAlternar={() => abrirPasso(3)}
          resumo={gDepois ? gramasTexto(gDepois) : t('nada')}
          ajuda="O que você ainda não sabe o que é fica guardado como “Não identificado” (aparece em Para depois na Triagem). Não é perda."
          exemplo="Ex.: 10 kg → 4 kg separados + 6 kg para depois → os 6 kg voltam para separar outro dia.">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:max-w-sm">
            <Campo rotulo="Peso"><GramasInput valor={depois.quantidade} placeholder={exemploPeso} onChange={(q) => setDepois({ ...depois, quantidade: q })} /></Campo>
            <Botao variante="leve" disabled={usar - somaPartes <= 0} onClick={() => setDepois({ ...depois, quantidade: usar - somaPartes })}>{t('Tudo o que sobrou')}</Botao>
          </div>
          {digitar && gDepois > 0 && <CampoCodigo tipo="lote" rotulo="Código deste lote" valor={depois.codigo ?? ''} onChange={(v) => setDepois({ ...depois, codigo: v })} contexto={{ paiId: juntar ? undefined : lotes[0].id, posicao: partes.length }} onEstado={(ok) => marcarCodigo(depois.id, ok)} />}
          <div className="flex justify-end"><Botao variante="secundario" onClick={() => proximo(3)}>{t('Próximo')} →</Botao></div>
        </PassoSeparar>

        {/* 4 · CONFERIR */}
        <PassoSeparar n={4} titulo="Conferir" feito={soma > 0 && soma <= usar} aberto={passosAbertos.has(4)} onAlternar={() => abrirPasso(4)}
          resumo={`${t('perda')} ${gramasTexto(perda)} (${fmt(pctPerda, 'percentual')})`}
          ajuda="A conta tem que fechar: o que entrou = as partes + para depois + perda. Perda é o que não virou pacote (pontas, sujeira, cabelo ruim)."
          exemplo="Ex.: 10 kg = 9,4 kg em partes + 0 para depois + 600 g de perda (6%).">
          <div className="num overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-sm">
            <div className="flex justify-between px-3 py-2 font-bold"><span>{t('Entrou')}</span><span>{gramasTexto(usar)}</span></div>
            {partesOk.map((p, i) => <div key={p.id} className="flex justify-between border-t border-[var(--borda)] px-3 py-1.5"><span className="min-w-0 truncate text-[var(--suave)]">{t('Parte {n}', { n: i + 1 })}{resumoParte(p) ? ` · ${resumoParte(p)}` : ''}</span><span>{gramasTexto(p.quantidade!)}</span></div>)}
            {gDepois > 0 && <div className="flex justify-between border-t border-[var(--borda)] px-3 py-1.5"><span className="text-[var(--suave)]">❓ {t('Para depois')}</span><span>{gramasTexto(gDepois)}</span></div>}
            <div className={cx('flex justify-between border-t-2 border-[var(--borda)] px-3 py-2 font-bold', soma > usar ? 'text-[var(--ruim)]' : perda > 0 ? 'text-[var(--alerta)]' : 'text-[var(--bom)]')}><span>{soma > usar ? t('Passou do que entrou!') : t('Perda')}</span><span>{soma > usar ? `+${gramasTexto(soma - usar)}` : `${gramasTexto(perda)} (${fmt(pctPerda, 'percentual')})`}</span></div>
          </div>
          <Campo rotulo="Observação (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: mesma qualidade, lavar junto')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          <button type="button" aria-expanded={avancado} onClick={() => setAvancado(!avancado)} className="min-h-10 text-sm font-semibold text-[var(--marca)]">{t('Avançado')} {avancado ? '▾' : '▸'} <span className="font-normal text-[var(--suave)]">({t('custo e códigos')})</span></button>
          {avancado && (
            <div className="space-y-3 rounded-xl bg-[var(--cartao)] p-3 text-sm">
              <div>
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={porValor} onChange={(e) => setPorValor(e.target.checked)} /> {t('Dividir o custo pelo valor de referência (recomendado)')}<Info texto={DICA_REFERENCIA} /></label>
                <p className="mt-1 text-xs text-[var(--suave)]">{t('Sem isso, o custo é dividido pelo peso de cada parte.')}</p>
                {porValor && tabela && <div className="mt-2"><Selecao valor={col} onChange={setColuna} opcoes={tabela.colunas.map((c) => ({ id: c.id, nome: `${t('Preço de referência')}: ${c.nome}` }))} /></div>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--suave)]">{t('Código dos lotes que saem')}: <b className="text-[var(--texto)]">{t(digitar ? 'digitado' : 'automático')}</b></span>
                <Botao variante="leve" onClick={() => setDigitarCodigos(!digitar)}>{digitar ? t('Usar os automáticos') : `✎ ${t('Digitar os códigos')}`}</Botao>
              </div>
            </div>
          )}
        </PassoSeparar>
      </ol>
    </Pagina>
  )
}

/**
 * Um passo do passo a passo da separação: número (✓ quando feito), título e resumo de uma linha; aberto, mostra a caixa
 * "para que serve" (explicação + exemplo, didática, sem precisar do ⓘ) e os campos.
 */
function PassoSeparar(p: { n: number; titulo: string; resumo: string; ajuda: string; exemplo?: string; aberto: boolean; feito?: boolean; opcional?: boolean; onAlternar(): void; children: ReactNode }) {
  return <Passo {...p} de={4} />
}

function Ajustar({ itemId, onFechar }: { itemId: Id; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('fichaItem', { id: itemId })
  const { executar, ocupado } = useComando()
  const [novo, setNovo] = useState<number>()
  const [motivo, setMotivo] = useState<'ajuste' | 'perda'>('ajuste')
  const [desc, setDesc] = useState('')
  if (!dados) return null
  return (
    <Janela aberta titulo={`${t('Ajustar')} · ${dados.item.nome}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || novo === undefined} onClick={async () => (await executar('ajustarEstoque', { itemId, novoSaldo: novo!, motivo, descricao: desc }, t('Estoque ajustado.'))) && onFechar()}>{t('Salvar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('Agora')}: <b>{fmt(dados.item.saldo, dados.item.unidade === 'grama' ? 'gramas' : 'numero')}</b></p>
        <Escolha rotulo="Motivo" valor={motivo} onChange={(v) => setMotivo(v as typeof motivo)} opcoes={[{ id: 'ajuste', nome: 'Contei e é outro número' }, { id: 'perda', nome: 'Perda / quebra' }]} />
        <Campo rotulo="Quantidade certa">{dados.item.unidade === 'grama' ? <GramasInput valor={novo} onChange={setNovo} /> : <Entrada inputMode="numeric" onChange={(e) => setNovo(Number(e.target.value))} />}</Campo>
        <Campo rotulo="Motivo"><Entrada value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}


/** Todas as situações do pacote, na ordem da vida dele (vai no ⓘ ao lado da situação). */
const AJUDA_SITUACAO = 'Bruto: chegou da compra, ainda não foi separado. Preparando: bruto numa etapa da triagem (ex.: lavagem). Não identificado: ficou para depois na separação. Disponível: separado e inteiro, pronto para vender. Parcial: já vendeu uma parte e ainda tem peso. Esgotado: não tem mais peso (vendido ou separado em outros pacotes). Ex.: entrou 18 kg, vendeu 9,7 kg = Parcial (8,3 kg).'

/** PRONTUÁRIO do lote: entrada (compra) → triagem (separação) → destino (vendas), atributos, arquivos e linha do tempo. */
export function FichaLote() {
  const t = useT()
  const { nav, ir, voltar, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('fichaItem', { id })
  const { dados: gen } = useConsulta('genealogia', { itemId: id }, admin)
  const campos = useCamposModulo(dados?.item.moduloId ?? '', dados?.item.tipoItem)
  const [ajustar, setAjustar] = useState(false)
  const [editar, setEditar] = useState(false)
  const [trocar, setTrocar] = useState(false)
  const [reservar, setReservar] = useState(false)
  const [refazer, setRefazer] = useState(false)
  const [aba, setAba] = useParamTela<'resumo' | 'detalhes' | 'historico' | 'fotos'>('aba', 'resumo')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const i = dados.item
  const fu = i.unidade === 'grama' ? 'gramas' : 'numero'
  const q = (n: number) => fmt(n, fu)
  const m = moedaPadrao()
  const f = dados.fluxo
  const atributos = resumoCampos(campos, i.campos)
  const bruto = ehBruto(dados.status)
  const separar = () => ir('separar', { id: i.id })
  // Vender do pacote = modo caixa com o pacote já dentro (total na hora, fecha com um toque na forma de pagamento);
  // o formulário longo de Vender continua no menu
  const vender = () => ir('vendaRapida', { lote: i.id })
  const verRastreio = () => ir('rastreio', { itemId: i.id })
  // PRÓXIMO PASSO (um só, destacado): bruto → Separar; vendável → Vender; acabou → ver para onde foi
  // separações que saíram deste pacote (ele é a entrada) → os pacotes novos
  const viraram = i.saldo > 0 ? [] : (gen?.triagens ?? []).filter((x) => x.separou && x.entradas.some((e) => e.id === i.id) && x.saidas.length > 0)
  // só foi separado (nada vendido direto dele): vendido/lucro aqui seriam sempre 0 e confundem
  const soSeparado = f.separado > 0 && !dados.vendido
  const proximo = !admin ? undefined : i.saldo > 0 && bruto ? { rotulo: '✂️ Separar', f: separar } : i.saldo > 0 ? { rotulo: '💰 Vender', f: vender } : viraram.length ? undefined : { rotulo: '📊 Ver para onde foi', f: verRastreio }
  return (
    <div className="space-y-4">
      <Trilha atual={i.codigo ?? i.nome} />
      <AvisoPacotesNovos />
      {/* cabeçalho compacto: foto pequena + nome; código e situação numa linha; UMA linha de ações (principal + Etiqueta + ⋯) */}
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <MiniaturaLote itemId={i.id} foto={dados.fotoPrincipal} marcador={marcadorLote(i.campos, i.nome)} tamanho="ficha" iconeSemFoto />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-2xl">{i.nome}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--suave)]">
              <CodigoSelo codigo={i.codigo} anteriores={i.codigosAnteriores} />
              <span className="inline-flex items-center"><StatusBadge status={dados.status} /><Info texto={AJUDA_SITUACAO} /></span>
              <span className="whitespace-nowrap text-xs">{t('desde')} {dataBR(i.criadoEm)}</span>
              {reservado(i) && <button type="button" onClick={() => setReservar(true)}><SeloReserva i={i} /></button>}
              {!!i.codigosAnteriores?.length && <span className="text-xs">{t('antes')}: <span className="font-mono">{i.codigosAnteriores.join(', ')}</span></span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* um botão principal (Vender ou Separar, conforme a situação); o resto fica no ⋯ */}
          {proximo && <Botao className="min-w-0 flex-1 sm:flex-none" onClick={proximo.f}>{t(proximo.rotulo)}</Botao>}
          {admin && <Botao variante="secundario" className="shrink-0" onClick={() => ir('etiquetas', { f: 'todas', sel: i.id })}>🏷 {t('Etiqueta')}</Botao>}
          <MenuAcoes comRotulo className="shrink-0" acoes={acoesLote(
            { id: i.id, saldo: i.saldo, compras: dados.dna.compras.map((c) => ({ id: c.id, codigo: c.codigo, fornecedor: c.fornecedor?.nome, fornecedorId: c.fornecedor?.id })), origens: dados.pai ? [dados.pai] : dados.dna.unificacao?.fontes, vendavel: !bruto, etiquetaImpressa: !!i.etiquetaImpressaEm, reservado: reservado(i) },
            { ir, t, admin, semAbrir: true, onAjustar: () => setAjustar(true), onTrocarCodigo: () => setTrocar(true), onRefazerEtiqueta: () => setRefazer(true), onReservar: () => setReservar(true), extras: [
              ...(admin ? [{ rotulo: 'Editar atributos', icone: '✎', onClick: () => setEditar(true), separar: true }] : []),
              ...(bruto && i.saldo > 0 ? [{ rotulo: 'Abrir na triagem', icone: '🧺', onClick: () => ir('triagem') }] : []),
            ] },
          )} />
        </div>
      </header>
      {/* JÁ SEPARADO (bruto que zerou): a primeira coisa é em que pacotes ele virou, com o atalho para cada um */}
      {viraram.length > 0 && (
        <section aria-label={t('Virou')} className="rounded-2xl border-2 border-[var(--marca)] bg-[var(--marca-suave)] p-3">
          <p className="text-sm font-bold">✂️ {t('Este pacote já foi separado')}{viraram.length === 1 ? ` · ${viraram[0].codigo}` : ''}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {viraram.flatMap((x) => x.saidas).map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => ir('lote', { id: s.id })} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-[var(--cartao)] px-3 text-left shadow-sm hover:ring-2 hover:ring-[var(--marca)]">
                  <b className="font-mono">📦 {s.codigo ?? '—'}</b><span className="num font-semibold">{q(s.g)} ›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ABAS: Resumo (a vida do pacote + números) · Detalhes · Histórico · Fotos e arquivos — como no pedido */}
      <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a as typeof aba)} abas={[
        { id: 'resumo', nome: 'Resumo' },
        { id: 'detalhes', nome: 'Detalhes' },
        { id: 'historico', nome: 'Histórico' },
        { id: 'fotos', nome: 'Arquivos', extra: dados.fotos.length ? <span className="num text-xs opacity-70">{dados.fotos.length}</span> : undefined },
      ]} />
      {aba === 'historico' ? (
        <Cartao titulo={t('Histórico do pacote')} ajuda="Tudo o que entrou e saiu deste pacote, dia a dia. Ex.: 6.000 → 4.500 g na venda V-9.">
          <HistoricoPacote id={i.id} />
        </Cartao>
      ) : aba === 'fotos' ? (
        <div className="space-y-4">
          <Cartao titulo={`${t('Fotos do lote')}${dados.fotos.length ? ` · ${dados.fotos.length}` : ''}`}><FotosDoLote itemId={i.id} codigo={i.codigo} /></Cartao>
          <Cartao titulo={t('Arquivos')}><AnexosCurtos donoId={i.id} categorias={['outro']} esconderFotos /></Cartao>
        </div>
      ) : aba === 'resumo' ? (
      <div className="space-y-4">
        {/* A VIDA DO PACOTE: compra → triagem → etiqueta → venda, cada passo leva direto ao registro */}
        <VidaDoPacote i={i} gen={gen} compras={dados.dna.compras} onEtiqueta={() => ir('etiquetas', { f: 'todas', sel: i.id })} />
        {/* números: peso e dinheiro; bruto já separado não mostra "vendido 0 / lucro 0" (o custo foi para os pacotes) */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Cartao><div className="text-xs text-[var(--suave)]">{t('Agora')}</div><div className="num whitespace-nowrap text-lg font-bold sm:text-xl">{q(i.saldo)}</div>{f.inicial !== i.saldo && <div className="num text-xs text-[var(--suave)]">{t('entrou')} {q(f.inicial)}</div>}</Cartao>
          <Cartao><div className="text-xs text-[var(--suave)]">{t('Custo do lote')}</div><div className="num whitespace-nowrap text-lg font-bold sm:text-xl">{formatar(i.custoPrincipal ?? 0, m)}</div>{soSeparado && <div className="text-xs text-[var(--suave)]">{t('dividido entre os pacotes')}</div>}</Cartao>
          {!soSeparado && <BotaoNumero rotulo={t('Vendido')} onClick={verRastreio}>{formatar(dados.vendido, m)}</BotaoNumero>}
          {!soSeparado && <BotaoNumero rotulo={t('Lucro (vendido − custo)')} onClick={verRastreio} className={dados.lucro < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{formatar(dados.lucro, m)}</BotaoNumero>}
        </div>
      </div>
      ) : <>
      {/* DETALHES: números completos, caminho, cada grama e atributos */}
      <section aria-label={t('Números')} className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Números')}</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Cartao><div className="text-xs text-[var(--suave)]">{t('Agora')}</div><div className="num whitespace-nowrap text-lg font-bold sm:text-xl">{q(i.saldo)}</div>{f.inicial !== i.saldo && <div className="num text-xs text-[var(--suave)]">{t('entrou')} {q(f.inicial)}</div>}</Cartao>
          <Cartao><div className="text-xs text-[var(--suave)]">{t('Custo do lote')}</div><div className="num whitespace-nowrap text-lg font-bold sm:text-xl">{formatar(i.custoPrincipal ?? 0, m)}</div>{soSeparado && <div className="text-xs text-[var(--suave)]">{t('dividido entre os pacotes')}</div>}</Cartao>
          {!soSeparado && <BotaoNumero rotulo={t('Vendido')} onClick={verRastreio}>{formatar(dados.vendido, m)}</BotaoNumero>}
          {!soSeparado && <BotaoNumero rotulo={t('Lucro (vendido − custo)')} onClick={verRastreio} className={dados.lucro < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{formatar(dados.lucro, m)}</BotaoNumero>}
        </div>
      </section>

      {/* LINHA DA VIDA: cada grama (barra) + a timeline compra → triagem → etiqueta → vendas/separações, cada passo clicável */}
      <Cartao titulo={`${t('Linha da vida do pacote')} · ${t('entrou')} ${q(f.inicial)}`} ajuda="De onde veio e para onde foi cada grama, na ordem. Ex.: 18 kg entrou · V-0006 −1,5 kg · separado em L-0025 3 kg (60 cm). Toque num passo para abrir.">
        {i.unidade === 'grama' && (
          <div className="mb-3">
            <BarraFluxo total={f.inicial} partes={[
              { nome: 'Vendido', valor: f.vendido, cor: 'var(--bom)' },
              { nome: 'Separado em lotes', valor: f.separado, cor: 'var(--marca)' },
              ...(f.unificado ? [{ nome: 'Unificado em outro lote', valor: f.unificado, cor: '#8b5cf6' }] : []),
              { nome: 'Perda', valor: f.perda, cor: 'var(--ruim)' },
              { nome: 'Em estoque', valor: f.saldo, cor: 'var(--alerta)' },
            ].filter((x) => x.valor > 0)} />
          </div>
        )}
        {gen ? <LinhaDaVida gen={gen} item={i} /> : <Carregando />}
        <button type="button" onClick={() => ir('rastreio', { itemId: i.id })} className="mt-2 min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">🔎 {t('Rastreio completo (todas as compras e pacotes ligados)')}</button>
      </Cartao>

      <Cartao titulo={t('Atributos')} acao={admin && campos.length > 0 ? <Botao variante="secundario" onClick={() => setEditar(true)}>✎ {t('Editar atributos')}</Botao> : undefined}>
        {!atributos.length ? <p className="text-sm text-[var(--suave)]">{t('Nenhum atributo preenchido.')}</p> : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            {atributos.map((a) => <div key={a.id} className="contents"><dt className="text-[var(--suave)]">{t(a.nome)}</dt><dd className="font-semibold [overflow-wrap:anywhere]">{t(a.valor)}</dd></div>)}
          </dl>
        )}
      </Cartao>
      </>}
      {/* janelas do ⋯ (valem em qualquer aba) */}
      {ajustar && <Ajustar itemId={i.id} onFechar={() => setAjustar(false)} />}
      {editar && <EditarAtributos id={i.id} campos={campos} valores={i.campos} onFechar={() => setEditar(false)} />}
      {trocar && <TrocarCodigo tipo="lote" id={i.id} atual={i.codigo} onFechar={() => setTrocar(false)} />}
      {reservar && <ReservarLote id={i.id} codigo={i.codigo} atual={i.reserva} onFechar={() => setReservar(false)} />}
      {refazer && <RefazerEtiqueta id={i.id} codigo={i.codigo} onFechar={() => setRefazer(false)} />}
    </div>
  )
}

/**
 * A VIDA DO PACOTE em 4 passos (a vida do negócio): 🛒 Compra → ✂️ Triagem → 🏷 Etiqueta → 💰 Venda. Cada passo é um
 * botão que leva direto ao registro (a compra, a triagem, a etiqueta usada, a venda); passo que ainda não aconteceu
 * fica apagado ("ainda não"). Celular: 2 × 2; computador: 4 numa linha.
 */
function VidaDoPacote({ i, gen, compras, onEtiqueta }: { i: ResultadoConsulta<'fichaItem'>['item']; gen?: ResultadoConsulta<'genealogia'>; compras: ResultadoConsulta<'fichaItem'>['dna']['compras']; onEtiqueta(): void }) {
  const t = useT()
  const { ir } = useApp()
  const triagem = gen?.triagens.find((x) => x.saidas.some((s) => s.id === i.id)) ?? gen?.triagens.find((x) => x.entradas.some((e) => e.id === i.id))
  const meu = gen?.lotes.find((l) => l.id === i.id)
  const vendas = (meu?.para ?? []).filter((p) => p.tipo === 'venda').map((p) => ({ ...p, cliente: gen?.vendas.find((v) => v.id === p.id)?.cliente }))
  const c = compras[0]
  const passo = (p: { icone: string; nome: string; feito: boolean; titulo?: string; sub?: string; onClick?(): void }) => (
    <button type="button" disabled={!p.onClick} onClick={p.onClick}
      className={cx('flex min-h-20 min-w-0 flex-col justify-between rounded-2xl border p-3 text-left transition', p.feito ? 'border-[var(--borda)] bg-[var(--cartao)] shadow-sm hover:border-[var(--marca)]' : 'border-dashed border-[var(--borda)] text-[var(--suave)]')}>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]"><span aria-hidden className="text-base">{p.icone}</span>{t(p.nome)}</span>
      <span className="min-w-0">
        <b className={cx('block truncate font-mono text-base', p.feito ? 'text-[var(--marca)]' : 'font-sans font-normal')}>{p.titulo ?? t('ainda não')}</b>
        {p.sub && <span className="block truncate text-xs text-[var(--suave)]">{p.sub}</span>}
      </span>
    </button>
  )
  return (
    <section aria-label={t('A vida do pacote')} className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {passo({ icone: '🛒', nome: 'Compra', feito: !!c, titulo: c?.codigo ?? undefined, sub: [c?.fornecedor?.nome, compras.length > 1 ? `+${compras.length - 1}` : ''].filter(Boolean).join(' · ') || undefined, onClick: c ? () => ir('pedido', { id: c.id }) : undefined })}
      {passo({ icone: '✂️', nome: 'Triagem', feito: !!triagem, titulo: triagem?.codigo, sub: triagem ? `${dataBR(triagem.em)}${triagem.por ? ` · ${triagem.por}` : ''}` : undefined, onClick: triagem ? () => ir('triagem', { aba: 'triagens', t: triagem.id }) : undefined })}
      {passo({ icone: '🏷', nome: 'Etiqueta', feito: !!i.etiquetaImpressaEm, titulo: i.etiquetaImpressaEm ? `${i.codigo ?? ''}${(i.etiquetaVia ?? 1) > 1 ? ` · ${t('{n}ª via', { n: i.etiquetaVia! })}` : ''}` : t('Sem etiqueta'), sub: i.etiquetaImpressaEm ? `${dataBR(i.etiquetaImpressaEm)}${i.etiquetaImpressaPor ? ` · ${i.etiquetaImpressaPor}` : ''}` : t('Toque para imprimir'), onClick: onEtiqueta })}
      {passo({ icone: '💰', nome: 'Venda', feito: vendas.length > 0, titulo: vendas[0]?.codigo, sub: vendas.length ? [vendas[0].cliente, vendas.length > 1 ? `+${vendas.length - 1}` : ''].filter(Boolean).join(' · ') || undefined : undefined, onClick: vendas.length ? () => ir('venda', { id: vendas[0].id }) : undefined })}
    </section>
  )
}

/** Editar atributos do lote (admin): só o que mudou vai para o comando; o log guarda antes → depois. */
export function EditarAtributos({ id, campos, valores, onFechar }: { id: Id; campos: CampoDef[]; valores: Campos; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [v, setV] = useState<Campos>(valores)
  const [motivo, setMotivo] = useState('')
  const mudou = Object.fromEntries(campos.filter((c) => String(v[c.id] ?? '') !== String(valores[c.id] ?? '')).map((c) => [c.id, v[c.id] ?? null]))
  const n = Object.keys(mudou).length
  useAvisoSaida(n > 0)
  return (
    <Janela aberta larga titulo={t('Editar atributos')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !n} onClick={async () => (await executar('editarAtributosLote', { id, campos: mudou, motivo }, t('Atributos salvos.'))) && onFechar()}>{t('Salvar')}</Botao>
    }>
      <div className="space-y-3">
        <CamposDinamicos campos={campos} valores={v} onChange={setV} />
        <Campo rotulo="Motivo (fica no histórico)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('Se mudar um atributo que faz parte do nome, o nome do lote muda junto.')}</p>
      </div>
    </Janela>
  )
}

/** RASTREIO TOTAL (tela cheia): o grafo compra → triagem → lote → venda em gramas, a partir da compra ou do lote. */
export function Rastreio() {
  const t = useT()
  const { nav, voltar, ir } = useApp()
  const { dados, erro } = useConsulta('genealogia', { compraId: nav.params.compraId as Id | undefined, itemId: nav.params.itemId as Id | undefined })
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  // trilha: origem › o registro em foco (pacote ou compra, tocar abre) › Rastreio total
  const foco = dados.caminho.lote
    ? [{ rotulo: dados.caminho.lote.codigo ?? dados.caminho.lote.nome, onClick: () => ir('lote', { id: dados.caminho.lote!.id }) }]
    : nav.params.compraId && dados.caminho.compras[0] ? [{ rotulo: dados.caminho.compras[0].codigo ?? t('Compra'), onClick: () => ir('pedido', { id: String(nav.params.compraId) }) }] : []
  return (
    <div className="space-y-4">
      <Trilha niveis={foco} atual={t('Rastreio total')} />
      <Titulo subtitulo={t('Cada grama: como entrou e para onde foi.')}>{t('Rastreio: origem → destino')}</Titulo>
      <Caminho g={dados} />
      <Cartao><RastreioTotal g={dados} /></Cartao>
      {dados.compras.map((c) => <Cartao key={c.id} titulo={`${t('Linha do tempo da compra')} ${c.codigo ?? ''}`}><LinhaDoTempo id={c.id} /></Cartao>)}
    </div>
  )
}

/** Número que leva à origem (toque abre de onde ele vem). */
function BotaoNumero({ rotulo, children, onClick, className }: { rotulo: ReactNode; children: ReactNode; onClick(): void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left shadow-sm hover:border-[var(--marca)] sm:p-4">
      <span className="block text-xs text-[var(--suave)]">{rotulo}</span>
      <span className={cx('num block whitespace-nowrap text-lg font-bold sm:text-xl', className)}>{children}</span>
    </button>
  )
}
