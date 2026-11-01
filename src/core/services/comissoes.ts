// COMISSÕES tratadas dos dois jeitos, sem contar duas vezes:
//  1) HISTÓRICO (o que foi ganho): nasce em cada venda/atendimento (linha × % da profissional) e muda junto quando a
//     venda é corrigida ou cancelada. Já entra como custo no lucro da venda.
//  2) LANÇAMENTO (o que foi pago): pagamento de comissão sai do caixa com a categoria "Comissões".
//     A pagar = ganho − pago. No resultado (DRE) o pagamento não vira despesa de novo.

import type { CodigoMoeda } from '../domain/dinheiro'
import { converter } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id } from '../domain/tipos'
import { auditar, type Ctx, cotacoesAtuais, exigirInteiroPositivo, lerConfig, paraPrincipal } from './contexto'
import { moverCaixa } from './caixa'

export const CATEGORIA_COMISSAO = 'Comissões'

export async function comissoes(ctx: Ctx, p: { de?: string; ate?: string; pessoaId?: Id } = {}) {
  const pessoaId = ctx.sessao.perfil === 'funcionario' ? ctx.sessao.pessoaId ?? ctx.sessao.usuarioId : p.pessoaId
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx)
  const conv = (v: number, m: string) => {
    try {
      return converter(v, m, cfg.moedaPrincipal, cot)
    } catch {
      return 0
    }
  }
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const noPeriodo = (d: string) => (!p.de || d >= p.de) && (!p.ate || d <= p.ate)
  const ganhos = (await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    .filter((t) => t.etapa === 'concluido')
    .flatMap((t) =>
      t.linhas
        .filter((l) => l.comissaoPrincipal && (l.profissionalId ?? t.profissionalId))
        .map((l) => ({
          tipo: 'ganho' as const,
          data: t.data,
          vendaId: t.id,
          pessoaId: (l.profissionalId ?? t.profissionalId)!,
          cliente: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
          descricao: l.descricao,
          base: l.totalPrincipal,
          bp: l.comissaoBp ?? 0,
          valor: l.comissaoPrincipal!,
          corrigida: t.historico.some((h) => h.tipo === 'correcao'),
        })),
    )
    .filter((g) => !pessoaId || g.pessoaId === pessoaId)
  const pagos = (await ctx.repos.movCaixa.listar())
    .filter((m) => m.categoria === CATEGORIA_COMISSAO && m.pessoaId && !m.estornadoPor && m.tipo === 'despesa')
    .filter((m) => !pessoaId || m.pessoaId === pessoaId)
    .map((m) => ({ tipo: 'pago' as const, data: m.data, pessoaId: m.pessoaId!, descricao: m.descricao, valor: m.valorPrincipal !== undefined ? -Math.sign(m.delta) * m.valorPrincipal : -conv(m.delta, m.moeda), forma: m.forma, moeda: m.moeda, valorMoeda: -m.delta }))
  const ids = [...new Set([...ganhos.map((g) => g.pessoaId), ...pagos.map((x) => x.pessoaId)])]
  const porPessoa = ids
    .map((id) => {
      const g = ganhos.filter((x) => x.pessoaId === id)
      const pg = pagos.filter((x) => x.pessoaId === id)
      const ganhoTotal = g.reduce((s, x) => s + x.valor, 0)
      const pagoTotal = pg.reduce((s, x) => s + x.valor, 0)
      return {
        pessoaId: id,
        nome: pessoas.get(id)?.nome ?? '—',
        ganhoPeriodo: g.filter((x) => noPeriodo(x.data)).reduce((s, x) => s + x.valor, 0),
        pagoPeriodo: pg.filter((x) => noPeriodo(x.data)).reduce((s, x) => s + x.valor, 0),
        ganhoTotal,
        pagoTotal,
        aPagar: ganhoTotal - pagoTotal,
        atendimentos: new Set(g.filter((x) => noPeriodo(x.data)).map((x) => x.vendaId)).size,
      }
    })
    .sort((a, b) => b.aPagar - a.aPagar)
  const extrato = [...ganhos.filter((x) => noPeriodo(x.data)), ...pagos.filter((x) => noPeriodo(x.data))].sort((a, b) => (a.data < b.data ? 1 : -1))
  return { moeda: cfg.moedaPrincipal, porPessoa, extrato, aPagar: porPessoa.reduce((s, x) => s + x.aPagar, 0) }
}

/** Paga comissão (tudo o que falta ou uma parte). Sai do caixa como "Comissões", ligada à profissional. */
export async function pagarComissao(ctx: Ctx, d: { id: Id; pessoaId: Id; valor: number; moeda: CodigoMoeda; forma: string; referencia?: string }) {
  if (await ctx.repos.movCaixa.obter(d.id)) return { id: d.id }
  const pessoa = await ctx.repos.pessoas.obter(d.pessoaId)
  exigir(pessoa, 'Escolha a profissional.', 'pessoaId')
  exigirInteiroPositivo(d.valor, 'Valor')
  const { valorPrincipal } = await paraPrincipal(ctx, d.valor, d.moeda)
  await moverCaixa(ctx, {
    valorPrincipal,
    id: d.id,
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: -d.valor,
    tipo: 'despesa',
    categoria: CATEGORIA_COMISSAO,
    descricao: `Comissão · ${pessoa.nome}${d.referencia?.trim() ? ` · ${d.referencia.trim()}` : ''}`,
    localId: pessoa.localId,
    pessoaId: pessoa.id,
  })
  await auditar(ctx, 'pagarComissao', pessoa.id, `${d.valor} ${d.moeda}`)
  return { id: d.id }
}
