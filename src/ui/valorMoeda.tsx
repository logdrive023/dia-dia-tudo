// Campos da NOVA COMPRA com a unidade DENTRO do campo:
//  - PesoInput: "2008 [g]" (toca no g para trocar por kg)
//  - ValorMoedaInput: "[Bs] 1.474,80" (toca no Bs para trocar por US$ / R$, quando há outras moedas ativas)
//  - LinhaCotacao: "1 US$ = [6,96] Bs  = Bs 696,00" (vem a cotação de compra do sistema; dá para digitar outra)
// A compra fica gravada na moeda principal com o valor convertido (o original vai na observação do pedido).

import { useState } from 'react'
import { MOEDAS, type TabelaCotacoes, formatar, lerValor, moeda as moedaDe, valorDeUm } from '../core/domain/dinheiro'
import { Entrada, cx } from './base'
import { CampoCotacao, conv, cotacaoDigitada, cotacaoTexto, lerCotacaoTexto } from './compartilhados'
import { useT } from './i18n'

/** Cotação do sistema "1 [de] = X [para]" em texto ("6,96"); vazio quando não tem. */
export function cotacaoSistema(de: string, para: string, cot: TabelaCotacoes) {
  if (de === para) return ''
  const v = valorDeUm(de, para, cot)
  return v ? cotacaoTexto(v) : ''
}

/** Converte o valor digitado (menor unidade de `de`) para `para` pela cotação digitada (ou a do sistema). */
export function converterDigitado(valor: number, de: string, para: string, texto: string | undefined, cot: TabelaCotacoes) {
  if (de === para) return valor
  const ok = lerCotacaoTexto(texto ?? cotacaoSistema(de, para, cot))
  if (!ok) return undefined
  return conv(valor, de, para, { ...cot, [de]: cotacaoDigitada(de, ok, para) })
}

/** Moedas para escolher no campo de valor: a principal primeiro, depois as outras ativas. */
export function moedasDoCampo(principal: string, ativas: string[] | undefined) {
  return [principal, ...(ativas ?? []).filter((m) => m !== principal && MOEDAS.some((x) => x.codigo === m))]
}

/** Peso em gramas com a unidade dentro do campo (g ⇄ kg). */
export function PesoInput({ valor, onChange, rotulo }: { valor?: number; onChange(g: number | undefined): void; rotulo?: string }) {
  const t = useT()
  const [unidade, setUnidade] = useState<'g' | 'kg'>('g')
  const [texto, setTexto] = useState(valor ? String(valor) : '')
  const ler = (s: string, u: 'g' | 'kg') => {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    if (!s || !Number.isFinite(n) || n <= 0) return undefined
    return Math.round(u === 'kg' ? n * 1000 : n)
  }
  return (
    <div className="relative">
      <Entrada aria-label={rotulo ? t(rotulo) : undefined} inputMode="decimal" value={texto} onChange={(e) => (setTexto(e.target.value), onChange(ler(e.target.value, unidade)))} className="num pr-14" placeholder={unidade === 'g' ? '2008' : '2,5'} />
      <button
        type="button"
        title={t('Trocar g / kg')}
        aria-label={t('Unidade: {u} (tocar para trocar)', { u: unidade })}
        onClick={() => {
          const u = unidade === 'g' ? 'kg' : 'g'
          setUnidade(u)
          onChange(ler(texto, u))
        }}
        className="absolute inset-y-1 right-1 min-w-11 rounded-lg bg-[var(--marca-suave)] px-2 text-sm font-bold text-[var(--marca)]"
      >
        {unidade}
      </button>
    </div>
  )
}

/** Valor com a moeda dentro do campo; com mais de uma moeda ativa, tocar no símbolo troca (Bs → US$ → R$). */
export function ValorMoedaInput({ moeda, moedas, valor, onChange, onMoeda, rotulo }: { moeda: string; moedas: string[]; valor?: number; onChange(v: number | undefined): void; onMoeda(m: string): void; rotulo?: string }) {
  const t = useT()
  const casas = moedaDe(moeda).casas
  const fmt = (v?: number, m = moeda) => (v !== undefined ? formatar(v, m, { semSimbolo: true }) : '')
  const [texto, setTexto] = useState(fmt(valor))
  const [ultimo, setUltimo] = useState<{ v?: number; m: string }>({ v: valor, m: moeda })
  if (valor !== ultimo.v || moeda !== ultimo.m) {
    setUltimo({ v: valor, m: moeda })
    setTexto(fmt(valor))
  }
  const invalido = texto !== '' && lerValor(texto, moeda) === null
  const troca = moedas.length > 1
  const proxima = moedas[(moedas.indexOf(moeda) + 1) % moedas.length]
  return (
    <div className="relative">
      <Entrada
        aria-label={rotulo ? t(rotulo) : undefined}
        inputMode="decimal"
        value={texto}
        placeholder={casas ? '0,00' : '0'}
        onChange={(e) => {
          setTexto(e.target.value)
          const v = lerValor(e.target.value, moeda)
          const novo = v === null ? undefined : v
          setUltimo({ v: novo, m: moeda })
          onChange(novo)
        }}
        className={cx('num', troca ? 'pl-[3.25rem] sm:pl-[3.75rem]' : 'pl-11', invalido && 'border-[var(--ruim)]')}
      />
      {troca ? (
        <button
          type="button"
          title={t('Pagou em outra moeda? Toque para trocar')}
          aria-label={t('Moeda: {m} (tocar para trocar por {p})', { m: moedaDe(moeda).simbolo, p: moedaDe(proxima).simbolo })}
          onClick={() => onMoeda(proxima)}
          className={cx('absolute inset-y-1 left-1 flex min-w-[2.75rem] sm:min-w-[3.25rem] items-center justify-center gap-0.5 rounded-lg px-1 text-sm font-bold', moeda === moedas[0] ? 'bg-[var(--fundo)] text-[var(--texto)]' : 'bg-[var(--alerta)]/15 text-[var(--alerta)]')}
        >
          {moedaDe(moeda).simbolo} <span aria-hidden className="hidden text-[10px] opacity-60 sm:inline">⇄</span>
        </button>
      ) : (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--suave)]">{moedaDe(moeda).simbolo}</span>
      )}
    </div>
  )
}

/** "1 US$ = [6,96] Bs  = Bs 696,00" (com "↺ 6,96" para voltar à cotação do sistema). */
export function LinhaCotacao({ moeda, principal, texto, sistema, resultado, onChange }: { moeda: string; principal: string; texto: string; sistema: string; resultado?: number; onChange(t: string | undefined): void }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[var(--alerta)]/10 px-3 py-2">
      <div className="[&_label]:w-auto">
        <CampoCotacao moeda={moeda} principal={principal} texto={texto} onChange={(x) => onChange(x)} />
      </div>
      {sistema && texto !== sistema && (
        <button type="button" className="min-h-10 px-1 text-xs text-[var(--marca)] underline" onClick={() => onChange(undefined)} title={t('Usar a cotação do sistema')}>
          ↺ {sistema}
        </button>
      )}
      <span className="num ml-auto text-sm font-black" aria-live="polite">= {resultado !== undefined ? formatar(resultado, principal) : '—'}</span>
    </div>
  )
}
