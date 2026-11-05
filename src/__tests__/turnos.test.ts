// FECHAMENTO DE TURNO (conferência cega): a funcionária conta o dinheiro sem ver o esperado; a diferença fica no nome
// dela e só o administrador vê. QR não entra (não está na mão); o turno seguinte começa onde o anterior terminou.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function cenario() {
  const { b, sessao, r } = await novoBackend('2026-11-05')
  const admin = { ...sessao }
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000), descricao: 'Troco' } as any)
  await b.comando('salvarPessoa', { id: 'p-l', nome: 'Lúcia', papeis: ['funcionario'] } as any)
  await b.comando('salvarUsuario', { id: 'u-l', login: 'lucia', nome: 'Lúcia', perfil: 'funcionario', pessoaId: 'p-l', senha: 'Lucia2026!' } as any)
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
  const lotes: string[] = []
  for (const k of [1, 2, 3, 4]) {
    await b.comando('criarCompra', { id: 'c' + k, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'c' + k + 'l', quantidade: 100, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc' + k, forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] } as any)
    lotes.push((await (b as any).repos.transacoes.obter('c' + k)).linhas[0].itemId)
  }
  const vender = (id: string, lote: string, valor: number, forma = 'dinheiro', moeda = 'BOB') =>
    b.comando('concluirVenda', { id, pessoaId: 'cli', linhas: [{ id: id + 'l', itemId: lote, quantidade: 100, moeda: 'BOB', total: bs(valor) }], pagamentos: [{ id: 'p' + id, forma, moeda, valor: moeda === 'USD' ? valor * 100 : bs(valor) }] } as any)
  const comoLucia = async () => Object.assign(sessao, await b.entrar('lucia', 'Lucia2026!'))
  const comoAdmin = () => Object.assign(sessao, admin)
  return { b, r, lotes, vender, comoLucia, comoAdmin }
}

describe('fechamento de turno com conferência cega', () => {
  it('a diferença fica no nome dela; ela não vê o esperado; QR não entra', async () => {
    const { b, r, lotes, vender, comoLucia, comoAdmin } = await cenario()
    r.avancar(0)
    await comoLucia()
    await vender('v1', lotes[0], 300)
    await vender('v2', lotes[1], 150)
    await vender('v3', lotes[2], 500, 'qr') // QR: não está na mão
    const atual = (await b.consulta('turnoAtual', {})) as any
    expect(atual.pendente).toBe(true)
    expect(atual.lancamentos).toBe(2)
    expect(JSON.stringify(atual)).not.toContain('45000') // nada do valor esperado
    // contou Bs 430 (faltam 20)
    const r1 = await b.comando('fecharTurno', { id: 't1', contado: { BOB: bs(430) } } as any)
    expect(r1).toEqual({ id: 't1' }) // cego: nada de esperado/diferença na resposta
    const meus = (await b.consulta('turnos', {})) as any[]
    expect(meus).toHaveLength(1)
    expect(meus[0].esperado).toBeUndefined()
    expect(meus[0].diferenca).toBeUndefined()
    expect(((await b.consulta('turnoAtual', {})) as any).pendente).toBe(false)
    // o administrador vê tudo, no nome dela, e na auditoria
    comoAdmin()
    const t = ((await b.consulta('turnos', {})) as any[])[0]
    expect(t.nome).toBe('Lúcia')
    expect(t.esperado.BOB).toBe(bs(450))
    expect(t.diferenca.BOB).toBe(-bs(20))
    expect(t.situacao).toBe('falta')
    const aud = (await b.consulta('auditoria', {} as any)) as any
    expect(((aud.linhas ?? aud) as any[]).some((x) => x.acao === 'fecharTurno' && x.usuarioNome === 'Lúcia' && /diferença BOB -20/.test(x.resumo))).toBe(true)
  })

  it('o turno seguinte começa onde o anterior terminou; confere quando bate; outra moeda separada', async () => {
    const { b, lotes, vender, comoLucia, comoAdmin } = await cenario()
    await comoLucia()
    await vender('v1', lotes[0], 300)
    await b.comando('fecharTurno', { id: 't1', contado: { BOB: bs(300) } } as any)
    await vender('v2', lotes[1], 20, 'dinheiro', 'USD')
    await b.comando('fecharTurno', { id: 't2', contado: { USD: 2000 } } as any)
    comoAdmin()
    const [t2, t1] = (await b.consulta('turnos', {})) as any[]
    expect(t1.situacao).toBe('confere')
    expect(t2.esperado).toEqual({ USD: 2000 })
    expect(t2.situacao).toBe('confere')
  })
})
