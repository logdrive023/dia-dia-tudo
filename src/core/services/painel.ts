// PAINEL: resumo geral + painel de cada módulo (o próprio módulo descreve o seu) + alertas.
// Cada número leva à lista que o forma (detalhe) e a soma dessa lista é o número (testado).

import { MOEDAS, converter } from '../domain/dinheiro'
import { diasEntre, listaDeDias, somarDias } from '../domain/datas'
import type { Id, Transacao } from '../domain/tipos'
import type { Cartao, DadosPainel, Secao } from '../modulos'
import { type Ctx, cotacoesAtuais, lerConfig } from './contexto'
import { situacaoDe } from './emprestimos'
import { filaTriagem } from './compras'
import { recortarVenda, valorEm } from './vendas'

export interface FiltrosPainel {
  de: string
  ate: string
  comparar?: boolean
  /** 'convertido' (moeda principal) ou um código de moeda */
  moeda?: string
  area?: string
  localId?: Id
  profissionalId?: Id
}

export async function carregarDados(ctx: Ctx, f: FiltrosPainel): Promise<DadosPainel> {
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx)
  const itens = await ctx.repos.itens.listar()
  const modDoItem = new Map(itens.map((i) => [i.id, i.moduloId]))
  const todas = await ctx.repos.transacoes.listar()
  const filtrarLinhas = (t: Transacao): Transacao | null => {
    if (f.localId && t.localId !== f.localId) return null
    return recortarVenda(t, { moduloId: f.area, profissionalId: f.profissionalId }, (id) => modDoItem.get(id))
  }
  const noPeriodo = (t: Transacao) => t.data >= f.de && t.data <= f.ate
  const vendas = todas.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && noPeriodo(t)).map(filtrarLinhas).filter((t): t is Transacao => !!t)
  const compras = todas.filter((t) => t.tipo === 'compra' && t.etapa === 'concluido' && noPeriodo(t) && (!f.area || t.moduloId === f.area))
  return {
    de: f.de,
    ate: f.ate,
    hoje: ctx.relogio.hoje(),
    moedaPrincipal: cfg.moedaPrincipal,
    vendas,
    compras,
    todasTransacoes: todas,
    itens,
    movEstoque: await ctx.repos.movEstoque.listar(),
    pessoas: new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p])),
    emprestimos: await ctx.repos.emprestimos.listar(),
    movDivida: await ctx.repos.movDivida.listar(),
    moduloDoItem: (id) => (id ? modDoItem.get(id) : undefined),
    paraPrincipal: (valor, moeda) => {
      try {
        return converter(valor, moeda, cfg.moedaPrincipal, cot)
      } catch {
        return 0
      }
    },
    localId: f.localId,
    profissionalId: f.profissionalId,
  }
}

function lucroDe(t: Transacao) {
  return t.linhas.reduce((s, l) => s + l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0), 0)
}

function resumo(d: DadosPainel, moeda?: string) {
  const vendas = moeda && moeda !== 'convertido' ? d.vendas.filter((t) => t.pagamentos.some((p) => p.moeda === moeda)) : d.vendas
  const faturamento = vendas.reduce((s, t) => s + valorEm(t, moeda), 0)
  const lucro = d.vendas.reduce((s, t) => s + lucroDe(t), 0)
  const fatConv = d.vendas.reduce((s, t) => s + t.totalPrincipal, 0)
  return {
    faturamento,
    lucro,
    margem: fatConv ? Math.round((lucro / fatConv) * 10000) : 0,
    compras: d.compras.reduce((s, t) => s + (moeda && moeda !== 'convertido' ? t.pagamentos.filter((p) => p.moeda === moeda).reduce((x, p) => x + p.valor, 0) : t.totalPrincipal), 0),
    nVendas: vendas.length,
    ticket: vendas.length ? Math.round(faturamento / vendas.length) : 0,
    atendimentos: d.vendas.filter((t) => t.agendadoPara).length,
  }
}

