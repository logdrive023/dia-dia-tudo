// VENDAS EM ABERTO (rascunho do caixa): começou a passar os pacotes e saiu da tela — nada se perde. A venda fica
// guardada "em aberto" (sem baixar estoque, sem caixa, sem aparecer nos relatórios: só vira venda no FECHAR).
// Regras (do SERVIDOR — hoje o serviço no aparelho, amanhã a API):
//   · salvar de novo atualiza a mesma (o caixa salva sozinho ao sair e a cada mudança)
//   · um pacote numa venda em aberto NÃO vai para outra venda sem aviso: a tela pergunta e, se a pessoa confirmar,
//     `tirarDaVendaAberta` tira ele de lá (fica no registro: de qual venda saiu e para onde foi)
//   · venda de UMA PARTE do pacote: `reduzirNaVendaAberta` só diminui o que a outra guardou se não couber nas duas
//   · ao concluir uma venda: a própria venda em aberto some; nas outras, o pacote só sai se o que sobrou não der mais
//     para o que elas guardaram (o estoque só muda no FECHAR: nada disto mexe em saldo)
// Guardado na coleção de configurações (chave "vendaAberta:<id>"), à parte das vendas de verdade.

import type { Id } from '../domain/tipos'
import { exigir } from '../domain/erros'
import { auditar, type Ctx, novo, tocar } from './contexto'

export interface LinhaAberta {
  id: Id
  itemId: Id
  quantidade: number
  /** preço digitado (pacote sem preço de tabela) */
  precoManual?: number
}

export interface VendaAberta {
  id: Id
  linhas: LinhaAberta[]
  pessoaId?: Id
  colunaId?: string
  vendedorId?: Id
  localId?: Id
  obs?: string
  desconto?: { modo: 'pct' | 'valor'; pct?: string; valor?: number }
  moeda?: string
  /** o total que a tela mostrava (só para a lista; o preço vale o da hora de fechar) */
  total?: number
  moedaTotal?: string
}

const CHAVE = 'vendaAberta:'

async function lerTodas(ctx: Ctx) {
  return (await ctx.repos.config.listar()).filter((r) => r.id.startsWith(CHAVE) && !r.apagadoEm)
}

/** funcionária só mexe na venda em aberto que ELA guardou (o administrador, em todas) */
function exigirDona(ctx: Ctx, r: { criadoPor?: Id }) {
  exigir(ctx.sessao.perfil === 'admin' || r.criadoPor === ctx.sessao.usuarioId, 'Essa venda em aberto é de outra pessoa.')
}

export async function salvarVendaAberta(ctx: Ctx, d: VendaAberta) {
  exigir(d.id, 'Venda sem id.')
  // a venda já foi fechada (talvez em outra aba): o "salvar sozinho" atrasado não ressuscita o rascunho
  if (await ctx.repos.transacoes.obter(d.id)) return { id: d.id }
  const ids = [...new Set((d.linhas ?? []).map((l) => l.itemId))]
  for (const id of ids) exigir(await ctx.repos.itens.obter(id), 'Pacote não encontrado.')
  for (const l of d.linhas ?? []) exigir(Number.isInteger(l.quantidade) && l.quantidade > 0, 'Quantidade inválida.')
  const chave = CHAVE + d.id
  const atual = await ctx.repos.config.obter(chave)
  if (atual) exigirDona(ctx, atual)
  // quando ela foi aberta (salvaEm muda a cada toque; a idade na lista conta desde o começo)
  const continua = atual && !atual.apagadoEm ? (atual.valor as { abertaEm?: string }).abertaEm ?? atual.criadoEm : undefined
  const valor = { ...d, linhas: d.linhas ?? [], salvaEm: ctx.relogio.agora(), abertaEm: continua ?? ctx.relogio.agora(), porNome: ctx.sessao.nome, porId: ctx.sessao.usuarioId }
  // sem nada dentro: não guarda (e apaga a que existia)
  if (!valor.linhas.length) {
    if (atual && !atual.apagadoEm) await ctx.repos.config.salvar(tocar(ctx, { ...atual, apagadoEm: ctx.relogio.agora() }))
    return { id: d.id }
  }
  if (atual && !atual.apagadoEm) await ctx.repos.config.salvar(tocar(ctx, { ...atual, valor }))
  else {
    await ctx.repos.config.salvar(atual ? tocar(ctx, { ...atual, apagadoEm: undefined, valor }) : novo(ctx, { id: chave, valor }))
    await auditar(ctx, 'salvarVendaAberta', d.id, `${valor.linhas.length} pacote(s) guardados em aberto`, ids)
  }
  return { id: d.id }
}

export async function descartarVendaAberta(ctx: Ctx, d: { id: Id; motivo?: string }) {
  const r = await ctx.repos.config.obter(CHAVE + d.id)
  if (!r || r.apagadoEm) return { id: d.id }
  exigirDona(ctx, r)
  await ctx.repos.config.salvar(tocar(ctx, { ...r, apagadoEm: ctx.relogio.agora() }))
  const v = r.valor as VendaAberta
  await auditar(ctx, 'descartarVendaAberta', d.id, `venda em aberto descartada${d.motivo ? ` · ${d.motivo}` : ''}`, v.linhas.map((l) => l.itemId))
  return { id: d.id }
}

