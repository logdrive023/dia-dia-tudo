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
  if (existente) {
    // guarda a versão anterior na auditoria (dá para ver como era a tabela em cada data)
    await auditar(ctx, 'tabelaPrecoAnterior', existente.id, JSON.stringify({ versao: existente.versao, linhas: existente.linhas, colunas: existente.colunas, valores: existente.valores }))
    await ctx.repos.tabelasPreco.salvar(tocar(ctx, { ...existente, ...dados }))
  } else await ctx.repos.tabelasPreco.salvar(novo<TabelaPreco>(ctx, { id: d.id, ...dados }))
  await auditar(ctx, 'salvarTabelaPreco', d.id, dados.nome)
  return { id: d.id }
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

/** Versões anteriores de uma tabela (mais nova primeiro). */
export async function historicoTabela(ctx: Ctx, p: { id: Id }) {
  const regs = await ctx.repos.auditoria.listar({ alvoId: p.id })
  return regs
    .filter((r) => r.acao === 'tabelaPrecoAnterior')
    .map((r) => ({ em: r.criadoEm, ...(JSON.parse(r.resumo) as Pick<TabelaPreco, 'versao' | 'linhas' | 'colunas' | 'valores'>) }))
    .sort((a, b) => (a.em < b.em ? 1 : -1))
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
