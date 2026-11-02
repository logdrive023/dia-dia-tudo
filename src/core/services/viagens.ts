// VIAGENS DE COMPRA: gestão, diagnóstico e prestação de contas.
// Uma viagem tem quem viajou, quando, orçamento e uma CARTEIRA por moeda:
//   adiantamento (sai do caixa → entra na carteira) − gastos operacionais (combustível, hospedagem…) = o que deve sobrar.
// Ao encerrar: a sobra contada volta ao caixa, o que passou do adiantamento pode ser reembolsado e a diferença fica
// registrada. As compras feitas na viagem (várias, de fornecedores diferentes) ficam ligadas pela compra (viagemId):
//   GASTOS OPERACIONAIS = custo da logística · CAPITAL DE COMPRA = o que se pagou pelo cabelo.
// RATEIO: o gasto da viagem dividido pelas gramas (ou pelo valor) compradas → custo real por grama. "Incorporar" soma a
// parte do gasto que corresponde ao que ainda está em estoque ao custo dos lotes (as margens daqui em diante já contam
// com ele) e é desfeito ao reabrir. RESULTADO = receita das vendas do cabelo da viagem (pela genealogia, proporcional às
// gramas) − (custo do cabelo + gastos da viagem). Viagem sem compra = custo de prospecção.
//
// No caixa (DRE geral): o adiantamento entra como despesa "Viagens"; a sobra devolvida estorna esse adiantamento; o
// reembolso é despesa. Assim a despesa da viagem no DRE = o dinheiro que de fato saiu.

import { multiplicarFator, proporcao, type CodigoMoeda } from '../domain/dinheiro'
import { diasEntre } from '../domain/datas'
import { ErroNegocio, exigir } from '../domain/erros'
import { novoId } from '../domain/ids'
import type { DespesaViagem, Id, Item, MovCaixa, MovCarteiraViagem, MovEstoque, Pessoa, Transacao, Viagem } from '../domain/tipos'
import { auditar, type Ctx, exigirInteiroPositivo, lerConfig, novo, paraPrincipal, tocar } from './contexto'
import { moverCaixa } from './caixa'
import { proximoCodigo, unidadeTexto } from './estoque'
import { fatorDaTabela, tabelaVigente } from './precos'

export const CATEGORIA_CAIXA_VIAGEM = 'Viagens'

export interface CategoriaViagem {
  id: string
  nome: string
  icone: string
}

export const CATEGORIAS_VIAGEM_PADRAO: CategoriaViagem[] = [
  { id: 'combustivel', nome: 'Combustível', icone: '⛽' },
  { id: 'hospedagem', nome: 'Hospedagem', icone: '🏨' },
  { id: 'comida', nome: 'Comida', icone: '🍽️' },
  { id: 'transporte', nome: 'Transporte', icone: '🚌' },
  { id: 'frete', nome: 'Frete do cabelo', icone: '📦' },
  { id: 'imprevisto', nome: 'Imprevistos', icone: '⚠️' },
  { id: 'outros', nome: 'Outros', icone: '🧾' },
]

const ETAPAS_FORA = new Set(['cancelado', 'recusado'])

// ---------- acesso ----------

function eViajante(ctx: Ctx, v: Viagem) {
  return !!ctx.sessao.pessoaId && v.viajantes.includes(ctx.sessao.pessoaId)
}

function exigirAdmin(ctx: Ctx, mensagem = 'Só o administrador faz isso na viagem.') {
  exigir(ctx.sessao.perfil === 'admin', mensagem)
}

async function obterViagem(ctx: Ctx, id: Id) {
  const v = await ctx.repos.viagens.obter(id)
  exigir(v && !v.apagadoEm, 'Viagem não encontrada.')
  // registros antigos/importados sem as listas
  return { ...v, despesas: v.despesas ?? [], carteira: v.carteira ?? [], viajantes: v.viajantes ?? [], rateio: v.rateio ?? 'grama' } as Viagem
}

async function obterComAcesso(ctx: Ctx, id: Id) {
  const v = await obterViagem(ctx, id)
  exigir(ctx.sessao.perfil === 'admin' || eViajante(ctx, v), 'Essa viagem não é sua.')
  return v
}

function exigirAberta(v: Viagem) {
  exigir(v.status === 'aberta', `A viagem ${v.codigo} está encerrada. Reabra para mudar.`)
}

// ---------- categorias ----------

export async function lerCategorias(ctx: Ctx): Promise<CategoriaViagem[]> {
  const r = await ctx.repos.config.obter('categoriasViagem')
  const lista = r?.valor as CategoriaViagem[] | undefined
  return lista?.length ? lista : CATEGORIAS_VIAGEM_PADRAO
}

export async function categoriasViagem(ctx: Ctx, _p: object = {}) {
  return lerCategorias(ctx)
}

export async function salvarCategoriasViagem(ctx: Ctx, d: { categorias: CategoriaViagem[] | null }) {
  exigirAdmin(ctx)
  const id = 'categoriasViagem'
  const antes = await ctx.repos.config.obter(id)
  if (d.categorias === null) {
    if (antes) await ctx.repos.config.salvar(tocar(ctx, { ...antes, valor: null }))
    await auditar(ctx, 'salvarCategoriasViagem', undefined, 'Voltou às categorias do sistema')
    return { id }
  }
  const lista = (d.categorias ?? []).map((c) => ({ id: c.id?.trim() || novoId(), nome: c.nome?.trim() ?? '', icone: c.icone?.trim() || '🧾' }))
  exigir(lista.length, 'Deixe pelo menos uma categoria.')
  exigir(lista.every((c) => c.nome), 'Toda categoria precisa de nome.')
  exigir(new Set(lista.map((c) => c.nome.toLowerCase())).size === lista.length, 'Há duas categorias com o mesmo nome.')
  exigir(new Set(lista.map((c) => c.id)).size === lista.length, 'Há duas categorias com o mesmo código.')
  await ctx.repos.config.salvar(antes ? tocar(ctx, { ...antes, valor: lista }) : novo(ctx, { id, valor: lista }))
  await auditar(ctx, 'salvarCategoriasViagem', undefined, lista.map((c) => `${c.icone} ${c.nome}`).join(', '))
  return { id }
}

// ---------- comandos ----------

