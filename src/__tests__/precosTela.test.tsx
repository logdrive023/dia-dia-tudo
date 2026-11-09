// Tela da tabela de preço: toca no número → digita → Enter vai para a de baixo; o que mudou aparece com "era X";
// a barra "N mudança(s) · Publicar vN" publica uma versão nova (salvarTabelaPreco) e o Histórico compara.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../app/App'

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
  // "Tabelas de preço" fica no grupo Cabelo, que começa fechado
  localStorage.setItem('tudo.menu.gruposAbertos', JSON.stringify(['Cabelo']))
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('tabela de preço (tela)', () => {
  it('edita na grade, desfaz, publica versão nova e mostra no histórico', async () => {
    render(<App />)
    fireEvent.click((await screen.findAllByText('admin', { selector: 'span.font-mono' }, { timeout: 30000 }))[0])
    await screen.findByText('Precisa de você', {}, { timeout: 30000 })
    fireEvent.click(within(screen.getAllByRole('navigation')[0]).getByText('Tabelas de preço'))
    fireEvent.click(await screen.findByText('Tabela geral (Normal)', {}, { timeout: 60000 }))

    const publicar = () => screen.queryByRole('button', { name: /^Publicar v\d+$/ })
    fireEvent.click(await screen.findByRole('button', { name: '60 cm · Helena: 16' }, { timeout: 60000 }))
    const campo = screen.getByRole('textbox', { name: '60 cm · Helena' })
    fireEvent.change(campo, { target: { value: '16.5' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    // Enter grava e abre a célula de baixo (70 cm)
    const baixo = await screen.findByRole('textbox', { name: '70 cm · Helena' })
    fireEvent.keyDown(baixo, { key: 'Escape' })
    expect(screen.getByRole('button', { name: '60 cm · Helena: 16,5 (era 16)' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 mudança(s)')

    // desfazer volta ao publicado: a barra some
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }))
    await waitFor(() => expect(publicar()).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: '60 cm · Helena: 16' }))
    const c2 = screen.getByRole('textbox', { name: '60 cm · Helena' })
    fireEvent.change(c2, { target: { value: '17' } })
    fireEvent.blur(c2)
    fireEvent.change(screen.getByRole('textbox', { name: 'O que mudou e por quê (opcional)' }), { target: { value: 'Subiu 60 cm Helena' } })
    const botao = publicar()!
    const proxima = botao.textContent!.replace('Publicar ', '')
    fireEvent.click(botao)
    // com a suíte inteira em paralelo a tela pode levar mais que 10 s para recarregar a tabela publicada (instável antes)
    await waitFor(() => expect(publicar()).toBeNull(), { timeout: 60000 })
    await screen.findByRole('button', { name: '60 cm · Helena: 17' }, { timeout: 60000 })

    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }))
    await screen.findByText('“Subiu 60 cm Helena”', {}, { timeout: 60000 })
    await screen.findByText(new RegExp(`→ ${proxima}: \\d+ preço`), {}, { timeout: 60000 })
    expect((await screen.findAllByText('+6,3%', {}, { timeout: 60000 })).length).toBeGreaterThan(0)
  }, 300000)
})
