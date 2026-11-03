// RELATÓRIOS contábeis e gerenciais. Tudo na moeda principal (convertido pela cotação guardada em cada lançamento;
// caixa e saldos de hoje pela cotação atual). Cada relatório volta em linhas prontas para tabela/CSV.

import { MOEDAS, converter } from '../domain/dinheiro'
import type { Id } from '../domain/tipos'
import { type Ctx, cotacoesAtuais, lerConfig } from './contexto'
import { contas } from './contas'
import { situacaoDe } from './emprestimos'
import { custoDe } from './estoque'

async function conversor(ctx: Ctx) {
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx)
  return (v: number, m: string) => {
    try {
      return converter(v, m, cfg.moedaPrincipal, cot)
    } catch {
      return 0
    }
  }
}

/**
 * DRE simplificado (resultado do período) + divisão entre sócios.
 * Receita bruta − descontos = receita líquida (com desconto no período aparecem as três linhas).
 * Receita − custo do que foi vendido − insumos dos serviços − comissões = lucro bruto; − despesas = resultado; resultado × parte de cada sócio
 * − retiradas já feitas = quanto falta acertar com cada um.
 */
export async function dre(ctx: Ctx, p: { de: string; ate: string }) {
  const cfg = await lerConfig(ctx)
  const conv = await conversor(ctx)
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa === 'concluido' && t.data >= p.de && t.data <= p.ate)
  // receita = líquida (o total da venda já é com desconto); descontos guardados em cada linha (vendas antigas: 0)
  const receita = vendas.reduce((s, t) => s + t.totalPrincipal, 0)
  const descontos = vendas.reduce((s, t) => s + t.linhas.reduce((x, l) => x + (l.descontoPrincipal ?? 0), 0), 0)
  const receitaBruta = receita + descontos
  const cmv = vendas.reduce((s, t) => s + t.linhas.reduce((x, l) => x + (l.custoPrincipal ?? 0), 0), 0)
  const comissoes = vendas.reduce((s, t) => s + t.linhas.reduce((x, l) => x + (l.comissaoPrincipal ?? 0), 0), 0)
  // insumos do salão (tinta, água oxigenada…) usados nos serviços: custo da venda, guardado em cada linha
  const insumos = vendas.reduce((s, t) => s + t.linhas.reduce((x, l) => x + (l.insumoPrincipal ?? 0), 0), 0)
  const todoCaixa = await ctx.repos.movCaixa.listar()
  const porId = new Map(todoCaixa.map((m) => [m.id, m]))
  const caixa = todoCaixa.filter((m) => m.data >= p.de && m.data <= p.ate)
  const despesasPorCategoria = new Map<string, number>()
  // comissão paga não entra aqui: ela já foi descontada como custo em cada venda (senão contaria duas vezes)
  for (const m of caixa.filter((x) => x.categoria !== 'Comissões' && (x.tipo === 'despesa' || (x.tipo === 'estorno' && x.estornaId && porId.get(x.estornaId)?.tipo === 'despesa')))) {
    const cat = m.categoria || 'Outras despesas'
    despesasPorCategoria.set(cat, (despesasPorCategoria.get(cat) ?? 0) - conv(m.delta, m.moeda))
  }
  // gasto de viagem incorporado ao custo dos lotes vira estoque (entra no custo quando vender): não conta duas vezes
  for (const v of await ctx.repos.viagens.listar()) {
    const inc = v.incorporacao
    if (inc && inc.em.slice(0, 10) >= p.de && inc.em.slice(0, 10) <= p.ate && despesasPorCategoria.has('Viagens'))
      despesasPorCategoria.set('Viagens', (despesasPorCategoria.get('Viagens') ?? 0) - inc.total)
  }
  const despesas = [...despesasPorCategoria.values()].reduce((s, v) => s + v, 0)
  const lucroBruto = receita - cmv - insumos - comissoes
  const resultado = lucroBruto - despesas
  const retiradas = caixa.filter((m) => m.tipo === 'retirada' && m.socioId && !m.estornadoPor)
  const socios = cfg.socios.map((s) => {
    const parte = Math.round((resultado * s.parteBp) / 10000)
    const retirou = retiradas.filter((m) => m.socioId === s.id).reduce((x, m) => x - conv(m.delta, m.moeda), 0)
    return { ...s, parte, retirou, falta: parte - retirou }
  })
  return {
    de: p.de,
    ate: p.ate,
    moeda: cfg.moedaPrincipal,
    linhas: [
      { conta: 'Receita de vendas', valor: receitaBruta, nivel: 0 },
      ...(descontos ? [{ conta: '(−) Descontos', valor: -descontos, nivel: 1 }, { conta: '= Receita líquida', valor: receita, nivel: 0 }] : []),
      { conta: '(−) Custo do que foi vendido', valor: -cmv, nivel: 1 },
      ...(insumos ? [{ conta: '(−) Insumos dos serviços', valor: -insumos, nivel: 1 }] : []),
      { conta: '(−) Comissões', valor: -comissoes, nivel: 1 },
      { conta: '= Lucro bruto', valor: lucroBruto, nivel: 0 },
      ...[...despesasPorCategoria].map(([c, v]) => ({ conta: `(−) ${c}`, valor: -v, nivel: 1 })),
      { conta: '= Resultado do período', valor: resultado, nivel: 0 },
    ],
    receita,
    receitaBruta,
    descontos,
    cmv,
    insumos,
    comissoes,
    lucroBruto,
    despesas,
    resultado,
    margem: receita ? Math.round((lucroBruto / receita) * 10000) : 0,
    socios,
    vendas: vendas.length,
  }
}

