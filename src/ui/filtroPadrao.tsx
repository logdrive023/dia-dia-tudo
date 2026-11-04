// FILTRO PADRÃO (o mesmo jeito em todas as listas): uma linha com a busca + "⚙ Filtros · N"; embaixo, os filtros
// ligados em chips com ✕ ("👤 Maria ✕") e "Limpar filtros"; o botão abre o painel no lugar, com os campos em
// GRUPOS separados (bloco com título e ícone: "🛒 De onde veio", "👤 Quem", "💇 O cabelo") e um rodapé
// "Limpar · Ver N resultados". Celular: dois campos por linha; computador: quatro. Tudo no endereço (quem usa decide).
// Variação permitida: atalhos (chips de período, abas) ficam fora do painel, mas o painel e os chips são sempre estes.

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
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
      {onAlternar && <BotaoFiltros ativos={ativos} aberto={aberto} onAlternar={onAlternar} />}
    </div>
  )
}

/** O botão "⚙ Filtros · N ▾" (o mesmo em toda tela; telas sem busca, como o Painel, usam só ele). */
export function BotaoFiltros({ ativos = 0, aberto = false, onAlternar }: { ativos?: number; aberto?: boolean; onAlternar(): void }) {
  const t = useT()
  return (
    <button type="button" aria-expanded={aberto} aria-label={t('Filtros')} onClick={onAlternar}
      className={cx('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', aberto || ativos ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)]')}>
      <span aria-hidden>⚙︎</span>
      <span className="hidden sm:inline">{t('Filtros')}</span>
      {ativos > 0 && <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--marca)] px-1 text-xs text-white">{ativos}</span>}
      <span aria-hidden className={cx('text-xs transition-transform', aberto && 'rotate-180')}>▾</span>
    </button>
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
 * ATALHOS (chips de um toque, fora do painel): o mesmo visual para período, situação etc. Cada tela diz o que cada
 * opção quer dizer (o atalho só mostra e devolve o id). Celular: rola de lado; computador: quebra a linha.
 */
export function AtalhosChips({ rotulo, icone, valor, opcoes, onChange, umaLinha }: { rotulo: string; icone?: string; valor: string; opcoes: { id: string; nome: string }[]; onChange(id: string): void; umaLinha?: boolean }) {
  const t = useT()
  return (
    <div className={cx("flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]", umaLinha ? "lg:flex-wrap" : "sm:flex-wrap")} role="group" aria-label={t(rotulo)}>
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

export interface OpcaoSituacao {
  id: string
  nome: string
  /** quantos (undefined = carregando: some) */
  n?: number
  /** cor do número quando pede atenção (ex.: "Com pendência 12" em laranja) */
  tom?: 'alerta' | 'ruim'
}

/**
 * ABAS DA SITUAÇÃO — o seletor padrão de toda lista ("Em aberto 2 · Encerradas 4 · Todas 6"): um trilho com as
 * opções lado a lado; a escolhida fica branca e com sombra, o número num selo. Celular: rola de lado, nunca quebra.
 */
export function AbasSituacao({ opcoes, valor, onChange, rotulo = 'Situação' }: { opcoes: OpcaoSituacao[]; valor: string; onChange(id: string): void; rotulo?: string }) {
  const t = useT()
  return (
    <div role="tablist" aria-label={t(rotulo)} className="flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-[var(--fundo)] p-1 ring-1 ring-[var(--borda)] [scrollbar-width:none]">
      {opcoes.map((o) => {
        const on = o.id === valor
        return (
          <button key={o.id || 'padrao'} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.id)}
            className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition', on ? 'bg-[var(--cartao)] text-[var(--texto)] shadow-[0_1px_3px_rgba(16,24,40,.12)]' : 'text-[var(--suave)] hover:text-[var(--texto)]')}>
            {t(o.nome)}{' '}
            {o.n !== undefined && (
              <span className={cx('num inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                on ? 'bg-[var(--marca)] text-white' : o.tom && o.n > 0 ? (o.tom === 'ruim' ? 'bg-[var(--ruim)]/12 text-[var(--ruim)]' : 'bg-[var(--alerta)]/15 text-[var(--alerta)]') : 'bg-[var(--borda)]/70 text-[var(--suave)]')}>
                {o.n}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * ESCOLHA NUM BOTÃO ("📅 7 dias ▾" ao lado da busca): abre a lista de opções; a escolhida fica marcada ✓ e o botão
 * mostra o nome dela. A primeira opção é o "sem filtro" (botão neutro); as outras deixam o botão ligado (cor da marca).
 */
export function BotaoEscolha({ icone, rotulo, valor, opcoes, onChange, nomeLivre }: { icone: string; rotulo: string; valor: string; opcoes: { id: string; nome: string }[]; onChange(id: string): void; nomeLivre?: string }) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  const atual = opcoes.find((o) => o.id === valor)
  const nome = atual ? t(atual.nome) : nomeLivre ?? '—'
  const ligado = valor !== (opcoes[0]?.id ?? '')
  return (
    <div ref={caixa} className="relative shrink-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={aberto} aria-label={`${t(rotulo)}: ${nome}`} onClick={() => setAberto(!aberto)}
        className={cx('inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', ligado ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)]')}>
        {/* celular: sem filtro, só o ícone (a busca precisa do espaço); escolhido, o nome aparece */}
        <span aria-hidden>{icone}</span><span className={cx('num max-w-[7rem] truncate', !ligado && 'hidden sm:inline')}>{nome}</span><span aria-hidden className={cx('text-xs transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>
      {aberto && (
        <ul role="listbox" aria-label={t(rotulo)} className="absolute right-0 z-30 mt-1 min-w-44 overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)] py-1 shadow-lg">
          {opcoes.map((o) => {
            const on = o.id === valor
            return (
              <li key={o.id || 'tudo'}>
                <button type="button" role="option" aria-selected={on} onClick={() => { onChange(o.id); setAberto(false) }}
                  className={cx('flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-[var(--marca-suave)]', on && 'font-semibold text-[var(--marca)]')}>
                  {t(o.nome)}{on && <span aria-hidden>✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * PERÍODO numa peça só (BotaoEscolha "📅 Tudo ▾"): Tudo · Hoje · 7 dias · 30 dias · Este mês. As datas vêm de
 * calcularPeriodo (as mesmas do Painel); datas livres (de–até, no painel de filtros) aparecem como "📅 02/11–04/11".
 */
export function BotaoPeriodo({ de, ate, onChange, presets = ['hoje', '7d', '30d', 'mes'] }: { de: string; ate: string; onChange(de?: string, ate?: string): void; presets?: Exclude<Preset, 'livre'>[] }) {
  const NOME: Record<string, string> = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', mes: 'Este mês', mesPassado: 'Mês passado', ano: 'Ano' }
  const opcoes = [{ id: '', nome: 'Tudo', p: undefined as ReturnType<typeof calcularPeriodo> | undefined }, ...presets.map((id) => ({ id: id as string, nome: NOME[id], p: calcularPeriodo(id) }))]
  const atual = opcoes.find((x) => (x.p ? x.p.de === de && x.p.ate === ate : !de && !ate))
  const curta = (d: string) => d.slice(5).split('-').reverse().join('/')
  return <BotaoEscolha icone="📅" rotulo="Período" valor={atual?.id ?? '__livre'} nomeLivre={`${de ? curta(de) : '…'}–${ate ? curta(ate) : '…'}`} opcoes={opcoes} onChange={(id) => { const x = opcoes.find((o) => o.id === id); onChange(x?.p?.de, x?.p?.ate) }} />
}

/**
 * FILTRO DA LISTA — o padrão do sistema (Compras, Vender, Estoque, Triagem, Etiquetas…), sempre na mesma ordem:
 *   1. `situacao` (AbasSituacao: "Em aberto 2 · Encerradas 4 · Todas 6") + `topo` livre à esquerda e `acaoTopo` à
 *      direita ("⚙ Etapas e regras")
 *   2. busca + `extra` (📷) + `periodo` ("📅 Tudo ▾") + "⚙ Filtros · N ▾" (só aparece se a tela tem `painel`)
 *   2. busca + `extra` (📷) + "⚙ Filtros · N ▾" (só aparece se a tela tem `painel`)
 *   3. o painel aberto no lugar, com os grupos da tela e o rodapé "Limpar filtros · Ver N resultados"
 *   4. o resultado: "4 de 8 pedido(s)" + os filtros ligados em chips ✕ + "Limpar filtros"; `ferramentas` à direita
 * A tela só diz QUAIS filtros tem (e como filtra): o lugar, o botão e o jeito de limpar são sempre estes.
 */
export function FiltroLista({ busca, onBusca, placeholder, onKeyDown, autoFocus, situacao, periodo, topo, acaoTopo, extra, painel, ativos = [], onTirar, onLimpar, temAtivos, resultados, total, unidade, detalhe, ferramentas, aberto: abertoFora, onAberto, className }: {
  busca: string; onBusca(v: string): void; placeholder: string; onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void; autoFocus?: boolean
  /** as abas da situação (o seletor padrão) */
  situacao?: { opcoes: OpcaoSituacao[]; valor: string; onChange(id: string): void }
  /** o período ("📅 Tudo ▾"), ao lado da busca */
  periodo?: { de: string; ate: string; onChange(de?: string, ate?: string): void; presets?: Exclude<Preset, 'livre'>[] }
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
      {(situacao || topo || acaoTopo) && (
        <div className="flex flex-wrap items-center gap-2">
          {situacao && <div className="min-w-0 max-w-full"><AbasSituacao {...situacao} /></div>}
          {topo && <div className="min-w-0">{topo}</div>}
          {acaoTopo && <div className="ml-auto shrink-0">{acaoTopo}</div>}
        </div>
      )}
      <BarraFiltros busca={busca} onBusca={onBusca} placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus} extra={<>{extra}{periodo && <BotaoPeriodo {...periodo} />}</>} ativos={ativos.length} aberto={aberto} onAlternar={painel ? () => abrir(!aberto) : undefined} />
      {painel && aberto && (
        <PainelFiltros resultados={resultados} temAtivos={temAtivos ?? ativos.length > 0} onLimpar={onLimpar} onFechar={() => abrir(false)}>{painel}</PainelFiltros>
      )}
      {/* O RESULTADO só aparece quando há busca ou filtro (sem filtro ele só repetiria o número do cartão/aba): em destaque,
          "🔎 4 de 20 pacote(s)" + o valor do que ficou, e os filtros ligados em chips ✕ ao lado */}
      {(filtrando || ferramentas) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          {filtrando && (
            <span aria-live="polite" className="num inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--texto)] px-3 text-sm font-semibold text-[var(--cartao)]">
              <span aria-hidden>🔎</span>{contagem}{detalhe && <span className="font-normal opacity-75"> · {detalhe}</span>}
            </span>
          )}
          {ativos.length > 0 && <ChipsFiltros itens={ativos} onTirar={(k) => onTirar?.(k)} onLimpar={onLimpar} />}
          {ferramentas && <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">{ferramentas}</div>}
        </div>
      )}
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
