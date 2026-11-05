// OPERAÇÃO CAOS — VERDADE DOS RELATÓRIOS em cenários pequenos e exatos: o que muda (e o que NÃO pode mudar) no
// histórico depois de cancelar, corrigir e publicar versão de tabela; períodos vazios, cruzando mês/ano,
// filtros contraditórios; estorno de lançamentos nas unidades. Teste que FALHA = bug.
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from '../src/__tests__/ajuda'
import { conferir, reposDe } from './integridade'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any
type B = Awaited<ReturnType<typeof novoBackend>>['b']
const pg = (id: string, valor: number, forma = 'dinheiro') => [{ id, forma, moeda: 'BOB', valor }]

async function base(inicio = '2026-11-01') {
  const ctx = await novoBackend(inicio)
  const { b } = ctx
  await b.comando('salvarLocal', { id: 'loc', nome: 'Salão', tipo: 'salao' })
  await b.comando('salvarPessoa', { id: 'prof', nome: 'Profa', papeis: ['funcionario', 'profissional'], comissaoBp: 4000, localId: 'loc', salario: { moeda: 'BOB', valor: bs(3000) } })
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] })
  await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', precoSugerido: { moeda: 'BOB', valor: bs(1000) } })
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'início' })
  return ctx
}

async function comLote(b: B) {
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'cl', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }], pagarNoAto: pg('cp', bs(50000)) })
  const bruto = ((await reposDe(b).itens.listar()) as Q[]).find((i) => i.moduloId === 'cabelo')!
  await b.comando('triarLotes', { id: 't', ids: [bruto.id], quantidadeUsada: 10000, saidas: [{ id: 'L60', quantidade: 9000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] })
  await b.comando('salvarTabelaPreco', { id: 'tab', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [60], colunas: [{ id: 'x', nome: 'X' }], valores: { '60|x': '17' } })
}

async function foto(b: B, d: string) {
  const p = await b.consulta('painel', { de: d, ate: d })
  const rel = await b.consulta('relatorioContabil', { de: d, ate: d })
  const cx = await b.consulta('caixaDoDia', { data: d })
  const com = await b.consulta('comissoes', { de: d, ate: d })
  const vs = await b.consulta('vendas', { de: d, ate: d })
  return {
    faturamento: p.cartoes.find((c: Q) => c.id === 'faturamento')!.valor,
    compras: p.cartoes.find((c: Q) => c.id === 'compras')!.valor,
    lucro: p.cartoes.find((c: Q) => c.id === 'lucro')!.valor,
    ventas: rel.resultados.find((l: Q) => l.id === 'ventas')!.valor,
    costo: rel.resultados.find((l: Q) => l.id === 'costo')!.valor,
    caixaHoje: cx.contas.map((c: Q) => [c.moeda, c.hoje, c.total]),
    comGanho: com.porPessoa.map((x: Q) => [x.pessoaId, x.ganhoPeriodo]),
    vendas: vs.map((v: Q) => [v.id, v.valor]),
  }
}

