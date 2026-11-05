// OPERAÇÃO CAOS — CONCORRÊNCIA: duas "abas" (dois BackendNoAparelho, cada um com a SUA fila) no MESMO IndexedDB.
import { criarBackend } from '../src/app/criarBackend'
import type { BackendNoAparelho } from '../src/adapters/noAparelho'
import { bs, relogioFixo } from '../src/__tests__/ajuda'

export type B = BackendNoAparelho
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Q = any

export function abrirAbas(n = 2, inicio = '2026-11-01') {
  const r = relogioFixo(inicio)
  const nomeBanco = `caos-conc-${Math.random().toString(36).slice(2)}`
  const abas = Array.from({ length: n }, () => criarBackend({ tipo: 'local', nomeBanco, relogio: r.relogio }))
  return { r, nomeBanco, abas: abas.map((a) => ({ b: a.backend as B, sessao: a.sessao })) }
}

/** base fictícia mínima, criada pela aba 1 */
export async function base(b: B) {
  await b.comando('salvarConfig', { moedaPrincipal: 'BOB' })
  await b.comando('salvarCotacao', { id: 'cot-bob', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
  await b.comando('salvarCotacao', { id: 'cot-usd', moeda: 'USD', valor: '5,40', sentido: 'basePorMoeda' })
  await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'Saldo inicial' })
  await b.comando('salvarPessoa', { id: 'forn', nome: 'Fornecedora Ficticia', papeis: ['fornecedor'], telefone: '111' })
  await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente Ficticia', papeis: ['cliente'], telefone: '222' })
  await b.comando('salvarPessoa', { id: 'p-sofia', nome: 'Sofia Ficticia', papeis: ['funcionario'] })
  await b.comando('salvarUsuario', { id: 'u-sofia', login: 'sofia', nome: 'Sofia Ficticia', perfil: 'funcionario', pessoaId: 'p-sofia', senha: '1234' })
  await b.comando('salvarUsuario', { id: 'u-adm2', login: 'bianca', nome: 'Bianca Admin', perfil: 'admin', senha: '1234' })
}

const linhaBruta = (id: string, g: number, total: number) => ({ id, quantidade: g, moeda: 'BOB', total, campos: { estado: 'Bruto', categoria: 'Normal' } })

/** compra paga no ato; devolve o id do lote que nasceu */
export async function compraPaga(b: B, id: string, g = 1000, total = bs(1000)) {
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'forn', linhas: [linhaBruta(id + '-l', g, total)], pagarNoAto: [{ id: id + '-p', forma: 'dinheiro', moeda: 'BOB', valor: total }] } as Q)
  return loteDa(b, id)
}
/** compra em aberto (sem pagar) */
export async function compraAberta(b: B, id: string, g = 1000, total = bs(1000)) {
  await b.comando('criarCompra', { id, moduloId: 'cabelo', pessoaId: 'forn', linhas: [linhaBruta(id + '-l', g, total)] } as Q)
  return loteDa(b, id)
}
export async function loteDa(b: B, compraId: string): Promise<string> {
  const c = (await b.consulta('compra', { id: compraId })) as Q
  return c.compra.linhas[0].itemId
}

export function venda(id: string, itemId: string, g: number, total = bs(100), extra: Q = {}) {
  return { id, pessoaId: 'cli', linhas: [{ id: id + '-l', itemId, quantidade: g, moeda: 'BOB', total }], pagamentos: [{ id: id + '-p', forma: 'dinheiro', moeda: 'BOB', valor: total }], ...extra } as Q
}

export const repos = (b: B) => (b as unknown as { repos: Q }).repos
export const saldo = async (b: B, itemId: string) => (await repos(b).itens.obter(itemId)).saldo as number
export const caixaBOB = async (b: B, data: string) => ((await b.consulta('caixaDoDia', { data })) as Q).contas.find((c: Q) => c.moeda === 'BOB')?.total ?? 0
export const auditoriaDe = async (b: B, acao: string) => ((await repos(b).auditoria.listar()) as Q[]).filter((a) => a.acao === acao)
export async function entrarComo(a: { b: B; sessao: Q }, login: string) {
  Object.assign(a.sessao, await a.b.entrar(login, '1234'))
}
export const resultado = (p: Promise<unknown>) => p.then(() => 'ok', (e: Error) => `erro: ${e.message}`)
