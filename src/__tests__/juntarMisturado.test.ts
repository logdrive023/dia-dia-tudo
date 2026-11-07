// JUNTAR COM UM PACOTE JÁ MISTURADO: nunca mistura dentro de mistura. A mistura antiga é desfeita e as partes entram
// uma a uma ("Misturado de 3"); o peso, o custo e as compras batem; o histórico registra as duas coisas.
// Mistura já mexida (ajuste, venda) entra como um pacote só.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function cenario() {
  const { b } = await novoBackend()
  const ids: string[] = []
  for (const [k, g] of [['a', 1200], ['b', 900], ['c', 2500]] as const) {
    await b.comando('criarCompra', { id: 'c-' + k, moduloId: 'cabelo', linhas: [{ id: 'l-' + k, quantidade: g, moeda: 'BOB', total: bs(g * 5), campos: { estado: 'Bruto', cor: k === 'c' ? 'Castanho' : 'Preto' } }] } as any)
    ids.push((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i: any) => i.origem?.id === 'c-' + k)!.id)
  }
  const [A, B, C] = ids
  await b.comando('unificarLotes', { id: 'mix', ids: [A, B] } as any)
  return { b, A, B, C }
}
const item = (b: any, id: string) => b.repos.itens.obter(id)

describe('juntar com pacote já misturado', () => {
  it('Só juntar: desfaz a mistura antiga e junta as partes (Misturado de 3), com histórico', async () => {
    const { b, A, B, C } = await cenario()
    const r: any = await b.comando('unificarLotes', { id: 'novo', ids: [C, 'mix'] } as any)
    expect(r.misturasDesfeitas).toHaveLength(1)
    const novo = await item(b, 'novo')
    expect(novo.saldo).toBe(4600)
    expect([...novo.origem.ids].sort()).toEqual([A, B, C].sort()) // as partes, não a mistura
    expect(novo.origem.compraIds.sort()).toEqual(['c-a', 'c-b', 'c-c'])
    expect(novo.custoPrincipal).toBe(bs(4600 * 5) * 1) // custo inteiro preservado (na moeda principal)
    const antiga = await item(b, 'mix')
    expect(antiga.ativo).toBe(false)
    expect(antiga.saldo).toBe(0)
    for (const id of [A, B, C]) expect((await item(b, id)).saldo).toBe(0)
    const aud = ((await b.consulta('auditoria', {} as any)) as any)
    const linhas = (aud.linhas ?? aud) as any[]
    expect(linhas.some((x) => x.acao === 'desfazerTriagem' && /desfeita para juntar de novo/.test(x.resumo))).toBe(true)
    expect(linhas.some((x) => x.acao === 'unificarLotes' && /mistura desfeita/.test(x.resumo))).toBe(true)
  })

  it('Juntar e separar: a mistura antiga é desfeita, o juntado é intermediário e as partes saem', async () => {
    const { b, A, B, C } = await cenario()
    const r: any = await b.comando('triarLotes', { id: 't1', ids: ['mix', C], saidas: [{ id: 'p60', quantidade: 3000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }, { id: 'p50', quantidade: 1500, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } }] } as any)
    expect(r.misturasDesfeitas).toEqual([(await item(b, 'mix')).codigo])
    const juntado = await item(b, 't1-u')
    expect([...juntado.origem.ids].sort()).toEqual([A, B, C].sort())
    expect((await item(b, 'p60')).saldo + (await item(b, 'p50')).saldo).toBe(4500) // 100 g de perda
    expect((await b.consulta('diagnostico', {}) as any).ok).toBe(true) // as contas do estoque batem
  })

  it('mistura já mexida (ajuste): entra como um pacote só', async () => {
    const { b, C } = await cenario()
    await b.comando('ajustarEstoque', { itemId: 'mix', novoSaldo: 2000, motivo: 'perda', descricao: 'pontas' } as any)
    const r: any = await b.comando('unificarLotes', { id: 'novo', ids: [C, 'mix'] } as any)
    expect(r.misturasDesfeitas).toEqual([])
    expect([...(await item(b, 'novo')).origem.ids].sort()).toEqual([C, 'mix'].sort())
  })
})
