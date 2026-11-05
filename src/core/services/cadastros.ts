// Pessoas, locais, cotações, configurações e anexos (metadados; o arquivo em si vai pela porta de arquivos).

import { MOEDAS, type CodigoMoeda } from '../domain/dinheiro'
import { textoCotacao, valorDeUm, type UsoCambio } from '../domain/dinheiro'
import { ErroNegocio, exigir } from '../domain/erros'
import { diasEntre } from '../domain/datas'
import { FORMA_FIXA, formasEmUso } from '../domain/formas'
import { empresaFormatada } from '../domain/textoFormatado'
import { MODELOS_DOCUMENTO } from '../dados/documentos'
import type { Anexo, CategoriaAnexo, CotacaoRegistro, Id, Local, Papel, Pessoa } from '../domain/tipos'
import { auditar, type Configuracoes, type Ctx, cotacoesAtuais, exigirVersao, lerConfig, MSG_ALTERADO_POR_OUTRA, novo, tocar, versaoDoFormulario } from './contexto'
import { situacaoDe } from './emprestimos'
import { type ModuloConfig, moduloDeConfig } from '../modulosConfig'
import { type AtributosConfig, type CampoDef, ETAPA_FINAL, type FluxoCompraConfig } from '../modulos'

export async function salvarPessoa(
  ctx: Ctx,
  d: {
    id: Id
    nome: string
    telefone?: string
    documento?: string
    papeis: Papel[]
    obs?: string
    comissaoBp?: number
    localId?: Id
    cargo?: string
    salario?: { moeda: string; valor: number; periodo?: 'mes' | 'semana' | 'dia' }
    superiorId?: Id
    acesso?: 'admin' | 'funcionario'
    verAgendaEquipe?: boolean
    /** versão da pessoa que o formulário carregou (outra aba mudou no meio → recusa) */
    versaoBase?: number
  },
) {
  exigir(d.nome?.trim(), 'Diga o nome.', 'nome')
  exigir(d.papeis?.length, 'Escolha pelo menos um papel (cliente, fornecedor…).', 'papeis')
  const tel = d.telefone?.replace(/[^\d+]/g, '') || undefined
  if (d.comissaoBp !== undefined) exigir(Number.isInteger(d.comissaoBp) && d.comissaoBp >= 0 && d.comissaoBp <= 10000, 'Comissão entre 0% e 100%.')
  const existente = await ctx.repos.pessoas.obter(d.id)
  exigirVersao(existente, versaoDoFormulario(d))
  if (d.salario) exigir(Number.isSafeInteger(d.salario.valor) && d.salario.valor >= 0, 'Salário inválido.')
  exigir(!d.superiorId || d.superiorId !== d.id, 'A pessoa não pode responder a ela mesma.')
  if (d.superiorId) {
    // evita ciclo no organograma (A chefe de B chefe de A)
    let atual = await ctx.repos.pessoas.obter(d.superiorId)
    for (let i = 0; atual && i < 50; i++) {
      exigir(atual.superiorId !== d.id, 'Esse chefe já responde a esta pessoa (o organograma ficaria em círculo).')
      atual = atual.superiorId ? await ctx.repos.pessoas.obter(atual.superiorId) : undefined
    }
  }
  const novos: Partial<Pessoa> = {
    nome: d.nome.trim(),
    telefone: tel,
    documento: d.documento?.trim() || undefined,
    papeis: d.papeis,
    obs: d.obs,
    comissaoBp: d.comissaoBp,
    localId: d.localId || undefined,
    cargo: d.cargo?.trim() || undefined,
    salario: d.salario,
    superiorId: d.superiorId || undefined,
    acesso: d.acesso,
    verAgendaEquipe: d.verAgendaEquipe,
  }
  // só muda o que a tela mandou (editar pela Equipe não apaga documento nem observação)
  const dados = Object.fromEntries(Object.entries(novos).filter(([k]) => k === 'nome' || k === 'papeis' || k in d)) as Partial<Pessoa> & { nome: string; papeis: Papel[] }
  if (ctx.sessao.perfil !== 'admin') {
    // funcionária cadastra e edita clientes, mas não comissão, salário, acesso, chefe, cargo nem unidade
    for (const k of ['comissaoBp', 'salario', 'acesso', 'superiorId', 'cargo', 'verAgendaEquipe'] as const) delete dados[k]
    if (existente) delete dados.localId
    exigir(!d.papeis.some((p) => p === 'funcionario' || p === 'socio') || existente?.papeis.some((p) => p === 'funcionario' || p === 'socio'), 'Só o administrador cadastra funcionários.')
  }
  if (existente) await ctx.repos.pessoas.salvar(tocar(ctx, { ...existente, ...dados }))
  else await ctx.repos.pessoas.salvar(novo<Pessoa>(ctx, { id: d.id, ...dados } as Parameters<typeof novo<Pessoa>>[1]))
  await auditar(ctx, 'salvarPessoa', d.id, dados.nome)
  return { id: d.id }
}

