// LIVRO DO CABELO (como um livro caixa, mas em gramas) e HISTÓRICO DO PACOTE (como o caixa do dia).
// O estoque é a soma dos movimentos de gramas: entrada da compra, diferença na conferência, triagem (sai do bruto /
// entram os pacotes), lavagem, perda, venda e ajuste. Nada some e nada é apagado: aqui só se LÊ o que já foi gravado
// (MovEstoque, com antes → depois e quem fez) e se liga cada lançamento ao registro de origem.

import type { Id, Item, MovEstoque, Transacao } from '../domain/tipos'
import type { Ctx } from './contexto'
import { comprasDe, lotesDeOrigem } from './estoque'
import { type OrigemCompra, origemDoPacote } from './origem'
import { genealogia } from './triagem'

export type TipoLivro = 'entrada' | 'diferenca' | 'triagemSaida' | 'triagemEntrada' | 'lavagem' | 'perda' | 'venda' | 'ajuste'

export const NOMES_TIPO_LIVRO: Record<TipoLivro, string> = {
  entrada: 'Entrada (compra)',
  diferenca: 'Diferença de peso',
  triagemSaida: 'Triagem: saiu',
  triagemEntrada: 'Triagem: entrou',
  lavagem: 'Lavagem',
  perda: 'Perda',
  venda: 'Venda',
  ajuste: 'Ajuste',
}

/** Referência clicável: a tela e os parâmetros que abrem o registro de origem. */
export interface RefLivro {
  tela: string
  params: Record<string, string>
  rotulo: string
}

/** Tipo do lançamento pelo motivo do movimento (a conferência de peso e a lavagem se reconhecem pelo texto).
 *  deCompra: o movimento é ligado a uma compra (cancelar/recusar a compra é entrada desfeita, não venda). */
export function tipoDoMovimento(m: Pick<MovEstoque, 'motivo' | 'delta' | 'descricao'>, deCompra = false): TipoLivro {
  const motivo = String(m.motivo)
  const d = m.descricao ?? ''
  if (motivo === 'diferenca' || ((motivo === 'ajuste' || motivo === 'perda') && /diferen[cç]a de peso|confer[eê]ncia/i.test(d))) return 'diferenca'
  if (motivo === 'compra' || (motivo === 'cancelamento' && (deCompra || /compra cancelada/i.test(d)))) return 'entrada'
  if (motivo === 'transformacao' || motivo === 'unificacao') return m.delta < 0 ? 'triagemSaida' : 'triagemEntrada'
  if (motivo === 'perda') return /lavagem/i.test(d) ? 'lavagem' : 'perda'
  if (motivo === 'venda' || motivo === 'uso' || motivo === 'cancelamento' || motivo === 'correcao') return 'venda'
  return 'ajuste'
}

/** chave da triagem de um lote (o mesmo critério da genealogia) */
const chaveTriagem = (i?: Item) => i?.triagem?.id ?? (i?.origem?.tipo === 'transformacao' ? (i.campos.separacaoId as string | undefined) : undefined)

