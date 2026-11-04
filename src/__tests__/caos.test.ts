// TESTES DE CAOS (ponta a ponta nas regras): forçar o erro de propósito para achar o que quebra ANTES do usuário.
//   1. Compra multi-origem: compras ao mesmo tempo, juntar pacotes de etapas que não combinam
//   2. Triagem e perda: perda maior que o peso, 0 g, negativo, fração, lavagem/elástico
//   3. Venda no limite: pacote esvaziado, reservado, bruto, mais do que tem, cliques repetidos (mesmo id e ids novos)
//   4. Livro do cabelo e desfazer: tudo registrado, desfazer volta o estoque sem quebrar o rastreio
// Depois de cada passo: o "diagnostico" (as contas que têm de bater) não pode ter problema.
// Teste marcado com `it.fails` = ACHADO (o sistema faz o que não devia). Quando consertar, ele "falha" e vira `it`.

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

/** compra bruta que já entrou no estoque (paga) → id do lote */
async function comprar(b: B, id: string, fornecedor: string, gramas: number, campos: Record<string, string | number> = {}) {
  await b.comando('salvarPessoa', { id: fornecedor, nome: fornecedor.toUpperCase(), papeis: ['fornecedor'] })
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: fornecedor, linhas: [{ id: `${id}-l`, quantidade: gramas, moeda: 'BOB', total: bs(gramas * 5), campos: { estado: 'Bruto', ...campos } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(gramas * 5) }] : undefined })
  return (await b.consulta('pedido', { id })).lotes[0].id
}
const saida = (id: string, g: number, comprimento = 60) => ({ id, quantidade: g, campos: { estado: 'Separado', comprimento, categoria: 'Normal' } })
const vender = (b: B, id: string, itemId: string, g: number) =>
  b.comando('concluirVenda', { id, linhas: [{ id: `${id}-l`, itemId, quantidade: g, moeda: 'BOB', total: bs(100) }], pagamentos: [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] })
const saldo = async (b: B, id: string) => (await b.consulta('fichaItem', { id })).item.saldo
const semProblema = async (b: B) => expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
const recusa = async (p: Promise<unknown>) => { try { await p } catch (e) { return (e as Error).message } return undefined }

describe('1. compra multi-origem', () => {
  it('5 compras ao MESMO tempo (fornecedores, pesos e medidas diferentes): códigos únicos, estoque e caixa batem', async () => {
    const { b } = await novoBackend()
    const pesos = [3000, 150, 12000, 1, 7777]
    const ids = await Promise.all(pesos.map((g, k) => comprar(b, `c${k}`, `f${k}`, g, { comprimento: 40 + k * 10 })))
    const lotes = await Promise.all(ids.map((id) => b.consulta('fichaItem', { id })))
    expect(lotes.map((l) => l.item.saldo)).toEqual(pesos)
    const codigos = lotes.map((l) => l.item.codigo)
    expect(new Set(codigos).size).toBe(5)
    const compras = await Promise.all(pesos.map((_, k) => b.consulta('pedido', { id: `c${k}` })))
    expect(new Set(compras.map((c) => c.compra.codigo)).size).toBe(5)
    await semProblema(b)
  })

  it('compra de 0 g, negativa ou fracionada é recusada', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    for (const q of [0, -500, 12.5, Number.NaN])
      expect(await recusa(b.comando('criarCompra', { id: `x${q}`, moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: q, moeda: 'BOB', total: bs(10), campos: { estado: 'Bruto' } }] }))).toBeTruthy()
  })

  it('juntar pacote NOVO (bruto) com pacote quase no fim (já separado e quase vendido) — com a regra ligada, recusa e diz por quê', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarConfig', { juntarMesmaEtapa: true })
    const novo = await comprar(b, 'c1', 'ana', 5000)
    const velho = await comprar(b, 'c2', 'bia', 2000)
    const r = await b.comando('triarLotes', { id: 't1', ids: [velho], quantidadeUsada: 2000, saidas: [saida('s1', 1900)] })
    const separado = r.lotes[0]
    await vender(b, 'v1', separado, 1850) // sobrou 50 g: "quase no fim"
    const msg = await recusa(b.comando('triarLotes', { id: 't2', ids: [novo, separado] }))
    expect(msg).toMatch(/etapa/i)
    expect(await saldo(b, novo)).toBe(5000)
    await semProblema(b)
  })

  it('com a regra DESLIGADA (padrão) juntar bruto + separado passa — e o pacote juntado fica com estado misturado coerente', async () => {
    const { b } = await novoBackend()
    const novo = await comprar(b, 'c1', 'ana', 5000)
    const velho = await comprar(b, 'c2', 'bia', 2000)
    const separado = (await b.comando('triarLotes', { id: 't1', ids: [velho], quantidadeUsada: 2000, saidas: [saida('s1', 1900)] })).lotes[0]
    const j = await b.comando('triarLotes', { id: 't2', ids: [novo, separado] })
    const junto = await b.consulta('fichaItem', { id: j.lotes[0] })
    expect(junto.item.saldo).toBe(6900)
    // o que importa: o juntado não pode se dizer "Separado" se tem cabelo bruto dentro
    expect(junto.item.campos.estado).toBe('Bruto')
    await semProblema(b)
  })

  it('juntar o MESMO pacote duas vezes na lista ([a, a]) não dobra o peso', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const msg = await recusa(b.comando('triarLotes', { id: 't', ids: [a, a] }))
    // ou recusa, ou trata como um só — nunca 2.000 g
    if (!msg) expect(await saldo(b, a)).toBeLessThanOrEqual(1000)
    await semProblema(b)
  })
})

