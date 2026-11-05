// FORMAS DE PAGAMENTO EM USO: a forma desligada em Configurações › Formas de pagamento some de TODA tela que pede para
// escolher (venda, compra, caixa, comissão, empréstimo…). O que já foi pago com ela continua nos relatórios e filtros.
// Dinheiro (efectivo) não desliga: é o caixa da mão e o padrão quando nada mais serve.

export const FORMA_FIXA = 'dinheiro'

export function formasEmUso<F extends { id: string; desligada?: boolean; moedas: string[] }>(formas: F[] | undefined, moeda?: string): F[] {
  return (formas ?? []).filter((f) => (f.id === FORMA_FIXA || !f.desligada) && (!moeda || f.moedas.includes(moeda)))
}
