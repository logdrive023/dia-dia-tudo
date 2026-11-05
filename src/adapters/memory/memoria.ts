// Adaptador EM MEMÓRIA: rápido, para testes. Transação = guarda o valor antigo de cada registro na 1ª escrita (desfaz só o que mudou) e volta se der erro.

import type { Base, Id } from '../../core/domain/tipos'
import { type ArquivosStore, type Colecao, type ExecutarEmTransacao, NOMES_COLECOES, type Onde, type Repos } from '../../core/ports/portas'

export class ColecaoMemoria<T extends Base> implements Colecao<T> {
  mapa = new Map<Id, T>()
  /** chamado antes de cada escrita (ids que vão mudar; null = a coleção inteira): a transação guarda o valor antigo */
  antesDeEscrever?: (ids: Id[] | null) => void

  async obter(id: Id) {
    const r = this.mapa.get(id)
    return r ? structuredClone(r) : undefined
  }

  async listar(onde?: Onde<T>) {
    const res: T[] = []
    const filtros = onde ? Object.entries(onde) : undefined
    for (const r of this.mapa.values()) {
      if (r.apagadoEm) continue
      if (filtros && !filtros.every(([k, v]) => (r as Record<string, unknown>)[k] === v)) continue
      res.push(structuredClone(r))
    }
    return res
  }

  async salvar(r: T) {
    this.antesDeEscrever?.([r.id])
    this.mapa.set(r.id, structuredClone(r))
  }

  async salvarVarios(rs: T[]) {
    this.antesDeEscrever?.(rs.map((r) => r.id))
    for (const r of rs) this.mapa.set(r.id, structuredClone(r))
  }

  async limpar() {
    this.antesDeEscrever?.(null)
    this.mapa.clear()
  }
}

type NomeColecao = (typeof NOMES_COLECOES)[number]
/** o que uma transação precisa para desfazer uma coleção: o valor antigo de cada registro tocado (e, se limpou, tudo) */
interface Desfazer {
  antigos: Map<Id, Base | undefined>
  tudo?: Map<Id, Base>
}

export function criarReposMemoria(): { repos: Repos; transacao: ExecutarEmTransacao } {
  const repos = Object.fromEntries(NOMES_COLECOES.map((n) => [n, new ColecaoMemoria()])) as unknown as Repos
  const col = (n: NomeColecao) => repos[n] as unknown as ColecaoMemoria<Base>
  // transações abertas (pode haver uma dentro da outra). Custo proporcional ao que o comando escreve, não ao tamanho do banco.
  const abertas: Map<NomeColecao, Desfazer>[] = []
  for (const n of NOMES_COLECOES)
    col(n).antesDeEscrever = (ids) => {
      const mapa = col(n).mapa
      for (const tx of abertas) {
        let d = tx.get(n)
        if (!d) tx.set(n, (d = { antigos: new Map() }))
        if (d.tudo) continue
        if (ids === null) d.tudo = new Map(mapa)
        else for (const id of ids) if (!d.antigos.has(id)) d.antigos.set(id, mapa.get(id))
      }
    }
  const transacao: ExecutarEmTransacao = async (fn) => {
    const tx = new Map<NomeColecao, Desfazer>()
    abertas.push(tx)
    try {
      return await fn()
    } catch (e) {
      for (const [n, d] of tx) {
        const c = col(n)
        if (d.tudo) c.mapa = d.tudo
        for (const [id, r] of d.antigos) if (r === undefined) c.mapa.delete(id)
        else c.mapa.set(id, r)
      }
      throw e
    } finally {
      abertas.splice(abertas.indexOf(tx), 1)
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
