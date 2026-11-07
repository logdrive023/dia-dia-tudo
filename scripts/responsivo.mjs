// RESPONSIVO — confere todas as telas nas larguras padrão, pela linha de comando, sem abrir nada à mão.
// Usa a varredura.html (o mesmo exame: "sai da tela" e "palavra quebrada") num navegador sem janela (o Edge do
// Windows, ou o Chrome; nada é baixado) e, com --fotos, tira uma foto de cada tela × largura e monta uma página só
// com todas lado a lado (.responsivo/index.html) para olhar rápido.
//
//   npm run responsivo                              todas as telas · 375, 768, 1024, 1440
//   npm run responsivo -- --rotas precos/tab-geral,estoque --fotos
//   npm run responsivo -- --larguras 320,360,390    (as do celular)   · --ver mostra o navegador
//   npm run responsivo -- --paralelo 6              trabalhadores (navegadores isolados) ao mesmo tempo; 1 = em fila
//   npm run responsivo -- --quadros 2               telas abertas ao mesmo tempo dentro de cada trabalhador
//   npm run responsivo -- --espera 700              modo antigo da varredura (esperas fixas)
//   npm run responsivo -- --calma 400 --calma-carga 800   se alguma tela for medida antes de terminar de desenhar
//
// Paralelo: cada trabalhador é um contexto próprio do navegador (dados isolados, a demonstração nasce do zero em
// cada um). As telas são divididas entre eles: cada tela é aberta uma vez só. As fichas (endereço com id) são
// descobertas e fotografadas pelo mesmo trabalhador, porque os ids podem mudar de uma demonstração para outra.
// O primeiro login é feito sozinho, para aquecer o servidor (o Vite pode reempacotar dependências no primeiro acesso).
//
// Servidor: usa o que já estiver em http://127.0.0.1:5174; se não houver, sobe um só para a conferência (e fecha).
// Nunca toca nos dados do dono (o navegador dele não é usado). Sai com código 1 se achar problema.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(RAIZ)
const args = process.argv.slice(2)
const so = (f) => args.includes(f)
const valorDe = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao }

const URL_BASE = valorDe('--url', 'http://127.0.0.1:5174').replace(/\/$/, '')
const LARGURAS = valorDe('--larguras', '375,768,1024,1440').split(',').map(Number)
const ROTAS = valorDe('--rotas', '') // vazio = todas as telas da varredura (listas, formulários e uma ficha de cada)
const FOTOS = so('--fotos')
const PARALELO = Math.max(1, Number(valorDe('--paralelo', Math.min(4, Math.max(2, Math.floor(availableParallelism() / 2))))) || 1)
const QUADROS = Math.max(1, Number(valorDe('--quadros', '1')) || 1)
const REPASSAR = { espera: valorDe('--espera', ''), calma: valorDe('--calma', ''), 'calma-carga': valorDe('--calma-carga', '') }
const SAIDA = join(RAIZ, '.responsivo')
const inicio = Date.now()
const seg = () => `${((Date.now() - inicio) / 1000).toFixed(0)} s`
const temProblema = (r) => !!(r.erro || r.fora.length || r.quebradas.length)

// ---------- servidor ----------
async function noAr(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok } catch { return false }
}
let servidor
if (!(await noAr(URL_BASE + '/'))) {
  const { port, hostname } = new URL(URL_BASE)
  console.log(`▶ subindo o servidor em ${URL_BASE} (só para esta conferência)…`)
  const { createServer } = await import('vite')
  servidor = await createServer({ logLevel: 'error', server: { host: hostname, port: Number(port), strictPort: true } })
  await servidor.listen()
}

// ---------- navegador ----------
const { chromium } = await import('playwright-core')
async function abrirNavegador() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: !so('--ver') }) } catch { /* tenta o próximo */ }
  }
  throw new Error('Nenhum navegador encontrado (Edge ou Chrome).')
}
const navegador = await abrirNavegador()
const LOCAL = ['127.0.0.1', 'localhost'].includes(new URL(URL_BASE).hostname)

/** @type {import('playwright-core').Page[]} */
const paginas = []

// um trabalhador = contexto novo (storage próprio) + uma página, já dentro do modo de teste como Administrador
async function novoTrabalhador() {
  const contexto = await navegador.newContext({ viewport: { width: 1600, height: 900 } })
  // a "senha de acesso" da demonstração é só uma marca na sessão (src/features/acesso/model/acesso.ts): no servidor
  // LOCAL a conferência já entra liberada, sem guardar nem digitar senha. No site publicado continua pedindo.
  if (LOCAL) {
    await contexto.addInitScript(() => { try { sessionStorage.setItem('tudo:acesso-liberado', '1') } catch { /* sem sessão */ } })
  }
  const pagina = await contexto.newPage()
  paginas.push(pagina)
  await pagina.goto(URL_BASE + '/')
  await pagina.getByText('Administrador', { exact: true }).first().click({ timeout: 90_000 })
  await pagina.waitForFunction(() => !document.body.innerText.includes('Entrar no Tudo'), null, { timeout: 30_000 })
  return pagina
}

