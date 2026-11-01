// CÂMBIO AUTOMÁTICO (grátis, sem chave): busca a cotação do dia em open.er-api.com e guarda como cotação "auto".
// Modo "inicioDoDia": uma vez por dia (todas as vendas do dia usam a mesma). Modo "momento": a cada hora de uso.
// Sem internet: fica a última cotação salva e a tela avisa a data dela.

import type { Backend } from '../core/ports/backend'
import { novoId } from '../core/domain/ids'

export const FONTE_CAMBIO = 'https://open.er-api.com/v6/latest/BRL'
const CHAVE = 'tudo.cambio.ultimaBusca'

/** "1 BRL = 1.284 BOB" → texto com vírgula, sem separador de milhar (formato que a regra de cotação lê). */
export function numeroParaTexto(n: number): string {
  const casas = n >= 100 ? 2 : n >= 1 ? 4 : 6
  return n.toFixed(casas).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
}

export async function atualizarCambio(backend: Backend, opcoes: { forcar?: boolean; fetch?: typeof fetch } = {}): Promise<{ ok: boolean; mensagem: string }> {
  const { config } = await backend.consulta('configuracoes', {})
  if (config.cambioAuto === 'desligado' && !opcoes.forcar) return { ok: false, mensagem: 'Câmbio automático desligado.' }
  let ultima = 0
  try {
    ultima = Number(localStorage.getItem(CHAVE) ?? 0)
  } catch {
    /* sem armazenamento: busca de novo */
  }
  const agora = Date.now()
  const hoje = new Date().toDateString()
  if (!opcoes.forcar) {
    if (config.cambioAuto === 'inicioDoDia' && ultima && new Date(ultima).toDateString() === hoje) return { ok: true, mensagem: 'Cotação de hoje já está salva.' }
    if (config.cambioAuto === 'momento' && agora - ultima < 3600_000) return { ok: true, mensagem: 'Cotação atualizada há menos de 1 hora.' }
  }
  try {
    const f = opcoes.fetch ?? fetch
    const res = await f(FONTE_CAMBIO)
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
    if (json.result !== 'success' || !json.rates) throw new Error('resposta inesperada')
    for (const moeda of config.moedasAtivas.filter((m) => m !== 'BRL')) {
      const taxa = json.rates[moeda]
      if (!taxa || !(taxa > 0)) continue
      await backend.comando('salvarCotacao', { id: novoId(), moeda, valor: numeroParaTexto(taxa), sentido: 'moedaPorBase', fonte: 'auto' })
    }
    try {
      localStorage.setItem(CHAVE, String(agora))
    } catch {
      /* ignora */
    }
    return { ok: true, mensagem: 'Cotação atualizada pela internet.' }
  } catch {
    return { ok: false, mensagem: 'Sem internet para buscar a cotação: usando a última salva.' }
  }
}
