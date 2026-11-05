// CÓDIGOS de compra e de lote: como cada um é identificado. Dois padrões, à escolha do negócio (Configurações › Códigos):
//  1. INCREMENTAL: 1, 2, 3 (sem prefixo) ou P-0001, L-0001 (prefixo e casas). Triagem (T-) e venda (V-) também.
//  2. CUSTOMIZÁVEL: por pessoa (sigla + sequência da pessoa: Maria → M1, M2; Celso → C1), da compra (lote M1-1, M1-2;
//     separado → M1-1a, M1-1b; juntado → M1+C3-1) ou manual (digitado na hora; sugere o próximo incremental).
// Regra de ouro: código é ÚNICO por tipo (compra / lote), sem diferenciar maiúsculas nem espaços nas pontas. Código
// digitado que já existe é recusado dizendo QUAL registro já usa ("Já existe: compra P-0003 · Helena · 04/10/2026").
// Trocar o código depois (admin) fica no log com antes → depois e o antigo continua achando o registro na busca.

import { exigir } from '../domain/erros'
import type { Id, Item, Pessoa, Transacao } from '../domain/tipos'
import { auditar, type Ctx, novo, tocar } from './contexto'

export type ModoCompra = 'incremental' | 'porPessoa' | 'manual'
export type ModoLote = 'incremental' | 'daCompra' | 'manual'
export type TipoCodigo = 'compra' | 'lote'
/** etiqueta do lote: QR + código de barras (Code 128, leitor "pistola"), só QR (celular) ou nenhuma (código grande à mão) */
export type ModoEtiqueta = 'qrBarras' | 'qr' | 'nenhuma'
export const MODOS_ETIQUETA: ModoEtiqueta[] = ['qrBarras', 'qr', 'nenhuma']

/** prefixo (pode ser vazio) + número com N casas: { 'P-', 4 } → P-0007; { '', 0 } → 7 */
export interface Sequencia {
  prefixo: string
  digitos: number
}

export interface RegrasCodigos {
  compra: Sequencia & { modo: ModoCompra; base: 'fornecedor' | 'comprador' }
  lote: Sequencia & { modo: ModoLote }
  triagem: Sequencia
  venda: Sequencia
  /** sigla de cada pessoa no modo "por pessoa" (sem sigla guardada = a sugerida pelo nome) */
  siglas: Record<Id, string>
  /** tipo de etiqueta padrão (dá para trocar em cada impressão) */
  etiqueta: ModoEtiqueta
}

/** Padrão = como sempre foi (P-0001, L-0001, T-0001, V-0001): nada muda até alguém mudar. */
export const CODIGOS_PADRAO: RegrasCodigos = {
  compra: { modo: 'incremental', base: 'fornecedor', prefixo: 'P-', digitos: 4 },
  lote: { modo: 'incremental', prefixo: 'L-', digitos: 4 },
  triagem: { prefixo: 'T-', digitos: 4 },
  venda: { prefixo: 'V-', digitos: 4 },
  siglas: {},
  etiqueta: 'qr',
}

const ID_CONFIG = 'codigos'
/** letra do contador de cada sequência (os contadores "contador-P/L/T/V" já existiam) */
const LETRA = { compra: 'P', lote: 'L', triagem: 'T', venda: 'V' } as const
type Chave = keyof typeof LETRA

export async function lerCodigos(ctx: Ctx): Promise<RegrasCodigos> {
  const v = ((await ctx.repos.config.obter(ID_CONFIG))?.valor ?? {}) as Partial<RegrasCodigos>
  return {
    compra: { ...CODIGOS_PADRAO.compra, ...(v.compra ?? {}) },
    lote: { ...CODIGOS_PADRAO.lote, ...(v.lote ?? {}) },
    triagem: { ...CODIGOS_PADRAO.triagem, ...(v.triagem ?? {}) },
    venda: { ...CODIGOS_PADRAO.venda, ...(v.venda ?? {}) },
    siglas: { ...(v.siglas ?? {}) },
    etiqueta: v.etiqueta && MODOS_ETIQUETA.includes(v.etiqueta) ? v.etiqueta : CODIGOS_PADRAO.etiqueta,
  }
}

async function gravarCodigos(ctx: Ctx, valor: RegrasCodigos) {
  const r = await ctx.repos.config.obter(ID_CONFIG)
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: ID_CONFIG, valor }))
}

// ---------- texto ----------

/** Igualdade de códigos: sem espaços nas pontas e sem diferenciar maiúsculas ("m1 " = "M1"). */
export const normalizarCodigo = (c?: string) => (c ?? '').trim().toUpperCase()

