// OPERAÇÃO CAOS — COMBINAÇÕES entre módulos com duas abas no mesmo IndexedDB (compra × fornecedor × triagem ×
// relatório × venda em aberto × tabela × viagem × adiantamento × caixa × comissão). Teste que FALHA = bug.
import { describe, expect, it } from 'vitest'
import { bs } from '../src/__tests__/ajuda'
import { abrirAbas, base, compraPaga, compraAberta, venda, repos, saldo, caixaBOB, auditoriaDe, entrarComo, resultado, type B, type Q } from './abas'
import { conferir } from './integridade'

async function integras(...bs_: B[]) {
  for (const b of bs_) expect(await conferir(b)).toEqual([])
}
async function cenario() {
  const x = abrirAbas(2)
  const [A, Bb] = x.abas
  await base(A.b)
  return { ...x, A, Bb }
}
const ok = (rs: string[]) => rs.filter((r) => r === 'ok').length
const sep = (id: string, loteId: string, partes: [string, number, number][]) =>
  ({ id, loteId, quantidadeUsada: partes.reduce((s, p) => s + p[1], 0), saidas: partes.map(([pid, q, cm]) => ({ id: pid, quantidade: q, campos: { estado: 'Separado', comprimento: cm, categoria: 'Normal' } })) }) as Q
/** as duas abas respondem igual (nenhum cache velho) */
async function mesmasRespostas(A: B, Bb: B, hoje: string) {
  for (const [n, p] of [['estoque', { moduloId: 'cabelo' }], ['caixaDoDia', { data: hoje }], ['inventario', {}], ['dre', { de: hoje, ate: hoje }], ['vendas', {}], ['vendasAbertas', {}]] as const)
    expect(JSON.stringify(await A.consulta(n as never, p as never))).toBe(JSON.stringify(await Bb.consulta(n as never, p as never)))
}

