// MODO CAIXA (venda rápida, como caixa de loja grande): pega o pacote, passa a pistola / lê o QR / digita o código,
// o lote entra INTEIRO (saldo disponível) com o preço da tabela (medida × fator da coluna padrão ou da cliente) e
// FECHAR paga num toque. Só três coisas na tela: o campo de leitura (sempre com o foco), a lista e o FECHAR.
// A baixa do estoque, o caixa e o histórico (saldo antes → depois) são os da venda normal (concluirVenda).
// Celular: cartões + barra fixa embaixo; tablet: lista à esquerda e total à direita; desktop: tabela larga.

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Cotacao, type TabelaCotacoes, formatar, moeda as moedaDe, multiplicarFator, valorDeUm } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id, TabelaPreco } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import { fatorDaTabela } from '../core/services/precos'
import { Botao, Campo, Entrada, Escolha, Info, Janela, Selecao, ValorInput, cx, gramasTexto, loc, moedaPadrao, ehToque } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../ui/contexto'
import { EditorPagamentos, type PagamentoTela, SeletorPessoa, conv, cotacaoDigitada, cotacaoTexto, lerCotacaoTexto, linkWhatsApp, textoCotacaoPagamento, useCotacoes } from '../ui/compartilhados'
import { LeitorCodigo, StatusBadge } from '../ui/estoqueUi'
import { VisorFotos, marcadorLote, useUrlFoto } from '../ui/fotos'
import { HistoricoPacote } from '../ui/historicoPacote'
import { useT } from '../ui/i18n'
import { acharPorCodigo, buscarPacotes, usePistola } from '../ui/leitorPistola'

type Pacote = ResultadoConsulta<'estoque'>[number]

interface LinhaCaixa {
  id: Id
  itemId: Id
  /** gramas (cabelo) ou unidades (produto) */
  quantidade: number
}

interface Preco {
  moeda: string
  total: number
  calculo?: { medida: number; fator: string; categoria: string; tabelaId: Id; colunaId: string }
  erro?: string
}

interface Feita {
  id: Id
  total: number
  moeda: string
  /** total na moeda da tabela quando cobrou em outra */
  totalPrincipal?: number
  moedaPrincipal: string
  troco?: number
  texto: string
  telefone?: string
}

// ---------- bipe (WebAudio, sem arquivo) + vibração ----------

let audio: AudioContext | undefined
function bipe(ok: boolean) {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (C) {
      audio ??= new C()
      const o = audio.createOscillator()
      const g = audio.createGain()
      const dur = ok ? 0.09 : 0.28
      o.type = ok ? 'sine' : 'square'
      o.frequency.value = ok ? 1500 : 190
      g.gain.setValueAtTime(ok ? 0.12 : 0.08, audio.currentTime)
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur)
      o.connect(g).connect(audio.destination)
      o.start()
      o.stop(audio.currentTime + dur + 0.02)
    }
  } catch {
    /* sem som: segue */
  }
  try {
    navigator.vibrate?.(ok ? 40 : [90, 60, 90])
  } catch {
    /* sem vibração */
  }
}

/** largura do conteúdo (o menu lateral come espaço no tablet); sem ResizeObserver, como nos testes, conta como larga */
function useLargura() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1280)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const o = new ResizeObserver(() => setW(el.clientWidth))
    o.observe(el)
    setW(el.clientWidth)
    return () => o.disconnect()
  }, [])
  return { ref, w }
}

/** media query no JS (sem matchMedia, como nos testes, vale o padrão) */
function useMidia(q: string, padrao: boolean) {
  const ler = () => {
    try {
      return window.matchMedia ? window.matchMedia(q).matches : padrao
    } catch {
      return padrao
    }
  }
  const [v, setV] = useState(ler)
  useEffect(() => {
    try {
      const m = window.matchMedia(q)
      const f = () => setV(m.matches)
      m.addEventListener('change', f)
      return () => m.removeEventListener('change', f)
    } catch {
      return undefined
    }
  }, [q])
  return v
}

const NAO_SEPARADO = new Set(['bruto', 'naoIdentificado', 'preparando'])

/** modo do desconto (% ou valor): o último escolhido fica no aparelho */
const CHAVE_MODO_DESCONTO = 'tudo.caixa.modoDesconto'
function lerModoDesconto(): 'pct' | 'valor' {
  try {
    return localStorage.getItem(CHAVE_MODO_DESCONTO) === 'pct' ? 'pct' : 'valor'
  } catch {
    return 'valor'
  }
}
/** "2,5" → 2.5 (inválido → undefined) */
function lerPct(texto: string) {
  const s = texto.trim().replace('%', '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined
  return Number(s)
}
const pctTexto = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 2 })

/** moeda de cobrança: a última escolhida fica no aparelho */
const CHAVE_MOEDA_COBRANCA = 'tudo.caixa.moedaCobranca'
function lerMoedaCobranca() {
  try {
    return localStorage.getItem(CHAVE_MOEDA_COBRANCA) ?? ''
  } catch {
    return ''
  }
}
const lerCotacao = lerCotacaoTexto

/** foto do pacote (miniatura guardada) ou a medida no lugar; só mostra (o toque é de quem usa) */
function Miniatura({ item, tamanho = 'h-14 w-14' }: { item: Pick<Pacote, 'foto' | 'campos' | 'nome'>; tamanho?: string }) {
  const t = useT()
  const url = useUrlFoto(item.foto)
  return (
    <span className={cx('relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--fundo)]', !item.foto && 'border-dashed', tamanho)}>
      {item.foto ? (
        url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-[var(--borda)]" />
      ) : (
        <>
          <span className="num block font-black leading-none">{marcadorLote(item.campos, item.nome)}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[8px] font-semibold uppercase leading-none text-[var(--suave)]">{t('sem foto')}</span>
        </>
      )}
    </span>
  )
}

/** "P-0003 · Helena" (+2 quando vem de várias compras) */
function origemCurta(i: Pick<Pacote, 'compras' | 'fornecedor'>) {
  const c = i.compras?.[0]
  if (!c) return i.fornecedor
  return [c.codigo, c.fornecedor].filter(Boolean).join(' · ') + (i.compras.length > 1 ? ` +${i.compras.length - 1}` : '')
}