export const formatarSequencia = (s: Sequencia, n: number) => `${s.prefixo}${String(n).padStart(Math.max(0, s.digitos), '0')}`

const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Código digitado: 1 a 30 caracteres, começa com letra ou número; aceita - + . / _ (sem espaço no meio). */
function validarFormato(c: string) {
  exigir(c, 'Digite o código.', 'codigo')
  exigir(c.length <= 30, 'Código longo demais (até 30 caracteres).', 'codigo')
  exigir(/^[\p{L}\p{N}][\p{L}\p{N}\-+./_]*$/u.test(c), 'Use só letras, números e - + . / _ (sem espaço).', 'codigo')
}

function validarSequencia(s: Sequencia, nome: string) {
  exigir(typeof s.prefixo === 'string' && s.prefixo.length <= 10, `${nome}: prefixo de até 10 caracteres.`)
  exigir(!s.prefixo || /^[\p{L}\p{N}\-+./_]+$/u.test(s.prefixo), `${nome}: no prefixo use só letras, números e - + . / _.`)
  exigir(Number.isInteger(s.digitos) && s.digitos >= 0 && s.digitos <= 8, `${nome}: casas de 0 a 8.`)
}

// ---------- quem já usa um código ----------

export interface CodigoExistente {
  id: Id
  codigo: string
  resumo: string
  tela: 'lote' | 'pedido'
  /** o código procurado é um código ANTERIOR deste registro */
  anterior?: boolean
}

/** id de quem acabou de ganhar um código NESTE comando (o registro ainda não foi gravado quando o código sai) */
const RECEM = '(código dado neste comando)'
type Indice = Map<string, { id: Id; anterior: boolean }>
/**
 * Índice dos códigos, montado UMA vez por comando (ctx) e mantido em dia pelos códigos que saem daqui (marcar).
 * Antes era refeito (listar + copiar todos os itens) a cada código conferido: o custo crescia com o quadrado do estoque.
 */
const CACHE = new WeakMap<Ctx, Partial<Record<TipoCodigo, Indice>>>()

async function montarIndice(ctx: Ctx, tipo: TipoCodigo): Promise<Indice> {
  const m: Indice = new Map()
  const por = (id: Id, atual: string | undefined, anteriores: string[] | undefined) => {
    for (const c of anteriores ?? []) if (!m.has(normalizarCodigo(c))) m.set(normalizarCodigo(c), { id, anterior: true })
    if (atual) m.set(normalizarCodigo(atual), { id, anterior: false })
  }
  if (tipo === 'lote') for (const i of await ctx.repos.itens.listar()) por(i.id, i.codigo, i.codigosAnteriores)
  else for (const t of await ctx.repos.transacoes.listar({ tipo: 'compra' })) por(t.id, t.codigo, t.codigosAnteriores)
  return m
}

/** Todos os códigos (atuais e anteriores) de um tipo → o registro que usa. Não mexa no mapa devolvido. */
async function indice(ctx: Ctx, tipo: TipoCodigo, refazer = false): Promise<Indice> {
  let c = CACHE.get(ctx)
  if (!c) CACHE.set(ctx, (c = {}))
  if (refazer || !c[tipo]) c[tipo] = await montarIndice(ctx, tipo)
  return c[tipo]!
}

/** o código acabou de ser dado (a registro novo = RECEM, ou trocado num registro existente) */
function marcar(ctx: Ctx, tipo: TipoCodigo, codigo: string, id: Id = RECEM) {
  CACHE.get(ctx)?.[tipo]?.set(normalizarCodigo(codigo), { id, anterior: false })
  return codigo
}

async function descrever(ctx: Ctx, tipo: TipoCodigo, id: Id, anterior: boolean, procurado: string): Promise<CodigoExistente | undefined> {
  if (tipo === 'lote') {
    const i = await ctx.repos.itens.obter(id)
    if (!i) return undefined
    const codigo = i.codigo ?? procurado
    const quando = i.saldo > 0 ? `no estoque desde ${dataBR(i.criadoEm)}` : `sem saldo; entrou em ${dataBR(i.criadoEm)}`
    return { id, codigo, tela: 'lote', anterior, resumo: `${codigo}${anterior ? ` (antes ${procurado})` : ''} · ${i.nome} (${quando})` }
  }
  const t = await ctx.repos.transacoes.obter(id)
  if (!t) return undefined
  const pessoa = t.pessoaId ? (await ctx.repos.pessoas.obter(t.pessoaId))?.nome : undefined
  const codigo = t.codigo ?? procurado
  return { id, codigo, tela: 'pedido', anterior, resumo: `compra ${codigo}${anterior ? ` (antes ${procurado})` : ''} · ${pessoa ?? 'sem fornecedor'} · ${dataBR(t.data)}` }
}

