import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { criarBackend } from '../app/criarBackend'
import { carregarDemo } from '../adapters/demo'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

/** compra de cabelo que já entrou no estoque (paga na hora) */
async function compra(b: B, id: string, gramas: number, total: number, fornecedor: string, compradorId?: string) {
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: fornecedor, compradorId, linhas: [{ id: `${id}-l`, quantidade: gramas, moeda: 'BOB', total, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: total }] : undefined })
  return (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.id === id)!.id
}

async function cenario() {
  const ctx = await novoBackend()
  const { b } = ctx
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(30000), descricao: 'Saldo inicial' })
  await b.comando('lancarCaixa', { id: 'ini-usd', tipo: 'saldoInicial', moeda: 'USD', forma: 'dinheiro', valor: 50000, descricao: 'Saldo inicial USD' })
  // a funcionária viajante precisa da tela Viagens liberada pelo admin (no padrão é só do admin)
  await b.comando('salvarConfig', { funcionariaTelas: ['viagens'] } as never)
  await b.comando('salvarPessoa', { id: 'p-ana', nome: 'Ana', papeis: ['funcionario'] })
  await b.comando('salvarPessoa', { id: 'p-bia', nome: 'Bia', papeis: ['funcionario', 'socio'] })
  await b.comando('salvarPessoa', { id: 'f1', nome: 'Fornecedor 1', papeis: ['fornecedor'] })
  await b.comando('salvarPessoa', { id: 'f2', nome: 'Fornecedor 2', papeis: ['fornecedor'] })
  return ctx
}

const caixaBOB = async (b: B, data: string) => (await b.consulta('caixaDoDia', { data })).contas.find((c) => c.moeda === 'BOB')!.total

