// CONCILIAÇÃO DE UM MÊS INTENSO: viagem (adiantamento, gastos) → compras na viagem e fora dela → triagem → vendas
// (uma cancelada) → gastos → a viagem encerra NO MÊS SEGUINTE e o gasto entra no custo dos lotes → vende o cabelo da
// viagem. Os relatórios precisam bater entre si e ser ADITIVOS (out + nov separados = out–nov juntos): se um gasto de
// viagem contar duas vezes (gasto em out + custo em nov), a soma não fecha.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function mes() {
  const { b, r } = await novoBackend('2026-10-05')
  await b.comando('salvarConfig', { socios: [{ id: 's1', nome: 'Ana', parteBp: 6000 }, { id: 's2', nome: 'Bia', parteBp: 4000 }] } as never)
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100_000), descricao: 'ini' } as any)
  await b.comando('salvarPessoa', { id: 'p-ana', nome: 'Ana', papeis: ['funcionario'] } as any)
  await b.comando('salvarPessoa', { id: 'f1', nome: 'Fornecedora 1', papeis: ['fornecedor'] } as any)
  await b.comando('salvarPessoa', { id: 'f2', nome: 'Fornecedora 2', papeis: ['fornecedor'] } as any)
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
  const repos = (b as any).repos
  const comprar = async (id: string, f: string, g: number, valor: number) => {
    await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: f, linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(valor), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'p' + id, forma: 'dinheiro', moeda: 'BOB', valor: bs(valor) }] } as any)
    return (await repos.transacoes.obter(id)).linhas[0].itemId as string
  }
  const separar = async (sep: string, lote: string, g: number, saida: string, sai: number) =>
    b.comando('separarLote', { id: sep, loteId: lote, quantidadeUsada: g, saidas: [{ id: saida, quantidade: sai, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } }] } as any)
  const vender = (id: string, item: string, g: number, valor: number) =>
    b.comando('concluirVenda', { id, pessoaId: 'cli', linhas: [{ id: id + 'l', itemId: item, quantidade: g, moeda: 'BOB', total: bs(valor) }], pagamentos: [{ id: 'p' + id, forma: 'dinheiro', moeda: 'BOB', valor: bs(valor) }] } as any)

  // OUTUBRO — viagem com adiantamento e gastos; 2 compras na viagem (fornecedoras diferentes) e 1 fora
  await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', destino: 'Oruro', viajantes: ['p-ana'], inicio: r.hoje } as any)
  await b.comando('adiantarViagem', { id: 'a1', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000) } as any)
  await b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(600) } as any)
  await b.comando('registrarDespesaViagem', { id: 'd2', viagemId: 'vg', categoria: 'hospedagem', moeda: 'BOB', valor: bs(400) } as any)
  const L1 = await comprar('c1', 'f1', 2000, 4000)
  await comprar('c2', 'f2', 1000, 2500)
  const L3 = await comprar('c3', 'f1', 1000, 1000) // fora da viagem
  await b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1', 'c2'] } as any)
  await separar('s1', L1, 2000, 'A', 1900)
  await separar('s3', L3, 1000, 'C', 950)
  r.avancar(5)
  await vender('v1', 'C', 500, 3000) // venda do cabelo SEM viagem
  await vender('v2', 'C', 100, 600)
  await b.comando('cancelarVenda', { id: 'v2', motivo: 'desistiu' } as any)
  await b.comando('lancarCaixa', { id: 'g1', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(300), descricao: 'Aluguel', categoria: 'Aluguel' } as any)
  // NOVEMBRO — a viagem encerra (gastou o adiantado inteiro) e o gasto entra no custo dos lotes; vende cabelo da viagem
  r.avancar(30)
  await b.comando('encerrarViagem', { viagemId: 'vg', contado: { BOB: 0 }, incorporar: true } as any)
  await vender('v3', 'A', 1000, 5000)
  return { b }
}

const res = async (b: any, de: string, ate: string) => (await b.consulta('dre', { de, ate })).resultado

describe('conciliação de um mês intenso', () => {
  it('os relatórios são aditivos: outubro + novembro = outubro a novembro (nenhum gasto de viagem conta duas vezes)', async () => {
    const { b } = await mes()
    const out = await res(b, '2026-10-01', '2026-10-31')
    const nov = await res(b, '2026-11-01', '2026-11-30')
    const tudo = await res(b, '2026-10-01', '2026-11-30')
    expect(out + nov).toBe(tudo)
  })

  it('estados financeiros, Painel, Imposto de Renda e a divisão entre sócias contam o mesmo', async () => {
    const { b } = await mes()
    const de = '2026-10-01'
    const ate = '2026-11-30'
    const d = await b.consulta('dre', { de, ate })
    const rel = await b.consulta('relatorioContabil', { de, ate })
    const p = await b.consulta('painel', { de, ate })
    // receita = vendas concluídas (a cancelada fora) = a lista de vendas
    expect(d.receita).toBe(bs(3000 + 5000))
    expect(rel.numeros.receita).toBe(d.receita)
    expect(p.cartoes.find((c: any) => c.id === 'faturamento')!.valor).toBe(d.receita)
    const lista = (await b.consulta('vendas', { de, ate })) as any[]
    expect(lista.filter((v) => v.etapa === 'concluido').reduce((s, v) => s + v.totalPrincipal, 0)).toBe(d.receita)
    // lucro bruto do Painel = o da DRE
    expect(p.cartoes.find((c: any) => c.id === 'lucro')!.valor).toBe(d.lucroBruto)
    // a divisão entre sócias fecha no resultado
    expect(d.socios.reduce((s: number, x: any) => s + x.parte, 0)).toBe(d.resultado)
    // o Imposto de Renda: receita do ano = soma dos meses = a do relatório
    const ir = await b.consulta('impostoRenda', { ano: 2026 })
    expect(ir.meses.reduce((s: number, x: any) => s + x.receita, 0)).toBe(ir.visao.receitaBruta.valor)
  })
  it('comparar viagens: custo por kg = cabelo + viagem (a mesma conta da tela da viagem)', async () => {
    const { b } = await mes()
    const v = (await b.consulta('viagens', {})).linhas.find((x: any) => x.id === 'vg')!
    expect(v.gramas).toBe(3000)
    expect(v.investido).toBe(v.custoCabelo + v.gasto)
    expect(Math.abs((v.custoKgReal ?? 0) - ((v.custoKg ?? 0) + (v.gastoKg ?? 0)))).toBeLessThanOrEqual(1)
    expect(v.receita).toBe(bs(5000))
  })
})
