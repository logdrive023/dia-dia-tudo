// OPERAÇÃO CAOS — VENDAS, CAIXA E IDEMPOTÊNCIA. Teste que FALHA = bug reproduzido (cada asserção diz o comportamento
// CORRETO). Recusa de regra de negócio para ação inválida é comportamento correto. Dados fictícios, backends em memória.
// Rodar: npx vitest run --config vitest.caos.config.ts caos/vendas-caixa.caos.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from '../src/__tests__/ajuda'
import { carregarDemo, SENHA_DEMO } from '../src/adapters/demo'
import { criarBackend } from '../src/app/criarBackend'
import { BackendApi } from '../src/adapters/api/backendApi'
import { criarFetchSimulado } from '../src/adapters/api/apiSimulada'
import type { BackendNoAparelho } from '../src/adapters/noAparelho'
import { conferir, reposDe } from './integridade'

type B = BackendNoAparelho

const recusa = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return (e as Error).message
  }
  return undefined
}
const pag = (id: string, valor: number, moeda = 'BOB', forma = 'dinheiro', extra: Record<string, unknown> = {}) => ({ id, forma, moeda, valor, ...extra })

/** compra bruta que já entrou no estoque (paga) → id do lote */
async function comprar(b: B, id: string, fornecedor: string, gramas: number) {
  await b.comando('salvarPessoa', { id: fornecedor, nome: fornecedor.toUpperCase(), papeis: ['fornecedor'] })
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: fornecedor, linhas: [{ id: `${id}-l`, quantidade: gramas, moeda: 'BOB', total: bs(gramas * 5), campos: { estado: 'Bruto' } }] } as any)
  for (const e of ['conferido', 'pago', 'concluido'])
    await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [pag(`${id}-p`, bs(gramas * 5))] : undefined } as any)
  return (await b.consulta('pedido', { id } as any)).lotes[0].id as string
}

const venda = (id: string, itemId: string, g: number, valor: number, extra: Record<string, unknown> = {}) => ({
  id,
  linhas: [{ id: `${id}-l`, itemId, quantidade: g, moeda: 'BOB', total: valor }],
  pagamentos: [pag(`${id}-p`, valor)],
  ...extra,
})
const vender = (b: B, id: string, itemId: string, g: number, valor = bs(100), extra: Record<string, unknown> = {}) => b.comando('concluirVenda', venda(id, itemId, g, valor, extra) as any)

const item = async (b: B, id: string) => reposDe(b).itens.obter(id)
const movsEstoque = async (b: B, itemId: string) => (await reposDe(b).movEstoque.listar()).filter((m: any) => m.itemId === itemId)
const caixaDe = async (b: B, origemId: string) => (await reposDe(b).movCaixa.listar()).filter((m: any) => m.origemId === origemId)
const somaCaixa = async (b: B, origemId: string, moeda = 'BOB') => (await caixaDe(b, origemId)).filter((m: any) => m.moeda === moeda).reduce((s: number, m: any) => s + m.delta, 0)
const vendasRepo = async (b: B) => (await reposDe(b).transacoes.listar()).filter((t: any) => t.tipo === 'venda')
const auditoria = async (b: B) => reposDe(b).auditoria.listar()

/** saldo do lote = soma do histórico de movimentos, nunca negativo */
async function estoqueBate(b: B, itemId: string) {
  const i = await item(b, itemId)
  const soma = (await movsEstoque(b, itemId)).reduce((s: number, m: any) => s + m.delta, 0)
  expect(i.saldo, `saldo de ${itemId} × movimentos`).toBe(soma)
  expect(i.saldo).toBeGreaterThanOrEqual(0)
  return i.saldo as number
}
const integro = async (b: B) => expect(await conferir(b)).toEqual([])

