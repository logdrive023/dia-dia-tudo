import { describe, expect, it } from 'vitest'
import { acharPorCodigo, buscarPacotes } from '../shared/ui/leitorPistola'

const pacotes = [
  { id: 'a', codigo: 'P4', nome: '60 cm · Castanho', codigosAnteriores: ['L-0007'] },
  { id: 'b', codigo: 'M1-2', nome: '50 cm · Loiro' },
  { id: 'c', codigo: 'P40', nome: '40 cm · Castanho' },
]

describe('leitor pistola: código exato abre o pacote', () => {
  it('acha pelo código atual, antigo, endereço do QR; sem diferenciar maiúsculas', () => {
    expect(acharPorCodigo(pacotes, 'p4 ')?.id).toBe('a')
    expect(acharPorCodigo(pacotes, 'L-0007')?.id).toBe('a')
    expect(acharPorCodigo(pacotes, 'https://x.app/#/lotes/b')?.id).toBe('b')
    expect(acharPorCodigo(pacotes, 'P')).toBeUndefined()
  })
  it('busca digitada: exato primeiro, depois código/rótulo que contém', () => {
    expect(buscarPacotes(pacotes, 'P4').map((p) => p.id)).toEqual(['a', 'c'])
    expect(buscarPacotes(pacotes, 'castanho').map((p) => p.id)).toEqual(['a', 'c'])
    expect(buscarPacotes(pacotes, '')).toEqual([])
  })
})
