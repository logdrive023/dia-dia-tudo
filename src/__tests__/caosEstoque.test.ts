// Regressões dos achados da Operação Caos em compra → triagem → estoque (CAOS-A-01…08, C-09). Rápidos, em memória.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function base() {
  const { b } = await novoBackend()
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(1_000_000), descricao: 'ini' } as any)
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora Ficticia', papeis: ['fornecedor'] } as any)
  const repos = (b as any).repos
  const comprar = async (id: string, g: number, valor: number) => {
    await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: id + 'l', quantidade: g, moeda: 'BOB', total: bs(valor), campos: { estado: 'Bruto' } }] } as any)
    return (await repos.transacoes.obter(id)).linhas[0].itemId as string
  }
  const item = (id: string) => repos.itens.obter(id)
  const soma = async () => (await repos.itens.listar()).filter((i: any) => i.moduloId === 'cabelo').reduce((s: number, i: any) => s + i.saldo, 0)
  return { b, repos, comprar, item, soma }
}
const parte = (id: string, quantidade: number) => ({ id, quantidade, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } })

describe('ids das partes da triagem (A-01, A-02, A-06)', () => {
  it('A-01: parte com o id de um pacote existente (ou do próprio de entrada) é recusada antes de mexer', async () => {
    const { b, comprar, item, soma } = await base()
    const L1 = await comprar('c1', 1000, 1000)
    const L2 = await comprar('c2', 2000, 2000)
    await expect(b.comando('triarLotes', { id: 't1', ids: [L1], quantidadeUsada: 500, saidas: [parte(L2, 500)] } as any)).rejects.toThrow(/Já existe um pacote/)
    await expect(b.comando('triarLotes', { id: 't2', ids: [L1], quantidadeUsada: 500, saidas: [parte(L1, 500)] } as any)).rejects.toThrow(/Já existe um pacote/)
    await expect(b.comando('triarLotes', { id: 't3', ids: [L1], quantidadeUsada: 500, saidas: [parte('ok1', 400)], paraDepois: { id: L2, quantidade: 100 } } as any)).rejects.toThrow(/Já existe um pacote/)
    expect((await item(L1)).saldo).toBe(1000)
    expect((await item(L2)).origem).toMatchObject({ tipo: 'compra', id: 'c2' })
    expect(await soma()).toBe(3000)
  })

  it('A-01: juntar + separar com uma parte usando o id do juntado ("-u") é recusado sem juntar', async () => {
    const { b, comprar, item } = await base()
    const L1 = await comprar('c1', 1000, 1000)
    const L2 = await comprar('c2', 500, 500)
    await expect(b.comando('triarLotes', { id: 't1', ids: [L1, L2], quantidadeUsada: 1500, saidas: [parte('t1-u', 1500)] } as any)).rejects.toThrow()
    expect((await item(L1)).saldo).toBe(1000)
    expect((await item(L2)).saldo).toBe(500)
  })

  it('A-02: duas partes com o mesmo id: recusado, nada some', async () => {
    const { b, comprar, soma } = await base()
    const L = await comprar('c1', 1000, 1000)
    await expect(b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 1000, saidas: [parte('dup', 600), parte('dup', 400)] } as any)).rejects.toThrow(/mesma identificação/)
    expect(await soma()).toBe(1000)
  })

  it('A-06: separarLote / unificarLotes com id de pacote alheio recusam (não dizem "ok" sem fazer)', async () => {
    const { b, comprar, item } = await base()
    const L1 = await comprar('c1', 1000, 1000)
    const L2 = await comprar('c2', 2000, 2000)
    await expect(b.comando('separarLote', { id: 'sx', loteId: L1, quantidadeUsada: 500, saidas: [parte(L2, 500)] } as any)).rejects.toThrow(/Já existe um pacote/)
    await expect(b.comando('unificarLotes', { id: L1, ids: [L1, L2] } as any)).rejects.toThrow(/Já existe um pacote/)
    expect((await item(L1)).saldo).toBe(1000)
    expect((await item(L2)).saldo).toBe(2000)
    // a MESMA unificação repetida continua sendo "ok" sem juntar de novo
    await b.comando('unificarLotes', { id: 'u1', ids: [L1, L2] } as any)
    await b.comando('unificarLotes', { id: 'u1', ids: [L1, L2] } as any)
    expect((await item('u1')).saldo).toBe(3000)
  })
})

