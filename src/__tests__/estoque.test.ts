import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

async function comLotes() {
  const ctx = await novoBackend()
  const { b } = ctx
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }], obs: 'Chegou úmido' })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
  const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
  await b.comando('separarLote', {
    id: 's',
    loteId: bruto.id,
    quantidadeUsada: 10000,
    saidas: [
      { id: 'a', quantidade: 6000, campos: { estado: 'Bruto', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
      { id: 'b', quantidade: 3500, campos: { estado: 'Bruto', comprimento: 40, categoria: 'Normal' } },
    ],
  })
  return { ...ctx, brutoId: bruto.id }
}

describe('estoque: atributos dos lotes', () => {
  it('marcarLotes muda vários lotes de uma vez, com uma linha no log por lote (antes → depois)', async () => {
    const { b } = await comLotes()
    const r = await b.comando('marcarLotes', { ids: ['a', 'b'], campos: { estado: 'Separado', textura: 'Liso' } })
    expect(r.alterados).toEqual(['a', 'b'])
    const lista = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
    expect(lista.map((i) => i.campos.estado)).toEqual(['Separado', 'Separado'])
    expect(lista.every((i) => i.status === 'disponivel' && i.compraId === 'c')).toBe(true)
    const log = (await b.consulta('logDetalhado', { acao: 'marcarLotes' })).linhas
    expect(log).toHaveLength(2)
    expect(log.some((l) => /Situação: Bruto → Separado/.test(l.resumo) && /Textura: — → Liso/.test(l.resumo))).toBe(true)
    // de novo, igual: nada muda e nada vai para o log
    expect((await b.comando('marcarLotes', { ids: ['a'], campos: { estado: 'Separado' } })).alterados).toEqual([])
    await expect(b.comando('marcarLotes', { ids: ['a'], campos: { cor: 'Verde' } })).rejects.toThrow(/lista/)
    await expect(b.comando('marcarLotes', { ids: ['a'], campos: { separacaoId: 'x' } })).rejects.toThrow(/desconhecido/)
  })

  it('editarAtributosLote recalcula o nome e fica no log; a ficha mostra compra, triagem e destino', async () => {
    const { b, brutoId } = await comLotes()
    const r = await b.comando('editarAtributosLote', { id: 'a', campos: { comprimento: 65, cor: 'Castanho' }, motivo: 'Medido de novo' })
    expect(r.nome).toBe('65 cm · Normal · Castanho')
    const log = (await b.consulta('logDetalhado', { acao: 'editarAtributosLote' })).linhas
    expect(log[0].resumo).toMatch(/Medida: 60 → 65/)
    expect(log[0].resumo).toMatch(/Medido de novo/)
    await expect(b.comando('editarAtributosLote', { id: 'a', campos: { comprimento: 65 } })).rejects.toThrow(/Nada mudou/)
    const mae = await b.consulta('fichaItem', { id: brutoId })
    expect(mae.entrada?.obs).toBe('Chegou úmido')
    expect(mae.separacoes[0].perda).toBe(500)
    expect(mae.separacoes[0].partes.map((p) => p.id).sort()).toEqual(['a', 'b'])
    expect(mae.fluxo).toMatchObject({ inicial: 10000, separado: 9500, perda: 500, saldo: 0 })
    const filho = await b.consulta('fichaItem', { id: 'a' })
    expect(filho.pai?.id).toBe(brutoId)
    expect(filho.irmaos.map((i) => i.id)).toEqual(['b'])
    expect(filho.entrada?.id).toBe('c')
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })

  it('marcarEtiquetasImpressas: guarda quando e quem; o filtro "sem etiqueta" só mostra os que nunca saíram', async () => {
    const { b, sessao } = await comLotes()
    Object.assign(sessao, { nome: 'Paula' })
    const sem = async () => (await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true, etiqueta: 'sem' })).map((i) => i.id).sort()
    expect(await sem()).toEqual(['a', 'b'])
    const r = await b.comando('marcarEtiquetasImpressas', { ids: ['a', 'a'] })
    expect(r.marcados).toEqual(['a'])
    expect(await sem()).toEqual(['b'])
    const impressas = await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true, etiqueta: 'impressa' })
    expect(impressas.map((i) => [i.id, i.etiquetaImpressaPor, !!i.etiquetaImpressaEm])).toEqual([['a', 'Paula', true]])
    expect((await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true, etiqueta: 'todas' })).length).toBe(2)
    // reimprimir atualiza a data e fica no log (uma linha por lote)
    const antes = impressas[0].etiquetaImpressaEm!
    await b.comando('marcarEtiquetasImpressas', { ids: ['a', 'b'] })
    expect(await sem()).toEqual([])
    expect((await b.consulta('fichaItem', { id: 'a' })).item.etiquetaImpressaEm! > antes).toBe(true)
    const log = (await b.consulta('logDetalhado', { acao: 'marcarEtiquetasImpressas' })).linhas
    expect(log).toHaveLength(3)
    expect(log.some((l) => /impressa de novo/.test(l.resumo))).toBe(true)
    await expect(b.comando('marcarEtiquetasImpressas', { ids: [] })).rejects.toThrow(/pelo menos um/)
    await expect(b.comando('marcarEtiquetasImpressas', { ids: ['nada'] })).rejects.toThrow(/não encontrado/)
    // funcionária não marca
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('marcarEtiquetasImpressas', { ids: ['a'] })).rejects.toThrow(/permissão/)
  })

  it('refazerEtiqueta: cancela a antiga com motivo, nova via (mesmo código), volta para "sem etiqueta" e fica no histórico', async () => {
    const { b, sessao } = await comLotes()
    Object.assign(sessao, { nome: 'Paula' })
    await b.comando('marcarEtiquetasImpressas', { ids: ['a'] })
    const codigo = (await b.consulta('fichaItem', { id: 'a' })).item.codigo
    const r = await b.comando('refazerEtiqueta', { id: 'a', motivo: 'Saiu errada' })
    expect(r.via).toBe(2)
    const item = (await b.consulta('fichaItem', { id: 'a' })).item
    expect(item).toMatchObject({ codigo, etiquetaVia: 2, etiquetaImpressaEm: undefined, etiquetaCancelada: { motivo: 'Saiu errada', porNome: 'Paula', via: 1 } })
    expect((await b.consulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true, etiqueta: 'sem' })).map((i) => i.id)).toContain('a')
    // a etiqueta nova mostra "2ª via"; o código (QR/barras) é o mesmo
    const [e] = await b.consulta('etiquetas', { ids: ['a'] })
    expect([e.codigo, e.via]).toEqual([codigo, 2])
    expect((await b.consulta('etiquetas', { ids: ['b'] }))[0].via).toBeUndefined()
    // histórico: log e histórico do pacote
    const log = (await b.consulta('logDetalhado', { acao: 'refazerEtiqueta' })).linhas
    expect(log[0].resumo).toMatch(/etiqueta cancelada \(Saiu errada\) · nova 2ª via gerada/)
    const hist = await b.consulta('historicoPacote', { itemId: 'a' })
    expect(hist.dias.flatMap((d) => d.movs).some((m) => /etiqueta cancelada/.test(m.descricao ?? ''))).toBe(true)
    // imprimiu a nova → impressa de novo; outra vez → 3ª via
    await b.comando('marcarEtiquetasImpressas', { ids: ['a'] })
    expect((await b.consulta('fichaItem', { id: 'a' })).item.etiquetaImpressaEm).toBeTruthy()
    expect((await b.comando('refazerEtiqueta', { id: 'a', motivo: 'Perdeu' })).via).toBe(3)
    await expect(b.comando('refazerEtiqueta', { id: 'a', motivo: '  ' })).rejects.toThrow(/por que/)
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('refazerEtiqueta', { id: 'a', motivo: 'Perdeu' })).rejects.toThrow(/permissão/)
  })

  it('funcionária não muda atributos', async () => {
    const { b, sessao } = await comLotes()
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('marcarLotes', { ids: ['a'], campos: { estado: 'Separado' } })).rejects.toThrow(/permissão/)
    await expect(b.comando('editarAtributosLote', { id: 'a', campos: { cor: 'Loiro' } })).rejects.toThrow(/permissão/)
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin' })
    expect((await b.consulta('fichaItem', { id: 'a' })).item.campos.cor).toBe('Preto')
  })
})
