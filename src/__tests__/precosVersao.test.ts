// TABELA DE PREÇO × VERSÃO × VENDA: a venda guarda a versão, o comprador (coluna) e o fator que usou; publicar a
// versão nova não muda a venda antiga; "Onde foi usada" separa por versão (a guardada na linha); fator mudado à mão
// fica marcado; a venda em aberto guarda a coluna escolhida; a venda cancelada sai dos usos; a compra também carimba
// (e o pacote não leva o carimbo); a lista mostra vigente/agendada.
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function cenario() {
  const ctx = await novoBackend()
  const { b } = ctx
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
  const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
  await b.comando('separarLote', { id: 's', loteId: bruto.id, quantidadeUsada: 10000, saidas: [
    { id: 'a', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
    { id: 'b', quantidade: 3500, campos: { estado: 'Bruto' } },
  ] })
  const tabela = (valores: Record<string, string>, nota?: string) => b.comando('salvarTabelaPreco', {
    id: 't', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [60],
    colunas: [{ id: 'lp', nome: 'LP' }, { id: 'hel', nome: 'Helena' }], valores, nota,
  })
  await tabela({ '60|lp': '17', '60|hel': '18' })
  const vender = (id: string, coluna: string, fator: string, gramas = 100) => b.comando('concluirVenda', {
    id, linhas: [{ id: `${id}-l`, itemId: 'a', quantidade: gramas, moeda: 'BOB', total: 0, calculo: { medida: 60, fator, categoria: 'Normal', tabelaId: 't', colunaId: coluna } }],
    pagamentos: [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: Math.round(gramas * Number(fator.replace(',', '.')) * 100) }],
  })
  return { ...ctx, tabela, vender }
}

describe('a venda guarda a versão e o valor usados', () => {
  it('v1 → venda (padrão e outra coluna) → publica v2 → a venda antiga continua v1; os usos separam por versão', async () => {
    const { b, tabela, vender } = await cenario()
    await vender('v1', 'lp', '17')
    await vender('v2', 'hel', '18')
    const l1 = (await b.consulta('venda', { id: 'v1' })).venda.linhas[0]
    expect(l1.campos).toMatchObject({ tabelaId: 't', tabelaVersao: 1, colunaId: 'lp', colunaNome: 'LP', fator: '17', fatorTabela: '17' })
    expect(l1.campos.fatorManual).toBeUndefined()
    expect(l1.totalPrincipal).toBe(bs(1700))
    expect((await b.consulta('venda', { id: 'v2' })).venda.linhas[0].campos).toMatchObject({ tabelaVersao: 1, colunaNome: 'Helena', fator: '18' })
    // publica a v2 (sobe o LP): as vendas antigas NÃO mudam
    expect((await tabela({ '60|lp': '17,5', '60|hel': '18' }, 'subiu LP')).versao).toBe(2)
    const de1 = (await b.consulta('venda', { id: 'v1' })).venda.linhas[0]
    expect(de1.campos).toMatchObject({ tabelaVersao: 1, fator: '17' })
    expect(de1.totalPrincipal).toBe(bs(1700))
    // a venda nova usa a v2
    await vender('v3', 'lp', '17,5')
    expect((await b.consulta('venda', { id: 'v3' })).venda.linhas[0].campos).toMatchObject({ tabelaVersao: 2, fatorTabela: '17,5' })
    // onde foi usada: a versão vem da linha (não da data) e nunca mistura
    const d = await b.consulta('tabelaPreco', { id: 't' })
    expect(d.atual).toBe(2)
    expect(d.usos.filter((u) => u.versao === 1).map((u) => u.id).sort()).toEqual(['v1', 'v2'])
    expect(d.usos.filter((u) => u.versao === 2).map((u) => u.id)).toEqual(['v3'])
    expect(d.usos.every((u) => !u.versaoEstimada)).toBe(true)
    expect(d.usos.find((u) => u.id === 'v2')?.colunas).toEqual(['Helena'])
    // a versão anterior continua no histórico, igual
    expect(d.versoes.map((v) => v.numero)).toEqual([2, 1])
    expect(d.versoes[1].valores['60|lp']).toBe('17')
  })

  it('fator mudado à mão fica marcado; venda cancelada sai dos usos', async () => {
    const { b, vender } = await cenario()
    await vender('m', 'lp', '16')
    const l = (await b.consulta('venda', { id: 'm' })).venda.linhas[0]
    expect(l.campos).toMatchObject({ fator: '16', fatorTabela: '17', fatorManual: true })
    expect((await b.consulta('tabelaPreco', { id: 't' })).usos.find((u) => u.id === 'm')?.manual).toBe(true)
    await b.comando('cancelarVenda', { id: 'm', motivo: 'teste' })
    expect((await b.consulta('tabelaPreco', { id: 't' })).usos.some((u) => u.id === 'm')).toBe(false)
  })

  it('a venda em aberto guarda a coluna escolhida (ao retomar, volta a mesma)', async () => {
    const { b } = await cenario()
    await b.comando('salvarVendaAberta', { id: 'ab', linhas: [{ id: 'x', itemId: 'a', quantidade: 100 }], colunaId: 'hel' })
    const a = (await b.consulta('vendasAbertas', {})).find((x) => x.id === 'ab')
    expect(a?.venda.colunaId).toBe('hel')
  })

  it('a compra pela tabela também guarda a versão, e o pacote que nasce dela não leva o carimbo', async () => {
    const { b } = await cenario()
    await b.comando('criarCompra', { id: 'c2', moduloId: 'cabelo', linhas: [{ id: 'cl', quantidade: 500, moeda: 'BOB', total: 0, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' }, calculo: { medida: 60, fator: '18', categoria: 'Normal', tabelaId: 't', colunaId: 'hel' } }] })
    const c = (await b.consulta('venda', { id: 'c2' })).venda
    expect(c.linhas[0].campos).toMatchObject({ tabelaVersao: 1, colunaNome: 'Helena', fatorTabela: '18' })
    const lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.compras?.some((x) => x.id === 'c2'))
    expect(lote?.campos.tabelaVersao).toBeUndefined()
    expect(lote?.campos.colunaNome).toBeUndefined()
  })

  it('a lista das tabelas: vigente e agendada (vale a partir de uma data futura)', async () => {
    const { b, r } = await cenario()
    await b.comando('salvarTabelaPreco', { id: 't2', moduloId: 'cabelo', nome: 'Geral 2027', validaDesde: '2099-01-01', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [60], colunas: [{ id: 'lp', nome: 'LP' }], valores: { '60|lp': '20' } })
    const lista = await b.consulta('listaTabelasPreco', {})
    expect(lista.find((x) => x.id === 't')?.situacao).toBe('vigente')
    expect(lista.find((x) => x.id === 't2')?.situacao).toBe('agendada')
    expect(lista.find((x) => x.id === 't')).toMatchObject({ versao: 1, compradores: 2, faixa: [17, 18] })
    expect(r).toBeTruthy()
  })
})
