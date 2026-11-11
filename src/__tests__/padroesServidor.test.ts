import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { padroesServidor } from '../core/services/padroesServidor'

// O servidor Go lê os padrões do sistema de api-contract/padroes.json: mudou a configuração padrão, um imposto padrão
// ou um módulo → rodar `npx vite-node scripts/exportar-padroes.ts` (atualiza o arquivo e a cópia do servidor).
describe('padrões do servidor', () => {
  it('api-contract/padroes.json está igual ao código', () => {
    const arquivo = JSON.parse(readFileSync(join(process.cwd(), 'api-contract', 'padroes.json'), 'utf8'))
    expect(arquivo).toEqual(JSON.parse(JSON.stringify(padroesServidor())))
  })
})
