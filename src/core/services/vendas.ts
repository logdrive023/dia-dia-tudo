// VENDAS e ATENDIMENTOS: uma venda tem linhas (cabelo em gramas, serviço, produto) e pagamentos em qualquer moeda.
// Agendado não mexe em estoque nem caixa; só ao concluir.

import { converter, formatar, moeda as moedaDe, multiplicarFator, proporcao, type CodigoMoeda, type Cotacao } from '../domain/dinheiro'
import { carimbarTabela } from './precos'
import { registrarImpostosEstimados } from './impostosRegistro'
import { mapaViagens } from './viagemCurta'
import { ErroNegocio, exigir } from '../domain/erros'
import { aoConcluirVenda } from './vendasAbertas'
import { dataDeInstante } from '../domain/datas'
import type { Id, Item, Linha, RegraComissao, Transacao } from '../domain/tipos'
import { dividir, pct, resolverComissao } from '../domain/comissao'
import { auditar, cotacoesAtuais, type Ctx, exigirInteiroPositivo, formaPagamento, lerConfig, novo, paraPrincipal, tocar, marcarDiaFechado, garantirDiaAberto } from './contexto'
import { moverCaixa } from './caixa'
import { comprasDe, custoDe, moverEstoque, proximoCodigo } from './estoque'
import { montarPagamentos, type PagamentoEntrada } from './pagamentos'
import { moverConta } from './contas'
import { pendenciasVenda } from './pendencias'

export interface LinhaVendaEntrada {
  id: Id
  itemId: Id
  quantidade: number
  moeda: CodigoMoeda
  total: number
  profissionalId?: Id
  comissaoBp?: number
  descricao?: string
  /**
   * Conta do caderno: medida | quantidade × fator. Ex.: 40 cm, 2.000 g × 3,5 = Bs 7.000.
   * Com fator, o total é calculado aqui (o "total" enviado é ignorado).
   */
  calculo?: { medida?: number; fator: string; categoria?: string; tabelaId?: Id; colunaId?: string }
  /** salão: insumos desta linha (sem = os do catálogo). Mudar pede motivo; abaixo do catálogo só o administrador. */
  insumo?: InsumoEntrada
  /** motivo de cobrar menos que o preço do catálogo (funcionária precisa dizer) */
  motivoPreco?: string
  /**
   * DESCONTO desta linha na moeda da linha. A linha continua com a conta da tabela (medida, fator, tabela, coluna) e o
   * valor cheio; o total gravado é o líquido. Ex.: 2.008 g × 17,5 = Bs 35.140 com desconto 87850 → total Bs 34.261,50.
   */
  desconto?: number
}

export interface InsumoEntrada {
  moeda: CodigoMoeda
  itens: { nome: string; valor: number }[]
  motivo?: string
}

export interface VendaEntrada {
  id: Id
  pessoaId?: Id
  localId?: Id
  profissionalId?: Id
  /** ISO: vira atendimento agendado */
  agendadoPara?: string
  linhas: LinhaVendaEntrada[]
  pagamentos: PagamentoEntrada[]
  obs?: string
  /** agenda: marcar mesmo com horário ocupado (a tela pergunta antes) */
  ignorarConflito?: boolean
  /**
   * MOEDA DE COBRANÇA (modo caixa): em que moeda a pessoa pagou e a cotação digitada na hora.
   * Ex.: { moeda: 'BRL', cotacao: { moeda: 'BRL', valor: '1,28', sentido: 'basePorMoeda', contra: 'BOB' } } →
   * a venda guarda "Cobrado em R$ · cotação 1 R$ = 1,28 Bs".
   */
  cobranca?: { moeda: CodigoMoeda; cotacao?: Cotacao }
  /**
   * DESCONTO da venda (modo caixa), em % ou em valor na moeda das linhas: é repartido entre as linhas dessa moeda,
   * proporcional ao valor cheio de cada uma (a última fica com o arredondamento). As linhas guardam a conta da tabela.
   * `cobrado` = o mesmo desconto na moeda de cobrança (para o texto "desconto R$ 10,00").
   * Ex.: { moeda: 'BOB', pct: 2.5 } sobre Bs 35.140 → "desconto 2,5% = Bs 878,50".
   */
  desconto?: { moeda: CodigoMoeda; valor?: number; pct?: number; cobrado?: number }
}

/** Reparte o desconto da venda entre as linhas da moeda dele (proporcional ao valor cheio). Devolve as linhas e o texto. */
function repartirDesconto(linhas: LinhaVendaEntrada[], d: VendaEntrada['desconto'], cobranca: VendaEntrada['cobranca']) {
  if (!d || (!d.valor && !d.pct)) return { linhas, texto: undefined as string | undefined }
  const cheio = (l: LinhaVendaEntrada) => (l.calculo?.fator ? multiplicarFator(l.quantidade, l.calculo.fator, l.moeda) : l.total)
  const alvo = linhas.filter((l) => l.moeda === d.moeda && !l.desconto)
  const base = alvo.reduce((s, l) => s + cheio(l), 0)
  exigir(alvo.length && base > 0, `Desconto em ${d.moeda}, mas nenhum item da venda está em ${d.moeda}.`, 'desconto')
  if (d.pct !== undefined) exigir(Number.isFinite(d.pct) && d.pct > 0 && d.pct <= 100, 'Desconto de 0 a 100%.', 'desconto')
  const valor = d.pct !== undefined ? Math.round((base * d.pct) / 100) : d.valor!
  exigirInteiroPositivo(valor, 'Desconto')
  exigir(valor <= base, 'Desconto maior que o total.', 'desconto')
  let resta = valor
  const ultima = alvo[alvo.length - 1]
  const saida = linhas.map((l) => {
    if (!alvo.includes(l)) return l
    const parte = l === ultima ? resta : proporcao(valor, cheio(l), base)
    resta -= parte
    return parte ? { ...l, desconto: parte } : l
  })
  const pctTxt = d.pct !== undefined ? `${String(Math.round(d.pct * 100) / 100).replace('.', ',')}% = ` : ''
  const naCobranca = d.cobrado !== undefined && cobranca && cobranca.moeda !== d.moeda
  const texto = naCobranca
    ? `desconto ${pctTxt}${formatar(d.cobrado!, cobranca!.moeda)} (= ${formatar(valor, d.moeda)})`
    : `desconto ${pctTxt}${formatar(valor, d.moeda)}`
  return { linhas: saida, texto }
}

