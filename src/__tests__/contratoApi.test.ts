// CONTRATO DA API em dia: todo comando e toda consulta do app (src/core/services/index.ts) tem de estar no
// api-contract/openapi.yaml (NomeComando / NomeConsulta). Tudo o que o app faz vai para a API: se faltar no contrato,
// o servidor de verdade não saberia responder. Faltou? Rode `node scripts/contrato.mjs` (ou acrescente à mão).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { comandos, consultas } from '../core/services'

/** os nomes do enum de `nome` (NomeComando / NomeConsulta) no yaml */
function lista(yaml: string, nome: string) {
  const i = yaml.indexOf(`    ${nome}:`)
  const depois = yaml.slice(yaml.indexOf('enum:', i) + 5).replace(/\r\n/g, '\n')
  const itens: string[] = []
  for (const linha of depois.split('\n').slice(1)) {
    const m = /^ {8}- (\w+)\s*$/.exec(linha)
    if (!m) break
    itens.push(m[1])
  }
  return itens
}

describe('contrato da API (openapi.yaml)', () => {
  const yaml = readFileSync('api-contract/openapi.yaml', 'utf8')
  it('todo COMANDO do app está no contrato', () => {
    const noContrato = new Set(lista(yaml, 'NomeComando'))
    expect(Object.keys(comandos).filter((c) => !noContrato.has(c))).toEqual([])
  })
  it('toda CONSULTA do app está no contrato', () => {
    const noContrato = new Set(lista(yaml, 'NomeConsulta'))
    expect(Object.keys(consultas).filter((c) => !noContrato.has(c))).toEqual([])
  })
})
