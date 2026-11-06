// OPERAÇÃO CAOS — MÊS SIMULADO + VERDADE DOS RELATÓRIOS. 30 dias úteis, 9 usuários (2 admins + 7 funcionárias da demo),
// tudo pelos comandos (com permissões reais). Depois de CADA dia: conferir(b) = []. No fim, cada relatório é
// recalculado a partir dos repositórios crus e comparado. Teste que FALHA = bug (o esperado é a regra correta).
import { beforeAll, describe, expect, it } from 'vitest'
import { novoBackend } from '../src/__tests__/ajuda'
import { carregarDemo, SENHA_DEMO } from '../src/app/demo'
import { dataLocal, somarDias } from '../src/core/domain/datas'
import { achar, conferir, reposDe } from './integridade'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any
type B = Awaited<ReturnType<typeof novoBackend>>['b']

function gerador(semente: number) {
  let s = semente >>> 0
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { r, int: (a: number, b: number) => a + Math.floor(r() * (b - a + 1)), um: <T>(xs: T[]) => xs[Math.floor(r() * xs.length)] }
}

const EQUIPE: Record<string, { pessoa: string; local: string }> = {
  paula: { pessoa: 'p-mariana', local: 'loc-centro' },
  renata: { pessoa: 'p-alison', local: 'loc-norte' },
  sofia: { pessoa: 'p-vero', local: 'loc-centro' },
  lia: { pessoa: 'p-china', local: 'loc-centro' },
  nina: { pessoa: 'p-dina', local: 'loc-centro' },
  clara: { pessoa: 'p-luz', local: 'loc-norte' },
  julia: { pessoa: 'p-karen', local: 'loc-norte' },
}
const PROFS = ['sofia', 'lia', 'nina', 'clara', 'julia']
const CLIENTES = ['p-ana', 'p-bia', 'p-carla', 'p-dani', 'p-elisa']
const SERVICOS: [string, number][] = [['s-corte', 8000], ['s-cor', 25000], ['s-escova', 6000], ['s-manut', 25000]]

// estado compartilhado do mês (montado uma vez no beforeAll)
const M: {
  b: B
  r: Q
  inicio: string
  fim: string
  ops: Record<string, number>
  recusas: Record<string, number>
  msDia: number[]
  problemasPorDia: { dia: string; problemas: string[] }[]
  vendaAntesVersao?: string
  versaoAntes?: number
  diaFechadoAlterado?: string
} = {} as never

async function como(b: B, login: string) {
  await b.entrar(login, SENHA_DEMO)
}

