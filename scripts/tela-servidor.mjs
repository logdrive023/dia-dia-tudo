// TELA CONTRA O SERVIDOR (ponta a ponta de verdade: tela → servidor Go → Postgres). Os outros scripts de tela
// (primeiro-acesso, dia-de-trabalho, varredura) continuam no banco do navegador — este NÃO os substitui.
//
// Sozinho: sobe o Postgres do backend (docker, porta 5433), sobe o servidor Go NO DOCKER (127.0.0.1:8090), cria uma
// EMPRESA DE TESTE nova e vazia (cmd/semear — nenhuma outra empresa é tocada), sobe o app em modo API
// (127.0.0.1:5175) e abre um navegador de celular (390 px) que:
//   1. entra com o administrador da empresa de teste
//   2. cadastra uma unidade pela tela e confere NO BANCO que ela foi gravada
//   3. abre cada tela do menu e anota, pelo log do servidor, o que ela pediu: o que já existe e o que falta portar
// No fim derruba o servidor e o app (o Postgres fica no ar). Relatório em node_modules/.cache/tela-servidor/.
//
//   npm run tela-servidor                  todas as telas do menu
//   npm run tela-servidor -- viagens caixa só essas telas
//   --ver  mostra o navegador
//
// Sai com erro só se o caminho de verdade falhar (subir, entrar, gravar a unidade). Tela que pede o que ainda não
// existe no servidor NÃO é erro: vira a lista do que falta portar.
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const VER = args.includes('--ver')
const TELAS_PADRAO = ['painel', 'comprar', 'triagem', 'estoque', 'etiquetas', 'vender', 'caixa', 'agenda', 'viagens', 'livro', 'precos',
  'pessoas', 'equipe', 'emprestimos', 'adiantamentos', 'relatorios', 'auditoria', 'config/unidades']
const TELAS = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : TELAS_PADRAO
const RAIZ = process.cwd()
const BACK = resolve(RAIZ, '..', 'dia-dia-tudo-backend')
const PASTA = join(RAIZ, 'node_modules', '.cache', 'tela-servidor')
// o servidor roda DENTRO DO DOCKER (serviço "go" do docker-compose do backend): lá o Postgres se chama "postgres"
const BANCO = process.env.BANCO_TESTE ?? 'postgres://tudo:tudo@postgres:5432/tudo?sslmode=disable'
const API = 'http://127.0.0.1:8090', APP = 'http://127.0.0.1:5175'
const RODADA = Date.now().toString(36)
const EMPRESA = `teste-${RODADA}`, LOGIN = `t${RODADA}`, SENHA = `Teste-${RODADA}-9`
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
rmSync(PASTA, { recursive: true, force: true })
mkdirSync(PASTA, { recursive: true })

const logServidor = [] // { t, linha }
const filhos = []
const achados = []

/** sobe um processo e guarda a saída (o do servidor vira o log que diz o que cada tela pediu) */
function subir(cmd, argv, opcoes, guardar) {
  const p = spawn(cmd, argv, { ...opcoes, stdio: ['ignore', 'pipe', 'pipe'] })
  const ler = (b) => String(b).split(/\r?\n/).filter(Boolean).forEach((linha) => guardar?.push({ t: Date.now(), linha }))
  p.stdout.on('data', ler)
  p.stderr.on('data', ler)
  filhos.push(p)
  return p
}

async function esperarUrl(url, ms, ok = (s) => s < 500) {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    try { if (ok((await fetch(url)).status)) return } catch { /* ainda subindo */ }
    await esperar(300)
  }
  throw new Error(`não respondeu a tempo: ${url}`)
}

function psql(sql) {
  return execFileSync('docker', ['exec', 'dia-dia-tudo-backend-postgres-1', 'psql', '-U', 'tudo', '-d', 'tudo', '-tAc', sql], { encoding: 'utf8' }).trim()
}

/** o que o servidor respondeu entre dois instantes: nomes ok, que faltam portar e erros internos */
function pedidosEntre(t0, t1) {
  const r = { ok: new Set(), falta: new Set(), recusa: new Set(), erro: new Set() }
  for (const { t, linha } of logServidor) {
    if (t < t0 || t > t1) continue
    const nome = linha.match(/ nome=(\S+)/)?.[1]
    const tipo = linha.match(/ tipo=(\S+)/)?.[1]
    if (!nome) continue
    const chave = `${tipo === 'comando' ? 'cmd' : 'cons'} ${nome}`
    if (/msg=ok/.test(linha)) r.ok.add(chave)
    else if (/Ainda não existe no servidor/.test(linha)) r.falta.add(chave)
    else if (/msg=recusado/.test(linha)) r.recusa.add(`${chave}: ${linha.match(/mensagem="?([^"]*)"?/)?.[1] ?? ''}`)
    else if (/erro interno/.test(linha)) r.erro.add(chave)
  }
  return r
}

