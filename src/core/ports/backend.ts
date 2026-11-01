// A PORTA que as telas usam. Trocar de "no aparelho" para "API" = trocar a implementação desta interface.

import type { Id } from '../domain/tipos'
import type { Sessao } from './portas'
import type { CategoriaAnexo } from '../domain/tipos'
import type { DadosComando, NomeComando, NomeConsulta, ParamsConsulta, ResultadoComando, ResultadoConsulta } from '../services'

export type TipoArmazenamento = 'memory' | 'local' | 'api'

export interface Backup {
  formato: 'tudo-backup'
  versao: 1
  exportadoEm: string
  colecoes: Record<string, unknown[]>
  /** arquivos em data URL (fotos e comprovantes) */
  arquivos: Record<Id, string>
}

export interface Backend {
  readonly tipo: TipoArmazenamento
  comando<N extends NomeComando>(nome: N, dados: DadosComando<N>): Promise<ResultadoComando<N>>
  consulta<N extends NomeConsulta>(nome: N, params: ParamsConsulta<N>): Promise<ResultadoConsulta<N>>
  /** guarda o arquivo e registra o anexo (na API: upload + comando) */
  anexar(d: { id: Id; donoId: Id; categoria: CategoriaAnexo; nome: string; arquivo: Blob }): Promise<{ id: Id }>
  urlDoAnexo(id: Id): Promise<string | undefined>
  /** avisa as telas que algo mudou (para recarregar as consultas) */
  aoMudar(fn: () => void): () => void
  exportar(): Promise<Backup>
  importar(b: Backup): Promise<void>
  /** só no modo demonstração */
  limparTudo(): Promise<void>
  /** login: no aparelho confere o hash; na API devolve token */
  entrar(login: string, senha: string): Promise<Sessao>
  sair(): Promise<void>
}
