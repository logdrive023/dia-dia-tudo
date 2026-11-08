// PRIMEIRO ACESSO, DEVAGAR: um navegador de verdade (Edge/Chrome do Windows, nada é baixado) faz o caminho de quem
// nunca usou o sistema — banco zerado (Modo teste › Começar do zero), só o admin — com uma pausa entre as ações:
//   1 viagem "SP - Lote Inicial #001" · 2 compra ligada à viagem · 3 triagem · 4 estoque · 5 venda (valor errado)
//   6 cancelar a venda (motivo) · 7 venda certa · 8 auditoria e caixa
// Em cada passo: o tempo, as CHECAGENS de tela (dica ⓘ à vista, aviso de feito, saldo, caixa…) e uma foto.
// No fim: relatório em node_modules/.cache/primeiro-acesso/relatorio.md (+ fotos). Sai com erro se algo falhar.
//
//   npm run primeiro-acesso              2 s entre as ações (como uma pessoa)
//   npm run primeiro-acesso -- 300       rápido (para conferir depois de mudar uma tela)
//   npm run primeiro-acesso -- 2000 --ver   mostra o navegador
//
// Precisa do servidor de desenvolvimento no ar (npm run dev, em http://127.0.0.1:5174). Os dados de exemplo do dono
// (localhost) não são tocados: o navegador é novo e usa 127.0.0.1.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const LENTO = Number(args.find((a) => /^\d+$/.test(a)) ?? 2000)
const VER = args.includes('--ver')
const URL_BASE = process.env.URL_APP ?? 'http://127.0.0.1:5174'
const PASTA = join(process.cwd(), 'node_modules', '.cache', 'primeiro-acesso')
mkdirSync(PASTA, { recursive: true })

const passos = []
let semViagemPorPadrao = false
let dicasViagem = 0
let camposSemNome = 0
let perdaMostrada = ''
let vendaErrada = ''
let listaVendas = ''
let caixaTexto = ''
let auditoriaTexto = ''
const nav = await chromium.launch({ channel: 'msedge', headless: !VER }).catch(() => chromium.launch({ channel: 'chrome', headless: !VER }))
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'pt-BR' })
const pg = await ctx.newPage()
const errosConsole = []
pg.on('pageerror', (e) => errosConsole.push(String(e)))
pg.on('console', (m) => m.type() === 'error' && errosConsole.push(`${pg.url().replace(URL_BASE, '')} · ${m.text().replace(/%s/g, '').slice(0, 300)} ${m.args().length > 3 ? '' : ''}`))
await pg.addInitScript(() => {
  sessionStorage.setItem('tudo:acesso-liberado', '1')
  localStorage.setItem('tudo:simular-api-ms', '0')
})

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = async () => (await pg.locator('body').innerText()).replace(/\s+/g, ' ')
const aviso = async (re, ms = 15000) => (await pg.getByText(re).first().textContent({ timeout: ms })).trim()
const ir = async (rota) => { await pg.goto(`${URL_BASE}/#/${rota}`); await pg.waitForLoadState('domcontentloaded') }
/** HTML inválido que confunde o leitor de tela: <button> dentro de <button> (diz qual) */
const semBotaoDentroDeBotao = async () => {
  const achados = await pg.evaluate(() => [...document.querySelectorAll('button button')].map((b) => `"${b.innerText.trim().slice(0, 30)}" dentro de "${b.parentElement.closest('button').innerText.trim().replace(/s+/g, ' ').slice(0, 50)}"`))
  return chec('Sem botão dentro de botão', !achados.length, achados.join(' · '))
}
const dicasNaTela = () => pg.getByRole('button', { name: 'Explicação' }).count()

