// AUDITORIA (tela #/auditoria, só administrador) — o registro BRUTO de toda ação: quando (com segundos), quem
// (nome e id do usuário), a ação (nome e código técnico), a área, o resumo, as REFERÊNCIAS (o registro afetado e os
// ligados: compra, venda, pacote, pessoa, viagem, adiantamento, empréstimo — cada um abre a sua tela) e as tentativas
// recusadas. O detalhe de um registro traz os campos crus e as outras ações sobre o mesmo registro.
// (logDetalhado continua para as fichas; esta é a visão de auditoria, com filtros e contagens.)
import type { Auditoria, Id } from '../domain/tipos'
import { exigir } from '../domain/erros'
import type { Ctx } from './contexto'
import { nomeAcao } from './historico'

export type CategoriaAuditoria = 'venda' | 'compra' | 'estoque' | 'viagens' | 'dinheiro' | 'pessoas' | 'acesso' | 'config' | 'recusa' | 'outros'

export const NOMES_CATEGORIA: Record<CategoriaAuditoria, { nome: string; icone: string }> = {
  venda: { nome: 'Vendas e agenda', icone: '💰' },
  compra: { nome: 'Compras', icone: '🛒' },
  estoque: { nome: 'Estoque e triagem', icone: '📦' },
  viagens: { nome: 'Viagens', icone: '🧳' },
  dinheiro: { nome: 'Dinheiro', icone: '💵' },
  pessoas: { nome: 'Pessoas', icone: '👤' },
  acesso: { nome: 'Acesso e usuários', icone: '🔒' },
  config: { nome: 'Configurações', icone: '⚙️' },
  recusa: { nome: 'Recusadas', icone: '⛔' },
  outros: { nome: 'Outros', icone: '•' },
}

/** a área de cada ação (pelo nome do comando) */
export function categoriaDe(acao: string): CategoriaAuditoria {
  if (acao === 'recusado') return 'recusa'
  if (/^(entrar|criarUsuario|alterarUsuario|trocarSenha|trocarMinhaSenha)/.test(acao)) return 'acesso'
  if (/Viagem|vincularCompras|desvincularCompra|desfazerLigacao|Cidade/.test(acao)) return 'viagens'
  if (/Compra|compra/.test(acao) && !/Codigo/.test(acao)) return 'compra'
  if (/Venda|venda|agendar|atender|Evento|Servico|Comissao|impostosEstimados/.test(acao)) return 'venda'
  if (/Lote|lote|Triagem|triar|Estoque|Etiqueta|Item|insumo|preco|TabelaPreco|Atributos/.test(acao)) return 'estoque'
  if (/Caixa|caixa|Lancamento|Dia$|Acerto|Conta|Emprestimo|Financiamento|Cotacao|Cambio|Salario/.test(acao)) return 'dinheiro'
  if (/Pessoa|anexar|Anexo/.test(acao)) return 'pessoas'
  if (/Config|Modulo|Fluxo|Form|Codigo|Sigla|Biblioteca|Categorias/.test(acao)) return 'config'
  return 'outros'
}

export interface RefAuditoria { tipo: string; tela: string; params: Record<string, string>; rotulo: string; id: Id }

/**
 * O QUE É CADA ID da lista inteira (vira referência clicável). Carrega cada coleção UMA vez e responde de memória:
 * antes, cada id ia ao banco até 7 vezes em sequência (compra? pacote? pessoa? …) — com 1000 linhas, milhares de
 * consultas a cada letra digitada na busca.
 */
async function resolvedorRefs(ctx: Ctx) {
  const [transacoes, itens, pessoas, viagens, financiamentos, emprestimos, usuarios] = await Promise.all([
    ctx.repos.transacoes.listar(), ctx.repos.itens.listar(), ctx.repos.pessoas.listar(), ctx.repos.viagens.listar(),
    ctx.repos.financiamentos.listar(), ctx.repos.emprestimos.listar(), ctx.repos.usuarios.listar(),
  ])
  const mapa = <T extends { id: Id }>(l: T[]) => new Map(l.map((x) => [x.id, x]))
  const tr = mapa(transacoes), it = mapa(itens), pe = mapa(pessoas), vg = mapa(viagens), fi = mapa(financiamentos), em = mapa(emprestimos), us = mapa(usuarios)
  return (id: Id): RefAuditoria | undefined => {
    const t = tr.get(id)
    if (t) return t.tipo === 'compra' ? { tipo: 'compra', tela: 'pedido', params: { id }, rotulo: t.codigo ?? 'Compra', id } : { tipo: 'venda', tela: 'venda', params: { id }, rotulo: t.codigo ?? 'Venda', id }
    const i = it.get(id)
    if (i) return { tipo: i.controlaEstoque ? 'pacote' : 'item', tela: i.controlaEstoque ? 'lote' : 'configSecao', params: i.controlaEstoque ? { id } : { id: 'catalogo' }, rotulo: i.codigo ?? i.nome, id }
    const p = pe.get(id)
    if (p) return { tipo: 'pessoa', tela: 'pessoa', params: { id }, rotulo: p.nome, id }
    const v = vg.get(id)
    if (v) return { tipo: 'viagem', tela: 'viagem', params: { id }, rotulo: v.codigo, id }
    const f = fi.get(id)
    if (f) return { tipo: 'adiantamento', tela: 'financiamento', params: { id }, rotulo: f.codigo, id }
    if (em.has(id)) return { tipo: 'empréstimo', tela: 'emprestimo', params: { id }, rotulo: 'Empréstimo', id }
    const u = us.get(id)
    if (u) return { tipo: 'usuário', tela: 'configSecao', params: { id: 'usuarios' }, rotulo: u.nome, id }
    return undefined
  }
}