/** BackendApi falando com um servidor simulado; `ctl.perder` = quantas respostas de /v1/r se perdem (executa no servidor, o cliente recebe erro de rede) */
function apiComPerda() {
  const { backend: servidor } = criarBackend({ tipo: 'memory' })
  const real = criarFetchSimulado(servidor)
  const ctl = { perder: 0, chamadas: 0 }
  const f = (async (u: any, init?: any) => {
    const r = await real(u, init)
    if (String(u).endsWith('/v1/r')) {
      ctl.chamadas++
      if (ctl.perder > 0) {
        ctl.perder--
        throw new TypeError('timeout: resposta perdida')
      }
    }
    return r
  }) as typeof fetch
  const api = new BackendApi({ url: 'https://api.teste', fetch: f, tentativas: 3 })
  return { api, servidor: servidor as B, ctl }
}
async function prepararApi(api: BackendApi) {
  await api.comando('salvarConfig', { moedaPrincipal: 'BOB' } as any)
  await api.comando('salvarCotacao', { id: 'cot-bob', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' } as any)
  await api.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha', saldoInicial: 10 } as any)
}

// =====================================================================================================================
describe('A. concorrência no estoque', () => {
  it('A1 duas vendas do saldo TODO do mesmo lote disparadas juntas (Promise.all): só uma passa', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    const r = await Promise.allSettled([vender(b, 'v1', lote, 500, bs(2500)), vender(b, 'v2', lote, 500, bs(2500))])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(await estoqueBate(b, lote)).toBe(0)
    expect((await movsEstoque(b, lote)).filter((m: any) => m.motivo === 'venda')).toHaveLength(1)
    expect(await vendasRepo(b)).toHaveLength(1)
    const ok = (await vendasRepo(b))[0].id
    expect(await somaCaixa(b, ok)).toBe(bs(2500))
    expect(await somaCaixa(b, ok === 'v1' ? 'v2' : 'v1')).toBe(0)
    await integro(b)
  })

  it('A2 dez vendas de 100 g disparadas juntas num lote de 500 g: exatamente 5 passam, nada negativo', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    const r = await Promise.allSettled(Array.from({ length: 10 }, (_, k) => vender(b, `v${k}`, lote, 100, bs(50))))
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(5)
    expect(await estoqueBate(b, lote)).toBe(0)
    expect(await vendasRepo(b)).toHaveLength(5)
    const caixa = (await reposDe(b).movCaixa.listar()).filter((m: any) => m.tipo === 'venda')
    expect(caixa.reduce((s: number, m: any) => s + m.delta, 0)).toBe(bs(250))
    await integro(b)
  })

  it('A3 vender mais do que tem é recusado, nada muda e a tentativa fica no log como "recusado"', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    expect(await recusa(vender(b, 'v1', lote, 501))).toMatch(/Não há/)
    expect(await estoqueBate(b, lote)).toBe(500)
    expect(await vendasRepo(b)).toHaveLength(0)
    expect(await caixaDe(b, 'v1')).toHaveLength(0)
    expect((await auditoria(b)).some((a: any) => a.acao === 'recusado' && /Não há/.test(a.resumo))).toBe(true)
    await integro(b)
  })

  it('A4 o mesmo lote em duas linhas da mesma venda (300 + 300 de 500): recusa tudo (tudo ou nada)', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    const msg = await recusa(
      b.comando('concluirVenda', {
        id: 'v1',
        linhas: [
          { id: 'a', itemId: lote, quantidade: 300, moeda: 'BOB', total: bs(100) },
          { id: 'b', itemId: lote, quantidade: 300, moeda: 'BOB', total: bs(100) },
        ],
        pagamentos: [pag('p', bs(200))],
      } as any),
    )
    expect(msg).toMatch(/Não há/)
    expect(await estoqueBate(b, lote)).toBe(500)
    expect(await movsEstoque(b, lote)).toHaveLength(1) // só a entrada da compra
    expect(await caixaDe(b, 'v1')).toHaveLength(0)
    await integro(b)
  })

  it('A5 venda e ajustarEstoque ao mesmo tempo no mesmo lote: o resultado é coerente em qualquer ordem', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    const [rv, ra] = await Promise.allSettled([vender(b, 'v1', lote, 300), b.comando('ajustarEstoque', { itemId: lote, novoSaldo: 100, motivo: 'perda' } as any)])
    const saldo = await estoqueBate(b, lote)
    if (rv.status === 'fulfilled' && ra.status === 'fulfilled') expect(saldo).toBe(100)
    else if (rv.status === 'fulfilled') expect(saldo).toBe(200)
    else expect(saldo).toBe(100)
    expect(rv.status === 'fulfilled' || ra.status === 'fulfilled').toBe(true)
    await integro(b)
  })
})

// =====================================================================================================================
describe('B. venda em aberto de outra pessoa', () => {
  it('B1 pacote na venda em aberto da Paula vendido pela Sofia: sai da venda da Paula (com registro) e a Paula não consegue mais fechar com ele', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha', saldoInicial: 2 } as any)
    Object.assign(sessao, await b.entrar('paula', SENHA_DEMO))
    await b.comando('salvarVendaAberta', { id: 'va-paula', linhas: [{ id: 'l', itemId: 'x', quantidade: 2 }] } as any)
    Object.assign(sessao, await b.entrar('sofia', SENHA_DEMO))
    await vender(b, 'v-sofia', 'x', 2, bs(40))
    const reg = await reposDe(b).config.obter('vendaAberta:va-paula')
    expect(reg.apagadoEm).toBeTruthy() // ficou vazia e foi descartada
    expect((await auditoria(b)).some((a: any) => a.acao === 'tirarDaVendaAberta' && a.alvoId === 'va-paula')).toBe(true)
    Object.assign(sessao, await b.entrar('paula', SENHA_DEMO))
    expect(await recusa(b.comando('concluirVenda', { id: 'va-paula', linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(40) }], pagamentos: [pag('p', bs(40))] } as any))).toMatch(/Não há/)
    expect(await estoqueBate(b, 'x')).toBe(0)
    expect((await vendasRepo(b)).filter((t: any) => t.id === 'v-sofia' || t.id === 'va-paula').map((t: any) => t.id)).toEqual(['v-sofia'])
    Object.assign(sessao, await b.entrar('admin', SENHA_DEMO)) // o diagnóstico é do administrador
    await integro(b)
  })

  it('B2 tirarDaVendaAberta (a tela confirmou): tira só aquele pacote; repetir não quebra; vazia é descartada', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 5 } as any)
    await b.comando('salvarItem', { id: 'y', moduloId: 'produtos', tipoItem: 'peca', nome: 'Y', saldoInicial: 5 } as any)
    await b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l1', itemId: 'x', quantidade: 1 }, { id: 'l2', itemId: 'y', quantidade: 1 }] } as any)
    await b.comando('tirarDaVendaAberta', { id: 'va', itemId: 'x', para: 'V-9' } as any)
    await b.comando('tirarDaVendaAberta', { id: 'va', itemId: 'x', para: 'V-9' } as any)
    let reg = await reposDe(b).config.obter('vendaAberta:va')
    expect(reg.valor.linhas.map((l: any) => l.itemId)).toEqual(['y'])
    expect(reg.apagadoEm).toBeFalsy()
    await b.comando('tirarDaVendaAberta', { id: 'va', itemId: 'y' } as any)
    reg = await reposDe(b).config.obter('vendaAberta:va')
    expect(reg.apagadoEm).toBeTruthy()
    expect((await item(b, 'x')).saldo).toBe(5) // venda em aberto não mexe em estoque
    await integro(b)
  })

  it('B3 funcionária NÃO descarta a venda em aberto de outra funcionária (ela nem a vê na lista)', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha', saldoInicial: 2 } as any)
    Object.assign(sessao, await b.entrar('paula', SENHA_DEMO))
    await b.comando('salvarVendaAberta', { id: 'va-paula', linhas: [{ id: 'l', itemId: 'x', quantidade: 1 }] } as any)
    Object.assign(sessao, await b.entrar('sofia', SENHA_DEMO))
    expect((await b.consulta('vendasAbertas', {} as any)).some((v: any) => v.id === 'va-paula')).toBe(false)
    const msg = await recusa(b.comando('descartarVendaAberta', { id: 'va-paula', motivo: 'sumiu' } as any))
    const reg = await reposDe(b).config.obter('vendaAberta:va-paula')
    expect({ recusou: !!msg, apagada: !!reg.apagadoEm }).toEqual({ recusou: true, apagada: false })
  })
})