/** Cria ou edita a viagem (só admin). Código "VG-0001" na criação. */
export async function salvarViagem(
  ctx: Ctx,
  d: { id: Id; nome: string; destino?: string; viajantes: Id[]; inicio: string; fim?: string; orcamento?: number; orcamentoCompra?: number; rateio?: 'grama' | 'valor'; obs?: string },
) {
  exigirAdmin(ctx, 'Só o administrador cria ou muda uma viagem.')
  const nome = d.nome?.trim()
  exigir(nome, 'Dê um nome à viagem (ex.: destino e mês).', 'nome')
  const viajantes = [...new Set(d.viajantes ?? [])]
  exigir(viajantes.length, 'Diga quem viajou.', 'viajantes')
  for (const p of viajantes) exigir(await ctx.repos.pessoas.obter(p), 'Quem viajou: pessoa não encontrada.')
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(d.inicio ?? ''), 'Data de início inválida.', 'inicio')
  if (d.fim) exigir(/^\d{4}-\d{2}-\d{2}$/.test(d.fim) && d.fim >= d.inicio, 'A volta não pode ser antes da ida.', 'fim')
  if (d.orcamento !== undefined) exigirInteiroPositivo(d.orcamento, 'Orçamento', true)
  if (d.orcamentoCompra !== undefined) exigirInteiroPositivo(d.orcamentoCompra, 'Orçamento de compra', true)
  exigir(!d.rateio || d.rateio === 'grama' || d.rateio === 'valor', 'Rateio inválido.')
  const antes = await ctx.repos.viagens.obter(d.id)
  const campos = { nome, destino: d.destino?.trim() || undefined, viajantes, inicio: d.inicio, fim: d.fim || undefined, orcamento: d.orcamento, orcamentoCompra: d.orcamentoCompra, obs: d.obs?.trim() || undefined }
  if (!antes) {
    const v = novo<Viagem>(ctx, { id: d.id, codigo: await proximoCodigo(ctx, 'VG'), ...campos, status: 'aberta', rateio: d.rateio ?? 'grama', despesas: [], carteira: [] })
    await ctx.repos.viagens.salvar(v)
    await auditar(ctx, 'salvarViagem', v.id, `${v.codigo} · ${nome} criada`, viajantes)
    return { id: v.id, codigo: v.codigo }
  }
  const v = await obterViagem(ctx, d.id)
  const rateio = d.rateio ?? v.rateio
  exigir(rateio === v.rateio || !v.incorporacao, 'O gasto já entrou no custo dos lotes: reabra a viagem para mudar o rateio.')
  const mudou: string[] = []
  const nomes = async (ids: Id[]) => (await Promise.all(ids.map(async (x) => (await ctx.repos.pessoas.obter(x))?.nome ?? x))).join(', ')
  if (v.nome !== nome) mudou.push(`Nome: ${v.nome} → ${nome}`)
  if ((v.destino ?? '') !== (campos.destino ?? '')) mudou.push(`Destino: ${v.destino ?? '—'} → ${campos.destino ?? '—'}`)
  if (v.viajantes.join() !== viajantes.join()) mudou.push(`Quem viajou: ${await nomes(v.viajantes)} → ${await nomes(viajantes)}`)
  if (v.inicio !== d.inicio || (v.fim ?? '') !== (campos.fim ?? '')) mudou.push(`Datas: ${v.inicio} a ${v.fim ?? '…'} → ${d.inicio} a ${campos.fim ?? '…'}`)
  if ((v.orcamento ?? 0) !== (d.orcamento ?? 0) || (v.orcamentoCompra ?? 0) !== (d.orcamentoCompra ?? 0)) mudou.push('Orçamento')
  if (rateio !== v.rateio) mudou.push(`Rateio: por ${v.rateio === 'grama' ? 'gramas' : 'valor'} → por ${rateio === 'grama' ? 'gramas' : 'valor'}`)
  if ((v.obs ?? '') !== (campos.obs ?? '')) mudou.push('Observação')
  if (!mudou.length) return { id: v.id, codigo: v.codigo }
  await ctx.repos.viagens.salvar(tocar(ctx, { ...v, ...campos, rateio }))
  await auditar(ctx, 'salvarViagem', v.id, `${v.codigo}: ${mudou.join('; ')}`, viajantes)
  return { id: v.id, codigo: v.codigo }
}

/** Adiantamento: o dinheiro sai do caixa da loja e entra na carteira da viagem (por moeda). */
export async function adiantarViagem(ctx: Ctx, d: { id: Id; viagemId: Id; moeda: CodigoMoeda; forma: string; valor: number; obs?: string }) {
  exigirAdmin(ctx, 'Só o administrador dá adiantamento.')
  const v = await obterViagem(ctx, d.viagemId)
  if (v.carteira.some((m) => m.id === d.id)) return { id: d.id }
  exigirAberta(v)
  exigirInteiroPositivo(d.valor, 'Valor do adiantamento')
  const nomes = await nomesViajantes(ctx, v)
  const mov = await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: -d.valor,
    tipo: 'despesa',
    origemId: v.id,
    descricao: `Adiantamento ${v.codigo} · ${nomes}`,
    categoria: CATEGORIA_CAIXA_VIAGEM,
  })
  await marcarViagemNoCaixa(ctx, mov)
  const entrada: MovCarteiraViagem = { id: d.id, tipo: 'adiantamento', data: ctx.relogio.hoje(), em: ctx.relogio.agora(), moeda: d.moeda, delta: d.valor, forma: d.forma, movCaixaId: mov.id, porNome: ctx.sessao.nome, obs: d.obs?.trim() || undefined }
  await ctx.repos.viagens.salvar(tocar(ctx, { ...v, carteira: [...v.carteira, entrada] }))
  await auditar(ctx, 'adiantarViagem', v.id, `${v.codigo}: adiantamento de ${d.valor} ${d.moeda} (${d.forma}) para ${nomes}`, v.viajantes)
  return { id: d.id }
}

/** o caixa guarda de que viagem é o dinheiro (moverCaixa não conhece o campo) */
async function marcarViagemNoCaixa(ctx: Ctx, mov: MovCaixa) {
  await ctx.repos.movCaixa.salvar({ ...mov, viagemId: mov.origemId })
}

/** GASTO em segundos (quem viajou ou o admin): categoria, valor e moeda; foto e nota são opcionais. */
export async function registrarDespesaViagem(ctx: Ctx, d: { id: Id; viagemId: Id; categoria: string; moeda: CodigoMoeda; valor: number; data?: string; nota?: string }) {
  const v = await obterComAcesso(ctx, d.viagemId)
  if (v.despesas.some((x) => x.id === d.id)) return { id: d.id }
  exigirAberta(v)
  exigirInteiroPositivo(d.valor, 'Valor do gasto')
  const cats = await lerCategorias(ctx)
  const cat = cats.find((c) => c.id === d.categoria)
  exigir(cat, 'Escolha a categoria do gasto.', 'categoria')
  const cfg = await lerConfig(ctx)
  exigir(cfg.moedasAtivas.includes(d.moeda) || d.moeda === cfg.moedaPrincipal, `Moeda ${d.moeda} não está ativa.`)
  const data = d.data || ctx.relogio.hoje()
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(data) && data <= ctx.relogio.hoje(), 'Data do gasto inválida (não pode ser no futuro).')
  // saiu dinheiro em outra moeda: cotação de "compra" (a mesma regra do pagamento a fornecedor)
  const { valorPrincipal, cotacao } = await paraPrincipal(ctx, d.valor, d.moeda, 'compra')
  const despesa: DespesaViagem = {
    id: d.id,
    data,
    em: ctx.relogio.agora(),
    categoria: cat.id,
    moeda: d.moeda,
    valor: d.valor,
    valorPrincipal,
    cotacao,
    nota: d.nota?.trim() || undefined,
    por: ctx.sessao.usuarioId,
    porNome: ctx.sessao.nome,
  }
  await ctx.repos.viagens.salvar(tocar(ctx, { ...v, despesas: [...v.despesas, despesa] }))
  await auditar(ctx, 'registrarDespesaViagem', v.id, `${v.codigo}: ${cat.icone} ${cat.nome} ${d.valor} ${d.moeda}${despesa.nota ? ` · ${despesa.nota}` : ''}`, [d.id])
  return { id: d.id }
}

