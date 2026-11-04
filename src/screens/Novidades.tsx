// NOVIDADES (#/novidades): o changelog para quem usa — o que mudou, em que área e onde ver. Mais novo em cima;
// filtro por área (chips) e busca, no padrão das outras listas. Tocar num item com tela abre a tela.

import { useState } from 'react'
import { BarraFiltros } from '../ui/filtroPadrao'
import { NOVIDADES, type ItemNovidade } from '../app/novidades'
import { Titulo, cx, dataBR } from '../ui/base'
import { useApp } from '../ui/contexto'
import { useT } from '../ui/i18n'

const ICONE_AREA: Record<ItemNovidade['area'], string> = { Triagem: '✂️', Etiquetas: '🏷', Estoque: '📦', Comprar: '🛒', Venda: '💰', 'Livro do cabelo': '📒', Equipe: '👥', Sistema: '⚙️' }

export function Novidades() {
  const t = useT()
  const { ir } = useApp()
  const [area, setArea] = useState<'' | ItemNovidade['area']>('')
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const areas = [...new Set(NOVIDADES.flatMap((n) => n.itens.map((i) => i.area)))]
  const passa = (i: ItemNovidade) => (!area || i.area === area) && (!termo || `${i.area} ${t(i.texto)}`.toLowerCase().includes(termo))
  const chip = (id: '' | ItemNovidade['area'], nome: string, n: number) => (
    <button key={id || 'todas'} type="button" aria-pressed={area === id} onClick={() => setArea(id)} className={cx('inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold', area === id ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
      {id && <span aria-hidden>{ICONE_AREA[id]}</span>}{t(nome)} <span className="num text-xs opacity-70">{n}</span>
    </button>
  )
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Titulo subtitulo={t('O que mudou no sistema, em palavras simples. Toque num item para ver onde mudou.')}>{t('Novidades')}</Titulo>
      <div className="space-y-2">
        <BarraFiltros busca={busca} onBusca={setBusca} placeholder="Buscar mudança" />
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {chip('', 'Todas', NOVIDADES.reduce((s, n) => s + n.itens.length, 0))}
          {areas.map((a) => chip(a, a, NOVIDADES.reduce((s, n) => s + n.itens.filter((i) => i.area === a).length, 0)))}
        </div>
      </div>
      {NOVIDADES.map((n) => {
        const itens = n.itens.filter(passa)
        if (!itens.length) return null
        return (
          <section key={n.data + n.titulo} aria-label={n.titulo} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
            <header className="border-b border-[var(--borda)] bg-[var(--fundo)] px-4 py-3">
              <span className="num text-xs font-semibold text-[var(--suave)]">{dataBR(n.data)}</span>
              <h2 className="font-bold">{t(n.titulo)}</h2>
            </header>
            <ul className="divide-y divide-[var(--borda)]">
              {itens.map((i, k) => (
                <li key={k}>
                  <button type="button" disabled={!i.tela} onClick={() => i.tela && ir(i.tela, i.params ?? {})} className={cx('flex w-full items-start gap-3 px-4 py-3 text-left text-sm', i.tela && 'hover:bg-[var(--fundo)]')}>
                    <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)]">{ICONE_AREA[i.area]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t(i.area)}</span>
                      <span className="block">{t(i.texto)}</span>
                    </span>
                    {i.tela && <span aria-hidden className="mt-2 text-[var(--marca)]">›</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {!NOVIDADES.some((n) => n.itens.some(passa)) && <p className="rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>}
    </div>
  )
}
