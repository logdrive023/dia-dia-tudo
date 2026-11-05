// SUGESTÃO DE COMPRA: ritmo de venda por medida, em quantos dias acaba, quanto comprar e o custo do último kg.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('reposição por medida', () => {
  it('60 cm vende 100 g/dia: 1.000 g acabam em 10 dias; para 30 dias falta comprar 2 kg', async () => {
    const { b, r } = await novoBackend('2026-10-01')
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'cl', quantidade: 5000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc', forma: 'qr', moeda: 'BOB', valor: bs(50000) }] } as any)
    const bruto = (await (b as any).repos.transacoes.obter('c')).linhas[0].itemId
    await b.comando('separarLote', { id: 's', loteId: bruto, quantidadeUsada: 5000, saidas: [
      { id: 'L60', quantidade: 4000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } },
      { id: 'L40', quantidade: 1000, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } },
    ] } as any)
    // vende 3.000 g de 60 cm ao longo de 30 dias (100 g/dia)
    for (let k = 0; k < 3; k++) {
      r.avancar(10)
      await b.comando('concluirVenda', { id: 'v' + k, pessoaId: 'cli', linhas: [{ id: 'v' + k + 'l', itemId: 'L60', quantidade: 1000, moeda: 'BOB', total: bs(15000) }], pagamentos: [{ id: 'p' + k, forma: 'qr', moeda: 'BOB', valor: bs(15000) }] } as any)
    }
    const rep = (await b.consulta('reposicao', { janelaDias: 30, alertaDias: 14, cobrirDias: 30 })) as any
    const l60 = rep.linhas.find((l: any) => l.medida === 60)
    expect(l60.estoqueG).toBe(1000)
    expect(l60.vendidoG).toBe(3000)
    expect(l60.ritmoGDia).toBe(100)
    expect(l60.acabaEmDias).toBe(10)
    expect(l60.situacao).toBe('acabando')
    expect(l60.sugestaoG).toBe(2000)
    expect(l60.ultimo.custoKg).toBe(bs(10000)) // Bs 50.000 ÷ 5 kg
    const l40 = rep.linhas.find((l: any) => l.medida === 40)
    expect(l40.situacao).toBe('parado')
    expect(rep.linhas[0].medida).toBe(60) // o mais urgente em cima
    expect(rep.totais.acabando).toBe(1)
    await expect(b.comando('salvarConfig', { reposicao: { janelaDias: 0, alertaDias: 14, cobrirDias: 30 } } as never)).rejects.toThrow(/1 a 365/)
  })
})
