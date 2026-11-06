// TELAS DA MISTURA e da SEPARAÇÃO simples: a janela "Desfazer mistura" (cartões com caixa + "como vai ficar" + um botão)
// e a separação em 3 passos (quanto → partes → perda sozinha) com um botão só.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DesfazerMistura } from '../components/DesfazerMistura'
import { Separar } from '../pages/Separar'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { bs, novoBackend } from '../../../__tests__/ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

async function montar() {
  const { b, sessao } = await novoBackend()
  for (const [id, g] of [['c1', 1200], ['c2', 3300]] as const) await b.comando('criarCompra', { id, moduloId: 'cabelo', linhas: [{ id: `${id}-l`, quantidade: g, moeda: 'BOB', total: bs(g), campos: { estado: 'Bruto' } }] })
  const ls = (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.saldo > 0 && (i.saldo === 1200 || i.saldo === 3300))
  const Prov = ({ children }: { children: React.ReactNode }) => {
    const [nav, setNav] = useState<Navegacao>({ tela: 'triagem', params: {} })
    const ctx: AppCtx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
    return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
  }
  return { b, ls, Prov }
}

describe('telas da mistura', () => {
  it('desfazer mistura: começa com tudo marcado, mostra como vai ficar e desfaz', async () => {
    const { b, ls, Prov } = await montar()
    await b.comando('unificarLotes', { id: 'u1', ids: ls.map((l) => l.id) })
    let fechou = false
    render(<Prov><DesfazerMistura loteId="u1" onFechar={() => (fechou = true)} /></Prov>)
    const botao = await screen.findByRole('button', { name: /Desfazer a mistura toda/ }, { timeout: 10000 })
    expect(screen.getByText(/deixa de existir/)).toBeTruthy()
    fireEvent.click(botao)
    await waitFor(() => expect(fechou).toBe(true))
    expect((await b.consulta('mistura', { loteId: 'u1' })).podeDesfazer).toBe(false)
    expect(ls.every(Boolean)).toBe(true)
  }, 30000)

  it('desfazer mistura: mexido → botão apagado e o porquê', async () => {
    const { b, ls, Prov } = await montar()
    await b.comando('unificarLotes', { id: 'u1', ids: ls.map((l) => l.id) })
    await b.comando('ajustarEstoque', { itemId: 'u1', novoSaldo: 4000, motivo: 'perda', descricao: 'pontas' })
    render(<Prov><DesfazerMistura loteId="u1" onFechar={() => undefined} /></Prov>)
    await screen.findByText(/Já mexeram/, {}, { timeout: 10000 })
    expect((screen.getByRole('button', { name: /Desfazer a mistura toda/ }) as HTMLButtonElement).disabled).toBe(true)
  }, 30000)

  it('separar: 3 passos, a perda sai sozinha e o botão só liga com uma parte', async () => {
    const { ls, Prov } = await montar()
    let feitos: string[] = []
    render(<Prov><Separar ids={[ls[0].id]} onFechar={() => undefined} onSeparou={(x) => (feitos = x)} /></Prov>)
    await screen.findByText('Quanto vai separar', {}, { timeout: 10000 })
    expect(screen.getByText('A perda (calculada sozinha)')).toBeTruthy()
    const botao = screen.getByRole('button', { name: /✂️ Separar/ }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    expect(feitos).toEqual([])
  }, 30000)
})
