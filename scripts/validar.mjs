#!/usr/bin/env node
// VALIDAÇÃO PROPORCIONAL AO RISCO — confere só o que a mudança pode ter quebrado (política no CLAUDE.md).
//
//   npm run validar            → olha o que mudou no git, escolhe o nível e roda
//   npm run validar:plano      → só mostra o plano (arquivos, nível, por quê, testes), sem rodar
//   npm run validar:tudo       → nível 3 (antes de commit/entrega)
//   node scripts/validar.mjs --nivel 2 src/shared/ui/base.tsx   → nível e arquivos à mão
//
// NÍVEIS
//   0  só documentação (.md, imagens): nada a conferir
//   1  rápido: textos/estilo (es.ts, .css) e telas sem teste direto → tipos (tsc -b, com cache)
//   2  intermediário: o resto → tipos + os testes que IMPORTAM o arquivo mudado (pelo grafo de imports, sem passar
//      pelo app/App.tsx). Os testes "do app inteiro" (que montam o App) ficam para o nível 3.
//   3  completo: núcleo, contrato, persistência, login/permissões, rotas, configuração do projeto, arquivo com muitos
//      dependentes, ou caminho desconhecido → tipos + a suíte inteira + o build de produção (vite build; os tipos já
//      foram conferidos, não repete o tsc do "npm run build").
// Tudo em sequência (o Vitest usa 6 processos; rodar junto com o tsc só disputaria a CPU).
// Passou e nada mudou desde então (mesmo conteúdo, mesmo nível ou menor) → não roda de novo.

import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve, sep } from 'node:path'

const RAIZ = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
process.chdir(RAIZ)
const CACHE = join('node_modules', '.cache', 'validar')
const args = process.argv.slice(2)
const so = (f) => args.includes(f)
const valorDe = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined }
const nivelForcado = valorDe('--nivel') ? Number(valorDe('--nivel')) : undefined
const posicionais = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--nivel')
const barra = (p) => p.split(sep).join('/')

// ---------- 1. o que mudou ----------
function mudados() {
  if (posicionais.length) return posicionais.map((p) => barra(normalize(p)))
  const git = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').map((s) => s.trim()).filter(Boolean)
  const lista = [...git('git diff --name-only HEAD'), ...git('git ls-files --others --exclude-standard')]
  return [...new Set(lista)].filter((p) => existsSync(p))
}

// ---------- 2. grafo de imports (só valor: "import type" não roda em teste) ----------
const EXT = ['.ts', '.tsx', '/index.ts', '/index.tsx']
function arquivosTs(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') arquivosTs(p, acc) } else if (/\.(ts|tsx)$/.test(n)) acc.push(barra(p))
  }
  return acc
}
const TODOS = [...arquivosTs('src'), ...(existsSync('caos') ? arquivosTs('caos') : [])]
const existe = new Set(TODOS)
function resolver(de, alvo) {
  const base = barra(normalize(join(dirname(de), alvo)))
  if (existe.has(base)) return base
  for (const e of EXT) if (existe.has(base + e)) return base + e
  return undefined
}
const APP = 'src/app/App.tsx'
const importa = new Map() // arquivo → arquivos que ele importa (valor)
for (const a of TODOS) {
  const s = readFileSync(a, 'utf8')
  const deps = new Set()
  for (const m of s.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm)) {
    if (m[1]) continue
    const r = resolver(a, m[2])
    if (r) deps.add(r)
  }
  importa.set(a, deps)
}
const dependentes = new Map() // arquivo → quem importa ele (direto)
for (const [a, ds] of importa) for (const d of ds) (dependentes.get(d) ?? dependentes.set(d, new Set()).get(d)).add(a)
/** quem depende de `arq` (transitivo), sem atravessar o app/App.tsx (o App liga todas as telas) */
function quemDepende(arq) {
  const vistos = new Set(); const fila = [arq]
  while (fila.length) {
    const x = fila.pop()
    for (const d of dependentes.get(x) ?? []) {
      if (vistos.has(d)) continue
      vistos.add(d)
      if (d !== APP) fila.push(d)
    }
  }
  return vistos
}
const ehTeste = (p) => /\.test\.tsx?$/.test(p)
const ehTesteCaos = (p) => p.startsWith('caos/')
const TESTES_APP = new Set(TODOS.filter((t) => ehTeste(t) && importa.get(t)?.has(APP)))

