// JANELA PADRÃO: digitou e apertou Esc ou × → pergunta antes de fechar (não perde o que foi digitado). Sem digitar, ou
// só buscando, fecha direto.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Janela } from '../shared/ui/base'

afterEach(cleanup)
const abrir = (onFechar: () => void) =>
  render(<Janela aberta titulo="Nova viagem" onFechar={onFechar}><input aria-label="Nome" /><input type="search" aria-label="Buscar" /></Janela>)

describe('janela: não perder o que foi digitado', () => {
  it('sem digitar: Esc fecha direto', () => {
    const f = vi.fn()
    abrir(f)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(f).toHaveBeenCalledOnce()
  })
  it('só buscou: × fecha direto', () => {
    const f = vi.fn()
    abrir(f)
    fireEvent.input(screen.getByLabelText('Buscar'), { target: { value: 'x' } })
    fireEvent.click(screen.getByLabelText('Fechar'))
    expect(f).toHaveBeenCalledOnce()
  })
  it('digitou: Esc e × perguntam; "Continuar editando" volta; "Descartar" fecha', () => {
    const f = vi.fn()
    abrir(f)
    fireEvent.input(screen.getByLabelText('Nome'), { target: { value: 'Sucre' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(f).not.toHaveBeenCalled()
    expect(screen.getByText(/Descartar o que você digitou/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.queryByText(/Descartar o que você digitou/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Fechar'))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(f).toHaveBeenCalledOnce()
  })
})
