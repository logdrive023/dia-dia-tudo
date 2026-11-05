// OPERAÇÃO CAOS — VOLUME / LONGA DURAÇÃO: compras progressivas (100 → 1000), cada uma separada em 9 pacotes
// (~10.000 itens), centenas de vendas; mede comandos e consultas-chave em cada tamanho e procura crescimento
// quadrático e registros sem limite (auditoria/outbox por comando). Para se um passo passar de ~3 min.
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from '../src/__tests__/ajuda'
import { conferir, reposDe } from './integridade'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any
const LIMITE_PASSO_MS = 180000

describe('volume progressivo', () => {
  it('100 → 300 → 1000 compras (×10 itens) + vendas: tempos e crescimento', async () => {
    const { b, r } = await novoBackend('2026-11-01')
    const repos = reposDe(b)
    await b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedora', papeis: ['fornecedor'] })
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] })
    await b.comando('salvarPessoa', { id: 'prof', nome: 'Prof', papeis: ['profissional'], comissaoBp: 4000 })
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', precoSugerido: { moeda: 'BOB', valor: bs(80) } })
    await b.comando('salvarTabelaPreco', { id: 'tab', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [40, 50, 60], colunas: [{ id: 'x', nome: 'X' }], valores: { '40|x': '4', '50|x': '8', '60|x': '17' } })
    let compras = 0
    let vendas = 0
    let comandos = 0
    const linhasPerf: { tamanho: string; nome: string; ms: number }[] = []
    const cmdPerf: { compras: number; msPorCompra: number; msPorVenda: number }[] = []
    let parou = ''
    for (const alvo of [100, 300, 1000]) {
      const t0 = performance.now()
      const ini = compras
      while (compras < alvo) {
        const k = compras++
        const cid = `c${k}`
        await b.comando('criarCompra', { id: cid, moduloId: 'cabelo', pessoaId: 'forn', linhas: [{ id: `${cid}l`, quantidade: 9000, moeda: 'BOB', total: bs(4500), campos: { estado: 'Bruto', categoria: 'Normal' } }], pagarNoAto: [{ id: `${cid}p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(4500) }] })
        const lote = (await b.consulta('pedido', { id: cid })).lotes[0]
        await b.comando('triarLotes', { id: `t${k}`, ids: [lote.id], quantidadeUsada: 9000, saidas: Array.from({ length: 9 }, (_, j) => ({ id: `s${k}-${j}`, quantidade: 990, campos: { estado: 'Separado', comprimento: [40, 50, 60][j % 3], categoria: 'Normal' } })) })
        comandos += 2
        if (k % 25 === 24) r.avancar(1)
        if (performance.now() - t0 > LIMITE_PASSO_MS) {
          parou = `compras parou em ${compras} (passo > ${LIMITE_PASSO_MS / 1000}s)`
          break
        }
      }
      const msCompras = performance.now() - t0
      // vendas: 1 venda de cabelo a cada 3 compras novas + 1 serviço
      const t1 = performance.now()
      const novas = Math.floor((compras - ini) / 3)
      for (let j = 0; j < novas; j++) {
        const k = vendas++
        const item = `s${(k * 7) % compras}-${k % 9}`
        await b.comando('concluirVenda', { id: `v${k}`, pessoaId: 'cli', linhas: [{ id: `v${k}l`, itemId: item, quantidade: 100, moeda: 'BOB', total: 0, calculo: { medida: [40, 50, 60][k % 9 % 3], fator: ['4', '8', '17'][k % 9 % 3], tabelaId: 'tab', colunaId: 'x' } }], pagamentos: [{ id: `v${k}p`, forma: 'qr', moeda: 'BOB', valor: [40000, 80000, 170000][k % 9 % 3] }] })
        await b.comando('concluirVenda', { id: `w${k}`, profissionalId: 'prof', linhas: [{ id: `w${k}l`, itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) }], pagamentos: [{ id: `w${k}p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(80) }] })
        comandos += 2
      }
      const msVendas = performance.now() - t1
      cmdPerf.push({ compras, msPorCompra: +(msCompras / Math.max(1, compras - ini)).toFixed(1), msPorVenda: +(msVendas / Math.max(1, novas * 2)).toFixed(1) })
      const tam = `${compras}c/${(await repos.itens.listar()).length}i/${(await repos.movEstoque.listar()).length}m/${vendas * 2}v`
      const medir = async (nome: string, f: () => Promise<unknown>) => {
        const t = performance.now()
        await f()
        linhasPerf.push({ tamanho: tam, nome, ms: Math.round(performance.now() - t) })
      }
      const de = '2026-11-01'
      const ate = r.hoje
      await medir('estoque', () => b.consulta('estoque', { moduloId: 'cabelo' }))
      await medir('painel', () => b.consulta('painel', { de, ate }))
      await medir('relatorioContabil', () => b.consulta('relatorioContabil', { de, ate }))
      await medir('auditoria', () => b.consulta('auditoria', {}))
      await medir('tabelaPreco', () => b.consulta('tabelaPreco', { id: 'tab' }))
      await medir('comissoes', () => b.consulta('comissoes', {}))
      await medir('vendas', () => b.consulta('vendas', {}))
      await medir('caixaDoDia', () => b.consulta('caixaDoDia', { data: ate }))
      await medir('diagnostico', () => b.consulta('diagnostico', {}))
      await medir('triagem', () => b.consulta('triagem', { moduloId: 'cabelo' }))
      // contagem × lista
      const est = await b.consulta('estoque', { moduloId: 'cabelo' })
      expect(new Set(est.map((i: Q) => i.id)).size).toBe(est.length)
      expect(est.length).toBe(((await repos.itens.listar()) as Q[]).filter((i) => i.moduloId === 'cabelo').length)
      const vs = await b.consulta('vendas', {})
      expect(vs.length).toBe(vendas * 2)
      const aud = await b.consulta('auditoria', {})
      console.log(`[vol] ${tam}: auditoria total ${aud.total} linhas devolvidas ${aud.linhas.length}`)
      if (parou) break
    }
    const nAud = (await repos.auditoria.listar()).length
    const nOut = (await repos.outbox.listar()).length
    console.log(`[vol] comandos ${comandos}; auditoria ${nAud} (${(nAud / comandos).toFixed(2)}/cmd); outbox ${nOut} (${(nOut / comandos).toFixed(2)}/cmd)`)
    console.log('[vol] comandos', JSON.stringify(cmdPerf))
    console.log('[vol] consultas\n' + linhasPerf.map((l) => `${l.tamanho}\t${l.nome}\t${l.ms}`).join('\n'))
    if (parou) console.log(`[vol] ${parou}`)
    const t = performance.now()
    expect(await conferir(b)).toEqual([])
    console.log(`[vol] conferir(b) no fim: ${Math.round(performance.now() - t)} ms`)
    // crescimento: o tempo por compra no último passo não pode ser > 5× o do primeiro (seria quadrático)
    expect(cmdPerf[cmdPerf.length - 1].msPorCompra).toBeLessThan(cmdPerf[0].msPorCompra * 5)
    expect(parou).toBe('')
  }, 900000)
})
