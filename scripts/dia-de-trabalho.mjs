// DIA DE TRABALHO, MISTURADO: um navegador de verdade (Edge/Chrome do Windows, nada é baixado) faz um dia inteiro com o
// banco zerado (Modo teste › Começar do zero), na tela de celular (390 px), na ordem embaralhada de quem usa de verdade:
//   viagem · vender com estoque vazio · gasto · compra ligada à viagem · gasto ERRADO · triagem · anular e relançar o gasto
//   · estoque · etiquetas e vitrine · relatório de viagens · cadastrar a funcionária e o usuário · agenda (viagem e
//   compromisso dela) · outra compra · venda · venda começada, abandonada e retomada · 10 vendas com um gasto no meio
//   · a funcionária entra (em espanhol), vê só o dela e erra uma venda · o admin corrige (motivo, caixa, auditoria)
//   · cancelar uma venda de cabelo e refazer · fechamento: vendas, caixa, estoque e viagem batem.
// Depois de cada ação confere estoque (no banco do navegador), caixa, avisos e telas. Checagem que falha vira achado e
// não para o resto; "fricção" (dava para ser mais fácil) só fica anotada.
//
//   npm run dia-de-trabalho                    rápido, sem janela (~3 min)
//   npm run dia-de-trabalho -- 1500 --ver      devagar, com a janela aberta e uma faixa dizendo o passo (~8 min)
//   npm run dia-de-trabalho -- 150 --detalhes  mostra o texto das telas (para entender um passo que falhou)
//   npm run dia-de-trabalho -- 150 --ate 9     só até o passo 9
//   --fotos  foto de todo passo (sem ela: só do passo que falhou; --ver também fotografa tudo)
//   --detalhes também mostra as checagens que passaram (o relatório.md sempre tem todas)
//
// Precisa do servidor de desenvolvimento no ar (npm run dev, em http://127.0.0.1:5174). Os dados de exemplo do dono
// (localhost) não são tocados: o navegador é novo e usa 127.0.0.1. Fotos e relatório em node_modules/.cache/dia-de-trabalho/.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const LENTO = Number(process.argv[2] ?? 300)
const VER = process.argv.includes('--ver')
const SO = process.argv.includes('--ate') ? Number(process.argv[process.argv.indexOf('--ate') + 1]) : 99
const B = process.env.URL_APP ?? 'http://127.0.0.1:5174', PASTA = join(process.cwd(), 'node_modules', '.cache', 'dia-de-trabalho')
const DETALHES = process.argv.includes('--detalhes')
const FOTOS = VER || process.argv.includes('--fotos')
/** o texto das telas (para entender um passo que falhou): só com --detalhes */
const detalhe = (x) => DETALHES && console.log(x)
rmSync(PASTA, { recursive: true, force: true }) // sem fotos velhas de outra rodada
mkdirSync(PASTA, { recursive: true })
// senha de teste nova a cada rodada (só existe neste navegador descartável)
const SENHA = 'Teste' + Math.random().toString(36).slice(2, 9) + 'a7'
const passos = [], erros = []
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
let pg
const texto = async () => (await pg.locator('body').innerText()).replace(/\s+/g, ' ')
const aviso = async (re, ms = 15000) => (await pg.getByText(re).first().textContent({ timeout: ms })).trim()
const ir = async (rota) => { await pg.goto(`${B}/#/${rota}`); await pg.waitForLoadState('domcontentloaded'); await esperar(900) }
const chec = (o, ok, detalhe = '', friccao = false) => ({ o, ok: !!ok, detalhe: String(detalhe ?? '').slice(0, 300), friccao })
let toques = 0
// a faixa fica fora do <body>: não entra no texto que as checagens leem
const faixa = (msg) => VER && pg.evaluate((m) => {
  let f = document.getElementById('faixa-teste')
  if (!f) {
    f = document.createElement('div')
    f.id = 'faixa-teste'
    f.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:8px 12px;background:#111827ee;color:#fde68a;font:600 13px system-ui;pointer-events:none'
    document.documentElement.appendChild(f)
  }
  f.textContent = m
}, msg).catch(() => {})
async function passo(n, titulo, fazer, conferir = async () => []) {
  if (n > SO) return
  await faixa(`Passo ${n} · ${titulo}`)
  await esperar(LENTO)
  toques = 0
  const t0 = Date.now(), p = { n, titulo, ms: 0, ok: true, checagens: [], erro: '', toques: 0 }
  try {
    await fazer(); p.ms = Date.now() - t0; p.toques = toques
    await esperar(500)
    for (const c of await conferir()) p.checagens.push(c)
  } catch (e) { p.ok = false; p.erro = String(e?.message ?? e).split('\n').slice(0, 7).join(' ').slice(0, 520) }
  if (p.checagens.some((c) => !c.ok && !c.friccao)) p.ok = false
  await faixa(`${p.ok ? '✓' : '✗'} Passo ${n} · ${titulo}`)
  // foto só do que falhou (ou de tudo com --fotos / --ver): menos tempo e menos disco
  p.foto = FOTOS || !p.ok
  if (p.foto) await pg.screenshot({ path: join(PASTA, `${String(n).padStart(2, '0')}.png`), fullPage: true }).catch(() => {})
  passos.push(p)
  console.log(`${p.ok ? '✓' : '✗'} ${n}. ${titulo} (${p.ms} ms, ${p.toques} toques)${p.erro ? `\n   ERRO: ${p.erro}` : ''}`)
  // no terminal só o que importa (erro e fricção); o relatorio.md guarda todas as checagens
  for (const c of p.checagens.filter((x) => DETALHES || !x.ok)) console.log(`   ${c.ok ? '·' : c.friccao ? '◌ fricção:' : '⚠'} ${c.o}${c.detalhe ? ` — ${c.detalhe}` : ''}`)
}
const lote = async () => pg.evaluate(async () => {
  const dbs = await indexedDB.databases()
  const db = await new Promise((ok) => { const r = indexedDB.open(dbs.find((d) => /tudo/i.test(d.name)).name); r.onsuccess = () => ok(r.result) })
  const q = (s) => new Promise((ok) => { const x = db.transaction(s).objectStore(s).getAll(); x.onsuccess = () => ok(x.result) })
  const itens = (await q('itens')).filter((i) => i.codigo?.startsWith('L-')).map((i) => [i.codigo, i.saldo, i.estado ?? i.status ?? ''])
  db.close()
  return itens
})
const saldo = async (c) => (await lote()).find((x) => x[0] === c)?.[1]
const clicar = async (l, o) => { toques++; await l.click({ timeout: 15000, ...o }) }