async function abrirVarredura(pagina, params) {
  await pagina.goto(`${URL_BASE}/varredura.html?${new URLSearchParams(params)}`)
  await pagina.waitForFunction(() => window.__pronto === true, null, { timeout: 30 * 60_000, polling: 1000 })
  const erro = await pagina.evaluate(() => window.__erro)
  if (erro) throw new Error(`a varredura parou: ${erro}`)
}

/** divide as telas entre n trabalhadores; o primeiro leva as fichas (descobrir + varrer ≈ 9 telas de trabalho) */
function repartir(fixas, comFichas, n) {
  const PESO_FICHAS = 9
  n = Math.max(1, Math.min(n, fixas.length + (comFichas ? 1 : 0)))
  if (n === 1) return [[...fixas, ...(comFichas ? ['@fichas'] : [])]]
  const lotes = Array.from({ length: n }, () => [])
  const resto = [...fixas]
  if (comFichas) {
    const cota = Math.max(0, Math.round((fixas.length + PESO_FICHAS) / n) - PESO_FICHAS)
    lotes[0].push(...resto.splice(0, cota), '@fichas')
  }
  const alvos = comFichas ? lotes.slice(1) : lotes
  resto.forEach((r, i) => alvos[i % alvos.length].push(r))
  return lotes.filter((l) => l.length)
}

let codigo = 0

try {
  console.log('▶ entrando no modo de teste…')
  const trabalhadores = [await novoTrabalhador()] // sozinho: aquece o servidor

  // quais telas existem
  let fixas, comFichas
  if (ROTAS) {
    fixas = ROTAS.split(',').map((s) => s.trim()).filter(Boolean)
    comFichas = false
  } else {
    await abrirVarredura(trabalhadores[0], { listar: '1' })
    fixas = await trabalhadores[0].evaluate(() => window.__rotas)
    comFichas = true
  }
  const lotes = repartir(fixas, comFichas, PARALELO)
  if (lotes.length > 1) {
    console.log(`▶ abrindo mais ${lotes.length - 1} trabalhador(es)…`)
    trabalhadores.push(...(await Promise.all(Array.from({ length: lotes.length - 1 }, novoTrabalhador))))
  }

  // a varredura: cada trabalhador com o seu lote de telas, todos ao mesmo tempo
  console.log(`▶ varrendo ${ROTAS || 'todas as telas'} em ${LARGURAS.join(', ')} px (${lotes.length} trabalhador(es) × ${QUADROS} quadro(s))…`)
  const dono = new Map() // tela → índice do trabalhador que a varreu (e que vai fotografá-la)
  const porLote = await Promise.all(lotes.map(async (rotasDoLote, i) => {
    const params = { larguras: LARGURAS.join(','), so: 'problemas', rotas: rotasDoLote.join(','), quadros: String(QUADROS) }
    for (const [k, v] of Object.entries(REPASSAR)) if (v) params[k] = v
    await abrirVarredura(trabalhadores[i], params)
    /** @type {{ rota: string, largura: number, fora: string[], quebradas: string[], erro?: string }[]} */
    const res = await trabalhadores[i].evaluate(() => window.__resultado)
    for (const r of res) dono.set(r.rota, i)
    return res
  }))

  // junta na ordem de sempre: telas fixas na ordem da lista, depois as fichas; larguras na ordem pedida
  const juntos = porLote.flat()
  const aparicao = [...new Set(juntos.map((r) => r.rota))]
  const ordem = (rota) => { const i = fixas.indexOf(rota); return i >= 0 ? i : fixas.length + aparicao.indexOf(rota) }
  const rotas = [...aparicao].sort((a, b) => ordem(a) - ordem(b))
  const resultado = juntos.sort((a, b) => ordem(a.rota) - ordem(b.rota) || LARGURAS.indexOf(a.largura) - LARGURAS.indexOf(b.largura))
  const ruins = resultado.filter(temProblema)

  // relatório no terminal: uma linha por tela, uma coluna por largura
  const larg = (l) => `${l}px`.padStart(7)
  console.log(`\n${'tela'.padEnd(34)}${LARGURAS.map(larg).join('')}`)
  for (const rota of rotas) {
    const cel = LARGURAS.map((l) => {
      const r = resultado.find((x) => x.rota === rota && x.largura === l)
      return (r && temProblema(r) ? (r.erro ? '⚠' : '✗') : '✓').padStart(7)
    })
    console.log(`${rota.slice(0, 33).padEnd(34)}${cel.join('')}`)
  }
  for (const r of ruins) {
    console.log(`\n✗ ${r.rota} @ ${r.largura}px`)
    if (r.erro) console.log(`   ⚠️ não abriu: ${r.erro}`)
    for (const x of r.fora.slice(0, 5)) console.log(`   🔴 sai da tela: ${x}`)
    for (const x of r.quebradas.slice(0, 5)) console.log(`   🟠 palavra quebrada: ${x}`)
  }

  // fotos: cada trabalhador fotografa as telas que ele mesmo varreu, todos ao mesmo tempo
  if (FOTOS) {
    rmSync(SAIDA, { recursive: true, force: true })
    mkdirSync(SAIDA, { recursive: true })
    console.log(`\n▶ fotos de ${rotas.length} tela(s) × ${LARGURAS.length} largura(s), ${trabalhadores.length} por vez…`)
    await Promise.all(trabalhadores.map(async (pagina, i) => {
      for (const rota of rotas.filter((r) => dono.get(r) === i)) {
        for (const largura of LARGURAS) await fotografar(pagina, rota, largura)
      }
    }))
    writeFileSync(join(SAIDA, 'index.html'), paginaFotos(rotas, resultado))
    console.log(`  fotos em ${join(SAIDA, 'index.html')}`)
  }

  console.log(ruins.length ? `\n✗ ${ruins.length} de ${resultado.length} combinações com problema (${seg()})` : `\n✓ ${resultado.length} combinações, todas ok (${seg()})`)
  codigo = ruins.length ? 1 : 0
} catch (e) {
  console.error(`\n✗ a conferência parou: ${e.message}`)
  mkdirSync(SAIDA, { recursive: true })
  const nomeErro = (i) => (paginas.length > 1 ? `erro-${i + 1}.png` : 'erro.png')
  await Promise.all(paginas.map((p, i) => p.screenshot({ path: join(SAIDA, nomeErro(i)) }).catch(() => {})))
  console.error(`  como estava(m) a(s) tela(s): ${join(SAIDA, paginas.length > 1 ? 'erro-*.png' : 'erro.png')}`)
  codigo = 2
} finally {
  await navegador.close()
  await servidor?.close()
}
process.exit(codigo)

