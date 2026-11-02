import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

const linha = (id: string, g = 1000) => ({ id, quantidade: g, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } })

async function comprar(b: B, id: string, d: { pessoaId?: string; compradorId?: string; codigo?: string } = {}) {
  await b.comando('criarCompra', { id, moduloId: 'cabelo', linhas: [linha(`${id}-l`)], ...d })
  return (await b.consulta('pedido', { id })).compra
}

async function concluir(b: B, id: string, codigosLotes?: Record<string, string>) {
  for (const e of ['conferido', 'pago', 'concluido'])
    await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(100) }] : undefined, codigosLotes: e === 'concluido' ? codigosLotes : undefined })
  return (await b.consulta('pedido', { id })).lotes
}

async function pessoas(b: B) {
  await b.comando('salvarPessoa', { id: 'maria', nome: 'Maria Silva', papeis: ['fornecedor'] })
  await b.comando('salvarPessoa', { id: 'celso', nome: 'Celso Rocha', papeis: ['fornecedor'] })
}

describe('códigos de compra e lote', () => {
  it('padrão continua P-0001 e L-0001; incremental sem prefixo dá 1, 2, 3', async () => {
    const { b } = await novoBackend()
    expect((await comprar(b, 'c0')).codigo).toBe('P-0001')
    await b.comando('salvarCodigos', { compra: { prefixo: '', digitos: 0 } })
    expect((await comprar(b, 'c1')).codigo).toBe('2')
    const { b: b2 } = await novoBackend()
    await b2.comando('salvarCodigos', { compra: { prefixo: '', digitos: 0 }, lote: { prefixo: '', digitos: 0 } })
    const cs = [await comprar(b2, 'a'), await comprar(b2, 'b'), await comprar(b2, 'c')]
    expect(cs.map((c) => c.codigo)).toEqual(['1', '2', '3'])
    expect((await concluir(b2, 'a')).map((l) => l.codigo)).toEqual(['1'])
    const prev = await b2.consulta('codigos', {})
    expect(prev.previa.compra).toEqual(['4', '5', '6'])
    // o incremental pula um código que alguém digitou à mão
    await comprar(b2, 'd', { codigo: '5' })
    expect((await comprar(b2, 'e')).codigo).toBe('4')
    expect((await comprar(b2, 'f')).codigo).toBe('6')
  })

  it('por pessoa: Maria M1, M2; Celso C1 (sigla editável, sem repetir)', async () => {
    const { b } = await novoBackend()
    await pessoas(b)
    await b.comando('salvarCodigos', { compra: { modo: 'porPessoa', base: 'fornecedor' } })
    expect((await b.consulta('codigos', { pessoaId: 'maria' })).previa.compra).toEqual(['M1', 'M2', 'M3'])
    expect((await comprar(b, 'm1', { pessoaId: 'maria' })).codigo).toBe('M1')
    expect((await comprar(b, 'm2', { pessoaId: 'maria' })).codigo).toBe('M2')
    expect((await comprar(b, 'c1', { pessoaId: 'celso' })).codigo).toBe('C1')
    // Marta chega depois: "M" já é da Maria → sugere outra (MA)
    await b.comando('salvarPessoa', { id: 'marta', nome: 'Marta', papeis: ['fornecedor'] })
    expect((await comprar(b, 'x1', { pessoaId: 'marta' })).codigo).toBe('MA1')
    await expect(b.comando('salvarSigla', { pessoaId: 'celso', sigla: 'M' })).rejects.toThrow(/já é de Maria Silva/)
    await b.comando('salvarSigla', { pessoaId: 'celso', sigla: 'CR' })
    expect((await comprar(b, 'c2', { pessoaId: 'celso' })).codigo).toBe('CR1')
    // base = quem comprou (equipe)
    await b.comando('salvarPessoa', { id: 'vera', nome: 'Vera', papeis: ['funcionario'] })
    await b.comando('salvarCodigos', { compra: { base: 'comprador' } })
    expect((await comprar(b, 'v1', { pessoaId: 'maria', compradorId: 'vera' })).codigo).toBe('V1')
    // a busca acha pela sigla do fornecedor e de quem comprou
    const fila = await b.consulta('filaTriagem', { incluirEncerradas: true })
    expect(fila.find((c) => c.id === 'v1')?.busca).toMatch(/\bvera\b/)
    expect(fila.find((c) => c.id === 'm1')?.sigla).toBe('M')
  })

  it('lote da compra: M1-1; separado → M1-1a, M1-1b; juntado → M1+C1-1', async () => {
    const { b } = await novoBackend()
    await pessoas(b)
    await b.comando('salvarCodigos', { compra: { modo: 'porPessoa' }, lote: { modo: 'daCompra' } })
    await comprar(b, 'm1', { pessoaId: 'maria' })
    const [lote] = await concluir(b, 'm1')
    expect(lote.codigo).toBe('M1-1')
    await b.comando('separarLote', {
      id: 's1',
      loteId: lote.id,
      quantidadeUsada: 1000,
      saidas: [
        { id: 'a', quantidade: 500, campos: { estado: 'Bruto', comprimento: 60 } },
        { id: 'b', quantidade: 400, campos: { estado: 'Bruto', comprimento: 40 } },
      ],
    })
    const est = await b.consulta('estoque', { moduloId: 'cabelo' })
    expect(est.filter((i) => i.id === 'a' || i.id === 'b').map((i) => i.codigo).sort()).toEqual(['M1-1a', 'M1-1b'])
    await comprar(b, 'c1', { pessoaId: 'celso' })
    const [lc] = await concluir(b, 'c1')
    expect(lc.codigo).toBe('C1-1')
    const r = await b.comando('triarLotes', { id: 'u1', ids: ['a', lc.id] })
    const u = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === r.lotes[0])
    expect(u?.codigo).toBe('M1+C1-1')
    // manual na separação: o digitado vale e o automático pula o reservado
    await b.comando('separarLote', { id: 's2', loteId: 'b', quantidadeUsada: 400, saidas: [{ id: 'b1', quantidade: 200, campos: { estado: 'Separado', comprimento: 40 } }, { id: 'b2', quantidade: 200, campos: { estado: 'Separado', comprimento: 40 }, codigo: 'M1-1b1' }] })
    const e2 = await b.consulta('estoque', { moduloId: 'cabelo' })
    expect(e2.find((i) => i.id === 'b2')?.codigo).toBe('M1-1b1')
    expect(e2.find((i) => i.id === 'b1')?.codigo).toBe('M1-1b2')
  })

  it('código digitado que já existe é recusado dizendo qual registro usa', async () => {
    const { b } = await novoBackend()
    await pessoas(b)
    await comprar(b, 'c1', { pessoaId: 'maria' })
    await expect(comprar(b, 'c2', { codigo: ' p-0001 ' })).rejects.toThrow(/Já existe: compra P-0001 · Maria Silva · 01\/11\/2026/)
    const [lote] = await concluir(b, 'c1')
    await comprar(b, 'c3')
    await expect(concluir(b, 'c3', { 'c3-l': 'l-0001' })).rejects.toThrow(/Já existe: L-0001 · .* \(no estoque desde 01\/11\/2026\)/)
    const v = await b.consulta('codigoDisponivel', { tipo: 'lote', codigo: 'L-0001' })
    expect(v).toMatchObject({ livre: false, existe: { id: lote.id, tela: 'lote' } })
    expect((await b.consulta('codigoDisponivel', { tipo: 'lote', codigo: 'X-9' })).livre).toBe(true)
    expect((await b.consulta('codigoDisponivel', { tipo: 'compra', codigo: '' })).sugestao).toBe('P-0003')
    // manual: o digitado entra; vazio = sugestão incremental
    await b.comando('salvarCodigos', { compra: { modo: 'manual' } })
    expect((await comprar(b, 'c4', { codigo: 'HELENA-1' })).codigo).toBe('HELENA-1')
    expect((await comprar(b, 'c5')).codigo).toBe('P-0003')
  })

  it('tipo de código escolhido na compra vale só para ela (e continua único)', async () => {
    const { b } = await novoBackend()
    await pessoas(b)
    // regra = incremental; esta compra pede "por pessoa"
    const sug = await b.consulta('codigoDisponivel', { tipo: 'compra', codigo: '', pessoaId: 'maria', modoCodigo: 'porPessoa' })
    expect(sug.sugestao).toBe('M1')
    expect((await b.consulta('codigoDisponivel', { tipo: 'compra', codigo: '', pessoaId: 'maria' })).sugestao).toBe('P-0001')
    const c1 = await b.comando('criarCompra', { id: 'o1', moduloId: 'cabelo', pessoaId: 'maria', modoCodigo: 'porPessoa', linhas: [linha('o1-l')] })
    expect((await b.consulta('pedido', { id: c1.id })).compra.codigo).toBe('M1')
    // a próxima, sem escolher, volta para a regra
    expect((await comprar(b, 'o2', { pessoaId: 'maria' })).codigo).toBe('P-0001')
    // manual nesta compra: o digitado entra; repetido é recusado
    await b.comando('criarCompra', { id: 'o3', moduloId: 'cabelo', modoCodigo: 'manual', codigo: 'HELENA-7', linhas: [linha('o3-l')] })
    expect((await b.consulta('pedido', { id: 'o3' })).compra.codigo).toBe('HELENA-7')
    await expect(b.comando('criarCompra', { id: 'o4', moduloId: 'cabelo', modoCodigo: 'manual', codigo: 'm1', linhas: [linha('o4-l')] })).rejects.toThrow(/Já existe: compra M1/)
    // regra = por pessoa; esta compra pede incremental (um código digitado é ignorado fora do manual)
    await b.comando('salvarCodigos', { compra: { modo: 'porPessoa' } })
    expect((await b.consulta('codigoDisponivel', { tipo: 'compra', codigo: '', pessoaId: 'celso', modoCodigo: 'incremental' })).sugestao).toBe('P-0002')
    await b.comando('criarCompra', { id: 'o5', moduloId: 'cabelo', pessoaId: 'celso', modoCodigo: 'incremental', codigo: 'X', linhas: [linha('o5-l')] })
    expect((await b.consulta('pedido', { id: 'o5' })).compra.codigo).toBe('P-0002')
    expect((await comprar(b, 'o6', { pessoaId: 'celso' })).codigo).toBe('C1')
    const log = (await b.consulta('logDetalhado', {})).linhas.filter((l) => l.acao === 'criarCompra').map((l) => l.resumo.split(' · ')[0])
    expect(log).toEqual(expect.arrayContaining(['M1', 'P-0001', 'HELENA-7', 'P-0002', 'C1']))
  })

  it('trocar código fica no log (antes → depois) e o antigo continua achando', async () => {
    const { b } = await novoBackend()
    await comprar(b, 'c1')
    const [lote] = await concluir(b, 'c1')
    await comprar(b, 'c2')
    await expect(b.comando('trocarCodigoCompra', { id: 'c1', codigo: 'p-0002' })).rejects.toThrow(/Já existe: compra P-0002/)
    await b.comando('trocarCodigoCompra', { id: 'c1', codigo: 'M1', motivo: 'Padrão novo' })
    await b.comando('trocarCodigoLote', { id: lote.id, codigo: 'M1-1' })
    const log = (await b.consulta('logDetalhado', {})).linhas
    expect(log.find((l) => l.acao === 'trocarCodigoCompra')?.resumo).toBe('P-0001 → M1 · Padrão novo')
    expect(log.find((l) => l.acao === 'trocarCodigoLote')?.resumo).toBe('L-0001 → M1-1')
    const fila = await b.consulta('filaTriagem', { incluirEncerradas: true })
    expect(fila.find((c) => c.id === 'c1')).toMatchObject({ codigo: 'M1', codigosAnteriores: ['P-0001'] })
    expect(fila.find((c) => c.id === 'c1')?.busca).toContain('p-0001')
    const item = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.id === lote.id)!
    expect(item.codigo).toBe('M1-1')
    expect(item.busca).toContain('l-0001')
    expect(item.busca).toContain('p-0001')
    // o código antigo não pode ser dado a outro registro
    expect((await b.consulta('codigoDisponivel', { tipo: 'compra', codigo: 'P-0001' })).existe?.resumo).toMatch(/compra M1 \(antes P-0001\)/)
    expect((await b.consulta('linhaDoTempo', { id: lote.id })).some((e) => e.titulo === 'Código do lote trocado')).toBe(true)
  })

  it('funcionária não muda a regra, as siglas nem os códigos', async () => {
    const { b, sessao } = await novoBackend()
    await pessoas(b)
    await comprar(b, 'c1')
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('salvarCodigos', { compra: { prefixo: '' } })).rejects.toThrow(/permissão/)
    await expect(b.comando('salvarSigla', { pessoaId: 'maria', sigla: 'MS' })).rejects.toThrow(/permissão/)
    await expect(b.comando('trocarCodigoCompra', { id: 'c1', codigo: 'X1' })).rejects.toThrow(/permissão/)
    await expect(b.consulta('codigos', {})).rejects.toThrow(/permissão/)
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin' })
    expect((await b.consulta('pedido', { id: 'c1' })).compra.codigo).toBe('P-0001')
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })
})
