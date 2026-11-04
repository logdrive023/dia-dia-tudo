// Regras da paginação padrão: nunca fica numa página vazia nem passa do fim; o intervalo "Exibindo X–Y de N" bate.
import { describe, expect, it } from 'vitest'
import { paginar } from '../ui/paginacao'

const cem = Array.from({ length: 248 }, (_, k) => k + 1)

describe('paginar', () => {
  it('mostra o intervalo certo e o total de páginas', () => {
    const p = paginar(cem, 1, 20)
    expect([p.de, p.ate, p.total, p.paginas, p.itens.length]).toEqual([1, 20, 248, 13, 20])
    const u = paginar(cem, 13, 20)
    expect([u.de, u.ate, u.itens.length, u.itens[0]]).toEqual([241, 248, 8, 241])
  })
  it('página além do fim (ex.: apagou o último registro da última página) cai na última', () => {
    expect(paginar(cem.slice(0, 240), 13, 20).pagina).toBe(12)
    expect(paginar(cem, 999, 50).pagina).toBe(5)
  })
  it('página inválida ou zero vira a primeira', () => {
    expect(paginar(cem, 0, 20).pagina).toBe(1)
    expect(paginar(cem, -3, 20).pagina).toBe(1)
    expect(paginar(cem, Number.NaN, 20).pagina).toBe(1)
  })
  it('lista vazia: uma página, intervalo zerado', () => {
    const p = paginar([], 4, 20)
    expect([p.pagina, p.paginas, p.de, p.ate, p.itens.length]).toEqual([1, 1, 0, 0, 0])
  })
  it('mudar o tamanho da página recalcula tudo', () => {
    expect(paginar(cem, 3, 100)).toMatchObject({ pagina: 3, paginas: 3, de: 201, ate: 248 })
    expect(paginar(cem, 3, 10)).toMatchObject({ pagina: 3, paginas: 25, de: 21, ate: 30 })
  })
})
