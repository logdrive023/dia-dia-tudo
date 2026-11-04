// FILTRO PADRÃO (o mesmo jeito em todas as listas): uma linha com a busca + "⚙ Filtros · N"; embaixo, os filtros
// ligados em chips com ✕ ("👤 Maria ✕") e "Limpar filtros"; o botão abre o painel no lugar, com os campos em
// GRUPOS separados (bloco com título e ícone: "🛒 De onde veio", "👤 Quem", "💇 O cabelo") e um rodapé
// "Limpar · Ver N resultados". Celular: dois campos por linha; computador: quatro. Tudo no endereço (quem usa decide).
// Variação permitida: atalhos (chips de período, abas) ficam fora do painel, mas o painel e os chips são sempre estes.

import { type KeyboardEvent, type ReactNode, useState } from 'react'
import { Botao, Entrada, Vazio, cx } from './base'
import { type Preset, calcularPeriodo } from './filtros'
import { useT } from './i18n'

export interface FiltroAtivo {
  /** chave(s) do endereço que o ✕ apaga, separadas por vírgula ("de,ate") */
  k: string
  rotulo: string
}

/**
 * Busca + botão "⚙ Filtros · N" (mesma altura, mesma ordem em toda tela). `extra` vai entre os dois (ex.: 📷).
 * Lista só com busca (sem painel): sem `onAlternar`, o botão não aparece.
 */