/** "Cobrado em R$ · cotação 1 R$ = 1,28 Bs" (ou "Cobrado em Bs") para os campos da venda. */
function camposCobranca(c: VendaEntrada['cobranca'], principal: CodigoMoeda) {
  if (!c) return {}
  const sm = moedaDe(c.moeda).simbolo
  const cot = c.moeda !== principal && c.cotacao?.valor ? String(c.cotacao.valor).trim() : undefined
  return {
    cobradoEm: c.moeda,
    ...(cot ? { cotacaoCobranca: cot } : {}),
    cobranca: cot ? `Cobrado em ${sm} · cotação 1 ${sm} = ${cot} ${moedaDe(principal).simbolo}` : `Cobrado em ${sm}`,
  }
}

/** Insumos da linha (moeda principal): os enviados ou os do catálogo. Mudar pede motivo; baixar do catálogo é do administrador. */
async function insumoDaLinha(ctx: Ctx, item: Item, entrada: InsumoEntrada | undefined) {
  const cat = await insumoCatalogo(ctx, item)
  if (!entrada) return { insumoPrincipal: cat.total, insumos: cat.itens, motivo: undefined as string | undefined }
  const itens: { nome: string; valorPrincipal: number }[] = []
  for (const i of entrada.itens ?? []) {
    if (!i.valor) continue
    exigirInteiroPositivo(i.valor, `Insumo ${i.nome || ''}`.trim())
    itens.push({ nome: i.nome?.trim() || 'Insumos', valorPrincipal: (await paraPrincipal(ctx, i.valor, entrada.moeda)).valorPrincipal })
  }
  const total = itens.reduce((s, i) => s + i.valorPrincipal, 0)
  const mudou = total !== cat.total || JSON.stringify(itens) !== JSON.stringify(cat.itens)
  if (!mudou) return { insumoPrincipal: cat.total, insumos: cat.itens, motivo: undefined }
  exigir(entrada.motivo?.trim(), `Diga o motivo de mudar os insumos de ${item.nome} (produto especial, quantidade extra…).`, 'insumoMotivo')
  if (total < cat.total) exigir(ctx.sessao.perfil === 'admin', `Só o administrador baixa os insumos de ${item.nome} abaixo do catálogo.`)
  return { insumoPrincipal: total, insumos: itens, motivo: entrada.motivo!.trim() }
}

/** Insumos do catálogo do serviço, convertidos para a moeda principal agora. */
export async function insumoCatalogo(ctx: Ctx, item: Pick<Item, 'insumo'>) {
  const ins = item.insumo
  if (!ins?.valor) return { total: 0, itens: [] as { nome: string; valorPrincipal: number }[] }
  const fonte = ins.itens?.length ? ins.itens : [{ nome: 'Insumos', valor: ins.valor }]
  const itens: { nome: string; valorPrincipal: number }[] = []
  for (const i of fonte) itens.push({ nome: i.nome, valorPrincipal: (await paraPrincipal(ctx, i.valor, ins.moeda)).valorPrincipal })
  return { total: itens.reduce((s, i) => s + i.valorPrincipal, 0), itens }
}

/** Grava na linha a divisão (base, comissão, salão) com o % que vale. */
function aplicarDivisao(l: Linha, bp: number | undefined, regra: RegraComissao | undefined) {
  const d = dividir(l.totalPrincipal, l.insumoPrincipal ?? 0, bp)
  l.comissaoBp = l.profissionalId ? bp : undefined
  l.comissaoRegra = l.profissionalId && bp !== undefined ? regra : undefined
  l.comissaoPrincipal = l.profissionalId && bp ? d.comissao : undefined
  l.baseComissao = d.base
  l.parteSalao = l.profissionalId && bp ? d.parteSalao : d.base
}

