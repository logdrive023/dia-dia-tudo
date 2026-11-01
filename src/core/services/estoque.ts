// ESTOQUE: todo movimento é registrado com saldo antes/depois. Regra: saldo = soma dos movimentos.

import { fatorValido, multiplicarFator, proporcao } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Campos, Id, Item, MotivoEstoque, MovEstoque, Unidade } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, novo, tocar } from './contexto'

export async function moverEstoque(
  ctx: Ctx,
  m: { itemId: Id; delta: number; motivo: MotivoEstoque; origemId?: Id; descricao?: string; corrigeId?: Id },
) {
  const item = await ctx.repos.itens.obter(m.itemId)
  exigir(item, 'Item não encontrado.')
  exigir(item.controlaEstoque, `${item.nome} não controla estoque.`)
  exigir(Number.isSafeInteger(m.delta) && m.delta !== 0, 'Quantidade inválida.')
  const depois = item.saldo + m.delta
  exigir(depois >= 0, `Não há ${unidadeTexto(item.unidade, -m.delta)} de "${item.nome}" (tem ${unidadeTexto(item.unidade, item.saldo)}).`)
  const mov = novo<MovEstoque>(ctx, {
    itemId: item.id,
    data: ctx.relogio.hoje(),
    delta: m.delta,
    saldoAntes: item.saldo,
    saldoDepois: depois,
    motivo: m.motivo,
    origemId: m.origemId,
    corrigeId: m.corrigeId,
    descricao: m.descricao,
  })
  await ctx.repos.movEstoque.salvar(mov)
  await ctx.repos.itens.salvar(tocar(ctx, { ...item, saldo: depois }))
  return mov
}

export function unidadeTexto(u: Unidade, q: number): string {
  const n = q.toLocaleString('pt-BR')
  if (u === 'grama') return `${n} g`
  if (u === 'peca') return `${n} ${Math.abs(q) === 1 ? 'peça' : 'peças'}`
  return `${n}×`
}

/** Custo proporcional de uma quantidade de um lote (na moeda principal). */
export function custoDe(item: Item, quantidade: number): number {
  if (!item.custoPrincipal || !item.quantidadeInicial) return 0
  return proporcao(item.custoPrincipal, quantidade, item.quantidadeInicial)
}

// ---------- comandos ----------

export async function salvarItem(
  ctx: Ctx,
  d: {
    id: Id
    moduloId: string
    tipoItem: string
    nome: string
    precoSugerido?: { moeda: string; valor: number }
    estoqueIdeal?: number
    duracaoMin?: number
    retornoDias?: number
    campos?: Campos
    saldoInicial?: number
    ativo?: boolean
  },
) {
  exigir(d.nome?.trim(), 'Dê um nome.', 'nome')
  const tipo = ctx.modulos.tipoItem(d.moduloId, d.tipoItem)
  const existente = await ctx.repos.itens.obter(d.id)
  if (existente) {
    await ctx.repos.itens.salvar(
      tocar(ctx, {
        ...existente,
        nome: d.nome.trim(),
        precoSugerido: d.precoSugerido,
        estoqueIdeal: d.estoqueIdeal,
        duracaoMin: d.duracaoMin,
        retornoDias: d.retornoDias,
        campos: { ...existente.campos, ...(d.campos ?? {}) },
        ativo: d.ativo ?? existente.ativo,
      }),
    )
    return { id: d.id }
  }
  const item = novo<Item>(ctx, {
    id: d.id,
    moduloId: d.moduloId,
    tipoItem: d.tipoItem,
    nome: d.nome.trim(),
    unidade: tipo.unidade,
    controlaEstoque: tipo.controlaEstoque,
    ativo: d.ativo ?? true,
    saldo: 0,
    precoSugerido: d.precoSugerido,
    estoqueIdeal: d.estoqueIdeal,
    duracaoMin: d.duracaoMin,
    retornoDias: d.retornoDias,
    origem: { tipo: 'cadastro' },
    campos: d.campos ?? {},
  })
  await ctx.repos.itens.salvar(item)
  if (tipo.controlaEstoque && d.saldoInicial) {
    exigirInteiroPositivo(d.saldoInicial, 'Quantidade inicial')
    await moverEstoque(ctx, { itemId: item.id, delta: d.saldoInicial, motivo: 'ajuste', descricao: 'Quantidade inicial do cadastro' })
  }
  await auditar(ctx, 'salvarItem', item.id, item.nome)
  return { id: item.id }
}

