// ESTOQUE: todo movimento é registrado com saldo antes/depois. Regra: saldo = soma dos movimentos.

import { fatorValido, multiplicarFator, proporcao } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Campos, Id, InsumoServico, Item, MotivoEstoque, MovEstoque, Transacao, Unidade } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, novo, tocar } from './contexto'
import { nomeAcao } from './historico'
import { codigoNovoLote, exigirCodigosLivres, proximoSequencial, siglasPorPessoa } from './codigos'
import { leitorFotos } from './fotos'
import { fatorDaTabela } from './precos'

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
    usuario: ctx.sessao.usuarioId || undefined,
    porNome: ctx.sessao.nome || undefined,
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

/** TODAS as compras de onde vem o lote (direto, pelo lote-mãe ou pelos lotes unificados). */
export function comprasDe(i?: Pick<Item, 'origem'>): Id[] {
  const o = i?.origem
  if (!o) return []
  if (o.compraIds?.length) return o.compraIds
  const c = o.tipo === 'compra' ? o.id : o.compraId
  return c ? [c] : []
}

/** Lotes de onde este veio: o lote-mãe (separação) ou os lotes unificados. */
export function lotesDeOrigem(i?: Pick<Item, 'origem'>): Id[] {
  const o = i?.origem
  if (o?.tipo === 'transformacao' && o.id) return [o.id]
  if (o?.tipo === 'unificacao') return o.ids ?? []
  return []
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
    /** serviço: % própria (pontos-base); undefined = regra padrão. Ausente na edição = mantém. */
    comissaoBp?: number
    /** serviço: insumos fixos (moeda + valor, itens opcionais que somam o valor). Ausente na edição = mantém. */
    insumo?: InsumoServico
  },
) {
  exigir(d.nome?.trim(), 'Dê um nome.', 'nome')
  const tipo = ctx.modulos.tipoItem(d.moduloId, d.tipoItem)
  const existente = await ctx.repos.itens.obter(d.id)
  if (d.comissaoBp !== undefined) exigir(Number.isInteger(d.comissaoBp) && d.comissaoBp >= 0 && d.comissaoBp <= 10000, 'Comissão inválida.', 'comissaoBp')
  const insumo = normalizarInsumo(d.insumo)
  const regra = {
    comissaoBp: 'comissaoBp' in d ? d.comissaoBp : existente?.comissaoBp,
    insumo: 'insumo' in d ? insumo : existente?.insumo,
  }
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
        ...regra,
      }),
    )
    if (existente.comissaoBp !== regra.comissaoBp || JSON.stringify(existente.insumo) !== JSON.stringify(regra.insumo))
      await auditar(ctx, 'regraServico', existente.id, `${existente.nome}: comissão ${existente.comissaoBp !== undefined ? existente.comissaoBp / 100 + '%' : 'padrão'} → ${regra.comissaoBp !== undefined ? regra.comissaoBp / 100 + '%' : 'padrão'} · insumos ${existente.insumo?.valor ?? 0} → ${regra.insumo?.valor ?? 0}`)
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
    ...(regra.comissaoBp !== undefined ? { comissaoBp: regra.comissaoBp } : {}),
    ...(regra.insumo ? { insumo: regra.insumo } : {}),
  })
  await ctx.repos.itens.salvar(item)
  if (tipo.controlaEstoque && d.saldoInicial) {
    exigirInteiroPositivo(d.saldoInicial, 'Quantidade inicial')
    await moverEstoque(ctx, { itemId: item.id, delta: d.saldoInicial, motivo: 'ajuste', descricao: 'Quantidade inicial do cadastro' })
  }
  await auditar(ctx, 'salvarItem', item.id, item.nome)
  return { id: item.id }
}

