// PAINEL: resumo geral + painel de cada módulo (o próprio módulo descreve o seu) + alertas.
// Cada número leva à lista que o forma (detalhe) e a soma dessa lista é o número (testado).

import { MOEDAS, converter } from '../domain/dinheiro'
import { dataComAno, diasEntre, listaDeDias, somarDias } from '../domain/datas'
import type { Id, Transacao } from '../domain/tipos'
import type { Cartao, DadosPainel, Secao } from '../modulos'
import { type Ctx, conversorPara, cotacoesAtuais, lerConfig } from './contexto'
import { situacaoDe } from './emprestimos'
import { filaTriagem } from './compras'
import { COLUNA_VENDIDO, triagem } from './triagem'
import { NAO_IDENTIFICADO, estoque, passaEtiqueta } from './estoque'
import { recortarVenda, valorEm, vendas } from './vendas'
import { toleranciaConversao } from './pagamentos'
import { viagensAbertas } from './viagens'
import { conferirFinanciamentos, resumoFinanciamentos } from './financiamentos'

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
    paraPrincipal: conversorPara(cfg.moedaPrincipal, cot),
    localId: f.localId,
    profissionalId: f.profissionalId,
  }
}

function lucroDe(t: Transacao) {
  return t.linhas.reduce((s, l) => s + l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.insumoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0), 0)
}

