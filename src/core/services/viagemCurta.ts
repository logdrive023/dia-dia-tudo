// VIAGEM CURTA: o que as listas precisam saber da viagem de uma compra (e, pela cadeia, de um pacote e de uma
// venda): código e nome. Vem do SERVIDOR junto com cada linha — a tela só mostra o selo "✈️ VG-0001" e filtra.

import type { Id } from '../domain/tipos'
import type { Ctx } from './contexto'

export interface ViagemCurta { id: Id; codigo: string; nome: string }

export async function mapaViagens(ctx: Ctx) {
  return new Map<Id, ViagemCurta>((await ctx.repos.viagens.listar()).filter((v) => !v.apagadoEm).map((v) => [v.id, { id: v.id, codigo: v.codigo, nome: v.nome }]))
}

/** as viagens (sem repetir) de uma lista de compras */
export function viagensDe(compras: { viagem?: ViagemCurta }[]): ViagemCurta[] {
  return [...new Map(compras.filter((c) => c.viagem).map((c) => [c.viagem!.id, c.viagem!])).values()]
}
