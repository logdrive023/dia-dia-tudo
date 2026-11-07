// TRIAGEM › próximo passo em 2 camadas (categoria · critério)
import { describe, expect, it } from 'vitest'
import { CRITERIOS_PROXIMO, PROXIMO_PADRAO, categoriasDaFila, escolherProximo } from '../model/proximo'

const fila = [
  { id: 'a', dias: 10, saldo: 3000, campos: { categoria: 'Normal' } },
  { id: 'b', dias: 2, saldo: 500, campos: { categoria: 'Tinte' } },
  { id: 'c', dias: 6, saldo: 8000, campos: {} },
  { id: 'd', dias: 6, saldo: 200, campos: { categoria: 'Tinte' } },
]

describe('próximo passo da triagem', () => {
  it('padrão = o que espera há mais tempo (o comportamento de antes)', () => {
    expect(escolherProximo(fila, PROXIMO_PADRAO)?.id).toBe('a')
  })

  it('camada 2: cada critério escolhe o seu', () => {
    expect(escolherProximo(fila, { categoria: '', criterio: 'pesado' })?.id).toBe('c')
    expect(escolherProximo(fila, { categoria: '', criterio: 'leve' })?.id).toBe('d')
    expect(escolherProximo(fila, { categoria: '', criterio: 'recente' })?.id).toBe('b')
  })

  it('camada 1: só a categoria escolhida (sem categoria = Normal)', () => {
    expect(escolherProximo(fila, { categoria: 'Tinte', criterio: 'parado' })?.id).toBe('d')
    expect(escolherProximo(fila, { categoria: 'Normal', criterio: 'pesado' })?.id).toBe('c')
    expect(escolherProximo(fila, { categoria: 'CH', criterio: 'parado' })).toBeUndefined()
  })

  it('a camada 1 só oferece categorias que existem na fila', () => {
    expect(categoriasDaFila(fila)).toEqual(['Normal', 'Tinte'])
  })

  it('cada critério diz o porquê com o peso', () => {
    for (const c of CRITERIOS_PROXIMO) expect(c.porque).toContain('{g}')
  })
})
