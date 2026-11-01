// Peças de tela reaproveitadas em tudo: botões, cartões, campos, janelas, "ⓘ" com exemplo e números formatados.

import { type ReactNode, useEffect, useId, useState } from 'react'
import { formatar, lerValor, moeda as moedaDe } from '../core/domain/dinheiro'
import type { Cartao as CartaoDados, Formato } from '../core/modulos'
import { useApp } from './contexto'
import { useT } from './i18n'

export function cx(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(' ')
}

// ---------- números ----------

export function gramasTexto(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
  return `${g.toLocaleString('pt-BR')} g`
}

export function fmt(valor: number, formato: Formato['tipo'] | undefined, moeda = 'BOB'): string {
  switch (formato) {
    case 'dinheiro':
      return formatar(valor, moeda)
    case 'gramas':
      return gramasTexto(valor)
    case 'percentual':
      return `${(valor / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    case 'dias':
      return `${valor} d`
    default:
      return valor.toLocaleString('pt-BR')
  }
}

export function dataBR(d?: string) {
  return d ? d.slice(0, 10).split('-').reverse().join('/') : ''
}

// ---------- botões e blocos ----------

export function Botao({
  children,
  variante = 'primario',
  grande,
  className,
  ...p
}: { variante?: 'primario' | 'secundario' | 'perigo' | 'leve'; grande?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const estilos = {
    primario: 'bg-[var(--marca)] text-white hover:brightness-110',
    secundario: 'bg-[var(--marca-suave)] text-[var(--marca)] hover:brightness-95',
    perigo: 'bg-[var(--ruim)] text-white',
    leve: 'bg-transparent text-[var(--marca)] hover:bg-[var(--marca-suave)]',
  }[variante]
  return (
    <button
      type="button"
      {...p}
      className={cx('rounded-xl font-semibold transition disabled:opacity-50', grande ? 'min-h-12 px-5 py-3 text-base' : 'min-h-10 px-4 py-2 text-sm', estilos, className)}
    >
      {children}
    </button>
  )
}

export function Cartao({ titulo, acao, children, className, ajuda }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string; ajuda?: string }) {
  return (
    <section className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm', className)}>
      {(titulo || acao) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1 text-base font-bold">
            {titulo}
            {ajuda && <Info texto={ajuda} />}
          </h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * "ⓘ" com explicação e EXEMPLO destacado (como no Dia a Dia). O texto pode ter "Ex.: …": a parte do exemplo vira
 * um quadro. Abre no toque, fecha no toque fora ou no Esc. Tudo traduzido (pt/es).
 */
export function Info({ texto, exemplo }: { texto: string; exemplo?: string }) {
  const [aberto, setAberto] = useState(false)
  const t = useT()
  useEffect(() => {
    if (!aberto) return
    const fechar = () => setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    setTimeout(() => window.addEventListener('click', fechar), 0)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('click', fechar)
      window.removeEventListener('keydown', esc)
    }
  }, [aberto])
  const traduzido = t(texto)
  const corte = traduzido.search(/\b(Ex\.|Ej\.):?\s/)
  const explicacao = corte > 0 ? traduzido.slice(0, corte).trim() : traduzido
  const ex = exemplo ? t(exemplo) : corte > 0 ? traduzido.slice(corte).replace(/^(Ex\.|Ej\.):?\s*/, '') : undefined
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label={t('Explicação')} aria-expanded={aberto} onClick={(e) => (e.stopPropagation(), setAberto(!aberto))} className={cx('ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition', aberto ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
        i
      </button>
      {aberto && (
        <span role="tooltip" onClick={(e) => e.stopPropagation()} className="absolute left-1/2 top-8 z-40 w-72 max-w-[80vw] -translate-x-1/2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left text-sm font-normal normal-case leading-snug text-[var(--texto)] shadow-xl">
          <span className="block">{explicacao}</span>
          {ex && (
            <span className="mt-2 block rounded-xl bg-[var(--marca-suave)] p-2 text-[var(--marca)]">
              <b className="mb-0.5 block text-[11px] uppercase tracking-wide">{t('Exemplo')}</b>
              {ex}
            </span>
          )}
        </span>
      )}
    </span>
  )
}

export function Pilula({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'bom' | 'alerta' | 'ruim' | 'marca' }) {
  const c = {
    neutro: 'bg-[var(--borda)] text-[var(--texto)]',
    bom: 'bg-[var(--bom)]/15 text-[var(--bom)]',
    alerta: 'bg-[var(--alerta)]/15 text-[var(--alerta)]',
    ruim: 'bg-[var(--ruim)]/15 text-[var(--ruim)]',
    marca: 'bg-[var(--marca-suave)] text-[var(--marca)]',
  }[tom]
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', c)}>{children}</span>
}

export function Vazio({ texto, children }: { texto: string; children?: ReactNode }) {
  const t = useT()
  return (
    <div className="rounded-xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">
      <p>{t(texto)}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function Carregando() {
  const t = useT()
  return <p className="p-6 text-center text-[var(--suave)]">{t('Carregando…')}</p>
}

export function Erro({ texto }: { texto?: string }) {
  if (!texto) return null
  return <p className="rounded-xl bg-[var(--ruim)]/10 p-3 text-sm text-[var(--ruim)]">{texto}</p>
}

export function Titulo({ children, acao, subtitulo }: { children: ReactNode; acao?: ReactNode; subtitulo?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold">{children}</h1>
        {subtitulo && <p className="text-sm text-[var(--suave)]">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Abas({ abas, atual, onChange }: { abas: { id: string; nome: string; extra?: ReactNode }[]; atual: string; onChange(id: string): void }) {
  const t = useT()
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[var(--marca-suave)] p-1">
      {abas.map((a) => (
        <button
          key={a.id}
          role="tab"
          aria-selected={a.id === atual}
          type="button"
          onClick={() => onChange(a.id)}
          className={cx('min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold', a.id === atual ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}
        >
          {t(a.nome)} {a.extra}
        </button>
      ))}
    </div>
  )
}

// ---------- campos ----------

export function Campo({ rotulo, ajuda, children, className }: { rotulo: string; ajuda?: string; children: ReactNode; className?: string }) {
  const t = useT()
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 flex items-center text-sm font-semibold text-[var(--suave)]">
        {t(rotulo)}
        {ajuda && <Info texto={ajuda} />}
      </span>
      {children}
    </label>
  )
}

const classeEntradaBase = 'min-h-11 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-base outline-none focus:border-[var(--marca)]'

/** largura: "w-auto"/"w-…" no className troca o padrão (largura toda) */
function classeEntrada(extra?: string) {
  return cx(classeEntradaBase, !/(^|\s)w-/.test(extra ?? '') && 'w-full', extra)
}

export function Entrada(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={classeEntrada(p.className)} />
}

export function Selecao({ opcoes, valor, onChange, vazio, className }: { opcoes: { id: string; nome: string }[]; valor?: string; onChange(v: string): void; vazio?: string; className?: string }) {
  const t = useT()
  return (
    <select value={valor ?? ''} onChange={(e) => onChange(e.target.value)} className={classeEntrada(className)}>
      {vazio !== undefined && <option value="">{t(vazio)}</option>}
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nome}
        </option>
      ))}
    </select>
  )
}

/** Campo de dinheiro: aceita "1.474,80", "70", "70,5"; mostra o erro na hora. */
export function ValorInput({ moeda, valor, onChange, placeholder }: { moeda: string; valor?: number; onChange(v: number | undefined): void; placeholder?: string }) {
  const casas = moedaDe(moeda).casas
  const [texto, setTexto] = useState(valor !== undefined ? formatar(valor, moeda, { semSimbolo: true }) : '')
  const [ultimo, setUltimo] = useState(valor)
  if (valor !== ultimo) {
    setUltimo(valor)
    setTexto(valor !== undefined ? formatar(valor, moeda, { semSimbolo: true }) : '')
  }
  const invalido = texto !== '' && lerValor(texto, moeda) === null
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--suave)]">{moedaDe(moeda).simbolo}</span>
      <input
        inputMode="decimal"
        value={texto}
        placeholder={placeholder ?? (casas ? '0,00' : '0')}
        onChange={(e) => {
          setTexto(e.target.value)
          const v = lerValor(e.target.value, moeda)
          const novo = v === null ? undefined : v
          setUltimo(novo)
          onChange(novo)
        }}
        className={classeEntrada(cx('num pl-11', invalido && 'border-[var(--ruim)]'))}
      />
    </div>
  )
}

/** Quantidade em gramas com troca g/kg (o caderno usa os dois: "2 kg" e "2008 g"). */
export function GramasInput({ valor, onChange }: { valor?: number; onChange(g: number | undefined): void }) {
  const [unidade, setUnidade] = useState<'g' | 'kg'>('g')
  const [texto, setTexto] = useState(valor ? String(valor) : '')
  const ler = (t: string, u: 'g' | 'kg') => {
    const n = Number(t.replace(/\./g, '').replace(',', '.'))
    if (!t || !Number.isFinite(n) || n <= 0) return undefined
    return Math.round(u === 'kg' ? n * 1000 : n)
  }
  return (
    <div className="flex gap-1">
      <input inputMode="decimal" value={texto} onChange={(e) => (setTexto(e.target.value), onChange(ler(e.target.value, unidade)))} className={classeEntrada('num')} placeholder={unidade === 'g' ? '2008' : '2,5'} />
      <button type="button" onClick={() => {
        const u = unidade === 'g' ? 'kg' : 'g'
        setUnidade(u)
        onChange(ler(texto, u))
      }} className="min-h-11 shrink-0 rounded-xl border border-[var(--borda)] px-3 text-sm font-bold">
        {unidade}
      </button>
    </div>
  )
}

// ---------- janela (folha que sobe no celular, centralizada no desktop) ----------

export function Janela({ aberta, titulo, onFechar, children, rodape, larga }: { aberta: boolean; titulo: ReactNode; onFechar(): void; children: ReactNode; rodape?: ReactNode; larga?: boolean }) {
  const id = useId()
  const t = useT()
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberta, onFechar])
  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
        className={cx('flex max-h-[92vh] max-h-[92dvh] min-h-0 w-full flex-col rounded-t-3xl bg-[var(--cartao)] shadow-xl md:rounded-3xl', larga ? 'md:max-w-4xl' : 'md:max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-[var(--borda)] px-4 py-3">
          <h2 id={id} className="text-lg font-bold">
            {titulo}
          </h2>
          <button type="button" onClick={onFechar} aria-label={t('Fechar')} className="h-10 w-10 rounded-full text-xl hover:bg-[var(--marca-suave)]">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {rodape && <div className="border-t border-[var(--borda)] p-3">{rodape}</div>}
      </div>
    </div>
  )
}

// ---------- cartão de número (painel) ----------

export function CartaoNumero({ c, onClick }: { c: CartaoDados; onClick?: () => void }) {
  const t = useT()
  const { ir } = useApp()
  const variacao = c.anterior !== undefined && c.anterior !== 0 ? Math.round(((c.valor - c.anterior) / Math.abs(c.anterior)) * 100) : undefined
  const cor = c.destaque === 'ruim' ? 'text-[var(--ruim)]' : c.destaque === 'alerta' ? 'text-[var(--alerta)]' : ''
  const clicavel = onClick || c.detalhe
  return (
    <div
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onClick ?? (c.detalhe ? () => ir(c.detalhe!.tela, c.detalhe!.filtro) : undefined)}
      onKeyDown={(e) => e.key === 'Enter' && (onClick ?? (c.detalhe ? () => ir(c.detalhe!.tela, c.detalhe!.filtro) : undefined))?.()}
      className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left', clicavel && 'cursor-pointer hover:border-[var(--marca)]')}
    >
      <div className="flex items-start justify-between text-xs font-semibold text-[var(--suave)]">
        <span className="flex items-center">
          {t(c.nome)}
          <Info texto={c.ajuda} />
        </span>
        {variacao !== undefined && <span className={variacao >= 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'}>{variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao) > 999 ? '999+' : Math.abs(variacao)}%</span>}
      </div>
      <div className={cx('num mt-1 break-words text-xl font-bold', cor)}>{fmt(c.valor, c.formato, c.moeda)}</div>
    </div>
  )
}
