// Pagamentos em qualquer moeda: cada um guarda a cotação usada e o valor na moeda principal.

import { ajustarCotacao, converter, formatar, type CodigoMoeda, type Cotacao, type UsoCambio } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id, Linha, Pagamento } from '../domain/tipos'
import { type Ctx, cotacoesAtuais, exigirInteiroPositivo, formaPagamento, lerConfig, paraPrincipal } from './contexto'

export interface PagamentoEntrada {
  id: Id
  forma: string
  moeda: CodigoMoeda
  valor: number
  /**
   * Cotação digitada NA HORA para este pagamento (ex.: venda cobrada em R$ com "1 R$ = 1,28 Bs"). Sem ela vale a
   * cotação do sistema para o uso (venda/compra). Ex.: { moeda: 'BRL', valor: '1,28', sentido: 'basePorMoeda', contra: 'BOB' }.
   */
  cotacao?: Cotacao
}

/** Converte para a moeda principal pela cotação digitada (guardada "achatada" contra a principal, como as do sistema). */
export async function paraPrincipalComCotacao(ctx: Ctx, valor: number, de: CodigoMoeda, c: Cotacao, uso: UsoCambio) {
  const cfg = await lerConfig(ctx)
  exigir(c.moeda === de, `A cotação informada é de ${c.moeda}, mas o pagamento é em ${de}.`)
  const digitada: Cotacao = {
    moeda: de,
    valor: String(c.valor ?? '').trim(),
    sentido: c.sentido === 'moedaPorBase' ? 'moedaPorBase' : 'basePorMoeda',
    contra: c.contra ?? cfg.moedaPrincipal,
    data: c.data || ctx.relogio.hoje(),
    uso,
  }
  const tabela = { ...(await cotacoesAtuais(ctx, uso)), [de]: digitada }
  const valorPrincipal = converter(valor, de, cfg.moedaPrincipal, tabela)
  return { valorPrincipal, cotacao: ajustarCotacao(de, cfg.moedaPrincipal, 0, tabela, uso, digitada.data) }
}

/**
 * Arredondamento aceito entre a soma dos pagamentos e o total (moeda principal): meia unidade da moeda de cada
 * pagamento em outra moeda, convertida (mínimo 1). Ex.: US$ a 6,96 Bs → 1 centavo de US$ = 6,96 centavos de Bs → 4.
 */
export function toleranciaConversao(pagamentos: Pick<Pagamento, 'moeda' | 'valor' | 'valorPrincipal'>[], principal: string) {
  return pagamentos.filter((p) => p.moeda !== principal).reduce((s, p) => s + Math.max(1, Math.ceil(p.valor ? Math.abs(p.valorPrincipal / p.valor) / 2 : 1)), 0)
}

/**
 * Confere e converte os pagamentos. A soma (na moeda principal) precisa fechar com o total:
 * tolera o arredondamento de cada pagamento em outra moeda (meia unidade dela, no mínimo 1 da principal).
 */
export async function montarPagamentos(
  ctx: Ctx,
  entrada: PagamentoEntrada[],
  totalPrincipal: number,
  _linhas: Linha[],
  /** com pessoa: pode pagar só uma parte (o resto fica na conta dela) ou a mais (fica de crédito) */
  permitirParcial = false,
  /** venda: recebo em outra moeda (taxa de venda); compra: pago em outra moeda (taxa de compra) */
  uso: UsoCambio = 'base',
): Promise<Pagamento[]> {
  const cfg = await lerConfig(ctx)
  const pagamentos: Pagamento[] = []
  for (const p of entrada.filter((x) => x.valor !== 0)) {
    exigirInteiroPositivo(p.valor, 'Pagamento')
    const f = await formaPagamento(ctx, p.forma)
    exigir(f.moedas.includes(p.moeda), `${f.nome} não aceita ${p.moeda}.`)
    const conv = p.cotacao && p.moeda !== cfg.moedaPrincipal ? await paraPrincipalComCotacao(ctx, p.valor, p.moeda, p.cotacao, uso) : await paraPrincipal(ctx, p.valor, p.moeda, uso)
    pagamentos.push({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor, cotacao: conv.cotacao, valorPrincipal: conv.valorPrincipal })
  }
  const soma = pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
  const tolerancia = toleranciaConversao(pagamentos, cfg.moedaPrincipal)
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