/** Quem já usa este código (atual ou anterior), fora o próprio registro (ignorarId). */
export async function procurarCodigo(ctx: Ctx, tipo: TipoCodigo, codigo: string, ignorarId?: Id): Promise<CodigoExistente | undefined> {
  const k = normalizarCodigo(codigo)
  if (!k) return undefined
  let achou = (await indice(ctx, tipo)).get(k)
  // código dado agora mesmo neste comando: relê o banco para saber de quem é (o registro já foi gravado)
  if (achou?.id === RECEM) achou = (await indice(ctx, tipo, true)).get(k) ?? achou
  if (!achou || achou.id === ignorarId) return undefined
  if (achou.id === RECEM) return { id: '', codigo: codigo.trim(), tela: tipo === 'lote' ? 'lote' : 'pedido', resumo: `${tipo === 'lote' ? 'lote' : 'compra'} ${codigo.trim()} (criado agora)` }
  return descrever(ctx, tipo, achou.id, achou.anterior, codigo.trim())
}

/** Recusa código inválido ou que já existe, dizendo qual registro usa. Devolve o código limpo (sem espaços nas pontas). */
export async function exigirCodigoLivre(ctx: Ctx, tipo: TipoCodigo, codigo: string, ignorarId?: Id): Promise<string> {
  const c = (codigo ?? '').trim()
  validarFormato(c)
  const existe = await procurarCodigo(ctx, tipo, c, ignorarId)
  exigir(!existe, `Já existe: ${existe?.resumo}`, 'codigo')
  // troca de código de um registro que já existe: o código passa a ser dele já neste comando
  if (ignorarId) marcar(ctx, tipo, c, ignorarId)
  return c
}

/** Vários códigos digitados de uma vez (ex.: as partes de uma separação): sem repetir entre si e livres. */
export async function exigirCodigosLivres(ctx: Ctx, tipo: TipoCodigo, codigos: (string | undefined)[]) {
  const vistos = new Set<string>()
  const limpos: (string | undefined)[] = []
  for (const c of codigos) {
    if (!c?.trim()) {
      limpos.push(undefined)
      continue
    }
    const k = normalizarCodigo(c)
    exigir(!vistos.has(k), `O código ${c.trim()} foi digitado duas vezes.`, 'codigo')
    vistos.add(k)
    limpos.push(await exigirCodigoLivre(ctx, tipo, c))
  }
  return { limpos, reservados: vistos }
}

// ---------- sequências ----------

async function contador(ctx: Ctx, letra: string) {
  return ((await ctx.repos.config.obter(`contador-${letra}`))?.valor as number | undefined) ?? 0
}

async function gravarContador(ctx: Ctx, letra: string, n: number) {
  const id = `contador-${letra}`
  const r = await ctx.repos.config.obter(id)
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor: n }) : novo(ctx, { id, valor: n }))
}

/** Próximos N números da sequência pulando os códigos já usados (sem gastar: só para mostrar). */
function proximosLivres(s: Sequencia, desde: number, usados: Set<string>, quantos: number) {
  const r: { n: number; codigo: string }[] = []
  for (let n = desde + 1; r.length < quantos; n++) {
    const c = formatarSequencia(s, n)
    if (!usados.has(normalizarCodigo(c))) r.push({ n, codigo: c })
  }
  return r
}

/**
 * Próximo código INCREMENTAL de uma sequência (compra, lote, triagem, venda). Compra e lote pulam o que já existe
 * (ex.: alguém digitou "5" à mão). Mudar o prefixo não zera a contagem.
 */
export async function proximoSequencial(ctx: Ctx, chave: Chave, reservados?: Set<string>): Promise<string> {
  const regras = await lerCodigos(ctx)
  const letra = LETRA[chave]
  const usados = chave === 'compra' || chave === 'lote' ? new Set([...(await indice(ctx, chave)).keys(), ...(reservados ?? [])]) : new Set<string>()
  const [{ n, codigo }] = proximosLivres(regras[chave], await contador(ctx, letra), usados, 1)
  await gravarContador(ctx, letra, n)
  return chave === 'compra' || chave === 'lote' ? marcar(ctx, chave, codigo) : codigo
}

/** Próximo número "base + N" ("M" → M3; "M1-" → M1-4), olhando os códigos já usados. */
function proximoComBase(base: string, usados: Iterable<string>, quantos = 1) {
  const b = normalizarCodigo(base)
  let max = 0
  for (const u of usados) if (u.startsWith(b) && /^\d+$/.test(u.slice(b.length))) max = Math.max(max, Number(u.slice(b.length)))
  return Array.from({ length: quantos }, (_, k) => `${base}${max + 1 + k}`)
}

