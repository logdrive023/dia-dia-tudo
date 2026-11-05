// MOTOR CONTÁBIL — o relatório "simples por fora, completo por dentro" (CONTABILIDADE.md). O padrão BOLIVIANO é o
// motor; o brasileiro muda só o que é diferente (a ordem do resultado e os impostos). Tudo na moeda principal.
//   resumo:    Estado de Resultados (🇧🇴) ou DRE (🇧🇷) — cada linha diz de que anexo vem
//   balanco:   Activo · Pasivo (inclui os impostos do período a pagar) · Patrimonio
//   impostos:  a conta de cada imposto (base × taxa)
//   conferencia: cada total do resumo × o anexo dele (✓ fecha ou ⚠ com a diferença)
//   anexos:    libro diario/caixa por moeda, ventas e compras línea por línea, inventario, cuentas por cobrar/pagar,
//              gastos por categoría — cada centavo
// Os números base vêm dos relatórios que já existem (dre, balanco, livroCaixa…): o motor só organiza e calcula impostos.

import { NOMES_REGIME, aplicar, impostosDaOperacao } from '../dados/impostos'
import type { Ctx } from './contexto'
import { lerConfig } from './contexto'
import { balanco, comprasDetalhadas, dre, inventario, livroCaixa, vendasDetalhadas } from './relatorios'

export type TipoLinha = 'conta' | 'subtotal' | 'total'
export interface LinhaRelatorio {
  id: string
  rotulo: string
  valor: number
  tipo: TipoLinha
  /** de qual anexo vem (a tela leva até ele) */
  anexo?: 'vendas' | 'compras' | 'gastos' | 'impostos' | 'inventario' | 'diario' | 'cuentas'
  /** a conta, quando é calculada ("13% × Bs 10.000") */
  conta?: string
}

const meses = (de: string, ate: string) => {
  const [a1, m1] = de.split('-').map(Number)
  const [a2, m2] = ate.split('-').map(Number)
  return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1)
}

