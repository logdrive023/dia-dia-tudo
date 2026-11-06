// CAIXA DO DIA — o que a tela do Caixa e as peças dela (saldo, lançar, fita dos dias) usam juntas: nomes da situação
// do dia, os botões de lançar, as categorias de despesa e a moeda/cotação de visualização guardadas no aparelho.
import { type TabelaCotacoes } from '../../core/domain/dinheiro'
import { cotacaoDigitada, lerCotacaoTexto } from '../../ui/compartilhados'


export const NOME_STATUS: Record<string, string> = { aberto: 'Aberto', encerrado: 'Encerrado', 'sem movimento': 'Sem movimento' }

/** Os botões de "Lançar dinheiro". Pagamento = paguei a uma pessoa (fornecedor, quem eu devo): acerto de conta. */
export type TipoLancar = 'dar' | 'entrada' | 'despesa' | 'retirada' | 'pagamento'

export const BOTOES: { tipo: TipoLancar; icone: string; nome: string; dica: string }[] = [
  { tipo: 'dar', icone: '🤝', nome: 'Dei dinheiro', dica: 'vale, ajuda, troco' },
  { tipo: 'entrada', icone: '➕', nome: 'Entrada', dica: 'entrou sem venda' },
  { tipo: 'despesa', icone: '🧾', nome: 'Despesa', dica: 'luz, aluguel, comida' },
  { tipo: 'retirada', icone: '🏦', nome: 'Retirada', dica: 'tirei do caixa' },
  { tipo: 'pagamento', icone: '💼', nome: 'Pagamento', dica: 'paguei a uma pessoa' },
]

export const CATEGORIAS_DESPESA = ['Aluguel', 'Luz e água', 'Comida', 'Transporte', 'Material', 'Outras despesas']

export const CHAVE_VER = 'caixa.verEm'

export const CHAVE_COT = 'caixa.cotacoes'

export function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch {
    return padrao
  }
}

export function gravarLocal(chave: string, v: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(v))
  } catch {
    /* sem armazenamento (aba anônima): só não lembra */
  }
}

/**
 * Tabela só para ver: a principal vale 1 e cada outra moeda vale o que foi digitado ("1 US$ = 6,96 Bs").
 * A conversão continua exata (a mesma do sistema).
 */
export function tabelaDaVisao(principal: string, textos: Record<string, string>): TabelaCotacoes {
  const tab: TabelaCotacoes = { [principal]: { moeda: principal, valor: '1', sentido: 'basePorMoeda', data: '' } }
  for (const [m, x] of Object.entries(textos)) {
    const v = lerCotacaoTexto(x)
    if (m !== principal && v) tab[m] = cotacaoDigitada(m, v, principal)
  }
  return tab
}
