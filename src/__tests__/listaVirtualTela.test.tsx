// LISTA GRANDE: no celular só as linhas perto da tela são desenhadas; lista pequena continua inteira.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabelaDados } from '../shared/ui/tabelaDados'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  // uma tela de celular: cada linha mede 72 px
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, right: 360, bottom: 72, width: 360, height: 72, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }) })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
})

const linhas = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `l${k}`, nome: `Linha ${k + 1}` }))
const montar = (n: number) => render(<TabelaDados linhas={linhas(n)} chave={(l) => l.id} colunas={[{ id: 'nome', titulo: 'Nome', celula: (l) => l.nome }]} celular={{ titulo: (l) => l.nome }} />)

describe('lista grande', () => {
  it('abaixo do limite desenha tudo', () => {
    const { container } = montar(30)
    expect(container.querySelectorAll('li').length || container.querySelectorAll('tbody').length).toBe(30)
  })

  it('com 100 linhas desenha só as de perto e reserva o espaço do resto', async () => {
    const { container } = montar(100)
    await screen.findByText('Linha 1')
    await waitFor(() => {
      const n = container.querySelectorAll('[data-index]').length
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThan(40)
    })
    expect(screen.queryByText('Linha 100')).toBeNull()
  })
})
