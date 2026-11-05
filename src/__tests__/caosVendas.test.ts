// Regressões da OPERAÇÃO CAOS (vendas, caixa, sessão, API): uma prova pequena e rápida por bug corrigido.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'
import { criarBackend } from '../app/criarBackend'
import { BackendApi } from '../adapters/api/backendApi'
import { criarFetchSimulado } from '../adapters/api/apiSimulada'
import type { BackendNoAparelho } from '../adapters/noAparelho'

const repos = (b: BackendNoAparelho) => (b as any).repos
const pag = (id: string, valor: number, moeda = 'BOB', extra: Record<string, unknown> = {}) => ({ id, forma: 'dinheiro', moeda, valor, ...extra })
const linha = (itemId: string, total: number, quantidade = 1) => [{ id: 'l', itemId, quantidade, moeda: 'BOB', total }]
const msg = (p: Promise<unknown>) => p.then(() => '', (e: Error) => e.message)

async function comItem(saldo = 10) {
  const x = await novoBackend()
  await x.b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: saldo } as any)
  return x
}

async function comUsuarios(b: BackendNoAparelho) {
  await b.comando('salvarUsuario', { id: 'u-f', login: 'fulana', nome: 'Fu', perfil: 'funcionario', senha: 'senha123' } as any)
  await b.comando('salvarUsuario', { id: 'u-g', login: 'gema', nome: 'Ge', perfil: 'funcionario', senha: 'senha123' } as any)
  await b.comando('salvarUsuario', { id: 'u-a', login: 'adma', nome: 'Ad', perfil: 'admin', senha: 'senha123' } as any)
}

function api() {
  const { backend: servidor } = criarBackend({ tipo: 'memory' })
  const ctl = { perder: 0 }
  const real = criarFetchSimulado(servidor)
  const f = (async (u: any, init?: any) => {
    const r = await real(u, init)
    if (String(u).endsWith('/v1/r') && ctl.perder > 0) {
      ctl.perder--
      throw new TypeError('resposta perdida')
    }
    return r
  }) as typeof fetch
  return { api: new BackendApi({ url: 'https://api.teste', fetch: f, tentativas: 3 }), servidor: servidor as BackendNoAparelho, ctl }
}

describe('CAOS-B-01 cotação digitada', () => {
  it('cotação absurda é recusada; perto da do sistema passa e fecha', async () => {
    const { b } = await comItem()
    const absurda = { moeda: 'USD', valor: '1000000', sentido: 'basePorMoeda', contra: 'BOB' }
    expect(await msg(b.comando('concluirVenda', { id: 'v1', linhas: linha('x', bs(14000)), pagamentos: [pag('p', 1, 'USD', { cotacao: absurda })] } as any))).toMatch(/longe da do sistema/)
    expect(await repos(b).transacoes.obter('v1')).toBeUndefined()
    // sistema: 1 USD = 6,912 BOB; digitada 6,96 (legítima) → US$ 14,37 = Bs 100,02 (arredondamento aceito)
    const ok = { moeda: 'USD', valor: '6,96', sentido: 'basePorMoeda', contra: 'BOB' }
    await b.comando('concluirVenda', { id: 'v2', linhas: linha('x', bs(100)), pagamentos: [pag('p2', 1437, 'USD', { cotacao: ok })] } as any)
    expect((await repos(b).transacoes.obter('v2')).etapa).toBe('concluido')
  })
})

