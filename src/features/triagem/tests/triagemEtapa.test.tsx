// REGRA NA TELA: juntar/separar só pacotes da MESMA ETAPA do quadro. Marcado um da "Aguardando triagem", o que está em
// "Lavagem" fica com a caixa apagada e diz por quê ("outra etapa · começar com este"); a lista vem em seções por etapa.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { COLUNAS_PADRAO, COLUNA_LAVAGEM } from '../../../core/services/triagem'
import { Triagem } from '../pages/Triagem'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { bs, novoBackend } from '../../../__tests__/ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('triagem: uma etapa por vez', () => {
  it('marcar um pacote apaga os de outra etapa, com o motivo; "começar com este" troca a seleção', async () => {
    const { b, sessao } = await novoBackend()
    await b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas: [COLUNAS_PADRAO[0], COLUNA_LAVAGEM, ...COLUNAS_PADRAO.slice(1)] })
    // a regra vem desligada; o dono liga (pelo ⚙ das regras ou em Configurações)
    await b.comando('salvarConfig', { juntarMesmaEtapa: true })
    for (const id of ['c1', 'c2']) await b.comando('criarCompra', { id, moduloId: 'cabelo', linhas: [{ id: `${id}-l`, quantidade: 2000, moeda: 'BOB', total: bs(10000), campos: { estado: 'Bruto' } }] })
    const brutos = (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.saldo > 0)
    expect(brutos).toHaveLength(2)
    await b.comando('moverFaseTriagem', { ids: [brutos[1].id], fase: COLUNA_LAVAGEM.id })
    function H() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'triagem', params: {} })
      const ctx: AppCtx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
      return <Ctx.Provider value={ctx}><Triagem /></Ctx.Provider>
    }
    render(<H />)
    // as regras estão à vista e a lista vem em seções por etapa
    await screen.findByText('Uma etapa por vez', {}, { timeout: 10000 })
    const fila = await screen.findByRole('region', { name: 'Para separar' })
    await within(fila).findByRole('region', { name: COLUNA_LAVAGEM.nome })
    fireEvent.click(screen.getByRole('button', { name: /Começar a marcar/ }))
    const caixa = (c?: string) => screen.getByLabelText(`Selecionar ${c}`) as HTMLInputElement
    fireEvent.click(caixa(brutos[0].codigo))
    // o da outra etapa: caixa apagada + "outra etapa · começar com este"
    await waitFor(() => expect(caixa(brutos[1].codigo).disabled).toBe(true))
    expect(caixa(brutos[1].codigo).title).toMatch(/mesma etapa/)
    fireEvent.click(screen.getByRole('button', { name: /outra etapa/ }))
    await waitFor(() => expect(caixa(brutos[1].codigo).checked).toBe(true))
    expect(caixa(brutos[0].codigo).disabled).toBe(true)
    // e o servidor também recusa misturar etapas com a regra ligada…
    await expect(b.comando('unificarLotes', { id: 'u', ids: brutos.map((x) => x.id) })).rejects.toThrow(/etapas diferentes/)
    // …e deixa quando ela é desligada
    await b.comando('salvarConfig', { juntarMesmaEtapa: false })
    await b.comando('unificarLotes', { id: 'u', ids: brutos.map((x) => x.id) })
  }, 30000)
})