/** Painel geral: cartões, série por dia, divisões e alertas. */
export async function painel(ctx: Ctx, f: FiltrosPainel) {
  const cfg = await lerConfig(ctx)
  const moedaVis = f.moeda && f.moeda !== 'convertido' ? f.moeda : cfg.moedaPrincipal
  const d = await carregarDados(ctx, f)
  const r = resumo(d, f.moeda)
  let ant: ReturnType<typeof resumo> | undefined
  const dias = diasEntre(f.de, f.ate) + 1
  const antDe = somarDias(f.de, -dias)
  const antAte = somarDias(f.de, -1)
  if (f.comparar) ant = resumo(await carregarDados(ctx, { ...f, de: antDe, ate: antAte }), f.moeda)

  // caixa agora e a receber / a pagar (não dependem do período)
  const movCaixa = await ctx.repos.movCaixa.listar()
  const vivo = new Set(cfg.formas.filter((x) => x.vivo).map((x) => x.id))
  const caixa = MOEDAS.map((m) => {
    const ms = movCaixa.filter((x) => x.moeda === m.codigo)
    const total = ms.reduce((s, x) => s + x.delta, 0)
    const mao = ms.filter((x) => vivo.has(x.forma)).reduce((s, x) => s + x.delta, 0)
    return { moeda: m.codigo, total, mao, banco: total - mao, tem: ms.length > 0 }
  }).filter((c) => c.tem)
  const cot = await cotacoesAtuais(ctx)
  const conv = (v: number, m: string) => {
    try {
      return converter(v, m, moedaVis, cot)
    } catch {
      return 0
    }
  }
  let aReceber = 0
  let aPagar = 0
  let atrasado = 0
  for (const e of d.emprestimos.filter((x) => x.situacao === 'aberto')) {
    const s = await situacaoDe(ctx, e)
    if (e.direcao === 'dado') {
      aReceber += conv(s.saldo, e.moeda)
      atrasado += conv(s.atrasado, e.moeda)
    } else aPagar += conv(s.saldo, e.moeda)
  }
  const caixaTotal = caixa.reduce((s, c) => s + (f.moeda && f.moeda !== 'convertido' ? (c.moeda === f.moeda ? c.total : 0) : conv(c.total, c.moeda)), 0)

  const filtroLista = { de: f.de, ate: f.ate, moduloId: f.area, localId: f.localId, profissionalId: f.profissionalId, moeda: f.moeda === 'convertido' ? undefined : f.moeda }
  const cartoes: Cartao[] = [
    { id: 'faturamento', nome: 'Faturamento', valor: r.faturamento, anterior: ant?.faturamento, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Soma das vendas concluídas no período. Ex.: 2 vendas de Bs 300 = Bs 600.', detalhe: { tela: 'vendas', filtro: filtroLista } },
    { id: 'lucro', nome: 'Lucro bruto', valor: r.lucro, anterior: ant?.lucro, formato: 'dinheiro', moeda: cfg.moedaPrincipal, ajuda: 'Vendas − custo do cabelo que saiu − comissões. Ex.: vendeu 100 g por Bs 400 que custaram Bs 250 → Bs 150.', detalhe: { tela: 'vendas', filtro: filtroLista }, destaque: r.lucro < 0 ? 'ruim' : 'bom' },
    { id: 'margem', nome: 'Margem', valor: r.margem, anterior: ant?.margem, formato: 'percentual', ajuda: 'Lucro ÷ faturamento. Ex.: lucro Bs 150 em Bs 400 = 37,5%.', detalhe: { tela: 'vendas', filtro: filtroLista } },
    { id: 'compras', nome: 'Compras', valor: r.compras, anterior: ant?.compras, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Compras concluídas (que entraram no estoque) no período.', detalhe: { tela: 'comprar', filtro: { encerradas: true } } },
    { id: 'vendas', nome: 'Vendas', valor: r.nVendas, anterior: ant?.nVendas, formato: 'numero', ajuda: 'Quantas vendas e atendimentos concluídos.', detalhe: { tela: 'vendas', filtro: filtroLista } },
    { id: 'ticket', nome: 'Ticket médio', valor: r.ticket, anterior: ant?.ticket, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Faturamento ÷ número de vendas. Ex.: Bs 900 em 3 vendas = Bs 300.', detalhe: { tela: 'vendas', filtro: filtroLista } },
    { id: 'caixa', nome: 'Caixa agora', valor: caixaTotal, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Todo o dinheiro (na mão + no banco), de todas as moedas convertidas pela cotação de hoje.', detalhe: { tela: 'caixa' } },
    { id: 'receber', nome: 'A receber', valor: aReceber, formato: 'dinheiro', moeda: moedaVis, ajuda: 'O que falta receber dos empréstimos que você deu (parcelas em aberto).', detalhe: { tela: 'emprestimos', filtro: { direcao: 'dado' } }, destaque: atrasado ? 'alerta' : undefined },
    { id: 'pagar', nome: 'A pagar', valor: aPagar, formato: 'dinheiro', moeda: moedaVis, ajuda: 'O que falta pagar dos empréstimos que você pegou.', detalhe: { tela: 'emprestimos', filtro: { direcao: 'tomado' } } },
  ]

  // série por dia
  const diasLista = listaDeDias(f.de, f.ate)
  const serie = diasLista.map((dia) => {
    const doDia = d.vendas.filter((t) => t.data === dia)
    return { data: dia, faturamento: doDia.reduce((s, t) => s + valorEm(t, f.moeda), 0), lucro: doDia.reduce((s, t) => s + lucroDe(t), 0) }
  })
  let serieAnterior: number[] | undefined
  if (f.comparar) {
    const da = await carregarDados(ctx, { ...f, de: antDe, ate: antAte })
    serieAnterior = listaDeDias(antDe, antAte).map((dia) => da.vendas.filter((t) => t.data === dia).reduce((s, t) => s + valorEm(t, f.moeda), 0))
  }

  // por área (cada linha conta para o módulo do seu item)
  const porAreaMapa = new Map<string, number>()
  for (const t of d.vendas)
    for (const l of t.linhas) {
      const m = d.moduloDoItem(l.itemId) ?? t.moduloId
      porAreaMapa.set(m, (porAreaMapa.get(m) ?? 0) + l.totalPrincipal)
    }
  const porArea = [...porAreaMapa].map(([id, valor]) => ({ id, nome: ctx.modulos.tem(id) ? ctx.modulos.obter(id).nome : id, icone: ctx.modulos.tem(id) ? ctx.modulos.obter(id).icone : '', valor })).sort((a, b) => b.valor - a.valor)

  const formasMapa = new Map<string, number>()
  const moedasMapa = new Map<string, { valor: number; principal: number }>()
  for (const t of d.vendas)
    for (const p of t.pagamentos) {
      if (f.moeda && f.moeda !== 'convertido' && p.moeda !== f.moeda) continue
      formasMapa.set(p.forma, (formasMapa.get(p.forma) ?? 0) + (f.moeda && f.moeda !== 'convertido' ? p.valor : p.valorPrincipal))
      const m = moedasMapa.get(p.moeda) ?? { valor: 0, principal: 0 }
      moedasMapa.set(p.moeda, { valor: m.valor + p.valor, principal: m.principal + p.valorPrincipal })
    }
  const nomeForma = new Map(cfg.formas.map((x) => [x.id, x.nome]))
  const porForma = [...formasMapa].map(([id, valor]) => ({ id, nome: nomeForma.get(id) ?? id, valor })).sort((a, b) => b.valor - a.valor)
  const porMoeda = [...moedasMapa].map(([moeda, v]) => ({ moeda, ...v })).sort((a, b) => b.principal - a.principal)

  // painéis dos módulos (genérico: cada módulo descreve o seu)
  const modulosAtivos = ctx.modulos.todos().filter((m) => cfg.modulosAtivos.includes(m.id))
  const areas = modulosAtivos
    .filter((m) => m.painel && (!f.area || f.area === m.id))
    .map((m) => ({ id: m.id, nome: m.nome, icone: m.icone, secoes: m.painel!(d) as Secao[] }))

  const alertas = await alertasGerais(ctx, d)
  for (const m of modulosAtivos) if (m.alertas) alertas.push(...m.alertas(d))

  return { filtros: f, moedaVis, cartoes, serie, serieAnterior, porArea, porForma, porMoeda, caixa, areas, alertas: alertas.filter((a) => a.quantidade > 0) }
}

export interface Alerta {
  id: string
  texto: string
  quantidade: number
  nivel: 'info' | 'alerta' | 'ruim'
  detalhe?: { tela: string; filtro?: Record<string, string | number | boolean | undefined> }
}

async function alertasGerais(ctx: Ctx, d: DadosPainel): Promise<Alerta[]> {
  const cfg = await lerConfig(ctx)
  const fila = await filaTriagem(ctx)
  const parada = fila.filter((t) => t.diasParada >= cfg.diasTriagemParada)
  const semComprovante = (await filaTriagem(ctx, { incluirEncerradas: true })).filter((t) => t.etapa === 'concluido' && t.semComprovanteOrigem)
  const baixos = d.itens.filter((i) => i.controlaEstoque && i.ativo && i.estoqueIdeal && i.saldo < i.estoqueIdeal)
  let vencendo = 0
  let atrasadas = 0
  for (const e of d.emprestimos.filter((x) => x.situacao === 'aberto' && x.direcao === 'dado')) {
    const s = await situacaoDe(ctx, e)
    vencendo += s.parcelas.filter((p) => p.status === 'vencendo').length
    atrasadas += s.parcelas.filter((p) => p.status === 'atrasada').length
  }
  const cot = await cotacoesAtuais(ctx)
  const velhas = cfg.moedasAtivas.filter((m) => m !== 'BRL' && (!cot[m] || diasEntre(cot[m]!.data, d.hoje) > cfg.diasCotacaoVelha))
  const dias = await ctx.repos.dias.listar()
  // só a última semana: dia antigo esquecido aberto não vira alarme eterno
  const abertosAntigos = dias.filter((x) => x.status === 'aberto' && x.data < d.hoje && x.data >= somarDias(d.hoje, -7))
  return [
    { id: 'triagemParada', texto: `compra(s) parada(s) na triagem há ${cfg.diasTriagemParada}+ dias`, quantidade: parada.length, nivel: 'alerta', detalhe: { tela: 'comprar' } },
    { id: 'semComprovante', texto: 'compra(s) sem comprovante de origem', quantidade: semComprovante.length, nivel: 'alerta', detalhe: { tela: 'comprar', filtro: { encerradas: true, semComprovante: true } } },
    { id: 'atrasadas', texto: 'parcela(s) atrasada(s) para receber', quantidade: atrasadas, nivel: 'ruim', detalhe: { tela: 'emprestimos', filtro: { status: 'atrasada' } } },
    { id: 'vencendo', texto: 'parcela(s) vencendo em 7 dias', quantidade: vencendo, nivel: 'info', detalhe: { tela: 'emprestimos', filtro: { status: 'vencendo' } } },
    { id: 'estoqueBaixo', texto: 'item(ns) abaixo do estoque ideal', quantidade: baixos.length, nivel: 'info', detalhe: { tela: 'estoque', filtro: { repor: true } } },
    { id: 'cotacao', texto: `moeda(s) sem cotação ou com cotação de mais de ${cfg.diasCotacaoVelha} dias`, quantidade: velhas.length, nivel: 'alerta', detalhe: { tela: 'config' } },
    { id: 'diaAberto', texto: 'dia(s) anterior(es) sem encerrar no caixa', quantidade: abertosAntigos.length, nivel: 'info', detalhe: { tela: 'caixa', filtro: { data: abertosAntigos[0]?.data } } },
  ]
}

// ---------- diagnóstico ----------

/** Confere as regras de ouro: estoque = movimentos; venda = pagamentos = caixa; dívida = movimentos. */
export async function diagnostico(ctx: Ctx, _p: object = {}) {
  const problemas: string[] = []
  const itens = await ctx.repos.itens.listar()
  const movs = await ctx.repos.movEstoque.listar()
  for (const i of itens.filter((x) => x.controlaEstoque)) {
    const soma = movs.filter((m) => m.itemId === i.id).reduce((s, m) => s + m.delta, 0)
    if (soma !== i.saldo) problemas.push(`Estoque de ${i.nome}: saldo ${i.saldo} ≠ movimentos ${soma}`)
    if (i.saldo < 0) problemas.push(`Estoque negativo: ${i.nome}`)
  }
  const caixa = await ctx.repos.movCaixa.listar()
  for (const t of await ctx.repos.transacoes.listar()) {
    const noCaixa = caixa.filter((c) => c.origemId === t.id)
    for (const moeda of new Set(t.pagamentos.map((p) => p.moeda))) {
      const pagos = t.pagamentos.filter((p) => p.moeda === moeda).reduce((s, p) => s + p.valor, 0)
      const soma = noCaixa.filter((c) => c.moeda === moeda).reduce((s, c) => s + c.delta, 0)
      const esperado = t.etapa === 'cancelado' ? 0 : t.tipo === 'venda' ? pagos : -pagos
      if (soma !== esperado) problemas.push(`Caixa da ${t.tipo} ${t.id} em ${moeda}: ${soma} ≠ ${esperado}`)
    }
    // com cliente pode ser fiado (o resto fica na conta dela); sem cliente o pagamento fecha com o total
    if (t.etapa === 'concluido' && t.tipo === 'venda' && !t.pessoaId) {
      const pago = t.pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
      const tol = t.pagamentos.filter((p) => p.moeda !== t.moedaPrincipal).length
      if (Math.abs(pago - t.totalPrincipal) > tol) problemas.push(`Venda ${t.id}: pagamentos ${pago} ≠ total ${t.totalPrincipal}`)
    }
  }
  for (const e of await ctx.repos.emprestimos.listar()) {
    const s = await situacaoDe(ctx, e)
    const total = e.parcelas.reduce((x, p) => x + p.valor, 0)
    if (s.saldo !== total - s.recebido) problemas.push(`Empréstimo ${e.id}: saldo ${s.saldo} ≠ parcelas ${total} − recebido ${s.recebido}`)
    if (s.saldo < 0) problemas.push(`Empréstimo ${e.id} com saldo negativo`)
  }
  return { ok: problemas.length === 0, problemas }
}
