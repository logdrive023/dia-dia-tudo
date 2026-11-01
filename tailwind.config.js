/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        marca: { 50: '#faf7ff', 100: '#f1eafe', 200: '#e2d4fd', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#3b1677' },
      },
    },
  },
  plugins: [],
}
