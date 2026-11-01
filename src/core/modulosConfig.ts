// MODALIDADES MONTADAS PELA TELA (plug-and-play): a pessoa escolhe os recursos e o núcleo gera o módulo.
// Combina peças que já existem: estoque (peça/grama), triagem na compra, tabela de preço por multiplicador
// (como o cabelo), atendimento com agenda (como o salão) e campos próprios. Nada é programado.

import type { CampoDef, DadosPainel, EtapaDef, ModuloDef, Secao } from './modulos'
import type { Unidade } from './domain/tipos'

export interface ModuloConfig {
  id: string
  nome: string
  icone: string
  descricao?: string
  recursos: {
    /** controla estoque? em que unidade? */
    estoque: false | Unidade
    /** compras passam por triagem com estas etapas (a última entra no estoque) */
    triagem?: string[]
    /** cada compra vira um lote novo (como o cabelo) */
    loteNaCompra?: boolean
    /** preço pela tabela medida × comprador (multiplicador) */
    tabelaPreco?: boolean
    /** atendimento com endereço, profissional e agenda (como o salão) */
    agenda?: boolean
    /** retorno sugerido em dias (ex.: manutenção) */
    retornoDias?: number
  }
  campos: CampoDef[]
}

function painelGenerico(m: ModuloConfig) {
  return (d: DadosPainel): Secao[] => {
    const itens = d.itens.filter((i) => i.moduloId === m.id)
    const linhas = d.vendas.flatMap((t) => t.linhas.filter((l) => d.moduloDoItem(l.itemId) === m.id))
    const receita = linhas.reduce((s, l) => s + l.totalPrincipal, 0)
    const lucro = linhas.reduce((s, l) => s + l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0), 0)
    const fmtQtd = m.recursos.estoque === 'grama' ? 'gramas' : 'numero'
    const porItem = new Map<string, number>()
    for (const l of linhas) porItem.set(l.descricao, (porItem.get(l.descricao) ?? 0) + l.totalPrincipal)
    return [
      {
        tipo: 'cartoes',
        titulo: m.nome,
        cartoes: [
          ...(m.recursos.estoque
            ? [{ id: `${m.id}.estoque`, nome: 'Em estoque', valor: itens.reduce((s, i) => s + i.saldo, 0), formato: fmtQtd as 'gramas' | 'numero', ajuda: 'Quantidade em estoque.', detalhe: { tela: 'estoque', filtro: { modulo: m.id } } }]
            : []),
          { id: `${m.id}.vendas`, nome: 'Vendas', valor: new Set(d.vendas.filter((t) => t.linhas.some((l) => d.moduloDoItem(l.itemId) === m.id)).map((t) => t.id)).size, formato: 'numero', ajuda: 'Vendas/atendimentos no período.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: m.id } } },
          { id: `${m.id}.receita`, nome: 'Receita', valor: receita, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Soma do que foi vendido.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: m.id } } },
          { id: `${m.id}.lucro`, nome: 'Lucro', valor: lucro, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Receita − custo − comissões.' },
        ],
      },
      { tipo: 'barras', titulo: 'Mais vendidos', formato: 'dinheiro', itens: [...porItem].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([rotulo, valor]) => ({ rotulo, valor })) },
    ]
  }
}

/** Gera o módulo a partir da configuração (é isso que deixa criar modalidades sem programar). */
export function moduloDeConfig(m: ModuloConfig): ModuloDef {
  const unidade: Unidade = m.recursos.estoque || 'servico'
  const etapas: EtapaDef[] | undefined = m.recursos.estoque
    ? [
        ...(m.recursos.triagem?.length ? m.recursos.triagem : ['Pedido feito']).map((nome, k): EtapaDef => ({ id: `e${k}`, nome, ajuda: nome })),
        { id: 'pago', nome: 'Pago', ajuda: 'Pagamento feito.', faz: ['pagamento'] },
        { id: 'concluido', nome: 'No estoque', ajuda: 'Entrou no estoque.', faz: ['estoque'] },
      ]
    : undefined
  const campos: CampoDef[] = [...(m.recursos.tabelaPreco ? [{ id: 'comprimento', nome: 'Medida', tipo: 'numero' as const }] : []), ...m.campos]
  return {
    id: m.id,
    nome: m.nome,
    icone: m.icone || '📦',
    descricao: m.descricao ?? 'Modalidade criada pela tela.',
    tiposItem: [
      {
        id: 'item',
        nome: m.recursos.estoque ? 'Item' : 'Serviço',
        unidade,
        controlaEstoque: !!m.recursos.estoque,
        nasceNaCompra: !!m.recursos.loteNaCompra,
        campos,
        nomear: m.recursos.loteNaCompra ? (c) => [m.nome, c.comprimento ? `${c.comprimento}` : '', ...m.campos.map((x) => c[x.id]).filter(Boolean)].filter(Boolean).join(' · ') : undefined,
      },
    ],
    compra: etapas ? { tipoItem: 'item', etapas, avisarParadaDias: 7 } : undefined,
    venda: { pergunta: `É ${m.nome.toLowerCase()}?`, ajuda: m.descricao ?? m.nome, tiposItem: ['item'], atendimento: !!m.recursos.agenda },
    painel: painelGenerico(m),
    recursos: m.recursos,
    personalizado: true,
  }
}
