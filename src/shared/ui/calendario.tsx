// CALENDÁRIO da agenda: Mês (grade com bolinhas/chips), Semana (colunas com horário no computador; lista no celular)
// e Dia (linha do tempo por hora). Só desenha: os dados vêm da consulta "calendario" (core/services/agenda.ts).

import type { ReactNode } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { dataLocal, diaDaSemana, somarDias } from '../../core/domain/datas'
import type { ItemCalendario, TipoCalendario } from '../../core/services/agenda'
import { Pilula, Vazio, cx, dataBR } from './base'
import { useT } from './i18n'
import { useMidia } from './midia'
import type { FeriadoNoDia } from '../../core/dados/feriados'
import { AvisoFeriado, CAT_FERIADO, FaixaFeriado, MarcaFeriado, dicaFeriado } from './feriadosAgenda'

export const TIPOS_CAL: { id: TipoCalendario; nome: string; icone: string; cor: string }[] = [
  { id: 'atendimento', nome: 'Atendimento', icone: '✂️', cor: '#8b5cf6' },
  { id: 'viagem', nome: 'Viagem', icone: '✈️', cor: '#0ea5e9' },
  { id: 'compromisso', nome: 'Compromisso', icone: '📌', cor: '#f59e0b' },
  { id: 'emprestimo', nome: 'Empréstimo', icone: '💵', cor: '#16a34a' },
]
export const tipoCal = (id: TipoCalendario) => TIPOS_CAL.find((x) => x.id === id)!

/** Segunda-feira da semana do dia. */
export function inicioSemana(d: string) {
  return somarDias(d, -((new Date(d + 'T12:00').getDay() + 6) % 7))
}

/** Grade do mês: de segunda antes do dia 1 até domingo depois do último dia (5 ou 6 semanas). */
export function gradeMes(data: string) {
  const primeiro = data.slice(0, 8) + '01'
  const de = inicioSemana(primeiro)
  const [a, m] = data.split('-').map(Number)
  const ultimo = dataLocal(new Date(a, m, 0, 12))
  const ate = somarDias(inicioSemana(ultimo), 6)
  const dias: string[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d)
  return dias
}

export const noDia = (i: ItemCalendario, d: string) => i.data <= d && d <= i.ateData

/** true em tela de 768 px ou mais (sem matchMedia, como nos testes, conta como larga). */
/** tela de 768 px ou mais (computador/tablet deitado) */
export function useLargo() {
  return useMidia('(min-width: 768px)', true)
}

const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const min = (h?: string) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : 0)

/** Agendado / Feito / Pago / Falta receber (atendimento) — as pílulas do item. */
export function PilulasStatus({ i, curto }: { i: ItemCalendario; curto?: boolean }) {
  const t = useT()
  if (i.status === 'cancelado') return <Pilula tom="ruim">{t('Cancelado')}</Pilula>
  return (
    <>
      {i.conflito && <Pilula tom="alerta">⚠️ {t('horário ocupado')}</Pilula>}
      {i.tipo === 'emprestimo' ? (
        <Pilula tom={i.pago ? 'bom' : i.atrasada ? 'ruim' : 'marca'}>{i.pago ? `✓ ${t('Paga')}` : i.atrasada ? t('Atrasada') : t(i.sentido === 'pagar' ? 'A pagar' : 'A receber')}</Pilula>
      ) : i.tipo === 'viagem' ? (
        <Pilula tom={i.status === 'feito' ? 'neutro' : 'marca'}>{t(i.status === 'feito' ? 'Encerrada' : 'Aberta')}</Pilula>
      ) : i.status === 'feito' ? (
        <Pilula tom="bom">✓ {t('Feito')}</Pilula>
      ) : (
        !curto && <Pilula tom="marca">{t('Agendado')}</Pilula>
      )}
      {i.tipo === 'atendimento' && i.status === 'feito' && (i.pago ? <Pilula tom="bom">{t('Pago')}</Pilula> : <Pilula tom="alerta">{t('Falta receber')}{!curto && i.falta && i.moeda ? ` ${formatar(i.falta, i.moeda)}` : ''}</Pilula>)}
    </>
  )
}

