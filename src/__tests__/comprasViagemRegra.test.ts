// COMPRAS × VIAGENS — a regra única (auditoria de 04/11/2026):
//  1. custo NUNCA fica errado: ligar/tirar/mover/cancelar/desfazer numa viagem com o gasto já no custo dos pacotes
//     refaz o rateio sozinho
//  2. ligar, tirar e mover valem sempre (viagem aberta ou encerrada)
//  5. em massa: prévia diz quantas entram, quantas já estão, quantas estão em outra; sem `mover`, nada muda pela metade
//  6. mover numa ação só · 10. desfazer volta exatamente como estava · 4. viagem parecida avisa; apagar viagem vazia
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function montar() {
  const ctx = await novoBackend()
  const { b, r } = ctx
  await b.comando('salvarPessoa', { id: 'p', nome: 'Paula', papeis: ['funcionario'] })
  await b.comando('salvarPessoa', { id: 'f', nome: 'Forn', papeis: ['fornecedor'] })
  const compra = (id: string, extra: object = {}) => b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', compradorId: 'p', linhas: [{ id: id + 'l', quantidade: 1000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }], ...extra })
  const custo = async (compraId: string) => {
    const lote = (await b.consulta('pedido', { id: compraId })).lotes[0].id
    return (await b.consulta('fichaItem', { id: lote })).item.custoPrincipal
  }
  return { ...ctx, b, r, compra, custo }
}

