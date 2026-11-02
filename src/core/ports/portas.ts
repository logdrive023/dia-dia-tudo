// PORTAS: o que as regras precisam do mundo lá fora. As regras (core/services) só conhecem estas interfaces.
// Quem implementa: adapters/memory (testes), adapters/local (IndexedDB, a demonstração) e adapters/api (servidor).

import type {
  Anexo,
  Auditoria,
  Base,
  ConfigRegistro,
  CotacaoRegistro,
  Dia,
  Emprestimo,
  Financiamento,
  Id,
  Item,
  Local,
  MovCaixa,
  MovConta,
  MovDivida,
  MovEstoque,
  Outbox,
  Pessoa,
  TabelaPreco,
  Transacao,
  Usuario,
  Viagem,
} from '../domain/tipos'

/** Filtro simples por igualdade (vira query string numa API: ?moduloId=cabelo). */
export type Onde<T> = Partial<{ [K in keyof T]: T[K] }>

export interface Colecao<T extends Base> {
  obter(id: Id): Promise<T | undefined>
  /** Lista por igualdade; registros apagados (apagadoEm) ficam de fora. */
  listar(onde?: Onde<T>): Promise<T[]>
  salvar(registro: T): Promise<void>
  salvarVarios(registros: T[]): Promise<void>
  limpar(): Promise<void>
}

export interface Repos {
  pessoas: Colecao<Pessoa>
  locais: Colecao<Local>
  itens: Colecao<Item>
  transacoes: Colecao<Transacao>
  movEstoque: Colecao<MovEstoque>
  dias: Colecao<Dia>
  movCaixa: Colecao<MovCaixa>
  movConta: Colecao<MovConta>
  cotacoes: Colecao<CotacaoRegistro>
  tabelasPreco: Colecao<TabelaPreco>
  emprestimos: Colecao<Emprestimo>
  movDivida: Colecao<MovDivida>
  anexos: Colecao<Anexo>
  config: Colecao<ConfigRegistro>
  auditoria: Colecao<Auditoria>
  usuarios: Colecao<Usuario>
  viagens: Colecao<Viagem>
  financiamentos: Colecao<Financiamento>
  outbox: Colecao<Outbox>
}

export const NOMES_COLECOES: (keyof Repos)[] = [
  'pessoas',
  'locais',
  'itens',
  'transacoes',
  'movEstoque',
  'dias',
  'movCaixa',
  'movConta',
  'cotacoes',
  'tabelasPreco',
  'emprestimos',
  'movDivida',
  'anexos',
  'config',
  'auditoria',
  'usuarios',
  'viagens',
  'financiamentos',
  'outbox',
]

/** Arquivos (fotos e comprovantes). No aparelho: Blob no IndexedDB. Na API: upload e URL remota. */
export interface ArquivosStore {
  guardar(id: Id, arquivo: Blob): Promise<void>
  obter(id: Id): Promise<Blob | undefined>
  remover(id: Id): Promise<void>
  limpar(): Promise<void>
  listarIds(): Promise<Id[]>
}

/** Quem está usando. Na demonstração é fixo; com a API vem do login. */
export interface Sessao {
  empresaId: Id
  /** vazio = ninguém entrou ainda (mostra a tela de entrar) */
  usuarioId: Id
  nome: string
  login?: string
  pessoaId?: Id
  /** admin: tudo; funcionário: só a unidade dele e a própria agenda (na API, o servidor confere pelo token) */
  perfil: 'admin' | 'funcionario'
  localId?: Id
}

/** Relógio trocável (os testes rodam com data fixa). */
export interface Relogio {
  agora(): string
  hoje(): string
}

/** Executa uma função como uma coisa só: ou grava tudo ou nada. */
export type ExecutarEmTransacao = <R>(fn: () => Promise<R>) => Promise<R>
