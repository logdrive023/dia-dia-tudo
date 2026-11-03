// TRIAGEM do cabelo: compra → (unificar lotes) → preparar/limpar → separar → VENDA. Sem regra rígida, tudo rastreado:
// cada passo é movimento de estoque + linha no log (quem, quando, quanto). As COLUNAS são do negócio (Configurações ›
// Etapas da triagem): nome, ordem, cor, explicação e o que cada uma faz. "Vendido" é sempre a última e é calculada.

import { diasEntre, inicioDoMes, somarDias } from '../domain/datas'
import { multiplicarFator } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Campos, Id, Item, Transacao } from '../domain/tipos'
import type { CampoDef } from '../modulos'
import { auditar, type Ctx, novo, paraPrincipal, tocar } from './contexto'
import { type Cadeia, NAO_IDENTIFICADO, type ParaDepois, type SaidaSeparacao, type Triagem, aplicarCampos, comprasDe, custoDe, leitorCadeia, lotesDeOrigem, moverEstoque, novaTriagem, separarNaTriagem, unidadeTexto } from './estoque'
import { codigoNovoLote, exigirCodigosLivres, siglasPorPessoa } from './codigos'
import { fatorDaTabela, tabelaVigente } from './precos'
import { type FotoResumo, leitorFotos } from './fotos'

/**
 * Coluna com "exigir foto ao sair": o lote só sai dela (mover ou triar) com pelo menos uma foto PRÓPRIA.
 * Recusa dizendo qual lote e qual coluna. Lotes em colunas sem a regra passam direto.
 */
async function exigirFotoParaSair(ctx: Ctx, lotes: Item[], destino?: string) {
  const cache = new Map<string, ColunaTriagem[]>()
  let F: Awaited<ReturnType<typeof leitorFotos>> | undefined
  for (const i of lotes) {
    if (!cache.has(i.moduloId)) cache.set(i.moduloId, await colunasTriagem(ctx, i.moduloId))
    const colunas = cache.get(i.moduloId)!
    const col = colunas.find((c) => c.id === faseLote(i, colunas))
    if (!col?.exigirFoto || col.id === destino) continue
    F ??= await leitorFotos(ctx)
    exigir(F.proprias(i.id) > 0, `Tire uma foto de ${i.codigo ?? i.nome} antes de tirar de "${col.nome}".`, 'foto')
  }
}

/** Coluna do quadro da triagem. entrada = onde caem os lotes brutos das compras (uma só); pronto = vendável (pelo menos uma). */
export interface ColunaTriagem {
  id: string
  nome: string
  cor?: string
  ajuda?: string
  entrada?: boolean
  pronto?: boolean
  /** soltar aqui abre a separação do lote */
  separarAoEntrar?: boolean
  lembrarFotos?: boolean
  /** o lote só sai desta coluna (mover ou triar) com pelo menos uma foto PRÓPRIA (as herdadas não contam) */
  exigirFoto?: boolean
  /** lavagem/secagem: ao sair desta coluna pergunta o peso depois (opcional) e registra a perda de lavagem (antes → depois) */
  pedirPeso?: boolean
}

/** Última coluna, sempre: lotes que acabaram com venda (calculada; dá para renomear, não para tirar). */
export const COLUNA_VENDIDO = 'vendido'

/**
 * Padrão: Aguardando → Separado → Pronto para venda (+ Vendido automático). Lavar é opcional: quem lava liga a coluna
 * COLUNA_LAVAGEM em Configurações › Etapas da triagem. Fluxos salvos antes continuam como estão; lote numa coluna que
 * deixou de existir volta para a calculada (bruto → entrada; separado → primeira "pronto").
 */
export const COLUNAS_PADRAO: ColunaTriagem[] = [
  { id: 'aguardando', nome: 'Aguardando triagem', cor: '#f59e0b', ajuda: 'Nenhum lote esperando. Quando uma compra é registrada, o cabelo bruto aparece aqui sozinho.', entrada: true },
  { id: 'triado', nome: 'Separado', cor: '#0ea5e9', ajuda: 'Separe um lote bruto (✂️) e as partes aparecem aqui, já dá para vender.', pronto: true, separarAoEntrar: true },
  { id: 'pronto', nome: 'Pronto para venda', cor: '#16a34a', ajuda: 'Arraste para cá o que já está etiquetado e pronto para vender.', pronto: true },
  { id: COLUNA_VENDIDO, nome: 'Vendido', cor: '#94a3b8', ajuda: 'Lotes que acabaram nos últimos 30 dias aparecem aqui.' },
]

/** Coluna opcional de lavagem/limpeza (o admin liga em Configurações › Etapas da triagem). */
export const COLUNA_LAVAGEM: ColunaTriagem = { id: 'preparando', nome: 'Em preparação/limpeza', cor: '#8b5cf6', ajuda: 'Arraste para cá o lote que está sendo lavado ou limpo. Ao sair, digite o peso depois (se quiser).', pedirPeso: true }

export async function colunasTriagem(ctx: Ctx, moduloId: string): Promise<ColunaTriagem[]> {
  const r = await ctx.repos.config.obter('fluxoTriagem')
  return (r?.valor as Record<string, ColunaTriagem[]> | undefined)?.[moduloId] ?? COLUNAS_PADRAO
}

const entradaDe = (cs: ColunaTriagem[]) => cs.find((c) => c.entrada) ?? cs[0]
const prontoDe = (cs: ColunaTriagem[]) => cs.find((c) => c.pronto) ?? cs[Math.max(0, cs.length - 2)]

/**
 * Coluna do lote: sem saldo e com venda = Vendido; senão a coluna guardada (se ainda existir); senão
 * bruto → coluna de entrada e já separado → primeira coluna "pronto para venda".
 */
export function faseLote(i: Pick<Item, 'saldo' | 'campos' | 'faseTriagem'>, colunas: ColunaTriagem[], vendeu = false): string | undefined {
  if (i.saldo <= 0) return vendeu ? COLUNA_VENDIDO : undefined
  const guardada = colunas.find((c) => c.id === i.faseTriagem?.fase && c.id !== COLUNA_VENDIDO)
  if (guardada) return guardada.id
  return i.campos.estado === 'Bruto' || i.campos.estado === NAO_IDENTIFICADO ? entradaDe(colunas).id : prontoDe(colunas).id
}

