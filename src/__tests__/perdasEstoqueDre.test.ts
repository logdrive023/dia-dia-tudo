// PERDAS DE ESTOQUE NO DRE (a custo, cada uma numa linha que diz o que é):
//   "(−) Perda de estoque lançada à mão (a custo)" — perda ou acerto para menos feito no estoque
//   "(−) Perda de peso na lavagem (a custo)"       — o peso que a lavagem tirou
// Não entram: a conferência de peso da compra (o custo é redistribuído) e o acerto para mais.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, hojeReal, novoBackend } from './ajuda'

const MAO = '(−) Perda de estoque lançada à mão (a custo)'
const LAVAGEM = '(−) Perda de peso na lavagem (a custo)'
const periodo = { de: '2000-01-01', ate: '2100-12-31' }

async function comprar(b: any, id: string, g: number, custoBs: number) {
  await b.comando('criarCompra', { id, moduloId: 'cabelo', linhas: [{ id: id + '-l', quantidade: g, moeda: 'BOB', total: bs(custoBs), campos: { estado: 'Bruto' } }] })
  return (await b.repos.transacoes.obter(id)).linhas[0].itemId as string
}
const linha = (d: any, conta: string) => (d.linhas as any[]).find((l) => l.conta === conta)

describe('perdas de estoque no DRE', () => {
  it('perda à mão: o custo das gramas vira despesa com nome próprio e baixa o resultado', async () => {
    const { b } = await novoBackend(hojeReal())
    const L = await comprar(b, 'c1', 10000, 1000) // Bs 0,10/g
    await b.comando('ajustarEstoque', { itemId: L, novoSaldo: 9500, motivo: 'perda', descricao: 'pontas' } as any)
    const d: any = await b.consulta('dre', periodo)
    expect(linha(d, MAO)?.valor).toBe(-bs(50))
    expect(d.perdasEstoque).toEqual({ mao: bs(50), lavagem: 0 })
    expect(d.resultado).toBe(-bs(50))
    // acerto para MENOS também é baixa à mão; para MAIS não é perda
    await b.comando('ajustarEstoque', { itemId: L, novoSaldo: 9400, motivo: 'ajuste', descricao: 'contagem' } as any)
    await b.comando('ajustarEstoque', { itemId: L, novoSaldo: 9450, motivo: 'ajuste', descricao: 'achei' } as any)
    expect((await b.consulta('dre', periodo) as any).perdasEstoque.mao).toBe(bs(60))
    // a conta fecha: estoque a custo + perdas = o que foi comprado (nada some)
    const inv: any = await b.consulta('inventario', { moduloId: 'cabelo' })
    expect(inv.valor + bs(60)).toBe(bs(1000) + Math.round((50 * bs(1000)) / 10000)) // os 50 g "achados" valem a custo
  })

  it('lavagem: o peso que saiu vira "Perda de peso na lavagem"; a conferência de peso da compra não entra', async () => {
    const { b } = await novoBackend(hojeReal())
    const L = await comprar(b, 'c1', 10000, 2000) // Bs 0,20/g
    // conferência na balança: 10 kg → 9,8 kg (o custo pago passa a valer para o peso novo: não é perda)
    await b.comando('conferirPesoCompra', { compraId: 'c1', itemId: L, pesado: 9800, motivo: 'balança' } as any)
    expect((await b.consulta('dre', periodo) as any).perdasEstoque).toEqual({ mao: 0, lavagem: 0 })
    // lavou: 9,8 kg → 9,3 kg (500 g a Bs 2000/9800 por grama)
    await b.comando('moverFaseTriagem', { ids: [L], fase: 'aguardando', obs: 'lavou', pesos: { [L]: 9300 } } as any)
    const d: any = await b.consulta('dre', periodo)
    expect(linha(d, LAVAGEM)?.valor).toBe(-Math.round((500 * bs(2000)) / 9800))
    expect(linha(d, MAO)).toBeUndefined()
  })

  it('sem perda no período: nenhuma linha nova', async () => {
    const { b } = await novoBackend(hojeReal())
    await comprar(b, 'c1', 1000, 100)
    const d: any = await b.consulta('dre', periodo)
    expect(linha(d, MAO)).toBeUndefined()
    expect(linha(d, LAVAGEM)).toBeUndefined()
  })
})

describe('perdas de estoque nos relatórios', () => {
  it('os Estados financeiros mostram a perda como gasto, com o mesmo nome, e a conferência fecha', async () => {
    const { b } = await novoBackend(hojeReal())
    const L = await comprar(b, 'c1', 10000, 1000)
    await b.comando('ajustarEstoque', { itemId: L, novoSaldo: 9000, motivo: 'perda', descricao: 'estragou' } as any)
    const r: any = await b.consulta('relatorioContabil', periodo as any)
    expect(r.anexos.gastos).toEqual(expect.arrayContaining([{ categoria: 'Perda de estoque lançada à mão (a custo)', valor: bs(100) }]))
    expect((r.conferencia ?? r.conferencias ?? []).every((c: any) => c.esperado === c.achado)).toBe(true)
  })
})