// ---------- 3. risco de cada arquivo ----------
const CENTRAIS = [
  [/^src\/core\/services\/(index|contexto|visibilidade|usuarios|auditoria)\.ts$/, 'serviço central (contrato, contexto, permissões, login, auditoria)'],
  [/^src\/core\/(domain|ports|seguranca|modulos|areas|dados)/, 'núcleo (domínio, portas, segurança, áreas de negócio)'],
  [/^src\/adapters\//, 'persistência / integração (adaptadores)'],
  [/^src\/app\//, 'app (App, menu, backend: liga todas as telas)'],
  [/^src\/shared\/(ui\/(contexto|i18n)\.tsx?$|navegacao\/)/, 'infraestrutura de tela (contexto, idioma, rotas)'],
  [/^src\/features\/[a-z]+\/index\.ts$/, 'contrato público de um domínio (index.ts)'],
  [/^src\/(main\.tsx|index\.css)$/, 'entrada do app / estilo global'],
  [/^(package(-lock)?\.json|tsconfig.*\.json|vite\.config\.ts|vitest.*\.ts|index\.html|postcss\.config\.js|tailwind\.config\.js)$/, 'configuração do projeto'],
  [/^\.github\//, 'publicação (deploy)'],
  [/^public\//, 'arquivos publicados (PWA)'],
  [/^api-contract\//, 'contrato da API'],
]
const MUITOS_DEPENDENTES = 25
function risco(p) {
  if (/\.(md|png|jpe?g|svg|webp)$/i.test(p) && !p.startsWith('public/')) return { nivel: 0, porque: 'documentação' }
  if (p.startsWith('scripts/')) return { nivel: 1, porque: 'script de apoio' }
  for (const [re, porque] of CENTRAIS) if (re.test(p)) return { nivel: 3, porque }
  if (/\.css$/.test(p)) return { nivel: 2, porque: 'estilo global (afeta todas as telas)' }
  if (p === 'src/shared/ui/es.ts') return { nivel: 1, porque: 'tradução (texto)' }
  if (ehTesteCaos(p)) return { nivel: 2, porque: 'teste da Operação Caos' }
  if (ehTeste(p)) return { nivel: 2, porque: 'teste' }
  if (!existe.has(p)) return { nivel: 3, porque: 'caminho desconhecido (na dúvida, completo)' }
  const deps = [...quemDepende(p)].filter((d) => !ehTeste(d))
  if (deps.length >= MUITOS_DEPENDENTES) return { nivel: 3, porque: `peça compartilhada (${deps.length} arquivos dependem dela)` }
  if (p.startsWith('src/core/services/')) return { nivel: 2, porque: 'serviço (regra de negócio)' }
  const testes = [...quemDepende(p)].filter((d) => ehTeste(d) && !TESTES_APP.has(d))
  if (!testes.length) return { nivel: 1, porque: 'tela/peça sem teste direto (os testes do app inteiro ficam no nível 3)' }
  return { nivel: 2, porque: `tela/peça com ${testes.length} teste(s) direto(s)` }
}

// ---------- 4. plano ----------
const lista = mudados().filter((p) => !p.startsWith('node_modules/') && !p.startsWith('dist/'))
const avaliados = lista.map((p) => ({ p, ...risco(p) }))
let nivel = nivelForcado ?? Math.max(0, ...avaliados.map((a) => a.nivel))
const testesDiretos = [...new Set(avaliados.filter((a) => a.nivel >= 1 && existe.has(a.p)).flatMap((a) => [
  ...(ehTeste(a.p) ? [a.p] : []),
  ...[...quemDepende(a.p)].filter((d) => ehTeste(d) && !TESTES_APP.has(d)),
]))]
const testesNormais = testesDiretos.filter((t) => !ehTesteCaos(t))
// Operação Caos: pesada (~5 min) e com 1 reprovação conhecida de propósito (CAOS-D-05, desempenho — caos/RELATORIO.md).
// Roda só quando um arquivo de caos/ mudou ou com --caos; o plano avisa quando vale rodar.
const caosLigados = so('--caos')
const testesCaosRelacionados = testesDiretos.filter(ehTesteCaos)
const testesCaos = caosLigados ? testesCaosRelacionados : testesCaosRelacionados.filter((t) => lista.includes(t))

const passos = []
if (nivel >= 1) passos.push({ nome: 'tipos (tsc -b)', cmd: 'npx tsc -b' })
if (nivel === 2 && testesNormais.length) passos.push({ nome: `testes diretos (${testesNormais.length})`, cmd: `npx vitest run ${testesNormais.join(' ')}` })
if (nivel >= 2 && testesCaos.length) passos.push({ nome: `Operação Caos (${testesCaos.length})`, cmd: `npx vitest run --config vitest.caos.config.ts ${testesCaos.join(' ')}` })
if (nivel >= 3) passos.push({ nome: 'suíte inteira (vitest run)', cmd: 'npx vitest run' })
if (nivel >= 3) passos.push({ nome: 'build de produção (vite build)', cmd: 'npx vite build' })

// impressão digital: o conteúdo dos arquivos mudados + o commit atual
const head = (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } })()
const digital = createHash('sha256').update(head).update(lista.map((p) => p + ':' + createHash('sha256').update(readFileSync(p)).digest('hex')).join('\n')).digest('hex')

console.log(`\nVALIDAR — ${lista.length} arquivo(s) mudado(s) → NÍVEL ${nivel}${nivelForcado !== undefined ? ' (pedido)' : ''}`)
// muitos arquivos: mostra os que decidiram o nível e resume o resto por motivo (com --todos, lista tudo)
const ordenados = avaliados.sort((x, y) => y.nivel - x.nivel)
const mostrar = so('--todos') || ordenados.length <= 15 ? ordenados : ordenados.filter((a) => a.nivel === nivel).slice(0, 10)
for (const a of mostrar) console.log(`  [${a.nivel}] ${a.p} — ${a.porque}`)
if (mostrar.length < ordenados.length) {
  const resto = new Map()
  for (const a of ordenados.filter((x) => !mostrar.includes(x))) resto.set(`[${a.nivel}] ${a.porque}`, (resto.get(`[${a.nivel}] ${a.porque}`) ?? 0) + 1)
  for (const [k, n] of resto) console.log(`  … ${n} × ${k}`)
  console.log('  (lista completa: --todos)')
}
if (nivel === 2) console.log(`  testes diretos: ${testesNormais.length ? testesNormais.join(', ') : 'nenhum'}`)
if (testesCaosRelacionados.length > testesCaos.length)
  console.log(`  Operação Caos: ${testesCaosRelacionados.length} bateria(s) tocam nisso — rode com --caos (ou npm run test:caos) se mexeu em estoque, caixa, vendas, compras ou concorrência`)
console.log(`  passos: ${passos.length ? passos.map((x) => x.nome).join(' → ') : 'nenhum'}`)
if (so('--plano')) process.exit(0)

mkdirSync(CACHE, { recursive: true })
const arqUltimo = join(CACHE, 'ultimo.json')
const ultimo = existsSync(arqUltimo) ? JSON.parse(readFileSync(arqUltimo, 'utf8')) : undefined
if (!so('--forcar') && ultimo && ultimo.ok && ultimo.digital === digital && ultimo.nivel >= nivel) {
  console.log(`\n✓ já validado no nível ${ultimo.nivel} em ${ultimo.quando} e nada mudou desde então (use --forcar para repetir).\n`)
  process.exit(0)
}

// ---------- 5. rodar (em sequência; para no primeiro que falhar) ----------
const resultados = []
let ok = true
for (const passo of passos) {
  console.log(`\n▶ ${passo.nome}`)
  const ini = Date.now()
  const r = spawnSync(passo.cmd, { stdio: 'inherit', shell: true })
  const s = ((Date.now() - ini) / 1000).toFixed(1)
  resultados.push({ passo: passo.nome, ok: r.status === 0, segundos: Number(s) })
  if (r.status !== 0) { ok = false; console.log(`✗ ${passo.nome} falhou (${s} s)`); break }
  console.log(`✓ ${passo.nome} (${s} s)`)
}
const total = resultados.reduce((s, r) => s + r.segundos, 0).toFixed(1)
const registro = { quando: new Date().toISOString(), nivel, ok, digital, arquivos: lista, resultados }
writeFileSync(arqUltimo, JSON.stringify(registro, null, 2))
appendFileSync(join(CACHE, 'historico.log'), `${registro.quando} nível ${nivel} ${ok ? 'OK' : 'FALHOU'} ${total}s ${resultados.map((r) => `${r.passo}=${r.segundos}s${r.ok ? '' : '✗'}`).join(' ')}\n`)
console.log(`\n${ok ? '✓ VALIDADO' : '✗ FALHOU'} — nível ${nivel}, ${total} s${nivel < 3 ? ' (antes de commit/entrega: npm run validar:tudo)' : ''}\n`)
process.exit(ok ? 0 : 1)