/** bruto ou "não identificado" (ficou para depois): ainda precisa ser separado */
const ehBruto = (i: Item) => i.campos.estado === 'Bruto' || i.campos.estado === NAO_IDENTIFICADO
const vazio = (v: Campos[string]) => v === undefined || v === null || v === ''

/** Atributos do lote unificado: o que é igual em todos fica; lista diferente vira "Misturado" (se a opção existir); o resto fica vazio. */
export function camposUnificados(defs: CampoDef[], lista: Campos[]): Campos {
  const r: Campos = {}
  for (const c of defs) {
    if (c.id === 'estado') continue
    const vs = lista.map((x) => x[c.id])
    if (new Set(vs.map((v) => (vazio(v) ? '' : String(v)))).size === 1) {
      if (!vazio(vs[0])) r[c.id] = vs[0]
    } else if (c.tipo === 'lista' && c.opcoes?.includes('Misturado')) r[c.id] = 'Misturado'
  }
  return { ...r, estado: 'Bruto' }
}

/**
 * UNIFICAR: 2+ lotes brutos (de compras diferentes, se quiser) viram UM lote para trabalhar junto.
 * Saldo = soma; custo = soma do custo do que sobrava em cada um; a origem guarda TODOS os lotes e TODAS as compras.
 */
export async function unificarLotes(ctx: Ctx, d: { id: Id; ids: Id[]; motivo?: string; codigo?: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador unifica lotes.')
  if (await ctx.repos.itens.obter(d.id)) return { id: d.id }
  exigir(new Set(d.ids ?? []).size >= 2, 'Escolha pelo menos 2 lotes brutos para unificar.')
  return unificarNaTriagem(ctx, d, await novaTriagem(ctx, d.id), 'saida')
}

async function unificarNaTriagem(ctx: Ctx, d: { id: Id; ids: Id[]; motivo?: string; codigo?: string; reservados?: Set<string> }, tg: Omit<Triagem, 'papel'>, papel: Triagem['papel'], qualquerLote = false) {
  const ids = [...new Set(d.ids ?? [])]
  exigir(ids.length >= 2, 'Escolha pelo menos 2 lotes brutos para unificar.')
  const lotes: Item[] = []
  for (const id of ids) {
    const i = await ctx.repos.itens.obter(id)
    exigir(i, 'Lote não encontrado.')
    exigir(i.controlaEstoque && i.saldo > 0, `${i.codigo ?? i.nome} está sem saldo.`)
    exigir(qualquerLote || ehBruto(i), `${i.codigo ?? i.nome} já foi triado: só lote bruto entra na unificação.`)
    lotes.push(i)
  }
  const [a] = lotes
  exigir(lotes.every((i) => i.moduloId === a.moduloId && i.tipoItem === a.tipoItem && i.unidade === a.unidade), 'Só dá para unificar lotes do mesmo tipo.')
  const tipo = ctx.modulos.tipoItem(a.moduloId, a.tipoItem)
  const colunas = await colunasTriagem(ctx, a.moduloId)
  const total = lotes.reduce((s, i) => s + i.saldo, 0)
  const custo = lotes.reduce((s, i) => s + custoDe(i, i.saldo), 0)
  const campos = camposUnificados(tipo.campos, lotes.map((i) => i.campos))
  const compraIds = [...new Set(lotes.flatMap((i) => comprasDe(i)))]
  const fornecedores = new Set(lotes.map((i) => i.origem?.pessoaId))
  const fases = new Set(lotes.map((i) => faseLote(i, colunas)))
  const fase = fases.size === 1 ? [...fases][0]! : entradaDe(colunas).id
  // código do lote juntado: o digitado ou o da regra (da compra: "M1+C3-1"; senão incremental)
  const codigo = await codigoNovoLote(ctx, { codigo: d.codigo, comprasUnificadas: compraIds, reservados: d.reservados })
  const lista = lotes.map((i) => `${i.codigo ?? i.nome} (${unidadeTexto(i.unidade, i.saldo)})`).join(' + ')
  const motivo = d.motivo?.trim() || undefined
  const lote = novo<Item>(ctx, {
    id: d.id,
    moduloId: a.moduloId,
    tipoItem: a.tipoItem,
    nome: tipo.nomear?.(campos) ?? `Unificado ${codigo}`,
    codigo,
    unidade: a.unidade,
    controlaEstoque: true,
    ativo: true,
    saldo: 0,
    precoSugerido: a.precoSugerido,
    custoPrincipal: custo,
    quantidadeInicial: total,
    origem: { tipo: 'unificacao', ids, pessoaId: fornecedores.size === 1 ? a.origem?.pessoaId : undefined, compraId: compraIds[0], compraIds },
    faseTriagem: { fase, desde: ctx.relogio.agora(), obs: motivo, entrada: colunas.find((c) => c.id === fase)?.entrada || undefined },
    triagem: { ...tg, papel },
    campos,
  })
  await ctx.repos.itens.salvar(lote)
  for (const i of lotes) await moverEstoque(ctx, { itemId: i.id, delta: -i.saldo, motivo: 'unificacao', origemId: lote.id, descricao: `Unificado em ${codigo}` })
  await moverEstoque(ctx, { itemId: lote.id, delta: total, motivo: 'unificacao', origemId: lote.id, descricao: `Unificação de ${lista}` })
  await auditar(ctx, 'unificarLotes', lote.id, `${tg.codigo} · ${codigo} ← ${lista} = ${unidadeTexto(lote.unidade, total)}${motivo ? ` · ${motivo}` : ''}`, ids)
  return { id: lote.id, codigo, triagem: tg.codigo }
}

/**
 * Leva lotes para qualquer coluna da triagem (menos "Vendido", que é calculada). Entrar numa coluna "pronto para venda"
 * marca o lote bruto como Separado (vendável). Uma linha no log por lote, com de → para.
 */
export async function moverFaseTriagem(ctx: Ctx, d: { ids: Id[]; fase: string; obs?: string; pesos?: Record<Id, number | undefined> }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador mexe na triagem.')
  exigir(d.ids?.length, 'Escolha pelo menos um lote.')
  const obs = d.obs?.trim() || undefined
  const alterados: Id[] = []
  const cache = new Map<string, ColunaTriagem[]>()
  for (const id of new Set(d.ids)) {
    let i = await ctx.repos.itens.obter(id)
    exigir(i, 'Lote não encontrado.')
    if (!cache.has(i.moduloId)) cache.set(i.moduloId, await colunasTriagem(ctx, i.moduloId))
    const colunas = cache.get(i.moduloId)!
    const col = colunas.find((c) => c.id === d.fase)
    exigir(col && col.id !== COLUNA_VENDIDO, col ? '"Vendido" é automático: vende-se pela tela de venda.' : 'Essa coluna da triagem não existe.')
    exigir(i.saldo > 0, `${i.codigo ?? i.nome} está sem saldo.`)
    const antes = faseLote(i, colunas)!
    if (antes === col.id && !obs) continue
    await exigirFotoParaSair(ctx, [i], col.id)
    let extra = ''
    // lavagem: peso depois (opcional) → a diferença vira "perda de lavagem" no livro (antes → depois)
    const peso = d.pesos?.[id]
    if (peso !== undefined && peso !== null) {
      exigir(Number.isSafeInteger(peso) && peso > 0, 'Peso depois inválido.')
      exigir(peso <= i.saldo, `${i.codigo ?? i.nome}: o peso depois (${unidadeTexto(i.unidade, peso)}) é maior que o de antes (${unidadeTexto(i.unidade, i.saldo)}).`)
      if (peso < i.saldo) {
        const texto = `${unidadeTexto(i.unidade, i.saldo)} → ${unidadeTexto(i.unidade, peso)} (−${unidadeTexto(i.unidade, i.saldo - peso)})`
        await moverEstoque(ctx, { itemId: i.id, delta: peso - i.saldo, motivo: 'perda', descricao: `Perda de lavagem: ${texto}` })
        extra += ` · lavagem ${texto}`
        i = (await ctx.repos.itens.obter(id))!
      }
    }
    if (col.pronto && ehBruto(i)) {
      const mudou = await aplicarCampos(ctx, i, { estado: 'Separado' })
      if (mudou) extra = ` (${mudou.join('; ')})`
      i = (await ctx.repos.itens.obter(id))!
    }
    const desde = antes === col.id ? i.faseTriagem?.desde ?? i.criadoEm : ctx.relogio.agora()
    await ctx.repos.itens.salvar(tocar(ctx, { ...i, faseTriagem: { fase: col.id, desde, obs, entrada: col.entrada || undefined } }))
    const nomeAntes = colunas.find((c) => c.id === antes)?.nome ?? antes
    await auditar(ctx, 'moverFaseTriagem', i.id, `${i.codigo ?? i.nome}: ${nomeAntes} → ${col.nome}${extra}${obs ? ` · ${obs}` : ''}`)
    alterados.push(i.id)
  }
  return { alterados }
}

// ---------- colunas personalizadas ----------

const temEstadoNoModulo = (ctx: Ctx, moduloId: string) => ctx.modulos.tem(moduloId) && ctx.modulos.obter(moduloId).tiposItem.some((x) => x.controlaEstoque && x.campos.some((c) => c.id === 'estado'))

/** Quantos lotes (com saldo) estão em cada coluna agora. */
async function lotesPorColuna(ctx: Ctx, moduloId: string, colunas: ColunaTriagem[]) {
  const n: Record<string, number> = {}
  for (const i of await ctx.repos.itens.listar({ moduloId })) {
    if (!i.controlaEstoque || !i.ativo || i.saldo <= 0 || !('estado' in i.campos)) continue
    const f = faseLote(i, colunas)
    if (f) n[f] = (n[f] ?? 0) + 1
  }
  return n
}

export async function fluxosTriagem(ctx: Ctx, _p: object = {}) {
  const r = await ctx.repos.config.obter('fluxoTriagem')
  const salvos = (r?.valor as Record<string, ColunaTriagem[]> | undefined) ?? {}
  const mods = ctx.modulos.todos().filter((m) => temEstadoNoModulo(ctx, m.id))
  return Promise.all(
    mods.map(async (m) => {
      const colunas = salvos[m.id] ?? COLUNAS_PADRAO
      return { moduloId: m.id, nome: m.nome, icone: m.icone, personalizado: !!salvos[m.id], colunas, emUso: await lotesPorColuna(ctx, m.id, colunas) }
    }),
  )
}

/**
 * Muda as colunas da triagem de um módulo: nome, ordem, cor, explicação e o que cada uma faz.
 * Regras: 2 a 10 colunas, nomes únicos, "Vendido" sempre a última (só muda o nome), exatamente uma de entrada,
 * pelo menos uma "pronto para venda" e não dá para tirar uma coluna onde ainda há lote. colunas: null = padrão.
 */
export async function salvarFluxoTriagem(ctx: Ctx, d: { moduloId: string; colunas: ColunaTriagem[] | null }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador muda as etapas da triagem.')
  exigir(temEstadoNoModulo(ctx, d.moduloId), 'Esse módulo não tem triagem de lotes.')
  const atuais = await colunasTriagem(ctx, d.moduloId)
  const novas = d.colunas ?? COLUNAS_PADRAO
  const emUso = await lotesPorColuna(ctx, d.moduloId, atuais)
  for (const c of atuais.filter((c) => c.id !== COLUNA_VENDIDO && !novas.some((n) => n.id === c.id))) {
    const n = emUso[c.id] ?? 0
    exigir(!n, `${n} lote(s) estão em "${c.nome}": mova esses lotes antes de tirar a coluna.`)
  }
  const r = await ctx.repos.config.obter('fluxoTriagem')
  const valor = { ...((r?.valor as Record<string, ColunaTriagem[]> | undefined) ?? {}) }
  if (!d.colunas) delete valor[d.moduloId]
  else {
    const cs = d.colunas
    exigir(cs.length >= 2 && cs.length <= 10, 'Use de 2 a 10 colunas.')
    exigir(cs.every((c) => c.nome?.trim() && /^[a-z0-9-]{1,30}$/.test(c.id)), 'Toda coluna precisa de nome.')
    exigir(new Set(cs.map((c) => c.nome.trim().toLowerCase())).size === cs.length, 'Há duas colunas com o mesmo nome.')
    exigir(new Set(cs.map((c) => c.id)).size === cs.length, 'Coluna repetida.')
    exigir(cs[cs.length - 1].id === COLUNA_VENDIDO && cs.filter((c) => c.id === COLUNA_VENDIDO).length === 1, '"Vendido" é sempre a última coluna.')
    const meio = cs.slice(0, -1)
    exigir(meio.filter((c) => c.entrada).length === 1, 'Escolha uma (e só uma) coluna de entrada: onde caem os lotes das compras.')
    exigir(meio.some((c) => c.pronto), 'Pelo menos uma coluna precisa ser "pronto para venda".')
    exigir(cs.every((c) => !c.cor || /^#[0-9a-fA-F]{6}$/.test(c.cor)), 'Cor inválida.')
    valor[d.moduloId] = cs.map((c) => {
      const v = c.id === COLUNA_VENDIDO
      return { id: c.id, nome: c.nome.trim(), cor: c.cor || undefined, ajuda: c.ajuda?.trim() || undefined, entrada: (!v && c.entrada) || undefined, pronto: (!v && c.pronto) || undefined, separarAoEntrar: (!v && c.separarAoEntrar) || undefined, lembrarFotos: (!v && c.lembrarFotos) || undefined, exigirFoto: (!v && c.exigirFoto) || undefined, pedirPeso: (!v && c.pedirPeso) || undefined }
    })
  }
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: 'fluxoTriagem', valor }))
  await auditar(ctx, 'salvarFluxoTriagem', d.moduloId, d.colunas ? novas.map((c) => c.nome).join(' → ') : 'voltou ao padrão')
  return { id: d.moduloId }
}

