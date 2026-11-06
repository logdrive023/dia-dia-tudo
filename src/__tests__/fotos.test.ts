// FOTOS DO LOTE: a foto acompanha o lote (separação e junção herdam por referência), a principal, foto obrigatória
// na compra e na saída da coluna da triagem, miniatura e etiquetas (dados + QR).

import { describe, expect, it } from 'vitest'
import type { CategoriaAnexo } from '../core/domain/tipos'
import { COLUNAS_PADRAO, COLUNA_LAVAGEM } from '../core/services/triagem'
import { enderecoDoLote, loteDoCodigoLido } from '../shared/ui/etiquetas'
import { bitsFormato, correcaoRS, gerarQR } from '../shared/ui/qr'
import { bs, novoBackend } from './ajuda'

type B = Awaited<ReturnType<typeof novoBackend>>['b']

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: 'image/jpeg' })
const foto = (b: B, id: string, donoId: string, categoria: CategoriaAnexo = 'produto') => b.anexar({ id, donoId, categoria, nome: `${id}.jpg`, arquivo: jpeg() })

async function compraNoEstoque(b: B, id: string, g = 10000) {
  await b.comando('criarCompra', { id, moduloId: 'cabelo', linhas: [{ id: `${id}-l`, quantidade: g, moeda: 'BOB', total: bs(50000), campos: { estado: 'Bruto' } }] })
  for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: id, para: e, pagamentos: e === 'pago' ? [{ id: `${id}-p`, forma: 'dinheiro', moeda: 'BOB', valor: bs(50000) }] : undefined })
  const lote = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.compraId === id && i.origem?.tipo === 'compra')!
  const compra = (await b.consulta('pedido', { id })).compra
  return { lote, compra }
}

