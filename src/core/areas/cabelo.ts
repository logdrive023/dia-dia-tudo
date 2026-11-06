// MÓDULO CABELO: compra (lote bruto) → triagem/separação em lotes por medida e categoria → vendas parciais.
// Preço pela tabela: medida (cm) × comprador → fator por grama. Ex.: 40 cm · 2.000 g × 3,5 = Bs 7.000.

import { diasEntre } from '../domain/datas'
import type { Item } from '../domain/tipos'
import type { DadosPainel, ModuloDef, Secao } from '../modulos'
import { custoDe } from '../services/estoque'

export const CATEGORIAS_CABELO = ['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque']

function faixa(cm: unknown): string {
  const n = Number(cm)
  if (!n) return 'Sem medida'
  if (n < 40) return 'até 39'
  if (n < 50) return '40–49'
  if (n < 60) return '50–59'
  if (n < 70) return '60–69'
  if (n < 80) return '70–79'
  return '80+'
}

const ehLote = (i: Item) => i.moduloId === 'cabelo' && i.tipoItem === 'lote'

function painelCabelo(d: DadosPainel): Secao[] {
  const lotes = d.itens.filter(ehLote)
  const comSaldo = lotes.filter((i) => i.saldo > 0)
  const brutos = comSaldo.filter((i) => (i.campos.estado === 'Bruto' || i.campos.estado === 'Não identificado'))
  const gramas = comSaldo.reduce((s, i) => s + i.saldo, 0)
  const valorCusto = comSaldo.reduce((s, i) => s + custoDe(i, i.saldo), 0)
  const linhasVendidas = d.vendas.flatMap((t) => t.linhas.filter((l) => d.moduloDoItem(l.itemId) === 'cabelo').map((l) => ({ t, l })))
  const gVendidas = linhasVendidas.reduce((s, x) => s + x.l.quantidade, 0)
  const receita = linhasVendidas.reduce((s, x) => s + x.l.totalPrincipal, 0)
  const custo = linhasVendidas.reduce((s, x) => s + (x.l.custoPrincipal ?? 0), 0)
  const comprasCabelo = d.compras.filter((t) => t.moduloId === 'cabelo')
  const gCompradas = comprasCabelo.reduce((s, t) => s + t.linhas.reduce((x, l) => x + l.quantidade, 0), 0)
  const valorCompras = comprasCabelo.reduce((s, t) => s + t.totalPrincipal, 0)
  const por1000 = (v: number, g: number) => (g ? Math.round((v * 1000) / g) : 0)

  // perda na separação (no período): o que saiu do lote-mãe e não virou lote-filho
  const movsPeriodo = d.movEstoque.filter((m) => m.data >= d.de && m.data <= d.ate && m.motivo === 'transformacao')
  const usado = -movsPeriodo.filter((m) => m.delta < 0 && lotes.some((l) => l.id === m.itemId)).reduce((s, m) => s + m.delta, 0)
  const gerado = movsPeriodo.filter((m) => m.delta > 0 && lotes.some((l) => l.id === m.itemId)).reduce((s, m) => s + m.delta, 0)

  // mapa: medida × categoria (gramas em estoque)
  const cats = [...new Set(comSaldo.map((i) => String(i.campos.categoria || 'Normal')))].sort()
  const faixas = ['até 39', '40–49', '50–59', '60–69', '70–79', '80+', 'Sem medida'].filter((f) => comSaldo.some((i) => faixa(i.campos.comprimento) === f))
  const mapa = faixas.map((f) => cats.map((c) => comSaldo.filter((i) => faixa(i.campos.comprimento) === f && String(i.campos.categoria || 'Normal') === c).reduce((s, i) => s + i.saldo, 0)))

  // por medida: vendido, receita, lucro, preço médio por kg
  const porMedida = new Map<string, { g: number; receita: number; custo: number }>()
  for (const { l } of linhasVendidas) {
    const lote = d.itens.find((i) => i.id === l.itemId)
    const k = String(l.campos.medida ?? lote?.campos.comprimento ?? '—')
    const a = porMedida.get(k) ?? { g: 0, receita: 0, custo: 0 }
    a.g += l.quantidade
    a.receita += l.totalPrincipal
    a.custo += l.custoPrincipal ?? 0
    porMedida.set(k, a)
  }

  // compradores e fornecedores
  const porCliente = new Map<string, { g: number; v: number }>()
  for (const { t, l } of linhasVendidas) {
    const nome = (t.pessoaId && d.pessoas.get(t.pessoaId)?.nome) || 'Sem nome'
    const a = porCliente.get(nome) ?? { g: 0, v: 0 }
    a.g += l.quantidade
    a.v += l.totalPrincipal
    porCliente.set(nome, a)
  }
  const porFornecedor = new Map<string, { g: number; v: number; n: number }>()
  for (const t of comprasCabelo) {
    const nome = (t.pessoaId && d.pessoas.get(t.pessoaId)?.nome) || 'Sem nome'
    const a = porFornecedor.get(nome) ?? { g: 0, v: 0, n: 0 }
    a.g += t.linhas.reduce((s, l) => s + l.quantidade, 0)
    a.v += t.totalPrincipal
    a.n++
    porFornecedor.set(nome, a)
  }

  // funil da triagem (compras abertas + concluídas/recusadas no período)
  const comprasTodas = d.todasTransacoes.filter((t) => t.tipo === 'compra' && t.moduloId === 'cabelo')
  const etapas: [string, string][] = [
    ['recebido', 'Chegou'],
    ['conferido', 'Conferido (pesado)'],
    ['pago', 'Pago'],
  ]
  const funil = [
    ...etapas.map(([id, nome]) => ({ nome, quantidade: comprasTodas.filter((t) => t.etapa === id).length, detalhe: { tela: 'comprar' } })),
    { nome: 'Concluído (no período)', quantidade: comprasCabelo.length, detalhe: { tela: 'comprar', filtro: { encerradas: true } } },
    { nome: 'Para separar (lotes brutos)', quantidade: brutos.length, detalhe: { tela: 'triagem' } },
  ]

  return [
    {
      tipo: 'cartoes',
      titulo: 'Cabelo agora',
      cartoes: [
        { id: 'cab.estoque', nome: 'Em estoque', valor: gramas, formato: 'gramas', ajuda: 'Soma das gramas de todos os lotes. Ex.: 20 kg preto + 19,5 kg castanho = 39,5 kg.', detalhe: { tela: 'estoque', filtro: { modulo: 'cabelo' } } },
        { id: 'cab.valor', nome: 'Estoque a custo', valor: valorCusto, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Quanto custou o cabelo que está parado. Ex.: 1 kg que custou Bs 12.000 → Bs 12.000.', detalhe: { tela: 'relatorios', filtro: { relatorio: 'inventario' } } },
        { id: 'cab.brutos', nome: 'Lotes para separar', valor: brutos.reduce((s, i) => s + i.saldo, 0), formato: 'gramas', ajuda: 'Cabelo comprado em bruto que ainda não passou pela separação por medida/categoria.', detalhe: { tela: 'triagem' }, destaque: brutos.length ? 'alerta' : undefined },
        { id: 'cab.lotes', nome: 'Lotes com saldo', valor: comSaldo.length, formato: 'numero', ajuda: 'Quantos lotes ainda têm cabelo.', detalhe: { tela: 'estoque', filtro: { modulo: 'cabelo' } } },
      ],
    },
    {
      tipo: 'cartoes',
      titulo: 'Cabelo no período',
      cartoes: [
        { id: 'cab.comprado', nome: 'Comprado', valor: gCompradas, formato: 'gramas', ajuda: 'Gramas que entraram no estoque por compra.', detalhe: { tela: 'comprar', filtro: { encerradas: true } } },
        { id: 'cab.vendido', nome: 'Vendido', valor: gVendidas, formato: 'gramas', ajuda: 'Gramas vendidas.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: 'cabelo' } } },
        { id: 'cab.receita', nome: 'Receita', valor: receita, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Valor vendido de cabelo. Ex.: 2.000 g × 3,5 = Bs 7.000.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: 'cabelo' } } },
        { id: 'cab.lucro', nome: 'Lucro', valor: receita - custo, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Receita − custo do cabelo que saiu (pelo custo do lote).', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: 'cabelo' } }, destaque: receita - custo < 0 ? 'ruim' : 'bom' },
        { id: 'cab.custoKg', nome: 'Custo médio por kg', valor: por1000(valorCompras, gCompradas), formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Quanto custou cada quilo comprado no período.' },
        { id: 'cab.precoKg', nome: 'Preço médio por kg', valor: por1000(receita, gVendidas), formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Quanto rendeu cada quilo vendido.' },
        { id: 'cab.perda', nome: 'Perda na separação', valor: usado ? Math.round(((usado - gerado) / usado) * 10000) : 0, formato: 'percentual', ajuda: 'Quanto do cabelo separado virou perda. Ex.: separou 40 kg e saíram 39,5 kg → 1,25%.' },
      ],
    },
    { tipo: 'funil', titulo: 'Triagem (da compra ao estoque)', ajuda: 'Quantas compras estão em cada passo. Toque para ver.', etapas: funil },
    { tipo: 'mapa', titulo: 'Estoque: medida × categoria (gramas)', ajuda: 'Onde está o cabelo parado.', formato: 'gramas', linhas: faixas, colunas: cats, valores: mapa },
    {
      tipo: 'tabela',
      titulo: 'Vendas por medida',
      colunas: [
        { id: 'medida', nome: 'Medida' },
        { id: 'g', nome: 'Vendido', formato: 'gramas' },
        { id: 'receita', nome: 'Receita', formato: 'dinheiro' },
        { id: 'lucro', nome: 'Lucro', formato: 'dinheiro' },
        { id: 'kg', nome: 'Preço/kg', formato: 'dinheiro' },
      ],
      linhas: [...porMedida]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([medida, a]) => ({ valores: { medida: `${medida} cm`, g: a.g, receita: a.receita, lucro: a.receita - a.custo, kg: por1000(a.receita, a.g) } })),
    },
    {
      tipo: 'barras',
      titulo: 'Quem mais comprou (gramas)',
      formato: 'gramas',
      itens: [...porCliente].sort((a, b) => b[1].g - a[1].g).slice(0, 10).map(([rotulo, a]) => ({ rotulo, valor: a.g })),
    },
    {
      tipo: 'tabela',
      titulo: 'Fornecedores',
      colunas: [
        { id: 'nome', nome: 'Fornecedor' },
        { id: 'n', nome: 'Compras', formato: 'numero' },
        { id: 'g', nome: 'Gramas', formato: 'gramas' },
        { id: 'v', nome: 'Valor', formato: 'dinheiro' },
        { id: 'kg', nome: 'Custo/kg', formato: 'dinheiro' },
      ],
      linhas: [...porFornecedor].sort((a, b) => b[1].g - a[1].g).map(([nome, a]) => ({ valores: { nome, n: a.n, g: a.g, v: a.v, kg: por1000(a.v, a.g) } })),
    },
  ]
}

export const moduloCabelo: ModuloDef = {
  id: 'cabelo',
  nome: 'Cabelo',
  icone: '💇‍♀️',
  descricao: 'Compra, separação, estoque em gramas e venda pela tabela de preço.',
  tiposItem: [
    {
      id: 'lote',
      nome: 'Lote de cabelo',
      unidade: 'grama',
      controlaEstoque: true,
      nasceNaCompra: true,
      campos: [
        { id: 'estado', nome: 'Situação', tipo: 'lista', opcoes: ['Bruto', 'Não identificado', 'Separado'], fixo: true, ajuda: 'Bruto = ainda não foi separado por medida/categoria.' },
        { id: 'comprimento', nome: 'Medida', tipo: 'numero', unidade: 'cm', fixo: true, ajuda: 'Comprimento em cm (40, 50, 55, 60…). Bruto misturado pode ficar sem medida.' },
        { id: 'categoria', nome: 'Categoria', tipo: 'lista', opcoes: CATEGORIAS_CABELO, fixo: true, ajuda: 'Normal, Tinte (tingido), CH, Rojo, Quemado… Cada uma pode ter sua tabela de preço.' },
        { id: 'cor', nome: 'Cor', tipo: 'lista', opcoes: ['Preto', 'Castanho escuro', 'Castanho', 'Castanho claro', 'Loiro', 'Ruivo', 'Grisalho', 'Misturado'] },
        { id: 'textura', nome: 'Textura', tipo: 'lista', opcoes: ['Liso', 'Ondulado', 'Cacheado', 'Crespo'] },
        { id: 'origem', nome: 'Origem', tipo: 'lista', opcoes: ['Bolívia', 'Paraguai', 'Brasil', 'Peru', 'Outro'] },
        { id: 'remy', nome: 'Remy (cutícula alinhada)', tipo: 'simNao', ajuda: 'Fios no mesmo sentido, da raiz à ponta. Não quer dizer virgem.' },
        { id: 'obs', nome: 'Observação', tipo: 'texto' },
      ],
      nomear: (c) => {
        const partes = [c.comprimento ? `${c.comprimento} cm` : c.estado === 'Bruto' ? 'Bruto' : 'Sem medida', String(c.categoria || 'Normal')]
        if (c.cor) partes.push(String(c.cor))
        return partes.join(' · ')
      },
    },
  ],
  compra: {
    tipoItem: 'lote',
    avisarParadaDias: 3,
    pedirComprovanteOrigem: true,
    etapas: [
      { id: 'recebido', nome: 'Chegou', ajuda: 'O cabelo chegou (ou foi oferecido). Tire fotos.', lembrar: ['fotos'] },
      { id: 'conferido', nome: 'Conferido', ajuda: 'Pesado e conferido: ajuste gramas e valor se for preciso (fica registrado o motivo).' },
      { id: 'pago', nome: 'Pago', ajuda: 'Pagamento feito (pode ser parte: o resto fica na conta da pessoa).', faz: ['pagamento'], lembrar: ['comprovante'] },
      // o lote já nasce no registro da compra (cai na Triagem como "Aguardando triagem"); esta etapa só fecha o pedido
      { id: 'concluido', nome: 'Concluído', ajuda: 'Pagamento e entrega acertados. O cabelo já está na Triagem desde que a compra foi registrada.', faz: ['estoque'] },
    ],
  },
  venda: {
    pergunta: 'É cabelo?',
    ajuda: 'Venda por medida e gramas, com o preço da tabela (gramas × fator).',
    tiposItem: ['lote'],
  },
  painel: painelCabelo,
  alertas: (d) => {
    const lotes = d.itens.filter((i) => ehLote(i) && i.saldo > 0)
    const brutos = lotes.filter((i) => (i.campos.estado === 'Bruto' || i.campos.estado === 'Não identificado'))
    // esperando na triagem há mais dias que o aviso da compra (padrão 3)
    const aviso = moduloCabelo.compra?.avisarParadaDias ?? 3
    const diasNaFila = (i: Item) => diasEntre((i.faseTriagem?.desde ?? i.criadoEm).slice(0, 10), d.hoje)
    const esperando = brutos.filter((i) => diasNaFila(i) > aviso).sort((a, b) => diasNaFila(b) - diasNaFila(a))
    // "X kg aguardando triagem" (o bruto entra na Triagem no registro da compra): quantos kg e há quantos dias o mais antigo
    const porIdade = [...brutos].sort((a, b) => diasNaFila(b) - diasNaFila(a))
    const kgAguardando = (brutos.reduce((s, i) => s + i.saldo, 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    const maisAntigo = porIdade[0] ? diasNaFila(porIdade[0]) : 0
    const parados = lotes.filter((i) => {
      const ult = d.movEstoque.filter((m) => m.itemId === i.id).map((m) => m.data).sort().pop() ?? i.criadoEm.slice(0, 10)
      return diasEntre(ult, d.hoje) > 60
    })
    return [
      // UM alerta para todo o bruto parado: "X kg aguardando triagem · o mais antigo há N dias" (atenção quando passa do aviso)
      { id: 'cab.triagem', texto: `${kgAguardando} kg aguardando triagem · o mais antigo há ${maisAntigo} dia(s)`, acao: esperando.length ? `${esperando.length} lote(s) passaram de ${aviso} dias: abra a Triagem e separe para poder vender.` : 'Abra a Triagem e separe quando puder; nada some enquanto espera.', quantidade: brutos.length, nivel: esperando.length ? 'alerta' : 'info', detalhe: { tela: 'triagem', filtro: esperando.length ? { f: 'atrasados' } : undefined },
        itens: porIdade.slice(0, 5).map((i) => ({ texto: `${i.codigo ?? ''} · ${i.nome}`, sub: `${(i.saldo / 1000).toLocaleString('pt-BR')} kg · ${diasNaFila(i)} d`, detalhe: { tela: 'lote', filtro: { id: i.id } } })) },
      { id: 'cab.parados', texto: 'lote(s) parado(s) há mais de 60 dias', quantidade: parados.length, nivel: 'info', detalhe: { tela: 'estoque', filtro: { modulo: 'cabelo' } } },
    ]
  },
}
