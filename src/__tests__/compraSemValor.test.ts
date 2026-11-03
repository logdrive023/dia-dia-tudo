// COMPRA SEM VALOR: cabelo que já tínhamos (ou valor ainda desconhecido) entra só com o peso — total 0, o lote
// nasce na Triagem e fica a pendência "Sem valor" até alguém pôr o valor. Não trava a operação.

import { describe, expect, it } from 'vitest'
import { novoBackend } from './ajuda'

describe('compra sem valor', () => {
  it('registra só o peso, o bruto vai para a triagem e fica "Sem valor" no que falta', async () => {
    const { b } = await novoBackend()
    await b.comando('criarCompra', { id: 'sv', moduloId: 'cabelo', semValor: true, linhas: [{ id: 'l', quantidade: 3000, moeda: 'BOB', total: 0, campos: { estado: 'Bruto' } }] })
    const fila = await b.consulta('filaTriagem', { incluirEncerradas: true })
    const c = fila.find((x) => x.id === 'sv')!
    expect(c.totalPrincipal).toBe(0)
    expect(c.pendencias.map((p) => p.id)).toContain('semValor')
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    expect(lotes.some((i) => i.compras.some((x) => x.id === 'sv') && i.saldo === 3000)).toBe(true)
  })
})