// =====================================================================================================================
describe('C. idempotência (mesmo id, repetição, resposta perdida)', () => {
  it('C1 mesmo id de venda enviado 2× (retry depois do "timeout"): uma venda, uma saída de estoque, um caixa', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await vender(b, 'v1', lote, 200, bs(300))
    await vender(b, 'v1', lote, 200, bs(300))
    expect(await vendasRepo(b)).toHaveLength(1)
    expect((await movsEstoque(b, lote)).filter((m: any) => m.origemId === 'v1')).toHaveLength(1)
    expect(await caixaDe(b, 'v1')).toHaveLength(1)
    expect(await estoqueBate(b, lote)).toBe(300)
    expect((await auditoria(b)).filter((a: any) => a.acao === 'concluirVenda' && a.alvoId === 'v1')).toHaveLength(1)
    await integro(b)
  })

  it('C2 mesmo id 5× em paralelo e um retry com conteúdo DIFERENTE: vale só o primeiro', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await Promise.all(Array.from({ length: 5 }, () => vender(b, 'v1', lote, 100, bs(100))))
    await vender(b, 'v1', lote, 400, bs(900))
    expect(await estoqueBate(b, lote)).toBe(400)
    expect(await somaCaixa(b, 'v1')).toBe(bs(100))
    expect((await reposDe(b).transacoes.obter('v1')).totalPrincipal).toBe(bs(100))
    await integro(b)
  })

  it('C3 API: resposta da venda se perde (executou no servidor), o cliente repete: nada duplica', async () => {
    const { api, servidor, ctl } = apiComPerda()
    await prepararApi(api)
    ctl.perder = 1
    const r = await api.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'l', itemId: 'x', quantidade: 3, moeda: 'BOB', total: bs(60) }], pagamentos: [pag('p', bs(60))] } as any)
    expect(r).toEqual({ id: 'v1' })
    expect(ctl.perder).toBe(0)
    expect(await vendasRepo(servidor)).toHaveLength(1)
    expect((await movsEstoque(servidor, 'x')).filter((m: any) => m.origemId === 'v1')).toHaveLength(1)
    expect(await caixaDe(servidor, 'v1')).toHaveLength(1)
    expect((await item(servidor, 'x')).saldo).toBe(7)
    await integro(servidor)
  })

  it('C4 API: cancelamento com resposta perdida e repetido: um estorno só', async () => {
    const { api, servidor, ctl } = apiComPerda()
    await prepararApi(api)
    await api.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'l', itemId: 'x', quantidade: 3, moeda: 'BOB', total: bs(60) }], pagamentos: [pag('p', bs(60))] } as any)
    ctl.perder = 1
    await api.comando('cancelarVenda', { id: 'v1', motivo: 'desistiu' } as any)
    expect((await caixaDe(servidor, 'v1')).filter((m: any) => m.tipo === 'estorno')).toHaveLength(1)
    expect(await somaCaixa(servidor, 'v1')).toBe(0)
    expect((await item(servidor, 'x')).saldo).toBe(10)
    await integro(servidor)
  })

  it('C5 API: DUAS correções legítimas seguidas da mesma venda (300→250, depois 250→200): a segunda tem de valer', async () => {
    const { api, servidor } = apiComPerda()
    await prepararApi(api)
    await api.comando('salvarItem', { id: 'g', moduloId: 'produtos', tipoItem: 'peca', nome: 'Grampo', saldoInicial: 500 } as any)
    await api.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'l', itemId: 'g', quantidade: 300, moeda: 'BOB', total: bs(300) }], pagamentos: [pag('p', bs(300))] } as any)
    await api.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'l', quantidade: 250, total: bs(250) }], motivo: 'balança', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any)
    const r2 = await api.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'l', quantidade: 200, total: bs(200) }], motivo: 'balança de novo', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any)
    const t = await reposDe(servidor).transacoes.obter('v1')
    expect({ resposta: (r2 as any).diferenca, quantidade: t.linhas[0].quantidade, total: t.totalPrincipal, saldo: (await item(servidor, 'g')).saldo, caixa: await somaCaixa(servidor, 'v1') }).toEqual({
      resposta: -bs(50),
      quantidade: 200,
      total: bs(200),
      saldo: 300,
      caixa: bs(200),
    })
  })

  it('C6 API: venda em aberto salva 2× (o caixa salva sozinho a cada mudança): a segunda versão tem de ficar guardada', async () => {
    const { api, servidor } = apiComPerda()
    await prepararApi(api)
    await api.comando('salvarItem', { id: 'y', moduloId: 'produtos', tipoItem: 'peca', nome: 'Y', saldoInicial: 5 } as any)
    await api.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l1', itemId: 'x', quantidade: 1 }] } as any)
    await api.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l1', itemId: 'x', quantidade: 1 }, { id: 'l2', itemId: 'y', quantidade: 2 }] } as any)
    const reg = await reposDe(servidor).config.obter('vendaAberta:va')
    expect(reg.valor.linhas.map((l: any) => l.itemId)).toEqual(['x', 'y'])
  })
})