export async function salvarLocal(ctx: Ctx, d: Omit<Local, keyof import('../domain/tipos').Base> & { id: Id; versaoBase?: number }) {
  exigir(d.nome?.trim(), 'Dê um nome ao local.', 'nome')
  // a tela pode mandar o registro inteiro: os campos de servidor não vêm do formulário
  const { versaoBase: _vb, versao: _v, criadoEm: _c, criadoPor: _cp, atualizadoEm: _a, empresaId: _e, ...dados } = d as typeof d & Partial<import('../domain/tipos').Base>
  const existente = await ctx.repos.locais.obter(d.id)
  exigirVersao(existente, versaoDoFormulario(d))
  const salvo = existente ? tocar(ctx, { ...existente, ...dados, nome: d.nome.trim() }) : novo<Local>(ctx, { ...dados, nome: d.nome.trim() })
  await ctx.repos.locais.salvar(salvo)
  const mudou = existente ? resumoMudancas(existente as unknown as Record<string, unknown>, salvo as unknown as Record<string, unknown>, ['atualizadoEm', 'versao']) : ''
  await auditar(ctx, 'salvarLocal', d.id, existente ? `${salvo.nome}${mudou ? `: ${mudou}` : ' (sem mudança)'}` : `${salvo.nome} criado`)
  return { id: d.id }
}

/** "campo: antes → depois; …" das chaves que mudaram (para o log de auditoria). */
function resumoMudancas(antes: Record<string, unknown>, depois: Record<string, unknown>, ignorar: string[] = []) {
  const txt = (v: unknown) => {
    if (v === undefined || v === null || v === '') return '—'
    const t = typeof v === 'string' ? v : JSON.stringify(v)
    return t.length > 80 ? `${t.slice(0, 77)}…` : t
  }
  return [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    .filter((k) => !ignorar.includes(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map((k) => `${k}: ${txt(antes[k])} → ${txt(depois[k])}`)
    .join('; ')
}

export async function salvarCotacao(
  ctx: Ctx,
  d: { id: Id; moeda: CodigoMoeda; valor: string; sentido: 'basePorMoeda' | 'moedaPorBase'; fonte?: 'manual' | 'auto'; contra?: CodigoMoeda; uso?: UsoCambio },
) {
  exigir(MOEDAS.some((m) => m.codigo === d.moeda) && d.moeda !== 'BRL', 'Moeda inválida.')
  // funcionária só grava a busca automática da internet (como base), e só se for plausível; o resto é do administrador
  if (ctx.sessao.perfil !== 'admin') {
    exigir(d.fonte === 'auto' && (d.uso ?? 'base') === 'base' && !d.contra, 'Sem permissão para mudar o câmbio.')
    const ultima = (await cotacoesAtuais(ctx))[d.moeda]
    if (ultima) {
      const conv = (c: { valor: string; sentido: string }) => { const v = Number(c.valor.replace(/\./g, '').replace(',', '.')); return c.sentido === 'basePorMoeda' ? v : 1 / v }
      const r = conv(d) / conv(ultima)
      exigir(r > 0.8 && r < 1.25, 'Cotação muito diferente da última: peça ao administrador.')
    }
  }
  exigir(!d.contra || (d.contra !== d.moeda && MOEDAS.some((m) => m.codigo === d.contra)), 'Moeda de referência inválida.')
  decimalValido(d.valor)
  await ctx.repos.cotacoes.salvar(
    novo<CotacaoRegistro>(ctx, { id: d.id, moeda: d.moeda, valor: d.valor.trim(), sentido: d.sentido, data: ctx.relogio.hoje(), fonte: d.fonte ?? 'manual', contra: d.contra, uso: d.uso ?? 'base' }),
  )
  await auditar(ctx, 'salvarCotacao', d.id, `${d.moeda} ${d.valor}`)
  return { id: d.id }
}

function decimalValido(v: string) {
  const t = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  exigir(/^\d+(\.\d+)?$/.test(t) && Number(t) > 0, `Cotação inválida: ${v}`)
}

/**
 * Câmbio de uma moeda: dinâmico (internet ± ajuste para venda e compra) ou fixo (valores digitados contra a moeda
 * principal: "1 USD = 6,96 BOB"). Os valores fixos ficam guardados com data (histórico) e valem até mudar de novo.
 */
export async function salvarCambio(
  ctx: Ctx,
  d: { moeda: CodigoMoeda; modo: 'dinamico' | 'fixo'; ajusteVendaBp?: number; ajusteCompraBp?: number; fixoVenda?: string; fixoCompra?: string; idVenda?: Id; idCompra?: Id },
) {
  const cfg = await lerConfig(ctx)
  exigir(d.moeda !== cfg.moedaPrincipal, 'A moeda principal não tem câmbio (ela é a referência).')
  for (const bp of [d.ajusteVendaBp, d.ajusteCompraBp]) if (bp !== undefined) exigir(Number.isInteger(bp) && bp > -5000 && bp < 5000, 'Ajuste entre −50% e +50%.')
  if (d.modo === 'fixo') {
    const temVenda = !!d.fixoVenda?.trim()
    const temCompra = !!d.fixoCompra?.trim()
    const jaTem = (await ctx.repos.cotacoes.listar({ moeda: d.moeda })).some((c) => c.uso === 'venda' || c.uso === 'compra')
    exigir(temVenda || temCompra || jaTem, 'Digite o valor para vender e para comprar.')
    if (temVenda) {
      decimalValido(d.fixoVenda!)
      await ctx.repos.cotacoes.salvar(novo<CotacaoRegistro>(ctx, { id: d.idVenda, moeda: d.moeda, valor: d.fixoVenda!.trim(), sentido: 'basePorMoeda', contra: cfg.moedaPrincipal, uso: 'venda', data: ctx.relogio.hoje(), fonte: 'manual' }))
    }
    if (temCompra) {
      decimalValido(d.fixoCompra!)
      await ctx.repos.cotacoes.salvar(novo<CotacaoRegistro>(ctx, { id: d.idCompra, moeda: d.moeda, valor: d.fixoCompra!.trim(), sentido: 'basePorMoeda', contra: cfg.moedaPrincipal, uso: 'compra', data: ctx.relogio.hoje(), fonte: 'manual' }))
    }
  }
  await salvarConfig(ctx, { cambio: { ...cfg.cambio, [d.moeda]: { modo: d.modo, ajusteVendaBp: d.ajusteVendaBp ?? 0, ajusteCompraBp: d.ajusteCompraBp ?? 0 } } })
  await auditar(ctx, 'salvarCambio', d.moeda, `${d.moeda}: ${d.modo}${d.modo === 'fixo' ? ` · venda ${d.fixoVenda ?? '='} · compra ${d.fixoCompra ?? '='}` : ` · venda ${(d.ajusteVendaBp ?? 0) / 100}% · compra ${(d.ajusteCompraBp ?? 0) / 100}%`}`)
  return { id: d.moeda }
}

/** Resultado da última busca na internet (fica guardado: a tela mostra quando foi e se deu certo). */
export async function registrarBuscaCambio(ctx: Ctx, d: { ok: boolean; mensagem: string; fonte: string }) {
  const r = await ctx.repos.config.obter('cambioStatus')
  const valor = { ...d, em: ctx.relogio.agora(), ultimaOk: d.ok ? ctx.relogio.agora() : ((r?.valor as { ultimaOk?: string } | undefined)?.ultimaOk) }
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: 'cambioStatus', valor }))
  return { id: 'cambioStatus' }
}

