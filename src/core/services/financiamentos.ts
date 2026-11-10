// FINANCIAMENTO / ADIANTAMENTO A PARCEIROS ("AD-0001"): a loja dá dinheiro a uma pessoa (intermediária, parceira ou
// funcionária) para ela comprar cabelo em nome da loja; a dívida é paga com o cabelo que ela entrega.
//
// Sem contar nada duas vezes — tudo passa pela CONTA CORRENTE da pessoa (+ = ela me deve):
//  - dar o dinheiro: sai do caixa como "Saída por empréstimo operacional" (tipo 'emprestimo': o DRE ignora; não é
//    despesa nem compra) e a conta dela sobe (+). O dinheiro está "na mão do comprador".
//  - entrega de cabelo: é uma COMPRA NORMAL (criarCompra, fornecedor = a pessoa) que passa pela etapa de pagamento
//    SEM pagamento: o valor vai para a mesma conta (−) e abate a dívida. Nada sai do caixa; o cabelo vira estoque com
//    custo = valor entregue e segue para a Triagem como qualquer compra.
//  - recebi em dinheiro / paguei a diferença: acerto de conta (registrarAcerto), com caixa.
//  - abater da comissão: a comissão a pagar vira pagamento da dívida (conta −, sem caixa) e conta como comissão paga.
//  - encerrar à mão: o que sobrou vira baixa (ajuste com motivo) na conta.
// Saldo do adiantamento = soma dos movimentos da conta ligados a ele (o próprio id, cada evento e cada compra).

import { formatar, type CodigoMoeda } from '../domain/dinheiro'
import { diasEntre } from '../domain/datas'
import { exigir } from '../domain/erros'
import type { EventoFinanciamento, Financiamento, Id, Item, MovConta, Transacao } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, novo, paraPrincipal, tocar } from './contexto'
import { moverCaixa } from './caixa'
import { moverConta, registrarAcerto } from './contas'
import { avancarTriagem, criarCompra, ETAPA_CANCELADO, type LinhaCompraEntrada } from './compras'
import { comissoes } from './comissoes'
import { comprasDe } from './estoque'
import { vincularCompras } from './viagens'

export type StatusFinanciamento = 'aberto' | 'aPagar' | 'quitado' | 'encerrado'

export const NOME_STATUS_FINANCIAMENTO: Record<StatusFinanciamento, string> = {
  aberto: 'Em aberto',
  aPagar: 'A pagar ao parceiro',
  quitado: 'Quitado',
  encerrado: 'Encerrado',
}

const NOME_EVENTO: Record<EventoFinanciamento['tipo'], string> = {
  entrega: 'Entrega de cabelo',
  recebimento: 'Recebi em dinheiro',
  comissao: 'Abatido da comissão',
  diferenca: 'Paguei a diferença',
  baixa: 'Baixa ao encerrar',
  reforco: 'Adiantei mais dinheiro',
}

/** "Adiantamento AD-0001 · Parceiro X" (vai na observação da compra e na origem do lote) */
export const textoOrigem = (codigo: string, nome?: string) => `Adiantamento ${codigo}${nome ? ` · ${nome}` : ''}`

function exigirAdmin(ctx: Ctx) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador mexe nos adiantamentos.')
}

async function obter(ctx: Ctx, id: Id) {
  const f = await ctx.repos.financiamentos.obter(id)
  exigir(f && !f.apagadoEm, 'Adiantamento não encontrado.')
  return f
}

async function proximoCodigo(ctx: Ctx) {
  const n = (await ctx.repos.financiamentos.listar()).reduce((m, f) => Math.max(m, Number(/^AD-(\d+)$/.exec(f.codigo)?.[1] ?? 0)), 0)
  return `AD-${String(n + 1).padStart(4, '0')}`
}

/** ids da conta corrente que pertencem ao adiantamento (ele mesmo, os eventos e as compras de entrega) */
function origensDe(f: Financiamento) {
  return new Set<Id>([f.id, ...f.eventos.map((e) => e.compraId ?? e.id)])
}

/**
 * Situação do adiantamento a partir da conta corrente (a verdade): financiado, cabelo entregue, recebido,
 * abatido de comissão, diferença paga, baixa e saldo (+ a pessoa ainda deve; − a loja deve a ela).
 */
