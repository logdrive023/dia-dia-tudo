// IMPOSTO DE RENDA E OBRIGAÇÕES TRIBUTÁRIAS (Bolívia, Régimen General) — o exercício fiscal inteiro, a partir do que o
// sistema já registra (compras, estoque, vendas, caixa), com as regras VERSIONADAS de dados/tributosBO.ts.
// Diagnóstico e fontes: docs/business/FISCAL.md. É DEMONSTRATIVO INTERNO: nada é "declarado" ou "pago" sem a pessoa registrar
// (sem integração com o SIN), estimativa é marcada como estimativa, e o que depende do contador vira pendência.
// Cada número tem a sua ORIGEM: 'calculado' (das operações) · 'estimado' (imposto calculado pelo sistema) ·
// 'confirmado' (declaração/pagamento registrado) · 'pendente' (falta validar) · 'externo' (documento de fora).
import { formatar } from '../domain/dinheiro'
import { empresaFormatada } from '../domain/textoFormatado'
import { exigir } from '../domain/erros'
import type { Id } from '../domain/tipos'
import { aplicar, taxaDaLista } from '../dados/impostos'
import { feriadosEntre } from '../dados/feriados'
import { type IdObrigacao, type TipoAtividade, CIERRE, exercicio, regrasEm, ultimoDia, vencimentoMensal } from '../dados/tributosBO'
import { auditar, type Ctx, lerConfig, novo, tocar } from './contexto'
import { relatorioContabil } from './contabilidade'
import { dre } from './relatorios'

export type Origem = 'calculado' | 'estimado' | 'confirmado' | 'pendente' | 'externo'
export type SituacaoExercicio = 'aberto' | 'preparacao' | 'pendencias' | 'validacao' | 'revisado' | 'fechado'
export const NOMES_SITUACAO: Record<SituacaoExercicio, string> = { aberto: 'Em aberto', preparacao: 'Em preparação', pendencias: 'Com pendências', validacao: 'Aguardando validação', revisado: 'Revisado', fechado: 'Fechado' }

/** uma declaração/pagamento registrado pela pessoa (o que foi feito no SIAT) */
export interface RegistroObrigacao {
  id: Id
  ano: number
  /** 'AAAA-MM' (mensal) ou 'AAAA' (anual) */
  periodo: string
  obrigacao: IdObrigacao
  formulario: string
  numeroOrden?: string
  declaradoEm?: string
  valorDeclarado?: number
  pagoEm?: string
  valorPago?: number
  obs?: string
  porNome?: string
  em: string
}
interface EstadoExercicio { situacao: SituacaoExercicio; historico: { em: string; porNome: string; de: SituacaoExercicio; para: SituacaoExercicio; motivo?: string }[]; fechamento?: { em: string; porNome: string; versaoRegras: string; resumo: Record<string, number> } }

const CHAVE_REG = 'irObrigacoes'
const CHAVE_EX = 'irExercicios'
async function lerReg(ctx: Ctx) { return ((await ctx.repos.config.obter(CHAVE_REG))?.valor as RegistroObrigacao[] | undefined) ?? [] }
async function lerEx(ctx: Ctx) { return ((await ctx.repos.config.obter(CHAVE_EX))?.valor as Record<string, EstadoExercicio> | undefined) ?? {} }
async function gravar(ctx: Ctx, id: string, valor: unknown) {
  const r = await ctx.repos.config.obter(id)
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor }) : novo(ctx, { id, valor }))
}
const exigirAdmin = (ctx: Ctx) => exigir(ctx.sessao.perfil === 'admin', 'Só o administrador mexe no Imposto de Renda.')

/** um mês do exercício: o que entrou e saiu e cada imposto do mês (estimado) */
export interface MesIR {
  mes: string; versao: string; passou: boolean; futuro: boolean
  receita: number; nVendas: number; compras: number; nCompras: number; despesas: number; cmv: number
  debitoIva: number; creditoIva: number; saldoIvaFavor: number; iva: number; it: number; itCompensadoIue: number; retIue: number; retIt: number; baseRetencao: number
  salarios: number; vencimento: string
}

