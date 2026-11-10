// PAGINAÇÃO (padrão do sistema para TODA lista de registros): "1–25 de 248 venda(s)" · ‹ página [3] de 10 › ·
// "25 por página" (10 · 25 · 50 · 100). Página e tamanho ficam no ENDEREÇO (?pagina=, ?porPagina=): voltar de um detalhe cai
// na mesma página e a ordem/filtros continuam. Aparece SEMPRE que a lista tem algo (com 1 página, as setas ficam apagadas).
//
// Os dados continuam vindo da consulta de cada módulo (hoje tudo é local no aparelho, então paginar na tela é o certo;
// com a API, a mesma `usePaginacao` só passa `pagina/porPagina` para a consulta).
//
// TROCAR DE PÁGINA: a tela sobe suave até o começo da lista e, no lugar dela, aparece "Carregando os dados…" por um
// instante (AreaPaginada). Sem isso, quem está embaixo da lista toca e não vê nada mudar perto do dedo.
//
// NO COMPUTADOR A PAGINAÇÃO FICA SEMPRE NO PÉ DA TELA (identidade visual: a lista começa sempre no mesmo lugar e a
// paginação está sempre embaixo). Lista curta: ela desce até o fim da tela; lista comprida: fica logo depois da
// lista, como sempre. No celular ela segue a lista (a tela já é estreita e a barra de baixo é do menu).

import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { cx } from './base'
import { useFiltrosTela } from './contexto'
import { useT } from './i18n'

/** os tamanhos de página do sistema inteiro (o seletor "N por página"); o padrão é 25 */
export const TAMANHOS_PAGINA = [10, 25, 50, 100]

/** a partir de que largura a paginação desce até o pé da tela (o computador; o tablet em pé e o celular não) */
const PE_DA_TELA = '(min-width: 1024px)'

/**
 * Quanto a paginação precisa descer para a página terminar exatamente no pé da tela (0 = a página já passa da tela).
 * Conta com o espaço que ela mesma já está ocupando (ponto fixo: medir de novo dá o mesmo número, sem pular).
 */
function useNoPeDaTela() {
  const ref = useRef<HTMLElement>(null)
  const [extra, setExtra] = useState(0)
  const atual = useRef(0)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia || typeof ResizeObserver === 'undefined') return
    const midia = window.matchMedia(PE_DA_TELA)
    let quadro = 0
    const medir = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        // só a ÚLTIMA paginação da página desce (duas descendo juntas ficariam brigando pelo mesmo espaço)
        const todas = document.querySelectorAll('nav[data-paginacao]')
        const ultima = todas[todas.length - 1] === ref.current
        // (medido do alto da PÁGINA, não da parte à vista: rolar não muda a conta)
        // o fim do CONTEÚDO da tela (o bloco da página dentro do <main>, mais o espaço de baixo do <main>) — não a altura
        // do documento, que o layout já estica até a tela
        const nav = ref.current
        const main = nav?.closest('main')
        let bloco: HTMLElement | null | undefined = nav
        while (bloco && bloco.parentElement && bloco.parentElement !== main) bloco = bloco.parentElement
        const fim = bloco && main ? bloco.getBoundingClientRect().bottom + window.scrollY + parseFloat(getComputedStyle(main).paddingBottom || '0') : Infinity
        const sobra = midia.matches && ultima ? window.innerHeight - fim : -Infinity
        const novo = Math.max(0, Math.round(atual.current + sobra))
        if (Math.abs(novo - atual.current) > 1) { atual.current = novo; setExtra(novo) }
      })
    }
    const obs = new ResizeObserver(medir)
    obs.observe(document.body)
    window.addEventListener('resize', medir)
    midia.addEventListener?.('change', medir)
    medir()
    return () => { cancelAnimationFrame(quadro); obs.disconnect(); window.removeEventListener('resize', medir); midia.removeEventListener?.('change', medir) }
  }, [])
  return { ref, extra }
}

/** tempo do aviso: o bastante para ver que trocou, sem atrapalhar quem está passando páginas */
const PAUSA_TROCA_MS = 450

/** sobe até o começo da lista, a não ser que ele já esteja à vista no alto da tela */
function subirAte(el: HTMLElement | null) {
  if (!el?.scrollIntoView) return
  const topo = el.getBoundingClientRect().top
  if (topo >= 0 && topo < window.innerHeight / 3) return
  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  el.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' })
}

