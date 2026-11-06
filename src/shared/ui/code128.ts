// CODE 128 sem dependência (conjunto B: ASCII 32–127; é o que o leitor "pistola" digita no campo de busca).
// Cada símbolo = 3 barras + 3 espaços (11 módulos); o fim (stop) tem 13. Soma de verificação: (início + Σ posição ×
// valor) mod 103. Usado na etiqueta do lote, embaixo do código: o leitor digita o código e a busca abre o pacote.

/** larguras barra/espaço de cada valor 0–105 e o stop (106) */
export const PADROES_128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const INICIO_B = 104
const STOP = 106

/** Texto que o Code 128 B aceita: tira acentos e troca o que não for ASCII imprimível por "?". */
export function textoCode128(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7f]/g, '?')
}

/** Valores dos símbolos: início B, os caracteres, a soma de verificação e o stop. */
export function valoresCode128(texto: string): number[] {
  const vs = [...textoCode128(texto)].map((c) => c.charCodeAt(0) - 32)
  const soma = vs.reduce((s, v, k) => s + v * (k + 1), INICIO_B) % 103
  return [INICIO_B, ...vs, soma, STOP]
}

/** Módulos (true = barra) do código, sem a margem. */
export function modulosCode128(texto: string): boolean[] {
  const r: boolean[] = []
  for (const v of valoresCode128(texto))
    [...PADROES_128[v]].forEach((w, k) => {
      for (let i = 0; i < Number(w); i++) r.push(k % 2 === 0)
    })
  return r
}

/** Caminho SVG (uma barra = um retângulo) e a largura em módulos, com margem de 10 módulos de cada lado. */
export function caminhoCode128(texto: string, altura = 30, margem = 10) {
  const m = modulosCode128(texto)
  let d = ''
  for (let i = 0; i < m.length; ) {
    if (!m[i]) {
      i++
      continue
    }
    let j = i
    while (j < m.length && m[j]) j++
    d += `M${i + margem} 0h${j - i}v${altura}h-${j - i}z`
    i = j
  }
  return { d, largura: m.length + 2 * margem, altura }
}
