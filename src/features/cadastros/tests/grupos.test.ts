// PESSOAS › os grupos: cada pessoa aparece uma vez na visão "Todas" e em toda aba de papel que tiver.
import { describe, expect, it } from 'vitest'
import type { Papel } from '../../../core/domain/tipos'
import { contarGrupos, estaNoGrupo, grupoPrincipal } from '../model/grupos'

describe('pessoas: grupos', () => {
  it('grupo principal: equipe > fornecedora > cliente > contas', () => {
    expect(grupoPrincipal(['cliente'])).toBe('clientes')
    expect(grupoPrincipal(['cliente', 'fornecedor'])).toBe('fornecedoras')
    expect(grupoPrincipal(['funcionario', 'socio'])).toBe('equipe')
    expect(grupoPrincipal(['credor'])).toBe('outros')
    expect(grupoPrincipal([])).toBe('outros')
  })

  it('a aba de cada grupo traz quem tem o papel (pode estar em duas)', () => {
    const p: Papel[] = ['cliente', 'fornecedor']
    expect(estaNoGrupo(p, 'clientes')).toBe(true)
    expect(estaNoGrupo(p, 'fornecedoras')).toBe(true)
    expect(estaNoGrupo(p, 'equipe')).toBe(false)
    expect(estaNoGrupo([], 'outros')).toBe(true)
    expect(contarGrupos([{ papeis: p }, { papeis: ['cliente'] }, { papeis: ['credor'] }])).toEqual({ clientes: 2, fornecedoras: 1, equipe: 0, outros: 1 })
  })
})