async function montarLinhas(ctx: Ctx, entrada: LinhaVendaEntrada[], profissionalPadrao?: Id): Promise<Linha[]> {
  exigir(entrada?.length, 'Coloque pelo menos um item na venda.')
  const cfg = await lerConfig(ctx)
  const linhas: Linha[] = []
  for (const l of entrada) {
    const item = await ctx.repos.itens.obter(l.itemId)
    exigir(item && item.ativo, 'Item não encontrado.')
    exigirInteiroPositivo(l.quantidade, `Quantidade de ${item.nome}`)
    const bruto = l.calculo?.fator ? multiplicarFator(l.quantidade, l.calculo.fator, l.moeda) : l.total
    exigirInteiroPositivo(bruto, `Valor de ${item.nome}`, true)
    // desconto: a linha guarda o cheio (gramas × fator) e o líquido; comissão e lucro usam o líquido
    const desconto = l.desconto || 0
    if (desconto) {
      exigirInteiroPositivo(desconto, `Desconto de ${item.nome}`)
      exigir(desconto <= bruto, `O desconto de ${item.nome} passa do valor.`, 'desconto')
    }
    const total = bruto - desconto
    const conv = await paraPrincipal(ctx, total, l.moeda, 'venda')
    const convBruto = desconto ? await paraPrincipal(ctx, bruto, l.moeda, 'venda') : conv
    const profissionalId = l.profissionalId ?? (item.controlaEstoque ? undefined : profissionalPadrao)
    const servico = item.unidade === 'servico'
    // preço abaixo do catálogo: a funcionária diz o motivo; fica guardado na linha e no log
    const precoCatalogo = servico && !l.calculo?.fator && item.precoSugerido?.valor && item.precoSugerido.moeda === l.moeda ? item.precoSugerido.valor * l.quantidade : undefined
    if (precoCatalogo !== undefined && total < precoCatalogo && ctx.sessao.perfil !== 'admin')
      exigir(l.motivoPreco?.trim(), `Diga o motivo de cobrar menos que o catálogo em ${item.nome} (${formatar(precoCatalogo, l.moeda)}).`, 'motivoPreco')
    // funcionária não escolhe a comissão (a não ser que a configuração deixe): vale a regra
    const linhaBp = ctx.sessao.perfil === 'admin' || cfg.comissaoFuncionarioMuda ? l.comissaoBp : undefined
    if (linhaBp !== undefined) exigir(Number.isInteger(linhaBp) && linhaBp >= 0 && linhaBp <= 10000, 'Comissão inválida.')
    const prof = profissionalId ? await ctx.repos.pessoas.obter(profissionalId) : undefined
    const regra = resolverComissao({ profissional: !!profissionalId, servico, linhaBp, servicoBp: item.comissaoBp, profissionalBp: prof?.comissaoBp, padraoBp: cfg.comissaoPadraoBp })
    const ins = servico ? await insumoDaLinha(ctx, item, l.insumo) : { insumoPrincipal: 0, insumos: [], motivo: undefined }
    exigir(ins.insumoPrincipal <= conv.valorPrincipal, `Os insumos de ${item.nome} passam do valor do serviço.`)
    const linha: Linha = {
      id: l.id,
      itemId: item.id,
      descricao: l.descricao?.trim() || item.nome,
      quantidade: l.quantidade,
      moeda: l.moeda,
      total,
      totalPrincipal: conv.valorPrincipal,
      cotacao: conv.cotacao,
      custoPrincipal: item.controlaEstoque ? custoDe(item, l.quantidade) : undefined,
      profissionalId,
      ...(ins.insumoPrincipal ? { insumoPrincipal: ins.insumoPrincipal, insumos: ins.insumos } : {}),
      ...(ins.motivo ? { insumoMotivo: ins.motivo } : {}),
      ...(precoCatalogo !== undefined ? { precoCatalogo } : {}),
      ...(precoCatalogo !== undefined && total !== precoCatalogo && l.motivoPreco?.trim() ? { motivoPreco: l.motivoPreco.trim() } : {}),
      ...(desconto ? { bruto, desconto, descontoPrincipal: convBruto.valorPrincipal - conv.valorPrincipal } : {}),
      campos: l.calculo?.fator
        ? {
            medida: l.calculo.medida,
            fator: l.calculo.fator,
            categoria: l.calculo.categoria,
            tabelaId: l.calculo.tabelaId,
            colunaId: l.calculo.colunaId,
            calculo: `${l.calculo.medida ?? ''}${l.calculo.categoria ? ' ' + l.calculo.categoria : ''} | ${l.quantidade.toLocaleString('pt-BR')} × ${l.calculo.fator} = ${formatar(bruto, l.moeda)}`,
          }
        : {},
    }
    aplicarDivisao(linha, regra?.bp, regra?.regra)
    linhas.push(linha)
  }
  // a versão da tabela que valia AGORA fica guardada na linha (o histórico nunca muda depois)
  const cache = new Map()
  for (const l of linhas) await carimbarTabela(ctx, l.campos, cache)
  return linhas
}

/** Log do que mudou no atendimento em relação ao catálogo (preço e insumos). */
async function auditarAjustes(ctx: Ctx, v: Transacao) {
  for (const l of v.linhas) {
    if (l.precoCatalogo !== undefined && l.total !== l.precoCatalogo)
      await auditar(ctx, 'precoAlterado', v.id, `${l.descricao}: ${formatar(l.precoCatalogo, l.moeda)} → ${formatar(l.total, l.moeda)} · ${l.motivoPreco ?? 'sem motivo'}`, [v.pessoaId!, l.itemId!])
    if (l.insumoMotivo) await auditar(ctx, 'insumoAjustado', v.id, `${l.descricao}: insumos ${formatar(l.insumoPrincipal ?? 0, v.moedaPrincipal)} · ${l.insumoMotivo}`, [v.pessoaId!, l.itemId!])
  }
}

async function concluir(ctx: Ctx, v: Transacao, pagamentosEntrada: PagamentoEntrada[]): Promise<Transacao> {
  // com cliente identificado pode pagar em partes: o resto vai para a conta dela (fiado)
  const pagamentos = await montarPagamentos(ctx, pagamentosEntrada, v.totalPrincipal, v.linhas, !!v.pessoaId, 'venda')
  const hoje = ctx.relogio.hoje()
  // dia encerrado: a venda (paga, fiado ou de valor zero) não entra — mesma regra do dinheiro (reabra no Caixa)
  await garantirDiaAberto(ctx, hoje)
  for (const l of v.linhas) {
    const item = await ctx.repos.itens.obter(l.itemId!)
    if (item?.controlaEstoque) {
      // custo na hora da saída (o lote pode ter mudado desde o agendamento)
      l.custoPrincipal = custoDe(item, l.quantidade)
      await moverEstoque(ctx, { itemId: item.id, delta: -l.quantidade, motivo: v.agendadoPara ? 'uso' : 'venda', origemId: v.id, descricao: 'Venda' })
    }
  }
  const resumo = v.linhas.map((l) => l.descricao).join(', ')
  for (const p of pagamentos)
    await moverCaixa(ctx, { data: hoje, moeda: p.moeda, forma: p.forma, delta: p.valor, tipo: 'venda', origemId: v.id, descricao: `Venda · ${resumo}` })
  if (v.pessoaId) {
    await moverConta(ctx, { pessoaId: v.pessoaId, delta: v.totalPrincipal, tipo: 'venda', origemId: v.id, descricao: `Venda · ${resumo}` })
    const pago = pagamentos.reduce((s, p) => s + p.valorPrincipal, 0)
    await moverConta(ctx, { pessoaId: v.pessoaId, delta: -pago, tipo: 'recebimento', origemId: v.id, descricao: 'Pago na hora' })
  }
  return {
    ...v,
    data: hoje,
    etapa: 'concluido',
    pagamentos,
    historico: [...v.historico, { de: v.etapa, para: 'concluido', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome }],
  }
}

