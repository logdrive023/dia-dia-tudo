// SERVIÇOS DO SALÃO: biblioteca padrão (Corte, Tintura…), serviço novo criado na hora do atendimento e o resumo
// "Serviços: receita × insumos" (receita, insumos, comissão e margem do salão por serviço e por tipo).

import { BIBLIOTECA_SERVICOS, nomeComparavel } from '../domain/comissao'
import { formatar } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import type { Id, InsumoServico, Item } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, tocar } from './contexto'
import { salvarItem } from './estoque'

const ehServico = (i: Item) => i.moduloId === 'salao' && i.unidade === 'servico'

/** Serviço do catálogo com o mesmo nome (sem acento/maiúscula), se houver. */
export async function servicoComMesmoNome(ctx: Ctx, nome: string, ignorarId?: Id) {
  const n = nomeComparavel(nome)
  return (await ctx.repos.itens.listar({ moduloId: 'salao' })).find((i) => ehServico(i) && i.id !== ignorarId && !i.campos.avulso && nomeComparavel(i.nome) === n)
}

/**
 * Serviço novo/atípico criado no atendimento ("+ Serviço novo"). A funcionária pode criar: entra no catálogo marcado
 * "criado por {nome}" para o administrador revisar. guardar=false = só para este atendimento (não aparece no catálogo).
 * Nome repetido é recusado dizendo qual já existe (use o do catálogo).
 */
export async function criarServicoRapido(
  ctx: Ctx,
  d: { id: Id; nome: string; preco: { moeda: string; valor: number }; duracaoMin?: number; categoria?: string; insumo?: InsumoServico; comissaoBp?: number; guardar: boolean },
) {
  if (await ctx.repos.itens.obter(d.id)) return { id: d.id }
  exigir(d.nome?.trim(), 'Dê um nome ao serviço.', 'nome')
  exigirInteiroPositivo(d.preco?.valor, 'Preço')
  const igual = await servicoComMesmoNome(ctx, d.nome)
  if (igual)
    throw new ErroNegocio(`Já existe: ${igual.nome}${igual.precoSugerido ? ` (${formatar(igual.precoSugerido.valor, igual.precoSugerido.moeda)})` : ''}. Use o do catálogo.`, 'nome')
  const cfg = await lerConfig(ctx)
  // % própria só quem pode mudar comissão (administrador, ou a funcionária se a configuração deixar)
  const comissaoBp = ctx.sessao.perfil === 'admin' || cfg.comissaoFuncionarioMuda ? d.comissaoBp : undefined
  await salvarItem(ctx, {
    id: d.id,
    moduloId: 'salao',
    tipoItem: 'servico',
    nome: d.nome,
    precoSugerido: d.preco,
    duracaoMin: d.duracaoMin || undefined,
    comissaoBp,
    insumo: d.insumo,
    campos: {
      categoria: d.categoria || undefined,
      criadoPorNome: ctx.sessao.nome,
      ...(ctx.sessao.perfil !== 'admin' ? { revisar: true } : {}),
      ...(!d.guardar ? { avulso: true } : {}),
    },
  })
  await auditar(ctx, 'criarServicoRapido', d.id, `${d.nome.trim()} · ${formatar(d.preco.valor, d.preco.moeda)}${d.guardar ? ' · no catálogo' : ' · só neste atendimento'}`)
  return { id: d.id }
}

/** Administrador revisou o serviço criado por uma funcionária (tira a marca "revisar"). */
export async function revisarServico(ctx: Ctx, d: { id: Id }) {
  const i = await ctx.repos.itens.obter(d.id)
  exigir(i, 'Serviço não encontrado.')
  const { revisar: _r, ...campos } = i.campos
  await ctx.repos.itens.salvar(tocar(ctx, { ...i, campos }))
  return { id: d.id }
}

/** Biblioteca padrão (Corte, Escova, Tintura, Mechas…): cria só o que falta (pelo nome); não mexe no que já existe. */
export async function restaurarBibliotecaServicos(ctx: Ctx, _d: object = {}) {
  const existentes = new Set((await ctx.repos.itens.listar({ moduloId: 'salao' })).filter(ehServico).map((i) => nomeComparavel(i.nome)))
  const criados: string[] = []
  for (const s of BIBLIOTECA_SERVICOS) {
    if (existentes.has(nomeComparavel(s.nome))) continue
    const cents = (v: number) => Math.round(v * 100)
    await salvarItem(ctx, {
      id: `srv-${nomeComparavel(s.nome).replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}`,
      moduloId: 'salao',
      tipoItem: 'servico',
      nome: s.nome,
      precoSugerido: { moeda: 'BOB', valor: cents(s.preco) },
      duracaoMin: s.duracaoMin,
      retornoDias: s.retornoDias,
      comissaoBp: s.comissaoBp,
      insumo: s.insumos ? { moeda: 'BOB', valor: cents(s.insumos.reduce((x, i) => x + i.valor, 0)), itens: s.insumos.map((i) => ({ nome: i.nome, valor: cents(i.valor) })) } : undefined,
      campos: { categoria: s.categoria, biblioteca: true },
    })
    criados.push(s.nome)
  }
  if (criados.length) await auditar(ctx, 'restaurarBibliotecaServicos', undefined, criados.join(', '))
  return { id: 'biblioteca', criados }
}

/**
 * "Serviços: receita × insumos" no período: por serviço e por tipo (categoria), receita, insumos (custo do salão),
 * comissão das profissionais e margem do salão (receita − insumos − comissão).
 */
export async function servicosReceitaInsumos(ctx: Ctx, p: { de: string; ate: string; localId?: Id }) {
  const cfg = await lerConfig(ctx)
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa === 'concluido' && t.data >= p.de && t.data <= p.ate && (!p.localId || t.localId === p.localId))
  type Soma = { nome: string; categoria: string; n: number; receita: number; insumos: number; comissao: number; margem: number }
  const porServico = new Map<string, Soma>()
  const porCategoria = new Map<string, Soma>()
  const total: Soma = { nome: 'Total', categoria: '', n: 0, receita: 0, insumos: 0, comissao: 0, margem: 0 }
  const somar = (a: Soma, l: { totalPrincipal: number; insumoPrincipal?: number; comissaoPrincipal?: number }) => {
    a.n++
    a.receita += l.totalPrincipal
    a.insumos += l.insumoPrincipal ?? 0
    a.comissao += l.comissaoPrincipal ?? 0
    a.margem += l.totalPrincipal - (l.insumoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0)
  }
  for (const t of vendas)
    for (const l of t.linhas) {
      const item = l.itemId ? itens.get(l.itemId) : undefined
      if (!item || !ehServico(item)) continue
      const categoria = String(item.campos.categoria || 'Outro')
      const k = item.campos.avulso ? `avulso|${l.descricao}` : item.id
      if (!porServico.has(k)) porServico.set(k, { nome: l.descricao, categoria, n: 0, receita: 0, insumos: 0, comissao: 0, margem: 0 })
      if (!porCategoria.has(categoria)) porCategoria.set(categoria, { nome: categoria, categoria, n: 0, receita: 0, insumos: 0, comissao: 0, margem: 0 })
      somar(porServico.get(k)!, l)
      somar(porCategoria.get(categoria)!, l)
      somar(total, l)
    }
  const ordenar = (m: Map<string, Soma>) => [...m.values()].sort((a, b) => b.receita - a.receita)
  return { de: p.de, ate: p.ate, moeda: cfg.moedaPrincipal, porServico: ordenar(porServico), porCategoria: ordenar(porCategoria), total }
}
