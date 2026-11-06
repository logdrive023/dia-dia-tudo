// MODO CAIXA × PREÇO DA TABELA: sem mexer vale o padrão; "Preço da tabela" mostra cada comprador com o total; trocar
// várias vezes recalcula a linha e o total na hora; voltar ao padrão; fechar → a venda salva a coluna, o fator e a
// versão que a tela mostrava (tela = registro).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { passarAlertaDeCusto } from '../../../__tests__/custoTeste'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { carregarDemo } from '../../../adapters/demo'
import { fatorDaTabela } from '../../../core/services/precos'
import { VendaRapida } from '../pages/VendaRapida'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { novoBackend } from '../../../__tests__/ajuda'

afterEach(() => (cleanup(), localStorage.clear()))

function Harness({ base }: { base: Omit<AppCtx, 'nav' | 'ajustarParams' | 'ir'> }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'vendaRapida', params: {} })
  const ctx: AppCtx = { ...base, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
  return <Ctx.Provider value={ctx}>{nav.tela === 'vendaRapida' ? <VendaRapida /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
}

describe('escolher o preço da tabela na venda', () => {
  it('padrão sem mexer; troca várias vezes e o total acompanha; fecha e salva o que a tela mostrava', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.unidade === 'grama' && i.codigo && Number(i.campos.comprimento) === 60 && i.saldo > 300 && (i.campos.categoria ?? 'Normal') === 'Normal')!
    const tabela = (await b.consulta('tabelasPreco', {})).find((x) => x.moduloId === 'cabelo' && !x.categoria)!
    // duas colunas com preço para 60 cm (e diferentes entre si)
    const comPreco = tabela.colunas.filter((c) => fatorDaTabela(tabela, 60, c.id).fator)
    const outra = comPreco.find((c) => fatorDaTabela(tabela, 60, c.id).fator !== fatorDaTabela(tabela, 60, comPreco[0].id).fator)!
    const terceira = comPreco.find((c) => c.id !== outra.id && c.id !== comPreco[0].id)!
    render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    const campo = (await screen.findByLabelText('Ler ou buscar pacote', {}, { timeout: 15000 })) as HTMLInputElement
    fireEvent.change(campo, { target: { value: lote.codigo } })
    await screen.findByText(lote.codigo!, { selector: 'li b' }, { timeout: 15000 })
    fireEvent.keyDown(campo, { key: 'Enter' })
    const venda = await screen.findByRole('region', { name: 'Nesta venda' }, { timeout: 5000 })
    const fatorNaLinha = () => within(venda).getByText(/ g × /).textContent ?? ''

    // o seletor aparece com o padrão (sem precisar mexer)
    const seletor = await screen.findByRole('region', { name: 'Preço da tabela' })
    expect(within(seletor).getByText('padrão')).toBeTruthy()
    const padrao = fatorDaTabela(tabela, 60, comPreco[0].id).fator!
    await waitFor(() => expect(fatorNaLinha()).toContain(`× ${padrao.replace('.', ',')}`))

    const escolher = async (nome: string) => {
      fireEvent.click(within(seletor).getByRole('button', { expanded: false }))
      fireEvent.click(await within(seletor).findByRole('radio', { name: new RegExp(`^${nome}`) }))
    }
    // troca para outra coluna: a linha recalcula na hora
    await escolher(outra.nome)
    await waitFor(() => expect(fatorNaLinha()).toContain(`× ${fatorDaTabela(tabela, 60, outra.id).fator!.replace('.', ',')}`))
    expect(within(seletor).getByText('escolhido')).toBeTruthy()
    // troca de novo e volta ao padrão
    if (terceira) {
      await escolher(terceira.nome)
      await waitFor(() => expect(fatorNaLinha()).toContain(`× ${fatorDaTabela(tabela, 60, terceira.id).fator!.replace('.', ',')}`))
    }
    fireEvent.click(within(seletor).getByRole('button', { expanded: false }))
    fireEvent.click(await within(seletor).findByRole('button', { name: /Voltar ao padrão/ }))
    await waitFor(() => expect(fatorNaLinha()).toContain(`× ${padrao.replace('.', ',')}`))
    // escolhe a outra e fecha: a venda salva essa coluna, esse fator e a versão em uso
    await escolher(outra.nome)
    const fatorOutra = fatorDaTabela(tabela, 60, outra.id).fator!
    await waitFor(() => expect(fatorNaLinha()).toContain(`× ${fatorOutra.replace('.', ',')}`))
    fireEvent.click(screen.getByRole('button', { name: /FECHAR/ }))
    await passarAlertaDeCusto()
    fireEvent.click(await screen.findByRole('button', { name: /Dinheiro/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Valor exato ✓' }))
    await screen.findByText(/^Venda V\S* ✓/, {}, { timeout: 10000 })
    const v = (await b.consulta('vendas', {})).find((x) => x.linhas.some((l) => l.itemId === lote.id))!
    const versao = (await b.consulta('tabelaPreco', { id: tabela.id })).atual
    expect(v.linhas[0].campos).toMatchObject({ colunaId: outra.id, colunaNome: outra.nome, tabelaVersao: versao })
    expect(String(v.linhas[0].campos.fator).replace('.', ',')).toBe(fatorOutra.replace('.', ','))
    expect(v.linhas[0].campos.fatorManual).toBeUndefined()
  }, 120000)
})
