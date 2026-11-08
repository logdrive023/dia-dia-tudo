// ORIGEM EM GRAMAS: de quais compras veio cada grama de um pacote ou de uma venda, mesmo quando o cabelo se misturou
// (separado, juntado, separado de novo). Ex.: P1 2 kg (C1) + P4 6 kg (2 kg de C1 + 4 kg de C2); venda de 1 kg do P1 +
// 1,5 kg do P4 → 1,5 kg da compra C1 (1 kg + 0,5 kg) + 1 kg da compra C2.
//
// COMO É CONTADO — um LIVRO em gramas inteiras (nada novo é gravado; é refeito dos movimentos de estoque):
// os movimentos são lidos NA ORDEM em que aconteceram (o id é ordenável pelo tempo) e cada pacote guarda quantas
// gramas de cada compra estão dentro dele AGORA. Cada saída (venda, separação, junção, perda) tira do pacote uma parte
// proporcional (arredonda pelo maior resto, nunca mais do que a compra tem lá dentro) e entrega ao destino: a venda,
// o pacote filho, a mistura. Como as gramas só MUDAM DE LUGAR, a conta por compra fecha sempre:
//   o que está no estoque + o que foi vendido + a perda = a compra   (sem o ±1 g de arredondar cada consulta sozinha)

import type { Id, Item, MovEstoque } from '../domain/tipos'
import type { Ctx } from './contexto'

export interface OrigemCompra {
  compraId: Id
  codigo?: string
  fornecedor?: string
  data?: string
  /** gramas desta compra dentro do pacote/venda */
  gramas: number
}

/** gramas por compra ('' = sem compra: cadastro, ajuste de algo que não veio de compra) */
type Vet = Map<Id, number>
const SEM = ''

const totalDe = (v: Vet) => [...v.values()].reduce((s, g) => s + g, 0)

function somarEm(alvo: Vet, v: Vet) {
  for (const [c, g] of v) if (g) alvo.set(c, (alvo.get(c) ?? 0) + g)
}

/** a parte de `q` gramas na proporção de `v`, pelo maior resto (empate: pela compra, para dar sempre o mesmo) */
function proporcional(v: Vet, q: number): Vet {
  const T = totalDe(v)
  const r: Vet = new Map()
  if (q <= 0) return r
  if (T <= 0) return r.set(SEM, q)
  const lista = [...v].filter(([, g]) => g > 0).map(([c, g]) => ({ c, x: (g * q) / T, i: Math.floor((g * q) / T) }))
  let falta = q - lista.reduce((s, x) => s + x.i, 0)
  for (const x of [...lista].sort((a, b) => b.x - b.i - (a.x - a.i) || (a.c < b.c ? -1 : 1))) if (falta-- > 0) x.i++
  for (const x of lista) if (x.i) r.set(x.c, x.i)
  return r
}

/** TIRA `q` gramas de `v` (muda `v`): na proporção do que tem; o que faltar (dado incompleto) vem "sem compra" */
function tirar(v: Vet, q: number): Vet {
  const T = totalDe(v)
  if (q >= T) {
    const tudo: Vet = new Map(v)
    v.clear()
    if (q > T) tudo.set(SEM, (tudo.get(SEM) ?? 0) + q - T)
    return tudo
  }
  const parte = proporcional(v, q)
  for (const [c, g] of parte) {
    const resta = (v.get(c) ?? 0) - g
    if (resta > 0) v.set(c, resta)
    else v.delete(c)
  }
  return parte
}

