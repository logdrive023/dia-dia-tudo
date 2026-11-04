// CARTÃO DE EVENTO — o único jeito de mostrar "uma coisa que aconteceu" em qualquer histórico (linha do tempo do
// pedido/venda, histórico do pacote, caminho do cabelo). Feito para bater o olho:
//
//   [ícone]  O QUE ACONTECEU                                      +3 kg      ← o número que importa, grande e colorido
//            o resumo numa linha (o item, o texto)
//            [Bruto → Normal]  🕒 10:00  👤 Paula  💳 Pix            ← selos separados, nada de "a · b · c · d"
//            ↗ P-0005  +1                                detalhes ▾
//   ┌ aberto: cada informação num bloco, com o rótulo pequeno em cima ─────────────────────────────┐
//   │  ANTES 6 kg  →  MUDOU +3 kg  →  DEPOIS 9 kg      (o principal, largo)                       │
//   │  QUANDO …      TIPO …      MOTIVO …      ITENS (lista com total)      REFERÊNCIAS (botões)  │
//   └──────────────────────────────────────────────────────────────────────────────────────────────┘
// Quem usa só passa o conteúdo; tamanho, cor, espaçamento e ordem são sempre estes.

import type { ReactNode } from 'react'
import { cx, loc } from './base'
import { useT } from './i18n'

export type TomEvento = 'bom' | 'ruim' | 'marca' | 'alerta' | 'suave'
const COR: Record<TomEvento, string> = { bom: 'var(--bom)', ruim: 'var(--ruim)', marca: 'var(--marca)', alerta: 'var(--alerta)', suave: 'var(--suave)' }

/** Cabeçalho de um dia do histórico: a data em destaque, o dia da semana e quantos eventos; à direita, o que a tela quiser (saldo do dia). */
export function CabecalhoDia({ data, quantos, direita, className }: { data: string; quantos?: number; direita?: ReactNode; className?: string }) {
  const t = useT()
  const d = new Date(data.slice(0, 10) + 'T12:00:00')
  return (
    <header className={cx('mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1', className)}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--marca)]" />
      <b className="num text-sm sm:text-base">{d.toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' })}</b>
      <span className="text-xs capitalize text-[var(--suave)]">{d.toLocaleDateString(loc(), { weekday: 'long' })}</span>
      {quantos !== undefined && <span className="num rounded-full bg-[var(--fundo)] px-2 text-xs text-[var(--suave)] ring-1 ring-[var(--borda)]">{t('{n} evento(s)', { n: quantos })}</span>}
      {direita && <span className="ml-auto">{direita}</span>}
    </header>
  )
}