export function VendaRapida() {
  const t = useT()
  const { ir, sessao, nav, ajustarParams } = useApp()
  const { executar, ocupado } = useComando()
  const { cot } = useCotacoes('venda')
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: estoqueTodo } = useConsulta('estoque', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  // celular: cartões + barra embaixo; tablet: lista | total; desktop: tabela larga | total
  const { ref: raiz, w } = useLargura()
  // duas colunas só com espaço de verdade (abaixo de 900 px o total vai para a barra de baixo e nada é cortado)
  const tablet = w >= 900
  const larga = (tablet ? w - 360 : w) >= 640
  const toque = useMidia('(pointer: coarse)', false)

  const [vendaId, setVendaId] = useState(() => novoId())
  const [linhas, setLinhas] = useState<LinhaCaixa[]>([])
  const [busca, setBusca] = useState('')
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean; itemId?: Id }>()
  const [conferindo, setConferindo] = useState<Id>()
  const [mais, setMais] = useState(false)
  const [pessoaId, setPessoaId] = useState<Id>()
  const [colunaId, setColunaId] = useState<string>()
  const [desconto, setDesconto] = useState<number>()
  const [descontoPct, setDescontoPct] = useState('')
  const [modoDesconto, setModoDesconto] = useState<'pct' | 'valor'>(lerModoDesconto)
  const [moedaEscolhida, setMoedaEscolhida] = useState(lerMoedaCobranca)
  const [cotDigitadas, setCotDigitadas] = useState<Record<string, string>>({})
  const [obs, setObs] = useState('')
  const [editando, setEditando] = useState<Id>()
  const [pagando, setPagando] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [leitura, setLeitura] = useState(0)
  const [teclado, setTeclado] = useState(false)
  const [feita, setFeita] = useState<Feita>()
  const campo = useRef<HTMLInputElement>(null)
  const ultimaLida = useRef<{ c: string; em: number }>()
  useAvisoSaida(linhas.length > 0)

  const focar = useCallback(() => {
    setTimeout(() => campo.current?.focus({ preventScroll: true }), 0)
  }, [])
  useEffect(() => {
    focar()
  }, [focar])

  // só itens de módulos ativos com venda
  const modulosVenda = new Set((cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.temVenda).map((m) => m.id))
  // só "carregado" quando as duas consultas chegaram (com [] antes do estoque, o ?lote= da URL dava "Pacote não encontrado")
  const estoque = cfg && estoqueTodo ? estoqueTodo.filter((i) => modulosVenda.has(i.moduloId)) : undefined
  const porId = new Map((estoque ?? []).map((i) => [i.id, i]))
  const pessoa = pessoas?.find((x) => x.id === pessoaId)

  const tabelaDe = (i: Pacote): TabelaPreco | undefined => {
    const ts = (tabelas ?? []).filter((x) => x.moduloId === i.moduloId)
    const cat = String(i.campos.categoria || 'Normal')
    return ts.find((x) => (x.categoria ?? 'Normal') === cat) ?? ts.find((x) => !x.categoria) ?? ts[0]
  }
  const colunaDe = (tb: TabelaPreco) =>
    (colunaId && tb.colunas.some((c) => c.id === colunaId) ? colunaId : undefined) ?? tb.colunas.find((c) => c.pessoaId && c.pessoaId === pessoaId)?.id ?? tb.colunas[0]?.id

  /** mesma conta do Vender: gramas × fator da tabela (medida da linha que não passa da do lote, coluna da cliente) */
  const precoDe = (i: Pacote, q: number): Preco => {
    const c = i.codigo ?? i.nome
    if (i.unidade === 'grama') {
      const medida = Number(i.campos.comprimento)
      const tb = tabelaDe(i)
      if (!tb) return { moeda: moedaPadrao(), total: 0, erro: t('Sem tabela de preço para {c}.', { c }) }
      const col = colunaDe(tb)
      const f = col ? fatorDaTabela(tb, medida, col).fator : undefined
      if (!f || !col) return { moeda: tb.moeda, total: 0, erro: t('A tabela não tem preço para {m} cm: ajuste em Tabelas de preço.', { m: medida }) }
      return { moeda: tb.moeda, total: multiplicarFator(q, f, tb.moeda), calculo: { medida, fator: f.replace('.', ','), categoria: String(i.campos.categoria || 'Normal'), tabelaId: tb.id, colunaId: col } }
    }
    if (!i.precoSugerido) return { moeda: moedaPadrao(), total: 0, erro: t('{c} não tem preço no catálogo.', { c }) }
    return { moeda: i.precoSugerido.moeda, total: i.precoSugerido.valor * q }
  }

  const vistas = linhas
    .map((l) => {
      const item = porId.get(l.itemId)
      return item ? { ...l, item, preco: precoDe(item, l.quantidade) } : undefined
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
  const moedaVenda = vistas.find((l) => l.preco.calculo)?.preco.moeda ?? vistas[0]?.preco.moeda ?? cfg?.config.moedaPrincipal ?? moedaPadrao()
  const bruto = vistas.reduce((s, l) => s + (conv(l.preco.total, l.preco.moeda, moedaVenda, cot) ?? 0), 0)
  const baseDesconto = vistas.filter((l) => l.preco.moeda === moedaVenda).reduce((s, l) => s + l.preco.total, 0)
  // COBRAR EM: Bs, US$ ou R$ (a principal primeiro). Fora da principal, a cotação vem do sistema e pode ser digitada.
  const principal = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const moedasCobranca = [principal, ...(cfg?.config.moedasAtivas ?? []).filter((m) => m !== principal)]
  const mc = moedasCobranca.includes(moedaEscolhida) ? moedaEscolhida : principal
  const cotSistema = mc === principal ? undefined : valorDeUm(mc, principal, cot)
  const cotTexto = cotDigitadas[mc] ?? (cotSistema ? cotacaoTexto(cotSistema) : '')
  const cotValor = mc === principal ? undefined : lerCotacao(cotTexto)
  const cotValida = mc === principal || !!cotValor
  const cotacaoCobranca: Cotacao | undefined = cotValor ? { moeda: mc, valor: cotValor, sentido: 'basePorMoeda', contra: principal, data: '', uso: 'venda' } : undefined
  const cotTab = cotacaoCobranca ? { ...cot, [mc]: cotacaoCobranca } : cot
  /** cotações já digitadas (a de cobrança e as outras): sugeridas em cada pagamento do "Dividir pagamento" */
  const cotSugeridas: Record<string, string> = {}
  for (const [m, v] of Object.entries(cotDigitadas)) if (m !== principal && lerCotacao(v)) cotSugeridas[m] = lerCotacao(v)!
  if (cotValor) cotSugeridas[mc] = cotValor
  /** cotação que vale para um pagamento (fora da principal): a digitada nele, a sugerida ou a do sistema */
  const cotacaoDe = (x: PagamentoTela): Cotacao | undefined => {
    if (x.moeda === principal) return undefined
    const v = lerCotacao(textoCotacaoPagamento(x, principal, cot, cotSugeridas))
    return v ? cotacaoDigitada(x.moeda, v, principal) : undefined
  }
  const naCobranca = (v: number, de = moedaVenda) => (de === mc ? v : conv(v, de, mc, cotTab) ?? 0)
  const daCobranca = (v: number) => (mc === moedaVenda ? v : conv(v, mc, moedaVenda, cotTab) ?? 0)
  const escolherMoeda = (m: string) => {
    setMoedaEscolhida(m)
    setDesconto(undefined)
    try {
      localStorage.setItem(CHAVE_MOEDA_COBRANCA, m)
    } catch {
      /* sem armazenamento: só nesta tela */
    }
  }
  const pct = modoDesconto === 'pct' ? lerPct(descontoPct) : undefined
  const pctInvalido = modoDesconto === 'pct' && !!descontoPct.trim() && (pct === undefined || pct > 100)
  // desconto em valor: digitado na moeda de cobrança
  const descontoPedido = modoDesconto === 'pct' ? (pct !== undefined && pct <= 100 ? Math.round((baseDesconto * pct) / 100) : 0) : desconto ? daCobranca(desconto) : 0
  const descontoValido = descontoPedido > 0 && descontoPedido <= baseDesconto ? descontoPedido : 0
  /** "desconto 2,5% = Bs 878,50" ou "desconto Bs 500,00" (recibo e observação da venda) */
  const descontoCobranca = modoDesconto === 'valor' && desconto ? desconto : naCobranca(descontoValido)
  const descontoTexto = descontoValido ? (modoDesconto === 'pct' && pct !== undefined ? `${t('desconto')} ${pctTexto(pct)}% = ${formatar(descontoCobranca, mc)}` : `${t('desconto')} ${formatar(descontoCobranca, mc)}`) : ''
  const total = bruto - descontoValido
  /** total na moeda de cobrança (o que a pessoa paga) */
  const totalCobrado = naCobranca(total)
  const sm = moedaDe(mc).simbolo
  const textoCobranca = mc === principal ? '' : `${t('Cobrado em {m}', { m: sm })} · ${t('cotação')} 1 ${sm} = ${cotValor ?? '?'} ${moedaDe(principal).simbolo}`

  const avisar = (texto: string, ok: boolean, itemId?: Id) => {
    setAviso({ texto, ok, itemId })
    bipe(ok)
  }

  const adicionar = (i: Pacote) => {
    setBusca('')
    setTeclado(false)
    focar()
    const c = i.codigo ?? i.nome
    if (linhas.some((l) => l.itemId === i.id)) return avisar(t('{c} já está na venda.', { c }), false)
    if (i.saldo <= 0) return avisar(t('{c} está esgotado.', { c }), false)
    if (i.unidade === 'grama' && (NAO_SEPARADO.has(i.status) || !i.campos.comprimento)) return avisar(t('{c} ainda não está separado: separe na Triagem antes de vender.', { c }), false)
    const q = i.unidade === 'grama' ? i.saldo : 1
    const p = precoDe(i, q)
    if (p.erro) return avisar(p.erro, false)
    setLinhas((ls) => [...ls, { id: novoId(), itemId: i.id, quantidade: q }])
    setFeita(undefined)
    avisar(`✓ ${c} · ${i.unidade === 'grama' ? gramasTexto(q) : q} · ${formatar(p.total, p.moeda)}`, true, i.id)
  }
  const naoAchou = (texto: string) => {
    const achados = buscarPacotes(estoque, texto, 2)
    if (achados.length === 1) return adicionar(achados[0])
    avisar(t('Nenhum pacote com o código {c}.', { c: texto.trim() }), false)
  }
  const pistola = usePistola(estoque, (p) => adicionar(p), naoAchou)

  // #/venda-rapida?lote=<id> (botão "Vender" da página do pacote): o lote entra assim que estoque e tabelas chegam
  const loteUrl = typeof nav.params.lote === 'string' ? nav.params.lote : undefined
  const loteLido = useRef<string>()
  useEffect(() => {
    if (!loteUrl || !estoque || !tabelas || loteLido.current === loteUrl) return
    loteLido.current = loteUrl
    const p = porId.get(loteUrl)
    if (p) adicionar(p)
    else avisar(t('Pacote não encontrado.'), false)
    ajustarParams({ lote: undefined })
  })
  const achados = buscarPacotes(estoque, busca, 6)

  const remover = (id: Id) => {
    setLinhas((ls) => ls.filter((l) => l.id !== id))
    focar()
  }
  const abrirPagamento = () => {
    if (!vistas.length) return avisar(t('Passe um pacote primeiro.'), false)
    if (!cotValida) return avisar(t('Digite a cotação de {m}.', { m: moedaDe(mc).simbolo }), false)
    // o foco sai do campo de leitura: as teclas 1, 2, 3… escolhem a forma de pagamento
    campo.current?.blur()
    setBusca('')
    setPagando(true)
  }

  // Esc (sem janela aberta): limpa a busca ou tira o último item
  const algoAberto = pagando || !!editando || lendo || !!conferindo
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || algoAberto || document.querySelector('[role="dialog"], [role="tooltip"]')) return
      if (busca) return setBusca('')
      if (linhas.length) {
        setLinhas((ls) => ls.slice(0, -1))
        setAviso({ texto: t('Último item tirado.'), ok: true })
        focar()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [algoAberto, busca, linhas.length, focar, t])

  const textoRecibo = (pago: number) => {
    const ls = vistas.map((l) =>
      l.preco.calculo
        ? `${l.item.codigo ?? ''} ${l.preco.calculo.medida}${l.preco.calculo.categoria !== 'Normal' ? ' ' + t(l.preco.calculo.categoria) : ''} | ${l.quantidade.toLocaleString(loc())} × ${l.preco.calculo.fator} = ${formatar(l.preco.total, l.preco.moeda)}`.trim()
        : `${l.item.nome}: ${formatar(l.preco.total, l.preco.moeda)}`,
    )
    return [
      `*${cfg?.config.nomeNegocio ?? ''}*`,
      pessoa ? `${t('Cliente')}: ${pessoa.nome}` : '',
      ...ls,
      descontoTexto ? `${descontoTexto.charAt(0).toUpperCase()}${descontoTexto.slice(1)}` : '',
      `*${t('Total')}: ${formatar(totalCobrado, mc)}*`,
      mc !== moedaVenda ? `= ${formatar(total, moedaVenda)}` : '',
      textoCobranca,
      pago < totalCobrado - 1 ? `${t('Pago')}: ${formatar(pago, mc)}` : '',
      t('Obrigado pela compra!'),
    ]
      .filter(Boolean)
      .join('\n')
  }

  /** linhas para o concluirVenda: sempre com a conta da tabela (o desconto vai à parte e o serviço reparte) */
  const linhasEntrada = () => vistas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: l.quantidade, moeda: l.preco.moeda, total: l.preco.total, calculo: l.preco.calculo }))
  /** desconto da venda na moeda da tabela (em valor: o digitado na moeda de cobrança, convertido pela cotação digitada) */
  const descontoEntrada = () =>
    descontoValido
      ? { moeda: moedaVenda, ...(modoDesconto === 'pct' && pct !== undefined ? { pct } : { valor: descontoValido }), ...(mc !== moedaVenda ? { cobrado: descontoCobranca } : {}) }
      : undefined

  const pagar = async (pags: PagamentoTela[], troco?: number) => {
    const valendo = pags.filter((x) => x.valor)
    const semCotacao = valendo.find((x) => x.moeda !== principal && !cotacaoDe(x))
    if (semCotacao) return avisar(t('Digite a cotação de {m}.', { m: moedaDe(semCotacao.moeda).simbolo }), false)
    const r = await executar('concluirVenda', {
      id: vendaId,
      pessoaId,
      localId: sessao.localId,
      profissionalId: sessao.perfil === 'funcionario' ? sessao.pessoaId ?? sessao.usuarioId : undefined,
      linhas: linhasEntrada(),
      desconto: descontoEntrada(),
      // cada pagamento fora da moeda principal vai com a SUA cotação (a de cobrança, a digitada nele ou a sugerida)
      pagamentos: valendo.map((x) => {
        const c = cotacaoDe(x)
        return { id: x.id, forma: x.forma, moeda: x.moeda, valor: x.valor!, ...(c ? { cotacao: c } : {}) }
      }),
      cobranca: { moeda: mc, cotacao: cotacaoCobranca },
      obs: [obs.trim(), textoCobranca].filter(Boolean).join(' · ') || undefined,
    })
    if (!r) return bipe(false)
    const tabDe = (x: PagamentoTela): TabelaCotacoes => {
      const c = cotacaoDe(x)
      return c ? { ...cotTab, [x.moeda]: c } : cotTab
    }
    const pago = valendo.reduce((s, x) => s + (x.moeda === mc ? x.valor! : conv(x.valor!, x.moeda, mc, tabDe(x)) ?? 0), 0)
    setFeita({ id: r.id, total: totalCobrado, moeda: mc, totalPrincipal: mc !== moedaVenda ? total : undefined, moedaPrincipal: moedaVenda, troco, texto: textoRecibo(pago), telefone: pessoa?.telefone })
    bipe(true)
    // pronto para a próxima cliente
    setVendaId(novoId())
    setLinhas([])
    setPagando(false)
    setPessoaId(undefined)
    setColunaId(undefined)
    setDesconto(undefined)
    setDescontoPct('')
    setObs('')
    setMais(false)
    setAviso(undefined)
    focar()
  }

  const { dados: vendaFeita } = useConsulta('venda', { id: feita?.id ?? '' }, !!feita)
  const editandoLinha = vistas.find((l) => l.id === editando)
  const colunas = (tabelas ?? []).filter((x) => modulosVenda.has(x.moduloId))[0]?.colunas ?? []

  const campoBusca = (
    <div className="relative">
      <div className="mb-1 flex items-center text-sm font-semibold text-[var(--suave)]">
        <label htmlFor="caixa-busca">{t('Ler ou buscar pacote')}</label>
        <Info texto="Passe a pistola, leia o QR ou digite o código. Ex.: P4" />
      </div>
      <div className="flex gap-2">
        <input
          id="caixa-busca"
          ref={campo}
          type="search"
          aria-label={t('Ler ou buscar pacote')}
          placeholder={t('Código, código antigo ou rótulo')}
          inputMode={toque && !teclado ? 'none' : 'search'}
          enterKeyHint="go"
          value={busca}
          onPointerDown={() => {
            // celular: o teclado só abre quando a pessoa toca no campo (a pistola Bluetooth digita sem ele)
            if (toque && !teclado) {
              campo.current?.blur()
              setTeclado(true)
            }
          }}
          onChange={(e) => (setBusca(e.target.value), setAviso(undefined))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.currentTarget.value.trim()) {
              e.preventDefault()
              return abrirPagamento()
            }
            pistola.onKeyDown(e)
          }}
          spellCheck={false}
          autoComplete="off"
          className="min-h-14 w-full rounded-2xl border-2 border-[var(--marca)] bg-[var(--cartao)] px-4 font-mono text-xl outline-none focus:ring-2 focus:ring-[var(--marca)]"
        />
        <button type="button" aria-label={t('Ler código')} title={t('Ler código')} onClick={() => setLendo(true)} className="min-h-14 min-w-14 shrink-0 rounded-2xl bg-[var(--marca)] text-2xl text-white">
          📷
        </button>
      </div>
      {achados.length > 0 && (
        <ul className="absolute inset-x-0 z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-[var(--borda)] bg-[var(--cartao)] shadow-lg">
          {achados.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => adicionar(l)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--marca-suave)]">
                <span className="min-w-0 truncate"><b className="font-mono">{l.codigo ?? '—'}</b> · {l.nome}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {l.status !== 'disponivel' && l.status !== 'parcial' && <StatusBadge status={l.status} />}
                  <span className="num text-[var(--suave)]">{l.unidade === 'grama' ? gramasTexto(l.saldo) : l.saldo}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <p role="status" className={cx('mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold', aviso.ok ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--ruim)]/10 text-[var(--ruim)]')}>
          {aviso.itemId && porId.get(aviso.itemId) && <Miniatura item={porId.get(aviso.itemId)!} tamanho="h-12 w-12" />}
          <span>{aviso.texto}</span>
        </p>
      )}
    </div>
  )

  const ajudaLinha = <Info texto="Vendeu só uma parte? Toque e digite as gramas. Ex.: 500 g do P4" />
  type Vista = (typeof vistas)[number]
  const qtdTexto = (l: Vista) => (l.item.unidade === 'grama' ? `${l.quantidade.toLocaleString(loc())} g` : `${l.quantidade}`)
  const contaTexto = (l: Vista) => (l.preco.calculo ? `${qtdTexto(l)} × ${l.preco.calculo.fator}` : `${qtdTexto(l)} × ${formatar(l.item.precoSugerido?.valor ?? 0, l.preco.moeda)}`)
  const ficaTexto = (l: Vista) => {
    const resta = l.item.saldo - l.quantidade
    if (resta <= 0) return t('acaba o pacote')
    return t('fica no estoque: {v}', { v: l.item.unidade === 'grama' ? gramasTexto(resta) : resta })
  }
  const botaoTirar = (l: Vista) => (
    <button type="button" aria-label={t('Tirar {c}', { c: l.item.codigo ?? l.item.nome })} className="min-h-11 min-w-11 shrink-0 rounded-full text-xl text-[var(--ruim)] hover:bg-[var(--ruim)]/10" onClick={() => remover(l.id)}>
      ✕
    </button>
  )
  /** toque na foto/código: CONFERIR (sem sair da venda) */
  const botaoConferir = (l: Vista, grande?: boolean) => (
    <button type="button" aria-label={t('Conferir {c}', { c: l.item.codigo ?? l.item.nome })} title={t('Conferir o pacote')} onClick={() => setConferindo(l.item.id)} className="flex min-w-0 items-center gap-3 rounded-xl p-1 text-left hover:bg-[var(--marca-suave)]">
      <Miniatura item={l.item} tamanho={grande ? 'h-16 w-16' : 'h-14 w-14'} />
      <span className="min-w-0">
        <span className="block font-mono text-lg font-black leading-tight">{l.item.codigo ?? '—'} <span className="text-sm font-semibold text-[var(--marca)]">🔎</span></span>
        <span className="block truncate text-sm">{l.item.nome}</span>
        {origemCurta(l.item) && <span className="block truncate text-xs text-[var(--suave)]">{t('de')} {origemCurta(l.item)}</span>}
      </span>
    </button>
  )
  /** toque nas gramas: vender só uma parte */
  const botaoGramas = (l: Vista) => (
    <button type="button" aria-label={t('Mudar a quantidade de {c}', { c: l.item.codigo ?? l.item.nome })} onClick={() => setEditando(l.id)} className="num min-h-11 rounded-xl border border-dashed border-[var(--marca)] px-3 py-1 text-right font-semibold hover:bg-[var(--marca-suave)]">
      {contaTexto(l)}
      <span className={cx('block text-xs font-normal', l.item.saldo - l.quantidade <= 0 ? 'text-[var(--alerta)]' : 'text-[var(--suave)]')}>{ficaTexto(l)}</span>
    </button>
  )
  const dica = <span className="flex items-center text-xs text-[var(--suave)]">{t('Toque na foto para conferir o pacote · toque nas gramas para vender só uma parte.')} {ajudaLinha}</span>

  const lista = !vistas.length ? (
    <div className="rounded-2xl border-2 border-dashed border-[var(--borda)] p-8 text-center text-[var(--suave)]">
      <div className="text-4xl">🧾</div>
      <p className="mt-2 font-semibold">{t('Passe a pistola ou leia o QR do pacote.')}</p>
      <p className="text-sm">{t('O pacote entra inteiro com o preço da tabela.')}</p>
    </div>
  ) : larga ? (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--borda)] text-left text-xs uppercase text-[var(--suave)]">
            <th className="py-2 pr-2">{t('Pacote')}</th>
            <th className="py-2 pr-2 text-right"><span className="inline-flex items-center">{t('Quantidade')} {ajudaLinha}</span></th>
            <th className="py-2 pr-2 text-right">{t('Total')}</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {vistas.map((l) => (
            <tr key={l.id} className="border-b border-[var(--borda)]">
              <td className="max-w-0 py-2 pr-2">{botaoConferir(l)}</td>
              <td className="py-2 pr-2 text-right">{botaoGramas(l)}</td>
              <td className="num whitespace-nowrap py-2 pr-2 text-right text-base font-bold">{formatar(l.preco.total, l.preco.moeda)}</td>
              <td className="text-right">{botaoTirar(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2">{dica}</div>
    </>
  ) : (
    <ul className="space-y-2">
      {vistas.map((l) => (
        <li key={l.id} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-2 shadow-sm">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">{botaoConferir(l)}</div>
            {botaoTirar(l)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 pl-1">
            {botaoGramas(l)}
            <b className="num text-lg">{formatar(l.preco.total, l.preco.moeda)}</b>
          </div>
        </li>
      ))}
      <li>{dica}</li>
    </ul>
  )

  const painelMais = (
    <div>
      <button type="button" aria-expanded={mais} onClick={(e) => { const alvo = e.currentTarget; setMais(!mais); if (!mais) setTimeout(() => alvo.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0) }} className="min-h-10 text-sm font-semibold text-[var(--marca)]">
        {mais ? '− ' : '+ '}{t('mais (cliente, desconto, observação)')}
      </button>
      {mais && (
        <div className="mt-2 space-y-3">
          <SeletorPessoa rotulo="Cliente" valor={pessoaId} onChange={(id) => (setPessoaId(id), setColunaId(undefined))} opcional />
          {colunas.length > 1 && (
            <Campo rotulo="Coluna da tabela (comprador)" ajuda="Cada comprador tem seu preço. Se a pessoa estiver ligada a uma coluna, ela já vem escolhida.">
              <Selecao valor={colunaId} onChange={(v) => setColunaId(v || undefined)} vazio="Automática" opcoes={colunas.map((c) => ({ id: c.id, nome: c.nome }))} />
            </Campo>
          )}
          <Campo comoDiv rotulo="Desconto" ajuda="Em % ou em valor. Ex.: 5% de Bs 35.000 = Bs 1.750 · ou Bs 500 fixo.">
            <div className="flex gap-2">
              <div className="w-28 shrink-0">
                <Escolha
                  rotulo="Desconto"
                  valor={modoDesconto}
                  onChange={(m) => {
                    setModoDesconto(m)
                    try {
                      localStorage.setItem(CHAVE_MODO_DESCONTO, m)
                    } catch {
                      /* sem armazenamento: só nesta tela */
                    }
                  }}
                  opcoes={[{ id: 'pct', nome: '%' }, { id: 'valor', nome: sm }]}
                />
              </div>
              <div className="min-w-0 flex-1">
                {modoDesconto === 'pct' ? (
                  <div className="relative">
                    <Entrada inputMode="decimal" aria-label={t('Desconto em %')} placeholder="0" value={descontoPct} onChange={(e) => setDescontoPct(e.target.value)} className={cx('num pr-8', pctInvalido && 'border-[var(--ruim)]')} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--suave)]">%</span>
                  </div>
                ) : (
                  <ValorInput moeda={mc} valor={desconto} onChange={setDesconto} />
                )}
              </div>
            </div>
          </Campo>
          {modoDesconto === 'pct' && !!descontoValido && (
            <p className="num text-sm font-semibold text-[var(--bom)]">= {t('{v} de desconto · total {t}', { v: formatar(descontoCobranca, mc), t: formatar(totalCobrado, mc) })}</p>
          )}
          {pctInvalido && <p className="text-sm font-semibold text-[var(--ruim)]">{t('Desconto de 0 a 100%.')}</p>}
          {modoDesconto === 'valor' && !!desconto && !descontoValido && <p className="text-sm font-semibold text-[var(--ruim)]">{t('Desconto maior que o total.')}</p>}
          <Campo rotulo="Observação">
            <Entrada value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
        </div>
      )}
    </div>
  )

  /** COBRAR EM [ Bs | US$ | R$ ] + cotação ("1 R$ = [1,28] Bs") quando não é a principal */
  const cobrarEm = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm font-semibold text-[var(--suave)]">{t('Cobrar em')}</span>
        <div className="min-w-0 flex-1">
          <Escolha rotulo="Cobrar em" valor={mc} onChange={escolherMoeda} opcoes={moedasCobranca.map((m) => ({ id: m, nome: moedaDe(m).simbolo }))} />
        </div>
        <Info texto="Escolha a moeda de quem está comprando. Ex.: brasileira paga em R$ com cotação 1 R$ = 1,28 Bs." />
      </div>
      {mc !== principal && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span className="shrink-0">{t('Cotação')}: 1 {sm} =</span>
          <input
            inputMode="decimal"
            aria-label={t('Cotação de {m}', { m: sm })}
            value={cotTexto}
            onChange={(e) => setCotDigitadas((x) => ({ ...x, [mc]: e.target.value }))}
            className={cx('num min-h-10 w-24 rounded-xl border bg-[var(--cartao)] px-2 text-base outline-none focus:border-[var(--marca)]', cotValida ? 'border-[var(--borda)]' : 'border-[var(--ruim)]')}
          />
          <span className="shrink-0">{moedaDe(principal).simbolo}</span>
        </label>
      )}
      {!cotValida && <p className="text-sm font-semibold text-[var(--ruim)]">{t('Digite a cotação de {m}.', { m: sm })}</p>}
    </div>
  )
  const totalGrande = (cls: string) => (
    <>
      <div className={cx('num break-words font-black leading-tight', cls)}>{formatar(totalCobrado, mc)}</div>
      {mc !== moedaVenda && <div className="num text-sm text-[var(--suave)]">= {formatar(total, moedaVenda)}</div>}
    </>
  )

  const botaoFechar = (
    <Botao grande className="min-h-14 w-full text-lg" disabled={!vistas.length || ocupado || !cotValida} onClick={abrirPagamento}>
      {t('FECHAR')}
    </Botao>
  )

  return (
    <div ref={raiz} className="mx-auto max-w-7xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Botao variante="leve" onClick={() => ir('vender')}>← {t('Vender')}</Botao>
        <h1 className="text-xl font-bold">⚡ {t('Modo caixa')}</h1>
        {/* atalhos de teclado/pistola: só no computador (no celular é ruído) */}
        <span className="hidden text-sm text-[var(--suave)] md:inline">{t('Enter vazio = fechar · Esc = tirar o último')}</span>
      </div>

      {feita && (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--bom)] bg-[var(--bom)]/10 p-3">
          <span className="font-bold text-[var(--bom)]">
            {t('Venda')} {vendaFeita?.venda.codigo ?? ''} ✓ · <span className="num">{formatar(feita.total, feita.moeda)}</span>
            {feita.totalPrincipal !== undefined && <span className="num text-sm font-semibold"> (= {formatar(feita.totalPrincipal, feita.moedaPrincipal)})</span>}
            {!!feita.troco && <> · {t('troco')} <span className="num">{formatar(feita.troco, feita.moeda)}</span></>}
          </span>
          <span className="flex flex-wrap gap-2">
            <a className="inline-flex min-h-10 items-center rounded-xl bg-[#25d366] px-3 text-sm font-semibold text-white" href={linkWhatsApp(feita.texto, feita.telefone)} target="_blank" rel="noreferrer">
              {t('Recibo WhatsApp')}
            </a>
            <Botao variante="secundario" onClick={() => ir('venda', { id: feita.id })}>{t('Ver venda')}</Botao>
            <button type="button" aria-label={t('Fechar')} className="min-h-10 min-w-10 rounded-full text-lg" onClick={() => (setFeita(undefined), focar())}>×</button>
          </span>
        </div>
      )}

      <div className={cx('grid gap-4', tablet && 'grid-cols-[1fr_18rem] lg:grid-cols-[1fr_22rem]')}>
        <div className="min-w-0 space-y-3">
          <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">{campoBusca}</section>
          <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
            <h2 className="mb-2 text-base font-bold">{t('Nesta venda')} {vistas.length > 0 && <span className="text-[var(--suave)]">({vistas.length})</span>}</h2>
            {lista}
          </section>
          {/* celular: "Cobrar em" fica no conteúdo; a barra fixa leva só total + FECHAR (não cobre o "+ mais") */}
          {!tablet && <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">{cobrarEm}</section>}
          {!tablet && <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">{painelMais}</section>}
        </div>

        {tablet && (
          <aside className="h-fit space-y-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm md:sticky md:top-4">
            {cobrarEm}
            <div>
              <div className="font-semibold text-[var(--suave)]">{t('Total')} · {vistas.length}</div>
              {totalGrande('text-3xl')}
            </div>
            {!!descontoValido && <p className="num text-right text-sm text-[var(--suave)]">{formatar(naCobranca(bruto), mc)} − {formatar(descontoCobranca, mc)}</p>}
            <div className="flex items-center gap-1">
              <div className="flex-1">{botaoFechar}</div>
              <Info texto="Fecha a venda: escolha como pagou e pronto. O estoque baixa sozinho e a venda fica no histórico. Ex.: Enter com o campo vazio também fecha." />
            </div>
            {painelMais}
          </aside>
        )}
      </div>

      {!tablet && (
        // "+ mais" aberto: a barra deixa de flutuar e vem DEPOIS dos campos (empurrada para baixo, nada fica coberto)
        <div className={cx('z-20 mt-3 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] px-3 py-2 shadow-lg', mais ? 'relative' : 'sticky bottom-20 md:bottom-4')}>
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-xs text-[var(--suave)]">{t('Total')} · {vistas.length}</div>
              {totalGrande('text-xl')}
            </div>
            <Botao grande className="min-h-14 flex-1 text-lg" disabled={!vistas.length || ocupado || !cotValida} onClick={abrirPagamento}>{t('FECHAR')}</Botao>
          </div>
        </div>
      )}

      {lendo && (
        <LeitorCodigo
          key={leitura}
          abrirLote={false}
          onFechar={() => (setLendo(false), focar())}
          onLer={(c) => {
            const agora = Date.now()
            const repetida = ultimaLida.current?.c === c && agora - ultimaLida.current.em < 2500
            ultimaLida.current = { c, em: agora }
            if (!repetida) {
              const p = acharPorCodigo(estoque, c)
              if (p) adicionar(p)
              else avisar(t('Nenhum pacote com o código {c}.', { c }), false)
            }
            // celular: a câmera continua aberta para o próximo pacote; no computador fecha
            if (toque) setTimeout(() => setLeitura((n) => n + 1), repetida ? 1200 : 600)
            else (setLendo(false), focar())
          }}
        />
      )}

      {conferindo && porId.get(conferindo) && (
        <Conferir
          item={porId.get(conferindo)!}
          naVenda={linhas.find((l) => l.itemId === conferindo)?.quantidade}
          lateral={tablet}
          onFechar={() => (setConferindo(undefined), focar())}
        />
      )}

      {editandoLinha && (
        <EditarQuantidade
          key={editandoLinha.id}
          titulo={`${editandoLinha.item.codigo ?? ''} · ${editandoLinha.item.nome}`}
          grama={editandoLinha.item.unidade === 'grama'}
          valor={editandoLinha.quantidade}
          max={editandoLinha.item.saldo}
          onSalvar={(q) => {
            setLinhas((ls) => ls.map((x) => (x.id === editandoLinha.id ? { ...x, quantidade: q } : x)))
            setEditando(undefined)
            focar()
          }}
          onFechar={() => (setEditando(undefined), focar())}
        />
      )}

      {pagando && (
        <Pagamento
          total={totalCobrado}
          moeda={mc}
          cotacoes={cotSugeridas}
          comCliente={!!pessoaId}
          ocupado={ocupado}
          onPagar={pagar}
          onFechar={() => (setPagando(false), focar())}
        />
      )}
    </div>
  )
}