/** Sufixo das partes de uma separação: depois de número vem letra (M1-1 → M1-1a); depois de letra, número (M1-1a → M1-1a1). */
function sufixos(pai: string, usados: Set<string>, quantos: number) {
  const letra = /\d$/.test(pai)
  const nome = (k: number) => {
    if (!letra) return String(k + 1)
    let s = ''
    for (let x = k + 1; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(97 + ((x - 1) % 26)) + s
    return s
  }
  const r: string[] = []
  for (let k = 0; r.length < quantos; k++) {
    const c = `${pai}${nome(k)}`
    if (!usados.has(normalizarCodigo(c))) r.push(c)
  }
  return r
}

// ---------- siglas (modo por pessoa) ----------

const PAPEIS_SIGLA = new Set(['fornecedor', 'doadora', 'funcionario', 'profissional', 'socio'])

/** Sugestões de sigla pelo nome: Maria Rosa → M, MR, MA, MAR… */
export function siglasSugeridas(nome: string): string[] {
  const ps = semAcento(nome).toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean)
  if (!ps.length) return ['X']
  const [a] = ps
  const ult = ps.length > 1 ? ps[ps.length - 1] : ''
  const c = [a[0], ult && a[0] + ult[0], a.slice(0, 2), ps.length > 2 ? a[0] + ps[1][0] : '', a.slice(0, 3), ult && a[0] + ult.slice(0, 2), ult && a.slice(0, 2) + ult[0]]
  return [...new Set(c.filter((x): x is string => !!x && /^[A-Z]{1,5}$/.test(x)))]
}

function primeiraLivre(nome: string, usadas: Set<string>) {
  for (const s of siglasSugeridas(nome)) if (!usadas.has(s)) return s
  const a = siglasSugeridas(nome)[0][0]
  for (let k = 0; k < 26 * 26; k++) {
    const s = a + String.fromCharCode(65 + Math.floor(k / 26)) + String.fromCharCode(65 + (k % 26))
    if (!usadas.has(s)) return s
  }
  return a
}

/**
 * Sigla de cada pessoa que compra/vende cabelo (fornecedores e equipe) e de quem já aparece numa compra:
 * a guardada ou, sem ela, a primeira sugestão livre (pela ordem de cadastro). Nunca duas pessoas com a mesma.
 */
export async function siglasEfetivas(ctx: Ctx, regras?: RegrasCodigos) {
  const r = regras ?? (await lerCodigos(ctx))
  const compras = await ctx.repos.transacoes.listar({ tipo: 'compra' })
  const nas = new Map<Id, number>()
  for (const t of compras) for (const pid of new Set([t.pessoaId, t.compradorId])) if (pid) nas.set(pid, (nas.get(pid) ?? 0) + 1)
  const pessoas = (await ctx.repos.pessoas.listar())
    .filter((p) => !p.apagadoEm && (p.papeis.some((x) => PAPEIS_SIGLA.has(x)) || nas.has(p.id) || r.siglas[p.id]))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : a.id < b.id ? -1 : 1))
  const mapa = new Map<Id, { sigla: string; padrao: boolean }>()
  const usadas = new Set<string>()
  for (const p of pessoas) {
    const s = r.siglas[p.id]
    if (s && !usadas.has(s)) (mapa.set(p.id, { sigla: s, padrao: false }), usadas.add(s))
  }
  for (const p of pessoas)
    if (!mapa.has(p.id)) {
      const s = primeiraLivre(p.nome, usadas)
      mapa.set(p.id, { sigla: s, padrao: true })
      usadas.add(s)
    }
  return { mapa, pessoas, nas }
}

/** pessoaId → sigla (para a busca: "M" acha as compras e os lotes da Maria). */
export async function siglasPorPessoa(ctx: Ctx) {
  const { mapa } = await siglasEfetivas(ctx)
  return new Map([...mapa].map(([id, x]) => [id, x.sigla]))
}

/** Sigla de uma pessoa (a sugerida é guardada na primeira compra: o código dela não muda depois). */
async function siglaFixa(ctx: Ctx, regras: RegrasCodigos, pessoaId: Id, guardar: boolean) {
  const { mapa } = await siglasEfetivas(ctx, regras)
  let x = mapa.get(pessoaId)
  if (!x) {
    const p = await ctx.repos.pessoas.obter(pessoaId)
    if (!p) return undefined
    x = { sigla: primeiraLivre(p.nome, new Set([...mapa.values()].map((v) => v.sigla))), padrao: true }
  }
  if (guardar && x.padrao) await gravarCodigos(ctx, { ...regras, siglas: { ...regras.siglas, [pessoaId]: x.sigla } })
  return x.sigla
}

