// VENDER = o módulo de vendas: a lista abre direto pelo menu (sem passar pelo Painel), busca, abas e filtro vindo do Painel.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../app/App'

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

async function abrirVender() {
  render(<App />)
  fireEvent.click((await screen.findAllByText('admin', { selector: 'span.font-mono' }, { timeout: 30000 }))[0])
  await screen.findByText('Precisa de você', {}, { timeout: 30000 })
  fireEvent.click(within(screen.getAllByRole('navigation')[0]).getByText('Vender'))
  await screen.findByRole('heading', { level: 1, name: 'Vender' }, { timeout: 15000 })
}

const CONTAGEM = /\d+ de \d+ venda\(s\)/
/** a contagem do resultado ("4 de 18 venda(s)") — só aparece com busca ou filtro ligado */
const contagem = async () => (await screen.findAllByText(CONTAGEM, {}, { timeout: 15000 })).find((e) => e.closest('[aria-live]'))!
/** o número de uma aba ("Concluídas 21") */
const naAba = (nome: RegExp) => Number(screen.getByRole('tab', { name: nome }).textContent!.match(/\d+/)![0])

describe('lista de vendas no Vender', () => {
  it('abre pelo menu com a lista, a busca filtra e as abas trocam a situação', async () => {
    await abrirVender()
    // a lista está aqui (sem o Painel) e o botão principal é "+ Nova venda"
    expect((await screen.findAllByRole('button', { name: '+ Nova venda' }, { timeout: 15000 })).length).toBeGreaterThan(0)
    await screen.findByRole('tab', { name: /Concluídas \d+/ }, { timeout: 15000 })
    const n = naAba(/Concluídas/)
    expect(n).toBeGreaterThan(0)
    // sem filtro não há contagem repetida (o número já está na aba e no cartão)
    expect(screen.queryByText(CONTAGEM)).toBeNull()

    // busca que acha parte → "X de N" em destaque
    const busca = screen.getByLabelText('Buscar cliente, código (V-0001), item ou quem vendeu')
    fireEvent.change(busca, { target: { value: 'Escova' } })
    expect((await contagem()).textContent).toMatch(new RegExp(`\\d+ de ${n} venda`))
    // busca que não acha nada → vazio de filtro com "Limpar filtros"
    fireEvent.change(busca, { target: { value: 'ninguem-com-esse-nome' } })
    await screen.findByText('Nenhuma venda com esse filtro.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0])
    await waitFor(() => expect(screen.queryByText('Nenhuma venda com esse filtro.')).toBeNull())

    // aba "Com pendência": só as que têm pendência (≤ concluídas)
    fireEvent.click(screen.getByRole('tab', { name: /Com pendência/ }))
    expect(naAba(/Com pendência/)).toBeLessThanOrEqual(n)
  }, 60000)

  it('o "+ Nova venda" abre os caminhos de venda de antes', async () => {
    await abrirVender()
    fireEvent.click((await screen.findAllByRole('button', { name: '+ Nova venda' }, { timeout: 15000 }))[0])
    expect(await screen.findByRole('menuitem', { name: /Vender cabelo/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Cabelo sem etiqueta/ })).toBeTruthy()
  }, 60000)
})
