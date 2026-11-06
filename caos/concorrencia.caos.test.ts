// OPERAÇÃO CAOS — CONCORRÊNCIA: duas abas (duas filas) no MESMO IndexedDB, comandos disparados juntos.
// Teste que FALHA = bug (cada um afirma o comportamento CERTO). Dados fictícios.
import { describe, expect, it } from 'vitest'
import { bs } from '../src/__tests__/ajuda'
import { abrirAbas, base, compraPaga, compraAberta, venda, repos, saldo, caixaBOB, auditoriaDe, entrarComo, resultado, type B, type Q , SENHA_TESTE } from './abas'
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

describe('CORRIDAS entre duas abas (fila por aba, mesmo banco)', () => {
  it('C01 duas abas vendem os últimos 700 g de um lote de 1000 g ao mesmo tempo → só uma vende', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const cx0 = await caixaBOB(A.b, r.hoje)
    const rs = await Promise.all([resultado(A.b.comando('concluirVenda', venda('v1', lote, 700))), resultado(Bb.b.comando('concluirVenda', venda('v2', lote, 700)))])
    expect(ok(rs)).toBe(1)
    expect(await saldo(Bb.b, lote)).toBe(300)
    expect(await caixaBOB(Bb.b, r.hoje)).toBe(cx0 + bs(100))
    await integras(A.b, Bb.b)
  })

  it('C02 duas abas criam 10 compras cada ao mesmo tempo → códigos P e L sem repetir', async () => {
    const { A, Bb } = await cenario()
    await Promise.all([
      ...Array.from({ length: 10 }, (_, i) => compraAberta(A.b, `ca${i}`)),
      ...Array.from({ length: 10 }, (_, i) => compraAberta(Bb.b, `cb${i}`)),
    ])
    const compras = (await repos(A.b).transacoes.listar({ tipo: 'compra' })) as Q[]
    expect(new Set(compras.map((c) => c.codigo)).size).toBe(20)
    const lotes = ((await repos(A.b).itens.listar()) as Q[]).filter((i) => i.controlaEstoque)
    expect(new Set(lotes.map((l) => l.codigo)).size).toBe(lotes.length)
    expect(lotes.length).toBe(20)
    expect((await auditoriaDe(A.b, 'criarCompra')).length).toBe(20)
    await integras(A.b, Bb.b)
  })

  it('C03 duas abas fazem 10 vendas cada ao mesmo tempo → códigos V sem repetir e estoque certo', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1', 5000)
    const rs = await Promise.all([
      ...Array.from({ length: 10 }, (_, i) => resultado(A.b.comando('concluirVenda', venda(`va${i}`, lote, 100)))),
      ...Array.from({ length: 10 }, (_, i) => resultado(Bb.b.comando('concluirVenda', venda(`vb${i}`, lote, 100)))),
    ])
    expect(ok(rs)).toBe(20)
    const vendas = (await repos(A.b).transacoes.listar({ tipo: 'venda' })) as Q[]
    expect(new Set(vendas.map((v) => v.codigo)).size).toBe(20)
    expect(await saldo(A.b, lote)).toBe(3000)
    await integras(A.b, Bb.b)
  })

  it('C04 duas abas separam (separarLote) o mesmo lote inteiro ao mesmo tempo → só uma separa', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const sep = (id: string) => ({ id, loteId: lote, quantidadeUsada: 1000, saidas: [{ id: id + '-a', quantidade: 600, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }, { id: id + '-b', quantidade: 400, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } }] }) as Q
    const rs = await Promise.all([resultado(A.b.comando('separarLote', sep('sA'))), resultado(Bb.b.comando('separarLote', sep('sB')))])
    expect(ok(rs)).toBe(1)
    expect(await saldo(A.b, lote)).toBe(0)
    const filhos = ((await repos(A.b).itens.listar()) as Q[]).filter((i) => i.controlaEstoque && i.id !== lote && i.saldo > 0)
    expect(filhos.reduce((s, i) => s + i.saldo, 0)).toBe(1000)
    await integras(A.b, Bb.b)
  })

  it('C05 aba A ajusta o estoque (contagem 800 g) enquanto a aba B vende 300 g → saldo = movimentos, nada negativo', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await Promise.all([resultado(A.b.comando('ajustarEstoque', { itemId: lote, novoSaldo: 800, motivo: 'ajuste', descricao: 'contagem' })), resultado(Bb.b.comando('concluirVenda', venda('v1', lote, 300)))])
    const movs = ((await repos(A.b).movEstoque.listar({ itemId: lote })) as Q[]).reduce((s, m) => s + m.delta, 0)
    expect(await saldo(A.b, lote)).toBe(movs)
    expect([500, 800]).toContain(movs)
    expect((await auditoriaDe(A.b, 'ajustarEstoque')).length).toBe(1)
    await integras(A.b, Bb.b)
  })

  it('C06 aba A cancela a compra enquanto a aba B separa o lote dela → uma das duas é recusada; nada pela metade', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const rs = await Promise.all([
      resultado(A.b.comando('cancelarCompra', { compraId: 'c1', motivo: 'errada' })),
      resultado(Bb.b.comando('separarLote', { id: 's1', loteId: lote, quantidadeUsada: 1000, saidas: [{ id: 's1-a', quantidade: 1000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] } as Q)),
    ])
    expect(ok(rs)).toBe(1)
    const c = await repos(A.b).transacoes.obter('c1')
    if (rs[0] === 'ok') expect(c.etapa).toBe('cancelado')
    else expect(await saldo(A.b, 's1-a')).toBe(1000)
    await integras(A.b, Bb.b)
  })

  it('C07 aba A cancela a compra enquanto a aba B vende parte do lote → nunca as duas', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const rs = await Promise.all([resultado(Bb.b.comando('concluirVenda', venda('v1', lote, 200))), resultado(A.b.comando('cancelarCompra', { compraId: 'c1', motivo: 'errada' }))])
    expect(ok(rs)).toBe(1)
    expect(await saldo(A.b, lote)).toBeGreaterThanOrEqual(0)
    expect(await caixaBOB(A.b, r.hoje)).toBe(bs(100000) - bs(1000) + (rs[0] === 'ok' ? bs(100) : bs(1000)))
    await integras(A.b, Bb.b)
  })

  it('C08 mesma venda (mesmo id) mandada pelas duas abas (toque duplo em dois aparelhos) → uma venda, um caixa', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    const cx0 = await caixaBOB(A.b, r.hoje)
    await Promise.all([A.b.comando('concluirVenda', venda('vX', lote, 100)), Bb.b.comando('concluirVenda', venda('vX', lote, 100))])
    expect(await saldo(A.b, lote)).toBe(900)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx0 + bs(100))
    await integras(A.b, Bb.b)
  })

  it('C09 duas abas pagam a MESMA compra em aberto ao mesmo tempo (pagamentos com ids diferentes) → paga uma vez', async () => {
    const { A, Bb, r } = await cenario()
    await compraAberta(A.b, 'c1')
    const cx0 = await caixaBOB(A.b, r.hoje)
    const pag = (id: string) => ({ compraId: 'c1', pagamentos: [{ id, forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] }) as Q
    await Promise.all([resultado(A.b.comando('pagarCompra', pag('pA'))), resultado(Bb.b.comando('pagarCompra', pag('pB')))])
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx0 - bs(1000))
    expect((await repos(A.b).transacoes.obter('c1')).etapa).toBe('concluido')
    await integras(A.b, Bb.b)
  })

  it('C10 duas abas recebem o saldo inteiro do MESMO adiantamento (ids diferentes) → a segunda é recusada', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('criarFinanciamento', { id: 'ad', pessoaId: 'forn', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' } as Q)
    const cx0 = await caixaBOB(A.b, r.hoje)
    const rec = (id: string) => ({ id, financiamentoId: 'ad', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro' }) as Q
    const rs = await Promise.all([resultado(A.b.comando('receberFinanciamento', rec('rA'))), resultado(Bb.b.comando('receberFinanciamento', rec('rB')))])
    expect(ok(rs)).toBe(1)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx0 + bs(5000))
    expect(((await A.b.consulta('financiamento', { id: 'ad' })) as Q).saldo).toBe(0)
    await integras(A.b, Bb.b)
  })

  it('C11 duas abas quitam o MESMO empréstimo ao mesmo tempo → recebido uma vez', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('criarEmprestimo', { id: 'emp', direcao: 'dado', pessoaId: 'forn', moeda: 'BOB', principal: bs(1000), juros: { tipo: 'nenhum' }, parcelas: 2, primeiroVencimento: '2026-11-15', forma: 'dinheiro' } as Q)
    const cx0 = await caixaBOB(A.b, r.hoje)
    const rs = await Promise.all([
      resultado(A.b.comando('pagarEmprestimo', { id: 'pa', emprestimoId: 'emp', valor: bs(1000), forma: 'dinheiro' })),
      resultado(Bb.b.comando('pagarEmprestimo', { id: 'pb', emprestimoId: 'emp', valor: bs(1000), forma: 'dinheiro' })),
    ])
    expect(ok(rs)).toBe(1)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx0 + bs(1000))
    await integras(A.b, Bb.b)
  })

  it('C12 duas abas cancelam a MESMA venda ao mesmo tempo → estoque e caixa voltam uma vez só', async () => {
    const { A, Bb, r } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await A.b.comando('concluirVenda', venda('v1', lote, 400))
    const cx = await caixaBOB(A.b, r.hoje)
    const rs = await Promise.all([resultado(A.b.comando('cancelarVenda', { id: 'v1', motivo: 'a' })), resultado(Bb.b.comando('cancelarVenda', { id: 'v1', motivo: 'b' }))])
    expect(ok(rs)).toBe(1)
    expect(await saldo(A.b, lote)).toBe(1000)
    expect(await caixaBOB(A.b, r.hoje)).toBe(cx - bs(100))
    await integras(A.b, Bb.b)
  })

  it('C13 duas abas trocam o código de compras diferentes para o MESMO código ao mesmo tempo → sem código repetido', async () => {
    const { A, Bb } = await cenario()
    await compraAberta(A.b, 'c1')
    await compraAberta(A.b, 'c2')
    await Promise.all([
      resultado(A.b.comando('trocarCodigoCompra', { id: 'c1', codigo: 'ZZ-1', motivo: 'teste' } as Q)),
      resultado(Bb.b.comando('trocarCodigoCompra', { id: 'c2', codigo: 'ZZ-1', motivo: 'teste' } as Q)),
    ])
    const cods = ((await repos(A.b).transacoes.listar({ tipo: 'compra' })) as Q[]).map((c) => c.codigo)
    expect(cods.filter((c) => c === 'ZZ-1').length).toBe(1)
    await integras(A.b, Bb.b)
  })

  it('C14 duas abas criam compras com o MESMO código digitado ao mesmo tempo → uma recusada', async () => {
    const { A, Bb } = await cenario()
    const c = (id: string) => ({ id, moduloId: 'cabelo', pessoaId: 'forn', codigo: 'MAN-7', linhas: [{ id: id + 'l', quantidade: 100, moeda: 'BOB', total: bs(10), campos: { estado: 'Bruto', categoria: 'Normal' } }] }) as Q
    const rs = await Promise.all([resultado(A.b.comando('criarCompra', c('k1'))), resultado(Bb.b.comando('criarCompra', c('k2')))])
    expect(ok(rs)).toBe(1)
    await integras(A.b, Bb.b)
  })

  it('C15 30 operações rápidas na aba A enquanto a aba B desfaz (cancela vendas e desfaz triagem) → íntegro', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1', 10000, bs(10000))
    const lote2 = await compraPaga(A.b, 'c2', 2000, bs(2000))
    await A.b.comando('separarLote', { id: 'tri', loteId: lote2, quantidadeUsada: 2000, saidas: [{ id: 't-a', quantidade: 1000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }, { id: 't-b', quantidade: 1000, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } }] } as Q)
    const triagemId = ((await repos(A.b).itens.obter('t-a')) as Q).triagem?.id ?? 'tri'
    const opsA = Array.from({ length: 30 }, (_, i) => resultado(A.b.comando('concluirVenda', venda(`r${i}`, lote, 100))))
    const opsB = [
      ...Array.from({ length: 10 }, (_, i) => resultado(Bb.b.comando('cancelarVenda', { id: `r${i * 3}`, motivo: 'desfaz' }))),
      resultado(Bb.b.comando('desfazerTriagem', { triagemId, motivo: 'pesei errado' } as Q)),
    ]
    const ra = await Promise.all(opsA)
    const rb = await Promise.all(opsB)
    expect(ok(ra)).toBe(30)
    expect(rb[10]).toBe('ok')
    const canceladas = rb.slice(0, 10).filter((x) => x === 'ok').length
    expect(await saldo(A.b, lote)).toBe(10000 - 3000 + canceladas * 100)
    expect(await saldo(A.b, lote2)).toBe(2000)
    await integras(A.b, Bb.b)
  })
})