export function situacaoFinanciamento(f: Financiamento, movsPessoa: MovConta[], compras: Map<Id, Transacao>) {
  const origens = origensDe(f)
  const porOrigem = new Map<Id, number>()
  for (const m of movsPessoa) if (m.origemId && origens.has(m.origemId)) porOrigem.set(m.origemId, (porOrigem.get(m.origemId) ?? 0) + m.delta)
  const efeito = (e: EventoFinanciamento) => porOrigem.get(e.compraId ?? e.id) ?? 0
  const soma = (tipo: EventoFinanciamento['tipo']) => f.eventos.filter((e) => e.tipo === tipo).reduce((s, e) => s + efeito(e), 0)
  const entregas = f.eventos.filter((e) => e.tipo === 'entrega')
  const gramas = entregas.reduce((s, e) => {
    const t = compras.get(e.compraId!)
    return s + (t && t.etapa !== ETAPA_CANCELADO ? t.linhas.reduce((x, l) => x + l.quantidade, 0) : 0)
  }, 0)
  // o adiantado = a entrega inicial + cada "adiantei mais"
  const inicial = porOrigem.get(f.id) ?? 0
  const financiado = inicial + soma('reforco')
  const entregue = -soma('entrega')
  const recebido = -soma('recebimento')
  const comissao = -soma('comissao')
  const diferencaPaga = soma('diferenca')
  const baixa = -soma('baixa')
  const saldo = [...porOrigem.values()].reduce((s, v) => s + v, 0)
  const status: StatusFinanciamento = f.encerramento ? 'encerrado' : saldo > 0 ? 'aberto' : saldo < 0 ? 'aPagar' : 'quitado'
  // quanto da dívida já foi coberto (cabelo + dinheiro + comissão), para a barra de progresso
  const coberto = entregue + recebido + comissao
  return {
    financiado,
    inicial,
    entregue,
    gramas,
    recebido,
    comissao,
    diferencaPaga,
    baixa,
    saldo,
    status,
    /** o que a loja deve ao parceiro (cabelo entregue além do adiantado) */
    aPagarParceiro: saldo < 0 ? -saldo : 0,
    progressoBp: financiado > 0 ? Math.min(10000, Math.round((coberto * 10000) / financiado)) : 0,
    efeito,
  }
}

async function carregar(ctx: Ctx, f: Financiamento) {
  const movs = await ctx.repos.movConta.listar({ pessoaId: f.pessoaId })
  const compras = new Map<Id, Transacao>()
  for (const e of f.eventos) if (e.compraId) {
    const t = await ctx.repos.transacoes.obter(e.compraId)
    if (t) compras.set(t.id, t)
  }
  return situacaoFinanciamento(f, movs, compras)
}

function evento(ctx: Ctx, e: Omit<EventoFinanciamento, 'data' | 'em' | 'porNome'>): EventoFinanciamento {
  return { ...e, data: ctx.relogio.hoje(), em: ctx.relogio.agora(), porNome: ctx.sessao.nome }
}

async function guardarEvento(ctx: Ctx, f: Financiamento, e: EventoFinanciamento) {
  const atual = await obter(ctx, f.id)
  const novoF = tocar(ctx, { ...atual, eventos: [...atual.eventos, e] })
  await ctx.repos.financiamentos.salvar(novoF)
  return novoF
}

async function exigirMoedaAtiva(ctx: Ctx, moeda: CodigoMoeda) {
  const cfg = await lerConfig(ctx)
  exigir(moeda === cfg.moedaPrincipal || cfg.moedasAtivas.includes(moeda), `Moeda ${moeda} não está ativa.`)
  return cfg
}

// ---------- comandos ----------

/**
 * Dá o dinheiro ao parceiro. Ex.: R$ 5.000 para o Parceiro X comprar cabelo → caixa −5.000 (empréstimo operacional,
 * fora do DRE) e a conta do Parceiro X +5.000 (ele me deve; dinheiro na mão dele).
 */
export async function criarFinanciamento(
  ctx: Ctx,
  d: { id: Id; pessoaId: Id; moeda: CodigoMoeda; valor: number; forma: string; viagemId?: Id; abaterComissoes?: boolean; obs?: string
    /** a data em que foi feito (padrão: hoje; não pode ser no futuro) */
    data?: string
    /** data limite para entregar (opcional; não antes da data) */
    prazo?: string },
) {
  exigirAdmin(ctx)
  if (await ctx.repos.financiamentos.obter(d.id)) return { id: d.id }
  const pessoa = await ctx.repos.pessoas.obter(d.pessoaId)
  exigir(pessoa, 'Escolha quem vai comprar.', 'pessoaId')
  exigirInteiroPositivo(d.valor, 'Valor')
  await exigirMoedaAtiva(ctx, d.moeda)
  if (d.viagemId) {
    const v = await ctx.repos.viagens.obter(d.viagemId)
    exigir(v && !v.apagadoEm, 'Viagem não encontrada.', 'viagemId')
  }
  const hoje = ctx.relogio.hoje()
  const data = d.data || hoje
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(data) && data <= hoje, 'A data do adiantamento não pode ser no futuro.', 'data')
  exigir(!d.prazo || (/^\d{4}-\d{2}-\d{2}$/.test(d.prazo) && d.prazo >= data), 'A data limite não pode ser antes da data do adiantamento.', 'prazo')
  // o dinheiro sai: cotação de "compra" (a mesma do pagamento a fornecedor)
  const { valorPrincipal, cotacao } = await paraPrincipal(ctx, d.valor, d.moeda, 'compra')
  exigir(valorPrincipal > 0, 'Valor pequeno demais para registrar.')
  const codigo = await proximoCodigo(ctx)
  const f = novo<Financiamento>(ctx, {
    id: d.id,
    codigo,
    pessoaId: pessoa.id,
    data,
    prazo: d.prazo || undefined,
    moeda: d.moeda,
    valor: d.valor,
    valorPrincipal,
    cotacao,
    forma: d.forma,
    viagemId: d.viagemId || undefined,
    abaterComissoes: !!d.abaterComissoes,
    obs: d.obs?.trim() || undefined,
    eventos: [],
  })
  await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: -d.valor,
    // 'emprestimo': o DRE só conta 'despesa' → não vira despesa (e não é compra)
    tipo: 'emprestimo',
    origemId: f.id,
    descricao: `Saída por empréstimo operacional · ${codigo} · ${pessoa.nome}`,
  })
  await moverConta(ctx, { pessoaId: pessoa.id, delta: valorPrincipal, tipo: 'adiantamento', origemId: f.id, forma: d.forma, descricao: `${textoOrigem(codigo)} · dinheiro para comprar cabelo` })
  await ctx.repos.financiamentos.salvar(f)
  await auditar(ctx, 'criarFinanciamento', f.id, `${codigo} · ${pessoa.nome}: ${formatar(d.valor, d.moeda)} (${d.forma})`, [pessoa.id, ...(f.viagemId ? [f.viagemId] : [])])
  return { id: f.id, codigo }
}

