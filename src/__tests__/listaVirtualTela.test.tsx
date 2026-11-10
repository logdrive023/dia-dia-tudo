// LISTA GRANDE: só as linhas perto da tela são desenhadas; lista pequena continua inteira. (O ambiente de teste não tem
// layout de verdade: rolagem e linha que abre no lugar são conferidas no navegador.)
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabelaDados } from '../shared/ui/tabelaDados'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  // o ambiente de teste não mede nada: cada linha passa a ter 72 px
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(72)
})

const linhas = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `l${k}`, nome: `Linha ${k + 1}` }))
const montar = (n: number) => render(<TabelaDados linhas={linhas(n)} chave={(l) => l.id} colunas={[{ id: 'nome', titulo: 'Nome', celula: (l) => l.nome }]} celular={{ titulo: (l) => l.nome }} />)

describe('lista grande', () => {
  it('abaixo do limite desenha tudo', () => {
    const { container } = montar(30)
    expect(container.querySelectorAll('[data-index]')).toHaveLength(30)
  })

  it('com 100 linhas não desenha todas', async () => {
    const { container } = montar(100)
    await screen.findByText('Linha 1')
    expect(container.querySelectorAll('[data-index]').length).toBeLessThan(100)
    expect(screen.queryByText('Linha 100')).toBeNull()
  })
})
