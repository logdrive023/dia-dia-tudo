// COMPRAS: registra o que entrou. Quando o item NASCE NA COMPRA (lote de cabelo, modalidade "lote por compra"), o lote
// nasce JÁ NO REGISTRO e cai na Triagem como "Aguardando triagem" (Bruto) — sem esperar pagamento nem as etapas.
// As etapas da compra ficam só para PAGAMENTO E ENTREGA (conferir, pagar, concluir); a última etapa não cria lote de novo.
// Item de catálogo (produto) continua entrando no estoque só na última etapa, como antes.

import { formatar, multiplicarFator, proporcao, type CodigoMoeda } from '../domain/dinheiro'
import { registrarImpostosEstimados } from './impostosRegistro'
import { redividirGasto } from './viagens'
import { mapaViagens } from './viagemCurta'
import { ErroNegocio, exigir } from '../domain/erros'
import { diasEntre } from '../domain/datas'
import type { Campos, Id, Item, Linha, MovEstoque, Transacao } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, novo, paraPrincipal, tocar } from './contexto'
import { moverCaixa } from './caixa'
import { comprasDe, custoDe, moverEstoque } from './estoque'
import { codigoNovaCompra, codigoNovoLote, exigirCodigoLivre, exigirCodigosLivres, type ModoCompra, siglasPorPessoa } from './codigos'
import { lerFormCompra, obrigatorioNoForm } from './formCompra'
import { leitorFotos } from './fotos'
import { montarPagamentos, type PagamentoEntrada } from './pagamentos'
import { pendenciasCompra } from './pendencias'
import { moverConta } from './contas'
import { estornarConta } from './vendas'
import { genealogia, triagemDaCompra } from './triagem'
import { origemDoPacote } from './origem'

export const ETAPA_RECUSADO = 'recusado'
export const ETAPA_CANCELADO = 'cancelado'
export const ETAPA_CONCLUIDO = 'concluido'

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

/** os campos sem a marca "sem valor" da linha (o lote e o resto do sistema não precisam dela) */
function semMarcaDeValor(c: Campos): Campos {
  const r = { ...c }
  delete r.semValor
  return r
}

/** a compra ainda tem valor a pôr? Por linha (as marcadas sem valor e ainda zeradas); compra antiga: o total zerado */
export function faltaValor(t: Pick<Transacao, 'linhas' | 'totalPrincipal' | 'campos'>) {
  if (!t.campos.semValor) return false
  const marcadas = t.linhas.filter((l) => l.campos?.semValor)
  return marcadas.length ? marcadas.some((l) => !l.totalPrincipal) : !t.totalPrincipal
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
    /** lote que nasce no registro: código digitado de cada lote (linhaId → código; vazio = o da regra) */
    codigosLotes?: Record<Id, string>
    /** cabelo que já tínhamos / valor depois: registra só o peso (total 0) e fica a pendência "Sem valor".
     *  Por LINHA: a linha vem com `campos.semValor: true` e total 0 (as outras linhas da mesma compra têm valor). */
    semValor?: boolean
    /** PAGO NO ATO (todas as linhas já pagas): o pagamento já vem junto e a compra vai direto até Concluído */
    pagarNoAto?: PagamentoEntrada[]
    /** SÓ ALGUMAS LINHAS já pagas: o valor delas sai do caixa agora (entrada); a compra segue em aberto e o
     *  pagamento da etapa "Pago" cobra só o que falta */
    pagoParcial?: PagamentoEntrada[]
  },
) {
  if (await ctx.repos.transacoes.obter(d.id)) return { id: d.id }
  const r = await criarCompraSemPagar(ctx, d)
  // valor de pagamento inválido (negativo, fração) é RECUSADO com o motivo, nunca ignorado em silêncio
  for (const p of [...(d.pagarNoAto ?? []), ...(d.pagoParcial ?? [])]) if (p.valor !== 0) exigirInteiroPositivo(p.valor, 'Pagamento')
  if (!d.pagarNoAto && d.pagoParcial?.some((p) => p.valor > 0)) {
    const t = (await ctx.repos.transacoes.obter(r.id))!
    const pags = await montarPagamentos(ctx, d.pagoParcial.filter((p) => p.valor > 0), t.totalPrincipal, t.linhas, true, 'compra')
    const pago = pags.reduce((s, p) => s + p.valorPrincipal, 0)
    exigir(pago <= t.totalPrincipal, 'O que já foi pago passa do total da compra.')
    for (const p of pags)
      await moverCaixa(ctx, { data: ctx.relogio.hoje(), moeda: p.moeda, forma: p.forma, delta: -p.valor, tipo: 'compra', origemId: t.id, descricao: `Compra · linhas já pagas · ${t.linhas.filter((l) => l.campos.jaPaga).map((l) => l.descricao).join(', ')}` })
    await ctx.repos.transacoes.salvar(tocar(ctx, { ...t, pagamentos: pags }))
    await auditar(ctx, 'pagamentoParcialCompra', t.id, `${t.codigo} · ${formatar(pago, t.moedaPrincipal)} já pago (linhas marcadas) · falta ${formatar(t.totalPrincipal - pago, t.moedaPrincipal)}`, [t.pessoaId!])
  }
  if (d.pagarNoAto) await pagarCompra(ctx, { compraId: r.id, pagamentos: d.pagarNoAto.filter((p) => p.valor > 0) })
  return r
}

