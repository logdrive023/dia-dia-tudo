// LOG DETALHADO e LINHA DO TEMPO: tudo o que aconteceu, quem fez e quando.
// "Pedido entrou dia X com Y, Z · fulana conferiu · ciclana pagou · entrou no estoque · vendido para…"

import type { Id } from '../domain/tipos'
import type { Ctx } from './contexto'

export interface EventoTempo {
  em: string
  titulo: string
  detalhe?: string
  por?: string
  tipo: 'etapa' | 'acao' | 'anexo' | 'estoque' | 'caixa' | 'conta'
  ref?: { tela: string; id: Id }
}

const NOMES_ACAO: Record<string, string> = {
  criarCompra: 'Pedido de compra registrado',
  avancarTriagem: 'Etapa da triagem',
  cancelarCompra: 'Compra cancelada',
  concluirVenda: 'Venda concluída',
  agendar: 'Atendimento agendado',
  atenderAgendamento: 'Atendimento feito',
  cancelarVenda: 'Venda cancelada',
  corrigirVenda: 'Venda corrigida',
  pagarComissao: 'Comissão paga',
  criarUsuario: 'Usuário criado',
  alterarUsuario: 'Usuário alterado',
  trocarSenha: 'Senha trocada',
  entrar: 'Entrou no sistema',
  separarLote: 'Lote separado',
  ajustarEstoque: 'Estoque ajustado',
  salvarItem: 'Item salvo',
  lancarCaixa: 'Lançamento no caixa',
  estornarLancamento: 'Lançamento desfeito',
  encerrarDia: 'Dia encerrado',
  reabrirDia: 'Dia reaberto',
  registrarAcerto: 'Acerto de conta',
  ajustarConta: 'Ajuste de conta',
  criarEmprestimo: 'Empréstimo criado',
  pagarEmprestimo: 'Pagamento de empréstimo',
  salvarPessoa: 'Cadastro de pessoa',
  salvarTabelaPreco: 'Tabela de preço salva',
  tabelaPrecoAnterior: 'Versão anterior da tabela',
  salvarCotacao: 'Cotação salva',
  pagarSalario: 'Salário pago',
  anexar: 'Arquivo anexado',
  removerAnexo: 'Anexo removido',
  salvarModulo: 'Modalidade salva',
}

export function nomeAcao(a: string) {
  return NOMES_ACAO[a] ?? a
}

