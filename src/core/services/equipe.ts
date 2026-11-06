// EQUIPE E UNIDADES: organograma por salão, resumo rápido do funcionário e "ponta do lápis" de cada unidade
// (entradas dos atendimentos × saídas: salários + despesas da unidade + comissões).

import { proporcao } from '../domain/dinheiro'
import { diasEntre } from '../domain/datas'
import type { Id, Pessoa } from '../domain/tipos'
import { exigir } from '../domain/erros'
import { auditar, type Ctx, conversorPrincipal, exigirInteiroPositivo, lerConfig, ehEquipe, euPessoa } from './contexto'
import { moverCaixa } from './caixa'


const DIAS_DO_PERIODO = { mes: 30, semana: 7, dia: 1 } as const

/** Salário levado para "por mês" (para comparar): Bs 700/semana ≈ Bs 3.000/mês; Bs 120/dia ≈ Bs 3.600/mês. */
export function salarioMensal(p: Pessoa, conv: (v: number, m: string) => number) {
  if (!p.salario) return 0
  const dias = DIAS_DO_PERIODO[p.salario.periodo ?? 'mes']
  return proporcao(conv(p.salario.valor, p.salario.moeda), 30, dias)
}

/** Desempenho de cada pessoa da equipe no período (atendimentos concluídos, faturamento e comissão). */
async function desempenho(ctx: Ctx, de: string, ate: string) {
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa === 'concluido' && t.data >= de && t.data <= ate)
  const mapa = new Map<Id, { atendimentos: number; faturamento: number; comissao: number }>()
  for (const t of vendas) {
    const vistos = new Set<Id>()
    for (const l of t.linhas) {
      const pid = l.profissionalId ?? t.profissionalId
      if (!pid) continue
      const a = mapa.get(pid) ?? { atendimentos: 0, faturamento: 0, comissao: 0 }
      if (!vistos.has(pid)) a.atendimentos++
      vistos.add(pid)
      a.faturamento += l.totalPrincipal
      a.comissao += l.comissaoPrincipal ?? 0
      mapa.set(pid, a)
    }
  }
  return mapa
}

export interface NoOrganograma {
  pessoa: Pessoa
  salarioPrincipal: number
  atendimentos: number
  faturamento: number
  subordinados: NoOrganograma[]
}

