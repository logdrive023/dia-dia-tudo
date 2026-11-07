// CONSULTANDO: os 4 estados de um dado que vem do servidor (parado · carregando · erro com "Tentar de novo" · sucesso/vazio)
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Consultando } from '../shared/ui/consultando'

const lista = (n: number) => Array.from({ length: n }, (_, k) => `item ${k + 1}`)

describe('Consultando', () => {
  it('parado: consulta desligada mostra o "ocioso", não o carregando', () => {
    render(<Consultando consulta={{ recarregar: () => undefined }} ativo={false} ocioso={<p>escolha um período</p>}>{() => <p>dados</p>}</Consultando>)
    expect(screen.getByText('escolha um período')).toBeTruthy()
    expect(screen.queryByText('Carregando…')).toBeNull()
  })

  it('carregando: esqueleto no formato pedido (com o texto para leitor de tela)', () => {
    const { container } = render(<Consultando consulta={{ recarregar: () => undefined }} formato="tabela" colunas={4} acoes>{() => <p>dados</p>}</Consultando>)
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(container.querySelector('[aria-busy]')).toBeTruthy()
    expect(screen.queryByText('dados')).toBeNull()
  })

  it('erro: mostra o motivo e "Tentar de novo" pede de novo', () => {
    const recarregar = vi.fn()
    render(<Consultando consulta={{ erro: 'Sem internet.', recarregar }}>{() => <p>dados</p>}</Consultando>)
    expect(screen.getByRole('alert').textContent).toContain('Sem internet.')
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }))
    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('erro com dado antigo na tela: continua mostrando o dado (não troca a tela inteira pelo erro)', () => {
    render(<Consultando consulta={{ dados: lista(2), erro: 'Sem internet.', recarregar: () => undefined }}>{(d) => <p>{d.length} itens</p>}</Consultando>)
    expect(screen.getByText('2 itens')).toBeTruthy()
  })

  it('sucesso vazio: o vazio padrão (com ícone e ação); com itens: o conteúdo', () => {
    const { rerender } = render(
      <Consultando consulta={{ dados: lista(0), recarregar: () => undefined }} vazio="Nenhuma venda." iconeVazio="📭" acaoVazio={<button>+ Venda</button>}>{(d) => <p>{d.length} itens</p>}</Consultando>,
    )
    expect(screen.getByText('Nenhuma venda.')).toBeTruthy()
    expect(screen.getByText('📭')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Venda' })).toBeTruthy()
    rerender(<Consultando consulta={{ dados: lista(3), recarregar: () => undefined }} vazio="Nenhuma venda.">{(d) => <p>{d.length} itens</p>}</Consultando>)
    expect(screen.getByText('3 itens')).toBeTruthy()
  })
})
