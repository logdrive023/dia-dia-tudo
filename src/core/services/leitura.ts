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
/** endereço do QR antigo (…#/lotes/<id>) → id — etiquetas impressas antes do código de QR continuam valendo */
const idDoQR = (texto: string) => {
  const m = /#\/lotes\/([^?#/\s]+)/.exec(texto.trim())
  return m ? decodeURIComponent(m[1]) : undefined
}
/** endereço do QR novo (…#/q/<código>) → o código aleatório da etiqueta (Item.qr) */
const codigoDoQR = (texto: string) => {
  const m = /#\/q\/([A-Za-z0-9]{10,40})/.exec(texto.trim())
  return m ? m[1] : undefined
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
  /** os pacotes de AGORA em que ele virou — mesmo depois de juntar e separar de novo (via = o pacote do meio) */
  viraram: { id: Id; codigo?: string; nome: string; saldo: number; via?: string }[]
}

type Genealogia = Awaited<ReturnType<typeof genealogia>>

/**
 * Os PACOTES FINAIS de um pacote que já saiu do estoque: desce a família (separou → juntou → separou…) até os pacotes
 * que existem hoje. Um pacote do meio que ainda tem peso também conta (dá para vender o que sobrou dele), junto com os
 * pacotes que já saíram dele.
 * Seguro: não repete pacote, não entra em laço e para em 12 níveis / 300 pacotes.
 * Ex.: bruto A (zerou) → juntado com B em J (zerou) → J separado em J1, J2 → finais: J1 e J2 (via J).
 */
export function pacotesFinais(g: Genealogia, itemId: Id) {
  const porId = new Map(g.lotes.map((l) => [l.id, l]))
  const saidasDe = (loteId: Id) =>
    (porId.get(loteId)?.para ?? [])
      .filter((x) => x.tipo === 'triagem')
      .flatMap((x) => g.triagens.find((t) => t.id === x.id)?.saidas ?? [])
      .map((s) => s.id as Id)
      .filter((id) => id !== loteId)
  const finais: { id: Id; codigo?: string; nome: string; saldo: number; via?: string }[] = []
  const vistos = new Set<Id>([itemId])
  let nivel = saidasDe(itemId).map((id) => ({ id, via: undefined as string | undefined }))
  for (let n = 0; n < 12 && nivel.length && vistos.size < 300; n++) {
    const proximo: typeof nivel = []
    for (const { id, via } of nivel) {
      if (vistos.has(id)) continue
      vistos.add(id)
      const l = porId.get(id)
      if (!l) continue
      const filhos = saidasDe(id).filter((f) => !vistos.has(f))
      // tem peso (sobrou de uma separação parcial) ou é a ponta da família: é um pacote final
      if (l.saldo > 0 || !filhos.length) finais.push({ id: l.id as Id, codigo: l.codigo, nome: l.nome, saldo: l.saldo, via })
      if (filhos.length) proximo.push(...filhos.map((f) => ({ id: f, via: via ?? l.codigo })))
    }
    nivel = proximo
  }
  // os que ainda têm peso primeiro (o caixa oferece esses)
  return finais.sort((a, b) => Number(b.saldo > 0) - Number(a.saldo > 0))
}

export async function lerCodigoPacote(ctx: Ctx, p: { texto: string }): Promise<LeituraPacote> {
  const itens = (await ctx.repos.itens.listar()).filter((i) => i.controlaEstoque)
  // QR novo: o código aleatório (etiqueta cancelada → '—', não acha nada); QR antigo: o id
  const cq = codigoDoQR(p.texto)
  const q = cq ? itens.find((i) => i.qr === cq)?.id ?? '—' : idDoQR(p.texto)
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
  // os pacotes em que virou, com o peso de AGORA (o caixa oferece vender os que ainda têm) — até o fim da família
  const viraram = pacotesFinais(g, item.id)
  const situacao: SituacaoLeitura = vendas.length ? 'vendido' : viraram.length ? 'separado' : 'zerado'
  return { ...base, situacao, vendas, triagens: triagens.map((t) => ({ id: t.id as Id, codigo: t.codigo, em: t.em })), viraram }
}
