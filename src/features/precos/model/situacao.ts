// TABELAS DE PREÇO — a situação de uma tabela (vigente, agendada, substituída): nome, cor e explicação, usada pela
// lista e pelo cartão.
export type Situacao = 'vigente' | 'agendada' | 'substituida'
export const SITUACAO_TABELA: Record<Situacao, { nome: string; tom: 'bom' | 'alerta' | 'neutro'; ajuda: string }> = {
  vigente: { nome: 'Vigente', tom: 'bom', ajuda: 'É a que vale hoje para a categoria dela: as vendas novas usam esta.' },
  agendada: { nome: 'Agendada', tom: 'alerta', ajuda: 'Vale a partir de uma data que ainda não chegou.' },
  substituida: { nome: 'Substituída', tom: 'neutro', ajuda: 'Outra tabela mais nova da mesma categoria tomou o lugar. Fica guardada com o histórico.' },
}
