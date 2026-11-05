// DIVISÃO DE VALORES DA VENDA — o detalhe do dinheiro (bruto → desconto → cobrado → impostos → líquido → custo, insumos
// e comissão → lucro), linha por linha, e a DIVISÃO com quem for preciso (por % de uma base ou por valor fixo).
// A divisão é REGISTRO: fica gravada na venda (com o histórico), mas não move o caixa nem muda a venda.
// Definições (as mesmas do resto do sistema):
//  · bruto = o preço cheio da linha (antes do desconto) · cobrado = bruto − desconto (o total da venda)
//  · impostos = os ESTIMADOS do dia da venda (impostosRegistro), repartidos entre as linhas pelo valor de cada uma
//  · líquido = cobrado − impostos · lucro = cobrado − custo do cabelo − insumos − comissão (o do Painel, antes dos impostos)
import { formatar } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id, ParteDivisao, Transacao } from '../domain/tipos'
import { auditar, type Ctx, exigirVersao, lerConfig, novo, tocar } from './contexto'
import { impostosDaOperacao, impostosDoRegime } from '../dados/impostos'
import { venda } from './vendas'
import { calcularDivisao } from '../domain/divisao'

const admin = (ctx: Ctx) => ctx.sessao.perfil === 'admin'

/**
 * OS IMPOSTOS ESTIMADOS DA VENDA — a mesma conta para a nota e para a divisão: o registro do dia da venda
 * (impostosRegistro); venda antiga sem registro → a regra do regime de hoje (produto × serviço, cada um com a sua taxa).
 */
export async function impostosDaVenda(ctx: Ctx, t: Transacao) {
  const cfg = await lerConfig(ctx)
  const fis = cfg.fiscal
  const reg = impostosDoRegime(fis)
  const guardado = t.impostosEstimados
  let calc: ReturnType<typeof impostosDaOperacao> | undefined
  if (!guardado) {
    const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
    let produto = 0
    let servico = 0
    for (const l of t.linhas) {
      const it = l.itemId ? itens.get(l.itemId) : undefined
      if (it?.tipoItem === 'servico' || it?.moduloId === 'salao') servico += l.totalPrincipal
      else produto += l.totalPrincipal
    }
    calc = impostosDaOperacao(reg.lista, { produto, servico }, fis.modoPreco ?? 'dentro')
  }
  return {
    modoPreco: guardado?.modoPreco ?? calc!.modoPreco,
    linhas: (guardado?.linhas ?? calc!.linhas).filter((l) => l.lado === 'venda').map((l) => ({ sigla: l.sigla, nome: l.nome, taxaBp: l.taxaBp, base: l.base, valor: l.valor })),
    total: guardado?.total ?? calc!.venda,
    doDia: !!guardado,
    aviso: reg.aviso,
  }
}
export type ImpostosDaVenda = Awaited<ReturnType<typeof impostosDaVenda>>

/** uma linha do ESTADO DE RESULTADO da venda (o mesmo jeito do relatório contábil): nome em pt e o termo oficial em es */
export interface LinhaEstado {
  id: string
  pt: string
  es: string
  valor: number
  /** conta (−), subtotal (= com linha em cima) ou total (= com linha dupla) */
  tipo: 'conta' | 'subtotal' | 'total'
  /** % do total faturado (análise vertical) */
  pctBp: number
  ajuda: string
}

/**
 * O ESTADO DE RESULTADO DA VENDA — o padrão boliviano do relatório contábil (Normas de Contabilidad CTNAC/CAUB; impostos
 * da Ley 843), aplicado a uma venda só:
 *   bloco COMERCIAL (o mesmo da factura): preço de lista − descontos e bonificações = TOTAL FATURADO
 *   bloco CONTÁBIL: − IVA débito fiscal = VENDAS LÍQUIDAS · − custo das vendas − insumos e comissões = LUCRO BRUTO
 *                   · − IT (e outros impostos sobre a receita) = RESULTADO DA VENDA (antes do IUE, que é anual)
 * Os impostos são os ESTIMADOS da venda (impostosDaVenda), repartidos entre as linhas pelo valor faturado de cada uma.
 * Custo e resultado só para o administrador.
 */
