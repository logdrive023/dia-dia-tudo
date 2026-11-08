// DIAGNÓSTICO DO ESTOQUE, PASSO A PASSO: 3 cenários (simples · juntar e separar · "teste da confusão") que conferem,
// DEPOIS DE CADA AÇÃO, se o estoque, os custos, a auditoria e os relatórios continuam batendo.
//
// Na suíte normal roda sem espera. Para ver passo a passo, devagar (como uma pessoa usando):
//   npm run diagnostico            (400 ms entre as ações, cada passo impresso)
//   npm run diagnostico -- 1000    (1 s entre as ações)
//
// Unidade: GRAMAS (o cabelo é vendido por grama). Custo em centavos da moeda principal (BOB).
// O que é conferido a cada passo (conferirTudo):
//   · estoque  = Σ entradas − Σ vendido − Σ perda  (e o inventário soma o mesmo)
//   · custo    = custo do que está no estoque + CMV das vendas + custo da perda = Σ custo das compras (± 1 centavo/op.)
//   · cada compra fecha o próprio rastreio (genealogia: entrou = em estoque + vendido + perda)
//   · o diagnóstico geral do sistema não acusa problema
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { caminhoProprio } from '../shared/ui/caminhoCabelo'
import { bs, hojeReal, novoBackend } from './ajuda'

const LENTO = Number(process.env.DIAG_LENTO_MS ?? 0)
const VERBOSO = process.env.DIAG_VERBOSO === '1'
const TEMPO = 120_000 + LENTO * 60

type B = Awaited<ReturnType<typeof novoBackend>>['b']
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** o "diário" do cenário: cada passo espera (modo lento), roda, e confere tudo de novo */
function diario(b: B, nome: string) {
  const compras: { id: string; g: number; custo: number }[] = []
  // gastos levados ao custo do estoque (ex.: o frete da viagem incorporado ao encerrar): entram na conta do dinheiro
  const extra = { custo: 0 }
  let n = 0
  const log = (s: string) => VERBOSO && console.log(s)
  log(`\n━━ ${nome} ━━`)
  return {
    compras,
    extra,
    async passo<T>(titulo: string, fn: () => Promise<T>): Promise<T> {
      if (LENTO) await esperar(LENTO)
      const t0 = Date.now()
      const r = await fn()
      const c = await conferirTudo(b, compras, extra.custo)
      log(`  ${String(++n).padStart(2)}. ${titulo}  →  estoque ${c.estoque} g · vendido ${c.vendido} g · perda ${c.perda} g · custo fecha ±${c.difCusto} · ${Date.now() - t0} ms`)
      return r
    },
    async comprar(id: string, g: number, custoBs: number) {
      await b.comando('salvarPessoa', { id: 'f-' + id, nome: 'Fornecedor ' + id, papeis: ['fornecedor'] } as any)
      await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'f-' + id, linhas: [{ id: id + '-l', quantidade: g, moeda: 'BOB', total: bs(custoBs), campos: { estado: 'Bruto', categoria: 'Normal' } }] } as any)
      for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: id + '-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(custoBs) }] : undefined } as any)
      compras.push({ id, g, custo: bs(custoBs) })
      return (await b.consulta('pedido', { id })).lotes[0].id as string
    },
  }
}

