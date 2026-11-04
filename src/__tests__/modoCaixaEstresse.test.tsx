// ESTRESSE DO MODO CAIXA (só esta tela): tentar quebrar o caixa como a pessoa no balcão quebraria — ler duas vezes,
// pistola em rajada, código que não existe, pacote que JÁ SAIU (vendido / separado), gramas absurdas, Esc e Enter,
// desconto impossível, clique duplo no FECHAR e no pagamento. Cada caso diz o que a tela TEM de fazer.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { carregarDemo } from '../app/demo'
import { VendaRapida } from '../screens/VendaRapida'
import { Ctx, type AppCtx, type Navegacao } from '../ui/contexto'
import { novoBackend } from './ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

type B = Awaited<ReturnType<typeof novoBackend>>['b']

function Harness({ base, params = {} }: { base: Omit<AppCtx, 'nav' | 'ajustarParams' | 'ir'>; params?: Record<string, string> }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'vendaRapida', params })
  const ctx: AppCtx = { ...base, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
  return <Ctx.Provider value={ctx}>{nav.tela === 'vendaRapida' ? <VendaRapida /> : <p>tela {nav.tela}</p>}</Ctx.Provider>
}

/** abre o caixa com os dados de exemplo; devolve o backend, o campo e os pacotes vendáveis (com tabela, 40–60 cm) */
async function abrir(preparar?: (b: B) => Promise<void>, params?: Record<string, string>) {
  const { b, sessao } = await novoBackend()
  await carregarDemo(b)
  await preparar?.(b)
  const estoque = await b.consulta('estoque', { moduloId: 'cabelo' })
  const vendaveis = estoque.filter((i) => i.codigo && i.saldo > 0 && (i.status === 'disponivel' || i.status === 'parcial') && i.campos.comprimento)
  const erros: string[] = []
  const r = render(<Harness params={params} base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: (t, tipo) => void (tipo === 'erro' && erros.push(t)) }} />)
  const campo = (await screen.findByLabelText('Ler ou buscar pacote')) as HTMLInputElement
  return { b, campo, vendaveis, estoque, erros, sair: () => r.unmount() }
}
/** passa a pistola: digita o código e Enter (espera o estoque aparecer na lista na 1ª vez) */
async function ler(campo: HTMLInputElement, codigo: string, esperarLista = true) {
  fireEvent.change(campo, { target: { value: codigo } })
  if (esperarLista) await screen.findByText(codigo, { selector: '[role=option] b' }, { timeout: 15000 })
  fireEvent.keyDown(campo, { key: 'Enter' })
}
const linhas = () => within(screen.getByRole('region', { name: 'Nesta venda' })).queryAllByRole('listitem')

