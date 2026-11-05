// ENDEREÇOS (hash): cada tela tem um endereço que dá para copiar, abrir de novo e usar o "voltar" do navegador.
//   #/pedidos           → comprar          #/pedidos/novo → novaCompra      #/pedidos/P123 → pedido {id}
//   #/vendas/V1         → venda {id}       #/pessoas/X    → pessoa {id}     #/lotes/L1     → lote {id}
//   #/emprestimos/E1    → emprestimo {id}  #/config        → config (índice) #/config/triagem → configSecao {id}
//   #/viagens           → viagens          #/viagens/VG1  → viagem {id}   #/viagens/nova → novaViagem
//   outros: #/<tela>?chave=valor
// Hash (e não caminho) porque o app é publicado como site estático (GitHub Pages) e funciona sem servidor.

import type { Navegacao, Params } from '../ui/contexto'

/** Telas de detalhe e a lista "pai": acende o menu certo e é para onde o "voltar" leva quando não há histórico. */
export const PAI: Record<string, string> = {
  pedido: 'comprar',
  novaCompra: 'comprar',
  tabelaPreco: 'precos',
  lote: 'estoque',
  rastreio: 'estoque',
  separar: 'estoque',
  pessoa: 'pessoas',
  emprestimo: 'emprestimos',
  novoEmprestimo: 'emprestimos',
  venda: 'vendas',
  vendaRapida: 'vender',
  // a lista de vendas é a tela Vender (o menu acende Vender; endereços antigos #/vendas continuam abrindo a mesma lista)
  vendas: 'vender',
  configSecao: 'config',
  viagem: 'viagens',
  novaViagem: 'viagens',
  financiamento: 'adiantamentos',
  novoFinanciamento: 'adiantamentos',
}

/** Nome curto de cada tela para a TRILHA de navegação ("Compras › Pedido P-0007"); telas fora daqui mostram "Voltar". */
export const NOME_TELA: Record<string, string> = {
  painel: 'Painel', comprar: 'Compras', triagem: 'Triagem', estoque: 'Estoque', etiquetas: 'Etiquetas', vender: 'Vender',
  vendas: 'Vendas', caixa: 'Caixa', agenda: 'Agenda', viagens: 'Viagens', livro: 'Livro do cabelo', precos: 'Tabelas de preço',
  pessoas: 'Pessoas', equipe: 'Equipe', emprestimos: 'Empréstimos', adiantamentos: 'Adiantamentos', relatorios: 'Relatórios',
  config: 'Configurações', novidades: 'Novidades', auditoria: 'Auditoria', rastreio: 'Rastreio total', lote: 'Pacote', pedido: 'Pedido', venda: 'Venda',
  pessoa: 'Pessoa', viagem: 'Viagem', tabelaPreco: 'Tabela de preço', configSecao: 'Configurações',
}

/** Formulários: depois de salvar, o "voltar" não cai de novo neles (pula para a lista da área). */
const FORMULARIOS = new Set(['novaCompra', 'novoEmprestimo', 'novaViagem', 'novoFinanciamento', 'separar'])

/**
 * PARA ONDE O "VOLTAR" LEVA (regra única, usada pelo voltar do App e pela trilha de navegação, que mostra o destino):
 *  · IR E VOLTAR: veio de outra tela (lista OU detalhe: a venda, o pedido, o rastreio) → volta exatamente para ela
 *    (history.back: com a aba, os filtros e a rolagem de antes)
 *  · veio de um FORMULÁRIO (nova compra, separar…) → a lista "pai" da área (pulando até ela se está no histórico)
 *  · abriu por link (sem tela antes) → troca a tela atual pela lista da área
 */
export type DestinoVoltar = { alvo: Navegacao } & ({ modo: 'anterior' } | { modo: 'pular'; passos: number } | { modo: 'trocar' })
export function destinoVoltar(pl: Navegacao[]): DestinoVoltar {
  const atual = pl[pl.length - 1]
  const anterior = pl[pl.length - 2]
  const pai = PAI[atual.tela]
  if (anterior && !FORMULARIOS.has(anterior.tela)) return { modo: 'anterior', alvo: anterior }
  if (pai) for (let k = pl.length - 2; k >= 0; k--) if (pl[k].tela === pai && !pl[k].params.id) return { modo: 'pular', passos: k - (pl.length - 1), alvo: pl[k] }
  return { modo: 'trocar', alvo: { tela: pai ?? 'painel', params: {} } }
}

const COLECOES: Record<string, { lista: string; item: string; novo?: string }> = {
  pedidos: { lista: 'comprar', item: 'pedido', novo: 'novaCompra' },
  vendas: { lista: 'vendas', item: 'venda' },
  pessoas: { lista: 'pessoas', item: 'pessoa' },
  lotes: { lista: 'estoque', item: 'lote' },
  emprestimos: { lista: 'emprestimos', item: 'emprestimo', novo: 'novoEmprestimo' },
  precos: { lista: 'precos', item: 'tabelaPreco' },
  config: { lista: 'config', item: 'configSecao' },
  viagens: { lista: 'viagens', item: 'viagem', novo: 'novaViagem' },
  // adiantamentos a parceiros: #/adiantamentos, #/adiantamentos/novo, #/adiantamentos/<id>
  adiantamentos: { lista: 'adiantamentos', item: 'financiamento', novo: 'novoFinanciamento' },
}

/** Configurações antigas por aba (ir('config', { aba: 'triagem' }), #/config?aba=moedas) viram a seção: #/config/triagem. */
const ABA_ANTIGA: Record<string, string> = { cambio: 'moedas', socios: 'socias', formas: 'pagamentos' }

export function normalizarNav(n: Navegacao): Navegacao {
  if (n.tela !== 'config' || !n.params.aba) return n
  const { aba, ...params } = n.params
  return { tela: 'configSecao', params: { ...params, id: ABA_ANTIGA[String(aba)] ?? String(aba) } }
}

function query(params: Params, sem: string[] = []) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && !sem.includes(k)) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function navParaHash(n: Navegacao): string {
  for (const [col, r] of Object.entries(COLECOES)) {
    if (n.tela === r.lista && !n.params.id) return `#/${col}${query(n.params)}`
    if (n.tela === r.novo) return `#/${col}/novo${query(n.params)}`
    if (n.tela === r.item && n.params.id) return `#/${col}/${encodeURIComponent(String(n.params.id))}${query(n.params, ['id'])}`
  }
  // modo caixa (venda rápida): #/venda-rapida (também aceita #/vender/caixa)
  if (n.tela === 'vendaRapida') return `#/venda-rapida${query(n.params)}`
  if (n.tela === 'comprar' && n.params.id) return `#/pedidos/${encodeURIComponent(String(n.params.id))}`
  return `#/${n.tela}${query(n.params)}`
}

export function hashParaNav(hash: string): Navegacao | undefined {
  const h = hash.replace(/^#\/?/, '')
  if (!h) return undefined
  const [caminho, q = ''] = h.split('?')
  const params: Params = {}
  for (const [k, v] of new URLSearchParams(q)) params[k] = v === 'true' ? true : v
  const [a, b] = caminho.split('/').map(decodeURIComponent)
  if (a === 'venda-rapida' || (a === 'vender' && b === 'caixa')) return { tela: 'vendaRapida', params }
  const col = COLECOES[a]
  if (col) {
    if (!b) return normalizarNav({ tela: col.lista, params })
    if (b === 'novo' && col.novo) return { tela: col.novo, params }
    return { tela: col.item, params: { ...params, id: b } }
  }
  return { tela: a, params: b && params.id === undefined ? { ...params, id: b } : params }
}
