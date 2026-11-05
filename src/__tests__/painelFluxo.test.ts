// O CICLO COMPLETO no Painel: compra → triagem → estoque → venda (uma cancelada) → os números do Painel e da "operação"
// batem com as telas de cada etapa, cada um pela SUA definição (operações × itens × peso × dinheiro).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function ciclo() {
  const { b, r } = await novoBackend()
  const hoje = r.hoje
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100_000), descricao: 'ini' } as any)
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
  const repos = (b as any).repos
  // compra 1: 2 kg (paga no ato = concluída); compra 2: 1 kg ainda EM ABERTO (o cabelo já entrou na triagem)
  await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'c1l', quantidade: 2000, moeda: 'BOB', total: bs(2000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc1', forma: 'dinheiro', moeda: 'BOB', valor: bs(2000) }] } as any)
  await b.comando('criarCompra', { id: 'c2', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'c2l', quantidade: 1000, moeda: 'BOB', total: bs(1500), campos: { estado: 'Bruto' } }] } as any)
  const lote1 = (await repos.transacoes.obter('c1')).linhas[0].itemId as string
  // triagem: os 2 kg viram 1,9 kg de 60 cm (100 g de perda)
  await b.comando('separarLote', { id: 's1', loteId: lote1, quantidadeUsada: 2000, saidas: [{ id: 'p60', quantidade: 1900, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } }] } as any)
  // venda de 1 kg (Bs 5.000) e outra de 200 g que é CANCELADA
  await b.comando('concluirVenda', { id: 'v1', pessoaId: 'cli', linhas: [{ id: 'v1l', itemId: 'p60', quantidade: 1000, moeda: 'BOB', total: bs(5000) }], pagamentos: [{ id: 'pv1', forma: 'dinheiro', moeda: 'BOB', valor: bs(5000) }] } as any)
  await b.comando('concluirVenda', { id: 'v2', pessoaId: 'cli', linhas: [{ id: 'v2l', itemId: 'p60', quantidade: 200, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'pv2', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
  await b.comando('cancelarVenda', { id: 'v2', motivo: 'teste' } as any)
  return { b, hoje }
}

describe('painel × telas: o ciclo completo', () => {
  it('vendas, compras, estoque e triagem: cada número pela sua definição', async () => {
    const { b, hoje } = await ciclo()
    const p = await b.consulta('painel', { de: hoje, ate: hoje })
    const c = (id: string) => p.cartoes.find((x) => x.id === id)!.valor
    // VENDAS: só a concluída (a cancelada não entra em faturamento, contagem nem ticket)
    expect(c('faturamento')).toBe(bs(5000))
    expect(c('vendas')).toBe(1)
    expect(c('ticket')).toBe(bs(5000))
    // a lista de Vender (o detalhe do cartão) soma o mesmo
    const lista = (await b.consulta('vendas', { de: hoje, ate: hoje })) as any[]
    expect(lista.filter((v) => v.etapa === 'concluido').reduce((s, v) => s + v.totalPrincipal, 0)).toBe(c('faturamento'))
    // OPERAÇÃO (foto de agora) = as telas: triagem tem 1 kg bruto (a compra em aberto), o estoque 900 g prontos
    const o = (await b.consulta('operacao', {}))!
    const tri = await b.consulta('triagem', { moduloId: 'cabelo' })
    expect(o.triagem.gramas).toBe(1000)
    expect(o.estoque.disponivel).toBe(900)
    expect(tri.totais.pronto).toBe(900)
    expect(o.compras.abertas).toBe(1)
  })

  it('filtro de moeda: faturamento, lucro e margem olham as MESMAS vendas', async () => {
    const { b, hoje } = await ciclo()
    const p = await b.consulta('painel', { de: hoje, ate: hoje, moeda: 'USD' })
    const c = (id: string) => p.cartoes.find((x) => x.id === id)!.valor
    // nenhuma venda em US$: nada de lucro "de todas as vendas" ao lado de um faturamento zero
    expect(c('faturamento')).toBe(0)
    expect(c('lucro')).toBe(0)
    expect(c('margem')).toBe(0)
  })

  it('compras: concluídas no número; as em aberto aparecem à parte (já estão na triagem)', async () => {
    const { b, hoje } = await ciclo()
    const p = await b.consulta('painel', { de: hoje, ate: hoje })
    const compras = p.cartoes.find((x) => x.id === 'compras')!
    expect(compras.valor).toBe(bs(2000))
    expect(p.comprasAbertas).toEqual({ n: 1, valor: bs(1500) })
  })
})