/** Lê tudo uma vez: lotes, movimentos, compras, vendas, nomes e quem fez. */
async function leitorLivro(ctx: Ctx) {
  const itens = await ctx.repos.itens.listar()
  const porId = new Map(itens.map((i) => [i.id, i]))
  const movs = await ctx.repos.movEstoque.listar()
  const transacoes = await ctx.repos.transacoes.listar()
  const trans = new Map(transacoes.map((t) => [t.id, t] as [Id, Transacao]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p.nome]))
  const usuarios = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u.nome]))
  // código de cada triagem (T-0003) pela chave
  const triagens = new Map<Id, string>()
  for (const i of itens) {
    const k = chaveTriagem(i)
    if (k && !triagens.has(k)) triagens.set(k, i.triagem?.codigo ?? `T·${k.slice(-4).toUpperCase()}`)
  }
  const tipoDe = (m: MovEstoque) => tipoDoMovimento(m, !!m.origemId && trans.get(m.origemId)?.tipo === 'compra')
  const codigoTransacao = (t?: Transacao) => t?.codigo ?? (t ? `${t.tipo === 'venda' ? 'V' : 'P'}·${t.id.slice(-4).toUpperCase()}` : '')
  /** de que triagem é este movimento de triagem */
  const triagemDoMov = (m: MovEstoque) => {
    const i = porId.get(m.itemId)
    if (m.motivo === 'transformacao') return m.delta < 0 ? m.origemId : chaveTriagem(i)
    if (m.motivo === 'unificacao') return m.delta < 0 ? chaveTriagem(porId.get(m.origemId ?? '')) ?? m.origemId : chaveTriagem(i)
    return undefined
  }
  /** título, quem e a referência clicável de um movimento */
  const descrever = (m: MovEstoque) => {
    const tipo = tipoDe(m)
    const i = porId.get(m.itemId)
    const t = m.origemId ? trans.get(m.origemId) : undefined
    const nomePessoa = t?.pessoaId ? pessoas.get(t.pessoaId) : undefined
    let titulo: string = NOMES_TIPO_LIVRO[tipo]
    let ref: RefLivro | undefined
    if ((tipo === 'entrada' || tipo === 'diferenca') && (t?.tipo === 'compra' || comprasDe(i).length)) {
      const c = t?.tipo === 'compra' ? t : trans.get(comprasDe(i)[0])
      if (c) {
        const nome = c.pessoaId ? pessoas.get(c.pessoaId) : undefined
        if (tipo === 'entrada') titulo = m.motivo === 'cancelamento' ? `Compra ${codigoTransacao(c)} cancelada` : `Entrada da compra ${codigoTransacao(c)}${nome ? ` · ${nome}` : ''}`
        ref = { tela: 'pedido', params: { id: c.id }, rotulo: `compra ${codigoTransacao(c)}` }
      }
    } else if (tipo === 'triagemEntrada' || tipo === 'triagemSaida') {
      const k = triagemDoMov(m)
      const cod = k ? triagens.get(k) ?? `T·${k.slice(-4).toUpperCase()}` : ''
      titulo = tipo === 'triagemEntrada' ? `Entrou da triagem ${cod}` : m.motivo === 'unificacao' ? `Juntado na triagem ${cod}` : `Saiu para a triagem ${cod}`
      if (k) ref = { tela: 'triagem', params: { aba: 'triagens', t: k }, rotulo: `triagem ${cod}` }
    } else if (tipo === 'venda' && t) {
      const v = codigoTransacao(t)
      titulo = m.motivo === 'cancelamento' ? `Venda ${v} cancelada` : m.motivo === 'correcao' ? `Correção da venda ${v}` : m.motivo === 'uso' ? `Usado no atendimento ${v}` : `Venda ${v}`
      if (nomePessoa) titulo += ` · ${nomePessoa}`
      ref = { tela: 'venda', params: { id: t.id }, rotulo: `venda ${v}` }
    } else if (tipo === 'lavagem') titulo = 'Perda de lavagem'
    if (!ref && i) ref = { tela: 'lote', params: { id: i.id }, rotulo: `pacote ${i.codigo ?? i.nome}` }
    return { tipo, titulo, ref, por: m.porNome ?? usuarios.get(m.criadoPor) }
  }
  return { itens, porId, movs, trans, pessoas, usuarios, descrever, codigoTransacao, tipoDe }
}

// ---------- histórico do pacote (o "log do item", no formato do caixa do dia) ----------

/** ações do log que mudam o pacote sem mexer nos gramas (aparecem no histórico, sem antes → depois) */
const EVENTOS_PACOTE: Record<string, string> = {
  moverFaseTriagem: 'Mudou de coluna na triagem',
  editarAtributosLote: 'Atributos editados',
  marcarLotes: 'Atributos mudados em massa',
  marcarEtiquetasImpressas: 'Etiqueta impressa',
  refazerEtiqueta: 'Etiqueta cancelada · nova via',
  trocarCodigoLote: 'Código trocado',
}

