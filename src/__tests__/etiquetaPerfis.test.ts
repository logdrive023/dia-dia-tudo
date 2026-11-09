// ETIQUETA: perfis prontos e histórico do tamanho (com "Usar de novo").
import { describe, expect, it } from 'vitest'
import { MAX_HISTORICO, PERFIS_ETIQUETA, configDe, mesmaEtiqueta, perfilDe, registrarMudanca, type ConfigEtiqueta, gradeNaFolha, opcoesPorFolha } from '../shared/ui/etiquetaPerfis'

const rolo: ConfigEtiqueta = { papel: 'pequena', w: 50, h: 30, modo: 'qrBarras', escalaBarras: 100 }

describe('perfis de etiqueta', () => {
  it('cada perfil tem nome, uso e é reconhecido de volta pela configuração', () => {
    for (const p of PERFIS_ETIQUETA) {
      expect(p.nome && p.uso).toBeTruthy()
      expect(perfilDe(p.config)).toBe(p.id)
    }
    expect(perfilDe(rolo)).toBeUndefined()
  })

  it('só barras é sem QR; o de cabelo é o maior', () => {
    const por = Object.fromEntries(PERFIS_ETIQUETA.map((p) => [p.id, p.config]))
    expect(por.soBarras.modo).toBe('barras')
    expect(por.cabelo.w * por.cabelo.h).toBeGreaterThan(por.compacto.w * por.compacto.h)
  })

  it('no rolo e no A4 a largura × altura digitada não muda a etiqueta', () => {
    expect(mesmaEtiqueta(rolo, { ...rolo, w: 99, h: 99 })).toBe(true)
    expect(mesmaEtiqueta({ ...rolo, papel: 'livre' }, { ...rolo, papel: 'livre', w: 60 })).toBe(false)
  })
})

describe('histórico do tamanho', () => {
  it('guarda no topo com quando e quem; igual à última não repete', () => {
    let h = registrarMudanca([], rolo, '2026-11-07T10:00:00Z', 'Paula')
    h = registrarMudanca(h, { ...rolo }, '2026-11-07T10:01:00Z', 'Paula')
    expect(h).toHaveLength(1)
    h = registrarMudanca(h, PERFIS_ETIQUETA[0].config, '2026-11-07T10:02:00Z', 'Ana')
    expect(h).toHaveLength(2)
    expect(h[0]).toMatchObject({ papel: 'livre', w: 70, h: 40, por: 'Ana' })
  })

  it('"Usar de novo" volta exatamente para a configuração guardada', () => {
    const h = registrarMudanca(registrarMudanca([], rolo, 'a'), PERFIS_ETIQUETA[2].config, 'b')
    expect(configDe(h[1])).toEqual(rolo)
  })

  it('mantém só as últimas', () => {
    let h: ReturnType<typeof registrarMudanca> = []
    for (let i = 0; i < MAX_HISTORICO + 5; i++) h = registrarMudanca(h, { ...rolo, papel: 'livre', w: 30 + i }, String(i))
    expect(h).toHaveLength(MAX_HISTORICO)
    expect(h[0].w).toBe(30 + MAX_HISTORICO + 4)
  })
})

describe('etiquetas por folha', () => {
  it('calcula quantas cabem numa A4, centradas', () => {
    expect(gradeNaFolha(50, 30)).toMatchObject({ colunas: 4, linhas: 9, lado: 5 })
    expect(gradeNaFolha(70, 40)).toMatchObject({ colunas: 2, linhas: 6, lado: 35 })
  })
  it('etiqueta maior que a folha ainda dá 1', () => {
    expect(gradeNaFolha(200, 290)).toMatchObject({ colunas: 1, linhas: 1 })
  })
  it('as opções param no máximo e sempre incluem ele', () => {
    expect(opcoesPorFolha(36)).toEqual([1, 2, 4, 6, 8, 12, 21, 36])
    expect(opcoesPorFolha(21)).toEqual([1, 2, 4, 6, 8, 12, 21])
    expect(opcoesPorFolha(3)).toEqual([1, 2, 3])
  })
})