/**
 * ENTREGA DE CABELO: cria uma compra normal (fornecedor = o parceiro) e passa pela etapa de pagamento sem pagar —
 * o valor abate a dívida na conta corrente. Se quiser, já entra no estoque (vai para a Triagem).
 * Ex.: adiantei 5.000 → entregou 3.000 → saldo 2.000; entregou mais 2.500 → a loja deve 500 a ele.
 */
export async function registrarEntregaFinanciamento(
  ctx: Ctx,
  d: { id: Id; financiamentoId: Id; moduloId?: string; linhas: LinhaCompraEntrada[]; obs?: string; codigo?: string; entrarNoEstoque?: boolean },
) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  if (f.eventos.some((e) => e.compraId === d.id)) return { id: d.id, financiamentoId: f.id }
  const s = await carregar(ctx, f)
  exigir(s.status === 'aberto', s.status === 'encerrado' ? 'Esse adiantamento foi encerrado.' : 'Esse adiantamento já foi coberto: registre como compra normal.')
  const moduloId = d.moduloId || 'cabelo'
  const fluxo = ctx.modulos.obter(moduloId).compra
  exigir(fluxo, 'Esse módulo não tem compras.')
  const idxPagamento = fluxo.etapas.findIndex((e) => e.faz?.includes('pagamento'))
  exigir(idxPagamento > 0, 'As etapas da compra não têm etapa de pagamento: não dá para abater do adiantamento.')
  const pessoa = await ctx.repos.pessoas.obter(f.pessoaId)
  const origem = textoOrigem(f.codigo, pessoa?.nome)
  await criarCompra(ctx, {
    id: d.id,
    moduloId,
    pessoaId: f.pessoaId,
    compradorId: f.pessoaId,
    linhas: d.linhas,
    codigo: d.codigo,
    obs: `${origem}${d.obs?.trim() ? ` · ${d.obs.trim()}` : ''}`,
  })
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t, 'Compra não encontrada.')
  await ctx.repos.transacoes.salvar(tocar(ctx, { ...t, financiamentoId: f.id }))
  // anda até a etapa de pagamento sem pagar nada: o total vai para a conta (−) e abate a dívida
  for (let k = 1; k <= idxPagamento; k++)
    await avancarTriagem(ctx, { compraId: d.id, para: fluxo.etapas[k].id, pagamentos: [], motivo: k === idxPagamento ? `Abatido do ${origem}` : undefined })
  // "já entrar no estoque": anda até a etapa que cria os lotes (etapas no meio, ex.: "Lavado", passam sozinhas;
  // se alguma delas cobrar pagamento de novo, para antes para não lançar a conta duas vezes)
  const idxEstoque = fluxo.etapas.findIndex((e, k) => k > idxPagamento && e.faz?.includes('estoque'))
  const meioSemPagamento = idxEstoque > idxPagamento && fluxo.etapas.slice(idxPagamento + 1, idxEstoque + 1).every((e) => !e.faz?.includes('pagamento'))
  if (d.entrarNoEstoque !== false && meioSemPagamento)
    for (let k = idxPagamento + 1; k <= idxEstoque; k++) await avancarTriagem(ctx, { compraId: d.id, para: fluxo.etapas[k].id })
  // compra ligada à viagem do adiantamento (se a viagem ainda está aberta)
  if (f.viagemId) {
    const v = await ctx.repos.viagens.obter(f.viagemId)
    if (v && !v.apagadoEm && v.status === 'aberta') await vincularCompras(ctx, { viagemId: v.id, compraIds: [d.id] })
  }
  const final = await ctx.repos.transacoes.obter(d.id)
  const gramas = final?.linhas.reduce((x, l) => x + l.quantidade, 0) ?? 0
  await guardarEvento(ctx, f, evento(ctx, { id: d.id, tipo: 'entrega', compraId: d.id, obs: d.obs?.trim() || undefined }))
  await auditar(ctx, 'registrarEntregaFinanciamento', f.id, `${f.codigo}: entrega ${final?.codigo ?? ''} · ${gramas} g · ${formatar(final?.totalPrincipal ?? 0, final?.moedaPrincipal ?? f.moeda)}`, [f.pessoaId, d.id])
  return { id: d.id, financiamentoId: f.id }
}

