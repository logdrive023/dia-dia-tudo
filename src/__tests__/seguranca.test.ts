// Segurança das requisições: na rede só passa ruído cifrado (nada de nome de comando, campo, valor, nome de cliente),
// mexer no conteúdo é recusado, reenviar o mesmo pedido é recusado e chave errada falha sem detalhe.

import { describe, expect, it } from 'vitest'
import { BackendApi, MSG_ERRO_SERVIDOR, MSG_SEM_CONEXAO } from '../adapters/api/backendApi'
import { criarFetchSimulado, gerarChaveFixaServidor } from '../adapters/api/apiSimulada'
import { criarBackend } from '../app/criarBackend'
import { ErroNegocio } from '../core/domain/erros'
import type { Backend } from '../core/ports/backend'
import { BLOCO_PREENCHIMENTO, JANELA_MS, TAM_IV, TAM_SESSAO, bytes } from '../core/seguranca/envelope'
import { bs } from './ajuda'

const URL_API = 'https://api.teste'
const CLIENTE = 'Maria Aparecida Quispe'

interface Capturado {
  url: string
  metodo?: string
  cabecalhos: Record<string, string>
  corpo: Uint8Array
  status: number
  resposta: Uint8Array
}

/** Grava tudo o que "a aba Rede" veria: endereço, método, cabeçalhos, corpo enviado e corpo recebido. */
function gravador(f: typeof fetch, mexer?: { pedido?: (b: Uint8Array) => Uint8Array; resposta?: (b: Uint8Array) => Uint8Array }) {
  const log: Capturado[] = []
  const espiao = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    let corpo = init?.body ? bytes(init.body as Uint8Array) : new Uint8Array(0)
    if (mexer?.pedido && String(entrada).endsWith('/v1/r')) corpo = mexer.pedido(corpo)
    const res = await f(entrada, { ...init, body: corpo })
    let resposta = bytes(await res.arrayBuffer())
    if (mexer?.resposta && String(entrada).endsWith('/v1/r')) resposta = mexer.resposta(resposta)
    log.push({ url: String(entrada), metodo: init?.method, cabecalhos: { ...(init?.headers as Record<string, string>) }, corpo, status: res.status, resposta })
    return new Response(resposta.length ? resposta : null, { status: res.status, headers: res.headers })
  }) as typeof fetch
  return { log, espiao }
}

/** Conta quantos comandos o servidor realmente executou. */
function contarComandos(b: Backend) {
  const cont = { n: 0 }
  const original = b.comando.bind(b)
  b.comando = ((nome, dados) => {
    cont.n++
    return original(nome, dados)
  }) as Backend['comando']
  return cont
}

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('')
const utf8 = (b: Uint8Array) => new TextDecoder('utf-8', { fatal: false }).decode(b)
const inverterUmByte = (b: Uint8Array) => {
  const c = b.slice()
  c[c.length - 5] ^= 0x01
  return c
}

async function vender(api: BackendApi) {
  await api.comando('salvarConfig', { moedaPrincipal: 'BOB' })
  await api.comando('salvarCotacao', { id: 'c1', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
  await api.comando('salvarPessoa', { id: 'pessoa-1', nome: CLIENTE, papeis: ['cliente'] })
  await api.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha dourada', saldoInicial: 5 })
  await api.comando('concluirVenda', {
    id: 'v',
    pessoaId: 'pessoa-1',
    linhas: [{ id: 'l', itemId: 'x', quantidade: 2, moeda: 'BOB', total: bs(50) }],
    pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(30) }],
  })
  return api.consulta('contaPessoa', { pessoaId: 'pessoa-1' })
}

