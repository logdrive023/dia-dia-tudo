import { describe, expect, it } from 'vitest'
import { MAX_CODE128, PADROES_128, caminhoCode128, code128Conferido, lerCode128, modulosCode128, textoCode128, validarCode128, valoresCode128 } from '../shared/ui/code128'

describe('Code 128 (conjunto B)', () => {
  it('tabela: 107 padrões distintos, 11 módulos cada (stop 13) e barras com largura par', () => {
    expect(PADROES_128).toHaveLength(107)
    expect(new Set(PADROES_128).size).toBe(107)
    const soma = (p: string) => [...p].reduce((s, c) => s + Number(c), 0)
    for (const p of PADROES_128.slice(0, 106)) {
      expect(p).toMatch(/^[1-4]{6}$/)
      expect(soma(p)).toBe(11)
      expect((Number(p[0]) + Number(p[2]) + Number(p[4])) % 2).toBe(0)
    }
    expect(PADROES_128[106]).toBe('2331112')
    expect(PADROES_128[104]).toBe('211214') // início B
    expect(PADROES_128[0]).toBe('212222') // espaço
    expect(PADROES_128[33]).toBe('111323') // "A"
  })

  it('soma de verificação: "Wikipedia" = 88 (exemplo clássico) e "P4" = (104 + 48 + 2×20) mod 103', () => {
    expect(valoresCode128('Wikipedia')).toEqual([104, 55, 73, 75, 73, 80, 69, 68, 73, 65, 88, 106])
    expect(valoresCode128('P4')).toEqual([104, 48, 20, (104 + 48 + 40) % 103, 106])
  })

  it('módulos: começa com barra, termina com barra e tem 11 × (n + 3) + 2 módulos', () => {
    const m = modulosCode128('M1-1a')
    expect(m.length).toBe(11 * (5 + 3) + 2)
    expect(m[0]).toBe(true)
    expect(m[m.length - 1]).toBe(true)
    // início B = 211214: barra 2, espaço 1, barra 1, espaço 2, barra 1, espaço 4
    expect(m.slice(0, 11).map((x) => (x ? 1 : 0)).join('')).toBe('11010010000')
    const svg = caminhoCode128('M1-1a')
    expect(svg.largura).toBe(m.length + 20)
    expect(svg.d.startsWith('M10 0h2v30')).toBe(true)
  })

  it('acentos viram a letra sem acento; o que não é ASCII vira "?"', () => {
    expect(textoCode128('Ção-1')).toBe('Cao-1')
    expect(textoCode128('L€1')).toBe('L?1')
  })

  it('conferência: o que vai para o papel lê de volta exatamente o mesmo código', () => {
    for (const c of ['L-0023', 'P-0007', 'Wikipedia', 'M1-1a', 'A b~}'])
      expect(lerCode128(modulosCode128(c)), c).toBe(c)
    expect(code128Conferido('L-0023')).toEqual({ ok: true })
  })

  it('conferência: vazio, acento/símbolo e longo demais não viram barras (nunca "?" em silêncio)', () => {
    expect(code128Conferido('  ')).toEqual({ ok: false, problema: 'vazio' })
    expect(code128Conferido('Ção-1')).toEqual({ ok: false, problema: 'caractere' })
    expect(code128Conferido('L€1')).toEqual({ ok: false, problema: 'caractere' })
    expect(code128Conferido('X'.repeat(MAX_CODE128 + 1))).toEqual({ ok: false, problema: 'longo' })
    expect(validarCode128('X'.repeat(MAX_CODE128))).toEqual({ ok: true })
  })

  it('leitura: barra trocada ou soma de verificação errada → não lê', () => {
    const m = modulosCode128('L-0023')
    const estragado = [...m]
    estragado[30] = !estragado[30]
    expect(lerCode128(estragado)).toBeUndefined()
    expect(lerCode128(m.slice(0, -3))).toBeUndefined()
    expect(lerCode128([])).toBeUndefined()
  })
})