// ---------- gerar o código de uma compra / de um lote ----------

export interface ParamsCompra {
  pessoaId?: Id
  compradorId?: Id
  /** tipo de código escolhido NESTA compra (vazio = o da regra de Configurações › Códigos) */
  modoCodigo?: ModoCompra
}

/** Modo que vale para esta compra: o escolhido na tela ou o da regra. */
const modoDe = (r: RegrasCodigos, p: ParamsCompra): ModoCompra => (p.modoCodigo && MODOS_COMPRA.includes(p.modoCodigo) ? p.modoCodigo : r.compra.modo)

/** De quem é a sequência (modo por pessoa): o fornecedor ou quem comprou. */
const donoDaSequencia = (r: RegrasCodigos, p: ParamsCompra) => (r.compra.base === 'comprador' ? p.compradorId : p.pessoaId)

/** Próximos códigos de compra (sem gastar), para mostrar e sugerir. */
async function sugestoesCompra(ctx: Ctx, r: RegrasCodigos, p: ParamsCompra, quantos: number): Promise<string[]> {
  const usados = await indice(ctx, 'compra')
  const dono = donoDaSequencia(r, p)
  if (modoDe(r, p) === 'porPessoa' && dono) {
    const sigla = (await siglasEfetivas(ctx, r)).mapa.get(dono)?.sigla ?? (await siglaFixa(ctx, r, dono, false))
    if (sigla) return proximoComBase(sigla, usados.keys(), quantos)
  }
  return proximosLivres(r.compra, await contador(ctx, LETRA.compra), new Set(usados.keys()), quantos).map((x) => x.codigo)
}

/**
 * Código da compra nova: o digitado (conferido) ou o da regra (incremental; por pessoa M1, M2…; manual sugere o
 * incremental). modoCodigo troca a regra só nesta compra (continua único); com ele, incremental e por pessoa ignoram
 * um código digitado (vale o que a tela mostrou).
 */
export async function codigoNovaCompra(ctx: Ctx, d: ParamsCompra & { codigo?: string }): Promise<string> {
  const r = await lerCodigos(ctx)
  const modo = modoDe(r, d)
  if (d.codigo?.trim() && (!d.modoCodigo || modo === 'manual')) return marcar(ctx, 'compra', await exigirCodigoLivre(ctx, 'compra', d.codigo))
  const dono = donoDaSequencia(r, d)
  if (modo === 'porPessoa' && dono) {
    const sigla = await siglaFixa(ctx, r, dono, true)
    if (sigla) return marcar(ctx, 'compra', proximoComBase(sigla, (await indice(ctx, 'compra')).keys())[0])
  }
  return proximoSequencial(ctx, 'compra')
}

export interface ParamsLote {
  /** lote que nasce de uma compra */
  compraId?: Id
  /** lote que nasce de uma separação (filho deste) */
  paiId?: Id
  /** lote que nasce da união de lotes: as compras de onde vem */
  comprasUnificadas?: Id[]
}

async function baseDoLote(ctx: Ctx, r: RegrasCodigos, p: ParamsLote): Promise<{ tipo: 'filho' | 'base'; base: string } | undefined> {
  if (r.lote.modo !== 'daCompra') return undefined
  if (p.paiId) {
    const pai = await ctx.repos.itens.obter(p.paiId)
    return pai?.codigo ? { tipo: 'filho', base: pai.codigo } : undefined
  }
  const ids = p.compraId ? [p.compraId] : [...new Set(p.comprasUnificadas ?? [])]
  // juntado de muitas compras (mais de 3) fica comprido demais: volta para o incremental
  if (!ids.length || ids.length > 3) return undefined
  const codigos: string[] = []
  for (const id of ids) {
    const c = (await ctx.repos.transacoes.obter(id))?.codigo
    if (!c) return undefined
    codigos.push(c)
  }
  return { tipo: 'base', base: `${codigos.join('+')}-` }
}

async function sugestoesLote(ctx: Ctx, r: RegrasCodigos, p: ParamsLote, quantos: number, reservados?: Set<string>) {
  const usados = new Set([...(await indice(ctx, 'lote')).keys(), ...(reservados ?? [])])
  const b = await baseDoLote(ctx, r, p)
  if (b?.tipo === 'filho') return sufixos(b.base, usados, quantos)
  if (b) return proximoComBase(b.base, usados, quantos)
  return proximosLivres(r.lote, await contador(ctx, LETRA.lote), usados, quantos).map((x) => x.codigo)
}

