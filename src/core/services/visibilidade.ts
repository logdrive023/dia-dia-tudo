// O QUE A FUNCIONÁRIA VÊ — um lugar só, para TODA consulta e todo comando que não é do administrador.
// Regra do dono: "a funcionária do salão NÃO PODE DE NENHUMA FORMA ver o que ela não pode ver".
//
// O backend chama isto antes e depois de cada consulta (e antes de alguns comandos) quando o perfil não é admin;
// com a API, o servidor usa o mesmo arquivo (a tela nunca decide sozinha o que mostrar).
//
//   1. CAMPOS que nunca saem: custo, insumo, comissão de outra pessoa, salário, documento, fornecedor, margem,
//      sócias, câmbio de compra… (tirados em qualquer profundidade da resposta: rede de segurança)
//   2. DE QUEM é o registro: venda só a dela (ou da equipe, se tiver "agenda da equipe"); ficha só de cliente ou
//      dela mesma; anexos só do que ela pode ver; pessoas = clientes + ela + a equipe (só o nome)
//   3. NÚMEROS dos outros: organograma e calendário sem faturamento/valor de quem não é ela
import type { Id, Pessoa, Transacao } from '../domain/tipos'
import { visiveis } from './agenda'
import { exigir } from '../domain/erros'
import { type Ctx, ehAdmin, ehEquipe, euPessoa, lerConfig } from './contexto'

/** campos que a funcionária nunca recebe (em qualquer nível da resposta) */
const SENSIVEIS = new Set([
  'custoPrincipal', 'custoTotal', 'custoMedio', 'custoKg', 'custoGrama', 'custoBruto', 'custos',
  'insumo', 'insumoPrincipal', 'insumos', 'insumoMotivo', 'baseComissao', 'parteSalao', 'comissaoRegra',
  'comissaoBp', 'comissaoPrincipal', 'salario', 'salarioPrincipal', 'documento',
  'fornecedor', 'fornecedorId', 'fornecedorNome', 'valorCompras', 'comprasDela',
  'margem', 'lucro', 'lucroPrincipal', 'cotacoesCompra',
])
/** campos da linha do atendimento que só a dona da linha vê */
const DA_LINHA = ['comissaoBp', 'comissaoPrincipal', 'insumo', 'insumoPrincipal', 'insumos', 'insumoMotivo', 'baseComissao']
/** tira da linha de outra profissional a comissão e os insumos */
function linhasSoMinhas<T extends { linhas?: { profissionalId?: Id }[]; profissionalId?: Id }>(t: T, eu: Id): T {
  if (!Array.isArray(t?.linhas)) return t
  return { ...t, linhas: t.linhas.map((l) => ((l.profissionalId ?? t.profissionalId) === eu ? l : Object.fromEntries(Object.entries(l).filter(([k]) => !DA_LINHA.includes(k))))) } as T
}
/**
 * "Divisão interna" da venda (comissão e insumos da linha): só quando a linha tem divisão de verdade e quem está logado
 * é o administrador ou a profissional DONA da linha. A tela usa isto; `venda` já tira a comissão das colegas da resposta.
 */
export function podeVerDivisao(s: { perfil?: string; pessoaId?: Id; usuarioId?: Id }, l: { profissionalId?: Id; comissaoBp?: number; insumoPrincipal?: number }) {
  if (!l.comissaoBp && !l.insumoPrincipal) return false
  return s.perfil === 'admin' || (!!l.profissionalId && l.profissionalId === (s.pessoaId ?? s.usuarioId))
}

/** o que é dela mesma: a comissão e o salário DELA aparecem */
const PROPRIOS: Partial<Record<string, string[]>> = {
  comissoes: ['comissaoPrincipal', 'comissaoBp', 'baseComissao'],
  resumoFuncionario: ['salario', 'salarioPrincipal', 'comissaoBp', 'comissaoPrincipal'],
  // no atendimento DELA: a comissão e os insumos que ela lançou (a conta da comissão); das colegas, nada (tirado antes)
  venda: DA_LINHA,
  agenda: DA_LINHA,
}

function limpar(v: unknown, manter: Set<string>, vistos = new WeakSet<object>()): unknown {
  if (Array.isArray(v)) return v.map((x) => limpar(x, manter, vistos))
  if (!v || typeof v !== 'object' || v instanceof Blob || v instanceof Date) return v
  if (vistos.has(v as object)) return v
  vistos.add(v as object)
  const o: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!SENSIVEIS.has(k) || manter.has(k)) o[k] = limpar(x, manter, vistos)
  return o
}

const ehCliente = (p?: Pessoa) => !!p?.papeis.includes('cliente')
const SEM = 'Sem permissão para ver isso.'

async function mapaPessoas(ctx: Ctx) {
  return new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
}

