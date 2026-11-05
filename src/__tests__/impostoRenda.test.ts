// IMPOSTO DE RENDA (Relatórios): o exercício fiscal boliviano a partir das operações, com as regras versionadas.
// Cenários: vendas e compras sem factura (retenção 8%), compra com factura (crédito de IVA e saldo a favor), gasto com e
// sem documento (ajuste do IUE), venda cancelada, meses sem movimento, compensação IUE → IT, declarações registradas,
// fechamento que congela e reabertura com motivo, regras de 2022 × 2026, cierre industrial e o calendário por NIT.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import { exercicio, regrasEm, vencimentoMensal } from '../core/dados/tributosBO'
import { bs, novoBackend } from './ajuda'

async function ano2025() {
  const { b, r, sessao } = await novoBackend('2025-03-10')
  await b.comando('salvarConfig', { fiscal: { nit: '1020304057', razaoSocial: 'Cabelos SRL', caeb: '4649400', tipoAtividade: 'comercial' } as never })
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(500_000), descricao: 'ini' } as any)
  await b.comando('salvarPessoa', { id: 'f', nome: 'Fornecedora', papeis: ['fornecedor'] } as any)
  await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 100 } as any)
  // MARÇO: compra sem factura de Bs 1.000 (paga), venda de Bs 2.000, gasto sem documento Bs 100
  await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'c1l', quantidade: 1000, moeda: 'BOB', total: bs(1000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc1', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
  await b.comando('concluirVenda', { id: 'v1', linhas: [{ id: 'v1l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(2000) }], pagamentos: [{ id: 'pv1', forma: 'dinheiro', moeda: 'BOB', valor: bs(2000) }] } as any)
  await b.comando('lancarCaixa', { id: 'g1', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(100), descricao: 'Luz', categoria: 'Luz e água' } as any)
  // MAIO: venda que é cancelada (não entra)
  r.avancar(60)
  await b.comando('concluirVenda', { id: 'v2', linhas: [{ id: 'v2l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(500) }], pagamentos: [{ id: 'pv2', forma: 'dinheiro', moeda: 'BOB', valor: bs(500) }] } as any)
  await b.comando('cancelarVenda', { id: 'v2', motivo: 'teste' } as any)
  return { b, r, sessao }
}
const mes = (d: any, m: string) => d.meses.find((x: any) => x.mes === m)
const obr = (d: any, id: string) => d.obrigacoes.find((o: any) => o.id === id)

describe('imposto de renda: o exercício', () => {
  it('IVA, IT e retenção do mês saem das operações; cancelada não entra; meses sem movimento avisam', async () => {
    const { b } = await ano2025()
    const d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(d.exercicio).toMatchObject({ de: '2025-01-01', ate: '2025-12-31', vencimentoAnual: '2026-04-30' })
    const mar = mes(d, '2025-03')
    expect(mar).toMatchObject({ receita: bs(2000), debitoIva: bs(260), creditoIva: 0, iva: bs(260), it: bs(60), baseRetencao: bs(1000), retIue: bs(50), retIt: bs(30) })
    // NIT termina em 7 → dia 20 do mês seguinte (DS 25619)
    expect(mar.vencimento).toBe('2025-04-21') // 20/04/2025 é domingo → segunda 21
    expect(mes(d, '2025-05').receita).toBe(0)
    expect(d.visao.nVendas.valor).toBe(1)
    expect(d.alertas.map((a: any) => a.id)).toEqual(expect.arrayContaining(['retencoes', 'despesasSemDoc', 'canceladas', 'semMovimento']))
  })

  it('compra com factura dá crédito de IVA; crédito maior que o débito vira saldo a favor no mês seguinte', async () => {
    const { b, r } = await ano2025()
    r.avancar(30) // junho
    await b.comando('criarCompra', { id: 'c2', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'c2l', quantidade: 1000, moeda: 'BOB', total: bs(5000), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: 'pc2', forma: 'dinheiro', moeda: 'BOB', valor: bs(5000) }] } as any)
    await b.comando('classificarDocumentoFiscal', { alvo: 'compra', id: 'c2', documento: 'factura', numero: '123' })
    r.avancar(30) // julho: venda de Bs 1.000 → débito 130, o saldo a favor de junho (650) cobre
    await b.comando('concluirVenda', { id: 'v3', linhas: [{ id: 'v3l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'pv3', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    const d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(mes(d, '2025-06')).toMatchObject({ creditoIva: bs(650), iva: 0, saldoIvaFavor: bs(650), baseRetencao: 0 })
    expect(mes(d, '2025-07')).toMatchObject({ debitoIva: bs(130), iva: 0, saldoIvaFavor: bs(520) })
  })

  it('gasto: sem documento soma de volta no lucro tributável; com factura dedutível sai do ajuste e dá crédito', async () => {
    const { b } = await ano2025()
    const a = await b.consulta('impostoRenda', { ano: 2025 })
    expect(a.resultado.lucroTributavel - a.resultado.lucroContabil).toBe(bs(100))
    await b.comando('classificarDocumentoFiscal', { alvo: 'despesa', id: 'g1', documento: 'factura', dedutivel: true })
    const d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(d.resultado.lucroTributavel).toBe(d.resultado.lucroContabil)
    expect(mes(d, '2025-03').creditoIva).toBe(bs(13))
    // IUE = 25% do tributável (estimado)
    expect(d.resultado.iue).toBe(Math.round(Math.max(0, d.resultado.lucroTributavel) * 0.25))
  })

  it('declaração registrada marca o mês; a obrigação vencida sem registro aparece', async () => {
    const { b, r } = await ano2025()
    r.avancar(400) // 2026
    let d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(obr(d, 'iva').meses.find((x: any) => x.mes === '2025-03').situacao).toBe('vencido')
    await b.comando('registrarObrigacaoFiscal', { id: 'o1', ano: 2025, periodo: '2025-03', obrigacao: 'iva', formulario: 'F-200', numeroOrden: '999', declaradoEm: '2025-04-15', valorDeclarado: bs(260), pagoEm: '2025-04-15', valorPago: bs(260) })
    d = await b.consulta('impostoRenda', { ano: 2025 })
    const mar = obr(d, 'iva').meses.find((x: any) => x.mes === '2025-03')
    expect(mar).toMatchObject({ situacao: 'pago', pago: bs(260) })
    expect(obr(d, 'iva').pago).toBe(bs(260))
    // retenção: só exige no mês em que houve compra sem factura
    expect(obr(d, 'retIue').meses.find((x: any) => x.mes === '2025-05').situacao).toBe('semMovimento')
  })

  it('o IUE pago do exercício anterior compensa o IT dos meses seguintes (Ley 843 art. 77)', async () => {
    const { b, r } = await novoBackend('2026-05-10')
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Escova', saldoInicial: 100 } as any)
    await b.comando('registrarObrigacaoFiscal', { id: 'iue25', ano: 2025, periodo: '2025', obrigacao: 'iue', formulario: 'F-500', declaradoEm: '2026-04-28', pagoEm: '2026-04-28', valorPago: bs(40) })
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    r.avancar(31) // junho
    await b.comando('concluirVenda', { id: 'v2', linhas: [{ id: 'l2', itemId: 'x', quantidade: 1, moeda: 'BOB', total: bs(1000) }], pagamentos: [{ id: 'p2', forma: 'dinheiro', moeda: 'BOB', valor: bs(1000) }] } as any)
    const d = await b.consulta('impostoRenda', { ano: 2026 })
    // IT de maio = 30, todo compensado; junho: sobram 10 do IUE → IT 20
    expect(mes(d, '2026-05')).toMatchObject({ it: 0, itCompensadoIue: bs(30) })
    expect(mes(d, '2026-06')).toMatchObject({ it: bs(20), itCompensadoIue: bs(10) })
  })

  it('fechar congela; mudar dado depois avisa; reabrir exige motivo; só depois do cierre', async () => {
    const { b, r } = await ano2025()
    await expect(b.comando('mudarSituacaoExercicio', { ano: 2025, para: 'fechado' })).rejects.toThrow(/depois do cierre/)
    r.avancar(320) // 2026
    await b.comando('mudarSituacaoExercicio', { ano: 2025, para: 'fechado' })
    let d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(d.situacao).toBe('fechado')
    expect(d.fechamento?.versaoRegras).toBe('BO-2023')
    // correção depois do fechamento (gasto classificado): o lucro tributável muda → aviso
    await b.comando('classificarDocumentoFiscal', { alvo: 'despesa', id: 'g1', documento: 'factura', dedutivel: true })
    d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(d.alertas.some((a: any) => a.id === 'mudouDepois')).toBe(true)
    await expect(b.comando('mudarSituacaoExercicio', { ano: 2025, para: 'revisado' })).rejects.toThrow(/motivo/)
    await b.comando('mudarSituacaoExercicio', { ano: 2025, para: 'revisado', motivo: 'faltou a factura da luz' })
    d = await b.consulta('impostoRenda', { ano: 2025 })
    expect(d.historico.map((h: any) => h.para)).toEqual(['fechado', 'revisado'])
  })

  it('funcionária não abre', async () => {
    const { b, sessao } = await ano2025()
    await b.comando('salvarPessoa', { id: 'p-s', nome: 'Sofia', papeis: ['funcionario'] } as any)
    await b.comando('salvarUsuario', { id: 'u-s', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', pessoaId: 'p-s', senha: 'senha123' } as any)
    Object.assign(sessao, await b.entrar('sofia', 'senha123'))
    await expect(b.consulta('impostoRenda', { ano: 2025 })).rejects.toThrow(/permissão|administrador/)
  })
})

describe('regras versionadas e calendário', () => {
  it('2022 usa as regras antigas (serviço sem factura: IUE 12,5%); 2026 usa as do DS 4850', () => {
    expect(regrasEm('2022-12-31')).toMatchObject({ versao: 'BO-2016', retencao: { servicoBp: 1250, servicoTipo: 'IUE' } })
    expect(regrasEm('2026-12-31')).toMatchObject({ versao: 'BO-2023', retencao: { servicoBp: 1300, servicoTipo: 'RC-IVA', bensIueBp: 500 } })
  })
  it('cierre industrial: o exercício 2026 vai de 01/04/2025 a 31/03/2026, IUE em 120 dias', () => {
    const e = exercicio(2026, 'industrial')
    expect(e).toMatchObject({ de: '2025-04-01', ate: '2026-03-31', vencimentoAnual: '2026-07-29' })
    expect(e.meses[0]).toBe('2025-04')
    expect(e.meses[11]).toBe('2026-03')
  })
  it('vencimento por NIT: dígito 0 → dia 13; dezembro vence em janeiro; sem NIT, o mais cedo', () => {
    expect(vencimentoMensal('2026-02', '123450')).toBe('2026-03-13')
    expect(vencimentoMensal('2026-12', '123459')).toBe('2027-01-22')
    expect(vencimentoMensal('2026-02', '')).toBe('2026-03-13')
  })
})