export interface MovHistorico {
  id: Id
  em: string
  tipo: TipoLivro | 'evento'
  nomeTipo: string
  titulo: string
  delta: number
  antes: number
  depois: number
  por?: string
  ref?: RefLivro
  descricao?: string
  /** entrada da triagem: as compras de origem com os gramas de cada uma e os pacotes que entraram */
  origem?: OrigemCompra[]
  fontes?: { id: Id; codigo?: string; g: number }[]
}

/**
 * HISTÓRICO DO PACOTE: tudo o que entrou e saiu, dia a dia (mais novo em cima), com o saldo do começo e do fim do dia,
 * antes → depois, hora, quem e a referência. Ex.: 6.000 → 4.500 g na venda V-9.
 */
export async function historicoPacote(ctx: Ctx, p: { itemId: Id }) {
  const L = await leitorLivro(ctx)
  const item = L.porId.get(p.itemId)
  if (!item) return { item: undefined, dias: [] }
  const movs = L.movs.filter((m) => m.itemId === item.id).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  // origem em gramas (compras) para o movimento de entrada da triagem; sem a origem calculada, as compras da genealogia
  let origem: OrigemCompra[] | undefined
  if (movs.some((m) => L.tipoDe(m) === 'triagemEntrada')) {
    origem = await origemDoPacote(ctx, { itemId: item.id, gramas: item.quantidadeInicial ?? undefined }).catch(() => [])
    if (!origem.length) {
      const g = await genealogia(ctx, { itemId: item.id })
      origem = g.compras.filter((c) => comprasDe(item).includes(c.id)).map((c) => ({ compraId: c.id, codigo: c.codigo, fornecedor: c.fornecedor, data: c.data, gramas: c.g }))
    }
  }
  const linhas: MovHistorico[] = movs.map((m) => {
    const d = L.descrever(m)
    const entradaTriagem = d.tipo === 'triagemEntrada'
    // pacotes que entraram: os juntados (com os gramas que cada um deu) ou o lote-mãe; o lote juntado e separado no
    // mesmo passo (intermediário) não aparece: mostra os pacotes que formaram ele
    const juntados = (id: Id) => L.movs.filter((x) => x.motivo === 'unificacao' && x.origemId === id && x.delta < 0).map((x) => ({ id: x.itemId, codigo: L.porId.get(x.itemId)?.codigo, g: -x.delta }))
    const fontes = !entradaTriagem
      ? undefined
      : m.motivo === 'unificacao'
        ? juntados(item.id)
        : lotesDeOrigem(item).flatMap((id) => (L.porId.get(id)?.triagem?.papel === 'intermediario' ? juntados(id) : [{ id, codigo: L.porId.get(id)?.codigo, g: m.delta }]))
    return { id: m.id, em: m.criadoEm, tipo: d.tipo, nomeTipo: NOMES_TIPO_LIVRO[d.tipo], titulo: d.titulo, delta: m.delta, antes: m.saldoAntes, depois: m.saldoDepois, por: d.por, ref: d.ref, descricao: m.descricao, origem: entradaTriagem ? origem : undefined, fontes }
  })
  // ações sem gramas (coluna, atributos, código): o saldo é o do momento
  const saldoEm = (em: string) => [...movs].reverse().find((m) => m.criadoEm <= em)?.saldoDepois ?? 0
  for (const a of await ctx.repos.auditoria.listar())
    if (a.alvoId === item.id && EVENTOS_PACOTE[a.acao]) {
      const s = saldoEm(a.criadoEm)
      linhas.push({ id: a.id, em: a.criadoEm, tipo: 'evento', nomeTipo: 'Evento', titulo: EVENTOS_PACOTE[a.acao], delta: 0, antes: s, depois: s, por: a.usuarioNome, descricao: a.resumo })
    }
  linhas.sort((a, b) => (a.em < b.em ? -1 : 1))
  // por dia: começou com (antes do 1º movimento) e terminou com (depois do último)
  const hoje = ctx.relogio.hoje()
  const porDia = new Map<string, MovHistorico[]>()
  for (const l of linhas) porDia.set(l.em.slice(0, 10), [...(porDia.get(l.em.slice(0, 10)) ?? []), l])
  if (linhas.length && !porDia.has(hoje)) porDia.set(hoje, [])
  const dias = [...porDia]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([data, ls]) => ({ data, aberto: data === hoje, inicio: ls.length ? ls[0].antes : item.saldo, fim: ls.length ? ls[ls.length - 1].depois : item.saldo, movs: [...ls].reverse() }))
  return { item: { id: item.id, codigo: item.codigo, nome: item.nome, unidade: item.unidade, saldo: item.saldo }, dias }
}

