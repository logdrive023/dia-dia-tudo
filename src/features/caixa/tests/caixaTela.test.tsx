// CAIXA (tela): abre o caixa de hoje → toca em Despesa → digita 150 → Lançar → o movimento aparece e o saldo
// cai Bs 150. Depois "Ver em US$" com a cotação digitada (1 US$ = 5 Bs) converte o total: Bs 50 = US$ 10,00.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Caixa } from '../pages/Caixa'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { hojeReal, novoBackend } from '../../../__tests__/ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function Harness({ base }: { base: Omit<AppCtx, 'nav' | 'ajustarParams' | 'ir'> }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'caixa', params: {} })
  const ctx: AppCtx = {
    ...base,
    nav,
    ir: (tela, params = {}) => setNav({ tela, params }),
    ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })),
  }
  return <Ctx.Provider value={ctx}>{nav.tela === 'caixa' ? <Caixa /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
}

describe('tela do caixa', () => {
  it('lança uma despesa de Bs 150 em 3 toques e converte o saldo para US$', async () => {
    // o caixa abre no dia de hoje do aparelho: o backend usa o mesmo dia
    const { b, sessao } = await novoBackend(hojeReal())
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'entrada', moeda: 'BOB', forma: 'dinheiro', valor: 20000, descricao: 'Troco inicial' })
    const avisos: string[] = []
    render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: (t) => void avisos.push(t) }} />)

    const total = await screen.findByTestId('saldo-total', {}, { timeout: 10000 })
    await waitFor(() => expect(total.textContent).toBe('Bs 200,00'))

    fireEvent.click(screen.getByRole('button', { name: /Despesa/ }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText(/Quanto\?/), { target: { value: '150' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Lançar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(avisos).toContain('Lançado.')
    await waitFor(() => expect(screen.getByTestId('saldo-total').textContent).toBe('Bs 50,00'))
    const lista = document.getElementById('cx-movimentos')!
    expect(within(lista).getByText('Despesa')).toBeTruthy()
    expect(within(lista).getByText('−Bs 150,00')).toBeTruthy()

    // ver em dólar com a cotação digitada aqui (só para ver)
    fireEvent.click(screen.getByRole('radio', { name: 'US$' }))
    fireEvent.change(screen.getByLabelText('Cotação de US$'), { target: { value: '5' } })
    await waitFor(() => expect(screen.getByTestId('saldo-total').textContent).toBe('US$ 10,00'))
    // o lançamento continua em Bs
    expect(within(lista).getByText('−Bs 150,00')).toBeTruthy()
  }, 30000)
})
