// QR SEGURO DA ETIQUETA: o QR leva um código ALEATÓRIO (…#/q/<código>), nunca o id, a data, a medida ou a cor.
// Sem login não abre nada; reimprimir troca o código (o antigo para de abrir); etiquetas antigas (…#/lotes/<id>)
// continuam funcionando para quem entrou; o caixa acha o pacote pelos dois.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { hashParaNav, navParaHash } from '../app/rotas'
import { enderecoDoQr, lerEnderecoQr } from '../ui/etiquetas'
import { acharPorCodigo } from '../ui/leitorPistola'
import { bs, novoBackend } from './ajuda'

async function cenario() {
  const { b, sessao } = await novoBackend('2026-11-05')
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
  await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'cl', quantidade: 1000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc', forma: 'qr', moeda: 'BOB', valor: bs(1000) }] } as any)
  await b.comando('separarLote', { id: 's', loteId: (await (b as any).repos.transacoes.obter('c')).linhas[0].itemId, quantidadeUsada: 1000, saidas: [{ id: 'lote-60-preto', quantidade: 1000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } }] } as any)
  return { b, sessao }
}

describe('QR seguro da etiqueta', () => {
  it('código aleatório (sem id/medida/cor), abre só logado, reimprimir invalida o antigo', async () => {
    const { b, sessao } = await cenario()
    expect(((await b.consulta('etiquetas', { ids: ['lote-60-preto'] })) as any[])[0].qr).toBeUndefined()
    await b.comando('prepararQrEtiquetas', { ids: ['lote-60-preto'] } as any)
    const qr1 = ((await b.consulta('etiquetas', { ids: ['lote-60-preto'] })) as any[])[0].qr as string
    expect(qr1).toMatch(/^[A-Za-z0-9]{16}$/)
    const url = enderecoDoQr(qr1)
    for (const vaza of ['lote', '60', 'preto', 'Preto']) expect(url.split('#')[1]).not.toContain(vaza)
    // preparar de novo não troca (a etiqueta que já está no pacote continua valendo)
    await b.comando('prepararQrEtiquetas', { ids: ['lote-60-preto'] } as any)
    expect(((await b.consulta('etiquetas', { ids: ['lote-60-preto'] })) as any[])[0].qr).toBe(qr1)
    // logado: o QR abre o pacote; a leitura do caixa também acha
    expect(await b.consulta('pacoteDoQr', { codigo: qr1 })).toEqual({ id: 'lote-60-preto' })
    expect(((await b.consulta('lerCodigoPacote', { texto: url })) as any).item.id).toBe('lote-60-preto')
    // reimprimir (nova via): o código troca e o antigo não abre mais nada
    await b.comando('refazerEtiqueta', { id: 'lote-60-preto', motivo: 'etiqueta molhou' } as any)
    const qr2 = ((await b.consulta('etiquetas', { ids: ['lote-60-preto'] })) as any[])[0].qr
    expect(qr2).not.toBe(qr1)
    await expect(b.consulta('pacoteDoQr', { codigo: qr1 })).rejects.toThrow(/antiga ou inválida/)
    expect(((await b.consulta('lerCodigoPacote', { texto: url })) as any).situacao).toBe('naoExiste')
    // sem login: nada
    Object.assign(sessao, { usuarioId: '', perfil: undefined, nome: '' })
    await expect(b.consulta('pacoteDoQr', { codigo: qr2 })).rejects.toThrow()
    await expect(b.consulta('lerCodigoPacote', { texto: enderecoDoQr(qr2) })).rejects.toThrow()
  })

  it('o caixa acha o pacote pelo QR novo e pelo antigo; a rota #/q/<código> abre a tela do QR', () => {
    const pacotes = [{ id: 'L1', codigo: 'L-0001', qr: 'AbCdEfGhJk23mnPq' }, { id: 'L2', codigo: 'L-0002' }]
    expect(acharPorCodigo(pacotes, 'https://x/app/#/q/AbCdEfGhJk23mnPq')?.id).toBe('L1')
    expect(acharPorCodigo(pacotes, 'https://x/app/#/lotes/L2')?.id).toBe('L2')
    expect(acharPorCodigo(pacotes, 'L-0002')?.id).toBe('L2')
    expect(acharPorCodigo(pacotes, 'https://x/app/#/q/CodigoQueNaoExiste9')).toBeUndefined()
    expect(lerEnderecoQr('https://x/#/q/AbCdEfGhJk23mnPq')).toEqual({ qr: 'AbCdEfGhJk23mnPq' })
    expect(hashParaNav('#/q/AbCdEfGhJk23mnPq')).toEqual({ tela: 'qr', params: { id: 'AbCdEfGhJk23mnPq' } })
    expect(navParaHash({ tela: 'qr', params: { id: 'AbCdEfGhJk23mnPq' } })).toBe('#/q/AbCdEfGhJk23mnPq')
  })
})
