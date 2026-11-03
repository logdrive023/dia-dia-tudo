// Desconto que mantém a ligação com a tabela de preço, cotação por pagamento (dividir pagamento) e o pacote para vender
// da funcionária (sem custo).

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function comLote() {
  const ctx = await novoBackend()
  const { b } = ctx
  await b.comando('salvarPessoa', { id: 'ana', nome: 'Ana', papeis: ['profissional'] })
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
  const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
  await b.comando('separarLote', {
    id: 's',
    loteId: bruto.id,
    quantidadeUsada: 10000,
    saidas: [
      { id: 'a', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
      { id: 'b', quantidade: 3500, campos: { estado: 'Bruto' } },
    ],
  })
  await b.comando('salvarTabelaPreco', {
    id: 't',
    moduloId: 'cabelo',
    nome: 'Geral',
    moeda: 'BOB',
    unidadeMedida: 'cm',
    fatorPor: 'grama',
    linhas: [40, 60],
    colunas: [{ id: 'henry', nome: 'Henry' }],
    valores: { '40|henry': '3,5', '60|henry': '17,5' },
  })
  return { ...ctx, brutoId: bruto.id }
}

const linha60 = (desconto?: number) => ({
  id: 'l1',
  itemId: 'a',
  quantidade: 2008,
  moeda: 'BOB',
  total: 0,
  profissionalId: 'ana',
  comissaoBp: 1000,
  calculo: { medida: 60, fator: '17,5', categoria: 'Normal', tabelaId: 't', colunaId: 'henry' },
  ...(desconto ? { desconto } : {}),
})

describe('desconto com a tabela de preço', () => {
  it('2,5% sobre 2.008 g × 17,5: a linha guarda fator/medida/tabela, o cheio e o desconto; total, comissão e lucro pelo líquido', async () => {
    const { b, r } = await comLote()
    // Bs 35.140 − 2,5% (Bs 878,50) = Bs 34.261,50
    await b.comando('concluirVenda', { id: 'v', linhas: [linha60()], desconto: { moeda: 'BOB', pct: 2.5 }, pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: 3426150 }] })
    const { venda: v } = await b.consulta('venda', { id: 'v' })
    const l = v.linhas[0]
    expect(l.campos).toMatchObject({ medida: 60, fator: '17,5', tabelaId: 't', colunaId: 'henry' })
    expect(l.campos.calculo).toContain('2.008 × 17,5 = Bs 35.140,00')
    expect(l).toMatchObject({ bruto: bs(35140), desconto: 87850, descontoPrincipal: 87850, total: 3426150, totalPrincipal: 3426150 })
    expect(l.descricao).not.toMatch(/desconto/)
    // comissão pelo líquido (10%)
    expect(l.comissaoPrincipal).toBe(342615)
    expect(l.baseComissao).toBe(3426150)
    expect(v.totalPrincipal).toBe(3426150)
    expect(v.campos.desconto).toBe('desconto 2,5% = Bs 878,50')
    // lucro = líquido − custo − comissão
    const lista = (await b.consulta('vendas', {})).find((x) => x.id === 'v')!
    expect(lista.lucroPrincipal).toBe(3426150 - (l.custoPrincipal ?? 0) - 342615)

    // relatórios: fator e desconto na linha; DRE com (−) Descontos entre receita bruta e líquida
    const det = (await b.consulta('vendasDetalhadas', { de: r.hoje, ate: r.hoje })).find((x) => x.vendaId === 'v')!
    expect(det).toMatchObject({ fator: '17,5', medida: 60, bruto: bs(35140), desconto: 87850, total: 3426150 })
    const dre = await b.consulta('dre', { de: r.hoje, ate: r.hoje })
    const contas = dre.linhas.map((x) => x.conta)
    expect(contas.slice(0, 3)).toEqual(['Receita de vendas', '(−) Descontos', '= Receita líquida'])
    expect(dre.linhas[0].valor).toBe(bs(35140))
    expect(dre.linhas[1].valor).toBe(-87850)
    expect(dre.linhas[2].valor).toBe(3426150)
    expect(dre.receita).toBe(3426150)
    expect(dre.descontos).toBe(87850)
    // tabela de preço: a venda continua contando como uso da tabela
    const tb = await b.consulta('tabelaPreco', { id: 't' })
    expect(tb.usos.find((u) => u.id === 'v')).toMatchObject({ linhas: 1, desconto: 87850 })
    // comissão: base = líquido, desconto visível
    const ganho = (await b.consulta('comissoes', {})).extrato.find((x) => x.tipo === 'ganho' && x.vendaId === 'v')
    expect(ganho).toMatchObject({ base: 3426150, valorLinha: 3426150, desconto: 87850, valor: 342615 })
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('desconto em valor reparte entre as linhas; venda sem desconto fica como antes; corrigir as gramas mantém o desconto', async () => {
    const { b } = await comLote()
    await b.comando('concluirVenda', {
      id: 'v',
      linhas: [
        { ...linha60(), id: 'x', quantidade: 1000 },
        { ...linha60(), id: 'y', quantidade: 3000 },
      ],
      desconto: { moeda: 'BOB', valor: bs(1000) },
      pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(70000 - 1000) }],
    })
    const v = (await b.consulta('venda', { id: 'v' })).venda
    expect(v.linhas.map((l) => l.desconto)).toEqual([bs(250), bs(750)])
    expect(v.linhas.every((l) => l.campos.tabelaId === 't' && l.campos.fator === '17,5')).toBe(true)
    expect(v.campos.desconto).toBe('desconto Bs 1.000,00')
    await expect(b.comando('concluirVenda', { id: 'w', linhas: [linha60()], desconto: { moeda: 'BOB', valor: bs(99999) }, pagamentos: [] })).rejects.toThrow(/Desconto maior/)

    // sem desconto: nada de bruto/desconto (vendas antigas continuam iguais)
    await b.comando('concluirVenda', { id: 'z', linhas: [{ ...linha60(), quantidade: 500 }], pagamentos: [{ id: 'pz', forma: 'dinheiro', moeda: 'BOB', valor: bs(8750) }] })
    const z = (await b.consulta('venda', { id: 'z' })).venda.linhas[0]
    expect(z.bruto).toBeUndefined()
    expect(z.desconto).toBeUndefined()

    // correção: 1.000 g → 900 g; cheio recalculado pelo fator, desconto continua
    await b.comando('corrigirVenda', { id: 'v', motivo: 'balança', linhas: [{ linhaId: 'x', quantidade: 900 }], diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    const x = (await b.consulta('venda', { id: 'v' })).venda.linhas.find((l) => l.id === 'x')!
    expect(x).toMatchObject({ bruto: bs(15750), desconto: bs(250), total: bs(15500), totalPrincipal: bs(15500) })
    expect(x.comissaoPrincipal).toBe(bs(1550))
  })
})

describe('dividir pagamento: cotação de cada pagamento', () => {
  it('R$ a 1,30 e US$ a 6,96: cada pagamento usa a sua cotação; caixa por moeda certo', async () => {
    const { b, r } = await comLote()
    const caixa = async (m: string) => (await b.consulta('caixaDoDia', { data: r.hoje })).contas.find((c) => c.moeda === m)?.total ?? 0
    const [brl0, usd0] = [await caixa('BRL'), await caixa('USD')]
    // 1.000 g × 17,5 = Bs 17.500 = R$ 100 (Bs 130) + US$ 2.495,69 × 6,96 (Bs 17.370)
    const usd = Math.round(((bs(17500) - 13000) * 100) / 696)
    await b.comando('concluirVenda', {
      id: 'v',
      linhas: [{ ...linha60(), quantidade: 1000 }],
      pagamentos: [
        { id: 'p1', forma: 'dinheiro', moeda: 'BRL', valor: bs(100), cotacao: { moeda: 'BRL', valor: '1,30', sentido: 'basePorMoeda' as const, contra: 'BOB', data: '' } },
        { id: 'p2', forma: 'dinheiro', moeda: 'USD', valor: usd, cotacao: { moeda: 'USD', valor: '6,96', sentido: 'basePorMoeda' as const, contra: 'BOB', data: '' } },
      ],
    })
    const v = (await b.consulta('venda', { id: 'v' })).venda
    expect(v.pagamentos[0]).toMatchObject({ moeda: 'BRL', valor: bs(100), valorPrincipal: 13000 })
    expect(v.pagamentos[1]).toMatchObject({ moeda: 'USD', valor: usd, valorPrincipal: Math.round(usd * 6.96) })
    expect(v.pagamentos[0].cotacao).toMatchObject({ valor: '1,3', contra: 'BOB' })
    expect(v.pagamentos[1].cotacao).toMatchObject({ valor: '6,96', contra: 'BOB' })
    expect(await caixa('BRL')).toBe(brl0 + bs(100))
    expect(await caixa('USD')).toBe(usd0 + usd)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })
})

describe('funcionária: pacote para vender', () => {
  it('consulta pacoteVenda (sem custo) e não a fichaItem', async () => {
    const { b, sessao, brutoId } = await comLote()
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    const p = await b.consulta('pacoteVenda', { id: 'a' })
    expect(p).toMatchObject({ id: 'a', rotulo: '60 cm · Normal · Preto', saldo: 6000, vendavel: true, status: 'disponivel', compras: [expect.any(String)] })
    expect(p.preco).toMatchObject({ moeda: 'BOB', fator: '17,5', total: bs(105000) })
    // nada de custo, margem ou preço do fornecedor
    const texto = JSON.stringify(p)
    expect(texto).not.toMatch(/custo|margem|lucro|fornecedor|totalPrincipal/i)
    // bruto: não está pronto para vender
    const bruto = await b.consulta('pacoteVenda', { id: 'b' })
    expect(bruto.vendavel).toBe(false)
    expect(bruto.preco).toBeUndefined()
    await expect(b.consulta('fichaItem', { id: 'a' })).rejects.toThrow(/permissão/)
    expect(brutoId).toBeTruthy()
  })
})