/** O EXERCÍCIO FISCAL inteiro: visão geral, cada obrigação mês a mês, o mês a mês, as validações e a situação */
export async function impostoRenda(ctx: Ctx, p: { ano: number }) {
  exigirAdmin(ctx)
  const cfg = await lerConfig(ctx)
  const fis = cfg.fiscal
  const emp = empresaFormatada(fis)
  const m = cfg.moedaPrincipal
  const hoje = ctx.relogio.hoje()
  const tipo: TipoAtividade = fis.tipoAtividade ?? 'comercial'
  const ex = exercicio(p.ano, tipo)
  const regras = regrasEm(ex.ate)
  const general = fis.regimeBO === 'general'
  const feriados = new Set(feriadosEntre(ex.de, ex.vencimentoAnual > ex.ate ? ex.vencimentoAnual : ex.ate, ['nacional'], cfg.feriadosAjustes, { pais: 'BO' }).map((f) => f.data))
  const registros = (await lerReg(ctx)).filter((r) => r.ano === p.ano || (r.ano === p.ano - 1 && r.obrigacao === 'iue'))
  const estado = (await lerEx(ctx))[String(p.ano)]

  // ---------- os dados do exercício ----------
  const todas = await ctx.repos.transacoes.listar()
  const noEx = (d: string) => d >= ex.de && d <= ex.ate
  const vendas = todas.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && noEx(t.data))
  const canceladas = todas.filter((t) => t.tipo === 'venda' && t.etapa === 'cancelado' && noEx(t.data))
  const compras = todas.filter((t) => t.tipo === 'compra' && t.etapa !== 'cancelado' && t.etapa !== 'recusado' && noEx(t.data))
  const caixa = await ctx.repos.movCaixa.listar()
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const despesas = caixa.filter((x) => x.tipo === 'despesa' && x.categoria !== 'Comissões' && !x.estornadoPor && noEx(x.data))
  const anexos = await ctx.repos.anexos.listar()
  const comOrigem = new Set(anexos.filter((a) => a.categoria === 'origem' || a.categoria === 'comprovante').map((a) => a.donoId))
  const docCompra = (t: (typeof compras)[number]) => (t.campos.docFiscal as string | undefined) ?? (fis.comprasComFatura ? 'factura' : 'sem')
  const valorDespesa = (x: (typeof despesas)[number]) => x.valorPrincipal ?? (x.moeda === m ? -x.delta : -x.delta)
  const dedutivel = (x: (typeof despesas)[number]) => !!x.docFiscal && x.docFiscal.documento !== 'sem' && x.docFiscal.dedutivel !== false
  const salarios = caixa.filter((x) => x.tipo === 'despesa' && !x.estornadoPor && noEx(x.data) && (x.categoria === 'Salários' || (!!x.pessoaId && /sal[aá]rio|di[aá]ria/i.test(`${x.categoria ?? ''} ${x.descricao}`))))

  // ---------- o mês a mês ----------
  let saldoIva = 0 // crédito de IVA a favor que passa de um mês para o outro (dentro do exercício)
  // o IUE pago do exercício anterior compensa o IT dos meses seguintes (Ley 843 art. 77), até acabar
  const iueAnt = registros.filter((r) => r.obrigacao === 'iue' && r.ano === p.ano - 1 && r.pagoEm && r.valorPago)
  let compensa = iueAnt.reduce((s, r) => s + (r.valorPago ?? 0), 0)
  const compensaDesde = iueAnt.map((r) => r.pagoEm!.slice(0, 7)).sort()[0]
  const meses: MesIR[] = []
  for (const mes of ex.meses) {
    const de = `${mes}-01`
    const ate = ultimoDia(mes)
    const v = regrasEm(ate)
    const r = await dre(ctx, { de, ate })
    const comprasMes = compras.filter((t) => t.data.slice(0, 7) === mes)
    const comFactura = comprasMes.filter((t) => docCompra(t) === 'factura')
    const semFactura = comprasMes.filter((t) => docCompra(t) !== 'factura')
    const despMes = despesas.filter((x) => x.data.slice(0, 7) === mes)
    const despFactura = despMes.filter((x) => x.docFiscal?.documento === 'factura')
    // a taxa é a da configuração (a mesma dos Estados financeiros); sem o imposto na lista, a da lei do mês
    const ivaBp = taxaDaLista(fis, 'iva', v.obrigacoes.find((o) => o.id === 'iva')!.aliquotaBp!)
    const itBp = taxaDaLista(fis, 'it', v.obrigacoes.find((o) => o.id === 'it')!.aliquotaBp!)
    const debito = general && fis.vendasComFatura ? aplicar(r.receita, ivaBp) : 0
    const credito = general ? aplicar(comFactura.reduce((s, t) => s + t.totalPrincipal, 0) + despFactura.reduce((s, x) => s + valorDespesa(x), 0), ivaBp) : 0
    const ivaLiq = debito - credito - saldoIva
    const iva = Math.max(0, ivaLiq)
    saldoIva = Math.max(0, -ivaLiq)
    const itBruto = general ? aplicar(r.receita, itBp) : 0
    const podeCompensar = !!compensaDesde && mes > compensaDesde
    const usado = podeCompensar ? Math.min(compensa, itBruto) : 0
    compensa -= usado
    const baseRet = semFactura.reduce((s, t) => s + t.totalPrincipal, 0)
    const retIue = general ? aplicar(baseRet, v.retencao.bensIueBp) : 0
    const retIt = general ? aplicar(baseRet, v.retencao.bensItBp) : 0
    const passou = ate < hoje
    meses.push({
      mes, versao: v.versao, passou, futuro: de > hoje,
      receita: r.receita, nVendas: r.vendas, compras: comprasMes.reduce((s, t) => s + t.totalPrincipal, 0), nCompras: comprasMes.length,
      despesas: r.despesas, cmv: r.cmv,
      debitoIva: debito, creditoIva: credito, saldoIvaFavor: saldoIva, iva, it: itBruto - usado, itCompensadoIue: usado, retIue, retIt, baseRetencao: baseRet,
      salarios: salarios.filter((x) => x.data.slice(0, 7) === mes).reduce((s, x) => s + valorDespesa(x), 0),
      vencimento: vencimentoMensal(mes, fis.nit, feriados),
    })
  }

  // ---------- o anual (o mesmo estado de resultados do relatório contábil) ----------
  const cmvAno = meses.reduce((s, x) => s + x.cmv, 0)
  const rel = await relatorioContabil(ctx, { de: ex.de, ate: ex.ate, padrao: 'BO' })
  const linha = (id: string) => rel.resultados.find((l) => l.id === id)?.valor ?? 0
  const lucroContabil = linha('antes')
  const naoDedutiveis = despesas.filter((x) => !dedutivel(x))
  const ajusteNaoDedutivel = naoDedutiveis.reduce((s, x) => s + valorDespesa(x), 0)
  const lucroTributavel = lucroContabil + ajusteNaoDedutivel
  // o IUE pela taxa da configuração (a mesma dos Estados financeiros)
  const iueApurado = general ? aplicar(Math.max(0, lucroTributavel), fis.iueBp ?? regras.obrigacoes.find((o) => o.id === 'iue')!.aliquotaBp!) : 0

  // ---------- cada obrigação: apurado (estimado) × declarado/pago (confirmado) ----------
  const reg = (id: IdObrigacao, periodo: string) => registros.filter((r) => r.obrigacao === id && r.periodo === periodo)
  const somaReg = (rs: RegistroObrigacao[], k: 'valorDeclarado' | 'valorPago') => rs.reduce((s, r) => s + (r[k] ?? 0), 0)
  const situacaoDe = (apurado: number, rs: RegistroObrigacao[], venc: string, exige: boolean) => {
    const pago = somaReg(rs, 'valorPago')
    if (rs.some((r) => r.pagoEm) && pago >= apurado) return 'pago'
    if (rs.some((r) => r.declaradoEm)) return pago ? 'parcial' : 'declarado'
    if (!exige) return 'semMovimento'
    return venc < hoje ? 'vencido' : 'aVencer'
  }
  const valorMes = (id: IdObrigacao, x: (typeof meses)[number]) => ({ iva: x.iva, it: x.it, retIue: x.retIue, retIt: x.retIt, rcIva: 0, rcv: 0, iue: 0, eeff: 0 })[id]
  // IVA, IT e o RCV vão todo mês (mesmo sem movimento); retenções só quando houve compra sem factura; RC-IVA se pagou salário
  const exigeMes = (id: IdObrigacao, x: (typeof meses)[number]) => (id === 'retIue' || id === 'retIt' ? x.baseRetencao > 0 : id === 'rcIva' ? x.salarios > 0 : true)
  const aplicaveis = regras.obrigacoes.filter((o) => (general ? true : o.id === 'rcIva' || o.id === 'rcv'))
  const obrigacoes = aplicaveis.map((o) => {
    if (o.periodicidade === 'anual') {
      const rs = reg(o.id, String(p.ano))
      const apurado = o.id === 'iue' ? iueApurado : 0
      return { ...o, meses: [], apurado, declarado: somaReg(rs, 'valorDeclarado'), pago: somaReg(rs, 'valorPago'), pendente: Math.max(0, apurado - somaReg(rs, 'valorPago')), proximoVencimento: ex.vencimentoAnual as string | undefined, situacao: hoje <= ex.ate ? 'exercicioAberto' : situacaoDe(apurado, rs, ex.vencimentoAnual, true), registros: rs, origem: (o.calcula ? 'estimado' : 'pendente') as Origem }
    }
    const ms = meses.filter((x) => !x.futuro).map((x) => {
      const rs = reg(o.id, x.mes)
      const apurado = valorMes(o.id, x)
      return { mes: x.mes, apurado, declarado: somaReg(rs, 'valorDeclarado'), pago: somaReg(rs, 'valorPago'), vencimento: x.vencimento, situacao: x.passou ? situacaoDe(apurado, rs, x.vencimento, exigeMes(o.id, x)) : 'emCurso', registros: rs }
    })
    const apurado = ms.reduce((s, x) => s + x.apurado, 0)
    const pago = ms.reduce((s, x) => s + x.pago, 0)
    return { ...o, meses: ms, apurado, declarado: ms.reduce((s, x) => s + x.declarado, 0), pago, pendente: Math.max(0, apurado - pago), proximoVencimento: ms.find((x) => x.situacao === 'aVencer' || x.situacao === 'emCurso')?.vencimento, situacao: ms.some((x) => x.situacao === 'vencido') ? 'vencido' : ms.some((x) => x.situacao === 'aVencer') ? 'aVencer' : 'emDia', registros: ms.flatMap((x) => x.registros), origem: (o.calcula ? 'estimado' : 'pendente') as Origem }
  })

  // ---------- estoque: início e fim do exercício (pelo movimento) e a conferência com o CMV ----------
  const itens = await ctx.repos.itens.listar()
  const movs = await ctx.repos.movEstoque.listar()
  const valorEstoque = (ate: string) => itens.filter((i) => i.controlaEstoque).reduce((s, i) => {
    const saldo = movs.filter((x) => x.itemId === i.id && x.data <= ate).reduce((a, x) => a + x.delta, 0)
    return s + (i.quantidadeInicial && saldo > 0 ? Math.round(((i.custoPrincipal ?? 0) * saldo) / i.quantidadeInicial) : 0)
  }, 0)
  const diaAntes = (d: string) => { const [a, mm, dd] = d.split('-').map(Number); const x = new Date(Date.UTC(a, mm - 1, dd - 1)); return x.toISOString().slice(0, 10) }
  const estoqueInicial = valorEstoque(diaAntes(ex.de))
  const estoqueFinal = valorEstoque(ex.ate < hoje ? ex.ate : hoje)

  // ---------- validações: o que revisar antes de fechar ----------
  type Alerta = { id: string; nivel: 'critico' | 'atencao' | 'info'; titulo: string; detalhe: string; impacto: string; revisar: string; registros: { tela: string; id: Id; codigo?: string }[] }
  const alertas: Alerta[] = []
  const add = (a: Alerta) => alertas.push(a)
  if (!fis.nit?.trim()) add({ id: 'nit', nivel: 'critico', titulo: 'Sem NIT da empresa', detalhe: 'O NIT define o dia de vencimento das declarações mensais e vai no documento.', impacto: 'Os vencimentos foram calculados pelo dia 13 (o mais cedo).', revisar: 'Preencha o NIT em Configurações › Fiscal.', registros: [] })
  if (!fis.caeb?.trim() || !fis.tipoAtividade) add({ id: 'enquadramento', nivel: 'critico', titulo: 'Enquadramento a confirmar com o contador', detalhe: `Falta ${[!fis.caeb?.trim() && 'o código CAEB-SIN', !fis.tipoAtividade && 'o tipo de atividade'].filter(Boolean).join(' e ')}. Não existe código CAEB que diga "cabelo humano": o mais próximo é 4649400 (atacado) / 4772200 (varejo) e 9602100 (salão).`, impacto: 'Sem o tipo de atividade, o cierre foi considerado 31/12 (comercial). Se o NIT for industrial, o cierre é 31/03.', revisar: 'Confirme com o contador o CAEB e o tipo de atividade registrados no NIT.', registros: [] })
  const semFac = compras.filter((t) => docCompra(t) !== 'factura')
  if (general && semFac.length) {
    const semRet = [...new Set(semFac.map((t) => t.data.slice(0, 7)))].filter((mes) => !reg('retIue', mes).some((r) => r.declaradoEm))
    add({ id: 'retencoes', nivel: semRet.length ? 'critico' : 'info', titulo: `${semFac.length} compra(s) sem factura: retenção de 8% (IUE 5% + IT 3%)`, detalhe: `Quem compra de pessoa sem factura retém e paga o imposto dela (F-570 e F-410). Base do exercício: ${formatar(semFac.reduce((s, t) => s + t.totalPrincipal, 0), m)}.${semRet.length ? ` Meses sem retenção registrada: ${semRet.join(', ')}.` : ''}`, impacto: 'Sem a retenção paga, a compra NÃO é dedutível no IUE (DS 24051 art. 15) e há multa por não reter.', revisar: 'Marque as compras que vieram com factura; registre os F-570/F-410 feitos no SIAT.', registros: semFac.slice(0, 20).map((t) => ({ tela: 'pedido', id: t.id, codigo: t.codigo })) })
  }
  const semDoc = compras.filter((t) => !comOrigem.has(t.id) && !t.campos.docFiscal)
  if (semDoc.length) add({ id: 'comprasSemDoc', nivel: 'atencao', titulo: `${semDoc.length} compra(s) sem documento de respaldo`, detalhe: 'Nem factura, nem recibo, nem comprovante de origem anexado.', impacto: 'Compra sem respaldo pode ser recusada como custo no IUE.', revisar: 'Anexe o comprovante (recibo + cópia do CI do vendedor) ou marque o documento.', registros: semDoc.slice(0, 20).map((t) => ({ tela: 'pedido', id: t.id, codigo: t.codigo })) })
  if (naoDedutiveis.length) add({ id: 'despesasSemDoc', nivel: 'atencao', titulo: `${naoDedutiveis.length} gasto(s) sem documento ou não dedutível(is)`, detalhe: `Somam ${formatar(ajusteNaoDedutivel, m)} e foram somados de volta no lucro tributável (ajuste).`, impacto: 'Gasto sem documento original não abate o IUE (DS 24051 art. 8).', revisar: 'Marque o documento de cada gasto (factura, recibo) e se é dedutível.', registros: naoDedutiveis.slice(0, 20).map((x) => ({ tela: 'caixa', id: x.id, codigo: x.descricao })) })
  const semCusto = vendas.filter((t) => t.linhas.some((l) => l.itemId && itens.find((i) => i.id === l.itemId)?.controlaEstoque && !l.custoPrincipal))
  if (semCusto.length) add({ id: 'semCusto', nivel: 'atencao', titulo: `${semCusto.length} venda(s) sem custo de origem`, detalhe: 'O pacote vendido não tem custo (compra sem valor ou cadastro).', impacto: 'O CMV fica menor e o lucro (e o IUE) maior do que o real.', revisar: 'Ponha o valor na compra de origem.', registros: semCusto.slice(0, 20).map((t) => ({ tela: 'venda', id: t.id, codigo: t.codigo })) })
  if (general && fis.vendasComFatura && vendas.length) add({ id: 'facturas', nivel: 'info', titulo: `${vendas.length} venda(s): confira as facturas no SIAT`, detalhe: 'O sistema não emite factura (não está ligado ao SIN): o débito de IVA aqui é ESTIMADO pelas vendas.', impacto: 'O IVA declarado sai das facturas emitidas no SIAT, não deste cálculo.', revisar: 'Compare com o Registro de Compras y Ventas do mês.', registros: [] })
  if (canceladas.length) add({ id: 'canceladas', nivel: 'info', titulo: `${canceladas.length} venda(s) cancelada(s) no exercício`, detalhe: 'Não entram na receita nem nos impostos.', impacto: 'Se tinham factura emitida, a factura precisa estar anulada no SIAT.', revisar: 'Confira a anulação das facturas.', registros: canceladas.slice(0, 20).map((t) => ({ tela: 'venda', id: t.id, codigo: t.codigo })) })
  const vencidas = obrigacoes.flatMap((o) => o.meses.filter((x) => x.situacao === 'vencido').map((x) => `${o.sigla} ${x.mes}`))
  if (vencidas.length) add({ id: 'vencidas', nivel: 'critico', titulo: `${vencidas.length} obrigação(ões) vencida(s) sem declaração registrada`, detalhe: vencidas.slice(0, 12).join(' · '), impacto: 'Declaração fora do prazo tem multa e juros (Ley 2492 arts. 47 e 162).', revisar: 'Se já foi feita no SIAT, registre aqui; se não, fale com o contador.', registros: [] })
  const vazios = meses.filter((x) => x.passou && !x.nVendas && !x.nCompras).map((x) => x.mes)
  if (vazios.length) add({ id: 'semMovimento', nivel: 'info', titulo: `${vazios.length} mês(es) sem movimento`, detalhe: vazios.join(', '), impacto: 'IVA, IT e o RCV vão mesmo sem movimento.', revisar: 'Confirme que não faltou registrar nada.', registros: [] })
  if (salarios.length && !registros.some((r) => r.obrigacao === 'rcIva')) add({ id: 'rcIva', nivel: 'atencao', titulo: 'Salários pagos: RC-IVA dos dependentes', detalhe: `Pagou ${formatar(salarios.reduce((s, x) => s + valorDespesa(x), 0), m)} em salários no exercício.`, impacto: 'O empregador retém o RC-IVA acima de 2 salários mínimos (F-608).', revisar: 'Confira com o contador a planilha tributária e registre os F-608.', registros: [] })
  const conferencia = estoqueInicial + compras.reduce((s, t) => s + t.totalPrincipal, 0) - cmvAno - estoqueFinal
  if (Math.abs(conferencia) > Math.max(100, Math.round(estoqueFinal * 0.02)) && ex.ate < hoje) add({ id: 'estoque', nivel: 'atencao', titulo: 'Estoque × compras × CMV não fecham', detalhe: `Estoque inicial + compras − CMV − estoque final = ${formatar(conferencia, m)} (perdas, ajustes, triagem e gastos de viagem incorporados explicam parte).`, impacto: 'Pode haver compra, perda ou ajuste sem registro.', revisar: 'Confira o inventário físico do encerramento.', registros: [] })
  if (hoje <= ex.ate) add({ id: 'incompleto', nivel: 'info', titulo: 'Exercício em curso', detalhe: `O exercício vai até ${ex.ate}. Os números do ano ainda vão mudar.`, impacto: 'O IUE só é apurado depois do cierre.', revisar: '—', registros: [] })
  if (estado?.fechamento) {
    const mudou = ['lucroContabil', 'lucroTributavel', 'receita'].filter((k) => estado.fechamento!.resumo[k] !== ({ lucroContabil, lucroTributavel, receita: rel.numeros.receita } as Record<string, number>)[k])
    if (mudou.length) add({ id: 'mudouDepois', nivel: 'critico', titulo: 'Os dados mudaram depois do fechamento', detalhe: `Mudou: ${mudou.join(', ')}. O documento do fechamento continua com os números congelados.`, impacto: 'O que foi declarado pode não bater com o sistema.', revisar: 'Veja no histórico o que foi corrigido; reabra o exercício se precisar refazer.', registros: [] })
  }

  const kpi = (valor: number, origem: Origem) => ({ valor, origem })
  // os impostos CADASTRADOS em Configurações (não são os oficiais): entram no apurado e aparecem à parte, com o selo
  const cadastrados = rel.resumoImpostos.itens.filter((i) => i.cadastrado).map((i) => ({ sigla: i.sigla, rotulo: i.rotulo, valor: i.valor }))
  const impostosApurados = obrigacoes.reduce((s, o) => s + o.apurado, 0) + cadastrados.reduce((s, i) => s + i.valor, 0)
  const pagos = obrigacoes.reduce((s, o) => s + o.pago, 0)
  return {
    exercicio: { ...ex, cierreNome: CIERRE[tipo].nome, tipoConfirmado: !!fis.tipoAtividade },
    regras: { versao: regras.versao, vigenteDesde: regras.vigenteDesde, vigenteAte: regras.vigenteAte, notas: regras.notas, versoesNoExercicio: [...new Set(meses.map((x) => x.versao))] },
    empresa: { razaoSocial: emp.razaoSocial || cfg.nomeNegocio, nit: emp.nit ?? '', caeb: fis.caeb ?? '', naturezaJuridica: fis.naturezaJuridica ?? '', atividade: emp.atividade ?? '', endereco: emp.endereco ?? '', contador: emp.contador ?? '', representante: emp.representante ?? '', regime: general ? 'Régimen General' : 'Régimen Tributario Simplificado (RTS)' },
    moeda: m,
    hoje,
    visao: {
      receitaBruta: kpi(rel.numeros.receita, 'calculado'),
      nVendas: kpi(vendas.length, 'calculado'),
      compras: kpi(compras.reduce((s, t) => s + t.totalPrincipal, 0), 'calculado'),
      cmv: kpi(cmvAno, 'calculado'),
      despesas: kpi(despesas.reduce((s, x) => s + valorDespesa(x), 0), 'calculado'),
      lucroContabil: kpi(lucroContabil, 'estimado'),
      lucroTributavel: kpi(lucroTributavel, 'estimado'),
      impostosApurados: kpi(impostosApurados, 'estimado'),
      impostosPagos: kpi(pagos, 'confirmado'),
      impostosPendentes: kpi(Math.max(0, impostosApurados - pagos), 'pendente'),
      creditoIva: kpi(meses[meses.length - 1]?.saldoIvaFavor ?? 0, 'estimado'),
      estoqueInicial: kpi(estoqueInicial, 'calculado'),
      estoqueFinal: kpi(estoqueFinal, 'calculado'),
    },
    resultado: { iueBp: fis.iueBp ?? regras.obrigacoes.find((o) => o.id === 'iue')!.aliquotaBp!, linhas: rel.resultados, ajustes: [{ id: 'naoDedutiveis', rotulo: '(+) Gastos sem documento ou não dedutíveis', valor: ajusteNaoDedutivel }], lucroContabil, lucroTributavel, iue: iueApurado, perdasAnteriores: 'a informar pelo contador' },
    obrigacoes,
    /** impostos cadastrados pela pessoa (fora dos oficiais): o valor estimado do exercício */
    cadastrados,
    meses,
    alertas: alertas.sort((a, b) => ({ critico: 0, atencao: 1, info: 2 })[a.nivel] - ({ critico: 0, atencao: 1, info: 2 })[b.nivel]),
    situacao: estado?.situacao ?? (hoje <= ex.ate ? 'aberto' : 'preparacao'),
    historico: estado?.historico ?? [],
    fechamento: estado?.fechamento,
    auditoria: vendas.reduce((s, t) => s + t.totalPrincipal, 0) >= regras.limiteAuditoria,
    /** o RESPALDO de cada compra e gasto do exercício (para marcar o documento na própria tela) */
    documentos: {
      compras: compras.map((t) => ({ id: t.id, codigo: t.codigo, data: t.data, fornecedor: t.pessoaId ? (pessoas.get(t.pessoaId) ?? '') : '', valor: t.totalPrincipal, documento: docCompra(t), marcado: !!t.campos.docFiscal, comprovante: comOrigem.has(t.id) })),
      despesas: despesas.map((x) => ({ id: x.id, data: x.data, descricao: x.descricao, categoria: x.categoria ?? '', valor: valorDespesa(x), documento: x.docFiscal?.documento ?? 'sem', dedutivel: dedutivel(x) })),
    },
  }
}

