// Dinheiro sempre em INTEIRO na menor unidade da moeda (centavos; o guarani não tem centavos).
// Conversão com números racionais em BigInt e um único arredondamento (meio para o par).

import { ErroNegocio } from './erros'

export type CodigoMoeda = string

export interface Moeda {
  codigo: CodigoMoeda
  nome: string
  simbolo: string
  casas: number
  pais: string
}

export const MOEDAS: Moeda[] = [
  { codigo: 'BRL', nome: 'Real', simbolo: 'R$', casas: 2, pais: 'Brasil' },
  { codigo: 'PYG', nome: 'Guarani', simbolo: '₲', casas: 0, pais: 'Paraguai' },
  { codigo: 'USD', nome: 'Dólar', simbolo: 'US$', casas: 2, pais: 'Estados Unidos' },
  { codigo: 'BOB', nome: 'Boliviano', simbolo: 'Bs', casas: 2, pais: 'Bolívia' },
]

/** Moeda em que as cotações são digitadas. */
export const MOEDA_BASE = 'BRL'

/** Limite de segurança: 10 bilhões na unidade menor (≈ R$ 100 milhões; ₲ 10 bilhões). */
export const MAX_VALOR = 10_000_000_000

export function moeda(codigo: CodigoMoeda): Moeda {
  const m = MOEDAS.find((x) => x.codigo === codigo)
  if (!m) throw new ErroNegocio(`Moeda desconhecida: ${codigo}`)
  return m
}

/** Lê o que a pessoa digitou ("1.474,80", "70", "70,5", "71.000") e devolve o inteiro na menor unidade. */
export function lerValor(texto: string, codigo: CodigoMoeda): number | null {
  const casas = moeda(codigo).casas
  let t = String(texto ?? '').trim().replace(/\s/g, '').replace(/^(R\$|US\$|Bs|₲)/i, '')
  if (!t || /[eE]/.test(t) || t.startsWith('-')) return null
  if (!/^[\d.,]+$/.test(t)) return null
  let inteira: string
  let decimal = ''
  if (t.includes(',')) {
    const partes = t.split(',')
    if (partes.length !== 2) return null
    inteira = partes[0].replace(/\./g, '')
    decimal = partes[1]
  } else {
    const pontos = t.split('.')
    // "71.000" e "1.474.000" = milhar; "70.5" = decimal
    if (pontos.length > 1 && pontos.slice(1).every((p) => p.length === 3)) inteira = pontos.join('')
    else if (pontos.length === 2) [inteira, decimal] = pontos
    else if (pontos.length === 1) inteira = pontos[0]
    else return null
  }
  if (!/^\d*$/.test(inteira) || !/^\d*$/.test(decimal)) return null
  if (decimal.length > casas) {
    if (casas === 0) return null
    decimal = decimal.slice(0, casas)
  }
  const valor = Number((inteira || '0') + decimal.padEnd(casas, '0'))
  if (!Number.isSafeInteger(valor) || valor > MAX_VALOR) return null
  return valor
}

/** Mostra o valor: formatar(147480, 'BRL') = "R$ 1.474,80"; formatar(71000, 'PYG') = "₲ 71.000". */
export function formatar(valor: number, codigo: CodigoMoeda, opcoes: { semSimbolo?: boolean } = {}): string {
  const m = moeda(codigo)
  const negativo = valor < 0
  const abs = Math.abs(Math.round(valor))
  const inteira = Math.floor(abs / 10 ** m.casas)
  const dec = m.casas ? ',' + String(abs % 10 ** m.casas).padStart(m.casas, '0') : ''
  const milhar = String(inteira).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const corpo = milhar + dec
  return (negativo ? '−' : '') + (opcoes.semSimbolo ? corpo : `${m.simbolo} ${corpo}`)
}

// ---------- cotações ----------

