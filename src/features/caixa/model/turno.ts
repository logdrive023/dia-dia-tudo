// CAIXA › TURNOS: as contas do relatório de um turno fechado (puras, testadas em tests/turnoResumo.test.ts).

/** quanto tempo durou (minutos inteiros) e a média de vendas por hora (centavos; sem vendas ou sem tempo → undefined) */
export function resumoTurno(t: { inicio: string; fim: string; vendas?: { total: number } }) {
  const minutos = Math.max(0, Math.round((Date.parse(t.fim) - Date.parse(t.inicio)) / 60000))
  const porHora = t.vendas && minutos >= 1 ? Math.round((t.vendas.total * 60) / minutos) : undefined
  return { minutos, porHora }
}

/** "4 h 30" · "45 min" · "2 h" */
export function duracaoTexto(minutos: number) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}