describe('compras × viagens: regra única', () => {
  it('1: o gasto já no custo é redividido ao ligar, tirar, cancelar e desfazer', async () => {
    const { b, r, compra, custo } = await montar()
    await b.comando('salvarViagem', { id: 'vC', nome: 'Com gasto', viajantes: ['p'], inicio: r.hoje })
    await compra('c1', { viagemId: 'vC' })
    await b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vC', categoria: 'comida', moeda: 'BOB', valor: bs(500) })
    await b.comando('encerrarViagem', { viagemId: 'vC', contado: { BOB: 0 }, incorporar: true })
    expect(await custo('c1')).toBe(bs(1500))

    // esqueceu uma compra: liga depois → as duas dividem o gasto
    await compra('c2')
    const r1 = await b.comando('vincularCompras', { viagemId: 'vC', compraIds: ['c2'] })
    expect(await custo('c1')).toBe(bs(1250))
    expect(await custo('c2')).toBe(bs(1250))

    // desfazer → volta exatamente
    await b.comando('desfazerLigacao', { antes: r1.antes })
    expect(await custo('c1')).toBe(bs(1500))
    expect(await custo('c2')).toBe(bs(1000))

    // compra nova JÁ com a viagem encerrada (vale) → redivide
    await compra('c3', { viagemId: 'vC' })
    expect(await custo('c1')).toBe(bs(1250))
    expect(await custo('c3')).toBe(bs(1250))

    // tirar (viagem encerrada: vale) → volta para a outra
    await b.comando('desvincularCompra', { viagemId: 'vC', compraId: 'c3' })
    expect(await custo('c3')).toBe(bs(1000))
    expect(await custo('c1')).toBe(bs(1500))

    // cancelar uma compra da viagem → o gasto fica com a que sobrou
    await b.comando('vincularCompras', { viagemId: 'vC', compraIds: ['c3'] })
    await b.comando('cancelarCompra', { compraId: 'c3', motivo: 'desistiu' })
    expect(await custo('c1')).toBe(bs(1500))
  })

  it('5 + 6: lote misto → prévia; sem mover recusa tudo; com mover faz em uma ação', async () => {
    const { b, r, compra } = await montar()
    await compra('velha') // comprada um ano antes da viagem
    r.avancar(365)
    await b.comando('salvarViagem', { id: 'vA', nome: 'Oruro', destino: 'Oruro', viajantes: ['p'], inicio: r.hoje })
    await b.comando('salvarViagem', { id: 'vB', nome: 'Cochabamba', destino: 'Cochabamba', viajantes: ['p'], inicio: r.hoje })
    for (const id of ['s1', 's2']) await compra(id)
    await compra('a1', { viagemId: 'vA' })
    await compra('b1', { viagemId: 'vB' })

    const pv = await b.consulta('previaLigarCompras', { viagemId: 'vA', compraIds: ['s1', 's2', 'a1', 'b1', 'velha'] })
    expect(pv).toMatchObject({ ligar: 3, jaNesta: 1, outra: 1, deViagens: [{ codigo: 'VG-0002', n: 1 }] })
    expect(pv.foraDoPeriodo.map((x) => x.codigo)).toEqual(['P-0001'])

    await expect(b.comando('vincularCompras', { viagemId: 'vA', compraIds: ['s1', 'b1'] })).rejects.toThrow(/em VG-0002.*Confirme para mover/)
    expect((await b.consulta('pedido', { id: 's1' })).viagem).toBeUndefined() // nada pela metade

    const feito = await b.comando('vincularCompras', { viagemId: 'vA', compraIds: ['s1', 's2', 'a1', 'b1'], mover: true })
    expect(feito).toMatchObject({ ligadas: ['s1', 's2'], movidas: ['b1'], jaNesta: ['a1'] })
    expect((await b.consulta('pedido', { id: 'b1' })).viagem?.id).toBe('vA')

    // desfazer: b1 volta para vB, s1/s2 sem viagem
    await b.comando('desfazerLigacao', { antes: feito.antes })
    expect((await b.consulta('pedido', { id: 'b1' })).viagem?.id).toBe('vB')
    expect((await b.consulta('pedido', { id: 's1' })).viagem).toBeUndefined()
  })

  it('2: viagem encerrada não prende compra — tirar e mover funcionam', async () => {
    const { b, r, compra } = await montar()
    await b.comando('salvarViagem', { id: 'vA', nome: 'Errada', viajantes: ['p'], inicio: r.hoje })
    await b.comando('salvarViagem', { id: 'vB', nome: 'Certa', viajantes: ['p'], inicio: r.hoje })
    await compra('c', { viagemId: 'vA' })
    await b.comando('encerrarViagem', { viagemId: 'vA', contado: {} })
    await b.comando('vincularCompras', { viagemId: 'vB', compraIds: ['c'], mover: true })
    expect((await b.consulta('pedido', { id: 'c' })).viagem?.id).toBe('vB')
  })

  it('4: viagem parecida em andamento avisa (pode ser de propósito) e viagem vazia pode ser apagada', async () => {
    const { b, r, compra } = await montar()
    await b.comando('salvarViagem', { id: 'v1', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p'], inicio: r.hoje })
    expect(await b.consulta('viagensParecidas', { nome: 'feira de oruro', destino: 'Oruro', inicio: r.hoje })).toHaveLength(1)
    expect(await b.consulta('viagensParecidas', { nome: 'Cochabamba', destino: 'Cochabamba', inicio: r.hoje })).toHaveLength(0)
    await expect(b.comando('salvarViagem', { id: 'v2', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p'], inicio: r.hoje })).rejects.toThrow(/parecida/)
    // escolheu continuar (true): cria
    expect(await b.comando('salvarViagem', { id: 'v2', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p'], inicio: r.hoje, confirmarParecida: true })).toMatchObject({ codigo: 'VG-0002' })

    // apagar: com compra recusa; vazia apaga e some das listas
    await compra('c', { viagemId: 'v1' })
    await expect(b.comando('apagarViagem', { viagemId: 'v1' })).rejects.toThrow(/compra/)
    await b.comando('apagarViagem', { viagemId: 'v2', motivo: 'repetida' })
    expect((await b.consulta('viagensParaFiltro', {})).map((v) => v.id)).toEqual(['v1'])
  })
})
