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
}

export const NOMES_REGIME: Record<RegimeFiscal, { nome: string; explica: string }> = {
  general: { nome: 'Régimen General', explica: 'Factura con IVA 13%, paga IT 3% sobre los ingresos e IUE 25% sobre la utilidad.' },
  rts: { nome: 'Régimen Tributario Simplificado (RTS)', explica: 'Cuota fija bimestral; sin IVA, IT ni IUE por separado y sin factura con crédito fiscal.' },
  simples: { nome: 'Simples Nacional', explica: 'DAS: uma alíquota única sobre a receita bruta (já inclui IRPJ, CSLL, PIS, COFINS e ICMS/ISS).' },
  presumido: { nome: 'Lucro Presumido', explica: 'PIS 0,65% e COFINS 3% sobre a receita; IRPJ e CSLL sobre um lucro presumido.' },
}

/** valor × taxa (pontos-base), arredondado ao centavo */
export const aplicar = (valor: number, bp: number) => Math.round((valor * bp) / 10000)

/** IVA "por dentro" (Bolívia): do preço faturado, quanto é imposto (13% do total) */
export const ivaDoFaturado = (faturado: number, ivaBp: number) => aplicar(faturado, ivaBp)
