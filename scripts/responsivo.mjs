// RESPONSIVO — confere todas as telas nas larguras padrão, pela linha de comando, sem abrir nada à mão.
// Usa a varredura.html (o mesmo exame: "sai da tela" e "palavra quebrada") num navegador sem janela (o Edge do
// Windows, ou o Chrome; nada é baixado) e, com --fotos, tira uma foto de cada tela × largura e monta uma página só
// com todas lado a lado (.responsivo/index.html) para olhar rápido.
//
//   npm run responsivo                              todas as telas · 375, 768, 1024, 1440
//   npm run responsivo -- --rotas precos/tab-geral,estoque --fotos
//   npm run responsivo -- --larguras 320,360,390    (as do celular)   · --ver mostra o navegador
//
// Servidor: usa o que já estiver em http://127.0.0.1:5174; se não houver, sobe um só para a conferência (e fecha).
// Dados: navegador novo, sem nada salvo → a demonstração nasce do zero e entra no modo de teste como Administrador.
// Nunca toca nos dados do dono (o navegador dele não é usado). Sai com código 1 se achar problema.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
const SAIDA = join(RAIZ, '.responsivo')
const inicio = Date.now()
const seg = () => `${((Date.now() - inicio) / 1000).toFixed(0)} s`

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
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 900 } })
// a "senha de acesso" da demonstração é só uma marca na sessão (src/features/acesso/model/acesso.ts): no servidor
// LOCAL a conferência já entra liberada, sem guardar nem digitar senha. No site publicado continua pedindo.
if (['127.0.0.1', 'localhost'].includes(new URL(URL_BASE).hostname)) {
  await pagina.addInitScript(() => { try { sessionStorage.setItem('tudo:acesso-liberado', '1') } catch { /* sem sessão */ } })
}
let codigo = 0

try {
  // entrar: a demonstração prepara os dados e mostra o modo de teste → toca no Administrador (sem senha)
  console.log('▶ entrando no modo de teste…')
  await pagina.goto(URL_BASE + '/')
  await pagina.getByText('Administrador', { exact: true }).first().click({ timeout: 90_000 })
  await pagina.waitForFunction(() => !document.body.innerText.includes('Entrar no Tudo'), null, { timeout: 30_000 })

  // a varredura
  console.log(`▶ varrendo ${ROTAS || 'todas as telas'} em ${LARGURAS.join(', ')} px…`)
  const q = new URLSearchParams({ larguras: LARGURAS.join(','), so: 'problemas' })
  if (ROTAS) q.set('rotas', ROTAS)
  await pagina.goto(`${URL_BASE}/varredura.html?${q}`)
  await pagina.waitForFunction(() => window.__pronto === true, null, { timeout: 30 * 60_000, polling: 1000 })
  /** @type {{ rota: string, largura: number, fora: string[], quebradas: string[] }[]} */
  const resultado = await pagina.evaluate(() => window.__resultado)
  const ruins = resultado.filter((r) => r.fora.length || r.quebradas.length)

  // relatório no terminal: uma linha por tela, uma coluna por largura
  const rotas = [...new Set(resultado.map((r) => r.rota))]
  const larg = (l) => `${l}px`.padStart(7)
  console.log(`\n${'tela'.padEnd(34)}${LARGURAS.map(larg).join('')}`)
  for (const rota of rotas) {
    const cel = LARGURAS.map((l) => {
      const r = resultado.find((x) => x.rota === rota && x.largura === l)
      return (r && (r.fora.length || r.quebradas.length) ? '✗' : '✓').padStart(7)
    })
    console.log(`${rota.slice(0, 33).padEnd(34)}${cel.join('')}`)
  }
  for (const r of ruins) {
    console.log(`\n✗ ${r.rota} @ ${r.largura}px`)
    for (const x of r.fora.slice(0, 5)) console.log(`   🔴 sai da tela: ${x}`)
    for (const x of r.quebradas.slice(0, 5)) console.log(`   🟠 palavra quebrada: ${x}`)
  }

  // fotos + página de conferência visual
  if (FOTOS) {
    rmSync(SAIDA, { recursive: true, force: true })
    mkdirSync(SAIDA, { recursive: true })
    console.log(`\n▶ fotos de ${rotas.length} tela(s) × ${LARGURAS.length} largura(s)…`)
    for (const rota of rotas) {
      for (const largura of LARGURAS) {
        await pagina.setViewportSize({ width: largura, height: 900 })
        await pagina.goto(`${URL_BASE}/?foto=${Date.now()}#/${rota}`)
        await pagina.waitForTimeout(1500)
        // janela da altura da página (no máximo 6000 px): a barra fixa de baixo fica no fim, não no meio da foto
        const altura = await pagina.evaluate(() => document.documentElement.scrollHeight)
        await pagina.setViewportSize({ width: largura, height: Math.min(Math.max(altura, 900), 6000) })
        await pagina.waitForTimeout(300)
        await pagina.screenshot({ path: join(SAIDA, arquivo(rota, largura)) })
      }
    }
    writeFileSync(join(SAIDA, 'index.html'), paginaFotos(rotas, resultado))
    console.log(`  fotos em ${join(SAIDA, 'index.html')}`)
  }

  console.log(ruins.length ? `\n✗ ${ruins.length} de ${resultado.length} combinações com problema (${seg()})` : `\n✓ ${resultado.length} combinações, todas ok (${seg()})`)
  codigo = ruins.length ? 1 : 0
} catch (e) {
  console.error(`\n✗ a conferência parou: ${e.message}`)
  mkdirSync(SAIDA, { recursive: true })
  await pagina.screenshot({ path: join(SAIDA, 'erro.png') }).catch(() => {})
  console.error(`  como estava a tela: ${join(SAIDA, 'erro.png')}`)
  codigo = 2
} finally {
  await navegador.close()
  await servidor?.close()
}
process.exit(codigo)

function arquivo(rota, largura) {
  return `${rota.replace(/[^\w-]+/g, '_')}-${largura}.png`
}

function paginaFotos(rotas, resultado) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const linhas = rotas.map((rota) => {
    const fotos = LARGURAS.map((l) => {
      const r = resultado.find((x) => x.rota === rota && x.largura === l)
      const probs = r ? [...r.fora.map((x) => `🔴 ${x}`), ...r.quebradas.map((x) => `🟠 ${x}`)] : []
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