/** O pedaço da lista que vai na tela (página começa em 1; página fora do fim cai na última: nunca fica numa vazia). */
export function paginar<T>(itens: T[], pagina: number, porPagina: number) {
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina))
  const atual = Math.min(Math.max(1, pagina || 1), paginas)
  return { pagina: atual, paginas, porPagina, total: itens.length, itens: itens.slice((atual - 1) * porPagina, atual * porPagina), de: itens.length ? (atual - 1) * porPagina + 1 : 0, ate: Math.min(atual * porPagina, itens.length) }
}

/**
 * Pagina uma lista JÁ filtrada e ordenada pelo módulo. `reiniciar`: o que, quando muda, volta para a página 1 (a busca
 * e os filtros, ex.: JSON dos filtros) — na primeira vez não mexe (quem volta de um detalhe fica na página).
 */
export function usePaginacao<T>(itens: T[], { padrao = 25, reiniciar = '' }: { padrao?: number; reiniciar?: string } = {}) {
  const { p, setP } = useFiltrosTela()
  const porPagina = TAMANHOS_PAGINA.includes(Number(p('porPagina'))) ? Number(p('porPagina')) : padrao
  const pag = paginar(itens, Number(p('pagina')) || 1, porPagina)
  const antes = useRef(reiniciar)
  const ancora = useRef<HTMLDivElement>(null)
  // a altura que a lista tinha: guardada durante a troca para a página não encolher e pular enquanto a tela sobe
  const [altura, setAltura] = useState<number>()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const mostrarTroca = () => {
    setAltura(ancora.current?.offsetHeight ?? 0)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAltura(undefined), PAUSA_TROCA_MS)
    subirAte(ancora.current)
  }
  useEffect(() => {
    if (antes.current !== reiniciar) {
      antes.current = reiniciar
      if (p('pagina')) setP('pagina', '')
    }
  }, [reiniciar]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ...pag,
    ancora,
    altura,
    carregando: altura !== undefined,
    irPara: (n: number) => { mostrarTroca(); setP('pagina', n > 1 ? String(Math.min(n, pag.paginas)) : '') },
    mudarTamanho: (n: number) => { mostrarTroca(); setP('porPagina', n === padrao ? '' : String(n)) },
  }
}