describe('modo caixa sob estresse', () => {
  it('ler o MESMO pacote 2× não duplica: avisa "já está na venda" e a busca mostra "já na venda"', async () => {
    const { campo, vendaveis } = await abrir()
    const c = vendaveis[0].codigo!
    await ler(campo, c)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    fireEvent.change(campo, { target: { value: c } })
    expect(await screen.findByText(/já na venda/)).toBeTruthy()
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(await screen.findByText(new RegExp(`${c} já está na venda`))).toBeTruthy()
    expect(linhas()).toHaveLength(1)
  }, 60000)

  it('pistola em RAJADA (5 pacotes seguidos): 5 linhas, total = soma, campo limpo', async () => {
    const { campo, vendaveis } = await abrir()
    const cinco = vendaveis.slice(0, 5)
    for (const [k, p] of cinco.entries()) await ler(campo, p.codigo!, k === 0)
    await waitFor(() => expect(linhas()).toHaveLength(cinco.length))
    expect(campo.value).toBe('')
    expect(screen.getByText(`Total · ${cinco.length}`, { exact: false })).toBeTruthy()
  }, 60000)

  it('código que NÃO EXISTE: diz que não há pacote com esse código e nada entra', async () => {
    const { campo, vendaveis } = await abrir()
    await ler(campo, vendaveis[0].codigo!) // estoque carregado
    await waitFor(() => expect(linhas()).toHaveLength(1))
    fireEvent.change(campo, { target: { value: 'ZZZ-9999' } })
    expect(await screen.findByText(/Nenhum pacote com “ZZZ-9999”/)).toBeTruthy()
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(await screen.findByText(/Nenhum pacote com o código ZZZ-9999/, {}, { timeout: 10000 })).toBeTruthy()
    expect(linhas()).toHaveLength(1)
  }, 60000)

  it('QR de pacote JÁ VENDIDO: nada entra; mostra a venda (código, cliente) com "Ver venda"', async () => {
    let vendido = ''
    const { campo } = await abrir(async (b) => {
      const p = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.codigo && i.saldo > 0 && i.campos.comprimento)!
      vendido = p.codigo!
      await b.comando('concluirVenda', { id: 'v-x', linhas: [{ id: 'l', itemId: p.id, quantidade: p.saldo, moeda: 'BOB', total: 100 }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: 100 }] })
    })
    await ler(campo, vendido)
    expect(await screen.findByRole('alert', { name: new RegExp(`${vendido} já foi vendido`) }, { timeout: 10000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ver venda/ })).toBeTruthy()
    expect(linhas()).toHaveLength(0)
  }, 60000)

  it('QR do BRUTO que já foi SEPARADO: mostra os pacotes em que virou e "Adicionar" põe um deles na venda', async () => {
    const { campo, estoque } = await abrir()
    const triado = estoque.find((i) => i.codigo && i.saldo <= 0 && i.campos.estado === 'Bruto')
    expect(triado).toBeTruthy()
    await ler(campo, triado!.codigo!)
    const card = await screen.findByRole('alert', { name: new RegExp(`${triado!.codigo} já foi separado`) }, { timeout: 10000 })
    fireEvent.click(within(card).getAllByRole('button', { name: /Adicionar/ })[0])
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(screen.queryByRole('alert')).toBeNull()
  }, 60000)

  it('gramas ABSURDAS: 0 e mais que o saldo não deixam confirmar; "Tudo" volta ao saldo', async () => {
    const { campo, vendaveis } = await abrir()
    const p = vendaveis.find((x) => x.saldo > 100)!
    await ler(campo, p.codigo!)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Mudar a quantidade de ${p.codigo}`) }))
    const g = screen.getByLabelText('Gramas') as HTMLInputElement
    fireEvent.change(g, { target: { value: '0' } })
    expect((screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(g, { target: { value: String(p.saldo + 1) } })
    expect(screen.getByText(/Só tem/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(g, { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(await within(linhas()[0]).findByText(/^50 g ×/)).toBeTruthy()
  }, 60000)

  it('Esc tira o ÚLTIMO; Enter vazio sem nada na venda avisa e não abre o pagamento', async () => {
    const { campo, vendaveis } = await abrir()
    await ler(campo, vendaveis[0].codigo!)
    await ler(campo, vendaveis[1].codigo!, false)
    await waitFor(() => expect(linhas()).toHaveLength(2))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(linhas()).toHaveLength(1))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(linhas()).toHaveLength(0))
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(await screen.findByText('Passe um pacote primeiro.')).toBeTruthy()
    expect(screen.queryByText('Como pagou?')).toBeNull()
  }, 60000)

  it('desconto IMPOSSÍVEL (150%) dá erro e não mexe no total', async () => {
    const { campo, vendaveis } = await abrir()
    await ler(campo, vendaveis[0].codigo!)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    const totalAntes = screen.getAllByText(/^Bs /, { selector: '.num.font-black, .num' })[0]?.textContent
    fireEvent.click(screen.getAllByText(/mais \(cliente, desconto/)[0])
    fireEvent.click(screen.getAllByRole('radio', { name: '%' })[0])
    fireEvent.change(screen.getAllByLabelText('Desconto em %')[0], { target: { value: '150' } })
    expect(await screen.findAllByText('Desconto de 0 a 100%.')).toBeTruthy()
    expect(screen.getAllByText(/^Bs /, { selector: '.num.font-black, .num' })[0]?.textContent).toBe(totalAntes)
  }, 60000)

  it('CLIQUE DUPLO no pagamento: uma venda só e o estoque baixa uma vez', async () => {
    const { b, campo, vendaveis } = await abrir()
    const p = vendaveis[0]
    await ler(campo, p.codigo!)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    const antes = (await b.consulta('vendas', {})).length
    fireEvent.click(screen.getAllByRole('button', { name: 'FECHAR' })[0])
    const forma = await screen.findByRole('button', { name: /QR/ })
    fireEvent.click(forma)
    fireEvent.click(forma)
    await screen.findByText('Recibo WhatsApp', {}, { timeout: 10000 })
    expect((await b.consulta('vendas', {})).length).toBe(antes + 1)
    expect((await b.consulta('fichaItem', { id: p.id })).item.saldo).toBe(0)
  }, 60000)

  it('busca pelo TECLADO: ↓ destaca e Enter adiciona o destacado (não o primeiro por acaso)', async () => {
    const { campo, vendaveis } = await abrir()
    const termo = 'castanho'
    fireEvent.change(campo, { target: { value: termo } })
    const opcoes = await screen.findAllByRole('option', {}, { timeout: 15000 })
    expect(opcoes.length).toBeGreaterThan(1)
    fireEvent.keyDown(campo, { key: 'ArrowDown' })
    fireEvent.keyDown(campo, { key: 'ArrowDown' })
    const segundo = within(opcoes[1]).getByText(/^L-|^P/, { selector: 'b' }).textContent
    fireEvent.keyDown(campo, { key: 'Enter' })
    await waitFor(() => expect(linhas()).toHaveLength(1))
    expect(within(linhas()[0]).getByText(new RegExp(segundo!))).toBeTruthy()
    expect(vendaveis.length).toBeGreaterThan(0)
  }, 60000)

  it('OUTRO APARELHO vendeu o mesmo pacote enquanto estava na venda: a linha avisa e o FECHAR não deixa vender o que não há', async () => {
    const { b, campo, vendaveis } = await abrir()
    const p = vendaveis[0]
    await ler(campo, p.codigo!)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    // a outra caixa vende o pacote inteiro
    await b.comando('concluirVenda', { id: 'outra', linhas: [{ id: 'l', itemId: p.id, quantidade: p.saldo, moeda: 'BOB', total: 100 }], pagamentos: [{ id: 'pp', forma: 'dinheiro', moeda: 'BOB', valor: 100 }] })
    expect(await within(linhas()[0]).findByText(/já saiu|só tem/, {}, { timeout: 10000 })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'FECHAR' })[0])
    expect(await screen.findByText(/já saiu|só tem/, { selector: '[role=status] *, [role=status]' })).toBeTruthy()
    expect(screen.queryByText('Como pagou?')).toBeNull()
  }, 60000)

  it('FECHAR é o ÚLTIMO da cobrança: vem depois do "+ mais" e do total', async () => {
    await abrir()
    const aside = screen.getByRole('complementary', { name: 'Cobrança' })
    const ordem = [...aside.querySelectorAll('button')].map((x) => x.textContent ?? '')
    const iMais = ordem.findIndex((x) => /mais \(cliente/.test(x))
    const iFechar = ordem.findIndex((x) => x === 'FECHAR')
    expect(iMais).toBeGreaterThanOrEqual(0)
    expect(iFechar).toBeGreaterThan(iMais)
  }, 60000)
})

describe('lerCodigoPacote (servidor)', () => {
  it('disponível, código antigo, não existe, vendido e separado — sempre o mesmo formato', async () => {
    const { b } = await novoBackend()
    await carregarDemo(b)
    const est = await b.consulta('estoque', { moduloId: 'cabelo' })
    const disp = est.find((i) => i.codigo && i.saldo > 0)!
    expect(await b.consulta('lerCodigoPacote', { texto: disp.codigo! })).toMatchObject({ situacao: 'disponivel', item: { id: disp.id }, vendas: [], viraram: [] })
    expect(await b.consulta('lerCodigoPacote', { texto: ` ${disp.codigo!.toLowerCase()} ` })).toMatchObject({ situacao: 'disponivel' })
    expect(await b.consulta('lerCodigoPacote', { texto: `https://x/#/lotes/${disp.id}` })).toMatchObject({ situacao: 'disponivel', item: { id: disp.id } })
    expect(await b.consulta('lerCodigoPacote', { texto: 'nada-123' })).toMatchObject({ situacao: 'naoExiste', vendas: [], viraram: [] })
    const triado = est.find((i) => i.codigo && i.saldo <= 0 && i.campos.estado === 'Bruto')!
    const r = await b.consulta('lerCodigoPacote', { texto: triado.codigo! })
    expect(r.situacao).toBe('separado')
    expect(r.viraram.length).toBeGreaterThan(0)
  }, 60000)
})