/** Painel do câmbio: por moeda, o modo, a base (internet ou digitada, com data) e as taxas efetivas de venda e compra. */
export async function cambio(ctx: Ctx, _p: object = {}) {
  const cfg = await lerConfig(ctx)
  const base = await cotacoesAtuais(ctx, 'base')
  const venda = await cotacoesAtuais(ctx, 'venda')
  const compra = await cotacoesAtuais(ctx, 'compra')
  const todas = (await ctx.repos.cotacoes.listar()).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  const status = (await ctx.repos.config.obter('cambioStatus'))?.valor as { ok: boolean; mensagem: string; em: string; ultimaOk?: string; fonte: string } | undefined
  const p = cfg.moedaPrincipal
  const moedas = cfg.moedasAtivas
    .filter((m) => m !== p)
    .map((m) => {
      const conf = cfg.cambio[m] ?? { modo: 'dinamico' as const }
      const ultimaBase = todas.find((c) => c.moeda === m && (!c.uso || c.uso === 'base'))
      const fixaVenda = todas.find((c) => c.moeda === m && c.uso === 'venda')
      const fixaCompra = todas.find((c) => c.moeda === m && c.uso === 'compra')
      return {
        moeda: m,
        modo: conf.modo,
        ajusteVendaBp: conf.ajusteVendaBp ?? 0,
        ajusteCompraBp: conf.ajusteCompraBp ?? 0,
        base: valorDeUm(m, p, base),
        venda: valorDeUm(m, p, venda),
        compra: valorDeUm(m, p, compra),
        baseData: ultimaBase?.criadoEm,
        baseFonte: ultimaBase?.fonte ?? 'manual',
        fixoVenda: fixaVenda?.contra === p ? fixaVenda.valor : undefined,
        fixoCompra: fixaCompra?.contra === p ? fixaCompra.valor : undefined,
        fixoData: (fixaVenda ?? fixaCompra)?.criadoEm,
      }
    })
  const historico = todas.slice(0, 120).map((c) => ({ id: c.id, moeda: c.moeda, uso: c.uso ?? 'base', fonte: c.fonte ?? 'manual', em: c.criadoEm, texto: textoCotacao(c) }))
  return { principal: p, auto: cfg.cambioAuto, status, moedas, historico }
}