/**
 * Código do lote novo: o digitado (conferido) ou o da regra. Da compra: M1-1, M1-2…; parte de uma separação: código do
 * lote-mãe + letra (M1-1a, M1-1b); juntado: compras unidas por "+" e a sequência (M1+C3-1); sem compra ou mais de
 * 3 compras: incremental. reservados = códigos digitados para outros lotes do mesmo passo (o automático não pega).
 */
export async function codigoNovoLote(ctx: Ctx, d: ParamsLote & { codigo?: string; reservados?: Set<string> }): Promise<string> {
  if (d.codigo?.trim()) return marcar(ctx, 'lote', await exigirCodigoLivre(ctx, 'lote', d.codigo))
  const r = await lerCodigos(ctx)
  if (await baseDoLote(ctx, r, d)) return marcar(ctx, 'lote', (await sugestoesLote(ctx, r, d, 1, d.reservados))[0])
  return proximoSequencial(ctx, 'lote', d.reservados)
}

// ---------- comandos ----------

const MODOS_COMPRA: ModoCompra[] = ['incremental', 'porPessoa', 'manual']
const MODOS_LOTE: ModoLote[] = ['incremental', 'daCompra', 'manual']

function textoRegra(r: RegrasCodigos, k: 'compra' | 'lote' | 'triagem' | 'venda') {
  const s = r[k]
  const seq = `${s.prefixo}${'#'.repeat(Math.max(1, s.digitos))}`
  if (k === 'compra') return r.compra.modo === 'porPessoa' ? `por pessoa (${r.compra.base})` : r.compra.modo === 'manual' ? `manual (sugere ${seq})` : `incremental ${seq}`
  if (k === 'lote') return r.lote.modo === 'daCompra' ? 'da compra' : r.lote.modo === 'manual' ? `manual (sugere ${seq})` : `incremental ${seq}`
  return seq
}

/** Muda como compras e lotes são identificados (admin). Os códigos que já existem não mudam. */
export async function salvarCodigos(ctx: Ctx, d: { compra?: Partial<RegrasCodigos['compra']>; lote?: Partial<RegrasCodigos['lote']>; triagem?: Partial<Sequencia>; venda?: Partial<Sequencia>; etiqueta?: ModoEtiqueta }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador muda os códigos.')
  const antes = await lerCodigos(ctx)
  const depois: RegrasCodigos = {
    ...antes,
    compra: { ...antes.compra, ...(d.compra ?? {}) },
    lote: { ...antes.lote, ...(d.lote ?? {}) },
    triagem: { ...antes.triagem, ...(d.triagem ?? {}) },
    venda: { ...antes.venda, ...(d.venda ?? {}) },
    etiqueta: d.etiqueta ?? antes.etiqueta,
  }
  exigir(MODOS_ETIQUETA.includes(depois.etiqueta), 'Tipo de etiqueta inválido.')
  exigir(MODOS_COMPRA.includes(depois.compra.modo), 'Modo de código da compra inválido.')
  exigir(depois.compra.base === 'fornecedor' || depois.compra.base === 'comprador', 'Base inválida: fornecedor ou quem comprou.')
  exigir(MODOS_LOTE.includes(depois.lote.modo), 'Modo de código do lote inválido.')
  validarSequencia(depois.compra, 'Compra')
  validarSequencia(depois.lote, 'Lote')
  validarSequencia(depois.triagem, 'Triagem')
  validarSequencia(depois.venda, 'Venda')
  const mudou = (['compra', 'lote', 'triagem', 'venda'] as const).filter((k) => textoRegra(antes, k) !== textoRegra(depois, k)).map((k) => `${k[0].toUpperCase()}${k.slice(1)}: ${textoRegra(antes, k)} → ${textoRegra(depois, k)}`)
  if (antes.etiqueta !== depois.etiqueta) mudou.push(`Etiqueta: ${antes.etiqueta} → ${depois.etiqueta}`)
  exigir(mudou.length, 'Nada mudou.')
  await gravarCodigos(ctx, depois)
  await auditar(ctx, 'salvarCodigos', ID_CONFIG, mudou.join('; '))
  return { id: ID_CONFIG }
}