/** Insumo do catálogo: itens com nome e valor somam o total; sem valor = sem insumo. */
export function normalizarInsumo(i: InsumoServico | undefined): InsumoServico | undefined {
  if (!i) return undefined
  const itens = (i.itens ?? []).filter((x) => x.valor).map((x) => ({ nome: x.nome?.trim() || 'Insumos', valor: x.valor }))
  for (const x of itens) exigirInteiroPositivo(x.valor, `Insumo ${x.nome}`)
  const valor = itens.length ? itens.reduce((s, x) => s + x.valor, 0) : i.valor
  if (!valor) return undefined
  exigirInteiroPositivo(valor, 'Insumos')
  return { moeda: i.moeda, valor, ...(itens.length ? { itens } : {}) }
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

const SEQUENCIAS = { P: 'compra', L: 'lote', T: 'triagem', V: 'venda' } as const

/**
 * Próximo código INCREMENTAL ("L-0007", "T-0003", "V-0012"): P = compra, L = lote, T = triagem, V = venda, com o
 * prefixo e as casas de Configurações › Códigos (prefixo vazio dá 1, 2, 3). Lote de compra/separação usa codigoNovoLote.
 */
export async function proximoCodigo(ctx: Ctx, prefixo = 'L'): Promise<string> {
  const seq = SEQUENCIAS[prefixo as keyof typeof SEQUENCIAS]
  if (seq) return proximoSequencial(ctx, seq)
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
  /** código digitado para o lote que sai (vazio = o da regra: M1-1a, L-0008…); recusado se já existir */
  codigo?: string
  /**
   * Valor de mercado por unidade (ex.: fator da tabela). Se todas as partes tiverem, o custo é dividido pelo VALOR
   * (cabelo longo, que vale mais, leva mais custo); senão, pelo peso.
   */
  valorReferencia?: string
}

/** "Deixar para depois": o que ainda não deu para separar vira um pacote "Não identificado" (pendência), não perda. */
export interface ParaDepois {
  id: Id
  quantidade: number
  codigo?: string
}

/** Situação do pacote que ainda não foi identificado (fica na entrada da triagem, como pendência). */
export const NAO_IDENTIFICADO = 'Não identificado'

/**
 * SEPARAÇÃO / TRIAGEM DE LOTE (genérica): consome parte de um lote e gera N lotes novos; a diferença é a perda.
 * Ex.: 40 kg de cabelo bruto → 20 kg preto + 19,5 kg castanho (perda 0,5 kg). O custo usado é dividido pelo peso
 * de cada parte (mais o custo extra, se houver). Cada lote novo guarda de onde veio: rastreio compra → venda.
 */
export type DadosSeparacao = { id: Id; loteId: Id; quantidadeUsada: number; saidas: SaidaSeparacao[]; paraDepois?: ParaDepois; custoExtraPrincipal?: number; descricao?: string }

/** Identidade de uma TRIAGEM (como compra e venda têm a sua): "T-0003", quem e quando. */
export type Triagem = NonNullable<Item['triagem']>
export async function novaTriagem(ctx: Ctx, id: Id): Promise<Omit<Triagem, 'papel'>> {
  return { id, codigo: await proximoCodigo(ctx, 'T'), em: ctx.relogio.agora(), por: ctx.sessao.nome }
}

export async function separarLote(ctx: Ctx, d: DadosSeparacao) {
  const primeiro = d.saidas?.[0]?.id ?? d.paraDepois?.id
  if (primeiro && (await ctx.repos.itens.obter(primeiro))) return { id: d.id, lotes: [...(d.saidas ?? []).map((x) => x.id), ...(d.paraDepois?.quantidade ? [d.paraDepois.id] : [])] }
  exigir(d.saidas?.length || d.paraDepois?.quantidade, 'Diga em que lotes ele foi separado.')
  return separarNaTriagem(ctx, d, await novaTriagem(ctx, d.id))
}

/** Separação dentro de uma triagem já aberta (a triagem pode ter unificado lotes antes, no mesmo passo). */
export async function separarNaTriagem(ctx: Ctx, d: DadosSeparacao, tg: Omit<Triagem, 'papel'>) {
  const lote = await ctx.repos.itens.obter(d.loteId)
  exigir(lote, 'Lote não encontrado.')
  const saidas = d.saidas ?? []
  const depois = d.paraDepois?.quantidade ? d.paraDepois : undefined
  exigir(saidas.length || depois, 'Diga em que lotes ele foi separado.')
  exigirInteiroPositivo(d.quantidadeUsada, 'Quantidade usada')
  for (const x of saidas) exigirInteiroPositivo(x.quantidade, 'Quantidade de cada parte')
  if (depois) exigirInteiroPositivo(depois.quantidade, 'Quantidade para depois')
  // perda = o que sobra depois das partes E do que ficou para depois
  const soma = saidas.reduce((s, x) => s + x.quantidade, 0) + (depois?.quantidade ?? 0)
  exigir(soma <= d.quantidadeUsada, `As partes somam ${unidadeTexto(lote.unidade, soma)}, mais do que foi usado (${unidadeTexto(lote.unidade, d.quantidadeUsada)}).`)
  const extra = d.custoExtraPrincipal ?? 0
  exigirInteiroPositivo(extra, 'Custo extra', true)
  const tipo = ctx.modulos.tipoItem(lote.moduloId, lote.tipoItem)
  const custoTotal = custoDe(lote, d.quantidadeUsada) + extra
  const perda = d.quantidadeUsada - soma
  // base do rateio: valor de mercado (quantidade × referência) quando todas têm referência; senão o peso
  const porValor = saidas.length > 0 && saidas.every((x) => x.valorReferencia && fatorValido(x.valorReferencia))
  const base = saidas.map((x) => (porValor ? multiplicarFator(x.quantidade, x.valorReferencia!, 'BOB') : x.quantidade))
  const somaBase = base.reduce((s, v) => s + v, 0)
  // o "para depois" leva o custo pelo peso (ainda não se sabe o valor); as partes dividem o resto
  const custoDepois = depois ? (saidas.length ? proporcao(custoTotal, depois.quantidade, soma) : custoTotal) : 0
  const custoPartes = custoTotal - custoDepois
  // códigos digitados: confere tudo ANTES de mexer no estoque (sem repetir entre si e sem existir)
  const { limpos, reservados } = await exigirCodigosLivres(ctx, 'lote', [...saidas.map((x) => x.codigo), depois?.codigo])
  await moverEstoque(ctx, {
    itemId: lote.id,
    delta: -d.quantidadeUsada,
    motivo: 'transformacao',
    origemId: d.id,
    descricao: d.descricao ?? `Separado em ${saidas.length} lote(s)${depois ? ` · ${unidadeTexto(lote.unidade, depois.quantidade)} para depois` : ''}${perda ? ` · perda ${unidadeTexto(lote.unidade, perda)}` : ''}`,
  })
  const criados: Id[] = []
  const compraIds = comprasDe(lote)
  let custoRestante = custoPartes
  for (const [k, x] of saidas.entries()) {
    const custo = k === saidas.length - 1 ? custoRestante : proporcao(custoPartes, base[k], somaBase)
    custoRestante -= custo
    const campos: Campos = { ...lote.campos, ...x.campos, separacaoId: d.id, rateio: porValor ? 'valor' : 'peso' }
    const nome = x.nome?.trim() || tipo.nomear?.(campos) || `${lote.nome} · parte ${k + 1}`
    const filho = novo<Item>(ctx, {
      id: x.id,
      moduloId: lote.moduloId,
      tipoItem: lote.tipoItem,
      nome,
      codigo: await codigoNovoLote(ctx, { codigo: limpos[k], paiId: lote.id, reservados }),
      unidade: lote.unidade,
      controlaEstoque: true,
      ativo: true,
      saldo: 0,
      precoSugerido: lote.precoSugerido,
      custoPrincipal: custo,
      quantidadeInicial: x.quantidade,
      origem: { tipo: 'transformacao', id: lote.id, pessoaId: lote.origem?.pessoaId, compraId: compraIds[0], compraIds: compraIds.length > 1 ? compraIds : undefined },
      triagem: { ...tg, papel: 'saida' },
      campos,
    })
    await ctx.repos.itens.salvar(filho)
    await moverEstoque(ctx, { itemId: filho.id, delta: x.quantidade, motivo: 'transformacao', origemId: lote.id, descricao: `Veio de ${lote.codigo ?? lote.nome}` })
    criados.push(filho.id)
  }
  if (depois) {
    const campos: Campos = { ...lote.campos, estado: NAO_IDENTIFICADO, separacaoId: d.id, rateio: 'peso' }
    const filho = novo<Item>(ctx, {
      id: depois.id,
      moduloId: lote.moduloId,
      tipoItem: lote.tipoItem,
      nome: NAO_IDENTIFICADO,
      codigo: await codigoNovoLote(ctx, { codigo: limpos[saidas.length], paiId: lote.id, reservados }),
      unidade: lote.unidade,
      controlaEstoque: true,
      ativo: true,
      saldo: 0,
      precoSugerido: lote.precoSugerido,
      custoPrincipal: custoDepois,
      quantidadeInicial: depois.quantidade,
      origem: { tipo: 'transformacao', id: lote.id, pessoaId: lote.origem?.pessoaId, compraId: compraIds[0], compraIds: compraIds.length > 1 ? compraIds : undefined },
      triagem: { ...tg, papel: 'saida' },
      campos,
    })
    await ctx.repos.itens.salvar(filho)
    await moverEstoque(ctx, { itemId: filho.id, delta: depois.quantidade, motivo: 'transformacao', origemId: lote.id, descricao: `Para depois (não identificado) · veio de ${lote.codigo ?? lote.nome}` })
    criados.push(filho.id)
  }
  // peso bruto (antes) → peso líquido (soma das partes) e a perda, com quem e quando (o log guarda o usuário)
  const pct = ((perda * 100) / d.quantidadeUsada).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  await auditar(
    ctx,
    'separarLote',
    lote.id,
    `${tg.codigo} · ${lote.codigo ?? lote.nome}: peso bruto ${unidadeTexto(lote.unidade, d.quantidadeUsada)} → líquido ${unidadeTexto(lote.unidade, soma)} em ${criados.length} lote(s) (${[...saidas.map((x) => x.quantidade), ...(depois ? [depois.quantidade] : [])].join(' + ')})${depois ? ` · ${unidadeTexto(lote.unidade, depois.quantidade)} para depois` : ''} · perda ${unidadeTexto(lote.unidade, perda)} (${pct}%)`,
    [d.id, ...criados],
  )
  return { id: d.id, codigo: tg.codigo, lotes: criados }
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

/** Situação do lote na lista: bruto (para separar), não identificado (ficou para depois), em preparação (limpeza), disponível, parcial (já saiu parte) ou esgotado. */
export type StatusLote = 'bruto' | 'naoIdentificado' | 'preparando' | 'disponivel' | 'parcial' | 'esgotado'

export function statusLote(i: Pick<Item, 'saldo' | 'campos' | 'quantidadeInicial' | 'faseTriagem'>): StatusLote {
  if (i.saldo <= 0) return 'esgotado'
  if (i.campos.estado === NAO_IDENTIFICADO) return 'naoIdentificado'
  if (i.campos.estado === 'Bruto') return i.faseTriagem && !i.faseTriagem.entrada ? 'preparando' : 'bruto'
  if (i.quantidadeInicial && i.saldo < i.quantidadeInicial) return 'parcial'
  return 'disponivel'
}

/** Filtro da tela Etiquetas: 'sem' = nunca impressa; 'impressa' = já saiu; 'todas' (ou nada) = todas. */
export type FiltroEtiqueta = 'sem' | 'impressa' | 'todas'
export function passaEtiqueta(i: Pick<Item, 'etiquetaImpressaEm' | 'etiquetaPeso' | 'saldo'>, f?: string) {
  // etiqueta VELHA (vendeu parte e o peso impresso não bate) volta para "Sem etiqueta": precisa reimprimir
  const velha = etiquetaVelha(i)
  return f === 'sem' ? !i.etiquetaImpressaEm || velha : f === 'impressa' ? !!i.etiquetaImpressaEm && !velha : true
}

/** A etiqueta diz um peso e o pacote tem outro (vendeu ou ajustou parte depois de imprimir). Ex.: diz 18 kg, tem 16 kg. */
export function etiquetaVelha(i: Pick<Item, 'etiquetaImpressaEm' | 'etiquetaPeso' | 'saldo'>) {
  return !!i.etiquetaImpressaEm && i.etiquetaPeso !== undefined && i.saldo > 0 && i.saldo !== i.etiquetaPeso
}

export async function estoque(ctx: Ctx, p: { moduloId?: string; somenteComSaldo?: boolean; etiqueta?: FiltroEtiqueta } = {}) {
  const itens = await ctx.repos.itens.listar(p.moduloId ? { moduloId: p.moduloId } : undefined)
  const porId = new Map(itens.map((i) => [i.id, i]))
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const usuarios = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u.nome]))
  const L = await leitorCadeia(ctx)
  const F = await leitorFotos(ctx, { porId: L.porId, compras })
  const siglas = await siglasPorPessoa(ctx)
  const vendido = new Map<Id, number>()
  for (const t of await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    if (t.etapa === 'concluido') for (const l of t.linhas) if (l.itemId) vendido.set(l.itemId, (vendido.get(l.itemId) ?? 0) + l.quantidade)
  return itens
    .filter((i) => i.controlaEstoque && i.ativo && (!p.somenteComSaldo || i.saldo > 0) && passaEtiqueta(i, p.etiqueta))
    .map((i) => (ctx.sessao.perfil === 'admin' ? i : { ...i, custoPrincipal: undefined }))
    .map((i) => {
      const ideal = i.estoqueIdeal ?? 0
      const cs = comprasDe(i).map((id) => compras.get(id)).filter((t): t is Transacao => !!t)
      const pai = i.origem?.tipo === 'transformacao' && i.origem.id ? porId.get(i.origem.id) : undefined
      const nomes = [...new Set(cs.map((t) => (t.pessoaId ? pessoas.get(t.pessoaId) : undefined)).filter(Boolean))]
      return {
        ...i,
        repor: Math.max(0, ideal - i.saldo),
        status: statusLote(i),
        vendido: vendido.get(i.id) ?? 0,
        entrada: i.criadoEm.slice(0, 10),
        compraId: cs[0]?.id,
        compraCodigo: cs.map((t) => t.codigo).filter(Boolean).join(', ') || undefined,
        compras: cs.map((t) => ({ id: t.id, codigo: t.codigo, fornecedor: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, fornecedorId: t.pessoaId })),
        fornecedor: (i.origem?.pessoaId ? pessoas.get(i.origem.pessoaId) : undefined) ?? (nomes.join(', ') || undefined),
        /** quem gerou o pacote (usuário que registrou a compra / fez a separação) */
        criadoPorNome: usuarios.get(i.criadoPor),
        etiquetaVelha: etiquetaVelha(i),
        pai: pai ? { id: pai.id, codigo: pai.codigo, nome: pai.nome } : undefined,
        unificadoDe: i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).map((id) => porId.get(id)?.codigo ?? id) : undefined,
        cadeia: L.cadeia(i.id),
        /** miniatura do lote (a própria mais nova ou a herdada) e quantas fotos próprias ele tem */
        foto: F.principal(i.id),
        fotosProprias: F.proprias(i.id),
        /** texto da busca: códigos atuais e anteriores (lote, compras, lote-mãe), fornecedor/comprador e a sigla */
        busca: [
          i.codigo, ...(i.codigosAnteriores ?? []), pai?.codigo, ...(pai?.codigosAnteriores ?? []),
          ...cs.flatMap((t) => [t.codigo, ...(t.codigosAnteriores ?? []), ...[t.pessoaId, t.compradorId].flatMap((x) => (x ? [pessoas.get(x), siglas.get(x)] : []))]),
          ...(i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).flatMap((id) => [porId.get(id)?.codigo, ...(porId.get(id)?.codigosAnteriores ?? [])]) : []),
        ].filter(Boolean).join(' ').toLowerCase(),
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Catálogo (serviços e produtos cadastrados). Serviço criado "só para este atendimento" (campos.avulso) fica de fora. */
export async function catalogo(ctx: Ctx, p: { moduloId?: string; incluirAvulsos?: boolean } = {}) {
  const itens = await ctx.repos.itens.listar(p.moduloId ? { moduloId: p.moduloId } : undefined)
  return itens
    .filter((i) => i.origem?.tipo === 'cadastro' || !i.controlaEstoque)
    .filter((i) => p.incluirAvulsos || !i.campos.avulso)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function movimentosDoItem(ctx: Ctx, p: { itemId: Id }) {
  const movs = await ctx.repos.movEstoque.listar({ itemId: p.itemId })
  return movs.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
}

/** Ações que contam a história da triagem de um lote (o "log da triagem"). */
const ACOES_TRIAGEM = ['unificarLotes', 'moverFaseTriagem', 'separarLote', 'marcarLotes', 'editarAtributosLote']

/**
 * PACOTE PARA VENDER (o que a funcionária vê ao ler o QR): foto, código, rótulo, situação, peso disponível e o preço de
 * venda pela tabela (coluna padrão). Nada de custo, margem, preço do fornecedor nem histórico; as compras de origem só
 * pelo código. Pacote bruto, não identificado ou esgotado volta com vendavel = false.
 * Ex.: P4 · 60 cm · Normal · Castanho · 2.008 g · 2.008 g × 17,5 = Bs 35.140.
 */
export async function pacoteVenda(ctx: Ctx, p: { id: Id }) {
  const i = await ctx.repos.itens.obter(p.id)
  exigir(i && i.controlaEstoque && i.ativo, 'Pacote não encontrado.')
  const status = statusLote(i)
  const grama = i.unidade === 'grama'
  const medida = i.campos.comprimento !== undefined && i.campos.comprimento !== '' ? Number(i.campos.comprimento) : undefined
  const categoria = i.campos.categoria ? String(i.campos.categoria) : undefined
  const cor = i.campos.cor ? String(i.campos.cor) : undefined
  const vendavel = i.saldo > 0 && (grama ? !['bruto', 'naoIdentificado', 'preparando'].includes(status) && !!medida : !!i.precoSugerido)
  // preço como no modo caixa: tabela da categoria (ou a geral) × coluna padrão
  let preco: { moeda: string; fator?: string; coluna?: string; total: number } | undefined
  if (vendavel && grama && medida) {
    const ts = (await ctx.repos.tabelasPreco.listar({ moduloId: i.moduloId }))
    const tb = ts.find((x) => (x.categoria ?? 'Normal') === (categoria ?? 'Normal')) ?? ts.find((x) => !x.categoria) ?? ts[0]
    const col = tb?.colunas[0]
    const fator = tb && col ? fatorDaTabela(tb, medida, col.id).fator : undefined
    if (tb && col && fator) preco = { moeda: tb.moeda, fator: fator.replace('.', ','), coluna: col.nome, total: multiplicarFator(i.saldo, fator, tb.moeda) }
  } else if (vendavel && i.precoSugerido) preco = { moeda: i.precoSugerido.moeda, total: i.precoSugerido.valor }
  const F = await leitorFotos(ctx)
  const compras = (await Promise.all(comprasDe(i).map((id) => ctx.repos.transacoes.obter(id)))).map((t) => t?.codigo).filter((c): c is string => !!c)
  return {
    id: i.id,
    codigo: i.codigo,
    nome: i.nome,
    rotulo: [medida !== undefined ? `${medida} cm` : undefined, categoria, cor].filter(Boolean).join(' · ') || i.nome,
    campos: { comprimento: i.campos.comprimento, categoria, cor },
    unidade: i.unidade,
    status,
    saldo: i.saldo,
    foto: F.principal(i.id),
    vendavel,
    preco,
    compras,
  }
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
        codigo: t.codigo,
        data: t.data,
        pessoaId: t.pessoaId,
        cliente: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
        quantidade: l.quantidade,
        totalPrincipal: l.totalPrincipal,
        custoPrincipal: l.custoPrincipal ?? 0,
        lucro: l.totalPrincipal - (l.custoPrincipal ?? 0),
      })),
  )
  const vendido = saidas.reduce((s, x) => s + x.totalPrincipal, 0)
  const custoVendido = saidas.reduce((s, x) => s + x.custoPrincipal, 0)
  const todos = await ctx.repos.itens.listar()
  const porId = new Map(todos.map((i) => [i.id, i]))
  const derivados = todos.filter((i) => i.origem?.tipo === 'transformacao' && i.origem.id === item.id)
  const transCompras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const auditoria = await ctx.repos.auditoria.listar()
  // ENTRADA: a compra de onde o lote veio (direto ou pelo lote-mãe); compras = todas (lote unificado tem várias)
  const pesoDe = (t: Transacao) => t.linhas.reduce((s, l) => s + l.quantidade, 0)
  const compraId = comprasDe(item)[0]
  const tc = compraId ? (compra?.id === compraId ? compra : await ctx.repos.transacoes.obter(compraId)) : undefined
  const pesoCompra = tc ? pesoDe(tc) : 0
  const entrada = tc
    ? { id: tc.id, codigo: tc.codigo, data: tc.data, obs: tc.obs, total: tc.totalPrincipal, peso: pesoCompra, custoKg: pesoCompra ? Math.round((tc.totalPrincipal * 1000) / pesoCompra) : 0 }
    : undefined
  const compras = comprasDe(item)
    .map((id) => transCompras.get(id))
    .filter((t): t is Transacao => !!t)
    .map((t) => {
      const peso = pesoDe(t)
      const f = t.pessoaId ? pessoas.get(t.pessoaId) : undefined
      return { id: t.id, codigo: t.codigo, data: t.data, obs: t.obs, total: t.totalPrincipal, peso, custoKg: peso ? Math.round((t.totalPrincipal * 1000) / peso) : 0, fornecedor: f ? { id: f.id, nome: f.nome } : undefined }
    })
  // TRIAGEM: em que lotes este foi separado (peso bruto → líquido, perda, quem e quando), ou de que lote veio (e os irmãos)
  const parte = (i: Item) => ({ id: i.id, codigo: i.codigo, nome: i.nome, campos: i.campos, quantidade: i.quantidadeInicial ?? 0, saldo: i.saldo, custo: i.custoPrincipal ?? 0, atual: i.id === item.id })
  const separacoesDe = (lote: Item, ms: MovEstoque[]) =>
    ms
      .filter((m) => m.motivo === 'transformacao' && m.delta < 0)
      .map((m) => {
        const partes = todos.filter((i) => i.origem?.tipo === 'transformacao' && i.origem.id === lote.id && i.campos.separacaoId === m.origemId).map(parte)
        const gerado = partes.reduce((s, x) => s + x.quantidade, 0)
        const usado = -m.delta
        const log =
          auditoria.find((a) => a.acao === 'separarLote' && !!m.origemId && !!a.ligados?.includes(m.origemId)) ??
          auditoria.filter((a) => a.acao === 'separarLote' && a.alvoId === lote.id && a.criadoEm >= m.criadoEm).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))[0]
        return { id: m.origemId, data: m.data, em: log?.criadoEm ?? m.criadoEm, por: log?.usuarioNome, logId: log?.id, usado, pesoBruto: usado, pesoLiquido: gerado, partes, perda: usado - gerado, perdaPct: Math.round(((usado - gerado) * 10000) / usado) }
      })
  const separacoes = separacoesDe(item, movimentos)
  const pai = item.origem?.tipo === 'transformacao' && item.origem.id ? porId.get(item.origem.id) : undefined
  const irmaos = pai ? todos.filter((i) => i.id !== item.id && i.origem?.tipo === 'transformacao' && i.origem.id === pai.id && i.campos.separacaoId === item.campos.separacaoId).map(parte) : []
  const triagemPai = pai ? separacoesDe(pai, await ctx.repos.movEstoque.listar({ itemId: pai.id })).find((s) => s.id === item.campos.separacaoId) : undefined
  // DNA: compra(s) → [unificação] → lote bruto → triagem → este lote (e os irmãos) → vendas
  const bruto = pai ?? item
  const u = bruto.origem?.tipo === 'unificacao' ? bruto : undefined
  const movsU = u ? await ctx.repos.movEstoque.listar({ origemId: u.id }) : []
  const logU = u ? auditoria.find((a) => a.acao === 'unificarLotes' && a.alvoId === u.id) : undefined
  const unificacao = u
    ? {
        id: u.id,
        codigo: u.codigo,
        nome: u.nome,
        em: logU?.criadoEm ?? u.criadoEm,
        por: logU?.usuarioNome,
        total: u.quantidadeInicial ?? 0,
        fontes: (u.origem?.ids ?? []).map((id) => {
          const f = porId.get(id)
          return { id, codigo: f?.codigo, nome: f?.nome ?? id, quantidade: -movsU.filter((m) => m.itemId === id && m.delta < 0).reduce((s, m) => s + m.delta, 0), compras: comprasDe(f).map((c) => transCompras.get(c)?.codigo ?? c) }
        }),
      }
    : undefined
  // este lote foi unificado em outro (destino)
  const unificadoEm = movimentos
    .filter((m) => m.motivo === 'unificacao' && m.delta < 0 && m.origemId)
    .map((m) => ({ id: m.origemId!, codigo: porId.get(m.origemId!)?.codigo, nome: porId.get(m.origemId!)?.nome ?? '', quantidade: -m.delta, em: m.criadoEm }))
  const dna = { compras, unificacao, bruto: { ...parte(bruto), fase: bruto.faseTriagem?.fase ?? 'aguardando', estado: bruto.campos.estado }, triagens: pai ? (triagemPai ? [triagemPai] : []) : separacoes }
  // LOG DA TRIAGEM: quem fez o quê (unificar, preparar, separar, marcar), com peso bruto × líquido e perda
  const ligados = new Set<Id>([item.id, bruto.id, ...(u ? [u.id, ...(u.origem?.ids ?? [])] : []), ...irmaos.map((x) => x.id), ...unificadoEm.map((x) => x.id)])
  const seps = [...separacoes, ...(triagemPai ? [triagemPai] : [])]
  const logTriagem = auditoria
    .filter((a) => ACOES_TRIAGEM.includes(a.acao) && ((a.alvoId && ligados.has(a.alvoId)) || a.ligados?.some((x) => ligados.has(x))))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
    .map((a) => {
      const s = a.acao === 'separarLote' ? seps.find((x) => x.logId === a.id) : undefined
      const un = a.acao === 'unificarLotes' ? porId.get(a.alvoId ?? '') : undefined
      const pesos = s
        ? { pesoBruto: s.pesoBruto, pesoLiquido: s.pesoLiquido, perda: s.perda, perdaPct: s.perdaPct }
        : un
          ? { pesoBruto: un.quantidadeInicial ?? 0, pesoLiquido: un.quantidadeInicial ?? 0, perda: 0, perdaPct: 0 }
          : {}
      return { id: a.id, em: a.criadoEm, por: a.usuarioNome, acao: a.acao, nome: nomeAcao(a.acao), resumo: a.resumo, ...pesos } as { id: Id; em: string; por?: string; acao: string; nome: string; resumo: string; pesoBruto?: number; pesoLiquido?: number; perda?: number; perdaPct?: number }
    })
  // para onde foi cada grama: comprado → vendido → separado → unificado → perda → em estoque
  const inicial = item.quantidadeInicial ?? movimentos.filter((m) => m.delta > 0 && m.motivo !== 'cancelamento' && m.motivo !== 'correcao').reduce((s, m) => s + m.delta, 0)
  const gVendido = saidas.reduce((s, x) => s + x.quantidade, 0)
  const gSeparado = separacoes.reduce((s, x) => s + x.usado - x.perda, 0)
  const gUnificado = unificadoEm.reduce((s, x) => s + x.quantidade, 0)
  const perdaSeparacao = separacoes.reduce((s, x) => s + x.perda, 0)
  const perdaAjuste = -movimentos.filter((m) => (m.motivo === 'perda' || m.motivo === 'ajuste') && m.delta < 0).reduce((s, m) => s + m.delta, 0)
  // FOTOS: as do lote primeiro, depois as herdadas (lotes de origem e compras), por referência
  const fotos = (await leitorFotos(ctx, { porId, compras: transCompras })).fotosDe(item.id)
  return {
    item, movimentos, anexos: [...anexos, ...anexosCompra], compra, fornecedor, saidas, vendido, custoVendido, lucro: vendido - custoVendido, derivados,
    fotos,
    fotoPrincipal: fotos[0],
    status: statusLote(item),
    entrada,
    separacoes,
    pai: pai ? parte(pai) : undefined,
    irmaos,
    dna,
    unificadoEm,
    logTriagem,
    fluxo: { inicial, vendido: gVendido, separado: gSeparado, unificado: gUnificado, perda: perdaSeparacao + perdaAjuste, perdaSeparacao, saldo: item.saldo },
  }
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
  /** gramas que foram para um lote unificado */
  unificado: number
  perdasAjustes: number
  saldo: number
  custo: number
  receita: number
  lucro: number
  vendas: VendaRastreio[]
  filhos: NoRastreio[]
  /** lote nascido da unificação de vários (mostra de quais) */
  unificacao?: { fontes: { id: Id; codigo?: string }[] }
  /** lote unificado que já apareceu em outro galho (não soma de novo) */
  repetido?: boolean
}