async function vender(cod, g, preco, { finalizar = true } = {}) {
  await ir('venda-rapida')
  const busca = pg.getByLabel(/Ler ou buscar pacote|Leer o buscar paquete/)
  await busca.fill(cod); toques++
  await esperar(500)
  await pg.keyboard.press('Enter')
  await clicar(pg.getByRole('button', { name: new RegExp(`(Mudar a quantidade|Cambiar la cantidad) de ${cod}`) }))
  const j = pg.getByRole('dialog')
  await j.locator('input').first().fill(String(g)); toques++
  await clicar(j.getByRole('button', { name: 'OK' }))
  await pg.getByLabel(new RegExp(`^(Preço|Precio) de ${cod}$`)).fill(String(preco)); toques++
  if (!finalizar) return
  await clicar(pg.getByRole('button', { name: /^(FECHAR|CERRAR)$/ }))
  await clicar(pg.getByRole('dialog').getByRole('button', { name: /Dinheiro|Efectivo/ }))
  await clicar(pg.getByRole('dialog').getByRole('button', { name: /Valor exato|Valor exacto|Monto exacto|exact/i }))
  await esperar(900)
}
async function gasto(valor, nomeCategoria) {
  await ir('viagens')
  await clicar(pg.getByRole('button', { name: /Gasto/ }).first())
  const j = pg.getByRole('dialog')
  await j.getByRole('radio').first().waitFor({ timeout: 10000 })
  if (nomeCategoria) await clicar(j.getByRole('radio', { name: nomeCategoria }).first())
  await j.locator('input[inputmode]').first().fill(String(valor)); toques++
  await clicar(j.getByRole('button', { name: /^Salvar/ }))
}
async function abrirViagem() {
  await ir('viagens')
  await clicar(pg.getByText(/Compra Sucre/).first())
  await esperar(500)
  const abrir = pg.getByRole('button', { name: /Abrir( a)? viagem|Ver viagem|Abrir ficha|Abrir/ }).first()
  if (await abrir.isVisible().catch(() => false)) await clicar(abrir)
  await esperar(1000)
}
async function sair() {
  const direto = pg.getByRole('button', { name: /^(Sair|Salir)$/ }).first()
  if (!(await direto.isVisible().catch(() => false))) await pg.getByRole('button', { name: /(Mais|Más)$/ }).last().click({ timeout: 5000 }).catch(() => {})
  await pg.getByText(/^(Sair|Salir)$/).or(direto).first().click({ timeout: 8000 })
  await esperar(800)
  const dlg = pg.getByRole('button', { name: /Sair sem fechar|Salir sin cerrar/ })
  if (await dlg.isVisible().catch(() => false)) await dlg.click()
  await pg.getByText(/Entrar no Tudo/).first().waitFor({ timeout: 15000 })
}
async function entrar(login, senha) {
  await pg.getByPlaceholder('Ex.: sofia').fill(login)
  await pg.getByLabel('Senha', { exact: true }).first().fill(senha)
  await pg.getByRole('button', { name: 'Entrar', exact: true }).click()
  await esperar(2200)
}
const entrarAdmin = async () => { await pg.getByText('Administrador', { exact: true }).first().click({ timeout: 30000 }); await esperar(2000) }

