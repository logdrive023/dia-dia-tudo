// BUSCA DE PACOTE — o componente único de "ler ou buscar um pacote" (modo caixa e onde mais precisar):
//   [ campo grande (pistola / digitado) ] [📷]
//   ┌ 6 pacotes · ↑↓ escolhe · Enter adiciona ───────────────────────────────┐
//   │ [foto] L-0004  40 cm · Normal · Castanho            2,513 kg          │
//   │        de P-0001 · Atacado Norte · 🔒 Ana · bruto     Bs 8.041,60       │
//   │ [foto] L-0007  …  já na venda (apagado, não entra duas vezes)          │
//   │ [foto] L-0002  …  esgotado — toque para ver para onde foi              │
//   └────────────────────────────────────────────────────────────────────────┘
// Teclado: ↑↓ escolhe, Enter adiciona o destacado (sem destaque, quem decide é o leitor/pistola), Esc limpa.
// O que é "pacote", o preço e o que fazer ao escolher vêm de quem usa: aqui é só a busca e a lista.

import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import type { Id } from '../../core/domain/tipos'
import { Info, cx, gramasTexto } from './base'
import type { FotoResumo } from '../../core/services/fotos'
import { marcadorLote, useUrlFoto } from './fotos'
import { useT } from './i18n'
import { buscarPacotes } from './leitorPistola'

export interface PacoteBusca {
  id: Id
  codigo?: string
  nome: string
  saldo: number
  unidade: string
  status: string
  foto?: FotoResumo
  campos: Record<string, unknown>
  codigosAnteriores?: string[]
  reserva?: { para: string }
  compras?: { codigo?: string; fornecedor?: string }[]
  fornecedor?: string
}

const BRUTO = new Set(['bruto', 'naoIdentificado', 'preparando'])

/** a foto pequena (ou a medida no lugar): só mostra — o toque é da linha inteira */
function Foto({ p }: { p: PacoteBusca }) {
  const url = useUrlFoto(p.foto)
  return (
    <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--borda)] bg-[var(--fundo)]', !p.foto && 'border-dashed')}>
      {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="num text-sm font-black">{marcadorLote(p.campos, p.nome)}</span>}
    </span>
  )
}

/** o pedaço do texto que bate com a busca, em destaque */
function Marcado({ texto, busca }: { texto: string; busca: string }) {
  const b = busca.trim().toLowerCase()
  const i = b ? texto.toLowerCase().indexOf(b) : -1
  if (i < 0) return <>{texto}</>
  return <>{texto.slice(0, i)}<mark className="rounded bg-[var(--marca-suave)] px-0.5 text-[var(--marca)]">{texto.slice(i, i + b.length)}</mark>{texto.slice(i + b.length)}</>
}