/**
 * PAGAR E CONCLUIR num toque: a compra passa por todas as etapas que faltam até Concluído (a que pede pagamento recebe
 * o pagamento; as outras só avançam). É o caminho normal — compra paga na hora. Quem usa as etapas uma a uma (pagar
 * depois, conferir antes) continua com "avançar etapa".
 */
export async function pagarCompra(ctx: Ctx, d: { compraId: Id; pagamentos: PagamentoEntrada[]; motivo?: string }) {
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  if (t.etapa === ETAPA_CONCLUIDO) return { id: t.id }
  exigir(t.etapa !== ETAPA_CANCELADO && t.etapa !== ETAPA_RECUSADO, 'Essa compra já foi encerrada.')
  const c = etapasDe(ctx, t.moduloId)
  const fim = c.etapas.findIndex((e) => e.id === ETAPA_CONCLUIDO)
  const idx = c.etapas.findIndex((e) => e.id === t.etapa)
  exigir(fim > idx, 'Essa compra já terminou.')
  const pagaEm = c.etapas.slice(idx + 1, fim + 1).find((e) => e.faz?.includes('pagamento'))?.id ?? c.etapas[fim].id
  for (const e of c.etapas.slice(idx + 1, fim + 1))
    await avancarTriagem(ctx, { compraId: t.id, para: e.id, motivo: d.motivo, pagamentos: e.id === pagaEm ? d.pagamentos : undefined })
  return { id: t.id }
}