// =====================================================================================================================
describe('D. cancelar e o dia do caixa', () => {
  it('D1 cancelar 2× (seguido e em paralelo): um estorno, estoque volta uma vez', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await vender(b, 'v1', lote, 200, bs(300))
    const r = await Promise.allSettled([b.comando('cancelarVenda', { id: 'v1', motivo: 'x' } as any), b.comando('cancelarVenda', { id: 'v1', motivo: 'x' } as any)])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(await recusa(b.comando('cancelarVenda', { id: 'v1', motivo: 'x' } as any))).toMatch(/já foi cancelada/)
    expect(await estoqueBate(b, lote)).toBe(500)
    expect((await movsEstoque(b, lote)).filter((m: any) => m.motivo === 'cancelamento')).toHaveLength(1)
    expect(await somaCaixa(b, 'v1')).toBe(0)
    await integro(b)
  })

  it('D2 cancelar com o dia encerrado (mesmo dia): recusa e NADA muda (estoque, caixa, aviso do dia); depois de reabrir, cancela', async () => {
    const { b, r } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await vender(b, 'v1', lote, 200, bs(300))
    await b.comando('encerrarDia', { data: r.hoje, contado: { BOB: bs(300) } } as any)
    expect(await recusa(b.comando('cancelarVenda', { id: 'v1', motivo: 'x' } as any))).toMatch(/encerrado/)
    expect(await estoqueBate(b, lote)).toBe(300)
    expect(await somaCaixa(b, 'v1')).toBe(bs(300))
    expect((await reposDe(b).dias.obter(r.hoje)).alteracoesDepois ?? []).toEqual([])
    expect((await reposDe(b).transacoes.obter('v1')).etapa).toBe('concluido')
    await b.comando('reabrirDia', { data: r.hoje } as any)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'x' } as any)
    expect(await estoqueBate(b, lote)).toBe(500)
    expect(await somaCaixa(b, 'v1')).toBe(0)
    await integro(b)
  })

  it('D3 cancelar no dia seguinte a um dia encerrado: estorno cai hoje, o dia fechado guarda o aviso e continua encerrado', async () => {
    const { b, r } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await vender(b, 'v1', lote, 200, bs(300))
    const ontem = r.hoje
    await b.comando('encerrarDia', { data: ontem, contado: { BOB: 0 } } as any)
    r.avancar(1)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'devolveu' } as any)
    const est = (await caixaDe(b, 'v1')).find((m: any) => m.tipo === 'estorno')
    expect(est.data).toBe(r.hoje)
    const dia = await reposDe(b).dias.obter(ontem)
    expect(dia.status).toBe('encerrado')
    expect(dia.alteracoesDepois.map((a: any) => a.origemId)).toEqual(['v1'])
    expect(await estoqueBate(b, lote)).toBe(500)
    await integro(b)
  })

  it('D4 venda FIADO (sem dinheiro) num dia já encerrado: não pode mudar o resultado do dia fechado sem aviso', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 5 } as any)
    await b.comando('lancarCaixa', { id: 'abre', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(10), descricao: 'troco' } as any)
    await b.comando('encerrarDia', { data: r.hoje, contado: { BOB: bs(10) } } as any)
    const msg = await recusa(b.comando('concluirVenda', { id: 'vf', pessoaId: 'cli', linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(80) }], pagamentos: [] } as any))
    const t = await reposDe(b).transacoes.obter('vf')
    const dia = await reposDe(b).dias.obter(r.hoje)
    // correto: recusa (dia encerrado) OU a venda entra com o aviso no dia fechado (alteracoesDepois)
    const avisou = (dia.alteracoesDepois ?? []).some((a: any) => a.origemId === 'vf')
    expect({ recusou: !!msg, vendaGravadaNoDiaFechado: t?.data === r.hoje && t?.etapa === 'concluido', avisou }).toEqual(
      msg ? { recusou: true, vendaGravadaNoDiaFechado: false, avisou: false } : { recusou: false, vendaGravadaNoDiaFechado: true, avisou: true },
    )
  })

  it('D5 encerrar o dia com venda em aberto; fechar a venda depois: recusa sem perder a venda em aberto; reabre e fecha', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 5 } as any)
    await b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l', itemId: 'x', quantidade: 2 }] } as any)
    await b.comando('encerrarDia', { data: r.hoje, contado: {} } as any)
    const v = { id: 'va', linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(80) }], pagamentos: [pag('p', bs(80))] }
    expect(await recusa(b.comando('concluirVenda', v as any))).toMatch(/encerrado/)
    expect((await reposDe(b).config.obter('vendaAberta:va')).apagadoEm).toBeFalsy()
    expect(await estoqueBate(b, 'x')).toBe(5)
    expect(await vendasRepo(b)).toHaveLength(0)
    await b.comando('reabrirDia', { data: r.hoje } as any)
    await b.comando('concluirVenda', v as any)
    expect((await reposDe(b).config.obter('vendaAberta:va')).apagadoEm).toBeTruthy()
    expect(await estoqueBate(b, 'x')).toBe(3)
    expect(await somaCaixa(b, 'va')).toBe(bs(80))
    await integro(b)
  })
})

