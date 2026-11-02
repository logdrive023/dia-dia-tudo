import { describe, expect, it } from 'vitest'
import { memoriaCalculo, resolverComissao } from '../core/domain/comissao'
import { bs, novoBackend } from './ajuda'

const pagar = (id: string, valor: number) => [{ id, forma: 'dinheiro', moeda: 'BOB', valor: bs(valor) }]

async function salao() {
  const ctx = await novoBackend('2026-11-01')
  const { b } = ctx
  await b.comando('salvarPessoa', { id: 'ana', nome: 'Ana', papeis: ['profissional'] })
  await b.comando('salvarPessoa', { id: 'bia', nome: 'Bia', papeis: ['profissional'], comissaoBp: 4000 })
  await b.comando('salvarPessoa', { id: 'f1', nome: 'Funcionária 1', papeis: ['funcionario', 'profissional'], acesso: 'funcionario' })
  await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte', precoSugerido: { moeda: 'BOB', valor: bs(80) } })
  await b.comando('salvarItem', {
    id: 'tintura',
    moduloId: 'salao',
    tipoItem: 'servico',
    nome: 'Tintura',
    precoSugerido: { moeda: 'BOB', valor: bs(300) },
    insumo: { moeda: 'BOB', valor: 0, itens: [{ nome: 'Tinta', valor: bs(15) }, { nome: 'Água oxigenada', valor: bs(5) }] },
  })
  return ctx
}

const linha = async (b: Awaited<ReturnType<typeof salao>>['b'], vendaId: string) => (await b.consulta('venda', { id: vendaId })).venda.linhas[0]

