// Peças de tela reaproveitadas em tudo: botões, cartões, campos, janelas, "ⓘ" com exemplo e números formatados.

import { createPortal } from 'react-dom'
import { PAI } from '../app/rotas'
import { Icone, temIcone } from './icones'
import { type ReactNode, useEffect, useId, useState, useLayoutEffect, useRef } from 'react'
import { formatar, lerValor, moeda as moedaDe } from '../core/domain/dinheiro'
import type { Cartao as CartaoDados, Formato } from '../core/modulos'
import { useApp } from './contexto'
import { useT } from './i18n'
import { Trilha } from './trilha'

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

// FORMATADORES DE TELA (um só lugar; seguem o idioma): data curta, hora, data e hora, gramas com sinal, %.
const quandoDe = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
/** "03/11" */
export const diaMes = (iso: string) => quandoDe(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit' })
/** "14/10" (o ano só quando não é o deste ano: "14/10/25") */
export function diaCurto(iso?: string) {
  if (!iso) return ''
  const d = quandoDe(iso)
  return d.toLocaleDateString(loc(), d.getFullYear() === new Date().getFullYear() ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: '2-digit' })
}
/** "14/10/26" */
export const dataCurta = (iso: string) => quandoDe(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit' })
/** "seg." (dia da semana curto) */
export const diaSemana = (iso: string) => quandoDe(iso.slice(0, 10)).toLocaleDateString(loc(), { weekday: 'short' })
/** "10:42" */
export const hora = (iso: string) => new Date(iso).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
/** "14/10/26, 10:42" */
export const dataHora = (iso: string) => new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
/** "+1,9 kg" · "−300 g" · "0 g" */
export const sinalGramas = (n: number) => (n > 0 ? `+${gramasTexto(n)}` : n < 0 ? `−${gramasTexto(-n)}` : gramasTexto(0))
/** pontos-base em %: 1234 → "12,3%"; sem valor → "—" */
export const pctBp = (bp?: number) => (bp === undefined ? '—' : `${(bp / 100).toLocaleString(loc(), { maximumFractionDigits: 1 })}%`)

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
  const largura = Math.min(320, window.innerWidth - margem * 2)
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
  const [meuId] = useState(() => Math.random().toString(36).slice(2))
  useEffect(() => {
    if (!aberto) return
    const fechar = () => setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    // só um balão aberto por vez: quando outro abre, este fecha
    const outro = (e: Event) => (e as CustomEvent<string>).detail !== meuId && setAberto(false)
    window.dispatchEvent(new CustomEvent('tudo:info-abriu', { detail: meuId }))
    setTimeout(() => window.addEventListener('click', fechar), 0)
    window.addEventListener('keydown', esc)
    window.addEventListener('tudo:info-abriu', outro)
    // rolou a tela ou girou o celular: o balão fecha (não fica solto fora do lugar)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      window.removeEventListener('click', fechar)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('tudo:info-abriu', outro)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto, meuId])
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
          className="z-[80] max-h-[70vh] overflow-y-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-left text-sm font-normal normal-case leading-relaxed text-[var(--texto)] shadow-xl"
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
const frases = (s: string) => s.split(/\.\s+(?=[^a-zà-ÿ\s])/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean)

/** Explicação: uma frase por linha; "Termo: descrição" vira termo em negrito (ex.: "Só QR: para celular"). */
function Explicacao({ texto }: { texto: string }) {
  const fs = frases(texto)
  if (fs.length <= 1) return <span className="block">{texto}</span>
  return (
    <span className="block space-y-2">
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
  const t = useT()
  // VÁRIOS exemplos ("Ex.: … Ex.: …"): cada um numa linha própria, com espaço entre eles (nada amontoado num parágrafo);
  // o que não é exemplo (frases depois da conta) vira a dica pequena embaixo
  const blocos = texto.split(/\s*\b(?:Ex\.|Ej\.):?\s*/).map((x) => x.trim()).filter(Boolean)
  const exemplos: string[] = []
  const dicas: string[] = []
  for (const b of blocos) {
    const [primeira, ...resto] = frases(b)
    if (primeira) exemplos.push(primeira)
    dicas.push(...resto)
  }
  const umExemplo = (ex: string) => {
    const partes = ex.split(' · ')
    // "… = X" só vira conta quando X é curto (um número: "Bs 7.000"); frase longa depois do "=" fica como texto
    const idxIgual = ex.lastIndexOf(' = ')
    const conta = idxIgual > 0 && ex.length - idxIgual - 3 <= 18 ? idxIgual : -1
    return partes.length > 1 ? (
      <span className="num flex flex-wrap gap-1">
        {partes.map((p, k) => <span key={k} className="rounded-md bg-[var(--cartao)] px-1.5 py-0.5 font-semibold text-[var(--texto)]">{p}</span>)}
      </span>
    ) : conta > 0 ? (
      <span className="num block font-semibold">{ex.slice(0, conta)} = <b className="whitespace-nowrap text-[var(--texto)]">{ex.slice(conta + 3)}</b></span>
    ) : (
      <span className="num block font-semibold">{ex}</span>
    )
  }
  return (
    <span className="mt-3 block overflow-hidden rounded-xl border border-[var(--marca-suave)]">
      <span className="block bg-[var(--marca-suave)] px-3 py-2.5 text-[var(--marca)]">
        <b className="mb-1.5 block text-[11px] uppercase tracking-wide opacity-80">{exemplos.length > 1 ? t('{n} exemplos', { n: exemplos.length }) : rotulo}</b>
        {exemplos.length > 1 ? (
          <span className="block divide-y divide-[var(--marca)]/15">
            {exemplos.map((ex, k) => <span key={k} className="flex gap-2 py-1.5 first:pt-0 last:pb-0"><span aria-hidden className="num shrink-0 text-xs font-bold opacity-60">{k + 1}</span><span className="min-w-0">{umExemplo(ex)}</span></span>)}
          </span>
        ) : exemplos[0] ? umExemplo(exemplos[0]) : null}
      </span>
      {dicas.length > 0 && <span className="block space-y-1 px-3 py-2 text-xs leading-relaxed text-[var(--suave)]">{dicas.map((d, k) => <span key={k} className="block">💡 {d}.</span>)}</span>}
    </span>
  )
}

/** TONS de selo/pílula (uma paleta só no sistema: situação, pendência, selos dos números grandes, reserva) */
export type Tom = 'neutro' | 'suave' | 'bom' | 'alerta' | 'ruim' | 'marca'
export const COR_TOM: Record<Tom, string> = {
  neutro: 'bg-[var(--borda)] text-[var(--texto)]',
  suave: 'bg-[var(--fundo)] text-[var(--suave)]',
  bom: 'bg-[var(--bom)]/15 text-[var(--bom)]',
  alerta: 'bg-[var(--alerta)]/15 text-[var(--alerta)]',
  ruim: 'bg-[var(--ruim)]/15 text-[var(--ruim)]',
  marca: 'bg-[var(--marca-suave)] text-[var(--marca)]',
}

/** `pequena`: o selo de 11 px (dentro de números grandes e linhas de lista); `title` aparece ao passar o mouse */
export function Pilula({ children, tom = 'neutro', pequena, title, className }: { children: ReactNode; tom?: Tom; pequena?: boolean; title?: string; className?: string }) {
  return <span title={title} className={cx('num inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 font-semibold', pequena ? 'text-[11px]' : 'text-xs', COR_TOM[tom], className)}>{children}</span>
}

/**
 * "▸ Ver mais / ▾ Esconder" (o mesmo jeito de abrir e fechar no lugar em todas as telas): link na cor da marca, seta
 * que gira, `aria-expanded`. `rotuloAberto` troca o texto quando aberto ("Ver rastreio" → "Fechar o rastreio").
 */
export function BotaoExpandir({ aberto, onClick, children, rotuloAberto, className }: { aberto: boolean; onClick(): void; children: ReactNode; rotuloAberto?: ReactNode; className?: string }) {
  return (
    <button type="button" aria-expanded={aberto} onClick={onClick} className={cx('inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]', className)}>
      <span aria-hidden className={cx('inline-block text-xs transition-transform', aberto && 'rotate-90')}>▸</span>
      <span>{aberto && rotuloAberto !== undefined ? rotuloAberto : children}</span>
    </button>
  )
}

/** Título de seção pequeno em maiúsculas ("VEIO DE", "PACOTES DESTA COMPRA · 3"): o mesmo em todas as telas */
export function TituloSecao({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cx('text-xs font-semibold uppercase tracking-wide text-[var(--suave)]', className)}>{children}</h3>
}

/** Nada para mostrar. `compacto`: uma linha cinza (dentro de um cartão ou seção); sem ele, o quadro tracejado da página. */
export function Vazio({ texto, children, compacto }: { texto: string; children?: ReactNode; compacto?: boolean }) {
  const t = useT()
  if (compacto) return <p className="text-sm text-[var(--suave)]">{t(texto)}{children}</p>
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

/**
 * Registro não encontrado / erro: explica e oferece voltar (nunca "Carregando…" para sempre). Sem `onVoltar`, volta
 * pela regra do App (a mesma da trilha: a lista de origem), e não para uma tela fixa.
 */
export function ErroTela({ texto, onVoltar }: { texto: string; onVoltar?(): void }) {
  const t = useT()
  const { voltar } = useApp()
  return (
    <div className="mx-auto max-w-md space-y-3 pt-10 text-center">
      <p className="font-semibold">{t(texto)}</p>
      <Botao variante="secundario" onClick={onVoltar ?? voltar}>← {t('Voltar')}</Botao>
    </div>
  )
}

/**
 * CABEÇALHO DE TELA (PageHeader) — O ÚNICO do sistema. Regra permanente: toda tela de módulo/lista/formulário usa este;
 * nada de <h1> montado à mão. A estrutura é fixa e só o CONTEÚDO muda:
 *   [ Título (texto, sem emoji)            ]  [ ações ]
 *   [ uma linha do para que serve (opcional)]
 * - título: 24 px, negrito; descrição: 14 px cinza, logo abaixo (sem descrição o bloco mantém a mesma altura mínima);
 * - ações: à direita, alinhadas ao centro do bloco, TODAS com 44 px de altura (principal = Botao cheio / MenuAcoes
 *   `principal`; secundárias = AcaoIcone com dica ou Botao secundário). Ficam à direita do título enquanto couberem;
 *   quando não cabem (celular, muitas ações, título longo) descem inteiras para a linha de baixo — o título nunca é
 *   espremido. Funciona sozinho com qualquer quantidade de ações;
 * - 16 px abaixo do cabeçalho, sempre. A trilha (← Origem › Tela) fica ACIMA, fora do cabeçalho.
 * VISUAL: tudo num CARTÃO (borda, sombra leve, cantos 16 px) com um brilho suave da cor da marca à esquerda, o ÍCONE
 * do módulo (o mesmo do menu; vem da tela atual, ninguém precisa passar) num quadrado com degradê. `icone` troca o
 * ícone quando a tela não é um módulo do menu.
 * (A ficha de UMA coisa — pacote, pedido, viagem — usa o CabecalhoFicha, que tem código, situação e valor.)
 */
export function Titulo({ children, acao, subtitulo, icone }: { children: ReactNode; acao?: ReactNode; subtitulo?: ReactNode; icone?: string }) {
  const { nav } = useApp()
  // o módulo da tela (novaCompra → comprar, vendas → vender, configSecao → config…): o ícone é o do menu
  let modulo = nav.tela
  for (let i = 0; i < 3 && !temIcone(modulo) && PAI[modulo]; i++) modulo = PAI[modulo]
  const nomeIcone = icone ?? (temIcone(modulo) ? modulo : undefined)
  return (
    <header className="relative mb-4 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_16px_-8px_rgba(16,24,40,.08)] sm:px-5">
      {/* brilho da marca (decoração: não pega toque, não é lido) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--marca)_9%,transparent)_0%,transparent_55%)]" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--marca),color-mix(in_srgb,var(--marca)_55%,#ec4899),transparent)]" />
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--marca)_6%,transparent)] blur-2xl" />
      {/* SE AJUSTA SOZINHO a qualquer conteúdo: o título nunca fica mais estreito que ~18rem (não espreme); as ações
          ficam ao lado enquanto couberem e, se não, descem inteiras para a linha de baixo (e quebram entre si) */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_18rem] items-center gap-3 sm:gap-4">
          {nomeIcone && (
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] text-white shadow-[0_6px_14px_-6px_color-mix(in_srgb,var(--marca)_70%,transparent)] sm:h-12 sm:w-12">
              <Icone nome={nomeIcone} className="h-6 w-6" />
            </span>
          )}
          <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{children}</h1>
            {subtitulo && <p className="mt-1 text-sm leading-snug text-[var(--suave)]">{subtitulo}</p>}
          </div>
        </div>
        {acao && <div className="flex min-w-0 max-w-full flex-[0_1_auto] flex-wrap items-center gap-2 sm:ml-auto sm:justify-end [&_button]:min-h-11">{acao}</div>}
      </div>
    </header>
  )
}

export function Abas({ abas, atual, onChange, variante = 'pilula' }: { abas: { id: string; nome: string; extra?: ReactNode; desativada?: boolean }[]; atual: string; onChange(id: string): void; variante?: 'pilula' | 'sublinhado' }) {
  const t = useT()
  if (variante === 'sublinhado') {
    // até 4 abas: dividem a largura (cabem em 360 px, sem barra de rolar); mais que isso: rolam, sem barra aparente
    const cabe = abas.length <= 4
    return (
      <div role="tablist" style={cabe ? { gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` } : undefined} className={cx('mb-4 gap-1 overflow-y-hidden border-b border-[var(--borda)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', cabe ? 'grid sm:flex' : 'flex overflow-x-auto')}>
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === atual} type="button" disabled={a.desativada} title={a.desativada ? t('Em breve') : undefined} onClick={() => onChange(a.id)} className={cx('-mb-px disabled:cursor-not-allowed disabled:opacity-40 min-h-11 min-w-0 border-b-2 px-2 text-sm font-semibold sm:shrink-0 sm:px-3', cabe ? 'py-1 text-center leading-tight' : 'shrink-0', a.id === atual ? 'border-[var(--marca)] text-[var(--marca)]' : 'border-transparent text-[var(--suave)] hover:text-[var(--texto)]')}>
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
          disabled={a.desativada}
          title={a.desativada ? t('Em breve') : undefined}
          onClick={() => onChange(a.id)}
          className={cx('min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40', a.id === atual ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}
        >
          {t(a.nome)} {a.extra}{a.desativada && <span className="ml-1 text-[10px] uppercase">{t('em breve')}</span>}
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
/**
 * `trilha`: o nome curto da página atual na trilha ("VG-0002", "Nova viagem"); sem ele, usa o título se for texto.
 * `onVoltar` igual ao voltar do App → a trilha mostra a origem certa; um voltar próprio (passo de formulário) mostra
 * `voltarRotulo` ou "Voltar".
 */
export function Pagina({ titulo, subtitulo, onVoltar, voltarRotulo, trilha, children, rodape }: { titulo: ReactNode; subtitulo?: ReactNode; onVoltar(): void; voltarRotulo?: string; trilha?: ReactNode; children: ReactNode; rodape?: ReactNode }) {
  const { voltar } = useApp()
  const proprio = onVoltar !== voltar
  return (
    <div className="mx-auto max-w-4xl">
      <Trilha atual={trilha ?? (typeof titulo === 'string' ? titulo : undefined)} onVoltar={proprio ? onVoltar : undefined} rotuloVoltar={proprio ? voltarRotulo : undefined} />
      <Titulo subtitulo={subtitulo}>{titulo}</Titulo>
      <div className="pb-4">{children}</div>
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
