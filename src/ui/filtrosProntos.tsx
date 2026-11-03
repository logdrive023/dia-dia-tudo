// FILTROS DO "PRONTO PARA VENDER" (Triagem): medida (chips com os kg de cada uma, várias de uma vez) ou uma FAIXA livre
// ("de 45 a 60 cm"), peso com limites livres ("de 100 g a 2 kg") ou atalhos, ordem e "Agrupar por" (medida, faixa de
// medida de N em N cm, cor, categoria ou nada). Tudo fica no endereço (voltar/compartilhar mantém). Só visual: não
// muda regra nenhuma, só escolhe o que mostrar.

import { useEffect, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { Info, cx, gramasTexto, moedaPadrao } from './base'
import { useApp, useParamTela } from './contexto'
import { useT } from './i18n'

/** o mínimo que o filtro precisa de um lote */
export interface LoteFiltravel {
  saldo: number
  campos: Record<string, unknown>
  desde?: string
  triadoEm?: string
  preco?: { valorPrincipal: number }
}

export type Agrupar = 'medida' | 'faixa' | 'cor' | 'categoria' | 'nenhum'
export type Ordem = 'maior' | 'menor' | 'antigo' | 'valor'

/** parâmetros do endereço usados aqui (para "Limpar" e para saber se há filtro) */
export const PARAMS_PRONTOS = ['pm', 'pfd', 'pfa', 'ppd', 'ppa'] as const

const ATALHOS_PESO = [
  { id: 'p', nome: '< 200 g', de: undefined, ate: 199 },
  { id: 'm', nome: '200 g–1 kg', de: 200, ate: 999 },
  { id: 'g', nome: '> 1 kg', de: 1000, ate: undefined },
] as const

const num = (v: unknown) => {
  const n = Number(v)
  return v !== undefined && v !== null && v !== '' && Number.isFinite(n) ? n : undefined
}
const medidaDe = (l: LoteFiltravel) => num(l.campos.comprimento)

/** "100 g", "2 kg", "1,5kg", "300" (sem unidade = gramas) → gramas */
export function lerPeso(texto: string): number | undefined {
  const s = texto.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return undefined
  const kg = s.endsWith('kg')
  const corpo = s.replace(/kg$|g$/, '').replace(/\./g, '').replace(',', '.')
  const n = Number(corpo)
  if (!corpo || !Number.isFinite(n) || n < 0) return undefined
  return Math.round(kg ? n * 1000 : n)
}

export interface FiltroProntos {
  medidas: number[]
  faixaDe?: number
  faixaAte?: number
  pesoDe?: number
  pesoAte?: number
  ordem: Ordem
  agrupar: Agrupar
  passo: number
}

/** lê os filtros do endereço */
export function useFiltroProntos() {
  const [pm, setPm] = useParamTela('pm', '')
  const [pfd] = useParamTela('pfd', '')
  const [pfa] = useParamTela('pfa', '')
  const [ppd] = useParamTela('ppd', '')
  const [ppa] = useParamTela('ppa', '')
  const [pord, setOrdem] = useParamTela<Ordem>('pord', 'maior')
  const [pag, setAgrupar] = useParamTela<Agrupar>('pag', 'medida')
  const [ppasso, setPasso] = useParamTela('ppasso', '10')
  const { ajustarParams } = useApp()
  const f: FiltroProntos = {
    medidas: pm.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0),
    faixaDe: num(pfd),
    faixaAte: num(pfa),
    pesoDe: num(ppd),
    pesoAte: num(ppa),
    ordem: pord,
    agrupar: pag,
    passo: Math.max(1, num(ppasso) ?? 10),
  }
  return {
    f,
    ativo: !!(f.medidas.length || f.faixaDe !== undefined || f.faixaAte !== undefined || f.pesoDe !== undefined || f.pesoAte !== undefined),
    setMedidas: (ms: number[]) => setPm([...new Set(ms)].sort((a, b) => a - b).join(',')),
    setFaixa: (de?: number, ate?: number) => ajustarParams({ pfd: de === undefined ? undefined : String(de), pfa: ate === undefined ? undefined : String(ate) }),
    setPeso: (de?: number, ate?: number) => ajustarParams({ ppd: de === undefined ? undefined : String(de), ppa: ate === undefined ? undefined : String(ate) }),
    setOrdem,
    setAgrupar,
    setPasso: (n: number) => setPasso(String(Math.max(1, Math.round(n) || 10))),
    limpar: () => ajustarParams(Object.fromEntries(PARAMS_PRONTOS.map((k) => [k, undefined]))),
  }
}

