// EDIÇÃO DA TABELA DE PREÇO (rascunho): funções puras usadas pela tela. Nada aqui grava — publicar continua sendo
// salvarTabelaPreco (cada publicação vira uma versão nova). Fatores sempre como texto com vírgula ("3,5").

import { fatorValido } from '../../core/domain/dinheiro'
import type { TabelaPreco } from '../../core/domain/tipos'

export type GradeEdicao = Pick<TabelaPreco, 'nome' | 'categoria' | 'validaDesde' | 'linhas' | 'colunas' | 'valores'>
export type Coluna = TabelaPreco['colunas'][number]

export const chave = (l: number, c: string) => `${l}|${c}`
export const numero = (x?: string) => (x ? Number(x.replace(',', '.')) : undefined)

/** "3.5" → "3,5"; "" → "" ; "abc" → "abc" (fica marcado como inválido). */
export function normalizarFator(txt: string): string {
  const s = txt.trim().replace(/\s/g, '')
  return fatorValido(s) ? s.replace('.', ',') : s
}

/** Número → texto de fator com no máximo 2 casas, sem zeros sobrando: 15.75 → "15,75"; 16.0 → "16". */
export function fatorTexto(x: number): string {
  return String(Math.round(x * 100) / 100).replace('.', ',')
}

/** Arredonda para o passo (0,5 → 15,75 vira 16). passo 0 = só 2 casas. */
export function arredondar(x: number, passo: number): number {
  if (!passo) return Math.round(x * 100) / 100
  return Math.round(Math.round(x / passo) * passo * 100) / 100
}

export function comValor<T extends GradeEdicao>(g: T, k: string, v: string): T {
  const valores = { ...g.valores }
  const txt = normalizarFator(v)
  if (txt) valores[k] = txt
  else delete valores[k]
  return { ...g, valores }
}

/** Chaves que um alvo cobre: tudo, uma faixa de medidas (de–até cm) ou um comprador. */
export type Alvo = { tipo: 'tudo' } | { tipo: 'medidas'; de: number; ate: number } | { tipo: 'coluna'; colunaId: string }

export function chavesDo(g: GradeEdicao, a: Alvo): string[] {
  const linhas = a.tipo === 'medidas' ? g.linhas.filter((l) => l >= Math.min(a.de, a.ate) && l <= Math.max(a.de, a.ate)) : g.linhas
  const colunas = a.tipo === 'coluna' ? g.colunas.filter((c) => c.id === a.colunaId) : g.colunas
  return linhas.flatMap((l) => colunas.map((c) => chave(l, c.id)))
}

/** +5% (ou −5%) nos preços preenchidos do alvo. Devolve a grade nova e quantos mudaram. */
export function ajustarPct<T extends GradeEdicao>(g: T, a: Alvo, pct: number, passo = 0): { grade: T; mudou: number } {
  const valores = { ...g.valores }
  let mudou = 0
  for (const k of chavesDo(g, a)) {
    const x = numero(valores[k])
    if (!x || !fatorValido(valores[k])) continue
    const y = arredondar(x * (1 + pct / 100), passo)
    if (y <= 0) continue
    const txt = fatorTexto(y)
    if (txt !== valores[k]) (valores[k] = txt), mudou++
  }
  return { grade: { ...g, valores }, mudou }
}

/** Copia os preços de um comprador para outro (só nos vazios, ou por cima de tudo). */
export function copiarColuna<T extends GradeEdicao>(g: T, de: string, para: string, soVazios = false): { grade: T; mudou: number } {
  const valores = { ...g.valores }
  let mudou = 0
  if (de === para) return { grade: g, mudou }
  for (const l of g.linhas) {
    const v = valores[chave(l, de)]
    const k = chave(l, para)
    if (soVazios && valores[k]) continue
    if ((valores[k] ?? '') === (v ?? '')) continue
    if (v) valores[k] = v
    else delete valores[k]
    mudou++
  }
  return { grade: { ...g, valores }, mudou }
}

/** Preenche as células vazias do alvo com um fator. */
export function preencherVazios<T extends GradeEdicao>(g: T, a: Alvo, valor: string): { grade: T; mudou: number } {
  const txt = normalizarFator(valor)
  if (!fatorValido(txt)) return { grade: g, mudou: 0 }
  const valores = { ...g.valores }
  let mudou = 0
  for (const k of chavesDo(g, a)) if (!valores[k]) (valores[k] = txt), mudou++
  return { grade: { ...g, valores }, mudou }
}

