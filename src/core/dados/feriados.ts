// FERIADOS DA BOLÍVIA E DE SANTA CRUZ — o cadastro (o que é cada feriado e a regra da data), separado do calendário
// (ui/calendario.tsx) e da preferência de mostrar (Agenda). Só informativo: feriado NÃO bloqueia nada no sistema.
//
// FONTES (conferidas em 11/2026):
//  · Nacionais: Decreto Supremo 2750 (01/05/2016), que substituiu o DS 1210/2012 — lista os feriados nacionais e diz que
//    o feriado nacional que cai no DOMINGO passa para a segunda seguinte (salvo os que a norma exceptua). O governo ainda
//    publica todo ano um decreto com mudanças (ex.: DS 5521/2026: 22/01 → sexta 23/01, 21/06 → segunda 22/06 e feriado
//    extra na sexta 07/08) — por isso existe o AJUSTE ANUAL (abaixo), que entra pela configuração, sem mudar o código.
//    Referências: lexivox.org (DS 1210), infoleyes (DS 2750, DS 5521), ferrere.com (resumo do DS 5521).
//  · Santa Cruz: 24 de setembro (efeméride departamental, 1810). É declarado feriado DEPARTAMENTAL a cada ano
//    (decreto departamental / comunicado do Ministério do Trabalho — ex.: Comunicado Santa Cruz 005/21), por isso fica
//    marcado como "depende de confirmação anual". Não achamos feriado MUNICIPAL fixo de Santa Cruz de la Sierra: não entra.
//  · Divergência registrada: uma fonte secundária diz que Carnaval, Sexta-feira Santa, Corpus Christi e 2 de novembro não
//    se trasladam; o texto do DS 2750 não foi lido na íntegra — o 2 de novembro fica SEM traslado automático e marcado para
//    confirmar (o ajuste anual corrige se o decreto do ano disser outra coisa).

export type CategoriaFeriado = 'nacional' | 'santaCruz'

/** a regra da data: fixa (dia/mês) ou móvel (dias a partir do Domingo de Páscoa) */
export type RegraData = { tipo: 'fixa'; mes: number; dia: number } | { tipo: 'pascoa'; dias: number }

export interface Feriado {
  id: string
  /** o nome OFICIAL em espanhol (como na norma) e o nome em português (o principal na tela) */
  es: string
  pt: string
  categoria: CategoriaFeriado
  /** onde vale */
  abrangencia: 'Bolívia (nacional)' | 'Departamento de Santa Cruz'
  regra: RegraData
  /** cai no domingo → passa para a segunda (DS 2750) */
  trasladaDomingo?: boolean
  /** a data/feriado é confirmada por norma de cada ano (decreto, comunicado) */
  confirmacaoAnual?: boolean
  fonte: string
}

export const FERIADOS: Feriado[] = [
  { id: 'anoNovo', es: 'Año Nuevo', pt: 'Ano-Novo', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 1, dia: 1 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'estadoPlurinacional', es: 'Día del Estado Plurinacional de Bolivia', pt: 'Dia do Estado Plurinacional da Bolívia', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 1, dia: 22 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'carnavalSeg', es: 'Carnaval (lunes)', pt: 'Carnaval (segunda)', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'pascoa', dias: -48 }, fonte: 'DS 2750/2016' },
  { id: 'carnavalTer', es: 'Carnaval (martes)', pt: 'Carnaval (terça)', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'pascoa', dias: -47 }, fonte: 'DS 2750/2016' },
  { id: 'viernesSanto', es: 'Viernes Santo', pt: 'Sexta-feira Santa', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'pascoa', dias: -2 }, fonte: 'DS 2750/2016' },
  { id: 'trabajo', es: 'Día del Trabajo', pt: 'Dia do Trabalho', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 5, dia: 1 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'corpusChristi', es: 'Corpus Christi', pt: 'Corpus Christi', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'pascoa', dias: 60 }, fonte: 'DS 2750/2016' },
  { id: 'anoNuevoAndino', es: 'Año Nuevo Andino Amazónico y del Chaco', pt: 'Ano-Novo Andino Amazônico e do Chaco', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 6, dia: 21 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'independencia', es: 'Día de la Independencia de Bolivia', pt: 'Dia da Independência da Bolívia', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 8, dia: 6 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'todosSantos', es: 'Día de Todos los Difuntos', pt: 'Dia de Finados', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 11, dia: 2 }, confirmacaoAnual: true, fonte: 'DS 2750/2016 (traslado a confirmar)' },
  { id: 'navidad', es: 'Navidad', pt: 'Natal', categoria: 'nacional', abrangencia: 'Bolívia (nacional)', regra: { tipo: 'fixa', mes: 12, dia: 25 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'santaCruz', es: 'Aniversario de Santa Cruz (efeméride departamental)', pt: 'Dia de Santa Cruz (efeméride departamental)', categoria: 'santaCruz', abrangencia: 'Departamento de Santa Cruz', regra: { tipo: 'fixa', mes: 9, dia: 24 }, confirmacaoAnual: true, fonte: 'Decreto departamental do ano / Ministério do Trabalho' },
]

