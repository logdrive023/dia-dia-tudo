// COMPRAS com TRIAGEM: a compra anda etapa por etapa (definidas pelo módulo) e só entra no estoque no fim.

import { formatar, multiplicarFator, type CodigoMoeda } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import { diasEntre } from '../domain/datas'
import type { Campos, Id, Item, Linha, Transacao } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, novo, paraPrincipal, tocar } from './contexto'
import { moverCaixa } from './caixa'
import { moverEstoque, proximoCodigo } from './estoque'
import { montarPagamentos, type PagamentoEntrada } from './pagamentos'
import { moverConta } from './contas'
import { estornarConta } from './vendas'

export const ETAPA_RECUSADO = 'recusado'
export const ETAPA_CANCELADO = 'cancelado'

export interface LinhaCompraEntrada {
  id: Id
  itemId?: Id
  descricao?: string
  quantidade: number
  moeda: CodigoMoeda
  total: number
  campos?: Campos
  /** compra pela tabela: medida | gramas × fator (ex.: Cirila 60 cm · 137 g × 15 = Bs 2.055) */
  calculo?: { medida?: number; fator: string; categoria?: string; tabelaId?: Id; colunaId?: string }
}

async function montarLinha(ctx: Ctx, l: LinhaCompraEntrada, nomePadrao: string): Promise<Linha> {
  exigirInteiroPositivo(l.quantidade, 'Quantidade')
  const total = l.calculo?.fator ? multiplicarFator(l.quantidade, l.calculo.fator, l.moeda) : l.total
  exigirInteiroPositivo(total, 'Valor', true)
  const { valorPrincipal, cotacao } = await paraPrincipal(ctx, total, l.moeda)
  const campos: Campos = { ...(l.campos ?? {}) }
  if (l.calculo?.fator) {
    if (l.calculo.medida && campos.comprimento === undefined) campos.comprimento = l.calculo.medida
    if (l.calculo.categoria && !campos.categoria) campos.categoria = l.calculo.categoria
    campos.fator = l.calculo.fator
    campos.tabelaId = l.calculo.tabelaId
    campos.colunaId = l.calculo.colunaId
    campos.calculo = `${l.calculo.medida ?? ''}${l.calculo.categoria ? ' ' + l.calculo.categoria : ''} | ${l.quantidade.toLocaleString('pt-BR')} × ${l.calculo.fator} = ${formatar(total, l.moeda)}`
  }
  return {
    id: l.id,
    itemId: l.itemId,
    descricao: l.descricao?.trim() || nomePadrao,
    quantidade: l.quantidade,
    moeda: l.moeda,
    total,
    totalPrincipal: valorPrincipal,
    cotacao,
    campos,
  }
}

function etapasDe(ctx: Ctx, moduloId: string) {
  const c = ctx.modulos.obter(moduloId).compra
  exigir(c, 'Esse módulo não tem compras.')
  return c
}

export async function criarCompra(
  ctx: Ctx,
  d: { id: Id; moduloId: string; pessoaId?: Id; localId?: Id; linhas: LinhaCompraEntrada[]; obs?: string },
) {
  if (await ctx.repos.transacoes.obter(d.id)) return { id: d.id }
  const c = etapasDe(ctx, d.moduloId)
  exigir(d.linhas?.length, 'Coloque pelo menos um item na compra.')
  const tipo = ctx.modulos.tipoItem(d.moduloId, c.tipoItem)
  const linhas: Linha[] = []
  for (const l of d.linhas) {
    if (!tipo.nasceNaCompra) {
      exigir(l.itemId, 'Escolha o item comprado.')
      const item = await ctx.repos.itens.obter(l.itemId)
      exigir(item, 'Item não encontrado.')
      linhas.push(await montarLinha(ctx, l, item.nome))
    } else {
      for (const campo of tipo.campos.filter((x) => x.obrigatorio))
        exigir(l.campos?.[campo.id] !== undefined && l.campos?.[campo.id] !== '', `Preencha: ${campo.nome}.`, campo.id)
      const camposNome = { ...(l.campos ?? {}), comprimento: l.campos?.comprimento ?? l.calculo?.medida, categoria: l.campos?.categoria ?? l.calculo?.categoria }
      linhas.push(await montarLinha(ctx, l, tipo.nomear?.(camposNome) ?? tipo.nome))
    }
  }
  const cfg = await lerConfig(ctx)
  const t = novo<Transacao>(ctx, {
    id: d.id,
    tipo: 'compra',
    moduloId: d.moduloId,
    data: ctx.relogio.hoje(),
    etapa: c.etapas[0].id,
    pessoaId: d.pessoaId,
    localId: d.localId,
    linhas,
    pagamentos: [],
    moedaPrincipal: cfg.moedaPrincipal,
    totalPrincipal: linhas.reduce((s, l) => s + l.totalPrincipal, 0),
    historico: [{ de: '', para: c.etapas[0].id, em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome }],
    obs: d.obs,
    campos: {},
  })
  await ctx.repos.transacoes.salvar(t)
  await auditar(ctx, 'criarCompra', t.id, `${linhas.length} item(ns): ${linhas.map((l) => `${l.descricao} ${l.quantidade}`).join(', ')}`, [t.pessoaId!])
  return { id: t.id }
}

