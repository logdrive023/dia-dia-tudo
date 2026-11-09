// ETIQUETAS (tela): abre em "Sem etiqueta" (só o pacote que nunca foi impresso), "Já impressa" mostra quando e quem;
// "Selecionar todos os filtrados" → "Imprimir 1 etiqueta" → Imprimir: o pacote sai de "Sem etiqueta" e a lista vazia
// diz "Todos os pacotes já têm etiqueta ✓". Os filtros ficam no endereço (params).

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Etiquetas } from '../pages/Etiquetas'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { bs, novoBackend } from '../../../__tests__/ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

function Harness({ base, navs }: { base: Omit<AppCtx, 'nav' | 'ajustarParams' | 'ir'>; navs: Navegacao[] }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'etiquetas', params: {} })
  navs.push(nav)
  const ctx: AppCtx = {
    ...base,
    nav,
    ir: (tela, params = {}) => setNav({ tela, params }),
    ajustarParams: (p) => setNav((n) => {
      const params = { ...n.params, ...p }
      for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k]
      return { ...n, params }
    }),
  }
  return <Ctx.Provider value={ctx}>{nav.tela === 'etiquetas' ? <Etiquetas /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
}

describe('tela Etiquetas', () => {
  it('filtra "sem etiqueta", seleciona os filtrados e imprime (marca como impressa)', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
    const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
    await b.comando('separarLote', { id: 's', loteId: bruto.id, quantidadeUsada: 10000, saidas: [
      { id: 'a', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
      { id: 'b', quantidade: 3500, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } },
    ] })
    Object.assign(sessao, { nome: 'Paula' })
    await b.comando('marcarEtiquetasImpressas', { ids: ['a'] })
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    const codigo = (id: string) => lotes.find((i) => i.id === id)!.codigo!
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const navs: Navegacao[] = []
    render(<Harness navs={navs} base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)

    // padrão: "Sem etiqueta" → só o B
    const lista = await screen.findByRole('list', {}, { timeout: 10000 })
    await waitFor(() => expect(within(lista).getAllByRole('listitem')).toHaveLength(1))
    expect(within(lista).getByText(codigo('b'))).toBeTruthy()
    expect(within(lista).queryByText(codigo('a'))).toBeNull()

    // "Já impressa" (fica no endereço): o A com quando e quem
    fireEvent.click(screen.getByRole('tab', { name: /Já impressa/ }))
    expect(navs[navs.length - 1].params.f).toBe('impressa')
    await screen.findByText(/impressa em \d\d\/\d\d por Paula/)
    expect(screen.getByText(codigo('a'))).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reimprimir/ })).toBeTruthy()

    // volta para "Sem etiqueta", seleciona todos os filtrados e imprime
    fireEvent.click(screen.getByRole('tab', { name: /Sem etiqueta/ }))
    await screen.findByText(codigo('b'))
    fireEvent.click(screen.getByLabelText(/Selecionar todos os filtrados/))
    // o painel da seleção começa minimizado: abre e escolhe a opção
    fireEvent.click(await screen.findByRole('button', { name: /Escolher o que fazer|Continuar/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Imprimir 1 etiqueta/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Imprimir etiquetas' })
    await waitFor(() => expect((within(dialogo).getByRole('button', { name: /Imprimir/ }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(within(dialogo).getByRole('button', { name: /Imprimir/ }))
    expect(print).toHaveBeenCalled()
    await within(dialogo).findByText(/Enviado para a impressora/)
    fireEvent.click(within(dialogo).getByRole('button', { name: /Confirmar impressão/ }))
    await within(dialogo).findByText(/Marcadas como impressas/)
    fireEvent.click(within(dialogo).getByRole('button', { name: /Voltar/ }))

    await screen.findByText('Todos os pacotes já têm etiqueta ✓', {}, { timeout: 10000 })
    expect((await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true, etiqueta: 'sem' })).length).toBe(0)
  }, 30000)

  it('abre com o pacote já marcado (?sel=…) vindo do pacote, da compra ou da triagem', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 2000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Separado', comprimento: 50 } }] })
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] : undefined })
    const [lote] = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    function ComSel() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'etiquetas', params: { f: 'todas', sel: lote.id } })
      const ctx: AppCtx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
      return <Ctx.Provider value={ctx}><Etiquetas /></Ctx.Provider>
    }
    render(<ComSel />)
    await screen.findByText('1 pacote selecionado', {}, { timeout: 10000 })
    expect((screen.getByLabelText(`Selecionar ${lote.codigo}`) as HTMLInputElement).checked).toBe(true)
  }, 30000)

  it('errou a etiqueta: ⋯ → "Errou? Gerar nova" → confirmar (motivo já escolhido) → abre a impressão da 2ª via', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 2000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Separado', comprimento: 50 } }] })
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] : undefined })
    const [lote] = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    await b.comando('marcarEtiquetasImpressas', { ids: [lote.id] })
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const navs: Navegacao[] = []
    render(<Harness navs={navs} base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    fireEvent.click(await screen.findByRole('tab', { name: /Já impressa/ }, { timeout: 10000 }))
    await screen.findByText(lote.codigo!)
    // "Reimprimir" é o botão da linha; "Errou? Gerar nova" fica no ⋯
    expect(screen.getByRole('button', { name: 'Reimprimir' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Errou\? Gerar nova/ }))
    const janela = await screen.findByRole('dialog')
    expect(within(janela).getByRole('radio', { name: 'Saiu errada' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(janela).getByRole('button', { name: 'Cancelar a antiga e imprimir nova' }))
    const folha = await screen.findByRole('dialog', { name: 'Imprimir etiquetas' })
    await within(folha).findByText(/2ª via/)
    const item = (await b.consulta('fichaItem', { id: lote.id })).item
    expect([item.etiquetaVia, item.etiquetaImpressaEm, item.etiquetaCancelada?.motivo]).toEqual([2, undefined, 'Saiu errada'])
  }, 30000)
})
