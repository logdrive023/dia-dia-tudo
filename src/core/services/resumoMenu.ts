// Números ao vivo do menu: o menu diz direto o que importa agora (vendido hoje, triagem, agenda, quem deve…).

import { converter, MOEDAS } from '../domain/dinheiro'
import { type Ctx, cotacoesAtuais, lerConfig } from './contexto'
import { situacaoDe } from './emprestimos'
import { viagensAbertas } from './viagens'
import { resumoFinanciamentos } from './financiamentos'

export async function resumoMenu(ctx: Ctx, _p: object = {}) {
  const hoje = ctx.relogio.hoje()
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx)
  const conv = (v: number, m: string) => {
    try {
      return converter(v, m, cfg.moedaPrincipal, cot)
    } catch {
      return 0
    }
  }
  const func = ctx.sessao.perfil === 'funcionario'
  const eu = ctx.sessao.pessoaId ?? ctx.sessao.usuarioId
  const trans = await ctx.repos.transacoes.listar()
  const vendasHoje = trans.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && t.data === hoje && (!func || t.criadoPor === ctx.sessao.usuarioId || t.profissionalId === eu))
  const agendadosHoje = trans.filter((t) => t.tipo === 'venda' && t.etapa === 'agendado' && t.agendadoPara && t.data === hoje && (!func || t.profissionalId === eu))
  // viagens de compra abertas (funcionária: só as dela; o menu só mostra "Viagens" a quem tem viagem)
  const abertas = (await viagensAbertas(ctx)).filter((v) => !func || v.minha)
  // adiantamentos a parceiros em andamento (funcionária: só os dela; o serviço filtra)
  const adiant = await resumoFinanciamentos(ctx)
  const base = {
    moeda: cfg.moedaPrincipal,
    vendasHoje: vendasHoje.length,
    totalHoje: vendasHoje.reduce((s, t) => s + t.totalPrincipal, 0),
    agendadosHoje: agendadosHoje.length,
    viagensAbertas: abertas.length,
    viagensAcimaOrcamento: abertas.filter((v) => v.acimaOrcamento).length,
    adiantamentosAbertos: adiant.abertos + adiant.aPagar,
    adiantamentosAPagar: adiant.aPagar,
  }
  if (func) return { ...base, triagem: 0, caixaHoje: 0, aReceber: 0, atrasadas: 0, brutos: 0, aguardandoTriagem: 0, repor: 0 }
  const triagem = trans.filter((t) => t.tipo === 'compra' && !['concluido', 'recusado', 'cancelado'].includes(t.etapa)).length
  const caixa = await ctx.repos.movCaixa.listar()
  const caixaTotal = MOEDAS.reduce((s, m) => s + conv(caixa.filter((x) => x.moeda === m.codigo).reduce((a, x) => a + x.delta, 0), m.codigo), 0)
  const contas = await ctx.repos.movConta.listar()
  const porPessoa = new Map<string, number>()
  for (const m of contas) porPessoa.set(m.pessoaId, (porPessoa.get(m.pessoaId) ?? 0) + m.delta)
  const aReceber = [...porPessoa.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0)
  let atrasadas = 0
  for (const e of (await ctx.repos.emprestimos.listar()).filter((x) => x.situacao === 'aberto' && x.direcao === 'dado'))
    atrasadas += (await situacaoDe(ctx, e)).parcelas.filter((p) => p.status === 'atrasada').length
  const itens = await ctx.repos.itens.listar()
  return {
    ...base,
    triagem,
    caixaHoje: caixaTotal,
    aReceber,
    atrasadas,
    brutos: itens.filter((i) => i.saldo > 0 && i.campos.estado === 'Bruto').length,
    aguardandoTriagem: itens.filter((i) => i.saldo > 0 && i.campos.estado === 'Bruto' && (!i.faseTriagem || !!i.faseTriagem.entrada)).length,
    repor: itens.filter((i) => i.controlaEstoque && i.estoqueIdeal && i.saldo < i.estoqueIdeal).length,
  }
}
