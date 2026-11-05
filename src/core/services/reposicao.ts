// SUGESTÃO DE COMPRA (reposição por medida): cruza o que mais vende com o que tem em estoque e diz quando acaba.
// Para cada medida + categoria (ex.: 60 cm Normal, 55 cm Tinte):
//   estoque  = soma das gramas dos pacotes separados com saldo
//   vendido  = gramas vendidas nos últimos `janelaDias` (vendas concluídas)
//   ritmo    = vendido ÷ janelaDias (g por dia)  ·  acaba em = estoque ÷ ritmo (dias)
//   sugestão = o que falta para cobrir `cobrirDias` no ritmo atual (ritmo × cobrirDias − estoque)
//   último   = o pacote mais novo da medida: custo por kg (com o gasto da viagem, se incorporado) e de qual compra/viagem
// Situação: acabou (vende e não tem) · acabando (acaba em até `alertaDias`) · ok · parado (não vendeu na janela).
// Ex.: 60 cm Normal: 2,1 kg em estoque, vendeu 3,6 kg em 30 dias (120 g/dia) → acaba em ~17 dias; último custou
//      Bs 15.200/kg na viagem a Oruro; para 30 dias falta comprar 1,5 kg.
// Bruto (ainda sem medida) aparece à parte: é cabelo que vai virar medida na triagem.
import { somarDias } from '../domain/datas'
import type { Id, Item } from '../domain/tipos'
import { type Ctx, lerConfig } from './contexto'
import { comprasDe } from './estoque'

export interface ConfigReposicao {
  janelaDias: number
  alertaDias: number
  cobrirDias: number
}
export const REPOSICAO_PADRAO: ConfigReposicao = { janelaDias: 30, alertaDias: 14, cobrirDias: 30 }

export type SituacaoReposicao = 'acabou' | 'acabando' | 'ok' | 'parado'

export interface LinhaReposicao {
  chave: string
  medida: number
  categoria: string
  estoqueG: number
  pacotes: number
  vendidoG: number
  ritmoGDia: number
  /** em quantos dias acaba (sem venda na janela: não dá para prever) */
  acabaEmDias?: number
  sugestaoG: number
  situacao: SituacaoReposicao
  ultimo?: { itemId: Id; codigo?: string; data: string; custoKg?: number; compra?: { id: Id; codigo?: string }; viagem?: { id: Id; codigo?: string; nome: string } }
}

const medidaDe = (i: Item) => Number(i.campos?.comprimento) || 0
const categoriaDe = (i: Item) => String(i.campos?.categoria || 'Normal')

export async function reposicao(ctx: Ctx, p: Partial<ConfigReposicao> = {}) {
  const cfg = { ...REPOSICAO_PADRAO, ...((await lerConfig(ctx)).reposicao ?? {}), ...p }
  const hoje = ctx.relogio.hoje()
  const desde = somarDias(hoje, -cfg.janelaDias)
  const itens = (await ctx.repos.itens.listar()).filter((i) => !i.apagadoEm && i.moduloId === 'cabelo' && i.controlaEstoque && i.unidade === 'grama')
  const porId = new Map(itens.map((i) => [i.id, i]))
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const viagens = new Map((await ctx.repos.viagens.listar()).map((v) => [v.id, v]))
  const linhas = new Map<string, LinhaReposicao>()
  const linhaDe = (i: Item) => {
    const chave = `${medidaDe(i)}|${categoriaDe(i)}`
    let l = linhas.get(chave)
    if (!l) linhas.set(chave, (l = { chave, medida: medidaDe(i), categoria: categoriaDe(i), estoqueG: 0, pacotes: 0, vendidoG: 0, ritmoGDia: 0, sugestaoG: 0, situacao: 'parado' }))
    return l
  }
  let brutoG = 0
  let brutoPacotes = 0
  for (const i of itens) {
    if (!medidaDe(i)) {
      if (i.saldo > 0) (brutoG += i.saldo), brutoPacotes++
      continue
    }
    const l = linhaDe(i)
    if (i.saldo > 0) (l.estoqueG += i.saldo), l.pacotes++
    // o pacote mais novo da medida (com custo): quanto custou o kg e de onde veio
    if (i.custoPrincipal && i.quantidadeInicial && (!l.ultimo || i.criadoEm > l.ultimo.data)) {
      const compraId = comprasDe(i)[0]
      const compra = compraId ? compras.get(compraId) : undefined
      const v = compra?.viagemId ? viagens.get(compra.viagemId) : undefined
      l.ultimo = {
        itemId: i.id,
        codigo: i.codigo,
        data: i.criadoEm,
        custoKg: Math.round((i.custoPrincipal * 1000) / i.quantidadeInicial),
        compra: compra ? { id: compra.id, codigo: compra.codigo } : undefined,
        viagem: v ? { id: v.id, codigo: v.codigo, nome: v.nome } : undefined,
      }
    }
  }
  for (const t of await ctx.repos.transacoes.listar({ tipo: 'venda' })) {
    if (t.etapa !== 'concluido' || t.data < desde || t.data > hoje) continue
    for (const ln of t.linhas) {
      const i = ln.itemId ? porId.get(ln.itemId) : undefined
      if (i && medidaDe(i)) linhaDe(i).vendidoG += ln.quantidade
    }
  }
  for (const l of linhas.values()) {
    l.ritmoGDia = Math.round(l.vendidoG / cfg.janelaDias)
    l.acabaEmDias = l.vendidoG > 0 ? Math.floor((l.estoqueG * cfg.janelaDias) / l.vendidoG) : undefined
    l.sugestaoG = l.vendidoG > 0 ? Math.max(0, Math.round((l.vendidoG * cfg.cobrirDias) / cfg.janelaDias - l.estoqueG)) : 0
    l.situacao = !l.vendidoG ? 'parado' : l.estoqueG <= 0 ? 'acabou' : (l.acabaEmDias ?? Infinity) <= cfg.alertaDias ? 'acabando' : 'ok'
  }
  const ordem: Record<SituacaoReposicao, number> = { acabou: 0, acabando: 1, ok: 2, parado: 3 }
  const lista = [...linhas.values()].sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.acabaEmDias ?? 1e9) - (b.acabaEmDias ?? 1e9) || a.medida - b.medida)
  return {
    config: cfg,
    linhas: lista,
    bruto: { gramas: brutoG, pacotes: brutoPacotes },
    totais: {
      estoqueG: lista.reduce((s, l) => s + l.estoqueG, 0),
      vendidoG: lista.reduce((s, l) => s + l.vendidoG, 0),
      sugestaoG: lista.reduce((s, l) => s + l.sugestaoG, 0),
      acabando: lista.filter((l) => l.situacao === 'acabou' || l.situacao === 'acabando').length,
    },
  }
}