/** Adiciona medidas ("65" ou "65, 75 85"). Ignora as repetidas e as inválidas. */
export function adicionarMedidas<T extends GradeEdicao>(g: T, texto: string): { grade: T; novas: number[] } {
  const novas = texto.split(/[\s,;]+/).map((x) => Number(x.replace(',', '.'))).filter((x) => Number.isFinite(x) && x > 0 && x < 10000 && !g.linhas.includes(x))
  const unicas = [...new Set(novas)]
  return { grade: { ...g, linhas: [...g.linhas, ...unicas].sort((a, b) => a - b) }, novas: unicas }
}

export function tirarMedida<T extends GradeEdicao>(g: T, l: number): T {
  const valores = Object.fromEntries(Object.entries(g.valores).filter(([k]) => Number(k.split('|')[0]) !== l))
  return { ...g, linhas: g.linhas.filter((x) => x !== l), valores }
}

/** 60 → 62: os preços vão junto. Recusa (devolve undefined) se a medida nova já existe. */
export function trocarMedida<T extends GradeEdicao>(g: T, de: number, para: number): T | undefined {
  if (de === para) return g
  if (!(para > 0 && para < 10000) || g.linhas.includes(para)) return undefined
  const valores: Record<string, string> = {}
  for (const [k, v] of Object.entries(g.valores)) {
    const [l, c] = k.split('|')
    valores[Number(l) === de ? chave(para, c) : k] = v
  }
  return { ...g, linhas: g.linhas.map((x) => (x === de ? para : x)).sort((a, b) => a - b), valores }
}

export function adicionarColuna<T extends GradeEdicao>(g: T, c: Coluna): T {
  return { ...g, colunas: [...g.colunas, c] }
}

export function tirarColuna<T extends GradeEdicao>(g: T, id: string): T {
  const valores = Object.fromEntries(Object.entries(g.valores).filter(([k]) => k.split('|')[1] !== id))
  return { ...g, colunas: g.colunas.filter((c) => c.id !== id), valores }
}

export function moverColuna<T extends GradeEdicao>(g: T, id: string, passo: -1 | 1): T {
  const i = g.colunas.findIndex((c) => c.id === id)
  const j = i + passo
  if (i < 0 || j < 0 || j >= g.colunas.length) return g
  const colunas = [...g.colunas]
  ;[colunas[i], colunas[j]] = [colunas[j], colunas[i]]
  return { ...g, colunas }
}

export function precosDaMedida(g: GradeEdicao, l: number) {
  return g.colunas.filter((c) => g.valores[chave(l, c.id)]).length
}
export function precosDaColuna(g: GradeEdicao, id: string) {
  return g.linhas.filter((l) => g.valores[chave(l, id)]).length
}

/**
 * Quantas mudanças o rascunho tem em relação à versão publicada: cada preço mudado conta 1, cada medida ou
 * comprador que entrou/saiu/mudou conta 1, e nome/categoria/vale desde contam 1 cada.
 */
export function contarMudancas(base: GradeEdicao | undefined, r: GradeEdicao) {
  if (!base) return { precos: Object.keys(r.valores).length, estrutura: 1, total: Math.max(1, Object.keys(r.valores).length) }
  const ks = new Set([...Object.keys(base.valores), ...Object.keys(r.valores)])
  const precos = [...ks].filter((k) => (base.valores[k] ?? '') !== (r.valores[k] ?? '')).length
  let estrutura = 0
  estrutura += r.linhas.filter((l) => !base.linhas.includes(l)).length + base.linhas.filter((l) => !r.linhas.includes(l)).length
  estrutura += r.colunas.filter((c) => !base.colunas.some((x) => x.id === c.id)).length + base.colunas.filter((c) => !r.colunas.some((x) => x.id === c.id)).length
  estrutura += r.colunas.filter((c) => {
    const b = base.colunas.find((x) => x.id === c.id)
    return b && (b.nome !== c.nome || (b.pessoaId ?? '') !== (c.pessoaId ?? ''))
  }).length
  const ordemBase = base.colunas.map((c) => c.id).filter((id) => r.colunas.some((c) => c.id === id))
  const ordemR = r.colunas.map((c) => c.id).filter((id) => base.colunas.some((c) => c.id === id))
  if (ordemBase.join() !== ordemR.join()) estrutura++
  if (base.nome !== r.nome) estrutura++
  if ((base.categoria ?? '') !== (r.categoria ?? '')) estrutura++
  if ((base.validaDesde ?? '') !== (r.validaDesde ?? '')) estrutura++
  return { precos, estrutura, total: precos + estrutura }
}

export function invalidos(g: GradeEdicao) {
  return Object.entries(g.valores).filter(([, v]) => v && !fatorValido(v)).map(([k]) => k)
}