describe('fotos do lote', () => {
  it('separação: as partes herdam (por referência) as fotos do lote-mãe e da compra; a própria vem primeiro', async () => {
    const { b } = await novoBackend()
    const { lote, compra } = await compraNoEstoque(b, 'c1')
    await foto(b, 'f-compra', 'c1', 'pedido')
    await foto(b, 'f-comprovante', 'c1', 'comprovante') // comprovante não é foto do cabelo
    await foto(b, 'f-bruto', lote.id)
    await b.comando('separarLote', { id: 's1', loteId: lote.id, quantidadeUsada: 10000, saidas: [{ id: 'a', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal' } }, { id: 'b', quantidade: 3500, campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal' } }] })
    await foto(b, 'f-a', 'a')

    const fa = await b.consulta('fotosDoLote', { itemId: 'a' })
    expect(fa.fotos.map((f) => f.id)).toEqual(['f-a', 'f-bruto', 'f-compra'])
    expect(fa.fotos.map((f) => f.propria)).toEqual([true, false, false])
    expect(fa.fotos[1].de).toBe(`do lote ${lote.codigo}`)
    expect(fa.fotos[2].de).toBe(`da compra ${compra.codigo}`)
    expect(fa.principal?.id).toBe('f-a')
    expect(fa.proprias).toBe(1)

    // a irmã sem foto própria: a principal é a herdada mais perto (a do lote-mãe)
    const fb = await b.consulta('fotosDoLote', { itemId: 'b' })
    expect(fb.fotos.map((f) => f.id)).toEqual(['f-bruto', 'f-compra'])
    expect(fb.principal).toMatchObject({ id: 'f-bruto', propria: false })

    // nada foi copiado: só os anexos originais existem
    expect((await b.consulta('anexosDe', { donoId: 'b' })).length).toBe(0)
    // as listas já trazem a miniatura (sem outra consulta) e a ficha traz todas
    const est = await b.consulta('estoque', { moduloId: 'cabelo' })
    expect(est.find((i) => i.id === 'a')?.foto?.id).toBe('f-a')
    expect(est.find((i) => i.id === 'b')?.foto?.id).toBe('f-bruto')
    expect(est.find((i) => i.id === 'b')?.fotosProprias).toBe(0)
    expect((await b.consulta('fichaItem', { id: 'b' })).fotoPrincipal?.id).toBe('f-bruto')
    const tri = await b.consulta('triagem', { moduloId: 'cabelo' })
    expect(tri.lotes.find((l) => l.id === 'a')?.foto?.id).toBe('f-a')
    const gen = await b.consulta('genealogia', { itemId: 'a' })
    expect(gen.lotes.find((l) => l.id === 'b')?.foto?.id).toBe('f-bruto')
    expect((await b.consulta('pedido', { id: 'c1' })).lotes.find((l) => l.id === 'a')?.foto?.id).toBe('f-a')
  })

  it('junção: o lote unificado herda as fotos de todos os lotes e de todas as compras', async () => {
    const { b } = await novoBackend()
    const x = await compraNoEstoque(b, 'c1', 4000)
    const y = await compraNoEstoque(b, 'c2', 3000)
    await foto(b, 'fx', x.lote.id)
    await foto(b, 'fc2', 'c2', 'produto')
    await b.comando('triarLotes', { id: 'u', ids: [x.lote.id, y.lote.id] })
    const fu = await b.consulta('fotosDoLote', { itemId: 'u' })
    expect(fu.fotos.map((f) => f.id)).toEqual(['fx', 'fc2'])
    expect(fu.fotos.map((f) => f.origem?.tipo)).toEqual(['lote', 'compra'])
    expect(fu.principal).toMatchObject({ id: 'fx', propria: false })
    // depois a separação do unificado: a neta herda tudo, do mais perto ao mais longe
    await foto(b, 'fu', 'u')
    await b.comando('separarLote', { id: 's', loteId: 'u', quantidadeUsada: 7000, saidas: [{ id: 'n', quantidade: 6800, campos: { estado: 'Separado', comprimento: 50 } }] })
    expect((await b.consulta('fotosDoLote', { itemId: 'n' })).fotos.map((f) => f.id)).toEqual(['fu', 'fx', 'fc2'])
  })

  it('foto principal = a própria mais nova; miniatura guardada e validada', async () => {
    const { b, r } = await novoBackend()
    const { lote } = await compraNoEstoque(b, 'c1')
    await foto(b, 'velha', lote.id)
    r.avancar(1)
    await foto(b, 'nova', lote.id)
    const mini = 'data:image/jpeg;base64,/9j/AAAA'
    await b.comando('definirMiniatura', { id: 'nova', miniatura: mini })
    await expect(b.comando('definirMiniatura', { id: 'nova', miniatura: 'javascript:alert(1)' })).rejects.toThrow(/Miniatura inválida/)
    const f = await b.consulta('fotosDoLote', { itemId: lote.id })
    expect(f.fotos.map((x) => x.id)).toEqual(['nova', 'velha'])
    expect(f.principal).toMatchObject({ id: 'nova', propria: true, miniatura: mini })
    // foto apagada sai da lista
    await b.comando('removerAnexo', { id: 'nova' })
    expect((await b.consulta('fotosDoLote', { itemId: lote.id })).principal?.id).toBe('velha')
  })

  it('compra: com "Fotos" obrigatório no formulário, não registra sem foto', async () => {
    const { b } = await novoBackend()
    const f = await b.consulta('formCompra', {})
    await b.comando('salvarFormCompra', { form: { ...f, campos: f.campos.map((c) => (c.id === 'fotos' ? { ...c, visivel: true, obrigatorio: true } : c)) } })
    const dados = { id: 'cx', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 1000, moeda: 'BOB', total: bs(100), campos: { estado: 'Bruto' } }] }
    await expect(b.comando('criarCompra', dados)).rejects.toThrow(/foto/)
    await foto(b, 'f1', 'cx', 'pedido')
    expect((await b.comando('criarCompra', dados)).id).toBe('cx')
  })

  it('triagem: coluna com "exigir foto ao sair" só deixa o lote sair com foto própria (herdada não conta)', async () => {
    const { b } = await novoBackend()
    const { lote } = await compraNoEstoque(b, 'c1')
    await foto(b, 'fc', 'c1', 'pedido') // herdada: não basta
    // a lavagem saiu das colunas padrão (é opcional): o teste liga a coluna para ter para onde mover
    const colunas = [COLUNAS_PADRAO[0], COLUNA_LAVAGEM, ...COLUNAS_PADRAO.slice(1)].map((c) => (c.entrada ? { ...c, exigirFoto: true } : c))
    await b.comando('salvarFluxoTriagem', { moduloId: 'cabelo', colunas })
    expect((await b.consulta('fluxosTriagem', {}))[0].colunas[0].exigirFoto).toBe(true)
    await expect(b.comando('moverFaseTriagem', { ids: [lote.id], fase: 'preparando' })).rejects.toThrow(/Tire uma foto/)
    await expect(b.comando('triarLotes', { id: 't', ids: [lote.id], saidas: [{ id: 'p', quantidade: 9000, campos: { estado: 'Separado' } }] })).rejects.toThrow(/Tire uma foto/)
    await foto(b, 'fl', lote.id)
    expect((await b.comando('moverFaseTriagem', { ids: [lote.id], fase: 'preparando' })).alterados).toEqual([lote.id])
    // de uma coluna sem a regra, sai sem foto
    expect((await b.comando('triarLotes', { id: 't2', ids: [lote.id], saidas: [{ id: 'p2', quantidade: 9000, campos: { estado: 'Separado' } }] })).lotes).toEqual(['p2'])
  })

  it('etiquetas: código, medida · categoria · cor, peso, data, compras e a foto; o QR leva ao lote', async () => {
    const { b } = await novoBackend()
    const { lote, compra } = await compraNoEstoque(b, 'c1')
    await b.comando('separarLote', { id: 's1', loteId: lote.id, quantidadeUsada: 10000, saidas: [{ id: 'a', quantidade: 6000, campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } }] })
    await foto(b, 'fc', 'c1', 'produto')
    const [e] = await b.consulta('etiquetas', { ids: ['a'] })
    expect(e).toMatchObject({ id: 'a', medida: '60 cm', categoria: 'Normal', cor: 'Preto', saldo: 6000, inicial: 6000, unidade: 'grama', compras: compra.codigo })
    expect(e.codigo).toBeTruthy()
    expect(e.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(e.foto).toMatchObject({ id: 'fc', propria: false })
    await expect(b.consulta('etiquetas', { ids: [] })).rejects.toThrow(/pelo menos um/)
    // o endereço do QR volta para o lote no leitor
    expect(loteDoCodigoLido(enderecoDoLote('01JABC'))).toBe('01JABC')
    expect(loteDoCodigoLido('https://x.github.io/app/#/lotes/L1?aba=a')).toBe('L1')
    expect(loteDoCodigoLido('L-0001')).toBeUndefined()
  })
})