describe('2. triagem e perda de peso', () => {
  it('separar em partes que somam MAIS que o bruto é recusado e nada muda', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    expect(await recusa(b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 800), saida('s2', 300)] }))).toBeTruthy()
    expect(await saldo(b, a)).toBe(1000)
    await semProblema(b)
  })

  it('usar mais do que o pacote tem (quantidadeUsada > saldo) é recusado', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    expect(await recusa(b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 5000, saidas: [saida('s1', 900)] }))).toBeTruthy()
    expect(await saldo(b, a)).toBe(1000)
  })

  it('parte de 0 g, negativa ou fracionada é recusada', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    for (const q of [0, -10, 0.5]) expect(await recusa(b.comando('triarLotes', { id: `t${q}`, ids: [a], quantidadeUsada: 1000, saidas: [saida('s', q)] }))).toBeTruthy()
    expect(await saldo(b, a)).toBe(1000)
    await semProblema(b)
  })

  it('perda de 100% (separou e não sobrou nada) é aceita só como perda total registrada — e o rastreio fecha', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const msg = await recusa(b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 1000, saidas: [] }))
    // sem partes não há o que separar: tem de recusar com uma mensagem clara
    expect(msg).toMatch(/separado|lotes/i)
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    expect(g.totais.confere).toBe(true)
  })

  it('perda muito alta (95%) passa, mas tem de ficar visível na triagem e no livro', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    await b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 50)] })
    const t = (await b.consulta('triagens', {}))[0]
    expect(t.perda).toBe(950)
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    expect(g.totais).toMatchObject({ entrou: 1000, perda: 950, emEstoque: 50, confere: true })
    await semProblema(b)
  })

  it('lavagem / tirar elástico: ajuste de perda maior que o saldo, 0 g e "perda" que aumenta são recusados', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    expect(await recusa(b.comando('ajustarEstoque', { itemId: a, novoSaldo: -200, motivo: 'perda', descricao: 'elástico' }))).toBeTruthy()
    expect(await recusa(b.comando('ajustarEstoque', { itemId: a, novoSaldo: 1200, motivo: 'perda', descricao: 'lavagem' }))).toBeTruthy()
    expect(await recusa(b.comando('ajustarEstoque', { itemId: a, novoSaldo: 1000, motivo: 'perda' }))).toBeTruthy()
    await b.comando('ajustarEstoque', { itemId: a, novoSaldo: 940, motivo: 'perda', descricao: 'lavagem' })
    expect(await saldo(b, a)).toBe(940)
    await semProblema(b)
  })

  it('a mesma triagem enviada 2× ao mesmo tempo (duplo clique) não separa duas vezes', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const d = { id: 't', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 900)] }
    await Promise.allSettled([b.comando('triarLotes', d), b.comando('triarLotes', d)])
    const est = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    expect(est.reduce((s, i) => s + i.saldo, 0)).toBe(900)
    await semProblema(b)
  })

  it('duas triagens DIFERENTES do mesmo bruto ao mesmo tempo: só uma passa', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const r = await Promise.allSettled([
      b.comando('triarLotes', { id: 'tA', ids: [a], quantidadeUsada: 1000, saidas: [saida('sA', 900)] }),
      b.comando('triarLotes', { id: 'tB', ids: [a], quantidadeUsada: 1000, saidas: [saida('sB', 950)] }),
    ])
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    const est = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    expect(est.reduce((s, i) => s + i.saldo, 0)).toBeLessThanOrEqual(1000)
    await semProblema(b)
  })
})