/** aplica medida/faixa/peso e ordena */
export function filtrarProntos<L extends LoteFiltravel>(lotes: L[], f: FiltroProntos): L[] {
  const passa = (l: L) => {
    const med = medidaDe(l)
    if (f.medidas.length && (med === undefined || !f.medidas.includes(med))) return false
    if (f.faixaDe !== undefined && (med === undefined || med < f.faixaDe)) return false
    if (f.faixaAte !== undefined && (med === undefined || med > f.faixaAte)) return false
    if (f.pesoDe !== undefined && l.saldo < f.pesoDe) return false
    if (f.pesoAte !== undefined && l.saldo > f.pesoAte) return false
    return true
  }
  const data = (l: L) => l.triadoEm ?? l.desde ?? ''
  const cmp: Record<Ordem, (a: L, b: L) => number> = {
    maior: (a, b) => b.saldo - a.saldo,
    menor: (a, b) => a.saldo - b.saldo,
    antigo: (a, b) => data(a).localeCompare(data(b)),
    valor: (a, b) => (b.preco?.valorPrincipal ?? 0) - (a.preco?.valorPrincipal ?? 0),
  }
  return lotes.filter(passa).sort(cmp[f.ordem])
}

export interface GrupoProntos<L> {
  chave: string
  rotulo: string
  /** quando o grupo é uma medida só (para "Vender esta medida" etc.) */
  medida?: string
  lotes: L[]
}

/** agrupa (mantendo a ordem dos lotes dentro de cada grupo) */
export function agruparProntos<L extends LoteFiltravel>(lotes: L[], f: FiltroProntos, t: (s: string, v?: Record<string, string | number>) => string): GrupoProntos<L>[] {
  if (f.agrupar === 'nenhum') return [{ chave: '*', rotulo: t('Todos'), lotes }]
  const mapa = new Map<string, GrupoProntos<L> & { ordem: number | string }>()
  for (const l of lotes) {
    const med = medidaDe(l)
    let chave: string
    let rotulo: string
    let ordem: number | string
    let medida: string | undefined
    if (f.agrupar === 'medida' || f.agrupar === 'faixa') {
      if (med === undefined) (chave = ''), (rotulo = t('Sem medida')), (ordem = -1)
      else if (f.agrupar === 'medida') (chave = String(med)), (rotulo = `${med} cm`), (ordem = med), (medida = String(med))
      else {
        const a = Math.floor(med / f.passo) * f.passo
        chave = String(a)
        rotulo = f.passo === 1 ? `${a} cm` : `${a}–${a + f.passo - 1} cm`
        ordem = a
      }
    } else {
      const v = l.campos[f.agrupar]
      rotulo = v ? t(String(v)) : f.agrupar === 'categoria' ? t('Normal') : t('Sem cor')
      chave = rotulo
      ordem = rotulo
    }
    const g = mapa.get(chave) ?? { chave, rotulo, medida, lotes: [], ordem }
    g.lotes.push(l)
    mapa.set(chave, g)
  }
  return [...mapa.values()].sort((a, b) => (typeof a.ordem === 'number' && typeof b.ordem === 'number' ? b.ordem - a.ordem : String(a.ordem).localeCompare(String(b.ordem))))
}

/** texto curto dos filtros ativos: "50–60 cm, > 1 kg" */
export function textoFiltros(f: FiltroProntos, t: (s: string, v?: Record<string, string | number>) => string) {
  const partes: string[] = []
  if (f.medidas.length) partes.push(`${f.medidas.join(' · ')} cm`)
  if (f.faixaDe !== undefined || f.faixaAte !== undefined)
    partes.push(f.faixaDe !== undefined && f.faixaAte !== undefined ? `${f.faixaDe}–${f.faixaAte} cm` : f.faixaDe !== undefined ? `≥ ${f.faixaDe} cm` : `≤ ${f.faixaAte} cm`)
  if (f.pesoDe !== undefined || f.pesoAte !== undefined) {
    const atalho = ATALHOS_PESO.find((a) => a.de === f.pesoDe && a.ate === f.pesoAte)
    partes.push(atalho ? atalho.nome : f.pesoDe !== undefined && f.pesoAte !== undefined ? `${gramasTexto(f.pesoDe)}–${gramasTexto(f.pesoAte)}` : f.pesoDe !== undefined ? `≥ ${gramasTexto(f.pesoDe)}` : `≤ ${gramasTexto(f.pesoAte!)}`)
  }
  return partes.join(', ') || t('tudo')
}