/** Vende agora (ou agenda o atendimento). Toque repetido devolve a mesma venda. */
export async function concluirVenda(ctx: Ctx, d: VendaEntrada) {
  if (await ctx.repos.transacoes.obter(d.id)) return { id: d.id }
  const cfg = await lerConfig(ctx)
  const comDesconto = repartirDesconto(d.linhas ?? [], d.desconto, d.cobranca)
  const linhas = await montarLinhas(ctx, comDesconto.linhas, d.profissionalId)
  const primeiro = await ctx.repos.itens.obter(linhas[0].itemId!)
  // funcionária: só vende o que o admin liberou (cabelo conta como liberado se a pistola OU a medida estiver)
  if (ctx.sessao.perfil === 'funcionario') {
    const nao = new Set(cfg.funcionariaNaoVende)
    const bloqueado = primeiro!.moduloId === 'cabelo' ? nao.has('caixa') && nao.has('medida') : nao.has(primeiro!.moduloId)
    exigir(!bloqueado, 'Esta venda não está liberada para funcionária. Peça a um administrador.')
  }
  let v = novo<Transacao>(ctx, {
    id: d.id,
    codigo: await proximoCodigo(ctx, 'V'),
    tipo: 'venda',
    moduloId: primeiro!.moduloId,
    data: d.agendadoPara ? dataDeInstante(d.agendadoPara) : ctx.relogio.hoje(),
    etapa: d.agendadoPara ? 'agendado' : 'novo',
    pessoaId: d.pessoaId,
    localId: d.localId,
    // VENDEDORA: a escolhida na tela; a funcionária que vende sem escolher fica como a vendedora (nunca vazio para ela)
    profissionalId: d.profissionalId ?? (ctx.sessao.perfil === 'funcionario' ? ctx.sessao.pessoaId ?? ctx.sessao.usuarioId : undefined),
    agendadoPara: d.agendadoPara,
    linhas,
    pagamentos: [],
    moedaPrincipal: cfg.moedaPrincipal,
    totalPrincipal: linhas.reduce((s, l) => s + l.totalPrincipal, 0),
    historico: [],
    obs: d.obs,
    campos: { ...camposCobranca(d.cobranca, cfg.moedaPrincipal), ...(comDesconto.texto ? { desconto: comDesconto.texto } : {}) },
  })
  if (d.agendadoPara) {
    exigir(d.pessoaId, 'Diga quem é a cliente do agendamento.', 'pessoaId')
    if (!d.ignorarConflito && d.profissionalId) {
      const c = await conflitosAgenda(ctx, { profissionalId: d.profissionalId, inicio: d.agendadoPara, itens: d.linhas.map((l) => l.itemId) })
      if (c.length) throw new ErroNegocio(`Horário ocupado: ${c.map((x) => `${x.cliente ?? 'cliente'} ${x.inicio.slice(11, 16)}–${x.fim.slice(11, 16)}`).join(', ')}.`, 'conflito')
    }
    v.historico = [{ de: '', para: 'agendado', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome }]
  } else {
    v = await concluir(ctx, v, d.pagamentos)
  }
  await ctx.repos.transacoes.salvar(v)
  await auditar(ctx, d.agendadoPara ? 'agendar' : 'concluirVenda', v.id, linhas.map((l) => l.descricao).join(', '), [v.pessoaId!, v.profissionalId!, ...linhas.map((l) => l.itemId!)])
  await auditarAjustes(ctx, v)
  if (!d.agendadoPara) await registrarImpostosEstimados(ctx, v)
  if (!d.agendadoPara) await aoConcluirVenda(ctx, v.id, linhas.map((l) => l.itemId).filter((x): x is Id => !!x), v.codigo)
  // RESERVA: vendeu um pacote reservado (para a própria pessoa ou para outra — a reserva pode ter caído e ninguém
  // atualizou): nada trava, a reserva acaba aqui e o porquê fica no histórico do pacote
  if (!d.agendadoPara) {
    const cliente = v.pessoaId ? (await ctx.repos.pessoas.obter(v.pessoaId))?.nome : undefined
    for (const id of new Set(linhas.map((l) => l.itemId).filter((x): x is Id => !!x))) {
      const it = await ctx.repos.itens.obter(id)
      if (!it?.reserva) continue
      await ctx.repos.itens.salvar(tocar(ctx, { ...it, reserva: undefined }))
      await auditar(ctx, 'reservarLote', it.id, `${it.codigo ?? it.nome}: reserva para ${it.reserva.para} encerrada pela venda ${v.codigo ?? ''}${cliente ? ` para ${cliente}` : ''}`)
    }
  }
  // cotação digitada na hora (não a do sistema): fica no log
  const manuais = d.pagamentos.filter((p) => p.cotacao && p.moeda !== cfg.moedaPrincipal)
  if (manuais.length)
    await auditar(ctx, 'cotacaoManual', v.id, manuais.map((p) => `${formatar(p.valor, p.moeda)} · 1 ${p.moeda} = ${p.cotacao!.valor} ${p.cotacao!.contra ?? cfg.moedaPrincipal}`).join(' · '), [v.pessoaId!])
  return { id: v.id }
}

