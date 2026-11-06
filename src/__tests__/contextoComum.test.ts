// As peças comuns dos serviços que estavam repetidas em vários arquivos (contexto.ts): o conversor para relatório
// (moeda sem cotação vale 0) e as checagens de sessão (admin, "eu", equipe).
import { describe, expect, it } from 'vitest'
import { conversorPara, ehAdmin, ehEquipe, euPessoa, type Ctx } from '../core/services/contexto'
import { dataComAno } from '../core/domain/datas'
import type { Pessoa } from '../core/domain/tipos'

const ctx = (sessao: Partial<Ctx['sessao']>) => ({ sessao }) as Ctx

describe('peças comuns dos serviços', () => {
  it('conversor de relatório: mesma moeda passa direto; moeda sem cotação → 0 (não derruba)', () => {
    const conv = conversorPara('BOB', {} as never)
    expect(conv(1234, 'BOB')).toBe(1234)
    expect(conv(1000, 'USD')).toBe(0)
  })

  it('sessão: admin, a pessoa de quem usa (sem pessoa → o usuário) e quem é da equipe', () => {
    expect(ehAdmin(ctx({ perfil: 'admin' }))).toBe(true)
    expect(ehAdmin(ctx({ perfil: 'funcionario' }))).toBe(false)
    expect(euPessoa(ctx({ pessoaId: 'p1', usuarioId: 'u1' }))).toBe('p1')
    expect(euPessoa(ctx({ usuarioId: 'u1' }))).toBe('u1')
    const p = (papeis: string[]) => ({ papeis }) as unknown as Pessoa
    expect(ehEquipe(p(['funcionario']))).toBe(true)
    expect(ehEquipe(p(['cliente', 'profissional']))).toBe(true)
    expect(ehEquipe(p(['cliente']))).toBe(false)
    expect(ehEquipe(undefined)).toBe(false)
  })

  it('data com ano: de data ou de instante (só os 10 primeiros caracteres)', () => {
    expect(dataComAno('2026-11-05')).toBe('05/11/2026')
    expect(dataComAno('2026-11-05T23:30:00.000Z')).toBe('05/11/2026')
  })
})
