// DIVISÃO DE VALORES DA VENDA: o detalhe (bruto → desconto → cobrado → impostos → líquido → lucro) fecha; a divisão
// por % (de cada base) e por valor fixo grava na venda, vai para o histórico e NÃO mexe no caixa.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function montar() {
  const { b } = await novoBackend()
  await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 10 })
  await b.comando('concluirVenda', { id: 'v', desconto: { moeda: 'BOB', pct: 10 }, linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(900) }] })
  return b
}

describe('divisão de valores', () => {
  it('o estado de resultado da venda fecha (padrão boliviano): lista − desconto = faturado − IVA = líquidas … = resultado', async () => {
    const b = await montar()
    const d = await b.consulta('divisaoVenda', { id: 'v' })
    expect(d.totais).toMatchObject({ bruto: bs(1000), desconto: bs(100), cobrado: bs(900) })
    // padrão boliviano: vendas líquidas = faturado − IVA (13% de 900 = 117); o IT (3% = 27) vem depois do lucro bruto
    expect(d.totais.iva).toBe(bs(117))
    expect(d.totais.liquido).toBe(d.totais.cobrado - d.totais.iva)
    expect(d.totais.outrosImpostos).toBe(bs(27))
    expect(d.estado.map((x) => x.id)).toEqual(['lista', 'desconto', 'facturado', 'iva', 'netas', 'costo', 'bruta', 'imp-IT', 'resultado'])
    const r = d.estado.find((x) => x.id === 'resultado')!
    expect(r.valor).toBe(d.totais.liquido - (d.totais.custo ?? 0) - (d.totais.servicos ?? 0) - d.totais.outrosImpostos)
    expect(d.estado.find((x) => x.id === 'facturado')!.pctBp).toBe(10000)
    expect(d.linhas).toHaveLength(1)
    expect(d.verCusto).toBe(true)
  })

  it('divide por % (de bases diferentes) e por valor fixo; o resto fica com a casa; o caixa não muda', async () => {
    const b = await montar()
    const caixaAntes = JSON.stringify(await (b as any).repos.movCaixa.listar())
    const r = await b.comando('salvarDivisaoVenda', { id: 'v', partes: [
      { id: 'a', nome: 'Paula', modo: 'pct', pctBp: 2500, base: 'total' },
      { id: 'c', nome: 'Sócia', modo: 'valor', valor: bs(100), base: 'total' },
    ] })
    expect(r).toMatchObject({ id: 'v' })
    const d = await b.consulta('divisaoVenda', { id: 'v' })
    expect(d.divisao.partes.map((p) => [p.nome, p.calculado])).toEqual([['Paula', bs(225)], ['Sócia', bs(100)]])
    expect(d.divisao).toMatchObject({ dividido: bs(325), casa: bs(575) })
    expect(JSON.stringify(await (b as any).repos.movCaixa.listar())).toBe(caixaAntes)
    // fica no histórico (log detalhado)
    const log = (await b.consulta('logDetalhado', { acao: 'salvarDivisaoVenda' })).linhas
    expect(log.map((l: any) => l.resumo).join(' ')).toMatch(/Paula 25% do total = Bs\s?225,00/)
  })

  it('recusa: sem nome, % fora de 0–100, partes acima do total; lista vazia tira a divisão', async () => {
    const b = await montar()
    await expect(b.comando('salvarDivisaoVenda', { id: 'v', partes: [{ id: 'a', nome: ' ', modo: 'pct', pctBp: 1000, base: 'total' }] })).rejects.toThrow(/com quem/)
    await expect(b.comando('salvarDivisaoVenda', { id: 'v', partes: [{ id: 'a', nome: 'X', modo: 'pct', pctBp: 12000, base: 'total' }] })).rejects.toThrow(/0 a 100/)
    await expect(b.comando('salvarDivisaoVenda', { id: 'v', partes: [{ id: 'a', nome: 'X', modo: 'valor', valor: bs(1000), base: 'total' }] })).rejects.toThrow(/mais que o total/)
    await b.comando('salvarDivisaoVenda', { id: 'v', partes: [{ id: 'a', nome: 'X', modo: 'pct', pctBp: 1000, base: 'lucro' }] })
    await b.comando('salvarDivisaoVenda', { id: 'v', partes: [] })
    expect((await b.consulta('divisaoVenda', { id: 'v' })).divisao.partes).toEqual([])
  })

  it('funcionária não abre a divisão (custo e lucro são do administrador) e não divide', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p-s', nome: 'Sofia', papeis: ['funcionario'] } as any)
    await b.comando('salvarUsuario', { id: 'u-s', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', pessoaId: 'p-s', senha: '1234' } as any)
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 10 })
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'p-s', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(100), profissionalId: 'p-s' }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] } as any)
    Object.assign(sessao, await b.entrar('sofia', '1234'))
    await expect(b.consulta('divisaoVenda', { id: 'v' })).rejects.toThrow(/permissão/)
    await expect(b.comando('salvarDivisaoVenda', { id: 'v', partes: [] })).rejects.toThrow(/administrador/)
  })
})