/** Anula um gasto lançado errado (nada é apagado). Quem viajou só anula o que ela mesma lançou. */
export async function anularDespesaViagem(ctx: Ctx, d: { viagemId: Id; despesaId: Id; motivo: string }) {
  const v = await obterComAcesso(ctx, d.viagemId)
  exigirAberta(v)
  const x = v.despesas.find((y) => y.id === d.despesaId)
  exigir(x, 'Gasto não encontrado.')
  if (x.anulada) return { id: x.id }
  exigir(ctx.sessao.perfil === 'admin' || x.por === ctx.sessao.usuarioId, 'Você só anula o gasto que você lançou.')
  exigir(d.motivo?.trim(), 'Diga o motivo.', 'motivo')
  const anulada = { em: ctx.relogio.agora(), porNome: ctx.sessao.nome, motivo: d.motivo.trim() }
  await ctx.repos.viagens.salvar(tocar(ctx, { ...v, despesas: v.despesas.map((y) => (y.id === x.id ? { ...y, anulada } : y)) }))
  await auditar(ctx, 'anularDespesaViagem', v.id, `${v.codigo}: gasto de ${x.valor} ${x.moeda} anulado · ${anulada.motivo}`, [x.id])
  return { id: x.id }
}

/** Liga compras (de lugares e fornecedores diferentes) à viagem. Uma compra só pertence a uma viagem. */
export async function vincularCompras(ctx: Ctx, d: { viagemId: Id; compraIds: Id[] }) {
  exigirAdmin(ctx)
  const v = await obterViagem(ctx, d.viagemId)
  exigirAberta(v)
  const ids = [...new Set(d.compraIds ?? [])]
  exigir(ids.length, 'Escolha pelo menos uma compra.')
  const ligadas: Transacao[] = []
  for (const id of ids) {
    const t = await ctx.repos.transacoes.obter(id)
    exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
    if (t.viagemId === v.id) continue
    exigir(!ETAPAS_FORA.has(t.etapa), `A compra ${t.codigo ?? ''} foi cancelada/recusada.`)
    if (t.viagemId) {
      const outra = await ctx.repos.viagens.obter(t.viagemId)
      if (outra && !outra.apagadoEm) throw new ErroNegocio(`A compra ${t.codigo ?? ''} já está na viagem ${outra.codigo}. Tire de lá antes.`)
    }
    ligadas.push(t)
  }
  for (const t of ligadas) await ctx.repos.transacoes.salvar(tocar(ctx, { ...t, viagemId: v.id }))
  if (ligadas.length) await auditar(ctx, 'vincularCompras', v.id, `${v.codigo} ← ${ligadas.map((t) => t.codigo ?? t.id).join(', ')}`, ligadas.map((t) => t.id))
  return { id: v.id, ligadas: ligadas.map((t) => t.id) }
}

export async function desvincularCompra(ctx: Ctx, d: { viagemId: Id; compraId: Id }) {
  exigirAdmin(ctx)
  const v = await obterViagem(ctx, d.viagemId)
  exigirAberta(v)
  const t = await ctx.repos.transacoes.obter(d.compraId)
  exigir(t && t.viagemId === v.id, 'Essa compra não está nesta viagem.')
  await ctx.repos.transacoes.salvar(tocar(ctx, { ...t, viagemId: undefined }))
  await auditar(ctx, 'desvincularCompra', v.id, `${v.codigo}: tirou ${t.codigo ?? t.id}`, [t.id])
  return { id: v.id }
}

/**
 * PRESTAÇÃO DE CONTAS: conta o dinheiro que sobrou (por moeda) e devolve ao caixa; o que passou do adiantamento pode ser
 * reembolsado a quem viajou; o resto vira "diferença" registrada (faltou / pagou do bolso). Opcional: incorporar o
 * gasto ao custo dos lotes.
 */
export async function encerrarViagem(
  ctx: Ctx,
  d: { viagemId: Id; contado: Record<CodigoMoeda, number>; forma?: string; reembolsar?: boolean; incorporar?: boolean; fim?: string; obs?: string },
) {
  exigirAdmin(ctx, 'Só o administrador encerra a viagem.')
  const v = await obterViagem(ctx, d.viagemId)
  if (v.status === 'encerrada') return { id: v.id }
  for (const [m, x] of Object.entries(d.contado ?? {})) exigirInteiroPositivo(x, `Contado em ${m}`, true)
  const forma = d.forma || 'dinheiro'
  const fim = d.fim || v.fim || ctx.relogio.hoje()
  exigir(fim >= v.inicio, 'A volta não pode ser antes da ida.')
  const caixa = new Map((await ctx.repos.movCaixa.listar({ origemId: v.id })).map((m) => [m.id, m]))
  const saldos = carteiraPorMoeda(v, caixa)
  const moedas = new Set([...saldos.map((s) => s.moeda), ...Object.keys(d.contado ?? {}).filter((m) => (d.contado[m] ?? 0) > 0)])
  const carteira = [...v.carteira]
  const nomes = await nomesViajantes(ctx, v)
  const resumo: string[] = []
  const agora = ctx.relogio.agora()
  const hoje = ctx.relogio.hoje()
  for (const moeda of moedas) {
    const s = saldos.find((x) => x.moeda === moeda)?.saldo ?? 0
    const contado = d.contado?.[moeda] ?? 0
    let resto = s
    if (contado > 0) {
      // a sobra volta ao caixa estornando o adiantamento (no DRE a despesa "Viagens" fica = o que de fato saiu)
      const adiant = carteira.filter((m) => m.tipo === 'adiantamento' && m.moeda === moeda && m.movCaixaId && !caixa.get(m.movCaixaId)?.estornadoPor).pop()
      const mov = await moverCaixa(ctx, {
        data: hoje,
        moeda,
        forma,
        delta: contado,
        tipo: adiant ? 'estorno' : 'entrada',
        estornaId: adiant?.movCaixaId,
        origemId: v.id,
        descricao: `Sobra da viagem ${v.codigo} devolvida · ${nomes}`,
        categoria: CATEGORIA_CAIXA_VIAGEM,
      })
      await marcarViagemNoCaixa(ctx, mov)
      carteira.push({ id: novoId(), tipo: 'devolucao', data: hoje, em: agora, moeda, delta: -contado, forma, movCaixaId: mov.id, porNome: ctx.sessao.nome })
      resto -= contado
      resumo.push(`devolveu ${contado} ${moeda}`)
    }
    if (resto < 0 && d.reembolsar) {
      // gastou mais do que levou (pagou do bolso): a loja reembolsa
      const mov = await moverCaixa(ctx, { data: hoje, moeda, forma, delta: resto, tipo: 'despesa', origemId: v.id, descricao: `Reembolso da viagem ${v.codigo} · ${nomes}`, categoria: CATEGORIA_CAIXA_VIAGEM })
      await marcarViagemNoCaixa(ctx, mov)
      carteira.push({ id: novoId(), tipo: 'reembolso', data: hoje, em: agora, moeda, delta: -resto, forma, movCaixaId: mov.id, porNome: ctx.sessao.nome })
      resumo.push(`reembolsou ${-resto} ${moeda}`)
      resto = 0
    }
    if (resto !== 0) {
      // zera a carteira: + = faltou dinheiro (sumiu/sem comprovante); − = pagou do bolso e não foi reembolsada
      carteira.push({ id: novoId(), tipo: 'diferenca', data: hoje, em: agora, moeda, delta: -resto, porNome: ctx.sessao.nome, obs: resto > 0 ? 'Faltou dinheiro na prestação de contas' : 'Pago do próprio bolso (não reembolsado)' })
      resumo.push(`${resto > 0 ? 'faltou' : 'pagou do bolso'} ${Math.abs(resto)} ${moeda}`)
    }
  }
  const encerrada: Viagem = tocar(ctx, { ...v, carteira, status: 'encerrada', fim, encerramento: { em: agora, data: hoje, porNome: ctx.sessao.nome, obs: d.obs?.trim() || undefined } })
  await ctx.repos.viagens.salvar(encerrada)
  await auditar(ctx, 'encerrarViagem', v.id, `${v.codigo} encerrada${resumo.length ? `: ${resumo.join('; ')}` : ''}${d.obs?.trim() ? ` · ${d.obs.trim()}` : ''}`, v.viajantes)
  if (d.incorporar) await incorporarCustoViagem(ctx, { viagemId: v.id })
  return { id: v.id }
}

