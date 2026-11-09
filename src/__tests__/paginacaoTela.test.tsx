// PAGINAÇÃO NA TELA: trocar de página sobe até o começo da lista e mostra "carregando" antes da página nova.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ctx, type AppCtx, type Navegacao } from '../shared/ui/contexto'
import { Paginada } from '../shared/ui/paginacao'
import { novoBackend } from './ajuda'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

const ITENS = Array.from({ length: 30 }, (_, k) => `item ${k + 1}`)

async function abrir() {
  const { b, sessao } = await novoBackend()
  const subir = vi.fn()
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: subir })
  function H() {
    const [nav, setNav] = useState<Navegacao>({ tela: 'vendas', params: {} })
    const ctx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: () => undefined, ajustarParams: (p: Record<string, string | undefined>) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) } as unknown as AppCtx
    return <Ctx.Provider value={ctx}><Paginada itens={ITENS} padrao={10} unidade="item(ns)">{(pagina) => <ul>{pagina.map((x) => <li key={x}>{x}</li>)}</ul>}</Paginada></Ctx.Provider>
  }
  render(<H />)
  // a lista "ficou para cima" da tela: a pessoa está lá embaixo, na paginação
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: -500 } as DOMRect)
  return subir
}

describe('trocar de página', () => {
  it('sobe suave até a lista, mostra carregando e depois a página nova', async () => {
    const subir = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(screen.getByText('Carregando os dados…')).toBeTruthy()
    expect(screen.queryByText('item 1')).toBeNull()
    expect(subir).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect((screen.getByRole('button', { name: 'Próxima página' }) as HTMLButtonElement).disabled).toBe(true)
    await screen.findByText('item 11')
    expect(screen.queryByText('Carregando os dados…')).toBeNull()
  }, 15000)

  it('trocar o tamanho da página também avisa', async () => {
    await abrir()
    fireEvent.change(screen.getByLabelText('Por página'), { target: { value: '25' } })
    expect(screen.getByText('Carregando os dados…')).toBeTruthy()
    await screen.findByText('item 25')
  }, 15000)

  it('lista já à vista no alto da tela: não mexe na rolagem', async () => {
    const subir = await abrir()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 40 } as DOMRect)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(screen.getByText('item 11')).toBeTruthy())
    expect(subir).not.toHaveBeenCalled()
  }, 15000)
})
