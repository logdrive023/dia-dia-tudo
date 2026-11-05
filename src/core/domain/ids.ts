// ULID: identificador gerado no aparelho, ordenável pelo tempo e sem colisão (pronto para servidor).

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function aleatorio(n: number): string {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += ALFABETO[b % 32]
  return s
}

let ultimoTempo = 0
let ultimoAleatorio = ''

export function novoId(): string {
  let tempo = Date.now()
  if (tempo <= ultimoTempo) {
    // mesmo milissegundo: incrementa a parte aleatória para manter a ordem
    tempo = ultimoTempo
    ultimoAleatorio = incrementar(ultimoAleatorio)
  } else {
    ultimoTempo = tempo
    ultimoAleatorio = aleatorio(16)
  }
  let t = ''
  for (let i = 0; i < 10; i++) {
    t = ALFABETO[tempo % 32] + t
    tempo = Math.floor(tempo / 32)
  }
  return t + ultimoAleatorio
}

function incrementar(s: string): string {
  const c = s.split('')
  for (let i = c.length - 1; i >= 0; i--) {
    const idx = ALFABETO.indexOf(c[i])
    if (idx < 31) {
      c[i] = ALFABETO[idx + 1]
      return c.join('')
    }
    c[i] = '0'
  }
  return c.join('')
}

/**
 * CÓDIGO DO QR da etiqueta: aleatório, sem sentido e impossível de adivinhar (≈95 bits). Não carrega id, data, medida
 * nem cor — o QR só leva isso (…#/q/<código>). Ex.: "k7Pq2xR9mT4wZb3n". Reimprimir a etiqueta gera outro.
 */
export function novoCodigoQr(): string {
  const letras = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => letras[b % letras.length]).join('')
}