/** as referências de um registro (o afetado e os ligados, sem repetir) */
const refsDe = (a: Auditoria, ref: (id: Id) => RefAuditoria | undefined) =>
  [...new Set([a.alvoId, ...(a.ligados ?? [])].filter((x): x is Id => !!x))].map(ref).filter((r): r is RefAuditoria => !!r)

/** o que é UM id (o detalhe de um registro: poucos ids, vai direto ao banco) */
async function referencia(ctx: Ctx, id: Id, cache: Map<Id, RefAuditoria | null>): Promise<RefAuditoria | undefined> {
  if (cache.has(id)) return cache.get(id) ?? undefined
  let r: RefAuditoria | undefined
  const tr = await ctx.repos.transacoes.obter(id)
  if (tr) r = tr.tipo === 'compra' ? { tipo: 'compra', tela: 'pedido', params: { id }, rotulo: tr.codigo ?? 'Compra', id } : { tipo: 'venda', tela: 'venda', params: { id }, rotulo: tr.codigo ?? 'Venda', id }
  const it = r ? undefined : await ctx.repos.itens.obter(id)
  if (it) r = { tipo: it.controlaEstoque ? 'pacote' : 'item', tela: it.controlaEstoque ? 'lote' : 'configSecao', params: it.controlaEstoque ? { id } : { id: 'catalogo' }, rotulo: it.codigo ?? it.nome, id }
  const pe = r ? undefined : await ctx.repos.pessoas.obter(id)
  if (pe) r = { tipo: 'pessoa', tela: 'pessoa', params: { id }, rotulo: pe.nome, id }
  const vg = r ? undefined : await ctx.repos.viagens.obter(id)
  if (vg) r = { tipo: 'viagem', tela: 'viagem', params: { id }, rotulo: vg.codigo, id }
  const fi = r ? undefined : await ctx.repos.financiamentos.obter(id)
  if (fi) r = { tipo: 'adiantamento', tela: 'financiamento', params: { id }, rotulo: fi.codigo, id }
  const em = r ? undefined : await ctx.repos.emprestimos.obter(id)
  if (em) r = { tipo: 'empréstimo', tela: 'emprestimo', params: { id }, rotulo: 'Empréstimo', id }
  const us = r ? undefined : await ctx.repos.usuarios.obter(id)
  if (us) r = { tipo: 'usuário', tela: 'configSecao', params: { id: 'usuarios' }, rotulo: us.nome, id }
  cache.set(id, r ?? null)
  return r
}

const ehAdmin = (ctx: Ctx) => exigir(ctx.sessao.perfil === 'admin', 'Sem permissão para ver isso.')
const visiveis = (a: Auditoria) => a.acao !== 'tabelaPrecoAnterior' && a.acao !== 'tabelaPrecoVersao'

