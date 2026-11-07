// MOTOR CONTÁBIL (docs/business/FISCAL.md): o padrão boliviano é o motor; o brasileiro muda a ordem e os impostos.
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

describe('impostos nas operações (lista configurável)', () => {
  it('venda: IVA 13% + IT 3%; compra: IVA como crédito; desligado não mostra; a lista manda no relatório', async () => {
    const { b, hoje } = await montar()
    const v = await b.consulta('impostosOperacao', { produto: bs(1000) })
    expect(v).toMatchObject({ ligado: true, venda: bs(160) })
    expect(v.linhas.map((l) => [l.sigla, l.valor])).toEqual([['IVA', bs(130)], ['IT', bs(30)]])
    // compra SEM fatura (o normal ao comprar cabelo de pessoas): não dá crédito de IVA
    expect((await b.consulta('impostosOperacao', { compra: bs(1000) })).linhas).toEqual([])
    // compra COM fatura: o IVA dela é crédito fiscal
    await b.comando('salvarConfig', { fiscal: { comprasComFatura: true } as never })
    const c = await b.consulta('impostosOperacao', { compra: bs(1000) })
    expect(c.linhas).toEqual([expect.objectContaining({ sigla: 'IVA', valor: bs(130), credito: true, lado: 'compra' })])
    // serviço também paga (os dois estão marcados para serviço)
    expect((await b.consulta('impostosOperacao', { servico: bs(100) })).venda).toBe(bs(16))

    // desliga o IVA na lista → o relatório não tem mais a linha do IVA; o IT continua
    const cfg = await b.consulta('configuracoes', {})
    const lista = cfg.config.fiscal.impostos.map((i) => (i.id === 'iva' ? { ...i, ligado: false } : i))
    await b.comando('salvarConfig', { fiscal: { impostos: lista } as never })
    const rel = await b.consulta('relatorioContabil', { de: hoje, ate: hoje })
    expect(rel.resultados.map((l) => l.id)).not.toContain('iva')
    expect(rel.resultados.find((l) => l.id === 'it')?.valor).toBe(-bs(30))

    // interruptor geral desligado: a tela não mostra nada
    await b.comando('salvarConfig', { fiscal: { mostrarNasOperacoes: false } as never })
    expect((await b.consulta('impostosOperacao', { produto: bs(1000) })).ligado).toBe(false)
  })
})

describe('impostos: só informativo, configurável', () => {
  it('"somado ao preço": cabelo de 60 → custo final 69,60; serviço com taxa própria; cada linha diz a fonte', async () => {
    const { b } = await montar()
    const dentro = await b.consulta('impostosOperacao', { produto: bs(60) })
    expect(dentro).toMatchObject({ modoPreco: 'dentro', venda: bs(9.6), base: bs(60), precoFinal: bs(60) })
    expect(dentro.linhas[0]).toMatchObject({ sigla: 'IVA', fonte: expect.stringMatching(/Ley 843/), vigenteDesde: '1986-05-20' })

    const cfg = await b.consulta('configuracoes', {})
    const lista = cfg.config.fiscal.impostos.map((i) => (i.id === 'it' ? { ...i, taxaServicoBp: 500 } : i))
    await b.comando('salvarConfig', { fiscal: { modoPreco: 'fora', impostos: lista } as never })
    const fora = await b.consulta('impostosOperacao', { produto: bs(60) })
    expect(fora).toMatchObject({ modoPreco: 'fora', precoFinal: bs(69.6) })
    // IT do serviço a 5% (o do produto continua 3%)
    const serv = await b.consulta('impostosOperacao', { servico: bs(100) })
    expect(serv.linhas.find((l) => l.sigla === 'IT')).toMatchObject({ taxaBp: 500, valor: bs(5) })
  })
})

describe('impostos no histórico (só registro)', () => {
  it('a venda guarda os impostos estimados (alíquota e fonte do dia) e o histórico tem a conta — mesmo com a exibição desligada', async () => {
    const { b } = await montar()
    await b.comando('salvarConfig', { fiscal: { mostrarNasOperacoes: false } as never })
    await b.comando('concluirVenda', { id: 'v2', linhas: [{ id: 'l2', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos: [{ id: 'p2', forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] })
    const log = (await b.consulta('logDetalhado', { acao: 'impostosEstimados' })).linhas
    const r = log.map((l: { resumo?: string }) => l.resumo ?? '').find((x: string) => x.includes('100,00'))
    expect(r).toMatch(/IVA 13% × Bs\s?100,00 = Bs\s?13,00/)
    expect(r).toContain('(estimado, não cobrado)')
  })
})
