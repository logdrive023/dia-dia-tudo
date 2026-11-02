import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'
import { faseLote } from '../core/services/triagem'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

/** Compra de cabelo bruto que vai até o estoque (vira um lote "Aguardando triagem"). */
async function comprar(b: B, id: string, fornecedor: string, gramas: number, total: number, campos: Record<string, string>) {
  await b.comando('salvarPessoa', { id: fornecedor, nome: fornecedor.toUpperCase(), papeis: ['fornecedor'] })
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: fornecedor, linhas: [{ id: `${id}-l`, quantidade: gramas, moeda: 'BOB', total, campos: { estado: 'Bruto', ...campos } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: total }] : undefined })
  return (await b.consulta('pedido', { id })).lotes[0].id
}

describe('triagem: compra → unificar → preparar → separar → venda', () => {
  it('lote bruto da compra aparece aguardando; muda de fase com log', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'ana', 5000, bs(40000), { cor: 'Preto', textura: 'Liso' })
    let q = await b.consulta('triagem', {})
    expect(q.lotes.find((x) => x.id === l1)).toMatchObject({ fase: 'aguardando', saldo: 5000, compras: [{ id: 'c1', fornecedor: 'ANA' }] })
    expect(q.totais.aguardando).toBe(5000)
    expect((await b.consulta('resumoMenu', {})).aguardandoTriagem).toBe(1)
    await b.comando('moverFaseTriagem', { ids: [l1], fase: 'preparando', obs: 'Lavando' })
    q = await b.consulta('triagem', {})
    expect(q.lotes.find((x) => x.id === l1)).toMatchObject({ fase: 'preparando', obs: 'Lavando' })
    expect(q.totais.porColuna).toMatchObject({ aguardando: { n: 0, g: 0 }, preparando: { n: 1, g: 5000 } })
    expect((await b.consulta('estoque', { moduloId: 'cabelo' }))[0].status).toBe('preparando')
    const log = (await b.consulta('logDetalhado', { acao: 'moverFaseTriagem' })).linhas
    expect(log[0].resumo).toMatch(/Aguardando triagem → Em preparação\/limpeza · Lavando/)
    expect(log[0].usuarioNome).toBeTruthy()
    // marcar como triado sem separar: sai da fila
    await b.comando('marcarLotes', { ids: [l1], campos: { estado: 'Separado' } })
    q = await b.consulta('triagem', {})
    expect(q.lotes.find((x) => x.id === l1)?.fase).toBe('triado')
    await expect(b.comando('moverFaseTriagem', { ids: [l1], fase: 'vendido' })).rejects.toThrow(/automático/)
    await expect(b.comando('moverFaseTriagem', { ids: [l1], fase: 'nao-existe' })).rejects.toThrow(/não existe/)
    // levar para uma coluna "pronto para venda" marca o bruto como Separado
    const l2 = await comprar(b, 'c2', 'bia', 2000, bs(10000), {})
    await b.comando('moverFaseTriagem', { ids: [l2], fase: 'triado' })
    expect((await b.consulta('fichaItem', { id: l2 })).item.campos.estado).toBe('Separado')
    expect((await b.consulta('logDetalhado', { acao: 'moverFaseTriagem' })).linhas[0].resumo).toMatch(/→ Triado \(pronto para venda\) \(Situação: Bruto → Separado/)
  })

  it('colunas personalizadas: renomear, criar, reordenar, entrada configurável, não tira coluna com lote, volta ao padrão', async () => {
    const { b } = await novoBackend()
    const padrao = (await b.consulta('fluxosTriagem', {})).find((f) => f.moduloId === 'cabelo')!
    expect(padrao.personalizado).toBe(false)
    expect(padrao.colunas.map((c) => c.id)).toEqual(['aguardando', 'preparando', 'triado', 'vendido'])
    const l1 = await comprar(b, 'c1', 'ana', 5000, bs(40000), {})
    // nova coluna "Lavagem" antes de tudo e é a entrada; "Aguardando" vira "Fila" e vai para depois
    const cols = [
      { id: 'lavagem', nome: 'Lavagem', cor: '#0ea5e9', entrada: true, lembrarFotos: true },
      { id: 'aguardando', nome: 'Fila' },
      { id: 'preparando', nome: 'Em preparação/limpeza' },
      { id: 'triado', nome: 'Pronto', pronto: true, separarAoEntrar: true },
      { id: 'vendido', nome: 'Saiu' },
    ]
    // o lote não tinha coluna guardada: cai na nova entrada (não há lote "dentro" de aguardando com coluna guardada)
    await b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: cols })
    let q = await b.consulta('triagem', {})
    expect(q.colunas.map((c) => c.nome)).toEqual(['Lavagem', 'Fila', 'Em preparação/limpeza', 'Pronto', 'Saiu'])
    expect(q.lotes.find((x) => x.id === l1)?.fase).toBe('lavagem')
    // compra nova cai na coluna de entrada configurada
    const l2 = await comprar(b, 'c2', 'bia', 3000, bs(30000), {})
    expect((await b.consulta('triagem', {})).lotes.find((x) => x.id === l2)?.fase).toBe('lavagem')
    await b.comando('moverFaseTriagem', { ids: [l2], fase: 'aguardando' })
    // não dá para tirar uma coluna com lote
    await expect(b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: cols.filter((c) => c.id !== 'aguardando') })).rejects.toThrow(/1 lote\(s\) estão em "Fila"/)
    // regras: vendido sempre a última, uma entrada, pelo menos uma "pronto"
    await expect(b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: [cols[4], ...cols.slice(0, 4)] })).rejects.toThrow(/última/)
    await expect(b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: cols.map((c) => ({ ...c, entrada: undefined })) })).rejects.toThrow(/entrada/)
    await expect(b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: cols.map((c) => ({ ...c, pronto: undefined })) })).rejects.toThrow(/pronto para venda/)
    // reordenar: tudo continua no lugar
    await b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: [cols[1], cols[0], cols[2], cols[3], cols[4]] })
    q = await b.consulta('triagem', {})
    expect(q.lotes.find((x) => x.id === l2)?.fase).toBe('aguardando')
    // voltar ao padrão: "Lavagem" (com l1) impede; depois de mover, volta
    await expect(b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: null })).rejects.toThrow(/Lavagem/)
    await b.comando('moverFaseTriagem', { ids: [l1], fase: 'preparando' })
    await b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: null })
    q = await b.consulta('triagem', {})
    expect(q.colunas.map((c) => c.id)).toEqual(['aguardando', 'preparando', 'triado', 'vendido'])
    expect(q.lotes.find((x) => x.id === l1)?.fase).toBe('preparando')
    // coluna guardada que não existe mais: bruto volta para a entrada, separado para a primeira "pronto"
    const cs = q.colunas
    expect(faseLote({ saldo: 10, campos: { estado: 'Bruto' }, faseTriagem: { fase: 'sumiu', desde: '' } }, cs)).toBe('aguardando')
    expect(faseLote({ saldo: 10, campos: { estado: 'Separado' }, faseTriagem: { fase: 'sumiu', desde: '' } }, cs)).toBe('triado')
    expect(faseLote({ saldo: 0, campos: {} }, cs, true)).toBe('vendido')
    expect(faseLote({ saldo: 0, campos: {} }, cs)).toBeUndefined()
    expect((await b.consulta('logDetalhado', { acao: 'salvarFluxoTriagem' })).linhas.length).toBe(3)
  })

  it('unifica lotes de 2 compras, separa com perda e mantém as duas compras no rastreio', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'ana', 5000, bs(40000), { cor: 'Preto', textura: 'Liso' })
    const l2 = await comprar(b, 'c2', 'bia', 3000, bs(30000), { cor: 'Castanho', textura: 'Liso' })
    await b.comando('moverFaseTriagem', { ids: [l2], fase: 'preparando' })
    await expect(b.comando('unificarLotes', { id: 'u', ids: [l1] })).rejects.toThrow(/2 lotes/)
    const r = await b.comando('unificarLotes', { id: 'u', ids: [l1, l2], motivo: 'Mesma qualidade' })
    expect(r.id).toBe('u')
    // repetir não duplica
    await b.comando('unificarLotes', { id: 'u', ids: [l1, l2] })
    const u = await b.consulta('fichaItem', { id: 'u' })
    expect(u.item.saldo).toBe(8000)
    expect(u.item.custoPrincipal).toBe(bs(70000))
    expect(u.item.campos).toMatchObject({ estado: 'Bruto', cor: 'Misturado', textura: 'Liso' })
    expect(u.item.origem).toMatchObject({ tipo: 'unificacao', ids: [l1, l2], compraIds: ['c1', 'c2'] })
    expect(u.dna.compras.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(u.dna.unificacao?.fontes.map((f) => f.quantidade)).toEqual([5000, 3000])
    expect((await b.consulta('fichaItem', { id: l1 })).item.saldo).toBe(0)
    expect((await b.consulta('fichaItem', { id: l1 })).unificadoEm[0]).toMatchObject({ id: 'u', quantidade: 5000 })
    const lu = (await b.consulta('logDetalhado', { acao: 'unificarLotes' })).linhas[0]
    expect(lu.resumo).toMatch(/5.000 g.*3.000 g.*= 8.000 g · Mesma qualidade/)
    expect((await b.consulta('pedido', { id: 'c2' })).lotes.map((l) => l.id)).toContain('u')
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
    // lote já triado não entra
    await expect(b.comando('unificarLotes', { id: 'u2', ids: ['u', l1] })).rejects.toThrow(/sem saldo/)

    // separar o unificado (em preparação também pode): 8 kg bruto → 7,6 kg líquido, perda 400 g (5%)
    await b.comando('moverFaseTriagem', { ids: ['u'], fase: 'preparando' })
    await b.comando('separarLote', {
      id: 's',
      loteId: 'u',
      quantidadeUsada: 8000,
      saidas: [
        { id: 'a', quantidade: 5000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
        { id: 'b', quantidade: 2600, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal', cor: 'Castanho' } },
      ],
    })
    const a = await b.consulta('fichaItem', { id: 'a' })
    expect(a.item.origem?.compraIds).toEqual(['c1', 'c2'])
    expect(a.dna.compras.map((c) => c.codigo).length).toBe(2)
    expect(a.dna.unificacao?.id).toBe('u')
    expect(a.dna.triagens[0]).toMatchObject({ pesoBruto: 8000, pesoLiquido: 7600, perda: 400, perdaPct: 500 })
    expect(a.dna.triagens[0].por).toBeTruthy()
    expect(a.dna.triagens[0].partes.find((p) => p.id === 'a')?.atual).toBe(true)
    expect(a.logTriagem.map((l) => l.acao)).toEqual(expect.arrayContaining(['separarLote', 'unificarLotes', 'moverFaseTriagem']))
    expect(a.logTriagem.find((l) => l.acao === 'separarLote')).toMatchObject({ pesoBruto: 8000, pesoLiquido: 7600, perda: 400 })
    const ls = (await b.consulta('logDetalhado', { acao: 'separarLote' })).linhas[0]
    expect(ls.resumo).toMatch(/peso bruto 8.000 g → líquido 7.600 g .* perda 400 g \(5%\)/)
    // rastreio a partir do filho: as duas compras e o nó de unificação
    const rs = await b.consulta('rastreio', { itemId: 'a' })
    expect(rs.compras.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(rs.resumo.comprado).toBe(8000)
    expect(rs.resumo.custoCompra).toBe(bs(70000))
    expect(rs.resumo.perdaNaSeparacao).toBe(400)
    expect(rs.resumo.emEstoque).toBe(7600)
    const noU = rs.arvore.flatMap((n) => n.filhos).filter((n) => n.item.id === 'u')
    expect(noU).toHaveLength(2)
    expect(noU.filter((n) => n.repetido)).toHaveLength(1)
    expect(noU[0].unificacao?.fontes.map((f) => f.id)).toEqual([l1, l2])
    // o quadro: triados prontos para venda; estoque e lista sabem das duas compras
    const q = await b.consulta('triagem', {})
    expect(q.lotes.filter((x) => x.fase === 'triado').map((x) => x.id).sort()).toEqual(['a', 'b'])
    expect(q.totais.triadoSemana).toBe(7600)
    expect(q.totais.perdaMesBp).toBe(500)
    expect((await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === 'a')?.compraCodigo?.split(', ')).toHaveLength(2)
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('funcionária não mexe na triagem', async () => {
    const { b, sessao } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'ana', 5000, bs(40000), {})
    const l2 = await comprar(b, 'c2', 'bia', 3000, bs(30000), {})
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('unificarLotes', { id: 'u', ids: [l1, l2] })).rejects.toThrow(/permissão/)
    await expect(b.comando('moverFaseTriagem', { ids: [l1], fase: 'preparando' })).rejects.toThrow(/permissão/)
    await expect(b.consulta('triagem', {})).rejects.toThrow(/permissão/)
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin' })
    expect((await b.consulta('fichaItem', { id: l1 })).item.saldo).toBe(5000)
  })
})