/** igualdade de valores de configuração (a ordem das chaves não importa) */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => igual(x, (b as unknown[])[i]))
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
const objetoSimples = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const listaSimples = (x: unknown): x is (string | number)[] => Array.isArray(x) && x.every((v) => typeof v === 'string' || typeof v === 'number')

/**
 * Junta a mudança da tela com o que está gravado agora, sabendo o que a tela tinha quando abriu (antes):
 *  - a tela não mudou esta parte → fica a gravada (a mudança da outra aba continua);
 *  - ninguém mais mudou → vale a da tela;
 *  - lista simples (módulos ativos, moedas) → aplica só o que a tela ligou/desligou sobre a gravada;
 *  - objeto (fiscal, câmbio) → o mesmo, chave por chave;
 *  - os dois mudaram a mesma coisa de jeitos diferentes → recusa (abrir de novo).
 */
function juntar(atual: unknown, antes: unknown, novo: unknown): unknown {
  if (igual(novo, antes)) return atual
  if (igual(atual, antes) || igual(atual, novo)) return novo
  if (listaSimples(atual) && listaSimples(antes) && listaSimples(novo)) {
    const tirou = antes.filter((x) => !novo.includes(x))
    const pos = atual.filter((x) => !tirou.includes(x))
    return [...pos, ...novo.filter((x) => !antes.includes(x) && !pos.includes(x))]
  }
  if (objetoSimples(atual) && objetoSimples(antes) && objetoSimples(novo)) {
    const r: Record<string, unknown> = { ...atual }
    for (const k of new Set([...Object.keys(antes), ...Object.keys(novo)])) {
      const v = juntar(atual[k], antes[k], novo[k])
      if (v === undefined) delete r[k]
      else r[k] = v
    }
    return r
  }
  throw new ErroNegocio(MSG_ALTERADO_POR_OUTRA)
}

/** Linhas "campo: antes → depois" da configuração (objetos como o fiscal: chave por chave). */
function mudancasConfig(antes: Record<string, unknown>, depois: Record<string, unknown>, prefixo = ''): string[] {
  const txt = (v: unknown) => {
    if (v === undefined || v === null || v === '') return '—'
    const t = typeof v === 'string' ? v : JSON.stringify(v)
    return t.length > 200 ? `${t.slice(0, 197)}…` : t
  }
  const out: string[] = []
  for (const k of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    const a = antes[k]
    const b = depois[k]
    if (igual(a, b)) continue
    if (!prefixo && objetoSimples(a) && objetoSimples(b)) out.push(...mudancasConfig(a, b, `${k}.`))
    else out.push(`${prefixo}${k}: ${txt(a)} → ${txt(b)}`)
  }
  return out
}