describe('separarLote idempotente pelo id da separação (A-05)', () => {
  it('retentativa com ids novos das partes não separa duas vezes', async () => {
    const { b, repos, comprar, item } = await base()
    const L = await comprar('c1', 1000, 1000)
    await b.comando('separarLote', { id: 'sep1', loteId: L, quantidadeUsada: 400, saidas: [parte('a1', 400)] } as any)
    const r = await b.comando('separarLote', { id: 'sep1', loteId: L, quantidadeUsada: 400, saidas: [parte('a2', 400)] } as any)
    expect(r.lotes).toEqual(['a1'])
    expect((await item(L)).saldo).toBe(600)
    expect((await repos.itens.listar()).filter((i: any) => i.campos?.separacaoId === 'sep1')).toHaveLength(1)
  })
})

describe('conferência de peso (A-03, A-08)', () => {
  it('A-03: peso a mais ou a menos: o custo dos pacotes soma exatamente o que foi pago', async () => {
    for (const pesado of [1100, 900]) {
      const { b, comprar, item } = await base()
      const L = await comprar('c1', 1000, 1000)
      await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado, motivo: 'balança' } as any)
      await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: pesado, saidas: [parte('s1', pesado - 100), parte('s2', 100)] } as any)
      expect((await item('s1')).custoPrincipal + (await item('s2')).custoPrincipal).toBe(bs(1000))
    }
  })

  it('A-03: conferência depois de separar parte: o resto mantém o custo que sobrava', async () => {
    const { b, comprar, item } = await base()
    const L = await comprar('c1', 1000, 1000)
    await b.comando('triarLotes', { id: 't1', ids: [L], quantidadeUsada: 600, saidas: [parte('s1', 600)] } as any)
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 1100, motivo: 'repesou' } as any)
    expect((await item(L)).saldo).toBe(500)
    await b.comando('triarLotes', { id: 't2', ids: [L], quantidadeUsada: 500, saidas: [parte('s2', 500)] } as any)
    expect((await item('s1')).custoPrincipal + (await item('s2')).custoPrincipal).toBe(bs(1000))
  })

  it('A-03: unificar lote com peso conferido a mais não cria custo', async () => {
    const { b, comprar, item } = await base()
    const L1 = await comprar('c1', 1000, 1000)
    const L2 = await comprar('c2', 1000, 1000)
    await b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 1500, motivo: 'veio mais' } as any)
    await b.comando('unificarLotes', { id: 'u1', ids: [L1, L2] } as any)
    expect((await item('u1')).custoPrincipal).toBe(bs(2000))
  })

  it('A-08: peso absurdo é recusado', async () => {
    const { b, comprar, item } = await base()
    const L = await comprar('c1', 1000, 1000)
    await expect(b.comando('conferirPesoCompra', { compraId: 'c1', linhaId: 'c1l', pesado: 9_000_000_000_000_000, motivo: 'dedo' } as any)).rejects.toThrow()
    expect((await item(L)).saldo).toBe(1000)
  })
})

