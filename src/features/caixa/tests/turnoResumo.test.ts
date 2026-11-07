// CAIXA › TURNOS: duração e média de vendas por hora do relatório
import { describe, expect, it } from 'vitest'
import { duracaoTexto, resumoTurno } from '../model/turno'

describe('resumo do turno', () => {
  it('trabalhou das 08:00 às 12:30 → 4 h 30; vendeu Bs 900 → Bs 200 por hora', () => {
    const r = resumoTurno({ inicio: '2026-11-07T08:00:00.000Z', fim: '2026-11-07T12:30:00.000Z', vendas: { total: 90000 } })
    expect(r.minutos).toBe(270)
    expect(duracaoTexto(r.minutos)).toBe('4 h 30')
    expect(r.porHora).toBe(20000)
  })

  it('sem vendas ou turno sem tempo: sem média (nada de divisão por zero)', () => {
    expect(resumoTurno({ inicio: '2026-11-07T08:00:00.000Z', fim: '2026-11-07T09:00:00.000Z' }).porHora).toBeUndefined()
    expect(resumoTurno({ inicio: '2026-11-07T08:00:00.000Z', fim: '2026-11-07T08:00:00.000Z', vendas: { total: 500 } }).porHora).toBeUndefined()
  })

  it('textos curtos de duração', () => {
    expect(duracaoTexto(45)).toBe('45 min')
    expect(duracaoTexto(120)).toBe('2 h')
    expect(duracaoTexto(61)).toBe('1 h 01')
  })
})