/** Linha do tempo de qualquer coisa: pedido (compra/venda), lote, pessoa, empréstimo. */
export async function linhaDoTempo(ctx: Ctx, p: { id: Id }) {
  const eventos: EventoTempo[] = []
  const t = await ctx.repos.transacoes.obter(p.id)
  const log = (await ctx.repos.auditoria.listar()).filter((a) => a.alvoId === p.id || a.ligados?.includes(p.id))
  if (t) {
    const nomesEtapa = new Map<string, string>()
    if (ctx.modulos.tem(t.moduloId)) for (const e of ctx.modulos.obter(t.moduloId).compra?.etapas ?? []) nomesEtapa.set(e.id, e.nome)
    const nomeEtapa = (id: string) =>
      nomesEtapa.get(id) ?? ({ agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado', recusado: 'Recusado' } as Record<string, string>)[id] ?? id
    for (const h of t.historico)
      eventos.push({
        em: h.em,
        tipo: 'etapa',
        por: h.porNome,
        titulo:
          h.tipo === 'correcao'
            ? `Venda corrigida${h.totalAntes !== undefined ? `: ${(h.totalAntes / 100).toLocaleString('pt-BR')} → ${(h.totalDepois! / 100).toLocaleString('pt-BR')}` : ''}`
            : h.de
              ? `${nomeEtapa(h.de)} → ${nomeEtapa(h.para)}`
              : `${t.tipo === 'compra' ? 'Pedido entrou' : 'Venda registrada'}: ${nomeEtapa(h.para)}`,
        detalhe: [h.de ? '' : t.linhas.map((l) => `${l.descricao} · ${l.quantidade.toLocaleString('pt-BR')}`).join(' + '), h.motivo, ...(h.ajustes ?? [])].filter(Boolean).join(' · '),
      })
    for (const m of await ctx.repos.movCaixa.listar({ origemId: t.id }))
      eventos.push({ em: m.criadoEm, tipo: 'caixa', titulo: m.descricao, detalhe: `${m.delta > 0 ? '+' : ''}${m.delta / 100} ${m.moeda} · ${m.forma}` })
    for (const m of await ctx.repos.movEstoque.listar({ origemId: t.id })) {
      const item = await ctx.repos.itens.obter(m.itemId)
      eventos.push({ em: m.criadoEm, tipo: 'estoque', titulo: `${m.delta > 0 ? 'Entrou no estoque' : 'Saiu do estoque'}: ${item?.codigo ?? ''} ${item?.nome ?? ''}`, detalhe: `${m.delta > 0 ? '+' : ''}${m.delta.toLocaleString('pt-BR')} (${m.saldoAntes} → ${m.saldoDepois})`, ref: { tela: 'lote', id: m.itemId } })
    }
    // vendas que saíram dos lotes desta compra (destino)
    const lotes = (await ctx.repos.itens.listar()).filter((i) => i.origem?.id === t.id || i.origem?.compraId === t.id)
    if (lotes.length) {
      const ids = new Set(lotes.map((l) => l.id))
      for (const v of (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((v) => v.etapa === 'concluido' && v.linhas.some((l) => ids.has(l.itemId!)))) {
        const pessoa = v.pessoaId ? await ctx.repos.pessoas.obter(v.pessoaId) : undefined
        const gramas = v.linhas.filter((l) => ids.has(l.itemId!)).reduce((s, l) => s + l.quantidade, 0)
        const quem = v.historico.find((h) => h.para === 'concluido')?.porNome
        eventos.push({ em: v.criadoEm, tipo: 'acao', titulo: `Vendido para ${pessoa?.nome ?? 'cliente'} (${v.data.split('-').reverse().join('/')})`, detalhe: `${gramas.toLocaleString('pt-BR')} desta compra`, por: quem, ref: { tela: 'venda', id: v.id } })
      }
    }
  }
  for (const a of log.filter((x) => !(t && (x.acao === 'avancarTriagem' || x.acao === 'criarCompra' || x.acao === 'concluirVenda' || x.acao === 'agendar' || x.acao === 'corrigirVenda'))))
    eventos.push({ em: a.criadoEm, tipo: a.acao === 'anexar' ? 'anexo' : 'acao', titulo: nomeAcao(a.acao), detalhe: a.acao === 'tabelaPrecoAnterior' ? undefined : a.resumo, por: a.usuarioNome })
  for (const an of await ctx.repos.anexos.listar({ donoId: p.id })) if (!log.some((a) => a.acao === 'anexar' && a.resumo.endsWith(an.nome))) eventos.push({ em: an.criadoEm, tipo: 'anexo', titulo: 'Arquivo anexado', detalhe: an.nome })
  return eventos.sort((a, b) => (a.em < b.em ? -1 : 1))
}

/** Log de tudo, com filtros (quem, o quê, quando). */
export async function logDetalhado(ctx: Ctx, p: { de?: string; ate?: string; usuarioId?: Id; acao?: string; busca?: string; limite?: number }) {
  const b = p.busca?.trim().toLowerCase()
  const todos = (await ctx.repos.auditoria.listar())
    .filter((a) => a.acao !== 'tabelaPrecoAnterior')
    .filter((a) => (!p.de || a.criadoEm.slice(0, 10) >= p.de) && (!p.ate || a.criadoEm.slice(0, 10) <= p.ate))
    .filter((a) => !p.usuarioId || a.criadoPor === p.usuarioId)
    .filter((a) => !p.acao || a.acao === p.acao)
    .filter((a) => !b || a.resumo.toLowerCase().includes(b) || (a.usuarioNome ?? '').toLowerCase().includes(b) || nomeAcao(a.acao).toLowerCase().includes(b))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  const usuarios = [...new Map(todos.map((a) => [a.criadoPor, a.usuarioNome ?? a.criadoPor])).entries()].map(([id, nome]) => ({ id, nome }))
  return { linhas: todos.slice(0, p.limite ?? 300).map((a) => ({ ...a, nomeAcao: nomeAcao(a.acao) })), total: todos.length, usuarios, acoes: [...new Set(todos.map((a) => a.acao))].map((id) => ({ id, nome: nomeAcao(id) })) }
}