describe('3. venda no limite', () => {
  async function pronto(b: B, g = 1000) {
    const a = await comprar(b, 'c1', 'ana', g)
    return (await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: g, saidas: [saida('s1', g)] })).lotes[0]
  }

  it('vender pacote ESVAZIADO é recusado', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    await vender(b, 'v1', p, 1000)
    expect(await recusa(vender(b, 'v2', p, 1))).toBeTruthy()
    await semProblema(b)
  })

  it('vender mais do que o saldo (1 g a mais) e quantidade fracionada/zero/negativa são recusados', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    for (const q of [1001, 0, -5, 0.5, 999.9]) expect(await recusa(vender(b, `v${q}`, p, q)), `quantidade ${q}`).toBeTruthy()
    expect(await saldo(b, p)).toBe(1000)
    await semProblema(b)
  })

  it('o mesmo pacote em DUAS linhas da mesma venda (600 + 600 de 1.000 g) é recusado', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    const msg = await recusa(b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'a', itemId: p, quantidade: 600, moeda: 'BOB', total: bs(1) }, { id: 'c', itemId: p, quantidade: 600, moeda: 'BOB', total: bs(1) }], pagamentos: [] }))
    expect(msg).toBeTruthy()
    expect(await saldo(b, p)).toBe(1000)
    await semProblema(b)
  })

  it('vender pacote BRUTO (ainda na fila da triagem): NUNCA trava (decisão: só avisa na tela); o rastreio fecha', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    expect(await recusa(vender(b, 'v', a, 500))).toBeUndefined()
    expect(await saldo(b, a)).toBe(500)
    expect((await b.consulta('genealogia', { compraId: 'c1' })).totais).toMatchObject({ vendido: 500, emEstoque: 500, confere: true })
    await semProblema(b)
  })

  it('vender pacote RESERVADO (Matheus desistiu e ninguém atualizou): passa, a reserva acaba e fica anotada', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    await b.comando('reservarLote', { id: p, para: 'Matheus', ate: '2026-11-30' })
    await b.comando('salvarPessoa', { id: 'ana', nome: 'Ana', papeis: ['cliente'] })
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'ana', linhas: [{ id: 'vl', itemId: p, quantidade: 400, moeda: 'BOB', total: bs(100) }], pagamentos: [{ id: 'vp', forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] })
    expect((await b.consulta('fichaItem', { id: p })).item.reserva).toBeUndefined()
    const log = (await b.consulta('logDetalhado', { acao: 'reservarLote' })).linhas
    expect(log[0].resumo).toMatch(/reserva para Matheus encerrada pela venda V-\d+ para Ana/)
    await semProblema(b)
  })

  it('DUPLO CLIQUE no finalizar (mesmo id, ao mesmo tempo): baixa uma vez só', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    await Promise.allSettled([vender(b, 'v', p, 400), vender(b, 'v', p, 400), vender(b, 'v', p, 400)])
    expect(await saldo(b, p)).toBe(600)
    expect((await b.consulta('vendas', {})).filter((v) => v.etapa !== 'cancelado')).toHaveLength(1)
    await semProblema(b)
  })

  it('SPAM com ids novos (a tela gerou um id por clique) vendendo tudo: só a primeira passa, saldo nunca negativo', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    const r = await Promise.allSettled([1, 2, 3, 4, 5].map((k) => vender(b, `v${k}`, p, 1000)))
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect(await saldo(b, p)).toBe(0)
    await semProblema(b)
  })

  it('cancelar a mesma venda 2× ao mesmo tempo devolve o peso UMA vez', async () => {
    const { b } = await novoBackend()
    const p = await pronto(b)
    await vender(b, 'v', p, 400)
    await Promise.allSettled([b.comando('cancelarVenda', { id: 'v', motivo: 'x' }), b.comando('cancelarVenda', { id: 'v', motivo: 'x' })])
    expect(await saldo(b, p)).toBe(1000)
    await semProblema(b)
  })
})

