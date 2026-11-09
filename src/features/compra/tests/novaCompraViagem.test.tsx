// Nova compra e a viagem: com UMA viagem aberta a compra já vem ligada a ela (a tela diz e dá para tirar);
// com duas, ninguém adivinha qual: fica sem viagem até a pessoa escolher.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { NovaCompraTela } from '..'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { novoBackend } from '../../../__tests__/ajuda'

afterEach(() => cleanup())
const TEMPO = 45000
const AVISO = /Ligada à única viagem aberta/

function Harness({ base }: { base: Omit<AppCtx, 'nav' | 'ajustarParams'> }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'novaCompra', params: {} })
  return (
    <Ctx.Provider value={{ ...base, nav, ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }}>
      <NovaCompraTela />
    </Ctx.Provider>
  )
}

async function montar(viagens: number) {
  const { b, sessao } = await novoBackend()
  await b.comando('salvarPessoa', { id: 'paula', nome: 'Paula', papeis: ['funcionario'] })
  for (let k = 1; k <= viagens; k++) await b.comando('salvarViagem', { id: `vg${k}`, nome: `Viagem ${k}`, viajantes: ['paula'], inicio: '2026-11-01' })
  let foi = false
  render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, ir: () => { foi = true }, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
  const compraSalva = async () => {
    await waitFor(() => expect(foi).toBe(true), { timeout: 15000 })
    const [c] = await (b as unknown as { repos: { transacoes: { listar(f: object): Promise<{ viagemId?: string }[]> } } }).repos.transacoes.listar({ tipo: 'compra' })
    return c
  }
  return { compraSalva }
}

const cabecalho = (nome: string, aberto?: boolean) =>
  screen.queryAllByRole('button').find((b) => b.hasAttribute('aria-expanded') && new RegExp(`^[\\d✓]*${nome}`).test(b.textContent ?? '') && (aberto === undefined || b.getAttribute('aria-expanded') === String(aberto)))
const abrirPasso = (nome: string) => {
  const b = cabecalho(nome, false)
  if (b) fireEvent.click(b)
}
/** peso e valor da linha (o que falta para poder registrar) */
async function preencherItem() {
  await waitFor(() => expect(cabecalho('Itens')).toBeTruthy(), { timeout: 15000 })
  abrirPasso('Itens')
  fireEvent.change(await screen.findByLabelText(/^Peso/, {}, { timeout: 15000 }), { target: { value: '5000' } })
  fireEvent.change(screen.getByLabelText(/^Valor total/), { target: { value: '2000' } })
}
const registrar = async () => {
  // dois botões iguais: a barra do celular e a coluna do computador (o CSS esconde um; aqui os dois existem)
  const [b] = await screen.findAllByRole('button', { name: /Registrar pedido/ }, { timeout: 15000 })
  await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(false), { timeout: 15000 })
  fireEvent.click(b)
}

describe('nova compra: viagem sugerida', () => {
  it('com 1 viagem aberta: já vem ligada, diz por quê e salva com a viagem', async () => {
    const { compraSalva } = await montar(1)
    await preencherItem()
    abrirPasso('Detalhes')
    expect(await screen.findByText(AVISO, {}, { timeout: 15000 })).toBeTruthy()
    await registrar()
    expect((await compraSalva()).viagemId).toBe('vg1')
  }, TEMPO)

  it('escolhendo "Sem viagem": o campo continua à vista e salva sem viagem', async () => {
    const { compraSalva } = await montar(1)
    await preencherItem()
    abrirPasso('Detalhes')
    await screen.findByText(AVISO, {}, { timeout: 15000 })
    const lista = screen.getByDisplayValue(/Viagem 1/)
    fireEvent.change(lista, { target: { value: '' } })
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
    expect(screen.getByDisplayValue('Sem viagem')).toBeTruthy()
    await registrar()
    expect((await compraSalva()).viagemId).toBeUndefined()
  }, TEMPO)

  it('o ✕ tira a viagem (não volta sozinha) e o "+ Viagem" traz a sugestão de novo', async () => {
    await montar(1)
    await preencherItem()
    abrirPasso('Detalhes')
    await screen.findByText(AVISO, {}, { timeout: 15000 })
    fireEvent.click(screen.getByRole('button', { name: 'Tirar Viagem' }))
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: '+ Viagem' }))
    expect(await screen.findByText(AVISO)).toBeTruthy()
  }, TEMPO)

  it('com 2 viagens abertas: não adivinha, fica sem viagem', async () => {
    const { compraSalva } = await montar(2)
    await preencherItem()
    abrirPasso('Detalhes')
    expect(await screen.findByRole('button', { name: '+ Viagem' }, { timeout: 15000 })).toBeTruthy()
    expect(screen.queryByText(AVISO)).toBeNull()
    await registrar()
    expect((await compraSalva()).viagemId).toBeUndefined()
  }, TEMPO)
})
