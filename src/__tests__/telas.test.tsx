import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { ES } from '../ui/es'
import { MENU } from '../ui/Shell'

// cada teste com um banco novo (o app abre o banco "tudo" do aparelho)
beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

/** Abre o app: ele já monta os dados de exemplo sozinho e pede para entrar. */
async function entrarComo(login: string) {
  fireEvent.click((await screen.findAllByText(login, { selector: 'span.font-mono' }, { timeout: 30000 }))[0])
}

async function abrirComDemo() {
  render(<App />)
  await entrarComo('admin')
  await screen.findByText('Atenção agora', {}, { timeout: 30000 })
}

function irPara(nome: string) {
  const nav = screen.getAllByRole('navigation')[0]
  fireEvent.click(within(nav).getByText(nome))
}

describe('telas (com os dados de exemplo)', () => {
  it('todas as telas do menu abrem sem erro', async () => {
    await abrirComDemo()
    for (const m of MENU) {
      irPara(m.nome)
      await waitFor(() => expect(screen.queryByText('Carregando…') ? m.tela : null).toBeNull(), { timeout: 10000 })
      const quebrou = screen.queryByText('Algo deu errado nesta tela.')
      expect(quebrou ? `${m.tela}: ${quebrou.parentElement?.textContent}` : null).toBeNull()
    }
    // fichas: lote, rastreio, pessoa
    irPara('Estoque')
    fireEvent.click((await screen.findAllByText(/60 cm · Normal · Preto/, {}, { timeout: 10000 }))[0])
    await screen.findByText('Para onde foi', {}, { timeout: 10000 })
    fireEvent.click(screen.getByText(/Rastrear origem e destino/))
    await waitFor(() => expect(screen.queryByText('Carregando…')).toBeNull(), { timeout: 10000 })
    const q = screen.queryByText('Algo deu errado nesta tela.')
    expect(q ? q.parentElement?.textContent : null).toBeNull()
    await screen.findByText('Rastreio: origem → destino', {}, { timeout: 10000 })
  }, 120000)

  it('venda de cabelo pela tabela: 60 | 2.008 × 17,5 = Bs 35.140', async () => {
    await abrirComDemo()
    irPara('Vender')
    // a entrada do Vender não tem mais o cartão "É cabelo?": o assistente por medida é o link "Sem etiqueta? Vender por medida"
    fireEvent.click(await screen.findByText('Sem etiqueta? Vender por medida'))
    fireEvent.click(await screen.findByRole('button', { name: '60' }))
    fireEvent.change(await screen.findByPlaceholderText('2008'), { target: { value: '2008' } })
    fireEvent.change(screen.getByPlaceholderText('15'), { target: { value: '17,5' } })
    await screen.findByText(/60 \| 2\.008 × 17,5 = Bs 35\.140,00/)
    // o botão só liga quando o estoque do lote carregou
    await waitFor(() => expect((screen.getByText('+ Adicionar') as HTMLButtonElement).disabled).toBe(false), { timeout: 10000 })
    fireEvent.click(screen.getByText('+ Adicionar'))
    fireEvent.click(screen.getByText('Continuar para pagamento'))
    fireEvent.click(await screen.findByText('+ Forma de pagamento'))
    await screen.findByText('Pagamento fecha com o total ✓')
    fireEvent.click(screen.getByText('Confirmar venda'))
    await screen.findByText('Pronto!', {}, { timeout: 10000 })
  }, 120000)

  it('funcionária só vê a agenda dela e ações ficam no nome dela', async () => {
    await abrirComDemo()
    fireEvent.click(screen.getAllByRole('button', { name: 'Sair' })[0])
    await entrarComo('sofia')
    await screen.findByText('Minha agenda', {}, { timeout: 10000 })
    const nav = screen.getAllByRole('navigation')[0]
    expect(within(nav).queryByText('Relatórios')).toBeNull()
    expect(within(nav).queryByText('Caixa')).toBeNull()
    // senha errada não entra
    fireEvent.click(screen.getAllByRole('button', { name: 'Sair' })[0])
    fireEvent.change(await screen.findByLabelText('Usuário'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByText('Usuário ou senha não conferem.')
  }, 120000)

  it('troca para espanhol', async () => {
    expect(Object.keys(ES).length).toBeGreaterThan(200)
    await abrirComDemo()
    irPara('Configurações')
    fireEvent.click(await screen.findByText('🇧🇴 Español'))
    await screen.findByRole('heading', { name: 'Configuraciones' }, { timeout: 10000 })
    const nav = screen.getAllByRole('navigation')[0]
    expect(within(nav).getByText('Vender')).toBeTruthy()
    expect(within(nav).getByText('Panel')).toBeTruthy()
  }, 120000)
})
