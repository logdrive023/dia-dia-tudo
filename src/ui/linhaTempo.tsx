// LINHA DO TEMPO como LISTA: um evento por linha, agrupado por dia. Cada linha diz o que aconteceu, quem fez e
// quando; o que entrou/saiu vira uma lista de itens com quantidade e valor; motivo e ajustes ficam destacados.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import type { EventoTempo } from '../core/services/historico'
import { Botao, cx, gramasTexto, loc } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

const ICONES = { etapa: '🔁', acao: '✳️', anexo: '📎', estoque: '📦', caixa: '💵', conta: '📒' } as const
const NOMES = { etapa: 'Etapas', acao: 'Ações', anexo: 'Arquivos', estoque: 'Estoque', caixa: 'Dinheiro', conta: 'Conta' } as const

function quantidade(q: number, u?: string) {
  const sinal = q < 0 ? '−' : ''
  if (u === 'grama') return sinal + gramasTexto(Math.abs(q))
  return `${sinal}${Math.abs(q).toLocaleString(loc())}${u === 'peca' ? ' un.' : ''}`
}

/** Lotes que entraram/saíram no mesmo minuto viram um evento só, com a lista de lotes. */
function juntar(eventos: EventoTempo[]) {
  const r: (EventoTempo & { refs?: EventoTempo['ref'][] })[] = []
  for (const e of eventos) {
    const ant = r[r.length - 1]
    if (ant && e.tipo === 'estoque' && ant.tipo === 'estoque' && ant.titulo === e.titulo && ant.em.slice(0, 16) === e.em.slice(0, 16) && e.itens) {
      r[r.length - 1] = { ...ant, itens: [...(ant.itens ?? []), ...e.itens], detalhe: undefined, ref: undefined, refs: [...(ant.refs ?? (ant.ref ? [ant.ref] : [])), ...(e.ref ? [e.ref] : [])] }
    } else r.push(e)
  }
  return r
}