export async function relatorioContabil(ctx: Ctx, p: { de: string; ate: string; padrao?: 'BO' | 'BR' }) {
  const cfg = await lerConfig(ctx)
  const fis = cfg.fiscal
  const pais = p.padrao ?? fis.pais
  const BO = pais === 'BO'
  const regime = BO ? fis.regimeBO : fis.regimeBR
  const m = cfg.moedaPrincipal
  const fmtPct = (bp: number) => `${(bp / 100).toLocaleString('es-BO')}%`

  const [r, bal, diario, inv, vendas, compras] = await Promise.all([
    dre(ctx, { de: p.de, ate: p.ate }),
    balanco(ctx),
    livroCaixa(ctx, { de: p.de, ate: p.ate }),
    inventario(ctx),
    vendasDetalhadas(ctx, { de: p.de, ate: p.ate }),
    comprasDetalhadas(ctx, { de: p.de, ate: p.ate }),
  ])
  const gastos = r.linhas.filter((l) => l.nivel === 1 && !['(−) Descontos', '(−) Custo do que foi vendido', '(−) Insumos dos serviços', '(−) Comissões'].includes(l.conta)).map((l) => ({ categoria: l.conta.replace(/^\(−\) /, ''), valor: -l.valor }))
  const totalGastos = gastos.reduce((s, g) => s + g.valor, 0)
  const comprasPeriodo = compras.filter((c) => c.etapa !== 'cancelado' && c.etapa !== 'recusado').reduce((s, c) => s + c.totalPrincipal, 0)
  const custoServicos = r.insumos + r.comissoes

  // ---------- impostos ----------
  const impostos: LinhaRelatorio[] = []
  const notas: string[] = []
  let resultados: LinhaRelatorio[]
  let ivaPagar = 0
  let itPagar = 0
  let impostoLucro = 0
  // IVA e IT: a taxa vem da LISTA de impostos vigentes (Configurações › Fiscal); desligado na lista = não entra
  const daLista = (id: string, padrao: number) => { const i = fis.impostos?.find((x) => x.id === id); return i ? (i.ligado ? i.taxaBp : 0) : padrao }
  const ivaBp = daLista('iva', fis.ivaBp)
  const itBp = daLista('it', fis.itBp)
  if (BO) {
    const general = regime === 'general'
    const ivaDebito = general && fis.vendasComFatura ? aplicar(r.receita, ivaBp) : 0
    const ivaCredito = general && fis.comprasComFatura ? aplicar(comprasPeriodo, ivaBp) : 0
    // custo sem o crédito fiscal (a parte do IVA que volta não é custo)
    const cmv = general && fis.comprasComFatura ? r.cmv - aplicar(r.cmv, ivaBp) : r.cmv
    const it = general ? aplicar(r.receita, itBp) : 0
    const rts = !general ? Math.round((fis.rtsCuotaBimestral * meses(p.de, p.ate)) / 2) : 0
    const ventasNetas = r.receita - ivaDebito
    const utilidadBruta = ventasNetas - cmv - custoServicos
    const antesIue = utilidadBruta - totalGastos - it - rts
    const iue = general && antesIue > 0 ? aplicar(antesIue, fis.iueBp) : 0
    ivaPagar = Math.max(0, ivaDebito - ivaCredito)
    itPagar = it
    impostoLucro = iue
    resultados = [
      { id: 'ventas', rotulo: general && fis.vendasComFatura ? 'Ventas brutas (facturado)' : 'Ventas', valor: r.receita, tipo: 'conta', anexo: 'vendas' },
      ...(ivaDebito ? [{ id: 'iva', rotulo: `(−) IVA débito fiscal (${fmtPct(ivaBp)})`, valor: -ivaDebito, tipo: 'conta' as const, anexo: 'impostos' as const, conta: `${fmtPct(ivaBp)} × ventas facturadas` }] : []),
      ...(ivaDebito ? [{ id: 'ventasNetas', rotulo: 'Ventas netas', valor: ventasNetas, tipo: 'subtotal' as const }] : []),
      { id: 'costo', rotulo: '(−) Costo de ventas', valor: -cmv, tipo: 'conta', anexo: 'vendas' },
      ...(custoServicos ? [{ id: 'servicios', rotulo: '(−) Insumos y comisiones de servicios', valor: -custoServicos, tipo: 'conta' as const, anexo: 'vendas' as const }] : []),
      { id: 'bruta', rotulo: 'Utilidad bruta', valor: utilidadBruta, tipo: 'subtotal' },
      ...gastos.map((g, k) => ({ id: `gasto${k}`, rotulo: `(−) ${g.categoria}`, valor: -g.valor, tipo: 'conta' as const, anexo: 'gastos' as const })),
      ...(it ? [{ id: 'it', rotulo: `(−) Impuesto a las Transacciones (IT ${fmtPct(itBp)})`, valor: -it, tipo: 'conta' as const, anexo: 'impostos' as const, conta: `${fmtPct(itBp)} × ingresos brutos` }] : []),
      ...(!general ? [{ id: 'rts', rotulo: '(−) Cuota RTS', valor: -rts, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
      { id: 'antes', rotulo: general ? 'Utilidad antes del IUE' : 'Utilidad del período', valor: antesIue, tipo: general ? 'subtotal' : 'total' },
      ...(general ? [{ id: 'iue', rotulo: `(−) IUE estimado (${fmtPct(fis.iueBp)})`, valor: -iue, tipo: 'conta' as const, anexo: 'impostos' as const, conta: `${fmtPct(fis.iueBp)} × utilidad` }] : []),
      ...(general ? [{ id: 'neta', rotulo: 'Utilidad neta del período', valor: antesIue - iue, tipo: 'total' as const }] : []),
    ]
    if (general) {
      impostos.push(
        { id: 'ivaD', rotulo: 'IVA débito fiscal (ventas facturadas)', valor: ivaDebito, tipo: 'conta', conta: fis.vendasComFatura ? `${fmtPct(ivaBp)} × ${r.receita / 100}` : 'ventas sin factura' },
        { id: 'ivaC', rotulo: '(−) IVA crédito fiscal (compras con factura)', valor: -ivaCredito, tipo: 'conta', conta: fis.comprasComFatura ? `${fmtPct(ivaBp)} × ${comprasPeriodo / 100}` : 'compras sin factura' },
        { id: 'ivaP', rotulo: ivaDebito >= ivaCredito ? 'IVA a pagar' : 'Saldo a favor (crédito fiscal)', valor: ivaDebito - ivaCredito, tipo: 'subtotal' },
        { id: 'itP', rotulo: `IT a pagar (${fmtPct(itBp)} × ingresos brutos)`, valor: it, tipo: 'subtotal' },
        { id: 'iueP', rotulo: `IUE estimado (${fmtPct(fis.iueBp)} × utilidad)`, valor: iue, tipo: 'subtotal' },
        { id: 'totalImp', rotulo: 'Total de impuestos del período', valor: ivaPagar + it + iue, tipo: 'total' },
      )
      notas.push('El IUE es anual: aquí se muestra la provisión del período. El IUE pagado se compensa con el IT de los períodos siguientes.')
      if (!fis.comprasComFatura) notas.push('Compras sin factura: no generan crédito fiscal (lo normal al comprar cabello a personas).')
    } else {
      impostos.push({ id: 'rtsP', rotulo: `Cuota RTS (${meses(p.de, p.ate)} mes(es) · ${fis.rtsCuotaBimestral / 100} por bimestre)`, valor: rts, tipo: 'total' })
      notas.push('Régimen Tributario Simplificado: sin IVA, IT ni IUE por separado.')
    }
    notas.push('Sin reexpresión por inflación (UFV): suspendida por Res. CTNAC 03/2020. Valores del período.')
  } else {
    // 🇧🇷 a DRE: receita bruta → deduções (impostos sobre a venda, descontos) → receita líquida → CMV → …
    const simples = regime === 'simples'
    const das = simples ? aplicar(r.receitaBruta, fis.simplesBp) : 0
    const pis = !simples ? aplicar(r.receitaBruta, fis.pisBp) : 0
    const cofins = !simples ? aplicar(r.receitaBruta, fis.cofinsBp) : 0
    const icms = !simples ? aplicar(r.receitaBruta, fis.icmsIssBp) : 0
    const liquida = r.receitaBruta - r.descontos - das - pis - cofins - icms
    const lucroBruto = liquida - r.cmv - custoServicos
    const lair = lucroBruto - totalGastos
    const irpj = !simples ? aplicar(r.receitaBruta, fis.irpjCsllBp) : 0
    ivaPagar = das + pis + cofins + icms
    impostoLucro = irpj
    resultados = [
      { id: 'bruta', rotulo: 'Receita bruta', valor: r.receitaBruta, tipo: 'conta', anexo: 'vendas' },
      ...(r.descontos ? [{ id: 'desc', rotulo: '(−) Descontos concedidos', valor: -r.descontos, tipo: 'conta' as const, anexo: 'vendas' as const }] : []),
      ...(das ? [{ id: 'das', rotulo: `(−) Simples Nacional — DAS (${fmtPct(fis.simplesBp)})`, valor: -das, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
      ...(pis ? [{ id: 'pis', rotulo: `(−) PIS (${fmtPct(fis.pisBp)})`, valor: -pis, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
      ...(cofins ? [{ id: 'cofins', rotulo: `(−) COFINS (${fmtPct(fis.cofinsBp)})`, valor: -cofins, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
      ...(icms ? [{ id: 'icms', rotulo: `(−) ICMS / ISS (${fmtPct(fis.icmsIssBp)})`, valor: -icms, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
      { id: 'liquida', rotulo: 'Receita líquida', valor: liquida, tipo: 'subtotal' },
      { id: 'cmv', rotulo: '(−) Custo das mercadorias vendidas (CMV)', valor: -r.cmv, tipo: 'conta', anexo: 'vendas' },
      ...(custoServicos ? [{ id: 'csp', rotulo: '(−) Custo dos serviços (insumos e comissões)', valor: -custoServicos, tipo: 'conta' as const, anexo: 'vendas' as const }] : []),
      { id: 'lb', rotulo: 'Lucro bruto', valor: lucroBruto, tipo: 'subtotal' },
      ...gastos.map((g, k) => ({ id: `gasto${k}`, rotulo: `(−) ${g.categoria}`, valor: -g.valor, tipo: 'conta' as const, anexo: 'gastos' as const })),
      { id: 'lair', rotulo: 'Resultado antes do IR e da CSLL (LAIR)', valor: lair, tipo: 'subtotal' },
      ...(!simples ? [{ id: 'irpj', rotulo: `(−) IRPJ e CSLL (${fmtPct(fis.irpjCsllBp)} da receita)`, valor: -irpj, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
      { id: 'll', rotulo: 'Lucro líquido do período', valor: lair - irpj, tipo: 'total' },
    ]
    impostos.push(
      ...(simples
        ? [{ id: 'dasP', rotulo: `DAS (${fmtPct(fis.simplesBp)} × receita bruta)`, valor: das, tipo: 'conta' as const }]
        : [
          { id: 'pisP', rotulo: `PIS (${fmtPct(fis.pisBp)})`, valor: pis, tipo: 'conta' as const },
          { id: 'cofP', rotulo: `COFINS (${fmtPct(fis.cofinsBp)})`, valor: cofins, tipo: 'conta' as const },
          ...(icms ? [{ id: 'icmsP', rotulo: `ICMS / ISS (${fmtPct(fis.icmsIssBp)})`, valor: icms, tipo: 'conta' as const }] : []),
          { id: 'irP', rotulo: `IRPJ + CSLL (${fmtPct(fis.irpjCsllBp)} da receita)`, valor: irpj, tipo: 'conta' as const },
        ]),
      { id: 'totalImp', rotulo: 'Total de impostos do período', valor: das + pis + cofins + icms + irpj, tipo: 'total' },
    )
    notas.push(simples ? 'Simples Nacional: o DAS já inclui IRPJ, CSLL, PIS, COFINS e ICMS/ISS (alíquota efetiva configurada).' : 'Lucro Presumido: IRPJ e CSLL calculados sobre a receita presumida (comércio), conforme as taxas configuradas.')
  }

  // ---------- balanço (com os impostos do período a pagar) ----------
  const impostosPagar = ivaPagar + itPagar + impostoLucro
  const ativo: LinhaRelatorio[] = bal.ativos.map((a, k) => ({ id: `a${k}`, rotulo: rotuloBalanco(a.conta, BO), valor: a.valor, tipo: 'conta', anexo: a.conta.startsWith('Caixa') ? 'diario' : a.conta.startsWith('Estoque') ? 'inventario' : 'cuentas' }))
  const passivo: LinhaRelatorio[] = [
    ...bal.passivos.map((a, k) => ({ id: `p${k}`, rotulo: rotuloBalanco(a.conta, BO), valor: a.valor, tipo: 'conta' as const, anexo: 'cuentas' as const })),
    ...(impostosPagar ? [{ id: 'impPagar', rotulo: BO ? 'Impuestos por pagar (del período)' : 'Impostos a recolher (do período)', valor: impostosPagar, tipo: 'conta' as const, anexo: 'impostos' as const }] : []),
  ]
  const totalAtivo = ativo.reduce((s, x) => s + x.valor, 0)
  const totalPassivo = passivo.reduce((s, x) => s + x.valor, 0)

  // ---------- conferência: cada total do resumo × o anexo dele ----------
  const somaVendas = vendas.reduce((s, l) => s + l.totalPrincipal, 0)
  const somaCusto = vendas.reduce((s, l) => s + l.custo, 0)
  const conferencia = [
    { id: 'vendas', rotulo: BO ? 'Ventas = suma del anexo de ventas' : 'Receita = soma do anexo de vendas', esperado: r.receita, achado: somaVendas },
    { id: 'custo', rotulo: BO ? 'Costo de ventas = suma del anexo' : 'CMV = soma do anexo', esperado: r.cmv, achado: somaCusto },
    { id: 'gastos', rotulo: BO ? 'Gastos = suma por categoría' : 'Despesas = soma por categoria', esperado: r.despesas, achado: totalGastos },
    ...diario.map((d) => ({ id: `caixa-${d.moeda}`, rotulo: `${BO ? 'Caja' : 'Caixa'} ${d.moeda}: ${BO ? 'saldo inicial + entradas − salidas = saldo final' : 'saldo inicial + entradas − saídas = saldo final'}`, esperado: d.final, achado: d.inicial + d.entradas - d.saidas, moeda: d.moeda })),
    { id: 'estoque', rotulo: BO ? 'Inventario del balance = suma del anexo' : 'Estoque do balanço = soma do anexo', esperado: bal.ativos.find((a) => a.conta.startsWith('Estoque'))?.valor ?? 0, achado: inv.valor },
  ].map((c) => ({ ...c, ok: c.esperado === c.achado, diferenca: c.achado - c.esperado }))

  const resultadoFinal = resultados[resultados.length - 1].valor
  return {
    pais,
    regime,
    regimeNome: NOMES_REGIME[regime].nome,
    titulo: BO ? 'Estados Financieros' : 'Demonstrações Contábeis',
    tituloResultado: BO ? 'Estado de Resultados' : 'Demonstração do Resultado do Exercício (DRE)',
    tituloBalanco: BO ? 'Balance General' : 'Balanço Patrimonial',
    empresa: { nome: fis.razaoSocial || cfg.nomeNegocio, nit: fis.nit, endereco: fis.endereco, atividade: fis.atividade, contador: fis.contador, representante: fis.representante },
    de: p.de,
    ate: p.ate,
    moeda: m,
    geradoEm: ctx.relogio.agora(),
    geradoPor: ctx.sessao.nome,
    numeros: { receita: r.receita, lucroBruto: resultados.find((l) => l.id === 'bruta' || l.id === 'lb')?.valor ?? 0, impostos: impostos.find((l) => l.id === 'totalImp' || l.id === 'rtsP')?.valor ?? 0, resultado: resultadoFinal, vendas: r.vendas },
    resultados,
    impostos,
    notas,
    balanco: { ativo, passivo, totalAtivo, totalPassivo, patrimonio: totalAtivo - totalPassivo },
    conferencia,
    anexos: {
      diario,
      vendas,
      compras,
      inventario: inv,
      gastos,
      devedores: bal.devedores,
      credores: bal.credores,
    },
  }
}

/** nomes das contas do balanço no padrão escolhido */
function rotuloBalanco(conta: string, BO: boolean) {
  const mapa: Record<string, [string, string]> = {
    'Estoque (a custo)': ['Inventario (a costo)', 'Estoques (a custo)'],
    'Pessoas que me devem': ['Cuentas por cobrar', 'Contas a receber'],
    'Empréstimos a receber': ['Préstamos por cobrar', 'Empréstimos a receber'],
    'Devo a pessoas': ['Cuentas por pagar', 'Contas a pagar'],
    'Empréstimos a pagar': ['Préstamos por pagar', 'Empréstimos a pagar'],
  }
  if (conta.startsWith('Caixa em ')) return `${BO ? 'Caja y bancos' : 'Caixa e equivalentes'} (${conta.slice(9)})`
  return mapa[conta]?.[BO ? 0 : 1] ?? conta
}

/** QUANTO DE IMPOSTO tem numa operação (a compra ou a venda que a pessoa está fazendo): só informa, não cobra.
 *  ligado = false quando a pessoa desligou "Mostrar impostos nas compras e vendas" (a tela não mostra nada). */
export async function impostosOperacao(ctx: Ctx, p: { produto?: number; servico?: number; compra?: number }) {
  const cfg = await lerConfig(ctx)
  const fis = cfg.fiscal
  const r = impostosDaOperacao(fis.impostos ?? [], p, fis.modoPreco ?? 'dentro')
  return { ligado: !!fis.mostrarNasOperacoes, noTotal: fis.mostrarNoTotal !== false, quadro: fis.mostrarQuadro !== false, pais: fis.pais, moeda: cfg.moedaPrincipal, ...r }
}
