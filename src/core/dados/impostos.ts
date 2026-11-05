// IMPOSTOS E PADRÕES CONTÁBEIS — a base do motor dos relatórios (o que vale, de onde vem). Texto completo, com as
// fontes e o porquê de cada regra: docs/CONTABILIDADE.md. Taxas em pontos-base (1300 = 13%).
//
// 🇧🇴 BOLÍVIA (o padrão do sistema) — Normas de Contabilidad (CTNAC/CAUB), Código de Comercio art. 37 (Diario, Mayor,
//    Inventarios y Balances) e Ley 843 (impostos):
//    · IVA 13% "por dentro": o preço faturado já inclui o imposto → débito fiscal = 13% das vendas faturadas;
//      crédito fiscal = 13% das compras com fatura. Fica FORA da venda (é do fisco): Ventas netas = faturado − IVA.
//    · IT 3% sobre o ingresso bruto (sem descontar custo) → aparece como GASTO no Estado de Resultados.
//    · IUE 25% sobre a utilidade (anual; o IUE pago compensa o IT dos períodos seguintes).
//    · RTS (Régimen Tributario Simplificado: comerciante minorista, artesano, vivandero): cuota fija bimestral, sem
//      IVA/IT/IUE separados e sem fatura com crédito fiscal.
//    · Ajuste por inflação (UFV): suspenso pelo CTNAC (Res. 03/2020, desde 11/12/2020); o SIN ainda usa UFV para o IUE.
//      O sistema NÃO reexpressa (mostra em valores do período) e avisa isso na nota do relatório.
// 🇧🇷 BRASIL (opcional) — Lei 6.404/76 art. 187 e CPC 26: DRE começa na RECEITA BRUTA, (−) deduções (impostos sobre a
//    venda, devoluções, descontos) = receita líquida, (−) CMV = lucro bruto, (−) despesas, (±) financeiro = LAIR,
//    (−) IRPJ/CSLL = lucro líquido. Simples Nacional: DAS sobre a receita (alíquota efetiva) e Livro Caixa.

export type PaisFiscal = 'BO' | 'BR'
export type RegimeBO = 'general' | 'rts'
export type RegimeBR = 'simples' | 'presumido'
export type RegimeFiscal = RegimeBO | RegimeBR

export interface ConfigFiscal {
  /** o padrão do relatório (o motor). Bolívia é o padrão do sistema. */
  pais: PaisFiscal
  /** regime na Bolívia */
  regimeBO: RegimeBO
  /** regime no Brasil (quando o padrão escolhido é o brasileiro) */
  regimeBR: RegimeBR
  /** dados que vão no cabeçalho do relatório */
  razaoSocial?: string
  nit?: string
  endereco?: string
  atividade?: string
  contador?: string
  representante?: string
  /** as FIRMAS (Contador · Representante legal) no fim do relatório impresso — padrão: sim; dá para tirar na hora */
  firmasNoRelatorio?: boolean
  /** 🇧🇴 Régimen General: as vendas saem com fatura? (débito fiscal IVA) · as compras vêm com fatura? (crédito fiscal) */
  vendasComFatura: boolean
  comprasComFatura: boolean
  /** taxas (pontos-base) — mudam por lei, por isso ficam na configuração */
  ivaBp: number
  itBp: number
  iueBp: number
  /** 🇧🇴 RTS: a cuota fija de cada bimestre (centavos na moeda principal) */
  rtsCuotaBimestral: number
  /** 🇧🇷 Simples Nacional: a alíquota efetiva do DAS sobre a receita */
  simplesBp: number
  /** 🇧🇷 Lucro presumido: PIS, COFINS, ICMS/ISS sobre a receita e IRPJ+CSLL (já na base presumida) */
  pisBp: number
  cofinsBp: number
  icmsIssBp: number
  irpjCsllBp: number
  /** mostrar o imposto na compra e na venda (e no Painel)? desligado = não aparece em lugar nenhum */
  mostrarNasOperacoes: boolean
  /** como mostrar (SÓ INFORMATIVO — nunca muda o preço cobrado):
   *  'dentro' = o imposto já está dentro do preço (Bolívia: IVA "por dentro") → "deste preço, Bs X é imposto"
   *  'fora'   = somado ao preço → "custo final com impostos: 60 + 9,60 = Bs 69,60" */
  modoPreco: 'dentro' | 'fora'
  /** a linha "🧾 impostos Bs X ›" embaixo do total (um toque abre o detalhe) */
  mostrarNoTotal: boolean
  /** o quadro com o detalhe às claras embaixo de "Nesta venda" / dos itens da compra */
  mostrarQuadro: boolean
  /** os impostos vigentes nas operações (a lista que a pessoa edita) — IVA/IT do relatório saem daqui */
  impostos: ImpostoOperacao[]
}