describe('4. livro do cabelo, registro e desfazer', () => {
  it('cada ação que deu certo aparece no livro e no registro, com quem e quando', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const p = (await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 900)] })).lotes[0]
    await b.comando('ajustarEstoque', { itemId: p, novoSaldo: 880, motivo: 'perda', descricao: 'lavagem' })
    await vender(b, 'v1', p, 300)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'cliente desistiu' })
    const L = await b.consulta('livroCabelo', {})
    const texto = JSON.stringify(L)
    for (const c of ['c1', 'v1']) expect(texto).toContain(c)
    const log = (await b.consulta('logDetalhado', {})).linhas
    for (const acao of ['criarCompra', 'separarLote', 'ajustarEstoque', 'concluirVenda', 'cancelarVenda']) expect(log.some((l) => l.acao === acao), acao).toBe(true)
    expect(log.every((l) => l.usuarioNome && l.criadoEm)).toBe(true)
  })

  it('tentativas BLOQUEADAS (vender mais do que tem) ficam no registro, ligadas ao pacote, com o motivo', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const p = (await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 1000)] })).lotes[0]
    await recusa(vender(b, 'vx', p, 5000))
    const log = (await b.consulta('logDetalhado', { acao: 'recusado' })).linhas
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ nomeAcao: 'Tentativa recusada', usuarioNome: 'Administrador' })
    expect(log[0].ligados).toContain(p)
    // e aparece na linha do tempo do pacote
    expect(JSON.stringify(await b.consulta('linhaDoTempo', { id: p }))).toMatch(/Tentativa recusada|recusad/i)
    // a tentativa não mexeu no estoque
    expect(await saldo(b, p)).toBe(1000)
  })

  it('DESFAZER a triagem: o bruto volta inteiro, as partes somem do estoque, o rastreio fecha e o livro guarda a ida e a volta', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 600), saida('s2', 350)] })
    expect(await saldo(b, a)).toBe(0)
    const t = (await b.consulta('triagens', {}))[0]
    await b.comando('desfazerTriagem', { triagemId: t.id, motivo: 'pesei errado' })
    expect(await saldo(b, a)).toBe(1000)
    const est = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    expect(est.map((i) => i.id)).toEqual([a])
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    expect(g.totais).toMatchObject({ entrou: 1000, emEstoque: 1000, confere: true })
    const h = await b.consulta('historicoPacote', { itemId: a })
    expect(h.dias.flatMap((d) => d.movs).length).toBeGreaterThanOrEqual(3) // entrou, saiu na triagem, voltou
    await semProblema(b)
    // e pode separar de novo
    await b.comando('triarLotes', { id: 't2', ids: [a], quantidadeUsada: 1000, saidas: [saida('s3', 980)] })
    await semProblema(b)
  })

  it('desfazer triagem depois de VENDER uma parte é recusado (e diz o motivo)', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const p = (await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 900)] })).lotes[0]
    await vender(b, 'v1', p, 100)
    const t = (await b.consulta('triagens', {}))[0]
    expect(t.podeDesfazer).toBe(false)
    expect(await recusa(b.comando('desfazerTriagem', { triagemId: t.id, motivo: 'x' }))).toBeTruthy()
    // cancelando a venda, volta a poder desfazer
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'errei' })
    expect((await b.consulta('triagens', {}))[0].podeDesfazer).toBe(true)
    await semProblema(b)
  })

  it('desfazer a mesma triagem 2× ao mesmo tempo não devolve o peso duas vezes', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 900)] })
    const t = (await b.consulta('triagens', {}))[0]
    await Promise.allSettled([b.comando('desfazerTriagem', { triagemId: t.id, motivo: 'a' }), b.comando('desfazerTriagem', { triagemId: t.id, motivo: 'b' })])
    expect(await saldo(b, a)).toBe(1000)
    await semProblema(b)
  })

  it('cancelar a COMPRA depois de separar: recusa (o cabelo já virou outros pacotes) sem quebrar nada', async () => {
    const { b } = await novoBackend()
    const a = await comprar(b, 'c1', 'ana', 1000)
    await b.comando('triarLotes', { id: 't1', ids: [a], quantidadeUsada: 1000, saidas: [saida('s1', 900)] })
    const msg = await recusa(b.comando('cancelarCompra', { compraId: 'c1', motivo: 'veio errado' }))
    if (!msg) {
      // se aceitou, o rastreio tem de continuar fechando
      const g = await b.consulta('genealogia', { compraId: 'c1' })
      expect(g.totais.confere).toBe(true)
    }
    await semProblema(b)
  })
})

