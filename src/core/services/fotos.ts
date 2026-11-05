// FOTOS DO LOTE (controle visual): a foto ACOMPANHA o lote a viagem inteira. Lote que nasce de uma separação ou de uma
// junção herda (por referência, sem copiar arquivo) as fotos dos lotes de origem e das compras; e pode ganhar as suas.
//  - fotosDoLote: primeiro as próprias (mais nova antes), depois as herdadas — do lote mais perto ao mais longe e, por
//    fim, as das compras — cada uma dizendo de onde veio ("do lote L-0001", "da compra P-0003").
//  - fotoPrincipal: a própria mais nova; sem própria, a primeira herdada.
//  - miniatura: imagem pequena (~240 px, data URL) guardada no próprio anexo: as listas mostram sem buscar o arquivo.
//  - etiquetas: o que vai impresso na etiqueta do lote (código grande, QR, medida · categoria · cor, peso, data e foto).

import { exigir } from '../domain/erros'
import type { Anexo, Id, Item, Transacao } from '../domain/tipos'
import { type Ctx, tocar } from './contexto'
import { comprasDe, lotesDeOrigem } from './estoque'

/** Categorias que NÃO são foto do produto (comprovante é papel, não cabelo). */
const NAO_FOTO = new Set(['comprovante', 'origem'])

/** É uma foto do produto/lote (imagem e não comprovante)? */
export const ehFoto = (a: Pick<Anexo, 'mime' | 'categoria' | 'apagadoEm'>) => !a.apagadoEm && a.mime.startsWith('image/') && !NAO_FOTO.has(a.categoria)

export interface FotoLote {
  /** id do anexo (o arquivo inteiro sai por backend.urlDoAnexo) */
  id: Id
  nome: string
  /** data URL pequena (~240 px); sem ela, a tela busca o arquivo */
  miniatura?: string
  /** quando a foto foi tirada/anexada */
  em: string
  /** foto deste lote (false = herdada do lote de origem ou da compra) */
  propria: boolean
  /** de onde veio a herdada */
  origem?: { tipo: 'lote' | 'compra'; id: Id; codigo?: string }
  /** "do lote L-0001" / "da compra P-0003" */
  de?: string
}

/** O que as listas precisam para mostrar a miniatura sem outra consulta. */
export type FotoResumo = Pick<FotoLote, 'id' | 'miniatura' | 'propria' | 'de' | 'origem'>

const resumo = (f?: FotoLote): FotoResumo | undefined => (f ? { id: f.id, miniatura: f.miniatura, propria: f.propria, de: f.de, origem: f.origem } : undefined)
const maisNovaAntes = (a: Anexo, b: Anexo) => (a.criadoEm === b.criadoEm ? (a.id < b.id ? 1 : -1) : a.criadoEm < b.criadoEm ? 1 : -1)
const codigoCurto = (id: Id) => id.slice(-4).toUpperCase()

/**
 * Lê tudo uma vez (anexos, lotes e compras) e responde as fotos de qualquer lote sem nova consulta. Serve para as
 * listas (estoque, triagem, genealogia, pedido) mostrarem a miniatura de cada lote.
 */
export async function leitorFotos(ctx: Ctx, pre: { porId?: Map<Id, Item>; compras?: Map<Id, Transacao> } = {}) {
  const porId = pre.porId ?? new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const compras = pre.compras ?? new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const deDono = new Map<Id, Anexo[]>()
  for (const a of await ctx.repos.anexos.listar()) if (ehFoto(a)) deDono.set(a.donoId, [...(deDono.get(a.donoId) ?? []), a])
  for (const xs of deDono.values()) xs.sort(maisNovaAntes)
  const foto = (a: Anexo, origem?: FotoLote['origem']): FotoLote => ({
    id: a.id,
    nome: a.nome,
    miniatura: a.miniatura,
    em: a.criadoEm,
    propria: !origem,
    ...(origem ? { origem, de: `${origem.tipo === 'compra' ? 'da compra' : 'do lote'} ${origem.codigo ?? codigoCurto(origem.id)}` } : {}),
  })
  const cache = new Map<Id, FotoLote[]>()
  /** próprias (mais nova antes) → lotes de origem (do mais perto ao mais longe) → compras */
  const fotosDe = (itemId: Id): FotoLote[] => {
    const c = cache.get(itemId)
    if (c) return c
    const item = porId.get(itemId)
    const lista: FotoLote[] = (deDono.get(itemId) ?? []).map((a) => foto(a))
    const vistos = new Set<Id>(lista.map((f) => f.id))
    const add = (a: Anexo, o: FotoLote['origem']) => {
      if (vistos.has(a.id)) return
      vistos.add(a.id)
      lista.push(foto(a, o))
    }
    // ancestrais em largura: mãe(s) primeiro, depois avós…
    const fila = [...lotesDeOrigem(item)]
    const passou = new Set<Id>([itemId])
    while (fila.length) {
      const id = fila.shift()!
      if (passou.has(id)) continue
      passou.add(id)
      const l = porId.get(id)
      for (const a of deDono.get(id) ?? []) add(a, { tipo: 'lote', id, codigo: l?.codigo })
      fila.push(...lotesDeOrigem(l))
    }
    for (const cid of comprasDe(item)) for (const a of deDono.get(cid) ?? []) add(a, { tipo: 'compra', id: cid, codigo: compras.get(cid)?.codigo })
    cache.set(itemId, lista)
    return lista
  }
  return {
    fotosDe,
    /** a própria mais nova; senão a primeira herdada */
    principal: (itemId: Id) => resumo(fotosDe(itemId)[0]),
    proprias: (itemId: Id) => fotosDe(itemId).filter((f) => f.propria).length,
    /** fotos de uma compra (para a tela do pedido) */
    daCompra: (compraId: Id) => (deDono.get(compraId) ?? []).map((a) => foto(a)),
  }
}