async function criarCompraSemPagar(ctx: Ctx, d: Parameters<typeof criarCompra>[1]) {
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
    campos: d.semValor || linhas.some((l) => l.campos.semValor) ? { semValor: true } : {},
    ...(viagem ? { viagemId: viagem.id } : {}),
  })
  await ctx.repos.transacoes.salvar(t)
  // REGRA NOVA: o lote nasce agora (o bruto já aparece na Triagem como "Aguardando triagem"); o pagamento é à parte
  if (tipo.nasceNaCompra) {
    await criarLotes(ctx, t, d.codigosLotes, 'Compra registrada')
    await ctx.repos.transacoes.salvar(t)
  }
  // mesma linha de log do "ligar compras" da viagem (uma viagem por compra: compra nova não está em outra)
  if (viagem) await auditar(ctx, 'vincularCompras', viagem.id, `${viagem.codigo} ← ${t.codigo ?? t.id}`, [t.id])
  if (viagem?.incorporacao) await redividirGasto(ctx, viagem.id)
  await registrarImpostosEstimados(ctx, t)
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

  const tipo = ctx.modulos.tipoItem(t.moduloId, c.tipoItem)
  /** lote que já nasceu no registro (regra nova); compra antiga ainda sem lote → undefined */
  const loteDaLinha = async (l: Linha) => (tipo.nasceNaCompra && l.itemId ? await ctx.repos.itens.obter(l.itemId) : undefined)
  const conferencias: { linhaId: Id; pesado: number }[] = []
  const custos: { itemId: Id; custo: number }[] = []
  for (const a of d.ajustes ?? []) {
    const l = compra.linhas.find((x) => x.id === a.linhaId)
    exigir(l, 'Linha não encontrada.')
    const lote = await loteDaLinha(l)
    if (a.quantidade !== undefined && a.quantidade !== l.quantidade) {
      exigirInteiroPositivo(a.quantidade, 'Quantidade')
      // com o lote já no estoque, o peso conferido vira LANÇAMENTO (diferença de peso) e o comprado não muda
      if (lote) conferencias.push({ linhaId: l.id, pesado: a.quantidade })
      else {
        historicoAjustes.push(`${l.descricao}: quantidade ${l.quantidade} → ${a.quantidade}`)
        l.quantidade = a.quantidade
      }
    }
    if (a.total !== undefined && a.total !== l.total) {
      exigirInteiroPositivo(a.total, 'Valor', true)
      historicoAjustes.push(`${l.descricao}: valor ${l.total} → ${a.total}`)
      l.total = a.total
      const conv = await paraPrincipal(ctx, a.total, l.moeda, 'compra')
      l.totalPrincipal = conv.valorPrincipal
      l.cotacao = conv.cotacao
      if (lote) {
        await exigirLoteIntacto(ctx, compra, lote, 'Parte deste cabelo já foi separada ou vendida: não dá para mudar o valor da compra.')
        custos.push({ itemId: lote.id, custo: conv.valorPrincipal })
      }
    }
    for (const [k, v] of Object.entries(a.campos ?? {})) {
      if (l.campos[k] !== v) historicoAjustes.push(`${l.descricao}: ${k} ${l.campos[k] ?? '—'} → ${v}`)
      l.campos[k] = v
    }
  }
  if (historicoAjustes.length) exigir(!compra.pagamentos.length, 'A compra já foi paga: não dá para mudar valores. Cancele e refaça.')
  for (const x of conferencias) historicoAjustes.push(`${compra.linhas.find((l) => l.id === x.linhaId)?.descricao ?? ''}: pesou ${gTxt(x.pesado)} (diferença de peso lançada no lote)`)
  compra.totalPrincipal = compra.linhas.reduce((s, l) => s + l.totalPrincipal, 0)

  if (d.para === ETAPA_RECUSADO) {
    exigir(!compra.pagamentos.length, 'A compra já foi paga. Use "Cancelar compra" para devolver o dinheiro.')
    exigir(d.motivo?.trim(), 'Diga o motivo da recusa.', 'motivo')
    // recusou: o bruto que entrou no registro sai da Triagem (só se ninguém separou nem vendeu)
    await tirarLotesDaCompra(ctx, compra, 'Compra recusada')
    compra = { ...compra, etapa: ETAPA_RECUSADO }
  } else {
    const prox = c.etapas[idx + 1]
    exigir(prox.id === d.para, `A próxima etapa é "${prox.nome}".`)
    if (prox.faz?.includes('pagamento')) {
      const antes = compra.pagamentos
      const jaPago = antes.reduce((s, p) => s + p.valorPrincipal, 0)
      const pagamentos = await montarPagamentos(ctx, d.pagamentos ?? [], compra.totalPrincipal - jaPago, compra.linhas, !!compra.pessoaId, 'compra')
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
      compra.pagamentos = [...antes, ...pagamentos]
      if (compra.pessoaId) {
        // o que não foi pago agora fica na conta dela (eu devo); adiantamento já dado abate sozinho
        const resumo = compra.linhas.map((l) => l.descricao).join(', ')
        await moverConta(ctx, { pessoaId: compra.pessoaId, delta: -compra.totalPrincipal, tipo: 'compra', origemId: compra.id, descricao: `Compra · ${resumo}` })
        await moverConta(ctx, { pessoaId: compra.pessoaId, delta: compra.pagamentos.reduce((s, p) => s + p.valorPrincipal, 0), tipo: 'pagamento', origemId: compra.id, descricao: jaPago ? 'Pago (linhas já pagas + na entrega)' : 'Pago na entrega' })
      }
    }
    if (prox.faz?.includes('estoque')) await entrarNoEstoque(ctx, compra, d.codigosLotes)
    compra = { ...compra, etapa: prox.id }
  }
  // novo valor (conferência antes de pagar): o custo do lote acompanha
  for (const x of custos) {
    const item = await ctx.repos.itens.obter(x.itemId)
    if (item) await ctx.repos.itens.salvar(tocar(ctx, { ...item, custoPrincipal: x.custo }))
  }
  for (const x of conferencias) await lancarConferencia(ctx, compra, x.linhaId, x.pesado, d.motivo?.trim() || 'Conferido na etapa')
  compra.historico = [
    ...compra.historico,
    { de: etapaAtual.id, para: compra.etapa, em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo, ajustes: historicoAjustes.length ? historicoAjustes : undefined },
  ]
  await ctx.repos.transacoes.salvar(tocar(ctx, compra))
  await auditar(ctx, 'avancarTriagem', compra.id, `${etapaAtual.id} → ${compra.etapa}`)
  return { id: compra.id }
}

/**
 * Cria os lotes das linhas que NASCEM NA COMPRA (e grava o lote em cada linha). Usado no registro (regra nova) e, para
 * compra antiga que ainda não tinha lote, na última etapa.
 */
