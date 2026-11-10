/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    // LARGURAS PADRÃO (docs/architecture/DESENHO.md §11.7): xs 360 (celular comum) · sm 640 · md 768 (tablet) · lg 1024 · xl 1280 · 2xl 1536.
    // Abaixo de 360 (celular pequeno, 240–359) é o padrão sem prefixo: tudo em uma coluna.
    // toque: celular/tablet (dedo). Ex.: min-h-10 toque:min-h-11 → 40 px no mouse, 44 px no dedo (alvo de toque mínimo)
    screens: { xs: '360px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px', toque: { raw: '(pointer: coarse)' } },
    extend: {
      colors: {
        marca: { 50: '#faf7ff', 100: '#f1eafe', 200: '#e2d4fd', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#3b1677' },
      },
    },
  },
  plugins: [],
}
