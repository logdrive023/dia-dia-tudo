// RELATÓRIOS › A CASCATA DO RESULTADO ("para onde foi o dinheiro"): das vendas até o que sobrou, em etapas.
// Entra qualquer demonstrativo em linhas (o Estado de Resultados contábil ou o resultado da Divisão entre sócias) e sai:
//   o começo (as vendas) · os GRUPOS de saídas (as contas entre um subtotal e o próximo) · cada MARCO (o subtotal)
//   · o final. A tela desenha uma barra por marco e cada grupo abre no toque com as contas dele.
// Também tira daqui as MAIORES SAÍDAS (o que mais pesou) para a frase do "Em resumo".

export type Anexo = 'vendas' | 'compras' | 'gastos' | 'impostos' | 'inventario' | 'diario' | 'cuentas'

/** uma linha qualquer de demonstrativo: o rótulo pode vir com "(−) " ou "= " na frente */
export interface LinhaEntrada {
  id?: string
  rotulo: string
  valor: number
  /** conta (lançamento) ou subtotal/total (marco) */
  tipo: 'conta' | 'subtotal' | 'total'
  conta?: string
  anexo?: Anexo
  ajuda?: string
}

export interface ContaCascata { id: string; rotulo: string; valor: number; conta?: string; anexo?: Anexo; ajuda?: string }
export interface EtapaCascata {
  /** as contas que levaram do marco anterior a este (positivas somam, negativas tiram) */
  contas: ContaCascata[]
  /** quanto as contas do grupo mudaram (a soma) */
  variacao: number
  marco: { rotulo: string; valor: number; final: boolean }
}
export interface Cascata { inicio: ContaCascata; etapas: EtapaCascata[]; final: number }

/** "(−) Salários" → "Salários" · "= Lucro bruto" → "Lucro bruto" */
export const limparRotulo = (r: string) => r.replace(/^\s*(\(\s*[−+-]\s*\)|=)\s*/, '').trim()

export function montarCascata(linhas: LinhaEntrada[]): Cascata | undefined {
  if (!linhas.length) return undefined
  const conta = (l: LinhaEntrada, k: number): ContaCascata => ({ id: l.id ?? `l${k}`, rotulo: limparRotulo(l.rotulo), valor: l.valor, conta: l.conta, anexo: l.anexo, ajuda: l.ajuda })
  const [primeira, ...resto] = linhas
  const etapas: EtapaCascata[] = []
  let grupo: ContaCascata[] = []
  resto.forEach((l, k) => {
    if (l.tipo === 'conta') { grupo.push(conta(l, k + 1)); return }
    etapas.push({ contas: grupo, variacao: grupo.reduce((s, c) => s + c.valor, 0), marco: { rotulo: limparRotulo(l.rotulo), valor: l.valor, final: false } })
    grupo = []
  })
  // contas soltas depois do último subtotal: um marco final com a soma
  const ultimo = etapas[etapas.length - 1]
  if (grupo.length) {
    const base = ultimo?.marco.valor ?? primeira.valor
    const variacao = grupo.reduce((s, c) => s + c.valor, 0)
    etapas.push({ contas: grupo, variacao, marco: { rotulo: 'Resultado', valor: base + variacao, final: true } })
  } else if (ultimo) ultimo.marco.final = true
  return { inicio: conta(primeira, 0), etapas, final: etapas.length ? etapas[etapas.length - 1].marco.valor : primeira.valor }
}

/** as contas que mais tiraram (as maiores saídas), da maior para a menor */
export const maioresSaidas = (c: Cascata, n = 3) => c.etapas.flatMap((e) => e.contas).filter((x) => x.valor < 0).sort((a, b) => a.valor - b.valor).slice(0, n)

/** o tamanho da barra (0–100) de um valor em relação ao começo (as vendas) */
export const larguraBarra = (valor: number, base: number) => (base > 0 ? Math.min(100, Math.round((Math.abs(valor) / base) * 100)) : 0)