/** Livro caixa: cada entrada e saída com saldo acumulado, por moeda. */
export async function livroCaixa(ctx: Ctx, p: { de: string; ate: string; moeda?: string }) {
  const cfg = await lerConfig(ctx)
  const nomeForma = new Map(cfg.formas.map((f) => [f.id, f.nome]))
  const todos = (await ctx.repos.movCaixa.listar()).sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? -1 : 1))
  const moedas = p.moeda ? [p.moeda] : MOEDAS.map((m) => m.codigo).filter((m) => todos.some((x) => x.moeda === m))
  return moedas.map((moeda) => {
    const ms = todos.filter((x) => x.moeda === moeda)
    const inicial = ms.filter((x) => x.data < p.de).reduce((s, x) => s + x.delta, 0)
    let saldo = inicial
    const linhas = ms
      .filter((x) => x.data >= p.de && x.data <= p.ate)
      .map((x) => {
        saldo += x.delta
        return { data: x.data, descricao: x.descricao, forma: nomeForma.get(x.forma) ?? x.forma, entrada: x.delta > 0 ? x.delta : 0, saida: x.delta < 0 ? -x.delta : 0, saldo, tipo: x.tipo }
      })
    return { moeda, inicial, final: saldo, entradas: linhas.reduce((s, l) => s + l.entrada, 0), saidas: linhas.reduce((s, l) => s + l.saida, 0), linhas }
  })
}