describe('cancelar compra (A-04, A-07)', () => {
  it('A-04: catálogo: cancelar a 2ª compra tira o custo dela do custo médio', async () => {
    const { b, repos, item } = await base()
    await b.comando('salvarItem', { id: 'p1', moduloId: 'produtos', tipoItem: 'peca', nome: 'Peça Ficticia' } as any)
    for (const [id, v] of [['k1', 100], ['k2', 300]] as const) {
      await b.comando('criarCompra', { id, moduloId: 'produtos', pessoaId: 'f', linhas: [{ id: id + 'l', itemId: 'p1', quantidade: 10, moeda: 'BOB', total: bs(v) }] } as any)
      await b.comando('pagarCompra', { compraId: id, pagamentos: [{ id: id + 'pg', forma: 'dinheiro', moeda: 'BOB', valor: bs(v) }] } as any)
    }
    await b.comando('cancelarCompra', { compraId: 'k2', motivo: 'devolvi' } as any)
    expect((await item('p1')).saldo).toBe(10)
    await b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'v1l', itemId: 'p1', quantidade: 10, moeda: 'BOB', total: bs(10) }], pagamentos: [{ id: 'v1p', forma: 'dinheiro', moeda: 'BOB', valor: bs(10) }] } as any)
    expect((await repos.transacoes.obter('v1')).linhas[0].custoPrincipal).toBe(bs(100))
  })

  it('A-07: triagem desfeita ou venda cancelada (soma zero) não impedem cancelar; triagem ativa impede', async () => {
    const { b, comprar } = await base()
    const L1 = await comprar('c1', 1000, 1000)
    await b.comando('triarLotes', { id: 't1', ids: [L1], quantidadeUsada: 1000, saidas: [parte('s1', 500), parte('s2', 450)] } as any)
    await expect(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'x' } as any)).rejects.toThrow(/já foi separada/)
    await b.comando('desfazerTriagem', { triagemId: 't1', motivo: 'pesei errado' } as any)
    await b.comando('cancelarCompra', { compraId: 'c1', motivo: 'levou de volta' } as any)

    const L2 = await comprar('c2', 1000, 1000)
    await b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'v1l', itemId: L2, quantidade: 200, moeda: 'BOB', total: bs(200) }], pagamentos: [{ id: 'v1p', forma: 'dinheiro', moeda: 'BOB', valor: bs(200) }] } as any)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'desistiu' } as any)
    await b.comando('cancelarCompra', { compraId: 'c2', motivo: 'devolvida' } as any)

    // juntou com outro e desfez: também volta a poder cancelar
    const L3 = await comprar('c3', 1000, 1000)
    const L4 = await comprar('c4', 500, 500)
    await b.comando('triarLotes', { id: 't2', ids: [L3, L4], quantidadeUsada: 1500, saidas: [parte('s3', 1400)] } as any)
    await b.comando('desfazerTriagem', { triagemId: 't2', motivo: 'errado' } as any)
    await b.comando('cancelarCompra', { compraId: 'c3', motivo: 'devolvida' } as any)
  })
})

describe('salvarItem com formulário velho (C-09)', () => {
  it('a tela manda o item como carregou ("antes"): se outra pessoa mudou o formulário, recusa e mantém a mudança dela', async () => {
    const { b, repos } = await base()
    await b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', precoSugerido: { moeda: 'BOB', valor: bs(50) } } as any)
    const carregado = await repos.itens.obter('pc')
    // outra pessoa muda o preço para 70 (a partir do mesmo item)
    await b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', precoSugerido: { moeda: 'BOB', valor: bs(70) }, antes: carregado } as any)
    // a tela velha (que ainda via 50) tenta salvar: recusa
    await expect(b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova grande', precoSugerido: { moeda: 'BOB', valor: bs(50) }, antes: carregado } as any)).rejects.toThrow(/alterado por outra pessoa/)
    expect((await repos.itens.obter('pc')).precoSugerido.valor).toBe(bs(70))
    // abrindo de novo (com o item atual), salva normalmente
    await b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova grande', precoSugerido: { moeda: 'BOB', valor: bs(80) }, antes: await repos.itens.obter('pc') } as any)
    expect((await repos.itens.obter('pc')).nome).toBe('Escova grande')
  })

  it('venda ou ajuste de estoque no meio NÃO gera conflito falso (só os campos do formulário contam)', async () => {
    const { b, repos } = await base()
    await b.comando('salvarItem', { id: 'pc2', moduloId: 'produtos', tipoItem: 'peca', nome: 'Pente', precoSugerido: { moeda: 'BOB', valor: bs(20) }, saldoInicial: 10 } as any)
    const carregado = await repos.itens.obter('pc2')
    await b.comando('ajustarEstoque', { id: 'aj-pc2', itemId: 'pc2', novoSaldo: 7, motivo: 'contagem' } as any)
    expect((await repos.itens.obter('pc2')).versao).not.toBe(carregado.versao)
    await b.comando('salvarItem', { id: 'pc2', moduloId: 'produtos', tipoItem: 'peca', nome: 'Pente fino', precoSugerido: { moeda: 'BOB', valor: bs(25) }, antes: carregado } as any)
    const depois = await repos.itens.obter('pc2')
    expect(depois.nome).toBe('Pente fino')
    expect(depois.saldo).toBe(7)
  })
})
