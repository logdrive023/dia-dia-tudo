// MINHA VITRINE: só o que está pronto (separado, com etiqueta, com saldo, sem reserva); o comprador (sem login) vê só
// dados públicos — nada de custo, fornecedor ou compra; escondidos e vitrine desligada respeitados.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('minha vitrine', () => {
  it('lista só o que está pronto e mostra ao comprador só o público', async () => {
    const { b, sessao } = await novoBackend('2026-11-05')
    await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora Secreta', papeis: ['fornecedor'] } as any)
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'cl', quantidade: 3000, moeda: 'BOB', total: bs(30000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc', forma: 'qr', moeda: 'BOB', valor: bs(30000) }] } as any)
    const bruto = (await (b as any).repos.transacoes.obter('c')).linhas[0].itemId
    await b.comando('separarLote', { id: 's', loteId: bruto, quantidadeUsada: 3000, saidas: [
      { id: 'A', quantidade: 1000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
      { id: 'B', quantidade: 1000, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal', cor: 'Castanho' } },
      { id: 'C', quantidade: 1000, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal', cor: 'Castanho' } },
    ] } as any)
    await b.comando('marcarEtiquetasImpressas', { ids: ['A', 'B'] } as any) // C sem etiqueta: não está pronto
    await b.comando('salvarTabelaPreco', { id: 'tg', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama', linhas: [50, 60], colunas: [{ id: 'venda', nome: 'Venda' }], valores: { '60|venda': '17,5', '50|venda': '8' } } as any)
    await b.comando('salvarConfig', { vitrine: { ativa: true, nome: 'Cabelos da Família', whatsapp: '+591 7000-0000', mostrarPreco: true, ocultos: ['B'] } } as never)
    // admin: vê os prontos, com o escondido marcado
    const adm = (await b.consulta('vitrine', {})) as any
    expect(adm.pacotes.map((x: any) => x.id).sort()).toEqual(['A', 'B'])
    expect(adm.pacotes.find((x: any) => x.id === 'B').oculto).toBe(true)
    expect(adm.loja.whatsapp).toBe('+59170000000')
    // comprador sem login: só A, preço por grama, nada de custo/fornecedor/compra
    Object.assign(sessao, { usuarioId: '', perfil: undefined, nome: '' })
    const pub = (await b.consulta('vitrine', { publico: true })) as any
    expect(pub.pacotes.map((x: any) => x.id)).toEqual(['A'])
    expect(pub.pacotes[0].preco).toEqual({ fator: '17,5', moeda: 'BOB' })
    expect(pub.pacotes[0].oculto).toBeUndefined()
    const texto = JSON.stringify(pub)
    for (const proibido of ['Fornecedora', 'custo', 'compra', '"c"']) expect(texto).not.toContain(proibido)
    expect(pub.loja.nome).toBe('Cabelos da Família')
  })

  it('vitrine desligada: o comprador não vê nada; WhatsApp inválido é recusado', async () => {
    const { b, sessao } = await novoBackend('2026-11-05')
    await b.comando('salvarConfig', { vitrine: { ativa: false, mostrarPreco: false, ocultos: [] } } as never)
    await expect(b.comando('salvarConfig', { vitrine: { ativa: true, mostrarPreco: true, ocultos: [], whatsapp: '123' } } as never)).rejects.toThrow(/código do país/)
    Object.assign(sessao, { usuarioId: '', perfil: undefined, nome: '' })
    expect(((await b.consulta('vitrine', { publico: true })) as any).pacotes).toEqual([])
  })
})