/** Atende um agendamento: pode trocar as linhas (o que realmente foi feito) e recebe o pagamento. */
export async function atenderAgendamento(ctx: Ctx, d: { id: Id; linhas?: LinhaVendaEntrada[]; pagamentos: PagamentoEntrada[] }) {
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Atendimento não encontrado.')
  if (t.etapa === 'concluido') return { id: t.id }
  exigir(t.etapa === 'agendado', 'Esse atendimento não está agendado.')
  let v: Transacao = { ...t, linhas: t.linhas.map((l) => ({ ...l })) }
  if (d.linhas) {
    v.linhas = await montarLinhas(ctx, d.linhas, t.profissionalId)
    v.totalPrincipal = v.linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  }
  v = await concluir(ctx, v, d.pagamentos)
  await ctx.repos.transacoes.salvar(tocar(ctx, v))
  await auditar(ctx, 'atenderAgendamento', v.id, '')
  await registrarImpostosEstimados(ctx, v)
  if (d.linhas) await auditarAjustes(ctx, v)
  return { id: v.id }
}

/** Cancela: devolve ao estoque e estorna cada pagamento. Nada é apagado. */
export async function cancelarVenda(ctx: Ctx, d: { id: Id; motivo: string }) {
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Venda não encontrada.')
  exigir(t.etapa !== 'cancelado', 'Essa venda já foi cancelada.')
  exigir(d.motivo?.trim(), 'Diga o motivo do cancelamento.', 'motivo')
  // funcionária só desmarca agendamento dela; cancelar venda feita é com o administrador
  if (ctx.sessao.perfil === 'funcionario') {
    const eu = ctx.sessao.pessoaId ?? ctx.sessao.usuarioId
    exigir(t.etapa === 'agendado' && (t.profissionalId === eu || t.linhas.some((l) => l.profissionalId === eu)), 'Só o administrador cancela vendas. Você pode desmarcar os seus agendamentos.')
  }
  if (t.etapa === 'concluido') {
    await marcarDiaFechado(ctx, t, `Venda cancelada · ${d.motivo}`)
    for (const l of t.linhas) {
      const item = l.itemId ? await ctx.repos.itens.obter(l.itemId) : undefined
      if (item?.controlaEstoque)
        await moverEstoque(ctx, { itemId: item.id, delta: l.quantidade, motivo: 'cancelamento', origemId: t.id, descricao: 'Venda cancelada' })
    }
    for (const p of t.pagamentos)
      await moverCaixa(ctx, { data: ctx.relogio.hoje(), moeda: p.moeda, forma: p.forma, delta: -p.valor, tipo: 'estorno', origemId: t.id, descricao: `Venda cancelada · ${d.motivo}` })
    await estornarConta(ctx, t.id, `Venda cancelada · ${d.motivo}`)
  }
  await ctx.repos.transacoes.salvar(
    tocar(ctx, { ...t, etapa: 'cancelado', historico: [...t.historico, { de: t.etapa, para: 'cancelado', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo }] }),
  )
  await auditar(ctx, 'cancelarVenda', t.id, d.motivo)
  return { id: t.id }
}

/** Desfaz na conta corrente tudo o que uma venda/compra lançou (com um movimento inverso). */
export async function estornarConta(ctx: Ctx, origemId: Id, descricao: string) {
  const movs = await ctx.repos.movConta.listar({ origemId })
  const porPessoa = new Map<Id, number>()
  for (const m of movs) porPessoa.set(m.pessoaId, (porPessoa.get(m.pessoaId) ?? 0) + m.delta)
  for (const [pessoaId, soma] of porPessoa) await moverConta(ctx, { pessoaId, delta: -soma, tipo: 'estorno', origemId, descricao })
}

// ---------- correção de venda (a qualquer momento, com histórico) ----------

export interface CorrecaoLinha {
  linhaId: Id
  quantidade?: number
  total?: number
  /** salão: novos insumos da linha (moeda + itens) */
  insumo?: InsumoEntrada
  /** administrador: novo % da comissão desta linha */
  comissaoBp?: number
  /** com fator, o total é recalculado (gramas × fator) */
  fator?: string
}

/**
 * Corrige quantidade, valor ou fator de uma venda já feita, quantas vezes precisar. Nada é apagado:
 * o histórico guarda antes → depois, quem corrigiu e o motivo. O estoque acerta a diferença de quantidade,
 * custo e comissão são recalculados, e a diferença de dinheiro vai para o caixa (forma escolhida)
 * ou para a conta da cliente.
 */
