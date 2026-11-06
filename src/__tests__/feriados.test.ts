// FERIADOS (dados/feriados.ts) e o CALENDÁRIO em qualquer ano: Páscoa e móveis, traslado de domingo, o decreto do
// ano (ajuste pela configuração), as categorias (só nacional, só Santa Cruz, as duas, nenhuma) e os anos bissextos.
import { describe, expect, it } from 'vitest'
import { bissexto, feriadosDoAno, feriadosEntre, pascoa } from '../core/dados/feriados'
import { somarMeses } from '../core/domain/datas'
import { gradeMes } from '../shared/ui/calendario'
import { novoBackend } from './ajuda'

const dataDe = (ano: number, id: string) => feriadosDoAno(ano).find((f) => f.id === id)?.data

describe('feriados', () => {
  it('Páscoa e os móveis (Carnaval, Sexta-feira Santa, Corpus Christi)', () => {
    expect(pascoa(2024)).toBe('2024-03-31')
    expect(pascoa(2025)).toBe('2025-04-20')
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
    expect(dataDe(2026, 'carnavalSeg')).toBe('2026-02-16')
    expect(dataDe(2026, 'carnavalTer')).toBe('2026-02-17')
    expect(dataDe(2026, 'viernesSanto')).toBe('2026-04-03')
    expect(dataDe(2026, 'corpusChristi')).toBe('2026-06-04')
    expect(dataDe(2027, 'carnavalSeg')).toBe('2027-02-08')
  })

  it('fixos, traslado de domingo e o decreto do ano (DS 5521/2026)', () => {
    expect(dataDe(2027, 'independencia')).toBe('2027-08-06')
    // 2026: o decreto moveu o 22/01 para 23/01 e o 21/06 (domingo) para 22/06, e pôs um feriado extra em 07/08
    expect(dataDe(2026, 'estadoPlurinacional')).toBe('2026-01-23')
    expect(dataDe(2026, 'anoNuevoAndino')).toBe('2026-06-22')
    expect(feriadosDoAno(2026).some((f) => f.data === '2026-08-07')).toBe(true)
    // sem decreto: 25/12/2022 caiu num domingo → segunda 26/12 (DS 2750), e diz de onde veio
    const natal = feriadosDoAno(2022).find((f) => f.id === 'navidad')!
    expect(natal).toMatchObject({ data: '2022-12-26', movidoDe: '2022-12-25' })
    // Santa Cruz: 24/09, marcado como confirmado a cada ano
    expect(feriadosDoAno(2027).find((f) => f.id === 'santaCruz')).toMatchObject({ data: '2027-09-24', categoria: 'santaCruz', confirmacaoAnual: true })
  })

  it('categorias e a virada do ano (dezembro → janeiro)', () => {
    const de = '2026-12-20'
    const ate = '2027-01-10'
    expect(feriadosEntre(de, ate, ['nacional']).map((f) => f.id)).toEqual(['navidad', 'anoNovo'])
    expect(feriadosEntre('2026-09-01', '2026-09-30', ['santaCruz']).map((f) => f.id)).toEqual(['santaCruz'])
    expect(feriadosEntre('2026-09-01', '2026-09-30', ['nacional'])).toEqual([])
    expect(feriadosEntre(de, ate, [])).toEqual([])
    // 11 nacionais (Carnaval conta 2) + 1 de Santa Cruz + 1 extra do decreto de 2026
    expect(feriadosEntre('2026-01-01', '2026-12-31', ['nacional', 'santaCruz']).length).toBe(13)
  })

  it('o ajuste do ano vem da configuração (sem mexer no código)', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarConfig', { feriadosAjustes: [{ ano: 2027, acao: 'extra', data: '2027-03-15', pt: 'Feriado de teste', es: 'Feriado de prueba', categoria: 'nacional', fonte: 'DS de teste' }] } as never)
    const r = await b.consulta('feriados', { de: '2027-03-01', ate: '2027-03-31', categorias: ['nacional'] })
    expect(r.find((f) => f.data === '2027-03-15')).toMatchObject({ pt: 'Feriado de teste', fonte: 'DS de teste' })
  })
})

describe('calendário em qualquer ano (bissexto pela regra gregoriana)', () => {
  it('2024 e 2028 bissextos; 2025, 2026 e 2100 não; 2400 sim', () => {
    expect([2024, 2025, 2026, 2028, 2100, 2400].map(bissexto)).toEqual([true, false, false, true, false, true])
    for (const [ano, tem29] of [[2024, true], [2025, false], [2028, true], [2100, false], [2400, true]] as const) {
      const g = gradeMes(`${ano}-02-10`)
      expect(g.includes(`${ano}-02-29`)).toBe(tem29)
      expect(g.includes(`${ano}-02-28`)).toBe(true)
      expect(g.includes(`${ano}-03-01`) || g.length % 7 === 0).toBe(true)
    }
  })
  it('mudar de mês e de ano', () => {
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(somarMeses('2027-01-31', 1)).toBe('2027-02-28')
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(somarMeses('2027-01-10', -1)).toBe('2026-12-10')
  })
})
