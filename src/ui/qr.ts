// QR CODE sem dependência: modo byte (UTF-8), correção L/M/Q/H, versões 1 a 40, escolhe a menor versão que cabe e a
// máscara de menor penalidade (ISO/IEC 18004). Devolve a matriz (true = módulo escuro), sem a margem.
// Usado nas etiquetas dos lotes: o QR leva o endereço do lote (…#/lotes/<id>) e o leitor da câmera abre o lote.

export type NivelQR = 'L' | 'M' | 'Q' | 'H'

const ORDEM: Record<NivelQR, number> = { L: 0, M: 1, Q: 2, H: 3 }
const BITS_FORMATO: Record<NivelQR, number> = { L: 1, M: 0, Q: 3, H: 2 }

// palavras de correção por bloco e número de blocos, por nível (L, M, Q, H) e versão (índice 0 não se usa)
const ECC_POR_BLOCO = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
]
const BLOCOS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
]

/** módulos de dados (sem padrões fixos) da versão */
function modulosDeDados(v: number) {
  let r = (16 * v + 128) * v + 64
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (v >= 7) r -= 36
  }
  return r
}

const palavrasDeDados = (v: number, nivel: NivelQR) => Math.floor(modulosDeDados(v) / 8) - ECC_POR_BLOCO[ORDEM[nivel]][v] * BLOCOS[ORDEM[nivel]][v]

// ---------- Reed-Solomon em GF(256), polinômio 0x11D ----------

function multiplicar(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function divisor(grau: number) {
  const r = new Array<number>(grau).fill(0)
  r[grau - 1] = 1
  let raiz = 1
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = multiplicar(r[j], raiz)
      if (j + 1 < r.length) r[j] ^= r[j + 1]
    }
    raiz = multiplicar(raiz, 0x02)
  }
  return r
}

/** Palavras de correção (resto da divisão) — exportado para teste. */
export function correcaoRS(dados: number[], grau: number) {
  const div = divisor(grau)
  const r = new Array<number>(grau).fill(0)
  for (const b of dados) {
    const f = b ^ (r.shift() as number)
    r.push(0)
    div.forEach((c, i) => (r[i] ^= multiplicar(c, f)))
  }
  return r
}

