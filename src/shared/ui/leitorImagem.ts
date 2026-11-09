// LER QR DE UMA IMAGEM (o quadro da câmera) — robusto para o mundo real do balcão: etiqueta com tinta fraca, papel
// amassado, pouca luz, reflexo do plástico. Funções puras (testáveis sem câmera):
//   · luminancia: cinza de cada pixel (o que importa para o QR)
//   · brilho: a média (para dizer "pouca luz — ligue a lanterna")
//   · realcar: estica o contraste pelos percentis 2–98% (tinta clara vira preta, papel cinza vira branco) — é o que
//     salva etiqueta desbotada e foto escura
//   · decodificar: tenta como veio (claro e invertido) e, se não der, de novo com o contraste realçado

type LeitorQr = typeof import('jsqr').default
let jsQR: LeitorQr | undefined

/** o decodificador próprio é pesado: baixa só quando a câmera abre */
export async function prepararLeitor() {
  jsQR ??= (await import('jsqr')).default
}

export function luminancia(rgba: Uint8ClampedArray, w: number, h: number) {
  const g = new Uint8ClampedArray(w * h)
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
  return g
}

/** brilho médio 0–255 (amostra 1 a cada 16 pixels: rápido) */
export function brilho(rgba: Uint8ClampedArray) {
  let s = 0
  let n = 0
  for (let p = 0; p < rgba.length; p += 64) (s += (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8), n++
  return n ? s / n : 0
}

/** contraste esticado (percentis 2% e 98% viram preto e branco) → RGBA cinza */
export function realcar(rgba: Uint8ClampedArray, w: number, h: number) {
  const g = luminancia(rgba, w, h)
  const hist = new Uint32Array(256)
  for (const v of g) hist[v]++
  const corte = g.length * 0.02
  let lo = 0
  let hi = 255
  for (let a = 0, acc = 0; a < 256; a++) if ((acc += hist[a]) > corte) { lo = a; break }
  for (let a = 255, acc = 0; a >= 0; a--) if ((acc += hist[a]) > corte) { hi = a; break }
  const faixa = Math.max(1, hi - lo)
  const out = new Uint8ClampedArray(rgba.length)
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    const v = ((g[i] - lo) * 255) / faixa
    out[p] = out[p + 1] = out[p + 2] = v
    out[p + 3] = 255
  }
  return out
}

/** suaviza (média 3×3): tira o "chuvisco" de foto ruim/papel granulado antes de realçar */
export function suavizar(rgba: Uint8ClampedArray, w: number, h: number) {
  const g = luminancia(rgba, w, h)
  const out = new Uint8ClampedArray(rgba.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy
          const xx = x + dx
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) (s += g[yy * w + xx]), n++
        }
      const p = (y * w + x) * 4
      out[p] = out[p + 1] = out[p + 2] = s / n
      out[p + 3] = 255
    }
  return out
}

/** o texto do QR da imagem (ou undefined): como veio → realçada → suavizada e realçada (o pior caso) */
export function decodificar(rgba: Uint8ClampedArray, w: number, h: number): string | undefined {
  const qr = jsQR
  if (!qr) return undefined
  const tentar = (px: Uint8ClampedArray) => qr(px, w, h, { inversionAttempts: 'attemptBoth' })?.data?.trim() || undefined
  return tentar(rgba) ?? tentar(realcar(rgba, w, h)) ?? tentar(realcar(suavizar(rgba, w, h), w, h))
}
