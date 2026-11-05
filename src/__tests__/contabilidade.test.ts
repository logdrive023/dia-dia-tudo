// MOTOR CONTÁBIL (CONTABILIDADE.md): o padrão boliviano é o motor; o brasileiro muda a ordem e os impostos.
// Cada total do resumo fecha com o anexo dele (conferência ✓), e cada imposto é base × taxa ao centavo.
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function montar() {
  const { b, r } = await novoBackend('2026-11-01')
  await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', precoSugerido: { moeda: 'BOB', valor: bs(1000) } })
  await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] })
  await b.comando('lancarCaixa', { id: 'd', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(100), descricao: 'Luz', categoria: 'Luz e água' })
  return { b, hoje: r.hoje }
}

const linha = (rel: { resultados: { id: string; valor: number }[] }, id: string) => rel.resultados.find((l) => l.id === id)?.valor

describe('relatório contábil', () => {
  it('🇧🇴 Régimen General: IVA 13% por dentro, IT 3% como gasto, IUE 25%; tudo confere', async () => {
    const { b, hoje } = await montar()
    const rel = await b.consulta('relatorioContabil', { de: hoje, ate: hoje })
    expect(rel.pais).toBe('BO')
    expect(rel.tituloResultado).toBe('Estado de Resultados')
    expect(linha(rel, 'ventas')).toBe(bs(1000))
    expect(linha(rel, 'iva')).toBe(-bs(130))
    expect(linha(rel, 'ventasNetas')).toBe(bs(870))
    expect(linha(rel, 'it')).toBe(-bs(30))
    // 870 − 0 custo − 100 luz − 30 IT = 740 → IUE 25% = 185 → neta 555
    expect(linha(rel, 'antes')).toBe(bs(740))
    expect(linha(rel, 'iue')).toBe(-bs(185))
    expect(linha(rel, 'neta')).toBe(bs(555))
    expect(rel.impostos.find((l) => l.id === 'totalImp')?.valor).toBe(bs(130 + 30 + 185))
    expect(rel.conferencia.every((c) => c.ok)).toBe(true)
    // o balanço inclui os impostos do período a pagar
    expect(rel.balanco.passivo.find((l) => l.id === 'impPagar')?.valor).toBe(bs(345))
    expect(rel.balanco.patrimonio).toBe(rel.balanco.totalAtivo - rel.balanco.totalPassivo)
  })

  it('🇧🇴 RTS: cuota fija no lugar do IVA/IT/IUE', async () => {
    const { b, hoje } = await montar()
    await b.comando('salvarConfig', { fiscal: { regimeBO: 'rts', rtsCuotaBimestral: bs(200) } as never })
    const rel = await b.consulta('relatorioContabil', { de: hoje, ate: hoje })
    expect(rel.resultados.map((l) => l.id)).not.toContain('iva')
    expect(linha(rel, 'rts')).toBe(-bs(100)) // 1 mês = meio bimestre
    expect(linha(rel, 'antes')).toBe(bs(1000 - 100 - 100))
  })

  it('🇧🇷 DRE (Simples): começa na receita bruta e o DAS é dedução', async () => {
    const { b, hoje } = await montar()
    const rel = await b.consulta('relatorioContabil', { de: hoje, ate: hoje, padrao: 'BR' })
    expect(rel.tituloResultado).toMatch(/DRE/)
    expect(rel.resultados.map((l) => l.id).slice(0, 3)).toEqual(['bruta', 'das', 'liquida'])
    expect(linha(rel, 'das')).toBe(-bs(60)) // 6% de 1.000
    expect(linha(rel, 'll')).toBe(bs(1000 - 60 - 100))
    expect(rel.conferencia.every((c) => c.ok)).toBe(true)
  })
})
