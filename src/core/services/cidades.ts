// CADASTRO DE CIDADES — as 340 da Bolívia já vêm cadastradas (src/core/dados/cidadesBolivia.ts); a pessoa só cadastra
// a que faltar (ou de fora). A lista que a tela recebe é uma só: as de fábrica + as cadastradas, sem repetir.
// Guardadas na coleção de configurações (chave "cidade:<id>"), cada uma com seu registro (dá para apagar uma só).

import { CIDADES_BOLIVIA, type Cidade, semAcento } from '../dados/cidadesBolivia'
import type { Id } from '../domain/tipos'
import { exigir } from '../domain/erros'
import { auditar, type Ctx, novo, tocar } from './contexto'

const CHAVE = 'cidade:'

export type CidadeCadastro = Cidade & { id?: Id }

async function extras(ctx: Ctx): Promise<CidadeCadastro[]> {
  return (await ctx.repos.config.listar())
    .filter((r) => r.id.startsWith(CHAVE) && !r.apagadoEm)
    .map((r) => ({ ...(r.valor as Cidade), id: r.id.slice(CHAVE.length), extra: true }))
}

/** todas as cidades: as da Bolívia (de fábrica) + as cadastradas; `pais` filtra ("Bolívia") */
export async function cidades(ctx: Ctx, p: { pais?: string } = {}): Promise<CidadeCadastro[]> {
  const todas: CidadeCadastro[] = [...CIDADES_BOLIVIA, ...(await extras(ctx))]
  return p.pais ? todas.filter((c) => semAcento(c.pais) === semAcento(p.pais!)) : todas
}

/** cadastra uma cidade nova (a que não veio na lista). Igual a uma que já existe (sem acento/maiúscula): não duplica. */
export async function salvarCidade(ctx: Ctx, d: { id: Id; nome: string; departamento?: string; pais?: string }) {
  exigir(d.id, 'Cidade sem id.')
  const nome = d.nome?.trim().replace(/\s+/g, ' ')
  exigir(nome && nome.length >= 2, 'Escreva o nome da cidade.', 'nome')
  exigir(nome!.length <= 80, 'Nome da cidade muito longo.', 'nome')
  const departamento = d.departamento?.trim() || undefined
  const pais = d.pais?.trim() || 'Bolívia'
  const igual = (await cidades(ctx)).find((c) => semAcento(c.nome) === semAcento(nome!) && semAcento(c.departamento ?? '') === semAcento(departamento ?? '') && semAcento(c.pais) === semAcento(pais))
  if (igual) return { id: igual.id ?? d.id, nome: igual.nome, jaExistia: true }
  const valor: Cidade = { nome: nome!, ...(departamento ? { departamento } : {}), pais }
  const atual = await ctx.repos.config.obter(CHAVE + d.id)
  await ctx.repos.config.salvar(atual ? tocar(ctx, { ...atual, apagadoEm: undefined, valor }) : novo(ctx, { id: CHAVE + d.id, valor }))
  await auditar(ctx, 'salvarCidade', d.id, `cidade cadastrada: ${nome}${departamento ? ` · ${departamento}` : ''} · ${pais}`)
  return { id: d.id, nome: nome!, jaExistia: false }
}
