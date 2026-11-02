import { describe, expect, it } from 'vitest'
import { FORM_COMPRA_PADRAO, type FormCompraConfig } from '../core/services/formCompra'
import { bs, novoBackend } from './ajuda'

const linha = (id: string) => ({ id, quantidade: 1000, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } })
const copia = (): FormCompraConfig => JSON.parse(JSON.stringify(FORM_COMPRA_PADRAO))

describe('formulário de compra (Configurações › Formulário de compra)', () => {
  it('padrão = uma página simples; compra com o mínimo (só o que veio) continua funcionando', async () => {
    const { b } = await novoBackend()
    const f = await b.consulta('formCompra', {})
    expect(f.layout).toBe('simples')
    expect(f.campos.filter((c) => c.aberto).map((c) => c.id)).toEqual(['fornecedor', 'itens'])
    expect(f.campos.some((c) => c.obrigatorio)).toBe(false)
    const r = await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', linhas: [linha('c1-l')] })
    const p = await b.consulta('pedido', { id: r.id })
    expect(p.compra.codigo).toBe('P-0001')
    expect(p.compra.pessoaId).toBeUndefined()
    expect(p.gramas).toBe(1000)
  })

  it('salva ordem, aberto, obrigatório e padrões; o servidor cobra o obrigatório; fica no log', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'maria', nome: 'Maria Silva', papeis: ['fornecedor'] })
    const f = copia()
    f.layout = 'passos'
    f.campos = [...f.campos].reverse().map((c) => (c.id === 'fornecedor' || c.id === 'obs' ? { ...c, obrigatorio: true } : c.id === 'codigo' ? { ...c, aberto: true } : c.id === 'fotos' ? { ...c, visivel: false } : c))
    f.padroes = { ...f.padroes, modoCodigo: 'porPessoa', modoLinha: 'tabela', moeda: 'BOB' }
    f.medidas = [60, 40, 60, 50]
    f.estados = ['Úmido', 'Seco']
    await b.comando('salvarFormCompra', { form: f })
    const salvo = await b.consulta('formCompra', {})
    expect(salvo.layout).toBe('passos')
    expect(salvo.campos[0].id).toBe('atributos')
    expect(salvo.campos.find((c) => c.id === 'codigo')?.aberto).toBe(true)
    expect(salvo.campos.find((c) => c.id === 'fotos')?.visivel).toBe(false)
    expect(salvo.medidas).toEqual([40, 50, 60])
    expect(salvo.estados).toEqual(['Úmido', 'Seco'])
    expect(salvo.padroes.modoCodigo).toBe('porPessoa')
    // obrigatórios conferidos no servidor
    await expect(b.comando('criarCompra', { id: 'x1', moduloId: 'cabelo', obs: 'ok', linhas: [linha('x1-l')] })).rejects.toThrow(/fornecedor/)
    await expect(b.comando('criarCompra', { id: 'x2', moduloId: 'cabelo', pessoaId: 'maria', linhas: [linha('x2-l')] })).rejects.toThrow(/observação/)
    await b.comando('criarCompra', { id: 'x3', moduloId: 'cabelo', pessoaId: 'maria', obs: 'veio úmido', linhas: [linha('x3-l')] })
    expect((await b.consulta('pedido', { id: 'x3' })).compra.obs).toBe('veio úmido')
    // salvar igual: nada mudou; log com antes → depois; voltar ao padrão
    await expect(b.comando('salvarFormCompra', { form: salvo })).rejects.toThrow(/Nada mudou/)
    const log = (await b.consulta('logDetalhado', {})).linhas.find((l) => l.acao === 'salvarFormCompra')
    expect(log?.resumo).toMatch(/uma página .* → passo a passo/)
    await b.comando('salvarFormCompra', { form: null })
    expect(await b.consulta('formCompra', {})).toEqual(FORM_COMPRA_PADRAO)
  })

  it('recusa formulário inválido e funcionária não muda', async () => {
    const { b, sessao } = await novoBackend()
    const f = copia()
    await expect(b.comando('salvarFormCompra', { form: { ...f, campos: f.campos.map((c) => (c.id === 'codigo' ? { ...c, obrigatorio: true } : c)) } })).rejects.toThrow(/não pode ser obrigatório/)
    await expect(b.comando('salvarFormCompra', { form: { ...f, campos: f.campos.slice(1) } })).rejects.toThrow(/Faltam campos/)
    await expect(b.comando('salvarFormCompra', { form: { ...f, medidas: [0] } })).rejects.toThrow(/Medidas/)
    await expect(b.comando('salvarFormCompra', { form: { ...f, estados: ['Úmido', 'úmido'] } })).rejects.toThrow(/iguais/)
    await expect(b.comando('salvarFormCompra', { form: { ...f, padroes: { ...f.padroes, moeda: 'XXX' } } })).rejects.toThrow(/Moeda/)
    // "O que veio" não some: esconder é ignorado
    await b.comando('salvarFormCompra', { form: { ...f, layout: 'passos', campos: f.campos.map((c) => (c.id === 'itens' ? { ...c, visivel: false } : c)) } })
    expect((await b.consulta('formCompra', {})).campos.find((c) => c.id === 'itens')?.visivel).toBe(true)
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('salvarFormCompra', { form: null })).rejects.toThrow(/permissão/)
  })
})
