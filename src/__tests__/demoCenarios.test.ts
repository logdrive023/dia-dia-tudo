// DADOS DE EXEMPLO: cada tela tem o que mostrar na demonstração. Se um cenário sumir (ou um comando passar a recusar),
// este teste avisa — a demonstração não pode ter tela vazia nem conta que não bate.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { PASSOS_DEMO, aoProgressoDemo, carregarDemo, passosDaUltimaMontagem } from '../adapters/demo'
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

describe('dados de exemplo: a vitrine', () => {
  it('tem pacotes prontos de várias medidas, um escondido, e a loja configurada', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const adm = (await b.consulta('vitrine', {})) as any
    expect(adm.pacotes.length).toBeGreaterThanOrEqual(8)
    expect(adm.pacotes.some((x: any) => x.oculto)).toBe(true)
    expect(adm.loja.whatsapp).toBe('+59170000000')
    expect(((await b.consulta('diagnostico', {})) as any).problemas).toEqual([])
    Object.assign(sessao, { usuarioId: '', perfil: undefined, nome: '' })
    const pub = (await b.consulta('vitrine', { publico: true })) as any
    expect(pub.pacotes.length).toBe(adm.pacotes.length - 1)
    expect(new Set(pub.pacotes.map((x: any) => x.medida)).size).toBeGreaterThanOrEqual(6)
    expect(pub.pacotes.some((x: any) => x.categoria === 'Tinte')).toBe(true)
    expect(pub.pacotes.filter((x: any) => x.preco).length).toBeGreaterThan(0)
  }, 120000)
})

describe('dados de exemplo: a barra de progresso da abertura', () => {
  it('a porcentagem é de verdade (comandos feitos / PASSOS_DEMO): só sobe, troca de etapa e termina em 100', async () => {
    const { b } = await novoBackend()
    const vistos: { pct: number; etapa: string }[] = []
    const parar = aoProgressoDemo((p) => p && vistos.push(p))
    await carregarDemo(b)
    parar()
    // mudou a demonstração? atualize PASSOS_DEMO (adapters/demo.ts) com o número abaixo
    expect(Math.abs(passosDaUltimaMontagem() - PASSOS_DEMO)).toBeLessThanOrEqual(Math.ceil(PASSOS_DEMO * 0.1))
    expect(vistos.every((p, i) => i === 0 || p.pct >= vistos[i - 1].pct)).toBe(true)
    expect(vistos.at(-1)).toEqual({ pct: 100, etapa: 'Pronto' })
    expect(Math.max(...vistos.slice(0, -1).map((p) => p.pct))).toBeGreaterThanOrEqual(90)
    expect(new Set(vistos.map((p) => p.etapa)).size).toBeGreaterThanOrEqual(7)
  }, 120_000)
})