/** Gramas vendidas (venda de uma parte): número grande, Enter confirma. */
function EditarQuantidade({ titulo, grama, valor, max, onSalvar, onFechar }: { titulo: string; grama: boolean; valor: number; max: number; onSalvar(q: number): void; onFechar(): void }) {
  const t = useT()
  const [texto, setTexto] = useState(String(valor))
  const q = Number(texto.replace(/\D/g, ''))
  const erro = !q ? t('Digite a quantidade.') : q > max ? t('Só tem {v} neste pacote.', { v: grama ? gramasTexto(max) : max }) : undefined
  const salvar = () => !erro && onSalvar(q)
  return (
    <Janela
      aberta
      titulo={titulo}
      onFechar={onFechar}
      rodape={
        <div className="flex gap-2">
          <Botao variante="secundario" grande className="flex-1" onClick={() => onSalvar(max)}>{t('Tudo')} ({grama ? gramasTexto(max) : max})</Botao>
          <Botao grande className="flex-1" disabled={!!erro} onClick={salvar}>OK</Botao>
        </div>
      }
    >
      <div>
        <span className="mb-1 flex items-center text-sm font-semibold text-[var(--suave)]">
          {grama ? t('Quantas gramas vendeu?') : t('Quantidade')}
          <Info texto="Vendeu só uma parte? Toque e digite as gramas. Ex.: 500 g do P4" />
        </span>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            aria-label={grama ? t('Gramas') : t('Quantidade')}
            value={texto}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), salvar())}
            className="num min-h-16 w-full rounded-2xl border-2 border-[var(--marca)] bg-[var(--cartao)] px-4 text-4xl font-bold outline-none"
          />
          {grama && <span className="text-2xl font-bold text-[var(--suave)]">g</span>}
        </div>
      </div>
      <p className={cx('mt-2 text-sm', erro ? 'font-semibold text-[var(--ruim)]' : 'text-[var(--suave)]')}>{erro ?? `${t('Disponível')}: ${grama ? gramasTexto(max) : max}`}</p>
    </Janela>
  )
}

