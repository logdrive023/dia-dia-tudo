// PAGINAÇÃO (padrão do sistema para listas longas): "Exibindo 1–20 de 248 venda(s)" · ‹ Anterior · página [3] de 13 ·
// Próxima › · "20 por página". Página e tamanho ficam no ENDEREÇO (?pagina=, ?porPagina=): voltar de um detalhe cai
// na mesma página e a ordem/filtros continuam. Some sozinha quando tudo cabe numa página.
//
// Os dados continuam vindo da consulta de cada módulo (hoje tudo é local no aparelho, então paginar na tela é o certo;
// com a API, a mesma `usePaginacao` só passa `pagina/porPagina` para a consulta).

import { type ReactNode, useEffect, useRef } from 'react'
import { Botao } from './base'
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
  // poucos registros: nada a paginar (nem o "por página")
  if (total <= TAMANHOS_PAGINA[0]) return null
  return (
    <nav aria-label={t('Páginas')} className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-3 py-2 text-sm">
      <span className="num text-[var(--suave)]" aria-live="polite">{t('Exibindo {de}–{ate} de {total}', { de, ate, total })} {t(unidade)}</span>
      <span className="flex flex-wrap items-center gap-2">
        {mudarTamanho && (
          <label className="flex items-center gap-1 text-[var(--suave)]">
            <select aria-label={t('Por página')} value={porPagina} disabled={carregando} onChange={(e) => mudarTamanho(Number(e.target.value))} className="h-10 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] px-2 text-[var(--texto)]">
              {TAMANHOS_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="hidden sm:inline">{t('por página')}</span>
          </label>
        )}
        {paginas > 1 && (
          <span className="flex items-center gap-1">
            <Botao variante="secundario" className="px-3" disabled={carregando || pagina <= 1} aria-label={t('Página anterior')} onClick={() => irPara(pagina - 1)}>‹<span className="hidden sm:inline"> {t('Anterior')}</span></Botao>
            {/* ir direto para uma página: a atual em destaque, escolher outra na lista */}
            <label className="flex items-center gap-1 px-1 text-[var(--suave)]">
              <span className="sr-only">{t('Página')}</span>
              <select aria-label={t('Página')} aria-current="page" value={pagina} disabled={carregando} onChange={(e) => irPara(Number(e.target.value))} className="num h-10 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] px-2 font-semibold text-[var(--texto)]">
                {Array.from({ length: paginas }, (_, k) => <option key={k + 1} value={k + 1}>{k + 1}</option>)}
              </select>
              <span className="num">{t('de {n}', { n: paginas })}</span>
            </label>
            <Botao variante="secundario" className="px-3" disabled={carregando || pagina >= paginas} aria-label={t('Próxima página')} onClick={() => irPara(pagina + 1)}><span className="hidden sm:inline">{t('Próxima')} </span>›</Botao>
          </span>
        )}
      </span>
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
