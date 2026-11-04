// LIGAR COMPRA A VIAGEM A QUALQUER MOMENTO: esqueceu de ligar na hora e a viagem já foi encerrada → liga mesmo assim
// (não trava a operação); o registro diz que estava encerrada. E as viagens do filtro vêm com o "tempo" (a cor):
// vigente · encerrada há pouco (até 30 dias) · encerrada faz tempo.
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('ligar compra a viagem encerrada', () => {
  it('liga, registra que já estava encerrada e o filtro mostra o tempo', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p', nome: 'P', papeis: ['funcionario'] })
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', viajantes: ['p'], inicio: r.hoje })
    await b.comando('salvarViagem', { id: 'vg2', nome: 'Aberta', viajantes: ['p'], inicio: r.hoje })
    await b.comando('encerrarViagem', { viagemId: 'vg', contado: {} })
    r.avancar(5)
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 1000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }] })

    // filtro: a aberta é vigente; a encerrada há 5 dias é recente
    let vs = await b.consulta('viagensParaFiltro', {})
    expect(vs.find((v) => v.id === 'vg2')).toMatchObject({ tempo: 'vigente', diasEncerrada: undefined })
    expect(vs.find((v) => v.id === 'vg')).toMatchObject({ tempo: 'recente', diasEncerrada: 5 })

    // liga na encerrada: vale, e o registro diz
    await b.comando('vincularCompras', { viagemId: 'vg', compraIds: ['c1'] })
    expect((await b.consulta('pedido', { id: 'c1' })).viagem?.id).toBe('vg')
    const log = (await b.consulta('logDetalhado', { acao: 'vincularCompras' })).linhas
    expect(log.some((x: { resumo?: string }) => /já encerrada há 5 dia/.test(x.resumo ?? ''))).toBe(true)

    // 40 dias depois: encerrada faz tempo
    r.avancar(40)
    vs = await b.consulta('viagensParaFiltro', {})
    expect(vs.find((v) => v.id === 'vg')).toMatchObject({ tempo: 'antiga', diasEncerrada: 45 })
  })
})
