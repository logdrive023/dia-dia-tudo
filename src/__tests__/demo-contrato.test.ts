import { describe, expect, it } from 'vitest'
import { BackendApi } from '../adapters/api/backendApi'
import { criarFetchSimulado } from '../adapters/api/apiSimulada'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { carregarDemo } from '../app/demo'
import { criarBackend } from '../app/criarBackend'
import { dataLocal, somarDias } from '../core/domain/datas'
import type { Backend } from '../core/ports/backend'
import { bs } from './ajuda'

describe('dados de exemplo', () => {
  it('carregam pelas regras e todas as contas batem (diagnóstico limpo)', async () => {
    const { backend } = criarBackend({ tipo: 'memory' })
    await carregarDemo(backend as BackendNoAparelho)
    const d = await backend.consulta('diagnostico', {})
    expect(d.problemas).toEqual([])
    const hoje = dataLocal()
    const p = await backend.consulta('painel', { de: somarDias(hoje, -30), ate: hoje })
    expect(p.cartoes.find((c) => c.id === 'faturamento')!.valor).toBeGreaterThan(0)
    expect(p.alertas.length).toBeGreaterThan(0)
    // clicar = somar: a lista do detalhe soma o número do cartão
    const lista = await backend.consulta('vendas', { de: somarDias(hoje, -30), ate: hoje })
    expect(lista.reduce((s, v) => s + v.valor, 0)).toBe(p.cartoes.find((c) => c.id === 'faturamento')!.valor)
    for (const area of ['cabelo', 'salao']) {
      const pa = await backend.consulta('painel', { de: somarDias(hoje, -30), ate: hoje, area })
      const la = await backend.consulta('vendas', { de: somarDias(hoje, -30), ate: hoje, moduloId: area })
      expect(la.reduce((s, v) => s + v.valor, 0)).toBe(pa.cartoes.find((c) => c.id === 'faturamento')!.valor)
    }
    const rast = await backend.consulta('rastreio', { compraId: 'c-bruto' })
    expect(rast.resumo.lotes).toBe(5)
    expect(rast.resumo.vendas).toBeGreaterThanOrEqual(4)
    const henry = await backend.consulta('contaPessoa', { pessoaId: 'p-henry' })
    expect(henry.saldo).toBeGreaterThan(0)
    const u = await backend.consulta('unidades', { de: somarDias(hoje, -30), ate: hoje })
    expect(u.lista.filter((x) => x.local.tipo === 'salao')).toHaveLength(2)
    const dre = await backend.consulta('dre', { de: somarDias(hoje, -45), ate: hoje })
    expect(dre.socios.map((s) => s.parteBp)).toEqual([5000, 5000])
  }, 60000)
})

/** A MESMA suíte roda em memória, no IndexedDB (local) e pela API simulada: é a garantia da troca. */
async function suiteContrato(b: Backend) {
  await b.comando('salvarConfig', { moedaPrincipal: 'BOB' })
  await b.comando('salvarCotacao', { id: 'c1', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
  await b.comando('salvarPessoa', { id: 'h', nome: 'Henry', papeis: ['cliente'] })
  await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha', saldoInicial: 5 })
  const venda = { id: 'v', pessoaId: 'h', linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(50) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(30) }] }
  await b.comando('concluirVenda', venda)
  await b.comando('concluirVenda', venda) // idempotente
  await expect(b.comando('concluirVenda', { ...venda, id: 'v2', linhas: [{ ...venda.linhas[0], id: 'l2', quantidade: 99 }] })).rejects.toThrow(/Não há/)
  expect((await b.consulta('estoque', { moduloId: 'produtos' }))[0].saldo).toBe(3)
  expect((await b.consulta('contaPessoa', { pessoaId: 'h' })).saldo).toBe(bs(20))
  expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  const backup = await b.exportar()
  expect(JSON.parse(JSON.stringify(backup)).colecoes.transacoes).toHaveLength(1)
}

describe('contrato das portas (troca local ↔ API)', () => {
  it('memória', async () => suiteContrato(criarBackend({ tipo: 'memory' }).backend))
  it('local (IndexedDB)', async () => suiteContrato(criarBackend({ tipo: 'local', nomeBanco: `teste-${Math.random()}` }).backend))
  it('API simulada', async () => {
    const servidor = criarBackend({ tipo: 'memory' }).backend
    const api = new BackendApi({ url: 'https://api.teste', fetch: criarFetchSimulado(servidor), tentativas: 1 })
    await suiteContrato(api)
  })
})
