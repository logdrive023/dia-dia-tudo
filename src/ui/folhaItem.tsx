// FOLHA DE UM ITEM — o mesmo desenho para tudo que abre ao tocar (agenda: atendimento, compromisso, viagem, parcela):
//   ┌ [ícone na cor do tipo]  Título                                  × ┐
//   │                          Atendimento · ● Agendado                  │
//   │  📅 Quando   qui 05/11 · 10:00–11:30       💵 Bs 250,00 (destaque) │
//   │  👤 Cliente  Beatriz                                               │
//   │  [        ✓ Ação principal (a mais provável)       ]               │
//   │  [ secundária ] [ secundária ]                                     │
//   │  Abrir venda →                                  Desmarcar (perigo) │
//   └────────────────────────────────────────────────────────────────────┘
//   numeros: um bloco de números em cartões ("Desempenho no período"); o que abre algo ganha › e um toque abre.
// Quem usa só diz o QUE mostrar (fatos, números, ações); o COMO é sempre este. Usada na agenda e na equipe.
import type { ReactNode } from 'react'
import { Botao, Janela, cx } from './base'
import { useT } from './i18n'

export interface FatoFolha { icone: string; rotulo: string; valor?: ReactNode }
export interface NumeroFolha { rotulo: string; valor: string; icone?: string; tom?: 'bom' | 'ruim' | 'alerta'; onClick?(): void }
export interface AcaoFolha { rotulo: string; icone?: string; onClick(): void; disabled?: boolean; href?: string }

