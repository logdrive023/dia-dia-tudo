// TABELAS DE PREÇO (genéricas): medida × comprador → fator. Valor = quantidade × fator.
// Ex. do caderno: 40 cm · Iver · 3,5 → 2 kg (2.000 g) × 3,5 = Bs 7.000.

import { fatorValido, multiplicarFator, moeda as moedaDe } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import type { Id, TabelaPreco } from '../domain/tipos'
import { auditar, type Ctx, novo, tocar } from './contexto'

export function chaveCelula(linha: number, colunaId: string) {
  return `${linha}|${colunaId}`
}

/** Fator da célula; sem valor exato, usa a maior medida da tabela que não passa da pedida (65 cm → linha 60). */
export function fatorDaTabela(t: TabelaPreco, medida: number, colunaId: string): { fator?: string; linhaUsada?: number } {
  const linhas = [...t.linhas].sort((a, b) => b - a)
  for (const l of linhas) {
    if (l > medida) continue
    const f = t.valores[chaveCelula(l, colunaId)]
    if (f && fatorValido(f)) return { fator: f, linhaUsada: l }
    return { linhaUsada: l }
  }
  return {}
}

export async function salvarTabelaPreco(
  ctx: Ctx,
  d: {
    id: Id
    moduloId: string
    nome: string
    categoria?: string
    validaDesde?: string
    moeda: string
    unidadeMedida: string
    fatorPor: 'grama' | 'unidade'
    linhas: number[]
    colunas: { id: string; nome: string; pessoaId?: Id }[]
    valores: Record<string, string>
    /** nota da versão: o que mudou e por quê (ex.: "subiu 60–70 cm para a P.W.") */
    nota?: string
  },
) {
  exigir(d.nome?.trim(), 'Dê um nome à tabela.', 'nome')
  moedaDe(d.moeda)
  exigir(d.colunas.length > 0, 'A tabela precisa de pelo menos uma coluna (comprador).')
  exigir(new Set(d.colunas.map((c) => c.id)).size === d.colunas.length, 'Colunas repetidas.')
  exigir(d.colunas.every((c) => c.nome.trim()), 'Toda coluna precisa de nome.')
  const linhas = [...new Set(d.linhas)].sort((a, b) => a - b)
  exigir(linhas.length > 0 && linhas.every((l) => Number.isFinite(l) && l > 0 && l < 10000), 'Medidas inválidas.')
  const valores: Record<string, string> = {}
  for (const [k, v] of Object.entries(d.valores)) {
    const txt = String(v ?? '').trim()
    if (!txt) continue
    exigir(fatorValido(txt), `Valor inválido na tabela: "${txt}" (use números como 3,5).`)
    const [l, c] = k.split('|')
    if (linhas.includes(Number(l)) && d.colunas.some((x) => x.id === c)) valores[k] = txt.replace('.', ',')
  }
  const existente = await ctx.repos.tabelasPreco.obter(d.id)
  const dados = {
    moduloId: d.moduloId,
    nome: d.nome.trim(),
    categoria: d.categoria?.trim() || undefined,
    validaDesde: d.validaDesde || ctx.relogio.hoje(),
    moeda: d.moeda, unidadeMedida: d.unidadeMedida, fatorPor: d.fatorPor, linhas, colunas: d.colunas.map((c) => ({ ...c, nome: c.nome.trim() })), valores }
  const anterior = existente ? await versoesTabela(ctx, { id: existente.id }) : []
  if (existente) {
    const igual = JSON.stringify([existente.linhas, existente.colunas, existente.valores, existente.nome, existente.categoria]) === JSON.stringify([dados.linhas, dados.colunas, dados.valores, dados.nome, dados.categoria])
    exigir(!igual, 'Nada mudou na tabela.')
    // tabela antiga (antes das versões): a primeira versão vira a situação de antes
    if (!anterior.length) await gravarVersao(ctx, existente.id, 1, existente, 'Versão inicial', existente.atualizadoEm)
  }
  const numero = (anterior[0]?.numero ?? (existente ? 1 : 0)) + 1
  const salvo = existente ? tocar(ctx, { ...existente, ...dados }) : novo<TabelaPreco>(ctx, { id: d.id, ...dados })
  await ctx.repos.tabelasPreco.salvar(salvo)
  // PUBLICA uma versão nova a cada alteração (foto completa + quem + quando + nota)
  await gravarVersao(ctx, d.id, numero, salvo, d.nota?.trim() || (existente ? '' : 'Tabela criada'))
  await auditar(ctx, 'salvarTabelaPreco', d.id, `${dados.nome} · v${numero}${d.nota?.trim() ? ` · ${d.nota.trim()}` : ''}`)
  return { id: d.id, versao: numero }
}