export const FISCAL_PADRAO: ConfigFiscal = {
  pais: 'BO',
  regimeBO: 'general',
  regimeBR: 'simples',
  vendasComFatura: true,
  comprasComFatura: false,
  ivaBp: 1300,
  itBp: 300,
  iueBp: 2500,
  rtsCuotaBimestral: 0,
  simplesBp: 600,
  pisBp: 65,
  cofinsBp: 300,
  icmsIssBp: 0,
  // presumido (comércio): IRPJ 15% × 8% da receita + CSLL 9% × 12% = 1,2% + 1,08% = 2,28% da receita
  irpjCsllBp: 228,
  mostrarNasOperacoes: true,
  modoPreco: 'dentro',
  mostrarNoTotal: true,
  mostrarQuadro: true,
  impostos: [
    { id: 'iva', sigla: 'IVA', nome: 'Impuesto al Valor Agregado', taxaBp: 1300, ligado: true, vendaProduto: true, vendaServico: true, compra: 'credito', fonte: 'Ley 843, arts. 1 y 15 (texto ordenado vigente)', vigenteDesde: '1986-05-20', conferidoEm: '2026-11-04', explica: 'Va incluido en el precio ("por dentro"): el 13% del total facturado es del fisco. En la compra con factura es crédito fiscal.',
    porQue: 'É o imposto sobre o consumo da Bolívia: quem compra paga, e a loja só repassa ao fisco. Por isso vem DENTRO do preço — dos Bs 100 cobrados, Bs 13 são do governo.',
    naPratica: 'Todo mês se paga o IVA das vendas MENOS o IVA das compras feitas com fatura (crédito fiscal). Cabelo comprado sem fatura não dá crédito. Venda sem fatura (ou regime RTS) não tem IVA por venda.' },
    { id: 'it', sigla: 'IT', nome: 'Impuesto a las Transacciones', taxaBp: 300, ligado: true, vendaProduto: true, vendaServico: true, compra: 'nao', fonte: 'Ley 843, arts. 72 a 77 (alícuota 3% por Ley 1606)', vigenteDesde: '1995-01-01', conferidoEm: '2026-11-04', explica: '3% sobre el ingreso bruto, sin descontar costos. El IUE pagado se compensa con el IT siguiente.',
    porQue: 'É um imposto sobre o faturamento bruto: incide sobre tudo o que entra, dê lucro ou não. Existe para o Estado arrecadar sobre cada transação.',
    naPratica: 'O IUE (25% sobre o lucro, pago uma vez por ano) já pago se desconta do IT dos meses seguintes. Quem está no RTS não paga IT por venda.' },
  ],
}

