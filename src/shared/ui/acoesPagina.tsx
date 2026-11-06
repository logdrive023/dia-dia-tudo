// AÇÕES DO CABEÇALHO (padrão do sistema): botões com ícone + nome (o nome some no celular, o ícone fica) e uma DICA
// que aparece ao passar o mouse ou focar pelo teclado ("Ler código: aponte a câmera para a etiqueta…"). Para o leitor
// de tela, o nome é o rótulo e a dica é a descrição. Hierarquia: `principal` = botão cheio; o resto = secundário.

import { type ReactNode, useId } from 'react'
import { cx } from './base'
import { useT } from './i18n'

/** Dica de passar o mouse / focar (embaixo do botão; nas ações do cabeçalho, presa à DIREITA do botão — elas ficam na beira
 * direita da página, centrada a dica saía da tela). Nunca mais larga que a tela. Só texto curto: explicação longa vai no ⓘ. */
export function Dica({ id, texto, lado = 'centro' }: { id: string; texto: string; lado?: 'centro' | 'direita' }) {
  const t = useT()
  return (
    <span id={id} role="tooltip"
      className={cx('pointer-events-none absolute top-full z-40 mt-2 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-[var(--texto)] px-2.5 py-1.5 text-left text-xs font-medium leading-snug text-[var(--cartao)] opacity-0 shadow-lg transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100',
        lado === 'direita' ? 'right-0' : 'left-1/2 -translate-x-1/2')}>
      {t(texto)}
    </span>
  )
}

/**
 * Ação do cabeçalho: ícone + nome (o nome some abaixo de `sm`) + dica. `ativo` = liga/desliga (ex.: ⚙ Opções aberto).
 * `principal` = a ação mais importante da tela (botão cheio). `comNome`: o nome aparece também no celular (a ação
 * que a pessoa precisa achar, ex.: 📷 Ler código).
 */
export function AcaoIcone({ icone, rotulo, dica, onClick, ativo, principal, lado = 'direita', comNome }: { icone: ReactNode; rotulo: string; dica: string; onClick(): void; ativo?: boolean; principal?: boolean; lado?: 'centro' | 'direita'; comNome?: boolean }) {
  const t = useT()
  const id = useId()
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={onClick} aria-label={t(rotulo)} aria-describedby={id} aria-pressed={ativo}
        className={cx('group relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marca)]',
          principal ? 'bg-[var(--marca)] text-white hover:brightness-110'
            : ativo ? 'border border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]'
              : 'border border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)] hover:text-[var(--marca)]')}>
        <span aria-hidden className="text-lg leading-none">{icone}</span>
        <span className={comNome ? undefined : 'hidden sm:inline'}>{t(rotulo)}</span>
        <Dica id={id} texto={dica} lado={lado} />
      </button>
    </span>
  )
}
