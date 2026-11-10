// RELATÓRIOS › a cascata do resultado: começo, grupos de saídas entre os subtotais, marco final e as maiores saídas.
import { describe, expect, it } from 'vitest'
import { larguraBarra, limparRotulo, maioresSaidas, montarCascata } from '../model/cascata'

describe('cascata do resultado', () => {
  it('agrupa as contas entre os subtotais (Estado de Resultados contábil)', () => {
    const c = montarCascata([
      { id: 'v', rotulo: 'Ventas brutas', valor: 68500, tipo: 'conta', anexo: 'vendas' },
      { id: 'iva', rotulo: '(−) IVA débito fiscal (13%)', valor: -8905, tipo: 'conta', conta: '13% × ventas' },
      { id: 'vn', rotulo: 'Ventas netas', valor: 59595, tipo: 'subtotal' },
      { id: 'cv', rotulo: '(−) Costo de ventas', valor: 0, tipo: 'conta' },
      { id: 'ins', rotulo: '(−) Insumos', valor: -23100, tipo: 'conta' },
      { id: 'ub', rotulo: 'Utilidad bruta', valor: 36495, tipo: 'subtotal' },
      { id: 'sal', rotulo: '(−) Salários', valor: -72000, tipo: 'conta' },
      { id: 'vg', rotulo: '(−) Viagens', valor: -80000, tipo: 'conta' },
      { id: 'un', rotulo: 'Utilidad neta', valor: -115505, tipo: 'total' },
    ])!
    expect(c.inicio).toMatchObject({ rotulo: 'Ventas brutas', valor: 68500, anexo: 'vendas' })
    expect(c.etapas.map((e) => [e.marco.rotulo, e.variacao, e.contas.length, e.marco.final])).toEqual([
      ['Ventas netas', -8905, 1, false],
      ['Utilidad bruta', -23100, 2, false],
      ['Utilidad neta', -152000, 2, true],
    ])
    expect(c.final).toBe(-115505)
    expect(c.etapas[0].contas[0]).toMatchObject({ rotulo: 'IVA débito fiscal (13%)', conta: '13% × ventas' })
    expect(maioresSaidas(c).map((x) => x.rotulo)).toEqual(['Viagens', 'Salários', 'Insumos'])
  })

  it('contas soltas no fim viram o marco final; rótulos sem "(−)" e "="', () => {
    const c = montarCascata([{ rotulo: 'Receita', valor: 1000, tipo: 'conta' }, { rotulo: '(−) Gasto', valor: -300, tipo: 'conta' }])!
    expect(c.etapas).toHaveLength(1)
    expect(c.etapas[0].marco).toEqual({ rotulo: 'Resultado', valor: 700, final: true })
    expect(limparRotulo('= Lucro bruto')).toBe('Lucro bruto')
    expect(limparRotulo('(+) Frete')).toBe('Frete')
    expect(montarCascata([])).toBeUndefined()
    expect(larguraBarra(-50, 200)).toBe(25)
    expect(larguraBarra(500, 200)).toBe(100)
    expect(larguraBarra(10, 0)).toBe(0)
  })
})