/** o que aparece no lugar da lista enquanto troca de página */
function CarregandoPagina() {
  const t = useT()
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
      <p className="mb-4 flex items-center gap-3 text-sm font-semibold">
        <span aria-hidden className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--marca-suave)] border-t-[var(--marca)] motion-reduce:animate-none" />
        {t('Carregando os dados…')}
      </p>
      <div aria-hidden className="space-y-4">
        {['70%', '55%', '65%', '50%'].map((largura) => (
          <div key={largura} className="flex items-center gap-3">
            <span className="esqueleto h-10 w-10 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="esqueleto block h-3 rounded" style={{ width: largura }} />
              <span className="esqueleto block h-3 w-1/3 rounded" />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Em volta da lista paginada: é até aqui que a tela sobe e é aqui que o "carregando" aparece ao trocar de página */
export function AreaPaginada({ pag, children }: { pag: { ancora: RefObject<HTMLDivElement>; altura?: number; carregando: boolean }; children: ReactNode }) {
  return <div ref={pag.ancora} className="scroll-mt-4" style={pag.carregando ? { minHeight: pag.altura } : undefined}>{pag.carregando ? <CarregandoPagina /> : children}</div>
}

/** no celular só a seta (alvo de 44 px); do sm para cima a seta vem com o nome */
function Seta({ direcao, forte, nome, ...p }: { direcao: 'anterior' | 'proxima'; forte?: boolean; nome: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const seta = <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={direcao === 'anterior' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
  return (
    <button type="button" {...p} className={cx('flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-1 rounded-xl text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--suave)] disabled:opacity-50 disabled:ring-1 disabled:ring-[var(--borda)] disabled:active:scale-100 sm:px-3', forte ? 'bg-[var(--marca)] text-white hover:brightness-110' : 'bg-[var(--marca-suave)] text-[var(--marca)] hover:brightness-95')}>
      {direcao === 'anterior' && seta}
      <span className="hidden sm:inline">{nome}</span>
      {direcao === 'proxima' && seta}
    </button>
  )
}

export function Paginacao({ pagina, paginas, de, ate, total, porPagina, irPara, mudarTamanho, unidade, carregando }: { pagina: number; paginas: number; de: number; ate: number; total: number; porPagina: number; irPara(n: number): void; mudarTamanho?(n: number): void; unidade: string; carregando?: boolean }) {
  const t = useT()
  const pe = useNoPeDaTela()
  // SEMPRE aparece em toda listagem (mesmo com 1 registro: o lugar da paginação não muda); só some com a lista vazia
  if (total <= 0) return null
  return (
    // CELULAR: em cima ‹ Página [3] de 13 › com alvos grandes, a barrinha de onde está e, embaixo, o intervalo e o tamanho.
    // COMPUTADOR: o intervalo à esquerda, ‹ Anterior · Página [3] de 13 · Próxima › à direita e a barrinha embaixo.
    <nav ref={pe.ref} data-paginacao aria-label={t('Páginas')} style={pe.extra ? { marginTop: `calc(0.75rem + ${pe.extra}px)` } : undefined} className="mt-3 flex flex-col gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-x-4 sm:px-4">
      <div className="flex items-center justify-between gap-2 sm:order-2 sm:justify-end sm:gap-3">
        <Seta direcao="anterior" nome={t('Anterior')} disabled={carregando || pagina <= 1} aria-label={t('Página anterior')} onClick={() => irPara(pagina - 1)} />
        {/* ir direto para uma página: a atual em destaque, escolher outra na lista */}
        <label className="num flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-[var(--suave)]">
          <span>{t('Página')}</span>
          <span className="relative inline-flex items-center">
            <select aria-label={t('Página')} aria-current="page" value={pagina} disabled={carregando} onChange={(e) => irPara(Number(e.target.value))} className="h-11 cursor-pointer appearance-none rounded-xl bg-[var(--fundo)] pl-3 pr-7 text-base font-bold text-[var(--texto)] outline-none ring-1 ring-[var(--borda)] focus-visible:ring-2 focus-visible:ring-[var(--marca)]">
              {Array.from({ length: paginas }, (_, k) => <option key={k + 1} value={k + 1}>{k + 1}</option>)}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-2.5 text-xs text-[var(--suave)]">▾</span>
          </span>
          <span className="whitespace-nowrap">{t('de {n}', { n: paginas })}</span>
        </label>
        <Seta direcao="proxima" nome={t('Próxima')} forte disabled={carregando || pagina >= paginas} aria-label={t('Próxima página')} onClick={() => irPara(pagina + 1)} />
      </div>
      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-[var(--fundo)] sm:order-3 sm:col-span-2">
        <div className="h-full rounded-full bg-[var(--marca)] transition-[width] duration-300" style={{ width: `${(pagina / paginas) * 100}%` }} />
      </div>
      <div className="num flex items-center justify-between gap-3 text-sm text-[var(--suave)] sm:order-1 sm:justify-start">
        <span aria-live="polite" className="whitespace-nowrap"><b className="font-semibold text-[var(--texto)]">{de}–{ate}</b> {t('de {n}', { n: total })} <span className="hidden sm:inline">{t(unidade)}</span></span>
        {mudarTamanho && (
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <select aria-label={t('Por página')} value={porPagina} disabled={carregando} onChange={(e) => mudarTamanho(Number(e.target.value))} className="h-10 toque:h-11 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] px-1.5 text-[var(--texto)]">
              {TAMANHOS_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{t('por página')}</span>
          </label>
        )}
      </div>
    </nav>
  )
}

/**
 * LISTA PAGINADA para listas de cartões próprias (fila da Triagem, Etiquetas): pagina `itens` e chama `children` com a
 * página atual e o índice do primeiro item dela (para seleções por intervalo); a Paginacao padrão vem embaixo.
 * Serve quando a tela já passou dos seus "return" antecipados e não pode chamar o hook ali.
 */
export function Paginada<T>({ itens, padrao, reiniciar, unidade, children }: { itens: T[]; padrao?: number; reiniciar?: string; unidade: string; children(pagina: T[], inicio: number): ReactNode }) {
  const pag = usePaginacao(itens, { padrao, reiniciar })
  return (
    <>
      <AreaPaginada pag={pag}>{children(pag.itens, Math.max(0, pag.de - 1))}</AreaPaginada>
      <Paginacao {...pag} unidade={unidade} />
    </>
  )
}
