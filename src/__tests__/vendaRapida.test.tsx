// MODO CAIXA (venda rápida) com os dados de exemplo: Vender › ⚡ Modo caixa → digita o código do lote + Enter → a
// linha entra inteira com o preço da tabela → toca e digita 500 g → FECHAR → Dinheiro → a venda existe, o estoque
// baixou 500 g e o movimento guarda saldo antes → depois. Ler o mesmo código de novo não duplica.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { multiplicarFator } from '../core/domain/dinheiro'
import { gramasTexto } from '../ui/base'
import { carregarDemo } from '../app/demo'
import { VendaRapida } from '../screens/VendaRapida'
import { PacoteVenda } from '../screens/PacoteVenda'
import { Vender } from '../screens/Vender'
import { Ctx, type AppCtx, type Navegacao } from '../ui/contexto'
import { novoBackend } from './ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

function Harness({ base, inicio = { tela: 'vender', params: {} } }: { base: Omit<AppCtx, 'nav' | 'ajustarParams' | 'ir'>; inicio?: Navegacao }) {
  const [nav, setNav] = useState<Navegacao>(inicio)
  const ctx: AppCtx = {
    ...base,
    nav,
    ir: (tela, params = {}) => setNav({ tela, params }),
    ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })),
  }
  return <Ctx.Provider value={ctx}>{nav.tela === 'vendaRapida' ? <VendaRapida /> : nav.tela === 'vender' ? <Vender /> : nav.tela === 'lote' ? <PacoteVenda /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
}