// =====================================================================================================================
describe('E. corrigir venda concluída', () => {
  it('E1 corrigir quantidade 200→150 (devolve 50 g e dinheiro), tentar 150→600 (sem estoque: recusa), cancelar: tudo fecha', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await vender(b, 'v1', lote, 200, bs(400))
    const r1 = await b.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'v1-l', quantidade: 150, total: bs(300) }], motivo: 'balança', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any)
    expect((r1 as any).diferenca).toBe(-bs(100))
    expect(await estoqueBate(b, lote)).toBe(350)
    expect(await somaCaixa(b, 'v1')).toBe(bs(300))
    const msg = await recusa(b.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'v1-l', quantidade: 600, total: bs(1200) }], motivo: 'erro', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any))
    expect(msg).toMatch(/Não há/)
    expect(await estoqueBate(b, lote)).toBe(350)
    expect((await reposDe(b).transacoes.obter('v1')).totalPrincipal).toBe(bs(300))
    // retry da mesma correção: nada mudou (não aplica 2×)
    expect(await recusa(b.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'v1-l', quantidade: 150, total: bs(300) }], motivo: 'balança', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any))).toMatch(/Nada mudou/)
    expect(await somaCaixa(b, 'v1')).toBe(bs(300))
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'devolveu' } as any)
    expect(await estoqueBate(b, lote)).toBe(500)
    expect(await somaCaixa(b, 'v1')).toBe(0)
    expect(await recusa(b.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'v1-l', quantidade: 100 }], motivo: 'x' } as any))).toMatch(/concluída ou agendada/)
    await integro(b)
  })

  it('E2 corrigir o valor de um serviço com comissão: comissão e "a pagar" acompanham; cancelar zera', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'ana', nome: 'Ana', papeis: ['profissional'] } as any)
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' } as any)
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos: [pag('p', bs(100))] } as any)
    expect((await reposDe(b).transacoes.obter('v')).linhas[0].comissaoPrincipal).toBe(bs(50))
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', total: bs(60) }], motivo: 'desconto', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any)
    const l = (await reposDe(b).transacoes.obter('v')).linhas[0]
    expect([l.comissaoPrincipal, l.parteSalao]).toEqual([bs(30), bs(30)])
    expect(await somaCaixa(b, 'v')).toBe(bs(60))
    expect((await b.consulta('comissoes', {} as any)).aPagar).toBe(bs(30))
    await b.comando('cancelarVenda', { id: 'v', motivo: 'x' } as any)
    expect((await b.consulta('comissoes', {} as any)).aPagar).toBe(0)
    await integro(b)
  })

  it('E3 corrigir venda com cliente (diferença na conta): conta corrente acompanha e o cancelamento zera', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cli', papeis: ['cliente'] } as any)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(100) }], pagamentos: [pag('p', bs(40))] } as any)
    expect((await b.consulta('contaPessoa', { pessoaId: 'cli' } as any)).saldo).toBe(bs(60))
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', quantidade: 3, total: bs(150) }], motivo: 'levou mais um', diferenca: 'conta' } as any)
    expect((await b.consulta('contaPessoa', { pessoaId: 'cli' } as any)).saldo).toBe(bs(110))
    expect(await estoqueBate(b, 'x')).toBe(7)
    await b.comando('cancelarVenda', { id: 'v', motivo: 'x' } as any)
    expect((await b.consulta('contaPessoa', { pessoaId: 'cli' } as any)).saldo).toBe(0)
    expect(await estoqueBate(b, 'x')).toBe(10)
    await integro(b)
  })
})

