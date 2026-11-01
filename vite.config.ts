/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Publicado em https://logdrive023.github.io/dia-dia-tudo/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dia-dia-tudo/' : '/',
  plugins: [
    react(),
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
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  build: { chunkSizeWarningLimit: 900 },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 60000,
    fileParallelism: false,
  },
}))
