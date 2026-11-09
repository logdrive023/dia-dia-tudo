// LOG DETALHADO e LINHA DO TEMPO: tudo o que aconteceu, quem fez e quando.
// "Pedido entrou dia X com Y, Z · fulana conferiu · ciclana pagou · entrou no estoque · vendido para…"

import type { Cotacao } from '../domain/dinheiro'
import type { Id, Unidade } from '../domain/tipos'
import { NOMES_TIPO_CAIXA } from './caixa'
import { type Ctx, lerConfig } from './contexto'

/** Referência clicável dentro dos detalhes do evento (lote, venda, compra, triagem, viagem, adiantamento…). */
export interface LinkEvento {
  tipo: 'lote' | 'venda' | 'compra' | 'triagem' | 'viagem' | 'adiantamento' | 'pessoa' | 'emprestimo' | 'caixa'
  tela: string
  params?: Record<string, string>
  rotulo: string
}

export interface EventoTempo {
  em: string
  titulo: string
  detalhe?: string
  por?: string
  tipo: 'etapa' | 'acao' | 'anexo' | 'estoque' | 'caixa' | 'conta'
  ref?: { tela: string; id: Id }
  /** etapa: de onde para onde (a tela mostra "Chegou → Conferido") */
  de?: string
  para?: string
  /** o que entrou/saiu, uma linha por item (a tela mostra como lista) */
  itens?: { texto: string; quantidade?: number; unidade?: 'grama' | 'peca' | 'servico'; valor?: number; moeda?: string }[]
  /** dinheiro do evento (sinal = entrou/saiu) */
  valor?: { valor: number; moeda: string; forma?: string }
  motivo?: string
  ajustes?: string[]
  // ---- DETALHES (opcionais; a tela mostra em "detalhes ▾") ----
  /** chave estável do evento (abrir/fechar os detalhes) */
  chave?: string
  /** correção, estorno, ajuste, conferência, cancelamento ou troca de código: entra também no filtro "Correções" */
  correcao?: boolean
  /** subtipo legível: "Compra", "Ajuste", "Recebimento"… */
  categoria?: string
  /** antes → movimentou → depois (estoque do lote, caixa da moeda, conta da pessoa, total da venda corrigida) */
  saldo?: { rotulo: string; antes: number; delta: number; depois: number; unidade?: Unidade; moeda?: string }
  /** pagamentos do registro (forma, moeda, valor, cotação usada) */
  pagamentos?: { forma: string; moeda: string; valor: number; cotacao?: string; valorPrincipal?: number; moedaPrincipal?: string }[]
  anexo?: { nome: string; mime?: string; tamanho?: number; categoria?: string }
  links?: LinkEvento[]
  /** texto completo do registro (resumo do log / descrição do movimento) */
  texto?: string
}

const ACOES_CORRECAO = new Set([
  'corrigirVenda', 'conferirPesoCompra', 'estornarLancamento', 'ajustarEstoque', 'ajustarConta', 'trocarCodigoCompra', 'trocarCodigoLote',
  'anularDespesaViagem', 'ajustarFinanciamento', 'removerAnexo', 'cancelarCompra', 'cancelarVenda', 'precoAlterado', 'insumoAjustado', 'cotacaoManual',
])

const NOMES_MOTIVO_ESTOQUE: Record<string, string> = {
  compra: 'Compra', venda: 'Venda', uso: 'Uso', ajuste: 'Ajuste', perda: 'Perda', cancelamento: 'Cancelamento', transformacao: 'Triagem', correcao: 'Correção', unificacao: 'Unificação',
}
const NOMES_TIPO_CONTA: Record<string, string> = {
  venda: 'Venda', compra: 'Compra', recebimento: 'Recebimento', pagamento: 'Pagamento', adiantamento: 'Adiantamento', ajuste: 'Ajuste', estorno: 'Estorno', comissao: 'Comissão',
}

const porData = <T extends { criadoEm: string; id: string }>(a: T, b: T) => (a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : a.id < b.id ? -1 : 1)

function textoCotacao(c: Cotacao | undefined, principal: string) {
  return c ? `1 ${c.moeda} = ${c.valor} ${c.contra ?? principal}` : undefined
}