describe('QR sem dependência', () => {
  it('Reed-Solomon e bits de formato conferem com o exemplo da norma', () => {
    // ISO/IEC 18004, exemplo "01234567" em 1-M
    expect(correcaoRS([0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11], 10)).toEqual([0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55])
    expect(bitsFormato('M', 0).toString(2).padStart(15, '0')).toBe('101010000010010')
    expect(bitsFormato('L', 0).toString(2).padStart(15, '0')).toBe('111011111000100')
  })

  it('gera a matriz do tamanho da versão, com os localizadores nos cantos', () => {
    const m = gerarQR('https://logdrive023.github.io/dia-dia-tudo/#/lotes/01JC8Z6T9V4Q2M7K3P5R1X0YWE')
    expect([37, 41, 45]).toContain(m.length) // versão 5 a 7 no nível M
    const quadrado = (x: number, y: number) => m[y][x] && m[y][x + 6] && m[y + 6][x] && m[y + 6][x + 6] && !m[y + 1][x + 1] && m[y + 3][x + 3]
    expect(quadrado(0, 0) && quadrado(m.length - 7, 0) && quadrado(0, m.length - 7)).toBe(true)
    expect(gerarQR('L-1').length).toBe(21)
  })

  it('lê de volta (decodificador independente: formato, máscara, zigue-zague, blocos e modo byte)', () => {
    for (const texto of ['L-1', 'https://logdrive023.github.io/dia-dia-tudo/#/lotes/01JC8Z6T9V4Q2M7K3P5R1X0YWE', `#/lotes/${'x'.repeat(150)}`]) expect(lerQR(gerarQR(texto))).toBe(texto)
  })
})

