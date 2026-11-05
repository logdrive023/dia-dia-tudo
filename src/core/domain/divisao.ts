// A CONTA DA DIVISÃO do valor da venda (pura: a mesma no servidor e na tela). Cada parte leva o % da SUA base (total
// cobrado, líquido ou lucro) ou um valor fixo; o que sobra do total cobrado fica com a casa.
import type { ParteDivisao } from './tipos'

export type BasesDivisao = { total: number; liquido: number; lucro: number }

export function calcularDivisao(partes: ParteDivisao[], bases: BasesDivisao) {
  const calc = partes.map((p) => ({ ...p, calculado: p.modo === 'valor' ? p.valor ?? 0 : Math.round(((bases[p.base] ?? 0) * (p.pctBp ?? 0)) / 10000) }))
  const dividido = calc.reduce((s, p) => s + p.calculado, 0)
  return { partes: calc, dividido, casa: bases.total - dividido }
}
