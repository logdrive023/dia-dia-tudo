// BANDEIRAS desenhadas (SVG pequeno, 3:2): o Windows não mostra bandeira em emoji (vira "BO", "BR"), então o
// desenho vai junto no sistema — igual em todo aparelho e sem internet. Simplificadas (o que se reconhece de longe).
import type { ReactNode } from 'react'

const faixasH = (cores: string[]) => cores.map((c, k) => <rect key={k} x="0" y={(20 / cores.length) * k} width="30" height={20 / cores.length + 0.1} fill={c} />)
const faixasV = (cores: string[]) => cores.map((c, k) => <rect key={k} x={(30 / cores.length) * k} y="0" width={30 / cores.length + 0.1} height="20" fill={c} />)

const DESENHOS: Record<string, ReactNode> = {
  BO: faixasH(['#d52b1e', '#f9e300', '#007934']),
  BR: <><rect width="30" height="20" fill="#009c3b" /><path d="M15 2.5 27 10 15 17.5 3 10Z" fill="#ffdf00" /><circle cx="15" cy="10" r="4.2" fill="#002776" /></>,
  US: <>{Array.from({ length: 7 }, (_, k) => <rect key={k} y={(20 / 7) * k * 1} width="30" height={20 / 13} fill="#b22234" transform={`translate(0 ${(20 / 13) * k})`} />)}<rect width="30" height="20" fill="none" /><rect width="13" height="10.8" fill="#3c3b6e" /></>,
  PY: <>{faixasH(['#d52b1e', '#ffffff', '#0038a8'])}<circle cx="15" cy="10" r="2" fill="none" stroke="#0038a8" strokeWidth="0.8" /></>,
  AR: <>{faixasH(['#74acdf', '#ffffff', '#74acdf'])}<circle cx="15" cy="10" r="2.2" fill="#f6b40e" /></>,
  PE: faixasV(['#d91023', '#ffffff', '#d91023']),
  CL: <><rect width="30" height="10" fill="#ffffff" /><rect y="10" width="30" height="10" fill="#d52b1e" /><rect width="10" height="10" fill="#0039a6" /><circle cx="5" cy="5" r="1.8" fill="#ffffff" /></>,
  UY: <><rect width="30" height="20" fill="#ffffff" />{[1, 3, 5, 7].map((k) => <rect key={k} y={(20 / 9) * k} width="30" height={20 / 9} fill="#0038a8" />)}<rect width="11" height="11.1" fill="#ffffff" /><circle cx="5.5" cy="5.5" r="2.6" fill="#fcd116" /></>,
  CO: <><rect width="30" height="10" fill="#fcd116" /><rect y="10" width="30" height="5" fill="#003893" /><rect y="15" width="30" height="5" fill="#ce1126" /></>,
  MX: <>{faixasV(['#006847', '#ffffff', '#ce1126'])}<circle cx="15" cy="10" r="2.2" fill="#8c6d3f" /></>,
  EC: <><rect width="30" height="10" fill="#ffdd00" /><rect y="10" width="30" height="5" fill="#034ea2" /><rect y="15" width="30" height="5" fill="#ed1c24" /><circle cx="15" cy="10" r="2.2" fill="#6b8e23" /></>,
  VE: faixasH(['#ffcc00', '#00247d', '#cf142b']),
  PT: <><rect width="12" height="20" fill="#006600" /><rect x="12" width="18" height="20" fill="#ff0000" /><circle cx="12" cy="10" r="3" fill="#ffcc00" /></>,
  ES: <><rect width="30" height="20" fill="#aa151b" /><rect y="5" width="30" height="10" fill="#f1bf00" /></>,
  IT: faixasV(['#009246', '#ffffff', '#ce2b37']),
}

/** a bandeira do país (ISO: "BO", "BR"…); país sem desenho: as letras num quadradinho */
export function Bandeira({ pais, className }: { pais: string; className?: string }) {
  const d = DESENHOS[pais]
  if (!d) return <span className={`inline-flex h-4 w-6 items-center justify-center rounded-sm bg-[var(--fundo)] text-[9px] font-bold ${className ?? ''}`}>{pais}</span>
  return (
    <svg viewBox="0 0 30 20" aria-hidden className={`inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,.15)] ${className ?? ''}`}>{d}</svg>
  )
}