async function fotografar(pagina, rota, largura) {
  await pagina.setViewportSize({ width: largura, height: 900 })
  await pagina.goto(`${URL_BASE}/?foto=${Date.now()}#/${rota}`)
  await pagina.evaluate(() => document.fonts?.ready).catch(() => {})
  await pagina.waitForTimeout(1500)
  // janela da altura da página (no máximo 6000 px): a barra fixa de baixo fica no fim, não no meio da foto
  const altura = await pagina.evaluate(() => document.documentElement.scrollHeight)
  await pagina.setViewportSize({ width: largura, height: Math.min(Math.max(altura, 900), 6000) })
  await pagina.waitForTimeout(300)
  await pagina.screenshot({ path: join(SAIDA, arquivo(rota, largura)) })
}

function arquivo(rota, largura) {
  return `${rota.replace(/[^\w-]+/g, '_')}-${largura}.png`
}

function paginaFotos(rotas, resultado) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const linhas = rotas.map((rota) => {
    const fotos = LARGURAS.map((l) => {
      const r = resultado.find((x) => x.rota === rota && x.largura === l)
      const probs = r ? [...(r.erro ? [`⚠️ não abriu: ${r.erro}`] : []), ...r.fora.map((x) => `🔴 ${x}`), ...r.quebradas.map((x) => `🟠 ${x}`)] : []
      return `<figure class="${probs.length ? 'ruim' : ''}"><figcaption>${l}px ${probs.length ? '✗' : '✓'}</figcaption>
        <a href="${arquivo(rota, l)}" target="_blank"><img loading="lazy" src="${arquivo(rota, l)}" style="width:${Math.round(l / 4)}px" alt="${esc(rota)} ${l}px"></a>
        ${probs.length ? `<ul>${probs.slice(0, 6).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</figure>`
    })
    return `<section><h2>${esc(rota)}</h2><div class="fila">${fotos.join('')}</div></section>`
  })
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conferência responsiva</title><style>
:root{--fundo:#f7f6fb;--texto:#1f1b2e;--suave:#6b6780;--ruim:#dc2626;--bom:#15803d}
@media (prefers-color-scheme:dark){:root{--fundo:#15131d;--texto:#ece9f5;--suave:#a19cb5;--ruim:#f87171;--bom:#4ade80}}
body{margin:0;padding:16px;font:14px/1.4 system-ui,sans-serif;background:var(--fundo);color:var(--texto)}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}
.fila{display:flex;gap:16px;align-items:flex-start;overflow-x:auto;padding-bottom:8px}
figure{margin:0;flex:none}figcaption{font-weight:700;color:var(--bom);margin-bottom:4px}
figure.ruim figcaption{color:var(--ruim)}figure.ruim img{outline:3px solid var(--ruim)}
img{display:block;border-radius:6px;max-height:600px;object-fit:cover;object-position:top}
ul{margin:6px 0 0;padding-left:16px;max-width:360px;font-size:12px;color:var(--suave)}
</style></head><body><h1>Conferência responsiva</h1><p>${new Date().toLocaleString('pt-BR')} · larguras ${LARGURAS.join(', ')} px · toque na foto para ver inteira</p>
${linhas.join('\n')}</body></html>`
}