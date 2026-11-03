// Peças de tela reaproveitadas em tudo: botões, cartões, campos, janelas, "ⓘ" com exemplo e números formatados.

import { createPortal } from 'react-dom'
import { type ReactNode, useEffect, useId, useState, useLayoutEffect, useRef } from 'react'
import { formatar, lerValor, moeda as moedaDe } from '../core/domain/dinheiro'
import type { Cartao as CartaoDados, Formato } from '../core/modulos'
import { useApp } from './contexto'
import { useT } from './i18n'

export function cx(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(' ')
}

// ---------- números ----------

// formato do idioma escolhido e moeda principal (ComIdioma ajusta ao ler as configurações)
const padroes = { locale: 'pt-BR', moeda: 'BOB' }
export function definirPadroes(p: Partial<typeof padroes>) {
  Object.assign(padroes, p)
}
/** 'pt-BR' ou 'es-BO' (datas e números) */
export const loc = () => padroes.locale
/** moeda principal das configurações (para valores sem moeda própria) */
export const moedaPadrao = () => padroes.moeda

export function gramasTexto(g: number): string {
  if (Math.abs(g) >= 1000) return `${(g / 1000).toLocaleString(loc(), { maximumFractionDigits: 3 })} kg`
  return `${g.toLocaleString(loc())} g`
}