/** Descobre o que é um id (para virar link): compra, venda, lote, pessoa, viagem, adiantamento, empréstimo. */
async function linkDe(ctx: Ctx, id: Id, cache: Map<Id, LinkEvento | null>): Promise<LinkEvento | undefined> {
  if (cache.has(id)) return cache.get(id) ?? undefined
  let l: LinkEvento | undefined
  const tr = await ctx.repos.transacoes.obter(id)
  if (tr) l = tr.tipo === 'compra' ? { tipo: 'compra', tela: 'pedido', params: { id }, rotulo: tr.codigo ?? 'Compra' } : { tipo: 'venda', tela: 'venda', params: { id }, rotulo: tr.codigo ?? 'Venda' }
  const it = l ? undefined : await ctx.repos.itens.obter(id)
  if (it) l = { tipo: 'lote', tela: 'lote', params: { id }, rotulo: it.codigo ?? it.nome }
  const pe = l ? undefined : await ctx.repos.pessoas.obter(id)
  if (pe) l = { tipo: 'pessoa', tela: 'pessoa', params: { id }, rotulo: pe.nome }
  const vg = l ? undefined : await ctx.repos.viagens.obter(id)
  if (vg) l = { tipo: 'viagem', tela: 'viagem', params: { id }, rotulo: vg.codigo }
  const fi = l ? undefined : await ctx.repos.financiamentos.obter(id)
  if (fi) l = { tipo: 'adiantamento', tela: 'financiamento', params: { id }, rotulo: fi.codigo }
  const em = l ? undefined : await ctx.repos.emprestimos.obter(id)
  if (em) l = { tipo: 'emprestimo', tela: 'emprestimo', params: { id }, rotulo: 'Empréstimo' }
  cache.set(id, l ?? null)
  return l
}

const NOMES_ACAO: Record<string, string> = {
  recusado: 'Tentativa recusada',
  salvarVendaAberta: 'Venda guardada em aberto',
  descartarVendaAberta: 'Venda em aberto descartada',
  tirarDaVendaAberta: 'Pacote saiu de uma venda em aberto',
  reduzirNaVendaAberta: 'Parte do pacote saiu de uma venda em aberto',
  salvarCidade: 'Cidade cadastrada',
  impostosEstimados: 'Impostos estimados (registro)',
  redividirGastoViagem: 'Gasto da viagem redividido',
  desfazerLigacao: 'Ligação de compras desfeita',
  apagarViagem: 'Viagem apagada',
  pagamentoParcialCompra: 'Linhas já pagas no registro',
  criarCompra: 'Pedido de compra registrado',
  avancarTriagem: 'Etapa da triagem',
  cancelarCompra: 'Compra cancelada',
  conferirPesoCompra: 'Conferência de peso',
  concluirVenda: 'Venda concluída',
  agendar: 'Atendimento agendado',
  atenderAgendamento: 'Atendimento feito',
  salvarEvento: 'Compromisso na agenda',
  excluirEvento: 'Compromisso excluído da agenda',
  concluirEvento: 'Compromisso feito',
  cancelarVenda: 'Venda cancelada',
  corrigirVenda: 'Venda corrigida',
  pagarComissao: 'Comissão paga',
  criarUsuario: 'Usuário criado',
  alterarUsuario: 'Usuário alterado',
  trocarSenha: 'Senha trocada',
  entrar: 'Entrou no sistema',
  separarLote: 'Lote separado',
  unificarLotes: 'Lotes unificados',
  triarLotes: 'Triagem feita',
  tirarDaMistura: 'Mistura desfeita',
  moverFaseTriagem: 'Lote mudou de coluna na triagem',
  salvarFluxoTriagem: 'Etapas da triagem mudadas',
  ajustarEstoque: 'Estoque ajustado',
  marcarLotes: 'Lotes alterados em massa',
  editarAtributosLote: 'Atributos do lote editados',
  marcarEtiquetasImpressas: 'Etiqueta impressa',
  refazerEtiqueta: 'Etiqueta cancelada · nova via',
  salvarCodigos: 'Regra dos códigos mudada',
  salvarSigla: 'Sigla da pessoa mudada',
  trocarCodigoCompra: 'Código da compra trocado',
  trocarCodigoLote: 'Código do lote trocado',
  salvarItem: 'Item salvo',
  regraServico: 'Comissão/insumos do serviço mudados',
  precoAlterado: 'Preço mudado no atendimento',
  insumoAjustado: 'Insumos ajustados no atendimento',
  criarServicoRapido: 'Serviço criado no atendimento',
  restaurarBibliotecaServicos: 'Biblioteca de serviços restaurada',
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
  tabelaPrecoVersao: 'Versão da tabela publicada',
  salvarCotacao: 'Cotação salva',
  salvarCambio: 'Câmbio configurado',
  pagarSalario: 'Salário pago',
  anexar: 'Arquivo anexado',
  removerAnexo: 'Anexo removido',
  salvarModulo: 'Modalidade salva',
  salvarFluxoCompra: 'Etapas da compra mudadas',
  salvarFormCompra: 'Formulário de compra mudado',
  salvarAtributos: 'Atributos do item mudados',
  salvarViagem: 'Viagem de compra salva',
  adiantarViagem: 'Adiantamento para a viagem',
  registrarDespesaViagem: 'Gasto da viagem',
  anularDespesaViagem: 'Gasto da viagem anulado',
  vincularCompras: 'Compras ligadas à viagem',
  desvincularCompra: 'Compra tirada da viagem',
  encerrarViagem: 'Viagem encerrada (prestação de contas)',
  incorporarCustoViagem: 'Gasto da viagem somado ao custo dos lotes',
  reabrirViagem: 'Viagem reaberta',
  salvarCategoriasViagem: 'Categorias de gasto de viagem mudadas',
  criarFinanciamento: 'Adiantamento a parceiro (dinheiro para comprar cabelo)',
  registrarEntregaFinanciamento: 'Entrega de cabelo abatendo o adiantamento',
  receberFinanciamento: 'Adiantamento: recebi em dinheiro',
  pagarDiferencaFinanciamento: 'Adiantamento: paguei a diferença ao parceiro',
  abaterComissaoFinanciamento: 'Adiantamento: abatido da comissão',
  encerrarFinanciamento: 'Adiantamento encerrado',
  ajustarFinanciamento: 'Adiantamento alterado',
}