/** a venda/atendimento é dela (ou de uma colega que ela pode ver pela agenda da equipe)? */
export async function vendaVisivel(ctx: Ctx, t: Transacao | undefined) {
  if (ehAdmin(ctx)) return true
  if (!t || t.tipo !== 'venda') return false
  const eu = euPessoa(ctx)
  if (t.criadoPor === ctx.sessao.usuarioId || t.profissionalId === eu || t.linhas.some((l) => l.profissionalId === eu)) return true
  const vis = await visiveis(ctx, await mapaPessoas(ctx))
  return !!vis && (!!(t.profissionalId && vis.has(t.profissionalId)) || t.linhas.some((l) => !!l.profissionalId && vis.has(l.profissionalId)))
}

/** a pessoa é cliente (ou ela mesma)? — o que a funcionária pode abrir e editar */
async function pessoaVisivel(ctx: Ctx, id: Id) {
  if (id === euPessoa(ctx)) return true
  return ehCliente(await ctx.repos.pessoas.obter(id))
}

/** o dono de um anexo é algo que ela pode ver? (venda dela, cliente, ela mesma, um pacote para vender) */
async function donoVisivel(ctx: Ctx, donoId: Id) {
  const t = await ctx.repos.transacoes.obter(donoId)
  if (t) return vendaVisivel(ctx, t)
  if (await ctx.repos.pessoas.obter(donoId)) return pessoaVisivel(ctx, donoId)
  return !!(await ctx.repos.itens.obter(donoId))
}

/** ANTES da consulta: confere de quem é e pode trocar o pedido (ex.: conflitos só da própria agenda) */
/**
 * TELAS QUE O ADMIN LIBERA (Configurações › O que a funcionária faz → config.funcionariaTelas): as consultas e os
 * comandos de cada tela só respondem à funcionária com a tela ligada — a tela esconder não basta (a API recusa também).
 * 'pessoas' protege a FICHA; a lista de pessoas continua (é o seletor de cliente da venda, já filtrado acima).
 */
const DA_TELA: Record<string, string> = {
  viagens: 'viagens', painelViajante: 'viagens', categoriasViagem: 'viagens', registrarDespesaViagem: 'viagens', anularDespesaViagem: 'viagens',
  financiamentos: 'adiantamentos', financiamento: 'adiantamentos',
  fichaPessoa: 'pessoas',
}
async function exigirTelaLiberada(ctx: Ctx, nome: string) {
  const tela = DA_TELA[nome]
  if (!tela) return
  exigir((await lerConfig(ctx)).funcionariaTelas.includes(tela), SEM)
}

export async function antesDaConsulta(ctx: Ctx, nome: string, p: Record<string, unknown>): Promise<Record<string, unknown> | 'vazio'> {
  if (ehAdmin(ctx)) return p
  await exigirTelaLiberada(ctx, nome)
  switch (nome) {
    case 'venda':
      exigir(await vendaVisivel(ctx, await ctx.repos.transacoes.obter(p.id as Id)), SEM)
      return p
    case 'fichaPessoa':
      exigir(await pessoaVisivel(ctx, p.id as Id), SEM)
      return p
    case 'anexosDe':
      return (await donoVisivel(ctx, p.donoId as Id)) ? p : 'vazio'
    case 'conflitosAgenda': {
      const vis = await visiveis(ctx, await mapaPessoas(ctx))
      return vis && !vis.has(p.profissionalId as Id) ? { ...p, profissionalId: euPessoa(ctx) } : p
    }
  }
  return p
}

