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
import { CadeiaChips, Caminho, RastreioResumo, RastreioTotal } from '../ui/rastreioTotal'
import { MenuAcoes, acoesLote } from '../ui/menuAcoes'
import { CampoCodigo, CodigoSelo, TrocarCodigo } from '../ui/codigos'
import { useT } from '../ui/i18n'
import { FotosDoLote, MiniaturaLote, marcadorLote, useTirarFoto } from '../ui/fotos'
import { ImprimirEtiquetas } from '../ui/etiquetas'
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

/** De onde veio o lote: compra(s) com o fornecedor, o lote-mãe ou os lotes juntados — completo, em chips que não cortam. */
function VeioDe({ i }: { i: Linha }) {
  const t = useT()
  const vazio = !i.compras.length && !i.pai && !i.unificadoDe?.length
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {i.compras.map((c) => (
        <span key={c.id} className={chip} title={[c.codigo, c.fornecedor].filter(Boolean).join(' · ')}>
          <span aria-hidden>🛒</span><b className="font-mono">{c.codigo ?? '?'}</b>{c.fornecedor && <span className="truncate">· {c.fornecedor}</span>}
        </span>
      ))}
      {i.pai && <span className={chip}><span aria-hidden>✂️</span>{t('separado de')} <b className="font-mono">{i.pai.codigo ?? i.pai.nome}</b></span>}
      {!!i.unificadoDe?.length && <span className={chip}><span aria-hidden>🔗</span>{t('juntado de')} <b className="font-mono">{i.unificadoDe.join(' + ')}</b></span>}
      {vazio && <span className="text-xs text-[var(--suave)]">{t('cadastro')}</span>}
    </div>
  )
}