describe('vendas em aberto (sair no meio não perde)', () => {
  it('SAIR no meio: a venda fica guardada em aberto (sem baixar estoque nem mexer no caixa)', async () => {
    const { b, campo, vendaveis, sair } = await abrir()
    const p = vendaveis[0]
    await ler(campo, p.codigo!)
    await waitFor(() => expect(linhas()).toHaveLength(1))
    sair()
    await waitFor(async () => expect(await b.consulta('vendasAbertas', {})).toHaveLength(1), { timeout: 5000 })
    const [a] = await b.consulta('vendasAbertas', {})
    expect(a.linhas.map((l) => l.itemId)).toEqual([p.id])
    expect((await b.consulta('fichaItem', { id: p.id })).item.saldo).toBe(p.saldo)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  }, 60000)

  it('RETOMAR (?aberta=id) traz os pacotes de volta; pagar apaga a em aberto', async () => {
    let abertaId = ''
    let item = ''
    const { b } = await abrir(async (bb) => {
      const p = (await bb.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.codigo && i.saldo > 0 && i.campos.comprimento)!
      item = p.id
      abertaId = 'va-1'
      await bb.comando('salvarVendaAberta', { id: abertaId, linhas: [{ id: 'l1', itemId: p.id, quantidade: p.saldo }] })
    }, { aberta: 'va-1' })
    await waitFor(() => expect(linhas()).toHaveLength(1), { timeout: 10000 })
    fireEvent.click(screen.getAllByRole('button', { name: 'FECHAR' })[0])
    fireEvent.click(await screen.findByRole('button', { name: /QR/ }))
    await screen.findByText('Recibo WhatsApp', {}, { timeout: 10000 })
    expect(await b.consulta('vendasAbertas', {})).toHaveLength(0)
    expect((await b.consulta('fichaItem', { id: item })).item.saldo).toBe(0)
  }, 60000)

  it('pacote que está noutra venda EM ABERTO: aviso claro antes; confirmando, sai de lá e entra aqui', async () => {
    let c = ''
    const { b, campo, vendaveis } = await abrir(async (bb) => {
      const p = (await bb.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.codigo && i.saldo > 0 && i.campos.comprimento)!
      c = p.codigo!
      await bb.comando('salvarVendaAberta', { id: 'va-2', linhas: [{ id: 'l1', itemId: p.id, quantidade: p.saldo }] })
    })
    expect(vendaveis.length).toBeGreaterThan(0)
    await ler(campo, c)
    expect(await screen.findByText('Este pacote está numa venda em aberto', {}, { timeout: 10000 })).toBeTruthy()
    expect(linhas()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar de lá e vender aqui' }))
    await waitFor(() => expect(linhas()).toHaveLength(1), { timeout: 10000 })
    expect(await b.consulta('vendasAbertas', {})).toHaveLength(0) // ficou vazia → descartada
    expect((await b.consulta('logDetalhado', { acao: 'tirarDaVendaAberta' })).linhas).toHaveLength(1)
  }, 60000)

  it('servidor: vender (de qualquer tela) um pacote que estava em aberto tira ele de lá e registra', async () => {
    const { b } = await novoBackend()
    await carregarDemo(b)
    const [p1, p2] = (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.codigo && i.saldo > 0 && i.campos.comprimento)
    await b.comando('salvarVendaAberta', { id: 'va', linhas: [{ id: 'a', itemId: p1.id, quantidade: p1.saldo }, { id: 'b', itemId: p2.id, quantidade: p2.saldo }] })
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: p1.id, quantidade: p1.saldo, moeda: 'BOB', total: 100 }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: 100 }] })
    const [a] = await b.consulta('vendasAbertas', {})
    expect(a.linhas.map((l) => l.itemId)).toEqual([p2.id])
    expect((await b.consulta('logDetalhado', { acao: 'tirarDaVendaAberta' })).linhas[0].resumo).toMatch(/foi para V-/)
    // quantidade inválida e pacote inexistente: recusa
    await expect(b.comando('salvarVendaAberta', { id: 'x', linhas: [{ id: 'a', itemId: p2.id, quantidade: 0 }] })).rejects.toThrow()
    await expect(b.comando('salvarVendaAberta', { id: 'x', linhas: [{ id: 'a', itemId: 'nada', quantidade: 1 }] })).rejects.toThrow()
    // descartar: some da lista e o estoque nem mexeu
    await b.comando('descartarVendaAberta', { id: 'va' })
    expect(await b.consulta('vendasAbertas', {})).toHaveLength(0)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  }, 60000)
})