async function criarLotes(ctx: Ctx, compra: Transacao, codigosLotes: Record<Id, string> | undefined, descricao: string) {
  const c = etapasDe(ctx, compra.moduloId)
  const tipo = ctx.modulos.tipoItem(compra.moduloId, c.tipoItem)
  const novas = compra.linhas.filter((l) => !l.itemId)
  // códigos digitados: conferidos antes de criar qualquer lote (sem repetir entre si e sem existir)
  const { limpos, reservados } = await exigirCodigosLivres(ctx, 'lote', novas.map((l) => codigosLotes?.[l.id]))
  for (const [k, l] of novas.entries()) {
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
      campos: semMarcaDeValor(l.campos),
    })
    await ctx.repos.itens.salvar(lote)
    l.itemId = lote.id
    await moverEstoque(ctx, { itemId: lote.id, delta: l.quantidade, motivo: 'compra', origemId: compra.id, descricao: l.campos.estado === 'Bruto' ? `${descricao} · aguardando triagem` : descricao })
  }
}

/** Última etapa ("concluído"): lote que já nasceu no registro não entra de novo; item de catálogo entra agora (custo médio). */
async function entrarNoEstoque(ctx: Ctx, compra: Transacao, codigosLotes?: Record<Id, string>) {
  const c = etapasDe(ctx, compra.moduloId)
  const tipo = ctx.modulos.tipoItem(compra.moduloId, c.tipoItem)
  if (tipo.nasceNaCompra) {
    // código digitado na última etapa para um lote que já existe: troca o código (o antigo continua achando o lote)
    for (const l of compra.linhas) {
      const cod = codigosLotes?.[l.id]?.trim()
      if (!l.itemId || !cod) continue
      const item = await ctx.repos.itens.obter(l.itemId)
      if (!item) continue
      const novoCodigo = await exigirCodigoLivre(ctx, 'lote', cod, item.id)
      if (novoCodigo !== item.codigo) await ctx.repos.itens.salvar(tocar(ctx, { ...item, codigo: novoCodigo, codigosAnteriores: [...(item.codigosAnteriores ?? []), ...(item.codigo ? [item.codigo] : [])] }))
    }
    // compra registrada antes da regra nova (ainda sem lote): o lote nasce agora
    if (compra.linhas.some((l) => !l.itemId)) await criarLotes(ctx, compra, codigosLotes, 'Compra concluída')
    return
  }
  for (const l of compra.linhas) {
    exigir(l.itemId, 'Item da compra sem cadastro.')
    // custo médio: custo do que já tinha + o que entrou, dividido pela quantidade nova
    const item = await ctx.repos.itens.obter(l.itemId)
    if (item) await ctx.repos.itens.salvar(tocar(ctx, { ...item, custoPrincipal: custoDe(item, item.saldo) + l.totalPrincipal, quantidadeInicial: item.saldo + l.quantidade }))
    await moverEstoque(ctx, { itemId: l.itemId, delta: l.quantidade, motivo: 'compra', origemId: compra.id, descricao: 'Compra concluída' })
  }
}

/** Diferença de peso (conferência) é um ajuste do lote ligado à compra, com este começo na descrição. */
export const PREFIXO_CONFERENCIA = 'Diferença de peso'
const ehConferencia = (m: MovEstoque, compraId: Id) => m.motivo === 'ajuste' && m.origemId === compraId && !!m.descricao?.startsWith(PREFIXO_CONFERENCIA)

/** O lote da compra ainda não foi separado, juntado, vendido nem ajustado (fora a entrada e a conferência de peso). */
async function exigirLoteIntacto(ctx: Ctx, compra: Transacao, lote: Item, mensagem: string) {
  const movs = await ctx.repos.movEstoque.listar({ itemId: lote.id })
  const mexido = movs.some((m) => !(m.motivo === 'compra' && m.origemId === compra.id) && !ehConferencia(m, compra.id))
  exigir(!mexido, `${mensagem} (${lote.codigo ?? lote.nome}).`)
}

/** Lotes que nasceram desta compra (no registro ou na última etapa). */
function lotesDasLinhas(ctx: Ctx, compra: Transacao) {
  const c = etapasDe(ctx, compra.moduloId)
  const tipo = ctx.modulos.tipoItem(compra.moduloId, c.tipoItem)
  return tipo.nasceNaCompra ? compra.linhas.filter((l) => l.itemId).map((l) => l.itemId!) : []
}

/**
 * Cancelou/recusou: tira da Triagem o cabelo que entrou com a compra (zera o lote com um movimento de cancelamento).
 * Recusa se alguma parte já foi separada, juntada ou vendida: aí o certo é ajustar o estoque.
 */
