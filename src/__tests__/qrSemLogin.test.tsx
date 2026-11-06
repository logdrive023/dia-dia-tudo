// QR LIDO POR QUEM NÃO ENTROU (aparelho de fora): só a página neutra — sem nome do negócio, sem lista de usuários de
// teste e sem montar dados de exemplo. "Entrar" mostra o login, ainda sem os usuários de teste.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../app/App'

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
  window.history.replaceState(null, '', '/#/q/AbCdEfGhJk23mnPq')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('QR sem login', () => {
  it('mostra só a página neutra; o login vem sem usuários de teste e sem dados de exemplo', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Etiqueta de uso interno' }, { timeout: 10000 })).toBeTruthy()
    expect(screen.queryByText(/Cabelos & Salão/)).toBeNull()
    expect(screen.queryByText(/Modo de teste/)).toBeNull()
    expect(screen.queryByText(/Montando/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByLabelText('Usuário')).toBeTruthy()
    expect(screen.queryByText(/Modo de teste/)).toBeNull()
    expect(screen.queryByText('admin', { selector: 'span.font-mono' })).toBeNull()
  }, 60000)
})
