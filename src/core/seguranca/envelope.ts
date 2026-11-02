// ENVELOPE CIFRADO: o que trafega entre o app e o servidor é só "ruído" (nada legível na aba Rede do navegador).
// Mesmo código nos dois lados (app e servidor simulado). Só usa WebCrypto (navegador e Node 20+).
//
//   1) POST /v1/k  (aperto de mão, binário)
//        app → servidor : chavePublicaApp(65) ‖ nonceApp(16)              ECDH P-256 efêmera
//        servidor → app : chavePublicaServ(65) ‖ nonceServ(16) ‖ sessao(16) ‖ [assinatura(64)]
//      assinatura = ECDSA P-256/SHA-256 da chave FIXA do servidor sobre a transcrição (opcional; se o app tiver
//      VITE_API_CHAVE_PUBLICA, ela é OBRIGATÓRIA → impede alguém no meio trocar as chaves).
//      segredo ECDH → HKDF-SHA-256 (sal = nonceApp ‖ nonceServ) → duas chaves AES-GCM-256 (uma por sentido).
//   2) POST /v1/r  (todo o resto: comandos, consultas, login, backup, arquivos)
//        app → servidor : sessao(16) ‖ iv(12) ‖ AES-GCM(mensagem)
//        servidor → app : iv(12) ‖ AES-GCM(resposta)
//      mensagem = { tipo, nome, dados, id, ts, token?, chave? }, resposta = { re, ok, r? | erro? | falha?, ts }
//      O texto é preenchido até múltiplos de 1 KB (o tamanho vaza menos). IV novo de 96 bits a cada mensagem.
//      Repetição: o servidor recusa id já visto e ts fora da janela.

export const TAM_CHAVE_PUBLICA = 65
export const TAM_NONCE = 16
export const TAM_SESSAO = 16
export const TAM_IV = 12
export const TAM_ASSINATURA = 64
export const BLOCO_PREENCHIMENTO = 1024
/** tolerância de relógio e tempo em que um id fica "visto" no servidor */
export const JANELA_MS = 5 * 60_000

export type TipoMensagem = 'comando' | 'consulta' | 'auth' | 'backup' | 'arquivo'

export interface Mensagem {
  tipo: TipoMensagem
  nome: string
  dados: unknown
  /** aleatório e único: base da proteção contra repetição */
  id: string
  /** instante do app (ms), já corrigido pelo relógio do servidor */
  ts: number
  /** token da sessão de login: viaja só aqui dentro (nunca em cabeçalho ou endereço) */
  token?: string
  /** chave de idempotência (nome:id da operação): repetir devolve o mesmo resultado */
  chave?: string
}

export interface Resposta {
  /** id da mensagem respondida (o app confere) */
  re: string
  ok: boolean
  r?: unknown
  erro?: { mensagem: string; campo?: string }
  /** 'relogio': ts fora da janela (o app ajusta e tenta de novo) */
  falha?: 'relogio'
  /** relógio do servidor (ms) */
  ts: number
}

const txt = new TextEncoder()
const ROTULO_K = txt.encode('tudo/v1/k')
const ROTULO_APP = txt.encode('tudo/v1/app→serv')
const ROTULO_SERV = txt.encode('tudo/v1/serv→app')

function sutil(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('canal')
  return s
}

export function aleatorio(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n))
}

export function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const r = new Uint8Array(total)
  let i = 0
  for (const p of partes) {
    r.set(p, i)
    i += p.length
  }
  return r
}

/** cópia num ArrayBuffer "deste mundo" (evita recusa do WebCrypto com buffers de outro contexto) */
export function bytes(b: ArrayBuffer | ArrayBufferView): Uint8Array {
  // isView/new Uint8Array funcionam entre contextos (instanceof ArrayBuffer não)
  const v = ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b)
  const r = new Uint8Array(v.length)
  r.set(v)
  return r
}

export function paraBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

export function deBase64(s: string): Uint8Array {
  const bin = atob(s)
  const r = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i)
  return r
}

export function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}

export function novoIdMensagem(): string {
  return paraBase64(aleatorio(16))
}

// ---------- chaves ----------

export async function gerarParEfemero(): Promise<{ privada: CryptoKey; publica: Uint8Array }> {
  const par = (await sutil().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])) as CryptoKeyPair
  return { privada: par.privateKey, publica: bytes(await sutil().exportKey('raw', par.publicKey)) }
}

