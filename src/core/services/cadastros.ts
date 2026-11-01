// Pessoas, locais, cotações, configurações e anexos (metadados; o arquivo em si vai pela porta de arquivos).

import { MOEDAS, type CodigoMoeda } from '../domain/dinheiro'
import { textoCotacao, valorDeUm, type UsoCambio } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import { diasEntre } from '../domain/datas'
import type { Anexo, CategoriaAnexo, CotacaoRegistro, Id, Local, Papel, Pessoa } from '../domain/tipos'
import { auditar, type Configuracoes, type Ctx, cotacoesAtuais, lerConfig, novo, tocar } from './contexto'
import { situacaoDe } from './emprestimos'
import { type ModuloConfig, moduloDeConfig } from '../modulosConfig'

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
  },
) {
  exigir(d.nome?.trim(), 'Diga o nome.', 'nome')
  exigir(d.papeis?.length, 'Escolha pelo menos um papel (cliente, fornecedor…).', 'papeis')
  const tel = d.telefone?.replace(/[^\d+]/g, '') || undefined
  if (d.comissaoBp !== undefined) exigir(Number.isInteger(d.comissaoBp) && d.comissaoBp >= 0 && d.comissaoBp <= 10000, 'Comissão entre 0% e 100%.')
  const existente = await ctx.repos.pessoas.obter(d.id)
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
  }
  // só muda o que a tela mandou (editar pela Equipe não apaga documento nem observação)
  const dados = Object.fromEntries(Object.entries(novos).filter(([k]) => k === 'nome' || k === 'papeis' || k in d)) as Partial<Pessoa> & { nome: string; papeis: Papel[] }
  if (ctx.sessao.perfil !== 'admin') {
    // funcionária cadastra e edita clientes, mas não comissão, salário, acesso, chefe, cargo nem unidade
    for (const k of ['comissaoBp', 'salario', 'acesso', 'superiorId', 'cargo'] as const) delete dados[k]
    if (existente) delete dados.localId
    exigir(!d.papeis.some((p) => p === 'funcionario' || p === 'socio') || existente?.papeis.some((p) => p === 'funcionario' || p === 'socio'), 'Só o administrador cadastra funcionários.')
  }
  if (existente) await ctx.repos.pessoas.salvar(tocar(ctx, { ...existente, ...dados }))
  else await ctx.repos.pessoas.salvar(novo<Pessoa>(ctx, { id: d.id, ...dados } as Parameters<typeof novo<Pessoa>>[1]))
  await auditar(ctx, 'salvarPessoa', d.id, dados.nome)
  return { id: d.id }
}

export async function salvarLocal(ctx: Ctx, d: Omit<Local, keyof import('../domain/tipos').Base> & { id: Id }) {
  exigir(d.nome?.trim(), 'Dê um nome ao local.', 'nome')
  const existente = await ctx.repos.locais.obter(d.id)
  if (existente) await ctx.repos.locais.salvar(tocar(ctx, { ...existente, ...d, nome: d.nome.trim() }))
  else await ctx.repos.locais.salvar(novo<Local>(ctx, { ...d, nome: d.nome.trim() }))
  return { id: d.id }
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

export async function salvarConfig(ctx: Ctx, d: Partial<Configuracoes>) {
  const atual = await lerConfig(ctx)
  const valor = { ...atual, ...d }
  exigir(valor.moedasAtivas.includes(valor.moedaPrincipal), 'A moeda principal precisa estar ativa.')
  if (valor.moedaPrincipal !== atual.moedaPrincipal && (await ctx.repos.transacoes.listar()).length)
    exigir(false, 'Já existem vendas/compras na moeda principal atual: trocar agora misturaria moedas nos totais. Faça um backup e comece de novo para trocar.')
  if (valor.socios.length) {
    exigir(valor.socios.every((x) => x.nome.trim() && Number.isInteger(x.parteBp) && x.parteBp > 0), 'Cada sócio precisa de nome e parte.')
    exigir(valor.socios.reduce((s, x) => s + x.parteBp, 0) === 10000, 'As partes dos sócios precisam somar 100%.')
  }
  const r = await ctx.repos.config.obter('geral')
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id: 'geral', valor }))
  return { id: 'geral' }
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
  return ctx.repos.anexos.listar({ donoId: p.donoId })
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