/**
 * Cotação como a pessoa digita:
 *  - sentido 'basePorMoeda': "1 USD = 5,43 BRL" → valor "5,43"
 *  - sentido 'moedaPorBase': "1 BRL = 1.420 PYG" → valor "1420"
 */
export interface Cotacao {
  moeda: CodigoMoeda
  valor: string
  sentido: 'basePorMoeda' | 'moedaPorBase'
  data: string
  /**
   * Contra qual moeda o valor foi digitado (padrão: BRL, a base). Ex.: câmbio fixo "1 USD = 6,96 BOB" →
   * { moeda: 'USD', valor: '6,96', sentido: 'basePorMoeda', contra: 'BOB' }. A conversão continua exata.
   */
  contra?: CodigoMoeda
  /** para que serve: base (a do mercado), venda (quando recebo em outra moeda) ou compra (quando pago em outra moeda) */
  uso?: UsoCambio
}

export type UsoCambio = 'base' | 'venda' | 'compra'

interface Racional {
  num: bigint
  den: bigint
}

function decimalParaRacional(texto: string): Racional {
  const t = texto.trim().replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) throw new ErroNegocio(`Cotação inválida: ${texto}`)
  const [i, d = ''] = t.split('.')
  const num = BigInt(i + d)
  if (num === 0n) throw new ErroNegocio('A cotação não pode ser zero.')
  return { num, den: 10n ** BigInt(d.length) }
}

/** Quantos BRL (unidade maior) vale 1 unidade maior da moeda (segue a moeda "contra", se houver). */
export function taxaParaBase(c: Cotacao | undefined, codigo: CodigoMoeda, tabela?: TabelaCotacoes, profundidade = 0): Racional {
  // o real é a base interna; só muda quando tem câmbio próprio contra outra moeda (fixo/ajustado para venda ou compra)
  if (codigo === MOEDA_BASE && (!c || !c.contra || c.contra === MOEDA_BASE)) return { num: 1n, den: 1n }
  if (!c) throw new ErroNegocio(`Falta a cotação de ${codigo}. Cadastre em Configurações › Moedas e câmbio.`)
  const r = decimalParaRacional(c.valor)
  const direto = c.sentido === 'basePorMoeda' ? r : { num: r.den, den: r.num }
  if (!c.contra || c.contra === MOEDA_BASE) return direto
  if (c.contra === codigo || profundidade > 3) throw new ErroNegocio(`Cotação de ${codigo} em círculo.`)
  const contra = taxaParaBase(tabela?.[c.contra], c.contra, tabela, profundidade + 1)
  return { num: direto.num * contra.num, den: direto.den * contra.den }
}

/** Texto decimal (com vírgula) de um racional, com até 10 casas. */
export function racionalParaTexto(r: Racional): string {
  const escala = 10n ** 10n
  const v = dividirArredondando(r.num * escala, r.den)
  const inteira = v / escala
  const dec = (v % escala).toString().padStart(10, '0').replace(/0+$/, '')
  return dec ? `${inteira},${dec}` : `${inteira}`
}

/**
 * Cotação de uma moeda escrita CONTRA a moeda de referência, com ajuste em pontos-base (sobre o valor da moeda).
 * Ex.: base 1 USD = 6,96 BOB, ajuste −150 (−1,5%) → { USD, 6,8556, contra BOB }. Serve para qualquer moeda, inclusive o real.
 */
export function ajustarCotacao(codigo: CodigoMoeda, referencia: CodigoMoeda, bp: number, tabela: TabelaCotacoes, uso: UsoCambio, data = ''): Cotacao {
  const m = taxaParaBase(tabela[codigo], codigo, tabela)
  const r = taxaParaBase(tabela[referencia], referencia, tabela)
  const aj = { num: m.num * r.den * BigInt(10000 + bp), den: m.den * r.num * 10000n }
  return { moeda: codigo, valor: racionalParaTexto(aj), sentido: 'basePorMoeda', contra: referencia, data, uso }
}

