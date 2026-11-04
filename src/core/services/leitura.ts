// LER UM CÓDIGO (pistola, QR, digitado) — a pergunta "o que é isto e onde está?" respondida pelo SERVIDOR (hoje o serviço
// no aparelho; amanhã a API). A tela só mostra a resposta. Serve para o caixa reagir certo a qualquer leitura:
//   · disponível → pode vender (com o código atual, mesmo que tenha lido um código antigo)
//   · já saiu → para onde foi: VENDIDO (venda, cliente, quando, quanto), SEPARADO (em que pacotes virou, com o peso de
//     cada um — o caixa oferece vender esses) ou ZERADO (ajuste/perda/compra cancelada)
//   · não existe → nenhum pacote com esse código

import type { Id } from '../domain/tipos'
import type { Ctx } from './contexto'
import { genealogia } from './triagem'

const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, '')
/** endereço do QR (…#/lotes/<id>) → id */
const idDoQR = (texto: string) => {
  const m = /#\/lotes\/([^?#/\s]+)/.exec(texto.trim())
  return m ? decodeURIComponent(m[1]) : undefined
}

export type SituacaoLeitura = 'naoExiste' | 'disponivel' | 'vendido' | 'separado' | 'zerado'

/** a resposta tem SEMPRE o mesmo formato (o contrato da API): listas vazias quando não se aplicam */
export interface LeituraPacote {
  situacao: SituacaoLeitura
  /** o que foi lido */
  texto: string
  item?: { id: Id; codigo?: string; nome: string; saldo: number; unidade: string }
  /** leu um código que já foi trocado (etiqueta antiga): o atual é item.codigo */
  codigoAntigo?: string
  vendas: { id: Id; codigo: string; cliente?: string; data: string; g: number }[]
  triagens: { id: Id; codigo: string; em: string }[]
  viraram: { id: Id; codigo?: string; nome: string; saldo: number }[]
}

export async function lerCodigoPacote(ctx: Ctx, p: { texto: string }): Promise<LeituraPacote> {
  const itens = (await ctx.repos.itens.listar()).filter((i) => i.controlaEstoque)
  const q = idDoQR(p.texto)
  const c = norm(p.texto)
  const item = q
    ? itens.find((i) => i.id === q)
    : itens.find((i) => norm(i.codigo) === c) ?? itens.find((i) => i.codigosAnteriores?.some((x) => norm(x) === c)) ?? itens.find((i) => norm(i.id) === c)
  const vazio = { texto: p.texto.trim(), vendas: [], triagens: [], viraram: [] }
  if (!c || !item) return { ...vazio, situacao: 'naoExiste' }
  const base = {
    ...vazio,
    item: { id: item.id, codigo: item.codigo, nome: item.nome, saldo: item.saldo, unidade: item.unidade },
    /** leu um código que já foi trocado (etiqueta antiga): o atual é item.codigo */
    codigoAntigo: !q && norm(item.codigo) !== c ? p.texto.trim() : undefined,
  }
  if (item.saldo > 0) return { ...base, situacao: 'disponivel' }
  // já saiu do estoque: para onde foi (a genealogia sabe as vendas e as triagens deste pacote)
  const g = await genealogia(ctx, { itemId: item.id })
  const eu = g.lotes.find((l) => l.id === item.id)
  const vendas = g.vendas
    .filter((v) => v.lotes.some((l) => l.id === item.id))
    .map((v) => ({ id: v.id as Id, codigo: v.codigo ?? '', cliente: v.cliente, data: v.data, g: v.lotes.find((l) => l.id === item.id)!.g }))
  const triagens = (eu?.para ?? []).filter((x) => x.tipo === 'triagem').map((x) => g.triagens.find((t) => t.id === x.id)).filter((t): t is NonNullable<typeof t> => !!t)
  // os pacotes em que virou, com o peso de AGORA (o caixa oferece vender os que ainda têm)
  const viraram = triagens.flatMap((t) => t.saidas.map((s) => g.lotes.find((l) => l.id === s.id)).filter((l): l is NonNullable<typeof l> => !!l))
    .map((l) => ({ id: l.id as Id, codigo: l.codigo, nome: l.nome, saldo: l.saldo }))
  const situacao: SituacaoLeitura = vendas.length ? 'vendido' : viraram.length ? 'separado' : 'zerado'
  return { ...base, situacao, vendas, triagens: triagens.map((t) => ({ id: t.id as Id, codigo: t.codigo, em: t.em })), viraram }
}
