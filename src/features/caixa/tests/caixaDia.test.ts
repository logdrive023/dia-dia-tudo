// CAIXA › ENTROU E SAIU: desfeitos e o lançamento inverso não contam; venda cancelada conta como saída (o dinheiro voltou).
import { describe, expect, it } from 'vitest'
import type { MovCaixa } from '../../../core/domain/tipos'
import { entrouSaiu } from '../model/caixaDia'

const mov = (delta: number, extra: Partial<MovCaixa> = {}) => ({ id: String(delta), moeda: 'BOB', delta, ...extra }) as MovCaixa
const igual = (v: number) => v

describe('entrou e saiu no dia', () => {
  it('soma separado as entradas e as saídas', () => {
    expect(entrouSaiu([mov(500), mov(300), mov(-150)], igual)).toEqual({ entrou: 800, saiu: 150 })
  })
  it('lançamento desfeito e o inverso dele não contam', () => {
    expect(entrouSaiu([mov(500), mov(-150, { estornadoPor: 'x' }), mov(150, { estornaId: 'y' })], igual)).toEqual({ entrou: 500, saiu: 0 })
  })
  it('sem cotação para uma moeda, aquele valor não entra na soma', () => {
    expect(entrouSaiu([mov(500), mov(100, { moeda: 'USD' })], (v, m) => (m === 'USD' ? undefined : v))).toEqual({ entrou: 500, saiu: 0 })
  })
})