async function tirarLotesDaCompra(ctx: Ctx, compra: Transacao, descricao: string) {
  const lotes: Item[] = []
  for (const id of lotesDasLinhas(ctx, compra)) {
    const lote = await ctx.repos.itens.obter(id)
    if (!lote || lote.origem?.tipo !== 'compra' || lote.origem.id !== compra.id) continue
    await exigirLoteIntacto(ctx, compra, lote, 'Parte desta compra já foi separada ou vendida: ajuste o estoque em vez de cancelar a compra')
    lotes.push(lote)
  }
  for (const lote of lotes) {
    if (lote.saldo > 0) await moverEstoque(ctx, { itemId: lote.id, delta: -lote.saldo, motivo: 'cancelamento', origemId: compra.id, descricao })
    const atual = await ctx.repos.itens.obter(lote.id)
    if (atual) await ctx.repos.itens.salvar(tocar(ctx, { ...atual, ativo: false }))
  }
}

const gTxt = (n: number) => `${n.toLocaleString('pt-BR')} g`

/** Lança a diferença de peso no lote da linha: comprou X g · pesou Y g (o comprado não muda). */
async function lancarConferencia(ctx: Ctx, compra: Transacao, linhaId: Id, pesado: number, motivo: string) {
  const l = compra.linhas.find((x) => x.id === linhaId)
  exigir(l, 'Linha não encontrada.')
  exigir(l.itemId, 'Esta linha ainda não tem lote.')
  const lote = await ctx.repos.itens.obter(l.itemId)
  exigir(lote, 'Lote não encontrado.')
  const antes = (await ctx.repos.movEstoque.listar({ itemId: lote.id })).filter((m) => ehConferencia(m, compra.id)).reduce((s, m) => s + m.delta, 0)
  const delta = pesado - (l.quantidade + antes)
  exigir(delta !== 0, 'O peso é o mesmo da última conferência.')
  exigir(lote.saldo + delta >= 0, `O lote ${lote.codigo ?? lote.nome} só tem ${gTxt(lote.saldo)} agora.`)
  await moverEstoque(ctx, {
    itemId: lote.id,
    delta,
    motivo: 'ajuste',
    origemId: compra.id,
    descricao: `${PREFIXO_CONFERENCIA}: comprou ${gTxt(l.quantidade)} · pesou ${gTxt(pesado)} (${delta > 0 ? '+' : '−'}${gTxt(Math.abs(delta))}) · ${motivo}`,
  })
  await auditar(ctx, 'conferirPesoCompra', compra.id, `${compra.codigo ?? ''} · ${l.descricao}: comprou ${gTxt(l.quantidade)} · pesou ${gTxt(pesado)} · ${motivo}`, [lote.id])
}

/**
 * CONFERÊNCIA DE PESO (opcional, de um toque, vale mesmo depois de pago): pesou na chegada e deu diferente → lança a
 * diferença no lote, com motivo, sem mudar o que foi comprado. Ex.: comprou 10.000 g, pesou 9.850 g → −150 g.
 */
export async function conferirPesoCompra(ctx: Ctx, d: { compraId: Id; linhaId?: Id; itemId?: Id; pesado: number; motivo: string }) {
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  exigir(t.etapa !== ETAPA_CANCELADO && t.etapa !== ETAPA_RECUSADO, 'Essa compra foi cancelada.')
  exigir(Number.isSafeInteger(d.pesado) && d.pesado >= 0, 'Peso conferido inválido.', 'pesado')
  exigir(d.motivo?.trim(), 'Diga o motivo da diferença.', 'motivo')
  // na triagem (passo 1 do Separar) vem o pacote, não a linha
  const linhaId = d.linhaId ?? t.linhas.find((l) => l.itemId && l.itemId === d.itemId)?.id
  exigir(linhaId, 'Linha não encontrada.')
  await lancarConferencia(ctx, t, linhaId, d.pesado, d.motivo.trim())
  return { id: t.id }
}

/**
 * VALOR DEPOIS / CORRIGIR O VALOR (vale mesmo já pago, separado ou vendido): muda o valor de uma linha e a DIFERENÇA
 * segue o cabelo — o custo do pacote da compra, dos pacotes que saíram dele na triagem (pela mesma divisão de antes; se
 * antes era 0, pelo peso) e o custo das vendas que já levaram esse cabelo. A conta do fornecedor também acompanha.
 * Ex.: comprou 3 kg "sem valor", separou em 2 + 1 kg e vendeu 500 g; pôs Bs 3.000 → pacotes Bs 2.000 e 1.000,
 * a venda passa a ter custo Bs 500.
 */
