// CÂMBIO DA INTERNET (grátis, sem chave): busca a cotação e GUARDA no aparelho como base (fonte "auto").
// Assim existe sempre uma base local: sem internet, vale a última salva (a tela mostra a data).
// Moeda em modo "dinâmico" usa essa base (± ajuste de venda/compra); em modo "fixo" a internet não muda nada.
// Quando buscar: "inicioDoDia" (uma vez por dia: todas as vendas do dia usam a mesma) ou "momento" (a cada hora).

import { MOEDAS } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Backend } from '../core/ports/backend'

export const FONTE_CAMBIO = 'https://open.er-api.com/v6/latest/BRL'
const CHAVE = 'tudo.cambio.ultimaBusca'

/** "1 BRL = 1.284 BOB" → texto com vírgula, sem separador de milhar (formato que a regra de cotação lê). */
export function numeroParaTexto(n: number): string {
  const casas = n >= 100 ? 4 : n >= 1 ? 6 : 8
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
  if (!opcoes.forcar) {
    if (config.cambioAuto === 'inicioDoDia' && ultima && new Date(ultima).toDateString() === new Date().toDateString()) return { ok: true, mensagem: 'Cotação de hoje já está salva.' }
    if (config.cambioAuto === 'momento' && agora - ultima < 3600_000) return { ok: true, mensagem: 'Cotação atualizada há menos de 1 hora.' }
  }
  const registrar = (ok: boolean, mensagem: string) => backend.comando('registrarBuscaCambio', { ok, mensagem, fonte: FONTE_CAMBIO }).catch(() => undefined)
  try {
    const f = opcoes.fetch ?? fetch
    const res = await f(FONTE_CAMBIO)
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
    if (json.result !== 'success' || !json.rates) throw new Error('resposta inesperada')
    // guarda a base de TODAS as moedas conhecidas (mesmo as desligadas): a base local fica completa
    for (const m of MOEDAS.map((x) => x.codigo).filter((x) => x !== 'BRL')) {
      const taxa = json.rates[m]
      if (!taxa || !(taxa > 0)) continue
      await backend.comando('salvarCotacao', { id: novoId(), moeda: m, valor: numeroParaTexto(taxa), sentido: 'moedaPorBase', fonte: 'auto', uso: 'base' })
    }
    try {
      localStorage.setItem(CHAVE, String(agora))
    } catch {
      /* ignora */
    }
    await registrar(true, 'Cotação atualizada pela internet.')
    return { ok: true, mensagem: 'Cotação atualizada pela internet.' }
  } catch {
    await registrar(false, 'Sem internet para buscar a cotação: usando a última salva.')
    return { ok: false, mensagem: 'Sem internet para buscar a cotação: usando a última salva.' }
  }
}
