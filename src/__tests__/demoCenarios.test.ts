// DADOS DE EXEMPLO: cada tela tem o que mostrar na demonstração. Se um cenário sumir (ou um comando passar a recusar),
// este teste avisa — a demonstração não pode ter tela vazia nem conta que não bate.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { carregarDemo } from '../app/demo'
import { novoBackend } from './ajuda'

describe('dados de exemplo: todos os cenários da demonstração', () => {
  it('carrega e cada tela tem o seu cenário', async () => {
    const { b } = await novoBackend()
    await carregarDemo(b)
    const de = '2000-01-01'
    const ate = '2100-12-31'
    // Viagens: 2 com compra (comparar) + 1 prospecção
    const vg = (await b.consulta('viagens', {})).linhas as any[]
    expect(vg.filter((v) => v.gramas > 0).length).toBeGreaterThanOrEqual(2)
    expect(vg.some((v) => !v.gramas)).toBe(true)
    // Vendas: concluídas, cancelada, com desconto, de produto, de Tinte, em aberto, com divisão
    const vendas = (await b.consulta('vendas', { de, ate })) as any[]
    const canceladas = (await b.consulta('vendas', { de, ate, etapa: 'cancelado' })) as any[]
    expect(canceladas.map((v) => v.id)).toContain('v-cancelada')
    expect(vendas.find((v) => v.id === 'v-produto')?.vendedora).toBe('Paula')
    expect(vendas.some((v) => v.id === 'v-wilson')).toBe(true)
    expect(((await b.consulta('vendasAbertas', {})) as any[]).map((v) => v.id)).toContain('va-pw')
    expect(((await b.consulta('venda', { id: 'v-henry2' })) as any).venda.divisao?.partes.length).toBe(3)
    // Compras: cancelada; pacote juntado na triagem
    const compra = (await b.consulta('compra', { id: 'c-cancelada' })) as any
    expect(compra.compra.etapa).toBe('cancelado')
    expect(((await b.consulta('estoque', { moduloId: 'cabelo' })) as any[]).some((i) => i.id === 'lote-juntado')).toBe(true)
    // Agenda: compromissos (um feito), feriados
    const cal = (await b.consulta('calendario', { de, ate })) as any[]
    expect(cal.filter((i) => i.tipo === 'compromisso').length).toBeGreaterThanOrEqual(3)
    // Acesso: forma desligada, usuário desativado, liberações da funcionária
    const cfg = (await b.consulta('configuracoes', {})).config as any
    expect(cfg.formas.find((f: any) => f.id === 'debito').desligada).toBe(true)
    expect(cfg.funcionariaTelas).toEqual(['viagens'])
    expect(((await b.consulta('usuarios', {})) as any[]).find((u) => u.login === 'ex.funcionaria')?.ativo).toBe(false)
    // Imposto de Renda: obrigação registrada no ano
    const ano = Number(new Date().toISOString().slice(0, 4))
    const ir = (await b.consulta('impostoRenda', { ano })) as any
    expect(JSON.stringify(ir)).toContain('1029384756')
    // e as contas continuam batendo
    expect(((await b.consulta('diagnostico', {})) as any).problemas).toEqual([])
  }, 120000)
})
