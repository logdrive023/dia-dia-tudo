// Nova compra: valor digitado em outra moeda vira a moeda do pedido pela cotação digitada (ou a do sistema).

import { describe, expect, it } from 'vitest'
import type { TabelaCotacoes } from '../core/domain/dinheiro'
import { converterDigitado, cotacaoSistema, moedasDoCampo } from '../ui/valorMoeda'

const cot: TabelaCotacoes = {
  USD: { moeda: 'USD', valor: '6,96', sentido: 'basePorMoeda', contra: 'BOB', data: '' },
  BOB: { moeda: 'BOB', valor: '0,8', sentido: 'basePorMoeda', data: '' },
}

describe('valor em outra moeda', () => {
  it('US$ 100 × 6,96 = Bs 696 (cotação do sistema)', () => {
    expect(cotacaoSistema('USD', 'BOB', cot)).toBe('6,96')
    expect(converterDigitado(10000, 'USD', 'BOB', undefined, cot)).toBe(69600)
  })
  it('cotação digitada vale no lugar da do sistema; inválida não converte', () => {
    expect(converterDigitado(10000, 'USD', 'BOB', '7', cot)).toBe(70000)
    expect(converterDigitado(10000, 'USD', 'BOB', 'abc', cot)).toBeUndefined()
  })
  it('mesma moeda não mexe; a principal vem primeiro na troca', () => {
    expect(converterDigitado(1234, 'BOB', 'BOB', undefined, cot)).toBe(1234)
    expect(moedasDoCampo('BOB', ['USD', 'BOB', 'BRL'])).toEqual(['BOB', 'USD', 'BRL'])
  })
})
