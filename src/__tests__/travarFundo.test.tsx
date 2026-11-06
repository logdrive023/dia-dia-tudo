// Janela aberta trava a rolagem da tela de trás (no celular, arrastar dentro da folha rolava a página de baixo).
// Janela dentro de janela (ex.: Confirmar sobre um formulário) só destrava quando a última fecha.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTravarFundo } from '../shared/ui/base'

function Trava({ ativo }: { ativo: boolean }) {
  useTravarFundo(ativo)
  return null
}

describe('trava do fundo', () => {
  it('trava ao abrir, conta as janelas empilhadas e devolve como estava', () => {
    document.body.style.overflow = 'auto'
    const fora = render(<Trava ativo />)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')
    const dentro = render(<Trava ativo />)
    dentro.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    fora.unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('fechada (ativo = false) não trava', () => {
    document.body.style.overflow = ''
    const r = render(<Trava ativo={false} />)
    expect(document.body.style.overflow).toBe('')
    r.rerender(<Trava ativo />)
    expect(document.body.style.overflow).toBe('hidden')
    r.rerender(<Trava ativo={false} />)
    expect(document.body.style.overflow).toBe('')
  })
})