// =====================================================================================================================
describe('F. descontos, totais e pagamentos', () => {
  it('F1 desconto de 100%: venda Bs 0 sem pagamento, estoque sai, caixa intacto; >100%, negativo, maior que o total: recusa', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    const base = (id: string, desconto: any, pagamentos: any[] = []) => ({ id, linhas: [{ id: `${id}-l`, itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos, desconto })
    for (const [k, d] of [{ moeda: 'BOB', pct: 150 }, { moeda: 'BOB', pct: -10 }, { moeda: 'BOB', valor: -bs(10) }, { moeda: 'BOB', valor: bs(101) }, { moeda: 'USD', pct: 10 }].entries())
      expect(await recusa(b.comando('concluirVenda', base(`r${k}`, d, [pag('p', bs(50))]) as any)), JSON.stringify(d)).toBeTruthy()
    expect(await recusa(b.comando('concluirVenda', { id: 'rl', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100), desconto: -bs(5) }], pagamentos: [pag('p', bs(105))] } as any))).toBeTruthy()
    expect(await vendasRepo(b)).toHaveLength(0)
    await b.comando('concluirVenda', base('v100', { moeda: 'BOB', pct: 100 }) as any)
    const t = await reposDe(b).transacoes.obter('v100')
    expect(t.totalPrincipal).toBe(0)
    expect(t.linhas[0].desconto).toBe(bs(100))
    expect(await caixaDe(b, 'v100')).toHaveLength(0)
    expect(await estoqueBate(b, 'x')).toBe(9)
    // 100% de desconto e mesmo assim pagou: sem cliente, recusa (não há troco)
    expect(await recusa(b.comando('concluirVenda', base('v100p', { moeda: 'BOB', pct: 100 }, [pag('p', bs(10))]) as any))).toMatch(/passou/)
    await integro(b)
  })

  it('F2 totais zero/negativos, quantidade negativa/fracionada, pagamento negativo/fracionado', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    const v = (id: string, q: number, total: number, pags: any[]) => b.comando('concluirVenda', { id, linhas: [{ id: 'l', itemId: 'x', quantidade: q, moeda: 'BOB', total }], pagamentos: pags } as any)
    expect(await recusa(v('a', 1, -bs(10), []))).toBeTruthy()
    expect(await recusa(v('b', -1, bs(10), [pag('p', bs(10))]))).toBeTruthy()
    expect(await recusa(v('c', 1.5, bs(10), [pag('p', bs(10))]))).toBeTruthy()
    expect(await recusa(v('d', 1, bs(10), [pag('p', -bs(10))]))).toBeTruthy()
    expect(await recusa(v('e', 1, bs(10), [pag('p', 999.5)]))).toBeTruthy()
    expect(await recusa(v('f', 1, bs(10), [pag('p', bs(10), 'BOB', 'pix')]))).toBeTruthy() // Pix não aceita BOB
    expect(await recusa(v('g', 1, Number.NaN, []))).toBeTruthy()
    expect(await vendasRepo(b)).toHaveLength(0)
    expect(await estoqueBate(b, 'x')).toBe(10)
    await v('zero', 1, 0, [])
    expect(await estoqueBate(b, 'x')).toBe(9)
    await integro(b)
  })

  it('F3 pagamento que não fecha: falta/sobra sem cliente recusa; com cliente a sobra vira crédito na conta', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cli', papeis: ['cliente'] } as any)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    const v = (id: string, pagos: number, extra: any = {}) => b.comando('concluirVenda', { id, linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos: [pag('p', pagos)], ...extra } as any)
    expect(await recusa(v('a', bs(99)))).toMatch(/Falta/)
    expect(await recusa(v('b', bs(101)))).toMatch(/passou/)
    await v('c', bs(150), { pessoaId: 'cli' })
    expect((await b.consulta('contaPessoa', { pessoaId: 'cli' } as any)).saldo).toBe(-bs(50))
    expect(await somaCaixa(b, 'c')).toBe(bs(150))
    await integro(b)
  })

  it('F4 pagamento em várias moedas (BOB + USD na cotação do sistema): cada moeda no seu caixa e a soma fecha', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    // 1 USD = 5,40 BRL; 1 BRL = 1,28 BOB → 1 USD = 6,912 BOB. US$ 10 = Bs 69,12; total Bs 100 → Bs 30,88 em dinheiro
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos: [pag('p1', 1000, 'USD'), pag('p2', 3088)] } as any)
    const t = await reposDe(b).transacoes.obter('v')
    expect(t.pagamentos.find((p: any) => p.moeda === 'USD').valorPrincipal).toBe(6912)
    expect(await somaCaixa(b, 'v', 'USD')).toBe(1000)
    expect(await somaCaixa(b, 'v', 'BOB')).toBe(3088)
    await integro(b)
  })

  it('F5 cotação digitada absurda (1 US$ = 1.000.000 Bs): US$ 0,01 NÃO pode quitar uma venda de Bs 14.000', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    const cot = { moeda: 'USD', valor: '1000000', sentido: 'basePorMoeda', contra: 'BOB' }
    const msg = await recusa(b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(14000) }], pagamentos: [pag('p', 1, 'USD', 'dinheiro', { cotacao: cot })] } as any))
    const t = await reposDe(b).transacoes.obter('v')
    const pago = t ? t.pagamentos.reduce((s: number, p: any) => s + p.valorPrincipal, 0) : undefined
    // correto: recusa; ou, se aceitou, a soma dos pagamentos tem de fechar com o total
    expect(msg ? 'recusou' : { pago, total: t.totalPrincipal }).toEqual(msg ? 'recusou' : { pago: t.totalPrincipal, total: t.totalPrincipal })
  })

  it('F6 cotação digitada zero, texto, ou de outra moeda: recusa, nada gravado', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    for (const [k, cot] of [{ moeda: 'USD', valor: '0', sentido: 'basePorMoeda', contra: 'BOB' }, { moeda: 'USD', valor: 'abc', sentido: 'basePorMoeda', contra: 'BOB' }, { moeda: 'BRL', valor: '1,28', sentido: 'basePorMoeda', contra: 'BOB' }, { moeda: 'USD', valor: '-6,96', sentido: 'basePorMoeda', contra: 'BOB' }].entries())
      expect(await recusa(b.comando('concluirVenda', { id: `v${k}`, linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100) }], pagamentos: [pag('p', bs(100) / 6.96 | 0, 'USD', 'dinheiro', { cotacao: cot })] } as any)), JSON.stringify(cot)).toBeTruthy()
    expect(await vendasRepo(b)).toHaveLength(0)
    expect(await estoqueBate(b, 'x')).toBe(10)
    await integro(b)
  })
})

