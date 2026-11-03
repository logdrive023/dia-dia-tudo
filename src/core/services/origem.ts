// ORIGEM EM GRAMAS: de quais compras veio cada grama de um pacote ou de uma venda, mesmo quando o cabelo se misturou
// (separado, juntado, separado de novo). Ex.: P1 2 kg (C1) + P4 6 kg (2 kg de C1 + 4 kg de C2); venda de 1 kg do P1 +
// 1,5 kg do P4 → 1,5 kg da compra C1 (1 kg + 0,5 kg) + 1 kg da compra C2.
// Regra: o lote da compra é 100% daquela compra; o lote separado herda a proporção do lote-mãe; o lote juntado pesa
// cada lote de origem pelos gramas que ele deu (movimento 'unificacao' com origemId = lote juntado). Base: as mesmas
// ligações da genealogia (item.origem + movimentos); nada novo é gravado.

import type { Id, Item, MovEstoque } from '../domain/tipos'
import type { Ctx } from './contexto'
import { lotesDeOrigem } from './estoque'

export interface OrigemCompra {
  compraId: Id
  codigo?: string
  fornecedor?: string
  data?: string
  /** gramas desta compra dentro do pacote/venda */
  gramas: number
}

/** fração de cada compra dentro de um lote (soma 1; vazio = lote sem compra, ex.: cadastro) */
type Mistura = Map<Id, number>

/** profundidade máxima da cadeia (separa → junta → separa…): evita laço em dado quebrado */
const LIMITE = 60

async function leitorMistura(ctx: Ctx) {
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const movs = await ctx.repos.movEstoque.listar()
  // gramas que cada lote deu para cada junção: chave "origem>destino"
  const deu = new Map<string, number>()
  for (const m of movs as MovEstoque[])
    if (m.motivo === 'unificacao' && m.delta < 0 && m.origemId) deu.set(`${m.itemId}>${m.origemId}`, (deu.get(`${m.itemId}>${m.origemId}`) ?? 0) - m.delta)
  const memo = new Map<Id, Mistura>()
  const mistura = (id: Id, prof = 0, caminho = new Set<Id>()): Mistura => {
    const pronto = memo.get(id)
    if (pronto) return pronto
    const i: Item | undefined = itens.get(id)
    const r: Mistura = new Map()
    if (!i || prof > LIMITE || caminho.has(id)) return r
    const o = i.origem
    if (o?.tipo === 'compra' && o.id) r.set(o.id, 1)
    else {
      const pais = lotesDeOrigem(i)
      if (pais.length) {
        const prox = new Set(caminho).add(id)
        const pesos = o?.tipo === 'unificacao' ? pais.map((p) => deu.get(`${p}>${id}`) ?? 0) : pais.map(() => 1)
        const soma = pesos.reduce((s, v) => s + v, 0)
        pais.forEach((p, k) => {
          const w = soma > 0 ? pesos[k] / soma : 1 / pais.length
          for (const [c, f] of mistura(p, prof + 1, prox)) r.set(c, (r.get(c) ?? 0) + f * w)
        })
      } else {
        // sem ligação de lote: usa as compras gravadas no lote, em partes iguais (dado antigo)
        const cs = o?.compraIds?.length ? o.compraIds : o?.compraId ? [o.compraId] : []
        for (const c of cs) r.set(c, 1 / cs.length)
      }
    }
    memo.set(id, r)
    return r
  }
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p.nome]))
  /** soma (lote, gramas) em gramas por compra; arredonda por "maior resto" para fechar com o total */
  const resolver = (partes: { itemId: Id; gramas: number }[]): OrigemCompra[] => {
    const acc = new Map<Id, number>()
    for (const p of partes) for (const [c, f] of mistura(p.itemId)) acc.set(c, (acc.get(c) ?? 0) + f * p.gramas)
    const total = Math.round([...acc.values()].reduce((s, v) => s + v, 0))
    const lista = [...acc].map(([c, g]) => ({ c, g, i: Math.floor(g) }))
    let falta = total - lista.reduce((s, x) => s + x.i, 0)
    for (const x of [...lista].sort((a, b) => b.g - b.i - (a.g - a.i))) if (falta-- > 0) x.i++
    return lista
      .filter((x) => x.i > 0)
      .map((x) => {
        const t = compras.get(x.c)
        return { compraId: x.c, codigo: t?.codigo, fornecedor: t?.pessoaId ? pessoas.get(t.pessoaId) : undefined, data: t?.data, gramas: x.i }
      })
      .sort((a, b) => b.gramas - a.gramas || ((a.data ?? '') < (b.data ?? '') ? -1 : 1))
  }
  return { itens, resolver }
}

/**
 * Compras de origem de um pacote, em gramas (proporcional ao que entrou em cada mistura).
 * Padrão: o peso com que o pacote nasceu (quantidadeInicial); `gramas` muda a base (ex.: o saldo atual).
 */
export async function origemDoPacote(ctx: Ctx, p: { itemId: Id; gramas?: number }): Promise<OrigemCompra[]> {
  const L = await leitorMistura(ctx)
  const i = L.itens.get(p.itemId)
  if (!i) return []
  return L.resolver([{ itemId: i.id, gramas: p.gramas ?? i.quantidadeInicial ?? i.saldo }])
}

/** Compras de origem de uma venda, em gramas (soma das linhas de cabelo, pela origem de cada pacote usado). */
export async function origemDaVenda(ctx: Ctx, p: { vendaId: Id }): Promise<OrigemCompra[]> {
  const v = await ctx.repos.transacoes.obter(p.vendaId)
  if (!v) return []
  const L = await leitorMistura(ctx)
  const partes = v.linhas.filter((l) => l.itemId && L.itens.get(l.itemId)?.unidade === 'grama').map((l) => ({ itemId: l.itemId!, gramas: l.quantidade }))
  return L.resolver(partes)
}