export async function corrigirVenda(
  ctx: Ctx,
  d: { id: Id; linhas: CorrecaoLinha[]; motivo: string; diferenca?: { forma: string; moeda: CodigoMoeda } | 'conta' },
) {
  const t = await ctx.repos.transacoes.obter(d.id)
  exigir(t && t.tipo === 'venda', 'Venda não encontrada.')
  exigir(t.etapa === 'concluido' || t.etapa === 'agendado', 'Só dá para corrigir venda concluída ou agendada.')
  exigir(d.motivo?.trim(), 'Diga o motivo da correção.', 'motivo')
  if (t.etapa === 'concluido') await marcarDiaFechado(ctx, t, `Venda corrigida · ${d.motivo}`)
  const v: Transacao = { ...t, linhas: t.linhas.map((l) => ({ ...l, campos: { ...l.campos } })), pagamentos: [...t.pagamentos] }
  const ajustes: string[] = []
  const antes = v.totalPrincipal
  for (const c of d.linhas) {
    const l = v.linhas.find((x) => x.id === c.linhaId)
    exigir(l, 'Linha não encontrada.')
    const qtd = c.quantidade ?? l.quantidade
    exigirInteiroPositivo(qtd, `Quantidade de ${l.descricao}`)
    const fator = c.fator?.trim() || (l.campos.fator as string | undefined)
    // com fator o valor cheio é recalculado (gramas × fator) e o desconto da linha continua (até o cheio);
    // valor digitado (c.total) é o valor final da linha: o desconto sai
    const recalcula = !!(c.fator?.trim() || (fator && c.quantidade !== undefined && c.total === undefined))
    const bruto = recalcula ? multiplicarFator(qtd, fator!, l.moeda) : l.bruto ?? l.total
    const desconto = recalcula ? Math.min(l.desconto ?? 0, bruto) : c.total !== undefined ? 0 : l.desconto ?? 0
    const total = recalcula ? bruto - desconto : c.total ?? l.total
    exigirInteiroPositivo(total, `Valor de ${l.descricao}`, true)
    // insumos e % da comissão (salão): o que já estava na linha vale; só muda o que vier na correção
    let insumoNovo: { insumoPrincipal: number; insumos: { nome: string; valorPrincipal: number }[] } | undefined
    if (c.insumo) {
      const itensIns: { nome: string; valorPrincipal: number }[] = []
      for (const i of c.insumo.itens ?? []) {
        if (!i.valor) continue
        exigirInteiroPositivo(i.valor, `Insumo ${i.nome || ''}`.trim())
        itensIns.push({ nome: i.nome?.trim() || 'Insumos', valorPrincipal: (await paraPrincipal(ctx, i.valor, c.insumo.moeda)).valorPrincipal })
      }
      const soma = itensIns.reduce((s, i) => s + i.valorPrincipal, 0)
      if (soma !== (l.insumoPrincipal ?? 0) || JSON.stringify(itensIns) !== JSON.stringify(l.insumos ?? [])) insumoNovo = { insumoPrincipal: soma, insumos: itensIns }
    }
    if (c.comissaoBp !== undefined) exigir(Number.isInteger(c.comissaoBp) && c.comissaoBp >= 0 && c.comissaoBp <= 10000, 'Comissão inválida.')
    const bpNovo = c.comissaoBp !== undefined && c.comissaoBp !== l.comissaoBp && l.profissionalId ? c.comissaoBp : undefined
    if (qtd === l.quantidade && total === l.total && !insumoNovo && bpNovo === undefined) continue
    const item = l.itemId ? await ctx.repos.itens.obter(l.itemId) : undefined
    if (t.etapa === 'concluido' && item?.controlaEstoque && qtd !== l.quantidade)
      await moverEstoque(ctx, { itemId: item.id, delta: l.quantidade - qtd, motivo: 'correcao', origemId: v.id, descricao: `Correção da venda: ${l.quantidade} → ${qtd}` })
    if (qtd !== l.quantidade || total !== l.total)
      ajustes.push(`${l.descricao}: ${l.quantidade.toLocaleString('pt-BR')} = ${formatar(l.total, l.moeda)} → ${qtd.toLocaleString('pt-BR')}${fator ? ` × ${fator}` : ''}${desconto ? ` − desconto ${formatar(desconto, l.moeda)}` : ''} = ${formatar(total, l.moeda)}`)
    if (insumoNovo) ajustes.push(`${l.descricao}: insumos ${formatar(l.insumoPrincipal ?? 0, v.moedaPrincipal)} → ${formatar(insumoNovo.insumoPrincipal, v.moedaPrincipal)}`)
    if (bpNovo !== undefined) ajustes.push(`${l.descricao}: comissão ${pct(l.comissaoBp ?? 0)} → ${pct(bpNovo)}`)
    const conv = await paraPrincipal(ctx, total, l.moeda, 'venda')
    l.quantidade = qtd
    l.total = total
    l.totalPrincipal = conv.valorPrincipal
    l.cotacao = conv.cotacao
    if (desconto) {
      l.bruto = bruto
      l.desconto = desconto
      l.descontoPrincipal = (await paraPrincipal(ctx, bruto, l.moeda, 'venda')).valorPrincipal - conv.valorPrincipal
    } else {
      delete l.bruto
      delete l.desconto
      delete l.descontoPrincipal
    }
    if (fator) {
      l.campos.fator = fator
      l.campos.calculo = `${l.campos.medida ?? ''}${l.campos.categoria && l.campos.categoria !== 'Normal' ? ' ' + l.campos.categoria : ''} | ${qtd.toLocaleString('pt-BR')} × ${fator} = ${formatar(recalcula || desconto ? bruto : total, l.moeda)}`
    }
    if (item?.controlaEstoque) l.custoPrincipal = custoDe(item, qtd)
    if (insumoNovo) {
      l.insumoPrincipal = insumoNovo.insumoPrincipal || undefined
      l.insumos = insumoNovo.insumoPrincipal ? insumoNovo.insumos : undefined
      l.insumoMotivo = d.motivo.trim()
    }
    exigir((l.insumoPrincipal ?? 0) <= l.totalPrincipal, `Os insumos de ${l.descricao} passam do valor do serviço.`)
    // recalcula a divisão com o % guardado na linha (o catálogo de hoje não muda o passado)
    if (bpNovo !== undefined) aplicarDivisao(l, bpNovo, 'linha')
    else if (l.baseComissao !== undefined || l.insumoPrincipal) aplicarDivisao(l, l.comissaoBp, l.comissaoRegra)
    else if (l.comissaoBp) l.comissaoPrincipal = proporcao(l.totalPrincipal, l.comissaoBp, 10000)
  }
  exigir(ajustes.length, 'Nada mudou.')
  v.totalPrincipal = v.linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  const diff = v.totalPrincipal - antes
  if (t.etapa === 'concluido' && diff !== 0) {
    if (d.diferenca === 'conta' || (!d.diferenca && v.pessoaId)) {
      exigir(v.pessoaId, 'Venda sem cliente: diga como a diferença foi paga ou devolvida.')
      await moverConta(ctx, { pessoaId: v.pessoaId, delta: diff, tipo: 'ajuste', origemId: v.id, descricao: `Correção da venda · ${d.motivo}` })
    } else {
      const dif = d.diferenca
      exigir(typeof dif === 'object', 'Diga como a diferença foi paga ou devolvida.')
      const f = await formaPagamento(ctx, dif.forma)
      exigir(f.moedas.includes(dif.moeda), `${f.nome} não aceita ${dif.moeda}.`)
      const cfg = await lerConfig(ctx)
      const valor = converter(diff, cfg.moedaPrincipal, dif.moeda, await cotacoesAtuais(ctx, 'venda'))
      await moverCaixa(ctx, { data: ctx.relogio.hoje(), moeda: dif.moeda, forma: dif.forma, delta: valor, tipo: 'correcao', origemId: v.id, descricao: `Correção da venda · ${d.motivo}` })
      v.pagamentos.push({ id: `${v.id}-corr-${v.historico.length}`, forma: dif.forma, moeda: dif.moeda, valor, valorPrincipal: diff })
    }
  }
  v.historico = [
    ...v.historico,
    { de: t.etapa, para: t.etapa, tipo: 'correcao', em: ctx.relogio.agora(), por: ctx.sessao.usuarioId, porNome: ctx.sessao.nome, motivo: d.motivo, ajustes, totalAntes: antes, totalDepois: v.totalPrincipal },
  ]
  await ctx.repos.transacoes.salvar(tocar(ctx, v))
  await auditar(ctx, 'corrigirVenda', v.id, `${d.motivo}: ${ajustes.join(' · ')}`, [v.pessoaId!])
  return { id: v.id, diferenca: diff }
}