export async function salvarConfig(
  ctx: Ctx,
  dados: Partial<Configuracoes> & {
    /** versão da configuração que a tela carregou */
    versaoBase?: number
    /** valores que a tela tinha quando abriu (das chaves mandadas): com eles, a mudança junta com a da outra aba */
    antes?: Partial<Configuracoes>
  },
) {
  const { versaoBase, antes, ...semMeta } = dados
  let d = semMeta as Partial<Configuracoes>
  const atual = await lerConfig(ctx)
  const r = await ctx.repos.config.obter('geral')
  if (antes) {
    // três vias: o que a tela tinha × o que ela manda × o que está gravado agora
    const j: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(d)) j[k] = k in antes ? juntar((atual as unknown as Record<string, unknown>)[k], (antes as Record<string, unknown>)[k], v) : v
    d = j as Partial<Configuracoes>
  } else exigirVersao(r, versaoBase)
  const valor = { ...atual, ...d }
  exigir(valor.moedasAtivas.includes(valor.moedaPrincipal), 'A moeda principal precisa estar ativa.')
  if (valor.moedaPrincipal !== atual.moedaPrincipal && (await ctx.repos.transacoes.listar()).length)
    exigir(false, 'Já existem vendas/compras na moeda principal atual: trocar agora misturaria moedas nos totais. Faça um backup e comece de novo para trocar.')
  exigir(Number.isInteger(valor.saldoPequenoG) && valor.saldoPequenoG >= 0, 'Sobra pequena: use um número de gramas (0 desliga o aviso).')
  exigir(!valor.modeloNota || valor.modeloNota in MODELOS_DOCUMENTO, 'Modelo de nota inválido.')
  if (d.fiscal) {
    valor.fiscal = { ...atual.fiscal, ...d.fiscal }
    const f = valor.fiscal
    for (const k of ['ivaBp', 'itBp', 'iueBp', 'simplesBp', 'pisBp', 'cofinsBp', 'icmsIssBp', 'irpjCsllBp'] as const) exigir(Number.isInteger(f[k]) && f[k] >= 0 && f[k] <= 10000, 'Taxa de imposto entre 0% e 100%.')
    exigir(Number.isInteger(f.rtsCuotaBimestral) && f.rtsCuotaBimestral >= 0, 'Cuota RTS inválida.')
    exigir(f.pais === 'BO' || f.pais === 'BR', 'País inválido.')
    for (const i of f.impostos ?? []) {
      exigir(i.id && i.sigla?.trim(), 'Cada imposto precisa de uma sigla (ex.: IVA).')
      exigir(Number.isInteger(i.taxaBp) && i.taxaBp >= 0 && i.taxaBp <= 10000, `Taxa do ${i.sigla}: entre 0% e 100%.`)
    }
    exigir(new Set((f.impostos ?? []).map((i) => i.id)).size === (f.impostos ?? []).length, 'Há dois impostos com o mesmo código.')
  }
  if (d.formas) {
    exigir(valor.formas.some((f) => f.id === FORMA_FIXA && !f.desligada), 'Dinheiro (efectivo) não pode ser desligado.')
    for (const m of valor.moedasAtivas) exigir(formasEmUso(valor.formas, m).length, `Pelo menos uma forma de pagamento ligada para ${m}.`)
  }
  if (d.fiscal) valor.fiscal = { ...valor.fiscal, ...empresaFormatada(valor.fiscal) }
  if (valor.socios.length) {
    exigir(valor.socios.every((x) => x.nome.trim() && Number.isInteger(x.parteBp) && x.parteBp > 0), 'Cada sócio precisa de nome e parte.')
    exigir(valor.socios.reduce((s, x) => s + x.parteBp, 0) === 10000, 'As partes dos sócios precisam somar 100%.')
  }
  const mudou = mudancasConfig(atual as unknown as Record<string, unknown>, valor as unknown as Record<string, unknown>)
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: 'geral', valor }))
  await auditar(ctx, 'salvarConfig', 'geral', mudou.length ? mudou.join('; ') : r ? 'salvou sem mudança' : 'configuração criada')
  return { id: 'geral' }
}

// ---------- atributos do item (campos dinâmicos) ----------

/** Tipos de item com os campos atuais (do código + criados pela tela) e o que foi mudado. */
export async function atributosItem(ctx: Ctx, _p: object = {}) {
  const r = await ctx.repos.config.obter('atributosItem')
  const salvo = (r?.valor as Record<string, AtributosConfig>) ?? {}
  return ctx.modulos.todos().flatMap((m) =>
    m.tiposItem
      .filter((ti) => ti.controlaEstoque)
      .map((ti) => ({
        moduloId: m.id,
        tipoId: ti.id,
        nome: `${m.icone} ${m.nome} · ${ti.nome}`,
        padrao: ctx.modulos.camposPadrao(m.id, ti.id),
        config: salvo[`${m.id}:${ti.id}`] ?? { extras: [], ocultos: [], opcoes: {} },
      })),
  )
}

/**
 * Atributos sem programar: criar campo (texto, número, lista, sim/não), esconder campo que não usa e mudar as opções
 * das listas (ex.: nova cor). O que já foi gravado nos itens fica guardado mesmo se o campo for escondido.
 */
