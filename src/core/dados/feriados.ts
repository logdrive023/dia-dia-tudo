// FERIADOS POR PAÍS E REGIÃO (Bolívia + 9 departamentos · Brasil nacional) — o cadastro (o que é cada feriado e a regra da data), separado do calendário
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
//  · Outros departamentos da Bolívia: a efeméride de cada um (a data de fundação/levante), declarada feriado
//    departamental por decreto do ano — todas marcadas "confirmação anual", como Santa Cruz.
//  · Brasil (só nacional): Lei 662/1949 e Lei 10.607/2002 (1/1, 21/4, 1/5, 7/9, 2/11, 15/11, 25/12), Lei 6.802/1980
//    (12/10), Lei 14.759/2023 (20/11) e Sexta-feira Santa (feriado religioso, Lei 9.093/1995). Carnaval e Corpus Christi
//    são ponto facultativo: não entram. Feriados ESTADUAIS do Brasil ainda não estão cadastrados (cada estado tem os seus).
//  · Divergência registrada: uma fonte secundária diz que Carnaval, Sexta-feira Santa, Corpus Christi e 2 de novembro não
//    se trasladam; o texto do DS 2750 não foi lido na íntegra — o 2 de novembro fica SEM traslado automático e marcado para
//    confirmar (o ajuste anual corrige se o decreto do ano disser outra coisa).

/** nacional (o país todo) ou regional (departamento/estado escolhido em Configurações › Geral) */
export type CategoriaFeriado = 'nacional' | 'regional'
/** nome antigo da categoria regional (só havia Santa Cruz): ajustes gravados antes continuam valendo */
type CategoriaAntiga = CategoriaFeriado | 'santaCruz'

export type PaisFeriado = 'BO' | 'BR'
/** de onde são os feriados da agenda (Configurações › Geral): país '' = sem feriados */
export interface LocalFeriados { pais: PaisFeriado | ''; regiao?: string }
/** o padrão (o de sempre): Bolívia, departamento de Santa Cruz */
export const LOCAL_PADRAO: LocalFeriados = { pais: 'BO', regiao: 'santaCruz' }

/** os países e as regiões que têm feriado regional cadastrado (nome do tipo de região: departamento/estado) */
export const PAISES_FERIADO: Record<PaisFeriado, { nome: string; bandeira: string; tipoRegiao: string; regioes: { id: string; nome: string }[] }> = {
  BO: {
    nome: 'Bolívia', bandeira: '🇧🇴', tipoRegiao: 'Departamento',
    regioes: [
      { id: 'beni', nome: 'Beni' }, { id: 'chuquisaca', nome: 'Chuquisaca' }, { id: 'cochabamba', nome: 'Cochabamba' },
      { id: 'laPaz', nome: 'La Paz' }, { id: 'oruro', nome: 'Oruro' }, { id: 'pando', nome: 'Pando' },
      { id: 'potosi', nome: 'Potosí' }, { id: 'santaCruz', nome: 'Santa Cruz' }, { id: 'tarija', nome: 'Tarija' },
    ],
  },
  BR: { nome: 'Brasil', bandeira: '🇧🇷', tipoRegiao: 'Estado', regioes: [] },
}

/** "Bolívia (nacional)" · "Departamento de Santa Cruz" (em português; a tela traduz pelas partes) */
export function abrangenciaDe(pais: PaisFeriado, regiao?: string): string {
  const p = PAISES_FERIADO[pais]
  const r = regiao ? p.regioes.find((x) => x.id === regiao) : undefined
  return r ? `${p.tipoRegiao} de ${r.nome}` : `${p.nome} (nacional)`
}

/** a regra da data: fixa (dia/mês) ou móvel (dias a partir do Domingo de Páscoa) */
export type RegraData = { tipo: 'fixa'; mes: number; dia: number } | { tipo: 'pascoa'; dias: number }

export interface Feriado {
  id: string
  /** o nome OFICIAL em espanhol (como na norma) e o nome em português (o principal na tela) */
  es: string
  pt: string
  categoria: CategoriaFeriado
  pais: PaisFeriado
  /** só nos regionais: o departamento/estado (id de PAISES_FERIADO) */
  regiao?: string
  regra: RegraData
  /** cai no domingo → passa para a segunda (DS 2750) */
  trasladaDomingo?: boolean
  /** a data/feriado é confirmada por norma de cada ano (decreto, comunicado) */
  confirmacaoAnual?: boolean
  fonte: string
}