/** Organograma: árvore da equipe (por superior), filtrada por unidade. Quem não tem chefe na unidade fica no topo. */
export async function organograma(ctx: Ctx, p: { localId?: Id; de: string; ate: string }) {
  const localId = ctx.sessao.perfil === 'funcionario' ? ctx.sessao.localId : p.localId
  const conv = await conversorPrincipal(ctx)
  const todos = (await ctx.repos.pessoas.listar()).filter(ehEquipe)
  const equipe = todos.filter((x) => !localId || x.localId === localId)
  const ids = new Set(equipe.map((x) => x.id))
  const des = await desempenho(ctx, p.de, p.ate)
  const admin = ctx.sessao.perfil === 'admin'
  const montar = (pessoa: Pessoa): NoOrganograma => ({
    pessoa: admin ? pessoa : { ...pessoa, salario: undefined, comissaoBp: undefined, documento: undefined },
    salarioPrincipal: admin ? salarioMensal(pessoa, conv) : 0,
    atendimentos: des.get(pessoa.id)?.atendimentos ?? 0,
    faturamento: des.get(pessoa.id)?.faturamento ?? 0,
    subordinados: equipe.filter((x) => x.superiorId === pessoa.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(montar),
  })
  const raizes = equipe.filter((x) => !x.superiorId || !ids.has(x.superiorId)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(montar)
  return { raizes, total: equipe.length, locais: (await ctx.repos.locais.listar()).filter((l) => !localId || l.id === localId) }
}

/** Resumo rápido (cartão ao tocar no funcionário): nome, cargo, salário, unidade, desempenho. */
export async function resumoFuncionario(ctx: Ctx, p: { id: Id; de: string; ate: string }) {
  // funcionária só vê o resumo dela
  if (ctx.sessao.perfil !== 'admin') exigir(p.id === euPessoa(ctx), 'Sem permissão para ver isso.')
  const pessoa = await ctx.repos.pessoas.obter(p.id)
  if (!pessoa) return undefined
  const conv = await conversorPrincipal(ctx)
  const des = (await desempenho(ctx, p.de, p.ate)).get(pessoa.id) ?? { atendimentos: 0, faturamento: 0, comissao: 0 }
  const local = pessoa.localId ? await ctx.repos.locais.obter(pessoa.localId) : undefined
  const superior = pessoa.superiorId ? await ctx.repos.pessoas.obter(pessoa.superiorId) : undefined
  const agendados = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter(
    (t) => t.etapa === 'agendado' && (t.profissionalId === pessoa.id || t.linhas.some((l) => l.profissionalId === pessoa.id)),
  ).length
  const salarioPrincipal = salarioMensal(pessoa, conv)
  // pago de verdade = salários − o que foi desfeito deles (o desfazer leva a mesma categoria e pessoa)
  const pagos = (await ctx.repos.movCaixa.listar()).filter((m) => m.pessoaId === pessoa.id && m.categoria === 'Salários' && m.data >= p.de && m.data <= p.ate && (m.tipo === 'despesa' || m.tipo === 'estorno'))
  const pagoNoPeriodo = 0 - pagos.reduce((s, m) => s + conv(m.delta, m.moeda), 0)
  return {
    pagoNoPeriodo, pessoa, local, superior, salarioPrincipal, ...des, agendados, ticket: des.atendimentos ? Math.round(des.faturamento / des.atendimentos) : 0 }
}

/**
 * UNIDADES na ponta do lápis, no período:
 *   Entradas = atendimentos/vendas da unidade
 *   Saídas = salários (estimados pelo cadastro e proporcionais aos dias: por mês, semana ou dia) + despesas da unidade
 *            + comissões + custo do cabelo usado. O que foi pago de verdade aparece ao lado (salariosPagos).
 *   Margem = Entradas − Saídas
 * Ex.: 4 funcionários de Bs 3.000 = Bs 12.000/mês de custo fixo; em 15 dias, Bs 6.000.
 */
export async function unidades(ctx: Ctx, p: { de: string; ate: string }) {
  const cfg = await lerConfig(ctx)
  const conv = await conversorPrincipal(ctx)
  // período ao contrário (de depois de até) não tem dia nenhum: nada de salário "negativo"
  const dias = Math.max(0, diasEntre(p.de, p.ate) + 1)
  const locais = (await ctx.repos.locais.listar()).filter((l) => ctx.sessao.perfil !== 'funcionario' || l.id === ctx.sessao.localId)
  const pessoas = await ctx.repos.pessoas.listar()
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.data >= p.de && t.data <= p.ate)
  const todoCaixa = await ctx.repos.movCaixa.listar()
  const porId = new Map(todoCaixa.map((m) => [m.id, m]))
  const caixa = todoCaixa.filter((m) => m.data >= p.de && m.data <= p.ate && m.localId)
  // desfazer de despesa conta (devolve a despesa); desfazer de entrada não é despesa — a mesma regra do DRE
  const ehDespesa = (m: (typeof todoCaixa)[number]) => m.tipo === 'despesa' || (m.tipo === 'estorno' && !!m.estornaId && porId.get(m.estornaId)?.tipo === 'despesa')
  const lista = locais.map((l) => {
    const equipe = pessoas.filter((x) => ehEquipe(x) && x.localId === l.id)
    const salarioMes = equipe.reduce((s, x) => s + salarioMensal(x, conv), 0)
    const salarios = proporcao(salarioMes, dias, 30)
    // pago de verdade = salários pagos − os desfeitos (antes tirava o original e somava o desfazer: dava negativo)
    const salariosPagos = 0 - caixa.filter((m) => m.localId === l.id && m.pessoaId && m.categoria === 'Salários' && ehDespesa(m)).reduce((s, m) => s + conv(m.delta, m.moeda), 0)
    const daUnidade = vendas.filter((t) => t.localId === l.id)
    const concluidas = daUnidade.filter((t) => t.etapa === 'concluido')
    const entradas = concluidas.reduce((s, t) => s + t.totalPrincipal, 0)
    const comissoes = concluidas.reduce((s, t) => s + t.linhas.reduce((x, li) => x + (li.comissaoPrincipal ?? 0), 0), 0)
    const custoCabelo = concluidas.reduce((s, t) => s + t.linhas.reduce((x, li) => x + (li.custoPrincipal ?? 0), 0), 0)
    // insumos dos serviços (tinta, água oxigenada…): custo da unidade
    const insumos = concluidas.reduce((s, t) => s + t.linhas.reduce((x, li) => x + (li.insumoPrincipal ?? 0), 0), 0)
    // despesas da unidade, sem os salários (esses entram pela estimativa acima)
    const despesas = 0 - caixa.filter((m) => m.localId === l.id && !m.pessoaId && ehDespesa(m)).reduce((s, m) => s + conv(m.delta, m.moeda), 0)
    const saidas = salarios + comissoes + custoCabelo + insumos + despesas
    return {
      local: l,
      funcionarios: equipe.length,
      salarioMensal: salarioMes,
      salarios,
      salariosPagos,
      entradas,
      comissoes,
      custoCabelo,
      insumos,
      despesas,
      saidas,
      margem: entradas - saidas,
      atendimentos: concluidas.length,
      agendados: daUnidade.filter((t) => t.etapa === 'agendado').length,
      clientes: pessoas.filter((x) => x.papeis.includes('cliente') && x.localId === l.id).length,
      pontoEquilibrio: salarios + despesas,
    }
  })
  return {
    moeda: cfg.moedaPrincipal,
    dias,
    lista,
    total: {
      entradas: lista.reduce((s, x) => s + x.entradas, 0),
      saidas: lista.reduce((s, x) => s + x.saidas, 0),
      margem: lista.reduce((s, x) => s + x.margem, 0),
      salarioMensal: lista.reduce((s, x) => s + x.salarioMensal, 0),
      salariosPagos: lista.reduce((s, x) => s + x.salariosPagos, 0),
    },
  }
}

// ---------- pagamento de salário (com "repetir o último") ----------

/** Paga salário/diária/semana: vira despesa da unidade no caixa, ligada à pessoa. */
export async function pagarSalario(
  ctx: Ctx,
  d: { id: Id; pessoaId: Id; valor: number; moeda: string; forma: string; referencia?: string; localId?: Id },
) {
  if (await ctx.repos.movCaixa.obter(d.id)) return { id: d.id }
  const pessoa = await ctx.repos.pessoas.obter(d.pessoaId)
  exigir(pessoa, 'Escolha a pessoa.', 'pessoaId')
  exigirInteiroPositivo(d.valor, 'Valor')
  const periodo = { mes: 'mês', semana: 'semana', dia: 'dia' }[pessoa.salario?.periodo ?? 'mes']
  await moverCaixa(ctx, {
    id: d.id,
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: -d.valor,
    tipo: 'despesa',
    categoria: 'Salários',
    descricao: `Salário · ${pessoa.nome}${d.referencia?.trim() ? ` · ${d.referencia.trim()}` : ` · por ${periodo}`}`,
    localId: d.localId ?? pessoa.localId,
    pessoaId: pessoa.id,
  })
  await auditar(ctx, 'pagarSalario', pessoa.id, `${d.valor} ${d.moeda}`)
  return { id: d.id }
}

/** Sugestão para o próximo pagamento: repete o último (ou usa o do cadastro). Evita digitar tudo de novo. */
export async function sugestaoSalario(ctx: Ctx, p: { pessoaId: Id }) {
  const pessoa = await ctx.repos.pessoas.obter(p.pessoaId)
  const ultimo = (await ctx.repos.movCaixa.listar())
    .filter((m) => m.pessoaId === p.pessoaId && m.tipo === 'despesa' && m.categoria === 'Salários' && !m.estornadoPor)
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))[0]
  if (ultimo) return { valor: -ultimo.delta, moeda: ultimo.moeda, forma: ultimo.forma, origem: 'ultimo' as const, data: ultimo.data }
  if (pessoa?.salario) return { valor: pessoa.salario.valor, moeda: pessoa.salario.moeda, forma: 'dinheiro', origem: 'cadastro' as const, data: undefined }
  return undefined
}

/** Último lançamento parecido (para o botão "repetir o último" do caixa). */
export async function ultimoLancamento(ctx: Ctx, p: { tipo?: string }) {
  const ms = (await ctx.repos.movCaixa.listar())
    .filter((m) => ['entrada', 'despesa', 'retirada', 'dar'].includes(m.tipo) && !m.pessoaId && (!p.tipo || m.tipo === p.tipo))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  return ms[0]
}
