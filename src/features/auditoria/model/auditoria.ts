// AUDITORIA › as contas e os nomes da tela (sem React): cor e ícone de cada área, o dia de cada ação e o rótulo do
// dia ("Hoje", "Ontem", "seg 08/11"), a hora com segundos e as linhas da planilha.
import type { CategoriaAuditoria } from '../../../core/services/auditoria'
import { dataCurta, dataDeInstante, diaDaSemana, somarDias } from '../../../core/domain/datas'

export const COR_AREA: Record<CategoriaAuditoria, string> = {
  venda: '#16a34a', compra: '#ea580c', estoque: '#9333ea', viagens: '#0284c7', dinheiro: '#ca8a04',
  pessoas: '#0ea5e9', acesso: '#dc2626', config: '#64748b', recusa: '#e11d48', outros: '#94a3b8',
}

export const ICONE_AREA: Record<CategoriaAuditoria, string> = {
  venda: '💰', compra: '🛒', estoque: '📦', viagens: '🧳', dinheiro: '💵', pessoas: '👤', acesso: '🔒', config: '⚙️', recusa: '⛔', outros: '📜',
}

export const NOME_AREA: Record<CategoriaAuditoria, string> = {
  venda: 'Vendas e agenda', compra: 'Compras', estoque: 'Estoque e triagem', viagens: 'Viagens', dinheiro: 'Dinheiro',
  pessoas: 'Pessoas', acesso: 'Acesso e usuários', config: 'Configurações', recusa: 'Recusadas', outros: 'Outros',
}

export const ICONE_REF: Record<string, string> = { compra: '🛒', venda: '💰', pacote: '📦', item: '🏷', pessoa: '👤', viagem: '🧳', adiantamento: '🤲', 'empréstimo': '🤝', 'usuário': '🔑' }

/** a hora com segundos (o log é para conferir): "08:49:17" */
export function horaSegundos(iso: string): string {
  const d = new Date(iso)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':')
}

/** o dia (no fuso do aparelho) em que a ação aconteceu: "2026-11-10" */
export const diaDaAcao = (iso: string) => dataDeInstante(iso)

/** o cabeçalho do dia na lista: "Hoje", "Ontem" ou "seg 08/11" (outro ano: "seg 08/11/2025") */
export function rotuloDia(dia: string, hoje: string): { texto: string; traduzir: boolean } {
  if (dia === hoje) return { texto: 'Hoje', traduzir: true }
  if (dia === somarDias(hoje, -1)) return { texto: 'Ontem', traduzir: true }
  return { texto: `${diaDaSemana(dia)} ${dataCurta(dia, dia.slice(0, 4) !== hoje.slice(0, 4))}`, traduzir: false }
}

/** começa um dia novo nesta linha? (a lista vem da mais nova para a mais antiga) */
export const comecaDia = (lista: { em: string }[], k: number) => k === 0 || diaDaAcao(lista[k].em) !== diaDaAcao(lista[k - 1].em)
