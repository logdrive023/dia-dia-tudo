// AUDITORIA › UMA AÇÃO na lista (memorizada: rolar e virar a página não redesenha as outras).
// Celular primeiro, de cima para baixo: [cabeçalho do dia, se começa um dia novo] · hora com segundos + área ·
// o que foi feito (o código técnico só a partir do tablet) · o resumo · quem fez + as referências.
import { memo } from 'react'
import type { CategoriaAuditoria, RefAuditoria } from '../../../core/services/auditoria'
import { cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'
import { COR_AREA, ICONE_AREA, NOME_AREA, horaSegundos } from '../model/auditoria'
import { RefsAuditoria } from './RefsAuditoria'

export interface LinhaLog {
  id: string
  em: string
  usuarioNome: string
  acao: string
  nomeAcao: string
  categoria: CategoriaAuditoria
  resumo: string
  refs: RefAuditoria[]
}

export const LinhaAuditoria = memo(function LinhaAuditoria({ l, dia, onAbrir, onRef }: {
  l: LinhaLog
  /** o cabeçalho do dia ("Hoje", "Ontem", "seg 08/11") quando esta linha começa um dia novo */
  dia?: { texto: string; n: number }
  onAbrir(id: string): void
  onRef(r: RefAuditoria): void
}) {
  const t = useT()
  const cor = COR_AREA[l.categoria]
  const recusa = l.categoria === 'recusa'
  return (
    <>
      {dia && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--borda)] bg-[var(--fundo)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--suave)]">
          <span>{dia.texto}</span>
          <span className="num font-semibold normal-case tracking-normal">{t('{n} ação(ões)', { n: dia.n })}</span>
        </div>
      )}
      <div role="button" tabIndex={0} onClick={() => onAbrir(l.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAbrir(l.id))}
        className={cx('relative flex min-h-11 cursor-pointer gap-3 py-3 pl-4 pr-3 text-left transition-colors hover:bg-[var(--fundo)] focus-visible:bg-[var(--fundo)] active:bg-[var(--fundo)]', recusa && 'bg-[var(--ruim)]/5')}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--suave)]">
            <span className="num font-mono font-semibold text-[var(--texto)]">{horaSegundos(l.em)}</span>
            <span className="inline-flex items-center gap-1" style={{ color: cor }}><span aria-hidden>{ICONE_AREA[l.categoria]}</span>{t(NOME_AREA[l.categoria])}</span>
          </span>
          <span className="block text-sm leading-snug">
            <b className={cx(recusa && 'text-[var(--ruim)]')}>{t(l.nomeAcao)}</b>
            <span className="ml-1.5 hidden rounded bg-[var(--fundo)] px-1 font-mono text-[10px] text-[var(--suave)] sm:inline">{l.acao}</span>
          </span>
          {l.resumo && <span className="block break-words text-sm text-[var(--suave)]">{l.resumo}</span>}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: `color-mix(in srgb, ${corDoNome(l.usuarioNome)} 18%, transparent)`, color: corDoNome(l.usuarioNome) }}>{iniciais(l.usuarioNome)}</span>
              {l.usuarioNome}
            </span>
            <RefsAuditoria refs={l.refs} onAbrir={onRef} />
          </span>
        </span>
        <span aria-hidden className="self-center text-[var(--suave)]">›</span>
      </div>
    </>
  )
})
