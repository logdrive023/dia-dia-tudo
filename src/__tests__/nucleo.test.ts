import { describe, expect, it } from 'vitest'
import { converter, formatar, lerValor, multiplicarFator } from '../core/domain/dinheiro'
import { calcularParcelas } from '../core/services/emprestimos'
import { bs, novoBackend } from './ajuda'

describe('dinheiro e moedas', () => {
  it('lê o que a pessoa digita e mostra igual ao caderno', () => {
    expect(lerValor('1.474,80', 'BRL')).toBe(147480)
    expect(lerValor('70', 'BRL')).toBe(7000)
    expect(lerValor('70,5', 'BRL')).toBe(7050)
    expect(lerValor('71.000', 'PYG')).toBe(71000)
    expect(lerValor('1e5', 'BRL')).toBeNull()
    expect(lerValor('-3', 'BRL')).toBeNull()
    expect(formatar(700000, 'BOB')).toBe('Bs 7.000,00')
    expect(formatar(71000, 'PYG')).toBe('₲ 71.000')
  })

  it('multiplica como o caderno: gramas × fator', () => {
    expect(multiplicarFator(2000, '3,5', 'BOB')).toBe(bs(7000)) // 40 | 3,5 × 2 kg = 7000
    expect(multiplicarFator(2008, '17,5', 'BOB')).toBe(bs(35140)) // 60 | 2008 × 17,5 = 35140
    expect(multiplicarFator(518, '19', 'BOB')).toBe(bs(9842))
    expect(multiplicarFator(1552, '3.5', 'BOB')).toBe(bs(5432))
  })

  it('converte exato pela cotação guardada', () => {
    const cot = { USD: { moeda: 'USD', valor: '5,43', sentido: 'basePorMoeda' as const, data: '' }, PYG: { moeda: 'PYG', valor: '1420', sentido: 'moedaPorBase' as const, data: '' } }
    expect(converter(10000, 'USD', 'BRL', cot)).toBe(54300)
    expect(converter(5000, 'BRL', 'PYG', cot)).toBe(71000)
  })

  it('parcelas de empréstimo somam o combinado', () => {
    const s = calcularParcelas(100000, { tipo: 'simples', taxaMensalBp: 500 }, 4, '2026-12-01')
    expect(s.parcelas.map((p) => p.valor)).toEqual([30000, 30000, 30000, 30000])
    expect(s.juros).toBe(20000)
    const pr = calcularParcelas(100000, { tipo: 'composto', taxaMensalBp: 300 }, 12, '2026-12-01')
    expect(pr.parcelas.every((p) => p.valor === pr.parcelas[0].valor)).toBe(true)
  })
})

