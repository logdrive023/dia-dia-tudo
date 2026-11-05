// REGISTRO DOS IMPOSTOS ESTIMADOS (só log — "nunca se sabe quando vai precisar"): a cada venda e compra, guarda na
// própria transação e no histórico a conta do imposto na hora, com a alíquota VIGENTE e a fonte daquele dia.
// Vale mesmo com a exibição desligada (Configurações › Fiscal): mostrar é escolha; guardar o registro é sempre.
import { formatar } from '../domain/dinheiro'
import type { Transacao } from '../domain/tipos'
import { impostosDaOperacao, impostosDoRegime } from '../dados/impostos'
import { auditar, type Ctx, lerConfig } from './contexto'

export async function registrarImpostosEstimados(ctx: Ctx, t: Transacao) {
  const cfg = await lerConfig(ctx)
  // a mesma regra da tela: só o que vale por venda no regime escolhido
  const lista = impostosDoRegime(cfg.fiscal).lista
  if (!lista.some((i) => i.ligado)) return
  let op: { produto?: number; servico?: number; compra?: number }
  if (t.tipo === 'compra') op = { compra: t.totalPrincipal }
  else {
    // serviço (salão) × produto (cabelo, mercadoria): cada um com a sua taxa
    const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
    let produto = 0
    let servico = 0
    for (const l of t.linhas) {
      const it = l.itemId ? itens.get(l.itemId) : undefined
      if (it?.tipoItem === 'servico' || it?.moduloId === 'salao') servico += l.totalPrincipal
      else produto += l.totalPrincipal
    }
    op = { produto, servico }
  }
  const r = impostosDaOperacao(lista, op, cfg.fiscal.modoPreco ?? 'dentro')
  if (!r.linhas.length) return
  const total = t.tipo === 'compra' ? r.compra : r.venda
  const m = cfg.moedaPrincipal
  t.impostosEstimados = {
    em: ctx.relogio.agora(),
    modoPreco: r.modoPreco,
    total,
    linhas: r.linhas.map((l) => ({ sigla: l.sigla, nome: l.nome, taxaBp: l.taxaBp, base: l.base, valor: l.valor, lado: l.lado, credito: l.credito, fonte: l.fonte, vigenteDesde: l.vigenteDesde })),
  }
  await ctx.repos.transacoes.salvar(t)
  await auditar(ctx, 'impostosEstimados', t.id, `${t.codigo ?? ''} · ${r.linhas.map((l) => `${l.sigla} ${l.taxaBp / 100}% × ${formatar(l.base, m)} = ${formatar(l.valor, m)}${l.credito ? ' (crédito)' : ''}`).join(' · ')} · total ${formatar(total, m)} (estimado, não cobrado)`)
}
