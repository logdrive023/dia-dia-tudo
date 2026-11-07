// MODO CAIXA (venda rápida pela pistola/QR) — o ESTADO e as REGRAS: os pacotes lidos, o preço pela tabela, a moeda
// de cobrança e a cotação, o desconto, guardar/retomar a venda em aberto (sozinho, ao sair) e pagar. A tela
// (VendaRapida.tsx) só mostra e chama o que vem daqui.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAbaixoDoCusto } from '../../../shared/ui/abaixoDoCusto'
import { type Cotacao, type TabelaCotacoes, formatar, moeda as moedaDe, multiplicarFator, valorDeUm } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id, TabelaPreco } from '../../../core/domain/tipos'
import { fatorDaTabela } from '../../../core/services/precos'
import { gramasTexto, loc, moedaPadrao } from '../../../shared/ui/base'
import { reservado } from '../../../shared/ui/reserva'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { type PagamentoTela, conv, cotacaoDigitada, cotacaoTexto, textoCotacaoPagamento, useCotacoes } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'
import { buscarPacotes, usePistola } from '../../../shared/ui/leitorPistola'
import { type Feita, type LinhaCaixa, type Pacote, type Preco, CHAVE_MOEDA_COBRANCA, NAO_SEPARADO, bipe, prepararBipe, lerCotacao, lerModoDesconto, lerMoedaCobranca, lerPct, pctTexto, useLargura, useMidia } from '../components/pecas'

