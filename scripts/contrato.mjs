// Atualiza o CONTRATO DA API (api-contract/openapi.yaml) com os comandos e consultas que o app tem de verdade
// (src/core/services/index.ts). Rode depois de criar um comando/consulta:  node scripts/contrato.mjs
// O teste src/__tests__/contratoApi.test.ts falha se alguém esquecer.

import { readFileSync, writeFileSync } from 'node:fs'

const idx = readFileSync('src/core/services/index.ts', 'utf8')
const bloco = (nome) => {
  const i = idx.indexOf(`export const ${nome} = {`)
  const fim = idx.indexOf('\n}', i)
  return [...idx.slice(i, fim).matchAll(/^ {2}(\w+):/gm)].map((m) => m[1])
}
const yamlArq = 'api-contract/openapi.yaml'
const crlf = readFileSync(yamlArq, 'utf8').includes('\r\n')
let yaml = readFileSync(yamlArq, 'utf8').replace(/\r\n/g, '\n')
const trocar = (tipo, nomes) => {
  const i = yaml.indexOf(`    ${tipo}:`)
  if (i < 0) throw new Error(`sem ${tipo} no contrato`)
  const e = yaml.indexOf('enum:\n', i) + 'enum:\n'.length
  let f = e
  const linhas = yaml.slice(e).split('\n')
  for (const l of linhas) { if (!/^ {8}- \w+\s*$/.test(l)) break; f += l.length + 1 }
  yaml = yaml.slice(0, e) + nomes.map((n) => `        - ${n}\n`).join('') + yaml.slice(f)
}
const c = bloco('comandos')
const q = bloco('consultas')
trocar('NomeComando', c)
trocar('NomeConsulta', q)
writeFileSync(yamlArq, crlf ? yaml.replace(/\n/g, '\r\n') : yaml)
console.log(`contrato: ${c.length} comandos · ${q.length} consultas`)