/** os anos que têm movimento (para escolher o exercício) */
export async function exerciciosFiscais(ctx: Ctx, _p: object = {}) {
  exigirAdmin(ctx)
  const anos = new Set<number>([Number(ctx.relogio.hoje().slice(0, 4))])
  for (const t of await ctx.repos.transacoes.listar()) anos.add(Number(t.data.slice(0, 4)))
  return [...anos].sort((a, b) => b - a)
}

/** marca o DOCUMENTO de uma compra (factura · recibo com retenção · sem) ou de um gasto (e se é dedutível) */
export async function classificarDocumentoFiscal(ctx: Ctx, d: { alvo: 'compra' | 'despesa'; id: Id; documento: 'factura' | 'recibo' | 'sem'; dedutivel?: boolean; numero?: string }) {
  exigirAdmin(ctx)
  exigir(['factura', 'recibo', 'sem'].includes(d.documento), 'Documento inválido.')
  if (d.alvo === 'compra') {
    const t = await ctx.repos.transacoes.obter(d.id)
    exigir(t && t.tipo === 'compra', 'Compra não encontrada.')
    await ctx.repos.transacoes.salvar(tocar(ctx, { ...t, campos: { ...t.campos, docFiscal: d.documento, docFiscalNumero: d.numero?.trim() || undefined } }))
    await auditar(ctx, 'classificarDocumentoFiscal', t.id, `${t.codigo ?? ''} · documento: ${d.documento}${d.numero ? ` nº ${d.numero}` : ''}`)
    return { id: t.id }
  }
  const x = await ctx.repos.movCaixa.obter(d.id)
  exigir(x && x.tipo === 'despesa', 'Gasto não encontrado.')
  await ctx.repos.movCaixa.salvar(tocar(ctx, { ...x, docFiscal: { documento: d.documento, dedutivel: d.documento === 'sem' ? false : d.dedutivel !== false, numero: d.numero?.trim() || undefined } }))
  await auditar(ctx, 'classificarDocumentoFiscal', x.id, `${x.descricao} · documento: ${d.documento} · ${d.documento !== 'sem' && d.dedutivel !== false ? 'dedutível' : 'não dedutível'}`)
  return { id: x.id }
}