/** Peso "agora / inicial" com a barrinha do quanto ainda sobra. */
function Peso({ i }: { i: Linha }) {
  const ini = i.quantidadeInicial ?? 0
  const pct = ini ? Math.max(0, Math.min(100, (i.saldo / ini) * 100)) : 0
  return (
    <div className="min-w-[7.5rem] text-right">
      <div className="num whitespace-nowrap"><b>{qtd(i, i.saldo)}</b>{ini ? <span className="text-xs text-[var(--suave)]"> / {qtd(i, ini)}</span> : null}</div>
      {ini > 0 && <div className="ml-auto mt-1 h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-[var(--fundo)]" role="img" aria-label={`${Math.round(pct)}%`}><div className="h-full rounded-full bg-[var(--marca)]" style={{ width: `${pct}%` }} /></div>}
    </div>
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
  const [janela, setJanela] = useState<'colunas' | 'favorito' | 'marcar' | 'camera'>()
  const [etiquetas, setEtiquetas] = useState<Id[]>()
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
    { id: 'peso', nome: 'Peso (agora / inicial)', num: true, texto: (i) => [qtd(i, i.saldo), qtd(i, i.quantidadeInicial)].filter(Boolean).join(' / '), celula: (i) => <Peso i={i} /> },
    { id: 'status', nome: 'Status', texto: (i) => t(STATUS_LOTE[i.status].nome), celula: (i) => <StatusBadge status={i.status} /> },
    ...campos.map((c): Coluna => ({ id: `c.${c.id}`, nome: c.nome, num: c.tipo === 'numero', texto: (i) => textoCampo(c, i.campos[c.id]) })),
    { id: 'vendido', nome: 'Vendido', num: true, texto: (i) => (i.vendido ? qtd(i, i.vendido) : '') },
    { id: 'caminho', nome: 'Caminho', texto: (i) => [i.cadeia.compras.map((c) => c.codigo).join(' + '), i.cadeia.triagens.map((x) => x.codigo).join(' + '), i.cadeia.vendas.map((v) => v.codigo).join(', ')].filter(Boolean).join(' → '), celula: (i) => <CadeiaChips cadeia={i.cadeia} /> },
    { id: 'entrada', nome: 'Entrada', texto: (i) => dataBR(i.entrada) },
    ...(admin ? [{ id: 'custo', nome: 'Custo', num: true, texto: (i: Linha) => { const c = custoAgora(i); return c === undefined ? '' : formatar(c, moedaPadrao()) } }] : []),
  ]
  const padrao = ['origem', 'peso', 'status']
  const escolhidas = colunasSalvas[modulo] ?? padrao
  const chipsDe = (i: Linha) =>
    CHIPS.map((id) => campos.find((c) => c.id === id)).filter((c): c is CampoDef => !!c).map((c) => ({ id: c.id, texto: textoCampo(c, i.campos[c.id]) })).filter((x) => x.texto)
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

  const numero = (rotulo: string, valor: ReactNode, extra: ReactNode, st: string, tom?: string, semMarca?: boolean) => (
    <button type="button" onClick={() => setP('status', status === st && st ? '' : st)} aria-pressed={semMarca ? undefined : status === st} className={cx('w-full min-w-0 rounded-2xl border bg-[var(--cartao)] p-3 text-left shadow-sm transition hover:border-[var(--marca)]', status === st && !semMarca ? 'border-[var(--marca)] ring-2 ring-[var(--marca-suave)]' : 'border-[var(--borda)]')}>
      <span className="block truncate text-xs font-semibold text-[var(--suave)]">{t(rotulo)}</span>
      <span className={cx('num block truncate text-xl font-bold', tom)}>{valor}</span>
      <span className="block truncate text-xs text-[var(--suave)]">{extra}</span>
    </button>
  )
  const acoes = (i: Linha) => (
    <div className="flex flex-nowrap justify-end gap-0.5" onClick={parar} onKeyDown={parar}>
      {admin && ehBruto(i.status) && i.saldo > 0 && <BotaoIcone rotulo={t('Separar')} onClick={() => ir('separar', { id: i.id })}>✂️</BotaoIcone>}
      <MenuAcoes acoes={acoesLote(
        { id: i.id, saldo: i.saldo, compras: i.compras, vendavel: !ehBruto(i.status), origens: i.pai ? [i.pai] : i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).map((id, k) => ({ id, codigo: i.unificadoDe?.[k] })) : [] },
        { ir, t, admin, onAjustar: () => setAjustar(i.id), onTrocarCodigo: () => setTrocar(i), extras: [
          { rotulo: 'Tirar foto', icone: '📷', onClick: () => tirar(i.id), separar: true },
          { rotulo: 'Escolher foto da galeria', icone: '🖼', onClick: () => tirar(i.id, { galeria: true }) },
          { rotulo: 'Imprimir etiqueta', icone: '🏷', onClick: () => setEtiquetas([i.id]) },
          ...(ehBruto(i.status) && i.saldo > 0 ? [{ rotulo: 'Abrir na triagem', icone: '🧺', onClick: () => ir('triagem'), separar: true }] : []),
        ] },
      )} />
    </div>
  )
  /** nome numa linha só (inteiro no "title") e medida/categoria/cor em chips */
  const nomeLote = (i: Linha) => (
    <div className="min-w-0">
      <div className="truncate font-semibold" title={i.nome}>{i.nome}</div>
      {chipsDe(i).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{chipsDe(i).map((x) => <span key={x.id} className={chip}>{x.texto}</span>)}</div>}
    </div>
  )
  const caixa = (i: Linha) => <input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={`${t('Selecionar')} ${i.codigo ?? i.nome}`} checked={sel.has(i.id)} onChange={() => alternar(i.id)} onClick={parar} onKeyDown={parar} />

  return (
    <div>
      <Titulo subtitulo={t('Cada número é a soma dos movimentos: nada some, tudo tem histórico.')}>{t('Estoque')}</Titulo>
      {modulos.length > 1 && <Abas atual={modulo} onChange={(m) => (setSel(new Set()), ajustarParams({ ...Object.fromEntries(chavesFiltro.map((k) => [k, undefined])), modulo: m === 'cabelo' ? undefined : m }))} abas={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />}

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {numero('Em estoque', fq(somar(comSaldo)), t('{n} lote(s)', { n: comSaldo.length }), '')}
        {numero('Disponível', fq(somar(disponiveis)), t('{n} lote(s)', { n: disponiveis.length }), 'separado', 'text-[var(--bom)]')}
        {numero('Para separar', fq(somar(brutos)), t('{n} lote(s)', { n: brutos.length }), 'bruto', brutos.length ? 'text-[var(--alerta)]' : undefined)}
        {numero('Esgotados', String(base.length - comSaldo.length), t('lotes sem saldo'), 'esgotado')}
        {admin && numero('Valor em estoque (custo)', formatar(comSaldo.reduce((s, i) => s + (custoAgora(i) ?? 0), 0), moedaPadrao()), t('custo do que ainda tem'), '', undefined, true)}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Entrada type="search" aria-label={t('Buscar por código, nome ou atributo')} className="w-auto min-w-0 flex-1 basis-48" placeholder={t('Buscar por código, nome ou atributo')} value={busca} onChange={(e) => setP('busca', e.target.value)} onKeyDown={pistola.onKeyDown} />
        <Botao variante="secundario" onClick={() => setJanela('camera')}>📷 {t('Ler código')}</Botao>
        <Botao variante={abrirFiltros || avancados ? 'secundario' : 'leve'} aria-expanded={abrirFiltros} onClick={() => setAbrirFiltros(!abrirFiltros)}>⚙︎ {t('Filtros')}{avancados ? ` · ${avancados}` : ''}</Botao>
        <Botao variante="leve" onClick={() => setJanela('colunas')}>▦ {t('Colunas')}</Botao>
        {larga && <div className="w-56"><Escolha rotulo="Ver como" valor={visao} onChange={setVisao} opcoes={[{ id: 'tabela', nome: 'Tabela' }, { id: 'cartoes', nome: 'Cartões' }]} /></div>}
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

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
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
        <span className="ml-auto text-[var(--suave)]">{t('{n} de {total} lote(s)', { n: lista.length, total: dados?.length ?? 0 })}</span>
        <Botao variante="secundario" disabled={!lista.length} onClick={() => exportar(selecionados.length ? selecionados : lista)}>⬇ {t('Exportar CSV')}</Botao>
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
                <th className="w-10 p-2"><input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={t('Selecionar todos os filtrados')} checked={todos} onChange={() => setSel(todos ? new Set() : new Set(lista.map((i) => i.id)))} /></th>
                <th className="w-12 p-1"><span className="sr-only">{t('Foto')}</span></th>
                <th className="whitespace-nowrap p-2">{t('Código')}</th>
                <th className="p-2">{t('Lote / item')}</th>
                {visiveis.map((c) => <th key={c.id} className={cx('whitespace-nowrap p-2', c.num && 'text-right')}>{t(c.nome)}</th>)}
                <th className="relative w-10 p-2"><span className="sr-only">{t('Ações')}</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.id} {...clicavel(() => ir('lote', { id: i.id }))} className={cx('cursor-pointer border-t border-[var(--borda)] align-middle outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]', sel.has(i.id) && 'bg-[var(--marca-suave)]', i.saldo <= 0 && 'text-[var(--suave)]')}>
                  <td className="px-2 py-1">{caixa(i)}</td>
                  <td className="p-1"><MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} tamanho="sm" /></td>
                  <td className="whitespace-nowrap p-2"><CodigoSelo codigo={i.codigo} anteriores={i.codigosAnteriores} /></td>
                  <td className="w-full min-w-[11rem] max-w-0 p-2">{nomeLote(i)}</td>
                  {visiveis.map((c) => <td key={c.id} className={cx('p-2', c.id === 'origem' && 'min-w-[12rem] max-w-[18rem]', c.id === 'status' && 'whitespace-nowrap', c.num && 'num whitespace-nowrap text-right')}>{c.celula ? c.celula(i) : c.texto(i) || '—'}</td>)}
                  <td className="p-1">{acoes(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul id="lista-estoque" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((i) => {
            const extras = visiveis.filter((c) => !['origem', 'peso', 'status'].includes(c.id)).map((c) => [c, c.texto(i)] as const).filter(([, v]) => v)
            return (
              <li key={i.id} {...clicavel(() => ir('lote', { id: i.id }))} className={cx('min-w-0 cursor-pointer space-y-2 rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm outline-none transition hover:border-[var(--marca)] focus-visible:border-[var(--marca)]', sel.has(i.id) ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
                <div className="flex items-start gap-2">
                  <div className="flex min-h-10 items-center">{caixa(i)}</div>
                  <MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1"><CodigoSelo codigo={i.codigo} anteriores={i.codigosAnteriores} /><StatusBadge status={i.status} /></div>
                    {nomeLote(i)}
                  </div>
                  {acoes(i)}
                </div>
                <VeioDe i={i} />
                <Peso i={i} />
                {extras.length > 0 && <p className="text-xs text-[var(--suave)] [overflow-wrap:anywhere]">{extras.map(([c, v]) => `${t(c.nome)}: ${v}`).join(' · ')}</p>}
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
          <Botao variante="secundario" onClick={() => setEtiquetas(selecionados.map((i) => i.id))}>🏷 {t('Imprimir etiquetas')}</Botao>
          {admin && <Botao variante="secundario" onClick={() => setJanela('marcar')}>✎ {t('Mudar atributo')}</Botao>}
          <Botao variante="leve" onClick={() => setSel(new Set())}>{t('Limpar seleção')}</Botao>
        </div>
      )}

      {ajustar && <Ajustar itemId={ajustar} onFechar={() => setAjustar(undefined)} />}
      {trocar && <TrocarCodigo tipo="lote" id={trocar.id} atual={trocar.codigo} onFechar={() => setTrocar(undefined)} />}
      {janela === 'camera' && <LeitorCodigo onLer={lerCodigo} onFechar={() => setJanela(undefined)} />}
      {etiquetas && <ImprimirEtiquetas ids={etiquetas} onFechar={() => setEtiquetas(undefined)} />}
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
  const t = useT()
  const { nav, voltar, ir, marcarSujo } = useApp()
  const ids = (nav.params.ids ? String(nav.params.ids).split(',') : [nav.params.id as Id]).filter(Boolean)
  const daTriagem = nav.params.volta === 'triagem'
  // depois de separar: "Imprimir N etiquetas?" com os pacotes novos e, depois, volta (quadro ou pacote)
  const [feitos, setFeitos] = useState<Id[]>()
  const [imprimir, setImprimir] = useState(false)
  const seguir = () => (daTriagem ? ir('triagem') : ir('lote', { id: feitos?.length === 1 ? feitos[0] : ids[0] }))
  if (feitos)
    return imprimir ? <ImprimirEtiquetas ids={feitos} onFechar={seguir} /> : (
      <Janela aberta titulo={t('Imprimir {n} etiquetas?', { n: feitos.length })} onFechar={seguir} rodape={
        <div className="flex gap-2">
          <Botao variante="leve" className="flex-1" onClick={seguir}>{t('Agora não')}</Botao>
          <Botao grande className="flex-1" onClick={() => setImprimir(true)}>🏷 {t('Imprimir')}</Botao>
        </div>
      }>
        <p className="text-sm">{t('Uma etiqueta por pacote novo: o código abre o pacote no sistema.')}</p>
      </Janela>
    )
  return <Separar ids={ids} onFechar={voltar} voltarRotulo={daTriagem ? 'Voltar à triagem' : undefined} onSeparou={(lotes) => (marcarSujo(false), setFeitos(lotes))} />
}

const DICA_SEPARAR = 'Digite o peso e o que é cada parte; o que sobrar é perda. Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.'
const DICA_JUNTAR = 'Junta pacotes de compras diferentes; a origem de cada grama fica guardada. Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.'
const DICA_DEPOIS = 'O que ainda não deu para separar fica guardado e aparece como pendência. Ex.: 6 kg aleatório.'
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
  const [motivo, setMotivo] = useState('')
  const [partes, setPartes] = useState<{ id: Id; quantidade?: number; campos: Campos; ref?: string; codigo?: string }[]>([{ id: novoId(), campos: { estado: 'Separado', categoria: 'Normal' } }])
  // "Deixar para depois": vira um pacote "Não identificado" (pendência), não perda
  const [depois, setDepois] = useState<{ id: Id; quantidade?: number; codigo?: string }>(() => ({ id: novoId() }))
  // rateio do custo, preço de referência e códigos manuais ficam no "Avançado ▸"
  const [avancado, setAvancado] = useState(false)
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
  const total = lotes.reduce((s, l) => s + l.saldo, 0)
  const juntar = lotes.length > 1
  const usar = usada ?? total
  const somaPartes = partes.reduce((s, p) => s + (p.quantidade ?? 0), 0)
  const gDepois = depois.quantidade ?? 0
  const soma = somaPartes + gDepois
  const perda = Math.max(0, usar - soma)
  const digitar = digitarCodigos ?? regrasCodigos?.regras.lote.modo === 'manual'
  const codigosDigitados = [...partes.map((p) => p.codigo), gDepois ? depois.codigo : undefined].map((c) => (c ?? '').trim().toUpperCase()).filter(Boolean)
  const codigosValidos = !digitar || ([...partes, ...(gDepois ? [depois] : [])].every((p) => codigosOk[p.id] !== false) && new Set(codigosDigitados).size === codigosDigitados.length)
  const att = (i: number, d: Partial<(typeof partes)[number]>) => setPartes(partes.map((p, k) => (k === i ? { ...p, ...d, campos: { ...p.campos, ...(d.campos ?? {}) } } : p)))
  const triar = async (comPartes: boolean) => {
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
  return (
    <Pagina
      titulo={<span className="inline-flex flex-wrap items-center">{juntar ? `${t('Juntar e separar')} ${lotes.map((l) => l.codigo ?? '').join(' + ')}` : `${t('Separar')} ${lotes[0].codigo ?? ''} · ${lotes[0].nome}`}<Info texto={juntar ? DICA_JUNTAR : DICA_SEPARAR} /></span>}
      subtitulo={t('Cada parte: peso e o que é. O que não der para separar agora, deixe para depois; o resto é perda.')}
      onVoltar={onFechar}
      voltarRotulo={voltarRotulo}
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cx('num inline-flex flex-wrap items-center gap-x-1 text-sm font-semibold', soma > usar ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>
            {t('Peso bruto')} <b className="text-[var(--texto)]">{gramasTexto(usar)}</b> → {t('partes')} <b className="text-[var(--texto)]">{gramasTexto(somaPartes)}</b>
            {gDepois > 0 && <> + {t('para depois')} <b className="text-[var(--texto)]">{gramasTexto(gDepois)}</b></>}
            · {t('perda')} <b className={perda > 0 ? 'text-[var(--ruim)]' : undefined}>{gramasTexto(perda)}{usar ? ` (${fmt(Math.round((perda * 10000) / usar), 'percentual')})` : ''}</b>
            <Info texto={DICA_PERDA} />
          </span>
          <span className="flex flex-wrap gap-2">
            {juntar && <Botao variante="secundario" disabled={ocupado} onClick={() => triar(false)}>🔗 {t('Só juntar')}</Botao>}
            <Botao grande disabled={ocupado || !soma || soma > usar || !codigosValidos} onClick={() => triar(true)}>{juntar ? t('Juntar e separar') : t('Separar')}</Botao>
          </span>
        </div>
      }
    >
      <div className="space-y-3">
        {juntar && (
          <ul className="divide-y divide-[var(--borda)] rounded-xl border border-[var(--borda)] text-sm">
            {lotes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                <span className="min-w-0"><span className="font-mono text-xs">{l.codigo}</span> · <b>{l.nome}</b>{l.cadeia && <CadeiaChips className="mt-1" cadeia={l.cadeia} />}</span>
                <span className="num whitespace-nowrap font-semibold">{gramasTexto(l.saldo)}</span>
              </li>
            ))}
            <li className="flex justify-between p-2 font-bold"><span>{t('Total')}</span><span className="num">{gramasTexto(total)}</span></li>
          </ul>
        )}
        {!juntar && <p className="text-sm text-[var(--suave)]">{t('Tem')} <b>{gramasTexto(total)}</b>{usada !== undefined && usada !== total ? <> · {t('vai separar')} <b>{gramasTexto(usar)}</b></> : null}.</p>}
        {digitar && new Set(codigosDigitados).size !== codigosDigitados.length && <p className="text-sm text-[var(--ruim)]">{t('Há dois lotes com o mesmo código.')}</p>}
        {partes.map((p, i) => (
          <div key={p.id} className="space-y-2 rounded-xl border border-[var(--borda)] p-3">
            <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:max-w-sm">
              <Campo rotulo="Peso"><GramasInput valor={p.quantidade} onChange={(q) => att(i, { quantidade: q })} /></Campo>
              <Botao variante="leve" disabled={partes.length === 1} onClick={() => setPartes(partes.filter((_, k) => k !== i))}>{t('Tirar')}</Botao>
            </div>
            <CamposDinamicos campos={campos} valores={p.campos} onChange={(v) => att(i, { campos: v })} pular={['estado']} />
            {avancado && porValor && <Campo rotulo="Valor de referência" ajuda="Vem da tabela (medida × coluna escolhida). Pode mudar."><Entrada inputMode="decimal" value={p.ref ?? ''} placeholder={refDe(p) ?? '?'} onChange={(e) => att(i, { ref: e.target.value })} /></Campo>}
            {digitar && <CampoCodigo tipo="lote" rotulo="Código deste lote" valor={p.codigo ?? ''} onChange={(v) => att(i, { codigo: v })} contexto={{ paiId: juntar ? undefined : lotes[0].id, posicao: i }} onEstado={(ok) => marcarCodigo(p.id, ok)} />}
          </div>
        ))}
        <Botao variante="secundario" onClick={() => setPartes([...partes, { id: novoId(), campos: { ...partes[partes.length - 1]?.campos, comprimento: undefined } }])}>+ {t('Outra parte')}</Botao>

        <div className="space-y-2 rounded-xl border border-dashed border-[var(--alerta)] p-3">
          <div className="flex items-center text-sm font-bold">❓ {t('Deixar para depois')}<Info texto={DICA_DEPOIS} /></div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:max-w-sm">
            <Campo rotulo="Peso (fica como “Não identificado”)"><GramasInput valor={depois.quantidade} onChange={(q) => setDepois({ ...depois, quantidade: q })} /></Campo>
            <Botao variante="leve" disabled={usar - somaPartes <= 0} onClick={() => setDepois({ ...depois, quantidade: usar - somaPartes })}>{t('Tudo o que sobrou')}</Botao>
          </div>
          {digitar && gDepois > 0 && <CampoCodigo tipo="lote" rotulo="Código deste lote" valor={depois.codigo ?? ''} onChange={(v) => setDepois({ ...depois, codigo: v })} contexto={{ paiId: juntar ? undefined : lotes[0].id, posicao: partes.length }} onEstado={(ok) => marcarCodigo(depois.id, ok)} />}
        </div>

        <Campo rotulo="Observação (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: mesma qualidade, lavar junto')} onChange={(e) => setMotivo(e.target.value)} /></Campo>

        <button type="button" aria-expanded={avancado} onClick={() => setAvancado(!avancado)} className="min-h-10 text-sm font-semibold text-[var(--marca)]">{t('Avançado')} {avancado ? '▾' : '▸'}</button>
        {avancado && (
          <div className="space-y-3 rounded-xl bg-[var(--fundo)] p-3 text-sm">
            {!juntar && <Campo rotulo="Quanto deste lote vai separar?"><GramasInput valor={usar} onChange={setUsada} /></Campo>}
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
      </div>
    </Pagina>
  )
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
  const [etiqueta, setEtiqueta] = useState(false)
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
  const vender = () => ir('vender', { modulo: 'cabelo', lote: i.id })
  const verRastreio = () => document.getElementById('rastreio-total')?.scrollIntoView?.({ behavior: 'smooth' })
  // PRÓXIMO PASSO (um só, destacado): bruto → Separar; vendável → Vender; acabou → ver para onde foi
  const proximo = !admin ? undefined : i.saldo > 0 && bruto ? { rotulo: '✂️ Separar', f: separar } : i.saldo > 0 ? { rotulo: '💰 Vender', f: vender } : { rotulo: '📊 Ver para onde foi', f: verRastreio }
  return (
    <div className="space-y-4">
      <Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao>
      <Titulo subtitulo={<span className="inline-flex flex-wrap items-center gap-2"><CodigoSelo grande codigo={i.codigo} anteriores={i.codigosAnteriores} />{!!i.codigosAnteriores?.length && <span className="text-xs">{t('antes')}: <span className="font-mono">{i.codigosAnteriores.join(', ')}</span></span>}· {t('desde')} {dataBR(i.criadoEm)} <StatusBadge status={dados.status} /></span>} acao={
        <div className="flex flex-wrap items-center gap-2">
          {/* um botão principal (Vender ou Separar, conforme a situação); o resto fica no ⋯ */}
          {proximo && <Botao grande onClick={proximo.f}>{t(proximo.rotulo)}</Botao>}
          <Botao variante="leve" onClick={() => ir('rastreio', { itemId: i.id })}>🔎 {t('Rastrear origem e destino')}</Botao>
          <MenuAcoes comRotulo acoes={acoesLote(
            { id: i.id, saldo: i.saldo, compras: dados.dna.compras.map((c) => ({ id: c.id, codigo: c.codigo, fornecedor: c.fornecedor?.nome, fornecedorId: c.fornecedor?.id })), origens: dados.pai ? [dados.pai] : dados.dna.unificacao?.fontes, vendavel: !bruto },
            { ir, t, admin, semAbrir: true, onAjustar: () => setAjustar(true), onTrocarCodigo: () => setTrocar(true), extras: [
              { rotulo: 'Etiqueta', icone: '🏷', onClick: () => setEtiqueta(true), separar: true },
              ...(admin ? [{ rotulo: 'Editar atributos', icone: '✎', onClick: () => setEditar(true) }] : []),
              ...(bruto && i.saldo > 0 ? [{ rotulo: 'Abrir na triagem', icone: '🧺', onClick: () => ir('triagem') }] : []),
            ] },
          )} />
        </div>
      }><span className="flex min-w-0 items-center gap-3"><MiniaturaLote itemId={i.id} foto={dados.fotoPrincipal} marcador={marcadorLote(i.campos, i.nome)} tamanho="lg" /><span className="min-w-0 [overflow-wrap:anywhere]">{i.nome}</span></span></Titulo>
      {gen && <Caminho g={gen} onSeparar={admin && bruto && i.saldo > 0 ? separar : undefined} onVender={admin && !bruto && i.saldo > 0 ? vender : undefined} />}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Agora')}</div><div className="num text-xl font-bold">{q(i.saldo)}</div></Cartao>
        <Cartao><div className="text-xs text-[var(--suave)]">{t('Custo do lote')}</div><div className="num text-xl font-bold">{formatar(i.custoPrincipal ?? 0, m)}</div></Cartao>
        <BotaoNumero rotulo={t('Vendido')} onClick={verRastreio}>{formatar(dados.vendido, m)}</BotaoNumero>
        <BotaoNumero rotulo={t('Lucro (vendido − custo)')} onClick={verRastreio} className={dados.lucro < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{formatar(dados.lucro, m)}</BotaoNumero>
      </div>
      {ajustar && <Ajustar itemId={i.id} onFechar={() => setAjustar(false)} />}
      {editar && <EditarAtributos id={i.id} campos={campos} valores={i.campos} onFechar={() => setEditar(false)} />}
      {trocar && <TrocarCodigo tipo="lote" id={i.id} atual={i.codigo} onFechar={() => setTrocar(false)} />}
      {etiqueta && <ImprimirEtiquetas ids={[i.id]} onFechar={() => setEtiqueta(false)} />}

      {i.unidade === 'grama' && (
        <Cartao titulo={`${t('Cada grama deste lote')} · ${t('entrou')} ${q(f.inicial)}`}>
          <BarraFluxo total={f.inicial} partes={[
            { nome: 'Vendido', valor: f.vendido, cor: 'var(--bom)' },
            { nome: 'Separado em lotes', valor: f.separado, cor: 'var(--marca)' },
            ...(f.unificado ? [{ nome: 'Unificado em outro lote', valor: f.unificado, cor: '#8b5cf6' }] : []),
            { nome: 'Perda', valor: f.perda, cor: 'var(--ruim)' },
            { nome: 'Em estoque', valor: f.saldo, cor: 'var(--alerta)' },
          ]} />
        </Cartao>
      )}

      <Cartao titulo={<span id="rastreio-total">{t('Rastreio total: de onde veio e para onde foi cada grama')}</span>}>
        {gen ? <RastreioResumo g={gen} admin={admin} /> : <Carregando />}
      </Cartao>

      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo={t('Atributos')} acao={admin && campos.length > 0 ? <Botao variante="secundario" onClick={() => setEditar(true)}>✎ {t('Editar atributos')}</Botao> : undefined}>
          {!atributos.length ? <p className="text-sm text-[var(--suave)]">{t('Nenhum atributo preenchido.')}</p> : (
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
              {atributos.map((a) => <div key={a.id} className="contents"><dt className="text-[var(--suave)]">{t(a.nome)}</dt><dd className="font-semibold [overflow-wrap:anywhere]">{t(a.valor)}</dd></div>)}
            </dl>
          )}
        </Cartao>
        <Cartao titulo={`${t('Fotos do lote')}${dados.fotos.length ? ` · ${dados.fotos.length}` : ''}`}><FotosDoLote itemId={i.id} codigo={i.codigo} /></Cartao>
        <Cartao titulo={t('Arquivos')}><AnexosCurtos donoId={i.id} categorias={['outro']} esconderFotos /></Cartao>
      </div>
      <Cartao titulo={t('Histórico do pacote')} ajuda="Tudo o que entrou e saiu deste pacote, dia a dia. Ex.: 6.000 → 4.500 g na venda V-9.">
        <HistoricoPacote id={i.id} />
      </Cartao>
    </div>
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
  const { nav, voltar } = useApp()
  const { dados, erro } = useConsulta('genealogia', { compraId: nav.params.compraId as Id | undefined, itemId: nav.params.itemId as Id | undefined })
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  return (
    <div className="space-y-4">
      <Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao>
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
    <button type="button" onClick={onClick} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-left shadow-sm hover:border-[var(--marca)]">
      <span className="block text-xs text-[var(--suave)]">{rotulo}</span>
      <span className={cx('num block text-xl font-bold', className)}>{children}</span>
    </button>
  )
}
