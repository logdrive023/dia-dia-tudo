// SELOS começam com maiúscula (Pilula, SeloAlerta, SeloSituacao), em português e em espanhol, sem estragar códigos.
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { inicialMaiuscula } from '../shared/ui/base'

describe('selos: primeira letra maiúscula', () => {
  it('texto simples, com ícone na frente e em espanhol', () => {
    expect(inicialMaiuscula('parado')).toBe('Parado')
    expect(inicialMaiuscula('só 40 g')).toBe('Só 40 g')
    expect(inicialMaiuscula(['❓ ', 'para depois'])).toEqual(['❓ ', 'Para depois'])
    expect(inicialMaiuscula('🔗 juntado')).toBe('🔗 Juntado')
    expect(inicialMaiuscula('para después')).toBe('Para después')
    expect(inicialMaiuscula('éxito')).toBe('Éxito')
  })
  it('não mexe em código, número na frente nem quando começa por outra peça', () => {
    expect(inicialMaiuscula('v2')).toBe('v2')
    expect(inicialMaiuscula(['v', 3, ' · em uso'])).toEqual(['v', 3, ' · em uso'])
    expect(inicialMaiuscula('3 kg')).toBe('3 kg')
    expect(inicialMaiuscula([5, ' medidas'])).toEqual([5, ' medidas'])
    const b = createElement('b', null, '3')
    const r = inicialMaiuscula([b, ' pacotes']) as unknown[]
    expect(r[1]).toBe(' pacotes')
    expect(inicialMaiuscula('Sem etiqueta')).toBe('Sem etiqueta')
  })
})
