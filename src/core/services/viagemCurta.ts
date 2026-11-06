// VIAGEM CURTA: o que as listas precisam saber da viagem de uma compra (e, pela cadeia, de um pacote e de uma
// venda): código e nome. Vem do SERVIDOR junto com cada linha — a tela só mostra o selo "✈️ VG-0001" e filtra.

import { diasEntre } from '../domain/datas'
import type { Id } from '../domain/tipos'
import type { Ctx } from './contexto'

export interface ViagemCurta { id: Id; codigo: string; nome: string }

export async function mapaViagens(ctx: Ctx) {
  return new Map<Id, ViagemCurta>((await ctx.repos.viagens.listar()).filter((v) => !v.apagadoEm).map((v) => [v.id, { id: v.id, codigo: v.codigo, nome: v.nome }]))
}

/** até quantos dias depois de encerrada a viagem ainda conta como "encerrada recentemente" (laranja) */
export const DIAS_ENCERRADA_RECENTE = 30

/**
 * as viagens para ESCOLHER num filtro (todas, a mais nova primeiro): código, nome, destino, datas e situação.
 * `tempo`: 'vigente' (aberta) · 'recente' (encerrada há até 30 dias) · 'antiga' (encerrada faz tempo) — a cor do cartão.
 */
export async function viagensParaFiltro(ctx: Ctx, _p: object = {}) {
  const hoje = ctx.relogio.hoje()
  return (await ctx.repos.viagens.listar())
    .filter((x) => !x.apagadoEm)
    // funcionária: só as viagens em que ela viajou
    .filter((x) => ctx.sessao.perfil === 'admin' || (!!ctx.sessao.pessoaId && x.viajantes.includes(ctx.sessao.pessoaId)))
    .map((x) => {
      const encerradaEm = x.status === 'encerrada' ? x.encerramento?.data ?? x.fim : undefined
      const diasEncerrada = encerradaEm ? Math.max(0, diasEntre(encerradaEm, hoje)) : undefined
      const tempo: 'vigente' | 'recente' | 'antiga' = x.status === 'aberta' ? 'vigente' : (diasEncerrada ?? 0) <= DIAS_ENCERRADA_RECENTE ? 'recente' : 'antiga'
      return { id: x.id, codigo: x.codigo, nome: x.nome, destino: x.destino, inicio: x.inicio, fim: x.fim, status: x.status, encerradaEm, diasEncerrada, tempo }
    })
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
}