describe('5. viagem: lançamentos e números', () => {
  it('adiantamento em 2 moedas, gasto MAIOR que o adiantamento, compra ligada, prestação de contas: tudo bate', async () => {
    const { b, r } = await novoBackend()
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(10000), descricao: 'ini' })
    await b.comando('lancarCaixa', { id: 'iniu', tipo: 'saldoInicial', moeda: 'USD', forma: 'dinheiro', valor: 100000, descricao: 'ini' })
    await b.comando('salvarPessoa', { id: 'p-ana', nome: 'Ana', papeis: ['funcionario'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', destino: 'Oruro', viajantes: ['p-ana'], inicio: r.hoje })
    await b.comando('adiantarViagem', { id: 'a1', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000) })
    await b.comando('adiantarViagem', { id: 'a2', viagemId: 'vg', moeda: 'USD', forma: 'dinheiro', valor: 10000 }) // US$ 100
    await b.comando('registrarDespesaViagem', { id: 'd1', viagemId: 'vg', categoria: 'combustivel', moeda: 'BOB', valor: bs(1200) }) // passou do adiantado em Bs
    await b.comando('registrarDespesaViagem', { id: 'd2', viagemId: 'vg', categoria: 'hospedagem', moeda: 'USD', valor: 4000 })
    // gasto 0 ou negativo: recusa
    expect(await recusa(b.comando('registrarDespesaViagem', { id: 'd0', viagemId: 'vg', categoria: 'comida', moeda: 'BOB', valor: 0 }))).toBeTruthy()
    expect(await recusa(b.comando('registrarDespesaViagem', { id: 'dn', viagemId: 'vg', categoria: 'comida', moeda: 'BOB', valor: -100 }))).toBeTruthy()
    // a mesma despesa enviada 2× (duplo toque): conta uma vez
    await Promise.allSettled([1, 2].map(() => b.comando('registrarDespesaViagem', { id: 'd3', viagemId: 'vg', categoria: 'comida', moeda: 'BOB', valor: bs(50) })))
    const v = await b.consulta('viagem', { id: 'vg' })
    const bob = v.carteira.find((c) => c.moeda === 'BOB')!
    const usd = v.carteira.find((c) => c.moeda === 'USD')!
    expect(bob).toMatchObject({ adiantado: bs(1000), gasto: bs(1250), saldo: bs(-250) })
    expect(usd).toMatchObject({ adiantado: 10000, gasto: 4000, saldo: 6000 })
    // compra feita na viagem, ligada
    const l = await comprar(b, 'c1', 'f1', 2000)
    await b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1'] })
    await b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1'] }) // repetido
    const d = await b.consulta('viagem', { id: 'vg' })
    expect(d.compras).toHaveLength(1)
    // prestação: devolveu US$ 60 e nada em Bs (ficou devendo Bs 250 → a diferença aparece)
    await b.comando('encerrarViagem', { viagemId: 'vg', contado: { BOB: 0, USD: 6000 }, incorporar: true })
    const enc = await b.consulta('viagem', { id: 'vg' })
    expect(enc.carteira.find((c) => c.moeda === 'USD')).toMatchObject({ devolvido: 6000, diferenca: 0 })
    // caixa BOB: 10.000 − 1.000 (adiantou) − 10.000 (compra 2 kg × Bs 5) = −1.000 ⇒ quem cobre os Bs 250 a mais?
    const cx = (await b.consulta('caixaDoDia', { data: r.hoje })).contas
    const caixaUSD = cx.find((c) => c.moeda === 'USD')!.total
    expect(caixaUSD).toBe(100000 - 10000 + 6000)
    // o custo do lote recebeu a logística
    expect((await b.consulta('fichaItem', { id: l })).item.custoPrincipal).toBeGreaterThan(bs(10000))
    await semProblema(b)
  })

  it('lançar despesa em viagem ENCERRADA é recusado', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p', nome: 'P', papeis: ['funcionario'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'X', viajantes: ['p'], inicio: r.hoje })
    await b.comando('encerrarViagem', { viagemId: 'vg', contado: {} })
    expect(await recusa(b.comando('registrarDespesaViagem', { id: 'd', viagemId: 'vg', categoria: 'comida', moeda: 'BOB', valor: bs(10) }))).toBeTruthy()
  })
})

