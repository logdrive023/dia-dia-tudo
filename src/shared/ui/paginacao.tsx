// PAGINAÇÃO (padrão do sistema para listas longas): "Exibindo 1–20 de 248 venda(s)" · ‹ Anterior · página [3] de 13 ·
// Próxima › · "20 por página". Página e tamanho ficam no ENDEREÇO (?pagina=, ?porPagina=): voltar de um detalhe cai
// na mesma página e a ordem/filtros continuam. Aparece SEMPRE que a lista tem algo (com 1 página, as setas ficam apagadas).
//
// Os dados continuam vindo da consulta de cada módulo (hoje tudo é local no aparelho, então paginar na tela é o certo;
// com a API, a mesma `usePaginacao` só passa `pagina/porPagina` para a consulta).

import { type ReactNode, useEffect, useRef } from 'react'
import { useFiltrosTela } from './contexto'
import { useT } from './i18n'

export const TAMANHOS_PAGINA = [10, 20, 50, 100]

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
export function usePaginacao<T>(itens: T[], { padrao = 20, reiniciar = '' }: { padrao?: number; reiniciar?: string } = {}) {
  const { p, setP } = useFiltrosTela()
  const porPagina = TAMANHOS_PAGINA.includes(Number(p('porPagina'))) ? Number(p('porPagina')) : padrao
  const pag = paginar(itens, Number(p('pagina')) || 1, porPagina)
  const antes = useRef(reiniciar)
  useEffect(() => {
    if (antes.current !== reiniciar) {
      antes.current = reiniciar
      if (p('pagina')) setP('pagina', '')
    }
  }, [reiniciar]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ...pag,
    irPara: (n: number) => setP('pagina', n > 1 ? String(Math.min(n, pag.paginas)) : ''),
    mudarTamanho: (n: number) => setP('porPagina', n === padrao ? '' : String(n)),
  }
}

export function Paginacao({ pagina, paginas, de, ate, total, porPagina, irPara, mudarTamanho, unidade, carregando }: { pagina: number; paginas: number; de: number; ate: number; total: number; porPagina: number; irPara(n: number): void; mudarTamanho?(n: number): void; unidade: string; carregando?: boolean }) {
  const t = useT()
  // SEMPRE aparece em toda listagem (mesmo com 1 registro: o lugar da paginação não muda); só some com a lista vazia
  if (total <= 0) return null
  const seta = 'flex h-10 w-10 items-center justify-center text-lg font-bold text-[var(--marca)] transition hover:bg-[var(--marca-suave)] disabled:cursor-not-allowed disabled:text-[var(--borda)] disabled:hover:bg-transparent'
  return (
    // UMA LINHA em qualquer largura: à esquerda o intervalo e o tamanho da página; à direita o seletor ‹ [3 de 13] ›
    // (um bloco só, com borda). Em tela muito estreita os dois lados só trocam de linha, sem quebrar por dentro.
    <nav aria-label={t('Páginas')} className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-3 py-2 text-sm shadow-sm">
      <span className="num flex min-w-0 items-center gap-2 text-[var(--suave)]">
        <span aria-live="polite" className="whitespace-nowrap"><b className="font-semibold text-[var(--texto)]">{de}–{ate}</b> {t('de {n}', { n: total })} <span className="hidden sm:inline">{t(unidade)}</span></span>
        {mudarTamanho && (
          <label className="flex items-center gap-1 whitespace-nowrap">
            <span aria-hidden>·</span>
            <select aria-label={t('Por página')} value={porPagina} disabled={carregando} onChange={(e) => mudarTamanho(Number(e.target.value))} className="h-9 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] px-1.5 text-[var(--texto)]">
              {TAMANHOS_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="hidden sm:inline">{t('por página')}</span>
          </label>
        )}
      </span>
      {(
        <span className="ml-auto inline-flex items-center overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--fundo)]">
          <button type="button" className={seta} disabled={carregando || pagina <= 1} aria-label={t('Página anterior')} onClick={() => irPara(pagina - 1)}>‹</button>
          {/* ir direto para uma página: a atual em destaque, escolher outra na lista */}
          <label className="num flex h-10 items-center gap-1 border-x border-[var(--borda)] px-2 text-[var(--suave)]">
            <select aria-label={t('Página')} aria-current="page" value={pagina} disabled={carregando} onChange={(e) => irPara(Number(e.target.value))} className="h-8 cursor-pointer rounded-md bg-transparent px-1 font-bold text-[var(--texto)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--marca)]">
              {Array.from({ length: paginas }, (_, k) => <option key={k + 1} value={k + 1}>{k + 1}</option>)}
            </select>
            <span className="whitespace-nowrap">{t('de {n}', { n: paginas })}</span>
          </label>
          <button type="button" className={seta} disabled={carregando || pagina >= paginas} aria-label={t('Próxima página')} onClick={() => irPara(pagina + 1)}>›</button>
        </span>
      )}
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
      {children(pag.itens, Math.max(0, pag.de - 1))}
      <Paginacao {...pag} unidade={unidade} />
    </>
  )
}