describe('histórico: o que muda depois de cancelar / corrigir / publicar tabela', () => {
  it('publicar versão nova da tabela NÃO muda nenhum número do passado', async () => {
    const { b, r } = await base()
    await comLote(b)
    await b.comando('concluirVenda', { id: 'vh', pessoaId: 'cli', linhas: [{ id: 'vhl', itemId: 'L60', quantidade: 1000, moeda: 'BOB', total: 0, calculo: { medida: 60, fator: '17', tabelaId: 'tab', colunaId: 'x' } }], pagamentos: pg('vhp', bs(17000)) })
    await b.comando('concluirVenda', { id: 'vs', profissionalId: 'prof', localId: 'loc', linhas: [{ id: 'vsl', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('vsp', bs(1000)) })
    const d = r.hoje
    r.avancar(2)
    const antes = await foto(b, d)
    const tg = (await b.consulta('tabelasPreco', {})).find((x: Q) => x.id === 'tab') as Q
    await b.comando('salvarTabelaPreco', { ...tg, valores: { '60|x': '25' } })
    expect(await foto(b, d)).toEqual(antes)
    expect((await b.consulta('venda', { id: 'vh' })).venda.linhas[0]).toMatchObject({ totalPrincipal: bs(17000), campos: { fator: '17', tabelaVersao: 1 } })
    expect(await conferir(b)).toEqual([])
  })

  it('corrigir venda de dia ENCERRADO: resultado e comissão do dia mudam; o caixa daquele dia não; a diferença entra no caixa de hoje', async () => {
    const { b, r } = await base()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'prof', localId: 'loc', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('p', bs(1000)) })
    const d = r.hoje
    await b.comando('encerrarDia', { data: d, contado: { BOB: bs(101000) } })
    r.avancar(2)
    const antes = await foto(b, d)
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', total: bs(800) }], motivo: 'desconto esquecido', diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    const depois = await foto(b, d)
    expect(depois.faturamento).toBe(antes.faturamento - bs(200))
    expect(depois.ventas).toBe(antes.ventas - bs(200))
    expect(depois.caixaHoje).toEqual(antes.caixaHoje)
    expect(depois.comGanho).toEqual([['prof', bs(320)]])
    const hoje = await b.consulta('caixaDoDia', { data: r.hoje })
    expect(hoje.contas[0].hoje).toBe(-bs(200))
    expect((await b.consulta('caixaDoDia', { data: d })).alteracoesDepois.length).toBe(1)
    expect(await conferir(b)).toEqual([])
  })

  it('cancelar venda de dia passado: sai do faturamento/comissão/custo daquele dia; caixa daquele dia intacto; estoque volta', async () => {
    const { b, r } = await base()
    await comLote(b)
    await b.comando('concluirVenda', { id: 'vh', pessoaId: 'cli', linhas: [{ id: 'vhl', itemId: 'L60', quantidade: 1000, moeda: 'BOB', total: 0, calculo: { medida: 60, fator: '17', tabelaId: 'tab', colunaId: 'x' } }], pagamentos: pg('vhp', bs(17000)) })
    await b.comando('concluirVenda', { id: 'vs', profissionalId: 'prof', localId: 'loc', linhas: [{ id: 'vsl', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('vsp', bs(1000)) })
    const d = r.hoje
    r.avancar(1)
    const antes = await foto(b, d)
    await b.comando('cancelarVenda', { id: 'vh', motivo: 'devolveu' })
    await b.comando('cancelarVenda', { id: 'vs', motivo: 'devolveu' })
    const depois = await foto(b, d)
    expect(depois.faturamento).toBe(0)
    expect(Math.abs(depois.costo)).toBe(0)
    expect(depois.comGanho).toEqual([])
    expect(depois.caixaHoje).toEqual(antes.caixaHoje)
    expect(depois.compras).toBe(antes.compras)
    expect(((await reposDe(b).itens.obter('L60')) as Q).saldo).toBe(9000)
    const hoje = await b.consulta('caixaDoDia', { data: r.hoje })
    expect(hoje.contas[0].hoje).toBe(-bs(18000))
    expect(await conferir(b)).toEqual([])
  })
})

describe('períodos e filtros', () => {
  it('período cruzando o ano: lista, painel e relatório contam os mesmos dias', async () => {
    const { b, r } = await base('2026-12-30')
    for (let k = 0; k < 4; k++) {
      await b.comando('concluirVenda', { id: `v${k}`, profissionalId: 'prof', linhas: [{ id: `l${k}`, itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000 + k) }], pagamentos: pg(`p${k}`, bs(1000 + k)) })
      r.avancar(1)
    }
    const f = { de: '2026-12-31', ate: '2027-01-01' }
    const lista = await b.consulta('vendas', f)
    expect(lista.map((v: Q) => v.id).sort()).toEqual(['v1', 'v2'])
    const p = await b.consulta('painel', f)
    expect(p.cartoes.find((c: Q) => c.id === 'faturamento')!.valor).toBe(bs(1001) + bs(1002))
    expect(p.serie.map((s: Q) => s.data)).toEqual(['2026-12-31', '2027-01-01'])
    const rel = await b.consulta('relatorioContabil', f)
    expect(rel.resultados.find((l: Q) => l.id === 'ventas')!.valor).toBe(bs(2003))
    expect(rel.conferencia.every((c: Q) => c.ok)).toBe(true)
  })

  it('período vazio: tudo zero, conferência ✓, sem linhas', async () => {
    const { b } = await base()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'prof', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('p', bs(1000)) })
    const f = { de: '2025-01-01', ate: '2025-01-31' }
    expect(await b.consulta('vendas', f)).toEqual([])
    const p = await b.consulta('painel', f)
    expect(p.cartoes.find((c: Q) => c.id === 'faturamento')!.valor).toBe(0)
    const rel = await b.consulta('relatorioContabil', f)
    expect(rel.numeros.receita).toBe(0)
    expect(rel.conferencia.every((c: Q) => c.ok)).toBe(true)
    expect((await b.consulta('comissoes', f)).extrato).toEqual([])
    expect((await b.consulta('auditoria', f)).total).toBe(0)
  })

  it('filtros contraditórios: de > ate e módulo × item de outro módulo → vazio, sem erro', async () => {
    const { b } = await base()
    await comLote(b)
    await b.comando('concluirVenda', { id: 'vh', pessoaId: 'cli', linhas: [{ id: 'vhl', itemId: 'L60', quantidade: 100, moeda: 'BOB', total: bs(100) }], pagamentos: pg('vhp', bs(100)) })
    expect(await b.consulta('vendas', { de: '2026-11-30', ate: '2026-11-01' })).toEqual([])
    expect(await b.consulta('vendas', { moduloId: 'salao', itemId: 'L60' })).toEqual([])
    const p = await b.consulta('painel', { de: '2026-11-30', ate: '2026-11-01' })
    expect(p.cartoes.find((c: Q) => c.id === 'faturamento')!.valor).toBe(0)
  })

  it('unidades com de > ate: salários estimados não podem ficar negativos (nem a margem "inventada")', async () => {
    const { b } = await base()
    const u = await b.consulta('unidades', { de: '2026-11-30', ate: '2026-11-01' })
    const x = u.lista.find((l: Q) => l.local.id === 'loc')
    expect({ salarios: x.salarios, margem: x.margem, dias: u.dias }).toEqual({ salarios: 0, margem: 0, dias: 0 })
  })
})