export interface ChavesSessao {
  /** app → servidor */
  ida: CryptoKey
  /** servidor → app */
  volta: CryptoKey
}

/** ECDH → HKDF-SHA-256 → duas chaves AES-GCM-256 não exportáveis (uma por sentido). */
export async function derivarChaves(privada: CryptoKey, publicaOutro: Uint8Array, nonceApp: Uint8Array, nonceServ: Uint8Array): Promise<ChavesSessao> {
  const s = sutil()
  const outro = await s.importKey('raw', bytes(publicaOutro), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const segredo = await s.deriveBits({ name: 'ECDH', public: outro }, privada, 256)
  const base = await s.importKey('raw', segredo, 'HKDF', false, ['deriveKey'])
  const sal = juntar(nonceApp, nonceServ)
  const derivar = (info: Uint8Array) =>
    s.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  return { ida: await derivar(ROTULO_APP), volta: await derivar(ROTULO_SERV) }
}

/** O que o servidor assina no aperto de mão (liga as duas chaves efêmeras e a sessão). */
export function transcricao(pubApp: Uint8Array, nonceApp: Uint8Array, pubServ: Uint8Array, nonceServ: Uint8Array, sessao: Uint8Array): Uint8Array {
  return juntar(ROTULO_K, pubApp, nonceApp, pubServ, nonceServ, sessao)
}

/** Chave pública fixa do servidor (base64 do formato "raw" P-256, 65 bytes) para conferir a assinatura. */
export async function importarChaveFixa(base64: string): Promise<CryptoKey> {
  return sutil().importKey('raw', deBase64(base64.trim()), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
}

export async function conferirAssinatura(chave: CryptoKey, assinatura: Uint8Array, dados: Uint8Array): Promise<boolean> {
  return sutil().verify({ name: 'ECDSA', hash: 'SHA-256' }, chave, bytes(assinatura), bytes(dados))
}

export async function assinar(chave: CryptoKey, dados: Uint8Array): Promise<Uint8Array> {
  return bytes(await sutil().sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, bytes(dados)))
}

// ---------- selar / abrir ----------

/** comprimento(4) ‖ JSON ‖ zeros até múltiplo de 1 KB */
function preencher(obj: unknown): Uint8Array {
  const json = txt.encode(JSON.stringify(obj))
  const total = Math.ceil((json.length + 4) / BLOCO_PREENCHIMENTO) * BLOCO_PREENCHIMENTO
  const r = new Uint8Array(total)
  new DataView(r.buffer).setUint32(0, json.length)
  r.set(json, 4)
  return r
}

function tirarPreenchimento(b: Uint8Array): unknown {
  const n = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0)
  if (n + 4 > b.length) throw new Error('canal')
  return JSON.parse(new TextDecoder().decode(b.subarray(4, 4 + n)))
}

function aad(sentido: 'ida' | 'volta', sessao: Uint8Array): Uint8Array {
  return juntar(sentido === 'ida' ? ROTULO_APP : ROTULO_SERV, sessao)
}

/** iv(12) ‖ AES-GCM(texto preenchido); AAD = sentido ‖ sessão (não dá para trocar de sentido nem de sessão) */
export async function selar(chave: CryptoKey, sentido: 'ida' | 'volta', sessao: Uint8Array, obj: unknown): Promise<Uint8Array> {
  const iv = aleatorio(TAM_IV)
  const c = await sutil().encrypt({ name: 'AES-GCM', iv, additionalData: aad(sentido, sessao), tagLength: 128 }, chave, preencher(obj))
  return juntar(iv, bytes(c))
}

/** Lança erro genérico se o texto foi alterado, a chave é outra ou o formato não confere. */
export async function abrir<T>(chave: CryptoKey, sentido: 'ida' | 'volta', sessao: Uint8Array, dados: Uint8Array): Promise<T> {
  if (dados.length < TAM_IV + 16) throw new Error('canal')
  try {
    const t = await sutil().decrypt(
      { name: 'AES-GCM', iv: bytes(dados.subarray(0, TAM_IV)), additionalData: aad(sentido, sessao), tagLength: 128 },
      chave,
      bytes(dados.subarray(TAM_IV)),
    )
    return tirarPreenchimento(bytes(t)) as T
  } catch {
    throw new Error('canal')
  }
}
