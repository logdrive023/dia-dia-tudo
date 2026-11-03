// TRIAGEM MAIS SIMPLES + LIVRO DO CABELO: "deixar para depois" (não identificado), lavagem opcional com peso depois,
// quem fez cada movimento, histórico do pacote e o livro com o fechamento por compra.

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'
import { COLUNAS_PADRAO, COLUNA_LAVAGEM } from '../core/services/triagem'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

async function comprar(b: B, id: string, fornecedor: string, gramas: number) {
  await b.comando('salvarPessoa', { id: fornecedor, nome: fornecedor.toUpperCase(), papeis: ['fornecedor'] })
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: fornecedor, linhas: [{ id: `${id}-l`, quantidade: gramas, moeda: 'BOB', total: bs(gramas * 5), campos: { estado: 'Bruto', categoria: 'Normal' } }] })
  // o lote bruto nasce no registro da compra (ou ao concluir, no fluxo antigo)
  let lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.tipo === 'compra' && i.origem.id === id)
  if (!lote) {
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(gramas * 5) }] : undefined })
    lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.tipo === 'compra' && i.origem.id === id)
  }
  return lote!.id
}

const parte = (id: string, g: number, cm: number, cor: string) => ({ id, quantidade: g, campos: { estado: 'Separado', comprimento: cm, categoria: 'Normal', cor } })

