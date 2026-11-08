// CAMPO COM ⓘ: o rótulo continua sendo o NOME do campo (leitor de tela e "tocar no rótulo vai ao campo"). Antes, o
// botão do ⓘ dentro do <label> virava o dono do rótulo e o campo ficava sem nome. O ⓘ segue sendo um botão (teclado).
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Campo, Entrada } from '../shared/ui/base'

afterEach(cleanup)

describe('campo com explicação (ⓘ)', () => {
  it('o campo tem o nome do rótulo; o ⓘ abre com toque e com Enter', () => {
    render(<Campo rotulo="Medida (cm)" ajuda="Comprimento do cabelo, da raiz à ponta. Ex.: 60"><Entrada /></Campo>)
    const campo = screen.getByLabelText(/Medida \(cm\)/)
    expect(campo.tagName).toBe('INPUT')
    const i = screen.getByRole('button', { name: 'Explicação' })
    fireEvent.click(i)
    expect(i.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).not.toBe(campo) // tocar no ⓘ não leva ao campo (nem abre o teclado)
    fireEvent.click(i)
    fireEvent.keyDown(i, { key: 'Enter' })
    expect(i.getAttribute('aria-expanded')).toBe('true')
  })
})
