// COBRANÇA NO WHATSAPP: o texto pronto, o do dono, as variáveis e a regra ao salvar.
import { describe, expect, it } from 'vitest'
import { validarCobrancas } from '../../../core/services/cobranca'
import { variaveisFora } from '../../../shared/ui/previaWhatsapp'
import { VARIAVEIS_COBRANCA, mensagemCobranca, modeloCobranca } from '../model/cobranca'

describe('cobrança no WhatsApp', () => {
  it('usa o texto do dono ou o pronto e preenche com os dados da conta', () => {
    const pronto = modeloCobranca('pt', 'emprestimo')
    expect(pronto).toContain('{parcelas}')
    const msg = mensagemCobranca(pronto, { nome: 'Lucas', parcelas: '1ª 05/12 Bs 8.400', falta: 'Bs 33.600' })
    expect(msg).toContain('Olá, Lucas!')
    expect(msg).toContain('1ª 05/12 Bs 8.400')
    expect(msg).toContain('*Total que falta:* Bs 33.600')
    const doDono = modeloCobranca('pt', 'adiantamento', { pt: { adiantamento: 'Oi {nome}, faltam {falta}' } })
    expect(mensagemCobranca(doDono, { nome: 'Ana', falta: 'Bs 10' })).toBe('Oi Ana, faltam Bs 10')
    // texto vazio do dono = volta ao pronto
    expect(modeloCobranca('pt', 'adiantamento', { pt: { adiantamento: '   ' } })).toContain('{codigo}')
  })

  it('o pronto em espanhol sai traduzido e com as mesmas variáveis', () => {
    for (const tipo of ['adiantamento', 'emprestimo'] as const) {
      const es = modeloCobranca('es', tipo)
      const pt = modeloCobranca('pt', tipo)
      expect(es).not.toBe(pt)
      expect(es).toMatch(/Hola/)
      const vars = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      expect(vars(es)).toEqual(vars(pt))
      expect(variaveisFora(es, VARIAVEIS_COBRANCA[tipo].map((v) => v.id))).toEqual([])
    }
  })

  it('avisa variável escrita errado e confere ao salvar', () => {
    expect(variaveisFora('Oi {nmoe}, {falta}', VARIAVEIS_COBRANCA.emprestimo.map((v) => v.id))).toEqual(['nmoe'])
    expect(validarCobrancas({ es: { emprestimo: '  Hola {nombre}  ' }, pt: { adiantamento: '' } })).toEqual({ es: { emprestimo: 'Hola {nombre}' } })
    expect(validarCobrancas({ pt: { adiantamento: '' } })).toBeUndefined()
    expect(() => validarCobrancas({ pt: { emprestimo: 'a'.repeat(601) } })).toThrow(/600 letras/)
  })
})