export const NOMES_REGIME: Record<RegimeFiscal, { nome: string; explica: string; quem: string; comoFunciona: string }> = {
  general: { nome: 'Régimen General', explica: 'Factura con IVA 13%, paga IT 3% sobre los ingresos e IUE 25% sobre la utilidad.',
    quem: 'Empresas e comércios que emitem fatura (NIT no Régimen General). É o padrão.',
    comoFunciona: 'Cada venda com fatura tem IVA 13% (dentro do preço) e IT 3%. Todo mês: IVA das vendas − IVA das compras com fatura, mais o IT. No fim do ano, IUE 25% sobre o lucro — e esse IUE se desconta do IT depois.' },
  rts: { nome: 'Régimen Tributario Simplificado (RTS)', explica: 'Cuota fija bimestral; sin IVA, IT ni IUE por separado y sin factura con crédito fiscal.',
    quem: 'Pequenos comerciantes e artesãos com capital e vendas pequenos (dentro dos limites do RTS).',
    comoFunciona: 'Paga uma cota FIXA a cada dois meses, conforme a categoria. Não há IVA nem IT por venda e não se emite fatura com crédito fiscal — por isso a venda não mostra imposto.' },
  simples: { nome: 'Simples Nacional', explica: 'DAS: uma alíquota única sobre a receita bruta (já inclui IRPJ, CSLL, PIS, COFINS e ICMS/ISS).',
    quem: 'Micro e pequenas empresas no Brasil (faturamento até o limite do Simples).',
    comoFunciona: 'Uma guia só por mês (DAS) com uma alíquota efetiva sobre a receita bruta, que sobe conforme o faturamento dos últimos 12 meses.' },
  presumido: { nome: 'Lucro Presumido', explica: 'PIS 0,65% e COFINS 3% sobre a receita; IRPJ e CSLL sobre um lucro presumido.',
    quem: 'Empresas no Brasil acima do Simples (ou que preferem este regime).',
    comoFunciona: 'PIS e COFINS sobre a receita todo mês; IRPJ e CSLL a cada trimestre sobre um lucro "presumido" (uma porcentagem fixa da receita), não sobre o lucro real.' },
}

/**
 * OS IMPOSTOS DA VENDA NO REGIME ESCOLHIDO (a mesma regra na tela e no registro):
 *   🇧🇴 RTS → nenhum imposto por venda (cota fixa bimestral) · Régimen General sem fatura → sem IVA na venda (o IT
 *   continua) · compras sem fatura → sem crédito de IVA · o DAS (Brasil) não entra na Bolívia
 *   🇧🇷 Simples → só o DAS · Presumido → sem DAS · IVA e IT (Bolívia) não entram no Brasil
 * Impostos criados pelo usuário (outros ids) passam como estão. `aviso` explica quando o regime tira tudo.
 */
export function impostosDoRegime(f: Pick<ConfigFiscal, 'pais' | 'regimeBO' | 'regimeBR' | 'vendasComFatura' | 'comprasComFatura' | 'impostos'>): { lista: ImpostoOperacao[]; aviso?: string } {
  const lista = f.impostos ?? []
  if (f.pais === 'BO') {
    if (f.regimeBO === 'rts') return { lista: [], aviso: 'RTS: paga uma cota fixa a cada dois meses — não há IVA nem IT por venda.' }
    return {
      lista: lista
        .filter((i) => i.id !== 'das')
        .map((i) => (i.id !== 'iva' ? i : { ...i, ...(f.vendasComFatura ? {} : { vendaProduto: false, vendaServico: false }), ...(f.comprasComFatura ? {} : { compra: 'nao' as const }) })),
      aviso: f.vendasComFatura ? undefined : 'Vendas sem fatura: não há IVA na venda (o IT continua).',
    }
  }
  if (f.regimeBR === 'presumido') return { lista: lista.filter((i) => i.id !== 'das' && i.id !== 'iva' && i.id !== 'it') }
  return { lista: lista.filter((i) => i.id !== 'iva' && i.id !== 'it') }
}

/** valor × taxa (pontos-base), arredondado ao centavo */
export const aplicar = (valor: number, bp: number) => Math.round((valor * bp) / 10000)