export function LinhaDoTempo({ id }: { id: string }) {
  const t = useT()
  const { dados } = useConsulta('linhaDoTempo', { id })
  const [filtro, setFiltro] = useState<string>('')
  const [tudo, setTudo] = useState(false)
  if (!dados) return null
  if (!dados.length) return <p className="text-sm text-[var(--suave)]">{t('Nada registrado ainda.')}</p>
  const tipos = [...new Set(dados.map((e) => e.tipo))]
  // mais recente primeiro: o que aconteceu por último é o que a pessoa procura
  const lista = juntar(dados.filter((e) => !filtro || e.tipo === filtro)).reverse()
  const visiveis = tudo ? lista : lista.slice(0, 15)
  const dias = new Map<string, EventoTempo[]>()
  for (const e of visiveis) dias.set(e.em.slice(0, 10), [...(dias.get(e.em.slice(0, 10)) ?? []), e])
  const chip = (ativo: boolean) => cx('min-h-10 rounded-full px-3 text-sm font-semibold', ativo ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')
  return (
    <div>
      {tipos.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label={t('Filtrar')}>
          <button type="button" aria-pressed={!filtro} onClick={() => setFiltro('')} className={chip(!filtro)}>{t('Tudo')} {dados.length}</button>
          {tipos.map((tp) => (
            <button key={tp} type="button" aria-pressed={filtro === tp} onClick={() => setFiltro(tp)} className={chip(filtro === tp)}>
              {ICONES[tp]} {t(NOMES[tp])} {dados.filter((e) => e.tipo === tp).length}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {[...dias].map(([dia, evs]) => (
          <section key={dia}>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">
              {new Date(dia + 'T12:00:00').toLocaleDateString(loc(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </h4>
            <ul className="divide-y divide-[var(--borda)] rounded-2xl border border-[var(--borda)]">
              {evs.map((e, i) => <Evento key={i} e={e} />)}
            </ul>
          </section>
        ))}
      </div>
      {!tudo && lista.length > visiveis.length && <Botao variante="leve" className="mt-2" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: lista.length })}</Botao>}
    </div>
  )
}

function Evento({ e }: { e: EventoTempo & { refs?: EventoTempo['ref'][] } }) {
  const t = useT()
  const { ir } = useApp()
  const hora = new Date(e.em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
  const [, antes, depois] = e.detalhe?.startsWith('saldo:') ? e.detalhe.split(':') : []
  const totalAntes = e.detalhe?.startsWith('antes:') ? Number(e.detalhe.slice(6)) : undefined
  const texto = e.detalhe && !e.detalhe.startsWith('saldo:') && !e.detalhe.startsWith('antes:') ? e.detalhe : undefined
  const unidade = e.itens?.[0]?.unidade
  return (
    <li className="flex gap-3 p-3">
      <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-base">{ICONES[e.tipo]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold">
            {t(e.titulo)}
            {e.de && e.para && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold">
                <span className="rounded-full bg-[var(--borda)] px-2 py-0.5">{t(e.de)}</span>→<span className="rounded-full bg-[var(--marca-suave)] px-2 py-0.5 text-[var(--marca)]">{t(e.para)}</span>
              </span>
            )}
            {!e.de && e.para && <span className="ml-2 rounded-full bg-[var(--marca-suave)] px-2 py-0.5 text-sm text-[var(--marca)]">{t(e.para)}</span>}
          </p>
          {e.valor && (
            <span className={cx('num font-bold', e.tipo === 'caixa' && (e.valor.valor > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'))}>
              {totalAntes !== undefined && <s className="mr-1 font-normal text-[var(--suave)]">{formatar(totalAntes, e.valor.moeda)}</s>}
              {e.tipo === 'caixa' && e.valor.valor > 0 ? '+' : ''}
              {formatar(e.valor.valor, e.valor.moeda)}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--suave)]">
          {hora}
          {e.por && <> · {e.por}</>}
          {e.valor?.forma && <> · {t(e.valor.forma)}</>}
        </p>
        {e.itens && e.itens.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-xl bg-[var(--fundo)] p-3 text-sm">
            {e.itens.map((it, k) => (
              <li key={k} className="flex justify-between gap-3">
                {e.refs?.[k] ? (
                  <button type="button" onClick={() => ir(e.refs![k]!.tela, { id: e.refs![k]!.id })} className="min-w-0 text-left font-semibold text-[var(--marca)] hover:underline">{it.texto}</button>
                ) : (
                  <span className="min-w-0">{it.texto}</span>
                )}
                <span className="num shrink-0 text-right">
                  {it.quantidade !== undefined && <b>{quantidade(it.quantidade, it.unidade)}</b>}
                  {it.valor !== undefined && it.moeda && <span className="ml-2 text-[var(--suave)]">{formatar(it.valor, it.moeda)}</span>}
                </span>
              </li>
            ))}
            {e.itens.length > 1 && e.itens.every((it) => it.quantidade !== undefined && it.unidade === unidade) && (
              <li className="flex justify-between gap-3 border-t border-[var(--borda)] pt-1 font-semibold">
                <span>{t('Total')} · {t('{n} item(ns)', { n: e.itens.length })}</span>
                <span className="num">{quantidade(e.itens.reduce((s, it) => s + (it.quantidade ?? 0), 0), unidade)}</span>
              </li>
            )}
          </ul>
        )}
        {antes !== undefined && <p className="mt-1 text-sm text-[var(--suave)]">{t('Saldo do lote')}: {quantidade(Number(antes), unidade)} → <b>{quantidade(Number(depois), unidade)}</b></p>}
        {texto && <p className="mt-1 text-sm">{texto}</p>}
        {e.motivo && <p className="mt-1 text-sm"><span className="font-semibold">{t('Motivo')}:</span> {e.motivo}</p>}
        {e.ajustes && e.ajustes.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-sm">
            {e.ajustes.map((a, k) => <li key={k}>{a}</li>)}
          </ul>
        )}
        {e.ref && (
          <button type="button" onClick={() => ir(e.ref!.tela, { id: e.ref!.id })} className="mt-1 min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">
            {t(e.ref.tela === 'venda' ? 'Abrir venda' : e.ref.tela === 'lote' ? 'Abrir lote' : 'Abrir')} →
          </button>
        )}
      </div>
    </li>
  )
}
