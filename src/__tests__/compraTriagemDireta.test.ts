// REGRA NOVA (Compra → Triagem): ao registrar a compra de cabelo, o lote nasce na hora e fica "Aguardando triagem"
// (Bruto); as etapas da compra ficam só para pagamento e entrega. Conferência de peso vira lançamento no lote.

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

async function base() {
  const ctx = await novoBackend()
  const { b } = ctx
  await b.comando('salvarPessoa', { id: 'maria', nome: 'Maria', papeis: ['fornecedor'] })
  await b.comando('salvarPessoa', { id: 'ana', nome: 'Ana', papeis: ['cliente'] })
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'Início' })
  return ctx
}

const comprar = (b: B, id = 'c1', g = 10000) =>
  b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'maria', linhas: [{ id: `${id}-l`, quantidade: g, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto', categoria: 'Normal' } }] })

const loteDa = async (b: B, compraId: string) => (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.tipo === 'compra' && i.origem.id === compraId)!

describe('compra → triagem direta', () => {
  it('registrou: o lote já existe como bruto aguardando triagem, sem andar etapa nem pagar', async () => {
    const { b, r } = await base()
    await comprar(b)
    const p = await b.consulta('pedido', { id: 'c1' })
    expect(p.compra.etapa).toBe('recebido')
    expect(p.lotes).toHaveLength(1)
    expect(p.lotes[0]).toMatchObject({ saldo: 10000, daCompra: true, aguardando: { dias: 0 } })
    const lote = await loteDa(b, 'c1')
    expect(lote.campos.estado).toBe('Bruto')
    expect(lote.status).toBe('bruto')
    // aparece na coluna de entrada da Triagem
    const tri = await b.consulta('triagem', { moduloId: 'cabelo' })
    expect(JSON.stringify(tri)).toContain(lote.id)
    // dias parado contam
    r.avancar(4)
    expect((await b.consulta('pedido', { id: 'c1' })).lotes[0].aguardando?.dias).toBe(4)
    // ninguém pagou ainda: a conta do fornecedor não mudou (o pagamento é à parte)
    expect((await b.consulta('contaPessoa', { pessoaId: 'maria' })).saldo).toBe(0)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('pagar depois continua como antes (parte paga, o resto fica na conta) e a última etapa não cria lote de novo', async () => {
    const { b } = await base()
    await comprar(b)
    // já dá para separar antes de pagar
    const lote = await loteDa(b, 'c1')
    await b.comando('separarLote', { id: 's1', loteId: lote.id, quantidadeUsada: 10000, saidas: [{ id: 'p1', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }, { id: 'p2', quantidade: 3800, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } }] })
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido' })
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [{ id: 'pg', forma: 'dinheiro', moeda: 'BOB', valor: bs(30000) }] })
    expect((await b.consulta('contaPessoa', { pessoaId: 'maria' })).saldo).toBe(-bs(20000))
    const pend = (await b.consulta('pedido', { id: 'c1' })).compra.pendencias
    expect(pend.some((x) => x.id === 'faltaPagar')).toBe(true)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'concluido' })
    const est = (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.origem?.tipo === 'compra' && i.origem.id === 'c1')
    expect(est).toHaveLength(1)
    expect((await b.consulta('pedido', { id: 'c1' })).compra.etapa).toBe('concluido')
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('conferência de peso: lança −150 g no lote (com motivo), não muda o comprado e vale depois de pago', async () => {
    const { b } = await base()
    await comprar(b)
    for (const e of ['conferido', 'pago']) await b.comando('avancarTriagem', { compraId: 'c1', para: e, pagamentos: e === 'pago' ? [{ id: 'pg', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
    await expect(b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1-l', pesado: 9850, motivo: '' })).rejects.toThrow(/motivo/)
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1-l', pesado: 9850, motivo: 'balança da loja' })
    const p = await b.consulta('pedido', { id: 'c1' })
    expect(p.gramas).toBe(10000)
    expect(p.compra.linhas[0].quantidade).toBe(10000)
    expect(p.lotes[0].saldo).toBe(9850)
    expect(p.conferencias).toHaveLength(1)
    expect(p.conferencias[0].delta).toBe(-150)
    expect(p.conferencias[0].descricao).toMatch(/Diferença de peso: comprou 10\.000 g · pesou 9\.850 g/)
    // pesar de novo compara com o último peso (não soma duas vezes)
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1-l', pesado: 9900, motivo: 'pesou de novo' })
    expect((await b.consulta('pedido', { id: 'c1' })).lotes[0].saldo).toBe(9900)
    expect(p.fechamento).toMatchObject({ comprado: 10000, aguardando: 9850, diferenca: 150, confere: true })
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('conferido com peso diferente na etapa também vira lançamento (o comprado fica)', async () => {
    const { b } = await base()
    await comprar(b)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido', ajustes: [{ linhaId: 'c1-l', quantidade: 9800 }], motivo: 'Na balança deu 9,8 kg' })
    const p = await b.consulta('pedido', { id: 'c1' })
    expect(p.compra.linhas[0].quantidade).toBe(10000)
    expect(p.lotes[0].saldo).toBe(9800)
    expect(p.conferencias[0].descricao).toMatch(/Na balança deu 9,8 kg/)
  })

  it('cancelar antes de separar tira o bruto da triagem e devolve o dinheiro; depois de separar é recusado', async () => {
    const { b } = await base()
    await comprar(b)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido' })
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [{ id: 'pg', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] })
    await b.comando('cancelarCompra', { compraId: 'c1', motivo: 'desistiu' })
    const lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.id === 'c1')
    expect(lote?.saldo ?? 0).toBe(0)
    expect((await b.consulta('contaPessoa', { pessoaId: 'maria' })).saldo).toBe(0)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])

    // outra compra: separou uma parte → cancelar é recusado com mensagem clara
    await comprar(b, 'c2')
    const l2 = await loteDa(b, 'c2')
    await b.comando('separarLote', { id: 's2', loteId: l2.id, quantidadeUsada: 4000, saidas: [{ id: 'x1', quantidade: 4000, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } }] })
    await expect(b.comando('cancelarCompra', { compraId: 'c2', motivo: 'erro' })).rejects.toThrow(/já foi separada ou vendida/)
    await expect(b.comando('avancarTriagem', { compraId: 'c2', para: 'recusado', motivo: 'ruim' })).rejects.toThrow(/já foi separada ou vendida/)
    // recusar antes de separar também tira o bruto
    await comprar(b, 'c3')
    await b.comando('avancarTriagem', { compraId: 'c3', para: 'recusado', motivo: 'cabelo com química' })
    expect((await loteDa(b, 'c3'))?.saldo ?? 0).toBe(0)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('linha de fechamento: comprado = em pacotes + vendido + perda + diferença ✓ (também com pacote misturado)', async () => {
    const { b } = await base()
    await comprar(b, 'c1', 10000)
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1-l', pesado: 9900, motivo: 'balança' })
    const l1 = await loteDa(b, 'c1')
    // separa 9.900 g: 2 kg + 2 kg + 5,5 kg (perda 400 g)
    await b.comando('separarLote', { id: 's1', loteId: l1.id, quantidadeUsada: 9900, saidas: [
      { id: 'P1', quantidade: 2000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } },
      { id: 'P2', quantidade: 2000, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } },
      { id: 'P3', quantidade: 5500, campos: { estado: 'Bruto', categoria: 'Normal' } },
    ] })
    await b.comando('concluirVenda', { id: 'v1', pessoaId: 'ana', linhas: [{ id: 'a', itemId: 'P1', quantidade: 1000, moeda: 'BOB', total: bs(5000) }], pagamentos: [{ id: 'pa', forma: 'dinheiro', moeda: 'BOB', valor: bs(5000) }] })
    let f = (await b.consulta('pedido', { id: 'c1' })).fechamento!
    expect(f).toMatchObject({ comprado: 10000, pacotes: 3000, aguardando: 5500, vendido: 1000, perda: 400, diferenca: 100, confere: true })

    // segunda compra junta com o P3 (2 kg do P3 + 4 kg da C2) e vira P4
    await comprar(b, 'c2', 4000)
    const l2 = await loteDa(b, 'c2')
    const j = await b.comando('triarLotes', { id: 'u1', ids: ['P3', l2.id] })
    const juntado = j.lotes[0]
    await b.comando('concluirVenda', { id: 'v2', pessoaId: 'ana', linhas: [{ id: 'b', itemId: juntado, quantidade: 950, moeda: 'BOB', total: bs(5000) }], pagamentos: [{ id: 'pb', forma: 'dinheiro', moeda: 'BOB', valor: bs(5000) }] })
    f = (await b.consulta('pedido', { id: 'c1' })).fechamento!
    expect(f.confere).toBe(true)
    expect(f.comprado).toBe(10000)
    const f2 = (await b.consulta('pedido', { id: 'c2' })).fechamento!
    expect(f2.confere).toBe(true)
    expect(f2.comprado).toBe(4000)
    // vendido da v2 dividido entre as duas compras pela proporção do pacote (5,5 kg C1 : 4 kg C2)
    expect(f.vendido + f2.vendido).toBe(1000 + 950)
  })
})