export function BarraFiltros({ busca, onBusca, placeholder, ativos = 0, aberto = false, onAlternar, extra, onKeyDown, autoFocus }: { busca: string; onBusca(v: string): void; placeholder: string; ativos?: number; aberto?: boolean; onAlternar?(): void; extra?: ReactNode; onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void; autoFocus?: boolean }) {
  const t = useT()
  return (
    <div className="flex items-center gap-2">
      <Entrada type="search" aria-label={t(placeholder)} className="w-auto min-w-0 flex-1" placeholder={t(placeholder)} value={busca} onChange={(e) => onBusca(e.target.value)} onKeyDown={onKeyDown} autoFocus={autoFocus} focoSempre={autoFocus} />
      {extra}
      {onAlternar && <button type="button" aria-expanded={aberto} aria-label={t('Filtros')} onClick={onAlternar}
        className={cx('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', aberto || ativos ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)]')}>
        <span aria-hidden>⚙︎</span>
        <span className="hidden sm:inline">{t('Filtros')}</span>
        {ativos > 0 && <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--marca)] px-1 text-xs text-white">{ativos}</span>}
        <span aria-hidden className={cx('text-xs transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>}
    </div>
  )
}

/** Os filtros ligados, um chip cada (✕ tira só aquele) + "Limpar filtros". Nada ligado: não mostra nada. */
export function ChipsFiltros({ itens, onTirar, onLimpar }: { itens: FiltroAtivo[]; onTirar(k: string): void; onLimpar(): void }) {
  const t = useT()
  if (!itens.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {itens.map((a) => (
        <button key={a.k} type="button" onClick={() => onTirar(a.k)} aria-label={`${t('Tirar filtro')} ${a.rotulo}`}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-[var(--marca)] bg-[var(--marca-suave)] pl-3 pr-2 font-semibold text-[var(--marca)] hover:brightness-95">
          <span className="truncate">{a.rotulo}</span><span aria-hidden className="text-xs">✕</span>
        </button>
      ))}
      <button type="button" onClick={onLimpar} className="min-h-9 rounded-lg px-2 font-semibold text-[var(--suave)] hover:text-[var(--marca)]">{t('Limpar filtros')}</button>
    </div>
  )
}

/** O painel: grupos (GrupoFiltro) + rodapé "Limpar · Ver N resultados" (fecha o painel). */
export function PainelFiltros({ children, resultados, onFechar, onLimpar, temAtivos }: { children: ReactNode; resultados?: number; onFechar(): void; onLimpar(): void; temAtivos: boolean }) {
  const t = useT()
  return (
    <section aria-label={t('Filtros')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="space-y-2 p-2 sm:p-3">{children}</div>
      <div className="flex items-center justify-end gap-2 border-t border-[var(--borda)] bg-[var(--fundo)] px-3 py-2">
        <Botao variante="leve" disabled={!temAtivos} onClick={onLimpar}>{t('Limpar filtros')}</Botao>
        <Botao onClick={onFechar}>{resultados === undefined ? t('Pronto') : t(resultados === 1 ? 'Ver 1 resultado' : 'Ver {n} resultados', { n: resultados })}</Botao>
      </div>
    </section>
  )
}

/** Um grupo do painel: bloco com fundo, título com ícone e os campos em grade (2 no celular, 4 no computador). */
export function GrupoFiltro({ titulo, icone, children }: { titulo: string; icone: string; children: ReactNode }) {
  const t = useT()
  return (
    <fieldset className="rounded-xl bg-[var(--fundo)] p-3">
      <legend className="sr-only">{t(titulo)}</legend>
      <p aria-hidden className="mb-2 flex items-center gap-1.5 text-sm font-bold"><span>{icone}</span>{t(titulo)}</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  )
}

/**
 * ATALHOS DE PERÍODO (fora do painel, no início da lista): "Tudo · Hoje · 7 dias · 30 dias · Este mês". As datas vêm de
 * calcularPeriodo (as mesmas do seletor de período do Painel e dos Relatórios); o de–até livre fica no painel.
 */
export function AtalhosPeriodo({ de, ate, onChange, presets = ['hoje', '7d', '30d', 'mes'] }: { de: string; ate: string; onChange(de?: string, ate?: string): void; presets?: Exclude<Preset, 'livre'>[] }) {
  const NOME: Record<string, string> = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', mes: 'Este mês', mesPassado: 'Mês passado', ano: 'Ano' }
  const opcoes = [{ id: '', nome: 'Tudo', p: undefined }, ...presets.map((id) => ({ id, nome: NOME[id], p: calcularPeriodo(id) }))]
  const atual = opcoes.find((x) => (x.p ? x.p.de === de && x.p.ate === ate : !de && !ate))?.id
  return <AtalhosChips rotulo="Período" icone="📅" valor={atual ?? '—'} opcoes={opcoes} onChange={(id) => { const x = opcoes.find((o) => o.id === id); onChange(x?.p?.de, x?.p?.ate) }} />
}

/**
 * ATALHOS (chips de um toque, fora do painel): o mesmo visual para período, situação etc. Cada tela diz o que cada
 * opção quer dizer (o atalho só mostra e devolve o id). Celular: rola de lado; computador: quebra a linha.
 */
export function AtalhosChips({ rotulo, icone, valor, opcoes, onChange }: { rotulo: string; icone?: string; valor: string; opcoes: { id: string; nome: string }[]; onChange(id: string): void }) {
  const t = useT()
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap" role="group" aria-label={t(rotulo)}>
      {icone && <span aria-hidden className="inline-flex min-h-10 shrink-0 items-center text-xs font-semibold text-[var(--suave)]">{icone}</span>}
      {opcoes.map((x) => {
        const on = x.id === valor
        return (
          <button key={x.id || 'tudo'} type="button" aria-pressed={on} onClick={() => onChange(x.id)}
            className={cx('min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold', on ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
            {t(x.nome)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * FILTRO DA LISTA — o padrão do sistema (Compras, Estoque, Triagem, Etiquetas…), sempre na mesma ordem:
 *   1. `topo` (opcional): abas/atalhos à esquerda e `acaoTopo` à direita ("⚙ Etapas e regras")
 *   2. busca + `extra` (📷) + "⚙ Filtros · N ▾" (só aparece se a tela tem `painel`)
 *   3. o painel aberto no lugar, com os grupos da tela e o rodapé "Limpar filtros · Ver N resultados"
 *   4. o resultado: "4 de 8 pedido(s)" + os filtros ligados em chips ✕ + "Limpar filtros"; `ferramentas` à direita
 * A tela só diz QUAIS filtros tem (e como filtra): o lugar, o botão e o jeito de limpar são sempre estes.
 */
export function FiltroLista({ busca, onBusca, placeholder, onKeyDown, autoFocus, topo, acaoTopo, extra, painel, ativos = [], onTirar, onLimpar, temAtivos, resultados, total, unidade, detalhe, ferramentas, aberto: abertoFora, onAberto, className }: {
  busca: string; onBusca(v: string): void; placeholder: string; onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void; autoFocus?: boolean
  topo?: ReactNode; acaoTopo?: ReactNode; extra?: ReactNode
  /** os grupos (GrupoFiltro) do painel; sem painel, sem botão "⚙ Filtros" */
  painel?: ReactNode
  /** os filtros ligados (chips ✕); a busca não entra (já está à vista) */
  ativos?: FiltroAtivo[]; onTirar?(k: string): void; onLimpar(): void
  /** algo para limpar além dos chips (ex.: a busca, a ordem): liga o "Limpar filtros" do painel */
  temAtivos?: boolean
  /** quantos ficaram, de quantos (undefined = carregando) e o nome do que é contado ("pedido(s)") */
  resultados?: number; total?: number; unidade: string; detalhe?: ReactNode
  ferramentas?: ReactNode
  /** aberto/fechado controlado por fora (quando a tela abre o painel sozinha) */
  aberto?: boolean; onAberto?(v: boolean): void
  className?: string
}) {
  const t = useT()
  const [abertoDentro, setAbertoDentro] = useState(false)
  const aberto = abertoFora ?? abertoDentro
  const abrir = (v: boolean) => (onAberto ? onAberto(v) : setAbertoDentro(v))
  const filtrando = ativos.length > 0 || !!busca.trim()
  const contagem = resultados === undefined ? t('Carregando…')
    : total !== undefined && total !== resultados ? `${t('{n} de {total}', { n: resultados, total })} ${t(unidade)}`
      : `${resultados} ${t(unidade)}`
  return (
    <div className={cx('space-y-2', className)}>
      {(topo || acaoTopo) && (
        <div className="flex flex-wrap items-center gap-2">
          {topo && <div className="min-w-0">{topo}</div>}
          {acaoTopo && <div className="ml-auto shrink-0">{acaoTopo}</div>}
        </div>
      )}
      <BarraFiltros busca={busca} onBusca={onBusca} placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus} extra={extra} ativos={ativos.length} aberto={aberto} onAlternar={painel ? () => abrir(!aberto) : undefined} />
      {painel && aberto && (
        <PainelFiltros resultados={resultados} temAtivos={temAtivos ?? ativos.length > 0} onLimpar={onLimpar} onFechar={() => abrir(false)}>{painel}</PainelFiltros>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
        <span className={cx('num text-xs', filtrando ? 'font-semibold text-[var(--marca)]' : 'text-[var(--suave)]')} aria-live="polite">{contagem}{detalhe && <span className="font-normal text-[var(--suave)]"> · {detalhe}</span>}</span>
        {ativos.length > 0 && <ChipsFiltros itens={ativos} onTirar={(k) => onTirar?.(k)} onLimpar={onLimpar} />}
        {ferramentas && <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">{ferramentas}</div>}
      </div>
    </div>
  )
}

/** Lista vazia por causa do filtro: o mesmo recado e o mesmo botão "Limpar filtros" em toda tela. */
export function VazioFiltro({ texto = 'Nada com esse filtro.', filtrando, onLimpar, children }: { texto?: string; filtrando: boolean; onLimpar(): void; children?: ReactNode }) {
  const t = useT()
  return (
    <Vazio texto={texto}>
      {(filtrando || children) && <div className="flex flex-wrap justify-center gap-2">{children}{filtrando && <Botao variante="secundario" onClick={onLimpar}>{t('Limpar filtros')}</Botao>}</div>}
    </Vazio>
  )
}

/** De–até (datas, números): dois campos lado a lado, ocupando a linha inteira no celular. */
export function CampoFaixa({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const t = useT()
  return (
    <div className="col-span-2 lg:col-span-1">
      <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t(rotulo)}</span>
      <div className="grid grid-cols-2 gap-1">{children}</div>
    </div>
  )
}
