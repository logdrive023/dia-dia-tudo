// LEITOR CONTÍNUO (modo caixa): o × e o "Concluir" fecham a câmera e voltam para a venda — e ela não abre de novo sozinha.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { carregarDemo } from '../app/demo'
import { VendaRapida } from '../screens/VendaRapida'
import { Ctx, type AppCtx, type Navegacao } from '../ui/contexto'
import { novoBackend } from './ajuda'

afterEach(() => cleanup())

function Harness({ base }: { base: Omit<AppCtx, 'nav' | 'ajustarParams' | 'ir'> }) {
  const [nav, setNav] = useState<Navegacao>({ tela: 'vendaRapida', params: {} })
  const ctx: AppCtx = { ...base, nav, ir: (tela, params = {}) => setNav({ tela, params }), ajustarParams: (p) => setNav((n) => ({ ...n, params: { ...n.params, ...p } })) }
  return <Ctx.Provider value={ctx}><VendaRapida /></Ctx.Provider>
}

describe('leitor contínuo fecha', () => {
  for (const botao of ['Fechar', 'Concluir']) {
    it(`o botão "${botao}" fecha a câmera`, async () => {
      const { b, sessao } = await novoBackend()
      await carregarDemo(b)
      render(<Harness base={{ backend: b, sessao, trocarSessao: () => undefined, voltar: () => undefined, marcarSujo: () => undefined, avisar: () => undefined }} />)
      await screen.findByLabelText('Ler ou buscar pacote', {}, { timeout: 15000 })
      fireEvent.click(screen.getByRole('button', { name: 'Ler código' }))
      const janela = await screen.findByRole('dialog', { name: /Ler vários códigos/ })
      fireEvent.click(botao === 'Fechar' ? screen.getByRole('button', { name: 'Fechar' }) : screen.getByRole('button', { name: /^Concluir/ }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /Ler vários códigos/ })).toBeNull())
      expect(janela.isConnected).toBe(false)
    }, 60000)
  }
})
