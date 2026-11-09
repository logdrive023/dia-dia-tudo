// LISTA DE COMPRAS DA VITRINE: escolher vários, ver a lista, mandar tudo numa mensagem; o botão individual continua.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { APARENCIA_PADRAO, type ModoPrecoVitrine, type PacoteVitrine } from '../../../core/services/vitrine'
import { Ctx, type AppCtx } from '../../../shared/ui/contexto'
import { novoBackend } from '../../../__tests__/ajuda'
import { ConteudoLoja, type DadosLoja } from '../components/ConteudoLoja'
import { mensagemLista } from '../model/mensagem'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const P: PacoteVitrine[] = [
  { id: 'a', codigo: 'L-1', medida: 60, categoria: 'Normal', cor: 'Preto', gramas: 1000, preco: { fator: '2', moeda: 'BOB' } },
  { id: 'b', codigo: 'L-2', medida: 50, categoria: 'Normal', cor: 'Loiro', gramas: 500, preco: { fator: '3', moeda: 'BOB' } },
  { id: 'c', codigo: 'L-3', medida: 40, categoria: 'Normal', gramas: 250 },
]

const dadosDe = (pacotes: PacoteVitrine[], modoPreco: ModoPrecoVitrine = 'contato'): DadosLoja => ({
  loja: { ativa: true, nome: 'Mechas', whatsapp: '+59170000000', modoPreco, aparencia: APARENCIA_PADRAO },
  pacotes,
  filtros: { medidas: [], cores: [], categorias: [] },
  gramas: pacotes.reduce((s, p) => s + p.gramas, 0),
})

async function abrir(dados: DadosLoja) {
  const { b, sessao } = await novoBackend()
  const ctx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav: { tela: 'loja', params: {} }, ir: () => undefined, ajustarParams: () => undefined } as AppCtx
  return render(<Ctx.Provider value={ctx}><ConteudoLoja dados={dados} /></Ctx.Provider>)
}

const adicionar = (n: number) => fireEvent.click(screen.getAllByRole('button', { name: /Adicionar à lista/ })[n])
const textoDoLink = (a: HTMLElement) => decodeURIComponent((a.getAttribute('href') ?? '').split('text=')[1])

describe('lista de compras na loja', () => {
  it('sem nada escolhido não há barra e o botão individual continua', async () => {
    await abrir(dadosDe(P))
    expect(screen.queryByRole('region', { name: 'Minha lista' })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Entrar em contato' }).length).toBeGreaterThanOrEqual(3)
  })

  it('escolhe dois, vê a lista numerada e manda numa mensagem só', async () => {
    await abrir(dadosDe(P))
    adicionar(0)
    adicionar(0) // o primeiro já virou "Na lista"
    const barra = screen.getByRole('region', { name: 'Minha lista' })
    expect(within(barra).getByText('2 pacotes')).toBeTruthy()
    fireEvent.click(within(barra).getByRole('button', { name: /Ver lista/ }))
    const texto = textoDoLink(within(barra).getByRole('link', { name: 'Enviar lista por WhatsApp' }))
    expect(texto).toContain('¡Hola, Mechas!')
    expect(texto).toContain('*1.* L-1 · 60 cm · Negro')
    expect(texto).toContain('*2.* L-2 · 50 cm · Rubio')
    fireEvent.click(within(barra).getByRole('button', { name: 'Tirar L-1 da lista' }))
    expect(within(barra).getByText('1 pacote')).toBeTruthy()
    fireEvent.click(within(barra).getByRole('button', { name: 'Limpar lista' }))
    expect(screen.queryByRole('region', { name: 'Minha lista' })).toBeNull()
  }, 30000)

  it('a lista fica no aparelho; pacote que saiu da vitrine some dela', async () => {
    const primeiro = await abrir(dadosDe(P))
    adicionar(0)
    adicionar(0)
    primeiro.unmount()
    await abrir(dadosDe(P.slice(1)))
    expect(within(screen.getByRole('region', { name: 'Minha lista' })).getByText('1 pacote')).toBeTruthy()
  }, 30000)

  it('sem WhatsApp da loja não oferece a lista', async () => {
    const d = dadosDe(P)
    await abrir({ ...d, loja: { ...d.loja, whatsapp: undefined } })
    expect(screen.queryByRole('button', { name: /Adicionar à lista/ })).toBeNull()
  })
})

describe('mensagem da lista', () => {
  it('com preço em todos: mostra valor e total, sem perguntar o preço', () => {
    const txt = mensagemLista('pt', P.slice(0, 2), 'Mechas', 'tabela')
    expect(txt).toContain('Tem disponível?')
    expect(txt).toMatch(/\*1\.\* L-1 · 60 cm · Preto · 1 kg · Bs 2[.,]000/)
    expect(txt).toMatch(/\*Total:\* 1[.,]5 kg · Bs 3[.,]500/)
    expect(txt).not.toContain('Qual é o valor?')
  })

  it('algum sem preço: total só em peso e pergunta o valor', () => {
    const txt = mensagemLista('es', P, 'Mechas', 'tabela')
    expect(txt).toMatch(/\*Total:\* 1[.,]75 kg$|\*Total:\* 1[.,]75 kg\n/)
    expect(txt.endsWith('¿Cuál es el precio?')).toBe(true)
  })

  it('texto reescrito troca as variáveis da lista', () => {
    const txt = mensagemLista('es', P.slice(0, 2), 'Mechas', 'tabela', { es: { lista: '{quantidade} artículos:\n{itens}' } })
    expect(txt.startsWith('2 artículos:\n*1.* L-1')).toBe(true)
  })
})
