// NOTA DA TELA: a orientação fica à vista, é anunciada como nota e o ícone não é lido.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NotaTela } from '../shared/ui/notaTela'

afterEach(cleanup)

describe('nota da tela', () => {
  it('mostra o texto como nota, com o ícone escondido do leitor de tela', () => {
    render(<NotaTela className="mt-3">Toque numa pessoa para ver o resumo.</NotaTela>)
    const nota = screen.getByRole('note')
    expect(nota.textContent).toContain('Toque numa pessoa para ver o resumo.')
    expect(nota.className).toContain('mt-3')
    expect(nota.querySelector('[aria-hidden]')?.textContent).toBe('💡')
  })

  it('aceita outro ícone', () => {
    render(<NotaTela icone="ℹ️">Só nesta impressão.</NotaTela>)
    expect(screen.getByRole('note').querySelector('[aria-hidden]')?.textContent).toBe('ℹ️')
  })
})