/**
 * Soma ao custo de cada lote em estoque a parte do gasto da viagem que cabe a ele (rateio da compra de onde veio ×
 * gramas em estoque ÷ gramas que sobreviveram — vendidas + em estoque). O custo por grama do lote sobe; triagem,
 * margem e o lucro das próximas vendas passam a contar com a logística. Antes → depois fica no log.
 */
export async function incorporarCustoViagem(ctx: Ctx, d: { viagemId: Id }) {
  exigirAdmin(ctx, 'Só o administrador muda o custo dos lotes.')
  const v = await obterViagem(ctx, d.viagemId)
  exigir(v.status === 'encerrada', 'Encerre a viagem (prestação de contas) antes de incorporar o gasto.')
  exigir(!v.incorporacao, 'O gasto desta viagem já entrou no custo dos lotes.')
  const base = await carregarBase(ctx)
  const a = analisar(ctx, v, base)
  const plano = a.incorporacao.lotes.filter((l) => l.extra > 0)
  exigir(plano.length, 'Nada a incorporar: não há gasto ou não sobrou cabelo desta viagem em estoque.')
  const lotes: NonNullable<Viagem['incorporacao']>['lotes'] = []
  for (const l of plano) {
    const item = await ctx.repos.itens.obter(l.itemId)
    if (!item || !item.saldo || !item.quantidadeInicial) continue
    // custo do lote é por quantidadeInicial: para o saldo ganhar "extra", o custo total sobe extra × inicial ÷ saldo
    const antes = item.custoPrincipal ?? 0
    const depois = antes + proporcao(l.extra, item.quantidadeInicial, item.saldo)
    await ctx.repos.itens.salvar(tocar(ctx, { ...item, custoPrincipal: depois }))
    lotes.push({ itemId: item.id, codigo: item.codigo, gramas: item.saldo, inicial: item.quantidadeInicial, extra: l.extra, antes, depois })
  }
  const total = lotes.reduce((s, l) => s + l.extra, 0)
  await ctx.repos.viagens.salvar(tocar(ctx, { ...v, incorporacao: { em: ctx.relogio.agora(), porNome: ctx.sessao.nome, total, lotes } }))
  await auditar(
    ctx,
    'incorporarCustoViagem',
    v.id,
    `${v.codigo}: ${total} somado ao custo de ${lotes.length} lote(s) · ${lotes.map((l) => `${l.codigo ?? l.itemId} ${unidadeTexto('grama', l.gramas)}: ${l.antes} → ${l.depois}`).join('; ')}`,
    lotes.map((l) => l.itemId),
  )
  return { id: v.id, total, lotes: lotes.length }
}

/** Reabre: desfaz a incorporação (tira o que foi somado aos lotes) e a diferença; o dinheiro devolvido fica como está. */
export async function reabrirViagem(ctx: Ctx, d: { viagemId: Id; motivo: string }) {
  exigirAdmin(ctx, 'Só o administrador reabre a viagem.')
  const v = await obterViagem(ctx, d.viagemId)
  if (v.status === 'aberta') return { id: v.id }
  exigir(d.motivo?.trim(), 'Diga o motivo.', 'motivo')
  const desfeitos: string[] = []
  if (v.incorporacao) {
    for (const l of v.incorporacao.lotes) {
      const item = await ctx.repos.itens.obter(l.itemId)
      if (!item) continue
      const antes = item.custoPrincipal ?? 0
      const depois = Math.max(0, antes - (l.depois - l.antes))
      await ctx.repos.itens.salvar(tocar(ctx, { ...item, custoPrincipal: depois }))
      desfeitos.push(`${l.codigo ?? l.itemId}: ${antes} → ${depois}`)
    }
  }
  const carteira = v.carteira.map((m) => (m.tipo === 'diferenca' && !m.anulada ? { ...m, anulada: true } : m))
  await ctx.repos.viagens.salvar(
    tocar(ctx, {
      ...v,
      status: 'aberta',
      carteira,
      encerramento: undefined,
      incorporacao: undefined,
      incorporacoesDesfeitas: v.incorporacao ? [...(v.incorporacoesDesfeitas ?? []), v.incorporacao] : v.incorporacoesDesfeitas,
    }),
  )
  await auditar(ctx, 'reabrirViagem', v.id, `${v.codigo} reaberta · ${d.motivo.trim()}${desfeitos.length ? ` · custo dos lotes desfeito: ${desfeitos.join('; ')}` : ''}`, v.incorporacao?.lotes.map((l) => l.itemId))
  return { id: v.id }
}

// ---------- cálculo ----------

async function nomesViajantes(ctx: Ctx, v: Viagem) {
  const ns = await Promise.all(v.viajantes.map(async (x) => (await ctx.repos.pessoas.obter(x))?.nome ?? '—'))
  return ns.join(', ')
}