export function detalheDeValores(t: Transacao, verCusto: boolean, imp: ImpostosDaVenda) {
  const facturadoTotal = t.linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  const ivaTotal = imp.linhas.filter((l) => l.sigla === 'IVA').reduce((s, l) => s + l.valor, 0)
  const outros = imp.linhas.filter((l) => l.sigla !== 'IVA')
  const outrosTotal = outros.reduce((s, l) => s + l.valor, 0)
  // reparte um total pelas linhas, pelo faturado de cada uma (a última fica com a sobra do arredondamento)
  const repartir = (total: number) => {
    let resto = total
    return t.linhas.map((l, k) => {
      const v = k === t.linhas.length - 1 ? resto : facturadoTotal ? Math.round((total * l.totalPrincipal) / facturadoTotal) : 0
      resto -= v
      return v
    })
  }
  const ivaL = repartir(ivaTotal)
  const outrosL = repartir(outrosTotal)
  const linhas = t.linhas.map((l, k) => {
    const desconto = l.descontoPrincipal ?? 0
    const facturado = l.totalPrincipal
    const netas = facturado - ivaL[k]
    const custo = l.custoPrincipal ?? 0
    const servicos = (l.insumoPrincipal ?? 0) + (l.comissaoPrincipal ?? 0)
    const bruta = netas - custo - servicos
    const resultado = bruta - outrosL[k]
    return {
      id: l.id, descricao: l.descricao, quantidade: l.quantidade,
      lista: facturado + desconto, desconto, facturado, iva: ivaL[k], netas, outros: outrosL[k],
      ...(verCusto ? { custo, servicos, bruta, resultado, margemBp: facturado ? Math.round((resultado * 10000) / facturado) : 0 } : {}),
    }
  })
  const soma = (f: (l: (typeof linhas)[number]) => number | undefined) => linhas.reduce((s, l) => s + (f(l) ?? 0), 0)
  const lista = soma((l) => l.lista)
  const desconto = soma((l) => l.desconto)
  const custo = soma((l) => l.custo)
  const servicos = soma((l) => l.servicos)
  const netas = facturadoTotal - ivaTotal
  const bruta = netas - custo - servicos
  const resultado = bruta - outrosTotal
  const pct = (v: number) => (facturadoTotal ? Math.round((v * 10000) / facturadoTotal) : 0)
  const pctTaxa = (bp: number) => `${(bp / 100).toLocaleString('pt-BR')}%`
  const L = (id: string, pt: string, es: string, valor: number, tipo: LinhaEstado['tipo'], ajuda: string): LinhaEstado => ({ id, pt, es, valor, tipo, pctBp: pct(valor), ajuda })
  const iva = imp.linhas.find((l) => l.sigla === 'IVA')
  const estado: LinhaEstado[] = [
    // bloco comercial (o mesmo da factura)
    L('lista', 'Preço de lista', 'Precio de lista', lista, 'conta', 'O preço de tabela de cada item, antes do desconto (o "SUBTOTAL" da factura).'),
    L('desconto', '(−) Descontos e bonificações', 'Descuentos y bonificaciones', -desconto, 'conta', 'O desconto comercial dado na venda, já repartido entre os itens (o "DESCUENTO" da factura).'),
    L('facturado', 'Total faturado', ivaTotal ? 'Ventas brutas (facturado)' : 'Ventas', facturadoTotal, 'subtotal', 'O que a cliente paga: o total da venda (o "TOTAL" da factura).'),
    // bloco contábil
    ...(ivaTotal ? [
      L('iva', `(−) IVA débito fiscal (${pctTaxa(iva!.taxaBp)})`, 'IVA débito fiscal', -ivaTotal, 'conta', 'O IVA vem DENTRO do preço e é do fisco: sai da venda antes de tudo (Ley 843). Estimado no dia da venda.'),
      L('netas', 'Vendas líquidas', 'Ventas netas', netas, 'subtotal', 'Total faturado − IVA: o que é do negócio.'),
    ] : []),
    ...(verCusto ? [
      L('costo', '(−) Custo das vendas', 'Costo de ventas', -custo, 'conta', 'Quanto custou o cabelo ou o produto que saiu (pela compra).'),
      ...(servicos ? [L('servicios', '(−) Insumos e comissões', 'Insumos y comisiones de servicios', -servicos, 'conta', 'Tinta, produtos do serviço e a parte da profissional.')] : []),
      L('bruta', 'Lucro bruto', 'Utilidad bruta', bruta, 'subtotal', 'Vendas líquidas − custo − insumos e comissões.'),
      ...outros.map((o) => L(`imp-${o.sigla}`, `(−) ${o.sigla === 'IT' ? 'Imposto sobre Transações' : o.nome} (${o.sigla} ${pctTaxa(o.taxaBp)})`, o.sigla === 'IT' ? 'Impuesto a las Transacciones' : o.nome, -o.valor, 'conta', o.sigla === 'IT' ? 'O IT incide sobre o faturamento bruto e entra como gasto, depois do lucro bruto (Ley 843). Estimado.' : 'Imposto estimado sobre a receita.')),
      L('resultado', 'Resultado da venda (antes do IUE)', 'Utilidad de la venta (antes del IUE)', resultado, 'total', 'Lucro bruto − IT. O IUE (25%) é anual, sobre o lucro do ano, por isso não se reparte por venda.'),
    ] : []),
  ]
  return {
    linhas,
    estado,
    totais: {
      bruto: lista, desconto, cobrado: facturadoTotal, iva: ivaTotal, liquido: netas, outrosImpostos: outrosTotal,
      ...(verCusto ? { custo, servicos, bruta, lucro: resultado, lucroPainel: facturadoTotal - custo - servicos } : {}),
      imposto: ivaTotal + outrosTotal,
    },
    impostos: imp.linhas.map((l) => ({ sigla: l.sigla, taxaBp: l.taxaBp, valor: l.valor })),
    impostosDoDia: imp.doDia,
  }
}