/**
 * tira um pacote de uma venda em aberto (ele vai para outra venda): a pessoa confirmou na tela. Vale também na venda em
 * aberto de OUTRA pessoa (o caixa vende o pacote que estava guardado lá; fica no registro) — tirar tudo/descartar não.
 */
export async function tirarDaVendaAberta(ctx: Ctx, d: { id: Id; itemId: Id; para?: string }) {
  const r = await ctx.repos.config.obter(CHAVE + d.id)
  if (!r || r.apagadoEm) return { id: d.id }
  const v = r.valor as VendaAberta
  if (!v.linhas.some((l) => l.itemId === d.itemId)) return { id: d.id }
  const linhas = v.linhas.filter((l) => l.itemId !== d.itemId)
  await ctx.repos.config.salvar(tocar(ctx, { ...r, ...(linhas.length ? {} : { apagadoEm: ctx.relogio.agora() }), valor: { ...v, linhas } }))
  const item = await ctx.repos.itens.obter(d.itemId)
  await auditar(ctx, 'tirarDaVendaAberta', d.id, `${item?.codigo ?? item?.nome ?? ''} saiu da venda em aberto${d.para ? ` · foi para ${d.para}` : ''}${linhas.length ? '' : ' (ela ficou vazia e foi descartada)'}`, [d.itemId])
  return { id: d.id }
}

/**
 * vender só UMA PARTE de um pacote guardado noutra venda em aberto: a outra continua com o pacote e só diminui se as
 * duas somadas passarem do saldo. Não mexe em estoque (só o FECHAR mexe). O pacote inteiro é `tirarDaVendaAberta`.
 */
export async function reduzirNaVendaAberta(ctx: Ctx, d: { id: Id; itemId: Id; quantidade: number; para?: string }) {
  const item = await ctx.repos.itens.obter(d.itemId)
  exigir(item, 'Pacote não encontrado.')
  exigir(item.unidade === 'grama', 'Só dá para dividir pacote vendido por grama.')
  exigir(Number.isInteger(d.quantidade) && d.quantidade > 0, 'Quantidade inválida.')
  exigir(d.quantidade < item.saldo, 'Essa quantidade é o pacote inteiro: tire ele da outra venda.')
  const r = await ctx.repos.config.obter(CHAVE + d.id)
  if (!r || r.apagadoEm) return { id: d.id }
  const v = r.valor as VendaAberta
  const fica = item.saldo - d.quantidade
  if (!v.linhas.some((l) => l.itemId === d.itemId && l.quantidade > fica)) return { id: d.id }
  const linhas = v.linhas.map((l) => (l.itemId === d.itemId && l.quantidade > fica ? { ...l, quantidade: fica } : l))
  await ctx.repos.config.salvar(tocar(ctx, { ...r, valor: { ...v, linhas } }))
  await auditar(ctx, 'reduzirNaVendaAberta', d.id, `${item.codigo ?? item.nome}: a venda em aberto ficou com ${fica} g${d.para ? ` · ${d.quantidade} g foram para ${d.para}` : ''}`, [d.itemId])
  return { id: d.id }
}

/** concluiu uma venda: a própria em aberto some; nas outras, o pacote sai se o saldo que sobrou não der mais para elas */
export async function aoConcluirVenda(ctx: Ctx, vendaId: Id, itens: Id[], codigoVenda?: string) {
  for (const r of await lerTodas(ctx)) {
    const id = r.id.slice(CHAVE.length)
    const v = r.valor as VendaAberta
    if (id === vendaId) {
      await ctx.repos.config.salvar(tocar(ctx, { ...r, apagadoEm: ctx.relogio.agora() }))
      continue
    }
    for (const itemId of itens) {
      const saldo = (await ctx.repos.itens.obter(itemId))?.saldo ?? 0
      if (v.linhas.some((l) => l.itemId === itemId && l.quantidade > saldo)) await tirarDaVendaAberta(ctx, { id, itemId, para: codigoVenda })
    }
  }
}

/** a lista das vendas em aberto (para a aba "Em aberto" e para o aviso do caixa) */
export async function vendasAbertas(ctx: Ctx, _p: object = {}) {
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p.nome]))
  return (await lerTodas(ctx))
    // funcionária: só as vendas em aberto que ELA guardou
    .filter((r) => ctx.sessao.perfil === 'admin' || r.criadoPor === ctx.sessao.usuarioId)
    .map((r) => {
      const v = r.valor as VendaAberta & { salvaEm: string; abertaEm?: string; porNome?: string }
      return {
        id: r.id.slice(CHAVE.length),
        salvaEm: v.salvaEm,
        abertaEm: v.abertaEm ?? r.criadoEm,
        minha: r.criadoPor === ctx.sessao.usuarioId,
        porNome: v.porNome,
        cliente: v.pessoaId ? pessoas.get(v.pessoaId) : undefined,
        total: v.total,
        moedaTotal: v.moedaTotal,
        linhas: v.linhas.map((l) => ({ ...l, codigo: itens.get(l.itemId)?.codigo, nome: itens.get(l.itemId)?.nome ?? '—', saldo: itens.get(l.itemId)?.saldo ?? 0 })),
        venda: v,
      }
    })
    .sort((a, b) => (a.salvaEm < b.salvaEm ? 1 : -1))
}