describe('comissão do salão: 50/50 e insumos antes da divisão', () => {
  it('serviço comum sem regra: 50% salão + 50% profissional (padrão global)', async () => {
    const { b } = await salao()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) }], pagamentos: pagar('p', 80) })
    const l = await linha(b, 'v')
    expect(l.comissaoBp).toBe(5000)
    expect(l.comissaoRegra).toBe('padrao')
    expect(l.comissaoPrincipal).toBe(bs(40))
    expect(l.parteSalao).toBe(bs(40))
  })

  it('Tintura Bs 300 − insumos Bs 20 = base 280 → 140 salão / 140 profissional', async () => {
    const { b } = await salao()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: pagar('p', 300) })
    const l = await linha(b, 'v')
    expect(l.insumoPrincipal).toBe(bs(20))
    expect(l.insumos).toEqual([{ nome: 'Tinta', valorPrincipal: bs(15) }, { nome: 'Água oxigenada', valorPrincipal: bs(5) }])
    expect(l.baseComissao).toBe(bs(280))
    expect(l.comissaoPrincipal).toBe(bs(140))
    expect(l.parteSalao).toBe(bs(140))
    expect(memoriaCalculo(l, 'BOB')).toBe('Valor Bs 300,00 − Insumos Bs 20,00 (Tinta Bs 15,00 + Água oxigenada Bs 5,00) = Base Bs 280,00 → Salão Bs 140,00 · Profissional Bs 140,00 (50%, padrão)')
    // extrato da profissional mostra a mesma base
    const c = await b.consulta('comissoes', { pessoaId: 'ana' })
    const g = c.extrato.find((x) => x.tipo === 'ganho')!
    expect(g.tipo === 'ganho' && g.base).toBe(bs(280))
    expect(g.tipo === 'ganho' && g.insumo).toBe(bs(20))
    expect(c.porPessoa[0].aPagar).toBe(bs(140))
  })

  it('precedência: linha > serviço > profissional > padrão', async () => {
    expect(resolverComissao({ profissional: true, servico: true, linhaBp: 3000, servicoBp: 6000, profissionalBp: 4000 })).toEqual({ bp: 3000, regra: 'linha' })
    expect(resolverComissao({ profissional: true, servico: true, servicoBp: 6000, profissionalBp: 4000 })).toEqual({ bp: 6000, regra: 'servico' })
    expect(resolverComissao({ profissional: true, servico: true, profissionalBp: 4000 })).toEqual({ bp: 4000, regra: 'profissional' })
    expect(resolverComissao({ profissional: true, servico: true, padraoBp: 5000 })).toEqual({ bp: 5000, regra: 'padrao' })
    expect(resolverComissao({ profissional: true, servico: false })).toBeUndefined()
    expect(resolverComissao({ profissional: false, servico: true })).toBeUndefined()
  })

  it('% própria do serviço vale mais que a da profissional; padrão global configurável', async () => {
    const { b } = await salao()
    await b.comando('salvarItem', { id: 'tintura', moduloId: 'salao', tipoItem: 'servico', nome: 'Tintura', precoSugerido: { moeda: 'BOB', valor: bs(300) }, comissaoBp: 6000 })
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'bia', linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: pagar('p', 300) })
    const l = await linha(b, 'v')
    // insumos mantidos (edição sem "insumo" não apaga), 60% da base 280
    expect(l.insumoPrincipal).toBe(bs(20))
    expect(l.comissaoRegra).toBe('servico')
    expect(l.comissaoPrincipal).toBe(bs(168))
    // Bia (40%) no corte sem regra: vale a dela
    await b.comando('concluirVenda', { id: 'v2', profissionalId: 'bia', linhas: [{ id: 'l2', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) }], pagamentos: pagar('p2', 80) })
    expect((await linha(b, 'v2')).comissaoPrincipal).toBe(bs(32))
    // padrão global 30%
    await b.comando('salvarConfig', { comissaoPadraoBp: 3000 })
    await b.comando('concluirVenda', { id: 'v3', profissionalId: 'ana', linhas: [{ id: 'l3', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) }], pagamentos: pagar('p3', 80) })
    expect((await linha(b, 'v3')).comissaoPrincipal).toBe(bs(24))
  })

  it('ajuste no atendimento: insumo extra com motivo, % na linha (admin) e preço abaixo do catálogo com motivo no log', async () => {
    const { b } = await salao()
    await expect(
      b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(300), insumo: { moeda: 'BOB', itens: [{ nome: 'Tinta', valor: bs(25) }, { nome: 'Água oxigenada', valor: bs(5) }] } }], pagamentos: pagar('p', 300) }),
    ).rejects.toThrow(/motivo/)
    await b.comando('concluirVenda', {
      id: 'v',
      profissionalId: 'ana',
      linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(280), motivoPreco: 'Cliente fiel', comissaoBp: 4000, insumo: { moeda: 'BOB', itens: [{ nome: 'Tinta', valor: bs(25) }, { nome: 'Água oxigenada', valor: bs(5) }], motivo: 'Cabelo longo: tinta extra' } }],
      pagamentos: pagar('p', 280),
    })
    const l = await linha(b, 'v')
    expect(l.insumoPrincipal).toBe(bs(30))
    expect(l.insumoMotivo).toBe('Cabelo longo: tinta extra')
    expect(l.baseComissao).toBe(bs(250))
    expect(l.comissaoRegra).toBe('linha')
    expect(l.comissaoPrincipal).toBe(bs(100))
    expect(l.precoCatalogo).toBe(bs(300))
    expect(l.motivoPreco).toBe('Cliente fiel')
    const log = await b.consulta('logDetalhado', {})
    expect(log.linhas.some((x) => x.acao === 'precoAlterado' && x.resumo.includes('Cliente fiel'))).toBe(true)
    expect(log.linhas.some((x) => x.acao === 'insumoAjustado')).toBe(true)
  })

  it('funcionária: põe insumo a mais, mas não baixa do catálogo nem muda %; preço menor só com motivo', async () => {
    const { b, sessao } = await salao()
    Object.assign(sessao, { usuarioId: 'f1', pessoaId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    const venda = (id: string, extra: object, total = 300) =>
      b.comando('concluirVenda', { id, profissionalId: 'f1', linhas: [{ id: `${id}-l`, itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(total), ...extra }], pagamentos: pagar(`${id}-p`, total) })
    await expect(venda('a', { insumo: { moeda: 'BOB', itens: [{ nome: 'Tinta', valor: bs(10) }], motivo: 'sobrou' } })).rejects.toThrow(/administrador/)
    await expect(venda('b', {}, 250)).rejects.toThrow(/motivo/)
    await venda('c', { comissaoBp: 9000, insumo: { moeda: 'BOB', itens: [{ nome: 'Tinta', valor: bs(15) }, { nome: 'Água oxigenada', valor: bs(5) }, { nome: 'Matizador', valor: bs(10) }], motivo: 'Matizador' } })
    const l = await linha(b, 'c')
    expect(l.comissaoBp).toBe(5000)
    expect(l.insumoPrincipal).toBe(bs(30))
    expect(l.comissaoPrincipal).toBe(bs(135))
    await venda('d', { motivoPreco: 'Promoção do dia' }, 250)
    expect((await linha(b, 'd')).motivoPreco).toBe('Promoção do dia')
    // com a configuração ligada, a funcionária muda o %
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin', pessoaId: undefined })
    await b.comando('salvarConfig', { comissaoFuncionarioMuda: true })
    Object.assign(sessao, { usuarioId: 'f1', pessoaId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await venda('e', { comissaoBp: 6000 })
    expect((await linha(b, 'e')).comissaoBp).toBe(6000)
  })

  it('corrigir venda recalcula base, comissão e salão com o % guardado; histórico fica', async () => {
    const { b } = await salao()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: pagar('p', 300) })
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', total: bs(320), insumo: { moeda: 'BOB', itens: [{ nome: 'Tinta', valor: bs(30) }] } }], motivo: 'Usou mais tinta', diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    const v = (await b.consulta('venda', { id: 'v' })).venda
    const l = v.linhas[0]
    expect(l.insumoPrincipal).toBe(bs(30))
    expect(l.baseComissao).toBe(bs(290))
    expect(l.comissaoPrincipal).toBe(bs(145))
    expect(l.parteSalao).toBe(bs(145))
    const h = v.historico.find((x) => x.tipo === 'correcao')!
    expect(h.ajustes!.some((a) => a.includes('insumos'))).toBe(true)
    // só o % muda (administrador)
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', comissaoBp: 4000 }], motivo: 'Combinado 40%' })
    const l2 = (await linha(b, 'v'))
    expect(l2.comissaoPrincipal).toBe(bs(116))
    expect(l2.comissaoRegra).toBe('linha')
  })

  it('mudar o catálogo depois não altera vendas passadas nem a comissão já ganha', async () => {
    const { b } = await salao()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: pagar('p', 300) })
    await b.comando('salvarItem', { id: 'tintura', moduloId: 'salao', tipoItem: 'servico', nome: 'Tintura', precoSugerido: { moeda: 'BOB', valor: bs(350) }, comissaoBp: 3000, insumo: { moeda: 'BOB', valor: bs(50) } })
    await b.comando('salvarConfig', { comissaoPadraoBp: 2000 })
    const l = await linha(b, 'v')
    expect(l.insumoPrincipal).toBe(bs(20))
    expect(l.comissaoPrincipal).toBe(bs(140))
    expect((await b.consulta('comissoes', { pessoaId: 'ana' })).porPessoa[0].ganhoTotal).toBe(bs(140))
    // corrigir só a quantidade/valor também usa o % e os insumos guardados
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', total: bs(320) }], motivo: 'Valor certo', diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    expect((await linha(b, 'v')).comissaoPrincipal).toBe(bs(150))
  })

  it('DRE e relatório: insumos são custo da venda; lucro = receita − insumos − comissão', async () => {
    const { b } = await salao()
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'ana', linhas: [{ id: 'l', itemId: 'tintura', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: pagar('p', 300) })
    const d = await b.consulta('dre', { de: '2026-11-01', ate: '2026-11-01' })
    expect(d.insumos).toBe(bs(20))
    expect(d.comissoes).toBe(bs(140))
    expect(d.lucroBruto).toBe(bs(140))
    expect(d.linhas.some((x) => x.conta === '(−) Insumos dos serviços' && x.valor === -bs(20))).toBe(true)
    expect((await b.consulta('vendas', {}))[0].lucroPrincipal).toBe(bs(140))
    const r = await b.consulta('servicosReceitaInsumos', { de: '2026-11-01', ate: '2026-11-01' })
    expect(r.porServico[0]).toMatchObject({ nome: 'Tintura', receita: bs(300), insumos: bs(20), comissao: bs(140), margem: bs(140) })
  })
})

