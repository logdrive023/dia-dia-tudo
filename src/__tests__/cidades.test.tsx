// CIDADES: as 340 da Bolívia já cadastradas, cadastro de cidade nova (sem duplicar) e a pergunta "É viagem na
// Bolívia?" no formulário da viagem (Sim → lista de cidades · Não → escreve o destino).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { CIDADES_BOLIVIA, semAcento, textoCidade } from '../core/dados/cidadesBolivia'
import { novoBackend } from './ajuda'

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('cidades (servidor)', () => {
  it('as 340 da Bolívia, 9 capitais, nome repetido leva o departamento', async () => {
    expect(CIDADES_BOLIVIA).toHaveLength(340)
    expect(CIDADES_BOLIVIA.filter((c) => c.capital).map((c) => c.nome).sort()).toEqual(['Cobija', 'Cochabamba', 'La Paz', 'Oruro', 'Potosí', 'Santa Cruz de la Sierra', 'Sucre', 'Tarija', 'Trinidad'])
    expect(textoCidade({ nome: 'Totora', departamento: 'Oruro' })).toBe('Totora · Oruro')
    expect(textoCidade({ nome: 'Uyuni', departamento: 'Potosí' })).toBe('Uyuni')
    expect(semAcento('Potosí')).toBe('potosi')
  })

  it('cadastra cidade nova, não duplica, e a funcionária também pode', async () => {
    const { b } = await novoBackend()
    expect(await b.consulta('cidades', {})).toHaveLength(340)
    // já existe (sem acento/maiúscula): não duplica
    expect(await b.comando('salvarCidade', { id: 'x', nome: 'potosi', departamento: 'potosí' })).toMatchObject({ jaExistia: true, nome: 'Potosí' })
    await b.comando('salvarCidade', { id: 'c1', nome: '  Villa   Nueva Esperanza ', departamento: 'Beni' })
    const todas = await b.consulta('cidades', {})
    expect(todas).toHaveLength(341)
    expect(todas.find((c) => c.id === 'c1')).toMatchObject({ nome: 'Villa Nueva Esperanza', departamento: 'Beni', pais: 'Bolívia', extra: true })
    await expect(b.comando('salvarCidade', { id: 'c2', nome: ' ' })).rejects.toThrow(/nome da cidade/)
    // a viagem guarda se é na Bolívia
    await b.comando('salvarPessoa', { id: 'p', nome: 'Paula', papeis: ['funcionario'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', destino: 'Totora · Oruro', naBolivia: true, viajantes: ['p'], inicio: '2026-11-01' })
    expect((await b.consulta('viagem', { id: 'vg' })).viagem).toMatchObject({ destino: 'Totora · Oruro', naBolivia: true })
  })
})

describe('formulário da viagem: é na Bolívia?', () => {
  it('Sim → busca na lista (sem acento) · Não → campo livre', async () => {
    window.history.replaceState(null, '', '/#/viagens/novo')
    render(<App />)
    fireEvent.click((await screen.findAllByText('admin', { selector: 'span.font-mono' }, { timeout: 30000 }))[0])
    const pergunta = await screen.findByRole('radiogroup', { name: 'É viagem na Bolívia?' }, { timeout: 30000 })
    expect(within(pergunta).getByRole('radio', { name: 'Sim' }).getAttribute('aria-checked')).toBe('true')

    const campo = screen.getByRole('combobox', { name: 'Destino' })
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: 'potosi' } })
    const lista = await screen.findByRole('listbox', { name: 'Destino' }, { timeout: 15000 })
    // capital primeiro, e acha sem acento
    const primeira = within(lista).getAllByRole('option')[0]
    expect(primeira.textContent).toMatch(/Potosí/)
    fireEvent.click(within(primeira).getByRole('button'))
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Destino' }) as HTMLInputElement).value).toBe('Potosí'))

    // não achou → oferece cadastrar
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: 'Vila Inventada' } })
    expect(await screen.findByRole('button', { name: /Cadastrar “Vila Inventada”/ })).toBeTruthy()

    // Não → escreve à mão
    fireEvent.click(within(pergunta).getByRole('radio', { name: 'Não' }))
    expect(screen.queryByRole('combobox', { name: 'Destino' })).toBeNull()
    expect((screen.getByPlaceholderText('Ex.: Lima, Peru') as HTMLInputElement).value).toBe('Potosí')
  }, 60000)
})