/**
 * AJUSTE ANUAL (decreto do ano): 'mover' um feriado para outra data, 'extra' (feriado a mais) ou 'tirar'. Vem da
 * configuração (feriadosAjustes); os de 2026 (DS 5521) já vêm cadastrados.
 */
export interface AjusteFeriado {
  ano: number
  acao: 'mover' | 'extra' | 'tirar'
  /** o feriado afetado (mover/tirar) */
  feriadoId?: string
  /** a data nova (mover) ou a do feriado extra */
  data?: string
  es?: string
  pt?: string
  categoria?: CategoriaFeriado
  fonte: string
}

export const AJUSTES_PADRAO: AjusteFeriado[] = [
  { ano: 2026, acao: 'mover', feriadoId: 'estadoPlurinacional', data: '2026-01-23', fonte: 'DS 5521/2026' },
  { ano: 2026, acao: 'mover', feriadoId: 'anoNuevoAndino', data: '2026-06-22', fonte: 'DS 5521/2026' },
  { ano: 2026, acao: 'extra', data: '2026-08-07', es: 'Feriado nacional adicional (Independencia)', pt: 'Feriado nacional adicional (Independência)', categoria: 'nacional', fonte: 'DS 5521/2026' },
]

/** Domingo de Páscoa (calendário gregoriano, algoritmo de Meeus/Jones/Butcher) — vale para qualquer ano */
export function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return iso(ano, mes, dia)
}

/** ano bissexto pela regra gregoriana (÷4 sim, ÷100 não, ÷400 sim) */
export const bissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

function iso(a: number, m: number, d: number) {
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
/** soma dias em UTC (sem fuso nem horário de verão) */
function somar(data: string, dias: number) {
  const [a, m, d] = data.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d + dias))
  return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate())
}
const domingo = (data: string) => { const [a, m, d] = data.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)).getUTCDay() === 0 }

/** um feriado num dia (o que a agenda mostra) */
export interface FeriadoNoDia {
  id: string
  data: string
  es: string
  pt: string
  categoria: CategoriaFeriado
  abrangencia: string
  fonte: string
  /** a data saiu da regra (traslado de domingo ou decreto do ano): de onde veio */
  movidoDe?: string
  confirmacaoAnual?: boolean
}

/** os feriados de um ano, com o traslado de domingo e os ajustes do decreto do ano */
export function feriadosDoAno(ano: number, ajustes: AjusteFeriado[] = AJUSTES_PADRAO): FeriadoNoDia[] {
  const doAno = ajustes.filter((x) => x.ano === ano)
  const lista: FeriadoNoDia[] = []
  for (const f of FERIADOS) {
    if (doAno.some((x) => x.acao === 'tirar' && x.feriadoId === f.id)) continue
    const base = f.regra.tipo === 'fixa' ? iso(ano, f.regra.mes, f.regra.dia) : somar(pascoa(ano), f.regra.dias)
    const movido = doAno.find((x) => x.acao === 'mover' && x.feriadoId === f.id && x.data)
    const data = movido ? movido.data! : f.trasladaDomingo && domingo(base) ? somar(base, 1) : base
    lista.push({ id: f.id, data, es: f.es, pt: f.pt, categoria: f.categoria, abrangencia: f.abrangencia, fonte: movido ? movido.fonte : f.fonte, movidoDe: data !== base ? base : undefined, confirmacaoAnual: f.confirmacaoAnual })
  }
  for (const x of doAno.filter((y) => y.acao === 'extra' && y.data))
    lista.push({ id: `extra-${x.data}`, data: x.data!, es: x.es ?? 'Feriado', pt: x.pt ?? 'Feriado', categoria: x.categoria ?? 'nacional', abrangencia: x.categoria === 'santaCruz' ? 'Departamento de Santa Cruz' : 'Bolívia (nacional)', fonte: x.fonte })
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

/** os feriados entre duas datas (atravessa a virada do ano), só das categorias pedidas */
export function feriadosEntre(de: string, ate: string, categorias: CategoriaFeriado[], ajustes?: AjusteFeriado[]): FeriadoNoDia[] {
  if (!categorias.length) return []
  const anos: number[] = []
  for (let a = Number(de.slice(0, 4)); a <= Number(ate.slice(0, 4)); a++) anos.push(a)
  return anos.flatMap((a) => feriadosDoAno(a, ajustes)).filter((f) => f.data >= de && f.data <= ate && categorias.includes(f.categoria))
}