/** refaz o livro: o que cada pacote tem agora, o que nasceu com ele e o que cada venda levou de cada compra */
async function lerLivro(ctx: Ctx) {
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const movs = [...((await ctx.repos.movEstoque.listar()) as MovEstoque[])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const agora = new Map<Id, Vet>() // o que está dentro de cada pacote agora
  const nasceu = new Map<Id, Vet>() // tudo o que entrou no pacote (a composição dele)
  const vendido = new Map<string, Vet>() // `${venda}|${pacote}` → o que a venda levou
  const aCaminho = new Map<string, Vet>() // separação ('s:'+pai) ou junção ('u:'+mistura): saiu e ainda não chegou
  const deu = new Map<string, Vet>() // `${fonte}>${mistura}`: o que a fonte pôs na mistura (para "tirar da mistura")
  const saidas = new Map<Id, Vet[]>() // saídas de triagem de cada pacote (desfazer devolve a última)
  const jaTirado = new Map<Id, number>() // gramas que voltaram da mistura para as fontes (o movimento da mistura vem depois)
  const de = (m: Map<string, Vet>, k: string) => m.get(k) ?? (m.set(k, new Map()), m.get(k)!)
  const pilhaDe = (k: Id) => saidas.get(k) ?? (saidas.set(k, []), saidas.get(k)!)

  /** entrada que não vem de outro pacote: compra → aquela compra; senão a composição do pacote (ou "sem compra") */
  const entradaPropria = (i: Item | undefined, q: number): Vet => {
    if (i?.origem?.tipo === 'compra' && i.origem.id) return new Map([[i.origem.id, q]])
    const comp = i ? nasceu.get(i.id) : undefined
    return comp && totalDe(comp) ? proporcional(comp, q) : new Map([[SEM, q]])
  }
  const entrar = (itemId: Id, v: Vet, compoe = true) => {
    somarEm(de(agora, itemId), v)
    if (compoe) somarEm(de(nasceu, itemId), v)
  }

  for (const m of movs) {
    const id = m.itemId
    const d = m.delta
    const i = itens.get(id)
    if (!d) continue
    switch (m.motivo) {
      case 'transformacao':
        if (d < 0) {
          // o pai sai para a separação: fica "a caminho" até os filhos entrarem (o que sobrar é a perda)
          const v = tirar(de(agora, id), -d)
          aCaminho.set('s:' + id, v)
          pilhaDe(id).push(new Map(v))
        } else {
          const pai = m.origemId ?? ''
          const fonte = aCaminho.get('s:' + pai)
          const v = fonte ? tirar(fonte, d) : entradaPropria(i, d)
          entrar(id, v)
        }
        break
      case 'unificacao':
        if (m.origemId && m.origemId !== id && d < 0) {
          // a fonte vai para a mistura
          const v = tirar(de(agora, id), -d)
          somarEm(de(aCaminho, 'u:' + m.origemId), v)
          somarEm(de(deu, `${id}>${m.origemId}`), v)
          pilhaDe(id).push(new Map(v))
        } else if (m.origemId === id && d > 0) {
          // a mistura nasce com o que as fontes deram
          const fonte = aCaminho.get('u:' + id)
          entrar(id, fonte ? tirar(fonte, d) : entradaPropria(i, d))
        } else if (m.origemId && m.origemId !== id && d > 0) {
          // "tirar da mistura": a fonte recebe de volta o que pôs (e sai da mistura agora mesmo)
          const pos = deu.get(`${id}>${m.origemId}`)
          const mistura = de(agora, m.origemId)
          const v = pos && totalDe(pos) >= d ? tirar(pos, d) : proporcional(mistura, d)
          for (const [c, g] of v) {
            const resta = (mistura.get(c) ?? 0) - g
            if (resta > 0) mistura.set(c, resta)
            else mistura.delete(c)
          }
          jaTirado.set(m.origemId, (jaTirado.get(m.origemId) ?? 0) + d)
          entrar(id, v, false)
        } else if (m.origemId === id && d < 0) {
          // a mistura perde o que voltou para as fontes (já descontado acima)
          const ja = jaTirado.get(id) ?? 0
          const usado = Math.min(ja, -d)
          jaTirado.set(id, ja - usado)
          if (-d > usado) tirar(de(agora, id), -d - usado)
        }
        break
      case 'venda':
      case 'uso':
      case 'correcao': {
        const chave = `${m.origemId ?? ''}|${id}`
        if (d < 0) somarEm(de(vendido, chave), tirar(de(agora, id), -d))
        else {
          // correção para menos: volta para o pacote o que a venda tinha levado
          const levou = vendido.get(chave)
          entrar(id, levou && totalDe(levou) ? tirar(levou, d) : entradaPropria(i, d), false)
        }
        break
      }
      case 'cancelamento':
        if (d < 0) tirar(de(agora, id), -d)
        else {
          const levou = vendido.get(`${m.origemId ?? ''}|${id}`)
          if (levou && totalDe(levou)) {
            // venda cancelada: volta exatamente o que ela levou
            entrar(id, tirar(levou, d), false)
          } else {
            // desfazer triagem: volta o que o pacote tinha mandado para a triagem (a última saída primeiro)
            const v: Vet = new Map()
            let falta = d
            const pilha = saidas.get(id) ?? []
            while (falta > 0 && pilha.length) {
              const topo = pilha[pilha.length - 1]
              const parte = tirar(topo, Math.min(falta, totalDe(topo)))
              somarEm(v, parte)
              falta -= totalDe(parte)
              if (!totalDe(topo)) pilha.pop()
            }
            if (falta > 0) somarEm(v, entradaPropria(i, falta))
            entrar(id, v, false)
          }
        }
        break
      default:
        // compra, ajuste, perda (lavagem, conferência de peso, cadastro)
        if (d > 0) entrar(id, entradaPropria(i, d))
        else tirar(de(agora, id), -d)
    }
  }

  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p.nome]))
  const lista = (v: Vet): OrigemCompra[] =>
    [...v]
      .filter(([c, g]) => c !== SEM && g > 0)
      .map(([c, g]) => {
        const t = compras.get(c)
        return { compraId: c, codigo: t?.codigo, fornecedor: t?.pessoaId ? pessoas.get(t.pessoaId) : undefined, data: t?.data, gramas: g }
      })
      .sort((a, b) => b.gramas - a.gramas || ((a.data ?? '') < (b.data ?? '') ? -1 : 1))
  return { itens, agora, nasceu, vendido, lista }
}

