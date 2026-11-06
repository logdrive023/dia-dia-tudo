// ETIQUETAS · FILTROS: fornecedor/cliente, lote (ou lote de origem), quem gerou e atributos do cabelo (cor), cada um
// no endereço e como chip com ✕. PACOTE JÁ SEPARADO: a página do bruto que zerou mostra primeiro em que pacotes virou.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Etiquetas } from '../pages/Etiquetas'
import { FichaLote } from '../../lote'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { bs, novoBackend } from '../../../__tests__/ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/** duas compras (Maria e Celso), cada uma separada em pacotes; Maria: 60 cm Preto + 40 cm Castanho; Celso: 50 cm Preto */
async function cenario() {
  const { b, sessao } = await novoBackend()
  const comprar = async (id: string, nome: string) => {
    await b.comando('salvarPessoa', { id: `p-${id}`, nome, papeis: ['fornecedor'] })
    await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: `p-${id}`, linhas: [{ id: `l-${id}`, quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `pg-${id}`, forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
    return (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.compras.some((c) => c.id === id) && i.campos.estado === 'Bruto')!
  }
  const brutoM = await comprar('cm', 'Maria')
  await b.comando('triarLotes', { id: 'tm', ids: [brutoM.id], quantidadeUsada: 10000, saidas: [
    { id: 'm60', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
    { id: 'm40', quantidade: 4000, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal', cor: 'Castanho' } },
  ] })
  const brutoC = await comprar('cc', 'Celso')
  await b.comando('triarLotes', { id: 'tc', ids: [brutoC.id], quantidadeUsada: 10000, saidas: [
    { id: 'c50', quantidade: 10000, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal', cor: 'Preto' } },
  ] })
  const lotes = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
  const codigo = (id: string) => lotes.find((i) => i.id === id)!.codigo!
  return { b, sessao, codigo, brutoM }
}

function harness(b: AppCtx['backend'], sessao: AppCtx['sessao'], inicio: Navegacao, navs: Navegacao[] = []) {
  return function H() {
    const [nav, setNav] = useState<Navegacao>(inicio)
    navs.push(nav)
    const ctx: AppCtx = {
      backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav,
      ir: (tela, params = {}) => setNav({ tela, params }),
      ajustarParams: (p) => setNav((n) => { const params = { ...n.params, ...p }; for (const k of Object.keys(params)) if (params[k] === undefined || params[k] === '') delete params[k]; return { ...n, params } }),
    }
    return <Ctx.Provider value={ctx}>{nav.tela === 'etiquetas' ? <Etiquetas /> : nav.tela === 'lote' ? <FichaLote /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
  }
}

describe('etiquetas: filtros', () => {
  it('fornecedor, cor, lote de origem e quem gerou; chip ✕ tira o filtro', async () => {
    const { b, sessao, codigo, brutoM } = await cenario()
    const navs: Navegacao[] = []
    const H = harness(b, sessao, { tela: 'etiquetas', params: { f: 'todas' } }, navs)
    render(<H />)
    const lista = await screen.findByRole('list', {}, { timeout: 10000 })
    await waitFor(() => expect(within(lista).getAllByRole('listitem')).toHaveLength(3))

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    // fornecedor: só os da Maria
    fireEvent.change(screen.getByLabelText('Fornecedor / cliente'), { target: { value: 'Maria' } })
    await waitFor(() => expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2))
    expect(navs[navs.length - 1].params.pessoa).toBe('Maria')
    // + cor Preto: só o 60 cm da Maria
    fireEvent.change(screen.getByLabelText('Cor'), { target: { value: 'Preto' } })
    await waitFor(() => expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1))
    expect(within(screen.getByRole('list')).getByText(codigo('m60'))).toBeTruthy()
    expect(navs[navs.length - 1].params['a.cor']).toBe('Preto')

    // chip ✕ do fornecedor: volta o Preto do Celso também
    fireEvent.click(screen.getByRole('button', { name: /Tirar filtro 👤 Maria/ }))
    await waitFor(() => expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2))

    // lote de origem: o código do bruto da Maria acha os pacotes que saíram dele
    fireEvent.click(within(screen.getByRole('region', { name: 'Filtros' })).getByRole('button', { name: 'Limpar filtros' }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: L-0012'), { target: { value: brutoM.codigo } })
    await waitFor(() => expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2))

    // quem gerou / quem imprimiu: os filtros existem (as opções vêm dos usuários cadastrados)
    fireEvent.click(within(screen.getByRole('region', { name: 'Filtros' })).getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByLabelText('Quem gerou o pacote')).toBeTruthy()
    expect(screen.getByLabelText('Quem imprimiu')).toBeTruthy()
  }, 30000)

  it('pacote bruto já separado: mostra em que pacotes virou e leva até eles', async () => {
    const { b, sessao, codigo, brutoM } = await cenario()
    const H = harness(b, sessao, { tela: 'lote', params: { id: brutoM.id } })
    render(<H />)
    const virou = await screen.findByRole('region', { name: 'Virou' }, { timeout: 10000 })
    expect(within(virou).getByText(/Este pacote já foi separado/)).toBeTruthy()
    fireEvent.click(within(virou).getByRole('button', { name: new RegExp(codigo('m60')) }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Virou' })).toBeNull())
  }, 30000)
})