export async function salvarAtributos(ctx: Ctx, d: { moduloId: string; tipoId: string } & AtributosConfig) {
  const padrao = ctx.modulos.camposPadrao(d.moduloId, d.tipoId)
  exigir(padrao.length || ctx.modulos.tem(d.moduloId), 'Tipo de item não encontrado.')
  const ids = new Set(padrao.map((c) => c.id))
  const extras: CampoDef[] = []
  for (const c of d.extras) {
    exigir(c.nome?.trim(), 'Todo atributo precisa de nome.')
    const id = c.id || c.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
    exigir(id && !ids.has(id), `Já existe um atributo "${c.nome}".`)
    ids.add(id)
    const opcoes = c.tipo === 'lista' ? (c.opcoes ?? []).map((o) => o.trim()).filter(Boolean) : undefined
    if (c.tipo === 'lista') exigir(opcoes?.length, `Dê as opções de "${c.nome}".`)
    extras.push({ id, nome: c.nome.trim(), tipo: c.tipo, opcoes, unidade: c.unidade?.trim() || undefined, ajuda: c.ajuda?.trim() || undefined, obrigatorio: !!c.obrigatorio })
  }
  for (const id of d.ocultos) exigir(!padrao.find((c) => c.id === id)?.fixo, 'Esse atributo não pode ser escondido (o nome, o preço ou a separação dependem dele).')
  const opcoes: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(d.opcoes ?? {})) {
    const lista = [...new Set(v.map((o) => o.trim()).filter(Boolean))]
    if (lista.length && padrao.some((c) => c.id === k && c.tipo === 'lista')) opcoes[k] = lista
  }
  const r = await ctx.repos.config.obter('atributosItem')
  const valor = { ...((r?.valor as Record<string, AtributosConfig>) ?? {}), [`${d.moduloId}:${d.tipoId}`]: { extras, ocultos: d.ocultos, opcoes } }
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: 'atributosItem', valor }))
  ctx.modulos.definirAtributos(valor)
  await auditar(ctx, 'salvarAtributos', `${d.moduloId}:${d.tipoId}`, [...extras.map((c) => `+ ${c.nome}`), ...d.ocultos.map((c) => `− ${c}`)].join(', ') || 'opções')
  return { id: `${d.moduloId}:${d.tipoId}` }
}

// ---------- etapas da compra (personalizáveis) ----------

async function fluxosSalvos(ctx: Ctx) {
  const r = await ctx.repos.config.obter('fluxosCompra')
  return { r, valor: { ...((r?.valor as Record<string, FluxoCompraConfig>) ?? {}) } }
}

/** Etapas atuais de cada módulo que compra, quantos pedidos abertos há em cada etapa e o padrão do sistema. */
export async function fluxosCompra(ctx: Ctx, _p: object = {}) {
  const abertas = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => !['concluido', 'recusado', 'cancelado'].includes(t.etapa))
  return ctx.modulos
    .todos()
    .filter((m) => m.compra)
    .map((m) => ({
      moduloId: m.id,
      nome: m.nome,
      icone: m.icone,
      personalizado: !!m.compra!.personalizado,
      fluxo: { etapas: m.compra!.etapas, avisarParadaDias: m.compra!.avisarParadaDias, pedirComprovanteOrigem: !!m.compra!.pedirComprovanteOrigem, pedirFotos: m.compra!.pedirFotos !== false },
      emUso: Object.fromEntries(m.compra!.etapas.map((e) => [e.id, abertas.filter((t) => t.moduloId === m.id && t.etapa === e.id).length])),
    }))
}

/**
 * Muda as etapas da compra de um módulo: nomes, ordem, explicação, onde paga, o que lembrar e o que conta como "falta".
 * Regras: 2 a 10 etapas, nomes únicos, a última é sempre "entra no estoque" (id fixo), no máximo uma cobra pagamento,
 * e não dá para tirar uma etapa onde ainda há pedido parado. fluxo: null = volta ao padrão do sistema.
 */
export async function salvarFluxoCompra(ctx: Ctx, d: { moduloId: string; fluxo: FluxoCompraConfig | null }) {
  const padrao = ctx.modulos.fluxoPadrao(d.moduloId)
  exigir(padrao, 'Esse módulo não tem compras.')
  const { r, valor } = await fluxosSalvos(ctx)
  const atuais = ctx.modulos.obter(d.moduloId).compra!.etapas
  const novas = d.fluxo?.etapas ?? padrao.etapas
  const abertas = (await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => t.moduloId === d.moduloId)
  for (const e of atuais.filter((e) => !novas.some((n) => n.id === e.id))) {
    const n = abertas.filter((t) => t.etapa === e.id).length
    exigir(!n, `${n} pedido(s) estão em "${e.nome}": ande ou recuse esses pedidos antes de tirar a etapa.`)
  }
  if (!d.fluxo) delete valor[d.moduloId]
  else {
    const f = d.fluxo
    exigir(f.etapas.length >= 2 && f.etapas.length <= 10, 'Use de 2 a 10 etapas.')
    exigir(f.etapas.every((e) => e.nome?.trim() && /^[a-z0-9-]{1,30}$/.test(e.id)), 'Toda etapa precisa de nome.')
    exigir(new Set(f.etapas.map((e) => e.nome.trim().toLowerCase())).size === f.etapas.length, 'Há duas etapas com o mesmo nome.')
    exigir(new Set(f.etapas.map((e) => e.id)).size === f.etapas.length, 'Etapa repetida.')
    const ultima = f.etapas[f.etapas.length - 1]
    exigir(ultima.id === ETAPA_FINAL, 'A última etapa é sempre a que põe no estoque.')
    exigir(f.etapas.filter((e) => e.faz?.includes('estoque')).length === 1 && ultima.faz?.includes('estoque'), 'Só a última etapa põe no estoque.')
    exigir(f.etapas.filter((e) => e.faz?.includes('pagamento')).length <= 1, 'Só uma etapa cobra o pagamento.')
    exigir(Number.isInteger(f.avisarParadaDias) && f.avisarParadaDias >= 1 && f.avisarParadaDias <= 90, 'Avisar parada: de 1 a 90 dias.')
    valor[d.moduloId] = {
      etapas: f.etapas.map((e) => ({ id: e.id, nome: e.nome.trim(), ajuda: e.ajuda?.trim() ?? '', faz: e.faz?.length ? e.faz : undefined, lembrar: e.lembrar?.length ? e.lembrar : undefined })),
      avisarParadaDias: f.avisarParadaDias,
      pedirComprovanteOrigem: !!f.pedirComprovanteOrigem,
      pedirFotos: f.pedirFotos !== false,
    }
  }
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: 'fluxosCompra', valor }))
  ctx.modulos.definirFluxos(valor)
  await auditar(ctx, 'salvarFluxoCompra', d.moduloId, d.fluxo ? novas.map((e) => e.nome).join(' → ') : 'voltou ao padrão')
  return { id: d.moduloId }
}