async function dia() {
  const h = {} // textos lidos num passo e conferidos depois

  await passo(0, 'Entrar e zerar tudo (Começar do zero)', async () => {
    await pg.goto(`${B}/`)
    await pg.getByText('Administrador', { exact: true }).first().click({ timeout: 180000 })
    await esperar(2500)
    await ir('config/teste')
    await pg.getByRole('radio', { name: /Começar do zero/ }).click({ timeout: 30000 })
    await pg.getByRole('button', { name: /Carregar cenário/ }).click()
    await pg.getByRole('dialog').getByRole('button', { name: 'Sim, carregar' }).click()
    await aviso(/Cenário “.*” carregado/, 60000)
  })

  await passo(1, 'Cadastrar viagem (Paula vai)', async () => {
    await ir('viagens')
    await clicar(pg.getByRole('button', { name: /Criar a primeira viagem/ }))
    await pg.getByPlaceholder('Ex.: Feira de Oruro · novembro').fill('Compra Sucre #1')
    await clicar(pg.getByRole('radio', { name: 'Não' }).first())
    await pg.getByPlaceholder('Ex.: Lima, Peru').fill('Sucre, Bolívia')
    await clicar(pg.getByRole('button', { name: /Próximo: Quem vai/ }))
    await pg.getByLabel('Adicionar quem vai').fill('Paula')
    await clicar(pg.getByRole('button', { name: /Nova pessoa da equipe: Paula/ }).or(pg.getByRole('option', { name: /Nova pessoa da equipe/ })).first())
    await aviso(/Paula cadastrad/)
    await clicar(pg.getByRole('button', { name: /Próximo: Quanto pode gastar/ }))
    await pg.getByRole('button', { name: /Próximo/ }).first().click({ timeout: 2000 }).catch(() => {})
    await clicar(pg.locator('button:not([disabled])', { hasText: /Salvar|Criar|Registrar|Começar/ }).last())
  }, async () => {
    const f = await aviso(/Viagem criada/).catch(() => '')
    const tx = await texto()
    return [chec('Aviso de criada', f, f), chec('Aberta', /Em viagem|Aberta/.test(tx)), chec('Sem erro no console', !erros.length, erros.at(-1))]
  })

  let vazio = ''
  await passo(2, 'Misturado: tentar vender com o estoque vazio', async () => {
    await ir('venda-rapida')
    await pg.getByLabel(/Ler ou buscar pacote/).fill('L-0001')
    await esperar(600)
    await pg.keyboard.press('Enter')
    await esperar(900)
    vazio = await texto()
  }, async () => [chec('Diz que não achou (não fica mudo)', /não encontr|nenhum|sem estoque|não há/i.test(vazio), vazio.slice(0, 300)), chec('Sem erro no console', !erros.length, erros.at(-1))])

  await passo(3, 'Gasto da viagem: Bs 300', async () => { await gasto(300) }, async () => {
    const f = await aviso(/Gasto salvo/).catch(() => '')
    return [chec('Aviso de salvo', f, f)]
  })
  let tela4 = ''
  await passo(4, 'Contabilizou certo? (lista e ficha)', async () => {
    await ir('viagens'); const lista = await texto()
    await abrirViagem(); tela4 = await texto()
    detalhe('   [lista] ' + lista.slice(0, 500)); detalhe('   [ficha] ' + tela4.slice(0, 900))
  }, async () => [chec('Ficha mostra Bs 300', /300,00/.test(tela4))])

  await passo(5, 'Compra 5 kg Bs 2.000 (ligada à viagem)', async () => {
    await ir('pedidos/novo')
    await pg.getByPlaceholder('Buscar pelo nome ou sigla…').fill('Fornecedora Sucre')
    await clicar(pg.getByRole('button', { name: /Novo fornecedor: Fornecedora Sucre/ }).or(pg.getByRole('option', { name: /Novo fornecedor/ })).first())
    await aviso(/Fornecedora Sucre cadastrad/)
    await pg.getByRole('button', { name: /Próximo: Itens da compra/ }).click({ timeout: 2000 }).catch(() => {})
    await pg.getByLabel(/^Peso/).first().fill('5000')
    await pg.getByLabel(/^Valor total/).first().fill('2000')
    await clicar(pg.getByRole('button', { name: /Próximo: Detalhes/ }))
    await clicar(pg.getByRole('button', { name: /Registrar pedido/ }))
  }, async () => {
    const f = await aviso(/Compra P-\d+ registrada/).catch(() => '')
    await pg.getByText(/Compra Sucre/).first().waitFor({ timeout: 8000 }).catch(() => {})
    const tx = await texto()
    detalhe('   [lotes] ' + JSON.stringify(await lote()))
    return [chec('Aviso', f, f), chec('Ligada à viagem', /Compra Sucre/.test(tx))]
  })

  await passo(6, 'Gasto ERRADO: Bs 1.500 (era 150)', async () => { await gasto(1500) }, async () => [chec('Salvou', await aviso(/Gasto salvo/).catch(() => ''))])

  let perda = ''
  await passo(7, 'Misturado: triagem 3 kg 60 cm + 1,9 kg 50 cm', async () => {
    await ir('triagem')
    await clicar(pg.getByRole('button', { name: /Separar L-/ }).first())
    const pesos = pg.getByPlaceholder('Ex.: 500')
    await pesos.nth(0).fill('3000')
    await pg.getByLabel(/^Medida/).nth(0).fill('60')
    await clicar(pg.getByRole('button', { name: /Outra parte/ }))
    await pesos.nth(1).fill('1900')
    await pg.getByLabel(/^Medida/).nth(1).fill('50')
    perda = (await texto()).match(/perda [\d.,]+ ?k?g[^)]*\)?/i)?.[0] ?? ''
    await clicar(pg.getByRole('button', { name: /✂️ Separar/ }))
  }, async () => { const f = await aviso(/Triagem feita|separad/i).catch(() => ''); detalhe('   [lotes] ' + JSON.stringify(await lote())); return [chec('Perda 100 g antes de confirmar', /100 g/.test(perda), perda), chec('Aviso', f, f)] })

  let t8 = '', t8j = ''
  await passo(8, 'Corrigir o gasto errado (achar, anular, relançar 150)', async () => {
    await abrirViagem()
    const abaG = pg.getByRole('button', { name: /^Gastos/ }).or(pg.getByRole('tab', { name: /^Gastos/ })).first()
    if (await abaG.isVisible().catch(() => false)) await clicar(abaG)
    await esperar(600)
    await clicar(pg.getByRole('button', { name: 'Anular' }).first())
    const j = pg.getByRole('dialog')
    t8j = (await j.innerText()).replace(/\s+/g, ' ')
    const motivo = j.locator('input,textarea').first()
    if (await motivo.isVisible().catch(() => false)) await motivo.fill('valor digitado errado')
    await clicar(j.getByRole('button', { name: /Anular/ }).last())
    await esperar(800)
    await gasto(150)
    await abrirViagem(); t8 = await texto()
  }, async () => { detalhe('   [janela] ' + t8j.slice(0, 300)); detalhe('   [ficha] ' + t8.slice(0, 700)); return [chec('Total de gastos = Bs 450 (300+150; o de 1.500 fora)', /450,00/.test(t8), (t8.match(/[\d.]+,\d\d/g) ?? []).slice(0, 8).join(' '))] })

  await passo(9, 'Estoque', async () => { await ir('estoque'); await pg.getByText(/1,9 kg|1\.900 g/).first().waitFor({ timeout: 15000 }) }, async () => {
    const tx = await texto()
    return [chec('3 kg', /\b3 kg\b/.test(tx)), chec('1,9 kg', /1,9 kg/.test(tx)), chec('Total 4,9 kg', /4,9 kg/.test(tx), tx.match(/[\d,]+ kg/g)?.slice(0, 5).join(' · '))]
  })

  let v0 = ''
  await passo(9.5, 'Vitrine antes da etiqueta; imprimir e confirmar as etiquetas; escolher o que vai para a vitrine', async () => {
    await ir('vitrine'); await esperar(900); v0 = await texto()
    await ir('etiquetas'); await esperar(900)
    await clicar(pg.getByText(/Selecionar todos os filtrados/).first())
    await esperar(400)
    const cont = pg.getByRole('button', { name: /Continuar/ })
    if (await cont.isVisible().catch(() => false)) await clicar(cont)
    await clicar(pg.getByRole('button', { name: /Imprimir 2 etiquetas/ }).first())
    await esperar(1200)
    await clicar(pg.getByRole('dialog').getByRole('button', { name: /Imprimir 2 etiquetas/ }).last())
    await esperar(800)
    await clicar(pg.getByRole('button', { name: /Confirmar impressão/ }))
    await esperar(1000)
    await pg.getByRole('button', { name: /Concluir/ }).click({ timeout: 2500 }).catch(() => {})
    await ir('vitrine'); await esperar(900)
    h.fila = await texto()
    await clicar(pg.getByRole('button', { name: /Pôr todos \(2\)/ }))
    await aviso(/2 pacote\(s\) na vitrine/).catch(() => '')
    await esperar(600)
  }, async () => {
    const tx = await texto()
    detalhe('   [vitrine sem etiqueta] ' + v0.slice(0, 300))
    return [chec('Sem etiqueta a vitrine explica por que está vazia', /etiqueta/i.test(v0), v0.match(/Na vitrine \d+[^.]{0,120}/)?.[0], true), chec('Com etiqueta, não entra sozinho: 2 em Prontos para a vitrine', /Fora \(2\)/i.test(h.fila) && /Na vitrine \(0\)/i.test(h.fila)), chec('Depois de Pôr todos: 2 na vitrine', /Na vitrine 2/.test(tx), tx.match(/Na vitrine \d+/)?.[0])]
  })

  let t10 = '', loja = ''
  await passo(10, 'Alterar a vitrine e ver como o cliente', async () => {
    await ir('vitrine')
    await esperar(800)
    // no celular a vitrine tem sub-abas (Pacotes · Loja): os campos de texto ficam na aba Loja
    const abaLoja = pg.getByRole('tab', { name: /^Loja/ })
    if (await abaLoja.isVisible().catch(() => false)) await clicar(abaLoja)
    await pg.getByPlaceholder('Meu negócio').fill('Cabelos Sucre')
    await pg.getByPlaceholder('+591 70000000').fill('+591 70012345')
    await clicar(pg.getByRole('radio', { name: /Preço da tabela/ }))
    await esperar(800)
    h.nomeFicou = await pg.getByPlaceholder('Meu negócio').inputValue()
    await clicar(pg.getByRole('button', { name: /Salvar e publicar/ }))
    t10 = await aviso(/Vitrine publicada/).catch(() => '')
    const [nova] = await Promise.all([pg.context().waitForEvent('page', { timeout: 6000 }).catch(() => null), pg.getByRole('button', { name: /Ver como o cliente vê/ }).click()])
    await esperar(2500)
    const alvo = nova ?? pg
    loja = (await alvo.locator('body').innerText()).replace(/\s+/g, ' ')
    if (nova) await nova.close()
  }, async () => { detalhe('   [loja] ' + loja.slice(0, 500)); return [chec('Aviso de publicado', t10, t10), chec('Loja com o nome novo', /Cabelos Sucre/.test(loja)), chec('Pacotes aparecem na loja', /60 ?cm|L-000/.test(loja), '', true)] })

  let rv = '', cx = ''
  await passo(11, 'Relatórios: a viagem entrou certo?', async () => {
    await ir('relatorios')
    await esperar(800)
    await clicar(pg.getByRole('tab', { name: /Viagens$/ }))
    await esperar(1200)
    rv = await texto()
    await ir('caixa'); await esperar(800); cx = await texto()
  }, async () => { detalhe('   [rel viagens] ' + rv.slice(0, 900)); detalhe('   [caixa] ' + cx.slice(0, 700)); return [chec('Relatório de Viagens traz a viagem', /Compra Sucre|VG-/.test(rv)), chec('Gasto 450 no relatório', /450,00/.test(rv))] })

  await passo(12, 'Cadastrar a funcionária Carla e o usuário dela', async () => {
    await ir('novoFuncionario')
    await pg.getByPlaceholder('Ex.: Paula').fill('Carla')
    await clicar(pg.getByRole('button', { name: /Cadastrar/ }))
    await aviso(/Funcionário cadastrado/)
    await ir('config/usuarios')
    await clicar(pg.getByRole('button', { name: /\+ Usuário/ }))
    const j = pg.getByRole('dialog')
    await j.getByLabel('Nome', { exact: true }).fill('Carla')
    await j.getByLabel('É a pessoa').selectOption({ label: await j.getByLabel('É a pessoa').locator('option', { hasText: 'Carla' }).first().innerText() })
    await j.getByLabel(/Usuário \(para entrar\)/).fill('carla')
    await j.getByLabel('Senha', { exact: true }).first().fill(SENHA)
    await clicar(j.getByRole('button', { name: /Salvar|Cadastrar|Criar/ }).last())
    await esperar(1000)
  }, async () => [chec('Carla na lista', /carla/.test(await texto()))])

  let ag = ''
  await passo(13, 'Agenda: ver a viagem e o que a Carla faz hoje', async () => {
    await ir('agenda')
    await clicar(pg.getByRole('button', { name: /\+ Marcar/ }))
    const j = pg.getByRole('dialog')
    await clicar(j.getByRole('button', { name: /Compromisso/ }).or(j.getByRole('radio', { name: /Compromisso/ })).first())
    await j.getByPlaceholder('Ex.: Buscar mechas no correio').fill('Etiquetar pacotes novos')
    await clicar(j.getByRole('button', { name: /Próximo: Quando/ }))
    await clicar(j.getByRole('button', { name: /Próximo: Para quem/ }))
    await j.getByLabel('Para quem').selectOption({ label: 'Carla' })
    await clicar(j.getByRole('button', { name: /Salvar|Marcar|Criar/ }).last())
    await esperar(1000)
    await ir('agenda')
    await clicar(pg.getByRole('radio', { name: 'Dia', exact: true }))
    await esperar(800)
    ag = await texto()
  }, async () => { detalhe('   [agenda] ' + ag.slice(0, 700)); return [chec('Viagem aparece', /Compra Sucre|Sucre/.test(ag)), chec('Compromisso aparece', /Etiquetar pacotes/.test(ag)), chec('Diz que é da Carla', /Carla/.test(ag), '', true)] })

  await passo(14, 'Outra compra: 2 kg Bs 900', async () => {
    await ir('pedidos/novo')
    await pg.getByPlaceholder('Buscar pelo nome ou sigla…').fill('Fornecedora')
    await esperar(600)
    await clicar(pg.getByRole('button', { name: /Fornecedora Sucre/ }).or(pg.getByRole('option', { name: /Fornecedora Sucre/ })).first())
    await pg.getByRole('button', { name: /Próximo: Itens da compra/ }).click({ timeout: 2000 }).catch(() => {})
    await pg.getByLabel(/^Peso/).first().fill('2000')
    await pg.getByLabel(/^Valor total/).first().fill('900')
    await clicar(pg.getByRole('button', { name: /Próximo: Detalhes/ }))
    await clicar(pg.getByRole('button', { name: /Registrar pedido/ }))
  }, async () => { const f = await aviso(/Compra P-\d+ registrada/).catch(() => ''); detalhe('   [lotes] ' + JSON.stringify(await lote())); return [chec('Aviso', f, f)] })

  await passo(15, 'Uma venda: 200 g de L-0002 por Bs 250', async () => { await vender('L-0002', 200, 250) }, async () => [chec('L-0002 = 2800 g', (await saldo('L-0002')) === 2800, await saldo('L-0002'))])

  let carrinho = ''
  await passo(16, 'Misturado: começa venda, sai para o estoque, volta (carrinho fica?)', async () => {
    await vender('L-0003', 100, 111, { finalizar: false })
    await esperar(700)
    await ir('estoque')
    await ir('venda-rapida')
    await esperar(800)
    carrinho = await texto()
  }, async () => { detalhe('   [volta] ' + carrinho.slice(0, 500)); return [chec('A venda começada continua lá', /L-0003/.test(carrinho), '', true)] })

  let soma13 = 0
  await passo(17, '10 vendas, com um gasto no meio', async () => {
    await clicar(pg.getByRole('button', { name: /Retomar/ }).first())
    await esperar(800)
    await clicar(pg.getByRole('button', { name: /^(FECHAR|CERRAR)$/ }))
    await clicar(pg.getByRole('dialog').getByRole('button', { name: /Dinheiro|Efectivo/ }))
    await clicar(pg.getByRole('dialog').getByRole('button', { name: /Valor exato|Valor exacto|Monto exacto|exact/i }))
    await esperar(900)
    detalhe('   retomada e fechada: L-0003 · saldo ' + await saldo('L-0003'))
    for (let k = 0; k < 10; k++) {
      const cod = k % 5 === 4 ? 'L-0003' : 'L-0002', preco = 100 + k * 10
      await vender(cod, 100, preco)
      soma13 += preco
      if (k === 4) await gasto(40)
      detalhe(`   venda ${k + 1}: ${cod} · saldo ${await saldo(cod)}`)
    }
  }, async () => {
    const a = await saldo('L-0002'), b = await saldo('L-0003')
    return [chec('L-0002 = 2000 g (−200 −8×100)', a === 2000, a), chec('L-0003 = 1600 g (−100 retomada −2×100)', b === 1600, b), chec('Soma das 10', soma13 === 1450, soma13)]
  })
  await passo(18, 'Conferir vendas e caixa', async () => {
    await ir('vender'); await esperar(900); h.v18 = await texto()
    await ir('caixa'); await esperar(900); h.c18 = await texto()
  }, async () => { detalhe('   [vendas] ' + h.v18.slice(0, 500)); detalhe('   [caixa] ' + h.c18.slice(0, 700)); return [chec('Vendido Bs 1.811 (250+111+1450)', /1\.811,00/.test(h.v18), h.v18.match(/Vendido (Bs [\d.,]+)/)?.[1])] })

  const c = {}
  await passo(19, 'Carla entra, vê o dia dela e erra uma venda', async () => {
    await sair()
    await entrar('carla', SENHA)
    await esperar(800)
    c.antes = await saldo('L-0003')
    await ir('agenda'); await esperar(900); c.ag = await texto()
    await ir('relatorios'); await esperar(900); c.rel = await texto()
    await ir('pedidos/novo'); await esperar(900); c.ped = await texto()
    await vender('L-0003', 100, 999)
    await ir('vender'); await esperar(1000); c.vend = await texto()
  }, async () => {
    detalhe('   [agenda carla] ' + c.ag.slice(0, 400)); detalhe('   [rel] ' + c.rel.slice(0, 200)); detalhe('   [pedido] ' + c.ped.slice(0, 200)); detalhe('   [vendas] ' + c.vend.slice(0, 500))
    const d = await saldo('L-0003')
    return [chec('Vê o compromisso dela', /Etiquetar pacotes/.test(c.ag)), chec('Não abre relatórios', !/Estados financeiros/.test(c.rel), c.rel.slice(0, 120)), chec('L-0003 baixou 100 g', d === c.antes - 100, `${c.antes} → ${d}`)]
  })
  await passo(20, 'Carla tenta arrumar a própria venda', async () => {
    await pg.getByText(/V-\d+/).first().click({ timeout: 8000 })
    await esperar(600)
    const ab = pg.getByRole('button', { name: /Abrir vent?d?a/ }).first()
    if (await ab.isVisible().catch(() => false)) await ab.click()
    await esperar(1200)
    c.ficha = await texto()
    c.botoes = await pg.evaluate(() => [...document.querySelectorAll('main button')].filter((e) => e.offsetParent).map((e) => (e.getAttribute('aria-label') || e.innerText).trim().replace(/\s+/g, ' ').slice(0, 30)).join(' | '))
    const m = pg.getByRole('button', { name: /Mais ações|Más acciones/ }).first()
    if (await m.isVisible().catch(() => false)) { await m.click(); await esperar(300); c.menu = await pg.getByRole('menu').innerText().catch(() => '') }
  }, async () => {
    detalhe('   [ficha] ' + c.ficha.slice(0, 600)); detalhe('   [botões] ' + c.botoes.slice(0, 500)); detalhe('   [menu] ' + (c.menu ?? ''))
    return [chec('Funcionária tem algum caminho na tela (avisar o admin/pedir correção)', /administrador|pedir|solicitar|avisar/i.test(c.ficha + c.botoes + (c.menu ?? '')), '', true), chec('Não tem Cancelar/Corrigir', !/Cancelar vent?d?a|Corrigir|Corregir/.test(c.botoes + (c.menu ?? '')))]
  })
  await passo(21, 'Admin vê e corrige Bs 999 → 130', async () => {
    await sair(); await entrarAdmin()
    await ir('painel'); await esperar(1000); c.painel = await texto()
    await ir('vender'); await esperar(1000)
    await clicar(pg.getByText(/V-\d+/).first())
    await esperar(500)
    await clicar(pg.getByRole('button', { name: /Abrir venda/ }).first())
    await esperar(1000)
    c.fichaAdm = await texto()
    await clicar(pg.getByRole('button', { name: /Corrigir/ }).first())
    const j = pg.getByRole('dialog')
    await j.locator('input[inputmode]').first().waitFor()
    c.jan = (await j.innerText()).replace(/\s+/g, ' ')
    await j.getByLabel(/^Valor/).first().fill('130')
    await esperar(300)
    await j.getByLabel(/Motivo/).or(j.getByPlaceholder(/motivo/i)).first().fill('preço digitado errado pela Carla')
    await clicar(j.getByRole('button', { name: /Salvar correção/ }))
    c.av = await aviso(/Venda corrigida/).catch(() => '')
    await esperar(800)
    await ir('vender'); await esperar(900); c.vd2 = await texto()
    await ir('caixa'); await esperar(900); c.cx2 = await texto()
    await ir('auditoria'); await esperar(900); c.aud = await texto()
  }, async () => {
    detalhe('   [ficha admin] ' + c.fichaAdm.slice(0, 500)); detalhe('   [corrigir] ' + c.jan.slice(0, 500)); detalhe('   [painel] ' + c.painel.slice(0, 400)); detalhe('   [caixa] ' + c.cx2.slice(0, 500))
    return [chec('Aviso de corrigida', c.av, c.av), chec('Vendido Bs 1.941 (1811+130)', /1\.941,00/.test(c.vd2), c.vd2.match(/Vendido (Bs [\d.,]+)/)?.[1]), chec('Auditoria com o motivo', /digitado errado pela Carla/.test(c.aud)), chec('O painel avisa sobre venda da funcionária', /Carla/.test(c.painel), '', true)]
  })
  const s = {}
  await passo(22, 'Cancelar uma venda de cabelo e fazer outra', async () => {
    await ir('vender'); await esperar(900)
    s.antes = await saldo('L-0002')
    await pg.locator('main input').first().fill('V-0001'); await esperar(900)
    await clicar(pg.getByText(/V-0001/).first())
    await esperar(400)
    await clicar(pg.getByRole('button', { name: /Abrir venda/ }).first())
    await esperar(900)
    await clicar(pg.getByRole('button', { name: /Mais ações|⋯/ }).first())
    await clicar(pg.getByRole('button', { name: /Cancelar venda/ }).or(pg.getByRole('menuitem', { name: /Cancelar venda/ })).first())
    const d = pg.getByRole('dialog')
    await d.locator('input,textarea').first().fill('cliente desistiu do pacote')
    await clicar(d.getByRole('button', { name: /Cancelar venda|Sim|Confirmar/ }).last())
    s.av = await aviso(/cancelad/i).catch(() => '')
    await esperar(600)
    s.depois = await saldo('L-0002')
    await vender('L-0002', 300, 300)
    s.fim = await saldo('L-0002')
  }, async () => [chec('Aviso', s.av, s.av), chec('Voltou 200 g', s.depois === s.antes + 200, `${s.antes} → ${s.depois}`), chec('Nova venda baixou 300 g', s.fim === s.depois - 300, s.fim)])

  const f = {}
  await passo(23, 'Fechamento: tudo bate?', async () => {
    f.lotes = await lote()
    await ir('vender'); await esperar(900); f.v = await texto()
    await ir('caixa'); await esperar(900); f.c = await texto()
    await ir('estoque'); await esperar(900); f.e = await texto()
    await ir('viagens'); await esperar(900); f.vg = await texto()
    await ir('painel'); await esperar(1200); f.p = await texto()
  }, async () => {
    detalhe('   [lotes] ' + JSON.stringify(f.lotes)); detalhe('   [vendas] ' + f.v.slice(0, 400)); detalhe('   [caixa] ' + f.c.slice(0, 700)); detalhe('   [estoque] ' + f.e.slice(0, 400)); detalhe('   [viagens] ' + f.vg.slice(0, 500)); detalhe('   [painel] ' + f.p.slice(0, 900))
    return [chec('Vendido Bs 1.991 (1941−250+300)', /1\.991,00/.test(f.v), f.v.match(/Vendido (Bs [\d.,]+)/)?.[1]), chec('Canceladas 1', /Canceladas 1/.test(f.v)), chec('Viagem com gasto Bs 490 (300+150+40)', /490,00/.test(f.vg), (f.vg.match(/[\d.]+,\d\d/g) ?? []).slice(0, 6).join(' ')), chec('Sem erro de tela no caminho', !erros.length, erros.at(-1))]
  })
}