// ---------- quadro ----------

export interface CartaoTriagem {
  id: Id
  codigo?: string
  nome: string
  campos: Campos
  unidade: Item['unidade']
  saldo: number
  inicial: number
  /** id da coluna */
  fase: string
  /** desde quando está na coluna (AAAA-MM-DD) e há quantos dias */
  desde: string
  dias: number
  /** numa coluna de trabalho (não vendável) há mais dias que o aviso de "parado" */
  atrasado: boolean
  obs?: string
  compras: { id: Id; codigo?: string; fornecedor?: string; fornecedorId?: Id }[]
  /** de quantos lotes foi unificado (0 = não é unificado) e os códigos deles */
  unificado: number
  unificadoDe?: { id: Id; codigo?: string }[]
  /** lote-mãe quando veio de uma separação */
  pai?: { id: Id; codigo?: string }
  triadoEm?: string
  vendidoEm?: string
  custo?: number
  custoKg?: number
  /** preço pela tabela vigente (gramas × fator) e margem sobre o custo (admin) */
  preco?: { valor: number; moeda: string; valorPrincipal: number; fator: string; medida: number; coluna: string }
  margem?: number
  semPreco?: 'medida' | 'tabela'
  /** Compra(s) → Triagem(ns) → Venda(s) */
  cadeia: Cadeia
  /** miniatura (a própria mais nova ou a herdada da origem/compra) e quantas fotos próprias o lote tem */
  foto?: FotoResumo
  fotosProprias: number
  /** texto da busca: códigos atuais e anteriores (lote, compras, origem), fornecedor e sigla */
  busca: string
}