// =====================================================================================================================
describe('G. sessão: sair no meio, trocar de usuário, comandos de administrador', () => {
  it('G1 venda disparada e logo depois "sair" (sem esperar): a venda não pode ficar sem dono (criadoPor/usuário do log vazios)', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    const quem = sessao.usuarioId
    const p = b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(10) }], pagamentos: [pag('p', bs(10))] } as any)
    await b.sair()
    const msg = await recusa(p)
    const t = await reposDe(b).transacoes.obter('v')
    const log = (await auditoria(b)).find((a: any) => a.acao === 'concluirVenda' && a.alvoId === 'v')
    // correto: ou recusa (nada gravado), ou grava no nome de quem disparou
    if (msg) expect(t).toBeUndefined()
    else expect({ criadoPor: t.criadoPor, porLog: log?.criadoPor, mov: (await movsEstoque(b, 'x')).find((m: any) => m.origemId === 'v')?.usuario }).toEqual({ criadoPor: quem, porLog: quem, mov: quem })
  })

  it('G2 depois de sair: qualquer comando é recusado e nada muda', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    await b.sair()
    expect(await recusa(vender(b, 'v', 'x', 1, bs(10)))).toMatch(/permissão/)
    expect(await recusa(b.comando('lancarCaixa', { id: 'l', tipo: 'entrada', moeda: 'BOB', forma: 'dinheiro', valor: bs(10), descricao: 'x' } as any))).toMatch(/permissão/)
    expect(await vendasRepo(b)).toHaveLength(0)
    expect(await reposDe(b).movCaixa.listar()).toHaveLength(0)
  })

  it('G3 funcionária tenta comandos de administrador: todos recusados, logados como "recusado" no nome dela, estado intacto', async () => {
    const { b, r, sessao } = await novoBackend()
    await carregarDemo(b)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 } as any)
    await vender(b, 'v', 'x', 2, bs(20))
    const caixaAntes = (await reposDe(b).movCaixa.listar()).length
    Object.assign(sessao, await b.entrar('sofia', SENHA_DEMO))
    const antes = (await auditoria(b)).filter((a: any) => a.acao === 'recusado').length
    const tentativas: [string, any][] = [
      ['encerrarDia', { data: r.hoje, contado: {} }],
      ['reabrirDia', { data: r.hoje }],
      ['corrigirVenda', { id: 'v', linhas: [{ linhaId: 'v-l', quantidade: 1, total: bs(10) }], motivo: 'x', diferenca: { forma: 'dinheiro', moeda: 'BOB' } }],
      ['ajustarEstoque', { itemId: 'x', novoSaldo: 100, motivo: 'ajuste' }],
      ['lancarCaixa', { id: 'lc', tipo: 'retirada', moeda: 'BOB', forma: 'dinheiro', valor: bs(5), descricao: 'x' }],
      ['estornarLancamento', { lancamentoId: 'qualquer' }],
      ['pagarComissao', { id: 'pc', pessoaId: 'x', valor: bs(1), moeda: 'BOB', forma: 'dinheiro' }],
      ['cancelarVenda', { id: 'v', motivo: 'x' }],
    ]
    for (const [nome, dados] of tentativas) expect(await recusa(b.comando(nome as any, dados)), nome).toBeTruthy()
    const recusados = (await auditoria(b)).filter((a: any) => a.acao === 'recusado')
    expect(recusados.length - antes).toBe(tentativas.length)
    expect(recusados.slice(-tentativas.length).every((a: any) => a.usuarioNome === 'Sofia')).toBe(true)
    expect((await reposDe(b).transacoes.obter('v')).etapa).toBe('concluido')
    expect((await reposDe(b).transacoes.obter('v')).totalPrincipal).toBe(bs(20))
    expect(await estoqueBate(b, 'x')).toBe(8)
    expect((await reposDe(b).movCaixa.listar()).length).toBe(caixaAntes)
    expect((await reposDe(b).dias.obter(r.hoje)).status).toBe('aberto')
    Object.assign(sessao, await b.entrar('admin', SENHA_DEMO))
    await integro(b)
  })
})

