import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

const caixaBOB = async (b: B, data: string) => (await b.consulta('caixaDoDia', { data })).contas.find((c) => c.moeda === 'BOB')?.total ?? 0
const linha = (id: string, gramas: number, total: number) => ({ id, quantidade: gramas, moeda: 'BOB', total, campos: { estado: 'Bruto', categoria: 'Normal' } })

async function cenario() {
  const ctx = await novoBackend('2026-11-01')
  const { b } = ctx
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(20000), descricao: 'Saldo inicial' })
  await b.comando('salvarPessoa', { id: 'px', nome: 'Parceiro X', papeis: ['fornecedor'] })
  return ctx
}

describe('adiantamento a parceiros (financiamento pago com cabelo)', () => {
  it('empresta 5.000 → entrega 3.000 → entrega 2.500 → paga a diferença de 500 → quitado; nada conta duas vezes', async () => {
    const { b, r } = await cenario()
    const hoje = r.hoje
    const r1 = await b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'px', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' })
    await b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'px', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' }) // toque duplo
    expect(r1.codigo).toBe('AD-0001')
    // caixa −5.000 como empréstimo operacional; não é despesa no DRE; a pessoa me deve
    expect(await caixaBOB(b, hoje)).toBe(bs(15000))
    const mov = (await b.consulta('livroCaixa', { de: hoje, ate: hoje, moeda: 'BOB' }))[0].linhas.find((l) => l.saida === bs(5000))!
    expect(mov.tipo).toBe('emprestimo')
    expect(mov.descricao).toMatch(/Saída por empréstimo operacional · AD-0001 · Parceiro X/)
    let dre = await b.consulta('dre', { de: hoje, ate: hoje })
    expect(dre.despesas).toBe(0)
    expect(dre.resultado).toBe(0)
    expect((await b.consulta('contaPessoa', { pessoaId: 'px' })).saldo).toBe(bs(5000))
    let lista = await b.consulta('financiamentos', {})
    expect(lista.linhas[0]).toMatchObject({ codigo: 'AD-0001', status: 'aberto', saldo: bs(5000), financiado: bs(5000) })
    expect(lista.totais.naMao).toBe(bs(5000))

    // entrega 1: R$ 3.000 de cabelo → compra normal, sem caixa; saldo 2.000; entra no estoque (Triagem)
    await b.comando('registrarEntregaFinanciamento', { id: 'c1', financiamentoId: 'ad', linhas: [linha('c1-l', 1000, bs(3000))] })
    await b.comando('registrarEntregaFinanciamento', { id: 'c1', financiamentoId: 'ad', linhas: [linha('c1-l', 1000, bs(3000))] }) // toque duplo
    expect(await caixaBOB(b, hoje)).toBe(bs(15000))
    const c1 = (await b.consulta('compra', { id: 'c1' })).compra
    expect(c1.financiamentoId).toBe('ad')
    expect(c1.pessoaId).toBe('px')
    expect(c1.etapa).toBe('concluido')
    expect(c1.pagamentos).toEqual([])
    expect(c1.obs).toMatch(/Adiantamento AD-0001 · Parceiro X/)
    let f = await b.consulta('financiamento', { id: 'ad' })
    expect(f.saldo).toBe(bs(2000))
    expect(f.entregue).toBe(bs(3000))
    expect(f.gramas).toBe(1000)
    expect(f.status).toBe('aberto')
    expect(f.progressoBp).toBe(6000)
    // lote: custo real = valor entregue; origem rastreável
    const lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.id === 'c1')!
    expect(lote.custoPrincipal).toBe(bs(3000))
    expect(f.passos.find((p) => p.compra?.id === 'c1')!.lotes!.map((l) => l.id)).toContain(lote.id)
    expect((await b.consulta('origemFinanciamento', { itemId: lote.id }))?.texto).toBe('Adiantamento AD-0001 · Parceiro X')
    expect((await b.consulta('origemFinanciamento', { compraId: 'c1' }))?.codigo).toBe('AD-0001')
    expect(await b.consulta('inventario', {})).toMatchObject({ valor: bs(3000) })

    // entrega 2: R$ 2.500 → passou 500: a loja deve ao parceiro
    await b.comando('registrarEntregaFinanciamento', { id: 'c2', financiamentoId: 'ad', linhas: [linha('c2-l', 800, bs(2500))], entrarNoEstoque: false })
    f = await b.consulta('financiamento', { id: 'ad' })
    expect(f.saldo).toBe(-bs(500))
    expect(f.status).toBe('aPagar')
    expect(f.aPagarParceiro).toBe(bs(500))
    expect((await b.consulta('compra', { id: 'c2' })).compra.etapa).toBe('pago')
    // não entra mais entrega num adiantamento já coberto
    await expect(b.comando('registrarEntregaFinanciamento', { id: 'c3', financiamentoId: 'ad', linhas: [linha('c3-l', 10, bs(10))] })).rejects.toThrow(/coberto/)
    await expect(b.comando('pagarDiferencaFinanciamento', { id: 'pd', financiamentoId: 'ad', moeda: 'BOB', valor: bs(600), forma: 'dinheiro' })).rejects.toThrow(/passa/)
    await b.comando('pagarDiferencaFinanciamento', { id: 'pd', financiamentoId: 'ad', moeda: 'BOB', valor: bs(500), forma: 'dinheiro' })
    expect(await caixaBOB(b, hoje)).toBe(bs(14500))
    f = await b.consulta('financiamento', { id: 'ad' })
    expect(f.saldo).toBe(0)
    expect(f.status).toBe('quitado')
    expect(f.passos.map((p) => p.tipo)).toEqual(['emprestimo', 'entrega', 'entrega', 'diferenca', 'quitacao'])
    expect((await b.consulta('contaPessoa', { pessoaId: 'px' })).saldo).toBe(0)
    // DRE: o empréstimo não é despesa e o cabelo é estoque (compra), nunca as duas coisas
    dre = await b.consulta('dre', { de: hoje, ate: hoje })
    expect(dre.despesas).toBe(0)
    expect(dre.resultado).toBe(0)
    lista = await b.consulta('financiamentos', { status: 'quitado' })
    expect(lista.linhas).toHaveLength(1)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('entrega menos: recebe em dinheiro, abate da comissão (na hora e sozinho ao pagar) e encerra com baixa', async () => {
    const { b, r } = await cenario()
    // o parceiro também é profissional e tem comissão a receber (40% de 300 = 120)
    await b.comando('salvarPessoa', { id: 'px', nome: 'Parceiro X', papeis: ['fornecedor', 'profissional'], comissaoBp: 4000 })
    await b.comando('salvarItem', { id: 's', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' })
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'px', linhas: [{ id: 'l', itemId: 's', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(300) }] })
    await b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'px', moeda: 'BOB', valor: bs(1000), forma: 'dinheiro' })
    await b.comando('registrarEntregaFinanciamento', { id: 'c1', financiamentoId: 'ad', linhas: [linha('c1-l', 200, bs(700))] })
    expect((await b.consulta('financiamento', { id: 'ad' })).saldo).toBe(bs(300))
    // abater agora da comissão a pagar (no máximo o que a loja deve de comissão)
    await expect(b.comando('abaterComissaoFinanciamento', { id: 'ab0', financiamentoId: 'ad', valor: bs(150) })).rejects.toThrow(/comissão a pagar/)
    await b.comando('abaterComissaoFinanciamento', { id: 'ab', financiamentoId: 'ad', valor: bs(50) })
    let com = (await b.consulta('comissoes', {})).porPessoa.find((x) => x.pessoaId === 'px')!
    expect(com.pagoTotal).toBe(bs(50))
    expect(com.aPagar).toBe(bs(70))
    let f = await b.consulta('financiamento', { id: 'ad' })
    expect(f.saldo).toBe(bs(250))
    expect(f.comissao).toBe(bs(50))
    // abatimento automático: pagar comissão de 70 → fica retida no adiantamento (nada sai do caixa)
    await b.comando('ajustarFinanciamento', { financiamentoId: 'ad', abaterComissoes: true })
    const antes = await caixaBOB(b, r.hoje)
    await b.comando('pagarComissao', { id: 'pc', pessoaId: 'px', valor: bs(70), moeda: 'BOB', forma: 'dinheiro' })
    await b.comando('pagarComissao', { id: 'pc', pessoaId: 'px', valor: bs(70), moeda: 'BOB', forma: 'dinheiro' }) // toque duplo
    expect(await caixaBOB(b, r.hoje)).toBe(antes)
    com = (await b.consulta('comissoes', {})).porPessoa.find((x) => x.pessoaId === 'px')!
    expect(com.aPagar).toBe(0)
    f = await b.consulta('financiamento', { id: 'ad' })
    expect(f.saldo).toBe(bs(180))
    // recebe 100 em dinheiro
    await b.comando('receberFinanciamento', { id: 'rc', financiamentoId: 'ad', moeda: 'BOB', valor: bs(100), forma: 'dinheiro' })
    expect(await caixaBOB(b, r.hoje)).toBe(antes + bs(100))
    expect((await b.consulta('financiamento', { id: 'ad' })).saldo).toBe(bs(80))
    // encerra à mão: o que falta vira baixa (com motivo)
    await expect(b.comando('encerrarFinanciamento', { id: 'enc', financiamentoId: 'ad', motivo: '' })).rejects.toThrow(/motivo/)
    await b.comando('encerrarFinanciamento', { id: 'enc', financiamentoId: 'ad', motivo: 'Perdoado' })
    f = await b.consulta('financiamento', { id: 'ad' })
    expect(f.status).toBe('encerrado')
    expect(f.baixa).toBe(bs(80))
    expect(f.saldo).toBe(0)
    expect(f.passos.at(-1)!.tipo).toBe('encerramento')
    const dre = await b.consulta('dre', { de: r.hoje, ate: r.hoje })
    // comissão já é custo da venda; o pagamento/abatimento não vira despesa; o adiantamento também não
    expect(dre.despesas).toBe(0)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('etapas personalizadas (Pago → Lavado → Estoque): a entrega passa as do meio e entra no estoque, sem caixa', async () => {
    const { b, r } = await cenario()
    await b.comando('salvarFluxoCompra', {
      moduloId: 'cabelo',
      fluxo: {
        etapas: [
          { id: 'recebido', nome: 'Recebido', ajuda: '' },
          { id: 'pago', nome: 'Pago', ajuda: '', faz: ['pagamento'] },
          { id: 'lavado', nome: 'Lavado', ajuda: '' },
          { id: 'concluido', nome: 'Estoque', ajuda: '', faz: ['estoque'] },
        ],
        avisarParadaDias: 10,
        pedirComprovanteOrigem: false,
        pedirFotos: false,
      },
    })
    await b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'px', moeda: 'BOB', valor: bs(1000), forma: 'dinheiro' })
    await b.comando('registrarEntregaFinanciamento', { id: 'c1', financiamentoId: 'ad', linhas: [linha('c1-l', 300, bs(400))] })
    expect((await b.consulta('compra', { id: 'c1' })).compra.etapa).toBe('concluido')
    expect(await caixaBOB(b, r.hoje)).toBe(bs(19000))
    expect((await b.consulta('financiamento', { id: 'ad' })).saldo).toBe(bs(600))
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })

  it('liga à viagem (opcional): a entrega vira compra da viagem; outra moeda; funcionária só lê o dela', async () => {
    const { b, sessao } = await cenario()
    await b.comando('lancarCaixa', { id: 'ini-usd', tipo: 'saldoInicial', moeda: 'USD', forma: 'dinheiro', valor: 100000, descricao: 'USD' })
    await b.comando('salvarPessoa', { id: 'p-ana', nome: 'Ana', papeis: ['funcionario'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', viajantes: ['p-ana'], inicio: '2026-11-01' })
    await b.comando('criarFinanciamento', { id: 'ad-ana', pessoaId: 'p-ana', moeda: 'USD', valor: 50000, forma: 'dinheiro', viagemId: 'vg' })
    await b.comando('criarFinanciamento', { id: 'ad-x', pessoaId: 'px', moeda: 'BOB', valor: bs(100), forma: 'dinheiro' })
    const f0 = await b.consulta('financiamento', { id: 'ad-ana' })
    expect(f0.financiamento.codigo).toBe('AD-0001')
    expect(f0.viagem?.id).toBe('vg')
    expect(f0.financiado).toBe(f0.financiamento.valorPrincipal)
    await b.comando('registrarEntregaFinanciamento', { id: 'c1', financiamentoId: 'ad-ana', linhas: [linha('c1-l', 500, bs(1000))] })
    expect((await b.consulta('compra', { id: 'c1' })).compra.viagemId).toBe('vg')
    expect((await b.consulta('financiamentos', { viagemId: 'vg' })).linhas.map((x) => x.id)).toEqual(['ad-ana'])
    // funcionária: lê só o dela; não cria nem acerta
    Object.assign(sessao, { usuarioId: 'u-ana', nome: 'Ana', perfil: 'funcionario', pessoaId: 'p-ana' })
    expect((await b.consulta('financiamentos', {})).linhas.map((x) => x.id)).toEqual(['ad-ana'])
    expect((await b.consulta('financiamento', { id: 'ad-ana' })).comissaoAPagar).toBe(0)
    await expect(b.consulta('financiamento', { id: 'ad-x' })).rejects.toThrow(/não é seu/)
    await expect(b.comando('criarFinanciamento', { id: 'n', pessoaId: 'p-ana', moeda: 'BOB', valor: 1, forma: 'dinheiro' })).rejects.toThrow(/permissão/)
    await expect(b.comando('receberFinanciamento', { id: 'n', financiamentoId: 'ad-ana', moeda: 'BOB', valor: 1, forma: 'dinheiro' })).rejects.toThrow(/permissão/)
    await expect(b.comando('encerrarFinanciamento', { id: 'n', financiamentoId: 'ad-ana', motivo: 'x' })).rejects.toThrow(/permissão/)
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin', pessoaId: undefined })
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
    const menu = await b.consulta('resumoMenu', {})
    expect(menu.adiantamentosAbertos).toBe(2)
  })
})
