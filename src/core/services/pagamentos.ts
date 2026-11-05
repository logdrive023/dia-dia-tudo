// Pagamentos em qualquer moeda: cada um guarda a cotação usada e o valor na moeda principal.

import { ajustarCotacao, converter, formatar, textoCotacao, type CodigoMoeda, type Cotacao, type TabelaCotacoes, type UsoCambio } from '../domain/dinheiro'
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

/** quanto vale 1 unidade MENOR de `de` em unidades menores de `para` (ex.: 1 centavo de US$ ≈ 6,96 centavos de Bs) */
function taxaMenor(de: CodigoMoeda, para: CodigoMoeda, tabela: TabelaCotacoes): number | undefined {
  try {
    const escala = 1_000_000
    const v = converter(escala, de, para, tabela) / escala
    return Number.isFinite(v) && v > 0 ? v : undefined
  } catch {
    return undefined
  }
}

/** a cotação digitada pode diferir da do sistema no máximo isso (±50%): fora disso é erro de digitação ou fraude */
export const DESVIO_MAXIMO_COTACAO = 0.5

/**
 * Converte para a moeda principal pela cotação digitada (guardada "achatada" contra a principal, como as do sistema).
 * Recusa a cotação que foge demais da do sistema (1 US$ = 1.000.000 Bs deixaria US$ 0,01 quitar qualquer venda).
 */
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
  const sistema = await cotacoesAtuais(ctx, uso)
  const tabela = { ...sistema, [de]: digitada }
  const taxaSistema = taxaMenor(de, cfg.moedaPrincipal, sistema)
  const taxaDigitada = taxaMenor(de, cfg.moedaPrincipal, tabela)
  if (taxaSistema && taxaDigitada)
    exigir(
      Math.abs(taxaDigitada / taxaSistema - 1) <= DESVIO_MAXIMO_COTACAO,
      `A cotação digitada para ${de} está muito longe da do sistema (${textoCotacao(ajustarCotacao(de, cfg.moedaPrincipal, 0, sistema, uso, ''))}). Confira o valor.`,
    )
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
  const sistema = await cotacoesAtuais(ctx, uso)
  // arredondamento aceito: meia unidade menor de cada pagamento em outra moeda, valendo pela cotação DO SISTEMA
  // (nunca pela digitada: senão uma cotação absurda abre uma "folga" do tamanho que quiser). Mínimo 1 da principal.
  let tolerancia = 0
  for (const p of entrada.filter((x) => x.valor !== 0)) {
    exigirInteiroPositivo(p.valor, 'Pagamento')
    const f = await formaPagamento(ctx, p.forma)
    exigir(f.moedas.includes(p.moeda), `${f.nome} não aceita ${p.moeda}.`)
    const conv = p.cotacao && p.moeda !== cfg.moedaPrincipal ? await paraPrincipalComCotacao(ctx, p.valor, p.moeda, p.cotacao, uso) : await paraPrincipal(ctx, p.valor, p.moeda, uso)
    pagamentos.push({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor, cotacao: conv.cotacao, valorPrincipal: conv.valorPrincipal })
    if (p.moeda !== cfg.moedaPrincipal) {
      // cotação digitada (já conferida: no máximo +50% da do sistema) pode arredondar um pouco mais que a do sistema
      const propria = Math.abs(conv.valorPrincipal / p.valor)
      const doSistema = taxaMenor(p.moeda, cfg.moedaPrincipal, sistema)
      const taxa = doSistema ? Math.max(doSistema, Math.min(propria, doSistema * (1 + DESVIO_MAXIMO_COTACAO))) : propria
      tolerancia += Math.max(1, Math.ceil(taxa / 2))
    }
  }
  const soma = pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
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