describe('unidades × estornos (repro isolada)', () => {
  it('salário pago e DESFEITO: salariosPagos da unidade = 0 (não −valor)', async () => {
    const { b, r } = await base()
    await b.comando('pagarSalario', { id: 's1', pessoaId: 'prof', valor: bs(3000), moeda: 'BOB', forma: 'dinheiro' })
    await b.comando('estornarLancamento', { lancamentoId: 's1', motivo: 'errado' })
    const u = await b.consulta('unidades', { de: r.hoje, ate: r.hoje })
    expect(u.lista.find((l: Q) => l.local.id === 'loc').salariosPagos).toBe(0)
  })

  it('despesa da unidade SEM categoria desfeita: despesas da unidade = 0', async () => {
    const { b, r } = await base()
    await b.comando('lancarCaixa', { id: 'd1', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(500), descricao: 'engano', localId: 'loc' })
    await b.comando('estornarLancamento', { lancamentoId: 'd1', motivo: 'engano' })
    const u = await b.consulta('unidades', { de: r.hoje, ate: r.hoje })
    expect(u.lista.find((l: Q) => l.local.id === 'loc').despesas).toBe(0)
    // o DRE acerta o mesmo caso (comparação)
    const dre = await b.consulta('dre', { de: r.hoje, ate: r.hoje })
    expect(dre.despesas).toBe(0)
  })

  it('ENTRADA da unidade com categoria desfeita: não vira despesa da unidade', async () => {
    const { b, r } = await base()
    await b.comando('lancarCaixa', { id: 'e1', tipo: 'entrada', moeda: 'BOB', forma: 'dinheiro', valor: bs(700), descricao: 'aporte', categoria: 'Aporte', localId: 'loc' })
    await b.comando('estornarLancamento', { lancamentoId: 'e1', motivo: 'engano' })
    const u = await b.consulta('unidades', { de: r.hoje, ate: r.hoje })
    expect(u.lista.find((l: Q) => l.local.id === 'loc').despesas).toBe(0)
  })

  it('comissão paga e DESFEITA: volta a "a pagar" (comissões) e o DRE não conta', async () => {
    const { b, r } = await base()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'prof', localId: 'loc', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('p', bs(1000)) })
    await b.comando('pagarComissao', { id: 'pc', pessoaId: 'prof', valor: bs(400), moeda: 'BOB', forma: 'dinheiro' })
    expect((await b.consulta('comissoes', {})).aPagar).toBe(0)
    await b.comando('estornarLancamento', { lancamentoId: 'pc', motivo: 'errado' })
    expect((await b.consulta('comissoes', {})).aPagar).toBe(bs(400))
    expect((await b.consulta('dre', { de: r.hoje, ate: r.hoje })).despesas).toBe(0)
    expect(await conferir(b)).toEqual([])
  })
})