/** IVA "por dentro" (Bolívia): do preço faturado, quanto é imposto (13% do total) */
export const ivaDoFaturado = (faturado: number, ivaBp: number) => aplicar(faturado, ivaBp)

// ---------- IMPOSTOS NAS OPERAÇÕES (compra e venda): a lista vigente, toda configurável ----------
// Cada imposto diz onde se aplica: venda de produto (cabelo, mercadoria), venda de serviço (salão) e compra
// (na compra o normal é ser CRÉDITO fiscal, que abate o imposto da venda). O sistema só INFORMA quanto iria para o
// fisco — não muda preço nem cobra a mais. Desligado (mostrarNasOperacoes = false) não aparece em lugar nenhum.

export interface ImpostoOperacao {
  id: string
  /** "IVA" · "IT" · "DAS" */
  sigla: string
  nome: string
  taxaBp: number
  /** serviço com taxa diferente (vazio = a mesma do produto) */
  taxaServicoBp?: number
  ligado: boolean
  vendaProduto: boolean
  vendaServico: boolean
  /** na compra: não se aplica · é crédito fiscal (abate o da venda) · é custo (não recupera) */
  compra: 'nao' | 'credito' | 'custo'
  /** a ALÍQUOTA VIGENTE: de onde vem (lei/artigo), desde quando e quando foi conferida (CONTABILIDADE.md › Sincronização) */
  fonte?: string
  vigenteDesde?: string
  conferidoEm?: string
  /** como a conta é feita, em uma frase (aparece no detalhe da venda) */
  explica?: string
  /** O QUE É e POR QUE EXISTE, em palavras simples */
  porQue?: string
  /** NA PRÁTICA: por que o valor da venda não é exatamente o que se paga (créditos, compensações, regime) */
  naPratica?: string
}

export const IMPOSTOS_PADRAO_BO: ImpostoOperacao[] = [
  { id: 'iva', sigla: 'IVA', nome: 'Impuesto al Valor Agregado', taxaBp: 1300, ligado: true, vendaProduto: true, vendaServico: true, compra: 'credito', fonte: 'Ley 843, arts. 1 y 15 (texto ordenado vigente)', vigenteDesde: '1986-05-20', conferidoEm: '2026-11-04', explica: 'Va incluido en el precio ("por dentro"): el 13% del total facturado es del fisco. En la compra con factura es crédito fiscal.',
    porQue: 'É o imposto sobre o consumo da Bolívia: quem compra paga, e a loja só repassa ao fisco. Por isso vem DENTRO do preço — dos Bs 100 cobrados, Bs 13 são do governo.',
    naPratica: 'Todo mês se paga o IVA das vendas MENOS o IVA das compras feitas com fatura (crédito fiscal). Cabelo comprado sem fatura não dá crédito. Venda sem fatura (ou regime RTS) não tem IVA por venda.' },
  { id: 'it', sigla: 'IT', nome: 'Impuesto a las Transacciones', taxaBp: 300, ligado: true, vendaProduto: true, vendaServico: true, compra: 'nao', fonte: 'Ley 843, arts. 72 a 77 (alícuota 3% por Ley 1606)', vigenteDesde: '1995-01-01', conferidoEm: '2026-11-04', explica: '3% sobre el ingreso bruto, sin descontar costos. El IUE pagado se compensa con el IT siguiente.',
    porQue: 'É um imposto sobre o faturamento bruto: incide sobre tudo o que entra, dê lucro ou não. Existe para o Estado arrecadar sobre cada transação.',
    naPratica: 'O IUE (25% sobre o lucro, pago uma vez por ano) já pago se desconta do IT dos meses seguintes. Quem está no RTS não paga IT por venda.' },
]
export const IMPOSTOS_PADRAO_BR: ImpostoOperacao[] = [
  { id: 'das', sigla: 'DAS', nome: 'Simples Nacional (alíquota efetiva)', taxaBp: 600, ligado: true, vendaProduto: true, vendaServico: true, compra: 'nao', fonte: 'Lei Complementar 123/2006 (Anexos I e III)', vigenteDesde: '2018-01-01', conferidoEm: '2026-11-04', explica: 'Uma alíquota efetiva sobre a receita bruta, que depende da faixa de faturamento dos últimos 12 meses.',
    porQue: 'É o regime simplificado do Brasil para pequenas empresas: junta vários impostos (IRPJ, CSLL, PIS, COFINS, ICMS/ISS) numa guia só, o DAS.',
    naPratica: 'A alíquota efetiva muda com o faturamento dos últimos 12 meses: o valor aqui é uma estimativa com a taxa configurada.' },
]

