// ESTOQUE: lista inteligente (filtros no endereço, favoritos, colunas escolhidas, tabela ou cartões, seleção em massa,
// CSV), SEPARAR lote bruto em N lotes, ajustar, PRONTUÁRIO do lote (compra → triagem → venda) e RASTREIO.

import { type ReactNode, useCallback, useState } from 'react'
import { FiltroViagem, SelosViagem, passaViagem, viagensDasLinhas } from '../../../shared/ui/seloViagem'
import { GrupoVisao, useVisaoLista } from '../../../shared/ui/visaoLista'
import { PainelSelecao } from '../../../shared/ui/painelSelecao'
import { AreaPaginada, Paginacao, usePaginacao } from '../../../shared/ui/paginacao'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { GrupoFiltro, CampoFaixa, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { formatar } from '../../../core/domain/dinheiro'
import type { Campos, Id } from '../../../core/domain/tipos'
import type { CampoDef } from '../../../core/modulos'
import { Abas, Botao, Campo, Carregando, Entrada, Selecao, Titulo, cx, dataBR, fmt, moedaPadrao, diaMes } from '../../../shared/ui/base'
import { useApp, useConsulta, useParamTela, useFiltrosTela } from '../../../shared/ui/contexto'
import { LeitorCodigo, STATUS_LOTE, useTelaLarga } from '../../../shared/ui/estoqueUi'
import { usePistola } from '../../../shared/ui/leitorPistola'
import { useLembrado } from '../../../shared/ui/filtros'
import { CadeiaChips } from '../../../shared/ui/rastreioTotal'
import { NumeroGrande, GrupoNumeros } from '../../../shared/ui/numeroGrande'
import { acoesLote } from '../../../shared/ui/menuAcoes'
import { CodigoSelo, TrocarCodigo } from '../../../shared/ui/codigos'
import { useT } from '../../../shared/ui/i18n'
import { MiniaturaLote, marcadorLote, useTirarFoto } from '../../../shared/ui/fotos'
import { SeloEtiqueta } from '../../../shared/ui/etiquetas'
import { ReservarLote, SeloReserva, reservado } from '../../../shared/ui/reserva'
import { baixarCSV } from '../../../shared/ui/csv'
import { ehBruto, type Linha, useCamposModulo } from '../model/comum'
import { Ajustar, MarcarLotes, SalvarFavorito } from '../components/janelas'

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
      <SelosViagem vs={viagensDasLinhas(i.compras.map((c) => c.viagem))} curto />
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

export function Estoque() {
  const t = useT()
  const { ir, nav, ajustarParams, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const larga = useTelaLarga()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const modulos = (cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.tiposItem.some((x) => x.controlaEstoque))
  const [modulo] = useParamTela('modulo', 'cabelo')
  const campos = useCamposModulo(modulo)
  const { p, tirar: tirarFiltro } = useFiltrosTela()
  const setP = (k: string, v: string) => ajustarParams({ [k]: v || undefined, ...(k === 'status' ? { bruto: undefined } : {}) })
  const busca = p('busca')
  const status = p('status') || (nav.params.bruto ? 'bruto' : '')
  const repor = !!nav.params.repor
  const { dados } = useConsulta('estoque', { moduloId: modulo })
  // VER COMO (padrão das listagens): tabela ou cartões — os cartões são a mesma linha padrão do celular
  const vis = useVisaoLista('estoque')
  const [colunasSalvas, setColunasSalvas] = useLembrado<Record<string, string[]>>('estoque.colunas.v2', {})
  const [favoritos, setFavoritos] = useLembrado<Favorito[]>('estoque.favoritos', [])
  const [sel, setSel] = useState<Set<Id>>(new Set())
  const [ajustar, setAjustar] = useState<Id>()
  const [trocar, setTrocar] = useState<Linha>()
  const [reservar, setReservar] = useState<Linha>()
  const [janela, setJanela] = useState<'colunas' | 'favorito' | 'marcar' | 'camera'>()
  const { tirar } = useTirarFoto()

  // ---------- filtros ----------
  // a página e o tamanho da página não são filtro (não contam, não entram no favorito)
  const chavesFiltro = Object.keys(nav.params).filter((k) => !['modulo', 'pagina', 'porPagina'].includes(k))
  const viagensEstoque = viagensDasLinhas((dados ?? []).flatMap((i) => i.compras.map((c) => c.viagem)))
  const limpar = () => ajustarParams(Object.fromEntries(chavesFiltro.map((k) => [k, undefined])))
  const ativosEstoque = [
    ...(status ? [{ k: 'status,bruto', rotulo: `📦 ${t(STATUS_FILTRO.find((s) => s.id === status)?.nome ?? status)}` }] : []),
    ...campos.filter((c) => c.tipo === 'numero' && (p(`min.${c.id}`) || p(`max.${c.id}`))).map((c) => ({ k: `min.${c.id},max.${c.id}`, rotulo: `${t(c.nome)}: ${p(`min.${c.id}`) || '0'} – ${p(`max.${c.id}`) || '∞'}` })),
    ...campos.filter((c) => (c.tipo === 'lista' || c.tipo === 'simNao') && p(`f.${c.id}`)).map((c) => ({ k: `f.${c.id}`, rotulo: `${t(c.nome)}: ${c.tipo === 'simNao' ? t(p(`f.${c.id}`) === 'true' ? 'Sim' : 'Não') : t(p(`f.${c.id}`))}` })),
    ...(p('compra') ? [{ k: 'compra', rotulo: `🛒 ${p('compra')}` }] : []),
    ...(p('vg') ? [{ k: 'vg', rotulo: `✈️ ${((id: string, vs: { id: string; codigo: string; nome: string }[]) => (id === 'sem' ? 'Sem viagem' : vs.find((v) => v.id === id)?.codigo ?? id))(p('vg'), viagensEstoque)}` }] : []),
    ...(p('de') || p('ate') ? [{ k: 'de,ate', rotulo: `📅 ${p('de') ? diaMes(p('de')) : '…'} – ${p('ate') ? diaMes(p('ate')) : '…'}` }] : []),
  ]
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
      passaViagem(p('vg'), i.compras.map((c) => c.viagem)) &&
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
  const pag = usePaginacao(lista, { padrao: 50, reiniciar: JSON.stringify([modulo, ...chavesFiltro.map((k) => [k, nav.params[k]])]) })

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

  // ações de um lote: o botão rápido (✂️ Separar, só bruto com saldo) e o menu "⋯"; a tabela e o cartão usam os dois
  const rapida = (i: Linha) => admin && ehBruto(i.status) && i.saldo > 0 ? <BotaoIcone rotulo={t('Separar')} onClick={() => ir('separar', { id: i.id })}>✂️</BotaoIcone> : null
  const menuDe = (i: Linha) => acoesLote(
    { id: i.id, saldo: i.saldo, compras: i.compras, vendavel: !ehBruto(i.status), etiquetaImpressa: !!i.etiquetaImpressaEm, reservado: reservado(i), origens: i.pai ? [i.pai] : i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).map((id, k) => ({ id, codigo: i.unificadoDe?.[k] })) : [] },
    { ir, t, admin, onAjustar: () => setAjustar(i.id), onTrocarCodigo: () => setTrocar(i), onReservar: () => setReservar(i), extras: [
      { rotulo: 'Tirar foto', icone: '📷', onClick: () => tirar(i.id), separar: true },
      { rotulo: 'Escolher foto da galeria', icone: '🖼', onClick: () => tirar(i.id, { galeria: true }) },
      ...(ehBruto(i.status) && i.saldo > 0 ? [{ rotulo: 'Abrir na triagem', icone: '🧺', onClick: () => ir('triagem'), separar: true }] : []),
    ] },
  )
  /** nome numa linha só (inteiro no "title"); chips só para medida/categoria/cor que o nome não mostra */
  const nomeLote = (i: Linha, quebrar?: boolean) => {
    const chips = chipsDe(i)
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={cx('min-w-min max-w-full font-semibold', quebrar ? 'line-clamp-2 leading-snug' : 'truncate')} title={i.nome}>{i.nome}</span>
        {chips.map((x) => <span key={x.id} className={chip}>{x.texto}</span>)}
        <SeloReserva i={i} />
      </div>
    )
  }

  return (
    <div>
      <Titulo subtitulo={t('Cada número é a soma dos movimentos: nada some, tudo tem histórico.')}>{t('Estoque')}</Titulo>
      {modulos.length > 1 && <Abas atual={modulo} onChange={(m) => (setSel(new Set()), ajustarParams({ ...Object.fromEntries(chavesFiltro.map((k) => [k, undefined])), modulo: m === 'cabelo' ? undefined : m }))} abas={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />}

      {/* NÚMEROS GRANDES (fileira padrão): tocar filtra a lista pela situação; o filtro ligado fica destacado */}
      <GrupoNumeros colunas={admin ? 5 : 4}>
        <NumeroGrande rotulo="Em estoque" icone="📦" cor="var(--marca)" valor={fq(somar(comSaldo))} selos={[{ texto: t('{n} lote(s)', { n: comSaldo.length }), tom: 'marca' }]} ativo={!status} onClick={() => setP('status', '')} carregando={!dados} />
        <NumeroGrande rotulo="Disponível" icone="✅" cor="var(--bom)" colorirValor valor={fq(somar(disponiveis))} selos={[{ texto: t('{n} lote(s)', { n: disponiveis.length }) }, { texto: t('pronto para vender'), tom: 'bom' }]} ativo={status === 'separado'} onClick={() => setP('status', status === 'separado' ? '' : 'separado')} carregando={!dados} />
        <NumeroGrande rotulo="Para separar" icone="⏳" cor="var(--alerta)" colorirValor={brutos.length > 0} valor={fq(somar(brutos))} selos={[{ texto: t('{n} lote(s)', { n: brutos.length }) }, ...(brutos.length ? [{ texto: t('bruto'), tom: 'alerta' as const }] : [])]} ativo={status === 'bruto'} onClick={() => setP('status', status === 'bruto' ? '' : 'bruto')} carregando={!dados} />
        <NumeroGrande rotulo="Esgotados" icone="⭕" cor="var(--suave)" valor={String(base.length - comSaldo.length)} selos={[{ texto: t('sem saldo') }]} ativo={status === 'esgotado'} onClick={() => setP('status', status === 'esgotado' ? '' : 'esgotado')} carregando={!dados} />
        {admin && <NumeroGrande rotulo="Valor em estoque" icone="💵" cor="#0ea5e9" valor={formatar(comSaldo.reduce((s, i) => s + (custoAgora(i) ?? 0), 0), moedaPadrao())} selos={[{ texto: t('a custo'), tom: 'marca' }, { texto: t('o que ainda tem') }]} carregando={!dados} />}
      </GrupoNumeros>

      {/* FILTRO PADRÃO: busca (aceita a pistola) + 📷 + ⚙ Filtros → painel em grupos (situação · medidas · o cabelo ·
          de onde veio) → "N de M lote(s)" + chips ✕; Colunas, Ver como e CSV ficam à direita do resultado */}
      <FiltroLista
        className="mb-2"
        // SITUAÇÃO à vista (o mesmo trilho do Vender): um toque troca a lista; o número é de lotes
        situacao={{ valor: ['', 'separado', 'parcial', 'bruto', 'esgotado', 'todos'].includes(status) ? status : '', onChange: (id) => setP('status', id), opcoes: [
          { id: '', nome: 'Com saldo', n: dados ? comSaldo.length : undefined },
          { id: 'separado', nome: 'Disponível', n: dados ? disponiveis.length : undefined },
          { id: 'parcial', nome: 'Parcial', n: dados ? base.filter((i) => i.status === 'parcial').length : undefined },
          { id: 'bruto', nome: 'Para separar', n: dados ? brutos.length : undefined, tom: brutos.length ? 'alerta' as const : undefined },
          { id: 'esgotado', nome: 'Esgotado', n: dados ? base.length - comSaldo.length : undefined },
          { id: 'todos', nome: 'Todos', n: dados ? base.length : undefined },
        ] }}
        busca={busca} onBusca={(v) => setP('busca', v)} placeholder="Buscar por código, nome ou atributo" onKeyDown={pistola.onKeyDown}
        extra={<><FiltroViagem nasLinhas={(dados ?? []).map((i) => i.compras.map((c) => c.viagem))} valor={p('vg')} onChange={(v) => setP('vg', v)} /><Botao variante="secundario" className="shrink-0 whitespace-nowrap px-3" aria-label={t('Ler código')} onClick={() => setJanela('camera')}>📷<span className="hidden sm:inline"> {t('Ler código')}</span></Botao></>}
        ativos={ativosEstoque} onTirar={tirarFiltro} onLimpar={limpar} temAtivos={chavesFiltro.length > 0}
        resultados={dados ? lista.length : undefined} total={dados?.length} unidade="lote(s)"
        exportar={{ onExportar: () => exportar(selecionados.length ? selecionados : lista), quantos: selecionados.length || lista.length, unidade: selecionados.length ? 'selecionado(s)' : 'lote(s)' }}
        painel={<>
            {campos.some((c) => c.tipo === 'numero') && (
              <GrupoFiltro titulo="Medidas" icone="📏">
                {campos.filter((c) => c.tipo === 'numero').map((c) => (
                  <CampoFaixa key={c.id} rotulo={`${t(c.nome)}${c.unidade ? ` (${c.unidade})` : ''}`}>
                    <Entrada inputMode="numeric" aria-label={`${t(c.nome)} · ${t('mínimo')}`} placeholder={t('mín.')} value={p(`min.${c.id}`)} onChange={(e) => setP(`min.${c.id}`, e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
                    <Entrada inputMode="numeric" aria-label={`${t(c.nome)} · ${t('máximo')}`} placeholder={t('máx.')} value={p(`max.${c.id}`)} onChange={(e) => setP(`max.${c.id}`, e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} />
                  </CampoFaixa>
                ))}
              </GrupoFiltro>
            )}
            {campos.some((c) => c.tipo === 'lista' || c.tipo === 'simNao') && (
              <GrupoFiltro titulo="O cabelo" icone="💇">
                {campos.filter((c) => c.tipo === 'lista' || c.tipo === 'simNao').map((c) => (
                  <Campo key={c.id} rotulo={c.nome}>
                    <Selecao valor={p(`f.${c.id}`)} onChange={(v) => setP(`f.${c.id}`, v)} vazio="Todos" opcoes={c.tipo === 'simNao' ? [{ id: 'true', nome: 'Sim' }, { id: 'false', nome: 'Não' }] : (c.opcoes ?? []).map((o) => ({ id: o, nome: o }))} />
                  </Campo>
                ))}
              </GrupoFiltro>
            )}
            {/* COMO MOSTRAR (dentro dos filtros): o que aparece em cada lote e no CSV; no computador, também tabela × cartões */}
            <GrupoVisao visao={vis.visao} onVisao={vis.setVisao}>
              <p className="col-span-full text-xs font-semibold text-[var(--suave)]">{t('Colunas')} · <span className="font-normal">{t(larga && !vis.cartoes ? 'o que aparece na tabela e no CSV (fica guardado neste aparelho).' : 'aparecem ao abrir o lote e no CSV (fica guardado neste aparelho).')}</span></p>
              <div className="col-span-full flex flex-wrap gap-1.5">
                {colunas.map((c) => {
                  const on = escolhidas.includes(c.id)
                  return <button key={c.id} type="button" aria-pressed={on} onClick={() => setColunasSalvas({ ...colunasSalvas, [modulo]: on ? escolhidas.filter((x) => x !== c.id) : colunas.map((x) => x.id).filter((x) => x === c.id || escolhidas.includes(x)) })} className={cx('min-h-9 rounded-full px-3 text-xs font-semibold ring-1 transition', on ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)] hover:text-[var(--texto)]')}>{on ? '✓ ' : ''}{t(c.nome)}</button>
                })}
              </div>
              <div className="col-span-full flex flex-wrap items-center gap-2">
                {escolhidas.join() !== padrao.join() && <Botao variante="leve" onClick={() => setColunasSalvas({ ...colunasSalvas, [modulo]: padrao })}>{t('Voltar ao padrão')}</Botao>}
              </div>
            </GrupoVisao>
            <GrupoFiltro titulo="De onde veio" icone="🛒">
              <Campo rotulo="Lote de origem / compra"><Entrada placeholder="P-0003 / L-0001" value={p('compra')} onChange={(e) => setP('compra', e.target.value)} /></Campo>
              <CampoFaixa rotulo="Entrada (período)">
                <Entrada type="date" aria-label={t('De')} value={p('de')} onChange={(e) => setP('de', e.target.value)} />
                <Entrada type="date" aria-label={t('Até')} value={p('ate')} onChange={(e) => setP('ate', e.target.value)} />
              </CampoFaixa>
            </GrupoFiltro>
        </>}
      />

      {/* filtros salvos (★): um toque aplica; "☆ Salvar filtro" guarda o que está ligado */}
      {(favoritos.length > 0 || chavesFiltro.length > 0) && <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {favoritos.map((f, k) => (
          <span key={k} className="inline-flex items-center rounded-full bg-[var(--marca-suave)] text-[var(--marca)]">
            <button type="button" className="min-h-10 rounded-l-full pl-3 pr-1 font-semibold" onClick={() => ajustarParams({ ...Object.fromEntries(chavesFiltro.map((x) => [x, undefined])), ...f.params })}>★ {f.nome}</button>
            <button type="button" className="min-h-10 min-w-10 rounded-r-full" aria-label={`${t('Tirar favorito')} ${f.nome}`} onClick={() => setFavoritos(favoritos.filter((_, j) => j !== k))}>×</button>
          </span>
        ))}
        {chavesFiltro.length > 0 && <Botao variante="leve" onClick={() => setJanela('favorito')}>☆ {t('Salvar filtro')}</Botao>}
        {chavesFiltro.length > 0 && !ativosEstoque.length && <Botao variante="leve" onClick={limpar}>× {t('Limpar filtros')}</Botao>}
      </div>}

      {!dados ? (
        <Carregando />
      ) : !lista.length ? (
        <VazioFiltro texto="Nada no estoque com esse filtro." filtrando={chavesFiltro.length > 0} onLimpar={limpar} />
      ) : (
        // LISTAGEM PADRÃO (TabelaDados): seleção em massa, linhas compactas (foto pequena) e as colunas que a pessoa escolheu
        <div id="lista-estoque">
          <AreaPaginada pag={pag}>
          <TabelaDados
            cartoes={vis.cartoes}
            linhas={pag.itens}
            chave={(i) => i.id}
            compacta
            onAbrir={(i) => ir('lote', { id: i.id })}
            rotuloLinha={(i) => `${i.codigo ?? ''} · ${i.nome}`}
            acoes={menuDe}
            acaoRapida={rapida}
            realce={(i) => (i.saldo <= 0 ? 'apagada' : undefined)}
            // CELULAR: a linha padrão (TabelaDados) — ao abrir: as colunas escolhidas em "Colunas da lista" viram os fatos
            celular={{
              midia: (i) => <MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} tamanho="sm" iconeSemFoto />,
              titulo: (i) => i.nome,
              valor: (i) => qtd(i, i.saldo),
              valorSub: (i) => (i.quantidadeInicial && i.quantidadeInicial !== i.saldo ? t('de {q}', { q: qtd(i, i.quantidadeInicial) }) : undefined),
              resumo: (i) => [[...new Set(i.compras.map((c) => c.fornecedor).filter(Boolean))].join(', '), i.pai ? `✂ ${t('de')} ${i.pai.codigo ?? i.pai.nome}` : '', i.unificadoDe?.length ? `🔗 ${t('juntado de')} ${i.unificadoDe.join(' + ')}` : ''].filter(Boolean).join(' · ') || t('cadastro'),
              codigo: (i) => i.codigo,
              situacao: (i) => { const s = STATUS_LOTE[i.status]; return { texto: t(s.nome), tom: s.tom === 'neutro' ? 'suave' : s.tom } },
              marca: (i) => <>{i.saldo > 0 && <SeloEtiqueta soLeitura id={i.id} impressaEm={i.etiquetaImpressaEm} por={i.etiquetaImpressaPor} via={i.etiquetaVia} />}<SeloReserva i={i} /><SelosViagem vs={viagensDasLinhas(i.compras.map((c) => c.viagem))} curto soLeitura /></>,
              fatos: (i) => [...i.compras.map((c) => `🛒 ${c.codigo ?? t('Compra')}`), ...visiveis.filter((c) => !['origem', 'peso', 'status'].includes(c.id)).map((c) => { const v = c.texto(i); return v ? `${t(c.nome)}: ${v}` : '' })],
            }}
            selecao={{ marcados: sel, onAlternar: alternar, onTodos: () => setSel(todos ? new Set() : new Set(lista.map((i) => i.id))), rotulo: (id) => `${t('Selecionar')} ${lista.find((i) => i.id === id)?.codigo ?? ''}` }}
            colunas={[
              { id: 'foto', titulo: '', classe: 'w-12', celula: (i) => <MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} tamanho="sm" iconeSemFoto /> },
              { id: 'codigo', titulo: 'Código', classe: 'whitespace-nowrap', celula: (i) => <CodigoSelo codigo={i.codigo} anteriores={i.codigosAnteriores} /> },
              // a etiqueta sempre à vista (coluna fixa): ✓ impressa · 🏷 sem etiqueta (toque imprime)
              { id: 'etiqueta', titulo: 'Etiqueta', classe: 'whitespace-nowrap', celula: (i) => (i.saldo > 0 ? <SeloEtiqueta id={i.id} impressaEm={i.etiquetaImpressaEm} por={i.etiquetaImpressaPor} via={i.etiquetaVia} /> : <span className="text-xs text-[var(--suave)]">—</span>) },
              { id: 'nome', titulo: 'Lote / item', classe: 'w-full min-w-[11rem] max-w-0', celula: (i) => nomeLote(i) },
              ...visiveis.map((c) => ({ id: c.id, titulo: c.nome, direita: c.num, classe: cx(c.id === 'origem' && 'min-w-[10rem] max-w-[16rem]', c.id === 'status' && 'whitespace-nowrap'), celula: (i: Linha) => (c.celula ? c.celula(i) : c.texto(i) || '—') })),
            ]}
          />
          </AreaPaginada>
        </div>
      )}
      {dados && lista.length > 0 && <Paginacao {...pag} unidade="lote(s)" />}

      {/* PAINEL DA SELEÇÃO (padrão): os lotes marcados e as ações explicadas */}
      {selecionados.length > 0 && (
        <PainelSelecao
          unidade="lote"
          itens={selecionados.map((i) => ({ id: i.id, codigo: i.codigo, peso: i.saldo, detalhe: i.nome }))}
          topo={!todos && <Botao variante="leve" onClick={() => setSel(new Set(lista.map((i) => i.id)))}>{t('Selecionar todos os {n} filtrados', { n: lista.length })}</Botao>}
          onTirar={(id) => alternar(id)}
          onLimpar={() => setSel(new Set())}
          opcoes={[
            { id: 'etiquetas', icone: '🏷', principal: true, onClick: () => ir('etiquetas', { f: 'todas', sel: selecionados.map((i) => i.id).join(',') }),
              titulo: 'Imprimir etiquetas', legenda: 'Abre Etiquetas com estes lotes já marcados.',
              ajuda: 'Uma etiqueta por lote, com o código, o peso de agora e o QR. Ex.: 3 lotes sem etiqueta → imprime as 3 de uma vez.' },
            { id: 'csv', icone: '⬇', onClick: () => exportar(selecionados),
              titulo: 'Exportar CSV', legenda: 'Baixa uma planilha só com os marcados (as colunas que estão à vista).',
              ajuda: 'Gera um arquivo .csv para abrir no Excel ou no Google Planilhas. Ex.: marcou 4 lotes de 60 cm → a planilha tem as 4 linhas.' },
            ...(admin ? [{ id: 'atributo', icone: '✎', onClick: () => setJanela('marcar'),
              titulo: 'Mudar atributo', legenda: 'Troca a cor, a categoria ou outro atributo de todos de uma vez.',
              ajuda: 'Muda o mesmo atributo nos lotes marcados (fica no histórico de cada um). Ex.: 5 lotes marcados como Castanho → Castanho escuro.' }] : []),
          ]}
        />
      )}

      {ajustar && <Ajustar itemId={ajustar} onFechar={() => setAjustar(undefined)} />}
      {trocar && <TrocarCodigo tipo="lote" id={trocar.id} atual={trocar.codigo} onFechar={() => setTrocar(undefined)} />}
      {reservar && <ReservarLote id={reservar.id} codigo={reservar.codigo} atual={reservar.reserva} onFechar={() => setReservar(undefined)} />}
      {janela === 'camera' && <LeitorCodigo onLer={lerCodigo} onFechar={() => setJanela(undefined)} />}
      {janela === 'favorito' && <SalvarFavorito onFechar={() => setJanela(undefined)} onSalvar={(nome) => setFavoritos([...favoritos.filter((f) => f.nome !== nome), { nome, params: Object.fromEntries(Object.entries(nav.params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) }])} />}
      {janela === 'marcar' && <MarcarLotes ids={selecionados.map((i) => i.id)} campos={campos} onFechar={() => setJanela(undefined)} onFeito={() => setSel(new Set())} />}
    </div>
  )
}

function BotaoIcone({ rotulo, onClick, children }: { rotulo: string; onClick(): void; children: ReactNode }) {
  return <button type="button" title={rotulo} aria-label={rotulo} onClick={onClick} className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl text-base text-[var(--marca)] hover:bg-[var(--marca-suave)]">{children}</button>
}