/** registra (ou corrige) uma declaração/pagamento feito no SIAT — o sistema não declara nada sozinho */
export async function registrarObrigacaoFiscal(ctx: Ctx, d: Omit<RegistroObrigacao, 'em' | 'porNome'>) {
  exigirAdmin(ctx)
  exigir(Number.isInteger(d.ano) && d.ano > 2000, 'Ano inválido.')
  exigir(d.periodo && (d.periodo === String(d.ano) || /^\d{4}-\d{2}$/.test(d.periodo)), 'Período inválido (AAAA-MM ou o ano).')
  exigir(d.declaradoEm || d.pagoEm, 'Diga a data da declaração ou do pagamento.')
  for (const k of ['valorDeclarado', 'valorPago'] as const) if (d[k] !== undefined) exigir(Number.isInteger(d[k]) && d[k]! >= 0, 'Valor inválido.')
  const lista = await lerReg(ctx)
  const r: RegistroObrigacao = { ...d, numeroOrden: d.numeroOrden?.trim() || undefined, obs: d.obs?.trim() || undefined, em: ctx.relogio.agora(), porNome: ctx.sessao.nome }
  await gravar(ctx, CHAVE_REG, [...lista.filter((x) => x.id !== d.id), r])
  await auditar(ctx, 'registrarObrigacaoFiscal', d.id, `${d.obrigacao} ${d.periodo} · ${d.formulario}${d.numeroOrden ? ` nº ${d.numeroOrden}` : ''}${d.valorPago !== undefined ? ` · pago ${formatar(d.valorPago, 'BOB')}` : ''}`)
  return { id: d.id }
}

