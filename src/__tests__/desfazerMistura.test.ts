// DESFAZER A MISTURA (tirarDaMistura): o contrário de unificar. Tudo ou só alguns pacotes de origem voltam com as
// gramas e o custo exatos que puseram; só enquanto o misturado está intacto; repetir não faz de novo; diagnóstico limpo.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function base() {
  const { b } = await novoBackend()
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(1_000_000), descricao: 'ini' } as any)
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora Ficticia', papeis: ['fornecedor'] } as any)
  const repos = (b as any).repos
  const comprar = async (id: string, g: number, valor: number, campos: Record<string, unknown> = {}) => {
    await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(valor), campos: { estado: 'Bruto', ...campos } }] } as any)
    return (await repos.transacoes.obter(id)).linhas[0].itemId as string
  }
  const item = (id: string) => repos.itens.obter(id)
  const custo = async (id: string) => { const i = await item(id); return i.quantidadeInicial ? Math.round((i.custoPrincipal * i.saldo) / i.quantidadeInicial) : 0 }
  const limpo = async () => expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  return { b, repos, comprar, item, custo, limpo }
}

describe('desfazer mistura (tirarDaMistura)', () => {
  it('desfazer tudo: as origens voltam com o peso e o custo; o misturado some', async () => {
    const { b, comprar, item, custo, limpo } = await base()
    const A = await comprar('c1', 1200, 1200)
    const B = await comprar('c2', 3300, 6600)
    const cA = await custo(A)
    const cB = await custo(B)
    await b.comando('unificarLotes', { id: 'u1', ids: [A, B] } as any)
    expect((await item('u1')).saldo).toBe(4500)
    const m = await b.consulta('mistura', { loteId: 'u1' })
    expect(m.podeDesfazer).toBe(true)
    expect(m.fontes.map((f) => [f.id, f.g, f.custo])).toEqual([[A, 1200, cA], [B, 3300, cB]])
    const r = await b.comando('tirarDaMistura', { id: 'd1', loteId: 'u1', tirar: [A, B] })
    expect(r).toMatchObject({ desfeita: true, restante: 0 })
    expect((await item(A)).saldo).toBe(1200)
    expect((await item(B)).saldo).toBe(3300)
    expect(await custo(A)).toBe(cA)
    expect(await custo(B)).toBe(cB)
    expect(await item('u1')).toMatchObject({ saldo: 0, ativo: false })
    expect((await b.consulta('triagem', {})).lotes.some((l) => l.id === 'u1')).toBe(false)
    await limpo()
  })

  it('tirar só um: volta com as gramas e o custo dele; o misturado fica com o resto (gramas e custo somam igual)', async () => {
    const { b, comprar, item, custo, limpo } = await base()
    const A = await comprar('c1', 1200, 1000, { cor: 'Preto' })
    const B = await comprar('c2', 3300, 3000, { cor: 'Preto' })
    const C = await comprar('c3', 2000, 1777, { cor: 'Castanho' })
    const [cA, cB, cC] = [await custo(A), await custo(B), await custo(C)]
    await b.comando('unificarLotes', { id: 'u1', ids: [A, B, C] } as any)
    const custoTotal = await custo('u1')
    expect(custoTotal).toBe(cA + cB + cC)
    const r = await b.comando('tirarDaMistura', { id: 'd1', loteId: 'u1', tirar: [C] })
    expect(r).toMatchObject({ desfeita: false, restante: 4500, devolvidos: [{ id: C, g: 2000 }] })
    expect((await item(C)).saldo).toBe(2000)
    expect(await custo(C)).toBe(cC)
    const u = await item('u1')
    expect(u).toMatchObject({ saldo: 4500, quantidadeInicial: 4500, ativo: true })
    expect(u.origem.ids).toEqual([A, B])
    expect(u.origem.compraIds).toEqual(['c1', 'c2'])
    // a cor era "Misturado" (Preto + Castanho); sem o Castanho, volta a ser Preto
    expect(u.campos.cor).toBe('Preto')
    expect(await custo('u1')).toBe(cA + cB)
    expect((await item(A)).saldo + (await item(B)).saldo).toBe(0)
    // conservação: as gramas de tudo continuam as mesmas
    expect(u.saldo + (await item(C)).saldo).toBe(6500)
    // a mistura de 2 que sobrou ainda pode ser desfeita (tirar 1 de 2 = desfazer tudo)
    const m = await b.consulta('mistura', { loteId: 'u1' })
    expect(m.podeDesfazer).toBe(true)
    expect(m.fontes.map((f) => f.id)).toEqual([A, B])
    const r2 = await b.comando('tirarDaMistura', { id: 'd2', loteId: 'u1', tirar: [B] })
    expect(r2).toMatchObject({ desfeita: true })
    expect((await item(A)).saldo).toBe(1200)
    expect((await item(B)).saldo).toBe(3300)
    // C já tinha voltado antes: fica com os 2 kg dele (não é mexido de novo)
    expect((await item(C)).saldo).toBe(2000)
    expect([await custo(A), await custo(B), await custo(C)]).toEqual([cA, cB, cC])
    await limpo()
    const log = (await b.consulta('logDetalhado', { acao: 'tirarDaMistura' })).linhas
    expect(log.length).toBe(2)
  })

  it('recusa quando o misturado foi mexido (ajuste, separação) e quando não é mistura', async () => {
    const { b, comprar, item, limpo } = await base()
    const A = await comprar('c1', 1000, 1000)
    const B = await comprar('c2', 2000, 2000)
    await b.comando('unificarLotes', { id: 'u1', ids: [A, B] } as any)
    await b.comando('ajustarEstoque', { itemId: 'u1', novoSaldo: 2900, motivo: 'perda', descricao: 'pontas' } as any)
    const m = await b.consulta('mistura', { loteId: 'u1' })
    expect(m.podeDesfazer).toBe(false)
    expect(m.porque).toMatch(/Já mexeram/)
    expect((await b.consulta('triagem', {})).lotes.find((l) => l.id === 'u1')?.mistura).toMatchObject({ pode: false })
    await expect(b.comando('tirarDaMistura', { id: 'd1', loteId: 'u1', tirar: [A] })).rejects.toThrow(/Já mexeram/)
    expect((await item(A)).saldo).toBe(0)
    expect((await item('u1')).saldo).toBe(2900)
    // pacote que não é mistura
    const C = await comprar('c3', 500, 500)
    await expect(b.comando('tirarDaMistura', { id: 'd2', loteId: C, tirar: [C] })).rejects.toThrow(/não é uma mistura/)
    // origem que não está nesta mistura
    const D = await comprar('c4', 700, 700)
    const E = await comprar('c5', 800, 800)
    await b.comando('unificarLotes', { id: 'u2', ids: [D, E] } as any)
    await expect(b.comando('tirarDaMistura', { id: 'd3', loteId: 'u2', tirar: [C] })).rejects.toThrow(/não está nesta mistura/)
    // separado depois de juntar: também é "mexido"
    await b.comando('triarLotes', { id: 't1', ids: ['u2'], quantidadeUsada: 1500, saidas: [{ id: 'p1', quantidade: 1400, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] } as any)
    await expect(b.comando('tirarDaMistura', { id: 'd4', loteId: 'u2', tirar: [D] })).rejects.toThrow(/Já mexeram/)
    await limpo()
  })

  it('repetir com o mesmo id não faz de novo; só o administrador', async () => {
    const { b, comprar, item, limpo } = await base()
    const A = await comprar('c1', 1000, 1000)
    const B = await comprar('c2', 2000, 2000)
    const C = await comprar('c3', 3000, 3000)
    await b.comando('unificarLotes', { id: 'u1', ids: [A, B, C] } as any)
    await b.comando('tirarDaMistura', { id: 'd1', loteId: 'u1', tirar: [A] })
    await b.comando('tirarDaMistura', { id: 'd1', loteId: 'u1', tirar: [A] })
    expect((await item(A)).saldo).toBe(1000)
    expect((await item('u1')).saldo).toBe(5000)
    expect((await b.consulta('logDetalhado', { acao: 'tirarDaMistura' })).linhas.length).toBe(1)
    // o mesmo id depois de desfazer tudo também não repete
    await b.comando('tirarDaMistura', { id: 'd2', loteId: 'u1', tirar: [B, C] })
    const r = await b.comando('tirarDaMistura', { id: 'd2', loteId: 'u1', tirar: [B, C] })
    expect(r).toMatchObject({ desfeita: true })
    expect([(await item(A)).saldo, (await item(B)).saldo, (await item(C)).saldo]).toEqual([1000, 2000, 3000])
    await limpo()
  })
})
