// TRIAGEM › PRÓXIMO PASSO em 2 camadas (conta pura, testada em proximo.test.ts):
//   camada 1 — O QUÊ: de qual categoria de cabelo escolher (todas, Normal, Tinte…; só as que estão na fila)
//   camada 2 — COMO: o critério para escolher um (mais tempo parado, mais pesado, mais leve, chegou por último)
// Empate no critério → o que espera há mais tempo (nunca fica "aleatório").

export type CriterioProximo = 'parado' | 'pesado' | 'leve' | 'recente'

export const CRITERIOS_PROXIMO: { id: CriterioProximo; icone: string; nome: string; porque: string }[] = [
  { id: 'parado', icone: '⏳', nome: 'Mais tempo parado', porque: 'É o que espera há mais tempo ({g}).' },
  { id: 'pesado', icone: '⚖️', nome: 'Mais pesado', porque: 'É o mais pesado da fila ({g}).' },
  { id: 'leve', icone: '🪶', nome: 'Mais leve', porque: 'É o mais leve da fila ({g}): sai rápido.' },
  { id: 'recente', icone: '🆕', nome: 'Chegou por último', porque: 'É o que chegou por último ({g}).' },
]

export interface PreferenciaProximo {
  /** '' = todas as categorias */
  categoria: string
  criterio: CriterioProximo
}

export const PROXIMO_PADRAO: PreferenciaProximo = { categoria: '', criterio: 'parado' }

/** o mínimo que a conta precisa de um pacote da fila */
export interface NaFila {
  dias: number
  saldo: number
  campos: Record<string, unknown>
}

export const categoriaDe = (l: NaFila) => String(l.campos.categoria || 'Normal')

/** as categorias que existem na fila (camada 1 só oferece o que dá resultado) */
export function categoriasDaFila(fila: NaFila[]): string[] {
  return [...new Set(fila.map(categoriaDe))].sort()
}

/** escolhe o próximo pacote pelas 2 camadas; categoria sem nenhum pacote → undefined (a tela avisa) */
export function escolherProximo<L extends NaFila>(fila: L[], p: PreferenciaProximo): L | undefined {
  const daCategoria = p.categoria ? fila.filter((l) => categoriaDe(l) === p.categoria) : fila
  const ordem: Record<CriterioProximo, (a: L, b: L) => number> = {
    parado: (a, b) => b.dias - a.dias,
    pesado: (a, b) => b.saldo - a.saldo || b.dias - a.dias,
    leve: (a, b) => a.saldo - b.saldo || b.dias - a.dias,
    recente: (a, b) => a.dias - b.dias || b.saldo - a.saldo,
  }
  return [...daCategoria].sort(ordem[p.criterio])[0]
}
