// OPERAÇÃO CAOS — testes de estresse, concorrência e integridade, SEPARADOS da suíte normal (não rodam no npm test).
// Rodar: npx vitest run --config vitest.caos.config.ts
// Teste que FALHA aqui = bug encontrado (cada um tem a reprodução no próprio teste). Dados só fictícios e isolados.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['caos/**/*.caos.test.ts'],
    environment: 'node',
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 600000,
    hookTimeout: 600000,
    pool: 'forks',
    poolOptions: { forks: { maxForks: 4, minForks: 1 } },
  },
})