export interface LinhaImposto { id: string; sigla: string; nome: string; taxaBp: number; base: number; valor: number; lado: 'venda' | 'compra'; credito?: boolean; fonte?: string; vigenteDesde?: string; conferidoEm?: string; explica?: string; porQue?: string; naPratica?: string }

/** quanto de imposto tem nesta operação (centavos): venda (produto/serviço) e/ou compra */
export function impostosDaOperacao(lista: ImpostoOperacao[], op: { produto?: number; servico?: number; compra?: number }, modoPreco: 'dentro' | 'fora' = 'dentro'): { linhas: LinhaImposto[]; venda: number; compra: number; base: number; precoFinal: number; modoPreco: 'dentro' | 'fora' } {
  const linhas: LinhaImposto[] = []
  for (const i of lista.filter((x) => x.ligado && (x.taxaBp > 0 || (x.taxaServicoBp ?? 0) > 0))) {
    const sobre = { fonte: i.fonte, vigenteDesde: i.vigenteDesde, conferidoEm: i.conferidoEm, explica: i.explica, porQue: i.porQue, naPratica: i.naPratica }
    const bp = i.taxaBp
    const bpServ = i.taxaServicoBp ?? i.taxaBp
    if (i.vendaProduto && bpServ === bp) {
      // mesma taxa: uma linha só (produto + serviço)
      const base = (op.produto ?? 0) + (i.vendaServico ? op.servico ?? 0 : 0)
      if (base > 0 && bp > 0) linhas.push({ id: `${i.id}-v`, sigla: i.sigla, nome: i.nome, taxaBp: bp, base, valor: aplicar(base, bp), lado: 'venda', ...sobre })
    } else {
      if (i.vendaProduto && (op.produto ?? 0) > 0 && bp > 0) linhas.push({ id: `${i.id}-p`, sigla: i.sigla, nome: `${i.nome} (produto)`, taxaBp: bp, base: op.produto!, valor: aplicar(op.produto!, bp), lado: 'venda', ...sobre })
      if (i.vendaServico && (op.servico ?? 0) > 0 && bpServ > 0) linhas.push({ id: `${i.id}-s`, sigla: i.sigla, nome: `${i.nome} (serviço)`, taxaBp: bpServ, base: op.servico!, valor: aplicar(op.servico!, bpServ), lado: 'venda', ...sobre })
    }
    if (i.compra !== 'nao' && (op.compra ?? 0) > 0) linhas.push({ id: `${i.id}-c`, sigla: i.sigla, nome: i.nome, taxaBp: i.taxaBp, base: op.compra!, valor: aplicar(op.compra!, i.taxaBp), lado: 'compra', credito: i.compra === 'credito', ...sobre })
  }
  const venda = linhas.filter((l) => l.lado === 'venda').reduce((s, l) => s + l.valor, 0)
  const compra = linhas.filter((l) => l.lado === 'compra').reduce((s, l) => s + l.valor, 0)
  const base = (op.produto ?? 0) + (op.servico ?? 0) + (op.compra ?? 0)
  // "fora": o custo final informativo é o preço + os impostos (o cobrado continua o preço)
  const precoFinal = modoPreco === 'fora' ? base + (op.compra ? compra : venda) : base
  return { linhas, venda, compra, base, precoFinal, modoPreco }
}
