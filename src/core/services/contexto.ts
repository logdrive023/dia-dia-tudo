// O que toda regra recebe: as portas (repos, relógio, sessão) e o registro de módulos. Nada de banco aqui.

import { MOEDAS, type CodigoMoeda, type TabelaCotacoes, converter } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import { novoId } from '../domain/ids'
import type { Base, Dia, Id } from '../domain/tipos'
import type { RegistroModulos } from '../modulos'
import type { Relogio, Repos, Sessao } from '../ports/portas'

export interface Ctx {
  repos: Repos
  relogio: Relogio
  sessao: Sessao
  modulos: RegistroModulos
}

type SemBase<T> = Omit<T, keyof Base> & { id?: Id }

/** Cria um registro com os campos de servidor preenchidos. */
export function novo<T extends Base>(ctx: Ctx, dados: SemBase<T>): T {
  const agora = ctx.relogio.agora()
  return {
    ...dados,
    id: dados.id ?? novoId(),
    empresaId: ctx.sessao.empresaId,
    criadoEm: agora,
    atualizadoEm: agora,
    criadoPor: ctx.sessao.usuarioId,
    versao: 1,
  } as T
}

/** Marca um registro como alterado (sobe a versão: base para detectar conflito na API). */
export function tocar<T extends Base>(ctx: Ctx, r: T): T {
  return { ...r, atualizadoEm: ctx.relogio.agora(), versao: r.versao + 1 }
}

/** Registra a ação no log com o usuário da sessão (toda ação do sistema passa por aqui). */
export async function auditar(ctx: Ctx, acao: string, alvoId: Id | undefined, resumo: string, ligados?: Id[]) {
  await ctx.repos.auditoria.salvar(novo(ctx, { acao, alvoId, resumo, usuarioNome: ctx.sessao.nome, ligados: ligados?.filter(Boolean) }))
}

// ---------- configurações ----------

export interface FormaPagamento {
  id: string
  nome: string
  /** dinheiro vivo (conta "na mão") */
  vivo: boolean
  moedas: CodigoMoeda[]
  descontoBp?: number
}

export const FORMAS_PADRAO: FormaPagamento[] = [
  { id: 'dinheiro', nome: 'Dinheiro (efectivo)', vivo: true, moedas: MOEDAS.map((m) => m.codigo) },
  { id: 'qr', nome: 'QR', vivo: false, moedas: ['BOB', 'PYG'] },
  { id: 'pix', nome: 'Pix', vivo: false, moedas: ['BRL'], descontoBp: 0 },
  { id: 'credito', nome: 'Crédito', vivo: false, moedas: ['BRL'] },
  { id: 'debito', nome: 'Débito', vivo: false, moedas: ['BRL'] },
  { id: 'transferencia', nome: 'Transferência', vivo: false, moedas: MOEDAS.map((m) => m.codigo) },
]

/** Sócios que dividem o lucro (ex.: 2 sócios 50% cada = "÷ 2" do caderno). */
export interface Socio {
  id: string
  nome: string
  /** parte do lucro em pontos-base: 5000 = 50% */
  parteBp: number
}

export interface Configuracoes {
  nomeNegocio: string
  idioma: 'pt' | 'es'
  socios: Socio[]
  /** câmbio automático: uma vez no começo do dia ou na hora de usar */
  cambioAuto: 'inicioDoDia' | 'momento' | 'desligado'
  moedaPrincipal: CodigoMoeda
  moedasAtivas: CodigoMoeda[]
  formas: FormaPagamento[]
  diasTriagemParada: number
  diasLoteParado: number
  diasCotacaoVelha: number
  modulosAtivos: string[]
}

export const CONFIG_PADRAO: Configuracoes = {
  nomeNegocio: 'Meu negócio',
  idioma: 'pt',
  socios: [],
  cambioAuto: 'inicioDoDia',
  moedaPrincipal: 'BOB',
  moedasAtivas: ['BRL', 'PYG', 'USD', 'BOB'],
  formas: FORMAS_PADRAO,
  diasTriagemParada: 3,
  diasLoteParado: 60,
  diasCotacaoVelha: 7,
  modulosAtivos: ['cabelo', 'salao', 'emprestimos', 'produtos'],
}

export async function lerConfig(ctx: Ctx): Promise<Configuracoes> {
  const r = await ctx.repos.config.obter('geral')
  return { ...CONFIG_PADRAO, ...((r?.valor as Partial<Configuracoes>) ?? {}) }
}

export async function formaPagamento(ctx: Ctx, id: string): Promise<FormaPagamento> {
  const f = (await lerConfig(ctx)).formas.find((x) => x.id === id)
  exigir(f, `Forma de pagamento desconhecida: ${id}`)
  return f
}

/** Última cotação de cada moeda. */
export async function cotacoesAtuais(ctx: Ctx): Promise<TabelaCotacoes> {
  const todas = await ctx.repos.cotacoes.listar()
  const tabela: TabelaCotacoes = {}
  for (const c of todas.sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? -1 : 1))) {
    tabela[c.moeda] = { moeda: c.moeda, valor: c.valor, sentido: c.sentido, data: c.data }
  }
  return tabela
}

/** Converte para a moeda principal e devolve também a cotação usada (para guardar). */
export async function paraPrincipal(ctx: Ctx, valor: number, de: CodigoMoeda) {
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx)
  const valorPrincipal = converter(valor, de, cfg.moedaPrincipal, cot)
  return { valorPrincipal, cotacao: de === cfg.moedaPrincipal ? undefined : cot[de], moedaPrincipal: cfg.moedaPrincipal }
}

// ---------- dia do caixa ----------

/** O dia nasce aberto no primeiro lançamento. Dia encerrado recusa lançamentos (dá para reabrir). */
export async function garantirDiaAberto(ctx: Ctx, data: string): Promise<Dia> {
  const existente = await ctx.repos.dias.obter(data)
  if (existente) {
    exigir(existente.status === 'aberto', `O dia ${data.split('-').reverse().join('/')} está encerrado. Reabra no Caixa para lançar.`)
    return existente
  }
  const dia = novo<Dia>(ctx, { id: data, data, status: 'aberto', contado: {} })
  await ctx.repos.dias.salvar(dia)
  return dia
}

export function exigirInteiroPositivo(valor: number, nome: string, permitirZero = false) {
  exigir(Number.isSafeInteger(valor) && (permitirZero ? valor >= 0 : valor > 0), `${nome}: valor inválido.`)
  exigir(valor <= 10_000_000_000, `${nome}: valor alto demais.`)
}