try {
  // Edge do Windows; se não abrir (ex.: logo depois de uma atualização), o Chrome — como no primeiro-acesso
  const abrir = (channel) => chromium.launch({ channel, headless: !VER, slowMo: VER ? 350 : 0 })
  const nav = await abrir('msedge').catch(() => abrir('chrome'))
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'pt-BR', serviceWorkers: 'block' })
  pg = await ctx.newPage()
  pg.on('pageerror', (e) => erros.push(`${pg.url().replace(B, '')} · ${String(e).slice(0, 240)}`))
  pg.on('console', (m) => m.type() === 'error' && erros.push(`${pg.url().replace(B, '')} · ${m.text().slice(0, 240)}`))
  pg.on('dialog', (d) => d.accept())
  await pg.addInitScript(() => { sessionStorage.setItem('tudo:acesso-liberado', '1'); localStorage.setItem('tudo:simular-api-ms', '0'); window.print = () => {} })
  await dia()
  if (VER) { await faixa('Fim do teste'); await esperar(6000) }
  await nav.close()
  for (const e of erros) console.log('   console: ' + e)
  writeFileSync(join(PASTA, 'relatorio.json'), JSON.stringify({ lento: LENTO, passos, erros }, null, 2))
  writeFileSync(join(PASTA, 'relatorio.md'), [
    `# Dia de trabalho, misturado (${new Date().toLocaleString('pt-BR')})`, '',
    `Pausa entre as ações: ${LENTO} ms · navegador novo, banco zerado, tela de celular (390 px).`, '',
    '| Passo | Tempo | Toques | Resultado |', '|---|---|---|---|',
    ...passos.map((x) => `| ${x.n}. ${x.titulo} | ${x.ms} ms | ${x.toques} | ${x.ok ? '✓' : '✗'}${x.erro ? ` ${x.erro}` : ''} |`), '',
    ...passos.flatMap((x) => [`## ${x.n}. ${x.titulo}`, '', ...x.checagens.map((c) => `- ${c.ok ? '✓' : c.friccao ? '◌ fricção:' : '⚠'} ${c.o}${c.detalhe ? ` — ${c.detalhe}` : ''}`), '', ...(x.foto ? [`![passo ${x.n}](${String(x.n).padStart(2, '0')}.png)`, ''] : [])]),
    ...(erros.length ? ['## Erros no console', '', ...erros.map((e) => `- ${e}`), ''] : []),
  ].join('\n'))
  const f = passos.filter((p) => !p.ok)
  console.log(`\n${f.length ? `✗ ${f.length} passo(s) com problema: ${f.map((x) => x.n).join(', ')}` : '✓ o dia inteiro bateu'} · relatório${passos.some((x) => x.foto) ? " e fotos" : ""} em ${PASTA}`)
  process.exit(f.length ? 1 : 0)
} catch (e) {
  console.error('FALHOU', e.message.slice(0, 500))
  process.exit(1)
}