describe('lista "Em aberto" no Vender', () => {
  it('com uma venda em aberto: a aba conta e a lista mostra (com busca ligada, nada quebra)', async () => {
    const { ListaVendas } = await import('../screens/ListaVendas')
    const { b, sessao } = await novoBackend()
    await carregarDemo(b)
    const p = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.codigo && i.saldo > 0 && i.campos.comprimento)!
    await b.comando('salvarVendaAberta', { id: 'va-l', linhas: [{ id: 'l1', itemId: p.id, quantidade: p.saldo }] })
    function H() {
      const [nav, setNav] = useState<Navegacao>({ tela: 'vender', params: { aba: 'abertas', busca: p.codigo!.toLowerCase() } })
      const ctx: AppCtx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (x) => setNav((n) => ({ ...n, params: { ...n.params, ...x } })) }
      return <Ctx.Provider value={ctx}><ListaVendas novaVenda={null} /></Ctx.Provider>
    }
    render(<H />)
    await screen.findByRole('tab', { name: /Em aberto 1/ }, { timeout: 15000 })
    expect(await screen.findAllByText(new RegExp(p.codigo!), {}, { timeout: 10000 })).toBeTruthy()
    expect(screen.queryByText('Algo deu errado nesta tela.')).toBeNull()
  }, 60000)
})