describe('rastreio total (genealogia) e triagem com id', () => {
  it('40 kg viram 4 pacotes (com perda); um pacote se junta com outra compra e é separado; vendas; tudo fecha em gramas', async () => {
    const { b } = await novoBackend()
    const l1 = await comprar(b, 'c1', 'ana', 40000, bs(400000), {})
    const l2 = await comprar(b, 'c2', 'bia', 5000, bs(40000), {})
    // T-1: só separar (40 kg → 10 + 12 + 9 + 8 = 39 kg, perda 1 kg)
    const parte = (id: string, g: number, cm: number) => ({ id, quantidade: g, campos: { estado: 'Separado', comprimento: cm, categoria: 'Normal' } })
    const t1 = await b.comando('triarLotes', { id: 't1', ids: [l1], saidas: [parte('A', 10000, 60), parte('B', 12000, 50), parte('C', 9000, 40), parte('D', 8000, 30)] })
    expect(t1.codigo).toMatch(/^T-/)
    expect(t1.lotes).toEqual(['A', 'B', 'C', 'D'])
    // T-2: o pacote B se mistura com a compra 2 e é separado de novo: 17 kg → 9 + 7,5 (perda 500 g)
    const t2 = await b.comando('triarLotes', { id: 't2', ids: ['B', l2], saidas: [parte('E', 9000, 55), parte('F', 7500, 45)], motivo: 'mesma cor' })
    expect(t2.codigo).not.toBe(t1.codigo)
    expect((await b.consulta('fichaItem', { id: 'E' })).item.origem?.compraIds).toEqual(['c1', 'c2'])
    // vendas
    await b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'x1', itemId: 'A', quantidade: 4000, moeda: 'BOB', total: bs(20000) }], pagamentos: [{ id: 'p1', forma: 'dinheiro', moeda: 'BOB', valor: bs(20000) }] })
    await b.comando('concluirVenda', { id: 'v2', linhas: [{ id: 'x2', itemId: 'E', quantidade: 3000, moeda: 'BOB', total: bs(15000) }], pagamentos: [{ id: 'p2', forma: 'dinheiro', moeda: 'BOB', valor: bs(15000) }] })
    // genealogia a partir da 1ª compra: inclui a 2ª compra, as duas triagens, os lotes e as vendas
    const g = await b.consulta('genealogia', { compraId: 'c1' })
    expect(g.compras.map((c) => [c.id, c.g])).toEqual([['c1', 40000], ['c2', 5000]])
    expect(g.triagens.map((t) => t.codigo)).toEqual([t1.codigo, t2.codigo])
    expect(g.triagens[0]).toMatchObject({ perda: 1000, saidas: [{ id: 'A', g: 10000 }, { id: 'B', g: 12000 }, { id: 'C', g: 9000 }, { id: 'D', g: 8000 }] })
    expect(g.triagens[1].entradas.map((e) => [e.id, e.g]).sort()).toEqual([['B', 12000], [l2, 5000]].sort())
    expect(g.triagens[1]).toMatchObject({ perda: 500, juntou: true, separou: true })
    expect(g.vendas.map((v) => [v.id, v.g])).toEqual([['v1', 4000], ['v2', 3000]])
    expect(g.vendas[0].codigo).toMatch(/^V-/)
    const lA = g.lotes.find((l) => l.id === 'A')!
    expect(lA).toMatchObject({ entrou: 10000, vendido: 4000, saldo: 6000 })
    // a conta fecha: entrou 45 kg = vendido 7 kg + estoque 36,5 kg + perda 1,5 kg
    expect(g.totais).toMatchObject({ entrou: 45000, vendido: 7000, emEstoque: 36500, perda: 1500, confere: true })
    // de qualquer ponta (venda, lote, triagem, 2ª compra) o grafo é o mesmo
    for (const p of [{ vendaId: 'v2' }, { itemId: 'C' }, { triagemId: 't2' }, { compraId: 'c2' }]) {
      const x = await b.consulta('genealogia', p)
      expect(x.totais).toMatchObject({ entrou: 45000, confere: true })
      expect(x.triagens).toHaveLength(2)
    }
    // lista de triagens e a cadeia de cada lote: Compra → Triagem → Venda
    const ts = await b.consulta('triagens', {})
    expect(ts.map((t) => t.codigo)).toEqual([t2.codigo, t1.codigo])
    expect(ts[0]).toMatchObject({ pesoEntrada: 17000, pesoSaida: 16500, perda: 500, vendas: [{ id: 'v2' }] })
    expect(ts[0].compras.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    const linhaE = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === 'E')!
    expect(linhaE.cadeia.compras.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(linhaE.cadeia.triagens.map((t) => t.codigo)).toEqual([t1.codigo, t2.codigo])
    expect(linhaE.cadeia.vendas.map((v) => v.id)).toEqual(['v2'])
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })
})
