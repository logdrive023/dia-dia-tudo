// FILTRO PADRÃO (o mesmo jeito em todas as listas): uma linha com a busca + "⚙ Filtros · N"; embaixo, os filtros
// ligados em chips com ✕ ("👤 Maria ✕") e "Limpar filtros"; o botão abre o painel no lugar, com os campos em
// GRUPOS separados (bloco com título e ícone: "🛒 De onde veio", "👤 Quem", "💇 O cabelo") e um rodapé
// "Limpar · Ver N resultados". Celular: dois campos por linha; computador: quatro. Tudo no endereço (quem usa decide).
// Variação permitida: atalhos (chips de período, abas) ficam fora do painel, mas o painel e os chips são sempre estes.

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Botao, Entrada, Vazio, cx } from './base'
import { dataCurta } from '../../core/domain/datas'
import { type Preset, calcularPeriodo } from './filtros'
import { useT } from './i18n'
import { useApp } from './contexto'

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

/**
 * VER COMO: "☰ Lista · ▦ Cartões" (o mesmo seletor em toda tela que tem as duas vistas: Preços, Viagens…). No celular
 * só os ícones (a busca não fica espremida); do tablet (640 px) para cima, o nome também. A tela guarda a escolha (useLembrado).
 */
export type Vista = 'lista' | 'cartoes'
export function EscolhaVista({ vista, onChange }: { vista: Vista; onChange(v: Vista): void }) {
  const t = useT()
  return (
    <div role="radiogroup" aria-label={t('Ver como')} className="inline-flex shrink-0 rounded-xl bg-[var(--marca-suave)] p-1">
      {([['lista', '☰', 'Lista'], ['cartoes', '▦', 'Cartões']] as const).map(([id, ic, nome]) => (
        <button key={id} type="button" role="radio" aria-checked={vista === id} aria-label={t(nome)} onClick={() => onChange(id)} title={t(nome)}
          className={cx('inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-semibold', vista === id ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
          <span aria-hidden>{ic}</span><span className="hidden sm:inline">{t(nome)}</span>
        </button>
      ))}
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
/** o que baixar em planilha (o botão fica dentro da ⚙, no rodapé do painel) */
export interface Exportar { onExportar(): void; quantos: number; unidade: string }

export function PainelFiltros({ children, resultados, onFechar, onLimpar, temAtivos, exportar }: { children?: ReactNode; resultados?: number; onFechar(): void; onLimpar(): void; temAtivos: boolean; exportar?: Exportar }) {
  const t = useT()
  return (
    <section aria-label={t('Filtros')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      {children && <div className="space-y-2 p-2 sm:p-3">{children}</div>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--borda)] bg-[var(--fundo)] px-3 py-2">
        {exportar && <span className="mr-auto"><BotaoExportar {...exportar} /></span>}
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
      {/* items-end: um rótulo que quebra em 2 linhas não desalinha a caixa do vizinho */}
      <div className="grid grid-cols-2 items-end gap-2 lg:grid-cols-4">{children}</div>
    </fieldset>
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
export function BotaoEscolha({ icone, rotulo, valor, opcoes, onChange, nomeLivre, rodape, ligadoSempre }: { icone: string; rotulo: string; valor: string
  /** `icone` e `sub` (uma linha de detalhe, ex.: o endereço da unidade) são opcionais */
  opcoes: { id: string; nome: string; icone?: string; sub?: string }[]; onChange(id: string): void; nomeLivre?: string
  /** algo embaixo das opções, dentro da lista (recebe o fechar) */
  rodape?(fechar: () => void): ReactNode
  /** o nome aparece sempre (não só quando muda do primeiro) */
  ligadoSempre?: boolean }) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  // abre para o lado que tem espaço (botão à esquerda da tela → a lista vai para a direita)
  const [lado, setLado] = useState<'esq' | 'dir'>('dir')
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
  const mostrarNome = ligado || !!ligadoSempre
  return (
    <div ref={caixa} className="relative shrink-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={aberto} aria-label={`${t(rotulo)}: ${nome}`} onClick={() => { const x = caixa.current?.getBoundingClientRect(); setLado(x && x.left + x.width / 2 < window.innerWidth / 2 ? 'esq' : 'dir'); setAberto(!aberto) }}
        className={cx('inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition', ligado ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)]')}>
        {/* celular: sem filtro, só o ícone (a busca precisa do espaço); escolhido, o nome aparece */}
        <span aria-hidden>{icone}</span><span className={cx('num max-w-[7rem] truncate', !mostrarNome && 'hidden sm:inline')}>{nome}</span><span aria-hidden className={cx('text-xs transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>
      {aberto && (
        <div className={cx('absolute z-30 mt-1 w-max min-w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)] shadow-lg', lado === 'esq' ? 'left-0' : 'right-0')}>
        <ul role="listbox" aria-label={t(rotulo)} className="py-1">
          {opcoes.map((o) => {
            const on = o.id === valor
            return (
              <li key={o.id || 'tudo'}>
                <button type="button" role="option" aria-selected={on} onClick={() => { onChange(o.id); setAberto(false) }}
                  className={cx('flex min-h-11 w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-[var(--marca-suave)]', on && 'font-semibold text-[var(--marca)]')}>
                  <span className="flex min-w-0 items-center gap-2">
                    {o.icone && <span aria-hidden className="shrink-0">{o.icone}</span>}
                    <span className="min-w-0">
                      <span className="block">{t(o.nome)}</span>
                      {o.sub && <span className="block max-w-[16rem] truncate text-xs font-normal text-[var(--suave)]">{o.sub}</span>}
                    </span>
                  </span>
                  {on && <span aria-hidden>✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {rodape && <div className="border-t border-[var(--borda)] p-2">{rodape(() => setAberto(false))}</div>}
        </div>
      )}
    </div>
  )
}

/**
 * PERÍODO numa peça só (BotaoEscolha "📅 Tudo ▾"): Tudo · Hoje · 7 dias · 30 dias · Este mês. As datas vêm de
 * calcularPeriodo (as mesmas do Painel); datas livres (de–até, no painel de filtros) aparecem como "📅 02/11–04/11".
 */
export function BotaoPeriodo({ de, ate, onChange, presets = ['hoje', '7d', '30d', 'mes'], obrigatorio }: { de: string; ate: string; onChange(de?: string, ate?: string): void; presets?: Exclude<Preset, 'livre'>[]
  /** o período é obrigatório (sem "Tudo") */
  obrigatorio?: boolean }) {
  const NOME: Record<string, string> = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', mes: 'Este mês', mesPassado: 'Mês passado', ano: 'Este ano' }
  const opcoes = [...(obrigatorio ? [] : [{ id: '', nome: 'Tudo', p: undefined as ReturnType<typeof calcularPeriodo> | undefined }]), ...presets.map((id) => ({ id: id as string, nome: NOME[id], p: calcularPeriodo(id) as ReturnType<typeof calcularPeriodo> | undefined }))]
  const atual = opcoes.find((x) => (x.p ? x.p.de === de && x.p.ate === ate : !de && !ate))
  return <BotaoEscolha icone="📅" rotulo="Período" valor={atual?.id ?? '__livre'} ligadoSempre={obrigatorio} nomeLivre={`${de ? dataCurta(de) : '…'}–${ate ? dataCurta(ate) : '…'}`} opcoes={opcoes} onChange={(id) => { const x = opcoes.find((o) => o.id === id); onChange(x?.p?.de, x?.p?.ate) }}
    rodape={(fechar) => <DatasLivres de={de} ate={ate} onAplicar={(d, a) => (onChange(d, a), fechar())} />} />
}

/** "📆 Escolher datas": de–até dentro da lista do período (até nunca antes de de) */
function DatasLivres({ de, ate, onAplicar }: { de: string; ate: string; onAplicar(de: string, ate: string): void }) {
  const t = useT()
  const [d, setD] = useState(de)
  const [a, setA] = useState(ate)
  const ok = !!d && !!a && d <= a
  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-[var(--suave)]">📆 {t('Escolher datas')}</span>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-xs text-[var(--suave)]">{t('De')}<input type="date" value={d} max={a || undefined} onChange={(e) => setD(e.target.value)} className="num mt-0.5 block min-h-10 w-full rounded-lg border border-[var(--borda)] bg-[var(--fundo)] px-2 text-sm text-[var(--texto)]" /></label>
        <label className="text-xs text-[var(--suave)]">{t('Até')}<input type="date" value={a} min={d || undefined} onChange={(e) => setA(e.target.value)} className="num mt-0.5 block min-h-10 w-full rounded-lg border border-[var(--borda)] bg-[var(--fundo)] px-2 text-sm text-[var(--texto)]" /></label>
      </div>
      <Botao className="w-full" disabled={!ok} onClick={() => onAplicar(d, a)}>{t('Ver este período')}</Botao>
    </div>
  )
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
export function FiltroLista({ busca, onBusca, placeholder, onKeyDown, autoFocus, situacao, periodo, topo, acaoTopo, extra, painel, ativos = [], onTirar, onLimpar, temAtivos, resultados, total, unidade, detalhe, ferramentas, exportar, aberto: abertoFora, onAberto, className }: {
  busca: string; onBusca(v: string): void; placeholder: string; onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void; autoFocus?: boolean
  /** as abas da situação (o seletor padrão) */
  situacao?: { opcoes: OpcaoSituacao[]; valor: string; onChange(id: string): void }
  /** o período ("📅 Tudo ▾"), ao lado da busca */
  periodo?: { de: string; ate: string; onChange(de?: string, ate?: string): void; presets?: Exclude<Preset, 'livre'>[]; obrigatorio?: boolean }
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
  /** "📥 Baixar planilha" — fica DENTRO da ⚙ (o padrão de toda lista) */
  exportar?: Exportar
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
      <BarraFiltros busca={busca} onBusca={onBusca} placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus} extra={<>{extra}{periodo && <BotaoPeriodo {...periodo} />}</>} ativos={ativos.length} aberto={aberto} onAlternar={painel || exportar ? () => abrir(!aberto) : undefined} />
      {(painel || exportar) && aberto && (
        <PainelFiltros resultados={resultados} temAtivos={temAtivos ?? ativos.length > 0} onLimpar={onLimpar} onFechar={() => abrir(false)} exportar={exportar}>{painel}</PainelFiltros>
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

/**
 * BAIXAR PLANILHA — o botão único de exportar uma lista (Vendas, Estoque…): sempre com o NOME à vista, também no
 * celular ("📥 Baixar planilha"; só um ⬇ ninguém entende), e depois de baixar diz o que veio e como abrir.
 * `quantos` + `unidade`: "22 venda(s)" no aviso e no title. O arquivo é CSV (abre no Excel e no Google Planilhas).
 */
export function BotaoExportar({ onExportar, quantos, unidade, rotulo = 'Baixar planilha' }: { onExportar(): void; quantos: number; unidade: string; rotulo?: string }) {
  const t = useT()
  const { avisar } = useApp()
  const baixar = () => {
    onExportar()
    avisar(t('Planilha baixada: {n} {u}. Abra no Excel ou no Google Planilhas.', { n: quantos, u: t(unidade) }), 'ok')
  }
  return (
    <button type="button" disabled={!quantos} onClick={baixar} title={t('Baixar uma planilha com as {n} {u} desta lista (como está filtrada)', { n: quantos, u: t(unidade) })}
      className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-sm font-semibold text-[var(--marca)] shadow-sm hover:border-[var(--marca)] hover:bg-[var(--marca-suave)] disabled:opacity-40">
      <span aria-hidden>📥</span>{t(rotulo)}
    </button>
  )
}