const quando = (i: ItemCalendario) => (i.diaTodo ? '' : `${i.hora}${i.horaFim ? `–${i.horaFim}` : ''}`)

/** Uma linha (lista do dia, semana no celular): cor do tipo, hora, título, quem/onde e status. */
export function LinhaItem({ i, onAbrir, mostrarDia }: { i: ItemCalendario; onAbrir(i: ItemCalendario): void; mostrarDia?: boolean }) {
  const t = useT()
  const tp = tipoCal(i.tipo)
  const sub = [i.detalhe, i.pessoa, i.local].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={() => onAbrir(i)}
      className={cx('block w-full rounded-xl border border-[var(--borda)] p-2 pl-3 text-left hover:brightness-95', i.status === 'feito' && 'opacity-75')}
      style={{ borderLeft: `4px solid ${tp.cor}`, background: `${tp.cor}14` }}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden>{tp.icone}</span>
        <b className="num text-sm">{i.diaTodo ? (i.tipo === 'viagem' && i.data !== i.ateData ? `${dataBR(i.data).slice(0, 5)}–${dataBR(i.ateData).slice(0, 5)}` : t('Dia todo')) : quando(i)}</b>
        {mostrarDia && <span className="text-xs text-[var(--suave)]">{t(diaDaSemana(i.data))} {dataBR(i.data).slice(0, 5)}</span>}
        <span className="ml-auto flex flex-wrap gap-1"><PilulasStatus i={i} curto /></span>
      </span>
      <span className={cx('block break-words font-semibold', i.status === 'feito' && i.tipo === 'compromisso' && 'line-through')}>{i.titulo}</span>
      {sub && <span className="block break-words text-sm text-[var(--suave)]">{sub}</span>}
    </button>
  )
}

/**
 * Chip de uma linha (grade do mês e "dia todo" da semana): a bolinha na cor do tipo (a mesma da legenda), a hora e o título.
 * `trecho`: evento de vários dias vira uma BARRA contínua — o nome aparece uma vez e a cor atravessa as células da semana.
 */
function Chip({ i, onAbrir, trecho }: { i: ItemCalendario; onAbrir(i: ItemCalendario): void; trecho?: { comeco: boolean; fim: boolean; titulo: boolean } }) {
  const tp = tipoCal(i.tipo)
  const { comeco, fim, titulo } = trecho ?? { comeco: true, fim: true, titulo: true }
  return (
    <button
      type="button"
      onClick={(e) => (e.stopPropagation(), onAbrir(i))}
      title={`${i.hora ?? ''} ${i.titulo}`.trim()}
      className={cx('relative flex h-6 min-w-0 items-center gap-1.5 px-1.5 text-left text-xs font-medium transition hover:brightness-125', comeco ? 'rounded-l-md' : '-ml-[5px]', fim ? 'rounded-r-md' : '-mr-[5px]', comeco && fim ? 'w-full' : comeco || fim ? 'w-[calc(100%+5px)]' : 'w-[calc(100%+10px)]', i.status === 'feito' && 'opacity-50')}
      style={{ background: `${tp.cor}2e` }}
    >
      {titulo ? (
        <>
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: tp.cor }} />
          <span className="min-w-0 truncate">{i.hora && <b className="num mr-1 font-semibold">{i.hora}</b>}{i.titulo}</span>
        </>
      ) : <span className="sr-only">{i.titulo}</span>}
    </button>
  )
}

// ---------- mês ----------

const variosDias = (i: ItemCalendario) => i.data !== i.ateData

