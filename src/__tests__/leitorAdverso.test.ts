// LEITOR DE QR NA ADVERSIDADE: o QR da etiqueta (o mesmo gerador das etiquetas, nível M) desenhado como uma foto e
// estragado de propósito — tinta fraca (cinza em vez de preto), pouca luz (tudo escuro), ruído (papel/foto ruim),
// mancha (pedaço apagado) e QR invertido. O leitor tem de ler em todos; o realce de contraste é o que salva os piores.

import { describe, expect, it, beforeAll } from 'vitest'
import { gerarQR } from '../shared/ui/qr'
import { brilho, decodificar, realcar, prepararLeitor } from '../shared/ui/leitorImagem'
import jsQR from 'jsqr'

const TEXTO = 'https://loja.exemplo/#/lotes/01M6J1FCMWSRN4S3272X1ETV25'

/** desenha a matriz como uma "foto": escala, margem branca, cor da tinta e do papel; ruído e mancha opcionais */
function foto({ tinta = 0, papel = 255, escala = 6, ruido = 0, mancha = 0, invertido = false, semente = 7 }: { tinta?: number; papel?: number; escala?: number; ruido?: number; mancha?: number; invertido?: boolean; semente?: number } = {}) {
  const m = gerarQR(TEXTO, 'M')
  const lado = (m.length + 8) * escala
  const px = new Uint8ClampedArray(lado * lado * 4)
  let s = semente
  const aleat = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      const my = Math.floor(y / escala) - 4
      const mx = Math.floor(x / escala) - 4
      let escuro = my >= 0 && mx >= 0 && my < m.length && mx < m.length && m[my][mx]
      if (invertido) escuro = !escuro
      let v = escuro ? tinta : papel
      // mancha: um retângulo apagado no meio (fora dos 3 cantos de posição)
      const c = lado / 2
      if (mancha && Math.abs(x - c) < (lado * mancha) / 2 && Math.abs(y - c) < (lado * mancha) / 6) v = papel
      if (ruido) v += (aleat() - 0.5) * 2 * ruido
      const p = (y * lado + x) * 4
      px[p] = px[p + 1] = px[p + 2] = v
      px[p + 3] = 255
    }
  return { px, lado }
}

beforeAll(() => prepararLeitor())

describe('leitor de QR na adversidade', () => {
  it('etiqueta boa: lê', () => {
    const { px, lado } = foto()
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
  })

  it('TINTA FRACA (cinza claro no papel): lê', () => {
    const { px, lado } = foto({ tinta: 150, papel: 205 })
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
  })

  it('POUCA LUZ (foto escura): o brilho baixo é detectado e mesmo assim lê com o realce', () => {
    const { px, lado } = foto({ tinta: 8, papel: 48, ruido: 6 })
    expect(brilho(px)).toBeLessThan(55)
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
  })

  it('PAPEL/FOTO RUIM (ruído forte): lê', () => {
    const { px, lado } = foto({ ruido: 70 })
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
  })

  it('MANCHA (um pedaço apagado — a correção de erro do QR recupera): lê', () => {
    const { px, lado } = foto({ mancha: 0.22 })
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
  })

  it('TINTA DESBOTADA + PAPEL RUIM (pouco contraste e muito ruído): a suavização antes do realce lê', () => {
    for (const semente of [1, 2, 3, 4, 5]) {
      const { px, lado } = foto({ tinta: 100, papel: 130, ruido: 25, escala: 4, semente })
      expect(decodificar(px, lado, lado), `semente ${semente}`).toBe(TEXTO)
    }
  })

  it('QR INVERTIDO (claro no escuro): lê', () => {
    const { px, lado } = foto({ invertido: true })
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
  })

  it('o REALCE é o que salva o pior caso: escuro + pouco contraste + ruído', () => {
    const { px, lado } = foto({ tinta: 20, papel: 40, ruido: 5 })
    expect(decodificar(px, lado, lado)).toBe(TEXTO)
    // e sem o realce o caso fica mais difícil (o leitor simples pode falhar): o realce tem de ler sempre
    const realcada = realcar(px, lado, lado)
    expect(jsQR(realcada, lado, lado)?.data).toBe(TEXTO)
  })
})