describe('catálogo do salão', () => {
  it('biblioteca padrão: cria os serviços comuns uma vez só (Tintura com insumos)', async () => {
    const { b } = await novoBackend()
    const r = await b.comando('restaurarBibliotecaServicos', {})
    expect(r.criados).toContain('Tintura')
    const cat = await b.consulta('catalogo', { moduloId: 'salao' })
    for (const n of ['Corte', 'Escova', 'Tintura', 'Mechas/Luzes', 'Descoloração', 'Hidratação', 'Depilação', 'Unha (mão)', 'Unha (pé)', 'Maquiagem', 'Penteado', 'Barba'])
      expect(cat.some((i) => i.nome === n)).toBe(true)
    expect(cat.find((i) => i.nome === 'Tintura')!.insumo!.valor).toBe(bs(20))
    expect((await b.comando('restaurarBibliotecaServicos', {})).criados).toEqual([])
  })

  it('serviço novo na hora: funcionária cria (catálogo, marcado para revisar) ou só para o atendimento; nome repetido é recusado', async () => {
    const { b, sessao } = await salao()
    Object.assign(sessao, { usuarioId: 'f1', pessoaId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await expect(b.comando('criarServicoRapido', { id: 'x', nome: ' corte ', preco: { moeda: 'BOB', valor: bs(90) }, guardar: true })).rejects.toThrow(/Já existe: Corte/)
    await b.comando('criarServicoRapido', { id: 'botox', nome: 'Botox capilar', preco: { moeda: 'BOB', valor: bs(400) }, insumo: { moeda: 'BOB', valor: bs(60) }, comissaoBp: 9000, categoria: 'Tratamento', guardar: true })
    await b.comando('criarServicoRapido', { id: 'tranca', nome: 'Trança especial', preco: { moeda: 'BOB', valor: bs(120) }, guardar: false })
    const cat = await b.consulta('catalogo', { moduloId: 'salao' })
    const botox = cat.find((i) => i.id === 'botox')!
    expect(botox.campos.criadoPorNome).toBe('Funcionária 1')
    expect(botox.campos.revisar).toBe(true)
    expect(botox.comissaoBp).toBeUndefined()
    expect(cat.some((i) => i.id === 'tranca')).toBe(false)
    await b.comando('concluirVenda', {
      id: 'v',
      profissionalId: 'f1',
      linhas: [
        { id: 'l1', itemId: 'botox', quantidade: 1, moeda: 'BOB', total: bs(400) },
        { id: 'l2', itemId: 'tranca', quantidade: 1, moeda: 'BOB', total: bs(120) },
      ],
      pagamentos: pagar('p', 520),
    })
    const v = (await b.consulta('venda', { id: 'v' })).venda
    expect(v.linhas[0].comissaoPrincipal).toBe(bs(170))
    expect(v.linhas[1].descricao).toBe('Trança especial')
    expect(v.linhas[1].comissaoPrincipal).toBe(bs(60))
  })
})
