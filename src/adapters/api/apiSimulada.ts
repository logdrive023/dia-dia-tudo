// API SIMULADA: um "servidor" de mentira que responde pelo contrato da API usando as mesmas regras.
// Serve para provar (nos testes de contrato) que o adaptador API funciona antes de o servidor existir.
// Faz também o LADO DO SERVIDOR do canal cifrado (é o modelo para o servidor de verdade):
//   POST /v1/k → aperto de mão ECDH (assinado pela chave fixa, se houver)
//   POST /v1/r → abre o envelope, recusa repetição (id visto / ts fora da janela), executa e devolve cifrado
// Erro de regra = HTTP 200 com { ok: false, erro } DENTRO do envelope. Falha de transporte = status sem corpo.

import { ErroNegocio } from '../../core/domain/erros'
import type { Backend, Backup } from '../../core/ports/backend'
import {
  JANELA_MS,
  TAM_CHAVE_PUBLICA,
  TAM_NONCE,
  TAM_SESSAO,
  abrir,
  aleatorio,
  assinar,
  bytes,
  derivarChaves,
  gerarParEfemero,
  juntar,
  paraBase64,
  selar,
  transcricao,
  type ChavesSessao,
  type Mensagem,
  type Resposta,
} from '../../core/seguranca/envelope'
import type { NomeComando, NomeConsulta } from '../../core/services'

export interface OpcoesServidorSimulado {
  /** par ECDSA P-256 fixo do servidor: assina o aperto de mão (o app confere com VITE_API_CHAVE_PUBLICA) */
  chaveFixa?: CryptoKeyPair
  /** relógio do servidor (ms); nos testes dá para adiantar */
  agora?: () => number
  /** sessão sem uso por mais que isso é esquecida (o app refaz o aperto de mão) */
  validadeSessaoMs?: number
}

/** Gera o par fixo do servidor e a chave pública em base64 (o valor de VITE_API_CHAVE_PUBLICA). */
export async function gerarChaveFixaServidor(): Promise<{ par: CryptoKeyPair; publica: string }> {
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  return { par, publica: paraBase64(bytes(await crypto.subtle.exportKey('raw', par.publicKey))) }
}

interface SessaoServidor {
  chaves: ChavesSessao
  vistos: Map<string, number>
  usadaEm: number
}