/** Decodificador mínimo só para o teste (nível M, modo byte). */
function lerQR(m: boolean[][]): string {
  const n = m.length
  const v = (n - 17) / 4
  const fixo = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const marca = (x0: number, y0: number, w: number, h: number) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < n && y < n) fixo[y][x] = true }
  marca(0, 0, 9, 9); marca(n - 8, 0, 8, 9); marca(0, n - 8, 9, 8)
  marca(6, 0, 1, n); marca(0, 6, n, 1)
  if (v >= 7) { marca(n - 11, 0, 3, 6); marca(0, n - 11, 6, 3) }
  if (v > 1) {
    const q = Math.floor(v / 7) + 2
    const passo = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (q * 2 - 2)) * 2
    const ps = [6]
    for (let p = n - 7; ps.length < q; p -= passo) ps.splice(1, 0, p)
    ps.forEach((a, i) => ps.forEach((b, j) => { if (!((i === 0 && j === 0) || (i === 0 && j === q - 1) || (i === q - 1 && j === 0))) marca(a - 2, b - 2, 5, 5) }))
  }
  // formato (primeira cópia) → máscara
  let f = 0
  const pos: [number, number][] = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
  pos.forEach(([x, y], i) => { if (m[y][x]) f |= 1 << i })
  f ^= 0x5412
  expect(f >>> 13).toBe(0) // nível M
  const mascara = (f >>> 10) & 7
  const inv = [(x: number, y: number) => (x + y) % 2 === 0, (_: number, y: number) => y % 2 === 0, (x: number) => x % 3 === 0, (x: number, y: number) => (x + y) % 3 === 0, (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0, (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mascara]
  const bits: number[] = []
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5
    const sobe = ((dir + 1) & 2) === 0
    for (let k = 0; k < n; k++) {
      const y = sobe ? n - 1 - k : k
      for (const x of [dir, dir - 1]) if (!fixo[y][x]) bits.push(m[y][x] !== inv(x, y) ? 1 : 0)
    }
  }
  const palavras: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) palavras.push(bits.slice(i, i + 8).reduce((s, b) => (s << 1) | b, 0))
  // blocos (nível M): só os dados, desintercalados
  const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26][v]
  const NB = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5][v]
  const curtos = NB - (palavras.length % NB)
  const dadosCurto = Math.floor(palavras.length / NB) - ECC
  const blocos: number[][] = Array.from({ length: NB }, () => [])
  let k = 0
  for (let i = 0; i <= dadosCurto; i++) for (let j = 0; j < NB; j++) if (i < dadosCurto || j >= curtos) blocos[j].push(palavras[k++])
  const dados = blocos.flat()
  const fluxo = dados.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >>> (7 - i)) & 1))
  const ler = (p: number, len: number) => fluxo.slice(p, p + len).reduce((s, b) => (s << 1) | b, 0)
  expect(ler(0, 4)).toBe(0b0100)
  const cBits = v <= 9 ? 8 : 16
  const len = ler(4, cBits)
  const bytes = Array.from({ length: len }, (_, i) => ler(4 + cBits + i * 8, 8))
  return new TextDecoder().decode(new Uint8Array(bytes))
}
