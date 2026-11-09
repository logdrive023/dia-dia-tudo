// Rascunho da tabela de preço (tela "Tabelas de preço"): ferramentas puras — nada aqui publica versão.
import { describe, expect, it } from 'vitest'
import {
  adicionarMedidas, ajustarPct, comValor, contarMudancas, copiarColuna, invalidos, moverColuna, normalizarFator, preencherVazios,
  tirarColuna, tirarMedida, trocarMedida, type GradeEdicao,
} from '../features/precos/model/tabelaPrecoEdicao'

const base: GradeEdicao = {
  nome: 'Tabela geral (Normal)',
  linhas: [50, 60, 70],
  colunas: [{ id: 'hel', nome: 'Helena' }, { id: 'lp', nome: 'LP' }],
  valores: { '50|hel': '12', '60|hel': '15', '70|hel': '17,5', '60|lp': '14' },
}

describe('edição da tabela de preço', () => {
  it('aceita 3,5 e 3.5; vazio tira o preço; texto ruim fica marcado', () => {
    expect(normalizarFator('3.5')).toBe('3,5')
    expect(comValor(base, '50|lp', '3.5').valores['50|lp']).toBe('3,5')
    expect(comValor(base, '60|hel', '').valores['60|hel']).toBeUndefined()
    expect(invalidos(comValor(base, '50|lp', 'abc'))).toEqual(['50|lp'])
  })

  it('+5% em 60–70 cm só nos preços preenchidos, com arredondamento opcional', () => {
    const { grade, mudou } = ajustarPct(base, { tipo: 'medidas', de: 60, ate: 70 }, 5)
    expect(mudou).toBe(3)
    expect(grade.valores['60|hel']).toBe('15,75')
    expect(grade.valores['70|hel']).toBe('18,38')
    expect(grade.valores['50|hel']).toBe('12')
    expect(grade.valores['50|lp']).toBeUndefined()
    expect(ajustarPct(base, { tipo: 'coluna', colunaId: 'hel' }, 5, 0.5).grade.valores['60|hel']).toBe('16')
    expect(ajustarPct(base, { tipo: 'tudo' }, -10).grade.valores['60|lp']).toBe('12,6')
  })

  it('copiar coluna (por cima ou só nos vazios) e preencher vazios', () => {
    const tudo = copiarColuna(base, 'hel', 'lp')
    expect(tudo.grade.valores).toMatchObject({ '50|lp': '12', '60|lp': '15', '70|lp': '17,5' })
    const vazios = copiarColuna(base, 'hel', 'lp', true)
    expect(vazios.mudou).toBe(2)
    expect(vazios.grade.valores['60|lp']).toBe('14')
    const p = preencherVazios(base, { tipo: 'coluna', colunaId: 'lp' }, '3.5')
    expect(p.mudou).toBe(2)
    expect(p.grade.valores['50|lp']).toBe('3,5')
  })

  it('medidas e compradores: adicionar, trocar, tirar, mover', () => {
    const a = adicionarMedidas(base, '65, 75 60')
    expect(a.novas).toEqual([65, 75])
    expect(a.grade.linhas).toEqual([50, 60, 65, 70, 75])
    const tr = trocarMedida(base, 60, 62)!
    expect(tr.linhas).toEqual([50, 62, 70])
    expect(tr.valores['62|hel']).toBe('15')
    expect(trocarMedida(base, 60, 70)).toBeUndefined()
    expect(tirarMedida(base, 60).valores['60|lp']).toBeUndefined()
    expect(tirarColuna(base, 'lp').colunas.map((c) => c.id)).toEqual(['hel'])
    expect(moverColuna(base, 'lp', -1).colunas.map((c) => c.id)).toEqual(['lp', 'hel'])
  })

  it('conta as mudanças do rascunho ("3 mudanças")', () => {
    expect(contarMudancas(base, base).total).toBe(0)
    let r = comValor(base, '60|hel', '16')
    r = comValor(r, '50|lp', '11')
    r = moverColuna(r, 'lp', -1)
    expect(contarMudancas(base, r)).toMatchObject({ precos: 2, estrutura: 1, total: 3 })
  })
})
