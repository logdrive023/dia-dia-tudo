// REGRAS TRIBUTÁRIAS DA BOLÍVIA (Régimen General) — VERSIONADAS. Diagnóstico e fontes: IMPOSTO-RENDA.md.
// Nada de alíquota, prazo ou formulário espalhado pelas telas: tudo sai daqui. Mudou a lei → entra uma VERSÃO NOVA com
// a data de início e a fonte (a antiga fica, para os exercícios antigos continuarem iguais). Cada mês usa a versão
// vigente no último dia do mês; o IUE usa a vigente no cierre. Certeza: 'O' texto oficial · 'S' secundária · 'N' a confirmar.

export type Certeza = 'O' | 'S' | 'N'
export type IdObrigacao = 'iva' | 'it' | 'iue' | 'retIue' | 'retIt' | 'rcIva' | 'rcv' | 'eeff'

export interface Obrigacao {
  id: IdObrigacao
  sigla: string
  nome: string
  es: string
  /** o que é, em uma frase */
  descricao: string
  formulario: string
  periodicidade: 'mensal' | 'anual'
  /** alíquota em pontos-base (quando é um imposto com valor) */
  aliquotaBp?: number
  base: string
  vencimento: string
  fonte: string
  certeza: Certeza
  /** o sistema calcula o valor (true) ou só lembra a obrigação (false: depende do contador / de dados externos) */
  calcula: boolean
}

export interface VersaoRegras {
  versao: string
  vigenteDesde: string
  /** inclusive; sem = vigente até hoje */
  vigenteAte?: string
  obrigacoes: Obrigacao[]
  /** retenções de compras sem factura: bens (IUE + IT) e serviços */
  retencao: { bensIueBp: number; bensItBp: number; servicoBp: number; servicoTipo: 'IUE' | 'RC-IVA'; servicoItBp: number }
  /** vendas a partir das quais os estados financeiros vão com parecer de auditoria (centavos BOB) */
  limiteAuditoria: number
  notas: string[]
}

