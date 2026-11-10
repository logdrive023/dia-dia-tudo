// LEGENDA (padrão do sistema) — explica o que cada marca de cor quer dizer, sem a pessoa precisar decorar.
// Recebe GRUPOS ("Eventos", "Feriados"…) de itens; cada item é um chip com a MARCA (bolinha · quadradinho · apagada) e
// o nome. A forma da marca é a mesma que aparece na tela (ex.: no calendário, evento = bolinha, feriado = quadradinho).
// Cada grupo com o seu título e os chips ao lado; no celular o título fica em cima e os chips quebram de linha.
import { cx } from './base'
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