export function VistaMes({ data, itens, largo, onDia, onAbrir, feriados = [] }: { data: string; itens: ItemCalendario[]; largo: boolean; onDia(d: string): void; onAbrir(i: ItemCalendario): void; feriados?: FeriadoNoDia[] }) {
  const t = useT()
  const hoje = dataLocal()
  const dias = gradeMes(data)
  const mes = data.slice(0, 7)
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="grid grid-cols-7 border-b border-[var(--borda)] bg-[var(--fundo)]/50 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--suave)]">
        {SEMANA.map((s) => <div key={s} className="py-2.5">{t(s)}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, k) => {
          const doDia = itens.filter((i) => noDia(i, d))
          const fer = feriados.filter((x) => x.data === d)
          const fora = d.slice(0, 7) !== mes
          const vistos = [...doDia].sort((a, b) => Number(variosDias(b)) - Number(variosDias(a)) || (variosDias(a) ? a.data.localeCompare(b.data) || a.id.localeCompare(b.id) : 0)).slice(0, 3)
          const ehHoje = d === hoje
          // a dica do dia (tooltip): os feriados e o que está marcado, por tipo — ninguém precisa decorar as cores
          const porTipo = TIPOS_CAL.map((x) => [x, doDia.filter((i) => i.tipo === x.id).length] as const).filter(([, n]) => n)
          const dica = [...fer.map((x) => dicaFeriado(x, t).split('\n')[0]), ...porTipo.map(([x, n]) => `${x.icone} ${n} ${t(x.nome).toLowerCase()}`)].join('\n')
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              aria-label={`${t(diaDaSemana(d))} ${dataBR(d)}${fer.length ? ` · ${fer.map((x) => x.pt).join(', ')}` : ''}: ${doDia.length}`}
              title={dica || undefined}
              onClick={() => onDia(d)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onDia(d))}
              className={cx('min-w-0 cursor-pointer border-b border-r border-[var(--borda)] p-1 text-left align-top outline-none transition-colors hover:bg-[var(--marca-suave)]/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marca)]', largo ? 'min-h-24' : 'min-h-14', k % 7 === 6 && 'border-r-0', k >= dias.length - 7 && 'border-b-0', k % 7 >= 5 && !ehHoje && 'bg-[var(--fundo)]/40', fora && 'bg-[var(--fundo)]/60 text-[var(--suave)]', ehHoje && 'bg-[var(--marca-suave)]/60 shadow-[inset_0_2px_0_var(--marca)]')}
            >
              <span className={cx('flex items-center gap-1', !largo && 'justify-center')}>
                <span className={cx('num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold', ehHoje && 'bg-[var(--marca)] font-bold text-white', fora && 'font-normal opacity-40')} style={!ehHoje && fer[0] ? { color: CAT_FERIADO[fer[0].categoria].cor } : undefined}>{Number(d.slice(8))}</span>
              </span>
              {largo ? (
                <span className="mt-1 block space-y-0.5">
                  {/* vários dias primeiro: a barra fica na mesma altura de uma célula para a outra */}
                  {vistos.filter(variosDias).map((i) => <Chip key={i.id} i={i} onAbrir={onAbrir} trecho={{ comeco: i.data === d, fim: i.ateData === d, titulo: i.data === d || k % 7 === 0 }} />)}
                  {fer.map((x) => <FaixaFeriado key={x.id} f={x} />)}
                  {vistos.filter((i) => !variosDias(i)).map((i) => <Chip key={i.id} i={i} onAbrir={onAbrir} />)}
                  {doDia.length > 3 && <span className="block px-1.5 text-[11px] font-semibold text-[var(--suave)]">+{doDia.length - 3} {t('mais')}</span>}
                </span>
              ) : (
                <span className="mt-1 flex flex-wrap items-center justify-center gap-1">
                  {fer.map((x) => <MarcaFeriado key={x.id} f={x} />)}
                  {doDia.slice(0, 3).map((i) => <span key={i.id} aria-hidden className="h-2 w-2 rounded-full" style={{ background: tipoCal(i.tipo).cor, opacity: i.status === 'feito' ? 0.45 : 1 }} />)}
                  {doDia.length > 3 && <span className="num text-[10px] font-bold leading-none text-[var(--suave)]">+{doDia.length - 3}</span>}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- semana ----------

const HORA_PX = 44

/** Faixa de horas a mostrar: 7h–21h, ou mais se houver algo fora. */
function faixaHoras(itens: ItemCalendario[]) {
  const comHora = itens.filter((i) => !i.diaTodo)
  const ini = Math.min(7, ...comHora.map((i) => Math.floor(min(i.hora) / 60)))
  const fim = Math.max(21, ...comHora.map((i) => Math.ceil((min(i.horaFim) || min(i.hora) + 60) / 60)))
  return { ini, fim: Math.min(24, fim) }
}

/** Raias para itens que se sobrepõem (lado a lado). */
function raias(itens: ItemCalendario[]) {
  const fins: number[] = []
  const r = new Map<string, number>()
  for (const i of [...itens].sort((a, b) => min(a.hora) - min(b.hora))) {
    const a = min(i.hora)
    const b = min(i.horaFim) || a + 60
    let k = fins.findIndex((f) => f <= a)
    if (k < 0) k = fins.push(b) - 1
    else fins[k] = b
    r.set(i.id, k)
  }
  return { r, n: Math.max(1, fins.length) }
}

function CabecaDia({ d, onDia, children }: { d: string; onDia(d: string): void; children?: ReactNode }) {
  const t = useT()
  const ehHoje = d === dataLocal()
  return (
    <button type="button" onClick={() => onDia(d)} className={cx('flex w-full items-center justify-center gap-1 rounded-lg py-1 text-sm font-semibold hover:bg-[var(--marca-suave)]', ehHoje && 'text-[var(--marca)]')}>
      <span className="uppercase text-[var(--suave)]">{t(diaDaSemana(d))}</span>
      <span className={cx('num inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1', ehHoje && 'bg-[var(--marca)] text-white')}>{Number(d.slice(8))}</span>
      {children}
    </button>
  )
}

export function VistaSemana({ de, itens, largo, onDia, onAbrir, feriados = [] }: { de: string; itens: ItemCalendario[]; largo: boolean; onDia(d: string): void; onAbrir(i: ItemCalendario): void; feriados?: FeriadoNoDia[] }) {
  const t = useT()
  const dias = Array.from({ length: 7 }, (_, k) => somarDias(de, k))
  const hoje = dataLocal()
  if (!largo)
    return (
      <div className="space-y-3">
        {dias.map((d) => {
          const doDia = itens.filter((i) => noDia(i, d))
          return (
            <section key={d} className={cx('rounded-2xl border bg-[var(--cartao)] p-3', d === hoje ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
              <button type="button" onClick={() => onDia(d)} className="mb-2 flex w-full items-center gap-2 text-left">
                <span className={cx('num inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1 font-bold', d === hoje ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{Number(d.slice(8))}</span>
                <b className="first-letter:uppercase">{t(diaDaSemana(d))} {dataBR(d).slice(0, 5)}</b>
                {d === hoje && <Pilula tom="marca">{t('Hoje')}</Pilula>}
                <span className="ml-auto text-sm text-[var(--suave)]">{doDia.length || ''}</span>
              </button>
              {feriados.filter((x) => x.data === d).map((x) => <div key={x.id} className="mb-2"><AvisoFeriado f={x} compacto /></div>)}
              {doDia.length ? <div className="space-y-2">{doDia.map((i) => <LinhaItem key={i.id} i={i} onAbrir={onAbrir} />)}</div> : <p className="text-sm text-[var(--suave)]">{t('Nada marcado')}</p>}
            </section>
          )
        })}
      </div>
    )
  const semana = itens.filter((i) => dias.some((d) => noDia(i, d)))
  const { ini, fim } = faixaHoras(semana)
  const horas = Array.from({ length: fim - ini }, (_, k) => ini + k)
  const temDiaTodo = semana.some((i) => i.diaTodo)
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
      <div className="grid border-b border-[var(--borda)]" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))' }}>
        <div />
        {dias.map((d) => <div key={d} className="border-l border-[var(--borda)] p-1"><CabecaDia d={d} onDia={onDia} />{feriados.filter((x) => x.data === d).map((x) => <FaixaFeriado key={x.id} f={x} />)}</div>)}
        {temDiaTodo && (
          <>
            <div className="p-1 text-right text-[10px] text-[var(--suave)]">{t('Dia todo')}</div>
            {dias.map((d) => (
              <div key={d} className="space-y-0.5 border-l border-t border-[var(--borda)] p-1">
                {semana.filter((i) => i.diaTodo && noDia(i, d)).map((i) => <Chip key={i.id} i={i} onAbrir={onAbrir} />)}
              </div>
            ))}
          </>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))' }}>
        <div className="relative" style={{ height: horas.length * HORA_PX }}>
          {horas.map((h, k) => <span key={h} className="num absolute right-1 -translate-y-1/2 text-[10px] text-[var(--suave)]" style={{ top: k * HORA_PX }}>{k ? `${String(h).padStart(2, '0')}:00` : ''}</span>)}
        </div>
        {dias.map((d) => {
          const doDia = semana.filter((i) => !i.diaTodo && i.data === d)
          const { r, n } = raias(doDia)
          return (
            <div key={d} className={cx('relative border-l border-[var(--borda)]', d === hoje && 'bg-[var(--marca-suave)]')} style={{ height: horas.length * HORA_PX }}>
              {horas.map((h, k) => <div key={h} className="absolute inset-x-0 border-t border-[var(--borda)]/60" style={{ top: k * HORA_PX }} />)}
              {doDia.map((i) => {
                const tp = tipoCal(i.tipo)
                const a = min(i.hora)
                const b = min(i.horaFim) || a + 60
                const k = r.get(i.id) ?? 0
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => onAbrir(i)}
                    title={`${quando(i)} ${i.titulo}`}
                    className={cx('absolute overflow-hidden rounded-md px-1 text-left text-[11px] leading-tight shadow-sm hover:z-10 hover:brightness-95', i.status === 'feito' && 'opacity-60')}
                    style={{ top: ((a - ini * 60) / 60) * HORA_PX + 1, height: Math.max(20, ((b - a) / 60) * HORA_PX - 2), left: `calc(${(k * 100) / n}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: `${tp.cor}26`, borderLeft: `3px solid ${tp.cor}` }}
                  >
                    <b className="num">{i.hora}</b> {i.conflito ? '⚠️ ' : ''}{i.titulo}
                    {i.detalhe && <span className="block truncate text-[var(--suave)]">{i.detalhe}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- dia ----------

export function VistaDia({ data, itens, onAbrir, onHora, feriados = [] }: { data: string; itens: ItemCalendario[]; onAbrir(i: ItemCalendario): void; onHora?(hora: string): void; feriados?: FeriadoNoDia[] }) {
  const t = useT()
  const doDia = itens.filter((i) => noDia(i, data))
  const diaTodo = doDia.filter((i) => i.diaTodo)
  const comHora = doDia.filter((i) => !i.diaTodo)
  const { ini, fim } = faixaHoras(comHora)
  const horas = Array.from({ length: fim - ini }, (_, k) => ini + k)
  return (
    <div className="space-y-3">
      {feriados.filter((x) => x.data === data).map((x) => <AvisoFeriado key={x.id} f={x} />)}
      {!doDia.length && <Vazio texto="Nada marcado" />}
      {diaTodo.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-[var(--suave)]">{t('Dia todo')}</h3>
          {diaTodo.map((i) => <LinhaItem key={i.id} i={i} onAbrir={onAbrir} />)}
        </section>
      )}
      <ol className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
        {horas.map((h) => {
          const hh = `${String(h).padStart(2, '0')}:00`
          const naHora = comHora.filter((i) => Math.floor(min(i.hora) / 60) === h)
          return (
            <li key={h} className="flex min-h-12 gap-2 border-b border-[var(--borda)] px-2 py-1 last:border-b-0">
              <button type="button" disabled={!onHora} onClick={() => onHora?.(hh)} aria-label={`${t('Marcar')} ${hh}`} className="num w-12 shrink-0 pt-1 text-left text-xs text-[var(--suave)] hover:text-[var(--marca)]">{hh}</button>
              <div className="min-w-0 flex-1 space-y-1 py-0.5">{naHora.map((i) => <LinhaItem key={i.id} i={i} onAbrir={onAbrir} />)}</div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