let nav, codigo = 0
try {
  // 1. banco + servidor + empresa de teste
  execFileSync('docker', ['compose', 'up', '-d', 'postgres'], { cwd: BACK, stdio: 'ignore' })
  for (let i = 0; i < 60 && !/accepting/.test(execFileSync('docker', ['exec', 'dia-dia-tudo-backend-postgres-1', 'pg_isready', '-U', 'tudo'], { encoding: 'utf8' }).toString()); i++) await esperar(500)
  // Go no Docker (contêiner Linux): o Controle de Aplicativos do Windows não bloqueia nada
  const goDocker = (extra, cmd) => ['compose', 'run', '--rm', ...extra, '-e', `BANCO=${BANCO}`, '-e', 'ADMIN_SENHA=', 'go', 'go', 'run', ...cmd]
  execFileSync('docker', goDocker([], ['./cmd/semear', '-empresa', EMPRESA, '-login', LOGIN, '-senha', SENHA]), { cwd: BACK, stdio: ['ignore', 'ignore', 'inherit'] })
  execFileSync('docker', ['rm', '-f', 'tudo-tela'], { stdio: 'ignore' })
  subir('docker', goDocker(['--name', 'tudo-tela', '-p', '127.0.0.1:8090:8090', '-e', 'ENDERECO=0.0.0.0:8090', '-e', `CORS_ORIGENS=${APP}`], ['./cmd/servidor']), { cwd: BACK }, logServidor)
  await esperarUrl(`${API}/saude`, 120_000, (s) => s === 204)

  // 2. o app em modo API (os outros modos e o .env do app não mudam)
  const vite = join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js')
  subir(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { cwd: RAIZ, env: { ...process.env, VITE_STORAGE: 'api', VITE_API_URL: API } })
  await esperarUrl(APP, 60_000)
  console.log(`no ar: servidor ${API} · app ${APP} · empresa de teste ${EMPRESA}`)

  nav = await chromium.launch({ channel: 'msedge', headless: !VER }).catch(() => chromium.launch({ channel: 'chrome', headless: !VER }))
  const pg = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR', serviceWorkers: 'block' })).newPage()
  const errosTela = []
  pg.on('pageerror', (e) => errosTela.push(`${pg.url().replace(APP, '')} · ${String(e).slice(0, 200)}`))
  await pg.addInitScript(() => sessionStorage.setItem('tudo:acesso-liberado', '1'))

  // 3. entrar
  await pg.goto(`${APP}/`)
  await pg.getByPlaceholder(/sofia/i).fill(LOGIN, { timeout: 60_000 })
  await pg.locator('input[type=password]').first().fill(SENHA)
  await pg.getByRole('button', { name: /^Entrar$/ }).click()
  await pg.waitForFunction(() => !document.body.innerText.includes('Entrar no Tudo'), null, { timeout: 30_000 })
  console.log('✓ entrou com o administrador da empresa de teste')

  // 4. unidade pela tela → no banco
  await pg.goto(`${APP}/#/config/unidades`)
  await pg.getByRole('button', { name: /Unidade \/ endereço/ }).click({ timeout: 30_000 })
  await pg.getByRole('dialog').getByLabel('Nome').fill('Salão Centro (teste)')
  await pg.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
  await pg.getByText('Salão Centro (teste)').first().waitFor({ timeout: 15_000 })
  const noBanco = psql(`SELECT nome FROM locais WHERE empresa_id = '${EMPRESA}'`)
  if (noBanco !== 'Salão Centro (teste)') throw new Error(`a unidade não chegou ao banco (achou: "${noBanco}")`)
  console.log('✓ unidade cadastrada pela tela e gravada no Postgres')

  // 5. cada tela: o que pediu ao servidor
  for (const tela of TELAS) {
    const t0 = Date.now()
    await pg.goto(`${APP}/#/${tela}`)
    await pg.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await esperar(800)
    const r = pedidosEntre(t0, Date.now())
    achados.push({ tela, ok: [...r.ok], falta: [...r.falta], recusa: [...r.recusa], erro: [...r.erro] })
    const sinal = r.erro.size ? '✗' : r.falta.size ? '◌' : '✓'
    console.log(`${sinal} ${tela}: ${r.ok.size} ok${r.falta.size ? ` · falta portar: ${[...r.falta].map((x) => x.split(' ')[1]).join(', ')}` : ''}${r.erro.size ? ` · ERRO INTERNO: ${[...r.erro].join(', ')}` : ''}`)
    if (r.erro.size) codigo = 1
  }
  for (const e of errosTela) console.log(`   tela: ${e}`)
} catch (e) {
  codigo = 1
  console.log(`✗ ${String(e?.message ?? e).split('\n')[0]}`)
} finally {
  await nav?.close().catch(() => {})
  for (const p of filhos) p.kill()
  try { execFileSync('docker', ['rm', '-f', 'tudo-tela'], { stdio: 'ignore' }) } catch { /* já parou */ }
}

// relatório: por tela e a lista única do que falta portar (a fila de trabalho do servidor)
const faltaTudo = [...new Set(achados.flatMap((a) => a.falta))].sort()
writeFileSync(join(PASTA, 'relatorio.json'), JSON.stringify({ empresa: EMPRESA, achados, faltaTudo }, null, 2))
writeFileSync(join(PASTA, 'relatorio.md'), [
  `# Telas contra o servidor (${new Date().toLocaleString('pt-BR')})`, '',
  `Empresa de teste \`${EMPRESA}\` · servidor ${API} · app ${APP} (modo API) · Postgres ${BANCO.replace(/\/\/[^@]*@/, '//')}`, '',
  '| Tela | Já funciona | Falta portar | Erro interno |', '|---|---|---|---|',
  ...achados.map((a) => `| ${a.tela} | ${a.ok.length} | ${a.falta.map((x) => x.split(' ')[1]).join(', ') || '—'} | ${a.erro.join(', ') || '—'} |`), '',
  `## Falta portar (${faltaTudo.length} nomes pedidos pelas telas)`, '', ...faltaTudo.map((x) => `- ${x}`), '',
  ...(achados.some((a) => a.recusa.length) ? ['## Outras recusas', '', ...achados.flatMap((a) => a.recusa.map((x) => `- ${a.tela}: ${x}`)), ''] : []),
].join('\n'))
console.log(`\n${codigo ? '✗ o caminho de verdade falhou' : '✓ tela → servidor → banco funcionando'} · ${faltaTudo.length} nome(s) ainda faltam no servidor · relatório em ${PASTA}`)
process.exit(codigo)
