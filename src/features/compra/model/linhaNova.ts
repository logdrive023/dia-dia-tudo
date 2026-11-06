// NOVA COMPRA — as peças que a tela, o estado (useNovaCompra) e a linha (LinhaCompra) usam juntas: a linha em
// edição, os campos fixos e como montar as linhas a partir de uma compra anterior.
import { novoId } from '../../../core/domain/ids'
import type { Campos, Id, Linha } from '../../../core/domain/tipos'

export const CAMPOS_FIXOS = ['estado', 'comprimento', 'categoria', 'obs']

export const SELETOR_CAMPO = 'input:not([type=file]):not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea:not([disabled])'

export const CAMPOS_TIRAR = ['fator', 'tabelaId', 'colunaId', 'calculo', 'tabelaVersao', 'tabelaNome', 'colunaNome', 'fatorTabela', 'fatorManual']

export interface LinhaNova {
  id: Id
  modo: 'bruto' | 'tabela' | 'item'
  itemId?: Id
  quantidade?: number
  total?: number
  medida?: number
  fator?: string
  /** fator da compra repetida (vale quando a tabela de hoje não tem fator para a medida) */
  fatorAntigo?: string
  /** valor como foi digitado (bruto: o total; produto: o custo unitário), na moeda digitada */
  digitado?: number
  /** moeda em que o valor foi digitado (vazio = a do pedido); o total da linha fica convertido */
  moedaDig?: string
  /** cotação digitada "1 US$ = 6,96" (vazio = a do sistema) */
  cotacao?: string
  campos: Campos
}

/** linha nova segue a moeda (e a cotação) digitada na anterior */
export const moedaDaAnterior = (ant?: LinhaNova) => (ant?.moedaDig ? { moedaDig: ant.moedaDig, cotacao: ant.cotacao } : {})

/** Linhas de uma compra anterior (repetir): mesma medida, peso e valor; o fator vem da tabela de hoje. */
export function deLinhas(ls: Linha[], cabelo: boolean): LinhaNova[] {
  return ls.map((l) => {
    const fator = typeof l.campos.fator === 'string' ? l.campos.fator : undefined
    return {
      id: novoId(),
      modo: fator ? 'tabela' : cabelo ? 'bruto' : 'item',
      itemId: cabelo ? undefined : l.itemId,
      quantidade: l.quantidade,
      total: fator ? undefined : l.total,
      digitado: fator ? undefined : !cabelo && l.quantidade > 0 ? Math.round(l.total / l.quantidade) : l.total,
      medida: typeof l.campos.comprimento === 'number' ? l.campos.comprimento : undefined,
      fatorAntigo: fator,
      campos: Object.fromEntries(Object.entries(l.campos).filter(([k]) => !CAMPOS_TIRAR.includes(k))),
    }
  })
}