const comum = (o: Partial<Obrigacao> & Pick<Obrigacao, 'id'>): Obrigacao => ({ ...BASE[o.id], ...o })
const BASE: Record<IdObrigacao, Obrigacao> = {
  iva: { id: 'iva', sigla: 'IVA', nome: 'Imposto ao Valor Agregado', es: 'Impuesto al Valor Agregado', descricao: 'Sobre a venda de bens e serviços: débito das vendas com factura menos o crédito das compras com factura.', formulario: 'F-200 (v5, SIAT)', periodicidade: 'mensal', aliquotaBp: 1300, base: 'Preço líquido da factura ("por dentro")', vencimento: 'Mês seguinte, pelo último dígito do NIT (dia 13 a 22)', fonte: 'Ley 843 arts. 1–15; DS 21530', certeza: 'O', calcula: true },
  it: { id: 'it', sigla: 'IT', nome: 'Imposto sobre as Transações', es: 'Impuesto a las Transacciones', descricao: 'Sobre o ingresso bruto do mês, dê lucro ou não. O IUE pago do ano anterior compensa o IT.', formulario: 'F-400 (v5, SIAT)', periodicidade: 'mensal', aliquotaBp: 300, base: 'Ingresso bruto do mês', vencimento: 'Mês seguinte, pelo último dígito do NIT (dia 13 a 22)', fonte: 'Ley 843 arts. 72–77; DS 21532', certeza: 'O', calcula: true },
  iue: { id: 'iue', sigla: 'IUE', nome: 'Imposto sobre os Lucros das Empresas', es: 'Impuesto sobre las Utilidades de las Empresas', descricao: 'Sobre o lucro do ano (estados financeiros): lucro contábil + ajustes = lucro tributável × 25%.', formulario: 'F-500', periodicidade: 'anual', aliquotaBp: 2500, base: 'Lucro tributável do exercício', vencimento: '120 dias depois do cierre de gestión', fonte: 'Ley 843 arts. 36–50; DS 24051 arts. 39–40', certeza: 'O', calcula: true },
  retIue: { id: 'retIue', sigla: 'RET-IUE', nome: 'Retenção de IUE (compras sem factura)', es: 'Retención IUE', descricao: 'Quem compra de pessoa sem factura retém e paga o IUE dela: 5% em bens (25% de um lucro presumido de 20%).', formulario: 'F-570', periodicidade: 'mensal', aliquotaBp: 500, base: 'Valor pago em compras de bens sem factura', vencimento: 'Mês seguinte, pelo último dígito do NIT', fonte: 'DS 24051 art. 3; DS 4850 (desde 01/01/2023)', certeza: 'O', calcula: true },
  retIt: { id: 'retIt', sigla: 'RET-IT', nome: 'Retenção de IT (compras sem factura)', es: 'Retención IT', descricao: 'Junto com a retenção de IUE: 3% do valor pago a quem não emite factura.', formulario: 'F-410', periodicidade: 'mensal', aliquotaBp: 300, base: 'Valor pago em compras sem factura', vencimento: 'Mês seguinte, pelo último dígito do NIT', fonte: 'DS 21532; DS 4850', certeza: 'S', calcula: true },
  rcIva: { id: 'rcIva', sigla: 'RC-IVA', nome: 'RC-IVA dos dependentes (agente de retenção)', es: 'Régimen Complementario al IVA', descricao: 'Sobre os salários acima de 2 salários mínimos, depois dos aportes; o empregado abate com facturas (F-110).', formulario: 'F-608', periodicidade: 'mensal', aliquotaBp: 1300, base: 'Salário líquido de aportes acima de 2 SMN', vencimento: 'Mês seguinte, pelo último dígito do NIT', fonte: 'DS 21531 arts. 8 e 11', certeza: 'S', calcula: false },
  rcv: { id: 'rcv', sigla: 'RCV', nome: 'Registro de Compras e Vendas (SIAT)', es: 'Registro de Compras y Ventas', descricao: 'O livro digital das facturas de compra e venda no SIAT — enviar todo mês, mesmo sem movimento.', formulario: 'SIAT en Línea', periodicidade: 'mensal', base: 'Facturas do mês', vencimento: 'Mês seguinte (antes das declarações)', fonte: 'RND 102100000011', certeza: 'S', calcula: false },
  eeff: { id: 'eeff', sigla: 'EEFF', nome: 'Estados financeiros', es: 'Estados Financieros', descricao: 'Balanço, estado de resultados e notas, com o IUE. Com parecer de auditoria se as vendas passam do limite.', formulario: 'Digital no SIAT (F-605)', periodicidade: 'anual', base: 'O exercício inteiro', vencimento: '120 dias depois do cierre de gestión', fonte: 'DS 24051 arts. 35–36; RND 101800000004', certeza: 'S', calcula: false },
}

export const REGRAS_BO: VersaoRegras[] = [
  {
    versao: 'BO-2016',
    vigenteDesde: '2016-05-01',
    vigenteAte: '2022-12-31',
    obrigacoes: [comum({ id: 'iva' }), comum({ id: 'it' }), comum({ id: 'iue' }), comum({ id: 'retIue', fonte: 'DS 24051 art. 3 (texto anterior ao DS 4850)' }), comum({ id: 'retIt' }), comum({ id: 'rcIva' }), comum({ id: 'rcv', fonte: 'Libro de Compras y Ventas IVA (até 2021) / RCV' }), comum({ id: 'eeff' })],
    retencao: { bensIueBp: 500, bensItBp: 300, servicoBp: 1250, servicoTipo: 'IUE', servicoItBp: 300 },
    limiteAuditoria: 120000000,
    notas: ['Serviços sem factura: retenção IUE 12,5% + IT 3% (antes do DS 4850).'],
  },
  {
    versao: 'BO-2023',
    vigenteDesde: '2023-01-01',
    obrigacoes: [comum({ id: 'iva' }), comum({ id: 'it' }), comum({ id: 'iue' }), comum({ id: 'retIue' }), comum({ id: 'retIt' }), comum({ id: 'rcIva' }), comum({ id: 'rcv' }), comum({ id: 'eeff' })],
    retencao: { bensIueBp: 500, bensItBp: 300, servicoBp: 1300, servicoTipo: 'RC-IVA', servicoItBp: 300 },
    limiteAuditoria: 120000000,
    notas: [
      'DS 4850: serviços sem factura passam a reter RC-IVA 13% (F-604) + IT 3%; bens seguem IUE 5% + IT 3%.',
      'DS 5327 (02/2025) só compensava o IT com IUE pago em dia; DS 5563 (03/2026) tirou essa exigência (fonte secundária).',
      'RND 102600000014 sobe o limite do parecer de auditoria para Bs 1.700.000 nos exercícios que fecham a partir de 2027 (fonte secundária).',
    ],
  },
]