/** a lista da auditoria, com os filtros e as contagens para os chips */
export async function auditoria(ctx: Ctx, p: { de?: string; ate?: string; usuarioId?: Id; acao?: string; categoria?: CategoriaAuditoria; busca?: string; alvoId?: Id; limite?: number } = {}) {
  ehAdmin(ctx)
  const b = p.busca?.trim().toLowerCase()
  const usuarios = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u]))
  const noPeriodo = (await ctx.repos.auditoria.listar()).filter(visiveis)
    .filter((a) => (!p.de || a.criadoEm.slice(0, 10) >= p.de) && (!p.ate || a.criadoEm.slice(0, 10) <= p.ate))
  // os filtros que não são a área (para a contagem de cada área ficar certa)
  const semArea = noPeriodo
    .filter((a) => !p.usuarioId || a.criadoPor === p.usuarioId)
    .filter((a) => !p.acao || a.acao === p.acao)
    .filter((a) => !p.alvoId || a.alvoId === p.alvoId || !!a.ligados?.includes(p.alvoId))
    .filter((a) => !b || [a.resumo, a.usuarioNome, nomeAcao(a.acao), a.acao, a.alvoId, a.id].some((x) => x?.toLowerCase().includes(b)))
  const filtrados = semArea.filter((a) => !p.categoria || categoriaDe(a.acao) === p.categoria).sort((a, c) => (a.criadoEm < c.criadoEm ? 1 : -1))
  const ref = await resolvedorRefs(ctx)
  const linhas = []
  for (const a of filtrados.slice(0, p.limite ?? 1000)) {
    const refs = refsDe(a, ref)
    linhas.push({ id: a.id, em: a.criadoEm, usuarioId: a.criadoPor, usuarioNome: a.usuarioNome ?? usuarios.get(a.criadoPor)?.nome ?? a.criadoPor, perfil: usuarios.get(a.criadoPor)?.perfil, acao: a.acao, nomeAcao: nomeAcao(a.acao), categoria: categoriaDe(a.acao), resumo: a.resumo, alvoId: a.alvoId, refs })
  }
  const contar = <K extends string>(lista: Auditoria[], k: (a: Auditoria) => K) => {
    const m = new Map<K, number>()
    for (const a of lista) m.set(k(a), (m.get(k(a)) ?? 0) + 1)
    return m
  }
  const porArea = contar(semArea, (a) => categoriaDe(a.acao))
  const porUsuario = contar(noPeriodo, (a) => a.criadoPor)
  const porAcao = contar(noPeriodo, (a) => a.acao)
  const hoje = ctx.relogio.hoje()
  return {
    linhas,
    total: filtrados.length,
    noPeriodo: noPeriodo.length,
    recusadas: noPeriodo.filter((a) => a.acao === 'recusado').length,
    hoje: noPeriodo.filter((a) => a.criadoEm.slice(0, 10) === hoje).length,
    categorias: (Object.keys(NOMES_CATEGORIA) as CategoriaAuditoria[]).map((id) => ({ id, ...NOMES_CATEGORIA[id], n: porArea.get(id) ?? 0 })).filter((c) => c.n > 0 || c.id === p.categoria),
    // TODOS os usuários cadastrados (quem não agiu no período vem com 0) + quem agiu sem ser usuário (ex.: "Sistema")
    usuarios: [...new Set([...usuarios.keys(), ...porUsuario.keys()])]
      .map((id) => ({ id, nome: usuarios.get(id)?.nome ?? noPeriodo.find((a) => a.criadoPor === id)?.usuarioNome ?? id, perfil: usuarios.get(id)?.perfil, ativo: usuarios.get(id)?.ativo, n: porUsuario.get(id) ?? 0 }))
      .sort((a, c) => c.n - a.n || a.nome.localeCompare(c.nome, 'pt-BR')),
    /** quantas pessoas agiram no período */
    agiram: porUsuario.size,
    acoes: [...porAcao.entries()].map(([id, n]) => ({ id, nome: nomeAcao(id), n })).sort((a, c) => a.nome.localeCompare(c.nome, 'pt-BR')),
  }
}

/** um registro da auditoria por inteiro: os campos crus, as referências e as outras ações sobre o mesmo registro */
export async function registroAuditoria(ctx: Ctx, p: { id: Id }) {
  ehAdmin(ctx)
  const todos = (await ctx.repos.auditoria.listar()).filter(visiveis)
  const a = todos.find((x) => x.id === p.id)
  exigir(a, 'Registro não encontrado.')
  const u = await ctx.repos.usuarios.obter(a.criadoPor)
  const cache = new Map<Id, RefAuditoria | null>()
  const refs: RefAuditoria[] = []
  for (const id of [...new Set([a.alvoId, ...(a.ligados ?? [])].filter((x): x is Id => !!x))]) {
    const r = await referencia(ctx, id, cache)
    if (r) refs.push(r)
  }
  const mesmoAlvo = a.alvoId
    ? todos.filter((x) => x.id !== a.id && (x.alvoId === a.alvoId || x.ligados?.includes(a.alvoId!))).sort((x, y) => (x.criadoEm < y.criadoEm ? 1 : -1)).slice(0, 30)
      .map((x) => ({ id: x.id, em: x.criadoEm, usuarioNome: x.usuarioNome ?? x.criadoPor, nomeAcao: nomeAcao(x.acao), categoria: categoriaDe(x.acao), resumo: x.resumo }))
    : []
  return {
    registro: { id: a.id, em: a.criadoEm, acao: a.acao, nomeAcao: nomeAcao(a.acao), categoria: categoriaDe(a.acao), resumo: a.resumo, usuarioId: a.criadoPor, usuarioNome: a.usuarioNome ?? u?.nome ?? a.criadoPor, perfil: u?.perfil, login: u?.login, alvoId: a.alvoId, ligados: a.ligados ?? [] },
    refs,
    mesmoAlvo,
    /** o registro como está guardado (para conferir na auditoria) */
    bruto: a,
  }
}
