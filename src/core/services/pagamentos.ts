// Pagamentos em qualquer moeda: cada um guarda a cotação usada e o valor na moeda principal.

import { formatar, type CodigoMoeda } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id, Linha, Pagamento } from '../domain/tipos'
import { type Ctx, exigirInteiroPositivo, formaPagamento, lerConfig, paraPrincipal } from './contexto'

export interface PagamentoEntrada {
  id: Id
  forma: string
  moeda: CodigoMoeda
  valor: number
}

/**
 * Confere e converte os pagamentos. A soma (na moeda principal) precisa fechar com o total:
 * tolera 1 unidade por pagamento em outra moeda (arredondamento da conversão).
 */
export async function montarPagamentos(
  ctx: Ctx,
  entrada: PagamentoEntrada[],
  totalPrincipal: number,
  _linhas: Linha[],
  /** com pessoa: pode pagar só uma parte (o resto fica na conta dela) ou a mais (fica de crédito) */
  permitirParcial = false,
): Promise<Pagamento[]> {
  const cfg = await lerConfig(ctx)
  const pagamentos: Pagamento[] = []
  for (const p of entrada.filter((x) => x.valor !== 0)) {
    exigirInteiroPositivo(p.valor, 'Pagamento')
    const f = await formaPagamento(ctx, p.forma)
    exigir(f.moedas.includes(p.moeda), `${f.nome} não aceita ${p.moeda}.`)
    const conv = await paraPrincipal(ctx, p.valor, p.moeda)
    pagamentos.push({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor, cotacao: conv.cotacao, valorPrincipal: conv.valorPrincipal })
  }
  const soma = pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
  const tolerancia = pagamentos.filter((p) => p.moeda !== cfg.moedaPrincipal).length
  if (permitirParcial) return pagamentos
  if (totalPrincipal > 0) exigir(pagamentos.length, 'Diga como foi pago.')
  exigir(
    Math.abs(soma - totalPrincipal) <= tolerancia,
    soma < totalPrincipal
      ? `Falta ${formatar(totalPrincipal - soma, cfg.moedaPrincipal)} no pagamento.`
      : `O pagamento passou ${formatar(soma - totalPrincipal, cfg.moedaPrincipal)} do total.`,
  )
  return pagamentos
}