export function fmt(valor: number, formato: Formato['tipo'] | undefined, moeda = moedaPadrao()): string {
  switch (formato) {
    case 'dinheiro':
      return formatar(valor, moeda)
    case 'gramas':
      return gramasTexto(valor)
    case 'percentual':
      return `${(valor / 100).toLocaleString(loc(), { maximumFractionDigits: 1 })}%`
    case 'dias':
      return `${valor} d`
    default:
      return valor.toLocaleString(loc())
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
/** Onde o balão cabe: abaixo do ⓘ (ou acima, se não couber), sempre dentro da tela, com 8 px de folga das bordas. */
function posicaoBalao(botao: DOMRect, alturaBalao: number) {
  const margem = 8
  const largura = Math.min(288, window.innerWidth - margem * 2)
  const centro = botao.left + botao.width / 2
  const left = Math.min(Math.max(centro - largura / 2, margem), window.innerWidth - largura - margem)
  const cabeAbaixo = botao.bottom + 8 + alturaBalao <= window.innerHeight - margem
  const top = cabeAbaixo || botao.top - 8 - alturaBalao < margem ? botao.bottom + 8 : botao.top - 8 - alturaBalao
  return { left, top, width: largura }
}

export function Info({ texto, exemplo }: { texto: string; exemplo?: string }) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>()
  const botao = useRef<HTMLButtonElement>(null)
  const balao = useRef<HTMLSpanElement>(null)
  const t = useT()
  useEffect(() => {
    if (!aberto) return
    const fechar = () => setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    setTimeout(() => window.addEventListener('click', fechar), 0)
    window.addEventListener('keydown', esc)
    // rolou a tela ou girou o celular: o balão fecha (não fica solto fora do lugar)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      window.removeEventListener('click', fechar)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])
  // mede depois de desenhar: encaixa na tela (celular estreito, ⓘ encostado na borda)
  useLayoutEffect(() => {
    if (!aberto || !botao.current) return setPos(undefined)
    setPos(posicaoBalao(botao.current.getBoundingClientRect(), balao.current?.offsetHeight ?? 120))
  }, [aberto])
  const traduzido = t(texto)
  const corte = traduzido.search(/\b(Ex\.|Ej\.):?\s/)
  const explicacao = corte > 0 ? traduzido.slice(0, corte).trim() : traduzido
  const ex = exemplo ? t(exemplo) : corte > 0 ? traduzido.slice(corte).replace(/^(Ex\.|Ej\.):?\s*/, '') : undefined
  return (
    <span className="relative inline-flex">
      <button ref={botao} type="button" aria-label={t('Explicação')} aria-expanded={aberto} onClick={(e) => (e.stopPropagation(), setAberto(!aberto))} className={cx('relative ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition after:absolute after:-inset-2 after:content-[\'\']', aberto ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
        i
      </button>
      {aberto &&
        createPortal(
        <span
          ref={balao}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={pos ? { position: 'fixed', left: pos.left, top: pos.top, width: pos.width } : { position: 'fixed', left: -9999, top: 0, width: 288 }}
          className="z-[80] rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left text-sm font-normal normal-case leading-snug text-[var(--texto)] shadow-xl"
        >
          <Explicacao texto={explicacao} />
          {ex && <ExemploDica texto={ex} rotulo={t('Exemplo')} />}
        </span>
        , document.body)}
    </span>
  )
}

// ---------- formato padrão do tooltip ----------
// Frases separadas em ". " antes de letra maiúscula (não corta "7.000" nem "3,5").
const frases = (s: string) => s.split(/\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean)

/** Explicação: uma frase por linha; "Termo: descrição" vira termo em negrito (ex.: "Só QR: para celular"). */
function Explicacao({ texto }: { texto: string }) {
  const fs = frases(texto)
  if (fs.length <= 1) return <span className="block">{texto}</span>
  return (
    <span className="block space-y-1">
      {fs.map((f, k) => {
        const m = /^([^:]{1,32}):\s+(.+)$/.exec(f)
        return (
          <span key={k} className="flex gap-1.5">
            <span aria-hidden className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-[var(--suave)]" />
            <span>{m ? <><b>{m[1]}</b>: {m[2]}</> : f}</span>
          </span>
        )
      })}
    </span>
  )
}

/**
 * Exemplo: a 1ª frase é o exemplo (números), em destaque — "a · b · c" vira etiquetas lado a lado e "… = X" deixa
 * o resultado em negrito; as frases seguintes ("Toque na linha…") viram uma dica pequena embaixo.
 */
function ExemploDica({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [primeira, ...resto] = frases(texto)
  const partes = primeira.split(' · ')
  const conta = primeira.lastIndexOf(' = ')
  return (
    <span className="mt-2 block overflow-hidden rounded-xl border border-[var(--marca-suave)]">
      <span className="block bg-[var(--marca-suave)] px-2.5 py-2 text-[var(--marca)]">
        <b className="mb-1 block text-[11px] uppercase tracking-wide opacity-80">{rotulo}</b>
        {partes.length > 1 ? (
          <span className="num flex flex-wrap gap-1">
            {partes.map((p, k) => <span key={k} className="rounded-md bg-[var(--cartao)] px-1.5 py-0.5 font-semibold text-[var(--texto)]">{p}</span>)}
          </span>
        ) : conta > 0 ? (
          <span className="num block font-semibold">{primeira.slice(0, conta)} = <b className="whitespace-nowrap text-[var(--texto)]">{primeira.slice(conta + 3)}</b></span>
        ) : (
          <span className="num block font-semibold">{primeira}</span>
        )}
      </span>
      {resto.length > 0 && <span className="block px-2.5 py-1.5 text-xs text-[var(--suave)]">💡 {resto.join('. ')}.</span>}
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

/** Registro não encontrado / erro: explica e oferece voltar (nunca "Carregando…" para sempre). */
export function ErroTela({ texto, onVoltar }: { texto: string; onVoltar(): void }) {
  const t = useT()
  return (
    <div className="mx-auto max-w-md space-y-3 pt-10 text-center">
      <p className="font-semibold">{t(texto)}</p>
      <Botao variante="secundario" onClick={onVoltar}>← {t('Voltar')}</Botao>
    </div>
  )
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

export function Abas({ abas, atual, onChange, variante = 'pilula' }: { abas: { id: string; nome: string; extra?: ReactNode }[]; atual: string; onChange(id: string): void; variante?: 'pilula' | 'sublinhado' }) {
  const t = useT()
  if (variante === 'sublinhado') {
    // até 4 abas: dividem a largura (cabem em 360 px, sem barra de rolar); mais que isso: rolam, sem barra aparente
    const cabe = abas.length <= 4
    return (
      <div role="tablist" style={cabe ? { gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` } : undefined} className={cx('mb-4 gap-1 overflow-y-hidden border-b border-[var(--borda)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', cabe ? 'grid sm:flex' : 'flex overflow-x-auto')}>
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === atual} type="button" onClick={() => onChange(a.id)} className={cx('-mb-px min-h-11 min-w-0 border-b-2 px-2 text-sm font-semibold sm:shrink-0 sm:px-3', cabe ? 'py-1 text-center leading-tight' : 'shrink-0', a.id === atual ? 'border-[var(--marca)] text-[var(--marca)]' : 'border-transparent text-[var(--suave)] hover:text-[var(--texto)]')}>
            {t(a.nome)} {a.extra}
          </button>
        ))}
      </div>
    )
  }
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

/** Escolha de formulário (uma opção entre poucas): botões segmentados, não abas. */
export function Escolha<T extends string>({ opcoes, valor, onChange, rotulo }: { opcoes: { id: T; nome: string }[]; valor: T; onChange(v: T): void; rotulo?: string }) {
  const t = useT()
  return (
    <div role="radiogroup" aria-label={rotulo ? t(rotulo) : undefined} className="flex flex-wrap gap-1 rounded-xl bg-[var(--marca-suave)] p-1">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === valor} onClick={() => onChange(o.id)} className={cx('min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold', o.id === valor ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
          {t(o.nome)}
        </button>
      ))}
    </div>
  )
}

// ---------- campos ----------

/** comoDiv: quando dentro há botões ou janela (rótulo não pode envolver outros controles) */
export function Campo({ rotulo, ajuda, children, className, comoDiv }: { rotulo: string; ajuda?: string; children: ReactNode; className?: string; comoDiv?: boolean }) {
  const t = useT()
  const Tag = comoDiv ? 'div' : 'label'
  return (
    <Tag className={cx('block', className)}>
      <span className="mb-1 flex items-center text-sm font-semibold text-[var(--suave)]">
        {t(rotulo)}
        {ajuda && <Info texto={ajuda} />}
      </span>
      {children}
    </Tag>
  )
}

// placeholder apagado (nunca parece um valor digitado)
const classeEntradaBase = 'min-h-11 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-base outline-none placeholder:font-normal placeholder:text-[var(--suave)] placeholder:opacity-70 focus:border-[var(--marca)]'

/** largura: "w-auto"/"w-…" no className troca o padrão (largura toda) */
function classeEntrada(extra?: string) {
  return cx(classeEntradaBase, !/(^|\s)w-/.test(extra ?? '') && 'w-full', extra)
}

/**
 * Aparelho de toque (celular/tablet): focar um campo sozinho abre o teclado e cobre a tela. Regra do app: no toque,
 * o cursor só vai para um campo quando a pessoa pediu (tocou no campo, num lápis, numa célula, na lupa).
 */
export function ehToque() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
}

/** autoFocus só vale no computador; `focoSempre` = o campo abriu porque a pessoa tocou para escrever */
export function Entrada({ focoSempre, autoFocus, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { focoSempre?: boolean }) {
  return <input {...p} autoFocus={autoFocus && (focoSempre || !ehToque())} className={classeEntrada(p.className)} />
}

export function Selecao({ opcoes, valor, onChange, vazio, className }: { opcoes: { id: string; nome: string }[]; valor?: string; onChange(v: string): void; vazio?: string; className?: string }) {
  const t = useT()
  return (
    <select value={valor ?? ''} onChange={(e) => onChange(e.target.value)} className={classeEntrada(className)}>
      {vazio !== undefined && <option value="">{t(vazio)}</option>}
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {t(o.nome)}
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
export function GramasInput({ valor, onChange, placeholder }: { valor?: number; onChange(g: number | undefined): void; placeholder?: { g: string; kg: string } }) {
  const [unidade, setUnidade] = useState<'g' | 'kg'>('g')
  const [texto, setTexto] = useState(valor ? String(valor) : '')
  const ler = (t: string, u: 'g' | 'kg') => {
    const n = Number(t.replace(/\./g, '').replace(',', '.'))
    if (!t || !Number.isFinite(n) || n <= 0) return undefined
    return Math.round(u === 'kg' ? n * 1000 : n)
  }
  return (
    <div className="flex gap-1">
      <input inputMode="decimal" value={texto} onChange={(e) => (setTexto(e.target.value), onChange(ler(e.target.value, unidade)))} className={classeEntrada('num')} placeholder={placeholder ? placeholder[unidade] : unidade === 'g' ? '2008' : '2,5'} />
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
    // tocar fora NÃO fecha: o formulário não perde o que foi digitado (fecha pelo × ou Esc)
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center">
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

/** Tela cheia com a mesma forma da Janela: voltar + título + conteúdo + barra de ação fixa embaixo. */
export function Pagina({ titulo, subtitulo, onVoltar, voltarRotulo, children, rodape }: { titulo: ReactNode; subtitulo?: ReactNode; onVoltar(): void; voltarRotulo?: string; children: ReactNode; rodape?: ReactNode }) {
  const t = useT()
  return (
    <div className="mx-auto max-w-4xl">
      <button type="button" onClick={onVoltar} className="mb-3 min-h-10 rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">← {t(voltarRotulo ?? 'Voltar')}</button>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      {subtitulo && <p className="mb-4 text-sm text-[var(--suave)]">{subtitulo}</p>}
      <div className={cx(!subtitulo && 'mt-4', 'pb-4')}>{children}</div>
      {/* barra fixa no fim do conteúdo (no fluxo da página: o último campo nunca fica escondido embaixo dela) */}
      {rodape && <div className="sticky bottom-20 z-20 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-lg sm:p-3 md:bottom-4">{rodape}</div>}
    </div>
  )
}

/**
 * "Tem certeza?" antes de ações que mexem em dinheiro, estoque ou agenda: diz o que vai acontecer
 * e (se pedir) o motivo, que fica no histórico.
 */
export function Confirmar({ titulo, texto, rotulo, perigo, pedirMotivo, motivoPadrao, onConfirmar, onFechar }: { titulo: string; texto: string; rotulo: string; perigo?: boolean; pedirMotivo?: boolean; motivoPadrao?: string; onConfirmar(motivo: string): void | Promise<unknown>; onFechar(): void }) {
  const t = useT()
  const [motivo, setMotivo] = useState(motivoPadrao ?? '')
  const [ocupado, setOcupado] = useState(false)
  return (
    <Janela aberta titulo={t(titulo)} onFechar={onFechar} rodape={
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
        <Botao variante={perigo ? 'perigo' : 'primario'} disabled={ocupado || (pedirMotivo && !motivo.trim())} onClick={async () => { setOcupado(true); try { await onConfirmar(motivo.trim()) } finally { setOcupado(false); onFechar() } }}>{t(rotulo)}</Botao>
      </div>
    }>
      <p className="text-sm">{t(texto)}</p>
      {pedirMotivo && <div className="mt-3"><Campo rotulo="Motivo (fica no histórico)"><Entrada autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo></div>}
    </Janela>
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
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (onClick ?? (c.detalhe ? () => ir(c.detalhe!.tela, c.detalhe!.filtro) : undefined))?.())}
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