/** O parceiro devolveu parte (ou todo) o dinheiro que não virou cabelo. */
export async function receberFinanciamento(ctx: Ctx, d: { id: Id; financiamentoId: Id; moeda: CodigoMoeda; valor: number; forma: string; obs?: string }) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  if (f.eventos.some((e) => e.id === d.id)) return { id: d.id }
  const s = await carregar(ctx, f)
  exigir(s.status === 'aberto', 'Não há saldo a receber nesse adiantamento.')
  exigirInteiroPositivo(d.valor, 'Valor')
  const cfg = await exigirMoedaAtiva(ctx, d.moeda)
  const { valorPrincipal } = await paraPrincipal(ctx, d.valor, d.moeda, 'venda')
  exigir(valorPrincipal <= s.saldo + (d.moeda === cfg.moedaPrincipal ? 0 : 1), `O valor passa do que falta (${formatar(s.saldo, cfg.moedaPrincipal)}).`)
  await registrarAcerto(ctx, { id: d.id, pessoaId: f.pessoaId, direcao: 'recebi', valor: d.valor, moeda: d.moeda, forma: d.forma, descricao: `${textoOrigem(f.codigo)}${d.obs?.trim() ? ` · ${d.obs.trim()}` : ''}` })
  await guardarEvento(ctx, f, evento(ctx, { id: d.id, tipo: 'recebimento', moeda: d.moeda, valor: d.valor, forma: d.forma, obs: d.obs?.trim() || undefined }))
  await auditar(ctx, 'receberFinanciamento', f.id, `${f.codigo}: recebi ${formatar(d.valor, d.moeda)}`, [f.pessoaId])
  return { id: d.id }
}

/** Cabelo entregue além do adiantado: a loja paga a diferença ao parceiro (sai do caixa, como pagamento a fornecedor). */
export async function pagarDiferencaFinanciamento(ctx: Ctx, d: { id: Id; financiamentoId: Id; moeda: CodigoMoeda; valor: number; forma: string }) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  if (f.eventos.some((e) => e.id === d.id)) return { id: d.id }
  const s = await carregar(ctx, f)
  exigir(s.status === 'aPagar', 'Não há diferença a pagar nesse adiantamento.')
  exigirInteiroPositivo(d.valor, 'Valor')
  const cfg = await exigirMoedaAtiva(ctx, d.moeda)
  const { valorPrincipal } = await paraPrincipal(ctx, d.valor, d.moeda, 'compra')
  exigir(valorPrincipal <= s.aPagarParceiro + (d.moeda === cfg.moedaPrincipal ? 0 : 1), `O valor passa da diferença (${formatar(s.aPagarParceiro, cfg.moedaPrincipal)}).`)
  await registrarAcerto(ctx, { id: d.id, pessoaId: f.pessoaId, direcao: 'paguei', valor: d.valor, moeda: d.moeda, forma: d.forma, descricao: `${textoOrigem(f.codigo)} · diferença do cabelo entregue` })
  await guardarEvento(ctx, f, evento(ctx, { id: d.id, tipo: 'diferenca', moeda: d.moeda, valor: d.valor, forma: d.forma }))
  await auditar(ctx, 'pagarDiferencaFinanciamento', f.id, `${f.codigo}: paguei a diferença ${formatar(d.valor, d.moeda)}`, [f.pessoaId])
  return { id: d.id }
}

/**
 * Abate AGORA da comissão a pagar: a comissão que a loja devia à pessoa paga a dívida dela (sem passar pelo caixa).
 * Conta como comissão paga (Equipe › Comissões) e baixa o saldo do adiantamento.
 */
export async function abaterComissaoFinanciamento(ctx: Ctx, d: { id: Id; financiamentoId: Id; valor: number; obs?: string }) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  if (f.eventos.some((e) => e.id === d.id)) return { id: d.id }
  const s = await carregar(ctx, f)
  exigir(s.status === 'aberto', 'Não há dívida para abater nesse adiantamento.')
  exigirInteiroPositivo(d.valor, 'Valor')
  const cfg = await lerConfig(ctx)
  exigir(d.valor <= s.saldo, `O valor passa do que falta (${formatar(s.saldo, cfg.moedaPrincipal)}).`)
  const aPagar = await comissaoAPagar(ctx, f.pessoaId)
  exigir(d.valor <= aPagar, aPagar > 0 ? `A comissão a pagar é só ${formatar(aPagar, cfg.moedaPrincipal)}.` : 'Essa pessoa não tem comissão a pagar.')
  await moverConta(ctx, { pessoaId: f.pessoaId, delta: -d.valor, tipo: 'comissao', origemId: d.id, descricao: `Comissão abatida · ${textoOrigem(f.codigo)}${d.obs?.trim() ? ` · ${d.obs.trim()}` : ''}` })
  await guardarEvento(ctx, f, evento(ctx, { id: d.id, tipo: 'comissao', moeda: cfg.moedaPrincipal, valor: d.valor, obs: d.obs?.trim() || undefined }))
  await auditar(ctx, 'abaterComissaoFinanciamento', f.id, `${f.codigo}: abateu ${formatar(d.valor, cfg.moedaPrincipal)} da comissão`, [f.pessoaId])
  return { id: d.id }
}

/**
 * Chamado por pagarComissao: se a pessoa tem adiantamento aberto marcado "abater das comissões", retém o que der
 * (mais antigo primeiro) e devolve quanto foi retido (moeda principal). O resto sai do caixa normalmente.
 */
