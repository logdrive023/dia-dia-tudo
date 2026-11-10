// MUDAR O COMBINADO: parcela (dia/valor), emprestar mais e adiantar mais — tudo continua batendo (diagnóstico),
// e o que depende das parcelas (próxima, atraso, agenda) acompanha.
import { describe, expect, it } from 'vitest'
import { replanejarParcela } from '../core/services/emprestimos'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

const caixaBOB = async (b: B, data: string) => (await b.consulta('caixaDoDia', { data })).contas.find((c) => c.moeda === 'BOB')?.total ?? 0
const semProblema = async (b: B) => expect((await b.consulta('diagnostico', {})).problemas).toEqual([])

async function cenario() {
  const ctx = await novoBackend('2026-11-01')
  const { b } = ctx
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(20000), descricao: 'Saldo inicial' })
  await b.comando('salvarPessoa', { id: 'ana', nome: 'Ana', papeis: ['cliente'] })
  // 1.200 em 4× sem juros → 4 × 300 (01/12, 01/01, 01/02, 01/03)
  await b.comando('criarEmprestimo', { id: 'e1', direcao: 'dado', pessoaId: 'ana', moeda: 'BOB', principal: bs(1200), juros: { tipo: 'nenhum' }, parcelas: 4, primeiroVencimento: '2026-12-01', forma: 'dinheiro' })
  return ctx
}

const valores = async (b: B) => (await b.consulta('emprestimo', { id: 'e1' })).parcelas.map((p) => p.valor / 100)

describe('replanejarParcela (a conta pura)', () => {
  const ps = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, numero: n, vencimento: `2027-0${n}-01`, valor: 300, pago: 0 }))
  it('diminuir: a diferença é dividida nas próximas; o total fica igual', () => {
    const r = replanejarParcela(ps, 'p2', { valor: 100 })
    expect(r.parcelas.map((p) => p.valor)).toEqual([300, 100, 400, 400])
  })
  it('aumentar: sai das últimas (a que zera some)', () => {
    const r = replanejarParcela(ps, 'p1', { valor: 800 })
    expect(r.parcelas.map((p) => p.valor)).toEqual([800, 300, 100])
  })
  it('a última diminui: vira uma parcela nova um mês depois', () => {
    const r = replanejarParcela(ps, 'p4', { valor: 100 })
    expect(r.parcelas.map((p) => [p.vencimento, p.valor])).toEqual([['2027-01-01', 300], ['2027-02-01', 300], ['2027-03-01', 300], ['2027-04-01', 100], ['2027-05-01', 200]])
  })
  it('mudar o dia reordena e renumera', () => {
    const r = replanejarParcela(ps, 'p1', { vencimento: '2027-02-15' })
    expect(r.parcelas.map((p) => [p.id, p.numero])).toEqual([['p2', 1], ['p1', 2], ['p3', 3], ['p4', 4]])
  })
  it('não aceita menos do que já foi pago nem aumento maior que o resto', () => {
    expect(() => replanejarParcela([{ ...ps[0], pago: 200 }, ...ps.slice(1)], 'p1', { valor: 100 })).toThrow(/já foi pago/)
    expect(() => replanejarParcela(ps, 'p1', { valor: 1300 })).toThrow(/passa do que falta/)
    expect(replanejarParcela(ps, 'p1', { valor: 1300 }, true).parcelas.map((p) => p.valor)).toEqual([1300, 300, 300, 300])
  })
})