export function FolhaItem({ icone, cor, tipo, titulo, riscado, selos, fatos, destaque, numeros, aviso, principal, secundarias = [], abrir, perigo, onFechar, aberta = true, children }: {
  /** emoji do tipo ou um avatar (iniciais) */
  icone: ReactNode
  /** a cor do tipo (a mesma do calendário) */
  cor: string
  /** o nome do tipo ("Atendimento") */
  tipo: string
  titulo: string
  /** feito/cancelado: título riscado */
  riscado?: boolean
  /** a situação (pílulas) */
  selos?: ReactNode
  fatos: FatoFolha[]
  /** o número que importa (valor), à direita dos fatos */
  destaque?: { rotulo: string; valor: string; tom?: 'bom' | 'ruim' | 'alerta'; sub?: string }
  /** um bloco de números (título + cartões) */
  numeros?: { titulo: string; sub?: string; itens: NumeroFolha[] }
  /** algo a mais da tela, entre os números e as ações */
  children?: ReactNode
  /** um aviso em faixa (horário ocupado, parcela atrasada) */
  aviso?: { texto: string; tom: 'alerta' | 'ruim' }
  principal?: AcaoFolha
  secundarias?: AcaoFolha[]
  /** abrir o registro completo (rodapé, à esquerda) */
  abrir?: AcaoFolha
  /** a ação que desfaz/apaga (rodapé, à direita, em vermelho) */
  perigo?: AcaoFolha
  onFechar(): void
  aberta?: boolean
}) {
  const t = useT()
  const vistos = fatos.filter((f) => f.valor !== undefined && f.valor !== null && f.valor !== '')
  const corTom = { bom: 'var(--bom)', ruim: 'var(--ruim)', alerta: 'var(--alerta)' }
  const botao = (a: AcaoFolha, variante: 'primario' | 'secundario', extra?: string) =>
    a.href
      ? <a key={a.rotulo} href={a.href} target="_blank" rel="noreferrer" className={cx('inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold', variante === 'primario' ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]', extra)}>{a.icone && <span aria-hidden>{a.icone}</span>}{t(a.rotulo)}</a>
      : <Botao key={a.rotulo} variante={variante} grande={variante === 'primario'} disabled={a.disabled} onClick={a.onClick} className={cx('inline-flex items-center justify-center gap-1.5', extra)}>{a.icone && <span aria-hidden>{a.icone}</span>}{t(a.rotulo)}</Botao>
  return (
    <Janela aberta={aberta} onFechar={onFechar} titulo={
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 35%, transparent)` }}>{icone}</span>
        <span className="min-w-0">
          <span className={cx('block truncate text-lg font-bold leading-tight', riscado && 'line-through opacity-70')}>{titulo}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{ color: cor }}>{t(tipo)}{selos}</span>
        </span>
      </span>
    }>
      <div className="space-y-4">
        {aviso && <p role="status" className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ color: corTom[aviso.tom], background: `color-mix(in srgb, ${corTom[aviso.tom]} 10%, transparent)` }}>⚠️ {aviso.texto}</p>}
        {/* os fatos (e o número que importa) */}
        <div className="flex flex-wrap gap-3">
          <dl className="linha-texto grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            {vistos.map((f) => (
              <div key={f.rotulo} className="contents">
                <dt className="flex items-center gap-1.5 whitespace-nowrap text-[var(--suave)]"><span aria-hidden className="w-5 text-center">{f.icone}</span>{t(f.rotulo)}</dt>
                <dd className="min-w-0 break-words font-semibold">{f.valor}</dd>
              </div>
            ))}
          </dl>
          {destaque && (
            <div className="ml-auto shrink-0 self-start rounded-2xl bg-[var(--fundo)] px-4 py-3 text-right ring-1 ring-[var(--borda)]">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t(destaque.rotulo)}</span>
              <b className="num block whitespace-nowrap text-2xl leading-tight" style={destaque.tom ? { color: corTom[destaque.tom] } : undefined}>{destaque.valor}</b>
              {destaque.sub && <span className="block text-xs text-[var(--suave)]">{destaque.sub}</span>}
            </div>
          )}
        </div>
        {numeros && numeros.itens.length > 0 && (
          <section aria-label={t(numeros.titulo)}>
            <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">{t(numeros.titulo)}{numeros.sub && <span className="num font-semibold normal-case tracking-normal">{numeros.sub}</span>}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {numeros.itens.map((n) => {
                const dentro = (
                  <>
                    <span className="flex items-center gap-1 text-xs text-[var(--suave)]">{n.icone && <span aria-hidden>{n.icone}</span>}<span className="truncate">{t(n.rotulo)}</span></span>
                    <span className="flex items-center justify-between gap-1">
                      <b className="num truncate text-lg leading-tight" style={n.tom ? { color: corTom[n.tom] } : undefined}>{n.valor}</b>
                      {n.onClick && <span aria-hidden className="text-[var(--suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--marca)]">›</span>}
                    </span>
                  </>
                )
                const caixa = 'flex min-h-[4.25rem] min-w-0 flex-col justify-between gap-1 rounded-xl bg-[var(--fundo)] p-2.5 text-left ring-1 ring-[var(--borda)]'
                return n.onClick
                  ? <button key={n.rotulo} type="button" onClick={n.onClick} className={cx(caixa, 'group transition hover:ring-[var(--marca)]')}>{dentro}</button>
                  : <div key={n.rotulo} className={caixa}>{dentro}</div>
              })}
            </div>
          </section>
        )}
        {children}
        {/* as ações: a principal (larga), as secundárias (lado a lado), e no rodapé abrir · perigo */}
        {(principal || secundarias.length > 0) && (
          <div className="space-y-2">
            {principal && botao(principal, 'primario', 'w-full')}
            {secundarias.length > 0 && <div className="grid grid-cols-[repeat(auto-fit,minmax(min(9rem,100%),1fr))] gap-2">{secundarias.map((a) => botao(a, 'secundario'))}</div>}
          </div>
        )}
        {(abrir || perigo) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] pt-2">
            {abrir && <button type="button" onClick={abrir.onClick} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{abrir.icone ? `${abrir.icone} ` : ''}{t(abrir.rotulo)} →</button>}
            {perigo && <button type="button" disabled={perigo.disabled} onClick={perigo.onClick} className="ml-auto min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--ruim)] hover:bg-[var(--ruim)]/10">{t(perigo.rotulo)}</button>}
          </div>
        )}
      </div>
    </Janela>
  )
}