/** Cria ou altera uma modalidade montada pela tela (recursos + campos). */
export async function salvarModulo(ctx: Ctx, d: ModuloConfig) {
  exigir(d.nome?.trim(), 'Dê um nome à modalidade.', 'nome')
  exigir(/^[a-z0-9-]{2,30}$/.test(d.id), 'Código inválido (use letras minúsculas, números e -).')
  exigir(!ctx.modulos.tem(d.id) || ctx.modulos.obter(d.id).personalizado, 'Esse código já é de um módulo do sistema.')
  for (const c of d.campos) exigir(c.id && c.nome?.trim(), 'Todo campo precisa de nome.')
  const r = await ctx.repos.config.obter('modulosPersonalizados')
  const lista = ((r?.valor as ModuloConfig[]) ?? []).filter((x) => x.id !== d.id)
  lista.push({ ...d, nome: d.nome.trim() })
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor: lista }) : novo(ctx, { id: 'modulosPersonalizados', valor: lista }))
  const cfg = await lerConfig(ctx)
  if (!cfg.modulosAtivos.includes(d.id)) await salvarConfig(ctx, { modulosAtivos: [...cfg.modulosAtivos, d.id] })
  ctx.modulos.definirPersonalizados(lista.map(moduloDeConfig))
  await auditar(ctx, 'salvarModulo', d.id, d.nome)
  return { id: d.id }
}

export async function registrarAnexo(ctx: Ctx, d: { id: Id; donoId: Id; categoria: CategoriaAnexo; nome: string; mime: string; tamanho: number }) {
  if (await ctx.repos.anexos.obter(d.id)) return { id: d.id }
  exigir(d.tamanho > 0 && d.tamanho <= 25_000_000, 'Arquivo grande demais (máximo 25 MB).')
  await ctx.repos.anexos.salvar(novo<Anexo>(ctx, d))
  await auditar(ctx, 'anexar', d.donoId, `${d.categoria}: ${d.nome}`)
  return { id: d.id }
}

export async function removerAnexo(ctx: Ctx, d: { id: Id }) {
  const a = await ctx.repos.anexos.obter(d.id)
  exigir(a, 'Anexo não encontrado.')
  await ctx.repos.anexos.salvar(tocar(ctx, { ...a, apagadoEm: ctx.relogio.agora() }))
  await auditar(ctx, 'removerAnexo', a.id, a.nome)
  return { id: a.id }
}

// ---------- consultas ----------

export async function configuracoes(ctx: Ctx, _p: object = {}) {
  const cfg = await lerConfig(ctx)
  const cot = await cotacoesAtuais(ctx)
  const hoje = ctx.relogio.hoje()
  const historico = (await ctx.repos.cotacoes.listar()).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  return {
    config: cfg,
    cotacoes: cot,
    cotacoesVenda: await cotacoesAtuais(ctx, 'venda'),
    cotacoesCompra: await cotacoesAtuais(ctx, 'compra'),
    historico,
    cotacaoVelha: Object.values(cot).some((c) => c && diasEntre(c.data, hoje) > cfg.diasCotacaoVelha),
    modulos: ctx.modulos.todos().map((m) => ({ id: m.id, nome: m.nome, icone: m.icone, descricao: m.descricao, personalizado: !!m.personalizado, recursos: m.recursos, temCompra: !!m.compra, temVenda: !!m.venda, pergunta: m.venda?.pergunta, telaPropria: m.telaPropria, etapas: (m.compra?.etapas ?? []).map((e) => ({ id: e.id, nome: e.nome, ajuda: e.ajuda, faz: e.faz ?? [] })), tiposItem: m.tiposItem.map((x) => ({ id: x.id, nome: x.nome, unidade: x.unidade, controlaEstoque: x.controlaEstoque, campos: x.campos })) })),
    personalizados: ((await ctx.repos.config.obter('modulosPersonalizados'))?.valor as ModuloConfig[]) ?? [],
  }
}