/** Movimento da carteira vale se não foi anulado e se o lançamento do caixa ligado não foi desfeito no Caixa. */
function vale(m: MovCarteiraViagem, caixa: Map<Id, MovCaixa>) {
  return !m.anulada && !(m.movCaixaId && caixa.get(m.movCaixaId)?.estornadoPor)
}

export interface SaldoCarteira {
  moeda: CodigoMoeda
  adiantado: number
  gasto: number
  devolvido: number
  reembolsado: number
  diferenca: number
  /** o que deve estar na mão de quem viajou agora */
  saldo: number
}

export function carteiraPorMoeda(v: Viagem, caixa: Map<Id, MovCaixa>): SaldoCarteira[] {
  const mapa = new Map<CodigoMoeda, SaldoCarteira>()
  const de = (moeda: CodigoMoeda) => {
    if (!mapa.has(moeda)) mapa.set(moeda, { moeda, adiantado: 0, gasto: 0, devolvido: 0, reembolsado: 0, diferenca: 0, saldo: 0 })
    return mapa.get(moeda)!
  }
  for (const m of v.carteira.filter((x) => vale(x, caixa))) {
    const s = de(m.moeda)
    if (m.tipo === 'adiantamento') s.adiantado += m.delta
    else if (m.tipo === 'devolucao') s.devolvido -= m.delta
    else if (m.tipo === 'reembolso') s.reembolsado += m.delta
    else s.diferenca -= m.delta
    s.saldo += m.delta
  }
  for (const x of v.despesas.filter((y) => !y.anulada)) {
    const s = de(x.moeda)
    s.gasto += x.valor
    s.saldo -= x.valor
  }
  return [...mapa.values()]
}

interface BaseViagens {
  itens: Item[]
  porItem: Map<Id, Item>
  movsUnificacao: MovEstoque[]
  compras: Transacao[]
  vendas: Transacao[]
  pessoas: Map<Id, Pessoa>
  usuariosDaPessoa: Map<Id, Id[]>
  caixa: Map<Id, MovCaixa>
  categorias: CategoriaViagem[]
  /** valor de tabela (moeda principal) de cada lote em estoque (sem preço: o custo) */
  valorTabela: Map<Id, { valor: number; semPreco: boolean }>
  hoje: string
  moedaPrincipal: string
}

/** Lê tudo uma vez (lista de viagens e detalhe usam a mesma base). */
async function carregarBase(ctx: Ctx): Promise<BaseViagens> {
  const cfg = await lerConfig(ctx)
  const itens = await ctx.repos.itens.listar()
  const trans = await ctx.repos.transacoes.listar()
  const usuarios = await ctx.repos.usuarios.listar()
  const usuariosDaPessoa = new Map<Id, Id[]>()
  for (const u of usuarios) if (u.pessoaId) usuariosDaPessoa.set(u.pessoaId, [...(usuariosDaPessoa.get(u.pessoaId) ?? []), u.id])
  const caixa = new Map((await ctx.repos.movCaixa.listar()).filter((m) => m.viagemId || m.categoria === CATEGORIA_CAIXA_VIAGEM).map((m) => [m.id, m]))
  // valor de mercado do que está em estoque: gramas × fator da tabela vigente (1ª coluna, como na Triagem)
  const valorTabela = new Map<Id, { valor: number; semPreco: boolean }>()
  const tabelas = new Map<string, Awaited<ReturnType<typeof tabelaVigente>>>()
  for (const i of itens.filter((x) => x.saldo > 0 && x.unidade === 'grama')) {
    let valor: number | undefined
    const medida = Number(i.campos.comprimento)
    if (medida) {
      const chave = `${i.moduloId}|${String(i.campos.categoria || '')}`
      if (!tabelas.has(chave)) tabelas.set(chave, await tabelaVigente(ctx, { moduloId: i.moduloId, categoria: String(i.campos.categoria || '') || undefined }))
      const tb = tabelas.get(chave)
      const col = tb?.colunas[0]
      const fator = tb && col ? fatorDaTabela(tb, medida, col.id).fator : undefined
      if (tb && fator) {
        try {
          valor = (await paraPrincipal(ctx, multiplicarFator(i.saldo, fator, tb.moeda), tb.moeda)).valorPrincipal
        } catch {
          valor = undefined
        }
      }
    }
    const custo = i.custoPrincipal && i.quantidadeInicial ? proporcao(i.custoPrincipal, i.saldo, i.quantidadeInicial) : 0
    valorTabela.set(i.id, valor !== undefined ? { valor, semPreco: false } : { valor: custo, semPreco: true })
  }
  return {
    itens,
    porItem: new Map(itens.map((i) => [i.id, i])),
    movsUnificacao: (await ctx.repos.movEstoque.listar()).filter((m) => m.motivo === 'unificacao' && m.delta < 0),
    compras: trans.filter((t) => t.tipo === 'compra'),
    vendas: trans.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido'),
    pessoas: new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p])),
    usuariosDaPessoa,
    caixa,
    categorias: await lerCategorias(ctx),
    valorTabela,
    hoje: ctx.relogio.hoje(),
    moedaPrincipal: cfg.moedaPrincipal,
  }
}

/**
 * De que compras vem cada grama de um lote (fração por compra): da compra = 100% dela; separado = igual ao lote-mãe;
 * unificado = média dos lotes que entraram, pesada pelas gramas que cada um deu. É a genealogia, em proporção.
 */
function fracoesPorCompra(base: BaseViagens) {
  const memo = new Map<Id, Map<Id, number>>()
  const pesoUnif = new Map<string, number>()
  for (const m of base.movsUnificacao) if (m.origemId) pesoUnif.set(`${m.origemId}|${m.itemId}`, (pesoUnif.get(`${m.origemId}|${m.itemId}`) ?? 0) - m.delta)
  const calc = (id: Id, visitando: Set<Id>): Map<Id, number> => {
    const pronto = memo.get(id)
    if (pronto) return pronto
    const i = base.porItem.get(id)
    let r = new Map<Id, number>()
    if (i && !visitando.has(id)) {
      visitando.add(id)
      const o = i.origem
      if (o?.tipo === 'compra' && o.id) r.set(o.id, 1)
      else if (o?.tipo === 'transformacao' && o.id) r = calc(o.id, visitando)
      else if (o?.tipo === 'unificacao' && o.ids?.length) {
        const pesos = o.ids.map((p) => pesoUnif.get(`${id}|${p}`) ?? 0)
        const soma = pesos.reduce((s, x) => s + x, 0)
        o.ids.forEach((p, k) => {
          const w = soma ? pesos[k] / soma : 1 / o.ids!.length
          for (const [c, f] of calc(p, visitando)) r.set(c, (r.get(c) ?? 0) + f * w)
        })
      }
      visitando.delete(id)
    }
    memo.set(id, r)
    return r
  }
  return (id: Id) => calc(id, new Set())
}

const gramasDa = (t: Transacao) => t.linhas.reduce((s, l) => s + l.quantidade, 0)