/** um passo: pausa (como uma pessoa), faz, confere e fotografa. Checagem que falha vira "achado", não para o resto. */
async function passo(n, titulo, fazer, conferir = async () => []) {
  await esperar(LENTO)
  const t0 = Date.now()
  const p = { n, titulo, ms: 0, ok: true, checagens: [], erro: '' }
  try {
    await fazer()
    p.ms = Date.now() - t0
    for (const c of await conferir()) p.checagens.push(c)
  } catch (e) {
    p.ok = false
    p.erro = String(e?.message ?? e).split('\n')[0]
  }
  // ERRO reprova o passo; FRICÇÃO (uso que poderia ser mais fácil) só fica anotada no relatório
  if (p.checagens.some((c) => !c.ok && !c.friccao)) p.ok = false
  await pg.screenshot({ path: join(PASTA, `${String(n).padStart(2, '0')}.png`), fullPage: true }).catch(() => {})
  passos.push(p)
  console.log(`${p.ok ? '✓' : '✗'} ${n}. ${titulo} (${p.ms} ms)${p.erro ? `\n   ERRO: ${p.erro}` : ''}`)
  for (const c of p.checagens) console.log(`   ${c.ok ? '·' : c.friccao ? '◌ fricção:' : '⚠'} ${c.o}${c.detalhe ? ` — ${c.detalhe}` : ''}`)
  return p.ok
}
const chec = (o, ok, detalhe = '', friccao = false) => ({ o, ok: !!ok, detalhe, friccao })

// ---------- 0. primeiro acesso: banco zerado, só o admin ----------
await passo(0, 'Primeiro acesso: entrar e zerar os dados (Modo teste › Começar do zero)', async () => {
  await pg.goto(`${URL_BASE}/`)
  await pg.getByText('Administrador', { exact: true }).first().click({ timeout: 180_000 })
  await pg.waitForFunction(() => !document.body.innerText.includes('Entrar no Tudo'))
  await ir('config/teste')
  await pg.getByRole('radio', { name: /Começar do zero/ }).click({ timeout: 30_000 })
  await pg.getByRole('button', { name: /Carregar cenário/ }).click()
  await pg.getByRole('dialog').getByRole('button', { name: 'Sim, carregar' }).click()
  await aviso(/Cenário “.*” carregado/, 60_000)
})

// ---------- 1. cadastrar a viagem ----------
await passo(1, 'Cadastrar a viagem "SP - Lote Inicial #001" (sem equipe cadastrada ainda)', async () => {
  await ir('viagens')
  await pg.getByRole('button', { name: /Criar a primeira viagem/ }).click({ timeout: 15000 })
  dicasViagem = await dicasNaTela()
  await pg.getByPlaceholder('Ex.: Feira de Oruro · novembro').fill('SP - Lote Inicial #001')
  await pg.getByRole('radio', { name: 'Não' }).first().click()
  await pg.getByPlaceholder('Ex.: Lima, Peru').fill('São Paulo, Brasil')
  await pg.getByRole('button', { name: /Próximo: Quem vai/ }).click()
  // ninguém cadastrado: cadastra quem vai ali mesmo
  await pg.getByLabel('Adicionar quem vai').fill('Paula')
  await pg.getByRole('button', { name: /Nova pessoa da equipe: Paula/ }).or(pg.getByRole('option', { name: /Nova pessoa da equipe/ })).first().click()
  await aviso(/Paula cadastrad/)
  await pg.getByRole('button', { name: /Próximo: Quanto pode gastar/ }).click()
  await pg.getByRole('button', { name: /Próximo/ }).first().click().catch(() => {})
  const salvar = pg.locator('button:not([disabled])', { hasText: /Salvar|Criar|Registrar|Começar/ }).last()
  console.log('   (botão final: ' + (await salvar.innerText().catch(() => '?')).trim() + ')')
  await salvar.click()
}, async () => {
  const feito = await aviso(/Viagem criada/).catch(() => '')
  await pg.getByText(/Aberta|Em viagem/).first().waitFor({ timeout: 10000 }).catch(() => {})
  const tx = await texto()
  return [
    chec('Aviso de feito na hora', feito, feito),
    chec('Viagem criada e aberta (Em viagem/Aberta)', /Em viagem|Aberta/.test(tx), tx.match(/VG-\d+[^·]{0,20}/)?.[0]),
    chec('A 1ª etapa do formulário tem dicas ⓘ (cada etapa tem a sua)', dicasViagem >= 2, `${dicasViagem} dica(s) à vista`),
    chec('Tela não travou (sem erro no console)', !errosConsole.length, errosConsole.slice(-1)[0]),
  ]
})