// ---------- agenda: horário ocupado ----------

/** Atendimentos da mesma profissional que se sobrepõem ao horário pedido (duração = soma dos serviços; padrão 60 min). */
export async function conflitosAgenda(ctx: Ctx, p: { profissionalId: Id; inicio: string; itens?: Id[]; duracaoMin?: number; ignorarId?: Id }) {
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const dur = (ids: (Id | undefined)[]) => Math.max(15, ids.reduce((s, id) => s + ((id && itens.get(id)?.duracaoMin) || 0), 0) || 60)
  const ini = Date.parse(p.inicio)
  const fim = ini + (p.duracaoMin ?? dur(p.itens ?? [])) * 60000
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  return (await ctx.repos.transacoes.listar({ tipo: 'venda' }))
    .filter((t) => t.id !== p.ignorarId && t.agendadoPara && t.etapa === 'agendado')
    .filter((t) => t.profissionalId === p.profissionalId || t.linhas.some((l) => l.profissionalId === p.profissionalId))
    .map((t) => {
      const a = Date.parse(t.agendadoPara!)
      const b = a + dur(t.linhas.map((l) => l.itemId)) * 60000
      const local = (ms: number) => {
        const x = new Date(ms)
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
      }
      return { id: t.id, cliente: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, a, b, inicio: local(a), fim: local(b) }
    })
    .filter((x) => x.a < fim && ini < x.b)
    .map(({ id, cliente, inicio, fim }) => ({ id, cliente, inicio, fim }))
}

// ---------- consultas ----------

export interface FiltroVendas {
  de?: string
  ate?: string
  moduloId?: string
  pessoaId?: Id
  profissionalId?: Id
  localId?: Id
  itemId?: Id
  forma?: string
  moeda?: string
  etapa?: string
  /** quem registrou (usuário) — "o que a funcionária 1 fez do dia X ao Y" */
  usuarioId?: Id
  /** 'qualquer' = só as incompletas; ou um tipo: 'faltaReceber', 'semComprovante' */
  pendencia?: string
}

/**
 * Recorta uma venda pelas linhas de um módulo/profissional (venda mista: cabelo + serviço).
 * Os pagamentos ficam proporcionais à parte recortada. Usado pelo painel E pela lista: por isso a soma bate.
 */
export function recortarVenda(t: Transacao, f: { moduloId?: string; profissionalId?: Id }, moduloDoItem: (id: Id) => string | undefined): Transacao | null {
  let linhas = t.linhas
  if (f.moduloId) linhas = linhas.filter((l) => (l.itemId ? moduloDoItem(l.itemId) : t.moduloId) === f.moduloId)
  if (f.profissionalId) linhas = linhas.filter((l) => l.profissionalId === f.profissionalId)
  if (!linhas.length) return null
  if (linhas.length === t.linhas.length) return t
  const parte = linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  const fator = t.totalPrincipal ? parte / t.totalPrincipal : 0
  return {
    ...t,
    linhas,
    totalPrincipal: parte,
    pagamentos: t.pagamentos.map((p) => ({ ...p, valor: Math.round(p.valor * fator), valorPrincipal: Math.round(p.valorPrincipal * fator) })),
  }
}

/** Valor que a venda soma: convertido (moeda principal) ou só o que foi pago numa moeda. */
export function valorEm(t: Transacao, moeda: string | undefined) {
  if (!moeda || moeda === 'convertido') return t.totalPrincipal
  return t.pagamentos.filter((p) => p.moeda === moeda).reduce((s, p) => s + p.valor, 0)
}