describe('viagens de compra', () => {
  it('adiantamento → gastos → compras ligadas → rateio por grama → incorporar ao custo → venda → DRE e ROI', async () => {
    const { b, r, sessao } = await cenario()
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p-ana'], inicio: r.hoje, orcamento: bs(700) })
    const lista = await b.consulta('viagens', {})
    expect(lista.linhas[0].codigo).toBe('VG-0001')
    // adiantamento: sai do caixa da loja, entra na carteira da viagem
    await b.comando('adiantarViagem', { id: 'ad1', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(2000) })
    await b.comando('adiantarViagem', { id: 'ad1', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(2000) }) // toque duplo
    expect(await caixaBOB(b, r.hoje)).toBe(bs(28000))

    // quem viajou lança os gastos pelo celular (só na viagem dela)
    Object.assign(sessao, { usuarioId: 'u-ana', nome: 'Ana', perfil: 'funcionario', pessoaId: 'p-ana' })
    await b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(300) })
    await b.comando('registrarDespesaViagem', { id: 'd2', viagemId: 'vg', categoria: 'hospedagem', moeda: 'BOB', valor: bs(500), nota: 'Hotel 2 noites' })
    await b.comando('registrarDespesaViagem', { id: 'd3', viagemId: 'vg', categoria: 'comida', moeda: 'BOB', valor: bs(99) })
    await b.comando('anularDespesaViagem', { viagemId: 'vg', despesaId: 'd3', motivo: 'Lancei duas vezes' })
    const painel = await b.consulta('painelViajante', {})
    expect(painel.viagem?.codigo).toBe('VG-0001')
    expect(painel.viagem?.gasto).toBe(bs(800))
    expect(painel.viagem?.carteira).toEqual([expect.objectContaining({ moeda: 'BOB', adiantado: bs(2000), gasto: bs(800), saldo: bs(1200) })])
    expect(painel.viagem?.acimaOrcamento).toBe(true)
    // nada de resultado/custos para a funcionária
    await expect(b.consulta('viagem', { id: 'vg' })).rejects.toThrow()
    await expect(b.comando('encerrarViagem', { viagemId: 'vg', contado: {} })).rejects.toThrow(/permissão/)
    await expect(b.comando('incorporarCustoViagem', { viagemId: 'vg' })).rejects.toThrow(/permissão/)
    await expect(b.comando('adiantarViagem', { id: 'x', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: 1 })).rejects.toThrow(/permissão/)
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin', pessoaId: undefined })

    // a viagem passou do orçamento: alerta no painel
    const p = await b.consulta('painel', { de: r.hoje, ate: r.hoje })
    expect(p.alertas.find((a) => a.id === 'viagemOrcamento')?.quantidade).toBe(1)

    // duas compras (lugares e fornecedores diferentes) feitas pela viajante, sugeridas e ligadas
    const l1 = await compra(b, 'c1', 1000, bs(5000), 'f1', 'p-ana')
    const l2 = await compra(b, 'c2', 3000, bs(9000), 'f2', 'p-ana')
    await compra(b, 'c3', 500, bs(1000), 'f1') // outra compra, de outra pessoa: não é sugerida
    const antes = await b.consulta('viagem', { id: 'vg' })
    expect(antes.candidatas.filter((c) => c.sugerida).map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    await b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1', 'c2'] })

    // rateio por grama: Bs 800 sobre 4 kg → Bs 200 na c1 (1 kg) e Bs 600 na c2 (3 kg)
    const d = await b.consulta('viagem', { id: 'vg' })
    expect(d.compras.map((c) => [c.id, c.parte])).toEqual([['c1', bs(200)], ['c2', bs(600)]])
    expect(d.compras.find((c) => c.id === 'c1')!.custoKgReal).toBe(bs(5200))
    expect(d.kpis.custoKg).toBe(bs(3500))
    expect(d.kpis.custoKgReal).toBe(bs(3700))
    expect(d.kpis.capitalPago).toBe(bs(14000))
    // por valor: c1 = 800 × 5.000/14.000
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p-ana'], inicio: r.hoje, orcamento: bs(700), rateio: 'valor' })
    expect((await b.consulta('viagem', { id: 'vg' })).compras[0].parte).toBe(28571)
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p-ana'], inicio: r.hoje, orcamento: bs(700), rateio: 'grama' })

    // venda antes de encerrar: 500 g do lote da c1
    await b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'v1l', itemId: l1, quantidade: 500, moeda: 'BOB', total: bs(4000) }], pagamentos: [{ id: 'v1p', forma: 'dinheiro', moeda: 'BOB', valor: bs(4000) }] })

    // prestação de contas: sobrou Bs 1.150 (esperado 1.200 → faltou 50) e incorpora o gasto
    await b.comando('encerrarViagem', { viagemId: 'vg', contado: { BOB: bs(1150) }, incorporar: true })
    const enc = await b.consulta('viagem', { id: 'vg' })
    expect(enc.viagem.status).toBe('encerrada')
    expect(enc.carteira).toEqual([expect.objectContaining({ moeda: 'BOB', devolvido: bs(1150), diferenca: bs(50), saldo: 0 })])
    // c1: sobreviveram 1.000 g (500 vendidas + 500 em estoque) → metade de Bs 200 vai para o lote; c2 inteira (Bs 600)
    expect(enc.viagem.incorporacao?.total).toBe(bs(700))
    expect(enc.viagem.incorporacao?.lotes.find((l) => l.itemId === l1)).toMatchObject({ extra: bs(100), antes: bs(5000), depois: bs(5200) })
    expect((await b.consulta('fichaItem', { id: l2 })).item.custoPrincipal).toBe(bs(9600))
    const log = (await b.consulta('logDetalhado', { acao: 'incorporarCustoViagem' })).linhas
    expect(log[0].resumo).toMatch(/500000 → 520000/)

    // venda depois: o custo do lote já leva a logística (Bs 2.500 + Bs 100)
    await b.comando('concluirVenda', { id: 'v2', linhas: [{ id: 'v2l', itemId: l1, quantidade: 500, moeda: 'BOB', total: bs(4000) }], pagamentos: [{ id: 'v2p', forma: 'dinheiro', moeda: 'BOB', valor: bs(4000) }] })
    expect((await b.consulta('venda', { id: 'v2' })).venda.linhas[0].custoPrincipal).toBe(bs(2600))

    // DRE da viagem: receita 8.000 − (cabelo 14.000 + gastos 800) = −6.800; ROI = −6.800 / 14.800
    const fim = await b.consulta('viagem', { id: 'vg' })
    expect(fim.kpis.receita).toBe(bs(8000))
    expect(fim.kpis.resultado).toBe(bs(-6800))
    expect(fim.kpis.roiBp).toBe(-4595)
    expect(fim.kpis.gramasVendidas).toBe(1000)
    expect(fim.kpis.gramasEstoque).toBe(3000)
    expect(fim.kpis.pctEstoqueBp).toBe(7500)
    // sem tabela de preço o potencial é o custo do que sobrou (c2 com a logística: 9.600)
    expect(fim.kpis.potencial).toBe(bs(9600))
    expect(fim.prospeccao).toBe(false)
    expect(fim.porCategoria.map((c) => c.id)).toEqual(['hospedagem', 'combustivel'])

    // caixa: 30.000 − 2.000 (adiantamento) − 15.000 (compras) + 8.000 (vendas) + 1.150 (sobra) = 22.150
    expect(await caixaBOB(b, r.hoje)).toBe(bs(22150))
    // DRE geral: saiu 850 (800 gastos + 50 que faltou), mas 700 foram incorporados ao custo dos lotes (viram estoque e
    // entram no custo quando venderem): na despesa "Viagens" fica só o que não foi para os lotes, sem contar duas vezes
    const dre = await b.consulta('dre', { de: '2026-01-01', ate: r.hoje })
    expect(dre.linhas.find((l) => l.conta === '(−) Viagens')?.valor).toBe(bs(-150))
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)

    // reabrir desfaz a incorporação no que ainda está no lote e a diferença; o dinheiro devolvido fica
    await expect(b.comando('reabrirViagem', { viagemId: 'vg', motivo: '' })).rejects.toThrow(/motivo/)
    await b.comando('reabrirViagem', { viagemId: 'vg', motivo: 'Esqueci um pedágio' })
    expect((await b.consulta('fichaItem', { id: l2 })).item.custoPrincipal).toBe(bs(9000))
    const reab = await b.consulta('viagem', { id: 'vg' })
    expect(reab.viagem.status).toBe('aberta')
    expect(reab.viagem.incorporacoesDesfeitas).toHaveLength(1)
    expect(reab.carteira[0].saldo).toBe(bs(50))
    expect(await caixaBOB(b, r.hoje)).toBe(bs(22150))
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('viagem sem compra = custo de prospecção (ROI "—"), gasto em dólar e sobra devolvida sem diferença', async () => {
    const { b, r } = await cenario()
    await b.comando('salvarViagem', { id: 'vp', nome: 'Prospecção Cochabamba', viajantes: ['p-bia'], inicio: r.hoje })
    await b.comando('adiantarViagem', { id: 'a', viagemId: 'vp', moeda: 'USD', forma: 'dinheiro', valor: 10000 })
    await b.comando('registrarDespesaViagem', { id: 'g', viagemId: 'vp', categoria: 'transporte', moeda: 'USD', valor: 3000 })
    r.avancar(2)
    await b.comando('encerrarViagem', { viagemId: 'vp', contado: { USD: 7000 } })
    const d = await b.consulta('viagem', { id: 'vp' })
    expect(d.prospeccao).toBe(true)
    expect(d.kpis.roiBp).toBeUndefined()
    expect(d.kpis.gramas).toBe(0)
    // US$ 30 × 6,912 = Bs 207,36
    expect(d.kpis.gasto).toBe(20736)
    expect(d.kpis.resultado).toBe(-20736)
    expect(d.kpis.dias).toBe(3)
    expect(d.carteira).toEqual([expect.objectContaining({ moeda: 'USD', adiantado: 10000, gasto: 3000, devolvido: 7000, diferenca: 0, saldo: 0 })])
    await expect(b.comando('incorporarCustoViagem', { viagemId: 'vp' })).rejects.toThrow(/Nada a incorporar/)
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('funcionária lança gasto só na viagem dela; não liga compra, não encerra, não incorpora', async () => {
    const { b, r, sessao } = await cenario()
    await b.comando('salvarViagem', { id: 'va', nome: 'Viagem da Ana', viajantes: ['p-ana'], inicio: r.hoje })
    await b.comando('salvarViagem', { id: 'vb', nome: 'Viagem da Bia', viajantes: ['p-bia'], inicio: r.hoje })
    await b.comando('registrarDespesaViagem', { id: 'adm', viagemId: 'va', categoria: 'outros', moeda: 'BOB', valor: bs(10) })
    Object.assign(sessao, { usuarioId: 'u-ana', nome: 'Ana', perfil: 'funcionario', pessoaId: 'p-ana' })
    await b.comando('registrarDespesaViagem', { id: 'ok', viagemId: 'va', categoria: 'comida', moeda: 'BOB', valor: bs(25) })
    await expect(b.comando('registrarDespesaViagem', { id: 'no', viagemId: 'vb', categoria: 'comida', moeda: 'BOB', valor: bs(25) })).rejects.toThrow(/não é sua/)
    await expect(b.comando('anularDespesaViagem', { viagemId: 'va', despesaId: 'adm', motivo: 'x' })).rejects.toThrow(/só anula/)
    await expect(b.comando('registrarDespesaViagem', { id: 'cat', viagemId: 'va', categoria: 'nada', moeda: 'BOB', valor: bs(1) })).rejects.toThrow(/categoria/)
    await expect(b.comando('vincularCompras', { viagemId: 'va', compraIds: ['x'] })).rejects.toThrow(/permissão/)
    await expect(b.comando('salvarViagem', { id: 'vc', nome: 'Minha', viajantes: ['p-ana'], inicio: r.hoje })).rejects.toThrow(/permissão/)
    await expect(b.comando('reabrirViagem', { viagemId: 'va', motivo: 'x' })).rejects.toThrow(/permissão/)
    // só vê as viagens dela
    expect((await b.consulta('viagens', {})).linhas.map((v) => v.id)).toEqual(['va'])
    expect((await b.consulta('painelViajante', { viagemId: 'vb' })).viagem?.id).toBe('va')
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin', pessoaId: undefined })
    await b.comando('encerrarViagem', { viagemId: 'va', contado: {}, reembolsar: true })
    // gastou Bs 35 sem adiantamento: a loja reembolsou (sai do caixa como despesa da viagem)
    const d = await b.consulta('viagem', { id: 'va' })
    expect(d.carteira[0]).toMatchObject({ reembolsado: bs(35), saldo: 0 })
    expect(d.caixa.map((m) => m.delta)).toEqual([bs(-35)])
    Object.assign(sessao, { usuarioId: 'u-ana', nome: 'Ana', perfil: 'funcionario', pessoaId: 'p-ana' })
    await expect(b.comando('registrarDespesaViagem', { id: 'tarde', viagemId: 'va', categoria: 'comida', moeda: 'BOB', valor: bs(5) })).rejects.toThrow(/encerrada/)
  })

  it('uma compra pertence a uma viagem só; desvincular volta a sugerir', async () => {
    const { b, r } = await cenario()
    await b.comando('salvarViagem', { id: 'v1', nome: 'A', viajantes: ['p-ana'], inicio: r.hoje })
    await b.comando('salvarViagem', { id: 'v2', nome: 'B', viajantes: ['p-ana'], inicio: r.hoje })
    await compra(b, 'c1', 1000, bs(5000), 'f1', 'p-ana')
    await b.comando('vincularCompras', { viagemId: 'v1', compraIds: ['c1'] })
    await expect(b.comando('vincularCompras', { viagemId: 'v2', compraIds: ['c1'] })).rejects.toThrow('P-0001 (em VG-0001) já está em outra viagem')
    await b.comando('desvincularCompra', { viagemId: 'v1', compraId: 'c1' })
    expect((await b.consulta('viagem', { id: 'v2' })).candidatas.find((c) => c.id === 'c1')?.sugerida).toBe(true)
    const tl = await b.consulta('linhaDoTempo', { id: 'c1' })
    expect(tl.some((e) => e.titulo === 'Compras ligadas à viagem')).toBe(true)
  })

  it('dados de exemplo: viagem encerrada com resultado e uma aberta acima do orçamento; contas batem', async () => {
    const { backend } = criarBackend({ tipo: 'memory' })
    await carregarDemo(backend as BackendNoAparelho)
    const lista = await backend.consulta('viagens', {})
    // Oruro e Sucre (encerradas, com compra: dá para comparar) + Cochabamba (aberta, prospecção)
    expect(lista.linhas.map((v) => v.codigo).sort()).toEqual(['VG-0001', 'VG-0002', 'VG-0003'])
    const sucre = await backend.consulta('viagem', { id: 'vg-sucre' })
    expect(sucre.viagem.status).toBe('encerrada')
    expect(sucre.compras).toHaveLength(1)
    const oruro = await backend.consulta('viagem', { id: 'vg-oruro' })
    expect(oruro.viagem.status).toBe('encerrada')
    expect(oruro.viagem.incorporacao?.total).toBeGreaterThan(0)
    expect(oruro.compras).toHaveLength(2)
    expect(oruro.kpis.receita).toBeGreaterThan(0)
    expect(oruro.carteira.every((c) => c.saldo === 0)).toBe(true)
    const cocha = await backend.consulta('viagem', { id: 'vg-cocha' })
    expect(cocha.prospeccao).toBe(true)
    expect(cocha.acimaOrcamento).toBe(true)
    expect((await backend.consulta('diagnostico', {})).problemas).toEqual([])
  }, 60000)
})