/**
 * QUADRO DA TRIAGEM: cada lote na sua coluna, com compra(s), dias esperando, custo e — nas colunas "pronto para venda" —
 * o preço pela tabela vigente (gramas × fator da medida/categoria na coluna de preço escolhida) e a margem.
 */
export async function triagem(ctx: Ctx, p: { moduloId?: string; colunaId?: string; vendidosDias?: number } = {}) {
  const moduloId = p.moduloId ?? 'cabelo'
  const hoje = ctx.relogio.hoje()
  const admin = ctx.sessao.perfil === 'admin'
  const colunas = await colunasTriagem(ctx, moduloId)
  const porColunaId = new Map(colunas.map((c) => [c.id, c]))
  const temEstado = (i: Item) => {
    try {
      return ctx.modulos.tipoItem(i.moduloId, i.tipoItem).campos.some((c) => c.id === 'estado')
    } catch {
      return false
    }
  }
  const itens = (await ctx.repos.itens.listar({ moduloId })).filter((i) => i.controlaEstoque && i.ativo && temEstado(i))
  const doModulo = new Set(itens.map((i) => i.id))
  const porId = new Map(itens.map((i) => [i.id, i]))
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((t) => [t.id, t] as [Id, Transacao]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const ultimaVenda = new Map<Id, string>()
  for (const t of await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    if (t.etapa === 'concluido') for (const l of t.linhas) if (l.itemId && doModulo.has(l.itemId) && (ultimaVenda.get(l.itemId) ?? '') < t.data) ultimaVenda.set(l.itemId, t.data)
  const diasAviso = ctx.modulos.tem(moduloId) ? ctx.modulos.obter(moduloId).compra?.avisarParadaDias ?? 3 : 3
  const limiteVendido = p.vendidosDias ?? 30
  const padrao = await tabelaVigente(ctx, { moduloId })
  const tabelas = new Map<string, Awaited<ReturnType<typeof tabelaVigente>>>()
  const tabelaDe = async (cat: string) => {
    if (!tabelas.has(cat)) tabelas.set(cat, await tabelaVigente(ctx, { moduloId, categoria: cat }))
    return tabelas.get(cat)
  }
  const L = await leitorCadeia(ctx)
  const F = await leitorFotos(ctx, { porId: L.porId, compras })
  const siglas = await siglasPorPessoa(ctx)
  let vendidosOcultos = 0
  const lotes: CartaoTriagem[] = []
  for (const i of itens) {
    const vendidoEm = ultimaVenda.get(i.id)
    const fase = faseLote(i, colunas, !!vendidoEm)
    if (!fase) continue
    const col = porColunaId.get(fase)
    if (fase === COLUNA_VENDIDO && limiteVendido > 0 && diasEntre(vendidoEm!, hoje) > limiteVendido) {
      vendidosOcultos++
      continue
    }
    const naFila = fase !== COLUNA_VENDIDO && !col?.pronto
    const desde = (fase === COLUNA_VENDIDO ? vendidoEm! : i.faseTriagem?.fase === fase ? i.faseTriagem.desde : i.criadoEm).slice(0, 10)
    const custo = custoDe(i, i.saldo)
    // preço de venda pela tabela vigente (só para o que está pronto para vender)
    let preco: CartaoTriagem['preco']
    let semPreco: CartaoTriagem['semPreco']
    if (col?.pronto) {
      const medida = Number(i.campos.comprimento)
      const tb = await tabelaDe(String(i.campos.categoria || 'Normal'))
      const cp = tb?.colunas.find((c) => c.id === p.colunaId) ?? tb?.colunas[0]
      const fator = tb && medida && cp ? fatorDaTabela(tb, medida, cp.id).fator : undefined
      if (!medida) semPreco = 'medida'
      else if (!tb || !cp || !fator) semPreco = 'tabela'
      else {
        const valor = multiplicarFator(i.saldo, fator, tb.moeda)
        let valorPrincipal = valor
        try {
          valorPrincipal = (await paraPrincipal(ctx, valor, tb.moeda)).valorPrincipal
        } catch {
          /* sem cotação: fica na moeda da tabela */
        }
        preco = { valor, moeda: tb.moeda, valorPrincipal, fator, medida, coluna: cp.nome }
      }
    }
    const cs = comprasDe(i).map((id) => compras.get(id)).filter((t): t is Transacao => !!t)
    lotes.push({
      id: i.id,
      codigo: i.codigo,
      nome: i.nome,
      campos: i.campos,
      unidade: i.unidade,
      saldo: i.saldo,
      inicial: i.quantidadeInicial ?? 0,
      fase,
      desde,
      dias: diasEntre(desde, hoje),
      atrasado: naFila && diasEntre(desde, hoje) > diasAviso,
      obs: i.faseTriagem?.fase === fase ? i.faseTriagem.obs : undefined,
      compras: cs.map((t) => ({ id: t.id, codigo: t.codigo, fornecedor: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, fornecedorId: t.pessoaId })),
      unificado: i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).length : 0,
      unificadoDe: i.origem?.tipo === 'unificacao' ? (i.origem.ids ?? []).map((id) => ({ id, codigo: porId.get(id)?.codigo })) : undefined,
      pai: i.origem?.tipo === 'transformacao' && i.origem.id ? { id: i.origem.id, codigo: porId.get(i.origem.id)?.codigo } : undefined,
      triadoEm: i.campos.separacaoId ? i.criadoEm.slice(0, 10) : undefined,
      vendidoEm,
      custo: admin ? custo : undefined,
      custoKg: admin && i.quantidadeInicial && i.custoPrincipal ? Math.round((i.custoPrincipal * 1000) / i.quantidadeInicial) : undefined,
      preco,
      margem: admin && preco ? preco.valorPrincipal - custo : undefined,
      semPreco,
      cadeia: L.cadeia(i.id),
      foto: F.principal(i.id),
      fotosProprias: F.proprias(i.id),
      busca: [
        i.codigo, ...(i.codigosAnteriores ?? []), i.nome,
        ...cs.flatMap((t) => [t.codigo, ...(t.codigosAnteriores ?? []), ...[t.pessoaId, t.compradorId].flatMap((x) => (x ? [pessoas.get(x), siglas.get(x)] : []))]),
        ...lotesDeOrigem(i).flatMap((id) => [L.porId.get(id)?.codigo, ...(L.porId.get(id)?.codigosAnteriores ?? [])]),
      ].filter(Boolean).join(' ').toLowerCase(),
    })
  }
  const pos = new Map(colunas.map((c, k) => [c.id, k]))
  lotes.sort((a, b) => (a.fase !== b.fase ? pos.get(a.fase)! - pos.get(b.fase)! : porColunaId.get(a.fase)?.pronto || a.fase === COLUNA_VENDIDO ? (a.desde < b.desde ? 1 : -1) : b.dias - a.dias))
  // números do topo: gramas por coluna, triado na semana e perda do mês (separações)
  const semanaDesde = somarDias(hoje, -6)
  const mesDesde = inicioDoMes(hoje)
  const movs = (await ctx.repos.movEstoque.listar()).filter((m) => m.motivo === 'transformacao' && doModulo.has(m.itemId))
  const soma = (f: (m: (typeof movs)[number]) => boolean) => movs.filter(f).reduce((s, m) => s + m.delta, 0)
  const usadoMes = -soma((m) => m.delta < 0 && m.data >= mesDesde)
  const geradoMes = soma((m) => m.delta > 0 && m.data >= mesDesde)
  const porColuna = Object.fromEntries(colunas.map((c) => { const ls = lotes.filter((x) => x.fase === c.id); return [c.id, { n: ls.length, g: ls.reduce((s, x) => s + x.saldo, 0) }] }))
  const prontos = lotes.filter((x) => porColunaId.get(x.fase)?.pronto)
  const naoId = lotes.filter((x) => x.fase !== COLUNA_VENDIDO && x.campos.estado === NAO_IDENTIFICADO)
  return {
    lotes,
    colunas,
    vendidosOcultos,
    diasAviso,
    colunasPreco: (padrao?.colunas ?? []).map((c) => ({ id: c.id, nome: c.nome })),
    colunaPrecoId: padrao?.colunas.find((c) => c.id === p.colunaId)?.id ?? padrao?.colunas[0]?.id,
    semanaDesde,
    mesDesde,
    totais: {
      porColuna,
      triadoSemana: soma((m) => m.delta > 0 && m.data >= semanaDesde),
      perdaMes: usadoMes - geradoMes,
      usadoMes,
      perdaMesBp: usadoMes ? Math.round(((usadoMes - geradoMes) * 10000) / usadoMes) : 0,
      pronto: prontos.reduce((s, x) => s + x.saldo, 0),
      prontoValor: prontos.reduce((s, x) => s + (x.preco?.valorPrincipal ?? 0), 0),
      aguardando: lotes.filter((x) => x.fase === entradaDe(colunas).id).reduce((s, x) => s + x.saldo, 0),
      // "não identificado": o que ficou para depois numa separação (pendência até alguém separar)
      naoIdentificado: { n: naoId.length, g: naoId.reduce((s, x) => s + x.saldo, 0), dias: naoId.reduce((s, x) => Math.max(s, x.dias), 0) },
    },
  }
}

// ---------- triagem em um passo: juntar e/ou separar, com um id só ----------

/**
 * TRIAR: um passo, um id ("T-0004"). Com 2+ lotes, junta (unifica); com partes, separa (o que sobra é perda).
 * Dá para só juntar, só separar ou os dois. Cada lote que sai guarda a triagem (quem, quando) e de onde veio.
 */
export async function triarLotes(ctx: Ctx, d: { id: Id; ids: Id[]; quantidadeUsada?: number; saidas?: SaidaSeparacao[]; paraDepois?: ParaDepois; custoExtraPrincipal?: number; motivo?: string; codigo?: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador faz a triagem.')
  const ja = (await ctx.repos.itens.listar()).filter((i) => i.triagem?.id === d.id)
  if (ja.length) return { id: d.id, codigo: ja[0].triagem!.codigo, lotes: ja.filter((i) => i.triagem!.papel === 'saida').map((i) => i.id) }
  const ids = [...new Set(d.ids ?? [])]
  exigir(ids.length, 'Escolha o(s) lote(s).')
  // separa quando há partes ou um pacote "para depois" (não identificado)
  const separa = !!d.saidas?.length || !!d.paraDepois?.quantidade
  exigir(ids.length >= 2 || separa, 'Diga em que lotes ele foi separado.')
  // coluna com "exigir foto ao sair": cada lote que entra na triagem precisa de foto própria
  await exigirFotoParaSair(ctx, (await Promise.all(ids.map((x) => ctx.repos.itens.obter(x)))).filter((x): x is Item => !!x))
  // códigos digitados (lote juntado e partes): conferidos antes de mexer em qualquer lote
  const { reservados } = await exigirCodigosLivres(ctx, 'lote', [d.codigo, ...(d.saidas ?? []).map((x) => x.codigo), d.paraDepois?.codigo])
  const tg = await novaTriagem(ctx, d.id)
  let loteId = ids[0]
  if (ids.length > 1) {
    loteId = separa ? `${d.id}-u` : d.id
    await unificarNaTriagem(ctx, { id: loteId, ids, motivo: d.motivo, codigo: d.codigo, reservados: new Set([...reservados].filter((c) => c !== (d.codigo ?? '').trim().toUpperCase())) }, tg, separa ? 'intermediario' : 'saida', true)
  }
  if (!separa) return { id: d.id, codigo: tg.codigo, lotes: [loteId] }
  const lote = await ctx.repos.itens.obter(loteId)
  exigir(lote, 'Lote não encontrado.')
  const r = await separarNaTriagem(ctx, { id: d.id, loteId, quantidadeUsada: d.quantidadeUsada ?? lote.saldo, saidas: d.saidas ?? [], paraDepois: d.paraDepois, custoExtraPrincipal: d.custoExtraPrincipal, descricao: d.motivo?.trim() || undefined }, tg)
  return { id: d.id, codigo: tg.codigo, lotes: r.lotes }
}

// ---------- genealogia: o rastreio total, em gramas ----------

export interface Ligacao { id: Id; codigo?: string; g: number; tipo: 'compra' | 'triagem' | 'lote' | 'venda' }

/** chave da triagem de um lote (lotes separados antes do id de triagem usam a separação) */
const chaveTriagem = (i: Item) => i.triagem?.id ?? (i.origem?.tipo === 'transformacao' ? (i.campos.separacaoId as string | undefined) : undefined)

/**
 * GENEALOGIA: o grafo inteiro ligado a uma compra, lote, venda ou triagem — compras → triagens → lotes → vendas —
 * seguindo as ligações nos dois sentidos (inclusive outras compras misturadas), com as gramas de cada ligação, onde está
 * cada grama agora e a conta: entrou = vendido + em estoque + perda (✓ quando fecha). Limite: 200 lotes.
 */
export async function genealogia(ctx: Ctx, p: { compraId?: Id; itemId?: Id; vendaId?: Id; triagemId?: Id }) {
  const L = await leitorCadeia(ctx)
  const { porId } = L
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa !== 'cancelado')
  const movs = await ctx.repos.movEstoque.listar()
  const movsDe = new Map<Id, typeof movs>()
  for (const m of movs) movsDe.set(m.itemId, [...(movsDe.get(m.itemId) ?? []), m])
  const lotesDaCompra = new Map<Id, Id[]>()
  for (const i of L.itens) if (i.origem?.tipo === 'compra' && i.origem.id) lotesDaCompra.set(i.origem.id, [...(lotesDaCompra.get(i.origem.id) ?? []), i.id])
  const filhos = new Map<Id, Id[]>()
  for (const i of L.itens) for (const o of lotesDeOrigem(i)) filhos.set(o, [...(filhos.get(o) ?? []), i.id])
  // sementes
  let sementes: Id[] = []
  if (p.compraId) sementes = lotesDaCompra.get(p.compraId) ?? []
  else if (p.itemId) sementes = [p.itemId]
  else if (p.vendaId) sementes = ((await ctx.repos.transacoes.obter(p.vendaId))?.linhas ?? []).map((l) => l.itemId!).filter((x) => porId.has(x))
  else if (p.triagemId) sementes = L.itens.filter((i) => chaveTriagem(i) === p.triagemId).map((i) => i.id)
  // percorre os dois sentidos: pais, filhos e os outros lotes da mesma compra
  const lotes = new Set<Id>()
  const fila = [...sementes]
  let parcial = false
  while (fila.length) {
    const id = fila.shift()!
    if (lotes.has(id) || !porId.has(id)) continue
    if (lotes.size >= 200) {
      parcial = true
      break
    }
    lotes.add(id)
    const i = porId.get(id)!
    fila.push(...lotesDeOrigem(i), ...(filhos.get(id) ?? []))
    if (i.origem?.tipo === 'compra' && i.origem.id) fila.push(...(lotesDaCompra.get(i.origem.id) ?? []))
  }
  const soma = (id: Id, f: (m: (typeof movs)[number]) => boolean) => (movsDe.get(id) ?? []).filter(f).reduce((s, m) => s + m.delta, 0)
  // TRIAGENS: agrupadas pela chave; intermediário (unificado e separado no mesmo passo) não vira nó
  const grupos = new Map<Id, Item[]>()
  for (const id of lotes) {
    const i = porId.get(id)!
    const k = chaveTriagem(i)
    if (k) grupos.set(k, [...(grupos.get(k) ?? []), i])
  }
  const intermediario = (i?: Item) => i?.triagem?.papel === 'intermediario'
  const triagens = [...grupos].map(([k, is]) => {
    const saidas = is.filter((i) => !intermediario(i))
    const meio = new Set([k, ...is.map((i) => i.id)])
    const entradasIds = new Set<Id>()
    for (const i of is) for (const o of lotesDeOrigem(i)) if (!intermediario(porId.get(o)) || chaveTriagem(porId.get(o)!) !== k) entradasIds.add(o)
    for (const i of is.filter(intermediario)) for (const o of lotesDeOrigem(i)) entradasIds.add(o)
    for (const i of is.filter(intermediario)) entradasIds.delete(i.id)
    const entradas: Ligacao[] = [...entradasIds].map((id) => ({ id, codigo: porId.get(id)?.codigo, tipo: 'lote' as const, g: -soma(id, (m) => m.delta < 0 && (m.motivo === 'transformacao' || m.motivo === 'unificacao') && !!m.origemId && meio.has(m.origemId)) }))
    const sai: Ligacao[] = saidas.map((i) => ({ id: i.id, codigo: i.codigo, tipo: 'lote' as const, g: i.quantidadeInicial ?? 0 }))
    const gIn = entradas.reduce((s, x) => s + x.g, 0)
    const gOut = sai.reduce((s, x) => s + x.g, 0)
    const tg = is.find((i) => i.triagem)?.triagem
    const em = tg?.em ?? is[0].criadoEm
    return { tipo: 'triagem' as const, id: k, codigo: tg?.codigo ?? `T·${k.slice(-4).toUpperCase()}`, em, por: tg?.por, entradas, saidas: sai, perda: gIn - gOut, perdaPct: gIn ? Math.round(((gIn - gOut) * 10000) / gIn) : 0, juntou: is.some((i) => i.origem?.tipo === 'unificacao'), separou: is.some((i) => i.origem?.tipo === 'transformacao') }
  })
  const triagemDoLote = new Map<Id, (typeof triagens)[number]>()
  for (const t of triagens) for (const s of t.saidas) triagemDoLote.set(s.id, t)
  const triagemQueUsou = new Map<Id, (typeof triagens)[number][]>()
  for (const t of triagens) for (const e of t.entradas) triagemQueUsou.set(e.id, [...(triagemQueUsou.get(e.id) ?? []), t])
  // VENDAS dos lotes do grafo
  const vendasNos = vendas
    .filter((t) => t.linhas.some((l) => l.itemId && lotes.has(l.itemId)))
    .map((t) => {
      const ls = t.linhas.filter((l) => l.itemId && lotes.has(l.itemId))
      const porLote = new Map<Id, number>()
      for (const l of ls) porLote.set(l.itemId!, (porLote.get(l.itemId!) ?? 0) + l.quantidade)
      return { tipo: 'venda' as const, id: t.id, codigo: L.codigoVenda(t), data: t.data, cliente: t.pessoaId ? L.pessoas.get(t.pessoaId) : undefined, agendada: t.etapa !== 'concluido', g: ls.reduce((s, l) => s + l.quantidade, 0), lotes: [...porLote].map(([id, g]) => ({ id, codigo: porId.get(id)?.codigo, g, tipo: 'lote' as const })) }
    })
    .sort((a, b) => (a.data < b.data ? -1 : 1))
  // COMPRAS
  const comprasIds = new Set<Id>()
  for (const id of lotes) {
    const i = porId.get(id)!
    if (i.origem?.tipo === 'compra' && i.origem.id) comprasIds.add(i.origem.id)
  }
  const compras = [...comprasIds].map((cid) => {
    const t = L.compras.get(cid)
    const ls = (lotesDaCompra.get(cid) ?? []).filter((id) => lotes.has(id)).map((id) => ({ id, codigo: porId.get(id)?.codigo, tipo: 'lote' as const, g: soma(id, (m) => m.motivo === 'compra' && m.origemId === cid) }))
    return { tipo: 'compra' as const, id: cid, codigo: t?.codigo, data: t?.data ?? '', fornecedor: t?.pessoaId ? L.pessoas.get(t.pessoaId) : undefined, fornecedorId: t?.pessoaId, g: ls.reduce((s, x) => s + x.g, 0), lotes: ls }
  }).sort((a, b) => (a.data < b.data ? -1 : 1))
  // LOTES: de onde veio, para onde foi e onde está agora (com a miniatura: a própria ou a herdada)
  const F = await leitorFotos(ctx, { porId, compras: L.compras })
  const nosLotes = [...lotes]
    .map((id) => porId.get(id)!)
    .filter((i) => !intermediario(i))
    .map((i) => {
      const t = triagemDoLote.get(i.id)
      const de: Ligacao[] = t ? [{ tipo: 'triagem', id: t.id, codigo: t.codigo, g: i.quantidadeInicial ?? 0 }] : i.origem?.tipo === 'compra' && i.origem.id ? [{ tipo: 'compra', id: i.origem.id, codigo: L.compras.get(i.origem.id)?.codigo, g: soma(i.id, (m) => m.motivo === 'compra') }] : []
      const para: Ligacao[] = [
        ...(triagemQueUsou.get(i.id) ?? []).map((x) => ({ tipo: 'triagem' as const, id: x.id, codigo: x.codigo, g: x.entradas.find((e) => e.id === i.id)?.g ?? 0 })),
        ...vendasNos.filter((v) => v.lotes.some((l) => l.id === i.id)).map((v) => ({ tipo: 'venda' as const, id: v.id, codigo: v.codigo, g: v.lotes.find((l) => l.id === i.id)!.g })),
      ]
      const ajustes = -soma(i.id, (m) => m.motivo === 'ajuste' || m.motivo === 'perda')
      // compra recusada/cancelada: o cabelo devolvido sai do lote (movimento 'cancelamento' ligado à compra)
      const cancelado = -soma(i.id, (m) => m.motivo === 'cancelamento' && !!m.origemId && L.compras.has(m.origemId))
      return { tipo: 'lote' as const, id: i.id, codigo: i.codigo, nome: i.nome, entrou: de.reduce((s, x) => s + x.g, 0) || i.quantidadeInicial || 0, saldo: i.saldo, vendido: para.filter((x) => x.tipo === 'venda').reduce((s, x) => s + x.g, 0), triado: para.filter((x) => x.tipo === 'triagem').reduce((s, x) => s + x.g, 0), ajustes, cancelado, de, para, compras: comprasDe(i).map(L.compraCurta), bruto: i.campos.estado === 'Bruto', foto: F.principal(i.id), criadoEm: i.criadoEm, campos: { comprimento: i.campos.comprimento, categoria: i.campos.categoria } }
    })
    .sort((a, b) => ((a.codigo ?? '') < (b.codigo ?? '') ? -1 : 1))
  triagens.sort((a, b) => (a.em < b.em ? -1 : 1))
  const entrou = compras.reduce((s, c) => s + c.g, 0) + nosLotes.filter((l) => !l.de.length).reduce((s, l) => s + (l.compras.length ? 0 : l.entrou), 0)
  const vendido = vendasNos.reduce((s, v) => s + v.g, 0)
  const emEstoque = nosLotes.reduce((s, l) => s + l.saldo, 0)
  const perdaTriagem = triagens.reduce((s, t) => s + t.perda, 0)
  const ajustes = nosLotes.reduce((s, l) => s + l.ajustes, 0)
  const cancelado = nosLotes.reduce((s, l) => s + l.cancelado, 0)
  // CAMINHO do registro em foco (a barra "você está aqui"): compra(s) → triagem(ns) → [lote] → venda(s)
  const juntar = <X extends { id: Id }>(xs: X[]) => [...new Map(xs.map((x) => [x.id, x])).values()]
  const cadeias = sementes.filter((id) => porId.get(id)?.triagem?.papel !== 'intermediario').map((id) => L.cadeia(id))
  const focoLote = p.itemId ? porId.get(p.itemId) : undefined
  const caminho = {
    compras: p.compraId ? [L.compraCurta(p.compraId)] : juntar(cadeias.flatMap((c) => c.compras)),
    triagens: juntar(cadeias.flatMap((c) => c.triagens)),
    vendas: p.vendaId ? [{ id: p.vendaId, codigo: vendasNos.find((v) => v.id === p.vendaId)?.codigo ?? '' }] : juntar(cadeias.flatMap((c) => c.vendas)),
    lote: focoLote ? { id: focoLote.id, codigo: focoLote.codigo, nome: focoLote.nome, saldo: focoLote.saldo, bruto: focoLote.campos.estado === 'Bruto' } : undefined,
  }
  return {
    foco: p.compraId ?? p.itemId ?? p.vendaId ?? p.triagemId,
    tipoFoco: p.compraId ? ('compra' as const) : p.itemId ? ('lote' as const) : p.vendaId ? ('venda' as const) : ('triagem' as const),
    caminho,
    compras,
    triagens,
    lotes: nosLotes,
    vendas: vendasNos,
    parcial,
    totais: { entrou, vendido, emEstoque, perdaTriagem, ajustes, cancelado, perda: perdaTriagem + ajustes, confere: !parcial && entrou === vendido + emEstoque + perdaTriagem + ajustes + cancelado },
  }
}

/** Lista das TRIAGENS (T-0001…): quando, quem, compras que entraram, lotes que saíram, perda e as vendas depois. */
export async function triagens(ctx: Ctx, p: { moduloId?: string } = {}) {
  const L = await leitorCadeia(ctx)
  const moduloId = p.moduloId ?? 'cabelo'
  const chaves = new Set<Id>()
  for (const i of L.itens) if (i.moduloId === moduloId) {
    const k = chaveTriagem(i)
    if (k) chaves.add(k)
  }
  const lista = []
  for (const k of chaves) {
    const g = await genealogiaTriagem(ctx, L, k)
    if (g) lista.push(g)
  }
  return lista.sort((a, b) => (a.em < b.em ? 1 : -1))
}

async function genealogiaTriagem(ctx: Ctx, L: Awaited<ReturnType<typeof leitorCadeia>>, k: Id) {
  const is = L.itens.filter((i) => chaveTriagem(i) === k)
  if (!is.length) return undefined
  const movs = await ctx.repos.movEstoque.listar()
  const saidas = is.filter((i) => i.triagem?.papel !== 'intermediario')
  const meio = new Set([k, ...is.map((i) => i.id)])
  const entradas = new Set<Id>()
  for (const i of is) for (const o of lotesDeOrigem(i)) if (!meio.has(o)) entradas.add(o)
  const gIn = -movs.filter((m) => entradas.has(m.itemId) && m.delta < 0 && !!m.origemId && meio.has(m.origemId) && (m.motivo === 'transformacao' || m.motivo === 'unificacao')).reduce((s, m) => s + m.delta, 0)
  const gOut = saidas.reduce((s, i) => s + (i.quantidadeInicial ?? 0), 0)
  const tg = is.find((i) => i.triagem)?.triagem
  const compras = new Map<Id, ReturnType<typeof L.compraCurta>>()
  for (const e of entradas) for (const c of comprasDe(L.porId.get(e))) compras.set(c, L.compraCurta(c))
  const descend = new Set<Id>(saidas.map((i) => i.id))
  for (const i of saidas) for (const x of L.descendentes(i.id)) descend.add(x)
  return {
    id: k,
    codigo: tg?.codigo ?? `T·${k.slice(-4).toUpperCase()}`,
    em: tg?.em ?? is[0].criadoEm,
    por: tg?.por,
    compras: [...compras.values()],
    entradas: [...entradas].map((id) => ({ id, codigo: L.porId.get(id)?.codigo })),
    saidas: saidas.map((i) => ({ id: i.id, codigo: i.codigo, nome: i.nome, g: i.quantidadeInicial ?? 0, saldo: i.saldo })),
    pesoEntrada: gIn,
    pesoSaida: gOut,
    perda: gIn - gOut,
    perdaPct: gIn ? Math.round(((gIn - gOut) * 10000) / gIn) : 0,
    vendas: L.vendasDosLotes(descend),
  }
}