/** a aba "Divisão de valores": o detalhe e a divisão gravada (com o valor de cada parte já calculado) */
export async function divisaoVenda(ctx: Ctx, p: { id: Id }) {
  const d = await venda(ctx, p)
  const t = d.venda
  const verCusto = admin(ctx)
  const det = detalheDeValores(t, verCusto, await impostosDaVenda(ctx, t))
  const bases = { total: det.totais.cobrado, liquido: det.totais.liquido, lucro: det.totais.lucro ?? 0 }
  const div = calcularDivisao(t.divisao?.partes ?? [], bases)
  return { ...det, verCusto, moeda: t.moedaPrincipal, bases, divisao: { ...div, em: t.divisao?.em, porNome: t.divisao?.porNome }, versao: t.versao }
}

/** grava a divisão do valor (só registro). Lista vazia = sem divisão. Fica no histórico da venda. */
export async function salvarDivisaoVenda(ctx: Ctx, d: { id: Id; partes: ParteDivisao[]; versaoBase?: number }) {
  exigir(admin(ctx), 'Só o administrador divide o valor da venda.')
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Venda não encontrada.')
  exigir(t.etapa !== 'cancelado', 'Venda cancelada não se divide.')
  exigirVersao(t, d.versaoBase)
  const partes = (d.partes ?? []).map((p) => ({ ...p, nome: (p.nome ?? '').trim(), obs: p.obs?.trim() || undefined }))
  for (const p of partes) {
    exigir(p.nome, 'Diga com quem divide (o nome).', 'nome')
    exigir(p.base === 'total' || p.base === 'liquido' || p.base === 'lucro', 'Base da divisão inválida.')
    if (p.modo === 'pct') exigir(Number.isInteger(p.pctBp) && p.pctBp! > 0 && p.pctBp! <= 10000, 'A porcentagem vai de 0 a 100%.', 'pct')
    else exigir(p.modo === 'valor' && Number.isInteger(p.valor) && p.valor! > 0, 'Diga o valor da parte.', 'valor')
  }
  const det = detalheDeValores(t, true, await impostosDaVenda(ctx, t))
  const bases = { total: det.totais.cobrado, liquido: det.totais.liquido, lucro: det.totais.lucro ?? 0 }
  const r = calcularDivisao(partes, bases)
  exigir(r.dividido <= bases.total, `As partes somam ${formatar(r.dividido, t.moedaPrincipal)}, mais que o total da venda (${formatar(bases.total, t.moedaPrincipal)}).`)
  const salvo = tocar(ctx, { ...t, divisao: partes.length ? { partes: partes.map((p) => ({ ...p, id: p.id || novo(ctx, {}).id })), em: ctx.relogio.agora(), porNome: ctx.sessao.nome } : undefined })
  await ctx.repos.transacoes.salvar(salvo)
  await auditar(ctx, 'salvarDivisaoVenda', t.id, partes.length
    ? `${t.codigo ?? ''} · divisão: ${r.partes.map((p) => `${p.nome} ${p.modo === 'pct' ? `${(p.pctBp! / 100).toLocaleString('pt-BR')}% do ${p.base}` : 'valor fixo'} = ${formatar(p.calculado, t.moedaPrincipal)}`).join(' · ')} · fica com a casa ${formatar(r.casa, t.moedaPrincipal)}`
    : `${t.codigo ?? ''} · divisão removida`)
  return { id: t.id, versao: salvo.versao }
}
