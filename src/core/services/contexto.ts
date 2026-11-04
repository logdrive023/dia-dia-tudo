// O que toda regra recebe: as portas (repos, relógio, sessão) e o registro de módulos. Nada de banco aqui.

import { MOEDAS, type CodigoMoeda, type Cotacao, type TabelaCotacoes, type UsoCambio, ajustarCotacao, converter } from '../domain/dinheiro'
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
  { id: 'qr', nome: 'QR', vivo: false, moedas: ['BOB'] },
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

/**
 * Câmbio de cada moeda:
 *  - 'dinamico': a base vem da internet (guardada no aparelho a cada busca); venda e compra = base ± ajuste em %.
 *  - 'fixo': você digita "1 USD = 6,96 BOB" para vender e para comprar; a internet não muda nada.
 */
export interface CambioMoeda {
  modo: 'dinamico' | 'fixo'
  /** só no dinâmico: ajuste sobre a base, em pontos-base (−150 = −1,5%) */
  ajusteVendaBp?: number
  ajusteCompraBp?: number
}

export interface Configuracoes {
  nomeNegocio: string
  idioma: 'pt' | 'es'
  socios: Socio[]
  /** câmbio automático: uma vez no começo do dia ou na hora de usar */
  cambioAuto: 'inicioDoDia' | 'momento' | 'desligado'
  /** modo de cada moeda (sem configuração = dinâmico sem ajuste) */
  cambio: Record<CodigoMoeda, CambioMoeda>
  moedaPrincipal: CodigoMoeda
  moedasAtivas: CodigoMoeda[]
  formas: FormaPagamento[]
  diasTriagemParada: number
  diasLoteParado: number
  diasCotacaoVelha: number
  modulosAtivos: string[]
  /** salão: comissão padrão dos serviços em pontos-base (5000 = 50/50 salão × profissional) */
  comissaoPadraoBp: number
  /** salão: a funcionária pode mudar o % da comissão na linha do atendimento (senão só o administrador) */
  comissaoFuncionarioMuda: boolean
  /** TRIAGEM: juntar/separar vários pacotes só se estiverem na MESMA etapa do quadro (desligado = pode misturar) */
  juntarMesmaEtapa: boolean
  /** avisar (sem travar) ao vender pacote ainda bruto */
  avisarVendaBruto: boolean
  /** TRIAGEM: abaixo disso (gramas) o pacote é "sobra pequena" — só avisa, não bloqueia */
  saldoPequenoG: number
}

export const CONFIG_PADRAO: Configuracoes = {
  nomeNegocio: 'Meu negócio',
  idioma: 'pt',
  socios: [],
  cambioAuto: 'inicioDoDia',
  cambio: {},
  moedaPrincipal: 'BOB',
  moedasAtivas: ['BOB', 'USD', 'BRL'],
  formas: FORMAS_PADRAO,
  diasTriagemParada: 3,
  diasLoteParado: 60,
  diasCotacaoVelha: 7,
  modulosAtivos: ['cabelo', 'salao', 'emprestimos', 'produtos'],
  comissaoPadraoBp: 5000,
  comissaoFuncionarioMuda: false,
  // desligada por padrão: o sistema sempre deixou juntar um separado com um bruto (re-triagem); quem quiser, liga
  juntarMesmaEtapa: false,
  avisarVendaBruto: true,
  saldoPequenoG: 50,
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

/** Última cotação BASE de cada moeda (a da internet ou a base digitada). Funciona sem internet: é a última salva. */
async function bases(ctx: Ctx): Promise<TabelaCotacoes> {
  const todas = await ctx.repos.cotacoes.listar()
  const tabela: TabelaCotacoes = {}
  for (const c of todas.filter((x) => !x.uso || x.uso === 'base').sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? -1 : 1)))
    tabela[c.moeda] = { moeda: c.moeda, valor: c.valor, sentido: c.sentido, data: c.data, contra: c.contra, uso: 'base' }
  return tabela
}

/**
 * Tabela de câmbio para um USO: 'venda' (recebo em outra moeda), 'compra' (pago em outra moeda) ou 'base' (mercado).
 * Dinâmico = base da internet ± ajuste; fixo = o valor digitado para aquele uso (sem ele, cai na base).
 */
export async function cotacoesAtuais(ctx: Ctx, uso: UsoCambio = 'base'): Promise<TabelaCotacoes> {
  const cfg = await lerConfig(ctx)
  const base = await bases(ctx)
  if (uso === 'base') return base
  const todas = (await ctx.repos.cotacoes.listar()).sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? -1 : 1))
  const tabela: TabelaCotacoes = { ...base }
  for (const m of MOEDAS.map((x) => x.codigo)) {
    if (m === cfg.moedaPrincipal) continue
    const conf = cfg.cambio[m] ?? { modo: 'dinamico' }
    if (conf.modo === 'fixo') {
      const fixa = todas.filter((c) => c.moeda === m && c.uso === uso).pop()
      if (fixa) tabela[m] = { moeda: m, valor: fixa.valor, sentido: fixa.sentido, data: fixa.data, contra: fixa.contra, uso }
    } else {
      const bp = uso === 'venda' ? conf.ajusteVendaBp ?? 0 : conf.ajusteCompraBp ?? 0
      const temBase = m === 'BRL' || !!base[m]
      if (temBase && bp && (cfg.moedaPrincipal === 'BRL' || base[cfg.moedaPrincipal] !== undefined)) tabela[m] = ajustarCotacao(m, cfg.moedaPrincipal, bp, base, uso, base[m]?.data ?? '')
    }
  }
  return tabela
}

/** Converte para a moeda principal pela taxa do uso e devolve também a cotação usada (para guardar). */
export async function paraPrincipal(ctx: Ctx, valor: number, de: CodigoMoeda, uso: UsoCambio = 'base') {
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx, uso)
  const valorPrincipal = converter(valor, de, cfg.moedaPrincipal, cot)
  // guarda a cotação usada já "achatada" contra a base: o registro não depende de outra cotação no futuro
  let cotacao: Cotacao | undefined
  if (de !== cfg.moedaPrincipal && (cot[de] || de === 'BRL')) cotacao = ajustarCotacao(de, cfg.moedaPrincipal, 0, cot, uso, cot[de]?.data ?? '')
  return { valorPrincipal, cotacao, moedaPrincipal: cfg.moedaPrincipal }
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

/**
 * Período fechado: o dia encerrado não muda de dinheiro (a diferença entra no caixa de hoje), mas o
 * resultado daquele dia muda. Por isso só o administrador corrige/cancela, e o dia guarda o aviso.
 */
export async function marcarDiaFechado(ctx: Ctx, t: { id: Id; codigo?: string; data: string }, descricao: string) {
  const dia = await ctx.repos.dias.obter(t.data)
  if (dia?.status !== 'encerrado') return
  exigir(ctx.sessao.perfil === 'admin', `O dia ${t.data.split('-').reverse().join('/')} já foi encerrado: só o administrador corrige ou cancela.`)
  const nova = { origemId: t.id, codigo: t.codigo, descricao, em: ctx.relogio.agora(), porNome: ctx.sessao.nome }
  await ctx.repos.dias.salvar(tocar(ctx, { ...dia, alteracoesDepois: [...(dia.alteracoesDepois ?? []), nova] }))
}

export function exigirInteiroPositivo(valor: number, nome: string, permitirZero = false) {
  exigir(Number.isSafeInteger(valor) && (permitirZero ? valor >= 0 : valor > 0), `${nome}: valor inválido.`)
  exigir(valor <= 10_000_000_000, `${nome}: valor alto demais.`)
}
