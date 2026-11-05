// OPERAÇÃO CAOS — onde está o custo crescente da compra: mede criarCompra, pedido e triarLotes separados em 2 tamanhos.
import { it } from 'vitest'
import { bs, novoBackend } from '../src/__tests__/ajuda'

it('perfil do ciclo compra → pedido → triar', async () => {
  const { b } = await novoBackend('2026-11-01')
  const t = { criarCompra: 0, pedido: 0, triarLotes: 0 }
  const res: string[] = []
  for (let k = 0; k < 250; k++) {
    let t0 = performance.now()
    await b.comando('criarCompra', { id: `c${k}`, moduloId: 'cabelo', linhas: [{ id: `l${k}`, quantidade: 9000, moeda: 'BOB', total: bs(4500), campos: { estado: 'Bruto' } }], pagarNoAto: [{ id: `p${k}`, forma: 'dinheiro', moeda: 'BOB', valor: bs(4500) }] })
    t.criarCompra += performance.now() - t0; t0 = performance.now()
    const lote = (await b.consulta('pedido', { id: `c${k}` })).lotes[0]
    t.pedido += performance.now() - t0; t0 = performance.now()
    await b.comando('triarLotes', { id: `t${k}`, ids: [lote.id], quantidadeUsada: 9000, saidas: Array.from({ length: 9 }, (_, j) => ({ id: `s${k}-${j}`, quantidade: 990, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } })) })
    t.triarLotes += performance.now() - t0
    if (k === 49 || k === 249) { res.push(`${k + 1} compras: ` + Object.entries(t).map(([n, v]) => `${n} ${(v / 50).toFixed(1)}ms`).join(' · ')); t.criarCompra = t.pedido = t.triarLotes = 0 }
    if (k === 199) { t.criarCompra = 0; t.pedido = 0; t.triarLotes = 0 }
  }
  // últimas 50 medidas: k 200..249 (zera em 200)
  console.log('[perfil]', res.join(' | '))
}, 600000)