/** Diagnóstico completo de uma viagem (KPIs, DRE, rateio, plano de incorporação). */
function analisar(_ctx: Ctx, v: Viagem, base: BaseViagens, fracoes = fracoesPorCompra(base)) {
  const compras = base.compras.filter((t) => t.viagemId === v.id && !ETAPAS_FORA.has(t.etapa)).sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? -1 : 1))
  const ids = new Set(compras.map((t) => t.id))
  const despesas = v.despesas.filter((x) => !x.anulada)
  const gastoTotal = despesas.reduce((s, x) => s + x.valorPrincipal, 0)
  // por compra: gramas, valor, pago, onde está cada grama
  const porCompra = new Map(compras.map((t) => [t.id, { estoque: 0, vendido: 0, receita: 0 }]))
  const fracViagem = new Map<Id, number>()
  const fracDe = (itemId: Id) => {
    const f = fracoes(itemId)
    const daqui = [...f].filter(([c]) => ids.has(c))
    return daqui
  }
  for (const i of base.itens) {
    if (!i.controlaEstoque) continue
    const fs = fracDe(i.id)
    if (!fs.length) continue
    fracViagem.set(i.id, fs.reduce((s, [, f]) => s + f, 0))
    for (const [c, f] of fs) porCompra.get(c)!.estoque += i.saldo * f
  }
  for (const t of base.vendas)
    for (const l of t.linhas) {
      if (!l.itemId) continue
      for (const [c, f] of fracDe(l.itemId)) {
        const pc = porCompra.get(c)!
        pc.vendido += l.quantidade * f
        pc.receita += l.totalPrincipal * f
      }
    }
  const G = compras.reduce((s, t) => s + gramasDa(t), 0)
  const V = compras.reduce((s, t) => s + t.totalPrincipal, 0)
  // rateio do gasto entre as compras (o último leva o resto: a soma fecha exata)
  let restante = gastoTotal
  const linhasRateio = compras.map((t, k) => {
    const g = gramasDa(t)
    const parte = k === compras.length - 1 ? restante : v.rateio === 'valor' ? (V ? proporcao(gastoTotal, t.totalPrincipal, V) : 0) : G ? proporcao(gastoTotal, g, G) : 0
    restante -= parte
    const pc = porCompra.get(t.id)!
    const pago = t.pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
    const fornecedor = t.pessoaId ? base.pessoas.get(t.pessoaId)?.nome : undefined
    const comprador = t.compradorId ? base.pessoas.get(t.compradorId)?.nome : undefined
    return {
      id: t.id,
      codigo: t.codigo,
      data: t.data,
      etapa: t.etapa,
      fornecedor,
      comprador,
      gramas: g,
      valor: t.totalPrincipal,
      pago,
      parte,
      custoKg: g ? Math.round((t.totalPrincipal * 1000) / g) : 0,
      custoKgReal: g ? Math.round(((t.totalPrincipal + parte) * 1000) / g) : 0,
      emEstoque: Math.round(pc.estoque),
      vendido: Math.round(pc.vendido),
      receita: Math.round(pc.receita),
      noEstoque: t.etapa === 'concluido',
    }
  })
  // plano de incorporação: parte do gasto de cada compra × (gramas no lote ÷ gramas que sobreviveram da compra)
  const sobreviveu = new Map(linhasRateio.map((r) => [r.id, porCompra.get(r.id)!.estoque + porCompra.get(r.id)!.vendido]))
  const parteDe = new Map(linhasRateio.map((r) => [r.id, r.parte]))
  const lotesPlano = base.itens
    .filter((i) => i.controlaEstoque && i.saldo > 0 && fracViagem.has(i.id))
    .map((i) => {
      let extra = 0
      for (const [c, f] of fracDe(i.id)) {
        const sv = sobreviveu.get(c) ?? 0
        if (sv > 0) extra += ((parteDe.get(c) ?? 0) * i.saldo * f) / sv
      }
      const gramas = Math.round(i.saldo * (fracViagem.get(i.id) ?? 0))
      const custoAtual = i.custoPrincipal && i.quantidadeInicial ? proporcao(i.custoPrincipal, i.saldo, i.quantidadeInicial) : 0
      return { itemId: i.id, codigo: i.codigo, nome: i.nome, saldo: i.saldo, gramas, extra: Math.round(extra), custoAtual, custoKgAtual: i.saldo ? Math.round((custoAtual * 1000) / i.saldo) : 0, custoKgNovo: i.saldo ? Math.round(((custoAtual + Math.round(extra)) * 1000) / i.saldo) : 0 }
    })
    .sort((a, b) => ((a.codigo ?? '') < (b.codigo ?? '') ? -1 : 1))
  const incorporavel = lotesPlano.reduce((s, l) => s + l.extra, 0)
  // DRE da viagem
  const receita = linhasRateio.reduce((s, r) => s + r.receita, 0)
  const gramasVendidas = linhasRateio.reduce((s, r) => s + r.vendido, 0)
  const gramasEstoque = linhasRateio.reduce((s, r) => s + r.emEstoque, 0)
  const aguardando = linhasRateio.filter((r) => !r.noEstoque).reduce((s, r) => s + r.gramas, 0)
  let potencial = 0
  let semPreco = 0
  for (const i of base.itens) {
    const f = fracViagem.get(i.id)
    const vt = base.valorTabela.get(i.id)
    if (!f || !vt || i.saldo <= 0) continue
    potencial += vt.valor * f
    if (vt.semPreco) semPreco++
  }
  potencial = Math.round(potencial)
  const custoCabelo = V
  const capitalPago = linhasRateio.reduce((s, r) => s + r.pago, 0)
  const investido = custoCabelo + gastoTotal
  const resultado = receita - investido
  const prospeccao = compras.length === 0
  const fim = v.fim && v.status === 'encerrada' ? v.fim : v.fim && v.fim < base.hoje ? v.fim : base.hoje
  const dias = Math.max(1, diasEntre(v.inicio, fim < v.inicio ? v.inicio : fim) + 1)
  const porCategoria = base.categorias
    .map((c) => ({ id: c.id, nome: c.nome, icone: c.icone, valor: despesas.filter((x) => x.categoria === c.id).reduce((s, x) => s + x.valorPrincipal, 0) }))
    .concat(
      // categoria que saiu da lista continua contando
      [...new Set(despesas.map((x) => x.categoria))].filter((id) => !base.categorias.some((c) => c.id === id)).map((id) => ({ id, nome: id, icone: '🧾', valor: despesas.filter((x) => x.categoria === id).reduce((s, x) => s + x.valorPrincipal, 0) })),
    )
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor)
  const custoVendido = G ? Math.round((investido * gramasVendidas) / G) : 0
  const kpis = {
    gramas: G,
    custoCabelo,
    capitalPago,
    gasto: gastoTotal,
    investido,
    custoGrama: G ? custoCabelo / G : undefined,
    custoGramaReal: G ? investido / G : undefined,
    custoKg: G ? Math.round((custoCabelo * 1000) / G) : undefined,
    custoKgReal: G ? Math.round((investido * 1000) / G) : undefined,
    receita,
    resultado,
    /** ROI em pontos-base (1000 = 10%); sem compra não existe */
    roiBp: !prospeccao && investido ? Math.round((resultado * 10000) / investido) : undefined,
    potencial,
    resultadoPotencial: resultado + potencial,
    roiPotencialBp: !prospeccao && investido ? Math.round(((resultado + potencial) * 10000) / investido) : undefined,
    lucroVendido: receita - custoVendido,
    gramasVendidas,
    gramasEstoque,
    aguardando,
    perda: Math.max(0, G - aguardando - gramasVendidas - gramasEstoque),
    pctEstoqueBp: G ? Math.round((gramasEstoque * 10000) / G) : 0,
    pctVendidoBp: G ? Math.round((gramasVendidas * 10000) / G) : 0,
    dias,
    custoDia: Math.round(gastoTotal / dias),
    semPreco,
  }
  const carteira = carteiraPorMoeda(v, base.caixa)
  const acimaOrcamento = (v.orcamento ? gastoTotal > v.orcamento : false) || (v.orcamentoCompra ? custoCabelo > v.orcamentoCompra : false)
  const dre = [
    { conta: 'Receita gerada (vendas do cabelo da viagem)', valor: receita, nivel: 0 },
    { conta: '(−) Custo dos cabelos (compras da viagem)', valor: -custoCabelo, nivel: 1 },
    { conta: '(−) Gastos da viagem (logística)', valor: -gastoTotal, nivel: 1 },
    ...porCategoria.map((c) => ({ conta: `${c.icone} ${c.nome}`, valor: -c.valor, nivel: 2 })),
    { conta: '= Resultado realizado', valor: resultado, nivel: 0 },
    { conta: '(+) Potencial em estoque (preço de tabela)', valor: potencial, nivel: 1 },
    { conta: '= Resultado com o estoque', valor: resultado + potencial, nivel: 0 },
  ]
  return {
    compras: linhasRateio,
    despesas,
    porCategoria,
    kpis,
    dre,
    carteira,
    prospeccao,
    acimaOrcamento,
    incorporacao: { lotes: lotesPlano, incorporavel, realizado: gastoTotal - incorporavel },
  }
}