describe('CAOS-B-02/B-03 idempotência por pedido na API', () => {
  it('duas correções e dois autosaves do mesmo registro valem; resposta perdida não duplica', async () => {
    const { api: a, servidor, ctl } = api()
    await a.comando('salvarConfig', { moedaPrincipal: 'BOB' } as any)
    await a.comando('salvarCotacao', { id: 'cot-bob', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' } as any)
    await a.comando('salvarItem', { id: 'g', moduloId: 'produtos', tipoItem: 'peca', nome: 'G', saldoInicial: 500 } as any)
    ctl.perder = 1
    await a.comando('concluirVenda', { id: 'v1', linhas: linha('g', bs(300), 300), pagamentos: [pag('p', bs(300))] } as any)
    expect((await repos(servidor).movCaixa.listar()).filter((m: any) => m.origemId === 'v1')).toHaveLength(1)
    const corr = (q: number) => ({ id: 'v1', linhas: [{ linhaId: 'l', quantidade: q, total: bs(q) }], motivo: 'balança', diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    await a.comando('corrigirVenda', corr(250) as any)
    await a.comando('corrigirVenda', corr(200) as any)
    expect((await repos(servidor).transacoes.obter('v1')).totalPrincipal).toBe(bs(200))
    await a.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'a', itemId: 'g', quantidade: 1 }] } as any)
    await a.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'a', itemId: 'g', quantidade: 1 }, { id: 'b', itemId: 'g', quantidade: 2 }] } as any)
    expect((await repos(servidor).config.obter('vendaAberta:va')).valor.linhas).toHaveLength(2)
  })
})

describe('CAOS-B-04 venda sem pagamento num dia encerrado', () => {
  it('fiado com o dia encerrado é recusado (como a venda paga)', async () => {
    const { b, r } = await comItem()
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cli', papeis: ['cliente'] } as any)
    await b.comando('encerrarDia', { data: r.hoje, contado: {} } as any)
    expect(await msg(b.comando('concluirVenda', { id: 'vf', pessoaId: 'cli', linhas: linha('x', bs(80)), pagamentos: [] } as any))).toMatch(/encerrado/)
    expect(await repos(b).transacoes.obter('vf')).toBeUndefined()
    expect((await repos(b).itens.obter('x')).saldo).toBe(10)
  })
})

describe('CAOS-B-05/C-03/C-04 sessão copiada na fila', () => {
  it('sair logo depois de disparar: a venda fica no nome de quem disparou; comando novo depois de sair é recusado', async () => {
    const { b } = await comItem()
    const p = b.comando('concluirVenda', { id: 'v', linhas: linha('x', bs(10)), pagamentos: [pag('p', bs(10))] } as any)
    const saiu = b.sair()
    expect(await msg(b.comando('lancarCaixa', { id: 'lc', tipo: 'entrada', moeda: 'BOB', forma: 'dinheiro', valor: 1, descricao: 'x' } as any))).toMatch(/permissão/)
    await p
    await saiu
    expect((await repos(b).transacoes.obter('v')).criadoPor).toBe('admin')
    expect(b.sessaoAtual.usuarioId).toBe('')
  })
})

describe('CAOS-C-01/C-02 usuário relido antes de cada comando', () => {
  it('desativada em outra aba não vende; administradora rebaixada perde o poder', async () => {
    const { b, sessao } = await comItem()
    await comUsuarios(b)
    Object.assign(sessao, await b.entrar('fulana', 'senha123'))
    const u = await repos(b).usuarios.obter('u-f')
    await repos(b).usuarios.salvar({ ...u, ativo: false })
    expect(await msg(b.comando('concluirVenda', { id: 'v', linhas: linha('x', bs(10)), pagamentos: [pag('p', bs(10))] } as any))).toMatch(/desativado/)
    expect(await repos(b).transacoes.obter('v')).toBeUndefined()
    Object.assign(sessao, await b.entrar('adma', 'senha123'))
    const a = await repos(b).usuarios.obter('u-a')
    await repos(b).usuarios.salvar({ ...a, perfil: 'funcionario' })
    expect(await msg(b.comando('ajustarEstoque', { itemId: 'x', novoSaldo: 0, motivo: 'perda' } as any))).toMatch(/permissão/)
    expect((await repos(b).itens.obter('x')).saldo).toBe(10)
    expect(b.sessaoAtual.perfil).toBe('funcionario')
  })
})