// ---------- 2. compra ligada à viagem ----------
await passo(2, 'Registrar a compra (5 kg bruto, Bs 2.000) e ligar à viagem', async () => {
  await ir('pedidos/novo')
  await pg.getByPlaceholder('Buscar pelo nome ou sigla…').fill('Fornecedora SP')
  await pg.getByRole('button', { name: /Novo fornecedor: Fornecedora SP/ }).or(pg.getByRole('option', { name: /Novo fornecedor/ })).first().click()
  await aviso(/Fornecedora SP cadastrad/)
  await pg.getByRole('button', { name: /Próximo: Itens da compra/ }).click({ timeout: 2000 }).catch(() => {}) // às vezes já avançou sozinho
  await pg.getByLabel(/^Peso/).first().fill('5000')
  await pg.getByLabel(/^Valor total/).first().fill('2000')
  // com 1 viagem aberta, a compra já vem ligada a ela? (o resumo de "Detalhes" diz "✈️ sem viagem" quando não)
  semViagemPorPadrao = /sem viagem/i.test(await texto())
  await pg.getByRole('button', { name: /Próximo: Detalhes/ }).click()
  if (semViagemPorPadrao) {
    await pg.getByRole('button', { name: '+ Viagem' }).click()
    await pg.locator('select', { hasText: 'SP - Lote Inicial' }).selectOption({ index: 1 })
  }
  await pg.getByRole('button', { name: /Registrar pedido/ }).click()
}, async () => {
  const feito = await aviso(/Compra P-\d+ registrada/).catch(() => '')
  await pg.getByText(/SP - Lote Inicial/).first().waitFor({ timeout: 10000 }).catch(() => {})
  const tx = await texto()
  return [
    chec('Aviso de feito na hora', feito, feito),
    chec('O pedido mostra a viagem ligada', /SP - Lote Inicial/.test(tx)),
    chec('Com 1 viagem aberta, a compra já vem ligada a ela', !semViagemPorPadrao, semViagemPorPadrao ? 'veio "sem viagem": precisou abrir "+ Viagem" e escolher (o pedido oferece "Ligar a uma viagem" depois)' : '', true),
    chec('O cabelo bruto entrou esperando a triagem', /Aguardando|Para separar|triagem/i.test(tx)),
    await semBotaoDentroDeBotao(),
  ]
})

// ---------- 3. triagem: separar o lote da viagem ----------
await passo(3, 'Triagem: separar o pacote em A 3 kg (60 cm) + B 1,9 kg (50 cm) — perda 100 g', async () => {
  await ir('triagem')
  await pg.getByRole('button', { name: /Separar L-/ }).first().click({ timeout: 15000 })
  camposSemNome = await pg.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((e) => e.offsetParent && !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).length)
  const pesos = pg.getByPlaceholder('Ex.: 500')
  await pesos.nth(0).fill('3000')
  await pg.getByLabel(/^Medida/).nth(0).fill('60')
  await pg.getByRole('button', { name: /Outra parte/ }).click()
  await pesos.nth(1).fill('1900')
  await pg.getByLabel(/^Medida/).nth(1).fill('50')
  perdaMostrada = (await texto()).match(/perda [\d.,]+ ?k?g[^)]*\)?/i)?.[0] ?? ''
  await pg.getByRole('button', { name: /✂️ Separar/ }).click()
}, async () => {
  const feito = await aviso(/Triagem feita|separad/i).catch(() => '')
  return [
    chec('Todo campo da separação tem nome (rótulo ligado ao campo)', camposSemNome === 0, `${camposSemNome} sem nome`),
    chec('A perda aparece antes de confirmar', /100 g/.test(perdaMostrada), perdaMostrada),
    chec('Aviso de feito na hora (toast)', feito, feito),
  ]
})

// ---------- 4. o estoque já mostra os pacotes ----------
await passo(4, 'Estoque: os 2 pacotes novos com o saldo certo', async () => {
  await ir('estoque')
  await pg.getByText(/1,9 kg|1.900 g/).first().waitFor({ timeout: 15000 })
}, async () => {
  const tx = await texto()
  return [
    chec('Pacote de 3 kg à vista', /\b3 kg\b/.test(tx)),
    chec('Pacote de 1,9 kg à vista', /1,9 kg/.test(tx)),
    chec('Total em estoque 4,9 kg', /4,9 kg/.test(tx), tx.match(/[\d,]+ kg/g)?.slice(0, 4).join(' · ')),
  ]
})