describe('triagem simples', () => {
  it('deixar para depois: vira pacote "Não identificado" (pendência), não perda; depois é separado', async () => {
    const { b, r } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'maria', 10000)
    // 10 kg → 2 kg loiro + 2 kg moreno + 5,8 kg para depois → perda 200 g
    const t1 = await b.comando('triarLotes', { id: 't1', ids: [l1], saidas: [parte('P1', 2000, 60, 'Loiro'), parte('P2', 2000, 50, 'Castanho')], paraDepois: { id: 'P3', quantidade: 5800 } })
    expect(t1.lotes).toEqual(['P1', 'P2', 'P3'])
    const p3 = await b.consulta('fichaItem', { id: 'P3' })
    expect(p3.item).toMatchObject({ saldo: 5800, nome: 'Não identificado', campos: { estado: 'Não identificado' } })
    expect(p3.status).toBe('naoIdentificado')
    // custo: o para depois leva pelo peso; nada some (a soma dos custos é o custo do bruto)
    const custos = await Promise.all(['P1', 'P2', 'P3'].map(async (id) => (await b.consulta('fichaItem', { id })).item.custoPrincipal ?? 0))
    expect(custos.reduce((s, c) => s + c, 0)).toBe(bs(50000))
    // perda = o que sobrou depois das partes e do para depois
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    expect(g.triagens[0]).toMatchObject({ perda: 200 })
    expect(g.totais.confere).toBe(true)
    // fica como pendência na entrada da triagem, com os dias esperando, e conta nos totais
    r.avancar(3)
    let q = await b.consulta('triagem', {})
    expect(q.lotes.find((x) => x.id === 'P3')).toMatchObject({ fase: 'aguardando', dias: 3 })
    expect(q.totais.naoIdentificado).toEqual({ n: 1, g: 5800, dias: 3 })
    // separado depois: vira pacotes de verdade e sai das pendências
    await b.comando('triarLotes', { id: 't2', ids: ['P3'], saidas: [parte('P4', 5700, 40, 'Preto')] })
    q = await b.consulta('triagem', {})
    expect(q.totais.naoIdentificado.n).toBe(0)
    expect((await b.consulta('genealogia', { compraId: 'c1' })).totais).toMatchObject({ confere: true, perdaTriagem: 300 })
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('padrão sem lavagem; coluna de lavagem opcional pede o peso depois e lança a perda de lavagem', async () => {
    const { b } = await novoBackend()
    expect((await b.consulta('fluxosTriagem', {}))[0].colunas.map((c) => c.nome)).toEqual(['Aguardando triagem', 'Separado', 'Pronto para venda', 'Vendido'])
    await b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: [COLUNAS_PADRAO[0], COLUNA_LAVAGEM, ...COLUNAS_PADRAO.slice(1)] })
    expect((await b.consulta('fluxosTriagem', {}))[0].colunas[1]).toMatchObject({ id: 'preparando', pedirPeso: true })
    const l1 = await comprar(b, 'c1', 'maria', 6000)
    await b.comando('moverFaseTriagem', { ids: [l1], fase: 'preparando' })
    // peso depois maior que o de antes: recusa
    await expect(b.comando('moverFaseTriagem', { ids: [l1], fase: 'aguardando', pesos: { [l1]: 6500 } })).rejects.toThrow(/maior/)
    await b.comando('moverFaseTriagem', { ids: [l1], fase: 'aguardando', pesos: { [l1]: 5700 } })
    const f = await b.consulta('fichaItem', { id: l1 })
    expect(f.item.saldo).toBe(5700)
    expect(f.item.faseTriagem?.fase).toBe('aguardando')
    const mov = f.movimentos.find((m) => m.motivo === 'perda')!
    expect(mov).toMatchObject({ delta: -300, saldoAntes: 6000, saldoDepois: 5700 })
    expect(mov.descricao).toMatch(/Perda de lavagem: 6.000 g → 5.700 g/)
    // sem peso (opcional): só muda de coluna
    await b.comando('moverFaseTriagem', { ids: [l1], fase: 'preparando' })
    await b.comando('moverFaseTriagem', { ids: [l1], fase: 'aguardando' })
    expect((await b.consulta('fichaItem', { id: l1 })).item.saldo).toBe(5700)
    const livro = await b.consulta('livroCabelo', { tipo: 'lavagem' })
    expect(livro.linhas.map((l) => l.delta)).toEqual([-300])
    expect((await b.consulta('genealogia', { compraId: 'c1' })).totais.confere).toBe(true)
  })

  it('movimento de estoque grava quem fez; histórico do pacote por dia com antes → depois e a origem', async () => {
    const { b, r, sessao } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'maria', 4000)
    const l2 = await comprar(b, 'c2', 'celso', 2000)
    r.avancar(1)
    Object.assign(sessao, { nome: 'Paula' })
    await b.comando('triarLotes', { id: 't1', ids: [l1, l2], saidas: [parte('P4', 6000, 50, 'Castanho')] })
    const movs = await b.consulta('movimentosDoItem', { itemId: 'P4' })
    expect(movs[0]).toMatchObject({ porNome: 'Paula', usuario: sessao.usuarioId })
    r.avancar(1)
    await b.comando('concluirVenda', { id: 'v9', linhas: [{ id: 'x', itemId: 'P4', quantidade: 1500, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] })
    const h = await b.consulta('historicoPacote', { itemId: 'P4' })
    expect(h.dias.map((d) => [d.data, d.inicio, d.fim, d.aberto])).toEqual([[r.hoje, 6000, 4500, true], [h.dias[1].data, 0, 6000, false]])
    const venda = h.dias[0].movs[0]
    expect(venda).toMatchObject({ tipo: 'venda', antes: 6000, depois: 4500, delta: -1500, por: 'Paula', ref: { tela: 'venda', params: { id: 'v9' } } })
    const entrada = h.dias[1].movs.find((m) => m.tipo === 'triagemEntrada')!
    expect(entrada.ref).toMatchObject({ tela: 'triagem', params: { aba: 'triagens', t: 't1' } })
    // as compras de origem com os gramas de cada uma (4 kg da Maria + 2 kg do Celso)
    expect(entrada.origem?.map((o) => [o.compraId, o.gramas]).sort()).toEqual([['c1', 4000], ['c2', 2000]])
    expect(entrada.fontes?.map((f) => f.g).sort()).toEqual([2000, 4000])
  })

  it('livro do cabelo: lançamentos com filtros e o fechamento por compra (misturado também fecha)', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'maria', 10000)
    const l2 = await comprar(b, 'c2', 'celso', 4000)
    await b.comando('triarLotes', { id: 't1', ids: [l1], saidas: [parte('P1', 2000, 60, 'Loiro'), parte('P2', 2000, 50, 'Castanho')], paraDepois: { id: 'P3', quantidade: 5800 } })
    // P3 (só da Maria) se junta com a compra do Celso: 2 kg do P3 + 4 kg do C2
    await b.comando('triarLotes', { id: 't2', ids: ['P3', l2], quantidadeUsada: 9800, saidas: [parte('P4', 9500, 50, 'Castanho')] })
    await b.comando('concluirVenda', { id: 'v9', linhas: [{ id: 'x1', itemId: 'P1', quantidade: 1000, moeda: 'BOB', total: bs(100) }, { id: 'x2', itemId: 'P4', quantidade: 1500, moeda: 'BOB', total: bs(150) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(250) }] })
    await b.comando('ajustarEstoque', { itemId: 'P2', novoSaldo: 1980, motivo: 'ajuste', descricao: 'contagem' })
    const L = await b.consulta('livroCabelo', {})
    expect(L.linhas.some((l) => l.tipo === 'entrada' && l.delta === 10000 && l.ref?.tela === 'pedido')).toBe(true)
    expect(L.linhas.filter((l) => l.tipo === 'venda').map((l) => l.delta).sort((a, b) => a - b)).toEqual([-1500, -1000])
    expect(L.linhas.find((l) => l.tipo === 'ajuste')).toMatchObject({ delta: -20, antes: 2000, depois: 1980 })
    // filtros: compra, pacote, pessoa, tipo
    expect((await b.consulta('livroCabelo', { compraId: 'c2' })).linhas.every((l) => l.compras.some((c) => c.id === 'c2'))).toBe(true)
    expect((await b.consulta('livroCabelo', { itemId: 'P4' })).linhas.map((l) => l.tipo).sort()).toEqual(['triagemEntrada', 'venda'])
    expect((await b.consulta('livroCabelo', { pessoaId: 'celso' })).linhas.length).toBeGreaterThan(0)
    expect((await b.consulta('livroCabelo', { tipo: 'triagemSaida' })).linhas.length).toBe(4)
    // fechamento: comprado = em pacotes + vendido + perda + diferença ✓ (para cada compra, mesmo misturada)
    const c1 = L.porCompra.find((c) => c.compraId === 'c1')!
    const c2 = L.porCompra.find((c) => c.compraId === 'c2')!
    expect(c1.comprado).toBe(10000)
    expect(c2.comprado).toBe(4000)
    expect(c1.confere && c2.confere).toBe(true)
    expect(c1.emPacotes + c1.vendido + c1.perda + c1.diferenca).toBeGreaterThanOrEqual(9998)
    // a parte do Celso no P4 é 4/9,8: vendeu 1.500 g do P4 → ~612 g dele
    expect(c2.vendido).toBe(Math.round((1500 * 4000) / 9800))
  })
})
