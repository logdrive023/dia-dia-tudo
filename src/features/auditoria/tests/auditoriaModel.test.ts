// AUDITORIA › a lista separada por dia: o rótulo do dia e onde começa um dia novo.
import { describe, expect, it } from 'vitest'
import { comecaDia, horaSegundos, rotuloDia } from '../model/auditoria'

describe('auditoria: os dias da lista', () => {
  it('hoje, ontem, outro dia e outro ano', () => {
    expect(rotuloDia('2026-11-10', '2026-11-10')).toEqual({ texto: 'Hoje', traduzir: true })
    expect(rotuloDia('2026-11-09', '2026-11-10')).toEqual({ texto: 'Ontem', traduzir: true })
    expect(rotuloDia('2026-11-02', '2026-11-10')).toEqual({ texto: 'seg 02/11', traduzir: false })
    expect(rotuloDia('2025-12-31', '2026-01-02').texto).toBe('qua 31/12/2025')
  })

  it('o cabeçalho aparece na 1ª linha e quando o dia muda', () => {
    const local = (d: number, h: number) => new Date(2026, 10, d, h, 0, 0).toISOString()
    const lista = [{ em: local(10, 15) }, { em: local(10, 9) }, { em: local(9, 23) }, { em: local(9, 8) }]
    expect(lista.map((_, k) => comecaDia(lista, k))).toEqual([true, false, true, false])
  })

  it('hora com segundos', () => {
    expect(horaSegundos(new Date(2026, 10, 10, 8, 4, 7).toISOString())).toBe('08:04:07')
  })
})
