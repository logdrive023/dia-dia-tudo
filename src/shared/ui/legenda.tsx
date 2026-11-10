// LEGENDA (padrão do sistema) — explica o que cada marca de cor quer dizer, sem a pessoa precisar decorar.
// Recebe GRUPOS ("Eventos", "Feriados"…) de itens; cada item é um chip com a MARCA (bolinha · quadradinho · apagada) e
// o nome. A forma da marca é a mesma que aparece na tela (ex.: no calendário, evento = bolinha, feriado = quadradinho).
// Cada grupo com o seu título e os chips ao lado; no celular o título fica em cima e os chips quebram de linha.
import { Pilula, type Tom, cx } from './base'
import { useT } from './i18n'

export type FormaMarca = 'bolinha' | 'quadrado' | 'apagada'

export interface ItemLegenda {
  id: string
  nome: string
  cor: string
  forma?: FormaMarca
  /** uma explicação curta (tooltip) */
  dica?: string
}

export interface GrupoLegenda {
  titulo?: string
  itens: ItemLegenda[]
}

/** a marca (o mesmo desenho da tela): bolinha, quadradinho ou bolinha apagada (já feito) */
export function Marca({ cor, forma = 'bolinha', className }: { cor: string; forma?: FormaMarca; className?: string }) {
  return <span aria-hidden className={cx('inline-block h-2 w-2 shrink-0', forma === 'quadrado' ? 'rounded-[3px]' : 'rounded-full', forma === 'apagada' && 'opacity-40', className)} style={{ background: cor }} />
}

export function Legenda({ grupos, titulo = 'Legenda', className }: { grupos: GrupoLegenda[]; titulo?: string; className?: string }) {
  const t = useT()
  const cheios = grupos.filter((g) => g.itens.length)
  if (!cheios.length) return null
  return (
    <section aria-label={t(titulo)} className={cx('flex flex-col gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-4 py-3 shadow-sm lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8', className)}>
      {cheios.map((g, k) => (
        <div key={g.titulo ?? k} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--suave)]">{t(g.titulo ?? titulo)}</span>
          <ul className="flex flex-wrap gap-1.5">
            {g.itens.map((i) => (
              <li key={i.id} title={i.dica ? t(i.dica) : undefined} className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--fundo)] px-2.5 text-xs font-medium">
                <Marca cor={i.cor} forma={i.forma} />
                {t(i.nome)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

// ---------- LEGENDA DE SELOS (o que quer dizer cada Pilula) ----------
// Celular: uma linha com os selos + "O que quer dizer? ›" (abre no toque, a explicação de cada um embaixo).
// Computador: a lista aberta, selo à esquerda (nunca cortado) e a explicação ao lado.

export interface SeloLegenda {
  id: string
  nome: string
  tom: Tom
  /** o que o selo quer dizer (uma frase curta) */
  dica: string
}

function ListaSelos({ itens }: { itens: SeloLegenda[] }) {
  const t = useT()
  return (
    <ul className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2 text-xs">
      {itens.map((i) => (
        <li key={i.id} className="contents">
          <Pilula pequena tom={i.tom} className="w-fit shrink-0 whitespace-nowrap">{t(i.nome)}</Pilula>
          <span className="min-w-0 pt-0.5 text-[var(--suave)]">{t(i.dica)}</span>
        </li>
      ))}
    </ul>
  )
}

export function LegendaSelos({ itens, titulo = 'O que quer dizer cada selo', className }: { itens: SeloLegenda[]; titulo?: string; className?: string }) {
  const t = useT()
  return (
    <section aria-label={t(titulo)} className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-4 py-3', className)}>
      <details className="group sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {itens.map((i) => <Pilula key={i.id} pequena tom={i.tom} className="shrink-0 whitespace-nowrap">{t(i.nome)}</Pilula>)}
          </span>
          <span className="shrink-0 text-xs font-semibold text-[var(--marca)]">{t('O que quer dizer?')} <span aria-hidden className="inline-block transition group-open:rotate-90">›</span></span>
        </summary>
        <div className="mt-3 border-t border-[var(--borda)] pt-3"><ListaSelos itens={itens} /></div>
      </details>
      <div className="hidden sm:block">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--suave)]">{t(titulo)}</p>
        <ListaSelos itens={itens} />
      </div>
    </section>
  )
}
