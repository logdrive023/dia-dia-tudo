// PREÇOS — o rascunho da tabela em edição, as ferramentas da grade e as categorias, usados pela tela e pelas janelas.
import type { TabelaPreco } from '../../core/domain/tipos'
import { useT } from '../../ui/i18n'
import { type Alvo } from '../../ui/tabelaPrecoEdicao'


export type Rascunho = Pick<TabelaPreco, 'id' | 'moduloId' | 'nome' | 'categoria' | 'validaDesde' | 'moeda' | 'unidadeMedida' | 'fatorPor' | 'linhas' | 'colunas' | 'valores'>

export type T = ReturnType<typeof useT>

export const CATEGORIAS = ['Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque']

export type Direcao = 'direita' | 'esquerda' | 'baixo' | 'cima'

export type Ferramenta = { tipo: 'pct' | 'copiar' | 'preencher'; alvo?: Alvo; para?: string }
