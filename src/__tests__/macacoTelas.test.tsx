// TESTE "MACACO" DAS TELAS: o app inteiro (com os dados de exemplo), entrando como admin e clicando ALEATÓRIO —
// com semente fixa — em Comprar, Triagem, Estoque, Etiquetas e Vender: abas, filtros, linhas que abrem, botões,
// "voltar" do navegador no meio. Só fica de fora o que sai do app ou apaga de verdade (Sair, cancelar, remover…).
// Depois de cada clique: nenhuma tela pode mostrar "Algo deu errado nesta tela.".

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
  localStorage.setItem('tudo.menu.gruposAbertos', JSON.stringify(['Dinheiro e agenda', 'Cabelo', 'Pessoas', 'Gestão']))
  vi.spyOn(window, 'print').mockImplementation(() => undefined)
  vi.spyOn(window, 'confirm').mockImplementation(() => true)
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

function gerador(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** o que o macaco NÃO toca: sai do app, apaga de verdade ou abre coisa fora (WhatsApp, impressão do sistema) */
const PROIBIDO = /sair|cancelar (venda|compra)|recusar|remover|excluir|apagar|reiniciar|zerar|whatsapp|recibo|baixar|exportar|csv|trocar quem|desativar|gerar nova|cancelar a antiga/i
const TELAS = ['Comprar', 'Triagem', 'Estoque', 'Etiquetas', 'Vender']

const quebrou = () => screen.queryByText('Algo deu errado nesta tela.')

describe('macaco: telas do fluxo principal', () => {
  it('clica aleatório em Comprar, Triagem, Estoque, Etiquetas e Vender sem quebrar nenhuma tela', async () => {
    render(<App />)
    fireEvent.click((await screen.findAllByText('admin', { selector: 'span.font-mono' }, { timeout: 30000 }))[0])
    await screen.findByText('Atenção agora', {}, { timeout: 30000 })
    const r = gerador(2026)
    const visitadas = new Set<string>()
    for (let k = 0; k < 140; k++) {
      // de vez em quando: troca de tela pelo menu ou "voltar" do navegador
      if (k % 12 === 0 || r() < 0.08) {
        const tela = TELAS[Math.floor(r() * TELAS.length)]
        fireEvent.click(within(screen.getAllByRole('navigation')[0]).getByText(tela))
        visitadas.add(tela)
      } else if (r() < 0.07) {
        await act(async () => { window.history.back(); await new Promise((x) => setTimeout(x, 20)) })
      } else {
        // um botão / aba / linha clicável qualquer do conteúdo (fora do menu lateral e da barra do celular)
        const main = document.querySelector('main') ?? document.body
        const alvos = [...main.querySelectorAll<HTMLElement>('button:not([disabled]), [role="tab"], [role="link"], summary, input[type="checkbox"]')]
          .filter((e) => !PROIBIDO.test(`${e.textContent ?? ''} ${e.getAttribute('aria-label') ?? ''} ${e.title}`))
        if (alvos.length) fireEvent.click(alvos[Math.floor(r() * alvos.length)])
        // fecha janela aberta às vezes (Esc), como alguém desistindo
        if (r() < 0.15) fireEvent.keyDown(window, { key: 'Escape' })
      }
      await act(async () => { await new Promise((x) => setTimeout(x, 15)) })
      const q = quebrou()
      if (q) throw new Error(`quebrou no passo ${k} (${window.location.hash}): ${q.parentElement?.textContent}`)
    }
    await waitFor(() => expect(quebrou()).toBeNull())
    expect(visitadas.size).toBeGreaterThanOrEqual(3)
  }, 240000)
})
