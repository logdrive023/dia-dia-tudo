// METAS DO MÊS: realizado por pessoa/unidade/empresa; o que a funcionária vê (só as dela, com ou sem valor).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('metas do mês', () => {
  it('calcula o realizado e respeita o que cada um pode ver', async () => {
    const { b, sessao } = await novoBackend('2026-11-10')
    const admin = { ...sessao }
    await b.comando('salvarLocal', { id: 'centro', nome: 'Centro', tipo: 'salao' } as any)
    await b.comando('salvarPessoa', { id: 'p-s', nome: 'Sofia', papeis: ['funcionario', 'profissional'], localId: 'centro' } as any)
    await b.comando('salvarPessoa', { id: 'p-l', nome: 'Lia', papeis: ['funcionario', 'profissional'], localId: 'centro' } as any)
    await b.comando('salvarUsuario', { id: 'u-s', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', pessoaId: 'p-s', localId: 'centro', senha: 'Sofia2026!' } as any)
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] } as any)
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', precoSugerido: { moeda: 'BOB', valor: bs(100) } } as any)
    const atender = (id: string, prof: string, valor: number) => b.comando('concluirVenda', { id, pessoaId: 'cli', localId: 'centro', profissionalId: prof, linhas: [{ id: id + 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(valor), profissionalId: prof }], pagamentos: [{ id: 'p' + id, forma: 'dinheiro', moeda: 'BOB', valor: bs(valor) }] } as any)
    await atender('a1', 'p-s', 300)
    await atender('a2', 'p-s', 450)
    await atender('a3', 'p-l', 200)
    await b.comando('salvarConfig', { metas: { painel: true, mostrarValor: true, funcionaria: true, funcionariaValor: false, itens: [
      { id: 'm-sofia', alvo: 'pessoa', alvoId: 'p-s', indicador: 'faturamento', valor: bs(1000), ativa: true },
      { id: 'm-sofia-at', alvo: 'pessoa', alvoId: 'p-s', indicador: 'atendimentos', valor: 4, ativa: true },
      { id: 'm-centro', alvo: 'unidade', alvoId: 'centro', indicador: 'vendas', valor: 10, ativa: true },
      { id: 'm-lia', alvo: 'pessoa', alvoId: 'p-l', indicador: 'faturamento', valor: bs(500), ativa: true },
      { id: 'm-off', alvo: 'empresa', indicador: 'vendas', valor: 5, ativa: false },
    ] } } as never)
    const r = (await b.consulta('metas', {})) as any
    const m = (id: string) => r.metas.find((x: any) => x.id === id)
    expect(m('m-sofia').realizado).toBe(bs(750))
    expect(m('m-sofia').pctBp).toBe(7500)
    expect(m('m-sofia').falta).toBe(bs(250))
    expect(m('m-sofia-at').realizado).toBe(2)
    expect(m('m-centro').realizado).toBe(3)
    expect(m('m-off')).toBeUndefined() // desligada não aparece
    // a funcionária: só as dela e da unidade dela, sem o valor (só a %)
    Object.assign(sessao, await b.entrar('sofia', 'Sofia2026!'))
    const f = (await b.consulta('metas', {})) as any
    expect(f.metas.map((x: any) => x.id).sort()).toEqual(['m-centro', 'm-sofia', 'm-sofia-at'])
    expect(f.metas.find((x: any) => x.id === 'm-sofia').valor).toBeUndefined()
    expect(f.metas.find((x: any) => x.id === 'm-sofia').pctBp).toBe(7500)
    // o admin desliga para a funcionária: ela não vê nada
    Object.assign(sessao, admin)
    const c = (await b.consulta('configuracoes', {})).config as any
    await b.comando('salvarConfig', { metas: { ...c.metas, funcionaria: false } } as never)
    Object.assign(sessao, await b.entrar('sofia', 'Sofia2026!'))
    expect(((await b.consulta('metas', {})) as any).metas).toEqual([])
    Object.assign(sessao, admin)
    await expect(b.comando('salvarConfig', { metas: { ...c.metas, itens: [{ id: 'x', alvo: 'pessoa', indicador: 'vendas', valor: 3, ativa: true }] } } as never)).rejects.toThrow(/escolha a pessoa/)
  })
})