/** venda rápida (modo caixa) de 1 kg do pacote L-0002, com o preço digitado (sem tabela de preço no 1º acesso) */
async function venderUmQuilo(preco) {
  await ir('venda-rapida')
  await pg.getByLabel('Ler ou buscar pacote').fill('L-0002')
  await esperar(500)
  await pg.keyboard.press('Enter')
  await pg.getByRole('button', { name: 'Mudar a quantidade de L-0002' }).click()
  const janela = pg.getByRole('dialog')
  await janela.locator('input').first().fill('1000')
  await janela.getByRole('button', { name: 'OK' }).click()
  await pg.getByLabel('Preço de L-0002').fill(preco)
  await pg.getByRole('button', { name: 'FECHAR' }).click()
  await pg.getByRole('dialog').getByRole('button', { name: /Dinheiro/ }).click()
  await pg.getByRole('dialog').getByRole('button', { name: /Valor exato/ }).click()
  await esperar(800)
  // o aviso que apareceu (toast) — o primeiro texto curto com "venda" fora da tela de fundo
  return (await pg.locator('[role="status"], [aria-live]').allInnerTexts()).map((x) => x.trim()).filter((x) => /venda|V-\d/i.test(x) && x.length < 160).join(' · ')
}
/** o saldo do pacote L-0002 na ficha do estoque */
async function saldoL0002() {
  await ir('estoque')
  await pg.getByLabel(/Buscar|Código/).first().fill('L-0002').catch(() => {})
  await esperar(600)
  const tx = await texto()
  // a linha do pacote: "60 cm · Normal 2 kg Fornecedora SP · ✂ de L-0001 de 3 kg L-0002"
  const g = tx.match(/60 cm · Normal (\d[\d.,]* ?k?g)[^]*?L-0002/)?.[1]
  if (!g) console.log(`   [estoque] ${tx.slice(0, 1500)}`)
  return g ?? '?'
}

await passo(5, 'Venda rápida: 1 kg do pacote de 3 kg por Bs 900 (valor digitado ERRADO)', async () => {
  vendaErrada = await venderUmQuilo('900')
}, async () => [
  chec('Aviso de venda feita na hora', vendaErrada, vendaErrada),
  chec('Baixa no estoque na hora: L-0002 fica com 2 kg', /^2 kg/.test(await saldoL0002()), await saldoL0002()),
])

// ---------- 6. cancelar a venda errada (com motivo) ----------
let motivoObrigatorio = false
let avisoCancelar = ''
await passo(6, 'Cancelar a venda V-0001 (valor errado): motivo, estorno do caixa e o pacote volta', async () => {
  await ir('vender')
  await pg.getByText(/V-0001/).first().click()
  await pg.getByRole('button', { name: /Abrir venda/ }).first().click()
  await pg.getByRole('button', { name: /Mais ações|⋯/ }).first().click()
  await pg.getByRole('button', { name: /Cancelar venda/ }).or(pg.getByRole('menuitem', { name: /Cancelar venda/ })).first().click()
  const dlg = pg.getByRole('dialog')
  const confirmar = dlg.getByRole('button', { name: /Cancelar venda|Sim|Confirmar/ }).last()
  motivoObrigatorio = await confirmar.isDisabled()
  console.log(`   [janela] ${(await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 600)}`)
  await dlg.locator('input,textarea').first().fill('valor digitado errado (era Bs 600)')
  await confirmar.click()
  avisoCancelar = await aviso(/cancelad/i).catch(() => '')
}, async () => {
  const tx = await texto()
  const saldo = await saldoL0002()
  return [
    chec('A janela exige o motivo (botão apagado sem motivo)', motivoObrigatorio),
    chec('Aviso de cancelada na hora', avisoCancelar, avisoCancelar),
    chec('A venda mostra "Cancelada"', /Cancelad/.test(tx)),
    chec('O pacote volta EXATAMENTE: L-0002 com 3 kg', /^3 kg/.test(saldo), saldo),
  ]
})

// ---------- 7. refazer a venda certa ----------
let vendaCerta = ''
await passo(7, 'Refazer a venda certa: 1 kg por Bs 600', async () => {
  vendaCerta = await venderUmQuilo('600')
}, async () => {
  const saldo = await saldoL0002()
  return [
    chec('Aviso de venda feita na hora', vendaCerta, vendaCerta),
    chec('Baixa no estoque: L-0002 com 2 kg (sem contar duas vezes)', /^2 kg/.test(saldo), saldo),
  ]
})

