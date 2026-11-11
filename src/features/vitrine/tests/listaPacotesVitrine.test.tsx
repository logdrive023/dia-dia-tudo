// LISTA DE PACOTES (Minha vitrine): o pacote com foto mostra a miniatura; sem foto, só o texto.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { Ctx, type AppCtx } from '../../../shared/ui/contexto'
import { novoBackend } from '../../../__tests__/ajuda'
import { ListaPacotesVitrine, type PacoteLista } from '../components/ListaPacotesVitrine'

afterEach(cleanup)

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

it('mostra a miniatura só no pacote que tem foto', async () => {
  const { b, sessao } = await novoBackend()
  const ctx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav: { tela: 'vitrine', params: {} }, ir: () => undefined, ajustarParams: () => undefined } as AppCtx
  const linhas: PacoteLista[] = [
    { id: 'a', codigo: 'L-1', medida: 60, cor: 'Preto', gramas: 1000, disponivel: 1000, foto: { id: 'f1', miniatura: FOTO } },
    { id: 'b', codigo: 'L-2', medida: 50, cor: 'Loiro', gramas: 500, disponivel: 500, oculto: true },
  ]
  const { container } = render(<Ctx.Provider value={ctx}>
    <ListaPacotesVitrine linhas={linhas} escolher ocupado={false} onNaVitrine={() => undefined} onLimite={() => undefined} precoTexto={() => ''} />
  </Ctx.Provider>)
  const imgs = [...container.querySelectorAll('img')]
  expect(imgs.length).toBeGreaterThan(0)
  expect(imgs.every((i) => i.getAttribute('src') === FOTO)).toBe(true)
  // só a linha do L-1 tem a foto
  expect(screen.getAllByTitle('Abrir no estoque').filter((x) => x.querySelector('img')).map((x) => x.textContent)).toEqual([expect.stringContaining('L-1')])
})