describe('LOST UPDATE: aba A salva o objeto velho depois que a aba B mudou', () => {
  it('C16 salvarPessoa com o formulário velho apaga o telefone que a outra aba acabou de trocar', async () => {
    const { A, Bb } = await cenario()
    const velho = await repos(A.b).pessoas.obter('forn')
    await Bb.b.comando('salvarPessoa', { id: 'forn', nome: velho.nome, papeis: velho.papeis, telefone: '999' })
    // aba A (formulário aberto antes) só mudou a observação, mas a tela manda o formulário inteiro
    // a tela velha manda a versão que CARREGOU (igual às telas de verdade, desde a correção): o servidor sabe que é velha
    await resultado(A.b.comando('salvarPessoa', { id: 'forn', nome: velho.nome, papeis: velho.papeis, telefone: velho.telefone, obs: 'nova obs', versaoBase: velho.versao } as Q))
    const p = await repos(A.b).pessoas.obter('forn')
    // certo: ou recusa (versão mudou) ou mantém o 999 — nunca volta ao 111 em silêncio
    expect(p.telefone).toBe('999')
  })

  it('C17 salvarTabelaPreco com a grade velha desfaz a célula que a outra aba publicou', async () => {
    const { A, Bb } = await cenario()
    const tabela = (valores: Record<string, string>, nota: string) => ({ id: 't', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [60], colunas: [{ id: 'lp', nome: 'LP' }, { id: 'hel', nome: 'Helena' }], valores, nota }) as Q
    await A.b.comando('salvarTabelaPreco', tabela({ '60|lp': '17', '60|hel': '18' }, 'v1'))
    const grade = { ...(await repos(A.b).tabelasPreco.obter('t')).valores }
    await Bb.b.comando('salvarTabelaPreco', tabela({ ...grade, '60|lp': '20' }, 'B sobe LP'))
    // a tela velha manda a versão que CARREGOU (igual às telas de verdade, desde a correção): o servidor sabe que é velha
    await resultado(A.b.comando('salvarTabelaPreco', { ...tabela({ ...grade, '60|hel': '19' }, 'A sobe Helena'), versaoBase: 1 } as Q))
    const t = await repos(A.b).tabelasPreco.obter('t')
    // certo: a publicação da A (baseada na v1) é recusada, ou o LP da B (20) continua
    expect(t.valores['60|lp']).toBe('20')
  })

  it('C18 salvarConfig com a lista velha de módulos ativos religa o módulo que a outra aba desligou', async () => {
    const { A, Bb } = await cenario()
    const ativos: string[] = ((await A.b.consulta('configuracoes', {})) as Q).config.modulosAtivos
    expect(ativos.length).toBeGreaterThan(1)
    const desligado = ativos.find((m) => m !== 'cabelo')!
    await Bb.b.comando('salvarConfig', { modulosAtivos: ativos.filter((m) => m !== desligado) } as Q)
    // aba A (tela aberta antes) muda outro módulo e manda a lista que tinha
    // a tela manda também o que CARREGOU ("antes"): só o que ela mudou vale; o que a outra aba mudou fica
    await A.b.comando('salvarConfig', { modulosAtivos: [...ativos], antes: { modulosAtivos: [...ativos] } } as Q)
    const depois = ((await repos(A.b).config.obter('geral')) as Q).valor.modulosAtivos as string[]
    expect(depois).not.toContain(desligado)
  })

  it('C19 salvarUsuario com o formulário velho REATIVA a funcionária que o outro administrador desativou', async () => {
    const { A, Bb } = await cenario()
    const velho = ((await A.b.consulta('usuarios', {})) as Q[]).find((u) => u.id === 'u-sofia')
    await Bb.b.comando('salvarUsuario', { id: 'u-sofia', login: 'sofia', nome: velho.nome, perfil: 'funcionario', pessoaId: 'p-sofia', ativo: false })
    // a tela velha manda a versão que CARREGOU (igual às telas de verdade, desde a correção): o servidor sabe que é velha
    await resultado(A.b.comando('salvarUsuario', { id: 'u-sofia', login: 'sofia', nome: 'Sofia F. (nome corrigido)', perfil: 'funcionario', pessoaId: 'p-sofia', ativo: velho.ativo, versaoBase: velho.versao } as Q))
    expect((await repos(A.b).usuarios.obter('u-sofia')).ativo).toBe(false)
  })

  it('C20 salvarItem com o formulário velho desfaz o preço que a outra aba mudou', async () => {
    const { A, Bb } = await cenario()
    await A.b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', precoSugerido: { moeda: 'BOB', valor: bs(50) }, estoqueIdeal: 5 })
    await Bb.b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', precoSugerido: { moeda: 'BOB', valor: bs(70) }, estoqueIdeal: 5 })
    // a tela da aba A abriu o item quando ele custava 50 (é o que ela manda como "antes", igual à tela de verdade)
    await resultado(A.b.comando('salvarItem', { id: 'pc', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova grande', precoSugerido: { moeda: 'BOB', valor: bs(50) }, estoqueIdeal: 5, antes: { nome: 'Escova', precoSugerido: { moeda: 'BOB', valor: bs(50) }, estoqueIdeal: 5, ativo: true } } as Q))
    expect((await repos(A.b).itens.obter('pc')).precoSugerido.valor).toBe(bs(70))
  })

  it('C21 salvarViagem (trocar rateio) com a viagem velha apaga o orçamento que a outra aba gravou', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarViagem', { id: 'vg', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    const v = (await repos(A.b).viagens.obter('vg')) as Q
    await Bb.b.comando('salvarViagem', { id: 'vg', nome: v.nome, destino: v.destino, viajantes: v.viajantes, inicio: v.inicio, orcamento: bs(3000) } as Q)
    // tela da viagem aberta na aba A: "mudarRateio" manda a viagem inteira que ela tinha
    // a tela velha manda a versão que CARREGOU (igual às telas de verdade, desde a correção): o servidor sabe que é velha
    await resultado(A.b.comando('salvarViagem', { id: 'vg', nome: v.nome, destino: v.destino, viajantes: v.viajantes, inicio: v.inicio, fim: v.fim, orcamento: v.orcamento, orcamentoCompra: v.orcamentoCompra, rateio: 'valor', obs: v.obs, versaoBase: v.versao } as Q))
    expect((await repos(A.b).viagens.obter('vg')).orcamento).toBe(bs(3000))
  })

  it('C22 "Desfazer" velho da ligação na aba A desfaz a mudança de viagem que a aba B fez depois', async () => {
    const { A, Bb, r } = await cenario()
    await A.b.comando('salvarViagem', { id: 'vg1', nome: 'Feira Oruro', destino: 'Oruro', viajantes: ['p-sofia'], inicio: r.hoje } as Q)
    await A.b.comando('salvarViagem', { id: 'vg2', nome: 'Feira Potosi', destino: 'Potosi', viajantes: ['p-sofia'], inicio: r.hoje, confirmarParecida: true } as Q)
    await compraAberta(A.b, 'c1')
    const lig = (await A.b.comando('vincularCompras', { viagemId: 'vg1', compraIds: ['c1'] })) as Q
    await Bb.b.comando('vincularCompras', { viagemId: 'vg2', compraIds: ['c1'], mover: true })
    await resultado(A.b.comando('desfazerLigacao', { antes: lig.antes }))
    // certo: o "desfazer" da A recusa (a compra não está mais onde A deixou) e mantém a escolha da B
    expect((await repos(A.b).transacoes.obter('c1')).viagemId).toBe('vg2')
  })
})

describe('SESSÃO e PERFIL numa aba que ficou aberta', () => {
  it('C23 funcionária desativada pelo administrador (outra aba) continua vendendo na aba dela', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await entrarComo(Bb, 'sofia')
    await A.b.comando('salvarUsuario', { id: 'u-sofia', login: 'sofia', nome: 'Sofia Ficticia', perfil: 'funcionario', pessoaId: 'p-sofia', ativo: false })
    const rr = await resultado(Bb.b.comando('concluirVenda', venda('vs', lote, 100)))
    expect(rr).not.toBe('ok')
    expect(await repos(A.b).transacoes.obter('vs')).toBeUndefined()
  })

  it('C24 administradora rebaixada a funcionária continua com poder de administrador na aba aberta', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await entrarComo(Bb, 'bianca')
    // outro administrador guardado antes (a regra "fica pelo menos um administrador ativo" não deixa rebaixar o único)
    await A.b.comando('salvarUsuario', { id: 'u-adm3', login: 'carla', nome: 'Carla Admin', perfil: 'admin', ativo: true, senha: SENHA_TESTE } as Q)
    await A.b.comando('salvarUsuario', { id: 'u-adm2', login: 'bianca', nome: 'Bianca Admin', perfil: 'funcionario', ativo: true })
    const rr = await resultado(Bb.b.comando('ajustarEstoque', { itemId: lote, novoSaldo: 0, motivo: 'perda', descricao: 'sumiu' }))
    expect(rr).not.toBe('ok')
    expect(await saldo(A.b, lote)).toBe(1000)
  })

  it('C25 sair no meio: comando já aceito roda depois sem ninguém (sem autoria no log)', async () => {
    const { A } = await cenario()
    const p = resultado(A.b.comando('lancarCaixa', { id: 'lx', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(10), descricao: 'Luz' }))
    void A.b.sair()
    const rr = await p
    const mov = await repos(A.b).movCaixa.obter('lx')
    // certo: o comando aceito quando o admin estava dentro fica no nome dele (ou é recusado inteiro)
    if (rr === 'ok') {
      expect(mov.criadoPor).toBe('admin')
      expect((await auditoriaDe(A.b, 'lancarCaixa'))[0]?.usuarioNome).toBe('Administrador')
    } else expect(mov).toBeUndefined()
  })

  it('C26 sair no meio de uma venda da funcionária: a venda fica sem dona', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    await entrarComo(Bb, 'sofia')
    const p = resultado(Bb.b.comando('concluirVenda', venda('vs', lote, 100)))
    void Bb.b.sair()
    const rr = await p
    const v = await repos(A.b).transacoes.obter('vs')
    if (rr === 'ok') expect(v.criadoPor).toBe('u-sofia')
    else expect(v).toBeUndefined()
  })

  it('C27 senha trocada pelo administrador: a senha antiga não entra mais, a nova entra', async () => {
    const { A, Bb } = await cenario()
    await entrarComo(Bb, 'sofia')
    await A.b.comando('salvarUsuario', { id: 'u-sofia', login: 'sofia', nome: 'Sofia Ficticia', perfil: 'funcionario', pessoaId: 'p-sofia', senha: 'nova9999' })
    expect(await resultado(Bb.b.entrar('sofia', SENHA_TESTE))).not.toBe('ok')
    expect(await resultado(Bb.b.entrar('sofia', 'nova9999'))).toBe('ok')
  })
})

