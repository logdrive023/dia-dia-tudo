// MÓDULO DE EXEMPLO "Produtos gerais" (peças e cores, como o Dia a Dia).
// Prova de que o núcleo é genérico: este módulo é SÓ configuração, sem nenhuma linha no núcleo.

import type { ModuloDef } from '../core/modulos'

export const moduloProdutos: ModuloDef = {
  id: 'produtos',
  nome: 'Produtos',
  icone: '🛍️',
  descricao: 'Peças com cor (bijuteria, acessórios, roupas…): exemplo de módulo feito só com configuração.',
  tiposItem: [
    {
      id: 'peca',
      nome: 'Peça',
      unidade: 'peca',
      controlaEstoque: true,
      campos: [
        { id: 'grupo', nome: 'Grupo', tipo: 'texto' },
        { id: 'cor', nome: 'Cor', tipo: 'texto' },
      ],
    },
  ],
  compra: {
    tipoItem: 'peca',
    avisarParadaDias: 7,
    etapas: [
      { id: 'recebido', nome: 'Pedido feito', ajuda: 'Pedido ao fornecedor.' },
      { id: 'pago', nome: 'Pago', ajuda: 'Pagamento feito.', faz: ['pagamento'] },
      { id: 'concluido', nome: 'Chegou', ajuda: 'Entrou no estoque.', faz: ['estoque'] },
    ],
  },
  venda: { pergunta: 'É produto?', ajuda: 'Peças do estoque.', tiposItem: ['peca'] },
  painel: (d) => {
    const pecas = d.itens.filter((i) => i.moduloId === 'produtos')
    const linhas = d.vendas.flatMap((t) => t.linhas.filter((l) => d.moduloDoItem(l.itemId) === 'produtos'))
    const porItem = new Map<string, number>()
    for (const l of linhas) porItem.set(l.descricao, (porItem.get(l.descricao) ?? 0) + l.quantidade)
    return [
      {
        tipo: 'cartoes',
        titulo: 'Produtos',
        cartoes: [
          { id: 'prod.estoque', nome: 'Peças em estoque', valor: pecas.reduce((s, i) => s + i.saldo, 0), formato: 'numero', ajuda: 'Soma das peças.', detalhe: { tela: 'estoque', filtro: { modulo: 'produtos' } } },
          { id: 'prod.vendidas', nome: 'Peças vendidas', valor: linhas.reduce((s, l) => s + l.quantidade, 0), formato: 'numero', ajuda: 'No período.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: 'produtos' } } },
          { id: 'prod.repor', nome: 'Para repor', valor: pecas.filter((i) => i.estoqueIdeal && i.saldo < i.estoqueIdeal).length, formato: 'numero', ajuda: 'Peças abaixo do estoque ideal.', detalhe: { tela: 'estoque', filtro: { repor: true } } },
        ],
      },
      { tipo: 'barras', titulo: 'Mais vendidas', formato: 'numero', itens: [...porItem].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([rotulo, valor]) => ({ rotulo, valor })) },
    ]
  },
}