function dividirArredondando(num: bigint, den: bigint): bigint {
  if (den < 0n) {
    num = -num
    den = -den
  }
  const negativo = num < 0n
  const a = negativo ? -num : num
  let q = a / den
  const resto = a % den
  const dobro = resto * 2n
  if (dobro > den || (dobro === den && q % 2n === 1n)) q += 1n
  return negativo ? -q : q
}

export type TabelaCotacoes = Record<CodigoMoeda, Cotacao | undefined>

/**
 * Converte um valor (menor unidade) de uma moeda para outra.
 * Ex.: converter(10000, 'USD', 'BRL', {USD: 5,43}) = 54300 (R$ 543,00).
 */
export function converter(valor: number, de: CodigoMoeda, para: CodigoMoeda, cot: TabelaCotacoes): number {
  if (de === para) return valor
  const a = taxaParaBase(cot[de], de, cot)
  const b = taxaParaBase(cot[para], para, cot)
  const casas = moeda(para).casas - moeda(de).casas
  let num = BigInt(Math.round(valor)) * a.num * b.den
  let den = a.den * b.num
  if (casas >= 0) num *= 10n ** BigInt(casas)
  else den *= 10n ** BigInt(-casas)
  return Number(dividirArredondando(num, den))
}

/** Texto amigável da cotação: "1 USD = BRL 5,43" ou "1 USD = BOB 6,96". */
export function textoCotacao(c: Cotacao): string {
  const contra = c.contra ?? MOEDA_BASE
  return c.sentido === 'basePorMoeda' ? `1 ${c.moeda} = ${contra} ${c.valor}` : `1 ${contra} = ${c.valor} ${c.moeda}`
}

/** Quanto vale 1 unidade de "de" em "para" (para mostrar: "1 USD = 6,9600 BOB"). */
export function valorDeUm(de: CodigoMoeda, para: CodigoMoeda, cot: TabelaCotacoes): number | undefined {
  try {
    const escala = 1_000_000
    const v = converter(escala * 10 ** moeda(de).casas, de, para, cot)
    return v / (escala * 10 ** moeda(para).casas)
  } catch {
    return undefined
  }
}

/**
 * Quantidade × fator, exato (fator em texto: "3,5", "17.5").
 * Ex.: multiplicarFator(2000, '3,5', 'BOB') = 700000 (Bs 7.000,00); multiplicarFator(2008, '17,5', 'BOB') = 3514000.
 */
export function multiplicarFator(quantidade: number, fator: string, codigo: CodigoMoeda): number {
  const t = String(fator).trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) throw new ErroNegocio(`Fator inválido: ${fator}`)
  const [i, d = ''] = t.split('.')
  const num = BigInt(Math.round(quantidade)) * BigInt(i + d) * 10n ** BigInt(moeda(codigo).casas)
  const v = Number(dividirArredondando(num, 10n ** BigInt(d.length)))
  if (v > MAX_VALOR) throw new ErroNegocio('Valor alto demais.')
  return v
}

/** Fator digitado é válido? ("3,5", "17.5", "9") */
export function fatorValido(fator: string | undefined): boolean {
  return !!fator && /^\d+([.,]\d+)?$/.test(String(fator).trim()) && Number(String(fator).replace(',', '.')) > 0
}

/** Parte proporcional sem perder centavos: proporcao(1000, 1, 3) = 333. */
export function proporcao(valor: number, parte: number, todo: number): number {
  if (todo === 0) return 0
  return Number(dividirArredondando(BigInt(Math.round(valor)) * BigInt(Math.round(parte)), BigInt(Math.round(todo))))
}

/** Divide um total em n partes inteiras que somam exatamente o total (a diferença vai na última). */
export function dividirEmPartes(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  const partes = Array.from({ length: n }, () => base)
  partes[n - 1] += total - base * n
  return partes
}
