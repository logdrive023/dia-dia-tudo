// Ajudas dos testes: backend em memória com relógio controlado.

import { criarBackend } from '../app/criarBackend'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { dataLocal, somarDias } from '../core/domain/datas'

export function relogioFixo(inicio = '2026-11-01') {
  let hoje = inicio
  let seq = 0
  return {
    relogio: {
      // instantes sempre crescentes (a ordem dos movimentos importa)
      agora: () => `${hoje}T12:00:${String(Math.floor(seq / 1000) % 60).padStart(2, '0')}.${String(seq++ % 1000).padStart(3, '0')}Z`,
      hoje: () => hoje,
    },
    avancar(dias: number) {
      hoje = somarDias(hoje, dias)
    },
    get hoje() {
      return hoje
    },
  }
}

export async function novoBackend(inicio?: string) {
  const r = relogioFixo(inicio)
  const { backend, sessao } = criarBackend({ tipo: 'memory', relogio: r.relogio })
  const b = backend as BackendNoAparelho
  await b.comando('salvarConfig', { moedaPrincipal: 'BOB' })
  await b.comando('salvarCotacao', { id: 'cot-bob', moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
  await b.comando('salvarCotacao', { id: 'cot-usd', moeda: 'USD', valor: '5,40', sentido: 'basePorMoeda' })
  await b.comando('salvarCotacao', { id: 'cot-pyg', moeda: 'PYG', valor: '1450', sentido: 'moedaPorBase' })
  return { b, r, sessao }
}

export const hojeReal = () => dataLocal()
export const bs = (v: number) => Math.round(v * 100)
