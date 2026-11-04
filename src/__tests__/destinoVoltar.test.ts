// A regra do "voltar" (a mesma que a trilha mostra): veio da lista → a lista; veio de outro detalhe/formulário → a
// lista da área (pulando até ela se está no histórico); abriu por link → troca pela lista da área.

import { describe, expect, it } from 'vitest'
import { destinoVoltar } from '../app/rotas'

const n = (tela: string, params: Record<string, string> = {}) => ({ tela, params })

describe('destinoVoltar', () => {
  it('veio de uma lista (com filtros): volta para ela', () => {
    const d = destinoVoltar([n('triagem', { aba: 'triagens' }), n('lote', { id: 'L1' })])
    expect(d.modo).toBe('anterior')
    expect(d.alvo).toEqual(n('triagem', { aba: 'triagens' }))
  })

  it('Nova compra → Pedido: vai para Compras, pulando o formulário', () => {
    const d = destinoVoltar([n('comprar'), n('novaCompra'), n('pedido', { id: 'P1' })])
    expect(d).toMatchObject({ modo: 'pular', passos: -2, alvo: n('comprar') })
  })

  it('pacote aberto de dentro do pedido: vai para Estoque (a lista da área do pacote)', () => {
    const d = destinoVoltar([n('pedido', { id: 'P1' }), n('lote', { id: 'L1' })])
    expect(d).toMatchObject({ modo: 'trocar', alvo: n('estoque') })
  })

  it('abriu por link (sem histórico): troca pela lista da área; tela sem pai vai ao Painel', () => {
    expect(destinoVoltar([n('rastreio', { itemId: 'L1' })]).alvo).toEqual(n('estoque'))
    expect(destinoVoltar([n('livro')]).alvo).toEqual(n('painel'))
  })
})
