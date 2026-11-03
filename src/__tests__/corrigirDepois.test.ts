// ERROU DEPOIS: desfazer a triagem (nada vendido), pôr/corrigir o valor depois de separar e vender (o custo segue o
// cabelo) e a etiqueta que ficou velha depois de vender parte (volta para "Sem etiqueta").

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function separado(semValor = false) {
  const ctx = await novoBackend()
  const { b } = ctx
  await b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedora', papeis: ['fornecedor'] })
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', pessoaId: 'forn', semValor: semValor || undefined, linhas: [{ id: 'l', quantidade: 3000, moeda: 'BOB', total: semValor ? 0 : bs(3000), campos: { estado: 'Bruto' } }] })
  const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.compraId === 'c')!
  await b.comando('separarLote', { id: 's', loteId: bruto.id, quantidadeUsada: 3000, saidas: [{ id: 'a', quantidade: 2000, campos: { comprimento: 60 } }, { id: 'b', quantidade: 1000, campos: { comprimento: 40 } }] })
  return { ...ctx, brutoId: bruto.id }
}

describe('corrigir depois', () => {
  it('desfazer a triagem: o peso volta para o bruto, os pacotes somem e dá para separar de novo', async () => {
    const { b, brutoId } = await separado()
    const t = (await b.consulta('triagens', {})).find((x) => x.saidas.some((s) => s.id === 'a'))!
    expect(t.podeDesfazer).toBe(true)
    await expect(b.comando('desfazerTriagem', { triagemId: t.id, motivo: '' })).rejects.toThrow(/por que/)
    await b.comando('desfazerTriagem', { triagemId: t.id, motivo: 'pesei errado' })
    const lista = await b.consulta('estoque', { moduloId: 'cabelo' })
    expect(lista.find((i) => i.id === brutoId)?.saldo).toBe(3000)
    expect(lista.some((i) => i.id === 'a' || i.id === 'b')).toBe(false)
    expect((await b.consulta('triagens', {})).some((x) => x.id === t.id)).toBe(false)
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
    expect((await b.consulta('genealogia', { compraId: 'c' })).totais.confere).toBe(true)
    // separa de novo, agora certo
    await b.comando('separarLote', { id: 's2', loteId: brutoId, quantidadeUsada: 3000, saidas: [{ id: 'a2', quantidade: 2900, campos: { comprimento: 60 } }] })
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === 'a2')?.saldo).toBe(2900)
  })

  it('não desfaz se um pacote que saiu já foi vendido', async () => {
    const { b } = await separado()
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'vl', itemId: 'a', quantidade: 500, moeda: 'BOB', total: bs(900) }], pagamentos: [{ id: 'vp', forma: 'dinheiro', moeda: 'BOB', valor: bs(900) }] })
    const t = (await b.consulta('triagens', {})).find((x) => x.saidas.some((s) => s.id === 'a'))!
    expect(t.podeDesfazer).toBe(false)
    await expect(b.comando('desfazerTriagem', { triagemId: t.id, motivo: 'x' })).rejects.toThrow(/não dá para desfazer/)
  })

  it('pôr o valor depois de separar e vender: pacotes e venda recebem o custo; tira o "Sem valor"', async () => {
    const { b } = await separado(true)
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'vl', itemId: 'a', quantidade: 500, moeda: 'BOB', total: bs(900) }], pagamentos: [{ id: 'vp', forma: 'dinheiro', moeda: 'BOB', valor: bs(900) }] })
    await b.comando('definirValorCompra', { compraId: 'c', linhaId: 'l', total: bs(3000), motivo: 'chegou a nota' })
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    expect(lotes.find((i) => i.id === 'a')?.custoPrincipal).toBe(bs(2000))
    expect(lotes.find((i) => i.id === 'b')?.custoPrincipal).toBe(bs(1000))
    const venda = await b.consulta('venda', { id: 'v' })
    expect(venda.venda.linhas[0].custoPrincipal).toBe(bs(500))
    const c = (await b.consulta('filaTriagem', { incluirEncerradas: true })).find((x) => x.id === 'c')!
    expect(c.totalPrincipal).toBe(bs(3000))
    expect(c.pendencias.map((p) => p.id)).not.toContain('semValor')
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('corrigir o valor depois de pago: a conta do fornecedor acompanha', async () => {
    const { b } = await separado()
    for (const e of ['conferido', 'pago']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(3000) }] : undefined })
    await b.comando('definirValorCompra', { compraId: 'c', linhaId: 'l', total: bs(3500), motivo: 'combinado' })
    const conta = await b.consulta('contaPessoa', { pessoaId: 'forn' })
    expect(conta.saldo).toBe(-bs(500))
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('reservar para uma cliente: fica no pacote, com data; tirar limpa', async () => {
    const { b } = await separado()
    await expect(b.comando('reservarLote', { id: 'a', para: 'Ana', ate: '07/11' })).rejects.toThrow(/Data/)
    await b.comando('reservarLote', { id: 'a', para: 'Ana', ate: '2026-11-07', obs: 'sinal' })
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === 'a')?.reserva).toMatchObject({ para: 'Ana', ate: '2026-11-07', obs: 'sinal' })
    await b.comando('reservarLote', { id: 'a', tirar: true })
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === 'a')?.reserva).toBeUndefined()
  })

  it('pesou diferente na triagem: a diferença fica na compra (pelo pacote, sem a linha)', async () => {
    const { b } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }] })
    const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
    await b.comando('conferirPesoCompra', { compraId: 'c', itemId: bruto.id, pesado: 9600, motivo: 'Pesado na triagem' })
    expect((await b.consulta('estoque', { moduloId: 'cabelo' }))[0].saldo).toBe(9600)
  })

  it('vendeu parte depois de imprimir: a etiqueta fica velha e volta para "Sem etiqueta"', async () => {
    const { b } = await separado()
    await b.comando('marcarEtiquetasImpressas', { ids: ['a'] })
    expect((await b.consulta('estoque', { moduloId: 'cabelo', etiqueta: 'sem' })).some((i) => i.id === 'a')).toBe(false)
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'vl', itemId: 'a', quantidade: 500, moeda: 'BOB', total: bs(900) }], pagamentos: [{ id: 'vp', forma: 'dinheiro', moeda: 'BOB', valor: bs(900) }] })
    const a = (await b.consulta('estoque', { moduloId: 'cabelo', etiqueta: 'sem' })).find((i) => i.id === 'a')
    expect(a?.etiquetaVelha).toBe(true)
    await b.comando('marcarEtiquetasImpressas', { ids: ['a'] })
    expect((await b.consulta('estoque', { moduloId: 'cabelo', etiqueta: 'sem' })).some((i) => i.id === 'a')).toBe(false)
  })
})
