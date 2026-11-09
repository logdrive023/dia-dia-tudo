// GERADOR DA VITRINE: a prévia muda na hora sem salvar nada; "Salvar e publicar" grava e a loja pública recebe o visual.
// As regras: cor no formato certo e banner só imagem enviada (o site publicado não carrega imagem de outro endereço).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MinhaVitrine } from '../pages/Vitrine'
import { contraste, primariaLegivel, textoSobre } from '../model/aparencia'
import { Ctx, type AppCtx, type Navegacao } from '../../../shared/ui/contexto'
import { novoBackend } from '../../../__tests__/ajuda'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

async function montar() {
  const { b, sessao } = await novoBackend()
  const Prov = ({ children }: { children: React.ReactNode }) => {
    const [nav, setNav] = useState<Navegacao>({ tela: 'vitrine', params: {} })
    const ctx: AppCtx = { backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
    return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
  }
  render(<Prov><MinhaVitrine /></Prov>)
  const previa = await screen.findByTestId('previa-vitrine', {}, { timeout: 10000 })
  return { b, previa, raiz: previa.firstElementChild as HTMLElement }
}

describe('gerador da vitrine', () => {
  it('a prévia muda na hora e nada é salvo até publicar', async () => {
    const { b, previa, raiz } = await montar()
    fireEvent.change(screen.getByLabelText(/^Nome da loja/), { target: { value: 'Mechas de Ouro' } })
    expect(within(previa).getByRole('heading', { level: 1 }).textContent).toBe('Mechas de Ouro')
    fireEvent.change(screen.getByLabelText('Cor principal (código)'), { target: { value: '#059669' } })
    expect(raiz.style.getPropertyValue('--marca')).toBe('#059669')
    fireEvent.click(screen.getByRole('radio', { name: /^Claro/ }))
    expect(raiz.style.getPropertyValue('--cartao')).toBe('#ffffff')
    // ainda não publicou
    expect((await b.consulta('vitrine', { publico: true })).loja.aparencia.corPrimaria).toBe('#7c3aed')
    expect(screen.getByText('Alterações ainda não publicadas')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e publicar' }))
    await waitFor(async () => expect((await b.consulta('vitrine', { publico: true })).loja).toMatchObject({ nome: 'Mechas de Ouro', aparencia: { corPrimaria: '#059669', fundo: 'claro' } }))
    await screen.findByText('Tudo publicado')
  }, 30000)

  it('código de cor incompleto não muda a prévia; "Desfazer" volta ao publicado', async () => {
    const { raiz } = await montar()
    fireEvent.change(screen.getByLabelText('Cor principal (código)'), { target: { value: '#05' } })
    expect(raiz.style.getPropertyValue('--marca')).toBe('#7c3aed')
    fireEvent.click(screen.getByRole('radio', { name: /Pontilhado/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(raiz.style.getPropertyValue('--cartao')).toBe('')
  }, 30000)
})

describe('aparência da vitrine: regras', () => {
  const vitrine = (aparencia: object) => ({ vitrine: { ativa: true, ocultos: [], aparencia } }) as never
  const cores = { corPrimaria: '#7c3aed', corSecundaria: '#a21caf', fundo: 'tema' }

  it('recusa cor fora do formato, fundo desconhecido e banner que não seja imagem enviada', async () => {
    const { b } = await novoBackend()
    await expect(b.comando('salvarConfig', vitrine({ ...cores, corPrimaria: 'red' }))).rejects.toThrow(/Cor inválida/)
    await expect(b.comando('salvarConfig', vitrine({ ...cores, fundo: 'neon' }))).rejects.toThrow(/Fundo/)
    for (const banner of ['https://exemplo.com/a.png', 'javascript:alert(1)', 'data:text/html;base64,AAAA', `data:image/png;base64,${'A'.repeat(800_000)}`])
      await expect(b.comando('salvarConfig', vitrine({ ...cores, banner }))).rejects.toThrow(/Banner inválido/)
    await b.comando('salvarConfig', vitrine({ ...cores, banner: 'data:image/jpeg;base64,AAAA', slogan: '  Direto da Bolívia ' }))
    expect((await b.consulta('vitrine', { publico: true })).loja.aparencia).toMatchObject({ banner: 'data:image/jpeg;base64,AAAA', slogan: 'Direto da Bolívia' })
  })

  it('legibilidade: texto sobre a cor e preço no cartão', () => {
    expect(textoSobre('#7c3aed')).toBe('#ffffff')
    expect(textoSobre('#fde047')).toBe('#111111')
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0)
    // amarelo some no cartão branco; no fundo escuro, lê
    expect(primariaLegivel({ corPrimaria: '#fde047', corSecundaria: '#000000', fundo: 'claro' })).toBe(false)
    expect(primariaLegivel({ corPrimaria: '#fde047', corSecundaria: '#000000', fundo: 'escuro' })).toBe(true)
  })
})
