// TEMA (claro / escuro / automático): escolha de cada aparelho, guardada nele (localStorage "tudo.tema").
// Automático segue o aparelho (prefers-color-scheme); claro/escuro põem <html data-tema="…"> e o index.css força as cores.
// Aplicado no main.tsx antes da primeira tela (sem piscar).

export type Tema = 'auto' | 'claro' | 'escuro'
export const TEMAS: { id: Tema; nome: string; icone: string }[] = [
  { id: 'claro', nome: 'Claro', icone: '☀️' },
  { id: 'escuro', nome: 'Escuro', icone: '🌙' },
  { id: 'auto', nome: 'Automático', icone: '🖥' },
]
const CHAVE = 'tudo.tema'

export function lerTema(): Tema {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'claro' || v === 'escuro' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function aplicarTema(t: Tema) {
  const html = document.documentElement
  if (t === 'auto') delete html.dataset.tema
  else html.dataset.tema = t
}

export function salvarTema(t: Tema) {
  try {
    if (t === 'auto') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, t)
  } catch {
    /* sem armazenamento (aba privada): vale só nesta visita */
  }
  aplicarTema(t)
}