export const FERIADOS: Feriado[] = [
  { id: 'anoNovo', es: 'Año Nuevo', pt: 'Ano-Novo', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 1, dia: 1 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'estadoPlurinacional', es: 'Día del Estado Plurinacional de Bolivia', pt: 'Dia do Estado Plurinacional da Bolívia', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 1, dia: 22 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'carnavalSeg', es: 'Carnaval (lunes)', pt: 'Carnaval (segunda)', categoria: 'nacional', pais: 'BO', regra: { tipo: 'pascoa', dias: -48 }, fonte: 'DS 2750/2016' },
  { id: 'carnavalTer', es: 'Carnaval (martes)', pt: 'Carnaval (terça)', categoria: 'nacional', pais: 'BO', regra: { tipo: 'pascoa', dias: -47 }, fonte: 'DS 2750/2016' },
  { id: 'viernesSanto', es: 'Viernes Santo', pt: 'Sexta-feira Santa', categoria: 'nacional', pais: 'BO', regra: { tipo: 'pascoa', dias: -2 }, fonte: 'DS 2750/2016' },
  { id: 'trabajo', es: 'Día del Trabajo', pt: 'Dia do Trabalho', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 5, dia: 1 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'corpusChristi', es: 'Corpus Christi', pt: 'Corpus Christi', categoria: 'nacional', pais: 'BO', regra: { tipo: 'pascoa', dias: 60 }, fonte: 'DS 2750/2016' },
  { id: 'anoNuevoAndino', es: 'Año Nuevo Andino Amazónico y del Chaco', pt: 'Ano-Novo Andino Amazônico e do Chaco', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 6, dia: 21 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'independencia', es: 'Día de la Independencia de Bolivia', pt: 'Dia da Independência da Bolívia', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 8, dia: 6 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'todosSantos', es: 'Día de Todos los Difuntos', pt: 'Dia de Finados', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 11, dia: 2 }, confirmacaoAnual: true, fonte: 'DS 2750/2016 (traslado a confirmar)' },
  { id: 'navidad', es: 'Navidad', pt: 'Natal', categoria: 'nacional', pais: 'BO', regra: { tipo: 'fixa', mes: 12, dia: 25 }, trasladaDomingo: true, fonte: 'DS 2750/2016' },
  { id: 'santaCruz', es: 'Aniversario de Santa Cruz (efeméride departamental)', pt: 'Dia de Santa Cruz (efeméride departamental)', categoria: 'regional', pais: 'BO', regiao: 'santaCruz', regra: { tipo: 'fixa', mes: 9, dia: 24 }, confirmacaoAnual: true, fonte: 'Decreto departamental do ano / Ministério do Trabalho' },
  // os outros departamentos da Bolívia (efeméride de cada um; o decreto departamental do ano confirma)
  ...([
    ['oruro', 2, 10, 'Oruro (10 de febrero de 1781)', 'Oruro (10 de fevereiro de 1781)'],
    ['tarija', 4, 15, 'Tarija (15 de abril de 1817)', 'Tarija (15 de abril de 1817)'],
    ['chuquisaca', 5, 25, 'Chuquisaca (25 de mayo de 1809)', 'Chuquisaca (25 de maio de 1809)'],
    ['laPaz', 7, 16, 'La Paz (16 de julio de 1809)', 'La Paz (16 de julho de 1809)'],
    ['cochabamba', 9, 14, 'Cochabamba (14 de septiembre de 1810)', 'Cochabamba (14 de setembro de 1810)'],
    ['pando', 9, 24, 'Pando (24 de septiembre de 1938)', 'Pando (24 de setembro de 1938)'],
    ['potosi', 11, 10, 'Potosí (10 de noviembre de 1810)', 'Potosí (10 de novembro de 1810)'],
    ['beni', 11, 18, 'Beni (18 de noviembre de 1842)', 'Beni (18 de novembro de 1842)'],
  ] as const).map(([regiao, mes, dia, es, pt]): Feriado => ({ id: regiao, es: `Aniversario de ${es}`, pt: `Dia de ${pt}`, categoria: 'regional', pais: 'BO', regiao, regra: { tipo: 'fixa', mes, dia }, confirmacaoAnual: true, fonte: 'Efeméride departamental · decreto departamental do ano' })),
  // BRASIL (nacionais; sem traslado de domingo)
  ...([
    ['br-anoNovo', 1, 1, 'Año Nuevo', 'Confraternização Universal', 'Lei 662/1949'],
    ['br-tiradentes', 4, 21, 'Tiradentes', 'Tiradentes', 'Lei 10.607/2002'],
    ['br-trabalho', 5, 1, 'Día del Trabajo', 'Dia do Trabalho', 'Lei 662/1949'],
    ['br-independencia', 9, 7, 'Independencia de Brasil', 'Independência do Brasil', 'Lei 662/1949'],
    ['br-aparecida', 10, 12, 'Nuestra Señora Aparecida', 'Nossa Senhora Aparecida', 'Lei 6.802/1980'],
    ['br-finados', 11, 2, 'Día de los Difuntos', 'Finados', 'Lei 10.607/2002'],
    ['br-republica', 11, 15, 'Proclamación de la República', 'Proclamação da República', 'Lei 662/1949'],
    ['br-conscienciaNegra', 11, 20, 'Día de Zumbi y de la Conciencia Negra', 'Dia de Zumbi e da Consciência Negra', 'Lei 14.759/2023'],
    ['br-natal', 12, 25, 'Navidad', 'Natal', 'Lei 662/1949'],
  ] as const).map(([id, mes, dia, es, pt, fonte]): Feriado => ({ id, es, pt, categoria: 'nacional', pais: 'BR', regra: { tipo: 'fixa', mes, dia }, fonte })),
  { id: 'br-sextaSanta', es: 'Viernes Santo', pt: 'Sexta-feira Santa', categoria: 'nacional', pais: 'BR', regra: { tipo: 'pascoa', dias: -2 }, fonte: 'Lei 9.093/1995 (feriado religioso)' },
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
  categoria?: CategoriaAntiga
  /** de que país/região é o feriado extra (sem: Bolívia; regional sem região = Santa Cruz, o de antes) */
  pais?: PaisFeriado
  regiao?: string
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
  pais: PaisFeriado
  regiao?: string
  /** "Bolívia (nacional)" · "Departamento de Santa Cruz" */
  abrangencia: string
  fonte: string
  /** a data saiu da regra (traslado de domingo ou decreto do ano): de onde veio */
  movidoDe?: string
  confirmacaoAnual?: boolean
}

