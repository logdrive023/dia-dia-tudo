// O QUE A FUNCIONÁRIA VÊ: uma pergunta só para menu, atalhos e rotas. Admin vê tudo; a funcionária vê o básico
// (Vender · Agenda · Equipe · Configurações básicas) e o que o admin liberou em Configurações › O que a funcionária faz.
import { useApp, useConsulta } from './contexto'

export type TelaLiberavel = 'pessoas' | 'viagens' | 'adiantamentos' | 'conversor'
export const TELAS_LIBERAVEIS: TelaLiberavel[] = ['pessoas', 'viagens', 'adiantamentos', 'conversor']

export function useLiberado() {
  const { sessao } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const telas = new Set(dados?.config.funcionariaTelas ?? [])
  return (x: TelaLiberavel) => sessao.perfil === 'admin' || telas.has(x)
}