const parte = (id: string, g: number, cm = 60) => ({ id, quantidade: g, campos: { estado: 'Separado', comprimento: cm, categoria: 'Normal' } })
const vender = (b: B, id: string, itemId: string, g: number, precoBs: number) =>
  b.comando('concluirVenda', { id, linhas: [{ id: id + '-l', itemId, quantidade: g, moeda: 'BOB', total: bs(precoBs) }], pagamentos: [{ id: id + '-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(precoBs) }] } as any)
const item = (b: B, id: string) => (b as any).repos.itens.obter(id)
const saldo = async (b: B, id: string) => (await item(b, id))?.saldo ?? 0

/** o que tem de valer depois de QUALQUER ação (as contas fecham por compra, no total e no dinheiro) */
async function conferirTudo(b: B, compras: { id: string; g: number; custo: number }[], custoExtra = 0) {
  const diag: any = await b.consulta('diagnostico', {})
  expect(diag.problemas ?? [], 'diagnóstico do sistema').toEqual([])
  // a ÁRVORE de cada compra fecha (a árvore inclui as compras misturadas com ela: entrou = estoque + vendido + perda)
  for (const c of compras) {
    const g: any = await b.consulta('genealogia', { compraId: c.id })
    expect(g.totais.confere, `rastreio da compra ${c.id} fecha`).toBe(true)
  }
  const tudo = { de: '2000-01-01', ate: '2100-12-31' }
  const vendas: any[] = await b.consulta('vendasDetalhadas', tudo)
  const vendido = vendas.reduce((s, l) => s + l.quantidade, 0)
  // perda = a das separações (triagens que valem) + os ajustes de perda/acerto feitos à mão
  const perdaTriagem = ((await b.consulta('triagens', {})) as any[]).reduce((s, t) => s + (t.perda ?? 0), 0)
  const ajustes = ((await (b as any).repos.movEstoque.listar()) as any[]).filter((m) => m.motivo === 'perda' || m.motivo === 'ajuste').reduce((s, m) => s - m.delta, 0)
  const perda = perdaTriagem + ajustes
  const entrou = compras.reduce((s, c) => s + c.g, 0)
  const inv: any = await b.consulta('inventario', { moduloId: 'cabelo' })
  expect(inv.quantidade, 'inventário = entradas − vendido − perda').toBe(entrou - vendido - perda)
  // POR COMPRA, em gramas: o que dela está no estoque + o que dela foi vendido = a compra − a parte dela na perda
  const daCompra = new Map(compras.map((c) => [c.id, 0]))
  for (const l of inv.linhas as any[]) for (const o of (await b.consulta('origemDoPacote', { itemId: l.id, gramas: l.quantidade })) as any[]) daCompra.set(o.compraId, (daCompra.get(o.compraId) ?? 0) + o.gramas)
  for (const v of new Set(vendas.map((l) => l.vendaId))) for (const o of (await b.consulta('origemDaVenda', { vendaId: v })) as any[]) daCompra.set(o.compraId, (daCompra.get(o.compraId) ?? 0) + o.gramas)
  // SEM FOLGA: a origem é um livro em gramas inteiras (core/services/origem.ts), então por compra fecha exato e o que
  // falta em todas as compras juntas é EXATAMENTE a perda. (Antes, cada consulta arredondava sozinha e sobrava ±1 g.)
  let faltaTotal = 0
  for (const c of compras) {
    const g = daCompra.get(c.id) ?? 0
    expect(g, `compra ${c.id}: estoque + vendido não passa da compra`).toBeLessThanOrEqual(c.g)
    expect(g, `compra ${c.id}: falta no máximo a perda`).toBeGreaterThanOrEqual(c.g - perda)
    faltaTotal += c.g - g
  }
  expect(faltaTotal, 'o que falta nas compras = a perda, grama a grama').toBe(perda)
  // dinheiro: o custo não some nem aparece do nada (custo da perda fica nos pacotes que sobraram — é o jeito do sistema)
  const dre: any = await b.consulta('dre', { de: '2000-01-01', ate: '2100-12-31' })
  const cmv = dre.cmv ?? (dre.linhas as any[]).find((l) => /custo/i.test(l.conta))?.valor ?? 0
  const custoTotal = compras.reduce((s, c) => s + c.custo, 0) + custoExtra
  // as perdas lançadas à mão e na lavagem entram no DRE a custo (linhas próprias): estoque + CMV + perdas = compras
  const custoPerdas = (dre.perdasEstoque?.mao ?? 0) + (dre.perdasEstoque?.lavagem ?? 0)
  const difCusto = Math.abs(inv.valor + Math.abs(cmv) + custoPerdas - custoTotal)
  const ops = (await (b as any).repos.movEstoque.listar()).length
  expect(difCusto, `custo: estoque (${inv.valor}) + CMV (${cmv}) + perdas no DRE (${custoPerdas}) = compras (${custoTotal})`).toBeLessThanOrEqual(ops)
  return { estoque: inv.quantidade, vendido, perda, difCusto }
}

const acoes = async (b: B) => {
  const a: any = await b.consulta('auditoria', {} as any)
  return ((a.linhas ?? a) as any[]).map((x) => x.acao as string)
}

describe('diagnóstico do estoque, passo a passo', () => {
  it('Cenário 1 — simples: comprar → triar tudo → vender 2 kg → relatórios batem', async () => {
    const { b } = await novoBackend(hojeReal())
    const d = diario(b, 'Cenário 1 — simples')
    const A = await d.passo('Comprar o lote A: 10 kg por Bs 1.000 (Bs 0,10/g)', () => d.comprar('A', 10000, 1000))
    expect(await saldo(b, A)).toBe(10000)
    await d.passo('Triagem: marcar o lote A inteiro como triado (pronto para vender)', () => b.comando('moverFaseTriagem', { ids: [A], fase: 'triado' } as any))
    expect((await item(b, A)).campos.estado).toBe('Separado')
    expect(((await b.consulta('estoque', { moduloId: 'cabelo' })) as any[]).find((i) => i.id === A)?.saldo).toBe(10000)
    await d.passo('Vender 2 kg do lote A por Bs 600', () => vender(b, 'V1', A, 2000, 600))
    expect(await saldo(b, A)).toBe(8000)
    // relatórios
    const linhas: any[] = await b.consulta('vendasDetalhadas', { de: '2000-01-01', ate: '2100-12-31' })
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ quantidade: 2000, totalPrincipal: bs(600), custo: bs(200), lucro: bs(400) })
    const dre: any = await b.consulta('dre', { de: '2000-01-01', ate: '2100-12-31' })
    expect(dre.linhas.find((l: any) => l.conta === 'Receita de vendas')?.valor).toBe(bs(600))
    expect((await b.consulta('inventario', { moduloId: 'cabelo' }) as any).valor).toBe(bs(800))
    // a venda no relatório = a baixa no estoque (o movimento do pacote)
    const movs: any[] = await b.consulta('movimentosDoItem', { itemId: A } as any)
    const baixa = movs.filter((m) => m.motivo === 'venda').reduce((s, m) => s + m.delta, 0)
    expect(-baixa).toBe(linhas[0].quantidade)
    expect(await acoes(b)).toEqual(expect.arrayContaining(['criarCompra', 'moverFaseTriagem', 'concluirVenda']))
  }, TEMPO)

  it('Cenário 2 — juntar e separar: 2 lotes → 1 misturado → 2 pacotes → venda; auditoria e custo sem perder centavo', async () => {
    const { b } = await novoBackend(hojeReal())
    const d = diario(b, 'Cenário 2 — juntar e separar')
    const L1 = await d.passo('Comprar o lote 1: 5 kg por Bs 500 (Bs 0,10/g)', () => d.comprar('C1', 5000, 500))
    const L2 = await d.passo('Comprar o lote 2: 5 kg por Bs 750 (Bs 0,15/g)', () => d.comprar('C2', 5000, 750))
    await d.passo('Juntar lote 1 + lote 2 → MIX (10 kg, custo Bs 1.250)', () => b.comando('unificarLotes', { id: 'MIX', ids: [L1, L2] } as any))
    expect(await item(b, 'MIX')).toMatchObject({ saldo: 10000, custoPrincipal: bs(1250) })
    await d.passo('Separar o MIX em 2 pacotes: A 6 kg + B 4 kg (sem perda)', () => b.comando('triarLotes', { id: 'T-SEP', ids: ['MIX'], saidas: [parte('PA', 6000), parte('PB', 4000, 50)] } as any))
    const [pa, pb] = [await item(b, 'PA'), await item(b, 'PB')]
    expect(pa.custoPrincipal + pb.custoPrincipal, 'o custo do MIX passa inteiro para as partes').toBe(bs(1250))
    await d.passo('Vender 1,5 kg do pacote A por Bs 450', () => vender(b, 'V2', 'PA', 1500, 450))
    // auditoria: juntar (MERGE) e separar (SPLIT) registrados
    const a = await acoes(b)
    expect(a).toContain('unificarLotes')
    expect(a.some((x) => /triar|separar/i.test(x)), `separação na auditoria: ${a.join(', ')}`).toBe(true)
    // saldo por lote original: cada grama vendida sabe de qual compra veio (metade de cada)
    const o: any[] = await b.consulta('origemDaVenda', { vendaId: 'V2' })
    expect(Object.fromEntries(o.map((x) => [x.compraId, x.gramas]))).toEqual({ C1: 750, C2: 750 })
    // e o que sobrou no estoque: 4,25 kg de cada compra (PA 4,5 kg + PB 4 kg, meio a meio)
    const noEstoque: Record<string, number> = {}
    for (const p of ['PA', 'PB']) for (const x of (await b.consulta('origemDoPacote', { itemId: p, gramas: await saldo(b, p) })) as any[]) noEstoque[x.compraId] = (noEstoque[x.compraId] ?? 0) + x.gramas
    expect(noEstoque).toEqual({ C1: 4250, C2: 4250 })
    // CMV da venda = proporção exata das compras: 750 g × 0,10 + 750 g × 0,15 = Bs 187,50
    const [linha]: any[] = await b.consulta('vendasDetalhadas', { de: '2000-01-01', ate: '2100-12-31' })
    expect(linha.custo).toBe(bs(187.5))
    // a composição aparece no histórico (o caminho do pacote vendido chega às 2 compras)
    const g: any = await b.consulta('genealogia', { itemId: 'PA' })
    const caminho = caminhoProprio(g, { itemId: 'PA' })
    for (const x of ['C1', 'C2', 'MIX']) expect(caminho.has(x), `caminho de PA passa por ${x}`).toBe(true)
  }, TEMPO)

  it('Cenário 3 — "teste da confusão": 4 lotes, mistura, separa, remistura em pares, vende e reconstrói a árvore', async () => {
    const { b } = await novoBackend(hojeReal())
    const d = diario(b, 'Cenário 3 — teste da confusão')
    // preços diferentes por grama: 0,10 · 0,20 · 0,30 · 0,40 → dá para conferir a proporção no CMV
    const L1 = await d.passo('Entrada L1: 4 kg por Bs 400 (0,10/g)', () => d.comprar('C1', 4000, 400))
    const L2 = await d.passo('Entrada L2: 3 kg por Bs 600 (0,20/g)', () => d.comprar('C2', 3000, 600))
    const L3 = await d.passo('Entrada L3: 2 kg por Bs 600 (0,30/g)', () => d.comprar('C3', 2000, 600))
    const L4 = await d.passo('Entrada L4: 1 kg por Bs 400 (0,40/g)', () => d.comprar('C4', 1000, 400))
    await d.passo('Confusão: juntar L1+L2 e separar em 3 (S1 3 kg · S2 2,5 kg · S3 1,4 kg; perda 100 g)', () =>
      b.comando('triarLotes', { id: 'T1', ids: [L1, L2], saidas: [parte('S1', 3000), parte('S2', 2500, 55), parte('S3', 1400, 50)] } as any))
    await d.passo('Separar S3 ao meio (S3a 700 g · S3b 700 g)', () => b.comando('triarLotes', { id: 'T2', ids: ['S3'], saidas: [parte('S3a', 700, 50), parte('S3b', 700, 50)] } as any))
    await d.passo('Misturar S3a com L3 → M1 (2,7 kg)', () => b.comando('triarLotes', { id: 'M1', ids: ['S3a', L3] } as any))
    // reorganização 2 a 2: Alpha = S1 + M1 (lotes 1, 2, 3) · Beta = S2 + L4 (lotes 1, 2, 4)
    // M1 é uma mistura intacta: ao juntar com S1 ela é DESFEITA e as partes entram uma a uma (nunca mistura de mistura)
    const rA: any = await d.passo('Par Alpha: juntar S1 + M1', () => b.comando('triarLotes', { id: 'ALPHA', ids: ['S1', 'M1'] } as any))
    expect(rA.misturasDesfeitas).toHaveLength(1)
    expect([...(await item(b, 'ALPHA')).origem.ids].sort()).toEqual(['S1', 'S3a', L3].sort())
    await d.passo('Par Beta: juntar S2 + L4', () => b.comando('triarLotes', { id: 'BETA', ids: ['S2', L4] } as any))
    expect(await saldo(b, 'ALPHA')).toBe(5700)
    expect(await saldo(b, 'BETA')).toBe(3500)
    await d.passo('Vender 2 kg do Alpha por Bs 1.000', () => vender(b, 'VA', 'ALPHA', 2000, 1000))
    await d.passo('Vender 1,5 kg do Beta por Bs 800', () => vender(b, 'VB', 'BETA', 1500, 800))
    await d.passo('Vender 300 g do S3b por Bs 120', () => vender(b, 'VC', 'S3b', 300, 120))

    // ---- auditoria crítica ----
    // ESTOQUE: 10 kg − 3,8 kg vendidos − 100 g de perda = 6,1 kg (conferirTudo já confere a cada passo; aqui o número)
    expect((await b.consulta('inventario', { moduloId: 'cabelo' }) as any).quantidade).toBe(6100)
    // CUSTOS: o CMV de cada venda = Σ (gramas de cada compra × custo/g da compra) — a proporção dos lotes originais
    const custoG: Record<string, number> = { C1: 10, C2: 20, C3: 30, C4: 40 } // centavos por grama
    const linhas: any[] = await b.consulta('vendasDetalhadas', { de: '2000-01-01', ate: '2100-12-31' })
    for (const v of ['VA', 'VB', 'VC']) {
      const o: any[] = await b.consulta('origemDaVenda', { vendaId: v })
      const gramas = o.reduce((s, x) => s + x.gramas, 0)
      expect(gramas, `${v}: a origem soma o vendido`).toBe(linhas.find((l) => l.vendaId === v).quantidade)
      const esperado = o.reduce((s, x) => s + x.gramas * custoG[x.compraId], 0)
      const cmv = linhas.find((l) => l.vendaId === v).custo
      // a perda de 100 g (na T1) fica no custo dos pacotes que sobraram dela: S1/S2/S3 custam um pouco mais por grama
      // que as compras. Por isso o CMV pode passar do "custo de compra puro" — mas nunca ficar abaixo dele.
      expect(cmv, `${v}: CMV ${cmv} ≥ custo das compras de origem ${esperado}`).toBeGreaterThanOrEqual(esperado - o.length)
      expect(cmv, `${v}: CMV ${cmv} ≤ custo de origem + parte da perda`).toBeLessThanOrEqual(Math.ceil(esperado * 1.02) + o.length)
    }
    // RASTREIO: cada venda reconstrói a árvore até as compras certas
    const comprasDe = async (v: string) => new Set(((await b.consulta('origemDaVenda', { vendaId: v })) as any[]).map((x) => x.compraId))
    expect([...(await comprasDe('VA'))].sort()).toEqual(['C1', 'C2', 'C3'])
    expect([...(await comprasDe('VB'))].sort()).toEqual(['C1', 'C2', 'C4'])
    expect([...(await comprasDe('VC'))].sort()).toEqual(['C1', 'C2'])
    const gA: any = await b.consulta('genealogia', { itemId: 'ALPHA' })
    const caminho = caminhoProprio(gA, { itemId: 'ALPHA' })
    for (const x of ['C1', 'C2', 'C3', 'S1', 'S3a', 'T1']) expect(caminho.has(x), `árvore do Alpha passa por ${x}`).toBe(true)
    // auditoria: as junções, separações e a mistura desfeita estão registradas
    const a = await acoes(b)
    expect(a.filter((x) => x === 'concluirVenda')).toHaveLength(3)
    expect(a).toEqual(expect.arrayContaining(['unificarLotes', 'desfazerTriagem']))
  }, TEMPO)

  it('Cenário 4 — voltar atrás: tirar da mistura, corrigir e cancelar venda, desfazer separação, perda à mão', async () => {
    const { b } = await novoBackend(hojeReal())
    const d = diario(b, 'Cenário 4 — voltar atrás')
    const L1 = await d.passo('Comprar C1: 3 kg por Bs 300 (0,10/g)', () => d.comprar('C1', 3000, 300))
    const L2 = await d.passo('Comprar C2: 2 kg por Bs 400 (0,20/g)', () => d.comprar('C2', 2000, 400))
    const L3 = await d.passo('Comprar C3: 1 kg por Bs 300 (0,30/g)', () => d.comprar('C3', 1000, 300))
    await d.passo('Juntar C1 + C2 + C3 → MIX (6 kg)', () => b.comando('unificarLotes', { id: 'MIX', ids: [L1, L2, L3] } as any))
    await d.passo('Tirar C3 da mistura (volta 1 kg para o pacote dela)', () => b.comando('tirarDaMistura', { id: 'tm1', loteId: 'MIX', tirar: [L3] } as any))
    expect(await saldo(b, L3)).toBe(1000)
    expect(await saldo(b, 'MIX')).toBe(5000)
    await d.passo('Separar o MIX: P1 3 kg + P2 1,8 kg (perda 200 g)', () => b.comando('triarLotes', { id: 'T1', ids: ['MIX'], saidas: [parte('P1', 3000), parte('P2', 1800, 50)] } as any))
    await d.passo('Vender 1 kg do P1', () => vender(b, 'V1', 'P1', 1000, 400))
    await d.passo('Vender 500 g do P2', () => vender(b, 'V2', 'P2', 500, 200))
    await d.passo('Corrigir a venda V1: era 800 g (volta 200 g para o P1)', () =>
      b.comando('corrigirVenda', { id: 'V1', linhas: [{ linhaId: 'V1-l', quantidade: 800, total: bs(320) }], motivo: 'balança', diferenca: { forma: 'dinheiro', moeda: 'BOB' } } as any))
    expect(await saldo(b, 'P1')).toBe(2200)
    await d.passo('Cancelar a venda V2 (volta 500 g para o P2)', () => b.comando('cancelarVenda', { id: 'V2', motivo: 'desistiu' } as any))
    expect(await saldo(b, 'P2')).toBe(1800)
    await d.passo('Separar o pacote de C3 (Q1 600 g + Q2 400 g)', () => b.comando('triarLotes', { id: 'T2', ids: [L3], saidas: [parte('Q1', 600), parte('Q2', 400, 50)] } as any))
    await d.passo('Desfazer essa separação (C3 volta inteiro)', () => b.comando('desfazerTriagem', { triagemId: 'T2', motivo: 'pesei errado' } as any))
    expect(await saldo(b, L3)).toBe(1000)
    await d.passo('Perda à mão: 100 g do P2 (pontas)', () => b.comando('ajustarEstoque', { itemId: 'P2', novoSaldo: 1700, motivo: 'perda', descricao: 'pontas' } as any))
    await d.passo('Vender 300 g do P2', () => vender(b, 'V3', 'P2', 300, 120))
    // a venda corrigida conta só os 800 g (na proporção da mistura 3:2); a cancelada não conta mais
    const o: any[] = await b.consulta('origemDaVenda', { vendaId: 'V1' })
    expect(Object.fromEntries(o.map((x) => [x.compraId, x.gramas]))).toEqual({ C1: 480, C2: 320 })
    expect((await b.consulta('inventario', { moduloId: 'cabelo' }) as any).quantidade).toBe(6000 - 800 - 300 - 200 - 100)
  }, TEMPO)

  it('Cenário 5 — primeiro acesso: viagem → compra ligada → triagem → venda → cancelar (estorno) → venda certa', async () => {
    const { b } = await novoBackend(hojeReal())
    const d = diario(b, 'Cenário 5 — primeiro acesso (venda cancelada e refeita)')
    const hoje = hojeReal()
    const caixaDe = async (vendaId: string) => ((await (b as any).repos.movCaixa.listar()) as any[]).filter((m) => m.origemId === vendaId)
    const acoesEmOrdem = async () => ((await (b as any).repos.auditoria.listar()) as any[]).sort((x, y) => (x.id < y.id ? -1 : 1)).map((a) => `${a.acao}:${a.alvoId ?? ''}`)

    await b.comando('salvarPessoa', { id: 'p-eu', nome: 'Eu (quem viaja)', papeis: ['funcionario'] } as any)
    await d.passo('Cadastrar a viagem "SP - Lote Inicial #001" (orçamento Bs 500)', () =>
      b.comando('salvarViagem', { id: 'VG1', nome: 'SP - Lote Inicial #001', destino: 'São Paulo', viajantes: ['p-eu'], inicio: hoje, orcamento: bs(500) } as any))
    expect(((await b.consulta('viagens', {})) as any).linhas[0]).toMatchObject({ status: 'aberta', codigo: expect.any(String) })
    await d.passo('Adiantamento para a viagem: Bs 300 em dinheiro', () => b.comando('adiantarViagem', { id: 'ad1', viagemId: 'VG1', moeda: 'BOB', forma: 'dinheiro', valor: bs(300) } as any))
    await d.passo('Lançar o frete da viagem: Bs 100', () => b.comando('registrarDespesaViagem', { id: 'g1', viagemId: 'VG1', categoria: 'transporte', moeda: 'BOB', valor: bs(100), nota: 'frete' } as any))
    const L = await d.passo('Registrar a compra ligada à viagem: 5 kg bruto por Bs 2.000', async () => {
      await b.comando('salvarPessoa', { id: 'f-sp', nome: 'Fornecedora SP', papeis: ['fornecedor'] } as any)
      await b.comando('criarCompra', { id: 'C1', moduloId: 'cabelo', pessoaId: 'f-sp', viagemId: 'VG1', linhas: [{ id: 'C1-l', quantidade: 5000, moeda: 'BOB', total: bs(2000), campos: { estado: 'Bruto', categoria: 'Normal' } }], pagarNoAto: [{ id: 'C1-p', forma: 'dinheiro', moeda: 'BOB', valor: bs(2000) }] } as any)
      d.compras.push({ id: 'C1', g: 5000, custo: bs(2000) })
      return (await b.consulta('pedido', { id: 'C1' })).lotes[0].id as string
    })
    expect((await b.consulta('compra', { id: 'C1' }) as any).compra.viagemId).toBe('VG1')
    await d.passo('Triagem: separar em A 3 kg (60 cm) + B 1,9 kg (50 cm), perda 100 g', () =>
      b.comando('triarLotes', { id: 'T1', ids: [L], saidas: [parte('A', 3000), parte('B', 1900, 50)] } as any))
    expect([await saldo(b, 'A'), await saldo(b, 'B')]).toEqual([3000, 1900])

    // venda com o valor errado (Bs 900 em vez de Bs 600) → cancelar com motivo → refazer
    await d.passo('Venda rápida: 1 kg do A por Bs 900 (valor digitado errado)', () => vender(b, 'V1', 'A', 1000, 900))
    expect(await saldo(b, 'A')).toBe(2000)
    expect((await caixaDe('V1')).reduce((s, m) => s + m.delta, 0)).toBe(bs(900))
    const turno: any = await b.consulta('turnoAtual', {})
    expect(turno.lancamentos, 'o turno vê a venda').toBeGreaterThanOrEqual(1)
    // cancelar SEM motivo é recusado (o motivo fica no histórico)
    await expect(b.comando('cancelarVenda', { id: 'V1', motivo: '  ' } as any)).rejects.toThrow(/motivo/)
    await d.passo('Cancelar a venda V1 (motivo: valor digitado errado)', () => b.comando('cancelarVenda', { id: 'V1', motivo: 'valor digitado errado' } as any))
    expect(await saldo(b, 'A'), 'o estorno devolve EXATAMENTE o que saiu').toBe(3000)
    const cx1 = await caixaDe('V1')
    expect(cx1.map((m) => m.tipo).sort()).toEqual(['estorno', 'venda'])
    expect(cx1.reduce((s, m) => s + m.delta, 0), 'o caixa da venda cancelada zera').toBe(0)
    // cancelar de novo não devolve duas vezes
    await expect(b.comando('cancelarVenda', { id: 'V1', motivo: 'de novo' } as any)).rejects.toThrow(/já foi cancelada/)
    expect(await saldo(b, 'A')).toBe(3000)
    await d.passo('Refazer a venda certa: 1 kg do A por Bs 600', () => vender(b, 'V2', 'A', 1000, 600))
    expect(await saldo(b, 'A')).toBe(2000)

    // relatórios: só a venda certa conta; a cancelada fica no histórico
    const linhas: any[] = await b.consulta('vendasDetalhadas', { de: '2000-01-01', ate: '2100-12-31' })
    expect(linhas.map((l) => [l.vendaId, l.totalPrincipal])).toEqual([['V2', bs(600)]])
    expect((await b.consulta('dre', { de: '2000-01-01', ate: '2100-12-31' }) as any).receita).toBe(bs(600))
    const ordem = (await acoesEmOrdem()).filter((x) => /^(concluirVenda|cancelarVenda):/.test(x))
    expect(ordem, 'auditoria: VENDA → CANCELAMENTO (com estorno) → NOVA VENDA').toEqual(['concluirVenda:V1', 'cancelarVenda:V1', 'concluirVenda:V2'])
    expect(((await (b as any).repos.auditoria.listar()) as any[]).find((a) => a.acao === 'cancelarVenda')?.resumo).toMatch(/valor digitado errado/)

    // ENCERRAR: voltou Bs 200 do adiantamento; o frete (Bs 100) vai para o custo do cabelo QUE SOBROU no estoque.
    // A parte do frete do cabelo JÁ VENDIDO (1 de 4,9 kg) fica como despesa de viagem no DRE — o frete inteiro aparece.
    await d.passo('Encerrar a viagem (voltaram Bs 200) e levar o frete ao custo do cabelo', async () => {
      await b.comando('encerrarViagem', { viagemId: 'VG1', contado: { BOB: bs(200) }, incorporar: true } as any)
      d.extra.custo += (await (b as any).repos.viagens.obter('VG1')).incorporacao?.total ?? 0
    })
    const vg: any = ((await b.consulta('viagens', {})) as any).linhas[0]
    expect(vg).toMatchObject({ status: 'encerrada', gasto: bs(100), gramas: 5000, custoKgReal: bs(420) })
    const noEstoque = (await (b as any).repos.viagens.obter('VG1')).incorporacao.total
    const dre: any = await b.consulta('dre', { de: '2000-01-01', ate: '2100-12-31' })
    const despesaViagem = -((dre.linhas as any[]).filter((l) => /Viagens/.test(l.conta)).reduce((s, l) => s + l.valor, 0))
    expect(noEstoque + despesaViagem, `frete: ${noEstoque} no custo do estoque + ${despesaViagem} de despesa = Bs 100`).toBe(bs(100))
    // só a parte do cabelo que ainda está no estoque (arredonda pacote a pacote: ±1 centavo por pacote, A e B)
    expect(Math.abs(noEstoque - Math.round((bs(100) * 3900) / 4900))).toBeLessThanOrEqual(2)
  }, TEMPO)
})