/** a versão vigente numa data (AAAA-MM-DD) */
export function regrasEm(data: string, versoes: VersaoRegras[] = REGRAS_BO): VersaoRegras {
  return [...versoes].reverse().find((v) => v.vigenteDesde <= data && (!v.vigenteAte || data <= v.vigenteAte)) ?? versoes[0]
}

/** CIERRE DE GESTIÓN pelo tipo de atividade (DS 24051 art. 39) */
export type TipoAtividade = 'comercial' | 'servicos' | 'industrial' | 'agro' | 'mineira'
export const CIERRE: Record<TipoAtividade, { mes: number; dia: number; nome: string }> = {
  comercial: { mes: 12, dia: 31, nome: 'Comercial' },
  servicos: { mes: 12, dia: 31, nome: 'Serviços' },
  industrial: { mes: 3, dia: 31, nome: 'Industrial' },
  agro: { mes: 6, dia: 30, nome: 'Agropecuária / agroindustrial' },
  mineira: { mes: 9, dia: 30, nome: 'Mineração' },
}

const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const somar = (data: string, dias: number) => { const [a, m, d] = data.split('-').map(Number); const x = new Date(Date.UTC(a, m - 1, d + dias)); return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()) }
const fimDoMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate()

/** o exercício fiscal "ano" pelo tipo de atividade: de (o dia seguinte ao cierre anterior) até o cierre deste ano */
export function exercicio(ano: number, tipo: TipoAtividade = 'comercial') {
  const c = CIERRE[tipo]
  const ate = iso(ano, c.mes, c.dia)
  const de = somar(iso(ano - 1, c.mes, c.dia), 1)
  // os meses do exercício, na ordem (ex.: industrial: abril do ano anterior → março)
  const meses: string[] = []
  let [a, m] = de.split('-').map(Number)
  for (let k = 0; k < 12; k++) { meses.push(`${a}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; a++ } }
  return { ano, de, ate, meses, vencimentoAnual: somar(ate, 120), tipo }
}

/** fim de semana ou feriado → o próximo dia útil (DS 25619 art. 3) */
export function proximoUtil(data: string, feriados: Set<string> = new Set()) {
  let d = data
  for (let k = 0; k < 10; k++) {
    const [a, m, dd] = d.split('-').map(Number)
    const dow = new Date(Date.UTC(a, m - 1, dd)).getUTCDay()
    if (dow !== 0 && dow !== 6 && !feriados.has(d)) return d
    d = somar(d, 1)
  }
  return d
}

/** vencimento de uma obrigação MENSAL do mês "AAAA-MM": no mês seguinte, dia 13 + último dígito do NIT (DS 25619 art. 1) */
export function vencimentoMensal(mes: string, nit: string | undefined, feriados?: Set<string>) {
  const digito = Number((nit ?? '').replace(/\D/g, '').slice(-1))
  const [a, m] = mes.split('-').map(Number)
  const na = m === 12 ? a + 1 : a
  const nm = m === 12 ? 1 : m + 1
  // sem NIT: o dia 13 (o mais cedo) — melhor avisar antes do que perder o prazo
  const dia = Math.min(13 + (Number.isFinite(digito) && (nit ?? '').trim() ? digito : 0), fimDoMes(na, nm))
  return proximoUtil(iso(na, nm, dia), feriados)
}

/** o último dia de um mês "AAAA-MM" */
export const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return iso(a, m, fimDoMes(a, m)) }
