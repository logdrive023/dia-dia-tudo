// DIAGNÓSTICO DO ESTOQUE, devagar e passo a passo (src/__tests__/diagnosticoEstoque.test.ts):
//   npm run diagnostico            400 ms entre as ações
//   npm run diagnostico -- 1000    1 s entre as ações
// Cada passo imprime: estoque, vendido, perda e se o custo fecha. Na suíte normal o mesmo teste roda sem espera.
import { spawnSync } from 'node:child_process'

const ms = Number(process.argv[2] ?? 400)
const r = spawnSync('npx', ['vitest', 'run', 'src/__tests__/diagnosticoEstoque.test.ts', '--reporter=verbose'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DIAG_LENTO_MS: String(Number.isFinite(ms) ? ms : 400), DIAG_VERBOSO: '1' },
})
process.exit(r.status ?? 1)