function resumoLinha(v: Viagem, base: BaseViagens, a: ReturnType<typeof analisar>) {
  return {
    id: v.id,
    codigo: v.codigo,
    nome: v.nome,
    destino: v.destino,
    status: v.status,
    inicio: v.inicio,
    fim: v.fim,
    viajantes: v.viajantes.map((p) => ({ id: p, nome: base.pessoas.get(p)?.nome ?? '—' })),
    orcamento: v.orcamento,
    orcamentoCompra: v.orcamentoCompra,
    gasto: a.kpis.gasto,
    gramas: a.kpis.gramas,
    custoCabelo: a.kpis.custoCabelo,
    resultado: a.kpis.resultado,
    resultadoPotencial: a.kpis.resultadoPotencial,
    roiBp: a.kpis.roiBp,
    custoKgReal: a.kpis.custoKgReal,
    dias: a.kpis.dias,
    compras: a.compras.length,
    prospeccao: a.prospeccao,
    acimaOrcamento: a.acimaOrcamento,
    incorporado: !!v.incorporacao,
    moeda: base.moedaPrincipal,
  }
}

// ---------- consultas ----------

async function todas(ctx: Ctx) {
  return (await ctx.repos.viagens.listar()).map((v) => ({ ...v, despesas: v.despesas ?? [], carteira: v.carteira ?? [], viajantes: v.viajantes ?? [], rateio: v.rateio ?? 'grama' }) as Viagem)
}