/**
 * Compras de origem de um pacote, em gramas.
 * Padrão: o peso com que o pacote nasceu (quantidadeInicial), na proporção da composição dele.
 * `gramas` = o saldo atual → EXATAMENTE o que está dentro dele agora (o livro); outro número → a proporção.
 */
export async function origemDoPacote(ctx: Ctx, p: { itemId: Id; gramas?: number }): Promise<OrigemCompra[]> {
  const L = await lerLivro(ctx)
  const i = L.itens.get(p.itemId)
  if (!i) return []
  const agora = L.agora.get(i.id) ?? new Map()
  const comp = L.nasceu.get(i.id) ?? new Map()
  const g = p.gramas ?? i.quantidadeInicial ?? i.saldo
  if (g === totalDe(agora) && g === i.saldo) return L.lista(agora)
  return L.lista(proporcional(totalDe(comp) ? comp : agora, g))
}

/** Compras de origem de uma venda, em gramas: o que ela levou de cada pacote (o livro), somado por compra. */
export async function origemDaVenda(ctx: Ctx, p: { vendaId: Id }): Promise<OrigemCompra[]> {
  const v = await ctx.repos.transacoes.obter(p.vendaId)
  if (!v) return []
  const L = await lerLivro(ctx)
  const soma: Vet = new Map()
  const vistos = new Set<Id>()
  for (const l of v.linhas) {
    if (!l.itemId || L.itens.get(l.itemId)?.unidade !== 'grama') continue
    const levou = L.vendido.get(`${v.id}|${l.itemId}`)
    if (levou && totalDe(levou)) {
      // o livro já soma todas as linhas da venda no mesmo pacote: conta uma vez
      if (!vistos.has(l.itemId)) somarEm(soma, levou)
      vistos.add(l.itemId)
    } else {
      // venda cancelada (devolveu) ou sem movimento: a proporção da composição do pacote
      const comp = L.nasceu.get(l.itemId) ?? new Map()
      somarEm(soma, proporcional(comp, l.quantidade))
    }
  }
  return L.lista(soma)
}
