// ENDEREÇOS (hash): cada tela tem um endereço que dá para copiar, abrir de novo e usar o "voltar" do navegador.
//   #/pedidos           → comprar          #/pedidos/novo → novaCompra      #/pedidos/P123 → pedido {id}
//   #/vendas/V1         → venda {id}       #/pessoas/X    → pessoa {id}     #/lotes/L1     → lote {id}
//   #/emprestimos/E1    → emprestimo {id}  outros: #/<tela>?chave=valor
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
  vendas: 'painel',
}

const COLECOES: Record<string, { lista: string; item: string; novo?: string }> = {
  pedidos: { lista: 'comprar', item: 'pedido', novo: 'novaCompra' },
  vendas: { lista: 'vendas', item: 'venda' },
  pessoas: { lista: 'pessoas', item: 'pessoa' },
  lotes: { lista: 'estoque', item: 'lote' },
  emprestimos: { lista: 'emprestimos', item: 'emprestimo', novo: 'novoEmprestimo' },
  precos: { lista: 'precos', item: 'tabelaPreco' },
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
  const col = COLECOES[a]
  if (col) {
    if (!b) return { tela: col.lista, params }
    if (b === 'novo' && col.novo) return { tela: col.novo, params }
    return { tela: col.item, params: { ...params, id: b } }
  }
  return { tela: a, params }
}