describe('canal cifrado (envelope)', () => {
  it('ida e volta pela API simulada, com a chave do servidor fixada; nada legível na rede', async () => {
    const { par, publica } = await gerarChaveFixaServidor()
    const servidor = criarBackend({ tipo: 'memory' }).backend
    const { log, espiao } = gravador(criarFetchSimulado(servidor, { chaveFixa: par }))
    const api = new BackendApi({ url: URL_API, fetch: espiao, tentativas: 1, chavePublica: publica })

    const conta = await vender(api)
    expect(conta.saldo).toBe(bs(20))
    const pessoas = await api.consulta('pessoas', {})
    expect(pessoas.some((p) => p.nome === CLIENTE)).toBe(true)
    // erro de regra chega inteiro (dentro do envelope, HTTP 200)
    await expect(api.entrar('ninguem', 'errada')).rejects.toBeInstanceOf(ErroNegocio)
    // arquivo vai e volta cifrado; o endereço devolvido é local (blob:), sem id na rede
    await api.anexar({ id: 'anx-1', donoId: 'pessoa-1', categoria: 'comprovante', nome: 'comprovante-maria.pdf', arquivo: new Blob(['conteudo secreto do PDF']) })
    expect(await api.urlDoAnexo('anx-1')).toMatch(/^blob:/)
    const backup = await api.exportar()
    expect(backup.colecoes.pessoas.length).toBeGreaterThan(0)

    // um único aperto de mão e o resto tudo no mesmo endereço opaco
    expect(log.filter((c) => c.url === `${URL_API}/v1/k`)).toHaveLength(1)
    expect(log.every((c) => c.url === `${URL_API}/v1/k` || c.url === `${URL_API}/v1/r`)).toBe(true)
    expect(log.every((c) => c.metodo === 'POST' && c.status === 200)).toBe(true)
    // nada de token, cookie ou nome no cabeçalho
    for (const c of log) {
      expect(Object.keys(c.cabecalhos).map((k) => k.toLowerCase())).not.toContain('authorization')
      expect(Object.keys(c.cabecalhos).map((k) => k.toLowerCase())).not.toContain('idempotency-key')
      expect(Object.values(c.cabecalhos).join(' ')).not.toMatch(/comando|consulta|venda|pessoa/i)
    }
    const proibidos = ['concluirVenda', 'salvarPessoa', 'contaPessoa', 'pessoas', 'entrar', 'pessoaId', 'total', 'pagamentos', 'Maria', 'Quispe', 'Presilha', 'ninguem', 'errada', 'senha', 'token', 'comprovante', 'secreto', 'comando', 'consulta', 'mensagem', 'conferem', '"nome"', 'moedaPrincipal']
    for (const c of log) {
      for (const texto of [c.url, latin1(c.corpo), utf8(c.corpo), latin1(c.resposta), utf8(c.resposta)])
        for (const p of proibidos) expect(texto.includes(p), `"${p}" visível na rede`).toBe(false)
    }
    // tamanho em degraus de 1 KB: sessão(16) + iv(12) + texto preenchido + etiqueta(16)
    for (const c of log.filter((x) => x.url.endsWith('/v1/r'))) {
      expect((c.corpo.length - TAM_SESSAO - TAM_IV - 16) % BLOCO_PREENCHIMENTO).toBe(0)
      expect((c.resposta.length - TAM_IV - 16) % BLOCO_PREENCHIMENTO).toBe(0)
    }
  })

  it('conteúdo alterado no caminho é recusado (pedido e resposta), sem executar e sem detalhe', async () => {
    const servidor = criarBackend({ tipo: 'memory' }).backend
    const cont = contarComandos(servidor)
    const ida = gravador(criarFetchSimulado(servidor), { pedido: inverterUmByte })
    const api = new BackendApi({ url: URL_API, fetch: ida.espiao, tentativas: 1 })
    const e = await api.comando('salvarPessoa', { id: 'p', nome: CLIENTE, papeis: ['cliente'] }).catch((x) => x)
    expect(e).toBeInstanceOf(ErroNegocio)
    expect(e.message).toBe(MSG_ERRO_SERVIDOR)
    expect(e.campo).toBeUndefined()
    expect(cont.n).toBe(0)
    expect(ida.log.at(-1)!.status).toBe(400)
    expect(ida.log.at(-1)!.resposta.length).toBe(0)

    const volta = gravador(criarFetchSimulado(servidor), { resposta: inverterUmByte })
    const api2 = new BackendApi({ url: URL_API, fetch: volta.espiao, tentativas: 1 })
    await expect(api2.consulta('pessoas', {})).rejects.toThrow(MSG_ERRO_SERVIDOR)
  })

  it('reenviar o mesmo envelope (repetição) é recusado; envelope velho também', async () => {
    const servidor = criarBackend({ tipo: 'memory' }).backend
    const cont = contarComandos(servidor)
    let relogio = Date.now()
    const servidorFetch = criarFetchSimulado(servidor, { agora: () => relogio })
    const { log, espiao } = gravador(servidorFetch)
    const api = new BackendApi({ url: URL_API, fetch: espiao, tentativas: 1 })
    await api.comando('salvarPessoa', { id: 'p', nome: CLIENTE, papeis: ['cliente'] })
    const n = cont.n
    const capturado = log.at(-1)!
    const reenviar = () => servidorFetch(capturado.url, { method: 'POST', body: capturado.corpo })

    const r1 = await reenviar()
    expect(r1.status).toBe(400)
    expect((await r1.arrayBuffer()).byteLength).toBe(0)
    expect(cont.n).toBe(n)

    // bem depois (o id já saiu da memória do servidor): o ts velho barra
    relogio += 2 * JANELA_MS + 60_000
    const r2 = await reenviar()
    expect(r2.status).toBe(200) // resposta cifrada pedindo relógio novo; nada executado
    expect(cont.n).toBe(n)
    expect(latin1(bytes(await r2.arrayBuffer()))).not.toContain('relogio')
  })

  it('relógio do aparelho errado: o app se ajusta pelo servidor e o pedido passa', async () => {
    const servidor = criarBackend({ tipo: 'memory' }).backend
    const api = new BackendApi({ url: URL_API, fetch: criarFetchSimulado(servidor, { agora: () => Date.now() + 3 * JANELA_MS }), tentativas: 1 })
    await api.comando('salvarPessoa', { id: 'p', nome: CLIENTE, papeis: ['cliente'] })
    expect((await api.consulta('pessoas', {})).some((p) => p.id === 'p')).toBe(true)
  })

  it('servidor esqueceu a sessão: o app refaz o aperto de mão sozinho', async () => {
    const servidor = criarBackend({ tipo: 'memory' }).backend
    let relogio = Date.now()
    const { log, espiao } = gravador(criarFetchSimulado(servidor, { agora: () => relogio, validadeSessaoMs: 1000 }))
    const api = new BackendApi({ url: URL_API, fetch: espiao, tentativas: 1 })
    await api.consulta('pessoas', {})
    relogio += 5000
    await api.consulta('pessoas', {})
    expect(log.filter((c) => c.url.endsWith('/v1/k'))).toHaveLength(2)
    expect(log.some((c) => c.status === 401)).toBe(true)
  })

  it('chave errada falha de forma genérica', async () => {
    const servidor = criarBackend({ tipo: 'memory' }).backend
    const cont = contarComandos(servidor)
    const certa = await gerarChaveFixaServidor()
    const outra = await gerarChaveFixaServidor()
    // app fixou outra chave (alguém no meio trocando as chaves): não conversa
    const api = new BackendApi({ url: URL_API, fetch: criarFetchSimulado(servidor, { chaveFixa: certa.par }), tentativas: 1, chavePublica: outra.publica })
    const e = await api.comando('salvarPessoa', { id: 'p', nome: CLIENTE, papeis: ['cliente'] }).catch((x) => x)
    expect(e).toBeInstanceOf(ErroNegocio)
    expect(e.message).toBe(MSG_ERRO_SERVIDOR)
    expect(e.campo).toBeUndefined()
    // app fixou a chave, mas o servidor não assina: também não conversa
    const semAssinatura = new BackendApi({ url: URL_API, fetch: criarFetchSimulado(servidor), tentativas: 1, chavePublica: certa.publica })
    await expect(semAssinatura.consulta('pessoas', {})).rejects.toThrow(MSG_ERRO_SERVIDOR)
    expect(cont.n).toBe(0)

    // envelope de outra sessão (outra chave) enviado para esta sessão: 400 sem corpo
    const fA = criarFetchSimulado(servidor)
    const a = gravador(fA)
    const b = gravador(criarFetchSimulado(servidor))
    await new BackendApi({ url: URL_API, fetch: a.espiao, tentativas: 1 }).consulta('pessoas', {})
    await new BackendApi({ url: URL_API, fetch: b.espiao, tentativas: 1 }).consulta('pessoas', {})
    const deA = a.log.at(-1)!.corpo
    const deB = b.log.at(-1)!.corpo
    const misturado = new Uint8Array(deB.length)
    misturado.set(deB)
    misturado.set(deA.subarray(0, TAM_SESSAO), 0) // sessão de A, conteúdo cifrado com a chave de B
    const r = await fA(`${URL_API}/v1/r`, { method: 'POST', body: misturado })
    expect(r.status).toBe(400)
    expect((await r.arrayBuffer()).byteLength).toBe(0)
  })

  it('sem rede: mensagem genérica, sem endereço nem erro técnico', async () => {
    const api = new BackendApi({
      url: URL_API,
      fetch: (async () => {
        throw new TypeError(`Failed to fetch ${URL_API}/v1/k`)
      }) as typeof fetch,
      tentativas: 1,
    })
    const e = await api.consulta('pessoas', {}).catch((x) => x)
    expect(e).toBeInstanceOf(ErroNegocio)
    expect(e.message).toBe(MSG_SEM_CONEXAO)
    expect(e.campo).toBeUndefined()
  })

  it('caminhos antigos (com nome no endereço) não existem mais', async () => {
    const f = criarFetchSimulado(criarBackend({ tipo: 'memory' }).backend)
    expect((await f(`${URL_API}/v1/consultas/pessoas?p={}`)).status).toBe(404)
    expect((await f(`${URL_API}/v1/comandos/salvarPessoa`, { method: 'POST', body: '{}' })).status).toBe(404)
    expect((await f(`${URL_API}/v1/r?x=1`, { method: 'POST' })).status).toBe(404)
  })
})