/**
 * RASTREIO (origem × destino): da compra até cada venda parcial. Funciona a partir da compra ou de qualquer lote.
 * Cada nó: entrou, vendido, separado em outros lotes, perdas/ajustes, saldo, custo, receita e lucro (com os filhos).
 */
export async function rastreio(ctx: Ctx, p: { compraId?: Id; itemId?: Id }) {
  const itens = await ctx.repos.itens.listar()
  const porId = new Map(itens.map((i) => [i.id, i]))
  let compraIds = p.compraId ? [p.compraId] : []
  if (!p.compraId && p.itemId) {
    const i = porId.get(p.itemId)
    exigir(i, 'Lote não encontrado.')
    compraIds = comprasDe(i)
  }
  const compras = (await Promise.all(compraIds.map((id) => ctx.repos.transacoes.obter(id)))).filter((t): t is Transacao => !!t)
  const compra = compras[0]
  const ids = new Set(compras.map((t) => t.id))
  const raizes = compras.length
    ? itens.filter((i) => i.origem?.tipo === 'compra' && ids.has(i.origem.id ?? ''))
    : p.itemId && porId.get(p.itemId)
      ? [porId.get(p.itemId)!]
      : []
  const movs = await ctx.repos.movEstoque.listar()
  const vendasTodas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa === 'concluido')
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const vistos = new Set<Id>()
  const montar = (item: Item): NoRastreio => {
    const unificacao = item.origem?.tipo === 'unificacao' ? { fontes: (item.origem.ids ?? []).map((id) => ({ id, codigo: porId.get(id)?.codigo })) } : undefined
    if (vistos.has(item.id)) return { item, entrada: 0, vendido: 0, separado: 0, unificado: 0, perdasAjustes: 0, saldo: 0, custo: 0, receita: 0, lucro: 0, vendas: [], filhos: [], unificacao, repetido: true }
    vistos.add(item.id)
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
    const filhos = itens.filter((i) => lotesDeOrigem(i).includes(item.id)).map(montar)
    const receitaPropria = vendas.reduce((s, v) => s + v.totalPrincipal, 0)
    const custoVendido = vendas.reduce((s, v) => s + v.custo, 0)
    return {
      item,
      entrada: soma((m) => m.delta > 0 && (m.motivo === 'compra' || m.motivo === 'transformacao' || m.motivo === 'unificacao' || m.descricao === 'Quantidade inicial do cadastro')),
      vendido: vendas.reduce((s, v) => s + v.quantidade, 0),
      separado: -soma((m) => m.motivo === 'transformacao' && m.delta < 0),
      unificado: -soma((m) => m.motivo === 'unificacao' && m.delta < 0),
      perdasAjustes: soma((m) => m.motivo === 'ajuste' || m.motivo === 'perda') ,
      saldo: item.saldo,
      custo: item.custoPrincipal ?? 0,
      receita: receitaPropria + filhos.reduce((s, f) => s + f.receita, 0),
      lucro: receitaPropria - custoVendido + filhos.reduce((s, f) => s + f.lucro, 0),
      vendas,
      filhos,
      unificacao,
    }
  }
  const arvore = raizes.map(montar)
  const somar = (nos: NoRastreio[], f: (n: NoRastreio) => number): number => nos.reduce((s, n) => s + f(n) + somar(n.filhos, f), 0)
  const entradas = arvore.reduce((s, n) => s + n.entrada, 0)
  return {
    compra,
    fornecedor: compra?.pessoaId ? pessoas.get(compra.pessoaId) : undefined,
    compras: compras.map((t) => ({ id: t.id, codigo: t.codigo, data: t.data, fornecedor: t.pessoaId ? pessoas.get(t.pessoaId) : undefined })),
    arvore,
    resumo: {
      comprado: entradas,
      custoCompra: compras.length ? compras.reduce((s, t) => s + t.totalPrincipal, 0) : arvore.reduce((s, n) => s + n.custo, 0),
      vendido: somar(arvore, (n) => n.vendido),
      emEstoque: somar(arvore, (n) => n.saldo),
      perdaNaSeparacao: somar(arvore, (n) => n.separado - n.filhos.filter((f) => !f.unificacao).reduce((s, f) => s + f.entrada, 0)),
      receita: arvore.reduce((s, n) => s + n.receita, 0),
      lucroRealizado: arvore.reduce((s, n) => s + n.lucro, 0),
      vendas: somar(arvore, (n) => n.vendas.length),
      lotes: somar(arvore, () => 1),
    },
  }
}

