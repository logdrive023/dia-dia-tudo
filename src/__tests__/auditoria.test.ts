// AUDITORIA: tela própria do administrador com o log bruto — quem, quando, a ação, a área, as referências (o registro
// afetado e os ligados) e as tentativas recusadas. A funcionária não vê.
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { SENHA_DEMO, carregarDemo } from '../adapters/demo'
import { criarBackend } from '../app/criarBackend'

describe('auditoria (só administrador)', () => {
  it('lista o log com área e referências, filtra, abre o detalhe e a funcionária é recusada', async () => {
    const { backend, sessao } = criarBackend({ tipo: 'memory' })
    const b = backend as BackendNoAparelho
    await carregarDemo(b)
    Object.assign(sessao, await b.entrar('admin', SENHA_DEMO))
    const tudo = await b.consulta('auditoria', {})
    expect(tudo.total).toBeGreaterThan(10)
    // toda venda concluída aparece em "Vendas e agenda" com a referência da venda
    const vendas = await b.consulta('auditoria', { acao: 'concluirVenda' })
    expect(vendas.linhas.length).toBeGreaterThan(0)
    expect(vendas.linhas.every((l) => l.categoria === 'venda')).toBe(true)
    expect(vendas.linhas[0].refs.some((r) => r.tipo === 'venda' && r.tela === 'venda')).toBe(true)
    // as contagens por área batem com o total
    expect(tudo.categorias.reduce((s, c) => s + c.n, 0)).toBe(tudo.total)
    // filtra pela área e pelo usuário
    const compras = await b.consulta('auditoria', { categoria: 'compra' })
    expect(compras.linhas.every((l) => l.categoria === 'compra')).toBe(true)
    const quem = tudo.usuarios[0]
    expect((await b.consulta('auditoria', { usuarioId: quem.id })).total).toBe(quem.n)
    // o detalhe: o registro cru, as referências e as outras ações sobre o mesmo registro
    const d = await b.consulta('registroAuditoria', { id: vendas.linhas[0].id })
    expect(d.bruto.id).toBe(vendas.linhas[0].id)
    expect(d.registro.nomeAcao).toBeTruthy()
    // o filtro "Quem" traz TODOS os usuários cadastrados (até quem não agiu no período), e "Quem agiu" conta só quem agiu
    const cadastrados = await b.consulta('usuarios', {})
    for (const u of cadastrados) expect(tudo.usuarios.some((x) => x.id === u.id)).toBe(true)
    const umDia = await b.consulta('auditoria', { de: '2000-01-01', ate: '2000-01-01' })
    expect(umDia.usuarios.filter((x) => x.perfil).length).toBe(cadastrados.length)
    expect(umDia.usuarios.every((x) => x.n === 0)).toBe(true)
    expect(umDia.agiram).toBe(0)
    expect(tudo.agiram).toBe(tudo.usuarios.filter((x) => x.n > 0).length)
    // a funcionária não vê nada disso
    Object.assign(sessao, await b.entrar('sofia', SENHA_DEMO))
    await expect(b.consulta('auditoria', {})).rejects.toThrow(/permissão/)
    await expect(b.consulta('registroAuditoria', { id: d.bruto.id })).rejects.toThrow(/permissão/)
  })
})