describe('AUDITORIA: toda mudança deixa rastro', () => {
  const contar = async (b: B) => ((await repos(b).auditoria.listar()) as Q[]).filter((a) => a.acao !== 'recusado').length

  it('C28 salvarConfig (ex.: regra de sobra pequena) fica no log de auditoria', async () => {
    const { A } = await cenario()
    const n = await contar(A.b)
    await A.b.comando('salvarConfig', { saldoPequenoG: 50 } as Q)
    expect(await contar(A.b)).toBeGreaterThan(n)
  })

  it('C29 salvarLocal (unidade nova) fica no log de auditoria', async () => {
    const { A } = await cenario()
    const n = await contar(A.b)
    await A.b.comando('salvarLocal', { id: 'loc1', nome: 'Salão Ficticio', tipo: 'salao' } as Q)
    expect(await contar(A.b)).toBeGreaterThan(n)
  })

  it('C30 separarLote e conferirPesoCompra ficam no log de auditoria', async () => {
    const { A } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    let n = await contar(A.b)
    await A.b.comando('conferirPesoCompra', { compraId: 'c1', itemId: lote, pesado: 980, motivo: 'balança' } as Q)
    const conferiu = (await contar(A.b)) > n
    n = await contar(A.b)
    await A.b.comando('separarLote', { id: 's1', loteId: lote, quantidadeUsada: 980, saidas: [{ id: 's1-a', quantidade: 980, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }] } as Q)
    const separou = (await contar(A.b)) > n
    expect({ conferiu, separou }).toEqual({ conferiu: true, separou: true })
  })
})

describe('AVISO entre abas (telas abertas)', () => {
  it('C31 venda gravada na aba A avisa as telas da aba B (aoMudar) para não ficarem com estoque velho', async () => {
    const { A, Bb } = await cenario()
    const lote = await compraPaga(A.b, 'c1')
    let avisos = 0
    Bb.b.aoMudar(() => avisos++)
    await A.b.comando('concluirVenda', venda('v1', lote, 100))
    await new Promise((r) => setTimeout(r, 50))
    expect(avisos).toBeGreaterThan(0)
  })
})
