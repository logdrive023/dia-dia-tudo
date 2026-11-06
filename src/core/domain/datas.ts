// Datas de calendário como texto "AAAA-MM-DD" (horário local); instantes como ISO em UTC.

export function dataLocal(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return dataLocal(new Date(a, m - 1, d + dias, 12))
}

export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const alvo = new Date(a, m - 1 + meses, 1, 12)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(d, ultimo))
  return dataLocal(alvo)
}

export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000)
}

export function dataDeInstante(iso: string): string {
  return dataLocal(new Date(iso))
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "01/11" ou "01/11/2026" */
export function dataCurta(data: string, comAno = false): string {
  const [a, m, d] = data.split('-')
  return comAno ? `${d}/${m}/${a}` : `${d}/${m}`
}

/** "05/11/2026" de uma data ou instante ISO (usa só os 10 primeiros caracteres: "2026-11-05T14:00Z" → "05/11/2026") */
export function dataComAno(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/')
}

export function diaDaSemana(data: string): string {
  const [a, m, d] = data.split('-').map(Number)
  return DIAS[new Date(a, m - 1, d, 12).getDay()]
}

export function horaCurta(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function inicioDoMes(data: string): string {
  return data.slice(0, 8) + '01'
}

export function fimDoMes(data: string): string {
  return somarDias(somarMeses(inicioDoMes(data), 1), -1)
}

export function listaDeDias(de: string, ate: string): string[] {
  const dias: string[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d)
  return dias
}
