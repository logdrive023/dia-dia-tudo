// Nova compra: trocar o fornecedor com algo preenchido pergunta e começa limpo; "Voltar" mantém o de antes.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { NovaCompraTela } from '../screens/Comprar'
import { Ctx, type AppCtx, type Navegacao } from '../ui/contexto'
import { novoBackend } from './ajuda'

afterEach(() => cleanup())

function Harness({ base }: { base: Omit<AppCtx, 'nav' | 'ajustarParams'> }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'novaCompra', params: {} })
  return (
    <Ctx.Provider value={{ ...base, nav, ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }}>
      <NovaCompraTela />
    </Ctx.Provider>
  )
}

async function montar() {
  const { b, sessao } = await novoBackend()
  await b.comando('salvarPessoa', { id: 'marta', nome: 'Marta', papeis: ['fornecedor'] })
  await b.comando('salvarPessoa', { id: 'rosa', nome: 'Rosa', papeis: ['fornecedor'] })
  render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, ir: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
}

async function escolher(nome: string) {
  const busca = await screen.findByRole('combobox', {}, { timeout: 5000 }).catch(() => screen.getAllByRole('textbox')[0])
  fireEvent.change(busca, { target: { value: nome } })
  fireEvent.click(await screen.findByText(nome, { selector: 'button *, button' }))
  await screen.findByText('Trocar')
}

const obs = () => screen.getByLabelText('Observação') as HTMLTextAreaElement

describe('nova compra: trocar o fornecedor', () => {
  it('com algo preenchido pergunta; Continuar limpa, Voltar mantém', async () => {
    await montar()
    await escolher('Marta')
    fireEvent.click(await screen.findByText('+ Observação'))
    fireEvent.change(obs(), { target: { value: 'veio úmido' } })
    // trocar e confirmar: começa limpo, com a Rosa
    fireEvent.click(screen.getByText('Trocar'))
    await escolher('Rosa')
    fireEvent.click(await screen.findByText('Continuar'))
    await waitFor(() => expect(obs().value).toBe(''))
    expect(screen.getByText('Rosa', { selector: 'b' })).toBeTruthy()
    // trocar e desistir: volta a Rosa, com o que foi preenchido
    fireEvent.change(obs(), { target: { value: 'outra obs' } })
    fireEvent.click(screen.getByText('Trocar'))
    await escolher('Marta')
    fireEvent.click(await screen.findByText('Voltar'))
    await waitFor(() => expect(screen.queryByText('Trocar o fornecedor?')).toBeNull())
    expect(obs().value).toBe('outra obs')
    expect(screen.getByText('Rosa', { selector: 'b' })).toBeTruthy()
    expect(screen.queryByText('Marta', { selector: 'b' })).toBeNull()
  }, 30000)

  it('sem nada preenchido troca direto', async () => {
    await montar()
    await escolher('Marta')
    fireEvent.click(screen.getByText('Trocar'))
    await escolher('Rosa')
    expect(screen.queryByText('Trocar o fornecedor?')).toBeNull()
  }, 30000)
})