/** Bits de formato (nível + máscara, BCH, XOR 0x5412) — exportado para teste. */
export function bitsFormato(nivel: NivelQR, mascara: number) {
  const d = (BITS_FORMATO[nivel] << 3) | mascara
  let rem = d
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((d << 10) | rem) ^ 0x5412
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

/** Matriz do QR para o texto (true = escuro). Nível M por padrão: aguenta etiqueta riscada/amassada. */
export function gerarQR(texto: string, nivel: NivelQR = 'M'): boolean[][] {
  const bytes = [...new TextEncoder().encode(texto)]
  // menor versão que cabe
  let versao = 0
  for (let v = 1; v <= 40; v++) {
    const bitsContagem = v <= 9 ? 8 : 16
    if (4 + bitsContagem + bytes.length * 8 <= palavrasDeDados(v, nivel) * 8) {
      versao = v
      break
    }
  }
  if (!versao) throw new Error('Texto grande demais para um QR.')
  const capacidade = palavrasDeDados(versao, nivel) * 8
  // fluxo de bits: modo byte (0100), contagem, dados, terminador e enchimento
  const bits: number[] = []
  const por = (valor: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1)
  }
  por(0b0100, 4)
  por(bytes.length, versao <= 9 ? 8 : 16)
  for (const b of bytes) por(b, 8)
  por(0, Math.min(4, capacidade - bits.length))
  por(0, (8 - (bits.length % 8)) % 8)
  for (let enche = 0xec; bits.length < capacidade; enche ^= 0xec ^ 0x11) por(enche, 8)
  const dados: number[] = []
  for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((s, b) => (s << 1) | b, 0))
  // blocos + correção, intercalados
  const nBlocos = BLOCOS[ORDEM[nivel]][versao]
  const eccLen = ECC_POR_BLOCO[ORDEM[nivel]][versao]
  const brutas = Math.floor(modulosDeDados(versao) / 8)
  const curtos = nBlocos - (brutas % nBlocos)
  const tamCurto = Math.floor(brutas / nBlocos)
  const blocos: number[][] = []
  for (let i = 0, k = 0; i < nBlocos; i++) {
    const d = dados.slice(k, k + tamCurto - eccLen + (i < curtos ? 0 : 1))
    k += d.length
    const ecc = correcaoRS(d, eccLen)
    if (i < curtos) d.push(0)
    blocos.push([...d, ...ecc])
  }
  const final: number[] = []
  for (let i = 0; i < blocos[0].length; i++)
    blocos.forEach((b, j) => {
      if (i !== tamCurto - eccLen || j >= curtos) final.push(b[i])
    })

  // ---------- matriz ----------
  const n = versao * 4 + 17
  const m: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const fixo: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const pos = (x: number, y: number, escuro: boolean) => {
    m[y][x] = escuro
    fixo[y][x] = true
  }
  for (let i = 0; i < n; i++) {
    pos(6, i, i % 2 === 0)
    pos(i, 6, i % 2 === 0)
  }
  const localizador = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < n && yy >= 0 && yy < n) pos(xx, yy, d !== 2 && d !== 4)
      }
  }
  localizador(3, 3)
  localizador(n - 4, 3)
  localizador(3, n - 4)
  if (versao > 1) {
    const qtd = Math.floor(versao / 7) + 2
    const passo = versao === 32 ? 26 : Math.ceil((versao * 4 + 4) / (qtd * 2 - 2)) * 2
    const ps = [6]
    for (let p = n - 7; ps.length < qtd; p -= passo) ps.splice(1, 0, p)
    for (let i = 0; i < qtd; i++)
      for (let j = 0; j < qtd; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === qtd - 1) || (i === qtd - 1 && j === 0)) continue
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) pos(ps[i] + dx, ps[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
  }
  const formato = (mascara: number) => {
    const b = bitsFormato(nivel, mascara)
    for (let i = 0; i <= 5; i++) pos(8, i, bit(b, i))
    pos(8, 7, bit(b, 6))
    pos(8, 8, bit(b, 7))
    pos(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) pos(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) pos(n - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) pos(8, n - 15 + i, bit(b, i))
    pos(8, n - 8, true)
  }
  formato(0) // reserva as áreas (o certo entra depois de escolher a máscara)
  if (versao >= 7) {
    let rem = versao
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const b = (versao << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3)
      const c = Math.floor(i / 3)
      pos(a, c, bit(b, i))
      pos(c, a, bit(b, i))
    }
  }
  // dados em zigue-zague, de baixo para cima, de 2 em 2 colunas (pulando a coluna 6)
  let k = 0
  for (let direita = n - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5
    for (let vert = 0; vert < n; vert++)
      for (let j = 0; j < 2; j++) {
        const x = direita - j
        const subindo = ((direita + 1) & 2) === 0
        const y = subindo ? n - 1 - vert : vert
        if (!fixo[y][x] && k < final.length * 8) {
          m[y][x] = bit(final[k >>> 3], 7 - (k & 7))
          k++
        }
      }
  }
  const inverte = (mascara: number, x: number, y: number) => {
    switch (mascara) {
      case 0: return (x + y) % 2 === 0
      case 1: return y % 2 === 0
      case 2: return x % 3 === 0
      case 3: return (x + y) % 3 === 0
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    }
  }
  const aplicar = (mascara: number) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fixo[y][x] && inverte(mascara, x, y)) m[y][x] = !m[y][x]
  }
  // escolhe a máscara de menor penalidade (sequências, blocos 2×2, padrões tipo localizador e equilíbrio)
  let melhor = 0
  let menor = Infinity
  for (let mascara = 0; mascara < 8; mascara++) {
    aplicar(mascara)
    formato(mascara)
    const p = penalidade(m)
    if (p < menor) (menor = p), (melhor = mascara)
    aplicar(mascara) // desfaz (XOR)
  }
  aplicar(melhor)
  formato(melhor)
  return m
}

function penalidade(m: boolean[][]) {
  const n = m.length
  let p = 0
  const linha = (get: (i: number) => boolean) => {
    let corrida = 1
    for (let i = 1; i < n; i++) {
      if (get(i) === get(i - 1)) {
        corrida++
        if (corrida === 5) p += 3
        else if (corrida > 5) p++
      } else corrida = 1
    }
    // padrão 1:1:3:1:1 com 4 claros de um lado
    for (let i = 0; i + 10 < n + 0; i++) {
      const s = Array.from({ length: 11 }, (_, k) => get(i + k))
      const nucleo = s[0] && !s[1] && s[2] && s[3] && s[4] && !s[5] && s[6]
      if ((nucleo && !s[7] && !s[8] && !s[9] && !s[10]) || (!s[0] && !s[1] && !s[2] && !s[3] && s[4] && !s[5] && s[6] && s[7] && s[8] && !s[9] && s[10])) p += 40
    }
  }
  for (let y = 0; y < n; y++) linha((i) => m[y][i])
  for (let x = 0; x < n; x++) linha((i) => m[i][x])
  for (let y = 0; y + 1 < n; y++) for (let x = 0; x + 1 < n; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3
  const escuros = m.reduce((s, l) => s + l.filter(Boolean).length, 0)
  const total = n * n
  p += Math.floor(Math.abs(escuros * 20 - total * 10) / total) * 10
  return p
}

/** Caminho SVG (um "M x y h1 v1 h-1 z" por módulo escuro) com margem de 4 módulos; viewBox = 0 0 lado lado. */
export function caminhoQR(m: boolean[][], margem = 4) {
  let d = ''
  m.forEach((l, y) => l.forEach((v, x) => v && (d += `M${x + margem} ${y + margem}h1v1h-1z`)))
  return { d, lado: m.length + margem * 2 }
}