/** Sigla de uma pessoa (admin): 1 a 5 letras, única. Vazia = volta para a sugerida. Os códigos já dados não mudam. */
export async function salvarSigla(ctx: Ctx, d: { pessoaId: Id; sigla: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador muda as siglas.')
  const p = await ctx.repos.pessoas.obter(d.pessoaId)
  exigir(p, 'Pessoa não encontrada.')
  const regras = await lerCodigos(ctx)
  const { mapa } = await siglasEfetivas(ctx, regras)
  const antes = mapa.get(p.id)?.sigla ?? '—'
  const sigla = semAcento(d.sigla ?? '').trim().toUpperCase()
  exigir(sigla ? regras.siglas[p.id] !== sigla : !!regras.siglas[p.id], 'Nada mudou.')
  const siglas = { ...regras.siglas }
  if (!sigla) delete siglas[p.id]
  else {
    exigir(/^[A-Z]{1,5}$/.test(sigla), 'Sigla: de 1 a 5 letras (sem número: o número é a sequência).', 'sigla')
    const dono = [...mapa].find(([id, x]) => id !== p.id && x.sigla === sigla)
    exigir(!dono, `A sigla ${sigla} já é de ${(await ctx.repos.pessoas.obter(dono?.[0] ?? ''))?.nome ?? 'outra pessoa'}. Sugestões: ${siglasSugeridas(p.nome).filter((s) => ![...mapa].some(([id, x]) => id !== p.id && x.sigla === s)).slice(0, 3).join(', ') || '—'}.`, 'sigla')
    siglas[p.id] = sigla
  }
  await gravarCodigos(ctx, { ...regras, siglas })
  const depois = (await siglasEfetivas(ctx)).mapa.get(p.id)?.sigla ?? '—'
  await auditar(ctx, 'salvarSigla', p.id, `${p.nome}: sigla ${antes} → ${depois}`)
  return { id: p.id, sigla: depois }
}

/** Troca o código de uma compra (admin): log com antes → depois; o antigo continua achando a compra na busca. */
export async function trocarCodigoCompra(ctx: Ctx, d: { id: Id; codigo: string; motivo?: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador troca códigos.')
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
  const novoCodigo = await exigirCodigoLivre(ctx, 'compra', d.codigo, t.id)
  exigir(novoCodigo !== t.codigo, 'Nada mudou.')
  await ctx.repos.transacoes.salvar(tocar(ctx, { ...t, codigo: novoCodigo, codigosAnteriores: anteriores(t, novoCodigo) }))
  await auditar(ctx, 'trocarCodigoCompra', t.id, `${t.codigo ?? '—'} → ${novoCodigo}${d.motivo?.trim() ? ` · ${d.motivo.trim()}` : ''}`, [t.pessoaId!])
  return { id: t.id, codigo: novoCodigo }
}

/** Troca o código de um lote (admin): log com antes → depois; o antigo continua achando o lote na busca. */
export async function trocarCodigoLote(ctx: Ctx, d: { id: Id; codigo: string; motivo?: string }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador troca códigos.')
  const i = await ctx.repos.itens.obter(d.id)
  exigir(i, 'Lote não encontrado.')
  const novoCodigo = await exigirCodigoLivre(ctx, 'lote', d.codigo, i.id)
  exigir(novoCodigo !== i.codigo, 'Nada mudou.')
  await ctx.repos.itens.salvar(tocar(ctx, { ...i, codigo: novoCodigo, codigosAnteriores: anteriores(i, novoCodigo) }))
  await auditar(ctx, 'trocarCodigoLote', i.id, `${i.codigo ?? '—'} → ${novoCodigo}${d.motivo?.trim() ? ` · ${d.motivo.trim()}` : ''}`)
  return { id: i.id, codigo: novoCodigo }
}

function anteriores(r: Pick<Item | Transacao, 'codigo' | 'codigosAnteriores'>, novoCodigo: string) {
  const k = normalizarCodigo(novoCodigo)
  const lista = [...(r.codigosAnteriores ?? []), ...(r.codigo ? [r.codigo] : [])].filter((c) => normalizarCodigo(c) !== k)
  return [...new Map(lista.map((c) => [normalizarCodigo(c), c])).values()]
}

// ---------- consultas ----------

/**
 * Tela Configurações › Códigos: a regra de cada tipo, os PRÓXIMOS 3 códigos (com o rascunho ainda não salvo, para a
 * prévia ao vivo) e a tabela de siglas por pessoa (com o aviso de sigla repetida).
 */
export async function codigos(ctx: Ctx, p: { rascunho?: Partial<Omit<RegrasCodigos, 'siglas'>>; pessoaId?: Id } = {}) {
  const salvo = await lerCodigos(ctx)
  const r: RegrasCodigos = {
    ...salvo,
    compra: { ...salvo.compra, ...(p.rascunho?.compra ?? {}) },
    lote: { ...salvo.lote, ...(p.rascunho?.lote ?? {}) },
    triagem: { ...salvo.triagem, ...(p.rascunho?.triagem ?? {}) },
    venda: { ...salvo.venda, ...(p.rascunho?.venda ?? {}) },
  }
  const ok = (s: Sequencia) => typeof s.prefixo === 'string' && Number.isInteger(s.digitos) && s.digitos >= 0 && s.digitos <= 8
  const { mapa, pessoas, nas } = await siglasEfetivas(ctx, salvo)
  const compras = await ctx.repos.transacoes.listar({ tipo: 'compra' })
  // exemplo da prévia "por pessoa": a escolhida ou quem mais aparece nas compras (pela base escolhida)
  const contagem = new Map<Id, number>()
  for (const t of compras) {
    const dono = donoDaSequencia(r, t)
    if (dono) contagem.set(dono, (contagem.get(dono) ?? 0) + 1)
  }
  const exemploId = p.pessoaId ?? [...contagem].sort((a, b) => b[1] - a[1])[0]?.[0] ?? pessoas[0]?.id
  const exemplo = exemploId ? pessoas.find((x) => x.id === exemploId) ?? (await ctx.repos.pessoas.obter(exemploId)) : undefined
  const params: ParamsCompra = r.compra.base === 'comprador' ? { compradorId: exemplo?.id } : { pessoaId: exemplo?.id }
  const ultimaCompra = [...compras].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))[0]
  const previaCompra = ok(r.compra) ? await sugestoesCompra(ctx, r, params, 3) : []
  // lote da compra: exemplo com a última compra (ou com o próximo código de compra, se não houver nenhuma)
  let previaLote: string[] = []
  let loteSeparado: string[] = []
  if (ok(r.lote)) {
    if (r.lote.modo === 'daCompra') {
      const baseCompra = ultimaCompra?.codigo ?? previaCompra[0] ?? '1'
      const usados = new Set((await indice(ctx, 'lote')).keys())
      previaLote = ultimaCompra?.codigo ? await sugestoesLote(ctx, r, { compraId: ultimaCompra.id }, 3) : proximoComBase(`${baseCompra}-`, usados, 3)
      loteSeparado = sufixos(previaLote[0], usados, 2)
    } else {
      previaLote = await sugestoesLote(ctx, r, {}, 3)
      loteSeparado = sufixos(previaLote[0], new Set(), 2)
    }
  }
  const seq = async (k: 'triagem' | 'venda') => (ok(r[k]) ? proximosLivres(r[k], await contador(ctx, LETRA[k]), new Set(), 3).map((x) => x.codigo) : [])
  return {
    regras: salvo,
    previa: {
      compra: previaCompra,
      compraDe: r.compra.modo === 'porPessoa' ? exemplo?.nome : undefined,
      lote: previaLote,
      loteCompra: r.lote.modo === 'daCompra' ? ultimaCompra?.codigo ?? previaCompra[0] : undefined,
      loteSeparado,
      triagem: await seq('triagem'),
      venda: await seq('venda'),
    },
    pessoas: pessoas.map((x: Pessoa) => ({
      id: x.id,
      nome: x.nome,
      papeis: x.papeis,
      sigla: mapa.get(x.id)?.sigla ?? '',
      padrao: !!mapa.get(x.id)?.padrao,
      compras: nas.get(x.id) ?? 0,
      sugestoes: siglasSugeridas(x.nome).slice(0, 4),
    })),
  }
}