export function BuscaPacote<P extends PacoteBusca>({ pacotes, valor, onValor, onEscolher, onCamera, onEnterVazio, onTeclaLeitor, naVenda, precoTexto, inputRef, inputMode, onPointerDown, rotulo = 'Ler ou buscar pacote', ajuda = 'Passe a pistola, leia o QR ou digite o código. Ex.: L-0004 · ou parte do rótulo: castanho 40', placeholder = 'Código, código antigo ou rótulo', max = 8, children }: {
  pacotes: readonly P[] | undefined
  valor: string
  onValor(v: string): void
  onEscolher(p: P): void
  onCamera?(): void
  /** Enter com o campo vazio (ex.: fechar a venda) */
  onEnterVazio?(): void
  /** o leitor/pistola (Enter com código exato), chamado quando nenhum item da lista está destacado */
  onTeclaLeitor?(e: KeyboardEvent<HTMLInputElement>): void
  /** os que já estão na venda: aparecem apagados com "já na venda" */
  naVenda?: ReadonlySet<Id>
  /** o preço de cada um (quando a tela sabe calcular) */
  precoTexto?(p: P): string | undefined
  inputRef?: RefObject<HTMLInputElement>
  inputMode?: 'none' | 'search'
  onPointerDown?(): void
  rotulo?: string
  ajuda?: string
  placeholder?: string
  max?: number
  /** embaixo do campo (o aviso do que acabou de entrar, por exemplo) */
  children?: ReactNode
}) {
  const t = useT()
  const idLista = useId()
  const [destaque, setDestaque] = useState(-1)
  // a lista FECHA ao tocar fora (retomar uma venda, rolar, tocar no total…) e volta ao digitar ou tocar no campo:
  // nunca fica aberta por cima da tela só porque sobrou texto no campo
  const [fechada, setFechada] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => setFechada(false), [valor])
  useEffect(() => {
    const fora = (e: Event) => !caixa.current?.contains(e.target as Node) && setFechada(true)
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [])
  // com saldo primeiro; esgotados no fim (continuam achados: tocar mostra para onde foram)
  const achados = buscarPacotes(pacotes, valor, max * 2).sort((a, b) => Number(b.saldo > 0) - Number(a.saldo > 0)).slice(0, max)
  const total = valor.trim() ? buscarPacotes(pacotes, valor, 999).length : 0
  useEffect(() => setDestaque(-1), [valor])
  const teclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && achados.length) return (e.preventDefault(), setDestaque((d) => (d + 1) % achados.length))
    if (e.key === 'ArrowUp' && achados.length) return (e.preventDefault(), setDestaque((d) => (d <= 0 ? achados.length - 1 : d - 1)))
    if (e.key === 'Enter' && !e.currentTarget.value.trim() && onEnterVazio) return (e.preventDefault(), onEnterVazio())
    if (e.key === 'Enter' && destaque >= 0 && achados[destaque]) return (e.preventDefault(), onEscolher(achados[destaque]))
    onTeclaLeitor?.(e)
  }
  const qtd = (p: P) => (p.unidade === 'grama' ? gramasTexto(p.saldo) : String(p.saldo))
  const aberta = valor.trim().length > 0 && !fechada
  return (
    <div ref={caixa} className="relative">
      <div className="mb-1 flex items-center text-sm font-semibold text-[var(--suave)]">
        <label htmlFor={`${idLista}-campo`}>{t(rotulo)}</label>
        <Info texto={ajuda} />
      </div>
      <div className="flex gap-2">
        <input
          id={`${idLista}-campo`}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={aberta && achados.length > 0}
          aria-controls={idLista}
          aria-activedescendant={destaque >= 0 ? `${idLista}-${destaque}` : undefined}
          aria-label={t(rotulo)}
          placeholder={t(placeholder)}
          inputMode={inputMode}
          enterKeyHint="go"
          value={valor}
          onPointerDown={() => (setFechada(false), onPointerDown?.())}
          onFocus={() => setFechada(false)}
          onChange={(e) => onValor(e.target.value)}
          onKeyDown={teclar}
          spellCheck={false}
          autoComplete="off"
          className="min-h-14 w-full min-w-0 rounded-2xl border-2 border-[var(--marca)] bg-[var(--cartao)] px-4 font-mono text-lg outline-none focus:ring-2 focus:ring-[var(--marca)] sm:text-xl"
        />
        {onCamera && (
          <button type="button" aria-label={t('Ler código')} title={t('Ler código')} onClick={onCamera} className="min-h-14 min-w-14 shrink-0 rounded-2xl bg-[var(--marca)] text-2xl text-white hover:brightness-110">📷</button>
        )}
      </div>
      {aberta && (
        <div className="absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-[0_16px_40px_-12px_rgba(16,24,40,.35)]">
          {achados.length ? (
            <>
              <p className="flex items-center justify-between gap-2 border-b border-[var(--borda)] bg-[var(--fundo)] px-3 py-1.5 text-xs text-[var(--suave)]">
                <span className="num">{total > achados.length ? t('{n} de {total} pacote(s) · continue digitando', { n: achados.length, total }) : t('{n} pacote(s)', { n: achados.length })}</span>
                <span className="hidden sm:inline">{t('↑↓ escolhe · Enter adiciona')}</span>
              </p>
              <ul id={idLista} role="listbox" aria-label={t(rotulo)} className="max-h-[min(24rem,60vh)] divide-y divide-[var(--borda)] overflow-y-auto">
                {achados.map((p, k) => {
                  const ja = naVenda?.has(p.id)
                  const esgotado = p.saldo <= 0
                  const origem = p.compras?.[0] ? [p.compras[0].codigo, p.compras[0].fornecedor].filter(Boolean).join(' · ') : p.fornecedor
                  const preco = !esgotado && !ja ? precoTexto?.(p) : undefined
                  return (
                    <li key={p.id} id={`${idLista}-${k}`} role="option" aria-selected={k === destaque} aria-disabled={ja}>
                      <button type="button" disabled={ja} onMouseEnter={() => setDestaque(k)} onClick={() => onEscolher(p)}
                        className={cx('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors', k === destaque ? 'bg-[var(--marca-suave)]' : 'hover:bg-[var(--marca-suave)]', (ja || esgotado) && 'opacity-60', ja && 'cursor-not-allowed')}>
                        <Foto p={p} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <b className="shrink-0 font-mono text-[15px]">{p.codigo ?? '—'}</b>
                            <span className="min-w-0 truncate text-sm"><Marcado texto={p.nome} busca={valor} /></span>
                          </span>
                          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--suave)]">
                            {origem && <span className="min-w-0 truncate">{t('de')} {origem}</span>}
                            {ja && <span className="font-semibold text-[var(--marca)]">✓ {t('já na venda')}</span>}
                            {esgotado && <span className="font-semibold text-[var(--ruim)]">{t('já saiu — toque para ver para onde foi')}</span>}
                            {!esgotado && BRUTO.has(p.status) && <span className="font-semibold text-[var(--alerta)]">{t('bruto')}</span>}
                            {!esgotado && p.reserva && <span className="font-semibold text-[var(--alerta)]">🔒 {p.reserva.para}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <b className="num block text-sm">{esgotado ? '0' : qtd(p)}</b>
                          {preco && <span className="num block text-xs text-[var(--suave)]">{preco}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="px-3 py-3 text-sm text-[var(--suave)]">{t('Nenhum pacote com “{b}”. Confira o código ou leia o QR.', { b: valor.trim() })}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
