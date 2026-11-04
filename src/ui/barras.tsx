// BARRAS (padrão do sistema todo), em dois tipos:
//  · BarraPartes: uma barra dividida em pedaços coloridos (para onde foi cada grama, vendas por forma de pagamento)
//  · BarraLimite: quanto do limite já foi usado (orçamento da viagem): verde, âmbar perto do fim (> 85%), vermelho ao passar

import { cx } from './base'

/** `total`: a base da barra (sem ele, a soma das partes); pedaço com valor 0 não aparece */
export function BarraPartes({ partes, total, altura = 'h-2.5', rotulo, className }: {
  partes: { chave: string; valor: number; cor: string }[]
  total?: number
  /** altura em classe Tailwind (h-2, h-2.5, h-4) */
  altura?: string
  /** texto para leitor de tela (sem ele a barra é só enfeite: o detalhe já está escrito ao lado) */
  rotulo?: string
  className?: string
}) {
  const base = Math.max(total ?? 0, partes.reduce((s, p) => s + p.valor, 0), 1)
  return (
    <div role={rotulo ? 'img' : undefined} aria-label={rotulo} aria-hidden={rotulo ? undefined : true} className={cx('flex w-full overflow-hidden rounded-full bg-[var(--fundo)]', altura, className)}>
      {partes.filter((p) => p.valor > 0).map((p) => <span key={p.chave} className="h-full" style={{ width: `${(p.valor * 100) / base}%`, background: p.cor }} />)}
    </div>
  )
}

/** cor do uso: até 85% verde; até 100% âmbar; passou, vermelho */
export const corDoUso = (pct: number) => (pct > 100 ? 'var(--ruim)' : pct > 85 ? 'var(--alerta)' : 'var(--bom)')

/** quanto do limite foi usado (usado ÷ previsto); sem previsto não desenha nada */
export function BarraLimite({ usado, previsto, altura = 'h-2.5', className }: { usado: number; previsto?: number; altura?: string; className?: string }) {
  if (!previsto) return null
  const pct = Math.round((usado * 100) / previsto)
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} className={cx('block overflow-hidden rounded-full bg-[var(--fundo)]', altura, className)}>
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: corDoUso(pct) }} />
    </div>
  )
}