const chip = (ativo: boolean) =>
  cx('num inline-flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm transition', ativo ? 'border-[var(--marca)] bg-[var(--marca-suave)] font-semibold text-[var(--marca)]' : 'border-[var(--borda)] text-[var(--texto)] hover:border-[var(--marca)]')
const caixa = 'num h-9 w-16 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] px-2 text-sm text-[var(--texto)]'

/** campo de peso livre: aceita "100 g", "2 kg", "1,5kg" */
function CampoPeso({ valor, onChange, rotulo, exemplo }: { valor?: number; onChange(g: number | undefined): void; rotulo: string; exemplo: string }) {
  const [texto, setTexto] = useState(valor === undefined ? '' : gramasTexto(valor))
  // atalho ou "Limpar" mudou o valor por fora: acompanha
  useEffect(() => {
    if (lerPeso(texto) !== valor) setTexto(valor === undefined ? '' : gramasTexto(valor))
  }, [valor])
  return (
    <input
      aria-label={rotulo}
      inputMode="decimal"
      placeholder={exemplo}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value)
        const g = lerPeso(e.target.value)
        if (!e.target.value.trim() || g !== undefined) onChange(g)
      }}
      className={cx(caixa, 'w-20')}
    />
  )
}

/**
 * Os controles: no celular, uma linha ("Filtros" + ordem) que abre o resto; no computador, tudo à mostra.
 * `todos` = os prontos antes do filtro (para os chips de medida com os kg de cada uma).
 */
