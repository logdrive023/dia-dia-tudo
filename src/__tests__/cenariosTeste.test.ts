// @vitest-environment jsdom
// MODO TESTE: os cenários prontos entram pelos comandos de verdade (as contas batem) e "zerar tudo" limpa dados e
// preferências do app sem mexer no que não é dele.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'
import { CENARIOS, carregarCenario, montandoCenario, zerarAparelho } from '../adapters/cenarios'
import { bs, novoBackend } from './ajuda'

describe('modo teste: cenários e zerar tudo', () => {
  it('turno com erro de caixa: um turno fechado com falta de Bs 50 e outro aberto, no nome da Paula', async () => {
    const { b } = await novoBackend()
    await carregarCenario(b, 'turnoErro')
    const turnos = (await b.consulta('turnos', {})) as any[]
    const t = turnos.find((x) => x.id === 'turno-teste-1')
    expect(t).toMatchObject({ nome: 'Paula (gerente Centro)', situacao: 'falta', trocoInicial: { BOB: bs(200) } })
    expect(t.esperado.BOB).toBe(bs(650))
    expect(t.diferenca.BOB).toBe(-bs(50))
    expect(t.vendas).toMatchObject({ n: 2, total: bs(450) })
    // o 2º turno está aberto (a Paula vê "Fechar meu turno")
    await b.comoUsuario({ usuarioId: 'u-paula', nome: 'Paula (gerente Centro)', perfil: 'funcionario', pessoaId: 'p-mariana', localId: 'loc-centro' }, async () => {
      expect((await b.consulta('turnoAtual', {})) as any).toMatchObject({ controle: true, aberto: true, precisaAbrir: false })
    })
    // voltou para quem estava (o admin do teste)
    expect(b.sessaoAtual.perfil).toBe('admin')
    expect(b.sessaoAtual.pessoaId).toBeUndefined()
  })

  it('loja cheia e começar do zero (fica só o admin para entrar); a trava vale só enquanto monta', async () => {
    const { b } = await novoBackend()
    const carregando = carregarCenario(b, 'loja')
    expect(montandoCenario()).toBe(true) // o primeiro uso não monta a demonstração por cima
    await carregando
    expect(montandoCenario()).toBe(false)
    expect(((await b.consulta('estoque', { moduloId: 'cabelo' })) as any[]).length).toBeGreaterThan(0)
    await carregarCenario(b, 'vazio')
    expect(((await b.consulta('estoque', { moduloId: 'cabelo' })) as any[]).length).toBe(0)
    expect(((await b.consulta('usuariosDemo', {})) as any[]).map((u) => u.login)).toEqual(['admin'])
    await expect(b.entrar('admin', 'demo1234')).resolves.toBeTruthy()
    expect(CENARIOS.map((c) => c.id)).toEqual(['loja', 'turnoErro', 'vazio'])
  })

  it('zerar tudo: apaga os dados e só as chaves "tudo…" do navegador, e recarrega', async () => {
    const { b } = await novoBackend()
    await carregarCenario(b, 'loja')
    localStorage.setItem('tudo.sessao', 'x')
    localStorage.setItem('tudo:modo-dados', 'x')
    localStorage.setItem('outro-app', 'fica')
    sessionStorage.setItem('tudo:acesso-liberado', '1')
    const recarregar = vi.fn()
    await zerarAparelho(b, recarregar)
    expect(((await b.consulta('estoque', { moduloId: 'cabelo' })) as any[]).length).toBe(0)
    expect(localStorage.getItem('tudo.sessao')).toBeNull()
    expect(localStorage.getItem('tudo:modo-dados')).toBeNull()
    expect(sessionStorage.getItem('tudo:acesso-liberado')).toBeNull()
    expect(localStorage.getItem('outro-app')).toBe('fica')
    expect(recarregar).toHaveBeenCalledOnce()
    localStorage.removeItem('outro-app')
  })
})