// ---------- 8. vendas, caixa e auditoria contam a história certa ----------
await passo(8, 'Conferir: lista de vendas, caixa do dia e auditoria (venda → cancelamento/estorno → nova venda)', async () => {
  await ir('vender')
  await esperar(600)
  listaVendas = await texto()
  await ir('caixa')
  await esperar(800)
  caixaTexto = await texto()
  await ir('auditoria')
  await esperar(800)
  auditoriaTexto = await texto()
}, async () => {
  const v = listaVendas.match(/Vendido (Bs [\d.,]+)/)?.[1] ?? '?'
  const posVenda = auditoriaTexto.search(/V-0001[^]*?(Venda|vend)/i)
  return [
    chec('Vendido no dia = Bs 600 (a cancelada não conta)', v === 'Bs 600,00', v),
    chec('A cancelada aparece em "Canceladas 1"', /Canceladas 1/.test(listaVendas)),
    chec('Caixa mostra a venda, o estorno e a venda certa', /estorn|cancelad/i.test(caixaTexto) && /600,00/.test(caixaTexto), (caixaTexto.match(/[^.]{0,40}(estorn|cancelad)[^.]{0,60}/i) ?? [''])[0]),
    chec('Auditoria registra o cancelamento com o motivo', /valor digitado errado/.test(auditoriaTexto) && posVenda >= 0),
    chec('Sem erro no console em todo o caminho', !errosConsole.length, errosConsole.slice(-1)[0]),
  ]
})

// --explorar <rota>: depois dos passos, mostra o texto e os campos de uma tela (para escrever o próximo passo)
if (args.includes('--explorar')) {
  const rota = args[args.indexOf('--explorar') + 1]
  await ir(rota)
  await esperar(1500)
  console.log(`==== ${rota}\n${(await pg.locator('body').innerText()).slice(0, 2500)}`)
  const campos = await pg.evaluate(() => [...document.querySelectorAll('input,select,textarea,button,[role=combobox]')].filter((e) => e.offsetParent)
    .map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('aria-label') ?? ''}|${e.getAttribute('placeholder') ?? ''}|${e.getAttribute('role') ?? ''}|${(e.innerText ?? '').slice(0, 25).replace(/\s+/g, ' ')}]`).join(' '))
  console.log(`-- campos: ${campos.slice(0, 3000)}`)
  await pg.screenshot({ path: join(PASTA, 'explorar.png'), fullPage: true })
}
await nav.close()
for (const e of errosConsole) console.log(`   console: ${e}`)
const falhas = passos.filter((p) => !p.ok)
writeFileSync(join(PASTA, 'relatorio.json'), JSON.stringify({ lento: LENTO, passos, console: errosConsole }, null, 2))
// RELATÓRIO legível: cada passo com o tempo, as checagens (✓ / ⚠ erro / ◌ fricção) e a foto
const linhasMd = [
  `# Primeiro acesso, devagar (${new Date().toLocaleString('pt-BR')})`,
  '',
  `Pausa entre as ações: ${LENTO} ms · navegador novo, banco zerado (Modo teste › Começar do zero), tela de celular (390 px).`,
  '',
  '| Passo | Tempo | Resultado |',
  '|---|---|---|',
  ...passos.map((x) => `| ${x.n}. ${x.titulo} | ${x.ms} ms | ${x.ok ? '✓' : '✗'}${x.erro ? ` ${x.erro}` : ''} |`),
  '',
  ...passos.flatMap((x) => [`## ${x.n}. ${x.titulo}`, '', ...x.checagens.map((c) => `- ${c.ok ? '✓' : c.friccao ? '◌ fricção:' : '⚠'} ${c.o}${c.detalhe ? ` — ${c.detalhe}` : ''}`), '', `![passo ${x.n}](${String(x.n).padStart(2, '0')}.png)`, '']),
  ...(errosConsole.length ? ['## Erros no console', '', ...errosConsole.map((e) => `- ${e}`), ''] : []),
]
writeFileSync(join(PASTA, 'relatorio.md'), linhasMd.join('\n'))
console.log(`\n${falhas.length ? `✗ ${falhas.length} passo(s) com problema` : '✓ caminho inteiro sem problema'} · fotos e relatório em ${PASTA}`)
process.exit(falhas.length ? 1 : 0)