describe('cabelo: compra bruta → separação → vendas parciais → rastreio', () => {
  it('40 kg bruto viram 20 preto + 19,5 castanho e duas vendas; tudo rastreado e conferido', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedor', papeis: ['fornecedor'] })
    await b.comando('salvarPessoa', { id: 'henry', nome: 'Henry', papeis: ['cliente'] })
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(500000), descricao: 'Início' })
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'forn', linhas: [{ id: 'l1', quantidade: 40000, moeda: 'BOB', total: bs(240000), campos: { estado: 'Bruto' } }] })
    // anda a triagem; não deixa pular etapa
    await expect(b.comando('avancarTriagem', { compraId: 'c1', para: 'pago' })).rejects.toThrow(/próxima etapa/)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido' })
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [{ id: 'p1', forma: 'dinheiro', moeda: 'BOB', valor: bs(200000) }] })
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'concluido' })
    // o que faltou pagar ficou na conta do fornecedor
    const conta = await b.consulta('contaPessoa', { pessoaId: 'forn' })
    expect(conta.saldo).toBe(-bs(40000))

    const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
    expect(bruto.saldo).toBe(40000)
    expect(bruto.codigo).toMatch(/^L-\d{4}$/)
    await b.comando('separarLote', {
      id: 's1',
      loteId: bruto.id,
      quantidadeUsada: 40000,
      saidas: [
        { id: 'preto', quantidade: 20000, campos: { comprimento: 60, categoria: 'Normal', cor: 'Preto', estado: 'Separado' } },
        { id: 'castanho', quantidade: 19500, campos: { comprimento: 50, categoria: 'Normal', cor: 'Castanho', estado: 'Separado' } },
      ],
    })
    const preto = (await b.consulta('fichaItem', { id: 'preto' })).item
    // custo dividido pelo peso: 240.000 × 20.000/39.500
    expect(preto.custoPrincipal).toBe(Math.round((bs(240000) * 20000) / 39500))

    r.avancar(1)
    await b.comando('concluirVenda', {
      id: 'v1',
      pessoaId: 'henry',
      linhas: [{ id: 'a', itemId: 'preto', quantidade: 2008, moeda: 'BOB', total: 0, calculo: { medida: 60, fator: '17,5' } }],
      pagamentos: [{ id: 'pa', forma: 'qr', moeda: 'BOB', valor: bs(30000) }],
    })
    await b.comando('concluirVenda', {
      id: 'v2',
      pessoaId: 'henry',
      linhas: [{ id: 'b', itemId: 'castanho', quantidade: 2000, moeda: 'BOB', total: 0, calculo: { medida: 50, fator: '6,4' } }],
      pagamentos: [{ id: 'pb', forma: 'qr', moeda: 'BOB', valor: bs(12800) }],
    })
    const v1 = (await b.consulta('venda', { id: 'v1' })).venda
    expect(v1.linhas[0].total).toBe(bs(35140))
    expect(v1.linhas[0].campos.calculo).toContain('2.008 × 17,5')
    // Henry ficou devendo 5.140 da primeira venda
    expect((await b.consulta('contaPessoa', { pessoaId: 'henry' })).saldo).toBe(bs(5140))

    const rast = await b.consulta('rastreio', { compraId: 'c1' })
    expect(rast.resumo.comprado).toBe(40000)
    expect(rast.resumo.perdaNaSeparacao).toBe(500)
    expect(rast.resumo.vendas).toBe(2)
    expect(rast.resumo.vendido).toBe(4008)
    expect(rast.resumo.emEstoque).toBe(40000 - 500 - 4008)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('não vende mais do que tem e não duplica com toque repetido', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha', saldoInicial: 2 })
    const venda = { id: 'v', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(25) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(25) }] }
    await b.comando('concluirVenda', venda)
    await b.comando('concluirVenda', venda)
    expect((await b.consulta('estoque', { moduloId: 'produtos' }))[0].saldo).toBe(1)
    await expect(
      b.comando('concluirVenda', { id: 'v2', linhas: [{ id: 'l2', itemId: 'x', quantidade: 5, moeda: 'BOB', total: bs(125) }], pagamentos: [{ id: 'p2', forma: 'dinheiro', moeda: 'BOB', valor: bs(125) }] }),
    ).rejects.toThrow(/Não há/)
    // sem cliente o pagamento precisa fechar
    await expect(
      b.comando('concluirVenda', { id: 'v3', linhas: [{ id: 'l3', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(25) }], pagamentos: [{ id: 'p3', forma: 'dinheiro', moeda: 'BOB', valor: bs(20) }] }),
    ).rejects.toThrow(/Falta/)
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('tabela de preço: célula exata, medida intermediária usa a linha de baixo', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarTabelaPreco', {
      id: 't',
      moduloId: 'cabelo',
      nome: 'Geral',
      moeda: 'BOB',
      unidadeMedida: 'cm',
      fatorPor: 'grama',
      linhas: [40, 50, 60],
      colunas: [{ id: 'iver', nome: 'Iver' }],
      valores: { '40|iver': '3.5', '50|iver': '6,4', '60|iver': '16,5' },
    })
    expect((await b.consulta('calcularPreco', { tabelaId: 't', colunaId: 'iver', medida: 40, quantidade: 2000 })).total).toBe(bs(7000))
    const r65 = await b.consulta('calcularPreco', { tabelaId: 't', colunaId: 'iver', medida: 65, quantidade: 1000 })
    expect(r65.linhaUsada).toBe(60)
    expect(r65.total).toBe(bs(16500))
    // editar guarda a versão anterior
    const t = (await b.consulta('tabelasPreco', {}))[0]
    await b.comando('salvarTabelaPreco', { ...t, valores: { ...t.valores, '40|iver': '3,7' } })
    expect((await b.consulta('historicoTabela', { id: 't' }))[0].valores['40|iver']).toBe('3,5')
  })
})

