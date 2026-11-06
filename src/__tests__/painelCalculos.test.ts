// As contas do Painel (painel/calculos.ts): variação, texto do período, soma dos alertas e o resumo das viagens.
import { describe, expect, it } from 'vitest'
import { resumoViagens, somaAlertas, textoPeriodo, variacaoPct } from '../screens/painel/calculos'

describe('painel: cálculos', () => {
  it('variação: inteira, arredondada; sem base comparável → undefined', () => {
    expect(variacaoPct(112, 100)).toBe(12)
    expect(variacaoPct(91.5, 100)).toBe(-8)
    expect(variacaoPct(100, 0)).toBeUndefined()
    expect(variacaoPct(100, -5)).toBeUndefined()
    expect(variacaoPct(100)).toBeUndefined()
    expect(variacaoPct(700, 100)).toBe(600)
  })

  it('texto do período: um dia, intervalo e o período anterior do mesmo tamanho', () => {
    expect(textoPeriodo('2026-11-05', '2026-11-05', false, 'vs.')).toBe('05/11')
    expect(textoPeriodo('2026-10-01', '2026-10-30', false, 'vs.')).toBe('01/10 – 30/10')
    expect(textoPeriodo('2026-10-01', '2026-10-30', true, 'vs.')).toBe('01/10 – 30/10 · vs. 01/09 – 30/09')
  })

  it('soma dos alertas por nível', () => {
    const a = (nivel: 'urgente' | 'atencao' | 'info', quantidade: number) => ({ id: nivel + quantidade, nivel, quantidade, titulo: '', acao: '', itens: [] })
    expect(somaAlertas([a('urgente', 2), a('urgente', 3), a('atencao', 1)], 'urgente')).toBe(5)
    expect(somaAlertas([a('atencao', 1)], 'info')).toBe(0)
  })

  it('viagens: só as do período (abertas sempre), totais, custo/kg e ROI médio das que têm ROI', () => {
    const v = (o: Record<string, unknown>) => ({ status: 'fechada', inicio: '2026-10-05', fim: '2026-10-08', gasto: 0, custoCabelo: 0, gramas: 0, resultado: 0, ...o }) as never
    const r = resumoViagens([
      v({ gasto: 800, custoCabelo: 14000, gramas: 4000, resultado: -200, roiBp: 1000 }),
      v({ status: 'aberta', inicio: '2026-01-01', fim: undefined, gasto: 200, roiBp: 2001 }),
      v({ inicio: '2026-08-01', fim: '2026-08-03', gasto: 999 }), // fora do período
    ], '2026-10-01', '2026-10-31')
    expect(r.gasto).toBe(1000)
    expect(r.resultado).toBe(-200)
    expect(r.abertas).toHaveLength(1)
    expect(r.custoKgReal).toBe(3750) // (14000 + 1000) × 1000 ÷ 4000
    expect(r.logisticaKg).toBe(250)
    expect(r.roiBp).toBe(1501) // média arredondada de 1000 e 2001
    const vazio = resumoViagens([], '2026-10-01', '2026-10-31')
    expect([vazio.custoKgReal, vazio.logisticaKg, vazio.roiBp]).toEqual([undefined, undefined, undefined])
  })
})
