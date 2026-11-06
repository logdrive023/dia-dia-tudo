// VIAGENS — os tipos (linha da lista, ficha) e os nomes/tons da situação que a lista, a ficha e as abas usam juntas.
import { useConsulta } from '../../ui/contexto'


export const TOM_STATUS = { aberta: 'marca', encerrada: 'neutro' } as const

export const NOME_STATUS = { aberta: 'Aberta', encerrada: 'Encerrada' } as const

export type LinhaLista = NonNullable<ReturnType<typeof useConsulta<'viagens'>>['dados']>['linhas'][number]

export type Dados = NonNullable<ReturnType<typeof useConsulta<'viagem'>>['dados']>
