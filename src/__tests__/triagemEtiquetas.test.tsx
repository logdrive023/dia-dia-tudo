// TRIAGEM × ETIQUETAS: a situação da etiqueta aparece à vista — "🏷 Sem etiqueta" / "✓ Etiqueta" em cada lote, o resumo
// "N sem etiqueta" + "Imprimir N" nos prontos e "1 de 2 com etiqueta" em cada triagem feita (com "Imprimir a que falta").

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Triagem } from '../screens/Triagem'
import { Ctx, type AppCtx, type Navegacao } from '../ui/contexto'
import { bs, novoBackend } from './ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('triagem: etiqueta à vista', () => {
  it('mostra sem etiqueta / com etiqueta, imprime as que faltam e conta por triagem', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
    const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
    const r = await b.comando('triarLotes', { id: 'tg', ids: [bruto.id], quantidadeUsada: 10000, saidas: [
      { id: 'a', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
      { id: 'b', quantidade: 3500, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } },
    ] })
    expect(r.lotes.sort()).toEqual(['a', 'b'])
    await b.comando('marcarEtiquetasImpressas', { ids: ['a'] })
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
    function H() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'triagem', params: { f: 'pronto' } })
      const ctx: AppCtx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => { const params = { ...n.params, ...p }; for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k]; return { ...n, params } }) }
      return <Ctx.Provider value={ctx}>{nav.tela === 'triagem' ? <Triagem /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
    }
    render(<H />)
    const prontos = await screen.findByRole('region', { name: 'Pronto para vender' }, { timeout: 10000 })
    await within(prontos).findByText('✓ Etiqueta', { exact: false })
    expect(within(prontos).getAllByRole('button', { name: /Sem etiqueta/ }).length).toBeGreaterThan(0)
    const resumo = within(prontos).getByRole('button', { name: /1 sem etiqueta/ })
    fireEvent.click(resumo)
    expect(resumo.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(prontos).getByRole('button', { name: /Imprimir 1/ }))
    const folha = await screen.findByRole('dialog', { name: 'Imprimir etiquetas' })
    await waitFor(() => expect((within(folha).getByRole('button', { name: /Imprimir/ }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(within(folha).getByRole('button', { name: /Imprimir/ }))
    await within(folha).findByText(/Marcadas como impressas/)
    fireEvent.click(within(folha).getByRole('button', { name: /Voltar/ }))
    await within(prontos).findByText(/Todos com etiqueta/, {}, { timeout: 10000 })

    // triagens feitas: 2 de 2 depois de imprimir; desmarca uma (gera nova via) → "1 de 2" e "Imprimir a que falta"
    await b.comando('refazerEtiqueta', { id: 'b', motivo: 'Perdeu' })
    fireEvent.click(screen.getByRole('tab', { name: 'Triagens feitas' }))
    await screen.findByText('🏷 1 de 2 com etiqueta', { exact: false }, { timeout: 10000 })
    fireEvent.click(screen.getByRole('button', { name: /Imprimir a que falta/ }))
    await screen.findByRole('dialog', { name: 'Imprimir etiquetas' })
  }, 30000)
})