/** Tipo de etiqueta padrão da empresa (para a tela de imprimir; qualquer perfil que imprime etiqueta lê). */
export async function modoEtiqueta(ctx: Ctx, _p: object = {}): Promise<ModoEtiqueta> {
  return (await lerCodigos(ctx)).etiqueta
}

/**
 * Validação ao vivo do formulário: o código está livre? Se não, quem já usa (com a tela para abrir). Devolve também a
 * sugestão da regra para aquele contexto (fornecedor/quem comprou, compra ou lote-mãe).
 */
export async function codigoDisponivel(
  ctx: Ctx,
  p: { tipo: TipoCodigo; codigo?: string; ignorarId?: Id; posicao?: number } & ParamsCompra & ParamsLote,
): Promise<{ livre: boolean; invalido?: string; existe?: CodigoExistente; sugestao: string }> {
  const r = await lerCodigos(ctx)
  // posicao: o 2º, 3º… lote do mesmo passo (as partes de uma separação) mostra a 2ª, 3ª… sugestão
  const k = Math.max(0, Math.min(50, Math.floor(p.posicao ?? 0)))
  const sugestao = (p.tipo === 'compra' ? await sugestoesCompra(ctx, r, p, k + 1) : await sugestoesLote(ctx, r, p, k + 1))[k] ?? ''
  const c = (p.codigo ?? '').trim()
  if (!c) return { livre: false, invalido: 'Digite o código.', sugestao }
  try {
    validarFormato(c)
  } catch (e) {
    return { livre: false, invalido: (e as Error).message, sugestao }
  }
  const existe = await procurarCodigo(ctx, p.tipo, c, p.ignorarId)
  return existe ? { livre: false, existe, sugestao } : { livre: true, sugestao }
}