function resumo(d: DadosPainel, moeda?: string) {
  const vendas = moeda && moeda !== 'convertido' ? d.vendas.filter((t) => t.pagamentos.some((p) => p.moeda === moeda)) : d.vendas
  const faturamento = vendas.reduce((s, t) => s + valorEm(t, moeda), 0)
  // lucro e margem olham as MESMAS vendas do faturamento (com o filtro de moeda, só as pagas nela) — antes o lucro era
  // sempre o de todas as vendas, ao lado de um faturamento filtrado
  const lucro = vendas.reduce((s, t) => s + lucroDe(t), 0)
  const fatConv = vendas.reduce((s, t) => s + t.totalPrincipal, 0)
  return {
    /** descontos dados no período (moeda principal); o faturamento já é líquido */
    descontos: d.vendas.reduce((s, t) => s + t.linhas.reduce((x, l) => x + (l.descontoPrincipal ?? 0), 0), 0),
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
    { id: 'compras', nome: 'Compras concluídas', valor: r.compras, anterior: ant?.compras, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Compras CONCLUÍDAS no período (pagas e recebidas). As que ainda estão em aberto aparecem embaixo: o cabelo delas já está na triagem.', detalhe: { tela: 'comprar', filtro: { encerradas: true } } },
    { id: 'vendas', nome: 'Vendas', valor: r.nVendas, anterior: ant?.nVendas, formato: 'numero', ajuda: 'Quantas vendas e atendimentos concluídos.', detalhe: { tela: 'vendas', filtro: filtroLista } },
    { id: 'ticket', nome: 'Ticket médio', valor: r.ticket, anterior: ant?.ticket, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Faturamento ÷ número de vendas. Ex.: Bs 900 em 3 vendas = Bs 300.', detalhe: { tela: 'vendas', filtro: filtroLista } },
    { id: 'caixa', nome: 'Caixa agora', valor: caixaTotal, formato: 'dinheiro', moeda: moedaVis, ajuda: 'Todo o dinheiro (na mão + no banco), de todas as moedas convertidas pela cotação de hoje.', detalhe: { tela: 'caixa' } },
    { id: 'receber', nome: 'A receber', valor: aReceber, formato: 'dinheiro', moeda: moedaVis, ajuda: 'O que falta receber dos empréstimos que você deu (parcelas em aberto).', detalhe: { tela: 'emprestimos', filtro: { direcao: 'dado' } }, destaque: atrasado ? 'alerta' : undefined },
    { id: 'pagar', nome: 'A pagar', valor: aPagar, formato: 'dinheiro', moeda: moedaVis, ajuda: 'O que falta pagar dos empréstimos que você pegou.', detalhe: { tela: 'emprestimos', filtro: { direcao: 'tomado' } } },
  ]

  // COMPRAS EM ABERTO do período (registradas, ainda não concluídas): não entram em "Compras concluídas", mas o cabelo
  // já está na triagem — o Painel mostra à parte para nada sumir
  const abertasP = d.todasTransacoes.filter((t) => t.tipo === 'compra' && t.etapa !== 'concluido' && t.etapa !== 'cancelado' && t.data >= f.de && t.data <= f.ate && (!f.area || t.moduloId === f.area))
  const comprasAbertas = { n: abertasP.length, valor: abertasP.reduce((s, t) => s + t.totalPrincipal, 0) }

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
  // alertas dos módulos (formato antigo) entram no mesmo formato
  for (const m of modulosAtivos)
    for (const a of m.alertas?.(d) ?? [])
      alertas.push({ id: a.id, titulo: a.texto.charAt(0).toUpperCase() + a.texto.slice(1), acao: a.acao ?? '', quantidade: a.quantidade, nivel: a.nivel === 'ruim' ? 'urgente' : a.nivel === 'alerta' ? 'atencao' : 'info', itens: a.itens ?? [], detalhe: a.detalhe })
  const ordem = { urgente: 0, atencao: 1, info: 2 }
  alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || b.quantidade - a.quantidade)

  return { filtros: f, moedaVis, cartoes, comprasAbertas, serie, serieAnterior, porArea, porForma, porMoeda, caixa, areas, alertas: alertas.filter((a) => a.quantidade > 0) }
}

/** Um registro dentro de um alerta: o que é e para onde o toque leva (o registro em si, não só a lista). */
export interface ItemAlerta {
  texto: string
  sub?: string
  valor?: number
  detalhe: { tela: string; filtro?: Record<string, string | number | boolean | undefined> }
}

/**
 * Alerta do "Atenção agora": título curto, o que fazer, quantos, os primeiros registros (cada um clicável) e
 * "ver todos" (a lista já filtrada). Nível: urgente (dinheiro/atraso) · atenção (falta algo) · info.
 */
export interface Alerta {
  id: string
  titulo: string
  acao: string
  quantidade: number
  nivel: 'urgente' | 'atencao' | 'info'
  /** valor total envolvido (moeda principal), quando é dinheiro */
  valor?: number
  itens: ItemAlerta[]
  detalhe?: { tela: string; filtro?: Record<string, string | number | boolean | undefined> }
  /** compatível com os módulos antigos */
  texto?: string
}

async function alertasGerais(ctx: Ctx, d: DadosPainel): Promise<Alerta[]> {
  const cfg = await lerConfig(ctx)
  const compras = await filaTriagem(ctx, { incluirEncerradas: true })
  const vendasPend = await vendas(ctx, { pendencia: 'qualquer' })
  const com = (id: string) => compras.filter((t) => t.pendencias.some((x) => x.id === id))
  const itemCompra = (t: (typeof compras)[number], id?: string) => ({
    texto: t.pessoa ?? 'Sem fornecedor',
    sub: `${dataComAno(t.data)} · ${t.nomeEtapa}${t.etapa !== 'concluido' && t.diasParada ? ` · ${t.diasParada} d parada` : ''}`,
    valor: id ? t.pendencias.find((x) => x.id === id)?.valor : undefined,
    detalhe: { tela: 'pedido', filtro: { id: t.id } },
  })
  const itemVenda = (v: (typeof vendasPend)[number], id: string) => ({
    texto: v.cliente ?? 'Sem nome',
    sub: `${dataComAno(v.data)} · ${v.linhas.map((l) => l.descricao).join(', ')}`,
    valor: v.pendencias.find((x) => x.id === id)?.valor ?? v.totalPrincipal,
    detalhe: { tela: 'venda', filtro: { id: v.id } },
  })
  const parada = com('paradaTriagem')
  const semOrigem = com('semComprovanteOrigem')
  const semFotos = compras.filter((t) => t.etapa !== 'concluido' && t.pendencias.some((x) => x.id === 'semFotos'))
  const faltaPagar = com('faltaPagar')
  const faltaReceber = vendasPend.filter((v) => v.pendencias.some((x) => x.id === 'faltaReceber'))
  const semComprovanteVenda = vendasPend.filter((v) => v.pendencias.some((x) => x.id === 'semComprovante'))

  const pessoas = d.pessoas
  const atrasadas: ItemAlerta[] = []
  const vencendo: ItemAlerta[] = []
  for (const e of d.emprestimos.filter((x) => x.situacao === 'aberto' && x.direcao === 'dado')) {
    const s = await situacaoDe(ctx, e)
    for (const p of s.parcelas.filter((x) => x.status === 'atrasada' || x.status === 'vencendo')) {
      const it = { texto: pessoas.get(e.pessoaId)?.nome ?? '—', sub: `Parcela ${p.numero} · venceu ${dataComAno(p.vencimento)}${p.status === 'atrasada' ? ` · ${diasEntre(p.vencimento, d.hoje)} d de atraso` : ''}`, valor: d.paraPrincipal(p.falta, e.moeda), detalhe: { tela: 'emprestimo', filtro: { id: e.id } } }
      if (p.status === 'atrasada') atrasadas.push(it)
      else vencendo.push({ ...it, sub: `Parcela ${p.numero} · vence ${dataComAno(p.vencimento)}` })
    }
  }
  const baixos = d.itens.filter((i) => i.controlaEstoque && i.ativo && i.estoqueIdeal && i.saldo < i.estoqueIdeal)
  const cot = await cotacoesAtuais(ctx)
  const velhas = cfg.moedasAtivas.filter((m) => m !== 'BRL' && m !== cfg.moedaPrincipal && (!cot[m] || diasEntre(cot[m]!.data, d.hoje) > cfg.diasCotacaoVelha))
  const dias = await ctx.repos.dias.listar()
  // só a última semana: dia antigo esquecido aberto não vira alarme eterno
  const abertosAntigos = dias.filter((x) => x.status === 'aberto' && x.data < d.hoje && x.data >= somarDias(d.hoje, -7)).sort((a, b) => (a.data < b.data ? 1 : -1))
  const soma = (xs: { valor?: number }[]) => xs.reduce((s, x) => s + (x.valor ?? 0), 0)
  // viagens de compra abertas que passaram do orçamento (gasto da viagem ou capital de compra)
  const viagensEstouradas = (await viagensAbertas(ctx)).filter((v) => v.acimaOrcamento)
  // adiantamentos em que o parceiro entregou mais cabelo do que recebeu: a loja deve a diferença
  const adiantamentosAPagar = (await resumoFinanciamentos(ctx)).linhas.filter((x) => x.status === 'aPagar')

  const lista: Alerta[] = [
    { id: 'faltaReceber', nivel: 'urgente', titulo: 'Vendas com valor a receber', acao: 'Cobre ou registre o pagamento (Pessoas e contas › Recebi).', quantidade: faltaReceber.length, itens: faltaReceber.map((v) => itemVenda(v, 'faltaReceber')), detalhe: { tela: 'vendas', filtro: { pendencia: 'faltaReceber' } } },
    { id: 'atrasadas', nivel: 'urgente', titulo: 'Parcelas de empréstimo atrasadas', acao: 'Cobre no WhatsApp ou registre o pagamento.', quantidade: atrasadas.length, itens: atrasadas, detalhe: { tela: 'emprestimos', filtro: { status: 'atrasada' } } },
    { id: 'faltaPagar', nivel: 'urgente', titulo: 'Compras com valor a pagar', acao: 'Pague o fornecedor ou registre o acerto.', quantidade: faltaPagar.length, itens: faltaPagar.map((t) => itemCompra(t, 'faltaPagar')), detalhe: { tela: 'comprar', filtro: { encerradas: true, pendencia: 'faltaPagar' } } },
    { id: 'triagemParada', nivel: 'atencao', titulo: `Compras paradas na triagem (${cfg.diasTriagemParada}+ dias)`, acao: 'Abra e avance o pagamento e a entrega (conferir, pagar, concluir).', quantidade: parada.length, itens: parada.map((t) => itemCompra(t)), detalhe: { tela: 'comprar', filtro: { pendencia: 'paradaTriagem' } } },
    { id: 'semComprovante', nivel: 'atencao', titulo: 'Compras sem comprovante de origem', acao: 'Anexe a nota ou recibo de quem vendeu.', quantidade: semOrigem.length, itens: semOrigem.map((t) => itemCompra(t)), detalhe: { tela: 'comprar', filtro: { encerradas: true, pendencia: 'semComprovanteOrigem' } } },
    { id: 'vendaSemComprovante', nivel: 'atencao', titulo: 'Vendas por QR/transferência sem comprovante', acao: 'Anexe a foto do comprovante na venda.', quantidade: semComprovanteVenda.length, itens: semComprovanteVenda.map((v) => itemVenda(v, 'semComprovante')), detalhe: { tela: 'vendas', filtro: { pendencia: 'semComprovante' } } },
    { id: 'semFotos', nivel: 'info', titulo: 'Compras na triagem sem fotos', acao: 'Tire fotos do cabelo/pedido ao conferir.', quantidade: semFotos.length, itens: semFotos.map((t) => itemCompra(t)), detalhe: { tela: 'comprar', filtro: { pendencia: 'semFotos' } } },
    { id: 'vencendo', nivel: 'info', titulo: 'Parcelas vencendo em 7 dias', acao: 'Lembre a pessoa antes do vencimento.', quantidade: vencendo.length, itens: vencendo, detalhe: { tela: 'emprestimos', filtro: { status: 'vencendo' } } },
    { id: 'estoqueBaixo', nivel: 'info', titulo: 'Itens abaixo do estoque ideal', acao: 'Reponha ou ajuste o estoque ideal.', quantidade: baixos.length, itens: baixos.map((i) => ({ texto: i.nome, sub: `tem ${i.saldo} · ideal ${i.estoqueIdeal}`, detalhe: { tela: 'lote', filtro: { id: i.id } } })), detalhe: { tela: 'estoque', filtro: { repor: true, modulo: baixos[0]?.moduloId } } },
    { id: 'diaAberto', nivel: 'info', titulo: 'Dias anteriores sem encerrar no caixa', acao: 'Confira o dinheiro e encerre o dia.', quantidade: abertosAntigos.length, itens: abertosAntigos.map((x) => ({ texto: dataComAno(x.data), detalhe: { tela: 'caixa', filtro: { data: x.data } } })), detalhe: { tela: 'caixa', filtro: { data: abertosAntigos[0]?.data } } },
    {
      id: 'viagemOrcamento',
      nivel: 'atencao',
      titulo: 'Viagens de compra acima do orçamento',
      acao: 'Veja os gastos com quem viajou e ajuste o orçamento ou o plano.',
      quantidade: viagensEstouradas.length,
      itens: viagensEstouradas.map((v) => ({
        texto: `${v.codigo} · ${v.nome}`,
        sub: `${v.nomes}${v.orcamento && v.gasto > v.orcamento ? ` · gastos ${Math.round((v.gasto * 100) / v.orcamento)}% do orçamento` : ''}${v.orcamentoCompra && v.valorCompras > v.orcamentoCompra ? ` · compras ${Math.round((v.valorCompras * 100) / v.orcamentoCompra)}% do orçamento` : ''}`,
        valor: v.gasto + v.valorCompras,
        detalhe: { tela: 'viagem', filtro: { id: v.id } },
      })),
      detalhe: { tela: 'viagens', filtro: { status: 'aberta' } },
    },
    {
      id: 'adiantamentoAPagar',
      nivel: 'atencao',
      titulo: 'Adiantamentos: diferença a pagar ao parceiro',
      acao: 'O cabelo entregue passou do adiantado: pague a diferença.',
      quantidade: adiantamentosAPagar.length,
      itens: adiantamentosAPagar.map((x) => ({ texto: `${x.codigo} · ${x.pessoa}`, sub: dataComAno(x.ultimo), valor: x.aPagarParceiro, detalhe: { tela: 'financiamento', filtro: { id: x.id } } })),
      detalhe: { tela: 'adiantamentos', filtro: { status: 'aPagar' } },
    },
    { id: 'cotacao', nivel: 'atencao', titulo: 'Câmbio sem atualizar', acao: `Busque a cotação (mais de ${cfg.diasCotacaoVelha} dias).`, quantidade: velhas.length, itens: velhas.map((m) => ({ texto: m, sub: cot[m] ? `última ${dataComAno(cot[m]!.data)}` : 'sem cotação', detalhe: { tela: 'config', filtro: { aba: 'moedas' } } })), detalhe: { tela: 'config', filtro: { aba: 'moedas' } } },
  ]
  return lista.map((a) => ({ ...a, valor: a.itens.some((i) => i.valor !== undefined) && a.nivel === 'urgente' ? soma(a.itens) : undefined }))
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
      const tol = toleranciaConversao(t.pagamentos, t.moedaPrincipal)
      if (Math.abs(pago - t.totalPrincipal) > tol) problemas.push(`Venda ${t.id}: pagamentos ${pago} ≠ total ${t.totalPrincipal}`)
    }
  }
  // conta corrente: venda com cliente = total − pago; compra com fornecedor = −(total − pago); cancelada = 0
  const contas = await ctx.repos.movConta.listar()
  for (const t of await ctx.repos.transacoes.listar()) {
    const movs = contas.filter((m) => m.origemId === t.id)
    if (!t.pessoaId || !movs.length) continue
    const soma = movs.reduce((s, m) => s + m.delta, 0)
    const pago = t.pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
    const esperado = t.etapa === 'cancelado' ? 0 : t.tipo === 'venda' ? t.totalPrincipal - pago : -(t.totalPrincipal - pago)
    const tol = t.pagamentos.filter((p) => p.moeda !== t.moedaPrincipal).length
    if (Math.abs(soma - esperado) > tol) problemas.push(`Conta corrente da ${t.tipo} ${t.codigo ?? t.id}: ${soma} ≠ ${esperado}`)
  }
  for (const e of await ctx.repos.emprestimos.listar()) {
    const s = await situacaoDe(ctx, e)
    const total = e.parcelas.reduce((x, p) => x + p.valor, 0)
    if (s.saldo !== total - s.recebido) problemas.push(`Empréstimo ${e.id}: saldo ${s.saldo} ≠ parcelas ${total} − recebido ${s.recebido}`)
    if (s.saldo < 0) problemas.push(`Empréstimo ${e.id} com saldo negativo`)
  }
  // adiantamentos a parceiros: saiu do caixa uma vez, entregas sem caixa, conta bate
  problemas.push(...(await conferirFinanciamentos(ctx)))
  return { ok: problemas.length === 0, problemas }
}