// ---------- atributos dos lotes (admin) ----------

const CAMPOS_INTERNOS = ['separacaoId', 'rateio', 'tabelaId', 'colunaId', 'calculo']

function textoValor(v: Campos[string]) {
  return v === undefined || v === null || v === '' ? '—' : v === true ? 'sim' : v === false ? 'não' : String(v)
}

/** Aplica atributos num item (valida pelo tipo; recalcula o nome) e devolve o "antes → depois" para o log. */
export async function aplicarCampos(ctx: Ctx, item: Item, campos: Campos) {
  const tipo = ctx.modulos.tipoItem(item.moduloId, item.tipoItem)
  const defs = new Map(tipo.campos.map((c) => [c.id, c]))
  const novos: Campos = { ...item.campos }
  const mudou: string[] = []
  for (const [k, v0] of Object.entries(campos)) {
    const def = defs.get(k)
    exigir(def && !CAMPOS_INTERNOS.includes(k), `Atributo desconhecido: ${k}.`)
    const v = v0 === '' || v0 === null ? undefined : v0
    if (v !== undefined) {
      if (def.tipo === 'lista') exigir(!def.opcoes?.length || def.opcoes.includes(String(v)), `${def.nome}: "${v}" não está na lista.`)
      if (def.tipo === 'numero') exigir(typeof v === 'number' && Number.isFinite(v) && v >= 0, `${def.nome}: número inválido.`)
      if (def.tipo === 'simNao') exigir(typeof v === 'boolean', `${def.nome}: use sim ou não.`)
    }
    if (textoValor(item.campos[k]) === textoValor(v)) continue
    mudou.push(`${def.nome}: ${textoValor(item.campos[k])} → ${textoValor(v)}`)
    if (v === undefined) delete novos[k]
    else novos[k] = v
  }
  if (!mudou.length) return undefined
  // mudou a situação (bruto ⇄ separado): a coluna da triagem volta a ser a calculada
  const faseTriagem = novos.estado === item.campos.estado ? item.faseTriagem : undefined
  const nomeAntes = tipo.nomear?.(item.campos)
  const nomeDepois = tipo.nomear?.(novos)
  const nome = nomeDepois && (nomeDepois !== nomeAntes || item.nome === NAO_IDENTIFICADO) ? nomeDepois : item.nome
  if (nome !== item.nome) mudou.push(`Nome: ${item.nome} → ${nome}`)
  await ctx.repos.itens.salvar(tocar(ctx, { ...item, campos: novos, nome, faseTriagem }))
  return mudou
}

