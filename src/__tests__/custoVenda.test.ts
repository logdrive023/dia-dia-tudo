// VENDA ABAIXO DO CUSTO: o caixa pergunta antes (custoDaVenda) e, se passar, fica registrado na auditoria.
// A funcionária recebe só o "abaixo: sim/não" — nunca o valor do custo.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('venda abaixo do custo', () => {
  it('detecta, esconde o custo da funcionária e registra na auditoria', async () => {
    const { b, sessao } = await novoBackend('2026-11-05')
    const admin = { ...sessao }
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    await b.comando('salvarPessoa', { id: 'p-l', nome: 'Lúcia', papeis: ['funcionario'] } as any)
    await b.comando('salvarUsuario', { id: 'u-l', login: 'lucia', nome: 'Lúcia', perfil: 'funcionario', pessoaId: 'p-l', senha: 'Lucia2026!' } as any)
    // 1.000 g por Bs 1.000 → custo Bs 1 por grama
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'cl', quantidade: 1000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    const lote = (await (b as any).repos.transacoes.obter('c')).linhas[0].itemId
    const barato = { itemId: lote, quantidade: 200, total: bs(150), moeda: 'BOB' } // custou Bs 200
    const ok = { itemId: lote, quantidade: 200, total: bs(400), moeda: 'BOB' }
    const r = (await b.consulta('custoDaVenda', { linhas: [barato] } as any)) as any[]
    expect(r[0].abaixo).toBe(true)
    expect(r[0].custoPrincipal).toBe(bs(200))
    expect(((await b.consulta('custoDaVenda', { linhas: [ok] } as any)) as any[])[0].abaixo).toBe(false)
    // funcionária: só o sim/não
    Object.assign(sessao, await b.entrar('lucia', 'Lucia2026!'))
    const f = ((await b.consulta('custoDaVenda', { linhas: [barato] } as any)) as any[])[0]
    expect(f.abaixo).toBe(true)
    expect(f.custoPrincipal).toBeUndefined()
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'vl', ...barato }], pagamentos: [{ id: 'pv', forma: 'dinheiro', moeda: 'BOB', valor: bs(150) }] } as any)
    Object.assign(sessao, admin)
    const aud = (await b.consulta('auditoria', {} as any)) as any
    const reg = ((aud.linhas ?? aud) as any[]).find((x) => x.acao === 'vendaAbaixoDoCusto')
    expect(reg?.usuarioNome).toBe('Lúcia')
    expect(reg?.resumo).toMatch(/vendeu Bs 150,00 · custou Bs 200,00/)
  })
})