describe('cliques repetidos e ids repetidos', () => {
  it('corrigirVenda enviada 2× ao mesmo tempo (mesmo pedido) aplica uma vez', async () => {
    const { b } = await base()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'prof', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('p', bs(1000)) })
    const d = { id: 'v', linhas: [{ linhaId: 'l', total: bs(900) }], motivo: 'x', diferenca: { forma: 'dinheiro', moeda: 'BOB' } }
    await Promise.allSettled([b.comando('corrigirVenda', d), b.comando('corrigirVenda', d)])
    const mc = ((await reposDe(b).movCaixa.listar()) as Q[]).filter((m) => m.origemId === 'v')
    expect(mc.reduce((s, m) => s + m.delta, 0)).toBe(bs(900))
    expect(await conferir(b)).toEqual([])
  })

  it('mesmo id de venda com OUTRO conteúdo (reenvio adulterado) não cria nem altera nada', async () => {
    const { b } = await base()
    const v = { id: 'v', profissionalId: 'prof', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('p', bs(1000)) }
    await b.comando('concluirVenda', v)
    await b.comando('concluirVenda', { ...v, linhas: [{ ...v.linhas[0], total: bs(5) }], pagamentos: pg('p2', bs(5)) })
    const t = (await reposDe(b).transacoes.obter('v')) as Q
    expect(t.totalPrincipal).toBe(bs(1000))
    expect(((await reposDe(b).movCaixa.listar()) as Q[]).filter((m) => m.origemId === 'v').length).toBe(1)
  })

  it('consulta não grava nada (auditoria e outbox não crescem ao ler relatórios)', async () => {
    const { b, r } = await base()
    const repos = reposDe(b)
    const a0 = (await repos.auditoria.listar()).length
    const o0 = (await repos.outbox.listar()).length
    for (const [n, p] of [['painel', { de: r.hoje, ate: r.hoje }], ['relatorioContabil', { de: r.hoje, ate: r.hoje }], ['auditoria', {}], ['comissoes', {}], ['estoque', {}], ['unidades', { de: r.hoje, ate: r.hoje }]] as const) await b.consulta(n as never, p as never)
    expect([(await repos.auditoria.listar()).length, (await repos.outbox.listar()).length]).toEqual([a0, o0])
  })
})

describe('fechamento do caixa', () => {
  it('encerrar um dia FUTURO é recusado (senão as vendas daquele dia ficam travadas antes de existir)', async () => {
    const { b } = await base()
    let msg = ''
    try {
      await b.comando('encerrarDia', { data: '2099-01-01', contado: {} })
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).not.toBe('')
  })

  it('dia de hoje encerrado: venda nova da funcionária é recusada e nada muda', async () => {
    const { b, r } = await base()
    await b.comando('encerrarDia', { data: r.hoje, contado: { BOB: bs(100000) } })
    const n0 = (await reposDe(b).movCaixa.listar()).length
    let recusou = false
    try {
      await b.comando('concluirVenda', { id: 'v', profissionalId: 'prof', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: pg('p', bs(1000)) })
    } catch {
      recusou = true
    }
    expect(recusou).toBe(true)
    expect((await reposDe(b).movCaixa.listar()).length).toBe(n0)
    expect(await reposDe(b).transacoes.obter('v')).toBeUndefined()
  })
})
