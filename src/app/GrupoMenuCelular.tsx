// MENU DO CELULAR (gaveta "Mais") — um GRUPO que abre e fecha, como no computador.
//   · o cabeçalho inteiro é o botão (alvo de 48 px), com a seta à direita: › fechado, ⌄ aberto (gira suave)
//   · fechado, mostra o contador do grupo (o que pede atenção não some)
//   · abre/fecha com transição de altura (grid 0fr → 1fr), sem pular; respeita "menos movimento"
//   · o grupo da tela atual nunca fica fechado (quem decide é o Shell)
import { type ReactNode, useId } from 'react'
import { cx } from '../shared/ui/base'
import { useT } from '../shared/ui/i18n'

export function GrupoMenuCelular({ nome, cor, aberto, podeFechar, onAlternar, selo, children }: {
  nome: string
  cor: string
  aberto: boolean
  /** o grupo da tela atual não fecha (a seta some) */
  podeFechar: boolean
  onAlternar(): void
  /** o contador do grupo, mostrado só quando fechado */
  selo?: ReactNode
  children: ReactNode
}) {
  const t = useT()
  const id = useId()
  return (
    <section className="mb-3 rounded-xl" style={{ background: `color-mix(in srgb, ${cor} 7%, transparent)`, borderLeft: `3px solid ${cor}` }}>
      <h2>
        <button type="button" disabled={!podeFechar} onClick={onAlternar} aria-expanded={aberto} aria-controls={id}
          className="flex min-h-12 w-full touch-manipulation items-center gap-2 rounded-xl px-3 text-left text-xs font-bold uppercase tracking-wide active:bg-[var(--fundo)] disabled:cursor-default"
          style={{ color: cor }}>
          <span className="flex-1">{t(nome)}</span>
          {!aberto && selo}
          {podeFechar && (
            <span aria-hidden className={cx('flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform duration-200 motion-reduce:transition-none', aberto ? 'rotate-90' : '')}>›</span>
          )}
        </button>
      </h2>
      <div id={id} className={cx('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        {/* fechado: invisible tira os itens do Tab e do leitor de tela (não dá para focar o que não se vê) */}
        <div className={cx('min-h-0 overflow-hidden', !aberto && 'invisible')}>
          <div className="pb-1">{children}</div>
        </div>
      </div>
    </section>
  )
}