export interface AjusteLinha {
  linhaId: Id
  quantidade?: number
  total?: number
  campos?: Campos
}

/**
 * Anda uma etapa (ou recusa). Ajustes (gramas, preço, ficha) ficam guardados no histórico com o motivo.
 * Etapa que "faz pagamento" exige pagamentos que fechem com o total; etapa que "faz estoque" cria os lotes.
 */
export async function avancarTriagem(
  ctx: Ctx,
  d: { compraId: Id; para: string; motivo?: string; ajustes?: AjusteLinha[]; pagamentos?: PagamentoEntrada[] },
) {
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  if (t.etapa === d.para) return { id: t.id } // toque repetido
  const c = etapasDe(ctx, t.moduloId)
  const idx = c.etapas.findIndex((e) => e.id === t.etapa)
  exigir(idx >= 0 && idx < c.etapas.length - 1, 'Essa compra já terminou.')
  const etapaAtual = c.etapas[idx]
  let compra: Transacao = { ...t, linhas: t.linhas.map((l) => ({ ...l })) }
  const historicoAjustes: string[] = []

  for (const a of d.ajustes ?? []) {
    const l = compra.linhas.find((x) => x.id === a.linhaId)
    exigir(l, 'Linha não encontrada.')
    if (a.quantidade !== undefined && a.quantidade !== l.quantidade) {
      exigirInteiroPositivo(a.quantidade, 'Quantidade')
      historicoAjustes.push(`${l.descricao}: quantidade ${l.quantidade} → ${a.quantidade}`)
      l.quantidade = a.quantidade
    }
    if (a.total !== undefined && a.total !== l.total) {
      exigirInteiroPositivo(a.total, 'Valor', true)
      historicoAjustes.push(`${l.descricao}: valor ${l.total} → ${a.total}`)
      l.total = a.total
      const conv = await paraPrincipal(ctx, a.total, l.moeda)
      l.totalPrincipal = conv.valorPrincipal
      l.cotacao = conv.cotacao
    }
    for (const [k, v] of Object.entries(a.campos ?? {})) {
      if (l.campos[k] !== v) historicoAjustes.push(`${l.descricao}: ${k} ${l.campos[k] ?? '—'} → ${v}`)
      l.campos[k] = v
    }
  }
  if (historicoAjustes.length) exigir(!compra.pagamentos.length, 'A compra já foi paga: não dá para mudar valores. Cancele e refaça.')
  compra.totalPrincipal = compra.linhas.reduce((s, l) => s + l.totalPrincipal, 0)

  if (d.para === ETAPA_RECUSADO) {
    exigir(!compra.pagamentos.length, 'A compra já foi paga. Use "Cancelar compra" para devolver o dinheiro.')
    exigir(d.motivo?.trim(), 'Diga o motivo da recusa.', 'motivo')
    compra = { ...compra, etapa: ETAPA_RECUSADO }
  } else {
    const prox = c.etapas[idx + 1]
    exigir(prox.id === d.para, `A próxima etapa é "${prox.nome}".`)
    if (prox.faz?.includes('pagamento')) {
      const pagamentos = await montarPagamentos(ctx, d.pagamentos ?? [], compra.totalPrincipal, compra.linhas, !!compra.pessoaId)
      for (const p of pagamentos)
        await moverCaixa(ctx, {
          data: ctx.relogio.hoje(),
          moeda: p.moeda,
          forma: p.forma,
          delta: -p.valor,
          tipo: 'compra',
          origemId: compra.id,
          descricao: `Compra · ${compra.linhas.map((l) => l.descricao).join(', ')}`,
        })
      compra.pagamentos = pagamentos
      if (compra.pessoaId) {
        // o que não foi pago agora fica na conta dela (eu devo); adiantamento já dado abate sozinho
        const resumo = compra.linhas.map((l) => l.descricao).join(', ')
        await moverConta(ctx, { pessoaId: compra.pessoaId, delta: -compra.totalPrincipal, tipo: 'compra', origemId: compra.id, descricao: `Compra · ${resumo}` })
        await moverConta(ctx, { pessoaId: compra.pessoaId, delta: pagamentos.reduce((s, p) => s + p.valorPrincipal, 0), tipo: 'pagamento', origemId: compra.id, descricao: 'Pago na entrega' })
      }
    }
    if (prox.faz?.includes('estoque')) await entrarNoEstoque(ctx, compra)
    compra = { ...compra, etapa: prox.id }
  }
  compra.historico = [
    ...compra.historico,
    { de: etapaAtual.id, para: compra.etapa, em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo, ajustes: historicoAjustes.length ? historicoAjustes : undefined },
  ]
  await ctx.repos.transacoes.salvar(tocar(ctx, compra))
  await auditar(ctx, 'avancarTriagem', compra.id, `${etapaAtual.id} → ${compra.etapa}`)
  return { id: compra.id }
}

