// Ícones de linha (mesmo traço e tamanho em todo o menu: reconhecer é mais fácil que lembrar).

const CAMINHOS: Record<string, string> = {
  painel: 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z',
  vender: 'M3 3h2l2.4 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  agenda: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 7h2m4 0h2m-8 4h2',
  caixa: 'M3 7h18v10H3z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M6 10v.01M18 14v.01',
  viagens: 'M3 17h18M5 17l1.5-6h11L19 17M8 11V8a4 4 0 0 1 8 0v3 M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  comprar: 'M12 3v12m0 0-4-4m4 4 4-4 M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2',
  triagem: 'M3 4h18l-7 8.5V19l-4 2v-8.5z',
  estoque: 'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  etiquetas: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z M7.5 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  precos: 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2',
  pessoas: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M5 18a2 2 0 0 1 2-2h12 M9 8h6',
  equipe: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a6 6 0 0 1 12 0v1 M16 3.1a4 4 0 0 1 0 7.8 M22 21v-1a6 6 0 0 0-4-5.7',
  emprestimos: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  adiantamentos: 'M2 12h6l3-3h4l2 2-3 2H11 M2 18h4l5 2 9-5-2-2-5 2 M14 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  relatorios: 'M4 20V10m6 10V4m6 16v-7m6 7H2',
  livro: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 1 2-2h13 M8 7h7M8 11h5',
  novidades: 'M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z',
  config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  mais: 'M4 6h16M4 12h16M4 18h16',
  recolher: 'M15 6l-6 6 6 6',
  expandir: 'M9 6l6 6-6 6',
  sair: 'M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4 M10 17l5-5-5-5 M15 12H3',
}

/** tem um desenho próprio (sem cair no do painel)? */
export const temIcone = (nome: string) => nome in CAMINHOS

export function Icone({ nome, className = 'h-5 w-5' }: { nome: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={CAMINHOS[nome] ?? CAMINHOS.painel} />
    </svg>
  )
}
