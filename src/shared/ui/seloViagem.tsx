// VIAGEM À VISTA — o mesmo selo e o mesmo filtro em toda lista (Compras, Triagem, Estoque, Vender):
//   · SeloViagem: "✈️ VG-0001 · Feira de Oruro" (um toque abre a viagem). A viagem vem do servidor junto com a linha.
//   · FiltroViagem: o botão "✈️ Todas as viagens ▾" ao lado da busca (sempre à vista) que abre a janela de escolher a
//     viagem, com busca, destino e período. Ex.: 2 dias de viagem, um monte de cabelo → escolhe a viagem e vê só o que veio dela.

import { type ReactNode, useState } from 'react'
import type { Id } from '../../core/domain/tipos'
import type { ViagemCurta } from '../../core/services/viagemCurta'
import { Janela, cx, dataBR } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'
import { CampoCidade } from './campoCidade'
import { semAcento } from '../../core/dados/cidadesBolivia'

export function SeloViagem({ v, curto, className, soLeitura }: { v?: ViagemCurta; curto?: boolean; className?: string
  /** dentro de outro botão (a linha do celular): só o selo, sem virar botão (botão dentro de botão não vale) */
  soLeitura?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  if (!v) return null
  const classe = cx('inline-flex min-h-6 max-w-full shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2 text-xs font-semibold text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300', !soLeitura && 'hover:bg-sky-500/20', className)
  const dentro = <><span aria-hidden>✈️</span><span className="font-mono">{v.codigo}</span>{!curto && <span className="truncate font-normal">· {v.nome}</span>}</>
  if (soLeitura) return <span title={`${t('Viagem')} ${v.codigo} · ${v.nome}`} className={classe}>{dentro}</span>
  return (
    <button type="button" title={`${t('Viagem')} ${v.codigo} · ${v.nome}`} onClick={(e) => (e.stopPropagation(), ir('viagem', { id: v.id }))} className={classe}>
      {dentro}
    </button>
  )
}

/** os vários selos (um pacote juntado pode vir de duas viagens) */
export function SelosViagem({ vs, curto, soLeitura }: { vs?: ViagemCurta[]; curto?: boolean; soLeitura?: boolean }) {
  if (!vs?.length) return null
  return <span className="inline-flex flex-wrap gap-1">{vs.map((v) => <SeloViagem key={v.id} v={v} curto={curto} soLeitura={soLeitura} />)}</span>
}

/** "" = todas · "sem" = sem viagem · id = a viagem */
export const passaViagem = (valor: string, vs: (ViagemCurta | undefined)[]) =>
  !valor ? true : valor === 'sem' ? !vs.some(Boolean) : vs.some((v) => v?.id === valor)

/** as viagens (sem repetir, mais nova primeiro pelo código) que aparecem nas linhas */
export function viagensDasLinhas(vs: (ViagemCurta | undefined)[]): ViagemCurta[] {
  return [...new Map(vs.filter((v): v is ViagemCurta => !!v).map((v) => [v.id, v])).values()].sort((a, b) => (a.codigo < b.codigo ? 1 : -1))
}

/** período da viagem (pela data de início) */
const PERIODOS = [
  { id: '', nome: 'Qualquer data' },
  { id: 'abertas', nome: 'Em andamento' },
  { id: '30', nome: 'Últimos 30 dias' },
  { id: '90', nome: 'Últimos 90 dias' },
  { id: 'ano', nome: 'Este ano' },
] as const

export type ViagemFiltro = NonNullable<ReturnType<typeof useConsulta<'viagensParaFiltro'>>['dados']>[number]

/** a cor da viagem pelo tempo (vem do servidor): 🟢 vigente · 🟠 encerrada há pouco (até 30 dias) · ⚪ encerrada faz tempo */
export const COR_TEMPO = {
  vigente: { cor: 'var(--bom)', selo: 'bg-[var(--bom)]/12 text-[var(--bom)]', legenda: 'Vigente' },
  recente: { cor: 'var(--alerta)', selo: 'bg-[var(--alerta)]/12 text-[var(--alerta)]', legenda: 'Encerrada há pouco (até 30 dias)' },
  antiga: { cor: 'var(--suave)', selo: 'bg-[var(--fundo)] text-[var(--suave)]', legenda: 'Encerrada faz tempo' },
} as const

/** "em andamento" · "encerrada hoje" · "encerrada há 5 dias" */
export function situacaoViagem(v: Pick<ViagemFiltro, 'tempo' | 'diasEncerrada'>, t: ReturnType<typeof useT>) {
  if (v.tempo === 'vigente') return t('em andamento')
  if (v.diasEncerrada === undefined) return t('encerrada')
  return v.diasEncerrada === 0 ? t('encerrada hoje') : t('encerrada há {n} dia(s)', { n: v.diasEncerrada })
}

/** a legenda das cores (embaixo dos filtros) */
export function LegendaViagem() {
  const t = useT()
  return (
    <ul aria-label={t('Legenda')} className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--suave)]">
      {Object.values(COR_TEMPO).map((x) => (
        <li key={x.legenda} className="inline-flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: x.cor }} />{t(x.legenda)}</li>
      ))}
    </ul>
  )
}