describe('CAOS-B-06/C-15 venda em aberto', () => {
  it('funcionária não descarta nem sobrescreve a da outra; o caixa ainda tira o pacote; admin pode', async () => {
    const { b, sessao } = await comItem()
    await comUsuarios(b)
    Object.assign(sessao, await b.entrar('fulana', 'senha123'))
    await b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l', itemId: 'x', quantidade: 1 }] } as any)
    Object.assign(sessao, await b.entrar('gema', 'senha123'))
    expect(await msg(b.comando('descartarVendaAberta', { id: 'va' } as any))).toMatch(/outra pessoa/)
    expect(await msg(b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l', itemId: 'x', quantidade: 5 }] } as any))).toMatch(/outra pessoa/)
    expect((await repos(b).config.obter('vendaAberta:va')).apagadoEm).toBeFalsy()
    await b.comando('tirarDaVendaAberta', { id: 'va', itemId: 'x', para: 'V-1' } as any)
    expect((await repos(b).config.obter('vendaAberta:va')).apagadoEm).toBeTruthy()
  })

  it('autosave atrasado depois de fechar a venda não ressuscita o rascunho', async () => {
    const { b } = await comItem()
    const rascunho = { id: 'vx', linhas: [{ id: 'l', itemId: 'x', quantidade: 1 }] }
    await b.comando('salvarVendaAberta', rascunho as any)
    await b.comando('concluirVenda', { id: 'vx', linhas: linha('x', bs(10)), pagamentos: [pag('p', bs(10))] } as any)
    await b.comando('salvarVendaAberta', rascunho as any)
    expect((await b.consulta('vendasAbertas', {} as any)).map((v: any) => v.id)).not.toContain('vx')
  })
})

describe('CAOS-C-14 comissão paga no máximo o que falta', () => {
  it('pagar duas vezes o total: a segunda é recusada; "a pagar" nunca fica negativo', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'pro', nome: 'Pro', papeis: ['profissional'], comissaoBp: 4000 } as any)
    await b.comando('salvarItem', { id: 's', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' } as any)
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'pro', linhas: linha('s', bs(300)), pagamentos: [pag('p', bs(300))] } as any)
    const d = { pessoaId: 'pro', valor: bs(120), moeda: 'BOB', forma: 'dinheiro' }
    expect(await msg(b.comando('pagarComissao', { ...d, id: 'pc0', valor: bs(121) } as any))).toMatch(/mais que isso/)
    await Promise.all([msg(b.comando('pagarComissao', { ...d, id: 'pcA' } as any)), msg(b.comando('pagarComissao', { ...d, id: 'pcB' } as any))])
    expect((await b.consulta('comissoes', {} as any)).porPessoa[0].aPagar).toBe(0)
  })
})

describe('CAOS-D-04 encerrar dia futuro', () => {
  it('recusa e não cria o dia', async () => {
    const { b } = await novoBackend()
    expect(await msg(b.comando('encerrarDia', { data: '2099-01-01', contado: {} } as any))).toMatch(/ainda não chegou/)
    expect(await repos(b).dias.obter('2099-01-01')).toBeUndefined()
  })
})

describe('CAOS-C-17 aviso entre abas', () => {
  it('comando gravado numa aba avisa as telas da outra (e não avisa a própria duas vezes)', async () => {
    const nomeBanco = `caos-aviso-${Math.random().toString(36).slice(2)}`
    const A = criarBackend({ tipo: 'local', nomeBanco }).backend as BackendNoAparelho
    const B = criarBackend({ tipo: 'local', nomeBanco }).backend as BackendNoAparelho
    let a = 0
    let bb = 0
    A.aoMudar(() => a++)
    B.aoMudar(() => bb++)
    await A.comando('salvarConfig', { moedaPrincipal: 'BOB' } as any)
    await new Promise((r) => setTimeout(r, 30))
    expect({ a, b: bb > 0 }).toEqual({ a: 1, b: true })
  })
})
