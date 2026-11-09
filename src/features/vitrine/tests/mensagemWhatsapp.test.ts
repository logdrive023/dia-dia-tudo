// MENSAGEM DO WHATSAPP DA VITRINE: espanhol para o comprador da Bolívia; português só com página e celular em português.
import { describe, expect, it } from 'vitest'
import type { PacoteVitrine } from '../../../core/services/vitrine'
import { idiomaDaMensagem, mensagemLoja, mensagemPacote, variaveisDesconhecidas } from '../model/mensagem'

const pacote: PacoteVitrine = { id: 'a', codigo: 'L-0004', medida: 60, categoria: 'Normal', cor: 'Castanho claro', gramas: 1200 }

describe('mensagem do WhatsApp da vitrine', () => {
  it('escolhe o idioma pelo comprador', () => {
    expect(idiomaDaMensagem('pt', 'es-BO')).toBe('es')
    expect(idiomaDaMensagem('pt', 'en-US')).toBe('es')
    expect(idiomaDaMensagem('es', 'pt-BR')).toBe('es')
    expect(idiomaDaMensagem('pt', 'pt-BR')).toBe('pt')
  })

  it('pacote em espanhol, inclusive a cor e a pergunta do preço', () => {
    expect(mensagemPacote('es', pacote, 'Mechas', '1,2 kg', false)).toBe('¡Hola, Mechas! Me interesa el paquete L-0004: 60 cm · Castaño claro · 1,2 kg. ¿Sigue disponible?')
    expect(mensagemPacote('es', pacote, 'Mechas', '1,2 kg', true)).toBe('¡Hola, Mechas! Me interesa el paquete L-0004: 60 cm · Castaño claro · 1,2 kg. ¿Sigue disponible? ¿Cuál es el precio?')
  })

  it('pacote em português e a categoria quando não é Normal', () => {
    expect(mensagemPacote('pt', { ...pacote, categoria: 'Tinte', cor: undefined }, 'Mechas', '1,2 kg', true)).toBe('Olá, Mechas! Tenho interesse no pacote L-0004: 60 cm Tinte · 1,2 kg. Ainda está disponível? Qual é o valor?')
  })

  it('texto reescrito vale só no idioma dele e troca as variáveis', () => {
    const m = { es: { pacote: 'Buen día {loja}, quiero {codigo} de {medida} {cor} ({peso})' } }
    expect(mensagemPacote('es', pacote, 'Mechas', '1,2 kg', false, m)).toBe('Buen día Mechas, quiero L-0004 de 60 cm Castaño claro (1,2 kg)')
    expect(mensagemPacote('pt', pacote, 'Mechas', '1,2 kg', false, m)).toContain('Olá, Mechas!')
  })

  it('pergunta em branco sai sem ela; texto principal em branco volta ao pronto; escrito errado é avisado', () => {
    const m = { es: { pacote: '   ', perguntaPreco: '' } }
    expect(mensagemPacote('es', pacote, 'Mechas', '1,2 kg', true, m)).toBe('¡Hola, Mechas! Me interesa el paquete L-0004: 60 cm · Castaño claro · 1,2 kg. ¿Sigue disponible?')
    expect(variaveisDesconhecidas('{loja} {nome}')).toEqual(['nome'])
  })

  it('botão geral da loja nos dois idiomas', () => {
    expect(mensagemLoja('es', 'Mechas')).toBe('¡Hola, Mechas! Vi la vitrina y quiero saber más.')
    expect(mensagemLoja('pt', 'Mechas')).toBe('Olá, Mechas! Vi a vitrine e quero saber mais.')
  })
})
