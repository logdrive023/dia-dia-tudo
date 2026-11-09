// LEITOR › ZOOM E LANTERNA: a câmera demora um pouco para trocar; o toque mostra "ajustando" na hora, e a resposta some.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ctx, type AppCtx } from '../shared/ui/contexto'
import { LeitorCodigo } from '../shared/ui/estoqueUi'
import { novoBackend } from './ajuda'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

async function abrir() {
  const { b, sessao } = await novoBackend()
  const pendentes: { c: MediaTrackConstraints; soltar(): void }[] = []
  const trilha = {
    getCapabilities: () => ({ torch: true, zoom: { min: 1, max: 3 } }),
    applyConstraints: (c: MediaTrackConstraints) => new Promise<void>((soltar) => pendentes.push({ c, soltar })),
    stop: () => undefined,
  }
  const stream = { getVideoTracks: () => [trilha], getTracks: () => [trilha] }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.resolve(stream) } })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, set: () => undefined })
  const ctx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav: { tela: 'triagem', params: {} }, ir: () => undefined, ajustarParams: () => undefined } as AppCtx
  render(<Ctx.Provider value={ctx}><LeitorCodigo onLer={() => undefined} onFechar={() => undefined} /></Ctx.Provider>)
  await screen.findByRole('button', { name: '2×' })
  return pendentes
}

describe('leitor: resposta ao tocar em zoom e lanterna', () => {
  it('zoom: mostra "ajustando" na hora e some quando a câmera termina', async () => {
    const pendentes = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    expect(screen.getByText('Ajustando o zoom…')).toBeTruthy()
    await waitFor(() => expect(pendentes).toHaveLength(1))
    act(() => pendentes[0].soltar())
    await waitFor(() => expect(screen.queryByText('Ajustando o zoom…')).toBeNull(), { timeout: 3000 })
  }, 15000)

  it('toques rápidos no zoom: só o último vai para a câmera', async () => {
    const pendentes = await abrir()
    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    fireEvent.click(screen.getByRole('button', { name: '3×' }))
    await waitFor(() => expect(pendentes).toHaveLength(1))
    expect(pendentes[0].c).toEqual({ advanced: [{ zoom: 3 }] })
  }, 15000)

  it('lanterna: segundo toque enquanto liga não desliga', async () => {
    const pendentes = await abrir()
    const botao = screen.getByRole('button', { name: /Lanterna/ })
    fireEvent.click(botao)
    expect(screen.getByText('Ligando a lanterna…')).toBeTruthy()
    fireEvent.click(botao)
    await waitFor(() => expect(pendentes).toHaveLength(1))
    expect(pendentes[0].c).toEqual({ advanced: [{ torch: true }] })
    expect(botao.getAttribute('aria-pressed')).toBe('true')
  }, 15000)

  it('câmera que nunca responde: o aviso não fica preso', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    await waitFor(() => expect(screen.queryByText('Ajustando o zoom…')).toBeNull(), { timeout: 5000 })
  }, 15000)
})
