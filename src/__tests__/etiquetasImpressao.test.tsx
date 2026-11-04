// IMPRESSÃO DE ETIQUETAS: cópias de cada pacote (todas ou uma a uma), folha A4 com 21 por folha e "começar na
// etiqueta N" (folha já usada), o resumo "4 etiqueta(s) · 2 folhas A4 (2 + 2)" e o limite por vez (acima dele o botão
// Imprimir fica desligado). Só os pacotes com cópia > 0 são marcados como impressos.
// TRIAGENS FEITAS: números de resumo e filtros (perda acima de X%, busca) no endereço.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Triagem } from '../screens/Triagem'
import { Ctx, type AppCtx, type Navegacao } from '../ui/contexto'
import { ImprimirEtiquetas } from '../ui/etiquetas'
import { bs, novoBackend } from './ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

/** compra de 10 kg separada em `n` pacotes de 1 kg (perda = o resto) */
async function separados(n: number, perda = 0) {
  const { b, sessao } = await novoBackend()
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
  const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
  const ids = Array.from({ length: n }, (_, k) => `s${k}`)
  await b.comando('triarLotes', { id: 'tg', ids: [bruto.id], quantidadeUsada: 10000, saidas: ids.map((id, k) => ({ id, quantidade: Math.floor((10000 - perda) / n), campos: { estado: 'Separado', comprimento: 40 + k * 10, categoria: 'Normal' } })) })
  return { b, sessao, ids }
}

function ctxDe(base: { b: AppCtx['backend']; sessao: AppCtx['sessao'] }, nav: Navegacao, setNav: (f: (n: Navegacao) => Navegacao) => void): AppCtx {
  return {
    backend: base.b, sessao: base.sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav,
    ir: (tela, params = {}) => setNav(() => ({ tela, params })),
    ajustarParams: (p) => setNav((n) => { const params = { ...n.params, ...p }; for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k]; return { ...n, params } }),
  }
}

describe('impressão de etiquetas', () => {
  it('cópias, folha A4 começando na 20, resumo por folha e marca só os impressos', async () => {
    const { b, sessao, ids } = await separados(2)
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    function H() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'etiquetas', params: {} })
      return <Ctx.Provider value={ctxDe({ b, sessao }, nav, setNav)}><ImprimirEtiquetas ids={ids} onFechar={() => undefined} /></Ctx.Provider>
    }
    render(<H />)
    const folha = await screen.findByRole('dialog', { name: 'Imprimir etiquetas' })
    await within(folha).findByText('2 etiqueta(s)', {}, { timeout: 10000 })

    // 2 cópias de cada → 4; folha A4 começando na 20 → 2 folhas (2 + 2), sobram 19 na última
    fireEvent.click(within(within(folha).getByRole('group', { name: 'Cópias de cada' })).getByRole('button', { name: 'Mais' }))
    fireEvent.click(within(folha).getByRole('radio', { name: 'Folha A4' }))
    fireEvent.click(within(folha).getByRole('button', { name: 'Mudar' }))
    fireEvent.click(within(within(folha).getByRole('radiogroup', { name: 'Começar na etiqueta' })).getByRole('radio', { name: '20' }))
    await within(folha).findByText('4 etiqueta(s)')
    expect(within(folha).getByText(/2 folhas A4 \(2 \+ 2\)/)).toBeTruthy()
    expect(within(folha).getByText(/sobram 19 na última/)).toBeTruthy()

    // um pacote com 0 cópias: sai do papel e não é marcado como impresso
    // poucos pacotes: a lista por pacote já vem aberta
    expect(within(folha).getByRole('button', { name: /Ajustar por pacote/ }).getAttribute('aria-expanded')).toBe('true')
    const segundo = within(folha).getByRole('group', { name: new RegExp(`Cópias ${(await b.consulta('fichaItem', { id: ids[1] })).item.codigo}`) })
    fireEvent.click(within(segundo).getByRole('button', { name: 'Menos' }))
    fireEvent.click(within(segundo).getByRole('button', { name: 'Menos' }))
    await within(folha).findByText('2 etiqueta(s)')
    fireEvent.click(within(folha).getByRole('button', { name: /Imprimir/ }))
    expect(print).toHaveBeenCalled()
    await within(folha).findByText(/Marcadas como impressas/)
    const fichas = await Promise.all(ids.map((id) => b.consulta('fichaItem', { id })))
    expect(fichas.map((f) => !!f.item.etiquetaImpressaEm)).toEqual([true, false])
  }, 30000)

  it('acima do limite por vez (10 folhas A4 = 210) o Imprimir fica desligado', async () => {
    const { b, sessao, ids } = await separados(5)
    function H() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'etiquetas', params: {} })
      return <Ctx.Provider value={ctxDe({ b, sessao }, nav, setNav)}><ImprimirEtiquetas ids={ids} onFechar={() => undefined} /></Ctx.Provider>
    }
    render(<H />)
    const folha = await screen.findByRole('dialog', { name: 'Imprimir etiquetas' })
    await within(folha).findByText('5 etiqueta(s)', {}, { timeout: 10000 })
    fireEvent.click(within(folha).getByRole('radio', { name: 'Folha A4' }))
    fireEvent.change(within(folha).getAllByRole('textbox', { name: 'Cópias de cada' })[0], { target: { value: '50' } })
    await within(folha).findByText('250 etiqueta(s)')
    expect(within(folha).getByRole('alert').textContent).toMatch(/Máximo 210 por vez/)
    expect((within(folha).getByRole('button', { name: /Imprimir/ }) as HTMLButtonElement).disabled).toBe(true)
  }, 30000)
})

describe('triagens feitas', () => {
  it('resumo, filtro de perda acima de X% e busca (no endereço)', async () => {
    const { b, sessao } = await separados(2, 1000) // 10 kg → 9 kg: perda 10%
    const navs: Navegacao[] = []
    function H() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'triagem', params: { aba: 'triagens' } })
      navs.push(nav)
      return <Ctx.Provider value={ctxDe({ b, sessao }, nav, setNav)}><Triagem /></Ctx.Provider>
    }
    render(<H />)
    await screen.findByText('Triagens', {}, { timeout: 10000 })
    expect(screen.getAllByText('10 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('9 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/10,0+%|10%/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    fireEvent.change(screen.getByLabelText(/Perda acima de/), { target: { value: '20' } })
    await screen.findByText('Nenhuma triagem com esses filtros.')
    expect(navs[navs.length - 1].params.tperda).toBe('20')
    fireEvent.change(screen.getByLabelText(/Perda acima de/), { target: { value: '5' } })
    await waitFor(() => expect(screen.queryByText('Nenhuma triagem com esses filtros.')).toBeNull())

    fireEvent.change(screen.getByLabelText('T-0003, compra, fornecedor, pacote…'), { target: { value: 'nada-assim' } })
    await screen.findByText('Nenhuma triagem com esses filtros.')
  }, 30000)
})
