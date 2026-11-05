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

/** o detalhe do dinheiro de uma venda, linha a linha e no total (custo/lucro só para o administrador) */
export function detalheDeValores(t: Transacao, verCusto: boolean, imp: ImpostosDaVenda) {
  const cobradoTotal = t.linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  const impostosTotal = imp.total
  // os impostos repartidos pelo valor de cada linha (o último fica com a sobra de arredondamento)
  let restoImposto = impostosTotal
  const linhas = t.linhas.map((l, k) => {
    const desconto = l.descontoPrincipal ?? 0
    const cobrado = l.totalPrincipal
    const imposto = k === t.linhas.length - 1 ? restoImposto : cobradoTotal ? Math.round((impostosTotal * cobrado) / cobradoTotal) : 0
    restoImposto -= imposto
    const custo = l.custoPrincipal ?? 0
    const insumos = l.insumoPrincipal ?? 0
    const comissao = l.comissaoPrincipal ?? 0
    return {
      id: l.id, descricao: l.descricao, quantidade: l.quantidade,
      bruto: cobrado + desconto, desconto, cobrado, imposto, liquido: cobrado - imposto,
      ...(verCusto ? { custo, insumos, comissao, lucro: cobrado - custo - insumos - comissao } : {}),
    }
  })
  const soma = (k: 'bruto' | 'desconto' | 'cobrado' | 'imposto' | 'liquido' | 'custo' | 'insumos' | 'comissao' | 'lucro') => linhas.reduce((s, l) => s + ((l as unknown as Record<string, number | undefined>)[k] ?? 0), 0)
  return {
    linhas,
    totais: {
      bruto: soma('bruto'), desconto: soma('desconto'), cobrado: soma('cobrado'), imposto: soma('imposto'), liquido: soma('liquido'),
      ...(verCusto ? { custo: soma('custo'), insumos: soma('insumos'), comissao: soma('comissao'), lucro: soma('lucro') } : {}),
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