/**
 * ESCOLHA DE VIAGEM — o miolo único de "achar uma viagem" (filtro das listas, ligar uma compra, onde mais precisar):
 * 🔎 busca (código, nome, destino) · 📍 destino (o campo de cidade, só com os destinos que existem) · 📅 quando, e as
 * viagens em cartões (código, situação, nome, destino, datas). As viagens vêm do servidor (viagensParaFiltro).
 *   · `conta`: quantos desta lista vieram de cada viagem (o número à direita do cartão)
 *   · `bloqueio(v)`: o motivo de não poder escolher (cartão apagado com o motivo; ex.: viagem encerrada)
 *   · `topo`: o que vai acima dos filtros (no filtro: "Todas as viagens" e "Sem viagem")
 */
export function EscolhaViagem({ valor, onEscolher, conta, bloqueio, topo }: {
  valor: string
  onEscolher(id: Id): void
  conta?: Map<string, number>
  bloqueio?(v: ViagemFiltro): string | undefined
  topo?: ReactNode
}) {
  const t = useT()
  const { dados } = useConsulta('viagensParaFiltro', {})
  const [busca, setBusca] = useState('')
  const [destino, setDestino] = useState('')
  const [periodo, setPeriodo] = useState('')
  const viagens = dados ?? []
  const destinos = [...new Set(viagens.map((v) => v.destino).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const hoje = new Date().toISOString().slice(0, 10)
  const desde = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  const b = semAcento(busca)
  const lista = viagens
    .filter((v) =>
      (!b || semAcento([v.codigo, v.nome, v.destino].filter(Boolean).join(' ')).includes(b)) &&
      (!destino || v.destino === destino) &&
      (!periodo || (periodo === 'abertas' ? v.status === 'aberta' : periodo === 'ano' ? v.inicio.slice(0, 4) === hoje.slice(0, 4) : v.inicio >= desde(Number(periodo)))))
    // as que dá para escolher primeiro (dentro de cada grupo, a ordem do servidor: mais nova primeiro)
    .sort((x, y) => Number(!!bloqueio?.(x)) - Number(!!bloqueio?.(y)))
  return (
    <div className="space-y-3">
      {topo}
      {viagens.length > 0 && (
        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 focus-within:border-sky-500">
            <span aria-hidden className="text-[var(--suave)]">🔎</span>
            <input type="search" aria-label={t('Buscar viagem')} placeholder={t('Buscar código, nome ou destino')} value={busca} onChange={(e) => setBusca(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {/* o destino: o mesmo campo de cidade da viagem, só com os destinos que as viagens têm */}
            {destinos.length > 1 && (
              <div className="min-w-[min(12rem,100%)] flex-1">
                <CampoCidade compacto rotulo="Destino" valor={destino} onChange={setDestino} opcoes={destinos} permitirNovo={false} placeholder="Todos os destinos" />
              </div>
            )}
            <label className={cx('inline-flex min-h-9 items-center gap-1 rounded-full pl-3 pr-1 text-sm font-semibold ring-1', periodo ? 'bg-sky-500/10 text-sky-700 ring-sky-500/40 dark:text-sky-300' : 'bg-[var(--fundo)] ring-[var(--borda)]')}>
              <span aria-hidden>📅</span>
              <select aria-label={t('Quando')} value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="cursor-pointer bg-transparent py-1 pr-1 outline-none">
                {PERIODOS.map((p) => <option key={p.id || 'qq'} value={p.id}>{t(p.nome)}</option>)}
              </select>
            </label>
            {(busca || destino || periodo) && <button type="button" onClick={() => (setBusca(''), setDestino(''), setPeriodo(''))} className="ml-auto min-h-9 rounded-full px-2 text-sm font-semibold text-[var(--suave)] hover:text-[var(--ruim)]">✕ {t('Limpar')}</button>}
          </div>
          <LegendaViagem />
        </div>
      )}
      {!dados ? <p className="text-sm text-[var(--suave)]">{t('Carregando…')}</p>
        : !viagens.length ? <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t('Nenhuma viagem cadastrada ainda.')}</p>
          : !lista.length ? <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t('Nenhuma viagem com esses filtros.')}</p>
            : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto" aria-label={t('Viagens')}>
                {lista.map((v) => {
                  const n = conta?.get(v.id) ?? 0
                  const on = valor === v.id
                  const motivo = bloqueio?.(v)
                  const cor = COR_TEMPO[v.tempo]
                  return (
                    <li key={v.id}>
                      <button type="button" aria-pressed={on} disabled={!!motivo} onClick={() => onEscolher(v.id)}
                        style={{ borderLeftColor: on ? undefined : cor.cor }}
                        className={cx('flex w-full items-center gap-3 rounded-2xl border-2 border-l-[6px] p-3 text-left transition', on ? 'border-sky-500 bg-sky-500/10' : 'border-[var(--borda)] hover:border-sky-500', (motivo || (conta && !n)) && 'opacity-60', motivo && 'cursor-not-allowed hover:border-[var(--borda)]')}>
                        <span aria-hidden className={cx('hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg min-[360px]:flex', on ? 'bg-sky-500 text-white' : 'bg-sky-500/15')}>{on ? '✓' : '✈️'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2"><b className="font-mono">{v.codigo}</b><span className={cx('whitespace-nowrap rounded-full px-2 text-[11px] font-semibold', cor.selo)}>{situacaoViagem(v, t)}</span></span>
                          <b className="block truncate text-sm">{v.nome}</b>
                          <span className="num block truncate text-xs text-[var(--suave)]">{[v.destino && `📍 ${v.destino}`, `📅 ${dataBR(v.inicio)}${v.fim ? ` – ${dataBR(v.fim)}` : ''}`].filter(Boolean).join(' · ')}</span>
                          {motivo && <span className="block text-xs font-semibold text-[var(--alerta)]">{t(motivo)}</span>}
                        </span>
                        {conta && (
                          <span className="shrink-0 text-right">
                            <b className="num block text-lg leading-none">{n}</b>
                            <span className="text-[11px] text-[var(--suave)]">{t('nesta lista')}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
    </div>
  )
}

/**
 * FILTRO DE VIAGEM — o botão "✈️ Todas as viagens ▾" ao lado da busca (Compras, Triagem, Estoque, Vender) que abre a
 * janela com a EscolhaViagem e, em cima, "Todas as viagens" e "Sem viagem"; cada viagem mostra QUANTOS desta lista
 * vieram dela (a contagem vem das linhas da tela, `nasLinhas`).
 */
export function FiltroViagem({ valor, onChange, nasLinhas }: { valor: string; onChange(id: Id | ''): void; nasLinhas: (ViagemCurta | undefined)[][] }) {
  const t = useT()
  const { dados } = useConsulta('viagensParaFiltro', {})
  const [aberta, setAberta] = useState(false)
  const conta = new Map<string, number>()
  let semViagem = 0
  for (const vs of nasLinhas) {
    const ids = [...new Set(vs.filter(Boolean).map((v) => v!.id))]
    if (!ids.length) semViagem++
    for (const id of ids) conta.set(id, (conta.get(id) ?? 0) + 1)
  }
  const atual = dados?.find((v) => v.id === valor)
  const escolher = (id: Id | '') => (onChange(id), setAberta(false))
  const nome = valor === 'sem' ? t('Sem viagem') : atual ? atual.codigo : t('Todas as viagens')
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`${t('Viagem')}: ${nome}`} onClick={() => setAberta(true)}
        className={cx('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', valor ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-sky-500')}>
        <span aria-hidden>✈️</span><span className={cx('max-w-[9rem] truncate', !valor && 'hidden sm:inline')}>{nome}</span><span aria-hidden className="text-xs">▾</span>
      </button>
      {aberta && (
        <Janela aberta titulo={`✈️ ${t('Filtrar por viagem')}`} onFechar={() => setAberta(false)}>
          <EscolhaViagem valor={valor} onEscolher={escolher} conta={conta} topo={
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
              {([['', 'Todas as viagens', nasLinhas.length], ['sem', 'Sem viagem', semViagem]] as const).map(([id, n, q]) => (
                <button key={id || 'todas'} type="button" aria-pressed={valor === id} onClick={() => escolher(id)}
                  className={cx('flex min-h-12 items-center justify-between gap-2 rounded-2xl border-2 px-3 text-left text-sm font-semibold', valor === id ? 'border-sky-500 bg-sky-500/10' : 'border-[var(--borda)] hover:border-sky-500')}>
                  <span className="min-w-0 leading-tight">{t(n)}</span><span className="num shrink-0 rounded-full bg-[var(--fundo)] px-2 text-xs">{q}</span>
                </button>
              ))}
            </div>
          } />
        </Janela>
      )}
    </>
  )
}

/**
 * CAMPO DE VIAGEM (formulários): mostra a viagem escolhida (na cor do tempo) ou "Sem viagem"; um toque abre a mesma
 * EscolhaViagem do filtro (busca, 📍 cidade, 📅 data). "Tirar" volta para sem viagem.
 */
export function CampoViagem({ valor, onChange, rotulo = 'Viagem' }: { valor: string; onChange(id: Id | ''): void; rotulo?: string }) {
  const t = useT()
  const { dados } = useConsulta('viagensParaFiltro', {})
  const [aberta, setAberta] = useState(false)
  const v = dados?.find((x) => x.id === valor)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-haspopup="dialog" aria-label={`${t(rotulo)}: ${v ? v.codigo : t('Sem viagem')}`} onClick={() => setAberta(true)}
          style={v ? { borderLeftColor: COR_TEMPO[v.tempo].cor } : undefined}
          className={cx('flex min-h-12 min-w-0 flex-[1_1_14rem] items-center gap-2 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-left hover:border-sky-500', v && 'border-l-[6px]')}>
          <span aria-hidden>✈️</span>
          {v ? (
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm"><span className="font-mono">{v.codigo}</span> · {v.nome}</b>
              <span className="block truncate text-xs text-[var(--suave)]">{situacaoViagem(v, t)}{v.destino ? ` · 📍 ${v.destino}` : ''}</span>
            </span>
          ) : <span className="min-w-0 flex-1 text-sm text-[var(--suave)]">{t('Sem viagem — toque para escolher')}</span>}
          <span aria-hidden className="text-xs text-[var(--suave)]">▾</span>
        </button>
        {v && <button type="button" onClick={() => onChange('')} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--suave)] hover:text-[var(--ruim)]">✕ {t('Tirar')}</button>}
      </div>
      {aberta && (
        <Janela aberta titulo={`✈️ ${t(rotulo)}`} onFechar={() => setAberta(false)}>
          <EscolhaViagem valor={valor} onEscolher={(id) => (onChange(id), setAberta(false))} />
        </Janela>
      )}
    </>
  )
}