/** Lista de vendas (é a mesma lista que forma os números do painel: soma de "valor" = cartão). */
export async function vendas(ctx: Ctx, f: FiltroVendas = {}) {
  const todas = await ctx.repos.transacoes.listar({ tipo: 'venda' })
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p]))
  const viagens = await mapaViagens(ctx)
  const viagemDaCompra = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).filter((t) => t.viagemId).map((t) => [t.id, viagens.get(t.viagemId!)]))
  const viagensDaVenda = (t: Transacao) => [...new Map(t.linhas.flatMap((l) => comprasDe(l.itemId ? itens.get(l.itemId) : undefined)).map((c) => viagemDaCompra.get(c)).filter((v): v is NonNullable<typeof v> => !!v).map((v) => [v.id, v])).values()]
  const etapa = f.etapa ?? 'concluido'
  const cfg = await lerConfig(ctx)
  const vivas = new Set(cfg.formas.filter((x) => x.vivo).map((x) => x.id))
  const anexos = await ctx.repos.anexos.listar()
  const saldoConta = new Map<string, number>()
  for (const m of await ctx.repos.movConta.listar()) saldoConta.set(m.pessoaId, (saldoConta.get(m.pessoaId) ?? 0) + m.delta)
  return todas
    .filter((t) => t.etapa === etapa)
    .filter((t) => (!f.de || t.data >= f.de) && (!f.ate || t.data <= f.ate))
    .filter((t) => !f.pessoaId || t.pessoaId === f.pessoaId)
    .filter((t) => !f.localId || t.localId === f.localId)
    .filter((t) => !f.itemId || t.linhas.some((l) => l.itemId === f.itemId))
    .filter((t) => !f.forma || t.pagamentos.some((p) => p.forma === f.forma))
    .filter((t) => !f.moeda || t.pagamentos.some((p) => p.moeda === f.moeda))
    .filter((t) => !f.usuarioId || t.criadoPor === f.usuarioId || t.historico.some((h) => h.por === f.usuarioId))
    .map((t) => ({ original: t, recorte: recortarVenda(t, { moduloId: f.moduloId, profissionalId: f.profissionalId }, (id) => itens.get(id)?.moduloId) }))
    .filter((x): x is { original: Transacao; recorte: Transacao } => !!x.recorte)
    .map(({ original, recorte }) => ({
      ...original,
      cliente: original.pessoaId ? pessoas.get(original.pessoaId)?.nome : undefined,
      viagens: viagensDaVenda(original),
      feitoPor: original.historico.find((h) => h.para === 'concluido')?.porNome ?? original.historico[0]?.porNome,
      /** quem vendeu/atendeu (a vendedora), separado de quem registrou no sistema (feitoPor) */
      vendedora: original.profissionalId ? pessoas.get(original.profissionalId)?.nome : undefined,
      pendencias: pendenciasVenda(original, anexos, vivas, original.pessoaId ? saldoConta.get(original.pessoaId) : undefined),
      valor: valorEm(recorte, f.moeda),
      lucroPrincipal: recorte.linhas.reduce((s, l) => s + l.totalPrincipal - (l.custoPrincipal ?? 0) - (l.insumoPrincipal ?? 0) - (l.comissaoPrincipal ?? 0), 0),
    }))
    .filter((v) => !f.pendencia || (f.pendencia === 'qualquer' ? v.pendencias.length > 0 : v.pendencias.some((x) => x.id === f.pendencia)))
    .sort((a, b) => (a.data + a.criadoEm < b.data + b.criadoEm ? 1 : -1))
}

/** Agenda: atendimentos agendados num intervalo (por profissional e local). */
export async function agenda(ctx: Ctx, p: { de: string; ate: string; profissionalId?: Id; localId?: Id }) {
  if (ctx.sessao.perfil === 'funcionario') p = { ...p, profissionalId: ctx.sessao.pessoaId ?? ctx.sessao.usuarioId }
  const todas = await ctx.repos.transacoes.listar({ tipo: 'venda' })
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const locais = new Map((await ctx.repos.locais.listar()).map((x) => [x.id, x]))
  return todas
    .filter((t) => t.agendadoPara && t.etapa !== 'cancelado')
    .filter((t) => {
      const d = dataDeInstante(t.agendadoPara!)
      return d >= p.de && d <= p.ate
    })
    .filter((t) => !p.profissionalId || t.profissionalId === p.profissionalId || t.linhas.some((l) => l.profissionalId === p.profissionalId))
    .filter((t) => !p.localId || t.localId === p.localId)
    .map((t, _i, todos) => ({
      ...t,
      conflito: t.etapa === 'agendado' && todos.some((o) => o.id !== t.id && o.etapa === 'agendado' && o.profissionalId && o.profissionalId === t.profissionalId && Math.abs(Date.parse(o.agendadoPara!) - Date.parse(t.agendadoPara!)) < 60 * 60000),
      cliente: t.pessoaId ? pessoas.get(t.pessoaId)?.nome : undefined,
      profissional: t.profissionalId ? pessoas.get(t.profissionalId)?.nome : undefined,
      local: t.localId ? locais.get(t.localId)?.nome : undefined,
    }))
    .sort((a, b) => (a.agendadoPara! < b.agendadoPara! ? -1 : 1))
}

export async function venda(ctx: Ctx, p: { id: Id }) {
  const t = await ctx.repos.transacoes.obter(p.id)
  exigir(t, 'Venda não encontrada.')
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const anexos = await ctx.repos.anexos.listar({ donoId: t.id })
  const local = t.localId ? await ctx.repos.locais.obter(t.localId) : undefined
  // de que viagem(ns) veio o cabelo vendido (pela compra de cada pacote)
  const vmapa = await mapaViagens(ctx)
  const itensV = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const compras = new Map((await ctx.repos.transacoes.listar({ tipo: 'compra' })).map((c) => [c.id, c]))
  const viagens = [...new Map(t.linhas.flatMap((l) => comprasDe(l.itemId ? itensV.get(l.itemId) : undefined)).map((c) => compras.get(c)?.viagemId).map((id) => (id ? vmapa.get(id) : undefined)).filter((v): v is NonNullable<typeof v> => !!v).map((v) => [v.id, v])).values()]
  return { venda: t, cliente: t.pessoaId ? pessoas.get(t.pessoaId) : undefined, profissional: t.profissionalId ? pessoas.get(t.profissionalId) : undefined, local, anexos, viagens }
}
