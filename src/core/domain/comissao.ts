// COMISSÃO DO SALÃO com desconto de insumos. Regras puras (servem ao núcleo e às telas):
//  1) % da comissão, por precedência: ajuste na linha (atendimento) > regra do serviço > % da profissional > padrão (50%).
//  2) Insumos do salão (tinta, água oxigenada, descolorante…) saem ANTES da divisão:
//     base = valor − insumos; profissional = base × %; salão = base − profissional.
//     Ex.: Tintura Bs 300, insumos Bs 20 → base 280 → salão 140 · profissional 140 (50%).

import { formatar, proporcao } from './dinheiro'
import type { Linha, RegraComissao } from './tipos'

export const COMISSAO_PADRAO_BP = 5000

export const NOME_REGRA: Record<RegraComissao, string> = {
  linha: 'ajustada no atendimento',
  servico: 'regra do serviço',
  profissional: 'da profissional',
  padrao: 'padrão',
}

/** Qual % vale e por quê. Sem profissional não há comissão. */
export function resolverComissao(p: {
  profissional: boolean
  servico: boolean
  linhaBp?: number
  servicoBp?: number
  profissionalBp?: number
  padraoBp?: number
}): { bp: number; regra: RegraComissao } | undefined {
  if (!p.profissional) return undefined
  if (p.linhaBp !== undefined) return { bp: p.linhaBp, regra: 'linha' }
  if (p.servico && p.servicoBp !== undefined) return { bp: p.servicoBp, regra: 'servico' }
  if (p.profissionalBp !== undefined) return { bp: p.profissionalBp, regra: 'profissional' }
  // o padrão global vale para serviços; produto/cabelo só tem comissão se a profissional tiver %
  if (p.servico) return { bp: p.padraoBp ?? COMISSAO_PADRAO_BP, regra: 'padrao' }
  return undefined
}

/** base = total − insumos; comissão = base × %; salão = base − comissão (tudo inteiro, na moeda principal). */
export function dividir(totalPrincipal: number, insumoPrincipal: number, bp: number | undefined) {
  const base = Math.max(0, totalPrincipal - insumoPrincipal)
  const comissao = bp ? proporcao(base, bp, 10000) : 0
  return { base, comissao, parteSalao: base - comissao }
}

export const pct = (bp: number) => `${(bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

/**
 * Memória do cálculo (para a tela, o recibo interno e o extrato da profissional):
 * "Valor 300 − Insumos 20 (Tinta 15 + Água oxigenada 5) = Base 280 → Salão 140 · Profissional 140 (50%, regra do serviço)".
 * NÃO vai para o recibo da cliente.
 */
export function memoriaCalculo(l: Pick<Linha, 'totalPrincipal' | 'insumoPrincipal' | 'insumos' | 'comissaoBp' | 'comissaoPrincipal' | 'comissaoRegra' | 'baseComissao' | 'parteSalao'>, moeda: string, t: (s: string) => string = (s) => s) {
  const f = (v: number) => formatar(v, moeda)
  const insumo = l.insumoPrincipal ?? 0
  const base = l.baseComissao ?? l.totalPrincipal - insumo
  const com = l.comissaoPrincipal ?? 0
  const salao = l.parteSalao ?? base - com
  const partes = [`${t('Valor')} ${f(l.totalPrincipal)}`]
  if (insumo) {
    const det = l.insumos?.length ? ` (${l.insumos.map((i) => `${i.nome} ${f(i.valorPrincipal)}`).join(' + ')})` : ''
    partes.push(`− ${t('Insumos')} ${f(insumo)}${det} = ${t('Base')} ${f(base)}`)
  }
  const regra = l.comissaoRegra ? `, ${t(NOME_REGRA[l.comissaoRegra])}` : ''
  const divisao = l.comissaoBp !== undefined ? `→ ${t('Salão')} ${f(salao)} · ${t('Profissional')} ${f(com)} (${pct(l.comissaoBp)}${regra})` : `→ ${t('Salão')} ${f(salao)}`
  return `${partes.join(' ')} ${divisao}`
}

/** Biblioteca de serviços comuns (preço em Bs, minutos, % própria opcional, insumos padrão). Restaurável no Catálogo. */
export interface ServicoBiblioteca {
  nome: string
  categoria: string
  preco: number
  duracaoMin: number
  retornoDias?: number
  comissaoBp?: number
  insumos?: { nome: string; valor: number }[]
}

export const BIBLIOTECA_SERVICOS: ServicoBiblioteca[] = [
  { nome: 'Corte', categoria: 'Corte', preco: 80, duracaoMin: 40 },
  { nome: 'Escova', categoria: 'Escova', preco: 60, duracaoMin: 40 },
  { nome: 'Tintura', categoria: 'Cor', preco: 300, duracaoMin: 120, insumos: [{ nome: 'Tinta', valor: 15 }, { nome: 'Água oxigenada', valor: 5 }] },
  { nome: 'Mechas/Luzes', categoria: 'Cor', preco: 450, duracaoMin: 180, insumos: [{ nome: 'Descolorante', valor: 25 }, { nome: 'Água oxigenada', valor: 10 }, { nome: 'Papel alumínio', valor: 5 }] },
  { nome: 'Descoloração', categoria: 'Cor', preco: 350, duracaoMin: 150, insumos: [{ nome: 'Descolorante', valor: 20 }, { nome: 'Água oxigenada', valor: 10 }] },
  { nome: 'Hidratação', categoria: 'Tratamento', preco: 100, duracaoMin: 45, insumos: [{ nome: 'Máscara', valor: 10 }] },
  { nome: 'Depilação', categoria: 'Estética', preco: 70, duracaoMin: 30, insumos: [{ nome: 'Cera', valor: 8 }] },
  { nome: 'Unha (mão)', categoria: 'Unhas', preco: 50, duracaoMin: 40 },
  { nome: 'Unha (pé)', categoria: 'Unhas', preco: 60, duracaoMin: 45 },
  { nome: 'Maquiagem', categoria: 'Maquiagem', preco: 150, duracaoMin: 60 },
  { nome: 'Penteado', categoria: 'Penteado', preco: 120, duracaoMin: 60 },
  { nome: 'Barba', categoria: 'Barba', preco: 50, duracaoMin: 30 },
]

/** nome comparável: sem acento, minúsculo, espaços simples ("Unha  (Mão)" = "unha (mao)") */
export function nomeComparavel(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
