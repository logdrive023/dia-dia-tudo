// LER O CÓDIGO DE UM BRUTO QUE JÁ VIROU OUTRA COISA: mesmo depois de JUNTAR com outro e SEPARAR de novo, o caixa
// mostra os pacotes de agora (com o pacote do meio em "passou por"), e o que ainda tem peso vem primeiro.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function cenario() {
  const { b } = await novoBackend('2026-11-05')
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
  const bruto = async (id: string, g: number) => {
    await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(g), campos: { estado: 'Bruto', cor: 'Castanho' } }], pagarNoAto: [{ id: 'p' + id, forma: 'qr', moeda: 'BOB', valor: bs(g) }] } as any)
    return (await (b as any).repos.transacoes.obter(id)).linhas[0].itemId as string
  }
  const A = await bruto('ca', 1000)
  const B = await bruto('cb', 500)
  await b.comando('unificarLotes', { id: 'J', ids: [A, B], motivo: 'mesma cor' } as any)
  const codigo = async (id: string) => (await (b as any).repos.itens.obter(id)).codigo as string
  return { b, A, B, codigo }
}

describe('pacotes finais de um bruto juntado e separado', () => {
  it('lê o bruto A: mostra J1 e J2 (passou por J), não o J zerado', async () => {
    const { b, A, codigo } = await cenario()
    await b.comando('separarLote', { id: 's', loteId: 'J', quantidadeUsada: 1500, saidas: [
      { id: 'J1', quantidade: 900, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } },
      { id: 'J2', quantidade: 600, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } },
    ] } as any)
    const r = (await b.consulta('lerCodigoPacote', { texto: await codigo(A) })) as any
    expect(r.situacao).toBe('separado')
    expect(r.viraram.map((x: any) => x.id).sort()).toEqual(['J1', 'J2'])
    expect(r.viraram.every((x: any) => x.via === undefined || x.via === r.viraram[0].via)).toBe(true)
    expect(r.viraram[0].via).toBe(await codigo('J'))
    // vende tudo do J1: ele continua na lista (sem saldo), mas o J2 (com peso) vem primeiro
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', linhas: [{ id: 'vl', itemId: 'J1', quantidade: 900, moeda: 'BOB', total: bs(900) }], pagamentos: [{ id: 'pv', forma: 'qr', moeda: 'BOB', valor: bs(900) }] } as any)
    const r2 = (await b.consulta('lerCodigoPacote', { texto: await codigo(A) })) as any
    expect(r2.viraram[0].id).toBe('J2')
  })

  it('separação PARCIAL do juntado: mostra o que sobrou do J e os pacotes que saíram dele', async () => {
    const { b, B, codigo } = await cenario()
    await b.comando('separarLote', { id: 's', loteId: 'J', quantidadeUsada: 700, saidas: [{ id: 'J1', quantidade: 700, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] } as any)
    const r = (await b.consulta('lerCodigoPacote', { texto: await codigo(B) })) as any
    expect(r.viraram.map((x: any) => x.id).sort()).toEqual(['J', 'J1'])
    expect(r.viraram.find((x: any) => x.id === 'J').saldo).toBe(800)
  })
})
