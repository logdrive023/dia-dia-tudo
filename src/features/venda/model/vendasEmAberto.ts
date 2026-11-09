// VENDAS EM ABERTO: há quanto tempo cada uma está aberta e os filtros rápidos da aba (contas sem tela, com teste).

export type FiltroAberta = '' | 'minhas' | 'recentes' | 'paradas'

const UMA_HORA = 60
const UM_DIA = 24 * UMA_HORA

/** minutos desde que a venda foi aberta (relógio adiantado no aparelho não dá número negativo) */
export function minutosAberta(abertaEm: string, agora: number = Date.now()) {
  return Math.max(0, Math.floor((agora - new Date(abertaEm).getTime()) / 60000))
}

/** "Aberta há 15 min" · "Aberta há 2 h" · "Aberta há 3 dias" */
export function textoIdade(minutos: number, t: (s: string, v?: Record<string, string | number>) => string) {
  if (minutos < 1) return t('Aberta agora')
  if (minutos < UMA_HORA) return t('Aberta há {n} min', { n: minutos })
  if (minutos < UM_DIA) return t('Aberta há {n} h', { n: Math.floor(minutos / UMA_HORA) })
  const dias = Math.floor(minutos / UM_DIA)
  return dias === 1 ? t('Aberta há 1 dia') : t('Aberta há {n} dias', { n: dias })
}

/** parada há um dia ou mais: pede atenção na lista */
export const estaParada = (minutos: number) => minutos >= UM_DIA

export function passaFiltroAberta(filtro: string, a: { abertaEm: string; minha: boolean }, agora: number = Date.now()) {
  const min = minutosAberta(a.abertaEm, agora)
  return filtro === 'minhas' ? a.minha : filtro === 'recentes' ? min < UMA_HORA : filtro === 'paradas' ? estaParada(min) : true
}