/**
 * CARIMBO DA TABELA NA LINHA (venda e compra): no momento em que a linha nasce, guarda a VERSÃO da tabela que valia,
 * o nome da tabela e do comprador (coluna), o fator que a tabela dava e se o fator usado foi mudado à mão.
 * É o que faz o histórico mostrar o que REALMENTE aconteceu: publicar a v3 depois não muda a venda feita com a v2.
 */
export async function carimbarTabela(ctx: Ctx, campos: Record<string, unknown>, cache = new Map<Id, { t?: TabelaPreco; versao?: number }>()) {
  const id = campos.tabelaId as Id | undefined
  if (!id || campos.tabelaVersao !== undefined) return
  if (!cache.has(id)) {
    const t = await ctx.repos.tabelasPreco.obter(id)
    cache.set(id, { t, versao: t ? (await versoesTabela(ctx, { id }))[0]?.numero ?? 1 : undefined })
  }
  const { t, versao } = cache.get(id)!
  if (!t) return
  const colunaId = campos.colunaId as string | undefined
  const medida = Number(campos.medida ?? campos.comprimento)
  const daTabela = colunaId && Number.isFinite(medida) ? fatorDaTabela(t, medida, colunaId).fator : undefined
  const norm = (x: unknown) => String(x ?? '').trim().replace('.', ',')
  campos.tabelaVersao = versao
  campos.tabelaNome = t.nome
  if (colunaId) campos.colunaNome = t.colunas.find((c) => c.id === colunaId)?.nome
  if (daTabela) campos.fatorTabela = norm(daTabela)
  if (daTabela && campos.fator !== undefined && norm(campos.fator) !== norm(daTabela)) campos.fatorManual = true
}

// ---------- consultas ----------