// ---------- consultas ----------

/** Todas as fotos do lote: próprias primeiro, depois as herdadas (com de onde vieram) e a principal. */
export async function fotosDoLote(ctx: Ctx, p: { itemId: Id }) {
  const item = await ctx.repos.itens.obter(p.itemId)
  exigir(item, 'Lote não encontrado.')
  const F = await leitorFotos(ctx)
  const fotos = F.fotosDe(item.id)
  return { itemId: item.id, codigo: item.codigo, fotos, principal: resumo(fotos[0]), proprias: fotos.filter((f) => f.propria).length }
}

export interface Etiqueta {
  id: Id
  codigo: string
  nome: string
  medida?: string
  categoria?: string
  cor?: string
  /** peso/quantidade agora e com que nasceu */
  saldo: number
  inicial: number
  unidade: Item['unidade']
  /** data de entrada (AAAA-MM-DD) */
  data: string
  /** compras de origem ("P-0003 + P-0007") */
  compras?: string
  foto?: FotoResumo
  /** o código aleatório do QR (…#/q/<código>); sem ele, a etiqueta usa o endereço antigo do lote */
  qr?: string
  /** via da etiqueta (2 = "2ª via", depois de cancelar a antiga); sem = 1ª */
  via?: number
}

/** Dados das ETIQUETAS dos lotes (na ordem pedida): o QR leva o código aleatório do pacote (#/q/<código>), montado na tela. */
export async function etiquetas(ctx: Ctx, p: { ids: Id[] }): Promise<Etiqueta[]> {
  exigir(p.ids?.length, 'Escolha pelo menos um lote.')
  exigir(p.ids.length <= 500, 'No máximo 500 etiquetas de uma vez.')
  const itens = await ctx.repos.itens.listar()
  const porId = new Map(itens.map((i) => [i.id, i]))
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const F = await leitorFotos(ctx, { porId, compras })
  const texto = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : String(v))
  return [...new Set(p.ids)].map((id) => {
    const i = porId.get(id)
    exigir(i, 'Lote não encontrado.')
    const medida = texto(i.campos.comprimento)
    return {
      id: i.id,
      codigo: i.codigo ?? codigoCurto(i.id),
      nome: i.nome,
      medida: medida ? `${medida} cm` : undefined,
      categoria: texto(i.campos.categoria),
      cor: texto(i.campos.cor),
      saldo: i.saldo,
      inicial: i.quantidadeInicial ?? i.saldo,
      unidade: i.unidade,
      data: i.criadoEm.slice(0, 10),
      compras: comprasDe(i).map((c) => compras.get(c)?.codigo).filter(Boolean).join(' + ') || undefined,
      foto: F.principal(i.id),
      qr: i.qr,
      via: i.etiquetaVia && i.etiquetaVia > 1 ? i.etiquetaVia : undefined,
    }
  })
}

// ---------- comandos ----------

const MINIATURA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/

/** Guarda a miniatura (~240 px) de uma foto já anexada: as listas mostram a foto sem baixar o arquivo inteiro. */
export async function definirMiniatura(ctx: Ctx, d: { id: Id; miniatura: string }) {
  const a = await ctx.repos.anexos.obter(d.id)
  exigir(a && !a.apagadoEm, 'Foto não encontrada.')
  exigir(a.mime.startsWith('image/'), 'Só foto tem miniatura.')
  exigir(typeof d.miniatura === 'string' && d.miniatura.length <= 80_000 && MINIATURA.test(d.miniatura), 'Miniatura inválida (imagem pequena em JPEG, PNG ou WebP).')
  if (a.miniatura === d.miniatura) return { id: a.id }
  await ctx.repos.anexos.salvar(tocar(ctx, { ...a, miniatura: d.miniatura }))
  return { id: a.id }
}
