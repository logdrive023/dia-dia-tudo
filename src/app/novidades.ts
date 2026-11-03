// NOVIDADES (changelog): o que mudou no sistema, em palavras simples, para quem usa entender. A cada rodada de mudanças,
// uma entrada nova no TOPO (mais nova primeiro). Cada item diz a área, o que mudou e, quando dá, a tela para ver.

export interface ItemNovidade {
  area: 'Triagem' | 'Etiquetas' | 'Estoque' | 'Comprar' | 'Venda' | 'Livro do cabelo' | 'Equipe' | 'Sistema'
  texto: string
  /** tela para abrir e ver a mudança */
  tela?: string
  params?: Record<string, string>
}

export interface Novidade {
  data: string
  titulo: string
  itens: ItemNovidade[]
}

export const NOVIDADES: Novidade[] = [
  {
    data: '2026-11-03',
    titulo: 'Celular em primeiro lugar: compra → triagem → etiqueta → venda',
    itens: [
      { area: 'Sistema', texto: 'Menu agrupado: Principal (Painel, Comprar, Triagem, Estoque, Etiquetas, Vender) sempre à vista; o resto em grupos que abrem e fecham.' },
      { area: 'Sistema', texto: 'Tema claro, escuro ou automático em Configurações (vale para cada aparelho).', tela: 'config' },
      { area: 'Sistema', texto: 'Explicações (ⓘ) mais fáceis de ler: frases em linhas, exemplo em destaque e dica 💡.' },
      { area: 'Sistema', texto: 'Filtros no mesmo padrão em todas as listas: busca + ⚙ Filtros, chips com ✕ e "Ver N resultados".' },
      { area: 'Comprar', texto: 'Compra "Sem valor": registre cabelo que já tinha (ou sem saber o preço) só com o peso; fica "Sem valor" no que falta.', tela: 'novaCompra' },
      { area: 'Comprar', texto: 'Pedido em abas: Resumo (itens + para onde foi), Pagamento, Conta do fornecedor, Anexos e Histórico.', tela: 'comprar' },
      { area: 'Comprar', texto: 'No celular, cada pedido é uma linha curta que abre no lugar; "O que falta" virou um resumo que abre.', tela: 'comprar' },
      { area: 'Triagem', texto: 'Abas de verdade: Para separar · Prontos · Para depois · Triagens feitas.', tela: 'triagem' },
      { area: 'Triagem', texto: 'Prontos em tabela (Medida · Lotes · Peso · Valor) com total em destaque; cada lote numa linha só.', tela: 'triagem', params: { aba: 'prontos' } },
      { area: 'Triagem', texto: 'Triagens feitas com números (entrou, saiu, perda) e filtros (período, quem, compra, perda acima de X%).', tela: 'triagem', params: { aba: 'triagens' } },
      { area: 'Triagem', texto: 'Separar ficou mais curto: peso, medida, categoria e cor à vista; o resto em "+ mais". Depois de separar, volta para a Triagem.' },
      { area: 'Etiquetas', texto: 'Impressão nova: cópias de cada pacote, folha A4 (21 por folha) com "começar na etiqueta N", rolo ou outro tamanho em mm, e limite por vez.', tela: 'etiquetas' },
      { area: 'Etiquetas', texto: 'Filtros por compra, lote, fornecedor, quem gerou, quem imprimiu, medida, cor, categoria e peso.', tela: 'etiquetas' },
      { area: 'Estoque', texto: 'Pacote em abas: Resumo mostra a vida do pacote (compra → triagem → etiqueta → venda), cada passo clicável.' },
      { area: 'Estoque', texto: 'Linha da vida do pacote (aba Detalhes): de onde veio e para onde foi cada grama, na ordem.' },
      { area: 'Estoque', texto: 'Histórico do pacote dividido por dia, com ícone por tipo e a referência de cada movimento à vista.' },
      { area: 'Estoque', texto: 'Fotos: dá para remover uma foto no próprio visor (fica no histórico).' },
      { area: 'Venda', texto: '"Vender" no pacote abre o modo caixa com o pacote dentro: fecha em 2 toques.', tela: 'vender' },
      { area: 'Venda', texto: 'Venda em abas (Resumo · Linha do tempo · Arquivos · Correções), total e ações no alto.', tela: 'vendas' },
      { area: 'Venda', texto: 'Corrigido: modo caixa aberto pelo pacote dizia "Pacote não encontrado".' },
      { area: 'Livro do cabelo', texto: 'Cada dia é um bloco que abre e fecha, modo Compacto e fechamento por compra recolhível.', tela: 'livro' },
      { area: 'Equipe', texto: 'Organograma novo: cartões limpos com os números do período; no celular vira lista em níveis.', tela: 'equipe' },
    ],
  },
]