/** Define a quantidade contada (ajuste) ou registra uma perda. */
export async function ajustarEstoque(ctx: Ctx, d: { itemId: Id; novoSaldo: number; motivo: 'ajuste' | 'perda'; descricao?: string }) {
  const item = await ctx.repos.itens.obter(d.itemId)
  exigir(item, 'Item não encontrado.')
  exigirInteiroPositivo(d.novoSaldo, 'Quantidade', true)
  const delta = d.novoSaldo - item.saldo
  exigir(delta !== 0, 'A quantidade já é essa.')
  if (d.motivo === 'perda') exigir(delta < 0, 'Perda só diminui o estoque.')
  const mov = await moverEstoque(ctx, { itemId: item.id, delta, motivo: d.motivo, descricao: d.descricao })
  await auditar(ctx, 'ajustarEstoque', item.id, `${item.nome}: ${item.saldo} → ${d.novoSaldo}`)
  return { id: mov.id }
}

/** Próximo código curto de lote ("L-0007"), sequencial por prefixo. */
export async function proximoCodigo(ctx: Ctx, prefixo = 'L'): Promise<string> {
  const id = `contador-${prefixo}`
  const r = await ctx.repos.config.obter(id)
  const n = ((r?.valor as number) ?? 0) + 1
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor: n }) : novo(ctx, { id, valor: n }))
  return `${prefixo}-${String(n).padStart(4, '0')}`
}

export interface SaidaSeparacao {
  id: Id
  quantidade: number
  campos: Campos
  nome?: string
  /**
   * Valor de mercado por unidade (ex.: fator da tabela). Se todas as partes tiverem, o custo é dividido pelo VALOR
   * (cabelo longo, que vale mais, leva mais custo); senão, pelo peso.
   */
  valorReferencia?: string
}

/**
 * SEPARAÇÃO / TRIAGEM DE LOTE (genérica): consome parte de um lote e gera N lotes novos; a diferença é a perda.
 * Ex.: 40 kg de cabelo bruto → 20 kg preto + 19,5 kg castanho (perda 0,5 kg). O custo usado é dividido pelo peso
 * de cada parte (mais o custo extra, se houver). Cada lote novo guarda de onde veio: rastreio compra → venda.
 */
export async function separarLote(
  ctx: Ctx,
  d: { id: Id; loteId: Id; quantidadeUsada: number; saidas: SaidaSeparacao[]; custoExtraPrincipal?: number; descricao?: string },
) {
  if (d.saidas?.length && (await ctx.repos.itens.obter(d.saidas[0].id))) return { id: d.id, lotes: d.saidas.map((x) => x.id) }
  const lote = await ctx.repos.itens.obter(d.loteId)
  exigir(lote, 'Lote não encontrado.')
  exigir(d.saidas?.length, 'Diga em que lotes ele foi separado.')
  exigirInteiroPositivo(d.quantidadeUsada, 'Quantidade usada')
  for (const x of d.saidas) exigirInteiroPositivo(x.quantidade, 'Quantidade de cada parte')
  const soma = d.saidas.reduce((s, x) => s + x.quantidade, 0)
  exigir(soma <= d.quantidadeUsada, `As partes somam ${unidadeTexto(lote.unidade, soma)}, mais do que foi usado (${unidadeTexto(lote.unidade, d.quantidadeUsada)}).`)
  const extra = d.custoExtraPrincipal ?? 0
  exigirInteiroPositivo(extra, 'Custo extra', true)
  const tipo = ctx.modulos.tipoItem(lote.moduloId, lote.tipoItem)
  const custoTotal = custoDe(lote, d.quantidadeUsada) + extra
  const perda = d.quantidadeUsada - soma
  // base do rateio: valor de mercado (quantidade × referência) quando todas têm referência; senão o peso
  const porValor = d.saidas.every((x) => x.valorReferencia && fatorValido(x.valorReferencia))
  const base = d.saidas.map((x) => (porValor ? multiplicarFator(x.quantidade, x.valorReferencia!, 'BOB') : x.quantidade))
  const somaBase = base.reduce((s, v) => s + v, 0)
  await moverEstoque(ctx, {
    itemId: lote.id,
    delta: -d.quantidadeUsada,
    motivo: 'transformacao',
    origemId: d.id,
    descricao: d.descricao ?? `Separado em ${d.saidas.length} lote(s)${perda ? ` · perda ${unidadeTexto(lote.unidade, perda)}` : ''}`,
  })
  const criados: Id[] = []
  let custoRestante = custoTotal
  for (const [k, x] of d.saidas.entries()) {
    const custo = k === d.saidas.length - 1 ? custoRestante : proporcao(custoTotal, base[k], somaBase)
    custoRestante -= custo
    const campos: Campos = { ...lote.campos, ...x.campos, separacaoId: d.id, rateio: porValor ? 'valor' : 'peso' }
    const nome = x.nome?.trim() || tipo.nomear?.(campos) || `${lote.nome} · parte ${k + 1}`
    const filho = novo<Item>(ctx, {
      id: x.id,
      moduloId: lote.moduloId,
      tipoItem: lote.tipoItem,
      nome,
      codigo: await proximoCodigo(ctx),
      unidade: lote.unidade,
      controlaEstoque: true,
      ativo: true,
      saldo: 0,
      precoSugerido: lote.precoSugerido,
      custoPrincipal: custo,
      quantidadeInicial: x.quantidade,
      origem: { tipo: 'transformacao', id: lote.id, pessoaId: lote.origem?.pessoaId, compraId: lote.origem?.compraId ?? (lote.origem?.tipo === 'compra' ? lote.origem.id : undefined) },
      campos,
    })
    await ctx.repos.itens.salvar(filho)
    await moverEstoque(ctx, { itemId: filho.id, delta: x.quantidade, motivo: 'transformacao', origemId: lote.id, descricao: `Veio de ${lote.codigo ?? lote.nome}` })
    criados.push(filho.id)
  }
  await auditar(ctx, 'separarLote', lote.id, `${lote.codigo ?? lote.nome}: ${d.quantidadeUsada} → ${d.saidas.map((x) => x.quantidade).join(' + ')} (perda ${perda})`)
  return { id: d.id, lotes: criados }
}