export async function reterComissaoFinanciamentos(ctx: Ctx, d: { pessoaId: Id; valorPrincipal: number; pagamentoId: Id }) {
  const fins = (await ctx.repos.financiamentos.listar({ pessoaId: d.pessoaId })).filter((f) => f.abaterComissoes && !f.encerramento).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  let resta = d.valorPrincipal
  let retido = 0
  for (const f of fins) {
    if (resta <= 0) break
    const s = await carregar(ctx, f)
    if (s.saldo <= 0) continue
    const x = Math.min(resta, s.saldo)
    const id = `${d.pagamentoId}-${f.id}`
    await moverConta(ctx, { pessoaId: f.pessoaId, delta: -x, tipo: 'comissao', origemId: id, descricao: `Comissão retida · ${textoOrigem(f.codigo)}` })
    await guardarEvento(ctx, f, evento(ctx, { id, tipo: 'comissao', moeda: (await lerConfig(ctx)).moedaPrincipal, valor: x, obs: 'Retida ao pagar a comissão', pagamentoComissaoId: d.pagamentoId }))
    await auditar(ctx, 'abaterComissaoFinanciamento', f.id, `${f.codigo}: retido ${x} da comissão paga`, [f.pessoaId])
    resta -= x
    retido += x
  }
  return retido
}

/**
 * ADIANTEI MAIS: mais dinheiro no mesmo adiantamento (ex.: 5.000 e depois mais 2.000 → a pessoa deve 7.000).
 * Sai do caixa (empréstimo operacional, fora do DRE), entra na conta da pessoa e aparece na linha do tempo.
 * Reabre um adiantamento quitado; encerrado não (crie outro).
 */
export async function reforcarFinanciamento(ctx: Ctx, d: { id: Id; financiamentoId: Id; moeda: CodigoMoeda; valor: number; forma: string; obs?: string; prazo?: string }) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  if (f.eventos.some((e) => e.id === d.id)) return { id: d.id }
  exigir(!f.encerramento, 'Esse adiantamento foi encerrado: crie um novo.')
  exigirInteiroPositivo(d.valor, 'Valor')
  await exigirMoedaAtiva(ctx, d.moeda)
  exigir(!d.prazo || (/^\d{4}-\d{2}-\d{2}$/.test(d.prazo) && d.prazo >= f.data), 'A data limite não pode ser antes da data do adiantamento.', 'prazo')
  const { valorPrincipal } = await paraPrincipal(ctx, d.valor, d.moeda, 'compra')
  exigir(valorPrincipal > 0, 'Valor pequeno demais para registrar.')
  const pessoa = await ctx.repos.pessoas.obter(f.pessoaId)
  await moverCaixa(ctx, { data: ctx.relogio.hoje(), moeda: d.moeda, forma: d.forma, delta: -d.valor, tipo: 'emprestimo', origemId: d.id, descricao: `Saída por empréstimo operacional · ${f.codigo} (mais) · ${pessoa?.nome ?? ''}` })
  await moverConta(ctx, { pessoaId: f.pessoaId, delta: valorPrincipal, tipo: 'adiantamento', origemId: d.id, forma: d.forma, descricao: `${textoOrigem(f.codigo)} · mais dinheiro para comprar cabelo` })
  const atual = await guardarEvento(ctx, f, evento(ctx, { id: d.id, tipo: 'reforco', moeda: d.moeda, valor: d.valor, forma: d.forma, obs: d.obs?.trim() || undefined }))
  if (d.prazo !== undefined && (d.prazo || undefined) !== atual.prazo) await ctx.repos.financiamentos.salvar(tocar(ctx, { ...atual, prazo: d.prazo || undefined }))
  await auditar(ctx, 'reforcarFinanciamento', f.id, `${f.codigo} · ${pessoa?.nome}: mais ${formatar(d.valor, d.moeda)} (${d.forma})`, [f.pessoaId])
  return { id: d.id }
}

/** Encerra à mão com motivo. Se ainda havia saldo, ele vira baixa (ajuste) na conta corrente: a conta fica zerada. */
export async function encerrarFinanciamento(ctx: Ctx, d: { id: Id; financiamentoId: Id; motivo: string }) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  if (f.encerramento) return { id: f.id }
  exigir(d.motivo?.trim(), 'Diga o motivo do encerramento.', 'motivo')
  const s = await carregar(ctx, f)
  let atual = f
  if (s.saldo !== 0) {
    await moverConta(ctx, { pessoaId: f.pessoaId, delta: -s.saldo, tipo: 'ajuste', origemId: d.id, descricao: `Baixa · ${textoOrigem(f.codigo)} · ${d.motivo.trim()}` })
    atual = await guardarEvento(ctx, f, evento(ctx, { id: d.id, tipo: 'baixa', obs: d.motivo.trim() }))
  }
  await ctx.repos.financiamentos.salvar(tocar(ctx, { ...atual, encerramento: { em: ctx.relogio.agora(), data: ctx.relogio.hoje(), porNome: ctx.sessao.nome, motivo: d.motivo.trim(), saldo: s.saldo } }))
  await auditar(ctx, 'encerrarFinanciamento', f.id, `${f.codigo} encerrado · ${d.motivo.trim()}${s.saldo ? ` · baixa de ${s.saldo}` : ''}`, [f.pessoaId])
  return { id: f.id }
}

