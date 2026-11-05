// OS IMPOSTOS DA VENDA SEGUEM O REGIME (Configurações › Fiscal): RTS = nenhum por venda (cota fixa); Régimen General sem
// fatura = sem IVA na venda (o IT continua); Brasil Simples = só o DAS. A tela e o registro usam a mesma regra.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { FISCAL_PADRAO, IMPOSTOS_PADRAO_BO, IMPOSTOS_PADRAO_BR, impostosDoRegime } from '../core/dados/impostos'
import { bs, novoBackend } from './ajuda'

const todos = [...IMPOSTOS_PADRAO_BO, ...IMPOSTOS_PADRAO_BR]
const siglas = (r: { linhas: { sigla: string }[] }) => [...new Set(r.linhas.map((l) => l.sigla))].sort()

describe('impostos por regime', () => {
  it('a regra: RTS tira tudo (com aviso); sem fatura tira o IVA da venda; compra sem fatura não dá crédito; Brasil Simples = DAS', () => {
    const base = { ...FISCAL_PADRAO, impostos: todos }
    expect(impostosDoRegime({ ...base, pais: 'BO', regimeBO: 'rts' })).toMatchObject({ lista: [] })
    expect(impostosDoRegime({ ...base, pais: 'BO', regimeBO: 'rts' }).aviso).toMatch(/RTS/)
    const semFatura = impostosDoRegime({ ...base, pais: 'BO', regimeBO: 'general', vendasComFatura: false, comprasComFatura: false })
    const iva = semFatura.lista.find((i) => i.id === 'iva')!
    expect([iva.vendaProduto, iva.vendaServico, iva.compra]).toEqual([false, false, 'nao'])
    expect(semFatura.lista.some((i) => i.id === 'it')).toBe(true)
    expect(semFatura.lista.some((i) => i.id === 'das')).toBe(false)
    expect(impostosDoRegime({ ...base, pais: 'BR', regimeBR: 'simples' }).lista.map((i) => i.id)).toEqual(['das'])
    expect(impostosDoRegime({ ...base, pais: 'BR', regimeBR: 'presumido' }).lista.map((i) => i.id)).toEqual([])
  })

  it('a venda (tela) mostra o que o regime manda; RTS = nenhuma linha e o aviso', async () => {
    const { b } = await novoBackend()
    const fiscal = async (f: object) => b.comando('salvarConfig', { fiscal: f } as any)
    const op = () => b.consulta('impostosOperacao', { produto: bs(100) })
    expect(siglas(await op())).toEqual(['IT', 'IVA'])
    await fiscal({ vendasComFatura: false })
    expect(siglas(await op())).toEqual(['IT'])
    await fiscal({ regimeBO: 'rts' })
    const rts = await op()
    expect(rts.linhas).toEqual([])
    expect(rts.aviso).toMatch(/cota fixa/)
  })

  it('cada imposto pré-definido explica o que é e o que se paga na prática', () => {
    for (const i of todos) {
      expect(i.porQue, i.id).toBeTruthy()
      expect(i.naPratica, i.id).toBeTruthy()
      expect(i.fonte, i.id).toBeTruthy()
    }
  })
})

describe('relatório contábil: resumo estimado dos impostos', () => {
  it('cada imposto a pagar com a % das vendas; o total do resumo = o total estimado da apuração', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', precoSugerido: { moeda: 'BOB', valor: bs(1000) } } as any)
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    const rel: any = await b.consulta('relatorioContabil', { de: r.hoje, ate: r.hoje })
    const siglasR = rel.resumoImpostos.itens.map((i: any) => i.sigla)
    expect(siglasR).toEqual(expect.arrayContaining(['IVA', 'IT', 'IUE']))
    const total = rel.impostos.find((l: any) => l.id === 'totalImp').valor
    expect(rel.resumoImpostos.total).toBe(total)
    expect(rel.resumoImpostos.itens.find((i: any) => i.sigla === 'IT').pctBp).toBe(300)
    expect(rel.impostos.find((l: any) => l.id === 'totalImp').rotulo).toMatch(/estimado/)
  })
})
