// VIAGEM À VISTA — o mesmo selo e o mesmo filtro em toda lista (Compras, Triagem, Estoque, Vender):
//   · SeloViagem: "✈️ VG-0001 · Feira de Oruro" (um toque abre a viagem). A viagem vem do servidor junto com a linha.
//   · FiltroViagem: o botão "✈️ Viagem ▾" ao lado da busca (sempre à vista quando há viagem): Todas · cada viagem ·
//     Sem viagem. Ex.: 2 dias de viagem, um monte de cabelo → escolhe a viagem e vê só o que veio dela.

import type { Id } from '../core/domain/tipos'
import type { ViagemCurta } from '../core/services/viagemCurta'
import { cx } from './base'
import { useApp } from './contexto'
import { BotaoEscolha } from './filtroPadrao'
import { useT } from './i18n'

export function SeloViagem({ v, curto, className }: { v?: ViagemCurta; curto?: boolean; className?: string }) {
  const t = useT()
  const { ir } = useApp()
  if (!v) return null
  return (
    <button type="button" title={`${t('Viagem')} ${v.codigo} · ${v.nome}`} onClick={(e) => (e.stopPropagation(), ir('viagem', { id: v.id }))}
      className={cx('inline-flex min-h-6 max-w-full shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2 text-xs font-semibold text-sky-700 ring-1 ring-sky-500/25 hover:bg-sky-500/20 dark:text-sky-300', className)}>
      <span aria-hidden>✈️</span><span className="font-mono">{v.codigo}</span>{!curto && <span className="truncate font-normal">· {v.nome}</span>}
    </button>
  )
}

/** os vários selos (um pacote juntado pode vir de duas viagens) */
export function SelosViagem({ vs, curto }: { vs?: ViagemCurta[]; curto?: boolean }) {
  if (!vs?.length) return null
  return <span className="inline-flex flex-wrap gap-1">{vs.map((v) => <SeloViagem key={v.id} v={v} curto={curto} />)}</span>
}

/** "" = todas · "sem" = sem viagem · id = a viagem */
export const passaViagem = (valor: string, vs: (ViagemCurta | undefined)[]) =>
  !valor ? true : valor === 'sem' ? !vs.some(Boolean) : vs.some((v) => v?.id === valor)

/** as viagens (sem repetir, mais nova primeiro pelo código) que aparecem nas linhas */
export function viagensDasLinhas(vs: (ViagemCurta | undefined)[]): ViagemCurta[] {
  return [...new Map(vs.filter((v): v is ViagemCurta => !!v).map((v) => [v.id, v])).values()].sort((a, b) => (a.codigo < b.codigo ? 1 : -1))
}

export function FiltroViagem({ viagens, valor, onChange }: { viagens: ViagemCurta[]; valor: string; onChange(id: Id | ''): void }) {
  if (!viagens.length && !valor) return null
  return (
    <BotaoEscolha icone="✈️" rotulo="Viagem" valor={valor} onChange={onChange}
      opcoes={[{ id: '', nome: 'Todas as viagens' }, ...viagens.map((v) => ({ id: v.id, nome: `${v.codigo} · ${v.nome}` })), { id: 'sem', nome: 'Sem viagem' }]} />
  )
}