export async function definirValorCompra(ctx: Ctx, d: { compraId: Id; linhaId: Id; total: number; motivo: string }) {
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  exigir(t.etapa !== ETAPA_CANCELADO && t.etapa !== ETAPA_RECUSADO, 'Essa compra foi cancelada.')
  exigirInteiroPositivo(d.total, 'Valor', true)
  const motivo = (d.motivo ?? '').trim()
  exigir(motivo, 'Diga o motivo (ex.: chegou a nota, valor combinado).', 'motivo')
  const compra: Transacao = { ...t, linhas: t.linhas.map((l) => ({ ...l })) }
  const l = compra.linhas.find((x) => x.id === d.linhaId)
  exigir(l, 'Linha não encontrada.')
  exigir(d.total !== l.total, 'O valor já é esse.')
  const conv = await paraPrincipal(ctx, d.total, l.moeda, 'compra')
  const delta = conv.valorPrincipal - l.totalPrincipal
  const antes = l.total
  l.total = d.total
  l.totalPrincipal = conv.valorPrincipal
  l.cotacao = conv.cotacao
  compra.totalPrincipal = compra.linhas.reduce((s, x) => s + x.totalPrincipal, 0)
  if (l.totalPrincipal > 0 && l.campos.semValor) l.campos = semMarcaDeValor(l.campos)
  if (compra.campos.semValor && !faltaValor(compra)) compra.campos = { ...compra.campos, semValor: false }
  // conta do fornecedor: só se a compra já lançou nela (depois da etapa de pagamento)
  if (compra.pessoaId && (await ctx.repos.movConta.listar()).some((m) => m.origemId === compra.id))
    await moverConta(ctx, { pessoaId: compra.pessoaId, delta: -delta, tipo: 'compra', origemId: compra.id, descricao: `Valor corrigido · ${l.descricao} · ${motivo}` })
  const lotes = l.itemId ? await espalharCusto(ctx, l.itemId, delta) : []
  compra.historico = [
    ...compra.historico,
    { de: compra.etapa, para: compra.etapa, tipo: 'correcao', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo, ajustes: [`${l.descricao}: valor ${formatar(antes, l.moeda)} → ${formatar(d.total, l.moeda)}`] },
  ]
  await ctx.repos.transacoes.salvar(tocar(ctx, compra))
  await auditar(ctx, 'definirValorCompra', compra.id, `${compra.codigo ?? ''} · ${l.descricao}: ${formatar(antes, l.moeda)} → ${formatar(d.total, l.moeda)} · ${motivo}`, lotes)
  return { id: compra.id, lotes: lotes.length }
}

/**
 * Soma `delta` ao custo do lote e passa a parte dele adiante: separação (pela fração usada, dividida entre as partes
 * como o custo já estava; custo 0 → pelo peso), unificação (pela fração que entrou) e vendas (custo da linha).
 */
async function espalharCusto(ctx: Ctx, raizId: Id, delta: number) {
  if (!delta) return []
  const itens = (await ctx.repos.itens.listar()).filter((i) => !i.campos.triagemDesfeita)
  const porId = new Map(itens.map((i) => [i.id, i]))
  const movs = await ctx.repos.movEstoque.listar()
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((v) => v.etapa !== 'cancelado')
  const recebe = new Map<Id, number>([[raizId, delta]])
  const fila = [raizId]
  const mexidos: Id[] = []
  while (fila.length) {
    const id = fila.shift()!
    const dl = recebe.get(id) ?? 0
    const lote = porId.get(id)
    if (!lote || !dl) continue
    recebe.delete(id)
    const ini = lote.quantidadeInicial ?? 0
    await ctx.repos.itens.salvar(tocar(ctx, { ...lote, custoPrincipal: (lote.custoPrincipal ?? 0) + dl }))
    mexidos.push(id)
    for (const m of movs.filter((x) => x.itemId === id && x.delta < 0 && !!x.origemId)) {
      const parte = proporcao(dl, -m.delta, ini)
      if (!parte) continue
      if (m.motivo === 'unificacao' && porId.has(m.origemId!)) {
        recebe.set(m.origemId!, (recebe.get(m.origemId!) ?? 0) + parte)
        fila.push(m.origemId!)
      } else if (m.motivo === 'transformacao') {
        const filhos = itens.filter((i) => i.campos.separacaoId === m.origemId && i.origem?.id === id)
        const somaCusto = filhos.reduce((s, f) => s + (f.custoPrincipal ?? 0), 0)
        const somaPeso = filhos.reduce((s, f) => s + (f.quantidadeInicial ?? 0), 0)
        let resto = parte
        filhos.forEach((f, k) => {
          const v = k === filhos.length - 1 ? resto : somaCusto ? proporcao(parte, f.custoPrincipal ?? 0, somaCusto) : proporcao(parte, f.quantidadeInicial ?? 0, somaPeso)
          resto -= v
          recebe.set(f.id, (recebe.get(f.id) ?? 0) + v)
          fila.push(f.id)
        })
      }
    }
    // vendas que já levaram deste pacote: o custo da linha acompanha (o lucro do relatório fica certo)
    for (const v of vendas.filter((x) => x.linhas.some((y) => y.itemId === id))) {
      const nova = { ...v, linhas: v.linhas.map((y) => (y.itemId === id ? { ...y, custoPrincipal: (y.custoPrincipal ?? 0) + proporcao(dl, y.quantidade, ini) } : y)) }
      await ctx.repos.transacoes.salvar(tocar(ctx, nova))
      Object.assign(v, nova)
    }
  }
  return mexidos
}