/** Liga (ou desliga) o abatimento automático nas próximas comissões e a viagem do adiantamento. */
export async function ajustarFinanciamento(ctx: Ctx, d: { financiamentoId: Id; abaterComissoes?: boolean; viagemId?: Id | null; obs?: string
  /** a data limite para entregar ('' tira a data) */
  prazo?: string }) {
  exigirAdmin(ctx)
  const f = await obter(ctx, d.financiamentoId)
  const mudou: string[] = []
  const prox = { ...f }
  if (d.abaterComissoes !== undefined && d.abaterComissoes !== !!f.abaterComissoes) {
    prox.abaterComissoes = d.abaterComissoes
    mudou.push(d.abaterComissoes ? 'abater das próximas comissões' : 'não abater das comissões')
  }
  if (d.viagemId !== undefined && (d.viagemId || undefined) !== f.viagemId) {
    if (d.viagemId) exigir(await ctx.repos.viagens.obter(d.viagemId), 'Viagem não encontrada.')
    prox.viagemId = d.viagemId || undefined
    mudou.push(d.viagemId ? 'viagem ligada' : 'viagem desligada')
  }
  if (d.prazo !== undefined && (d.prazo || undefined) !== f.prazo) {
    exigir(!d.prazo || (/^\d{4}-\d{2}-\d{2}$/.test(d.prazo) && d.prazo >= f.data), 'A data limite não pode ser antes da data do adiantamento.', 'prazo')
    prox.prazo = d.prazo || undefined
    mudou.push(d.prazo ? `data limite ${f.prazo ?? '—'} → ${d.prazo}` : 'sem data limite')
  }
  if (d.obs !== undefined && (d.obs.trim() || undefined) !== f.obs) {
    prox.obs = d.obs.trim() || undefined
    mudou.push('observação')
  }
  if (!mudou.length) return { id: f.id }
  await ctx.repos.financiamentos.salvar(tocar(ctx, prox))
  await auditar(ctx, 'ajustarFinanciamento', f.id, `${f.codigo}: ${mudou.join('; ')}`, [f.pessoaId])
  return { id: f.id }
}

// ---------- consultas ----------

async function comissaoAPagar(ctx: Ctx, pessoaId: Id) {
  return (await comissoes(ctx, { pessoaId })).porPessoa.find((x) => x.pessoaId === pessoaId)?.aPagar ?? 0
}

/** funcionária só vê os adiantamentos dela */
function podeVer(ctx: Ctx, f: Financiamento) {
  return ctx.sessao.perfil === 'admin' || (!!ctx.sessao.pessoaId && f.pessoaId === ctx.sessao.pessoaId)
}

/** Lista com filtros (situação, pessoa, viagem, busca) e os totais: dinheiro na mão dos compradores, entregue, a pagar. */
/** o prazo de um adiantamento ainda em aberto: vencido · semana (vence em até 7 dias) · ok · sem (sem data limite) */
export function situacaoPrazo(x: { prazo?: string; status: string }, hoje: string): 'vencido' | 'semana' | 'ok' | 'sem' | 'fechado' {
  if (x.status !== 'aberto') return 'fechado'
  if (!x.prazo) return 'sem'
  if (x.prazo < hoje) return 'vencido'
  return diasEntre(hoje, x.prazo) <= 7 ? 'semana' : 'ok'
}

export async function financiamentos(ctx: Ctx, p: { status?: StatusFinanciamento | 'ativos'; pessoaId?: Id; viagemId?: Id; busca?: string
  /** período pela DATA em que o adiantamento foi feito */
  de?: string; ate?: string
  /** o prazo: vencido (passou da data limite e ainda deve) · semana (vence em até 7 dias) · sem (sem data limite) */
  prazo?: 'vencido' | 'semana' | 'sem' } = {}) {
  const hoje = ctx.relogio.hoje()
  const cfg = await lerConfig(ctx)
  const todos = (await ctx.repos.financiamentos.listar()).filter((f) => podeVer(ctx, f))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const viagens = new Map((await ctx.repos.viagens.listar()).map((x) => [x.id, x]))
  const movs = await ctx.repos.movConta.listar()
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t]))
  const b = p.busca?.trim().toLowerCase()
  const todas = todos
    .map((f) => {
      const s = situacaoFinanciamento(f, movs.filter((m) => m.pessoaId === f.pessoaId), compras)
      const { efeito: _e, ...resto } = s
      const v = f.viagemId ? viagens.get(f.viagemId) : undefined
      return {
        id: f.id,
        codigo: f.codigo,
        data: f.data,
        pessoaId: f.pessoaId,
        pessoa: pessoas.get(f.pessoaId)?.nome ?? '—',
        telefone: pessoas.get(f.pessoaId)?.telefone,
        moeda: f.moeda,
        valor: f.valor,
        viagem: v ? { id: v.id, codigo: v.codigo, nome: v.nome } : undefined,
        prazo: f.prazo,
        abaterComissoes: !!f.abaterComissoes,
        entregas: f.eventos.filter((e) => e.tipo === 'entrega').length,
        ultimo: f.eventos[f.eventos.length - 1]?.data ?? f.data,
        ...resto,
      }
    })
    .sort((a, b) => (a.data + a.codigo < b.data + b.codigo ? 1 : -1))
  const linhas = todas
    .filter((x) => !p.status || (p.status === 'ativos' ? x.status === 'aberto' || x.status === 'aPagar' : x.status === p.status))
    .filter((x) => !p.pessoaId || x.pessoaId === p.pessoaId)
    .filter((x) => !p.viagemId || x.viagem?.id === p.viagemId)
    .filter((x) => (!p.de || x.data >= p.de) && (!p.ate || x.data <= p.ate))
    .filter((x) => !p.prazo || situacaoPrazo(x, hoje) === p.prazo)
    .filter((x) => !b || [x.codigo, x.pessoa, x.viagem?.codigo, x.viagem?.nome].some((y) => y?.toLowerCase().includes(b)))
  const contar = (st: StatusFinanciamento) => todas.filter((x) => x.status === st).length
  return {
    moeda: cfg.moedaPrincipal,
    linhas,
    contagem: { aberto: contar('aberto'), aPagar: contar('aPagar'), quitado: contar('quitado'), encerrado: contar('encerrado'), todos: todas.length },
    totais: {
      financiado: linhas.reduce((s, x) => s + x.financiado, 0),
      entregue: linhas.reduce((s, x) => s + x.entregue, 0),
      gramas: linhas.reduce((s, x) => s + x.gramas, 0),
      /** dinheiro ainda na mão dos compradores (carteira de terceiros) */
      naMao: linhas.filter((x) => x.status === 'aberto').reduce((s, x) => s + x.saldo, 0),
      aPagarParceiros: linhas.filter((x) => x.status === 'aPagar').reduce((s, x) => s + x.aPagarParceiro, 0),
    },
  }
}

