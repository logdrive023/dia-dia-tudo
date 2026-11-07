/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Hosts externos que o app chama (src/app/cambio.ts). Mudou a fonte do câmbio? Atualize aqui.
const HOSTS_CAMBIO = ['https://open.er-api.com']

/** Origem (https://host:porta) de um endereço; vazio se não for um endereço válido. */
function origem(url?: string): string {
  try {
    return url ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

/**
 * Content-Security-Policy só no build (no `npm run dev` o Vite injeta script inline do recarregamento rápido).
 * Sem script inline, sem eval; rede só para o próprio site, o câmbio e a API (VITE_API_URL).
 * frame-ancestors não vale em <meta>: no servidor de verdade mande também como cabeçalho HTTP.
 */
function cspNoBuild(apiUrl?: string): Plugin {
  const connect = ["'self'", ...HOSTS_CAMBIO, origem(apiUrl)].filter(Boolean).join(' ')
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
  return {
    name: 'tudo-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: politica }, injectTo: 'head-prepend' }],
    },
  }
}

// Publicado em https://logdrive023.github.io/dia-dia-tudo/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const build = command === 'build'
  return {
    base: build ? '/dia-dia-tudo/' : '/',
    plugins: [
      react(),
      cspNoBuild(env.VITE_API_URL),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Tudo · gestão do dia a dia',
          short_name: 'Tudo',
          description: 'Cabelo, salão e empréstimos num só lugar. Funciona sem internet.',
          lang: 'pt-BR',
          theme_color: '#7c3aed',
          background_color: '#faf7ff',
          display: 'standalone',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        // o app é um arquivo só (~2,2 MB): o limite padrão do cache offline (2 MiB) deixava ele de fora e quebrava o build
        workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
      }),
    ],
    // produção: sem mapa do código-fonte, sem console/debugger e sem comentários de licença no pacote
    build: { chunkSizeWarningLimit: 900, sourcemap: false },
    esbuild: build ? { drop: ['console', 'debugger'], legalComments: 'none' } : undefined,
    test: {
      environment: 'jsdom',
      // testes de regra (.test.ts) rodam em Node puro (sem simular navegador): sobem bem mais rápido
      environmentMatchGlobs: [['src/__tests__/**/*.test.ts', 'node'], ['src/features/**/*.test.ts', 'node']],
      setupFiles: ['src/__tests__/setup.ts'],
      // a Operação Caos (estresse e concorrência) roda à parte: npx vitest run --config vitest.caos.config.ts
      // e o ponta a ponta com o servidor Go (precisa do servidor no ar): npm run test:ponta
      exclude: ['**/node_modules/**', 'caos/**', 'ponta-a-ponta/**'],
      testTimeout: 60000,
      // arquivos em paralelo (cada um no seu processo, com o próprio banco): ~4x mais rápido que um por vez
      pool: 'forks',
      poolOptions: { forks: { maxForks: 6, minForks: 2 } },
    },
  }
})
