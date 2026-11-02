// Adaptador LOCAL (a demonstração): IndexedDB via Dexie. É o ÚNICO lugar do app que conhece o Dexie.

import Dexie, { type Table } from 'dexie'
import type { Base, Id } from '../../core/domain/tipos'
import { type ArquivosStore, type Colecao, type ExecutarEmTransacao, NOMES_COLECOES, type Onde, type Repos } from '../../core/ports/portas'

/** Índices de cada tabela (mudar índice = nova versão abaixo). */
const ESQUEMA_V1: Record<string, string> = {
  pessoas: 'id, nome',
  locais: 'id',
  itens: 'id, moduloId, tipoItem',
  transacoes: 'id, tipo, moduloId, data, etapa, pessoaId',
  movEstoque: 'id, itemId, data, origemId',
  dias: 'id, data, status',
  movCaixa: 'id, data, moeda, origemId',
  movConta: 'id, pessoaId, data, origemId',
  cotacoes: 'id, moeda',
  tabelasPreco: 'id, moduloId',
  emprestimos: 'id, pessoaId',
  movDivida: 'id, emprestimoId',
  anexos: 'id, donoId',
  config: 'id',
  auditoria: 'id, alvoId',
  outbox: 'id, enviadoEm',
  arquivos: 'id',
}

export type BancoLocal = Dexie

export function abrirBanco(nome = 'tudo'): BancoLocal {
  const db = new Dexie(nome)
  db.version(1).stores(ESQUEMA_V1)
  // v2: usuários (login). Mudar índice = nova versão; o Dexie migra sozinho.
  db.version(2).stores({ ...ESQUEMA_V1, usuarios: 'id, &login' })
  // v3: viagens de compra (tabela nova; as outras ficam como estão)
  db.version(3).stores({ ...ESQUEMA_V1, usuarios: 'id, &login', viagens: 'id, status, inicio' })
  // v4: adiantamentos a parceiros (financiamentos AD-0001; tabela nova)
  db.version(4).stores({ ...ESQUEMA_V1, usuarios: 'id, &login', viagens: 'id, status, inicio', financiamentos: 'id, pessoaId' })
  return db
}

class ColecaoDexie<T extends Base> implements Colecao<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private tabela: Table<any, Id>) {}

  obter(id: Id) {
    return this.tabela.get(id)
  }

  async listar(onde?: Onde<T>) {
    const pares = Object.entries(onde ?? {}).filter(([, v]) => v !== undefined)
    const indexado = pares.find(([k]) => this.tabela.schema.idxByName[k])
    let lista: T[]
    if (indexado) lista = await this.tabela.where(indexado[0]).equals(indexado[1] as never).toArray()
    else lista = await this.tabela.toArray()
    return lista.filter((r) => !r.apagadoEm && pares.every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  }

  async salvar(r: T) {
    await this.tabela.put(r)
  }

  async salvarVarios(rs: T[]) {
    await this.tabela.bulkPut(rs)
  }

  async limpar() {
    await this.tabela.clear()
  }
}

class ArquivosDexie implements ArquivosStore {
  constructor(private tabela: Table<{ id: Id; blob: Blob }, Id>) {}
  async guardar(id: Id, blob: Blob) {
    await this.tabela.put({ id, blob })
  }
  async obter(id: Id) {
    return (await this.tabela.get(id))?.blob
  }
  async remover(id: Id) {
    await this.tabela.delete(id)
  }
  async limpar() {
    await this.tabela.clear()
  }
  async listarIds() {
    return (await this.tabela.toCollection().primaryKeys()) as Id[]
  }
}

export function criarReposLocal(db: BancoLocal): { repos: Repos; transacao: ExecutarEmTransacao; arquivos: ArquivosStore } {
  const repos = Object.fromEntries(NOMES_COLECOES.map((n) => [n, new ColecaoDexie(db.table(n))])) as unknown as Repos
  const tabelas = NOMES_COLECOES.map((n) => db.table(n))
  const transacao: ExecutarEmTransacao = (fn) => db.transaction('rw', tabelas, fn) as never
  return { repos, transacao, arquivos: new ArquivosDexie(db.table('arquivos')) }
}

/** Pede ao navegador para nunca apagar os dados (Configurações mostra o resultado). */
export async function protegerDados(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export async function espacoUsado(): Promise<{ usado: number; total: number } | undefined> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e ? { usado: e.usage ?? 0, total: e.quota ?? 0 } : undefined
  } catch {
    return undefined
  }
}
