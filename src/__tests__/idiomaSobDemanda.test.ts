// ESPANHOL SOB DEMANDA: o dicionário só vem quando alguém precisa; até lá o texto sai em português, sem quebrar.
import { describe, expect, it, vi } from 'vitest'

describe('dicionário de espanhol', () => {
  it('antes de carregar sai em português; depois, em espanhol', async () => {
    vi.resetModules()
    const i18n = await import('../shared/ui/i18n')
    expect(i18n.idiomaCarregado('pt')).toBe(true)
    expect(i18n.idiomaCarregado('es')).toBe(false)
    expect(i18n.traduzir('es', 'Vender')).toBe('Vender')
    await i18n.carregarIdioma('es')
    expect(i18n.idiomaCarregado('es')).toBe(true)
    expect(i18n.traduzir('es', 'Tem agora')).toBe('Hay ahora')
  })

  it('português não baixa nada', async () => {
    vi.resetModules()
    const i18n = await import('../shared/ui/i18n')
    await i18n.carregarIdioma('pt')
    expect(i18n.idiomaCarregado('es')).toBe(false)
  })
})
