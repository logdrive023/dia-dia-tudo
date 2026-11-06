// TRIAGEM — os tipos e a constante que a tela e as peças dela (quadro, prontos, histórico) usam juntas.
import type { ResultadoConsulta } from '../../core/services'
import { useT } from '../../ui/i18n'


export const NAO_ID = 'Não identificado'

export type Dados = ResultadoConsulta<'triagem'>

export type Lote = Dados['lotes'][number]

export type T = ReturnType<typeof useT>
