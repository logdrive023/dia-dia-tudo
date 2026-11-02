// Compra ligada à VIAGEM já ao registrar: viagem aberta, log igual ao "ligar compras", campo obrigatório no formulário,
// funcionária só na viagem dela, e a tela do pedido mostra a viagem.

import { describe, expect, it } from 'vitest'
import type { Ctx } from '../core/services/contexto'
import { criarCompra } from '../core/services/compras'
import { bs, novoBackend } from './ajuda'

const linhas = [{ id: 'l', quantidade: 1000, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } }]

async function cenario() {
  const x = await novoBackend()
  await x.b.comando('salvarPessoa', { id: 'p-ana', nome: 'Ana', papeis: ['funcionario'] })
  await x.b.comando('salvarPessoa', { id: 'p-bia', nome: 'Bia', papeis: ['funcionario'] })
  await x.b.comando('salvarViagem', { id: 'vg', nome: 'Feira de Oruro', destino: 'Oruro', viajantes: ['p-ana'], inicio: x.r.hoje })
  return x
}

describe('compra ligada à viagem', () => {
  it('criarCompra com viagemId liga a compra à viagem aberta (com o log da viagem) e o pedido mostra a viagem', async () => {
    const { b } = await cenario()
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', linhas, viagemId: 'vg', compradorId: 'p-ana' })
    const p = await b.consulta('pedido', { id: 'c1' })
    expect(p.compra.viagemId).toBe('vg')
    expect(p.viagem).toMatchObject({ id: 'vg', destino: 'Oruro', status: 'aberta' })
    const log = (await b.consulta('logDetalhado', { acao: 'vincularCompras' })).linhas
    expect(log[0]).toMatchObject({ alvoId: 'vg' })
    expect(log[0].ligados).toContain('c1')
    // o painel da viagem já conta a compra
    expect((await b.consulta('viagem', { id: 'vg' })).compras.some((c: { id: string }) => c.id === 'c1')).toBe(true)
    await expect(b.comando('criarCompra', { id: 'c2', moduloId: 'cabelo', linhas, viagemId: 'nao-existe' })).rejects.toThrow(/Viagem não encontrada/)
  })

  it('viagem obrigatória no formulário; funcionária só liga à viagem em que está', async () => {
    const { b, sessao } = await cenario()
    const f = await b.consulta('formCompra', {})
    expect(f.campos.some((c) => c.id === 'viagem' && c.visivel && !c.aberto)).toBe(true)
    await b.comando('salvarFormCompra', { form: { ...f, campos: f.campos.map((c) => (c.id === 'viagem' ? { ...c, obrigatorio: true } : c)) } })
    await expect(b.comando('criarCompra', { id: 'c3', moduloId: 'cabelo', linhas })).rejects.toThrow(/Escolha a viagem/)
    // regra da funcionária, direto no serviço (a lista de permissões é outra conversa)
    const ctx = (b as unknown as { ctx(): Ctx }).ctx()
    Object.assign(ctx.sessao, { usuarioId: 'u-bia', nome: 'Bia', perfil: 'funcionario', pessoaId: 'p-bia' })
    await expect(criarCompra(ctx, { id: 'c4', moduloId: 'cabelo', linhas, viagemId: 'vg' })).rejects.toThrow(/viagem em que você está/)
    Object.assign(ctx.sessao, { usuarioId: 'u-ana', nome: 'Ana', pessoaId: 'p-ana' })
    expect((await criarCompra(ctx, { id: 'c5', moduloId: 'cabelo', linhas, viagemId: 'vg' })).id).toBe('c5')
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin', pessoaId: undefined })
  })
})