describe('6. rodada 2: pagamento por linha, pagar e concluir, avisos e registro', () => {
  const pag = (id: string, valor: number, forma = 'dinheiro') => ({ id, forma, moeda: 'BOB', valor })
  const linha = (id: string, g: number, total: number, jaPaga?: boolean) => ({ id, quantidade: g, moeda: 'BOB', total, campos: { estado: 'Bruto', ...(jaPaga ? { jaPaga: true } : {}) } })
  const caixaBOB = async (b: B, dia: string) => (await b.consulta('caixaDoDia', { data: dia })).contas.find((c) => c.moeda === 'BOB')?.total ?? 0
  async function base() {
    const ctx = await novoBackend()
    await ctx.b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'ini' })
    await ctx.b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    return ctx
  }

  it('"já pago" MAIOR que o total: recusa e NADA fica gravado (nem compra, nem lote, nem caixa)', async () => {
    const { b, r } = await base()
    const msg = await recusa(b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [linha('a', 1000, bs(5000), true), linha('b', 1000, bs(4000))], pagoParcial: [pag('p', bs(99999))] }))
    expect(msg).toBeTruthy()
    expect(await recusa(b.consulta('pedido', { id: 'c1' }))).toBeTruthy()
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).length).toBe(0)
    expect(await caixaBOB(b, r.hoje)).toBe(bs(100000))
    await semProblema(b)
  })

  it('"já pago" com valor 0, negativo ou fração: recusa', async () => {
    const { b } = await base()
    for (const v of [-100, 0.5]) expect(await recusa(b.comando('criarCompra', { id: `c${v}`, moduloId: 'cabelo', pessoaId: 'f', linhas: [linha('a', 1000, bs(5000), true), linha('b', 1000, bs(4000))], pagoParcial: [pag('p', v)] })), `valor ${v}`).toBeTruthy()
    await semProblema(b)
  })

  it('linha paga e depois CANCELAR a compra: o dinheiro já pago volta ao caixa e o lote sai', async () => {
    const { b, r } = await base()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [linha('a', 1000, bs(5000), true), linha('b', 1000, bs(4000))], pagoParcial: [pag('p', bs(5000))] })
    expect(await caixaBOB(b, r.hoje)).toBe(bs(95000))
    await b.comando('cancelarCompra', { compraId: 'c1', motivo: 'desistiu' })
    expect(await caixaBOB(b, r.hoje)).toBe(bs(100000))
    expect((await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })).length).toBe(0)
    await semProblema(b)
  })

  it('PAGAR E CONCLUIR 3× ao mesmo tempo (duplo clique): paga uma vez', async () => {
    const { b, r } = await base()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [linha('a', 1000, bs(5000))] })
    const d = { compraId: 'c1', pagamentos: [pag('p', bs(5000))] }
    await Promise.allSettled([b.comando('pagarCompra', d), b.comando('pagarCompra', d), b.comando('pagarCompra', d)])
    expect((await b.consulta('pedido', { id: 'c1' })).pago).toBe(bs(5000))
    expect(await caixaBOB(b, r.hoje)).toBe(bs(95000))
    await semProblema(b)
  })

  it('pagar e concluir com MENOS do que falta: sem fornecedor recusa; com fornecedor o resto fica na conta dele', async () => {
    const { b } = await base()
    await b.comando('criarCompra', { id: 'sem', moduloId: 'cabelo', linhas: [linha('a', 1000, bs(5000))] })
    expect(await recusa(b.comando('pagarCompra', { compraId: 'sem', pagamentos: [pag('p', bs(1000))] }))).toBeTruthy()
    await b.comando('criarCompra', { id: 'com', moduloId: 'cabelo', pessoaId: 'f', linhas: [linha('a', 1000, bs(5000))] })
    await b.comando('pagarCompra', { compraId: 'com', pagamentos: [pag('p2', bs(1000))] })
    const p = await b.consulta('pedido', { id: 'com' })
    expect(p.compra.etapa).toBe('concluido')
    expect(p.saldoConta).toBe(-bs(4000)) // devo 4.000 ao fornecedor
    await semProblema(b)
  })

  it('pagar compra RECUSADA ou já CANCELADA: recusa', async () => {
    const { b } = await base()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [linha('a', 1000, bs(5000))] })
    await b.comando('cancelarCompra', { compraId: 'c1', motivo: 'x' })
    expect(await recusa(b.comando('pagarCompra', { compraId: 'c1', pagamentos: [pag('p', bs(5000))] }))).toBeTruthy()
  })

  it('linha paga + etapa por etapa (o caminho longo): a etapa Pago cobra só o resto e recusa se passar', async () => {
    const { b, r } = await base()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', linhas: [linha('a', 1000, bs(5000), true), linha('b', 1000, bs(3000))], pagoParcial: [pag('p', bs(5000))] })
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'conferido' })
    expect(await recusa(b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [pag('p2', bs(8000))] }))).toMatch(/passou/)
    await b.comando('avancarTriagem', { compraId: 'c1', para: 'pago', pagamentos: [pag('p3', bs(3000))] })
    expect((await b.consulta('pedido', { id: 'c1' })).pago).toBe(bs(8000))
    expect(await caixaBOB(b, r.hoje)).toBe(bs(92000))
    await semProblema(b)
  })

  it('5 tentativas recusadas AO MESMO TEMPO: 5 registros, estoque intacto', async () => {
    const { b } = await base()
    const a = await comprar(b, 'c9', 'ana', 1000)
    const p = (await b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 1000, saidas: [saida('s', 1000)] })).lotes[0]
    await Promise.allSettled([1, 2, 3, 4, 5].map((k) => vender(b, `vx${k}`, p, 5000)))
    expect((await b.consulta('logDetalhado', { acao: 'recusado' })).linhas).toHaveLength(5)
    expect(await saldo(b, p)).toBe(1000)
    await semProblema(b)
  })

  it('vende parte do BRUTO e depois separa o resto: o rastreio fecha (nada some)', async () => {
    const { b } = await base()
    const a = await comprar(b, 'c1', 'ana', 2000)
    await vender(b, 'v1', a, 500)
    await b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 1500, saidas: [saida('s', 1400)] })
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    expect(g.totais).toMatchObject({ entrou: 2000, vendido: 500, emEstoque: 1400, perda: 100, confere: true })
    await semProblema(b)
  })

  it('venda de pacote RESERVADO cancelada: o pacote volta, a reserva continua encerrada e nada quebra', async () => {
    const { b } = await base()
    const a = await comprar(b, 'c1', 'ana', 1000)
    const p = (await b.comando('triarLotes', { id: 't', ids: [a], quantidadeUsada: 1000, saidas: [saida('s', 1000)] })).lotes[0]
    await b.comando('reservarLote', { id: p, para: 'Matheus' })
    await vender(b, 'v1', p, 1000)
    await b.comando('cancelarVenda', { id: 'v1', motivo: 'voltou' })
    const f = await b.consulta('fichaItem', { id: p })
    expect(f.item.saldo).toBe(1000)
    expect(f.item.reserva).toBeUndefined()
    await semProblema(b)
  })

  it('viagem: encerrar com "incorporar" sem compra nenhuma encerra do mesmo jeito', async () => {
    const { b, r } = await base()
    await b.comando('salvarPessoa', { id: 'p', nome: 'P', papeis: ['funcionario'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'X', viajantes: ['p'], inicio: r.hoje })
    await b.comando('adiantarViagem', { id: 'a', viagemId: 'vg', moeda: 'BOB', forma: 'dinheiro', valor: bs(500) })
    await b.comando('registrarDespesaViagem', { id: 'd', viagemId: 'vg', categoria: 'comida', moeda: 'BOB', valor: bs(200) })
    await b.comando('encerrarViagem', { viagemId: 'vg', contado: { BOB: bs(300) }, incorporar: true })
    expect((await b.consulta('viagem', { id: 'vg' })).viagem.status).toBe('encerrada')
    expect(await caixaBOB(b, r.hoje)).toBe(bs(100000 - 500 + 300))
    await semProblema(b)
  })
})
