/** CSV com ";" (abre direto no Excel em pt/es) e proteção contra fórmula maliciosa (=, +, -, @ no começo). */
export function baixarCSV(nome: string, linhas: Record<string, string | number>[]) {
  if (!linhas.length) return
  const cols = Object.keys(linhas[0])
  const esc = (v: string | number) => {
    if (typeof v === 'number') return String(v).replace('.', ',')
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
