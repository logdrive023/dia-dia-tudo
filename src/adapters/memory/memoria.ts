// Adaptador EM MEMÓRIA: rápido, para testes. Transação = cópia antes e volta se der erro.

import type { Base, Id } from '../../core/domain/tipos'
import { type ArquivosStore, type Colecao, type ExecutarEmTransacao, NOMES_COLECOES, type Onde, type Repos } from '../../core/ports/portas'

export class ColecaoMemoria<T extends Base> implements Colecao<T> {
  mapa = new Map<Id, T>()

  async obter(id: Id) {
    const r = this.mapa.get(id)
    return r ? structuredClone(r) : undefined
  }

  async listar(onde?: Onde<T>) {
    const res: T[] = []
    for (const r of this.mapa.values()) {
      if (r.apagadoEm) continue
      if (onde && !Object.entries(onde).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) continue
      res.push(structuredClone(r))
    }
    return res
  }

  async salvar(r: T) {
    this.mapa.set(r.id, structuredClone(r))
  }

  async salvarVarios(rs: T[]) {
    for (const r of rs) this.mapa.set(r.id, structuredClone(r))
  }

  async limpar() {
    this.mapa.clear()
  }
}

export function criarReposMemoria(): { repos: Repos; transacao: ExecutarEmTransacao } {
  const repos = Object.fromEntries(NOMES_COLECOES.map((n) => [n, new ColecaoMemoria()])) as unknown as Repos
  const transacao: ExecutarEmTransacao = async (fn) => {
    const copia = NOMES_COLECOES.map((n) => [n, new Map((repos[n] as unknown as ColecaoMemoria<Base>).mapa)] as const)
    try {
      return await fn()
    } catch (e) {
      for (const [n, m] of copia) (repos[n] as unknown as ColecaoMemoria<Base>).mapa = m
      throw e
    }
  }
  return { repos, transacao }
}

export class ArquivosMemoria implements ArquivosStore {
  private mapa = new Map<Id, Blob>()
  async guardar(id: Id, b: Blob) {
    this.mapa.set(id, b)
  }
  async obter(id: Id) {
    return this.mapa.get(id)
  }
  async remover(id: Id) {
    this.mapa.delete(id)
  }
  async limpar() {
    this.mapa.clear()
  }
  async listarIds() {
    return [...this.mapa.keys()]
  }
}