/** Muda atributos de vários lotes de uma vez (ex.: marcar 12 lotes como "Separado"). Uma linha no log por lote. */
export async function marcarLotes(ctx: Ctx, d: { ids: Id[]; campos: Campos }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador muda atributos em massa.')
  exigir(d.ids?.length, 'Escolha pelo menos um lote.')
  exigir(d.campos && Object.keys(d.campos).length, 'Diga o que mudar.')
  const alterados: Id[] = []
  for (const id of new Set(d.ids)) {
    const item = await ctx.repos.itens.obter(id)
    exigir(item, 'Lote não encontrado.')
    const mudou = await aplicarCampos(ctx, item, d.campos)
    if (!mudou) continue
    await auditar(ctx, 'marcarLotes', item.id, `${item.codigo ?? item.nome}: ${mudou.join('; ')}`)
    alterados.push(item.id)
  }
  return { alterados }
}

/** Edita os atributos de um lote (fica no log com antes → depois; muda o nome se a medida/categoria/cor mudar). */
export async function editarAtributosLote(ctx: Ctx, d: { id: Id; campos: Campos; motivo?: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador edita atributos.')
  const item = await ctx.repos.itens.obter(d.id)
  exigir(item, 'Lote não encontrado.')
  const mudou = await aplicarCampos(ctx, item, d.campos ?? {})
  exigir(mudou, 'Nada mudou.')
  await auditar(ctx, 'editarAtributosLote', item.id, `${item.codigo ?? item.nome}: ${mudou.join('; ')}${d.motivo?.trim() ? ` · ${d.motivo.trim()}` : ''}`)
  return { id: item.id, nome: (await ctx.repos.itens.obter(item.id))!.nome }
}

/**
 * Etiquetas impressas (chamado quando a pessoa manda imprimir): guarda quando e quem em cada lote, para a tela
 * Etiquetas separar "Sem etiqueta" de "Já impressa". Reimprimir atualiza a data. Uma linha no log por lote.
 */
export async function marcarEtiquetasImpressas(ctx: Ctx, d: { ids: Id[] }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador marca etiquetas.')
  exigir(d.ids?.length, 'Escolha pelo menos um lote.')
  exigir(d.ids.length <= 500, 'No máximo 500 etiquetas de uma vez.')
  const em = ctx.relogio.agora()
  const marcados: Id[] = []
  for (const id of new Set(d.ids)) {
    const item = await ctx.repos.itens.obter(id)
    exigir(item && item.controlaEstoque, 'Lote não encontrado.')
    const antes = item.etiquetaImpressaEm
    await ctx.repos.itens.salvar(tocar(ctx, { ...item, etiquetaImpressaEm: em, etiquetaImpressaPor: ctx.sessao.nome || undefined, etiquetaPeso: item.saldo }))
    await auditar(ctx, 'marcarEtiquetasImpressas', item.id, `${item.codigo ?? item.nome}: ${antes ? 'etiqueta impressa de novo' : 'etiqueta impressa'}`)
    marcados.push(item.id)
  }
  return { marcados, em }
}

/**
 * RESERVAR um pacote para uma cliente (encomenda): fica 🔒 no estoque e a venda avisa se for para outra pessoa.
 * Sem `para` (ou `tirar`) = tira a reserva. Ex.: Ana pediu 60 cm Preto para sexta → reserva L-0004 para Ana até sexta.
 */
export async function reservarLote(ctx: Ctx, d: { id: Id; para?: string; ate?: string; obs?: string; tirar?: boolean }) {
  const item = await ctx.repos.itens.obter(d.id)
  exigir(item && item.controlaEstoque, 'Lote não encontrado.')
  const para = (d.para ?? '').trim()
  if (d.tirar || !para) {
    if (!item.reserva) return { id: item.id }
    await ctx.repos.itens.salvar(tocar(ctx, { ...item, reserva: undefined }))
    await auditar(ctx, 'reservarLote', item.id, `${item.codigo ?? item.nome}: reserva para ${item.reserva.para} tirada`)
    return { id: item.id }
  }
  exigir(item.saldo > 0, 'Este pacote não tem mais peso para reservar.')
  exigir(para.length <= 80, 'Nome muito longo.')
  exigir(!d.ate || /^\d{4}-\d{2}-\d{2}$/.test(d.ate), 'Data inválida.', 'ate')
  const reserva = { para, ate: d.ate || undefined, obs: d.obs?.trim() || undefined, em: ctx.relogio.agora(), porNome: ctx.sessao.nome || undefined }
  await ctx.repos.itens.salvar(tocar(ctx, { ...item, reserva }))
  await auditar(ctx, 'reservarLote', item.id, `${item.codigo ?? item.nome}: reservado para ${para}${reserva.ate ? ` até ${reserva.ate}` : ''}${reserva.obs ? ` · ${reserva.obs}` : ''}`)
  return { id: item.id }
}

/**
 * "Errou? Gerar nova": cancela a etiqueta impressa (motivo no histórico) e abre a próxima via (2ª, 3ª…). O código do
 * lote (QR e barras) continua o mesmo, então a leitura não muda; o papel novo mostra "2ª via" para não confundir com o
 * antigo. O lote volta para "Sem etiqueta" até a nova ser impressa (marcarEtiquetasImpressas).
 */
export async function refazerEtiqueta(ctx: Ctx, d: { id: Id; motivo: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador refaz etiquetas.')
  const motivo = (d.motivo ?? '').trim()
  exigir(motivo, 'Diga por que a etiqueta foi cancelada.')
  exigir(motivo.length <= 200, 'Motivo muito longo (máx. 200 letras).')
  const item = await ctx.repos.itens.obter(d.id)
  exigir(item && item.controlaEstoque, 'Lote não encontrado.')
  const antiga = item.etiquetaVia ?? 1
  const via = antiga + 1
  const em = ctx.relogio.agora()
  await ctx.repos.itens.salvar(tocar(ctx, {
    ...item,
    etiquetaVia: via,
    etiquetaCancelada: { motivo, em, porNome: ctx.sessao.nome || undefined, via: antiga },
    etiquetaImpressaEm: undefined,
    etiquetaImpressaPor: undefined,
  }))
  await auditar(ctx, 'refazerEtiqueta', item.id, `${item.codigo ?? item.nome}: etiqueta cancelada (${motivo}) · nova ${via}ª via gerada`)
  return { id: item.id, via }
}

// ---------- cadeia: Compra(s) → Triagem(ns) → Venda(s) ----------

export interface Cadeia {
  compras: { id: Id; codigo?: string; fornecedor?: string }[]
  triagens: { id: Id; codigo: string }[]
  vendas: { id: Id; codigo: string }[]
}

/**
 * Lê tudo uma vez e devolve a CADEIA de qualquer lote: de que compra(s) veio, por que triagem(ns) passou (antes e
 * depois dele) e em que venda(s) terminou (dele e dos lotes que saíram dele). Uma compra não fica junta para sempre:
 * pode ir para várias triagens, e uma triagem pode misturar várias compras.
 */
export async function leitorCadeia(ctx: Ctx) {
  // pacotes de triagem DESFEITA não fazem parte da cadeia (o peso já voltou para o pacote de entrada)
  const itens = (await ctx.repos.itens.listar()).filter((i) => !i.campos.triagemDesfeita)
  const porId = new Map(itens.map((i) => [i.id, i]))
  const filhos = new Map<Id, Id[]>()
  for (const i of itens) for (const o of lotesDeOrigem(i)) filhos.set(o, [...(filhos.get(o) ?? []), i.id])
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p.nome]))
  const vendasDe = new Map<Id, Transacao[]>()
  for (const t of await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    if (t.etapa === 'concluido')
      for (const l of t.linhas)
        if (l.itemId) {
          const a = vendasDe.get(l.itemId) ?? []
          if (!a.includes(t)) a.push(t)
          vendasDe.set(l.itemId, a)
        }
  const codigoVenda = (t: Transacao) => t.codigo ?? `V·${t.id.slice(-4).toUpperCase()}`
  const andar = (id: Id, prox: (id: Id) => Id[], vistos = new Set<Id>()) => {
    for (const x of prox(id)) if (!vistos.has(x)) (vistos.add(x), andar(x, prox, vistos))
    return vistos
  }
  const descendentes = (id: Id) => andar(id, (x) => filhos.get(x) ?? [])
  const ancestrais = (id: Id) => andar(id, (x) => lotesDeOrigem(porId.get(x)))
  const compraCurta = (id: Id) => {
    const t = compras.get(id)
    return { id, codigo: t?.codigo, fornecedor: t?.pessoaId ? pessoas.get(t.pessoaId) : undefined }
  }
  const vendasDosLotes = (ids: Iterable<Id>) => {
    const vs = new Map<Id, Transacao>()
    for (const x of ids) for (const t of vendasDe.get(x) ?? []) vs.set(t.id, t)
    return [...vs.values()].sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? -1 : 1)).map((t) => ({ id: t.id, codigo: codigoVenda(t) }))
  }
  const cadeia = (id: Id): Cadeia => {
    const linha = [...ancestrais(id), id, ...descendentes(id)]
    const ts = new Map<Id, Pick<Triagem, 'id' | 'codigo' | 'em'>>()
    for (const x of linha) {
      const i = porId.get(x)
      // lotes separados antes do número de triagem: a separação vale como triagem
      const sep = i?.origem?.tipo === 'transformacao' ? (i.campos.separacaoId as string | undefined) : undefined
      const tg = i?.triagem ?? (sep ? { id: sep, codigo: `T·${sep.slice(-4).toUpperCase()}`, em: i!.criadoEm } : undefined)
      if (tg) ts.set(tg.id, tg)
    }
    return {
      compras: comprasDe(porId.get(id)).map(compraCurta),
      triagens: [...ts.values()].sort((a, b) => (a.em < b.em ? -1 : 1)).map((x) => ({ id: x.id, codigo: x.codigo })),
      vendas: vendasDosLotes([id, ...descendentes(id)]),
    }
  }
  return { cadeia, itens, porId, compras, pessoas, vendasDe, vendasDosLotes, descendentes, compraCurta, codigoVenda }
}