/** Lista/histórico das viagens com o resultado de cada uma e a comparação por viajante. Funcionária: só as dela. */
export async function viagens(ctx: Ctx, p: { status?: 'aberta' | 'encerrada'; viajanteId?: Id; busca?: string } = {}) {
  const admin = ctx.sessao.perfil === 'admin'
  const base = await carregarBase(ctx)
  const fr = fracoesPorCompra(base)
  const b = p.busca?.trim().toLowerCase()
  const lista = (await todas(ctx))
    .filter((v) => admin || eViajante(ctx, v))
    .filter((v) => !p.status || v.status === p.status)
    .filter((v) => !p.viajanteId || v.viajantes.includes(p.viajanteId))
    .sort((a, b) => (a.inicio + a.criadoEm < b.inicio + b.criadoEm ? 1 : -1))
  // funcionária não vê custo nem resultado (só o que ela gastou e as gramas)
  const semCustos = <R extends ReturnType<typeof resumoLinha>>(r: R): R => (admin ? r : { ...r, custoCabelo: 0, resultado: 0, resultadoPotencial: 0, roiBp: undefined, custoKgReal: undefined })
  const linhas = lista
    .map((v) => semCustos(resumoLinha(v, base, analisar(ctx, v, base, fr))))
    .filter((r) => !b || [r.codigo, r.nome, r.destino, ...r.viajantes.map((x) => x.nome)].some((x) => x?.toLowerCase().includes(b)))
  // eficiência por viajante (viagem com várias pessoas conta para cada uma)
  const porViajante = new Map<Id, { id: Id; nome: string; viagens: number; prospeccao: number; gramas: number; gasto: number; custoCabelo: number; resultado: number; rois: number[] }>()
  for (const r of linhas)
    for (const x of r.viajantes) {
      const a = porViajante.get(x.id) ?? { id: x.id, nome: x.nome, viagens: 0, prospeccao: 0, gramas: 0, gasto: 0, custoCabelo: 0, resultado: 0, rois: [] }
      a.viagens++
      if (r.prospeccao) a.prospeccao++
      a.gramas += r.gramas
      a.gasto += r.gasto
      a.custoCabelo += r.custoCabelo
      a.resultado += r.resultado
      if (r.roiBp !== undefined) a.rois.push(r.roiBp)
      porViajante.set(x.id, a)
    }
  const comparativo = [...porViajante.values()]
    .map(({ rois, ...a }) => ({
      ...a,
      custoKgReal: a.gramas ? Math.round(((a.custoCabelo + a.gasto) * 1000) / a.gramas) : undefined,
      gastoKg: a.gramas ? Math.round((a.gasto * 1000) / a.gramas) : undefined,
      roiMedioBp: rois.length ? Math.round(rois.reduce((s, x) => s + x, 0) / rois.length) : undefined,
    }))
    .sort((a, b) => (a.custoKgReal ?? Infinity) - (b.custoKgReal ?? Infinity))
  const pessoas = [...base.pessoas.values()].filter((x) => x.papeis.includes('funcionario') || x.papeis.includes('socio')).map((x) => ({ id: x.id, nome: x.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { linhas, comparativo: admin ? comparativo : [], viajantesPossiveis: pessoas, moeda: base.moedaPrincipal }
}

/** Detalhe da viagem (admin): resumo/DRE, gastos, compras ligadas e sugeridas, rateio, carteira e prestação de contas. */
export async function viagem(ctx: Ctx, p: { id: Id }) {
  exigirAdmin(ctx, 'Só o administrador vê o resultado da viagem.')
  const v = await obterViagem(ctx, p.id)
  const base = await carregarBase(ctx)
  const a = analisar(ctx, v, base)
  // sugestões: compras do período por quem viajou (comprou ou registrou), ainda sem viagem
  const fim = v.fim ?? base.hoje
  const usuarios = new Set(v.viajantes.flatMap((x) => base.usuariosDaPessoa.get(x) ?? []))
  const semViagem = base.compras.filter((t) => !t.viagemId && !ETAPAS_FORA.has(t.etapa))
  const linhaCompra = (t: Transacao) => ({
    id: t.id,
    codigo: t.codigo,
    data: t.data,
    etapa: t.etapa,
    fornecedor: t.pessoaId ? base.pessoas.get(t.pessoaId)?.nome : undefined,
    comprador: t.compradorId ? base.pessoas.get(t.compradorId)?.nome : undefined,
    gramas: gramasDa(t),
    valor: t.totalPrincipal,
    sugerida: t.data >= v.inicio && t.data <= fim && ((!!t.compradorId && v.viajantes.includes(t.compradorId)) || usuarios.has(t.criadoPor)),
  })
  const candidatas = semViagem.map(linhaCompra).sort((x, y) => Number(y.sugerida) - Number(x.sugerida) || (x.data < y.data ? 1 : -1))
  const cats = new Map(base.categorias.map((c) => [c.id, c]))
  return {
    viagem: v,
    resumo: resumoLinha(v, base, a),
    viajantes: v.viajantes.map((x) => ({ id: x, nome: base.pessoas.get(x)?.nome ?? '—' })),
    categorias: base.categorias,
    ...a,
    despesas: v.despesas
      .map((x) => ({ ...x, nomeCategoria: cats.get(x.categoria)?.nome ?? x.categoria, icone: cats.get(x.categoria)?.icone ?? '🧾' }))
      .sort((x, y) => (x.data + x.em < y.data + y.em ? 1 : -1)),
    candidatas,
    caixa: [...base.caixa.values()].filter((m) => m.viagemId === v.id || m.origemId === v.id).sort((x, y) => (x.criadoEm < y.criadoEm ? -1 : 1)),
    moeda: base.moedaPrincipal,
  }
}

/**
 * PAINEL DO VIAJANTE: a viagem aberta de quem está usando (funcionária ou sócia que viajou). Admin vê as abertas.
 * Sem custos de lote nem resultado (funcionária não vê custos): orçamento, gasto, cabelo comprado e carteira.
 */
export async function painelViajante(ctx: Ctx, p: { viagemId?: Id } = {}) {
  const admin = ctx.sessao.perfil === 'admin'
  const abertas = (await todas(ctx)).filter((v) => v.status === 'aberta' && (eViajante(ctx, v) || admin)).sort((a, b) => Number(eViajante(ctx, b)) - Number(eViajante(ctx, a)) || (a.inicio < b.inicio ? 1 : -1))
  const categorias = await lerCategorias(ctx)
  const cfg = await lerConfig(ctx)
  const v = abertas.find((x) => x.id === p.viagemId) ?? abertas[0]
  const opcoes = abertas.map((x) => ({ id: x.id, codigo: x.codigo, nome: x.nome, minha: eViajante(ctx, x) }))
  if (!v) return { abertas: opcoes, categorias, moedas: cfg.moedasAtivas, moeda: cfg.moedaPrincipal, viagem: undefined }
  const caixa = new Map((await ctx.repos.movCaixa.listar({ origemId: v.id })).map((m) => [m.id, m]))
  const compras = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => t.viagemId === v.id && !ETAPAS_FORA.has(t.etapa))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const cats = new Map(categorias.map((c) => [c.id, c]))
  const despesas = v.despesas.filter((x) => !x.anulada)
  const gasto = despesas.reduce((s, x) => s + x.valorPrincipal, 0)
  const valorCompras = compras.reduce((s, t) => s + t.totalPrincipal, 0)
  return {
    abertas: opcoes,
    categorias,
    moedas: cfg.moedasAtivas,
    moeda: cfg.moedaPrincipal,
    viagem: {
      id: v.id,
      codigo: v.codigo,
      nome: v.nome,
      destino: v.destino,
      inicio: v.inicio,
      fim: v.fim,
      viajantes: v.viajantes.map((x) => pessoas.get(x) ?? '—'),
      orcamento: v.orcamento,
      orcamentoCompra: v.orcamentoCompra,
      gasto,
      gramas: compras.reduce((s, t) => s + gramasDa(t), 0),
      valorCompras,
      acimaOrcamento: (v.orcamento ? gasto > v.orcamento : false) || (v.orcamentoCompra ? valorCompras > v.orcamentoCompra : false),
      carteira: carteiraPorMoeda(v, caixa),
      despesas: v.despesas
        .map((x) => ({ ...x, nomeCategoria: cats.get(x.categoria)?.nome ?? x.categoria, icone: cats.get(x.categoria)?.icone ?? '🧾', minha: x.por === ctx.sessao.usuarioId }))
        .sort((x, y) => (x.data + x.em < y.data + y.em ? 1 : -1)),
      compras: compras
        .sort((a, b) => (a.data < b.data ? 1 : -1))
        .map((t) => ({ id: t.id, codigo: t.codigo, data: t.data, fornecedor: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, gramas: gramasDa(t), valor: t.totalPrincipal, etapa: t.etapa })),
    },
  }
}

/** Para o painel e o menu: viagens abertas, quantas passaram do orçamento (consulta leve, sem genealogia). */
export async function viagensAbertas(ctx: Ctx) {
  const abertas = (await todas(ctx)).filter((v) => v.status === 'aberta')
  const compras = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => t.viagemId && !ETAPAS_FORA.has(t.etapa))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  return abertas.map((v) => {
    const gasto = v.despesas.filter((x) => !x.anulada).reduce((s, x) => s + x.valorPrincipal, 0)
    const valorCompras = compras.filter((t) => t.viagemId === v.id).reduce((s, t) => s + t.totalPrincipal, 0)
    return {
      id: v.id,
      codigo: v.codigo,
      nome: v.nome,
      viajantes: v.viajantes,
      nomes: v.viajantes.map((x) => pessoas.get(x) ?? '—').join(', '),
      gasto,
      valorCompras,
      orcamento: v.orcamento,
      orcamentoCompra: v.orcamentoCompra,
      acimaOrcamento: (v.orcamento ? gasto > v.orcamento : false) || (v.orcamentoCompra ? valorCompras > v.orcamentoCompra : false),
      minha: eViajante(ctx, v),
    }
  })
}