/**
 * OPERAÇÃO DO CABELO (painel): o caminho compra → triagem → estoque → etiqueta, cada etapa com o MESMO número que a
 * tela do módulo mostra (vem das mesmas consultas: filaTriagem, triagem e estoque) e o que pede atenção nela.
 * Só leitura; nada é calculado de outro jeito aqui. Sem o módulo de cabelo, volta vazio.
 */
export async function operacao(ctx: Ctx, _p: object = {}) {
  let tri: Awaited<ReturnType<typeof triagem>>
  try {
    tri = await triagem(ctx, { moduloId: 'cabelo' })
  } catch {
    return null
  }
  const fila = await filaTriagem(ctx, {})
  const est = (await estoque(ctx, { moduloId: 'cabelo', somenteComSaldo: true })).filter((i) => i.saldo > 0)
  const pronta = new Set(tri.colunas.filter((c) => c.pronto).map((c) => c.id))
  const naFila = tri.lotes.filter((l) => l.fase !== COLUNA_VENDIDO && !pronta.has(l.fase))
  const separar = naFila.filter((l) => l.campos.estado !== NAO_IDENTIFICADO)
  const bruto = (s: string) => s === 'bruto' || s === 'preparando' || s === 'naoIdentificado'
  const disponiveis = est.filter((i) => !bruto(i.status))
  const semEtiqueta = est.filter((i) => passaEtiqueta(i, 'sem'))
  const g = (xs: { saldo: number }[]) => xs.reduce((s, x) => s + x.saldo, 0)
  return {
    compras: {
      abertas: fila.length,
      valor: fila.reduce((s, c) => s + c.totalPrincipal, 0),
      gramas: fila.reduce((s, c) => s + c.linhas.reduce((x, l) => x + l.quantidade, 0), 0),
      paradas: fila.filter((c) => c.pendencias.some((p) => p.id === 'paradaTriagem')).length,
      urgentes: fila.filter((c) => c.pendencias.some((p) => p.nivel === 'urgente')).length,
    },
    triagem: {
      separar: separar.length,
      gramas: g(separar),
      parados: separar.filter((l) => l.atrasado).length,
      paraDepois: tri.totais.naoIdentificado.n,
      triadoSemana: tri.totais.triadoSemana,
    },
    estoque: {
      lotes: est.length,
      gramas: g(est),
      disponivel: g(disponiveis),
      prontos: tri.totais.pronto,
      prontoValor: tri.totais.prontoValor,
    },
    etiqueta: {
      sem: semEtiqueta.length,
      velhas: est.filter((i) => i.etiquetaVelha).length,
      gramas: g(semEtiqueta),
    },
  }
}
