// TESTE "MACACO" DO FLUXO PRINCIPAL (regras): centenas de passos aleatórios — com semente fixa, então dá para repetir —
// pelo caminho do negócio: comprar (com e sem valor, bruto, com fornecedor ou não) → conferir peso → pagar → separar e
// juntar (com perda) → etiqueta (imprimir, refazer) → vender (parte ou tudo) → cancelar venda. No meio, tentativas
// ERRADAS (vender mais do que tem, separar mais do que tem, cancelar duas vezes) que têm de ser recusadas sem estragar
// nada. Depois de CADA passo: a conferência das contas (estoque, caixa, contas, vendas) tem de bater.

import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

/** gerador com semente (mulberry32): mesma semente → mesmos passos */
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

const MEDIDAS = [40, 50, 55, 60, 70, 80]
const CORES = ['Preto', 'Castanho', 'Loiro']

async function rodar(semente: number, passos: number) {
  const { b } = await novoBackend()
  const g = gerador(semente)
  let n = 0
  const id = (p: string) => `${p}${semente}-${n++}`
  const recusas: string[] = []
  const tentarErrado = async (nome: string, f: () => Promise<unknown>) => {
    try {
      await f()
      throw new Error(`devia recusar: ${nome}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('devia recusar')) throw e
      recusas.push(nome)
    }
  }
  await b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedora Macaco', papeis: ['fornecedor'] })
  const historia: string[] = []
  for (let k = 0; k < passos; k++) {
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    const brutos = lotes.filter((i) => i.campos.estado === 'Bruto')
    const separados = lotes.filter((i) => i.campos.estado === 'Separado')
    const acao = g.um(['comprar', 'comprar', 'separar', 'separar', 'juntar', 'etiqueta', 'vender', 'vender', 'cancelarVenda', 'errado', 'pagar', 'desfazer', 'valor'])
    historia.push(acao)
    if (acao === 'comprar' || (!brutos.length && !separados.length)) {
      // compra: com valor ou "sem valor", com ou sem fornecedor, 1 a 3 linhas brutas
      const semValor = g.r() < 0.3
      const cid = id('c')
      const linhas = Array.from({ length: g.int(1, 3) }, () => ({ id: id('l'), quantidade: g.int(50, 12000), moeda: 'BOB', total: semValor ? 0 : bs(g.int(100, 90000)), campos: { estado: 'Bruto', cor: g.um(CORES) } }))
      await b.comando('criarCompra', { id: cid, moduloId: 'cabelo', pessoaId: g.r() < 0.7 ? 'forn' : undefined, semValor: semValor || undefined, linhas })
      // às vezes confere o peso (pesou diferente)
      if (g.r() < 0.3) await b.comando('conferirPesoCompra', { compraId: cid, linhaId: linhas[0].id, pesado: Math.max(1, linhas[0].quantidade - g.int(1, 40)), motivo: 'balança' })
    } else if (acao === 'pagar') {
      const fila = (await b.consulta('filaTriagem', {})).filter((c) => c.etapa !== 'concluido')
      if (!fila.length) continue
      const c = g.um(fila)
      for (const e of ['conferido', 'pago', 'concluido']) {
        if (c.etapa === e) continue
        await b.comando('avancarTriagem', { compraId: c.id, para: e, pagamentos: e === 'pago' && c.totalPrincipal ? [{ id: id('pg'), forma: 'dinheiro', moeda: 'BOB', valor: c.totalPrincipal }] : undefined }).catch(() => undefined)
      }
    } else if (acao === 'separar' && brutos.length) {
      // separa um bruto em 1 a 3 partes; o que sobra é perda (às vezes nada sobra)
      const l = g.um(brutos)
      const partes = g.int(1, 3)
      const total = l.saldo
      let resto = total
      const saidas = Array.from({ length: partes }, () => {
        const q = Math.max(1, Math.floor((resto * g.int(30, 95)) / 100 / partes) || 1)
        resto -= q
        return { id: id('s'), quantidade: q, campos: { estado: 'Separado', comprimento: g.um(MEDIDAS), categoria: 'Normal', cor: g.um(CORES) } }
      }).filter((s) => s.quantidade > 0)
      if (saidas.reduce((s, x) => s + x.quantidade, 0) <= total) await b.comando('triarLotes', { id: id('t'), ids: [l.id], quantidadeUsada: total, saidas })
    } else if (acao === 'juntar' && brutos.length >= 2) {
      const [a, c] = [brutos[0], brutos[1]]
      await b.comando('triarLotes', { id: id('j'), ids: [a.id, c.id], motivo: 'mesma qualidade' })
    } else if (acao === 'etiqueta' && lotes.length) {
      const l = g.um(lotes)
      await b.comando('marcarEtiquetasImpressas', { ids: [l.id] })
      if (g.r() < 0.4) await b.comando('refazerEtiqueta', { id: l.id, motivo: g.um(['Saiu errada', 'Perdeu']) })
    } else if (acao === 'vender' && separados.length) {
      // vende uma parte ou tudo de 1 ou 2 pacotes, paga na hora
      const ls = [g.um(separados), ...(g.r() < 0.3 ? [g.um(separados)] : [])].filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i)
      const linhas = ls.map((l) => ({ id: id('vl'), itemId: l.id, quantidade: g.r() < 0.4 ? l.saldo : g.int(1, l.saldo), moeda: 'BOB', total: bs(g.int(10, 50000)) }))
      const total = linhas.reduce((s, x) => s + x.total, 0)
      await b.comando('concluirVenda', { id: id('v'), linhas, pagamentos: [{ id: id('vp'), forma: g.um(['dinheiro', 'qr']), moeda: 'BOB', valor: total }] })
    } else if (acao === 'cancelarVenda') {
      const vendas = (await b.consulta('vendas', {})).filter((v) => v.etapa === 'concluido')
      if (!vendas.length) continue
      const v = g.um(vendas)
      await b.comando('cancelarVenda', { id: v.id, motivo: 'teste macaco' })
      await tentarErrado('cancelar duas vezes', () => b.comando('cancelarVenda', { id: v.id, motivo: 'de novo' }))
    } else if (acao === 'desfazer') {
      // errou a triagem: desfaz se pode; se já mexeram, tem de recusar
      const ts = await b.consulta('triagens', {})
      if (!ts.length) continue
      const x = g.um(ts)
      if (x.podeDesfazer) await b.comando('desfazerTriagem', { triagemId: x.id, motivo: 'pesei errado' })
      else await tentarErrado('desfazer triagem já mexida', () => b.comando('desfazerTriagem', { triagemId: x.id, motivo: 'x' }))
    } else if (acao === 'valor') {
      // pôr/corrigir o valor depois (mesmo pago, separado ou vendido)
      const fila = (await b.consulta('filaTriagem', { incluirEncerradas: true })).filter((c) => c.etapa !== 'cancelado' && c.etapa !== 'recusado')
      if (!fila.length) continue
      const c = g.um(fila)
      const l = g.um(c.linhas)
      await b.comando('definirValorCompra', { compraId: c.id, linhaId: l.id, total: bs(g.int(100, 90000)), motivo: 'nota' }).catch(() => undefined)
    } else if (acao === 'errado' && lotes.length) {
      const l = g.um(lotes)
      await tentarErrado('vender mais do que tem', () => b.comando('concluirVenda', { id: id('vx'), linhas: [{ id: id('x'), itemId: l.id, quantidade: l.saldo + g.int(1, 5000), moeda: 'BOB', total: bs(100) }], pagamentos: [{ id: id('xp'), forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] }))
      if (l.campos.estado === 'Bruto') await tentarErrado('separar mais do que tem', () => b.comando('triarLotes', { id: id('tx'), ids: [l.id], quantidadeUsada: l.saldo, saidas: [{ id: id('sx'), quantidade: l.saldo + g.int(1, 999), campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } }] }))
    }
    const d = await b.consulta('diagnostico', {})
    if (d.problemas.length) throw new Error(`semente ${semente}, passo ${k} (${historia.slice(-5).join(' → ')}): ${JSON.stringify(d.problemas)}`)
  }
  return { recusas, historia, b }
}

describe('macaco: fluxo compra → triagem → etiqueta → venda', () => {
  for (const semente of [1, 7, 42])
    it(`semente ${semente}: 120 passos aleatórios e as contas sempre batem`, async () => {
      const { recusas, historia, b } = await rodar(semente, 120)
      // passou pelo fluxo todo e as tentativas erradas foram recusadas
      for (const a of ['comprar', 'separar', 'vender']) expect(historia).toContain(a)
      expect(recusas.length).toBeGreaterThan(0)
      // nenhum saldo negativo e toda grama tem lugar
      const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
      expect(lotes.every((i) => i.saldo >= 0)).toBe(true)
    }, 120000)
})
