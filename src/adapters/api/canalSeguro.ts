// CANAL SEGURO (lado do app): aperto de mão em POST /v1/k e TODO pedido em POST /v1/r, cifrado.
// Na aba Rede aparece só: o mesmo endereço, corpo binário de tamanho "redondo" e resposta binária.
// Nada de nome de comando, parâmetro, token ou mensagem de erro legível. Nunca registra conteúdo no console.
// Protocolo: src/core/seguranca/envelope.ts e api-contract/openapi.yaml.

import {
  TAM_ASSINATURA,
  TAM_CHAVE_PUBLICA,
  TAM_NONCE,
  TAM_SESSAO,
  abrir,
  aleatorio,
  bytes,
  conferirAssinatura,
  derivarChaves,
  gerarParEfemero,
  importarChaveFixa,
  juntar,
  novoIdMensagem,
  selar,
  transcricao,
  type ChavesSessao,
  type Mensagem,
  type Resposta,
} from '../../core/seguranca/envelope'

/** Falha de transporte, sem detalhe: 'rede' = não chegou; 'servidor' = chegou mas não deu para confiar/entender. */
export class ErroCanal extends Error {
  constructor(readonly tipo: 'rede' | 'servidor') {
    super(tipo)
    this.name = 'ErroCanal'
  }
}

export interface OpcoesCanal {
  url: string
  fetch: typeof fetch
  /** base64 da chave pública FIXA do servidor (ECDSA P-256 raw). Se existir, o aperto de mão tem de vir assinado por ela. */
  chavePublica?: string
  tempoLimiteMs?: number
}

interface Sessao {
  id: Uint8Array
  chaves: ChavesSessao
}

const CABECALHOS = { 'Content-Type': 'application/octet-stream', Accept: 'application/octet-stream' }

export class CanalSeguro {
  private sessao?: Promise<Sessao>
  /** diferença entre o relógio do servidor e o do aparelho (ms) */
  private desvio = 0

  constructor(private op: OpcoesCanal) {}

  /** Esquece as chaves (ex.: ao sair). O próximo pedido faz um aperto de mão novo. */
  esquecer() {
    this.sessao = undefined
  }

  private async postar(caminho: string, corpo: Uint8Array): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.op.tempoLimiteMs ?? 15000)
    try {
      return await this.op.fetch(`${this.op.url}${caminho}`, {
        method: 'POST',
        body: corpo,
        headers: CABECALHOS,
        signal: ctrl.signal,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
    } catch {
      throw new ErroCanal('rede')
    } finally {
      clearTimeout(timer)
    }
  }

  private async lerBinario(res: Response): Promise<Uint8Array> {
    try {
      return bytes(await res.arrayBuffer())
    } catch {
      throw new ErroCanal('rede')
    }
  }

  private abrirSessao(): Promise<Sessao> {
    if (!this.sessao) {
      this.sessao = this.apertoDeMao()
      this.sessao.catch(() => (this.sessao = undefined))
    }
    return this.sessao
  }

  private async apertoDeMao(): Promise<Sessao> {
    try {
      const { privada, publica } = await gerarParEfemero()
      const nonceApp = aleatorio(TAM_NONCE)
      const res = await this.postar('/v1/k', juntar(publica, nonceApp))
      if (res.status !== 200) throw new ErroCanal('servidor')
      const r = await this.lerBinario(res)
      const base = TAM_CHAVE_PUBLICA + TAM_NONCE + TAM_SESSAO
      if (r.length !== base && r.length !== base + TAM_ASSINATURA) throw new ErroCanal('servidor')
      const pubServ = r.subarray(0, TAM_CHAVE_PUBLICA)
      const nonceServ = r.subarray(TAM_CHAVE_PUBLICA, TAM_CHAVE_PUBLICA + TAM_NONCE)
      const id = bytes(r.subarray(TAM_CHAVE_PUBLICA + TAM_NONCE, base))
      if (this.op.chavePublica) {
        // chave fixada: sem assinatura válida, não conversa (pode ter alguém no meio)
        if (r.length !== base + TAM_ASSINATURA) throw new ErroCanal('servidor')
        const fixa = await importarChaveFixa(this.op.chavePublica)
        const ok = await conferirAssinatura(fixa, r.subarray(base), transcricao(publica, nonceApp, pubServ, nonceServ, id))
        if (!ok) throw new ErroCanal('servidor')
      }
      return { id, chaves: await derivarChaves(privada, pubServ, nonceApp, nonceServ) }
    } catch (e) {
      throw e instanceof ErroCanal ? e : new ErroCanal('servidor')
    }
  }

  /**
   * Envia uma mensagem cifrada e devolve a resposta aberta (ok ou erro de regra).
   * Refaz o aperto de mão uma vez se o servidor perdeu a sessão e ajusta o relógio uma vez se ele pedir.
   */
  async enviar(m: Omit<Mensagem, 'id' | 'ts'>): Promise<Resposta> {
    for (let volta = 0; volta < 3; volta++) {
      const sessao = await this.abrirSessao()
      const msg: Mensagem = { ...m, id: novoIdMensagem(), ts: Date.now() + this.desvio }
      let corpo: Uint8Array
      try {
        corpo = juntar(sessao.id, await selar(sessao.chaves.ida, 'ida', sessao.id, msg))
      } catch {
        throw new ErroCanal('servidor')
      }
      const res = await this.postar('/v1/r', corpo)
      if (res.status === 401) {
        // sessão vencida/desconhecida no servidor: novo aperto de mão
        this.esquecer()
        continue
      }
      if (res.status !== 200) throw new ErroCanal('servidor')
      let r: Resposta
      try {
        r = await abrir<Resposta>(sessao.chaves.volta, 'volta', sessao.id, await this.lerBinario(res))
      } catch (e) {
        throw e instanceof ErroCanal ? e : new ErroCanal('servidor')
      }
      if (r.re !== msg.id) throw new ErroCanal('servidor')
      if (typeof r.ts === 'number') this.desvio = r.ts - Date.now()
      if (r.falha === 'relogio') continue
      return r
    }
    throw new ErroCanal('servidor')
  }
}