export async function tabelasPreco(ctx: Ctx, p: { moduloId?: string } = {}) {
  const ts = await ctx.repos.tabelasPreco.listar(p.moduloId ? { moduloId: p.moduloId } : undefined)
  return ts.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Tabela que vale hoje para uma categoria (ex.: "Tinte"); sem categoria própria usa a geral. */
export async function tabelaVigente(ctx: Ctx, p: { moduloId: string; categoria?: string }) {
  const hoje = ctx.relogio.hoje()
  const ts = (await ctx.repos.tabelasPreco.listar({ moduloId: p.moduloId })).filter((t) => !t.validaDesde || t.validaDesde <= hoje)
  const escolher = (cat?: string) =>
    ts.filter((t) => (t.categoria ?? '') === (cat ?? '')).sort((a, b) => ((a.validaDesde ?? '') + a.atualizadoEm < (b.validaDesde ?? '') + b.atualizadoEm ? 1 : -1))[0]
  return (p.categoria ? escolher(p.categoria) : undefined) ?? escolher(undefined) ?? ts[0]
}

// ---------- versões ----------

export interface VersaoTabela {
  numero: number
  em: string
  por?: string
  nota: string
  nome: string
  categoria?: string
  validaDesde?: string
  linhas: number[]
  colunas: { id: string; nome: string; pessoaId?: Id }[]
  valores: Record<string, string>
}

async function gravarVersao(ctx: Ctx, id: Id, numero: number, t: Pick<TabelaPreco, 'nome' | 'categoria' | 'validaDesde' | 'linhas' | 'colunas' | 'valores'>, nota: string, em?: string) {
  const v: VersaoTabela = { numero, em: em ?? ctx.relogio.agora(), por: ctx.sessao.nome, nota, nome: t.nome, categoria: t.categoria, validaDesde: t.validaDesde, linhas: t.linhas, colunas: t.colunas, valores: t.valores }
  await auditar(ctx, 'tabelaPrecoVersao', id, JSON.stringify(v))
}

/** Todas as versões publicadas (mais nova primeiro). Lê também o formato antigo ("tabelaPrecoAnterior"). */
export async function versoesTabela(ctx: Ctx, p: { id: Id }): Promise<VersaoTabela[]> {
  const regs = await ctx.repos.auditoria.listar({ alvoId: p.id })
  const novas = regs.filter((r) => r.acao === 'tabelaPrecoVersao').map((r) => JSON.parse(r.resumo) as VersaoTabela)
  if (novas.length) return novas.sort((a, b) => b.numero - a.numero)
  const antigas = regs.filter((r) => r.acao === 'tabelaPrecoAnterior').sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  const t = await ctx.repos.tabelasPreco.obter(p.id)
  const lista: VersaoTabela[] = antigas.map((r, i) => ({ numero: i + 1, em: r.criadoEm, por: r.usuarioNome, nota: '', nome: t?.nome ?? '', ...(JSON.parse(r.resumo) as Pick<TabelaPreco, 'linhas' | 'colunas' | 'valores'>) }))
  if (t) lista.push({ numero: lista.length + 1, em: t.atualizadoEm, nota: '', nome: t.nome, categoria: t.categoria, validaDesde: t.validaDesde, linhas: t.linhas, colunas: t.colunas, valores: t.valores })
  return lista.sort((a, b) => b.numero - a.numero)
}

/** Compatível: versões anteriores (sem a atual). */
export async function historicoTabela(ctx: Ctx, p: { id: Id }) {
  return (await versoesTabela(ctx, p)).slice(1)
}

export interface DiferencaCelula {
  linha: number
  colunaId: string
  coluna: string
  antes?: string
  depois?: string
  /** variação em % (só quando os dois têm número) */
  pct?: number
}

/**
 * Compara duas versões: "era assim X, ficou Y". Devolve cada célula que mudou (subiu, desceu, entrou, saiu),
 * medidas e colunas que entraram/saíram, e um resumo.
 */
export async function compararVersoes(ctx: Ctx, p: { id: Id; de: number; para: number }) {
  const vs = await versoesTabela(ctx, { id: p.id })
  const a = vs.find((v) => v.numero === p.de)
  const b = vs.find((v) => v.numero === p.para)
  exigir(a && b, 'Versão não encontrada.')
  const num = (x?: string) => (x ? Number(x.replace(',', '.')) : undefined)
  const linhas = [...new Set([...a.linhas, ...b.linhas])].sort((x, y) => x - y)
  const colunas = [...b.colunas, ...a.colunas.filter((c) => !b.colunas.some((x) => x.id === c.id))]
  const celulas: DiferencaCelula[] = []
  for (const l of linhas)
    for (const c of colunas) {
      const k = `${l}|${c.id}`
      const antes = a.valores[k]
      const depois = b.valores[k]
      if ((antes ?? '') === (depois ?? '')) continue
      const x = num(antes)
      const y = num(depois)
      celulas.push({ linha: l, colunaId: c.id, coluna: c.nome, antes, depois, pct: x && y ? Math.round(((y - x) / x) * 1000) / 10 : undefined })
    }
  return {
    de: a,
    para: b,
    linhas,
    colunas,
    celulas,
    resumo: {
      mudaram: celulas.length,
      subiram: celulas.filter((c) => (c.pct ?? 0) > 0).length,
      desceram: celulas.filter((c) => (c.pct ?? 0) < 0).length,
      entraram: celulas.filter((c) => !c.antes).length,
      sairam: celulas.filter((c) => !c.depois).length,
      medidasNovas: b.linhas.filter((l) => !a.linhas.includes(l)),
      medidasRemovidas: a.linhas.filter((l) => !b.linhas.includes(l)),
      colunasNovas: b.colunas.filter((c) => !a.colunas.some((x) => x.id === c.id)).map((c) => c.nome),
      colunasRemovidas: a.colunas.filter((c) => !b.colunas.some((x) => x.id === c.id)).map((c) => c.nome),
    },
  }
}

/** Uma tabela com tudo para a tela dela: dados atuais, versões e onde foi usada (vendas/compras com essa tabela). */
export async function tabelaPreco(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.tabelasPreco.obter(p.id)
  exigir(t, 'Tabela não encontrada.')
  const versoes = await versoesTabela(ctx, p)
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const usuarios = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u.nome]))
  const usos = (await ctx.repos.transacoes.listar())
    .filter((x) => x.etapa !== 'cancelado' && x.linhas.some((l) => l.campos.tabelaId === t.id))
    .map((x) => {
      const ls = x.linhas.filter((l) => l.campos.tabelaId === t.id)
      // a VERSÃO que a linha usou: a guardada na linha (carimbo na hora da venda/compra). Venda antiga, de antes do
      // carimbo: a versão que valia na data (a mais nova publicada antes dela) — marcada como estimada
      const guardada = ls.map((l) => l.campos.tabelaVersao as number | undefined).find((v) => v !== undefined)
      const versao = guardada ?? versoes.find((v) => v.em <= x.criadoEm)?.numero ?? versoes[versoes.length - 1]?.numero
      const colunas = [...new Set(ls.map((l) => (l.campos.colunaNome as string | undefined) ?? t.colunas.find((c) => c.id === l.campos.colunaId)?.nome).filter((n): n is string => !!n))]
      // desconto das linhas desta tabela (a linha com desconto continua ligada à tabela, com o fator que usou)
      return {
        id: x.id, tipo: x.tipo, data: x.data, codigo: x.codigo, total: x.totalPrincipal, linhas: ls.length, versao, versaoEstimada: guardada === undefined, colunas,
        /** quem fez a venda/compra */
        responsavel: usuarios.get(x.criadoPor) ?? undefined,
        /** valor só das linhas desta tabela */
        valorTabela: ls.reduce((s, l) => s + l.totalPrincipal, 0),
        /** alguma linha com o fator mudado à mão (diferente do que a tabela dava) */
        manual: ls.some((l) => !!l.campos.fatorManual),
        desconto: ls.reduce((s, l) => s + (l.descontoPrincipal ?? 0), 0),
        pessoa: x.pessoaId ? pessoas.get(x.pessoaId) : undefined,
        gramas: ls.reduce((s, l) => s + l.quantidade, 0),
        // detalhe (aberto na própria lista): cada linha com medida, gramas × fator e valor
        detalhe: ls.map((l) => ({
          id: l.id, descricao: l.descricao, medida: l.campos.medida as number | string | undefined, gramas: l.quantidade,
          fator: l.campos.fator as number | string | undefined, fatorTabela: l.campos.fatorTabela as string | undefined, manual: !!l.campos.fatorManual,
          coluna: (l.campos.colunaNome as string | undefined) ?? t.colunas.find((c) => c.id === l.campos.colunaId)?.nome, total: l.totalPrincipal, desconto: l.descontoPrincipal,
        })),
      }
    })
    .sort((a, b) => (a.data < b.data ? 1 : -1))
  return {
    // a tela filtra (tipo, período, pessoa, versão, busca): vão até 300, os mais novos primeiro
    tabela: t, versoes, atual: versoes[0]?.numero ?? 1, usos: usos.slice(0, 300), totalUsos: usos.length,
    // para a lista ("usada em 8 vendas · 2 compras")
    totalVendas: usos.filter((u) => u.tipo !== 'compra').length,
    totalCompras: usos.filter((u) => u.tipo === 'compra').length,
  }
}