/** o feriado vale para o lugar escolhido? (nacional do país; regional do país E da região) */
const vale = (f: { pais: PaisFeriado; categoria: CategoriaFeriado; regiao?: string }, local: LocalFeriados) =>
  !!local.pais && f.pais === local.pais && (f.categoria === 'nacional' || f.regiao === local.regiao)

/** os feriados de um ano do lugar escolhido, com o traslado de domingo e os ajustes do decreto do ano */
export function feriadosDoAno(ano: number, ajustes: AjusteFeriado[] = AJUSTES_PADRAO, local: LocalFeriados = LOCAL_PADRAO): FeriadoNoDia[] {
  const doAno = ajustes.filter((x) => x.ano === ano)
  const lista: FeriadoNoDia[] = []
  for (const f of FERIADOS) {
    if (!vale(f, local)) continue
    if (doAno.some((x) => x.acao === 'tirar' && x.feriadoId === f.id)) continue
    const base = f.regra.tipo === 'fixa' ? iso(ano, f.regra.mes, f.regra.dia) : somar(pascoa(ano), f.regra.dias)
    const movido = doAno.find((x) => x.acao === 'mover' && x.feriadoId === f.id && x.data)
    const data = movido ? movido.data! : f.trasladaDomingo && domingo(base) ? somar(base, 1) : base
    lista.push({ id: f.id, data, es: f.es, pt: f.pt, categoria: f.categoria, pais: f.pais, regiao: f.regiao, abrangencia: abrangenciaDe(f.pais, f.regiao), fonte: movido ? movido.fonte : f.fonte, movidoDe: data !== base ? base : undefined, confirmacaoAnual: f.confirmacaoAnual })
  }
  for (const x of doAno.filter((y) => y.acao === 'extra' && y.data)) {
    // ajuste antigo: categoria 'santaCruz' = regional de Santa Cruz (Bolívia)
    const categoria: CategoriaFeriado = x.categoria === 'santaCruz' || x.categoria === 'regional' ? 'regional' : 'nacional'
    const pais = x.pais ?? 'BO'
    const regiao = categoria === 'regional' ? x.regiao ?? 'santaCruz' : undefined
    if (!vale({ pais, categoria, regiao }, local)) continue
    lista.push({ id: `extra-${x.data}`, data: x.data!, es: x.es ?? 'Feriado', pt: x.pt ?? 'Feriado', categoria, pais, regiao, abrangencia: abrangenciaDe(pais, regiao), fonte: x.fonte })
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

/** os feriados entre duas datas (atravessa a virada do ano), só das categorias pedidas, do lugar escolhido */
export function feriadosEntre(de: string, ate: string, categorias: CategoriaAntiga[], ajustes?: AjusteFeriado[], local: LocalFeriados = LOCAL_PADRAO): FeriadoNoDia[] {
  const cats = new Set<CategoriaFeriado>(categorias.map((c) => (c === 'santaCruz' ? 'regional' : c)))
  if (!cats.size) return []
  const anos: number[] = []
  for (let a = Number(de.slice(0, 4)); a <= Number(ate.slice(0, 4)); a++) anos.push(a)
  return anos.flatMap((a) => feriadosDoAno(a, ajustes, local)).filter((f) => f.data >= de && f.data <= ate && cats.has(f.categoria))
}
