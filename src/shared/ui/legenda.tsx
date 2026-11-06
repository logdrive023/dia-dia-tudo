// LEGENDA (padrão do sistema) — explica o que cada marca de cor quer dizer, sem a pessoa precisar decorar.
// Recebe GRUPOS ("Eventos", "Feriados"…) de itens; cada item é um chip com a MARCA (bolinha · quadradinho · apagada) e
// o nome. A forma da marca é a mesma que aparece na tela (ex.: no calendário, evento = bolinha, feriado = quadradinho).
// Moldura leve, cada grupo com o seu título (sem divisor: ele ficava torto quando o grupo quebra de linha); no celular os chips quebram de linha sem apertar o texto.
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
  /** a dica curta ao lado do título (ex.: "bolinha") */
  dica?: string
  itens: ItemLegenda[]
}

/** a marca (o mesmo desenho da tela): bolinha, quadradinho ou bolinha apagada (já feito) */
export function Marca({ cor, forma = 'bolinha', className }: { cor: string; forma?: FormaMarca; className?: string }) {
  // a marca com um anel suave da própria cor: lê melhor no claro e no escuro, sem caixa em volta
  return <span aria-hidden className={cx('inline-block h-2.5 w-2.5 shrink-0', forma === 'quadrado' ? 'rounded-[3px]' : 'rounded-full', forma === 'apagada' && 'opacity-40', className)} style={{ background: cor, boxShadow: `0 0 0 3px color-mix(in srgb, ${cor} 18%, transparent)` }} />
}

export function Legenda({ grupos, titulo = 'Legenda', className }: { grupos: GrupoLegenda[]; titulo?: string; className?: string }) {
  const t = useT()
  const cheios = grupos.filter((g) => g.itens.length)
  if (!cheios.length) return null
  return (
    <section aria-label={t(titulo)} className={cx('overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm', className)}>
      {/* os grupos lado a lado (computador) ou um embaixo do outro (celular), separados por uma linha fina */}
      <div className={cx('grid divide-y divide-[var(--borda)] sm:divide-x sm:divide-y-0', cheios.length > 1 && 'sm:grid-cols-[auto_1fr]')}>
        {cheios.map((g, k) => (
          <div key={g.titulo ?? k} className="min-w-0 px-4 py-3">
            <p className="mb-2 flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t(g.titulo ?? titulo)}</span>
              {g.dica && <span className="text-[11px] text-[var(--suave)] opacity-80">{t(g.dica)}</span>}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {g.itens.map((i) => (
                <li key={i.id} title={i.dica ? t(i.dica) : undefined} className="inline-flex items-center gap-2 text-[13px]">
                  <Marca cor={i.cor} forma={i.forma} />
                  <span className="whitespace-nowrap">{t(i.nome)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