/** Pagamento num toque: botões grandes por forma; dinheiro pergunta o recebido e mostra o troco; dividir é opcional. */
function Pagamento({ total, moeda, cotacoes, comCliente, ocupado, onPagar, onFechar }: { total: number; moeda: string; cotacoes: Record<string, string>; comCliente: boolean; ocupado: boolean; onPagar(p: PagamentoTela[], troco?: number): void; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes('venda')
  const formas = (cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda))
  const [dinheiro, setDinheiro] = useState<string>()
  const [recebido, setRecebido] = useState<number>()
  const [dividir, setDividir] = useState(false)
  const [pags, setPags] = useState<PagamentoTela[]>([])
  const caixaRecebido = useRef<HTMLDivElement>(null)
  const grade = useRef<HTMLDivElement>(null)
  useEffect(() => {
    grade.current?.querySelector('button')?.focus()
  }, [formas.length])
  const troco = recebido !== undefined && recebido > total ? recebido - total : 0
  const falta = recebido !== undefined && recebido < total ? total - recebido : 0
  const podeDinheiro = !falta || comCliente

  const escolher = (id: string) => {
    if (ocupado) return
    const f = formas.find((x) => x.id === id)
    if (!f) return
    if (f.vivo) {
      setDinheiro(f.id)
      setRecebido(undefined)
      if (!ehToque()) setTimeout(() => caixaRecebido.current?.querySelector('input')?.focus(), 0)
      return
    }
    onPagar([{ id: novoId(), forma: f.id, moeda, valor: total }])
  }
  const confirmarDinheiro = () => {
    if (!dinheiro || ocupado || !podeDinheiro) return
    onPagar([{ id: novoId(), forma: dinheiro, moeda, valor: falta ? recebido : total }], troco || undefined)
  }
  // teclado: 1, 2, 3… escolhe a forma (fora de um campo); Enter confirma o dinheiro
  const ref = useRef({ escolher, confirmarDinheiro, formas, dividir })
  ref.current = { escolher, confirmarDinheiro, formas, dividir }
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (ref.current.dividir || alvo?.tagName === 'INPUT' || alvo?.tagName === 'SELECT' || alvo?.tagName === 'TEXTAREA') return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= ref.current.formas.length) {
        e.preventDefault()
        ref.current.escolher(ref.current.formas[n - 1].id)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // atalhos de dinheiro: exato e as próximas notas redondas
  const passo = 10 ** Math.max(0, String(Math.round(total / 100)).length - 1) * 100
  const redondos = [...new Set([Math.ceil(total / passo) * passo, Math.ceil(total / (passo * 5)) * passo * 5])].filter((v) => v > total).slice(0, 2)

  return (
    <Janela aberta titulo={t('Como pagou?')} onFechar={onFechar}>
      <div className="mb-3 text-center">
        <div className="text-sm text-[var(--suave)]">{t('Total')}</div>
        <div className="num text-4xl font-black">{formatar(total, moeda)}</div>
      </div>
      {!dividir ? (
        <>
          <div ref={grade} className="grid grid-cols-2 gap-2">
            {formas.map((f, i) => (
              <button
                key={f.id}
                type="button"
                disabled={ocupado}
                aria-pressed={dinheiro === f.id}
                onClick={() => escolher(f.id)}
                className={cx('min-h-16 rounded-2xl border-2 px-3 text-lg font-bold disabled:opacity-50', dinheiro === f.id ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}
              >
                <span className="mr-1 text-xs opacity-60">{i + 1}</span> {t(f.nome)}
              </button>
            ))}
          </div>
          {dinheiro && (
            <div className="mt-3 space-y-2 rounded-2xl bg-[var(--fundo)] p-3">
              <div ref={caixaRecebido} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmarDinheiro())}>
                <Campo rotulo="Recebido" ajuda="Quanto a cliente entregou. Ex.: total Bs 35.000, recebeu Bs 35.100 → troco Bs 100.">
                  <ValorInput moeda={moeda} valor={recebido} onChange={setRecebido} placeholder={formatar(total, moeda, { semSimbolo: true })} />
                </Campo>
              </div>
              <div className="flex flex-wrap gap-2">
                {redondos.map((v) => (
                  <Botao key={v} variante="secundario" onClick={() => setRecebido(v)}>{formatar(v, moeda)}</Botao>
                ))}
              </div>
              {troco > 0 && <p className="num text-2xl font-black text-[var(--bom)]">{t('Troco')}: {formatar(troco, moeda)}</p>}
              {falta > 0 && (
                <p className="text-sm font-semibold text-[var(--alerta)]">
                  {comCliente ? t('Faltam {v}: fica na conta da pessoa (fiado).', { v: formatar(falta, moeda) }) : t('Faltam {v}. Fiado só com cliente (em "+ mais").', { v: formatar(falta, moeda) })}
                </p>
              )}
              <Botao grande className="min-h-14 w-full text-lg" disabled={ocupado || !podeDinheiro} onClick={confirmarDinheiro}>
                {recebido === undefined || recebido === total ? t('Valor exato ✓') : t('Confirmar ✓')}
              </Botao>
            </div>
          )}
          <button type="button" className="mt-3 min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => (setDividir(true), setPags([{ id: novoId(), forma: formas[0]?.id ?? 'dinheiro', moeda, valor: total }]))}>
            {t('Dividir pagamento')}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {/* cada pagamento em outra moeda tem a sua cotação ("1 US$ = [6,96] Bs"), sugerida pela já digitada ou a do sistema */}
          <EditorPagamentos total={total} moedaTotal={moeda} pagamentos={pags} onChange={setPags} permiteFiado={comCliente} cotacaoEditavel cotacoesSugeridas={cotacoes} />
          <Botao grande className="min-h-14 w-full text-lg" disabled={ocupado} onClick={() => onPagar(pags)}>{t('Confirmar venda')}</Botao>
          <button type="button" className="min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => setDividir(false)}>← {t('Uma forma só')}</button>
        </div>
      )}
    </Janela>
  )
}

