// PONTA A PONTA com o servidor Go (../dia-dia-tudo-backend) — SEPARADO da suíte normal (precisa do servidor no ar).
// Rodar: npm run test:ponta   (o script ponta-a-ponta do backend sobe o servidor, roda isto e derruba)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['ponta-a-ponta/**/*.ponta.test.ts'],
    environment: 'node',
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