/** Lista de cartões de um dia (a moldura com as divisórias). */
export function ListaEventos({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">{children}</ul>
}

/** Um selo pequeno da linha de informações (hora, quem, forma…). */
export function SeloEvento({ icone, children, title }: { icone?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className="num inline-flex min-h-6 max-w-full items-center gap-1 rounded-full bg-[var(--fundo)] px-2 text-xs text-[var(--suave)] ring-1 ring-[var(--borda)]">
      {icone && <span aria-hidden>{icone}</span>}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function CartaoEvento({ icone, tom = 'marca', titulo, etapa, resumo, selos, valor, valorTom, valorAntes, referencia, aberto, onAlternar, children }: {
  icone: string
  /** cor do ícone e da faixa à esquerda */
  tom?: TomEvento
  titulo: ReactNode
  /** mudança de etapa (de → para), num selo à parte */
  etapa?: { de?: string; para?: string }
  /** uma linha curta: o item, o texto do registro */
  resumo?: ReactNode
  /** hora, quem, forma… (cada um num selo; vazios somem) */
  selos?: ReactNode[]
  /** o número que importa (+3 kg, Bs 15.000) */
  valor?: ReactNode
  valorTom?: TomEvento
  /** valor anterior riscado (quando o total mudou) */
  valorAntes?: ReactNode
  /** para onde o evento leva (um toque abre); `mais`: quantas outras referências há nos detalhes */
  referencia?: { rotulo: ReactNode; abrir(): void; mais?: number }
  aberto?: boolean
  onAlternar?(): void
  /** os detalhes (use DetalhesEvento + BlocoDetalhe) */
  children?: ReactNode
}) {
  const t = useT()
  const cor = COR[tom]
  const temDetalhe = !!children && !!onAlternar
  const visiveis = (selos ?? []).filter((x) => x !== undefined && x !== null && x !== false && x !== '')
  return (
    <li className="relative">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor, opacity: 0.55 }} />
      <div className="flex gap-3 py-3 pl-4 pr-3 sm:gap-4 sm:py-3.5 sm:pr-4">
        <span aria-hidden className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `color-mix(in srgb, ${cor} 13%, transparent)` }}>{icone}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{titulo}</p>
              {resumo && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--suave)] [overflow-wrap:anywhere]">{resumo}</p>}
            </div>
            {valor !== undefined && valor !== null && valor !== '' && (
              <div className="shrink-0 text-right">
                <b className="num block whitespace-nowrap text-lg font-black leading-tight sm:text-xl" style={valorTom ? { color: COR[valorTom] } : undefined}>{valor}</b>
                {valorAntes && <s className="num block whitespace-nowrap text-xs text-[var(--suave)]">{valorAntes}</s>}
              </div>
            )}
          </div>
          {(etapa?.para || visiveis.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {etapa?.para && (
                <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-[var(--marca-suave)] px-2 text-xs font-semibold text-[var(--marca)]">
                  {etapa.de && <><span className="font-normal opacity-80">{t(etapa.de)}</span><span aria-hidden>→</span></>}
                  {t(etapa.para)}
                </span>
              )}
              {visiveis.map((s, k) => <span key={k} className="contents">{s}</span>)}
            </div>
          )}
          {(referencia || temDetalhe) && (
            <div className="-mb-1 mt-1.5 flex flex-wrap items-center gap-x-2">
              {referencia && (
                <button type="button" onClick={referencia.abrir} className="-ml-2 inline-flex min-h-10 max-w-full items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                  <span aria-hidden>↗</span><span className="truncate">{referencia.rotulo}</span>
                  {!!referencia.mais && <span className="num rounded-full bg-[var(--marca-suave)] px-1.5 text-xs">+{referencia.mais}</span>}
                </button>
              )}
              {temDetalhe && (
                <button type="button" aria-expanded={aberto} onClick={onAlternar} className="-mr-2 ml-auto inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                  {aberto ? t('fechar') : t('detalhes')}<span aria-hidden className={cx('transition-transform', aberto && 'rotate-180')}>▾</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {aberto && children}
    </li>
  )
}

/** A área aberta do cartão: blocos lado a lado (1 coluna no celular, 2 a partir da tela média). */
export function DetalhesEvento({ children }: { children: ReactNode }) {
  return <dl className="mx-3 mb-3 grid gap-2 rounded-xl bg-[var(--fundo)] p-2 sm:mx-4 sm:ml-[4.5rem] sm:grid-cols-2 sm:p-3">{children}</dl>
}

/** Um bloco do detalhe: rótulo pequeno em cima, a informação embaixo. `largo`: ocupa a linha toda. */
export function BlocoDetalhe({ rotulo, largo, children }: { rotulo: string; largo?: boolean; children: ReactNode }) {
  const t = useT()
  return (
    <div className={cx('min-w-0 rounded-lg bg-[var(--cartao)] px-3 py-2 ring-1 ring-[var(--borda)]', largo && 'sm:col-span-2')}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t(rotulo)}</dt>
      <dd className="mt-1 text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/** Antes → mudou → depois: três números com setas (o "o que mudou" sem ter que fazer conta). */
export function AntesDepois({ antes, mudou, depois, negativo, rotulo }: { antes: ReactNode; mudou: ReactNode; depois: ReactNode; negativo?: boolean; rotulo?: ReactNode }) {
  const t = useT()
  const caixa = 'min-w-0 rounded-lg bg-[var(--fundo)] px-2 py-1.5 text-center'
  const nome = 'block text-[10px] font-semibold uppercase tracking-wide text-[var(--suave)]'
  return (
    <div>
      {rotulo && <p className="mb-1 text-xs text-[var(--suave)]">{rotulo}</p>}
      <div className="num grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
        <span className={caixa}><span className={nome}>{t('antes')}</span>{antes}</span>
        <span aria-hidden className="text-[var(--suave)]">→</span>
        <span className={cx(caixa, 'font-bold', negativo ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}><span className={nome}>{t('mudou')}</span>{mudou}</span>
        <span aria-hidden className="text-[var(--suave)]">→</span>
        <span className={cx(caixa, 'font-black')}><span className={nome}>{t('depois')}</span>{depois}</span>
      </div>
    </div>
  )
}

/** Botão de referência (lote, venda, compra…): um toque abre. */
export function BotaoReferencia({ icone, children, onClick }: { icone?: string; children: ReactNode; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-[var(--marca-suave)] px-3 text-sm font-semibold text-[var(--marca)] hover:brightness-95">
      {icone && <span aria-hidden>{icone}</span>}<span className="truncate">{children}</span><span aria-hidden>→</span>
    </button>
  )
}
