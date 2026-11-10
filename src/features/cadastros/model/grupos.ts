// PESSOAS › os GRUPOS da lista (para não ficar tudo misturado): Clientes · Fornecedoras · Equipe · Contas e sócias.
// Cada pessoa aparece UMA vez na visão "Todas" (no grupo principal dela); a aba de um grupo traz todo mundo que tem
// aquele papel (ex.: quem é cliente E fornecedora aparece nas duas abas).
import type { Papel } from '../../../core/domain/tipos'

export type GrupoPessoa = 'clientes' | 'fornecedoras' | 'equipe' | 'outros'

export const GRUPOS: { id: GrupoPessoa; nome: string; icone: string; papeis: Papel[]; descricao: string }[] = [
  { id: 'clientes', nome: 'Clientes', icone: '👤', papeis: ['cliente'], descricao: 'Quem compra cabelo ou é atendida no salão.' },
  { id: 'fornecedoras', nome: 'Fornecedoras', icone: '🛒', papeis: ['fornecedor', 'doadora'], descricao: 'De quem o cabelo é comprado.' },
  { id: 'equipe', nome: 'Equipe', icone: '🧑‍💼', papeis: ['funcionario', 'profissional', 'socio'], descricao: 'Quem trabalha com você e as sócias.' },
  { id: 'outros', nome: 'Contas e empréstimos', icone: '🤝', papeis: ['devedor', 'credor'], descricao: 'Quem pegou ou emprestou dinheiro.' },
]

/** o grupo principal (equipe > fornecedora > cliente > contas): onde a pessoa aparece na visão "Todas" */
export function grupoPrincipal(papeis: Papel[]): GrupoPessoa {
  for (const g of ['equipe', 'fornecedoras', 'clientes', 'outros'] as GrupoPessoa[]) {
    if (GRUPOS.find((x) => x.id === g)!.papeis.some((p) => papeis.includes(p))) return g
  }
  return 'outros'
}

/** a pessoa tem algum papel do grupo? (a aba do grupo) */
export const estaNoGrupo = (papeis: Papel[], g: GrupoPessoa) => GRUPOS.find((x) => x.id === g)!.papeis.some((p) => papeis.includes(p)) || (g === 'outros' && grupoPrincipal(papeis) === 'outros')

/** quantos aparecem em cada aba de grupo */
export function contarGrupos(lista: { papeis: Papel[] }[]): Record<GrupoPessoa, number> {
  const r = { clientes: 0, fornecedoras: 0, equipe: 0, outros: 0 }
  for (const p of lista) for (const g of GRUPOS) if (estaNoGrupo(p.papeis, g.id)) r[g.id]++
  return r
}
