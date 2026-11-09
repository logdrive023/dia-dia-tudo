// O VISUAL DA LOJA em contas puras: de `AparenciaVitrine` (as cores e o fundo escolhidos) para as variáveis de CSS que a
// loja e a prévia usam. Um lugar só: o que a prévia mostra é o que o comprador vê. Cuida da leitura: texto sobre a cor
// primária (branco ou preto) e preço legível no cartão (cor clara demais não some no fundo claro).
import type { CSSProperties } from 'react'
import type { AparenciaVitrine, FundoVitrine } from '../../../core/services/vitrine'

function luminancia(hex: string) {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}
/** contraste WCAG entre duas cores #rrggbb (1 a 21) */
export function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** branco ou preto: o que se lê melhor sobre a cor */
export const textoSobre = (cor: string) => (contraste(cor, '#ffffff') >= contraste(cor, '#111111') ? '#ffffff' : '#111111')

const CLARO = { fundo: '#f7f5fb', cartao: '#ffffff', texto: '#1c1a26', suave: '#6b6780', borda: '#e4e0ee' }
const ESCURO = { fundo: '#121118', cartao: '#1e1c27', texto: '#f4f2fa', suave: '#a6a2b8', borda: '#322f40' }
/** as cores de superfície de cada fundo ('tema' não força: segue o claro/escuro de quem abre) */
const SUPERFICIE: Record<Exclude<FundoVitrine, 'tema'>, typeof CLARO> = { claro: CLARO, escuro: ESCURO, gradiente: ESCURO, pontos: CLARO }

/** os fundos para escolher (a amostra é a mesma conta da loja) */
export const OPCOES_FUNDO: { id: FundoVitrine; nome: string; dica: string }[] = [
  { id: 'tema', nome: 'Automático', dica: 'Claro ou escuro, como o aparelho do comprador' },
  { id: 'claro', nome: 'Claro', dica: 'Fundo claro para todos' },
  { id: 'escuro', nome: 'Escuro', dica: 'Fundo escuro para todos' },
  { id: 'gradiente', nome: 'Gradiente', dica: 'Escuro, com as suas cores' },
  { id: 'pontos', nome: 'Pontilhado', dica: 'Claro, com pontinhos da sua cor' },
]

/** combinações prontas (um toque preenche as duas cores) */
export const PALETAS: { nome: string; primaria: string; secundaria: string }[] = [
  { nome: 'Violeta', primaria: '#7c3aed', secundaria: '#a21caf' },
  { nome: 'Rosa', primaria: '#db2777', secundaria: '#9d174d' },
  { nome: 'Dourado', primaria: '#b45309', secundaria: '#78350f' },
  { nome: 'Esmeralda', primaria: '#059669', secundaria: '#065f46' },
  { nome: 'Azul', primaria: '#2563eb', secundaria: '#1e3a8a' },
  { nome: 'Grafite', primaria: '#374151', secundaria: '#111827' },
]

function fundoDaPagina(a: AparenciaVitrine): CSSProperties {
  const p = a.corPrimaria
  const s = a.corSecundaria
  if (a.fundo === 'tema') return { background: 'var(--fundo)' }
  if (a.fundo === 'gradiente') return { background: `linear-gradient(165deg, color-mix(in srgb, ${p} 30%, ${ESCURO.fundo}), ${ESCURO.fundo} 60%, color-mix(in srgb, ${s} 24%, ${ESCURO.fundo}))` }
  if (a.fundo === 'pontos') return { backgroundColor: CLARO.fundo, backgroundImage: `radial-gradient(color-mix(in srgb, ${p} 28%, transparent) 1.2px, transparent 1.2px)`, backgroundSize: '18px 18px' }
  return { background: SUPERFICIE[a.fundo].fundo }
}

/** a cor primária é legível sobre o cartão? (no automático, precisa valer no claro E no escuro) */
export function primariaLegivel(a: AparenciaVitrine) {
  const cartoes = a.fundo === 'tema' ? [CLARO.cartao, ESCURO.cartao] : [SUPERFICIE[a.fundo].cartao]
  return cartoes.every((c) => contraste(a.corPrimaria, c) >= 3)
}

/** as variáveis de CSS e o fundo: vão na raiz da loja (e só nela: o resto do sistema não muda) */
export function estiloLoja(a: AparenciaVitrine): CSSProperties {
  const sup = a.fundo === 'tema' ? undefined : SUPERFICIE[a.fundo]
  return {
    ...fundoDaPagina(a),
    '--marca': a.corPrimaria,
    '--marca-suave': `color-mix(in srgb, ${a.corPrimaria} 16%, transparent)`,
    '--sobre-marca': textoSobre(a.corPrimaria),
    // preço e destaques no cartão: a cor escolhida, ou o texto normal se ela sumiria no fundo
    '--marca-texto': primariaLegivel(a) ? a.corPrimaria : 'var(--texto)',
    ...(sup ? { '--fundo': sup.fundo, '--cartao': sup.cartao, '--texto': sup.texto, '--suave': sup.suave, '--borda': sup.borda } : {}),
  } as CSSProperties
}

/** o topo sem banner: as duas cores */
export const gradienteCapa = (a: AparenciaVitrine) => `radial-gradient(120% 120% at 0% 0%, ${a.corPrimaria}, ${a.corSecundaria} 55%, #1f1b1a)`
/** cor clara no topo: escurece um pouco para o texto branco continuar legível */
export const capaPrecisaEscurecer = (a: AparenciaVitrine) => contraste(a.corPrimaria, '#ffffff') < 3