export function criarFetchSimulado(servidor: Backend, opcoes: OpcoesServidorSimulado = {}): typeof fetch {
  const agora = opcoes.agora ?? (() => Date.now())
  // idempotência por PEDIDO (chave nova a cada chamada do app, repetida só nas tentativas automáticas) e por token:
  // guarda a promessa → duas cópias do mesmo pedido ao mesmo tempo não executam duas vezes (a 2ª espera a 1ª)
  const idempotencia = new Map<string, Promise<unknown>>()
  const sessoes = new Map<string, SessaoServidor>()
  const arquivos = new Map<string, { mime: string; conteudo: string }>()
  const binario = (status: number, corpo?: Uint8Array) =>
    new Response(corpo ?? null, { status, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } })

  async function lerCorpo(init?: RequestInit): Promise<Uint8Array> {
    const b = init?.body
    if (ArrayBuffer.isView(b) || Object.prototype.toString.call(b) === '[object ArrayBuffer]') return bytes(b as ArrayBuffer | ArrayBufferView)
    if (b && typeof (b as Blob).arrayBuffer === 'function') return bytes(await (b as Blob).arrayBuffer())
    return new Uint8Array(0)
  }

  async function apertoDeMao(corpo: Uint8Array): Promise<Response> {
    if (corpo.length !== TAM_CHAVE_PUBLICA + TAM_NONCE) return binario(400)
    const pubApp = corpo.subarray(0, TAM_CHAVE_PUBLICA)
    const nonceApp = corpo.subarray(TAM_CHAVE_PUBLICA)
    const { privada, publica } = await gerarParEfemero()
    const nonceServ = aleatorio(TAM_NONCE)
    const id = aleatorio(TAM_SESSAO)
    const chaves = await derivarChaves(privada, pubApp, nonceApp, nonceServ)
    sessoes.set(paraBase64(id), { chaves, vistos: new Map(), usadaEm: agora() })
    const resposta = juntar(publica, nonceServ, id)
    if (!opcoes.chaveFixa) return binario(200, resposta)
    const assinatura = await assinar(opcoes.chaveFixa.privateKey, transcricao(pubApp, nonceApp, publica, nonceServ, id))
    return binario(200, juntar(resposta, assinatura))
  }

  async function executar(m: Mensagem): Promise<unknown> {
    const d = m.dados as Record<string, unknown>
    if (m.tipo === 'comando') return servidor.comando(m.nome as NomeComando, d as never)
    if (m.tipo === 'consulta') return servidor.consulta(m.nome as NomeConsulta, (d ?? {}) as never)
    if (m.tipo === 'auth' && m.nome === 'entrar') {
      const sessao = await servidor.entrar(String(d.login), String(d.senha))
      return { token: paraBase64(aleatorio(32)), sessao }
    }
    if (m.tipo === 'backup' && m.nome === 'exportar') return servidor.exportar()
    if (m.tipo === 'backup' && m.nome === 'importar') return servidor.importar(d as unknown as Backup)
    if (m.tipo === 'arquivo' && m.nome === 'enviar') {
      arquivos.set(String(d.id), { mime: String(d.mime ?? ''), conteudo: String(d.conteudo ?? '') })
      return { ok: true }
    }
    if (m.tipo === 'arquivo' && m.nome === 'baixar') return arquivos.get(String(d.id)) ?? null
    throw new ErroNegocio('Pedido não existe.')
  }

  async function pedido(corpo: Uint8Array): Promise<Response> {
    if (corpo.length < TAM_SESSAO) return binario(400)
    const idSessao = bytes(corpo.subarray(0, TAM_SESSAO))
    const chaveSessao = paraBase64(idSessao)
    const s = sessoes.get(chaveSessao)
    const t = agora()
    if (!s || t - s.usadaEm > (opcoes.validadeSessaoMs ?? 30 * 60_000)) {
      sessoes.delete(chaveSessao)
      return binario(401)
    }
    let m: Mensagem
    try {
      m = await abrir<Mensagem>(s.chaves.ida, 'ida', idSessao, corpo.subarray(TAM_SESSAO))
    } catch {
      return binario(400) // alterado, chave errada ou lixo: sem detalhe
    }
    s.usadaEm = t
    for (const [id, quando] of s.vistos) if (t - quando > 2 * JANELA_MS) s.vistos.delete(id)
    // repetição exata (mesmo envelope reenviado por alguém): recusa sem executar
    if (typeof m.id !== 'string' || s.vistos.has(m.id)) return binario(400)
    s.vistos.set(m.id, t)
    const responder = async (r: Omit<Resposta, 're' | 'ts'>) => binario(200, await selar(s.chaves.volta, 'volta', idSessao, { ...r, re: m.id, ts: agora() }))
    // envelope velho (ou relógio do aparelho muito errado): não executa; o app ajusta o relógio e manda outro
    if (typeof m.ts !== 'number' || Math.abs(t - m.ts) > JANELA_MS) return responder({ ok: false, falha: 'relogio' })
    try {
      // JSON de ida e volta: garante que tudo que trafega é JSON puro
      const rodar = async () => {
        const r = await executar(m)
        return r === undefined ? undefined : JSON.parse(JSON.stringify(r))
      }
      if (!m.chave) return responder({ ok: true, r: await rodar() })
      const chave = `${m.token ?? ''}|${m.chave}`
      let p = idempotencia.get(chave)
      if (!p) {
        p = rodar()
        idempotencia.set(chave, p)
        // recusa de regra não fica guardada: a pessoa corrige e o app manda outro pedido (chave nova) — mas a cópia em voo vê a mesma recusa
        p.catch(() => idempotencia.delete(chave))
      }
      return responder({ ok: true, r: await p })
    } catch (e) {
      if (e instanceof ErroNegocio) return responder({ ok: false, erro: { mensagem: e.message, campo: e.campo } })
      return binario(500) // erro interno: nada de pilha ou mensagem técnica para fora
    }
  }

  return (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada))
    try {
      if (init?.method !== 'POST' || url.search) return binario(404)
      if (url.pathname === '/v1/k') return await apertoDeMao(await lerCorpo(init))
      if (url.pathname === '/v1/r') return await pedido(await lerCorpo(init))
      return binario(404)
    } catch {
      return binario(500)
    }
  }) as typeof fetch
}