/** Inventário: estoque valorizado a custo (lote por lote). */
export async function inventario(ctx: Ctx, p: { moduloId?: string } = {}) {
  const itens = (await ctx.repos.itens.listar(p.moduloId ? { moduloId: p.moduloId } : undefined)).filter((i) => i.controlaEstoque && i.saldo > 0)
  const linhas = itens
    .map((i) => ({
      id: i.id,
      codigo: i.codigo ?? '',
      nome: i.nome,
      moduloId: i.moduloId,
      unidade: i.unidade,
      quantidade: i.saldo,
      custoUnitario100: i.quantidadeInicial ? Math.round(((i.custoPrincipal ?? 0) * 100) / i.quantidadeInicial) : 0,
      valorCusto: custoDe(i, i.saldo),
      campos: i.campos,
      desde: i.criadoEm.slice(0, 10),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { linhas, quantidade: linhas.reduce((s, l) => s + l.quantidade, 0), valor: linhas.reduce((s, l) => s + l.valorCusto, 0) }
}

/** Balanço: o que o negócio tem (caixa, estoque, a receber) menos o que deve = patrimônio. */
export async function balanco(ctx: Ctx, _p: object = {}) {
  const cfg = await lerConfig(ctx)
  const conv = await conversor(ctx)
  const caixa = await ctx.repos.movCaixa.listar()
  const porMoeda = MOEDAS.map((m) => {
    const v = caixa.filter((x) => x.moeda === m.codigo).reduce((s, x) => s + x.delta, 0)
    return { moeda: m.codigo, valor: v, convertido: conv(v, m.codigo) }
  }).filter((x) => x.valor !== 0)
  const inv = await inventario(ctx)
  const ct = await contas(ctx, { somenteAbertas: true })
  let empDados = 0
  let empTomados = 0
  for (const e of (await ctx.repos.emprestimos.listar()).filter((x) => x.situacao === 'aberto')) {
    const s = await situacaoDe(ctx, e)
    if (e.direcao === 'dado') empDados += conv(s.saldo, e.moeda)
    else empTomados += conv(s.saldo, e.moeda)
  }
  const ativos = [
    ...porMoeda.map((m) => ({ conta: `Caixa em ${m.moeda}`, valor: m.convertido, detalhe: m.valor, moeda: m.moeda })),
    { conta: 'Estoque (a custo)', valor: inv.valor },
    { conta: 'Pessoas que me devem', valor: ct.aReceber },
    { conta: 'Empréstimos a receber', valor: empDados },
  ].filter((x) => x.valor !== 0)
  const passivos = [
    { conta: 'Devo a pessoas', valor: ct.aPagar },
    { conta: 'Empréstimos a pagar', valor: empTomados },
  ].filter((x) => x.valor !== 0)
  const totalAtivos = ativos.reduce((s, x) => s + x.valor, 0)
  const totalPassivos = passivos.reduce((s, x) => s + x.valor, 0)
  return { moeda: cfg.moedaPrincipal, ativos, passivos, totalAtivos, totalPassivos, patrimonio: totalAtivos - totalPassivos, devedores: ct.lista.filter((x) => x.saldo > 0), credores: ct.lista.filter((x) => x.saldo < 0) }
}

/** Vendas linha por linha (como o caderno: medida | gramas × fator = total), com custo e lucro. */
export async function vendasDetalhadas(ctx: Ctx, p: { de: string; ate: string; pessoaId?: Id; moduloId?: string }) {
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter(
    (t) => t.etapa === 'concluido' && t.data >= p.de && t.data <= p.ate && (!p.pessoaId || t.pessoaId === p.pessoaId),
  )
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const itens = new Map((await ctx.repos.itens.listar()).map((x) => [x.id, x]))
  return vendas
    .flatMap((t) =>
      t.linhas
        .filter((l) => !p.moduloId || itens.get(l.itemId!)?.moduloId === p.moduloId)
        .map((l) => ({
          data: t.data,
          vendaId: t.id,
          cliente: t.pessoaId ? pessoas.get(t.pessoaId) ?? '' : '',
          lote: itens.get(l.itemId!)?.codigo ?? '',
          descricao: l.descricao,
          medida: (l.campos.medida as number | undefined) ?? (itens.get(l.itemId!)?.campos.comprimento as number | undefined) ?? '',
          categoria: (l.campos.categoria as string | undefined) ?? (itens.get(l.itemId!)?.campos.categoria as string | undefined) ?? '',
          quantidade: l.quantidade,
          fator: (l.campos.fator as string | undefined) ?? '',
          /** valor cheio (gramas × fator) e desconto, na moeda da linha; total = líquido */
          bruto: l.bruto ?? l.total,
          desconto: l.desconto ?? 0,
          descontoPrincipal: l.descontoPrincipal ?? 0,
          total: l.total,
          moeda: l.moeda,
          totalPrincipal: l.totalPrincipal,
          custo: l.custoPrincipal ?? 0,
          insumos: l.insumoPrincipal ?? 0,
          comissao: l.comissaoPrincipal ?? 0,
          lucro: l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.insumoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0),
        })),
    )
    .sort((a, b) => (a.data < b.data ? -1 : 1))
}

/** Compras linha por linha (com etapa da triagem e fornecedor). */
export async function comprasDetalhadas(ctx: Ctx, p: { de: string; ate: string }) {
  const compras = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => t.data >= p.de && t.data <= p.ate)
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  return compras
    .flatMap((t) =>
      t.linhas.map((l) => ({
        data: t.data,
        compraId: t.id,
        fornecedor: t.pessoaId ? pessoas.get(t.pessoaId) ?? '' : '',
        etapa: t.etapa,
        descricao: l.descricao,
        quantidade: l.quantidade,
        total: l.total,
        moeda: l.moeda,
        totalPrincipal: l.totalPrincipal,
        pago: t.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0),
      })),
    )
    .sort((a, b) => (a.data < b.data ? -1 : 1))
}