export function FiltrosProntos<L extends LoteFiltravel>({ todos, filtro }: { todos: L[]; filtro: ReturnType<typeof useFiltroProntos> }) {
  const t = useT()
  const { f } = filtro
  const [aberto, setAberto] = useState(false)
  const [faixaAberta, setFaixa] = useState(false)
  const faixa = faixaAberta || f.faixaDe !== undefined || f.faixaAte !== undefined
  const porMedida = new Map<number, number>()
  for (const l of todos) {
    const m = medidaDe(l)
    if (m !== undefined) porMedida.set(m, (porMedida.get(m) ?? 0) + l.saldo)
  }
  const medidas = [...porMedida].sort((a, b) => a[0] - b[0])
  const nAtivos = (f.medidas.length ? 1 : 0) + (f.faixaDe !== undefined || f.faixaAte !== undefined ? 1 : 0) + (f.pesoDe !== undefined || f.pesoAte !== undefined ? 1 : 0)
  const ordens: { id: Ordem; nome: string }[] = [
    { id: 'maior', nome: 'Maior peso' },
    { id: 'menor', nome: 'Menor peso' },
    { id: 'antigo', nome: 'Mais antigo' },
    { id: 'valor', nome: 'Maior valor' },
  ]
  const grupos: { id: Agrupar; nome: string }[] = [
    { id: 'medida', nome: 'Medida' },
    { id: 'faixa', nome: 'Faixa de medida' },
    { id: 'cor', nome: 'Cor' },
    { id: 'categoria', nome: 'Categoria' },
    { id: 'nenhum', nome: 'Nenhum' },
  ]
  const rotulo = 'w-full shrink-0 text-xs font-semibold text-[var(--suave)] sm:w-24'
  return (
    <div className="mb-3 space-y-2">
      {/* uma linha no celular */}
      <div className="flex items-center gap-2">
        <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={cx(chip(aberto || nAtivos > 0), 'sm:hidden')}>
          ⚲ {t('Filtros')}{nAtivos > 0 && <b className="ml-0.5 rounded-full bg-[var(--marca)] px-1.5 text-xs text-white">{nAtivos}</b>}
        </button>
        <label className="ml-auto flex items-center gap-1 text-xs text-[var(--suave)]">
          <span className="hidden sm:inline">{t('Ordenar')}</span>
          <select aria-label={t('Ordenar')} value={f.ordem} onChange={(e) => filtro.setOrdem(e.target.value as Ordem)} className="h-9 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] px-2 text-sm text-[var(--texto)]">
            {ordens.map((o) => <option key={o.id} value={o.id}>{t(o.nome)}</option>)}
          </select>
        </label>
      </div>

      <div className={cx('space-y-2 rounded-xl bg-[var(--fundo)] p-2 sm:block sm:bg-transparent sm:p-0', !aberto && 'hidden')}>
        {/* medida */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={rotulo}>{t('Medida')}</span>
          {medidas.map(([m, g]) => {
            const on = f.medidas.includes(m)
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => filtro.setMedidas(on ? f.medidas.filter((x) => x !== m) : [...f.medidas, m])} className={chip(on)}>
                {m} <span className={cx('text-xs', !on && 'text-[var(--suave)]')}>{gramasTexto(g)}</span>
              </button>
            )
          })}
          <span className="inline-flex items-center">
            <button type="button" aria-pressed={faixa} onClick={() => { if (faixa) filtro.setFaixa(undefined, undefined); setFaixa(!faixa) }} className={chip(faixa)}>↔ {t('Faixa')}</button>
            <Info texto="Agrupa medidas próximas. Ex.: de 10 em 10 cm → 50–59 cm" />
          </span>
          {faixa && (
            <span className="inline-flex items-center gap-1 text-sm">
              {t('de')} <input aria-label={t('Medida de')} inputMode="numeric" className={caixa} value={f.faixaDe ?? ''} onChange={(e) => filtro.setFaixa(num(e.target.value), f.faixaAte)} placeholder="45" />
              {t('a')} <input aria-label={t('Medida até')} inputMode="numeric" className={caixa} value={f.faixaAte ?? ''} onChange={(e) => filtro.setFaixa(f.faixaDe, num(e.target.value))} placeholder="60" /> cm
            </span>
          )}
        </div>

        {/* peso */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx(rotulo, 'inline-flex items-center')}>{t('Peso')}<Info texto="Ex.: só pacotes acima de 1 kg" /></span>
          {ATALHOS_PESO.map((a) => {
            const on = f.pesoDe === a.de && f.pesoAte === a.ate
            return <button key={a.id} type="button" aria-pressed={on} onClick={() => (on ? filtro.setPeso(undefined, undefined) : filtro.setPeso(a.de, a.ate))} className={chip(on)}>{a.nome}</button>
          })}
          <span className="inline-flex items-center gap-1 text-sm">
            {t('de')} <CampoPeso rotulo={t('Peso de')} exemplo="100 g" valor={f.pesoDe} onChange={(g) => filtro.setPeso(g, f.pesoAte)} />
            {t('a')} <CampoPeso rotulo={t('Peso até')} exemplo="2 kg" valor={f.pesoAte} onChange={(g) => filtro.setPeso(f.pesoDe, g)} />
          </span>
        </div>

        {/* agrupar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={rotulo}>{t('Agrupar por')}</span>
          {grupos.map((o) => <button key={o.id} type="button" aria-pressed={f.agrupar === o.id} onClick={() => filtro.setAgrupar(o.id)} className={chip(f.agrupar === o.id)}>{t(o.nome)}</button>)}
          {f.agrupar === 'faixa' && (
            <span className="inline-flex items-center gap-1 text-sm">
              {t('de')} <input aria-label={t('Tamanho da faixa (cm)')} inputMode="numeric" className={caixa} value={f.passo} onChange={(e) => filtro.setPasso(Number(e.target.value))} /> {t('em')} {f.passo} cm
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** "Mostrando 6 lotes · 4,2 kg · Bs 38.000 · 50–60 cm, > 1 kg" + Limpar (só com filtro ativo) */
export function ResumoFiltroProntos<L extends LoteFiltravel>({ lotes, filtro }: { lotes: L[]; filtro: ReturnType<typeof useFiltroProntos> }) {
  const t = useT()
  if (!filtro.ativo) return null
  const g = lotes.reduce((s, l) => s + l.saldo, 0)
  const v = lotes.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
  return (
    <div className="num mb-2 flex items-center gap-2 rounded-xl bg-[var(--marca-suave)] px-3 py-1.5 text-sm">
      <span className="min-w-0 flex-1">
        {t('Mostrando {n} lote(s)', { n: lotes.length })} · <b>{gramasTexto(g)}</b>{v > 0 && <> · <b>{formatar(v, moedaPadrao())}</b></>} · <span className="text-[var(--marca)]">{textoFiltros(filtro.f, t)}</span>
      </span>
      <button type="button" onClick={filtro.limpar} className="min-h-9 shrink-0 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--cartao)]">✕ {t('Limpar')}</button>
    </div>
  )
}