describe('mudar parcela, emprestar mais e adiantar mais', () => {
  it('muda o dia: a próxima e o atraso acompanham', async () => {
    const { b, r } = await cenario()
    r.avancar(34) // 05/12
    expect((await b.consulta('emprestimo', { id: 'e1' })).status).toBe('atrasada')
    const p1 = (await b.consulta('emprestimo', { id: 'e1' })).parcelas[0]
    await b.comando('ajustarParcela', { emprestimoId: 'e1', parcelaId: p1.id, vencimento: '2026-12-20' })
    const d = await b.consulta('emprestimo', { id: 'e1' })
    expect(d.atrasado).toBe(0)
    expect(d.proxima?.vencimento).toBe('2026-12-20')
    expect(d.saldo).toBe(bs(1200))
    await semProblema(b)
    const hist = await b.consulta('auditoria', {})
    expect(JSON.stringify(hist)).toMatch(/Parcela 1: dia 2026-12-01 → 2026-12-20/)
  })

  it('muda o valor (total igual) e com "muda o total" (a dívida acompanha)', async () => {
    const { b } = await cenario()
    let d = await b.consulta('emprestimo', { id: 'e1' })
    await b.comando('ajustarParcela', { emprestimoId: 'e1', parcelaId: d.parcelas[1].id, valor: bs(100) })
    expect(await valores(b)).toEqual([300, 100, 400, 400])
    expect((await b.consulta('emprestimo', { id: 'e1' })).saldo).toBe(bs(1200))
    d = await b.consulta('emprestimo', { id: 'e1' })
    await b.comando('ajustarParcela', { emprestimoId: 'e1', parcelaId: d.parcelas[0].id, valor: bs(350), mudaTotal: true, motivo: 'juros de atraso' })
    expect(await valores(b)).toEqual([350, 100, 400, 400])
    expect((await b.consulta('emprestimo', { id: 'e1' })).saldo).toBe(bs(1250))
    await semProblema(b)
  })

  it('pagou parte, depois muda: o pago fica', async () => {
    const { b } = await cenario()
    await b.comando('pagarEmprestimo', { id: 'pg', emprestimoId: 'e1', valor: bs(200), forma: 'dinheiro' })
    const d = await b.consulta('emprestimo', { id: 'e1' })
    await expect(b.comando('ajustarParcela', { emprestimoId: 'e1', parcelaId: d.parcelas[0].id, valor: bs(100) })).rejects.toThrow(/já foi pago/)
    await b.comando('ajustarParcela', { emprestimoId: 'e1', parcelaId: d.parcelas[0].id, valor: bs(200) })
    const depois = await b.consulta('emprestimo', { id: 'e1' })
    expect(depois.parcelas[0].status).toBe('paga')
    expect(depois.saldo).toBe(bs(1000))
    await semProblema(b)
  })

  it('emprestei 1.200 e depois mais 1.000: parcelas novas no fim; o caixa sai de novo', async () => {
    const { b, r } = await cenario()
    expect(await caixaBOB(b, r.hoje)).toBe(bs(18800))
    const op = { id: 'mais1', emprestimoId: 'e1', valor: bs(1000), forma: 'dinheiro', modo: 'novas' as const, parcelas: 2, primeiroVencimento: '2027-04-01' }
    await b.comando('aumentarEmprestimo', op)
    await b.comando('aumentarEmprestimo', op) // toque duplo
    const d = await b.consulta('emprestimo', { id: 'e1' })
    expect(d.emprestimo.principal).toBe(bs(2200))
    expect(d.saldo).toBe(bs(2200))
    expect(d.parcelas.map((p) => [p.numero, p.vencimento, p.valor / 100])).toEqual([
      [1, '2026-12-01', 300], [2, '2027-01-01', 300], [3, '2027-02-01', 300], [4, '2027-03-01', 300], [5, '2027-04-01', 500], [6, '2027-05-01', 500],
    ])
    expect(await caixaBOB(b, r.hoje)).toBe(bs(17800))
    await semProblema(b)
  })

  it('emprestar mais "juntar com o que falta": refaz as parcelas em aberto (o pago fica); reabre quitado', async () => {
    const { b } = await cenario()
    await b.comando('pagarEmprestimo', { id: 'pg', emprestimoId: 'e1', valor: bs(450), forma: 'dinheiro' })
    await b.comando('aumentarEmprestimo', { id: 'mais', emprestimoId: 'e1', valor: bs(1000), forma: 'dinheiro', modo: 'juntar', parcelas: 5, primeiroVencimento: '2027-01-10' })
    let d = await b.consulta('emprestimo', { id: 'e1' })
    // pago: 300 (1ª) + 150 (2ª) → ficam 300 e 150; falta 750 + 1.000 = 1.750 em 5 × 350
    expect(d.parcelas.map((p) => p.valor / 100)).toEqual([300, 150, 350, 350, 350, 350, 350])
    expect(d.saldo).toBe(bs(1750))
    await semProblema(b)
    // quita e empresta mais: volta a ficar aberto
    await b.comando('pagarEmprestimo', { id: 'pg2', emprestimoId: 'e1', valor: bs(1750), forma: 'dinheiro' })
    expect((await b.consulta('emprestimo', { id: 'e1' })).emprestimo.situacao).toBe('quitado')
    await b.comando('aumentarEmprestimo', { id: 'mais2', emprestimoId: 'e1', valor: bs(500), forma: 'dinheiro', modo: 'novas', parcelas: 1, primeiroVencimento: '2027-08-01' })
    d = await b.consulta('emprestimo', { id: 'e1' })
    expect(d.emprestimo.situacao).toBe('aberto')
    expect(d.saldo).toBe(bs(500))
    await semProblema(b)
  })

  it('adiantei 5.000 e depois mais 2.000: a pessoa deve 7.000, o caixa sai duas vezes, a linha do tempo mostra', async () => {
    const { b, r } = await cenario()
    await b.comando('salvarPessoa', { id: 'px', nome: 'Parceiro X', papeis: ['fornecedor'] })
    await b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'px', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' })
    const op = { id: 'ad-mais', financiamentoId: 'ad', moeda: 'BOB', valor: bs(2000), forma: 'dinheiro', prazo: '2026-12-31' }
    await b.comando('reforcarFinanciamento', op)
    await b.comando('reforcarFinanciamento', op) // toque duplo
    const f = await b.consulta('financiamento', { id: 'ad' })
    expect(f).toMatchObject({ financiado: bs(7000), inicial: bs(5000), saldo: bs(7000), status: 'aberto' })
    expect(f.financiamento.prazo).toBe('2026-12-31')
    expect(f.passos.map((p) => [p.tipo, p.saldoDepois])).toEqual([['emprestimo', bs(5000)], ['reforco', bs(7000)]])
    expect((await b.consulta('contaPessoa', { pessoaId: 'px' })).saldo).toBe(bs(7000))
    expect(await caixaBOB(b, r.hoje)).toBe(bs(18800 - 7000))
    expect((await b.consulta('financiamentos', {})).linhas[0].financiado).toBe(bs(7000))
    // a data limite muda sozinha também
    await b.comando('ajustarFinanciamento', { financiamentoId: 'ad', prazo: '2027-01-15' })
    expect((await b.consulta('financiamento', { id: 'ad' })).financiamento.prazo).toBe('2027-01-15')
    await expect(b.comando('ajustarFinanciamento', { financiamentoId: 'ad', prazo: '2020-01-01' })).rejects.toThrow(/antes da data/)
    await semProblema(b)
  })
})