/** DEPOIS da consulta: tira os campos e os números que não são dela */
export async function depoisDaConsulta(ctx: Ctx, nome: string, _p: Record<string, unknown>, r: unknown): Promise<unknown> {
  if (ehAdmin(ctx)) return r
  const eu = euPessoa(ctx)
  type X = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  let x = r as X
  switch (nome) {
    case 'configuracoes':
      // sócias, ajustes do câmbio e o histórico das cotações (com as de compra) são do administrador
      x = { ...x, config: { ...(x.config as object), socios: [], cambio: {} }, historico: [], personalizados: [] } as X
      break
    case 'pessoas': {
      // clientes (para vender) + ela + a equipe só com o nome; fornecedoras, sócias, devedores… ficam de fora
      const lista = (r as Pessoa[]).filter((q) => ehCliente(q) || q.id === eu || ehEquipe(q))
      x = lista.map((q) => (ehCliente(q) || q.id === eu ? { ...q, papeis: q.id === eu ? q.papeis : q.papeis.filter((pp) => pp === 'cliente' || pp === 'profissional' || pp === 'funcionario') } : { id: q.id, nome: q.nome, papeis: q.papeis.filter((pp) => pp === 'profissional' || pp === 'funcionario'), localId: q.localId, ativo: (q as { ativo?: boolean }).ativo })) as unknown as X
      break
    }
    case 'fichaPessoa': {
      const minha = (x.pessoa as Pessoa | undefined)?.id === eu
      if (!minha)
        x = {
          ...x,
          gramasVendidas: 0,
          atendimentosFeitos: 0,
          emprestimos: [],
          // só o que ela fez como CLIENTE (nada de compra de fornecedor nem empréstimo)
          timeline: ((x.timeline as { tipo: string }[]) ?? []).filter((e) => e.tipo === 'venda'),
          pessoa: { ...(x.pessoa as Pessoa), papeis: (x.pessoa as Pessoa).papeis.filter((pp) => pp === 'cliente') },
        } as X
      break
    }
    case 'venda': {
      const c = x.cliente as Pessoa | undefined
      const pr = x.profissional as Pessoa | undefined
      x = { ...x, venda: linhasSoMinhas(x.venda as Transacao, eu), cliente: c ? { id: c.id, nome: c.nome, telefone: c.telefone } : undefined, profissional: pr ? { id: pr.id, nome: pr.nome } : undefined, viagens: [] } as X
      break
    }
    case 'organograma': {
      type No = { pessoa: Pessoa; atendimentos: number; faturamento: number; subordinados: No[] }
      const so = (n: No): No => (n.pessoa.id === eu ? { ...n, subordinados: n.subordinados.map(so) } : { ...n, pessoa: { id: n.pessoa.id, nome: n.pessoa.nome, cargo: n.pessoa.cargo, papeis: n.pessoa.papeis, localId: n.pessoa.localId } as Pessoa, atendimentos: 0, faturamento: 0, subordinados: n.subordinados.map(so) })
      x = { ...x, raizes: (x.raizes as No[]).map(so) } as X
      break
    }
    case 'resumoFuncionario': {
      const s = x?.superior as Pessoa | undefined
      if (x) x = { ...x, superior: s ? { id: s.id, nome: s.nome, cargo: s.cargo } : undefined } as X
      break
    }
    case 'estoque':
    case 'catalogo':
      // o pacote para VENDER: códigos, nome, peso, foto e situação. De quem foi comprado (e a busca por fornecedor), não
      x = (r as Record<string, unknown>[]).map((i) => {
        const o = (i.origem ?? undefined) as Record<string, unknown> | undefined
        const compras = Array.isArray(i.compras) ? (i.compras as { id: Id; codigo?: string }[]).map((c) => ({ id: c.id, codigo: c.codigo })) : undefined
        const codigos = [i.codigo, ...((i.codigosAnteriores as string[]) ?? []), ...(compras ?? []).map((c) => c.codigo), (i.pai as { codigo?: string } | undefined)?.codigo]
        return { ...i, origem: o ? { ...o, pessoaId: undefined } : undefined, compras, cadeia: undefined, ...('busca' in i ? { busca: codigos.filter(Boolean).join(' ').toLowerCase() } : {}) }
      }) as unknown as X
      break
    case 'agenda':
      x = (r as Transacao[]).map((t) => linhasSoMinhas(t, eu)) as unknown as X
      break
    case 'calendario':
      // atendimento de colega (agenda da equipe): o horário e a cliente aparecem; o valor não
      x = (r as { tipo: string; pessoaId?: Id }[]).map((i) => (i.tipo === 'atendimento' && i.pessoaId && i.pessoaId !== eu ? { ...i, valor: undefined, falta: undefined } : i)) as unknown as X
      break
    case 'vendas': {
      // a lista de vendas (tela Vender): só as da bolha dela (as dela; a gerente com "agenda da equipe", também as das
      // colegas que ela vê) — a mesma regra da venda aberta uma a uma (vendaVisivel). Viagens são do admin.
      const lista = r as { id: Id }[]
      const ok = await Promise.all(lista.map(async (v) => vendaVisivel(ctx, await ctx.repos.transacoes.obter(v.id))))
      x = lista.filter((_, k) => ok[k]).map((v) => ({ ...linhasSoMinhas(v as { linhas?: { profissionalId?: Id }[] }, eu), viagens: [] })) as unknown as X
      break
    }
    case 'lerCodigoPacote':
      // pacote já vendido: para quem foi não é da conta dela
      if (Array.isArray(x?.vendas)) x = { ...x, vendas: (x.vendas as object[]).map((v) => ({ ...v, cliente: undefined })) } as X
      break
  }
  return limpar(x, new Set(PROPRIOS[nome] ?? []))
}

/** ANTES de um comando: o que ela pode mudar (a lista de comandos já diz QUAIS; aqui é EM QUÊ) */
export async function antesDoComando(ctx: Ctx, nome: string, d: Record<string, unknown>) {
  if (ehAdmin(ctx)) return
  await exigirTelaLiberada(ctx, nome)
  switch (nome) {
    case 'salvarPessoa': {
      // funcionária cadastra e edita CLIENTES (e os dados dela); fornecedora, sócia, colega: só o administrador
      const existente = await ctx.repos.pessoas.obter(d.id as Id)
      if (existente) exigir(existente.id === euPessoa(ctx) || ehCliente(existente), 'Só o administrador edita esta pessoa.')
      else exigir(((d.papeis as string[]) ?? []).every((pp) => pp === 'cliente'), 'Só o administrador cadastra quem não é cliente.')
      return
    }
    case 'registrarAnexo':
    case 'definirMiniatura':
      if (d.donoId) exigir(await donoVisivel(ctx, d.donoId as Id), 'Sem permissão para isso. Peça a um administrador.')
      return
  }
}
