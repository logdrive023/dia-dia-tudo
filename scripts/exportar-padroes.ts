// PADRÕES PARA O SERVIDOR: o que não é dado da empresa e sim do próprio sistema (a configuração padrão, os impostos
// padrão e os módulos com os seus campos) sai daqui, do código do app, para o servidor Go — uma fonte só.
//   npx vite-node scripts/exportar-padroes.ts
// Escreve api-contract/padroes.json e, se a pasta existir, ../dia-dia-tudo-backend/internal/domains/comum/entities/padroes.json.
// O teste padroesServidor.test.ts avisa quando o código mudou e o arquivo ficou velho.
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { padroesServidor } from '../src/core/services/padroesServidor'

const json = JSON.stringify(padroesServidor(), null, 2) + '\n'
const destinos = [join(process.cwd(), 'api-contract', 'padroes.json')]
const back = resolve(process.cwd(), '..', 'dia-dia-tudo-backend', 'internal', 'domains', 'comum', 'entities')
if (existsSync(back)) destinos.push(join(back, 'padroes.json'))
for (const d of destinos) {
  writeFileSync(d, json)
  console.log(`escrito: ${d}`)
}