/** a versão em uso de cada tabela: { tabelaId: número } (o caixa mostra; a venda guarda a mesma ao fechar) */
export async function versoesEmUso(ctx: Ctx, _p: object = {}) {
  const r: Record<Id, number> = {}
  for (const t of await ctx.repos.tabelasPreco.listar()) r[t.id] = (await versoesTabela(ctx, { id: t.id }))[0]?.numero ?? 1
  return r
}

/**
 * A LISTA DAS TABELAS (tela Tabelas de preço): cada uma com a versão em uso (quando, quem, nota), a faixa de preço,
 * quantas vendas/compras usaram e a SITUAÇÃO: vigente (é a que vale hoje para a categoria dela) · agendada (vale
 * a partir de uma data que ainda não chegou) · substituída (outra mais nova da mesma categoria tomou o lugar).
 */
export async function listaTabelasPreco(ctx: Ctx, _p: object = {}) {
  const hoje = ctx.relogio.hoje()
  const ts = await ctx.repos.tabelasPreco.listar()
  const trans = (await ctx.repos.transacoes.listar()).filter((x) => x.etapa !== 'cancelado')
  const vigentes = new Set<Id>()
  for (const t of ts) {
    const v = await tabelaVigente(ctx, { moduloId: t.moduloId, categoria: t.categoria })
    if (v && (v.categoria ?? '') === (t.categoria ?? '')) vigentes.add(v.id)
  }
  const lista = []
  for (const t of ts) {
    const vs = await versoesTabela(ctx, { id: t.id })
    const usa = trans.filter((x) => x.linhas.some((l) => l.campos.tabelaId === t.id))
    const ns = Object.values(t.valores).filter((v) => fatorValido(v)).map((v) => Number(String(v).replace(',', '.')))
    const situacao: 'vigente' | 'agendada' | 'substituida' = t.validaDesde && t.validaDesde > hoje ? 'agendada' : vigentes.has(t.id) ? 'vigente' : 'substituida'
    lista.push({
      id: t.id, nome: t.nome, categoria: t.categoria, moeda: t.moeda, fatorPor: t.fatorPor, unidadeMedida: t.unidadeMedida, validaDesde: t.validaDesde,
      medidas: t.linhas.length, compradores: t.colunas.length, colunas: t.colunas.map((c) => c.nome),
      faixa: ns.length ? [Math.min(...ns), Math.max(...ns)] as [number, number] : undefined,
      medidaMin: Math.min(...t.linhas), medidaMax: Math.max(...t.linhas),
      versao: vs[0]?.numero ?? 1, versoes: vs.length, mudouEm: vs[0]?.em ?? t.atualizadoEm, por: vs[0]?.por, nota: vs[0]?.nota,
      vendas: usa.filter((x) => x.tipo !== 'compra').length, compras: usa.filter((x) => x.tipo === 'compra').length,
      situacao,
    })
  }
  // a geral (sem categoria) primeiro; depois por nome
  return lista.sort((a, b) => Number(!!a.categoria) - Number(!!b.categoria) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Calcula como no caderno: "40 | 3,5 × 2 kg = Bs 7.000". */
export async function calcularPreco(ctx: Ctx, p: { tabelaId: Id; colunaId: string; medida: number; quantidade: number; fator?: string }) {
  const t = await ctx.repos.tabelasPreco.obter(p.tabelaId)
  exigir(t, 'Tabela de preço não encontrada.')
  const daTabela = fatorDaTabela(t, p.medida, p.colunaId)
  const fator = p.fator?.trim() || daTabela.fator
  exigir(fator, `A tabela não tem valor para ${p.medida} ${t.unidadeMedida} em "${t.colunas.find((c) => c.id === p.colunaId)?.nome ?? p.colunaId}". Digite o fator.`)
  return { fator, linhaUsada: daTabela.linhaUsada, moeda: t.moeda, total: multiplicarFator(p.quantidade, fator, t.moeda) }
}