export function useModoCaixa() {
  const t = useT()
  const { ir, sessao, nav, ajustarParams } = useApp()
  const { executar, ocupado } = useComando()
  const { executar: executarCfg } = useComando()
  const { cot } = useCotacoes('venda')
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: estoqueTodo } = useConsulta('estoque', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', {})
  const { dados: versoesTab } = useConsulta('versoesEmUso', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const { dados: abertas } = useConsulta('vendasAbertas', {})
  const { ref: raiz, w } = useLargura()
  // duas colunas só com espaço de verdade (abaixo de 900 px o total vai para a barra de baixo e nada é cortado)
  const tablet = w >= 900
  const toque = useMidia('(pointer: coarse)', false)

  const [vendaId, setVendaId] = useState(() => novoId())
  const [linhas, setLinhas] = useState<LinhaCaixa[]>([])
  const [busca, setBusca] = useState('')
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean | 'alerta'; itemId?: Id }>()
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
  const [teclado, setTeclado] = useState(false)
  const [feita, setFeita] = useState<Feita>()
  /** o pacote lido está noutra venda EM ABERTO: pergunta antes de tirar de lá */
  const [deOutraAberta, setDeOutraAberta] = useState<{ p: Pacote; abertaId: Id; quem: string }>()
  /** a venda atual já foi guardada em aberto (o caixa salva sozinho) */
  const [guardada, setGuardada] = useState<string>()
  /** leu um pacote que já deu baixa: o servidor diz para onde foi (JaSaiu) */
  const [jaSaiu, setJaSaiu] = useState<string>()
  const [vendedorId, setVendedorId] = useState<Id | undefined>(sessao.perfil === 'funcionario' ? sessao.pessoaId ?? sessao.usuarioId : undefined)
  const [localId, setLocalId] = useState<Id | undefined>(sessao.localId)
  const campo = useRef<HTMLInputElement>(null)

  // com o LEITOR aberto (contínuo) a venda não puxa o cursor para a busca: o foco fica no leitor
  const lendoRef = useRef(false)
  lendoRef.current = lendo
  const focar = useCallback(() => {
    setTimeout(() => !lendoRef.current && campo.current?.focus({ preventScroll: true }), 0)
  }, [])
  useEffect(() => {
    focar()
    // o áudio do bipe nasce agora, ocioso — nunca dentro do toque que põe o pacote na venda (travava ~0,2 s)
    prepararBipe()
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
  /** a coluna PADRÃO: a ligada à cliente (se tiver) ou a primeira da tabela */
  const padraoDe = (tb: TabelaPreco) => tb.colunas.find((c) => c.pessoaId && c.pessoaId === pessoaId)?.id ?? tb.colunas[0]?.id
  const colunaDe = (tb: TabelaPreco, forcada?: string) => {
    const escolhida = forcada ?? colunaId
    return (escolhida && tb.colunas.some((c) => c.id === escolhida) ? escolhida : undefined) ?? padraoDe(tb)
  }

  /** mesma conta do Vender: gramas × fator da tabela (medida da linha que não passa da do lote, coluna da cliente) */
  const precoDe = (i: Pacote, q: number, forcada?: string): Preco => {
    const c = i.codigo ?? i.nome
    if (i.unidade === 'grama') {
      const medida = Number(i.campos.comprimento)
      const tb = tabelaDe(i)
      if (!tb) return { moeda: moedaPadrao(), total: 0, erro: t('Sem tabela de preço para {c}.', { c }) }
      const col = colunaDe(tb, forcada)
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
      return item ? { ...l, item, preco: l.precoManual !== undefined ? { moeda: cfg?.config.moedaPrincipal ?? moedaPadrao(), total: l.precoManual } as Preco : precoDe(item, l.quantidade) } : undefined
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
  const moedaVenda = vistas.find((l) => l.preco.calculo)?.preco.moeda ?? vistas[0]?.preco.moeda ?? cfg?.config.moedaPrincipal ?? moedaPadrao()
  // ESCOLHA DO PREÇO: a tabela dos pacotes (a do primeiro pacote por grama) e, para cada coluna dela, o total da venda
  const comTabela = vistas.filter((l) => l.item.unidade === 'grama')
  const tbVenda = comTabela[0] ? tabelaDe(comTabela[0].item) : undefined
  const opcoesPreco = !tbVenda ? [] : tbVenda.colunas.map((c) => {
    let total = 0
    let semPreco = 0
    for (const l of vistas) {
      const pr = l.precoManual !== undefined ? l.preco : precoDe(l.item, l.quantidade, c.id)
      if (pr.erro) semPreco++
      else total += conv(pr.total, pr.moeda, moedaVenda, cot) ?? 0
    }
    return { id: c.id, nome: c.nome, total: semPreco === vistas.length ? undefined : total, semPreco }
  })
  const padraoVenda = tbVenda ? padraoDe(tbVenda) : undefined
  const clienteTemColuna = !!tbVenda?.colunas.some((c) => c.pessoaId && c.pessoaId === pessoaId)
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
  // ABAIXO DO CUSTO: o preço de cada linha já com a parte dela do desconto (a venda inteira, não só a lista)
  const fatorDesconto = bruto > 0 ? total / bruto : 1
  const custo = useAbaixoDoCusto(vistas.filter((l) => !l.preco.erro).map((l) => ({ itemId: l.item.id, quantidade: l.quantidade, total: Math.round(l.preco.total * fatorDesconto), moeda: l.preco.moeda })))
  const [custoConfirmado, setCustoConfirmado] = useState('')
  const [perguntarCusto, setPerguntarCusto] = useState(false)
  const sm = moedaDe(mc).simbolo
  const textoCobranca = mc === principal ? '' : `${t('Cobrado em {m}', { m: sm })} · ${t('cotação')} 1 ${sm} = ${cotValor ?? '?'} ${moedaDe(principal).simbolo}`

  const avisar = (texto: string, ok: boolean | 'alerta', itemId?: Id) => {
    setAviso({ texto, ok, itemId })
    bipe(ok !== false)
  }

  const adicionar = (i: Pacote, jaConfirmou = false) => {
    const outra = !jaConfirmou ? abertas?.find((a) => a.id !== vendaId && a.linhas.some((l) => l.itemId === i.id)) : undefined
    if (outra) {
      setBusca('')
      bipe(false)
      return setDeOutraAberta({ p: i, abertaId: outra.id, quem: [outra.cliente ?? t('sem cliente'), outra.porNome && t('guardada por {p}', { p: outra.porNome })].filter(Boolean).join(' · ') })
    }
    setBusca('')
    setTeclado(false)
    focar()
    const c = i.codigo ?? i.nome
    if (linhas.some((l) => l.itemId === i.id)) return avisar(t('{c} já está na venda.', { c }), false)
    if (i.saldo <= 0) return (setJaSaiu(i.codigo ?? i.id), setAviso(undefined), bipe(false))
    setJaSaiu(undefined)
    const q = i.unidade === 'grama' ? i.saldo : 1
    const p = precoDe(i, q)
    setLinhas((ls) => [...ls, { id: novoId(), itemId: i.id, quantidade: q }])
    setFeita(undefined)
    // NUNCA trava: bruto, reservado ou sem preço entram; o aviso diz o que é e o que fazer (nada quebra)
    const notas = [
      i.unidade === 'grama' && NAO_SEPARADO.has(i.status) && cfg?.config.avisarVendaBruto !== false && t('ainda está bruto (não passou pela triagem) — tudo bem vender assim'),
      reservado(i) && t('estava reservado para {p} — tudo bem vender para outra pessoa: a reserva sai sozinha e fica anotada no histórico', { p: i.reserva!.para }),
      p.erro && t('digite o preço na linha'),
    ].filter(Boolean)
    if (notas.length) return avisar(`${c} · ${i.unidade === 'grama' ? gramasTexto(q) : q}: ${notas.join(' · ')}`, 'alerta', i.id)
    avisar(`✓ ${c} · ${i.unidade === 'grama' ? gramasTexto(q) : q} · ${formatar(p.total, p.moeda)}`, true, i.id)
  }
  const naoAchou = (texto: string) => {
    const achados = buscarPacotes(estoque, texto, 2)
    if (achados.length === 1) return adicionar(achados[0])
    // não está no estoque à venda: o servidor diz se já saiu (e para onde) ou se não existe
    setJaSaiu(texto.trim())
    bipe(false)
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

  const remover = (id: Id) => {
    setLinhas((ls) => ls.filter((l) => l.id !== id))
    focar()
  }
  /** custoOk === true: a pessoa já confirmou vender abaixo do custo (não pergunta de novo) */
  const abrirPagamento = (custoOk?: unknown) => {
    if (!vistas.length) return avisar(t('Passe um pacote primeiro.'), false)
    // o estoque mudou depois que entrou (outro aparelho vendeu): não deixa cobrar o que não há
    const sem = vistas.find((l) => l.quantidade > l.item.saldo)
    if (sem) return avisar(`${sem.item.codigo ?? sem.item.nome}: ${sem.item.saldo <= 0 ? t('já saiu do estoque') : t('só tem {v} agora', { v: sem.item.unidade === 'grama' ? gramasTexto(sem.item.saldo) : sem.item.saldo })}`, false, sem.item.id)
    if (!cotValida) return avisar(t('Digite a cotação de {m}.', { m: moedaDe(mc).simbolo }), false)
    // abaixo do custo: pergunta uma vez (para esta combinação de pacotes); confirmando, segue para o pagamento
    if (custo.abaixo.length && custoConfirmado !== custo.chave && custoOk !== true) return setPerguntarCusto(true)
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

  // ---------- VENDA EM ABERTO: guarda sozinha (o servidor decide; aqui só manda o que está na tela) ----------
  const { backend } = useApp()
  const rascunho = () => ({
    id: vendaId,
    linhas: linhas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: l.quantidade, ...(l.precoManual !== undefined ? { precoManual: l.precoManual } : {}) })),
    pessoaId, colunaId, vendedorId, localId, obs: obs.trim() || undefined,
    desconto: { modo: modoDesconto, pct: descontoPct || undefined, valor: desconto },
    moeda: mc, total: totalCobrado, moedaTotal: mc,
  })
  const atual = useRef(rascunho)
  atual.current = rascunho
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const fechando = useRef(false)
  const guardar = useCallback(async () => {
    if (fechando.current) return
    const r = atual.current()
    try {
      await backend.comando('salvarVendaAberta', r)
      setGuardada(r.linhas.length ? new Date().toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }) : undefined)
    } catch {
      /* sem guardar agora: tenta de novo na próxima mudança */
    }
  }, [backend])
  const chaveRascunho = JSON.stringify(rascunho())
  const tinhaLinhas = useRef(false)
  useEffect(() => {
    if (!linhas.length && !tinhaLinhas.current) return
    tinhaLinhas.current = linhas.length > 0
    clearTimeout(timer.current)
    timer.current = setTimeout(guardar, 1000)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveRascunho])
  // saiu da tela no meio da venda: guarda NA HORA (nada de "sair sem salvar")
  useEffect(() => () => { clearTimeout(timer.current); if (atual.current().linhas.length) void guardar() }, [guardar])
  // retomar: #/venda-rapida?aberta=<id> (da lista "Em aberto" ou do aviso aqui em cima)
  const abertaUrl = typeof nav.params.aberta === 'string' ? nav.params.aberta : undefined
  const retomada = useRef<string>()
  const retomar = (id: string) => {
    const a = abertas?.find((x) => x.id === id)
    if (!a) return
    retomada.current = id
    const v = a.venda
    setVendaId(a.id)
    setLinhas(v.linhas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: l.quantidade, ...(l.precoManual !== undefined ? { precoManual: l.precoManual } : {}) })))
    setPessoaId(v.pessoaId)
    setColunaId(v.colunaId)
    setVendedorId(v.vendedorId)
    setLocalId(v.localId)
    setObs(v.obs ?? '')
    if (v.desconto) { setModoDesconto(v.desconto.modo); setDescontoPct(v.desconto.pct ?? ''); setDesconto(v.desconto.valor) }
    if (v.moeda) setMoedaEscolhida(v.moeda)
    setFeita(undefined)
    // o que estava digitado na busca sai (senão a lista de pacotes abre por cima da venda retomada)
    setBusca('')
    setAviso({ texto: t('Venda em aberto retomada: {n} pacote(s).', { n: v.linhas.length }), ok: true })
    ajustarParams({ aberta: undefined })
    focar()
  }
  useEffect(() => {
    if (abertaUrl && abertas && retomada.current !== abertaUrl) retomar(abertaUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertaUrl, abertas])
  const outrasAbertas = (abertas ?? []).filter((a) => a.id !== vendaId)

  const pagar = async (pags: PagamentoTela[], troco?: number) => {
    const semPreco = vistas.find((l) => l.preco.erro)
    if (semPreco) return avisar(t('Digite o preço de {c}.', { c: semPreco.item.codigo ?? semPreco.item.nome }), false, semPreco.item.id)
    const valendo = pags.filter((x) => x.valor)
    const semCotacao = valendo.find((x) => x.moeda !== principal && !cotacaoDe(x))
    if (semCotacao) return avisar(t('Digite a cotação de {m}.', { m: moedaDe(semCotacao.moeda).simbolo }), false)
    clearTimeout(timer.current)
    fechando.current = true
    const r = await executar('concluirVenda', {
      id: vendaId,
      pessoaId,
      localId,
      profissionalId: vendedorId,
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
    fechando.current = false
    if (!r) return bipe(false)
    tinhaLinhas.current = false
    setGuardada(undefined)
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

  // ---------- as peças conversam por aqui: a tela guarda o estado da venda e cada peça só mostra e avisa ----------
  const vendedores = sessao.perfil === 'admin' ? (pessoas ?? []).filter((x) => x.papeis.some((pp) => pp === 'funcionario' || pp === 'profissional')).map((x) => ({ id: x.id, nome: x.nome })) : undefined
  const listaLocais = (locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))
  const resumoOpcoes = [
    pessoa && `👤 ${pessoa.nome}`,
    vendedorId && `🧑 ${(pessoas ?? []).find((x) => x.id === vendedorId)?.nome ?? ''}`,
    localId && localId !== sessao.localId && `🏪 ${listaLocais.find((l) => l.id === localId)?.nome ?? ''}`,
  ].filter((x): x is string => !!x)
  return { t, ir, sessao, nav, ajustarParams, executar, ocupado, executarCfg, cot, cfg, estoqueTodo, tabelas, versoesTab, pessoas, locais, abertas, raiz, w, tablet, toque, vendaId, setVendaId, linhas, setLinhas, busca, setBusca, aviso, setAviso, conferindo, setConferindo, mais, setMais, pessoaId, setPessoaId, colunaId, setColunaId, desconto, setDesconto, descontoPct, setDescontoPct, modoDesconto, setModoDesconto, moedaEscolhida, setMoedaEscolhida, cotDigitadas, setCotDigitadas, obs, setObs, editando, setEditando, pagando, setPagando, lendo, setLendo, teclado, setTeclado, feita, setFeita, deOutraAberta, setDeOutraAberta, guardada, setGuardada, jaSaiu, setJaSaiu, vendedorId, setVendedorId, localId, setLocalId, campo, lendoRef, focar, modulosVenda, estoque, porId, pessoa, tabelaDe, padraoDe, colunaDe, precoDe, vistas, moedaVenda, comTabela, tbVenda, opcoesPreco, padraoVenda, clienteTemColuna, bruto, baseDesconto, principal, moedasCobranca, mc, cotSistema, cotTexto, cotValor, cotValida, cotacaoCobranca, cotTab, cotSugeridas, cotacaoDe, naCobranca, daCobranca, escolherMoeda, pct, pctInvalido, descontoPedido, descontoValido, descontoCobranca, descontoTexto, total, totalCobrado, fatorDesconto, custo, custoConfirmado, setCustoConfirmado, perguntarCusto, setPerguntarCusto, sm, textoCobranca, avisar, adicionar, naoAchou, pistola, loteUrl, loteLido, remover, abrirPagamento, algoAberto, textoRecibo, linhasEntrada, descontoEntrada, backend, rascunho, atual, timer, fechando, guardar, chaveRascunho, tinhaLinhas, abertaUrl, retomada, retomar, outrasAbertas, pagar, vendaFeita, editandoLinha, vendedores, listaLocais, resumoOpcoes }
}

/** tudo o que o modo caixa sabe e faz (o resultado do useModoCaixa) */
export type EstadoModoCaixa = ReturnType<typeof useModoCaixa>