async function entrarNoEstoque(ctx: Ctx, compra: Transacao) {
  const c = etapasDe(ctx, compra.moduloId)
  const tipo = ctx.modulos.tipoItem(compra.moduloId, c.tipoItem)
  for (const l of compra.linhas) {
    let itemId = l.itemId
    if (tipo.nasceNaCompra) {
      const lote = novo<Item>(ctx, {
        moduloId: compra.moduloId,
        tipoItem: tipo.id,
        nome: tipo.nomear?.(l.campos) ?? l.descricao,
        codigo: await proximoCodigo(ctx),
        unidade: tipo.unidade,
        controlaEstoque: tipo.controlaEstoque,
        ativo: true,
        saldo: 0,
        custoPrincipal: l.totalPrincipal,
        quantidadeInicial: l.quantidade,
        origem: { tipo: 'compra', id: compra.id, pessoaId: compra.pessoaId },
        campos: { ...l.campos },
      })
      await ctx.repos.itens.salvar(lote)
      itemId = lote.id
      l.itemId = lote.id
    }
    exigir(itemId, 'Item da compra sem cadastro.')
    await moverEstoque(ctx, { itemId, delta: l.quantidade, motivo: 'compra', origemId: compra.id, descricao: 'Compra concluída' })
  }
}

/** Cancela: devolve o dinheiro (estorno) e, se já entrou no estoque, tira de volta (só se o lote não foi mexido). */
export async function cancelarCompra(ctx: Ctx, d: { compraId: Id; motivo: string }) {
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  exigir(t.etapa !== ETAPA_CANCELADO && t.etapa !== ETAPA_RECUSADO, 'Essa compra já foi encerrada.')
  exigir(d.motivo?.trim(), 'Diga o motivo do cancelamento.', 'motivo')
  const c = etapasDe(ctx, t.moduloId)
  const idxEstoque = c.etapas.findIndex((e) => e.faz?.includes('estoque'))
  const entrou = idxEstoque >= 0 && c.etapas.findIndex((e) => e.id === t.etapa) >= idxEstoque
  if (entrou) {
    for (const l of t.linhas) {
      if (!l.itemId) continue
      const item = await ctx.repos.itens.obter(l.itemId)
      exigir(item && item.saldo >= l.quantidade, `"${l.descricao}" já foi vendido ou usado: ajuste o estoque em vez de cancelar a compra.`)
      await moverEstoque(ctx, { itemId: l.itemId, delta: -l.quantidade, motivo: 'cancelamento', origemId: t.id, descricao: 'Compra cancelada' })
    }
  }
  for (const p of t.pagamentos)
    await moverCaixa(ctx, {
      data: ctx.relogio.hoje(),
      moeda: p.moeda,
      forma: p.forma,
      delta: p.valor,
      tipo: 'estorno',
      origemId: t.id,
      descricao: `Compra cancelada · ${d.motivo}`,
    })
  await estornarConta(ctx, t.id, `Compra cancelada · ${d.motivo}`)
  await ctx.repos.transacoes.salvar(
    tocar(ctx, { ...t, etapa: ETAPA_CANCELADO, historico: [...t.historico, { de: t.etapa, para: ETAPA_CANCELADO, em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo }] }),
  )
  await auditar(ctx, 'cancelarCompra', t.id, d.motivo)
  return { id: t.id }
}

// ---------- consultas ----------

/** Fila da triagem: compras por etapa, com quantos dias estão paradas e o que falta. */
export async function filaTriagem(ctx: Ctx, p: { moduloId?: string; incluirEncerradas?: boolean } = {}) {
  const hoje = ctx.relogio.hoje()
  const compras = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => !p.moduloId || t.moduloId === p.moduloId)
  const anexos = await ctx.repos.anexos.listar()
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  return compras
    .filter((t) => p.incluirEncerradas || !['concluido', ETAPA_RECUSADO, ETAPA_CANCELADO].includes(t.etapa))
    .map((t) => {
      const mod = ctx.modulos.obter(t.moduloId)
      const ultimo = t.historico[t.historico.length - 1]?.em ?? t.criadoEm
      const meus = anexos.filter((a) => a.donoId === t.id)
      return {
        ...t,
        pessoa: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
        diasParada: diasEntre(ultimo.slice(0, 10), hoje),
        nomeEtapa: mod.compra?.etapas.find((e) => e.id === t.etapa)?.nome ?? t.etapa,
        semFotos: !meus.some((a) => a.categoria === 'pedido' || a.categoria === 'produto'),
        semComprovanteOrigem: !!mod.compra?.pedirComprovanteOrigem && !meus.some((a) => a.categoria === 'origem'),
        anexos: meus.length,
      }
    })
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
}

export async function compra(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.transacoes.obter(p.id)
  if (!t) throw new ErroNegocio('Compra não encontrada.')
  const pessoa = t.pessoaId ? await ctx.repos.pessoas.obter(t.pessoaId) : undefined
  const anexos = await ctx.repos.anexos.listar({ donoId: t.id })
  return { compra: t, pessoa, anexos, modulo: ctx.modulos.obter(t.moduloId).id }
}