async function simularMes() {
  const { b, r } = await novoBackend(dataLocal())
  await carregarDemo(b)
  const repos = reposDe(b)
  const g = gerador(20261105)
  const ops: Record<string, number> = {}
  const recusas: Record<string, number> = {}
  const op = async (nome: string, f: () => Promise<unknown>) => {
    await f()
    ops[nome] = (ops[nome] ?? 0) + 1
  }
  const deveRecusar = async (nome: string, f: () => Promise<unknown>) => {
    try {
      await f()
    } catch {
      recusas[nome] = (recusas[nome] ?? 0) + 1
      return
    }
    throw new Error(`devia recusar: ${nome}`)
  }
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const agendados: { id: string; login: string; dia: string; total: number }[] = []
  const msDia: number[] = []
  const problemasPorDia: { dia: string; problemas: string[] }[] = []
  const inicio = somarDias(r.hoje, 1)
  M.b = b
  M.r = r

  const fatorDe = async (medida: number) => {
    const t = (await repos.tabelasPreco.obter('tab-geral')) as Q
    return (t.valores[`${medida}|henry`] as string | undefined) ?? '10'
  }
  const separados = async () => ((await repos.itens.listar()) as Q[]).filter((i) => i.moduloId === 'cabelo' && i.controlaEstoque && i.saldo >= 50 && i.campos?.estado === 'Separado' && Number(i.campos?.comprimento) > 0)
  const vendasConcluidas = async () => ((await repos.transacoes.listar({ tipo: 'venda' })) as Q[]).filter((t) => t.etapa === 'concluido')

  for (let k = 1; k <= 30; k++) {
    r.avancar(1)
    const hoje = r.hoje
    const t0 = performance.now()
    await como(b, g.um(['admin', 'bianca']))

    // ---- compras (admin) + separação ----
    if (k % 3 === 1) {
      const gramas = g.int(2000, 8000)
      const cid = id('mc')
      const valor = gramas * g.int(300, 600)
      await op('criarCompra', () => b.comando('criarCompra', { id: cid, moduloId: 'cabelo', pessoaId: g.um(['p-iran', 'p-elena', 'p-maria']), linhas: [{ id: id('mcl'), quantidade: gramas, moeda: 'BOB', total: valor, campos: { estado: 'Bruto', categoria: 'Normal', cor: 'Castanho' } }], pagarNoAto: [{ id: id('mcp'), forma: g.um(['dinheiro', 'qr']), moeda: 'BOB', valor }] }))
      const lote = ((await repos.itens.listar()) as Q[]).find((i) => i.origem?.id === cid || (i.compras ?? []).some((c: Q) => c.id === cid))
      if (lote) {
        const partes = [60, 50, 40].map((cm) => ({ id: id('ms'), quantidade: Math.floor((gramas * 0.3)), campos: { estado: 'Separado', comprimento: cm, categoria: 'Normal', cor: 'Castanho' } }))
        await op('triarLotes', () => b.comando('triarLotes', { id: id('mt'), ids: [lote.id], quantidadeUsada: lote.saldo, saidas: partes }))
      }
    }

    // ---- versão nova da tabela no meio do mês ----
    if (k === 15) {
      const vs = (await repos.vendas?.listar?.()) ?? null
      void vs
      const vAntes = (await vendasConcluidas()).find((t) => t.linhas.some((l: Q) => l.campos?.tabelaId === 'tab-geral'))
      M.vendaAntesVersao = vAntes?.id
      M.versaoAntes = vAntes?.linhas.find((l: Q) => l.campos?.tabelaId === 'tab-geral')?.campos?.tabelaVersao
      const tg = (await b.consulta('tabelasPreco', {})).find((x: Q) => x.id === 'tab-geral') as Q
      await op('salvarTabelaPreco', () => b.comando('salvarTabelaPreco', { ...tg, valores: { ...tg.valores, '60|henry': '19', '50|henry': '8', '40|henry': '4' }, nota: 'mês caos: subiu henry' }))
    }

    // ---- atender os agendamentos de hoje (a própria profissional) ----
    for (const a of agendados.filter((x) => x.dia === hoje)) {
      await como(b, a.login)
      if (g.r() < 0.15) await op('desmarcarAgendamento', () => b.comando('cancelarVenda', { id: a.id, motivo: 'cliente desmarcou' }))
      else await op('atenderAgendamento', () => b.comando('atenderAgendamento', { id: a.id, pagamentos: [{ id: id('map'), forma: g.um(['dinheiro', 'qr']), moeda: 'BOB', valor: a.total }] }))
    }

    // ---- vendas das funcionárias: serviços + cabelo ----
    const quem = [...PROFS].sort(() => g.r() - 0.5).slice(0, g.int(3, 5))
    for (const login of quem) {
      await como(b, login)
      const eu = EQUIPE[login]
      const nServ = g.int(1, 2)
      const linhas = Array.from({ length: nServ }, () => {
        const [sid, preco] = g.um(SERVICOS)
        return { id: id('mvl'), itemId: sid, quantidade: 1, moeda: 'BOB', total: preco }
      })
      const total = linhas.reduce((s, l) => s + l.total, 0)
      const cliente = g.um(CLIENTES)
      await op('vendaServico', () => b.comando('concluirVenda', { id: id('mv'), pessoaId: cliente, localId: eu.local, profissionalId: eu.pessoa, linhas, pagamentos: [{ id: id('mvp'), forma: g.um(['dinheiro', 'qr']), moeda: 'BOB', valor: total }] }))
      // cabelo pela tabela
      const lotes = await separados()
      if (lotes.length && g.r() < 0.6) {
        const l = g.um(lotes)
        const medida = Number(l.campos.comprimento)
        const fator = await fatorDe(medida)
        const q = g.int(20, Math.min(400, l.saldo))
        const valor = Math.round(q * Number(fator.replace(',', '.')) * 100)
        await op('vendaCabelo', () => b.comando('concluirVenda', { id: id('mh'), pessoaId: cliente, localId: eu.local, linhas: [{ id: id('mhl'), itemId: l.id, quantidade: q, moeda: 'BOB', total: 0, calculo: { medida, fator, tabelaId: 'tab-geral', colunaId: 'henry', categoria: 'Normal' } }], pagamentos: [{ id: id('mhp'), forma: 'qr', moeda: 'BOB', valor }] }))
      }
      // agendamento para amanhã (hora diferente por profissional)
      if (g.r() < 0.5) {
        const amanha = somarDias(hoje, 1)
        const [sid, preco] = g.um(SERVICOS)
        const aid = id('mag')
        const hora = String(17 + PROFS.indexOf(login)).padStart(2, '0')
        await op('agendar', () => b.comando('concluirVenda', { id: aid, pessoaId: g.um(CLIENTES), localId: eu.local, profissionalId: eu.pessoa, agendadoPara: `${amanha}T${hora}:00:00.000Z`, linhas: [{ id: id('magl'), itemId: sid, quantidade: 1, moeda: 'BOB', total: preco }], pagamentos: [] }))
        agendados.push({ id: aid, login, dia: amanha, total: preco })
      }
    }

    // ---- venda em aberto guardada por uma, retomada (concluída) por outra pessoa ----
    if (k % 5 === 2) {
      const lotes = await separados()
      if (lotes.length) {
        const l = g.um(lotes)
        const vid = id('mab')
        await como(b, 'sofia')
        await op('salvarVendaAberta', () => b.comando('salvarVendaAberta', { id: vid, linhas: [{ id: id('mabl'), itemId: l.id, quantidade: 30 }], pessoaId: 'p-ana', colunaId: 'henry' }))
        await como(b, 'bianca')
        const medida = Number(l.campos.comprimento)
        const fator = await fatorDe(medida)
        await op('retomarVendaAberta', () => b.comando('concluirVenda', { id: vid, pessoaId: 'p-ana', linhas: [{ id: id('mabv'), itemId: l.id, quantidade: 30, moeda: 'BOB', total: 0, calculo: { medida, fator, tabelaId: 'tab-geral', colunaId: 'henry', categoria: 'Normal' } }], pagamentos: [{ id: id('mabp'), forma: 'dinheiro', moeda: 'BOB', valor: Math.round(30 * Number(fator.replace(',', '.')) * 100) }] }))
      }
    }

    await como(b, 'admin')
    // ---- cancelamentos e correções (admin) ----
    const concl = (await vendasConcluidas()).filter((t) => t.data < hoje)
    if (k % 4 === 0 && concl.length) {
      const v = g.um(concl)
      await op('cancelarVenda', () => b.comando('cancelarVenda', { id: v.id, motivo: 'caos: cliente devolveu' }))
    }
    if (k % 4 === 2 && concl.length) {
      const v = g.um(concl.filter((t) => t.linhas.length))
      const l = v.linhas[0]
      const novoTotal = Math.max(100, l.total + g.int(-2000, 2000))
      if (novoTotal !== l.total) await op('corrigirVenda', () => b.comando('corrigirVenda', { id: v.id, linhas: [{ linhaId: l.id, total: novoTotal }], motivo: 'caos: valor errado', diferenca: { forma: 'dinheiro', moeda: 'BOB' } }))
    }

    // ---- despesas, salários, comissões ----
    await op('despesa', () => b.comando('lancarCaixa', { id: id('md'), tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: g.int(1000, 30000), descricao: 'Material', categoria: 'Material', localId: g.um(['loc-centro', 'loc-norte']) }))
    await op('pagarSalario', () => b.comando('pagarSalario', { id: id('msn'), pessoaId: 'p-dina', valor: 12000, moeda: 'BOB', forma: 'dinheiro', referencia: 'Diária' }))
    if (k % 7 === 0) await op('pagarSalario', () => b.comando('pagarSalario', { id: id('msj'), pessoaId: 'p-karen', valor: 60000, moeda: 'BOB', forma: 'dinheiro', referencia: 'Semana' }))
    if (k === 10) {
      // ERRO: pagou o salário da Lia em dobro → estorna e paga o certo
      const errado = id('msl')
      await op('pagarSalario', () => b.comando('pagarSalario', { id: errado, pessoaId: 'p-china', valor: 500000, moeda: 'BOB', forma: 'qr', referencia: 'errado' }))
      await op('estornarLancamento', () => b.comando('estornarLancamento', { lancamentoId: errado, motivo: 'valor errado' }))
      await op('pagarSalario', () => b.comando('pagarSalario', { id: id('msl'), pessoaId: 'p-china', valor: 250000, moeda: 'BOB', forma: 'qr', referencia: 'certo' }))
    }
    if (k === 12) {
      // despesa SEM categoria da unidade, lançada por engano e desfeita
      const d = id('mdx')
      await op('despesa', () => b.comando('lancarCaixa', { id: d, tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: 77700, descricao: 'engano', localId: 'loc-norte' }))
      await op('estornarLancamento', () => b.comando('estornarLancamento', { lancamentoId: d, motivo: 'engano' }))
    }
    if (k === 13) {
      // ENTRADA com categoria da unidade, desfeita
      const e = id('mex')
      await op('entrada', () => b.comando('lancarCaixa', { id: e, tipo: 'entrada', moeda: 'BOB', forma: 'dinheiro', valor: 55500, descricao: 'aporte errado', categoria: 'Aporte', localId: 'loc-centro' }))
      await op('estornarLancamento', () => b.comando('estornarLancamento', { lancamentoId: e, motivo: 'engano' }))
    }
    if (k % 7 === 6) {
      const c = await b.consulta('comissoes', {})
      for (const p of c.porPessoa.filter((x: Q) => x.aPagar > 100)) {
        const pid = id('mcom')
        const d = { id: pid, pessoaId: p.pessoaId, valor: Math.floor(p.aPagar / 2), moeda: 'BOB', forma: 'dinheiro', referencia: 'semana' }
        // clique duplo (mesmo id) — tem de contar uma vez só
        await Promise.all([b.comando('pagarComissao', d), b.comando('pagarComissao', d)])
        ops.pagarComissao = (ops.pagarComissao ?? 0) + 1
      }
    }

    // ---- onda de erros (dia 20) ----
    if (k === 20) {
      await como(b, 'clara')
      const dup = { id: id('mdup'), pessoaId: 'p-carla', localId: 'loc-norte', profissionalId: 'p-luz', linhas: [{ id: id('mdupl'), itemId: 's-corte', quantidade: 1, moeda: 'BOB', total: 8000 }], pagamentos: [{ id: id('mdupp'), forma: 'dinheiro', moeda: 'BOB', valor: 8000 }] }
      await Promise.all([b.comando('concluirVenda', dup), b.comando('concluirVenda', dup), b.comando('concluirVenda', dup)])
      ops.vendaDuplicada3x = (ops.vendaDuplicada3x ?? 0) + 1
      await deveRecusar('funcionariaCancelaVendaFeita', () => b.comando('cancelarVenda', { id: dup.id, motivo: 'x' }))
      await deveRecusar('funcionariaCobraMenosSemMotivo', () => b.comando('concluirVenda', { id: id('mx'), pessoaId: 'p-carla', profissionalId: 'p-luz', linhas: [{ id: id('mxl'), itemId: 's-cor', quantidade: 1, moeda: 'BOB', total: 100 }], pagamentos: [{ id: id('mxp'), forma: 'dinheiro', moeda: 'BOB', valor: 100 }] }))
      const lotes = await separados()
      if (lotes.length) await deveRecusar('venderMaisQueTem', () => b.comando('concluirVenda', { id: id('mx'), pessoaId: 'p-carla', linhas: [{ id: id('mxl'), itemId: lotes[0].id, quantidade: lotes[0].saldo + 1, moeda: 'BOB', total: 100 }], pagamentos: [{ id: id('mxp'), forma: 'dinheiro', moeda: 'BOB', valor: 100 }] }))
      await deveRecusar('funcionariaLancaCaixa', () => b.comando('lancarCaixa', { id: id('mx'), tipo: 'retirada', moeda: 'BOB', forma: 'dinheiro', valor: 100, descricao: 'x' }))
      await como(b, 'admin')
      // valor digitado 100× maior, corrigido depois
      const vErr = id('merr')
      await op('vendaValorErrado', () => b.comando('concluirVenda', { id: vErr, pessoaId: 'p-dani', localId: 'loc-norte', profissionalId: 'p-luz', linhas: [{ id: `${vErr}-l`, itemId: 's-escova', quantidade: 1, moeda: 'BOB', total: 600000 }], pagamentos: [{ id: id('merrp'), forma: 'dinheiro', moeda: 'BOB', valor: 600000 }] }))
      await op('corrigirVenda', () => b.comando('corrigirVenda', { id: vErr, linhas: [{ linhaId: `${vErr}-l`, total: 6000 }], motivo: 'digitou errado', diferenca: { forma: 'dinheiro', moeda: 'BOB' } }))
      const lid = id('mldup')
      await Promise.all([1, 2].map(() => b.comando('lancarCaixa', { id: lid, tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: 1500, descricao: 'água', categoria: 'Luz e água', localId: 'loc-centro' })))
      const cid = id('mcdup')
      const comp = { id: cid, moduloId: 'cabelo', pessoaId: 'p-iran', linhas: [{ id: id('mcdl'), quantidade: 1000, moeda: 'BOB', total: 300000, campos: { estado: 'Bruto', categoria: 'Normal' } }], pagarNoAto: [{ id: id('mcdp'), forma: 'dinheiro', moeda: 'BOB', valor: 300000 }] }
      await Promise.all([b.comando('criarCompra', comp), b.comando('criarCompra', comp)])
      ops.compraDuplicada = 1
      await deveRecusar('cancelarDuasVezes', async () => {
        const v = (await vendasConcluidas())[0]
        await b.comando('cancelarVenda', { id: v.id, motivo: 'a' })
        ops.cancelarVenda = (ops.cancelarVenda ?? 0) + 1
        await b.comando('cancelarVenda', { id: v.id, motivo: 'b' })
      })
    }

    // ---- fecha o dia; às vezes reabre um dia anterior, mexe e fecha de novo ----
    await como(b, 'admin')
    const cx = await b.consulta('caixaDoDia', { data: hoje })
    const contado = Object.fromEntries(cx.contas.map((c: Q) => [c.moeda, Math.max(0, c.mao)]))
    await op('encerrarDia', () => b.comando('encerrarDia', { data: hoje, contado }))
    if (k % 7 === 3 && k > 3) {
      const ontem = somarDias(hoje, -1)
      await op('reabrirDia', () => b.comando('reabrirDia', { data: ontem }))
      await op('encerrarDia', () => b.comando('encerrarDia', { data: ontem, contado: {} }))
      M.diaFechadoAlterado = ontem
    }
    msDia.push(performance.now() - t0)
    const p = await conferir(b)
    problemasPorDia.push({ dia: hoje, problemas: p })
  }
  Object.assign(M, { inicio, fim: r.hoje, ops, recusas, msDia, problemasPorDia })
}

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('mês simulado (30 dias, 9 usuários)', () => {
  beforeAll(async () => {
    const t0 = performance.now()
    await simularMes()
    console.log(`[mes] simulação ${(performance.now() - t0).toFixed(0)} ms; ms/dia min ${Math.min(...M.msDia).toFixed(0)} máx ${Math.max(...M.msDia).toFixed(0)}`)
    console.log('[mes] ops', JSON.stringify(M.ops), 'recusas', JSON.stringify(M.recusas))
  }, 600000)

  it('integridade: conferir(b) vazio ao fim de CADA dia', () => {
    expect(M.problemasPorDia.filter((d) => d.problemas.length)).toEqual([])
  })

  it('sem vendas em aberto penduradas (a retomada fecha a em aberto)', async () => {
    expect((await M.b.consulta('vendasAbertas', {})).length).toBe(0)
  })

  it('painel: faturamento/compras/nº vendas = recálculo dos repositórios; lista de vendas soma o cartão', async () => {
    const { b, inicio, fim } = M
    const repos = reposDe(b)
    const tr = (await repos.transacoes.listar()) as Q[]
    const vendas = tr.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && t.data >= inicio && t.data <= fim)
    const compras = tr.filter((t) => t.tipo === 'compra' && t.etapa === 'concluido' && t.data >= inicio && t.data <= fim)
    const p = await b.consulta('painel', { de: inicio, ate: fim })
    const c = (id: string) => p.cartoes.find((x: Q) => x.id === id)!.valor
    expect(c('faturamento')).toBe(soma(vendas.map((t) => t.totalPrincipal)))
    expect(c('compras')).toBe(soma(compras.map((t) => t.totalPrincipal)))
    expect(c('vendas')).toBe(vendas.length)
    const lucro = soma(vendas.flatMap((t) => t.linhas.map((l: Q) => l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.insumoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0))))
    expect(c('lucro')).toBe(lucro)
    const lista = await b.consulta('vendas', { de: inicio, ate: fim })
    expect(lista.length).toBe(vendas.length)
    expect(new Set(lista.map((v: Q) => v.id)).size).toBe(lista.length)
    expect(soma(lista.map((v: Q) => v.valor))).toBe(c('faturamento'))
    // caixa agora = soma de todo movCaixa (convertido); só BOB e USD aqui: confere BOB
    const mc = (await repos.movCaixa.listar()) as Q[]
    expect(p.caixa.find((x: Q) => x.moeda === 'BOB')!.total).toBe(soma(mc.filter((m) => m.moeda === 'BOB').map((m) => m.delta)))
  })

  it('painel cabelo: "Estoque a custo" = inventário = Σ custo proporcional dos lotes com saldo', async () => {
    const { b, inicio, fim } = M
    const itens = ((await reposDe(b).itens.listar()) as Q[]).filter((i) => i.moduloId === 'cabelo' && i.controlaEstoque && i.saldo > 0)
    const esperado = soma(itens.map((i) => (!i.custoPrincipal || !i.quantidadeInicial ? 0 : Math.round((i.custoPrincipal * i.saldo) / i.quantidadeInicial))))
    const p = await b.consulta('painel', { de: inicio, ate: fim })
    const secao = achar(p.areas, (a) => a.id === 'cabelo', 'área cabelo no painel').secoes[0]
    if (secao.tipo !== 'cartoes') throw new Error(`a 1ª seção do cabelo devia ser de cartões, veio "${secao.tipo}"`)
    const cab = achar(secao.cartoes, (x) => x.id === 'cab.valor', 'cartão cab.valor').valor
    const inv = await b.consulta('inventario', { moduloId: 'cabelo' })
    expect(inv.valor).toBe(cab)
    expect(Math.abs(cab - esperado)).toBeLessThanOrEqual(itens.length) // arredondamento por lote
  })

  it('relatório contábil: ventas, IVA 13%, IT 3%, costo = recálculo; conferência toda ✓', async () => {
    const { b, inicio, fim } = M
    const tr = (await reposDe(b).transacoes.listar()) as Q[]
    const vendas = tr.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && t.data >= inicio && t.data <= fim)
    const receita = soma(vendas.map((t) => t.totalPrincipal))
    const cmv = soma(vendas.flatMap((t) => t.linhas.map((l: Q) => l.custoPrincipal ?? 0)))
    const rel = await b.consulta('relatorioContabil', { de: inicio, ate: fim })
    const v = (id: string) => rel.resultados.find((l: Q) => l.id === id)?.valor
    expect(v('ventas')).toBe(receita)
    expect(v('iva')).toBe(-Math.round((receita * 1300) / 10000))
    expect(v('it')).toBe(-Math.round((receita * 300) / 10000))
    expect(v('costo')).toBe(-cmv)
    expect(rel.conferencia.filter((c: Q) => !c.ok)).toEqual([])
    expect(rel.numeros.vendas).toBe(vendas.length)
  })

  it('caixaDoDia de cada dia do mês = Σ movCaixa do dia; total = Σ até o dia; mão = só dinheiro', async () => {
    const { b, inicio, fim } = M
    const mc = (await reposDe(b).movCaixa.listar()) as Q[]
    const erros: string[] = []
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
      const cx = await b.consulta('caixaDoDia', { data: d })
      for (const c of cx.contas) {
        const ms = mc.filter((m) => m.moeda === c.moeda)
        const hoje = soma(ms.filter((m) => m.data === d).map((m) => m.delta))
        const total = soma(ms.filter((m) => m.data <= d).map((m) => m.delta))
        const mao = soma(ms.filter((m) => m.data <= d && m.forma === 'dinheiro').map((m) => m.delta))
        if (c.hoje !== hoje || c.total !== total || c.mao !== mao) erros.push(`${d} ${c.moeda}: hoje ${c.hoje}/${hoje} total ${c.total}/${total} mão ${c.mao}/${mao}`)
        if (soma(c.linhas.map((l: Q) => l.valor)) !== c.hoje) erros.push(`${d} ${c.moeda}: linhas ${soma(c.linhas.map((l: Q) => l.valor))} ≠ hoje ${c.hoje}`)
      }
      if (cx.movimentos.length !== mc.filter((m) => m.data === d).length) erros.push(`${d}: movimentos ${cx.movimentos.length}`)
    }
    expect(erros).toEqual([])
  })

  it('comissões: ganho = Σ comissão das linhas concluídas; pago = Σ despesas "Comissões" (clique duplo conta 1×); visão da funcionária = linha dela', async () => {
    const { b } = M
    const repos = reposDe(b)
    const tr = (await repos.transacoes.listar({ tipo: 'venda' })) as Q[]
    const mc = (await repos.movCaixa.listar()) as Q[]
    const c = await b.consulta('comissoes', {})
    const erros: string[] = []
    for (const p of c.porPessoa) {
      const ganho = soma(tr.filter((t) => t.etapa === 'concluido').flatMap((t) => t.linhas.filter((l: Q) => (l.profissionalId ?? t.profissionalId) === p.pessoaId).map((l: Q) => l.comissaoPrincipal ?? 0)))
      const pago = soma(mc.filter((m) => m.categoria === 'Comissões' && m.pessoaId === p.pessoaId && m.tipo === 'despesa' && !m.estornadoPor).map((m) => -m.delta))
      if (p.ganhoTotal !== ganho || p.pagoTotal !== pago || p.aPagar !== ganho - pago) erros.push(`${p.nome}: ganho ${p.ganhoTotal}/${ganho} pago ${p.pagoTotal}/${pago}`)
    }
    expect(erros).toEqual([])
    const admSofia = achar(c.porPessoa, (x) => x.pessoaId === 'p-vero', 'comissão da p-vero (visão do admin)')
    await como(b, 'sofia')
    const dela = await b.consulta('comissoes', {})
    await como(b, 'admin')
    expect(dela.porPessoa.map((x: Q) => x.pessoaId)).toEqual(['p-vero'])
    expect(dela.porPessoa[0].aPagar).toBe(admSofia.aPagar)
  })

  it('unidades: entradas, comissões, custo = recálculo; salários pagos = Σ salários líquidos de estorno', async () => {
    const { b, inicio, fim } = M
    const repos = reposDe(b)
    const tr = (await repos.transacoes.listar({ tipo: 'venda' })) as Q[]
    const mc = ((await repos.movCaixa.listar()) as Q[]).filter((m) => m.data >= inicio && m.data <= fim)
    const u = await b.consulta('unidades', { de: inicio, ate: fim })
    const erros: string[] = []
    for (const x of u.lista) {
      const vs = tr.filter((t) => t.etapa === 'concluido' && t.localId === x.local.id && t.data >= inicio && t.data <= fim)
      const entradas = soma(vs.map((t) => t.totalPrincipal))
      const com = soma(vs.flatMap((t) => t.linhas.map((l: Q) => l.comissaoPrincipal ?? 0)))
      // salário pago de verdade na unidade = −Σ (despesa de salário) − Σ (estorno de salário)
      const sal = -soma(mc.filter((m) => m.localId === x.local.id && m.categoria === 'Salários' && m.pessoaId).map((m) => m.delta))
      if (x.entradas !== entradas) erros.push(`${x.local.nome} entradas ${x.entradas}/${entradas}`)
      if (x.comissoes !== com) erros.push(`${x.local.nome} comissões ${x.comissoes}/${com}`)
      if (x.salariosPagos !== sal) erros.push(`${x.local.nome} salariosPagos ${x.salariosPagos}/${sal}`)
      if (x.margem !== x.entradas - x.saidas) erros.push(`${x.local.nome} margem`)
    }
    expect(erros).toEqual([])
  })

  it('unidades: despesa estornada (sem categoria) e entrada estornada não mexem nas despesas da unidade', async () => {
    const { b, inicio, fim } = M
    const mc = ((await reposDe(b).movCaixa.listar()) as Q[]).filter((m) => m.data >= inicio && m.data <= fim)
    const u = await b.consulta('unidades', { de: inicio, ate: fim })
    const erros: string[] = []
    for (const x of u.lista) {
      // despesas reais da unidade: despesas sem pessoa, menos o que foi desfeito delas
      const daUni = mc.filter((m) => m.localId === x.local.id && !m.pessoaId)
      const porId = new Map(daUni.map((m) => [m.id, m]))
      const desp = -soma(daUni.filter((m) => m.tipo === 'despesa' || (m.tipo === 'estorno' && porId.get(m.estornaId)?.tipo === 'despesa')).map((m) => m.delta))
      if (x.despesas !== desp) erros.push(`${x.local.nome}: despesas ${x.despesas} ≠ ${desp}`)
    }
    expect(erros).toEqual([])
  })

  it('auditoria: total = linhas do repositório; contagens por área/usuário fecham; limite e sem duplicados', async () => {
    const { b, inicio, fim } = M
    const aud = ((await reposDe(b).auditoria.listar()) as Q[]).filter((a) => a.acao !== 'tabelaPrecoAnterior' && a.acao !== 'tabelaPrecoVersao')
    const noPer = aud.filter((a) => a.criadoEm.slice(0, 10) >= inicio && a.criadoEm.slice(0, 10) <= fim)
    const r = await b.consulta('auditoria', { de: inicio, ate: fim, limite: 50 })
    expect(r.total).toBe(noPer.length)
    expect(r.noPeriodo).toBe(noPer.length)
    expect(r.linhas.length).toBe(Math.min(50, noPer.length))
    expect(soma(r.categorias.map((c: Q) => c.n))).toBe(r.total)
    expect(soma(r.usuarios.map((c: Q) => c.n))).toBe(r.noPeriodo)
    expect(r.recusadas).toBe(noPer.filter((a) => a.acao === 'recusado').length)
    const tudo = await b.consulta('auditoria', { de: inicio, ate: fim, limite: 100000 })
    expect(new Set(tudo.linhas.map((l: Q) => l.id)).size).toBe(tudo.linhas.length)
    expect(tudo.linhas.length).toBe(noPer.length)
    // paginar por "limite" não perde nem repete: as 50 primeiras são as 50 primeiras da lista completa
    expect(r.linhas.map((l: Q) => l.id)).toEqual(tudo.linhas.slice(0, 50).map((l: Q) => l.id))
    // por usuário: o filtro devolve exatamente a contagem do chip
    for (const u of r.usuarios.slice(0, 3)) expect((await b.consulta('auditoria', { de: inicio, ate: fim, usuarioId: u.id, limite: 100000 })).total).toBe(u.n)
  })

  it('logDetalhado: total = linhas do log no período', async () => {
    const { b, inicio, fim } = M
    const r = await b.consulta('logDetalhado', { de: inicio, ate: fim })
    const aud = ((await reposDe(b).auditoria.listar()) as Q[]).filter((a) => a.criadoEm.slice(0, 10) >= inicio && a.criadoEm.slice(0, 10) <= fim)
    console.log(`[mes] logDetalhado total ${r.total} linhas ${r.linhas.length}; auditoria no período (cru) ${aud.length}`)
    expect(r.linhas.length).toBe(Math.min(300, r.total))
    expect(new Set(r.linhas.map((l: Q) => l.id)).size).toBe(r.linhas.length)
  })

  it('versão nova da tabela no meio do mês: vendas antigas (não canceladas) continuam com a versão e o valor delas', async () => {
    const { b } = M
    expect(M.versaoAntes).toBeTruthy()
    const tr = (await reposDe(b).transacoes.listar({ tipo: 'venda' })) as Q[]
    const antigas = tr.filter((t) => t.etapa !== 'cancelado' && t.linhas.some((l: Q) => l.campos?.tabelaId === 'tab-geral' && l.campos?.tabelaVersao === M.versaoAntes))
    expect(antigas.length).toBeGreaterThan(0)
    const t = await b.consulta('tabelaPreco', { id: 'tab-geral' })
    expect(t.totalUsos).toBe(t.usos.length > 299 ? t.totalUsos : t.usos.length)
    for (const v of antigas) {
      expect(t.usos.find((u: Q) => u.id === v.id)?.versao).toBe(M.versaoAntes)
      for (const l of v.linhas.filter((x: Q) => x.campos?.tabelaId === 'tab-geral' && !t.usos.find((u: Q) => u.id === v.id)?.detalhe.find((d: Q) => d.id === x.id)?.manual)) {
        // valor = gramas × fator guardado (correções só mexem no total, o fator da linha é o da versão antiga)
        if (!v.historico.some((h: Q) => h.tipo === 'correcao')) expect(l.totalPrincipal).toBe(Math.round(l.quantidade * Number(String(l.campos.fator).replace(',', '.')) * 100))
      }
    }
  })

  it('o dia reaberto e encerrado de novo fica encerrado; nenhum dia do mês ficou aberto', async () => {
    const dias = await M.b.consulta('diasDoCaixa', {})
    const doMes = dias.filter((d: Q) => d.data >= M.inicio && d.data <= M.fim)
    expect(doMes.filter((d: Q) => d.status !== 'encerrado')).toEqual([])
  })

  it('crescimento: auditoria e outbox por comando (registro sem fim?)', async () => {
    const repos = reposDe(M.b)
    const aud = (await repos.auditoria.listar()).length
    const out = (await repos.outbox.listar()).length
    const totalOps = soma(Object.values(M.ops))
    console.log(`[mes] auditoria ${aud} linhas, outbox ${out} linhas, ops ${totalOps} → ${(aud / totalOps).toFixed(2)} aud/op, ${(out / totalOps).toFixed(2)} outbox/op`)
    expect(out).toBeGreaterThan(0)
  })
})