export async function removerObrigacaoFiscal(ctx: Ctx, d: { id: Id; motivo: string }) {
  exigirAdmin(ctx)
  exigir(d.motivo?.trim(), 'Diga o motivo.')
  const lista = await lerReg(ctx)
  const r = lista.find((x) => x.id === d.id)
  exigir(r, 'Registro não encontrado.')
  await gravar(ctx, CHAVE_REG, lista.filter((x) => x.id !== d.id))
  await auditar(ctx, 'removerObrigacaoFiscal', d.id, `${r.obrigacao} ${r.periodo} removido · ${d.motivo}`)
  return { id: d.id }
}

/** muda a SITUAÇÃO do exercício; fechar congela os números e a versão das regras; reabrir exige o motivo (fica no histórico) */
export async function mudarSituacaoExercicio(ctx: Ctx, d: { ano: number; para: SituacaoExercicio; motivo?: string }) {
  exigirAdmin(ctx)
  exigir(d.para in NOMES_SITUACAO, 'Situação inválida.')
  const todos = await lerEx(ctx)
  const atual = todos[String(d.ano)] ?? { situacao: 'aberto' as SituacaoExercicio, historico: [] }
  if (atual.situacao === 'fechado' && d.para !== 'fechado') exigir(d.motivo?.trim(), 'Para reabrir um exercício fechado, diga o motivo (fica no histórico).')
  let fechamento = atual.fechamento
  if (d.para === 'fechado') {
    const r = await impostoRenda(ctx, { ano: d.ano })
    exigir(r.hoje > r.exercicio.ate, 'Só dá para fechar depois do cierre do exercício.')
    fechamento = { em: ctx.relogio.agora(), porNome: ctx.sessao.nome, versaoRegras: r.regras.versao, resumo: { receita: r.visao.receitaBruta.valor, lucroContabil: r.resultado.lucroContabil, lucroTributavel: r.resultado.lucroTributavel, iue: r.resultado.iue, impostosApurados: r.visao.impostosApurados.valor, impostosPagos: r.visao.impostosPagos.valor } }
  }
  todos[String(d.ano)] = { situacao: d.para, fechamento, historico: [...atual.historico, { em: ctx.relogio.agora(), porNome: ctx.sessao.nome, de: atual.situacao, para: d.para, motivo: d.motivo?.trim() || undefined }] }
  await gravar(ctx, CHAVE_EX, todos)
  await auditar(ctx, 'mudarSituacaoExercicio', String(d.ano), `Exercício ${d.ano}: ${NOMES_SITUACAO[atual.situacao]} → ${NOMES_SITUACAO[d.para]}${d.motivo ? ` · ${d.motivo}` : ''}`)
  return { ano: d.ano, situacao: d.para }
}
