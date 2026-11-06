// VENDER — os tipos da venda montada na tela (linha e carrinho) e as categorias de reserva do cabelo.
import type { Id, Item } from '../../core/domain/tipos'
import { type PagamentoTela } from '../../ui/compartilhados'
import { type AjusteServico } from '../../ui/linhaServico'


/** categorias de reserva (quando a configuração de atributos não tem a lista) */
export const CATEGORIAS_RESERVA = ['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque']

export interface LinhaTela {
  id: Id
  itemId: Id
  nome: string
  quantidade: number
  moeda: string
  total: number
  profissionalId?: Id
  calculo?: { medida?: number; fator: string; categoria?: string; tabelaId?: Id; colunaId?: string }
  unidade: Item['unidade']
  /** salão: preço/insumos/% mudados no atendimento (vazio = catálogo e regra) */
  ajuste?: AjusteServico
}

/** o que já foi montado na venda: sobrevive a voltar para a escolha do que vender e à troca de passo */
export interface Carrinho {
  moduloId: string
  linhas: LinhaTela[]
  pagamentos: PagamentoTela[]
  pessoaId?: Id
}