/** Cancela: devolve o dinheiro (estorno) e, se já entrou no estoque, tira de volta (só se o lote não foi mexido). */
export async function cancelarCompra(ctx: Ctx, d: { compraId: Id; motivo: string }) {
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  exigir(t.etapa !== ETAPA_CANCELADO && t.etapa !== ETAPA_RECUSADO, 'Essa compra já foi encerrada.')
  exigir(d.motivo?.trim(), 'Diga o motivo do cancelamento.', 'motivo')
  const c = etapasDe(ctx, t.moduloId)
  const tipo = ctx.modulos.tipoItem(t.moduloId, c.tipoItem)
  const idxEstoque = c.etapas.findIndex((e) => e.faz?.includes('estoque'))
  const entrou = idxEstoque >= 0 && c.etapas.findIndex((e) => e.id === t.etapa) >= idxEstoque
  // lote que nasce na compra (desde o registro): sai da Triagem, se ninguém separou nem vendeu
  if (tipo.nasceNaCompra) await tirarLotesDaCompra(ctx, t, 'Compra cancelada')
  else if (entrou) {
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
  // compra cancelada sai dos números da viagem: se o gasto já entrou no custo dos pacotes, redivide entre as que ficaram
  if (t.viagemId) await redividirGasto(ctx, t.viagemId)
  await auditar(ctx, 'cancelarCompra', t.id, d.motivo)
  return { id: t.id }
}

// ---------- consultas ----------

/** Fila da triagem: compras por etapa, com quantos dias estão paradas e o que falta. */
export async function filaTriagem(ctx: Ctx, p: { moduloId?: string; incluirEncerradas?: boolean; pendencia?: string } = {}) {
  const viagens = await mapaViagens(ctx)
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
        viagem: t.viagemId ? viagens.get(t.viagemId) : undefined,
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

/** o que veio numa viagem: quantas compras (sem as canceladas/recusadas) e quantos gramas */
async function resumoDaViagem(ctx: Ctx, viagemId: Id) {
  const cs = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => t.viagemId === viagemId && t.etapa !== ETAPA_CANCELADO && t.etapa !== ETAPA_RECUSADO)
  return { compras: cs.length, gramas: cs.reduce((s, t) => s + t.linhas.reduce((a, l) => a + l.quantidade, 0), 0) }
}

export async function compra(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.transacoes.obter(p.id)
  if (!t) throw new ErroNegocio('Compra não encontrada.')
  const pessoa = t.pessoaId ? await ctx.repos.pessoas.obter(t.pessoaId) : undefined
  const anexos = await ctx.repos.anexos.listar({ donoId: t.id })
  return { compra: t, pessoa, anexos, modulo: ctx.modulos.obter(t.moduloId).id }
}

/**
 * A CONTA DA COMPRA FECHA (como um livro caixa): comprado = em pacotes + aguardando triagem + vendido + perda + diferença
 * de peso. Lê a genealogia da compra; em pacote misturado conta só a parte desta compra (pela origem em gramas).
 * Ex.: 10 kg comprados = 4 kg em pacotes + 5,4 kg vendidos + 0,6 kg de perda ✓.
 */
export async function fechamentoCompra(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.transacoes.obter(p.id)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  const comprado = t.linhas.reduce((s, l) => s + l.quantidade, 0)
  const g = await genealogia(ctx, { compraId: t.id })
  if (!g.lotes.length) return undefined
  // fração desta compra em cada lote (1 = só dela; misturado = pela origem em gramas)
  const fracao = new Map<Id, number>()
  const BASE = 1_000_000_000
  const fracaoDe = async (id: Id): Promise<number> => {
    if (fracao.has(id)) return fracao.get(id)!
    const item = await ctx.repos.itens.obter(id)
    const cs = comprasDe(item)
    let f = 0
    if (cs.length === 1) f = cs[0] === t.id ? 1 : 0
    else if (cs.includes(t.id)) f = ((await origemDoPacote(ctx, { itemId: id, gramas: BASE })).find((o) => o.compraId === t.id)?.gramas ?? 0) / BASE
    fracao.set(id, f)
    return f
  }
  const aguardandoEstados = ['Bruto', 'Não identificado']
  let pacotes = 0
  let aguardando = 0
  let vendido = 0
  let perda = 0
  for (const l of g.lotes) {
    const f = await fracaoDe(l.id)
    if (!f) continue
    const item = await ctx.repos.itens.obter(l.id)
    if (aguardandoEstados.includes(String(item?.campos.estado ?? ''))) aguardando += l.saldo * f
    else pacotes += l.saldo * f
    vendido += l.vendido * f
    perda += l.ajustes * f
  }
  // perda na triagem: o que entrou desta compra menos o que saiu dela nos pacotes
  for (const tg of g.triagens) {
    for (const e of tg.entradas) perda += e.g * (await fracaoDe(e.id))
    for (const s of tg.saidas) perda -= s.g * (await fracaoDe(s.id))
  }
  // diferença de peso (conferência) e cancelamento: lançamentos no lote da própria compra
  const movs = (await ctx.repos.movEstoque.listar()).filter((m) => m.origemId === t.id)
  const diferenca = -movs.filter((m) => ehConferencia(m, t.id)).reduce((s, m) => s + m.delta, 0)
  const cancelado = -movs.filter((m) => m.motivo === 'cancelamento').reduce((s, m) => s + m.delta, 0)
  perda -= diferenca
  const r = {
    comprado,
    pacotes: Math.round(pacotes),
    aguardando: Math.round(aguardando),
    vendido: Math.round(vendido),
    perda: Math.round(perda),
    diferenca,
    cancelado,
  }
  const soma = r.pacotes + r.aguardando + r.vendido + r.perda + r.diferenca + r.cancelado
  // tolerância: 1 g por lote misturado (arredondamento das proporções)
  const tolerancia = [...fracao.values()].filter((f) => f > 0 && f < 1).length
  return { ...r, soma, confere: Math.abs(soma - comprado) <= tolerancia, falta: comprado - soma }
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
  const hoje = ctx.relogio.hoje()
  const movsCompra = (await ctx.repos.movEstoque.listar()).filter((m) => m.origemId === t.id)
  return {
    compra: t,
    /** comprado = em pacotes + aguardando + vendido + perda + diferença (✓ quando fecha); sem lote ainda = undefined */
    fechamento: await fechamentoCompra(ctx, { id: t.id }),
    /** a triagem desta compra: feita / parcial / falta (com o que espera e as triagens que já usaram o cabelo dela) */
    triagem: await triagemDaCompra(ctx, t.id),
    /** conferências de peso lançadas nos lotes desta compra (comprou × pesou, com motivo) */
    conferencias: movsCompra.filter((m) => ehConferencia(m, t.id)).map((m) => ({ id: m.id, itemId: m.itemId, data: m.data, delta: m.delta, descricao: m.descricao ?? '' })),
    pessoa,
    comprador: comprador ? { id: comprador.id, nome: comprador.nome } : undefined,
    anexos,
    etapas: (mod.compra?.etapas ?? []).map((e) => ({ id: e.id, nome: e.nome, ajuda: e.ajuda, faz: e.faz ?? [] })),
    modulo: { id: mod.id, nome: mod.nome, icone: mod.icone },
    pago: t.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0),
    gramas,
    custoKg: gramas ? Math.round((t.totalPrincipal * 1000) / gramas) : 0,
    saldoConta,
    lotes: lotes.map((l) => ({
      id: l.id, codigo: l.codigo, nome: l.nome, saldo: l.saldo, inicial: l.quantidadeInicial ?? 0, unidade: l.unidade, campos: { comprimento: l.campos.comprimento, categoria: l.campos.categoria }, foto: F.principal(l.id), fotosProprias: F.proprias(l.id),
      /** lote da própria compra (não um pacote que nasceu dele na triagem) */
      daCompra: l.origem?.tipo === 'compra' && l.origem.id === t.id,
      linhaId: t.linhas.find((x) => x.itemId === l.id)?.id,
      /** bruto com saldo: "Aguardando triagem · há N dias" (desde que entrou ou mudou de coluna) */
      aguardando: l.campos.estado === 'Bruto' && l.saldo > 0 ? { dias: diasEntre((l.faseTriagem?.desde ?? l.criadoEm).slice(0, 10), hoje) } : undefined,
    })),
    /** viagem de compra a que pertence (chip na tela do pedido) */
    viagem: vg && !vg.apagadoEm ? { id: vg.id, codigo: vg.codigo, nome: vg.nome, destino: vg.destino, status: vg.status, inicio: vg.inicio, fim: vg.fim, ...(await resumoDaViagem(ctx, vg.id)) } : undefined,
    /** fotos da compra (as que os lotes herdam) */
    fotos: F.daCompra(t.id),
    outras: outras.map((x) => ({ id: x.id, codigo: x.codigo, data: x.data, total: x.totalPrincipal, etapa: x.nomeEtapa })),
  }
}