export async function pessoas(ctx: Ctx, p: { papel?: Papel; busca?: string } = {}) {
  const todas = await ctx.repos.pessoas.listar()
  const b = p.busca?.trim().toLowerCase()
  const func = ctx.sessao.perfil !== 'admin'
  return todas
    .map((x) => (func ? { ...x, salario: undefined, comissaoBp: undefined, documento: undefined } : x))
    .filter((x) => !p.papel || x.papeis.includes(p.papel))
    .filter((x) => !b || x.nome.toLowerCase().includes(b) || x.telefone?.includes(b))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function locais(ctx: Ctx, _p: object = {}) {
  return (await ctx.repos.locais.listar()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function anexosDe(ctx: Ctx, p: { donoId: Id }) {
  const anexos = await ctx.repos.anexos.listar({ donoId: p.donoId })
  // quem anexou (nome do usuário), para a lista de anexos mostrar "foto do pedido · 03/11 · Ana"
  const nomes = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u.nome]))
  return anexos.map((a) => ({ ...a, porNome: nomes.get(a.criadoPor) }))
}

/** Ficha 360° da pessoa: tudo o que ela comprou, vendeu, fez no salão, pegou emprestado. */
export async function fichaPessoa(ctx: Ctx, p: { id: Id }) {
  const pessoa = await ctx.repos.pessoas.obter(p.id)
  exigir(pessoa, 'Pessoa não encontrada.')
  const trans = (await ctx.repos.transacoes.listar()).filter((t) => t.pessoaId === pessoa.id || t.profissionalId === pessoa.id)
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const comoCliente = trans.filter((t) => t.tipo === 'venda' && t.pessoaId === pessoa.id)
  const comoFornecedor = trans.filter((t) => t.tipo === 'compra' && t.pessoaId === pessoa.id)
  const comoProfissional = trans.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && t.linhas.some((l) => l.profissionalId === pessoa.id))
  const concluidas = comoCliente.filter((t) => t.etapa === 'concluido')
  const cabeloColocado = concluidas.flatMap((t) =>
    t.linhas.filter((l) => itens.get(l.itemId!)?.unidade === 'grama').map((l) => ({ data: t.data, lote: l.descricao, loteId: l.itemId, gramas: l.quantidade })),
  )
  const emps = (await ctx.repos.emprestimos.listar()).filter((e) => e.pessoaId === pessoa.id)
  const emprestimos = []
  for (const e of emps) emprestimos.push({ ...e, ...(await situacaoDe(ctx, e)) })
  const timeline = [
    ...trans.map((t) => ({ data: t.data, quando: t.agendadoPara ?? t.criadoEm, tipo: t.tipo, id: t.id, texto: t.linhas.map((l) => l.descricao).join(', '), valor: t.totalPrincipal, etapa: t.etapa })),
    ...emps.map((e) => ({ data: e.inicio, quando: e.criadoEm, tipo: 'emprestimo' as const, id: e.id, texto: e.direcao === 'dado' ? 'Emprestei' : 'Peguei emprestado', valor: e.principal, etapa: e.situacao })),
  ].sort((a, b) => (a.quando < b.quando ? 1 : -1))
  const totalGasto = concluidas.reduce((s, t) => s + t.totalPrincipal, 0)
  return {
    pessoa,
    totalGasto,
    visitas: concluidas.length,
    ultimaVisita: concluidas.map((t) => t.data).sort().pop(),
    ticketMedio: concluidas.length ? Math.round(totalGasto / concluidas.length) : 0,
    comprasDela: comoFornecedor.filter((t) => t.etapa === 'concluido').reduce((s, t) => s + t.totalPrincipal, 0),
    gramasVendidas: comoFornecedor.filter((t) => t.etapa === 'concluido').reduce((s, t) => s + t.linhas.reduce((x, l) => x + l.quantidade, 0), 0),
    atendimentosFeitos: comoProfissional.length,
    comissao: comoProfissional.reduce((s, t) => s + t.linhas.filter((l) => l.profissionalId === pessoa.id).reduce((x, l) => x + (l.comissaoPrincipal ?? 0), 0), 0),
    cabeloColocado,
    emprestimos,
    timeline,
  }
}
