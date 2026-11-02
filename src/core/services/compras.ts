// COMPRAS com TRIAGEM: a compra anda etapa por etapa (definidas pelo módulo) e só entra no estoque no fim.

import { formatar, multiplicarFator, type CodigoMoeda } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import { diasEntre } from '../domain/datas'
import type { Campos, Id, Item, Linha, Transacao } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, novo, paraPrincipal, tocar } from './contexto'
import { moverCaixa } from './caixa'
import { comprasDe, custoDe, moverEstoque } from './estoque'
import { codigoNovaCompra, codigoNovoLote, exigirCodigosLivres, type ModoCompra, siglasPorPessoa } from './codigos'
import { lerFormCompra, obrigatorioNoForm } from './formCompra'
import { leitorFotos } from './fotos'
import { montarPagamentos, type PagamentoEntrada } from './pagamentos'
import { pendenciasCompra } from './pendencias'
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
  const { valorPrincipal, cotacao } = await paraPrincipal(ctx, total, l.moeda, 'compra')
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
  d: {
    id: Id
    moduloId: string
    pessoaId?: Id
    localId?: Id
    linhas: LinhaCompraEntrada[]
    obs?: string
    /** código digitado (vazio = o da regra de Configurações › Códigos); recusado se já existir */
    codigo?: string
    /** quem da equipe comprou (padrão: a pessoa do usuário que registra) */
    compradorId?: Id
    /** tipo de código só desta compra (vazio = a regra de Configurações › Códigos) */
    modoCodigo?: ModoCompra
    /** VIAGEM de compra aberta a que esta compra pertence (admin: qualquer aberta; funcionária: só a viagem dela) */
    viagemId?: Id
  },
) {
  if (await ctx.repos.transacoes.obter(d.id)) return { id: d.id }
  const c = etapasDe(ctx, d.moduloId)
  exigir(d.linhas?.length, 'Coloque pelo menos um item na compra.')
  // o que o formulário de compra pede como obrigatório (Configurações › Formulário de compra)
  const form = await lerFormCompra(ctx)
  exigir(!obrigatorioNoForm(form, 'fornecedor') || d.pessoaId, 'Escolha o fornecedor.', 'pessoaId')
  exigir(!obrigatorioNoForm(form, 'obs') || d.obs?.trim(), 'Escreva a observação.', 'obs')
  exigir(!obrigatorioNoForm(form, 'viagem') || d.viagemId, 'Escolha a viagem.', 'viagemId')
  const viagem = d.viagemId ? await ctx.repos.viagens.obter(d.viagemId) : undefined
  if (d.viagemId) {
    exigir(viagem && !viagem.apagadoEm, 'Viagem não encontrada.', 'viagemId')
    exigir(viagem.status === 'aberta', `A viagem ${viagem.codigo} já foi encerrada.`, 'viagemId')
    // a funcionária que viaja liga a compra à viagem DELA (a ligação de outras compras é do administrador)
    exigir(ctx.sessao.perfil === 'admin' || (!!ctx.sessao.pessoaId && viagem.viajantes.includes(ctx.sessao.pessoaId)), 'Você só liga a compra a uma viagem em que você está.', 'viagemId')
  }
  if (obrigatorioNoForm(form, 'fotos')) exigir((await ctx.repos.anexos.listar({ donoId: d.id })).length, 'Coloque pelo menos uma foto ou arquivo.', 'fotos')
  if (d.pessoaId) exigir(await ctx.repos.pessoas.obter(d.pessoaId), 'Fornecedor não encontrado.')
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
  if (d.compradorId) exigir(await ctx.repos.pessoas.obter(d.compradorId), 'Quem comprou: pessoa não encontrada.')
  const compradorId = d.compradorId || (ctx.sessao.pessoaId && (await ctx.repos.pessoas.obter(ctx.sessao.pessoaId)) ? ctx.sessao.pessoaId : undefined)
  exigir(!obrigatorioNoForm(form, 'comprador') || compradorId, 'Diga quem comprou.', 'compradorId')
  const t = novo<Transacao>(ctx, {
    id: d.id,
    tipo: 'compra',
    codigo: await codigoNovaCompra(ctx, { codigo: d.codigo, pessoaId: d.pessoaId, compradorId, modoCodigo: d.modoCodigo }),
    compradorId,
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
    ...(viagem ? { viagemId: viagem.id } : {}),
  })
  await ctx.repos.transacoes.salvar(t)
  // mesma linha de log do "ligar compras" da viagem (uma viagem por compra: compra nova não está em outra)
  if (viagem) await auditar(ctx, 'vincularCompras', viagem.id, `${viagem.codigo} ← ${t.codigo ?? t.id}`, [t.id])
  await auditar(ctx, 'criarCompra', t.id, `${t.codigo} · ${linhas.length} item(ns): ${linhas.map((l) => `${l.descricao} ${l.quantidade}`).join(', ')}`, [t.pessoaId!])
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
  d: {
    compraId: Id
    para: string
    motivo?: string
    ajustes?: AjusteLinha[]
    pagamentos?: PagamentoEntrada[]
    /** etapa que cria os lotes: código digitado de cada lote (linhaId → código; vazio = o da regra) */
    codigosLotes?: Record<Id, string>
  },
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
      const conv = await paraPrincipal(ctx, a.total, l.moeda, 'compra')
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
      const pagamentos = await montarPagamentos(ctx, d.pagamentos ?? [], compra.totalPrincipal, compra.linhas, !!compra.pessoaId, 'compra')
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
    if (prox.faz?.includes('estoque')) await entrarNoEstoque(ctx, compra, d.codigosLotes)
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

async function entrarNoEstoque(ctx: Ctx, compra: Transacao, codigosLotes?: Record<Id, string>) {
  const c = etapasDe(ctx, compra.moduloId)
  const tipo = ctx.modulos.tipoItem(compra.moduloId, c.tipoItem)
  // códigos digitados: conferidos antes de criar qualquer lote (sem repetir entre si e sem existir)
  const { limpos, reservados } = await exigirCodigosLivres(ctx, 'lote', tipo.nasceNaCompra ? compra.linhas.map((l) => codigosLotes?.[l.id]) : [])
  for (const [k, l] of compra.linhas.entries()) {
    let itemId = l.itemId
    if (tipo.nasceNaCompra) {
      const lote = novo<Item>(ctx, {
        moduloId: compra.moduloId,
        tipoItem: tipo.id,
        nome: tipo.nomear?.(l.campos) ?? l.descricao,
        codigo: await codigoNovoLote(ctx, { codigo: limpos[k], compraId: compra.id, reservados }),
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
    if (!tipo.nasceNaCompra) {
      // custo médio: custo do que já tinha + o que entrou, dividido pela quantidade nova
      const item = await ctx.repos.itens.obter(itemId)
      if (item) await ctx.repos.itens.salvar(tocar(ctx, { ...item, custoPrincipal: custoDe(item, item.saldo) + l.totalPrincipal, quantidadeInicial: item.saldo + l.quantidade }))
    }
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
export async function filaTriagem(ctx: Ctx, p: { moduloId?: string; incluirEncerradas?: boolean; pendencia?: string } = {}) {
  const hoje = ctx.relogio.hoje()
  const cfg = await lerConfig(ctx)
  const compras = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => !p.moduloId || t.moduloId === p.moduloId)
  const anexos = await ctx.repos.anexos.listar()
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const siglas = await siglasPorPessoa(ctx)
  const saldoConta = new Map<string, number>()
  for (const m of await ctx.repos.movConta.listar()) saldoConta.set(m.pessoaId, (saldoConta.get(m.pessoaId) ?? 0) + m.delta)
  return compras
    .filter((t) => p.incluirEncerradas || !['concluido', ETAPA_RECUSADO, ETAPA_CANCELADO].includes(t.etapa))
    .map((t) => {
      const mod = ctx.modulos.obter(t.moduloId)
      const ultimo = t.historico[t.historico.length - 1]?.em ?? t.criadoEm
      const meus = anexos.filter((a) => a.donoId === t.id)
      const etapas = mod.compra?.etapas ?? []
      const idxPago = etapas.findIndex((e) => e.faz?.includes('pagamento'))
      const diasParada = diasEntre(ultimo.slice(0, 10), hoje)
      const pendencias = pendenciasCompra({ ...t, diasParada }, meus, {
        pedeFotos: mod.compra?.pedirFotos !== false,
        pedeOrigem: !!mod.compra?.pedirComprovanteOrigem,
        jaPassouDoPago: idxPago >= 0 && etapas.findIndex((e) => e.id === t.etapa) >= idxPago,
        diasParadaLimite: mod.compra?.personalizado ? mod.compra.avisarParadaDias : cfg.diasTriagemParada,
        saldoConta: t.pessoaId ? saldoConta.get(t.pessoaId) : undefined,
      })
      return {
        ...t,
        pessoa: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
        comprador: t.compradorId ? pessoas.get(t.compradorId)?.nome : undefined,
        sigla: t.pessoaId ? siglas.get(t.pessoaId) : undefined,
        /** texto da busca: código atual e anteriores, fornecedor e quem comprou (com as siglas) */
        busca: [t.codigo, ...(t.codigosAnteriores ?? []), ...[t.pessoaId, t.compradorId].flatMap((x) => (x ? [pessoas.get(x)?.nome, siglas.get(x)] : []))].filter(Boolean).join(' ').toLowerCase(),
        diasParada,
        pendencias,
        nomeEtapa: mod.compra?.etapas.find((e) => e.id === t.etapa)?.nome ?? t.etapa,
        semFotos: mod.compra?.pedirFotos !== false && !meus.some((a) => a.categoria === 'pedido' || a.categoria === 'produto'),
        semComprovanteOrigem: !!mod.compra?.pedirComprovanteOrigem && !meus.some((a) => a.categoria === 'origem'),
        anexos: meus.length,
      }
    })
    .filter((t) => !p.pendencia || (p.pendencia === 'qualquer' ? t.pendencias.length > 0 : t.pendencias.some((x) => x.id === p.pendencia)))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
}

export async function compra(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.transacoes.obter(p.id)
  if (!t) throw new ErroNegocio('Compra não encontrada.')
  const pessoa = t.pessoaId ? await ctx.repos.pessoas.obter(t.pessoaId) : undefined
  const anexos = await ctx.repos.anexos.listar({ donoId: t.id })
  return { compra: t, pessoa, anexos, modulo: ctx.modulos.obter(t.moduloId).id }
}

/**
 * Tela do PEDIDO (pedidos/:id): tudo de uma compra num lugar — etapas, pendências, itens, pagamentos,
 * conta do fornecedor, lotes que nasceram dela e as outras compras da mesma pessoa.
 */
export async function pedido(ctx: Ctx, p: { id: Id }) {
  const fila = await filaTriagem(ctx, { incluirEncerradas: true })
  const t = fila.find((x) => x.id === p.id)
  if (!t) throw new ErroNegocio('Pedido não encontrado.')
  const mod = ctx.modulos.obter(t.moduloId)
  const anexos = await ctx.repos.anexos.listar({ donoId: t.id })
  const pessoa = t.pessoaId ? await ctx.repos.pessoas.obter(t.pessoaId) : undefined
  const comprador = t.compradorId ? await ctx.repos.pessoas.obter(t.compradorId) : undefined
  const saldoConta = t.pessoaId ? (await ctx.repos.movConta.listar({ pessoaId: t.pessoaId })).reduce((s, m) => s + m.delta, 0) : undefined
  const todosItens = await ctx.repos.itens.listar()
  const lotes = todosItens.filter((i) => comprasDe(i).includes(t.id))
  const F = await leitorFotos(ctx, { porId: new Map(todosItens.map((i) => [i.id, i])) })
  const outras = fila.filter((x) => x.pessoaId && x.pessoaId === t.pessoaId && x.id !== t.id).slice(0, 5)
  const vg = t.viagemId ? await ctx.repos.viagens.obter(t.viagemId) : undefined
  const gramas = t.linhas.reduce((s, l) => s + l.quantidade, 0)
  return {
    compra: t,
    pessoa,
    comprador: comprador ? { id: comprador.id, nome: comprador.nome } : undefined,
    anexos,
    etapas: (mod.compra?.etapas ?? []).map((e) => ({ id: e.id, nome: e.nome, ajuda: e.ajuda, faz: e.faz ?? [] })),
    modulo: { id: mod.id, nome: mod.nome, icone: mod.icone },
    pago: t.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0),
    gramas,
    custoKg: gramas ? Math.round((t.totalPrincipal * 1000) / gramas) : 0,
    saldoConta,
    lotes: lotes.map((l) => ({ id: l.id, codigo: l.codigo, nome: l.nome, saldo: l.saldo, inicial: l.quantidadeInicial ?? 0, unidade: l.unidade, campos: { comprimento: l.campos.comprimento, categoria: l.campos.categoria }, foto: F.principal(l.id), fotosProprias: F.proprias(l.id) })),
    /** viagem de compra a que pertence (chip na tela do pedido) */
    viagem: vg && !vg.apagadoEm ? { id: vg.id, codigo: vg.codigo, nome: vg.nome, destino: vg.destino, status: vg.status } : undefined,
    /** fotos da compra (as que os lotes herdam) */
    fotos: F.daCompra(t.id),
    outras: outras.map((x) => ({ id: x.id, codigo: x.codigo, data: x.data, total: x.totalPrincipal, etapa: x.nomeEtapa })),
  }
}