export function nomeAcao(a: string) {
  return NOMES_ACAO[a] ?? a
}

/** Linha do tempo de qualquer coisa: pedido (compra/venda), lote, pessoa, empréstimo. */
export async function linhaDoTempo(ctx: Ctx, p: { id: Id }) {
  const eventos: EventoTempo[] = []
  const t = await ctx.repos.transacoes.obter(p.id)
  const log = (await ctx.repos.auditoria.listar()).filter((a) => a.alvoId === p.id || a.ligados?.includes(p.id))
  const cache = new Map<Id, LinkEvento | null>()
  const usuarios = new Map((await ctx.repos.usuarios.listar()).map((u) => [u.id, u.nome]))
  const cfg = await lerConfig(ctx)
  const nomeForma = new Map(cfg.formas.map((f) => [f.id, f.nome]))
  const linksDe = async (ids: (Id | undefined)[]) => {
    const r: LinkEvento[] = []
    for (const id of [...new Set(ids.filter((x): x is Id => !!x && x !== p.id))]) {
      const l = await linkDe(ctx, id, cache)
      if (l) r.push(l)
    }
    return r
  }
  if (t) {
    const nomesEtapa = new Map<string, string>()
    if (ctx.modulos.tem(t.moduloId)) for (const e of ctx.modulos.obter(t.moduloId).compra?.etapas ?? []) nomesEtapa.set(e.id, e.nome)
    const nomeEtapa = (id: string) =>
      nomesEtapa.get(id) ?? ({ novo: 'Nova', agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado', recusado: 'Recusado' } as Record<string, string>)[id] ?? id
    const unidadeDe = async (itemId?: Id) => (itemId ? (await ctx.repos.itens.obter(itemId))?.unidade : undefined)
    const pagamentos = t.pagamentos.map((pg) => ({
      forma: nomeForma.get(pg.forma) ?? pg.forma,
      moeda: pg.moeda,
      valor: pg.valor,
      cotacao: pg.moeda !== t.moedaPrincipal ? textoCotacao(pg.cotacao, t.moedaPrincipal) : undefined,
      valorPrincipal: pg.moeda !== t.moedaPrincipal ? pg.valorPrincipal : undefined,
      moedaPrincipal: t.moedaPrincipal,
    }))
    const linksBase = await linksDe([t.pessoaId, t.viagemId, t.financiamentoId])
    let comPagamentos = false
    for (const [k, h] of t.historico.entries()) {
      const correcao = h.tipo === 'correcao'
      const entrada = !h.de && !correcao
      // os pagamentos aparecem no registro (ou na conclusão da venda), uma vez só
      const levaPagamentos = !comPagamentos && !correcao && pagamentos.length > 0 && (entrada || h.para === 'concluido')
      if (levaPagamentos) comPagamentos = true
      eventos.push({
        em: h.em,
        tipo: 'etapa',
        por: h.porNome,
        titulo: correcao ? 'Venda corrigida' : entrada ? (t.tipo === 'compra' ? 'Pedido registrado' : 'Venda registrada') : 'Mudou de etapa',
        de: correcao || entrada ? undefined : nomeEtapa(h.de),
        para: correcao ? undefined : nomeEtapa(h.para),
        itens: entrada ? await Promise.all(t.linhas.map(async (l) => ({ texto: l.descricao, quantidade: l.quantidade, unidade: await unidadeDe(l.itemId), valor: l.total, moeda: l.moeda }))) : undefined,
        valor: entrada ? { valor: t.totalPrincipal, moeda: t.moedaPrincipal } : correcao && h.totalDepois !== undefined ? { valor: h.totalDepois, moeda: t.moedaPrincipal } : undefined,
        detalhe: correcao && h.totalAntes !== undefined ? `antes:${h.totalAntes}` : undefined,
        motivo: h.motivo,
        ajustes: h.ajustes,
        chave: `h${k}`,
        correcao: correcao || h.para === 'cancelado' || undefined,
        categoria: correcao ? 'Correção' : entrada ? 'Registro' : 'Etapa',
        saldo:
          correcao && h.totalAntes !== undefined && h.totalDepois !== undefined
            ? { rotulo: 'Total', antes: h.totalAntes, delta: h.totalDepois - h.totalAntes, depois: h.totalDepois, moeda: t.moedaPrincipal }
            : undefined,
        pagamentos: levaPagamentos ? pagamentos : undefined,
        links: entrada || correcao || levaPagamentos ? [...linksBase, ...(await linksDe(t.linhas.map((l) => l.itemId)))] : undefined,
      })
    }
    // caixa: saldo da moeda (todas as formas) antes e depois de cada movimento
    const doCaixa = await ctx.repos.movCaixa.listar({ origemId: t.id })
    const todosCaixa = doCaixa.length ? (await ctx.repos.movCaixa.listar()).sort(porData) : []
    for (const m of doCaixa) {
      const antes = todosCaixa.slice(0, Math.max(0, todosCaixa.findIndex((x) => x.id === m.id))).filter((x) => x.moeda === m.moeda).reduce((s, x) => s + x.delta, 0)
      eventos.push({
        em: m.criadoEm,
        tipo: 'caixa',
        titulo: m.delta > 0 ? 'Dinheiro entrou' : 'Dinheiro saiu',
        detalhe: m.descricao,
        valor: { valor: m.delta, moeda: m.moeda, forma: nomeForma.get(m.forma) ?? m.forma },
        por: usuarios.get(m.criadoPor),
        chave: `c${m.id}`,
        correcao: m.tipo === 'estorno' || m.tipo === 'correcao' || !!m.estornadoPor || undefined,
        categoria: NOMES_TIPO_CAIXA[m.tipo] ?? m.tipo,
        saldo: { rotulo: `Caixa ${m.moeda}`, antes, delta: m.delta, depois: antes + m.delta, moeda: m.moeda },
        texto: m.descricao,
        links: [{ tipo: 'caixa', tela: 'caixa', params: { data: m.data }, rotulo: `${m.data.split('-').reverse().join('/')}` }, ...(await linksDe([m.pessoaId, m.viagemId]))],
      })
    }
    for (const m of await ctx.repos.movEstoque.listar({ origemId: t.id })) {
      const item = await ctx.repos.itens.obter(m.itemId)
      const lk = await linkDe(ctx, m.itemId, cache)
      eventos.push({
        em: m.criadoEm,
        tipo: 'estoque',
        titulo: m.delta > 0 ? 'Entrou no estoque' : 'Saiu do estoque',
        itens: [{ texto: `${item?.codigo ?? ''} · ${item?.nome ?? ''}`, quantidade: m.delta, unidade: item?.unidade }],
        detalhe: `saldo:${m.saldoAntes}:${m.saldoDepois}`,
        ref: { tela: 'lote', id: m.itemId },
        por: m.porNome ?? usuarios.get(m.criadoPor),
        chave: `e${m.id}`,
        correcao: m.motivo === 'correcao' || m.motivo === 'ajuste' || !!m.corrigeId || undefined,
        categoria: NOMES_MOTIVO_ESTOQUE[m.motivo] ?? m.motivo,
        saldo: { rotulo: item?.codigo ? `Saldo do lote ${item.codigo}` : 'Saldo do lote', antes: m.saldoAntes, delta: m.delta, depois: m.saldoDepois, unidade: item?.unidade },
        texto: m.descricao,
        links: [...(lk ? [lk] : []), ...(item?.triagem ? [{ tipo: 'triagem' as const, tela: 'triagem', rotulo: item.triagem.codigo }] : [])],
      })
    }
    // vendas que saíram dos lotes desta compra (destino)
    const lotes = (await ctx.repos.itens.listar()).filter((i) => i.origem?.id === t.id || i.origem?.compraId === t.id || !!i.origem?.compraIds?.includes(t.id))
    if (lotes.length) {
      const ids = new Set(lotes.map((l) => l.id))
      for (const v of (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((v) => v.etapa === 'concluido' && v.linhas.some((l) => ids.has(l.itemId!)))) {
        const pessoa = v.pessoaId ? await ctx.repos.pessoas.obter(v.pessoaId) : undefined
        const quem = v.historico.find((h) => h.para === 'concluido')?.porNome
        const daqui = v.linhas.filter((l) => ids.has(l.itemId!))
        eventos.push({
          em: v.criadoEm,
          tipo: 'acao',
          titulo: `Vendido para ${pessoa?.nome ?? 'cliente'}`,
          itens: daqui.map((l) => ({ texto: l.descricao, quantidade: l.quantidade, unidade: 'grama' as const, valor: l.total, moeda: l.moeda })),
          valor: { valor: daqui.reduce((s, l) => s + l.totalPrincipal, 0), moeda: v.moedaPrincipal },
          detalhe: v.codigo ? `Venda ${v.codigo}` : undefined,
          por: quem,
          ref: { tela: 'venda', id: v.id },
          chave: `v${v.id}`,
          categoria: 'Venda',
          links: await linksDe([v.id, v.pessoaId, ...daqui.map((l) => l.itemId)]),
        })
      }
    }
  }
  // conta corrente do registro: saldo da pessoa antes e depois (+ = a pessoa me deve)
  const movsConta = await ctx.repos.movConta.listar({ origemId: p.id })
  // lançou e pagou NA HORA (+X e −X da mesma pessoa, no mesmo minuto): vira UM evento "pago na hora", sem o vai e vem
  const pares = new Set<Id>()
  for (const m of movsConta) {
    if (pares.has(m.id)) continue
    const par = movsConta.find((x) => x.id !== m.id && !pares.has(x.id) && x.pessoaId === m.pessoaId && x.moeda === m.moeda && x.delta === -m.delta && x.criadoEm.slice(0, 16) === m.criadoEm.slice(0, 16) && x.tipo !== 'ajuste' && m.tipo !== 'ajuste')
    if (!par) continue
    pares.add(m.id).add(par.id)
    const pessoa = await linkDe(ctx, m.pessoaId, cache)
    const pago = m.delta < 0 ? m : par
    eventos.push({
      em: m.criadoEm < par.criadoEm ? m.criadoEm : par.criadoEm,
      tipo: 'conta',
      titulo: 'Lançado na conta e pago na hora',
      valor: { valor: Math.abs(m.delta), moeda: m.moeda, forma: pago.forma ? nomeForma.get(pago.forma) ?? pago.forma : undefined },
      por: usuarios.get(m.criadoPor),
      chave: `k${m.id}`,
      texto: 'A conta da pessoa não mudou: entrou e saiu o mesmo valor.',
      links: pessoa ? [pessoa] : undefined,
    })
  }
  for (const m of movsConta.filter((x) => !pares.has(x.id))) {
    const daPessoa = (await ctx.repos.movConta.listar({ pessoaId: m.pessoaId })).sort(porData)
    const antes = daPessoa.slice(0, Math.max(0, daPessoa.findIndex((x) => x.id === m.id))).reduce((s, x) => s + x.delta, 0)
    const pessoa = await linkDe(ctx, m.pessoaId, cache)
    eventos.push({
      em: m.criadoEm,
      tipo: 'conta',
      titulo: 'Movimento na conta',
      detalhe: m.descricao,
      valor: { valor: m.delta, moeda: m.moeda, forma: m.forma ? nomeForma.get(m.forma) ?? m.forma : undefined },
      por: usuarios.get(m.criadoPor),
      chave: `k${m.id}`,
      correcao: m.tipo === 'ajuste' || m.tipo === 'estorno' || undefined,
      categoria: NOMES_TIPO_CONTA[m.tipo] ?? m.tipo,
      saldo: { rotulo: pessoa ? `Conta · ${pessoa.rotulo}` : 'Conta', antes, delta: m.delta, depois: antes + m.delta, moeda: m.moeda },
      texto: m.descricao,
      links: pessoa ? [pessoa] : undefined,
    })
  }
  const anexos = await ctx.repos.anexos.listar({ donoId: p.id })
  const fichaAnexo = (an: (typeof anexos)[number]) => ({ nome: an.nome, mime: an.mime, tamanho: an.tamanho, categoria: an.categoria })
  for (const a of log.filter((x) => !(t && (x.acao === 'avancarTriagem' || x.acao === 'criarCompra' || x.acao === 'concluirVenda' || x.acao === 'agendar' || x.acao === 'corrigirVenda')))) {
    const an = a.acao === 'anexar' ? anexos.find((x) => a.resumo.endsWith(x.nome)) : undefined
    const semResumo = a.acao === 'tabelaPrecoAnterior' || a.acao === 'tabelaPrecoVersao'
    eventos.push({
      em: a.criadoEm,
      tipo: a.acao === 'anexar' ? 'anexo' : 'acao',
      titulo: nomeAcao(a.acao),
      detalhe: semResumo ? undefined : a.resumo,
      por: a.usuarioNome,
      chave: `a${a.id}`,
      correcao: ACOES_CORRECAO.has(a.acao) || undefined,
      categoria: a.acao === 'anexar' ? 'Arquivo' : 'Ação',
      anexo: an ? fichaAnexo(an) : undefined,
      texto: semResumo ? undefined : a.resumo || undefined,
      links: await linksDe([a.alvoId, ...(a.ligados ?? [])]),
    })
  }
  for (const an of anexos)
    if (!log.some((a) => a.acao === 'anexar' && a.resumo.endsWith(an.nome)))
      eventos.push({ em: an.criadoEm, tipo: 'anexo', titulo: 'Arquivo anexado', detalhe: an.nome, por: usuarios.get(an.criadoPor), chave: `n${an.id}`, categoria: 'Arquivo', anexo: fichaAnexo(an) })
  return eventos.sort((a, b) => (a.em < b.em ? -1 : 1))
}

/** Log de tudo, com filtros (quem, o quê, quando). */
export async function logDetalhado(ctx: Ctx, p: { de?: string; ate?: string; usuarioId?: Id; acao?: string; busca?: string; limite?: number }) {
  const b = p.busca?.trim().toLowerCase()
  const todos = (await ctx.repos.auditoria.listar())
    .filter((a) => a.acao !== 'tabelaPrecoAnterior' && a.acao !== 'tabelaPrecoVersao')
    .filter((a) => (!p.de || a.criadoEm.slice(0, 10) >= p.de) && (!p.ate || a.criadoEm.slice(0, 10) <= p.ate))
    .filter((a) => !p.usuarioId || a.criadoPor === p.usuarioId)
    .filter((a) => !p.acao || a.acao === p.acao)
    .filter((a) => !b || a.resumo.toLowerCase().includes(b) || (a.usuarioNome ?? '').toLowerCase().includes(b) || nomeAcao(a.acao).toLowerCase().includes(b))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  const usuarios = [...new Map(todos.map((a) => [a.criadoPor, a.usuarioNome ?? a.criadoPor])).entries()].map(([id, nome]) => ({ id, nome }))
  return { linhas: todos.slice(0, p.limite ?? 300).map((a) => ({ ...a, nomeAcao: nomeAcao(a.acao) })), total: todos.length, usuarios, acoes: [...new Set(todos.map((a) => a.acao))].map((id) => ({ id, nome: nomeAcao(id) })) }
}