describe('COMBINAÇÕES entre módulos (duas abas)', () => {
  it('K01 compra (A) + fornecedor renomeado (B) + triagem (A) + relatório de compras nas duas abas', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1', 2000, bs(2000))
    await Promise.all([
      Bb.b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedora Renomeada', papeis: ['fornecedor'] }),
      A.b.comando('separarLote', sep('s1', lote, [['s1a', 1200, 60], ['s1b', 800, 40]])),
    ])
    const relA = JSON.stringify(await A.b.consulta('comprasDetalhadas', { de: r.hoje, ate: r.hoje } as Q))
    expect(relA).toBe(JSON.stringify(await Bb.b.consulta('comprasDetalhadas', { de: r.hoje, ate: r.hoje } as Q)))
    expect(relA).toContain('Fornecedora Renomeada')
    expect((await auditoriaDe(A.b, 'salvarPessoa')).some((a) => a.resumo === 'Fornecedora Renomeada')).toBe(true)
    await mesmasRespostas(A.b, Bb.b, r.hoje)
    await integras(A.b, Bb.b)
  })

  it('K02 venda em aberto (A) + estoque zerado como perda (B) + A tenta fechar (recusa) + B recompõe + A fecha', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await A.b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l', itemId: lote, quantidade: 500 }], pessoaId: 'cli' } as Q)
    await Bb.b.comando('ajustarEstoque', { itemId: lote, novoSaldo: 0, motivo: 'perda', descricao: 'mofou' })
    expect(await resultado(A.b.comando('concluirVenda', venda('va', lote, 500)))).toMatch(/erro/)
    await Bb.b.comando('ajustarEstoque', { itemId: lote, novoSaldo: 600, motivo: 'ajuste', descricao: 'achou' })
    expect(await resultado(A.b.comando('concluirVenda', venda('va', lote, 500)))).toBe('ok')
    expect(await saldo(A.b, lote)).toBe(100)
    expect(((await Bb.b.consulta('vendasAbertas', {})) as Q[]).map((v) => v.id)).not.toContain('va')
    await mesmasRespostas(A.b, Bb.b, r.hoje)
    await integras(A.b, Bb.b)
  })

  it('K03 venda fechada na aba B; o "salvar sozinho" atrasado da aba A NÃO pode ressuscitar a venda em aberto', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const rascunho = { id: 'vx', linhas: [{ id: 'l', itemId: lote, quantidade: 300 }], pessoaId: 'cli' } as Q
    await A.b.comando('salvarVendaAberta', rascunho)
    await Bb.b.comando('concluirVenda', venda('vx', lote, 300))
    // a tela da aba A ainda estava aberta com a venda e salva ao sair
    await resultado(A.b.comando('salvarVendaAberta', rascunho))
    const abertas = ((await A.b.consulta('vendasAbertas', {})) as Q[]).map((v) => v.id)
    expect(abertas).not.toContain('vx')
  })

  it('K04 compra em aberto → separada → parte vendida → valor corrigido → cancelar compra (recusa) → desfaz venda e triagem → cancela', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraAberta(A.b, 'c1', 2000, bs(2000))
    const cx0 = await caixaBOB(A.b, r.hoje)
    await A.b.comando('separarLote', sep('s1', lote, [['s1a', 1000, 60], ['s1b', 1000, 40]]))
    await Bb.b.comando('concluirVenda', venda('v1', 's1a', 300, bs(900)))
    await A.b.comando('definirValorCompra', { compraId: 'c1', linhaId: 'c1-l', total: bs(2400), motivo: 'renegociado' } as Q)
    expect(await resultado(Bb.b.comando('cancelarCompra', { compraId: 'c1', motivo: 'devolve' }))).toMatch(/erro/)
    await Bb.b.comando('cancelarVenda', { id: 'v1', motivo: 'cliente desistiu' })
    const tri = ((await repos(A.b).itens.obter('s1a')) as Q).triagem?.id ?? 's1'
    await A.b.comando('desfazerTriagem', { triagemId: tri, motivo: 'refazer' } as Q)
    expect(await resultado(Bb.b.comando('cancelarCompra', { compraId: 'c1', motivo: 'devolve' }))).toBe('ok')
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx0)
    for (const a of ['cancelarVenda', 'desfazerTriagem', 'cancelarCompra']) expect((await auditoriaDe(A.b, a)).length).toBe(1)
    await mesmasRespostas(A.b, Bb.b, r.hoje)
    await integras(A.b, Bb.b)
  })

  it('K05 produto desativado na aba B enquanto está numa venda em aberto da aba A → fechar é recusado; histórico intacto', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 10 })
    await A.b.comando('concluirVenda', venda('v0', 'pc', 2, bs(20)))
    await A.b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'l', itemId: 'pc', quantidade: 1 }] } as Q)
    await Bb.b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', ativo: false })
    expect(await resultado(A.b.comando('concluirVenda', venda('va', 'pc', 1, bs(10))))).toMatch(/erro/)
    expect(((await A.b.consulta('vendasDetalhadas', { de: r.hoje, ate: r.hoje } as Q)) as Q)).toBeTruthy()
    expect(await saldo(A.b, 'pc')).toBe(8)
    await integras(A.b, Bb.b)
  })

  it('K06 tabela v2 publicada (aba B) entre começar a venda e fechar (aba A) → a venda carimba a v2', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const tabela = (lp: string) => ({ id: 't', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [60], colunas: [{ id: 'lp', nome: 'LP' }], valores: { '60|lp': lp } }) as Q
    await A.b.comando('salvarTabelaPreco', tabela('17'))
    await A.b.comando('salvarVendaAberta', { id: 'vt', linhas: [{ id: 'l', itemId: lote, quantidade: 100 }], colunaId: 'lp' } as Q)
    await Bb.b.comando('salvarTabelaPreco', tabela('20'))
    const fator = ((await A.b.consulta('tabelaVigente', { moduloId: 'cabelo' })) as Q)?.valores?.['60|lp'] ?? '20'
    await A.b.comando('concluirVenda', { id: 'vt', linhas: [{ id: 'vt-l', itemId: lote, quantidade: 100, moeda: 'BOB', total: 0, calculo: { medida: 60, fator, tabelaId: 't', colunaId: 'lp' } }], pagamentos: [{ id: 'vt-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(2000) }] } as Q)
    const l = ((await repos(A.b).transacoes.obter('vt')) as Q).linhas[0]
    expect(l.campos.tabelaVersao).toBe(2)
    expect(l.totalPrincipal).toBe(bs(2000))
    await integras(A.b, Bb.b)
  })

  it('K07 aba A liga compras à viagem enquanto a aba B paga essas compras → íntegro, viagem com as 3', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    for (const id of ['c1', 'c2', 'c3']) await compraAberta(A.b, id, 500, bs(500))
    await Promise.all([
      A.b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1', 'c2', 'c3'] }),
      ...['c1', 'c2', 'c3'].map((id) => Bb.b.comando('pagarCompra', { compraId: id, pagamentos: [{ id: id + '-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(500) }] } as Q)),
      A.b.comando('desvincularCompra', { viagemId: 'vg', compraId: 'c2' }).catch(() => undefined),
    ])
    const comp = ((await repos(A.b).transacoes.listar({ tipo: 'compra' })) as Q[])
    expect(comp.every((c) => c.etapa === 'concluido')).toBe(true)
    expect(comp.filter((c) => c.viagemId === 'vg').length).toBeGreaterThanOrEqual(2)
    expect(await caixaBOB(A.b, r.hoje)).toBe(bs(100000) - bs(1500))
    await integras(A.b, Bb.b)
  })

  it('K08 adiantamento: entrega de cabelo (A) e recebimento do saldo inteiro (B) ao mesmo tempo → nunca as duas', async () => {
    const { A, Bb } = await cenario()
    await A.b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'forn', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' } as Q)
    const rs = await Promise.all([
      resultado(A.b.comando('registrarEntregaFinanciamento', { id: 'e1', financiamentoId: 'ad', linhas: [{ id: 'e1-l', quantidade: 1000, moeda: 'BOB', total: bs(3000), campos: { estado: 'Bruto', categoria: 'Normal' } }] } as Q)),
      resultado(Bb.b.comando('receberFinanciamento', { id: 'r1', financiamentoId: 'ad', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' } as Q)),
    ])
    expect(ok(rs)).toBe(1)
    const f = (await A.b.consulta('financiamento', { id: 'ad' })) as Q
    expect(f.saldo).toBeGreaterThanOrEqual(0)
    expect(((await A.b.consulta('contaPessoa', { pessoaId: 'forn' })) as Q).saldo).toBe(f.saldo)
    await integras(A.b, Bb.b)
  })

  it('K09 encerrar o dia de ontem (A) enquanto a aba B cancela uma venda de ontem → o caixa de ontem não muda, aviso no dia', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const ontem = r.hoje
    await A.b.comando('concluirVenda', venda('v1', lote, 200, bs(300)))
    const cxOntem = await caixaBOB(A.b, ontem)
    r.avancar(1)
    await Promise.all([
      resultado(A.b.comando('encerrarDia', { data: ontem, contado: { BOB: cxOntem } as Q })),
      resultado(Bb.b.comando('cancelarVenda', { id: 'v1', motivo: 'devolveu' })),
    ])
    expect(await caixaBOB(A.b, ontem)).toBe(cxOntem)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cxOntem - bs(300))
    expect(await saldo(A.b, lote)).toBe(1000)
    const dia = (await repos(A.b).dias.obter(ontem)) as Q
    expect(dia.status).toBe('encerrado')
    await integras(A.b, Bb.b)
  })

  it('K10 corrigir a venda (A) e cancelar a mesma venda (B) ao mesmo tempo → estoque e caixa batem', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await A.b.comando('concluirVenda', venda('v1', lote, 400, bs(400)))
    const cx = await caixaBOB(A.b, r.hoje)
    const rs = await Promise.all([
      resultado(A.b.comando('corrigirVenda', { id: 'v1', linhas: [{ linhaId: 'v1-l', quantidade: 300, total: bs(300) }], motivo: 'balança', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as Q)),
      resultado(Bb.b.comando('cancelarVenda', { id: 'v1', motivo: 'desistiu' })),
    ])
    expect(rs[1]).toBe('ok')
    expect(await saldo(A.b, lote)).toBe(1000)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx - bs(400))
    await integras(A.b, Bb.b)
  })

  it('K11 funcionária vende (aba B) enquanto o administrador ajusta o lote e cancela a venda dela (aba A)', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await entrarComo(Bb, 'sofia')
    await Bb.b.comando('concluirVenda', venda('vs', lote, 200))
    await Promise.all([
      resultado(A.b.comando('cancelarVenda', { id: 'vs', motivo: 'errada' })),
      resultado(Bb.b.comando('concluirVenda', venda('vs2', lote, 700))),
      resultado(A.b.comando('ajustarEstoque', { itemId: lote, novoSaldo: 900, motivo: 'ajuste', descricao: 'conta' })),
    ])
    const movs = ((await repos(A.b).movEstoque.listar({ itemId: lote })) as Q[]).reduce((s, m) => s + m.delta, 0)
    expect(await saldo(A.b, lote)).toBe(movs)
    expect(((await Bb.b.consulta('venda', { id: 'vs' })) as Q).venda.etapa).toBe('cancelado')
    expect(await caixaBOB(A.b, r.hoje)).toBeGreaterThan(0)
    await integras(A.b)
  })

  it('K12 trocar o código do lote (A) enquanto a aba B lê o pacote pelo código → novo código vale nas duas abas', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const antigo = (await repos(A.b).itens.obter(lote)).codigo
    await Promise.all([A.b.comando('trocarCodigoLote', { id: lote, codigo: 'NOVO-1', motivo: 'etiqueta' } as Q), resultado(Bb.b.consulta('lerCodigoPacote', { texto: antigo } as Q))])
    const ler = async (b: B, c: string) => JSON.stringify(await b.consulta('lerCodigoPacote', { texto: c } as Q).catch((e: Error) => e.message))
    expect(await ler(Bb.b, 'NOVO-1')).toBe(await ler(A.b, 'NOVO-1'))
    expect(await ler(Bb.b, 'NOVO-1')).toContain(lote)
    expect((await auditoriaDe(A.b, 'trocarCodigoLote')).length).toBe(1)
    await integras(A.b, Bb.b)
  })

  it('K13 reserva para X (A) e venda para outra cliente (B) ao mesmo tempo → venda passa, reserva acaba, log explica', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await Promise.all([A.b.comando('reservarLote', { id: lote, para: 'Cliente X', ate: '2026-11-30' } as Q), Bb.b.comando('concluirVenda', venda('v1', lote, 1000))])
    const it_ = (await repos(A.b).itens.obter(lote)) as Q
    expect(it_.saldo).toBe(0)
    // se a reserva chegou depois da venda, ficou reservado um pacote vazio (vendido)
    expect(it_.reserva).toBeUndefined()
    await integras(A.b, Bb.b)
  })

  it('K14 unir/triar lotes (A) enquanto a aba B vende de um deles → nunca usa o mesmo grama duas vezes', async () => {
    const { A, Bb } = await cenario()
    const l1 = await compraPaga(A.b, 'c1', 1000)
    const l2 = await compraPaga(A.b, 'c2', 1000)
    const rs = await Promise.all([
      resultado(A.b.comando('triarLotes', { id: 'tt', ids: [l1, l2], quantidadeUsada: 2000, saidas: [{ id: 'tt-a', quantidade: 2000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] } as Q)),
      resultado(Bb.b.comando('concluirVenda', venda('v1', l1, 500))),
    ])
    expect(ok(rs)).toBeGreaterThanOrEqual(1)
    const total = ((await repos(A.b).itens.listar()) as Q[]).filter((i) => i.controlaEstoque).reduce((s, i) => s + i.saldo, 0)
    const vendido = rs[1] === 'ok' ? 500 : 0
    expect(total).toBe(2000 - vendido)
    await integras(A.b, Bb.b)
  })

  it('K15 encerrar a viagem (A) enquanto a viajante lança um gasto (B, funcionária) → gasto antes entra na conta; depois é recusado', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    await A.b.comando('adiantarViagem', { id: 'ad1', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000) })
    await entrarComo(Bb, 'sofia')
    const rs = await Promise.all([
      resultado(Bb.b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(200) } as Q)),
      resultado(A.b.comando('encerrarViagem', { viagemId: 'vg', contado: { BOB: bs(1000) } as Q })),
      resultado(Bb.b.comando('registrarDespesaViagem', { id: 'd2', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(50) } as Q)),
    ])
    const v = (await repos(A.b).viagens.obter('vg')) as Q
    expect(v.status).toBe('encerrada')
    expect(rs[1]).toBe('ok')
    const depois = v.despesas.filter((d: Q) => !d.anulada && d.criadoEm > v.encerramento?.em)
    expect(depois.length).toBe(0)
    await integras(A.b)
  })

  it('K16 incorporar o custo da viagem (A) enquanto a aba B cancela uma compra ligada → custo redividido só entre as que ficaram', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    await A.b.comando('adiantarViagem', { id: 'ad1', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000) })
    await A.b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(600) } as Q)
    const l1 = await compraPaga(A.b, 'c1', 1000, bs(1000))
    const l2 = await compraPaga(A.b, 'c2', 1000, bs(1000))
    await A.b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1', 'c2'] })
    await A.b.comando('encerrarViagem', { viagemId: 'vg', contado: { BOB: bs(400) } as Q, incorporar: false })
    await Promise.all([resultado(A.b.comando('incorporarCustoViagem', { viagemId: 'vg' })), resultado(Bb.b.comando('cancelarCompra', { compraId: 'c2', motivo: 'devolvida' }))])
    const i1 = (await repos(A.b).itens.obter(l1)) as Q
    const i2 = (await repos(A.b).itens.obter(l2)) as Q
    expect(i2.saldo).toBe(0)
    const inv = (await A.b.consulta('inventario', {})) as Q
    // o gasto da viagem (600) foi todo para o lote que ficou
    expect(i1.custoPrincipal).toBe(bs(1600))
    expect(inv.valor).toBe(bs(1600))
    await integras(A.b, Bb.b)
  })

  it('K17 duas abas pagam a mesma comissão (tela aberta nas duas) → não paga duas vezes', async () => {
    const { A, Bb } = await cenario()
    await A.b.comando('salvarPessoa', { id: 'pro', nome: 'Profissional Ficticia', papeis: ['profissional'], comissaoBp: 4000 })
    await A.b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' })
    await A.b.comando('concluirVenda', { id: 'vs', profissionalId: 'pro', linhas: [{ id: 'vs-l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: [{ id: 'vs-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(300) }] } as Q)
    const aPagar = ((await A.b.consulta('comissoes', {})) as Q).porPessoa[0].aPagar
    expect(aPagar).toBe(bs(120))
    await Promise.all([
      resultado(A.b.comando('pagarComissao', { id: 'pcA', pessoaId: 'pro', valor: aPagar, moeda: 'BOB', forma: 'dinheiro' })),
      resultado(Bb.b.comando('pagarComissao', { id: 'pcB', pessoaId: 'pro', valor: aPagar, moeda: 'BOB', forma: 'dinheiro' })),
    ])
    expect(((await A.b.consulta('comissoes', {})) as Q).porPessoa[0].aPagar).toBeGreaterThanOrEqual(0)
  })

  it('K18 cancelar o atendimento (B) depois que a comissão dele foi paga (A) → comissão a pagar não fica negativa sem aviso', async () => {
    const { A, Bb } = await cenario()
    await A.b.comando('salvarPessoa', { id: 'pro', nome: 'Profissional Ficticia', papeis: ['profissional'], comissaoBp: 4000 })
    await A.b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' })
    await A.b.comando('concluirVenda', { id: 'vs', profissionalId: 'pro', linhas: [{ id: 'vs-l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: [{ id: 'vs-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(300) }] } as Q)
    await Promise.all([A.b.comando('pagarComissao', { id: 'pcA', pessoaId: 'pro', valor: bs(120), moeda: 'BOB', forma: 'dinheiro' }), Bb.b.comando('cancelarVenda', { id: 'vs', motivo: 'refeito' })])
    const c = ((await A.b.consulta('comissoes', {})) as Q).porPessoa.find((x: Q) => x.pessoaId === 'pro' || x.id === 'pro') ?? ((await A.b.consulta('comissoes', {})) as Q).porPessoa[0]
    // ganho 0 (venda cancelada), pago 120: a diferença tem de aparecer como crédito da loja (a receber), não sumir
    expect(c.pagoTotal - c.ganhoTotal).toBe(bs(120))
    await integras(A.b, Bb.b)
  })

  it('K19 mudar a regra de códigos (A) enquanto a aba B cria compras → nenhum código repetido', async () => {
    const { A, Bb } = await cenario()
    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => compraAberta(Bb.b, `cb${i}`)),
      A.b.comando('salvarCodigos', { compra: { prefixo: 'Q', digitos: 3 }, lote: { prefixo: 'K', digitos: 3 } } as Q),
      ...Array.from({ length: 5 }, (_, i) => compraAberta(A.b, `ca${i}`)),
    ])
    await integras(A.b, Bb.b)
  })

  it('K20 trocar a moeda principal (A) enquanto a aba B registra a primeira venda → nunca as duas', async () => {
    const x = abrirAbas(2)
    const [A, Bb] = x.abas
    await A.b.comando('salvarCotacao', { id: 'cot-bob', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
    await A.b.comando('salvarCotacao', { id: 'cot-usd', moeda: 'USD', valor: '5,40', sentido: 'basePorMoeda' })
    await A.b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 10 })
    const rs = await Promise.all([
      resultado(Bb.b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'l', itemId: 'pc', quantidade: 1, moeda: 'BRL', total: 1000 }], pagamentos: [{ id: 'p', forma: 'pix', moeda: 'BRL', valor: 1000 }] } as Q)),
      resultado(A.b.comando('salvarConfig', { moedaPrincipal: 'BOB' } as Q)),
    ])
    const cfg = ((await repos(A.b).config.obter('geral')) as Q)?.valor
    const v = (await repos(A.b).transacoes.obter('v1')) as Q
    if (rs[0] === 'ok' && rs[1] === 'ok') expect(v.moedaPrincipal).toBe(cfg.moedaPrincipal)
    await integras(A.b, Bb.b)
  })

  it('K21 apagar a viagem (A) enquanto a aba B registra uma compra nela → nenhuma compra fica numa viagem apagada', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    await Promise.all([
      resultado(A.b.comando('apagarViagem', { viagemId: 'vg', motivo: 'repetida' })),
      resultado(Bb.b.comando('criarCompra', { id: 'cv', moduloId: 'cabelo', pessoaId: 'forn', viagemId: 'vg', linhas: [{ id: 'cv-l', quantidade: 100, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto', categoria: 'Normal' } }] } as Q)),
    ])
    const v = (await repos(A.b).viagens.obter('vg')) as Q
    const c = (await repos(A.b).transacoes.obter('cv')) as Q
    expect(!!(v.apagadoEm && c?.viagemId === 'vg')).toBe(false)
    await integras(A.b, Bb.b)
  })

  it('K22 desfazer o mesmo lançamento de caixa nas duas abas ao mesmo tempo → desfeito uma vez', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('lancarCaixa', { id: 'luz', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(100), descricao: 'Luz' })
    const cx = await caixaBOB(A.b, r.hoje)
    const rs = await Promise.all([resultado(A.b.comando('estornarLancamento', { lancamentoId: 'luz' })), resultado(Bb.b.comando('estornarLancamento', { lancamentoId: 'luz' }))])
    expect(ok(rs)).toBe(1)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx + bs(100))
    await integras(A.b, Bb.b)
  })

  it('K23 pagamentos parciais do mesmo empréstimo nas duas abas que juntos passam do saldo → o segundo é recusado', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('criarEmprestimo', { id: 'emp', direcao: 'tomado', pessoaId: 'forn', moeda: 'BOB', principal: bs(1000), juros: { tipo: 'nenhum' }, parcelas: 2, primeiroVencimento: '2026-11-15', forma: 'dinheiro' } as Q)
    const cx = await caixaBOB(A.b, r.hoje)
    const rs = await Promise.all([
      resultado(A.b.comando('pagarEmprestimo', { id: 'pa', emprestimoId: 'emp', valor: bs(700), forma: 'dinheiro' })),
      resultado(Bb.b.comando('pagarEmprestimo', { id: 'pb', emprestimoId: 'emp', valor: bs(700), forma: 'dinheiro' })),
    ])
    expect(ok(rs)).toBe(1)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx - bs(700))
    await integras(A.b, Bb.b)
  })

  it('K24 rajada mista nas duas abas (compras, vendas, separação, ajustes, cancelamentos) → íntegro, consultas iguais e cada comando aceito tem log e fila de saída', async () => {
    const { A, Bb, r } = await cenario()
    const l = await compraPaga(A.b, 'c0', 5000, bs(5000))
    const aud0 = ((await repos(A.b).auditoria.listar()) as Q[]).length
    const out0 = ((await repos(A.b).outbox.listar()) as Q[]).length
    const ops: Promise<string>[] = []
    for (let i = 0; i < 8; i++) {
      ops.push(resultado(A.b.comando('concluirVenda', venda(`a${i}`, l, 150))))
      ops.push(resultado(Bb.b.comando('concluirVenda', venda(`b${i}`, l, 150))))
      ops.push(resultado((i % 2 ? A : Bb).b.comando('criarCompra', { id: `k${i}`, moduloId: 'cabelo', pessoaId: 'forn', linhas: [{ id: `k${i}l`, quantidade: 100, moeda: 'BOB', total: bs(50), campos: { estado: 'Bruto', categoria: 'Normal' } }] } as Q)))
      ops.push(resultado((i % 2 ? Bb : A).b.comando('cancelarVenda', { id: `a${Math.max(0, i - 1)}`, motivo: 'x' })))
    }
    ops.push(resultado(A.b.comando('ajustarEstoque', { itemId: l, novoSaldo: 4000, motivo: 'ajuste', descricao: 'contagem' })))
    const rs = await Promise.all(ops)
    const aceitos = ok(rs)
    expect(((await repos(A.b).outbox.listar()) as Q[]).length - out0).toBe(aceitos)
    const novosLogs = ((await repos(A.b).auditoria.listar()) as Q[]).slice(0).filter((a) => a.acao !== 'recusado').length - aud0
    expect(novosLogs).toBeGreaterThanOrEqual(aceitos)
    await mesmasRespostas(A.b, Bb.b, r.hoje)
    await integras(A.b, Bb.b)
  })

  it('K25 funcionária na aba B: o administrador tira dela a viagem (A) e ela ainda lança gasto na viagem', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarPessoa', { id: 'p-outra', nome: 'Outra Viajante', papeis: ['funcionario'] })
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    await entrarComo(Bb, 'sofia')
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-outra'], inicio: r.hoje } as Q)
    expect(await resultado(Bb.b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(50) } as Q))).toMatch(/erro/)
  })
})