/** Transformação de uma parte só (ex.: limpar 100 g bruto → 82 g limpo). */
export async function transformarLote(
  ctx: Ctx,
  d: { id: Id; loteId: Id; quantidadeUsada: number; quantidadeResultado: number; campos: Campos; nome?: string; custoExtraPrincipal?: number; descricao?: string },
) {
  const r = await separarLote(ctx, {
    id: `sep-${d.id}`,
    loteId: d.loteId,
    quantidadeUsada: d.quantidadeUsada,
    saidas: [{ id: d.id, quantidade: d.quantidadeResultado, campos: d.campos, nome: d.nome }],
    custoExtraPrincipal: d.custoExtraPrincipal,
    descricao: d.descricao,
  })
  return { id: r.lotes[0] }
}

// ---------- consultas ----------

export async function estoque(ctx: Ctx, p: { moduloId?: string; somenteComSaldo?: boolean } = {}) {
  const itens = await ctx.repos.itens.listar(p.moduloId ? { moduloId: p.moduloId } : undefined)
  return itens
    .filter((i) => i.controlaEstoque && i.ativo && (!p.somenteComSaldo || i.saldo > 0))
    .map((i) => {
      const ideal = i.estoqueIdeal ?? 0
      return { ...i, repor: Math.max(0, ideal - i.saldo) }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function catalogo(ctx: Ctx, p: { moduloId?: string } = {}) {
  const itens = await ctx.repos.itens.listar(p.moduloId ? { moduloId: p.moduloId } : undefined)
  return itens.filter((i) => i.origem?.tipo === 'cadastro' || !i.controlaEstoque).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function movimentosDoItem(ctx: Ctx, p: { itemId: Id }) {
  const movs = await ctx.repos.movEstoque.listar({ itemId: p.itemId })
  return movs.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
}

/** Ficha do lote: de onde veio, para onde foi cada grama e quanto deu de lucro. */
export async function fichaItem(ctx: Ctx, p: { id: Id }) {
  const item = await ctx.repos.itens.obter(p.id)
  exigir(item, 'Item não encontrado.')
  const movimentos = await movimentosDoItem(ctx, { itemId: item.id })
  const anexos = await ctx.repos.anexos.listar({ donoId: item.id })
  const compra = item.origem?.tipo === 'compra' && item.origem.id ? await ctx.repos.transacoes.obter(item.origem.id) : undefined
  const anexosCompra = compra ? await ctx.repos.anexos.listar({ donoId: compra.id }) : []
  const fornecedor = item.origem?.pessoaId ? await ctx.repos.pessoas.obter(item.origem.pessoaId) : undefined
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    .filter((t) => t.etapa === 'concluido' && t.linhas.some((l) => l.itemId === item.id))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const saidas = vendas.flatMap((t) =>
    t.linhas
      .filter((l) => l.itemId === item.id)
      .map((l) => ({
        vendaId: t.id,
        data: t.data,
        cliente: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
        quantidade: l.quantidade,
        totalPrincipal: l.totalPrincipal,
        custoPrincipal: l.custoPrincipal ?? 0,
      })),
  )
  const vendido = saidas.reduce((s, x) => s + x.totalPrincipal, 0)
  const custoVendido = saidas.reduce((s, x) => s + x.custoPrincipal, 0)
  const derivados = (await ctx.repos.itens.listar()).filter((i) => i.origem?.tipo === 'transformacao' && i.origem.id === item.id)
  return { item, movimentos, anexos: [...anexos, ...anexosCompra], compra, fornecedor, saidas, vendido, custoVendido, lucro: vendido - custoVendido, derivados }
}

export interface VendaRastreio {
  vendaId: Id
  data: string
  cliente?: string
  quantidade: number
  total: number
  moeda: string
  totalPrincipal: number
  custo: number
  calculo: string
}

export interface NoRastreio {
  item: Item
  entrada: number
  vendido: number
  separado: number
  perdasAjustes: number
  saldo: number
  custo: number
  receita: number
  lucro: number
  vendas: VendaRastreio[]
  filhos: NoRastreio[]
}

/**
 * RASTREIO (origem × destino): da compra até cada venda parcial. Funciona a partir da compra ou de qualquer lote.
 * Cada nó: entrou, vendido, separado em outros lotes, perdas/ajustes, saldo, custo, receita e lucro (com os filhos).
 */
export async function rastreio(ctx: Ctx, p: { compraId?: Id; itemId?: Id }) {
  const itens = await ctx.repos.itens.listar()
  const porId = new Map(itens.map((i) => [i.id, i]))
  let compraId = p.compraId
  if (!compraId && p.itemId) {
    const i = porId.get(p.itemId)
    exigir(i, 'Lote não encontrado.')
    compraId = i.origem?.tipo === 'compra' ? i.origem.id : i.origem?.compraId
  }
  const compra = compraId ? await ctx.repos.transacoes.obter(compraId) : undefined
  const raizes = compra
    ? itens.filter((i) => i.origem?.tipo === 'compra' && i.origem.id === compra.id)
    : p.itemId && porId.get(p.itemId)
      ? [porId.get(p.itemId)!]
      : []
  const movs = await ctx.repos.movEstoque.listar()
  const vendasTodas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa === 'concluido')
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const montar = (item: Item): NoRastreio => {
    const ms = movs.filter((m) => m.itemId === item.id)
    const soma = (f: (m: MovEstoque) => boolean) => ms.filter(f).reduce((s, m) => s + m.delta, 0)
    const vendas: VendaRastreio[] = vendasTodas.flatMap((t) =>
      t.linhas
        .filter((l) => l.itemId === item.id)
        .map((l) => ({
          vendaId: t.id,
          data: t.data,
          cliente: t.pessoaId ? pessoas.get(t.pessoaId) : undefined,
          quantidade: l.quantidade,
          total: l.total,
          moeda: l.moeda,
          totalPrincipal: l.totalPrincipal,
          custo: l.custoPrincipal ?? 0,
          calculo: l.campos?.calculo ? String(l.campos.calculo) : '',
        })),
    )
    const filhos = itens.filter((i) => i.origem?.tipo === 'transformacao' && i.origem.id === item.id).map(montar)
    const receitaPropria = vendas.reduce((s, v) => s + v.totalPrincipal, 0)
    const custoVendido = vendas.reduce((s, v) => s + v.custo, 0)
    return {
      item,
      entrada: soma((m) => m.delta > 0 && (m.motivo === 'compra' || m.motivo === 'transformacao' || m.descricao === 'Quantidade inicial do cadastro')),
      vendido: vendas.reduce((s, v) => s + v.quantidade, 0),
      separado: -soma((m) => m.motivo === 'transformacao' && m.delta < 0),
      perdasAjustes: soma((m) => m.motivo === 'ajuste' || m.motivo === 'perda') ,
      saldo: item.saldo,
      custo: item.custoPrincipal ?? 0,
      receita: receitaPropria + filhos.reduce((s, f) => s + f.receita, 0),
      lucro: receitaPropria - custoVendido + filhos.reduce((s, f) => s + f.lucro, 0),
      vendas,
      filhos,
    }
  }
  const arvore = raizes.map(montar)
  const somar = (nos: NoRastreio[], f: (n: NoRastreio) => number): number => nos.reduce((s, n) => s + f(n) + somar(n.filhos, f), 0)
  const entradas = arvore.reduce((s, n) => s + n.entrada, 0)
  return {
    compra,
    fornecedor: compra?.pessoaId ? pessoas.get(compra.pessoaId) : undefined,
    arvore,
    resumo: {
      comprado: entradas,
      custoCompra: compra?.totalPrincipal ?? arvore.reduce((s, n) => s + n.custo, 0),
      vendido: somar(arvore, (n) => n.vendido),
      emEstoque: somar(arvore, (n) => n.saldo),
      perdaNaSeparacao: somar(arvore, (n) => n.separado - n.filhos.reduce((s, f) => s + f.entrada, 0)),
      receita: arvore.reduce((s, n) => s + n.receita, 0),
      lucroRealizado: arvore.reduce((s, n) => s + n.lucro, 0),
      vendas: somar(arvore, (n) => n.vendas.length),
      lotes: somar(arvore, () => 1),
    },
  }
}
