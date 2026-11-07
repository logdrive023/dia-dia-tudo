// O aviso da seleção antes de juntar: mistura intacta é desfeita (as partes entram), mexida entra inteira.
import { describe, expect, it } from 'vitest'
import { avisoFeito, avisoJuntar, planoJuntar } from '../model/juntarMisturas'

const t = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ''))
const limpo = { codigo: 'L-0031', unificado: 0 }
const intacta = { codigo: 'L-0035', unificado: 2, unificadoDe: [{ id: 'a', codigo: 'L-0033' }, { id: 'b', codigo: 'L-0034' }], mistura: { pode: true } }
const mexida = { codigo: 'L-0040', unificado: 2, unificadoDe: [{ id: 'c', codigo: 'L-0038' }, { id: 'd', codigo: 'L-0039' }], mistura: { pode: false, porque: 'venda' } }

describe('juntar com pacote já misturado: o aviso', () => {
  it('limpo + mistura intacta → desfaz e fica "Misturado de 3"', () => {
    const p = planoJuntar([limpo, intacta])
    expect(p).toEqual({ abrir: [{ codigo: 'L-0035', partes: ['L-0033', 'L-0034'] }], inteiras: [], partes: 3 })
    const a = avisoJuntar(p, t)
    expect(a[0]).toContain('L-0035 já é uma mistura (L-0033 + L-0034)')
    expect(a.at(-1)).toContain('Misturado de 3')
    expect(avisoFeito(p, t, 'Lotes juntados.')).toBe('Mistura L-0035 desfeita, partes juntadas e histórico atualizado.')
  })
  it('mistura mexida entra inteira; sem mistura não há aviso', () => {
    const p = planoJuntar([limpo, mexida])
    expect(p).toMatchObject({ abrir: [], inteiras: ['L-0040'], partes: 2 })
    expect(avisoJuntar(p, t)[0]).toContain('entra como um pacote só')
    expect(avisoJuntar(planoJuntar([limpo, { codigo: 'L-0032', unificado: 0 }]), t)).toEqual([])
    expect(avisoFeito(planoJuntar([limpo]), t, 'Lotes juntados.')).toBe('Lotes juntados.')
  })
})
