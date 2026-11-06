// No celular/tablet nenhum campo recebe o cursor sozinho (abriria o teclado e cobriria a tela).
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Entrada } from '../shared/ui/base'

const original = window.matchMedia
const toque = (sim: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: sim && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
}

describe('foco automático', () => {
  afterEach(() => {
    window.matchMedia = original
  })
  it('no toque, autoFocus não abre o teclado; no computador continua', () => {
    toque(true)
    const a = render(<Entrada autoFocus aria-label="a" />)
    expect(document.activeElement).not.toBe(a.getByLabelText('a'))
    a.unmount()
    toque(false)
    const b = render(<Entrada autoFocus aria-label="b" />)
    expect(document.activeElement).toBe(b.getByLabelText('b'))
  })
  it('focoSempre: a pessoa tocou para escrever, o cursor vai mesmo no toque', () => {
    toque(true)
    const c = render(<Entrada autoFocus focoSempre aria-label="c" />)
    expect(document.activeElement).toBe(c.getByLabelText('c'))
  })
})