export interface PassoFinanciamento {
  id: Id
  tipo: 'emprestimo' | EventoFinanciamento['tipo'] | 'quitacao' | 'encerramento'
  titulo: string
  data: string
  em: string
  porNome?: string
  /** efeito na dívida (moeda principal): + aumentou o que a pessoa deve; − abateu */
  efeito?: number
  saldoDepois?: number
  dinheiro?: { valor: number; moeda: string; forma?: string }
  obs?: string
  compra?: { id: Id; codigo?: string; gramas: number; valor: number; etapa: string; nomeEtapa: string; cancelada: boolean; linhas: { descricao: string; quantidade: number; total: number; moeda: string }[] }
  lotes?: { id: Id; codigo?: string; nome: string; saldo: number; inicial: number }[]
}

/** Detalhe: números, linha do tempo (dinheiro → entregas → acertos → quitação) e as entregas com os lotes. */
export async function financiamento(ctx: Ctx, p: { id: Id }) {
  const f = await obter(ctx, p.id)
  exigir(podeVer(ctx, f), 'Esse adiantamento não é seu.')
  const cfg = await lerConfig(ctx)
  const pessoa = await ctx.repos.pessoas.obter(f.pessoaId)
  const movs = await ctx.repos.movConta.listar({ pessoaId: f.pessoaId })
  const compras = new Map<Id, Transacao>()
  for (const e of f.eventos) if (e.compraId) {
    const t = await ctx.repos.transacoes.obter(e.compraId)
    if (t) compras.set(t.id, t)
  }
  const s = situacaoFinanciamento(f, movs, compras)
  const itens: Item[] = compras.size ? await ctx.repos.itens.listar() : []
  const usuarios = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u.nome]))
  const nomeEtapa = (t: Transacao) => ctx.modulos.obter(t.moduloId).compra?.etapas.find((e) => e.id === t.etapa)?.nome ?? (t.etapa === ETAPA_CANCELADO ? 'Cancelada' : t.etapa === 'recusado' ? 'Recusada' : t.etapa)
  let saldo = s.inicial
  const passos: PassoFinanciamento[] = [
    { id: f.id, tipo: 'emprestimo', titulo: 'Dinheiro entregue para comprar cabelo', data: f.data, em: f.criadoEm, porNome: usuarios.get(f.criadoPor), efeito: s.inicial, saldoDepois: saldo, dinheiro: { valor: f.valor, moeda: f.moeda, forma: f.forma }, obs: f.obs },
  ]
  for (const e of f.eventos) {
    const efeito = s.efeito(e)
    saldo += efeito
    const passo: PassoFinanciamento = { id: e.id, tipo: e.tipo, titulo: NOME_EVENTO[e.tipo], data: e.data, em: e.em, porNome: e.porNome, efeito, saldoDepois: saldo, obs: e.obs, dinheiro: e.valor !== undefined && e.moeda ? { valor: e.valor, moeda: e.moeda, forma: e.forma } : undefined }
    const t = e.compraId ? compras.get(e.compraId) : undefined
    if (t) {
      passo.compra = {
        id: t.id,
        codigo: t.codigo,
        gramas: t.linhas.reduce((x, l) => x + l.quantidade, 0),
        valor: t.totalPrincipal,
        etapa: t.etapa,
        nomeEtapa: nomeEtapa(t),
        cancelada: t.etapa === ETAPA_CANCELADO,
        linhas: t.linhas.map((l) => ({ descricao: l.descricao, quantidade: l.quantidade, total: l.total, moeda: l.moeda })),
      }
      passo.lotes = itens.filter((i) => comprasDe(i).includes(t.id)).map((i) => ({ id: i.id, codigo: i.codigo, nome: i.nome, saldo: i.saldo, inicial: i.quantidadeInicial ?? 0 }))
    }
    passos.push(passo)
  }
  if (s.status === 'quitado' && passos.length > 1) {
    const ultimo = passos[passos.length - 1]
    passos.push({ id: `${f.id}-quitado`, tipo: 'quitacao', titulo: 'Quitado: o cabelo e os acertos cobriram o adiantamento', data: ultimo.data, em: ultimo.em, saldoDepois: 0 })
  }
  if (f.encerramento) passos.push({ id: `${f.id}-encerrado`, tipo: 'encerramento', titulo: 'Encerrado', data: f.encerramento.data, em: f.encerramento.em, porNome: f.encerramento.porNome, obs: f.encerramento.motivo, efeito: f.encerramento.saldo ? -f.encerramento.saldo : undefined, saldoDepois: 0 })
  const v = f.viagemId ? await ctx.repos.viagens.obter(f.viagemId) : undefined
  const admin = ctx.sessao.perfil === 'admin'
  const { efeito: _e, ...numeros } = s
  return {
    financiamento: f,
    pessoa: pessoa ? { id: pessoa.id, nome: pessoa.nome, telefone: pessoa.telefone } : undefined,
    moedaPrincipal: cfg.moedaPrincipal,
    ...numeros,
    nomeStatus: NOME_STATUS_FINANCIAMENTO[s.status],
    viagem: v && !v.apagadoEm ? { id: v.id, codigo: v.codigo, nome: v.nome, status: v.status } : undefined,
    /** comissão que a loja ainda deve à pessoa (para "Abater da comissão") */
    comissaoAPagar: admin ? await comissaoAPagar(ctx, f.pessoaId) : 0,
    /** saldo da conta corrente inteira da pessoa (pode ter outras coisas além do adiantamento) */
    saldoConta: movs.reduce((x, m) => x + m.delta, 0),
    passos,
    origem: textoOrigem(f.codigo, pessoa?.nome),
  }
}

