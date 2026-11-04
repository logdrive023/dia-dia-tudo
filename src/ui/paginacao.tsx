// PAGINAÇÃO (padrão do sistema para listas longas): "1–25 de 80" + ‹ Anterior · Próxima ›. A página fica no endereço
// (quem usa guarda em ?pagina=), então voltar de um detalhe cai na mesma página. Some sozinha quando tudo cabe numa.

import { Botao } from './base'
import { useT } from './i18n'

/** O pedaço da lista que vai na tela (página começa em 1; página fora do fim cai na última). */
export function paginar<T>(itens: T[], pagina: number, porPagina: number) {
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina))
  const atual = Math.min(Math.max(1, pagina || 1), paginas)
  return { pagina: atual, paginas, itens: itens.slice((atual - 1) * porPagina, atual * porPagina), de: itens.length ? (atual - 1) * porPagina + 1 : 0, ate: Math.min(atual * porPagina, itens.length) }
}

export function Paginacao({ pagina, paginas, de, ate, total, onPagina, unidade }: { pagina: number; paginas: number; de: number; ate: number; total: number; onPagina(p: number): void; unidade: string }) {
  const t = useT()
  if (paginas <= 1) return null
  return (
    <nav aria-label={t('Páginas')} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="num text-[var(--suave)]">{t('{de}–{ate} de {total}', { de, ate, total })} {t(unidade)}</span>
      <span className="flex items-center gap-1">
        <Botao variante="secundario" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>‹ {t('Anterior')}</Botao>
        <span className="num px-2 text-[var(--suave)]" aria-current="page">{pagina} / {paginas}</span>
        <Botao variante="secundario" disabled={pagina >= paginas} onClick={() => onPagina(pagina + 1)}>{t('Próxima')} ›</Botao>
      </span>
    </nav>
  )
}