describe('modo caixa (venda rápida)', () => {
  it('lê o lote, vende uma parte em dinheiro, baixa o estoque e não duplica', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    const lote = lotes.find((i) => i.unidade === 'grama' && i.codigo && Number(i.campos.comprimento) === 60 && (i.status === 'disponivel' || i.status === 'parcial') && i.saldo > 600)!
    expect(lote).toBeTruthy()
    const codigo = lote.codigo!
    const erros: string[] = []
    render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: (t, tipo) => void (tipo === 'erro' && erros.push(t)) }} />)

    // Vender abre na lista de vendas: "+ Nova venda ▾" › "Vender cabelo (pistola ou QR)"
    fireEvent.click((await screen.findAllByRole('button', { name: '+ Nova venda' }, { timeout: 10000 }))[0]); fireEvent.click(await screen.findByRole('menuitem', { name: /Vender cabelo/ }))
    const campo = (await screen.findByLabelText('Ler ou buscar pacote')) as HTMLInputElement
    // digita o código (a lista de achados aparece quando o estoque carregou) + Enter, como a pistola
    fireEvent.change(campo, { target: { value: codigo } })
    await screen.findByText(codigo, { selector: 'li b' }, { timeout: 15000 })
    fireEvent.keyDown(campo, { key: 'Enter' })

    // entrou inteiro: saldo do lote × fator da tabela
    const tabela = await screen.findByRole('table', {}, { timeout: 5000 })
    const linhas = () => within(tabela).getAllByRole('row').slice(1)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(within(linhas()[0]).getByText(codigo)).toBeTruthy()
    expect(within(linhas()[0]).getByText(new RegExp(`^${lote.saldo.toLocaleString('pt-BR').replace('.', '\\.')} g × `))).toBeTruthy()
    expect(campo.value).toBe('')
    // "fica no estoque" depois da venda: o pacote inteiro acaba
    expect(within(linhas()[0]).getByText('acaba o pacote')).toBeTruthy()

    // tocar na foto/código: CONFERIR sem sair da venda; a página do lote abre em outra aba
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    fireEvent.click(within(linhas()[0]).getByRole('button', { name: `Conferir ${codigo}` }))
    const painel = await screen.findByRole('dialog', { name: 'Conferir o pacote' })
    expect(within(painel).getByText('Peso atual')).toBeTruthy()
    await within(painel).findByText('Compras de origem')
    fireEvent.click(within(painel).getByText('Abrir página do lote ↗'))
    expect(abrir).toHaveBeenCalledWith(expect.stringContaining(`#/lotes/${encodeURIComponent(lote.id)}`), '_blank', 'noopener')
    fireEvent.click(within(painel).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conferir o pacote' })).toBeNull())
    expect(linhas()).toHaveLength(1)

    // tocar nas gramas: vendeu só 500 g
    fireEvent.click(within(linhas()[0]).getByText(/ g × /))
    const gramas = await screen.findByLabelText('Gramas')
    fireEvent.change(gramas, { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(within(linhas()[0]).getByText(/^500 g × /)).toBeTruthy())
    expect(within(linhas()[0]).getByText(`fica no estoque: ${gramasTexto(lote.saldo - 500)}`)).toBeTruthy()

    // o mesmo código de novo: avisa e não duplica
    fireEvent.change(campo, { target: { value: codigo } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    await screen.findByText(`${codigo} já está na venda.`)
    expect(linhas()).toHaveLength(1)

    // FECHAR → Dinheiro → valor exato
    fireEvent.click(screen.getByRole('button', { name: /FECHAR/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Dinheiro/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Valor exato ✓' }))
    await screen.findByText('Recibo WhatsApp', {}, { timeout: 10000 })
    await screen.findByText(/^Venda V\S* ✓/, {}, { timeout: 5000 })
    expect(erros).toEqual([])
    // pronto para a próxima: lista vazia e campo limpo
    expect(screen.queryByRole('table')).toBeNull()

    // a venda existe, o estoque baixou e o movimento guarda antes → depois
    const vendas = await b.consulta('vendas', {})
    const v = vendas.find((x) => x.linhas.some((l) => l.itemId === lote.id && l.quantidade === 500))
    expect(v).toBeTruthy()
    expect(v!.pagamentos[0].forma).toBe('dinheiro')
    expect(v!.linhas[0].campos.fator).toBeTruthy()
    const movs = await b.consulta('movimentosDoItem', { itemId: lote.id })
    const mov = movs.find((m) => m.origemId === v!.id)!
    expect(mov).toMatchObject({ motivo: 'venda', delta: -500, saldoAntes: lote.saldo, saldoDepois: lote.saldo - 500 })
    const depois = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === lote.id)!
    expect(depois.saldo).toBe(lote.saldo - 500)
  }, 120000)

  it('pacote ainda não separado ENTRA (nunca trava): aviso amarelo e o preço digitado na linha', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    const bruto = lotes.find((i) => i.codigo && i.saldo > 0 && (i.status === 'bruto' || i.status === 'naoIdentificado' || !i.campos.comprimento))
    if (!bruto) return // a demonstração não tem pacote bruto com saldo
    render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    // Vender abre na lista de vendas: "+ Nova venda ▾" › "Vender cabelo (pistola ou QR)"
    fireEvent.click((await screen.findAllByRole('button', { name: '+ Nova venda' }, { timeout: 10000 }))[0]); fireEvent.click(await screen.findByRole('menuitem', { name: /Vender cabelo/ }))
    const campo = await screen.findByLabelText('Ler ou buscar pacote')
    fireEvent.change(campo, { target: { value: bruto.codigo } })
    await screen.findByText(bruto.codigo!, { selector: 'li b' }, { timeout: 15000 })
    fireEvent.keyDown(campo, { key: 'Enter' })
    await screen.findByText(/tudo bem vender assim|digite o preço na linha/, {}, { timeout: 10000 })
    // sem preço de tabela: o campo do preço aparece na linha e pagar pede o valor
    if (!bruto.campos.comprimento) expect(await screen.findByLabelText(`Preço de ${bruto.codigo}`)).toBeTruthy()
  }, 120000)

  it('desconto em %: mostra o valor na hora, guarda o modo e a venda sai com o total descontado', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    const lote = lotes.find((i) => i.unidade === 'grama' && i.codigo && Number(i.campos.comprimento) === 60 && (i.status === 'disponivel' || i.status === 'parcial') && i.saldo > 600)!
    const codigo = lote.codigo!
    render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    // Vender abre na lista de vendas: "+ Nova venda ▾" › "Vender cabelo (pistola ou QR)"
    fireEvent.click((await screen.findAllByRole('button', { name: '+ Nova venda' }, { timeout: 10000 }))[0]); fireEvent.click(await screen.findByRole('menuitem', { name: /Vender cabelo/ }))
    const campo = await screen.findByLabelText('Ler ou buscar pacote')
    fireEvent.change(campo, { target: { value: codigo } })
    await screen.findByText(codigo, { selector: 'li b' }, { timeout: 15000 })
    fireEvent.keyDown(campo, { key: 'Enter' })
    const linha = (await screen.findAllByRole('row'))[1]
    fireEvent.click(within(linha).getByText(/ g × /))
    fireEvent.change(await screen.findByLabelText('Gramas'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    const conta = await within(linha).findByText(/^500 g × /)
    const fator = conta.firstChild!.textContent!.split('×')[1].trim()
    const cheio = multiplicarFator(500, fator, 'BOB')
    const esperado = cheio - Math.round(cheio * 0.1)

    // + mais → [ % | Bs ] → 10 %
    fireEvent.click(screen.getByText(/mais \(cliente, desconto, observação\)/))
    fireEvent.click(screen.getByRole('radio', { name: '%' }))
    expect(localStorage.getItem('tudo.caixa.modoDesconto')).toBe('pct')
    fireEvent.change(screen.getByLabelText('Desconto em %'), { target: { value: '150' } })
    await screen.findByText('Desconto de 0 a 100%.')
    fireEvent.change(screen.getByLabelText('Desconto em %'), { target: { value: '10' } })
    await screen.findByText(/de desconto · total/)

    fireEvent.click(screen.getByRole('button', { name: /FECHAR/ }))
    fireEvent.click(await screen.findByRole('button', { name: /QR/ }))
    await screen.findByText('Recibo WhatsApp', {}, { timeout: 10000 })
    const v = (await b.consulta('vendas', {})).find((x) => x.linhas.some((l) => l.itemId === lote.id && l.quantidade === 500))!
    expect(v.totalPrincipal).toBe(esperado)
    // o desconto fica na venda e a linha continua com a conta da tabela (fator, medida, tabela)
    expect(v.campos.desconto).toMatch(/^desconto 10% = Bs /)
    expect(v.linhas[0].campos).toMatchObject({ fator, medida: 60 })
    expect(v.linhas[0].campos.tabelaId).toBeTruthy()
    expect(v.linhas[0]).toMatchObject({ bruto: cheio, desconto: Math.round(cheio * 0.1), total: esperado })
    expect(v.pagamentos[0]).toMatchObject({ forma: 'qr', valor: esperado })
  }, 120000)

  it('cobrado em R$ com a cotação digitada: pagamento em BRL, valor principal pela cotação digitada, caixa em R$ e desconto em R$', async () => {
    const { b, r, sessao } = await novoBackend()
    await carregarDemo(b)
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    const lote = lotes.find((i) => i.unidade === 'grama' && i.codigo && Number(i.campos.comprimento) === 60 && (i.status === 'disponivel' || i.status === 'parcial') && i.saldo > 600)!
    const codigo = lote.codigo!
    const caixaBRL = async () => (await b.consulta('caixaDoDia', { data: r.hoje })).contas.find((c) => c.moeda === 'BRL')?.total ?? 0
    const antes = await caixaBRL()
    render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    // Vender abre na lista de vendas: "+ Nova venda ▾" › "Vender cabelo (pistola ou QR)"
    fireEvent.click((await screen.findAllByRole('button', { name: '+ Nova venda' }, { timeout: 10000 }))[0]); fireEvent.click(await screen.findByRole('menuitem', { name: /Vender cabelo/ }))
    const campo = await screen.findByLabelText('Ler ou buscar pacote')
    fireEvent.change(campo, { target: { value: codigo } })
    await screen.findByText(codigo, { selector: 'li b' }, { timeout: 15000 })
    fireEvent.keyDown(campo, { key: 'Enter' })
    const linha = (await screen.findAllByRole('row'))[1]
    fireEvent.click(within(linha).getByText(/ g × /))
    fireEvent.change(await screen.findByLabelText('Gramas'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    const conta = await within(linha).findByText(/^500 g × /)
    const cheio = multiplicarFator(500, conta.firstChild!.textContent!.split('×')[1].trim(), 'BOB')

    // Cobrar em R$: a cotação aparece (do sistema) e dá para digitar a do dia
    expect(screen.queryByLabelText('Cotação de R$')).toBeNull()
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Cobrar em' })).getByRole('radio', { name: 'R$' }))
    expect(localStorage.getItem('tudo.caixa.moedaCobranca')).toBe('BRL')
    const cotacao = (await screen.findByLabelText('Cotação de R$')) as HTMLInputElement
    expect(cotacao.value).not.toBe('')
    fireEvent.change(cotacao, { target: { value: '1,30' } })

    // desconto de R$ 10,00 (na moeda da cobrança)
    fireEvent.click(screen.getByText(/mais \(cliente, desconto, observação\)/))
    const grupoDesconto = screen.getByRole('radiogroup', { name: 'Desconto' })
    fireEvent.click(within(grupoDesconto).getByRole('radio', { name: 'R$' }))
    fireEvent.change(grupoDesconto.parentElement!.parentElement!.querySelector('input:not([aria-label])')!, { target: { value: '10' } })

    // total em R$ = (cheio − R$ 10 × 1,30) ÷ 1,30
    const brl = Math.round((cheio * 10) / 13) - 1000
    await screen.findAllByText(`R$ ${(brl / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)

    fireEvent.click(screen.getByRole('button', { name: /FECHAR/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Dinheiro/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Valor exato ✓' }))
    await screen.findByText('Recibo WhatsApp', {}, { timeout: 10000 })

    const v = (await b.consulta('vendas', {})).find((x) => x.linhas.some((l) => l.itemId === lote.id && l.quantidade === 500))!
    expect(v.totalPrincipal).toBe(cheio - 1300)
    expect(v.pagamentos).toHaveLength(1)
    const pg = v.pagamentos[0]
    expect(pg).toMatchObject({ forma: 'dinheiro', moeda: 'BRL', valor: brl })
    // valor principal pela cotação DIGITADA (1 R$ = 1,30 Bs), não a do sistema
    expect(pg.valorPrincipal).toBe(Math.round(brl * 1.3))
    expect(pg.cotacao).toMatchObject({ moeda: 'BRL', valor: '1,3', contra: 'BOB' })
    expect(v.campos.cobranca).toBe('Cobrado em R$ · cotação 1 R$ = 1,30 Bs')
    // desconto digitado em R$, convertido pela cotação digitada (R$ 10 × 1,30 = Bs 13)
    expect(v.campos.desconto).toBe('desconto R$ 10,00 (= Bs 13,00)')
    expect(v.linhas[0]).toMatchObject({ desconto: 1300 })
    expect(v.linhas[0].campos.fator).toBeTruthy()
    expect(await caixaBRL()).toBe(antes + brl)
    const log = await b.consulta('logDetalhado', { acao: 'cotacaoManual' })
    expect(JSON.stringify(log)).toContain('1,30')
  }, 120000)

  it('dividir pagamento: R$ com a cotação de cobrança e US$ com a cotação digitada nele', async () => {
    const { b, r, sessao } = await novoBackend()
    await carregarDemo(b)
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    const lote = lotes.find((i) => i.unidade === 'grama' && i.codigo && Number(i.campos.comprimento) === 60 && (i.status === 'disponivel' || i.status === 'parcial') && i.saldo > 600)!
    const caixa = async (m: string) => (await b.consulta('caixaDoDia', { data: r.hoje })).contas.find((c) => c.moeda === m)?.total ?? 0
    const [brl0, usd0] = [await caixa('BRL'), await caixa('USD')]
    render(<Harness inicio={{ tela: 'vendaRapida', params: {} }} base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    const campo = await screen.findByLabelText('Ler ou buscar pacote')
    fireEvent.change(campo, { target: { value: lote.codigo } })
    await screen.findByText(lote.codigo!, { selector: 'li b' }, { timeout: 15000 })
    fireEvent.keyDown(campo, { key: 'Enter' })
    const linha = (await screen.findAllByRole('row'))[1]
    fireEvent.click(within(linha).getByText(/ g × /))
    fireEvent.change(await screen.findByLabelText('Gramas'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    const conta = await within(linha).findByText(/^500 g × /)
    const cheio = multiplicarFator(500, conta.firstChild!.textContent!.split('×')[1].trim(), 'BOB')
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Cobrar em' })).getByRole('radio', { name: 'R$' }))
    fireEvent.change(await screen.findByLabelText('Cotação de R$'), { target: { value: '1,30' } })

    fireEvent.click(screen.getByRole('button', { name: /FECHAR/ }))
    fireEvent.click(await screen.findByText('Dividir pagamento'))
    const dlg = screen.getByRole('dialog')
    // R$ 100 + o resto em US$ a 6,96
    expect((within(dlg).getByLabelText('Cotação de R$') as HTMLInputElement).value).toBe('1,30')
    fireEvent.change(dlg.querySelectorAll('input[inputmode="decimal"]:not([aria-label])')[0], { target: { value: '100' } })
    fireEvent.click(within(dlg).getByText(/Forma de pagamento/))
    await waitFor(() => expect(dlg.querySelectorAll('select')[2]?.querySelector('option[value="USD"]')).toBeTruthy())
    fireEvent.change(dlg.querySelectorAll('select')[2], { target: { value: 'USD' } })
    const cotUsd = (await within(dlg).findByLabelText('Cotação de US$')) as HTMLInputElement
    expect(cotUsd.value).not.toBe('')
    fireEvent.change(cotUsd, { target: { value: '6,96' } })
    fireEvent.click(within(dlg).getByText('Completar o que falta'))
    await within(dlg).findByText('Pagamento fecha com o total ✓')
    fireEvent.click(within(dlg).getByRole('button', { name: 'Confirmar venda' }))
    await screen.findByText('Recibo WhatsApp', {}, { timeout: 10000 })

    const v = (await b.consulta('vendas', {})).find((x) => x.linhas.some((l) => l.itemId === lote.id && l.quantidade === 500))!
    expect(v.totalPrincipal).toBe(cheio)
    const brl = v.pagamentos.find((p) => p.moeda === 'BRL')!
    const usd = v.pagamentos.find((p) => p.moeda === 'USD')!
    expect(brl).toMatchObject({ valor: 10000, valorPrincipal: 13000 })
    expect(usd.valorPrincipal).toBe(Math.round(usd.valor * 6.96))
    expect(usd.cotacao).toMatchObject({ valor: '6,96', contra: 'BOB' })
    expect(await caixa('BRL')).toBe(brl0 + 10000)
    expect(await caixa('USD')).toBe(usd0 + usd.valor)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  }, 120000)

  it('funcionária abre o pacote (QR): vê só o que precisa para vender e o Vender abre o modo caixa com ele', async () => {
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const lotes = await b.consulta('estoque', { moduloId: 'cabelo' })
    const lote = lotes.find((i) => i.unidade === 'grama' && i.codigo && Number(i.campos.comprimento) === 60 && (i.status === 'disponivel' || i.status === 'parcial') && i.saldo > 600)!
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    render(<Harness inicio={{ tela: 'lote', params: { id: lote.id } }} base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
    await screen.findByRole('heading', { name: lote.codigo }, { timeout: 10000 })
    expect(screen.getByText('Peso disponível')).toBeTruthy()
    expect(screen.getByText('Preço de venda')).toBeTruthy()
    expect(screen.queryByText(/Separar|Ajustar|Rastrear|Etiqueta|Custo/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Vender/ }))
    const tabela = await screen.findByRole('table', {}, { timeout: 15000 })
    await waitFor(() => expect(within(tabela).getAllByRole('row')).toHaveLength(2), { timeout: 15000 })
    expect(within(tabela).getByText(lote.codigo!)).toBeTruthy()
  }, 120000)
})