/**
 * De qual adiantamento veio uma compra ou um lote (e os filhos dele, pela origem): "Adiantamento AD-0001 · Parceiro X".
 * O custo real do lote = o valor entregue (nada mais). Devolve null quando não veio de adiantamento.
 */
export async function origemFinanciamento(ctx: Ctx, p: { compraId?: Id; itemId?: Id }) {
  let compraIds: Id[] = []
  if (p.compraId) compraIds = [p.compraId]
  else if (p.itemId) compraIds = comprasDe(await ctx.repos.itens.obter(p.itemId))
  if (!compraIds.length) return null
  for (const cid of compraIds) {
    const t = await ctx.repos.transacoes.obter(cid)
    let f = t?.financiamentoId ? await ctx.repos.financiamentos.obter(t.financiamentoId) : undefined
    if (!f) f = (await ctx.repos.financiamentos.listar()).find((x) => x.eventos.some((e) => e.compraId === cid))
    if (f && !f.apagadoEm && podeVer(ctx, f)) {
      const pessoa = await ctx.repos.pessoas.obter(f.pessoaId)
      return { id: f.id, codigo: f.codigo, compraId: cid, pessoaId: f.pessoaId, pessoa: pessoa?.nome, texto: textoOrigem(f.codigo, pessoa?.nome) }
    }
  }
  return null
}

/** Diagnóstico: o adiantamento saiu do caixa uma vez só, as entregas não pagaram nada pelo caixa e a conta bate. */
export async function conferirFinanciamentos(ctx: Ctx): Promise<string[]> {
  const problemas: string[] = []
  const caixa = await ctx.repos.movCaixa.listar()
  const contas = await ctx.repos.movConta.listar()
  for (const f of await ctx.repos.financiamentos.listar()) {
    const saida = caixa.filter((m) => m.origemId === f.id)
    if (saida.length !== 1 || saida[0].delta !== -f.valor || saida[0].tipo !== 'emprestimo') problemas.push(`Adiantamento ${f.codigo}: saída do caixa ≠ ${-f.valor} ${f.moeda}`)
    const naConta = contas.filter((m) => m.origemId === f.id).reduce((s, m) => s + m.delta, 0)
    if (naConta !== f.valorPrincipal) problemas.push(`Adiantamento ${f.codigo}: conta corrente ${naConta} ≠ ${f.valorPrincipal}`)
    for (const e of f.eventos.filter((x) => x.compraId)) {
      const t = await ctx.repos.transacoes.obter(e.compraId!)
      if (!t) problemas.push(`Adiantamento ${f.codigo}: compra ${e.compraId} sumiu`)
      else if (t.pagamentos.length || caixa.some((m) => m.origemId === t.id && m.tipo === 'compra')) problemas.push(`Adiantamento ${f.codigo}: a entrega ${t.codigo ?? t.id} saiu do caixa (contaria duas vezes)`)
    }
    for (const e of f.eventos.filter((x) => x.tipo !== 'entrega'))
      if (!contas.some((m) => m.origemId === e.id)) problemas.push(`Adiantamento ${f.codigo}: evento ${e.tipo} sem movimento na conta`)
  }
  return problemas
}

/** usado pelo menu e pelo painel (sem custo de montar a lista inteira duas vezes) */
export async function resumoFinanciamentos(ctx: Ctx) {
  const r = await financiamentos(ctx, { status: 'ativos' })
  return { abertos: r.contagem.aberto, aPagar: r.contagem.aPagar, naMao: r.totais.naMao, aPagarParceiros: r.totais.aPagarParceiros, linhas: r.linhas }
}

