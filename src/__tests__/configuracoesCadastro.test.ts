// CONFIGURAÇÕES: forma de pagamento desligada some das escolhas (e dinheiro não desliga), a regra da senha nova
// e o cabeçalho do relatório arrumado (NIT só números, nomes com maiúscula).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { formasEmUso } from '../core/domain/formas'
import { faltaNaSenha } from '../core/domain/senha'
import { nomeProprio } from '../core/domain/textoFormatado'
import { bs, novoBackend } from './ajuda'

describe('formas de pagamento ligadas e desligadas', () => {
  it('desligar o Pix tira ele das escolhas; dinheiro não desliga', async () => {
    const { b } = await novoBackend()
    const cfg = async () => (await b.consulta('configuracoes', {})).config
    const formas = (await cfg()).formas
    await b.comando('salvarConfig', { formas: formas.map((f: any) => (f.id === 'pix' ? { ...f, desligada: true } : f)), antes: { formas } } as never)
    const depois = (await cfg()).formas
    expect(depois.find((f: any) => f.id === 'pix')!.desligada).toBe(true)
    expect(formasEmUso(depois, 'BRL').map((f) => f.id)).not.toContain('pix')
    expect(formasEmUso(depois, 'BRL').map((f) => f.id)).toContain('dinheiro')
    await expect(b.comando('salvarConfig', { formas: depois.map((f: any) => (f.id === 'dinheiro' ? { ...f, desligada: true } : f)), antes: { formas: depois } } as never)).rejects.toThrow(/Dinheiro/)
  })
})

describe('senha nova', () => {
  it('pede 8 caracteres, uma letra e um número ou caractere especial', async () => {
    expect(faltaNaSenha('1234').map((r) => r.id)).toEqual(['tamanho', 'letra'])
    expect(faltaNaSenha('abcdefgh').map((r) => r.id)).toEqual(['numeroOuEspecial'])
    expect(faltaNaSenha('abcdefg!')).toEqual([])
    expect(faltaNaSenha('senha123')).toEqual([])
    const { b } = await novoBackend()
    await expect(b.comando('salvarUsuario', { id: 'u1', login: 'ana', nome: 'Ana', perfil: 'funcionario', senha: 'abc' } as any)).rejects.toThrow(/Senha fraca/)
    await b.comando('salvarUsuario', { id: 'u1', login: 'ana', nome: 'Ana', perfil: 'funcionario', senha: 'ana!2026' } as any)
  })
})

describe('cabeçalho do relatório formatado', () => {
  it('NIT só com números e nomes com maiúscula, ao salvar e no relatório', async () => {
    expect(nomeProprio('  maria  DA silva ')).toBe('Maria da Silva')
    expect(nomeProprio('juan pérez y cía S.R.L.')).toBe('Juan Pérez y Cía S.R.L.')
    const { b } = await novoBackend()
    await b.comando('salvarConfig', { fiscal: { nit: '123.456-7019', contador: 'lic. ana  quispe', razaoSocial: '  Cabelos   & Salão ' } } as never)
    const f = (await b.consulta('configuracoes', {})).config.fiscal
    expect(f.nit).toBe('1234567019')
    expect(f.contador).toBe('Lic. Ana Quispe')
    expect(f.razaoSocial).toBe('Cabelos & Salão')
    const rel = await b.consulta('relatorioContabil', { de: '2026-11-01', ate: '2026-11-30' })
    expect(rel.empresa.nit).toBe('1234567019')
  })
})

describe('o que a funcionária faz (o admin decide)', () => {
  it('agenda: viagem só aparece quando o admin libera; venda bloqueada é recusada no servidor', async () => {
    const { b, sessao } = await novoBackend('2026-11-01')
    await b.comando('salvarPessoa', { id: 'p-s', nome: 'Sofia', papeis: ['funcionario'] } as any)
    await b.comando('salvarUsuario', { id: 'u-s', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', pessoaId: 'p-s', senha: 'senha123' } as any)
    await b.comando('salvarViagem', { id: 'v1', nome: 'Feira', destino: 'Oruro', viajantes: ['p-s'], inicio: '2026-11-02' } as any)
    const admin = { ...sessao }
    const comoSofia = async () => Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    const comoAdmin = () => Object.assign(sessao, admin)
    const cal = async () => (await b.consulta('calendario', { de: '2026-11-01', ate: '2026-11-30' })).map((i: any) => i.id)
    await comoSofia()
    expect(await cal()).not.toContain('v1')
    comoAdmin()
    const c = (await b.consulta('configuracoes', {})).config
    expect(c.funcionariaIdioma).toBe('es')
    expect(c.funcionariaTelas).toEqual([])
    await b.comando('salvarConfig', { funcionariaAgenda: [...c.funcionariaAgenda, 'viagem'], antes: { funcionariaAgenda: c.funcionariaAgenda } } as never)
    await comoSofia()
    expect(await cal()).toContain('v1')
  })
})

describe('vendas da funcionária: lista, vendedora e auditoria', () => {
  it('ela vê só as vendas dela (sem lucro), vira a vendedora sozinha, e tudo o que faz (e o que tentou) entra na auditoria', async () => {
    const { b, sessao } = await novoBackend('2026-11-05')
    const admin = { ...sessao }
    await b.comando('salvarPessoa', { id: 'p-l', nome: 'Lúcia', papeis: ['funcionario'] } as any)
    await b.comando('salvarUsuario', { id: 'u-l', login: 'lucia', nome: 'Lúcia', perfil: 'funcionario', pessoaId: 'p-l', senha: 'Lucia2026!' } as any)
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
    const comprar = async (id: string) => {
      await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: 100, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'p' + id, forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] } as any)
      return (await (b as any).repos.transacoes.obter(id)).linhas[0].itemId as string
    }
    const A = await comprar('ca')
    const B = await comprar('cb')
    const vender = (id: string, item: string) => b.comando('concluirVenda', { id, pessoaId: 'cli', linhas: [{ id: id + 'l', itemId: item, quantidade: 100, moeda: 'BOB', total: bs(500) }], pagamentos: [{ id: 'p' + id, forma: 'dinheiro', moeda: 'BOB', valor: bs(500) }] } as any)
    await vender('v-admin', A) // venda do admin (não é dela)
    Object.assign(sessao, await b.entrar('lucia', 'Lucia2026!'))
    await vender('v-lucia', B)
    await expect(b.comando('lancarCaixa', { id: 'x', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: 100, descricao: 'x' } as any)).rejects.toThrow(/permissão/)
    const minhas = (await b.consulta('vendas', {})) as any[]
    expect(minhas.map((v) => v.id)).toEqual(['v-lucia'])
    expect(minhas[0].lucroPrincipal).toBeUndefined()
    expect(minhas[0].vendedora).toBe('Lúcia')
    Object.assign(sessao, admin)
    const venda = (await b.consulta('vendas', {}) as any[]).find((v) => v.id === 'v-lucia')
    expect(venda.profissionalId).toBe('p-l')
    expect(venda.feitoPor).toBe('Lúcia')
    // auditoria: a venda dela e a tentativa recusada, no nome dela
    const aud = (await b.consulta('auditoria', {} as any)) as any
    const linhas = (aud.linhas ?? aud) as any[]
    expect(linhas.some((x) => x.acao === 'concluirVenda' && x.usuarioNome === 'Lúcia')).toBe(true)
    expect(linhas.some((x) => x.acao === 'recusado' && x.usuarioNome === 'Lúcia')).toBe(true)
  })
})