describe('salão, equipe e unidades', () => {
  it('custo da unidade soma salários de qualquer período e compara com as entradas', async () => {
    const { b } = await novoBackend('2026-11-01')
    await b.comando('salvarLocal', { id: 's1', nome: 'Salão 1', tipo: 'salao' })
    await b.comando('salvarPessoa', { id: 'a', nome: 'Ana', papeis: ['funcionario', 'profissional'], localId: 's1', salario: { moeda: 'BOB', valor: bs(3000), periodo: 'mes' }, comissaoBp: 4000 })
    await b.comando('salvarPessoa', { id: 'b', nome: 'Bia', papeis: ['funcionario'], localId: 's1', salario: { moeda: 'BOB', valor: bs(700), periodo: 'semana' }, superiorId: 'a' })
    await b.comando('salvarPessoa', { id: 'c', nome: 'Cris', papeis: ['funcionario'], localId: 's1', salario: { moeda: 'BOB', valor: bs(100), periodo: 'dia' }, superiorId: 'a' })
    await expect(b.comando('salvarPessoa', { id: 'a', nome: 'Ana', papeis: ['funcionario'], superiorId: 'b' })).rejects.toThrow(/círculo/)
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' })
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'], localId: 's1' })
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', localId: 's1', profissionalId: 'a', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] })
    const u = (await b.consulta('unidades', { de: '2026-11-01', ate: '2026-11-30' })).lista[0]
    // 3000 + 700×30/7 (3000) + 100×30 (3000) = 9000 por mês; período de 30 dias
    expect(u.salarioMensal).toBe(bs(9000))
    expect(u.entradas).toBe(bs(1000))
    expect(u.comissoes).toBe(bs(400))
    expect(u.margem).toBe(bs(1000) - bs(9000) - bs(400))
    const org = await b.consulta('organograma', { localId: 's1', de: '2026-11-01', ate: '2026-11-30' })
    expect(org.raizes.map((n) => n.pessoa.nome)).toEqual(['Ana'])
    expect(org.raizes[0].subordinados.map((n) => n.pessoa.nome)).toEqual(['Bia', 'Cris'])
    // "repetir o último": sem pagamento usa o cadastro; depois repete o último pago
    expect((await b.consulta('sugestaoSalario', { pessoaId: 'b' }))?.valor).toBe(bs(700))
    await b.comando('pagarSalario', { id: 'ps', pessoaId: 'b', valor: bs(650), moeda: 'BOB', forma: 'dinheiro' })
    expect((await b.consulta('sugestaoSalario', { pessoaId: 'b' }))?.valor).toBe(bs(650))
  })
})

describe('modalidade criada pela tela', () => {
  it('entra no sistema sem mudar o núcleo e vende com estoque', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarModulo', { id: 'oculos', nome: 'Óculos', icone: '👓', recursos: { estoque: 'peca', triagem: ['Conferido'] }, campos: [{ id: 'marca', nome: 'Marca', tipo: 'texto' }] })
    await b.comando('salvarItem', { id: 'o1', moduloId: 'oculos', tipoItem: 'item', nome: 'Óculos de sol', saldoInicial: 3, campos: { marca: 'X' } })
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'o1', quantidade: 1, moeda: 'BOB', total: bs(200) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(200) }] })
    const p = await b.consulta('painel', { de: '2026-11-01', ate: '2026-11-01' })
    expect(p.areas.some((a) => a.id === 'oculos')).toBe(true)
    expect(p.porArea.find((a) => a.id === 'oculos')?.valor).toBe(bs(200))
  })
})