/** endereço do lote para abrir em OUTRA aba (a venda em andamento não se perde) */
function abrirLoteNovaAba(id: Id) {
  try {
    window.open(`${window.location.pathname}${window.location.search}#/lotes/${encodeURIComponent(id)}`, '_blank', 'noopener')
  } catch {
    /* navegador bloqueou: segue na venda */
  }
}

/**
 * CONFERIR o pacote sem sair da venda: foto grande (toque abre o visor), código, rótulo e situação, peso atual,
 * compras de origem em gramas e os últimos movimentos. Celular: folha que sobe; tablet/desktop: painel à direita.
 */
function Conferir({ item, naVenda, lateral, onFechar }: { item: Pacote; naVenda?: number; lateral: boolean; onFechar(): void }) {
  const t = useT()
  const [ver, setVer] = useState(false)
  const grama = item.unidade === 'grama'
  const { dados: origem } = useConsulta('origemDoPacote', { itemId: item.id, gramas: item.saldo }, grama && item.saldo > 0)
  const q = (n: number) => (grama ? gramasTexto(n) : String(n))
  useEffect(() => {
    if (!lateral) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]') && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [lateral, onFechar])
  const titulo = <span className="font-mono">{t('Conferir')} {item.codigo ?? ''}</span>
  const conteudo = (
    <div className="space-y-4">
      <button type="button" onClick={() => item.foto && setVer(true)} aria-label={t('Ver fotos')} className={cx('block w-full', !item.foto && 'cursor-default')}>
        <Miniatura item={item} tamanho="h-56 w-full text-3xl" />
      </button>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-3xl font-black">{item.codigo ?? '—'}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="text-base">{item.nome}</div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-[var(--fundo)] p-2">
          <dt className="text-[var(--suave)]">{t('Peso atual')}</dt>
          <dd className="num text-xl font-bold">{q(item.saldo)}</dd>
        </div>
        {naVenda !== undefined && (
          <div className="rounded-xl bg-[var(--fundo)] p-2">
            <dt className="text-[var(--suave)]">{t('Nesta venda')}</dt>
            <dd className="num text-xl font-bold">{q(naVenda)}</dd>
            <dd className="text-xs text-[var(--suave)]">{item.saldo - naVenda <= 0 ? t('acaba o pacote') : t('fica no estoque: {v}', { v: q(item.saldo - naVenda) })}</dd>
          </div>
        )}
      </dl>
      <section>
        <h3 className="mb-1 text-sm font-bold">{t('Compras de origem')}</h3>
        {grama && origem?.length ? (
          <ul className="space-y-1 text-sm">
            {origem.map((o) => (
              <li key={o.compraId} className="flex justify-between gap-2 rounded-lg border border-[var(--borda)] px-2 py-1">
                <span className="min-w-0 truncate"><b className="font-mono">{o.codigo ?? '—'}</b>{o.fornecedor ? ` · ${o.fornecedor}` : ''}</span>
                <span className="num shrink-0 font-semibold">{gramasTexto(o.gramas)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--suave)]">{origemCurta(item) ?? t('Sem compra ligada.')}</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold">{t('Histórico do pacote')}</h3>
        <HistoricoPacote id={item.id} />
      </section>
    </div>
  )
  const abrir = (
    <Botao variante="secundario" className="w-full" onClick={() => abrirLoteNovaAba(item.id)}>
      {t('Abrir página do lote ↗')}
    </Botao>
  )
  return (
    <>
      {lateral ? (
        <aside role="dialog" aria-label={t('Conferir o pacote')} className="fixed inset-y-0 right-0 z-40 flex w-[26rem] max-w-full flex-col border-l border-[var(--borda)] bg-[var(--cartao)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--borda)] px-4 py-3">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <button type="button" onClick={onFechar} aria-label={t('Fechar')} className="h-10 w-10 rounded-full text-xl hover:bg-[var(--marca-suave)]">×</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{conteudo}</div>
          <div className="border-t border-[var(--borda)] p-3">{abrir}</div>
        </aside>
      ) : (
        <Janela aberta titulo={titulo} onFechar={onFechar} rodape={abrir}>
          {conteudo}
        </Janela>
      )}
      {ver && <VisorFotos itemId={item.id} onFechar={() => setVer(false)} />}
    </>
  )
}
