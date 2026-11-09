// DIVISÃO INTERNA DE UMA LINHA DA VENDA: quanto ficou com cada parte e ONDE a comissão foi definida (para levar direto
// ao lugar de mudar). A ordem da regra está em core/domain/comissao.ts.
import type { Linha } from '../../../core/domain/tipos'

export type DestinoComissao =
  | { tipo: 'corrigir' }
  | { tipo: 'servico'; itemId: string }
  | { tipo: 'profissional'; pessoaId: string }
  | { tipo: 'regras' }

export interface OrigemComissao {
  explica: string
  rotulo: string
  destino: DestinoComissao
}

type LinhaDivisao = Pick<Linha, 'itemId' | 'profissionalId' | 'comissaoBp' | 'comissaoRegra'>

/** de onde veio a % desta linha e onde mudar; sem comissão na linha, não há o que mostrar */
export function origemComissao(l: LinhaDivisao): OrigemComissao | undefined {
  if (l.comissaoBp === undefined && !l.comissaoRegra) return undefined
  if (l.comissaoRegra === 'linha') return { explica: 'Ajustada só nesta venda', rotulo: 'Corrigir esta venda', destino: { tipo: 'corrigir' } }
  if (l.comissaoRegra === 'servico' && l.itemId) return { explica: 'Definida no serviço', rotulo: 'Alterar no serviço', destino: { tipo: 'servico', itemId: l.itemId } }
  if (l.comissaoRegra === 'profissional' && l.profissionalId) return { explica: 'Definida no cadastro da profissional', rotulo: 'Alterar na profissional', destino: { tipo: 'profissional', pessoaId: l.profissionalId } }
  if (l.comissaoRegra === 'padrao') return { explica: 'Padrão do salão', rotulo: 'Alterar o padrão', destino: { tipo: 'regras' } }
  return { explica: 'Regra de comissão', rotulo: 'Ver as regras', destino: { tipo: 'regras' } }
}

/** as partes da linha, na moeda principal: insumos + salão + profissional = valor da linha */
export function partesDaLinha(l: Pick<Linha, 'totalPrincipal' | 'insumoPrincipal' | 'comissaoPrincipal' | 'baseComissao' | 'parteSalao'>) {
  const insumos = l.insumoPrincipal ?? 0
  const profissional = l.comissaoPrincipal ?? 0
  const salao = l.parteSalao ?? (l.baseComissao ?? l.totalPrincipal - insumos) - profissional
  const total = Math.max(insumos + salao + profissional, 1)
  const fatia = (v: number) => `${(v / total) * 100}%`
  return { insumos, salao, profissional, fatias: { insumos: fatia(insumos), salao: fatia(salao), profissional: fatia(profissional) } }
}