// ---------- livro do cabelo ----------

export interface LinhaLivro {
  id: Id
  em: string
  data: string
  tipo: TipoLivro
  nomeTipo: string
  titulo: string
  delta: number
  antes: number
  depois: number
  por?: string
  ref?: RefLivro
  descricao?: string
  lote: { id: Id; codigo?: string; nome: string }
  compras: { id: Id; codigo?: string; fornecedor?: string }[]
  /** pessoas ligadas (fornecedor das compras, cliente da venda): filtro "pessoa" */
  pessoas: { id: Id; nome?: string }[]
}

/**
 * LIVRO DO CABELO: todos os lançamentos de gramas, mais novos em cima, com filtros (compra, pacote, pessoa, período,
 * tipo) e o FECHAMENTO de cada compra: comprado = em pacotes + vendido + perda + diferença ✓.
 * A parte de cada compra num pacote misturado é a dos gramas que entraram (lote juntado pesa cada lote de origem).
 */
export async function livroCabelo(ctx: Ctx, p: { moduloId?: string; compraId?: Id; itemId?: Id; pessoaId?: Id; de?: string; ate?: string; tipo?: TipoLivro } = {}) {
  const L = await leitorLivro(ctx)
  const moduloId = p.moduloId ?? 'cabelo'
  const lotes = L.itens.filter((i) => i.moduloId === moduloId && i.controlaEstoque && i.unidade === 'grama')
  const doModulo = new Set(lotes.map((i) => i.id))
  const movs = L.movs.filter((m) => doModulo.has(m.itemId)).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  // a parte de cada compra em cada lote (fração): origem das linhas e FECHAMENTO POR COMPRA (cada movimento conta pela parte da compra)
  const memo = new Map<Id, Map<Id, number>>()
  const deu = new Map<string, number>()
  for (const m of L.movs) if (m.motivo === 'unificacao' && m.delta < 0 && m.origemId) deu.set(`${m.itemId}>${m.origemId}`, (deu.get(`${m.itemId}>${m.origemId}`) ?? 0) - m.delta)
  const partes = (id: Id, vistos = new Set<Id>()): Map<Id, number> => {
    if (memo.has(id)) return memo.get(id)!
    const r = new Map<Id, number>()
    const i = L.porId.get(id)
    if (!i || vistos.has(id)) return r
    vistos.add(id)
    if (i.origem?.tipo === 'compra' && i.origem.id) r.set(i.origem.id, 1)
    else if (i.origem?.tipo === 'transformacao' && i.origem.id) for (const [c, f] of partes(i.origem.id, vistos)) r.set(c, f)
    else if (i.origem?.tipo === 'unificacao') {
      const fontes = (i.origem.ids ?? []).map((o) => [o, deu.get(`${o}>${i.id}`) ?? 0] as const)
      const total = fontes.reduce((s, [, g]) => s + g, 0)
      for (const [o, g] of fontes) for (const [c, f] of partes(o, vistos)) r.set(c, (r.get(c) ?? 0) + (total ? (f * g) / total : 0))
    }
    memo.set(id, r)
    return r
  }
  const compraCurta = (id: Id) => {
    const t = L.trans.get(id)!
    return { id, codigo: L.codigoTransacao(t), fornecedor: t.pessoaId ? L.pessoas.get(t.pessoaId) : undefined, pessoaId: t.pessoaId }
  }
  /** compras de origem de um lote: as gravadas no lote + as da genealogia (lote juntado/separado herda das fontes);
   *  só as que existem como compra (sem isso aparecia "🛒 ?": código vazio ou compra que não está mais na lista) */
  const comprasDoLote = (i: Item) => [...new Set([...comprasDe(i), ...partes(i.id).keys()])].filter((c) => L.trans.get(c)?.tipo === 'compra')
  const todas: LinhaLivro[] = movs.map((m) => {
    const i = L.porId.get(m.itemId)!
    const d = L.descrever(m)
    const cs = comprasDoLote(i).map(compraCurta)
    const t = m.origemId ? L.trans.get(m.origemId) : undefined
    const pessoas = [...cs.filter((c) => c.pessoaId).map((c) => ({ id: c.pessoaId!, nome: c.fornecedor })), ...(t?.tipo === 'venda' && t.pessoaId ? [{ id: t.pessoaId, nome: L.pessoas.get(t.pessoaId) }] : [])]
    return { id: m.id, em: m.criadoEm, data: m.data, tipo: d.tipo, nomeTipo: NOMES_TIPO_LIVRO[d.tipo], titulo: d.titulo, delta: m.delta, antes: m.saldoAntes, depois: m.saldoDepois, por: d.por, ref: d.ref, descricao: m.descricao, lote: { id: i.id, codigo: i.codigo, nome: i.nome }, compras: cs.map(({ id, codigo, fornecedor }) => ({ id, codigo, fornecedor })), pessoas }
  })
  const linhas = todas.filter(
    (l) =>
      (!p.compraId || l.compras.some((c) => c.id === p.compraId)) &&
      (!p.itemId || l.lote.id === p.itemId) &&
      (!p.pessoaId || l.pessoas.some((x) => x.id === p.pessoaId)) &&
      (!p.de || l.data >= p.de) &&
      (!p.ate || l.data <= p.ate) &&
      (!p.tipo || l.tipo === p.tipo),
  )

  const contas = new Map<Id, { comprado: number; emPacotes: number; vendido: number; perda: number; diferenca: number }>()
  const conta = (c: Id) => contas.get(c) ?? (contas.set(c, { comprado: 0, emPacotes: 0, vendido: 0, perda: 0, diferenca: 0 }), contas.get(c)!)
  for (const i of lotes) for (const [c, f] of partes(i.id)) conta(c).emPacotes += i.saldo * f
  for (const m of L.movs) {
    if (!doModulo.has(m.itemId)) continue
    const tipo = L.tipoDe(m)
    for (const [c, f] of partes(m.itemId)) {
      const k = conta(c)
      if (tipo === 'entrada') k.comprado += m.delta * f
      else if (tipo === 'diferenca') k.diferenca -= m.delta * f
      else if (tipo === 'venda') k.vendido -= m.delta * f
      // triagem: o que saiu menos o que entrou nos pacotes é a perda da separação (junção não perde nada)
      else k.perda -= m.delta * f
    }
  }
  const porCompra = [...contas]
    .filter(([c]) => L.trans.get(c)?.tipo === 'compra' && (!p.compraId || c === p.compraId))
    .map(([c, k]) => {
      const t = L.trans.get(c)!
      const r = { comprado: Math.round(k.comprado), emPacotes: Math.round(k.emPacotes), vendido: Math.round(k.vendido), perda: Math.round(k.perda), diferenca: Math.round(k.diferenca) }
      const resto = r.comprado - r.emPacotes - r.vendido - r.perda - r.diferenca
      // arredondar cada parte de um pacote misturado pode dar 1 ou 2 g: até 2 g ainda fecha
      return { compraId: c, codigo: L.codigoTransacao(t), fornecedor: t.pessoaId ? L.pessoas.get(t.pessoaId) : undefined, data: t.data, ...r, resto, confere: Math.abs(resto) <= 2 }
    })
    .sort((a, b) => (a.data < b.data ? 1 : -1))
  const soma = (f: (l: LinhaLivro) => boolean) => linhas.filter(f).reduce((s, l) => s + l.delta, 0)
  return {
    linhas,
    total: todas.length,
    porCompra,
    tipos: (Object.keys(NOMES_TIPO_LIVRO) as TipoLivro[]).map((id) => ({ id, nome: NOMES_TIPO_LIVRO[id] })),
    totais: { entrou: soma((l) => l.delta > 0), saiu: -soma((l) => l.delta < 0), saldo: soma(() => true) },
  }
}
