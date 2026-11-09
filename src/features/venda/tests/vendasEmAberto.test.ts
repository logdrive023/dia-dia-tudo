// VENDAS EM ABERTO: idade na lista, filtros rápidos e venda de só uma parte de um pacote guardado noutra venda.
import { describe, expect, it } from 'vitest'
import { carregarDemo } from '../../../adapters/demo'
import { novoBackend } from '../../../__tests__/ajuda'
import { estaParada, minutosAberta, passaFiltroAberta, textoIdade } from '../model/vendasEmAberto'

const t = (s: string, v: Record<string, string | number> = {}) => Object.entries(v).reduce((x, [k, n]) => x.replace(`{${k}}`, String(n)), s)
const agora = Date.parse('2026-11-09T12:00:00Z')
const ha = (min: number) => new Date(agora - min * 60000).toISOString()

describe('idade da venda em aberto', () => {
  it('diz há quanto tempo está aberta', () => {
    expect(textoIdade(minutosAberta(ha(0), agora), t)).toBe('Aberta agora')
    expect(textoIdade(minutosAberta(ha(15), agora), t)).toBe('Aberta há 15 min')
    expect(textoIdade(minutosAberta(ha(125), agora), t)).toBe('Aberta há 2 h')
    expect(textoIdade(minutosAberta(ha(1440), agora), t)).toBe('Aberta há 1 dia')
    expect(textoIdade(minutosAberta(ha(4400), agora), t)).toBe('Aberta há 3 dias')
    expect(minutosAberta(ha(-30), agora)).toBe(0)
    expect(estaParada(1439)).toBe(false)
  })
  it('filtros rápidos', () => {
    const nova = { abertaEm: ha(10), minha: false }
    const velha = { abertaEm: ha(3000), minha: true }
    expect([nova, velha].filter((a) => passaFiltroAberta('', a, agora))).toHaveLength(2)
    expect([nova, velha].filter((a) => passaFiltroAberta('minhas', a, agora))).toEqual([velha])
    expect([nova, velha].filter((a) => passaFiltroAberta('recentes', a, agora))).toEqual([nova])
    expect([nova, velha].filter((a) => passaFiltroAberta('paradas', a, agora))).toEqual([velha])
  })
})

describe('parte de um pacote guardado noutra venda em aberto', () => {
  async function cenario(guardado?: number) {
    const { b } = await novoBackend()
    await carregarDemo(b)
    await b.comando('descartarVendaAberta', { id: 'va-pw' })
    const p = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.codigo && i.unidade === 'grama' && i.saldo >= 300)
    if (!p) throw new Error('sem pacote no exemplo')
    await b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'a', itemId: p.id, quantidade: guardado ?? p.saldo }] })
    const vender = (q: number) => b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: p.id, quantidade: q, moeda: 'BOB', total: 100 }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: 100 }] })
    const saldo = async () => (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === p.id)?.saldo
    return { b, p, vender, saldo }
  }

  it('a outra venda fica com o resto, o estoque só muda ao fechar e ela continua com o pacote', async () => {
    const { b, p, vender, saldo } = await cenario()
    await b.comando('reduzirNaVendaAberta', { id: 'va', itemId: p.id, quantidade: 100, para: 'caixa' })
    expect((await b.consulta('vendasAbertas', {}))[0].linhas[0].quantidade).toBe(p.saldo - 100)
    expect(await saldo()).toBe(p.saldo)
    expect((await b.consulta('logDetalhado', { acao: 'reduzirNaVendaAberta' })).linhas).toHaveLength(1)
    await vender(100)
    expect(await saldo()).toBe(p.saldo - 100)
    expect((await b.consulta('vendasAbertas', {}))[0].linhas[0].quantidade).toBe(p.saldo - 100)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  }, 30000)

  it('se as duas cabem no saldo, a outra não muda', async () => {
    const { b, p } = await cenario(100)
    await b.comando('reduzirNaVendaAberta', { id: 'va', itemId: p.id, quantidade: 100 })
    expect((await b.consulta('vendasAbertas', {}))[0].linhas[0].quantidade).toBe(100)
    expect((await b.consulta('logDetalhado', { acao: 'reduzirNaVendaAberta' })).linhas).toHaveLength(0)
  }, 30000)

  it('recusa o pacote inteiro, zero e fração', async () => {
    const { b, p } = await cenario()
    await expect(b.comando('reduzirNaVendaAberta', { id: 'va', itemId: p.id, quantidade: p.saldo })).rejects.toThrow(/inteiro/)
    await expect(b.comando('reduzirNaVendaAberta', { id: 'va', itemId: p.id, quantidade: 0 })).rejects.toThrow()
    await expect(b.comando('reduzirNaVendaAberta', { id: 'va', itemId: p.id, quantidade: 1.5 })).rejects.toThrow()
  }, 30000)

  it('vendeu mais do que sobraria para a outra: o pacote sai dela e fica anotado', async () => {
    const { b, p, vender } = await cenario()
    await vender(50)
    expect(await b.consulta('vendasAbertas', {})).toHaveLength(0)
    expect((await b.consulta('logDetalhado', { acao: 'tirarDaVendaAberta' })).linhas[0].resumo).toMatch(/foi para V-/)
    expect(p.saldo).toBeGreaterThan(50)
  }, 30000)
})