// =====================================================================================================================
describe('H. origens diferentes, serviço + cabelo, agenda', () => {
  it('H1 venda com linhas de duas compras e de um lote unificado: cada lote baixa o seu, origem soma as gramas', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'ana', 1000)
    const l2 = await comprar(b, 'c2', 'bia', 1000)
    const l3 = await comprar(b, 'c3', 'cris', 500)
    const l4 = await comprar(b, 'c4', 'dani', 500)
    await b.comando('unificarLotes', { id: 'u', ids: [l3, l4], motivo: 'mesma qualidade' } as any)
    expect((await item(b, 'u')).saldo).toBe(1000)
    await b.comando('concluirVenda', {
      id: 'v',
      linhas: [
        { id: 'a', itemId: l1, quantidade: 300, moeda: 'BOB', total: bs(300) },
        { id: 'b', itemId: l2, quantidade: 200, moeda: 'BOB', total: bs(200) },
        { id: 'c', itemId: 'u', quantidade: 400, moeda: 'BOB', total: bs(400) },
      ],
      pagamentos: [pag('p', bs(900))],
    } as any)
    for (const [id, s] of [[l1, 700], [l2, 800], ['u', 600], [l3, 0], [l4, 0]] as const) expect(await estoqueBate(b, id), id).toBe(s)
    const origem = (await b.consulta('origemDaVenda', { vendaId: 'v' } as any)) as any[]
    const gramas = origem.reduce((s, o) => s + (o.gramas ?? o.quantidade ?? 0), 0)
    expect(gramas).toBe(900)
    await b.comando('cancelarVenda', { id: 'v', motivo: 'x' } as any)
    for (const [id, s] of [[l1, 1000], [l2, 1000], ['u', 1000]] as const) expect(await estoqueBate(b, id), id).toBe(s)
    await integro(b)
  })

  it('H2 serviço + cabelo na mesma venda: comissão só no serviço, estoque só no cabelo, caixa = total', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await b.comando('salvarPessoa', { id: 'pro', nome: 'Pro', papeis: ['profissional'] } as any)
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' } as any)
    await b.comando('concluirVenda', {
      id: 'v',
      profissionalId: 'pro',
      linhas: [
        { id: 's', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) },
        { id: 'h', itemId: lote, quantidade: 100, moeda: 'BOB', total: bs(500) },
      ],
      pagamentos: [pag('p', bs(580))],
    } as any)
    const t = await reposDe(b).transacoes.obter('v')
    expect(t.linhas.find((l: any) => l.id === 's').comissaoPrincipal).toBe(bs(40))
    expect(t.linhas.find((l: any) => l.id === 'h').comissaoPrincipal).toBeFalsy()
    expect(await estoqueBate(b, lote)).toBe(400)
    expect(await somaCaixa(b, 'v')).toBe(bs(580))
    expect((await b.consulta('comissoes', {} as any)).aPagar).toBe(bs(40))
    await integro(b)
  })

  it('H3 atendimento agendado atendido 2× (em paralelo e repetido): uma baixa, um caixa, uma comissão', async () => {
    const { b, r } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cli', papeis: ['cliente'] } as any)
    await b.comando('salvarPessoa', { id: 'pro', nome: 'Pro', papeis: ['profissional'] } as any)
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' } as any)
    await b.comando('concluirVenda', {
      id: 'ag',
      pessoaId: 'cli',
      profissionalId: 'pro',
      agendadoPara: '2026-11-02T10:00:00',
      linhas: [
        { id: 's', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) },
        { id: 'h', itemId: lote, quantidade: 100, moeda: 'BOB', total: bs(500) },
      ],
      pagamentos: [],
    } as any)
    expect(await estoqueBate(b, lote)).toBe(500)
    r.avancar(1)
    const at = { id: 'ag', pagamentos: [pag('p', bs(580))] }
    const res = await Promise.allSettled([b.comando('atenderAgendamento', at as any), b.comando('atenderAgendamento', at as any)])
    expect(res.every((x) => x.status === 'fulfilled')).toBe(true)
    await b.comando('atenderAgendamento', at as any)
    expect((await movsEstoque(b, lote)).filter((m: any) => m.origemId === 'ag')).toHaveLength(1)
    expect(await estoqueBate(b, lote)).toBe(400)
    expect(await caixaDe(b, 'ag')).toHaveLength(1)
    expect(await somaCaixa(b, 'ag')).toBe(bs(580))
    expect((await b.consulta('contaPessoa', { pessoaId: 'cli' } as any)).saldo).toBe(0)
    expect((await b.consulta('comissoes', {} as any)).aPagar).toBe(bs(40))
    await integro(b)
  })

  it('H4 agendamento cancelado não pode ser atendido depois; agendado não mexe em estoque', async () => {
    const { b } = await novoBackend()
    const lote = await comprar(b, 'c1', 'ana', 500)
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cli', papeis: ['cliente'] } as any)
    await b.comando('concluirVenda', { id: 'ag', pessoaId: 'cli', agendadoPara: '2026-11-03T10:00:00', linhas: [{ id: 'h', itemId: lote, quantidade: 100, moeda: 'BOB', total: bs(500) }], pagamentos: [] } as any)
    await b.comando('cancelarVenda', { id: 'ag', motivo: 'desmarcou' } as any)
    expect(await recusa(b.comando('atenderAgendamento', { id: 'ag', pagamentos: [pag('p', bs(500))] } as any))).toMatch(/não está agendado/)
    expect(await estoqueBate(b, lote)).toBe(500)
    expect(await caixaDe(b, 'ag')).toHaveLength(0)
    await integro(b)
  })
})
