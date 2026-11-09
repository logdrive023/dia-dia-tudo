// DIVISÃO INTERNA DA VENDA: valores de cada parte e o atalho para o lugar exato onde a comissão foi definida.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Linha } from '../../../core/domain/tipos'
import { Ctx, type AppCtx } from '../../../shared/ui/contexto'
import { novoBackend } from '../../../__tests__/ajuda'
import { DivisaoInterna } from '../components/DivisaoInterna'
import { origemComissao, partesDaLinha } from '../model/divisao'

afterEach(cleanup)

const linha = (extra: Partial<Linha>): Linha => ({ id: 'l1', itemId: 'esc', descricao: 'Escova', quantidade: 1, moeda: 'BOB', total: 6000, totalPrincipal: 6000, campos: {}, profissionalId: 'ana', comissaoBp: 4000, comissaoPrincipal: 2400, baseComissao: 6000, parteSalao: 3600, ...extra }) as Linha

describe('de onde veio a comissão', () => {
  it('leva ao lugar certo em cada regra', () => {
    expect(origemComissao(linha({ comissaoRegra: 'profissional' }))?.destino).toEqual({ tipo: 'profissional', pessoaId: 'ana' })
    expect(origemComissao(linha({ comissaoRegra: 'servico' }))?.destino).toEqual({ tipo: 'servico', itemId: 'esc' })
    expect(origemComissao(linha({ comissaoRegra: 'padrao' }))?.destino).toEqual({ tipo: 'regras' })
    expect(origemComissao(linha({ comissaoRegra: 'linha' }))?.destino).toEqual({ tipo: 'corrigir' })
  })
  it('venda antiga sem a regra gravada leva às regras; sem comissão não mostra nada', () => {
    expect(origemComissao(linha({ comissaoRegra: undefined }))?.destino).toEqual({ tipo: 'regras' })
    expect(origemComissao(linha({ comissaoRegra: undefined, comissaoBp: undefined }))).toBeUndefined()
  })
  it('as partes somam o valor da linha', () => {
    const p = partesDaLinha(linha({ insumoPrincipal: 1000, baseComissao: 5000, comissaoPrincipal: 2000, parteSalao: 3000 }))
    expect(p.insumos + p.salao + p.profissional).toBe(6000)
    expect(p.fatias.salao).toBe('50%')
  })
})

describe('cartão da divisão interna', () => {
  async function abrir(l: Linha, onCorrigir?: () => void) {
    const { b, sessao } = await novoBackend()
    const ir = vi.fn()
    const ctx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav: { tela: 'venda', params: {} }, ir, ajustarParams: () => undefined } as AppCtx
    render(<Ctx.Provider value={ctx}><DivisaoInterna linhas={[l]} moeda="BOB" onCorrigir={onCorrigir} /></Ctx.Provider>)
    return ir
  }

  it('mostra quem ficou com quanto e abre o cadastro da profissional', async () => {
    const ir = await abrir(linha({ comissaoRegra: 'profissional' }))
    expect(screen.getByText('Definida no cadastro da profissional')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Alterar na profissional/ }))
    expect(ir).toHaveBeenCalledWith('novoFuncionario', { id: 'ana' })
  }, 15000)

  it('abre o serviço já pelo id', async () => {
    const ir = await abrir(linha({ comissaoRegra: 'servico' }))
    fireEvent.click(screen.getByRole('button', { name: /Alterar no serviço/ }))
    expect(ir).toHaveBeenCalledWith('configSecao', { id: 'catalogo', servico: 'esc' })
  }, 15000)

  it('ajuste na venda: corrige aqui; venda que não dá para corrigir não oferece o botão', async () => {
    const corrigir = vi.fn()
    await abrir(linha({ comissaoRegra: 'linha' }), corrigir)
    fireEvent.click(screen.getByRole('button', { name: /Corrigir esta venda/ }))
    expect(corrigir).toHaveBeenCalled()
    cleanup()
    await abrir(linha({ comissaoRegra: 'linha' }))
    expect(screen.queryByRole('button', { name: /Corrigir esta venda/ })).toBeNull()
  }, 15000)
})
