// O DOCUMENTO DA VENDA (a NOTA DE VENTA): junta os dados da venda, da empresa (Configurações › Fiscal) e da cliente
// numa estrutura pronta para qualquer modelo (dados/documentos.ts) — a tela e a impressão só desenham.
// Nada de conta nova aqui: totais, descontos e pagamentos são os da venda; os impostos são os ESTIMADOS que a venda
// guardou na hora (impostosRegistro.ts), ou, em venda antiga sem esse registro, a mesma regra do regime de hoje.
import type { Id, Unidade } from '../domain/tipos'
import { MODELO_PADRAO, totalPorExtenso } from '../dados/documentos'
import { type Ctx, lerConfig } from './contexto'
import { venda } from './vendas'
import { calcularDivisao } from '../domain/divisao'
import { detalheDeValores, impostosDaVenda } from './divisao'

const UNIDADE: Record<Unidade, string> = { grama: 'g', peca: 'Unidad', servico: 'Servicio' }

export async function documentoVenda(ctx: Ctx, p: { id: Id }) {
  // a mesma consulta da tela da venda (e a mesma regra de quem pode ver)
  const d = await venda(ctx, p)
  const v = d.venda
  const cfg = await lerConfig(ctx)
  const fis = cfg.fiscal
  const m = v.moedaPrincipal
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))

  // DETALHE: tudo na moeda principal (a venda pode ter linhas em outra moeda; o total do papel é um só)
  const linhas = v.linhas.map((l) => {
    const it = l.itemId ? itens.get(l.itemId) : undefined
    const ehServico = it?.tipoItem === 'servico' || it?.moduloId === 'salao'
    const desconto = l.descontoPrincipal ?? 0
    const bruto = l.totalPrincipal + desconto
    const unidade = it?.unidade ?? (ehServico ? 'servico' : 'peca')
    const qtd = l.quantidade || 1
    return {
      id: l.id,
      codigo: it?.codigo ?? '',
      descricao: l.descricao,
      quantidade: qtd,
      unidade: UNIDADE[unidade],
      gramas: unidade === 'grama',
      precoUnitario: Math.round(bruto / qtd),
      desconto,
      subtotal: l.totalPrincipal,
    }
  })
  const descontos = linhas.reduce((s, l) => s + l.desconto, 0)
  const subtotal = linhas.reduce((s, l) => s + l.subtotal + l.desconto, 0)

  // IMPOSTOS (estimados): a MESMA conta da divisão de valores (o registro do dia; sem ele, a regra do regime de hoje)
  const impostos = await impostosDaVenda(ctx, v)

  // PAGAMENTOS: cada forma (com a moeda em que entrou) e o saldo
  const nomeForma = (id: string) => cfg.formas.find((f) => f.id === id)?.nome ?? id
  const pagamentos = v.pagamentos.map((x) => ({ forma: nomeForma(x.forma), valor: x.valor, moeda: x.moeda, valorPrincipal: x.valorPrincipal }))
  const pago = v.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0)
  // a mesma tolerância da tela: até 1 centavo por pagamento é arredondamento de câmbio
  const folga = v.pagamentos.length
  const saldo = v.etapa === 'concluido' && v.totalPrincipal - pago > folga ? v.totalPrincipal - pago : 0
  const troco = pago - v.totalPrincipal > folga ? pago - v.totalPrincipal : 0

  // o que falta para o papel ficar completo (a tela avisa; o papel mostra "—")
  const faltando: string[] = []
  if (!fis.razaoSocial?.trim()) faltando.push('razão social da empresa')
  if (!fis.nit?.trim()) faltando.push('NIT da empresa')
  if (!fis.endereco?.trim()) faltando.push('endereço da empresa')
  if (!d.cliente) faltando.push('nome da cliente')
  else if (!d.cliente.documento?.trim()) faltando.push('NIT/CI da cliente')

  // a DIVISÃO gravada (aba Divisão de valores): cada parte com quanto leva e o que fica com a casa — vai na nota se ligar
  const det = detalheDeValores(v, true, impostos)
  const div = calcularDivisao(v.divisao?.partes ?? [], { total: det.totais.cobrado, liquido: det.totais.liquido, lucro: det.totais.lucro ?? 0 })
  const BASE_ES = { total: 'del total facturado', liquido: 'de las ventas netas', lucro: 'de la utilidad de la venta' } as const
  const divisao = { partes: div.partes.map((p) => ({ nome: p.nome, valor: p.calculado, como: p.modo === 'pct' ? `${((p.pctBp ?? 0) / 100).toLocaleString('es-BO')}% ${BASE_ES[p.base]}` : 'monto fijo' })), casa: div.casa }

  return {
    divisao,
    modeloPadrao: cfg.modeloNota ?? MODELO_PADRAO,
    impostosNaNota: cfg.impostosNaNota !== false,
    pais: fis.pais,
    moeda: m,
    situacao: v.etapa,
    emisor: {
      razaoSocial: fis.razaoSocial?.trim() || cfg.nomeNegocio,
      nomeComercial: fis.razaoSocial?.trim() && cfg.nomeNegocio !== fis.razaoSocial ? cfg.nomeNegocio : '',
      nit: fis.nit?.trim() ?? '',
      endereco: fis.endereco?.trim() ?? '',
      atividade: fis.atividade?.trim() ?? '',
      sucursal: d.local?.nome ?? '',
    },
    numero: v.codigo ?? v.id.slice(-6).toUpperCase(),
    data: v.data,
    emitidoEm: v.criadoEm,
    atendidoPor: d.profissional?.nome ?? '',
    comprador: { nome: d.cliente?.nome ?? '', documento: d.cliente?.documento?.trim() ?? '', telefone: d.cliente?.telefone ?? '' },
    linhas,
    totais: { subtotal, descontos, total: v.totalPrincipal, pago, saldo, troco, emPalavras: totalPorExtenso(v.totalPrincipal, m) },
    impostos,
    pagamentos,
    faltando,
  }
}

export type DocumentoVenda = Awaited<ReturnType<typeof documentoVenda>>
