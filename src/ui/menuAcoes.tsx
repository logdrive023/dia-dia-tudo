// MENU "⋯" (mais ações): o mesmo em toda tela. Abre por toque/clique/teclado, fecha no Esc, ao tocar fora ou ao escolher.
// Fica por cima de tudo (posição fixa): não é cortado por cartões com overflow nem por listas com rolagem.

import { useEffect, useId, useRef, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { Params } from './contexto'
import { cx } from './base'
import { useT } from './i18n'

export interface Acao {
  rotulo: string
  icone?: string
  onClick(): void
  perigo?: boolean
  /** linha separadora antes deste item */
  separar?: boolean
}

export function MenuAcoes({ acoes, rotulo = 'Mais ações', className, comRotulo }: { acoes: Acao[]; rotulo?: string; className?: string; comRotulo?: boolean }) {
  const t = useT()
  const id = useId()
  const botao = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number; maxH: number }>()
  const aberto = !!pos
  const fechar = (voltarFoco = true) => {
    setPos(undefined)
    if (voltarFoco) botao.current?.focus()
  }
  const abrir = () => {
    const r = botao.current!.getBoundingClientRect()
    const abaixo = window.innerHeight - r.bottom
    const right = Math.max(8, window.innerWidth - r.right)
    setPos(abaixo > 260 || abaixo > r.top ? { top: r.bottom + 4, right, maxH: abaixo - 12 } : { bottom: window.innerHeight - r.top + 4, right, maxH: r.top - 12 })
  }
  useEffect(() => {
    if (!aberto) return
    menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    const fora = (e: Event) => {
      if (!menu.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) fechar(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (e.stopPropagation(), fechar())
    }
    const sair = () => fechar(false)
    document.addEventListener('pointerdown', fora, true)
    document.addEventListener('keydown', tecla, true)
    window.addEventListener('resize', sair)
    window.addEventListener('scroll', sair, true)
    return () => {
      document.removeEventListener('pointerdown', fora, true)
      document.removeEventListener('keydown', tecla, true)
      window.removeEventListener('resize', sair)
      window.removeEventListener('scroll', sair, true)
    }
  }, [aberto])
  if (!acoes.length) return null
  const andar = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const itens = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])]
    const k = itens.indexOf(document.activeElement as HTMLButtonElement)
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? itens.length - 1 : (k + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length
    itens[n]?.focus()
  }
  return (
    <span className={cx('relative inline-flex', className)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={botao}
        type="button"
        aria-label={t(rotulo)}
        title={t(rotulo)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        className={cx('inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl text-lg font-black leading-none hover:bg-[var(--marca-suave)] hover:text-[var(--marca)]', comRotulo ? 'border border-[var(--borda)] px-3 text-[var(--marca)]' : 'text-[var(--suave)]', aberto && 'bg-[var(--marca-suave)] text-[var(--marca)]')}
      >
        {comRotulo && <span className="hidden text-sm font-semibold sm:inline">{t('Mais')}</span>}⋯
      </button>
      {pos && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={t(rotulo)}
          onKeyDown={andar}
          style={{ top: pos.top, bottom: pos.bottom, right: pos.right, maxHeight: Math.max(160, pos.maxH) }}
          className="fixed z-50 w-max min-w-56 max-w-[calc(100vw-16px)] overflow-y-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-1 text-left shadow-xl"
        >
          {acoes.map((a, k) => (
            <div key={k}>
              {a.separar && k > 0 && <div role="separator" className="my-1 border-t border-[var(--borda)]" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => (fechar(false), a.onClick())}
                className={cx('flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium outline-none hover:bg-[var(--marca-suave)] focus-visible:bg-[var(--marca-suave)]', a.perigo && 'text-[var(--ruim)]')}
              >
                <span aria-hidden className="w-5 shrink-0 text-center">{a.icone}</span>
                <span className="min-w-0 [overflow-wrap:anywhere]">{t(a.rotulo)}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

/** O que o menu precisa saber de um lote (serve para a linha do estoque, o cartão da triagem e a ficha). */
export interface LoteMenu {
  id: Id
  saldo: number
  compras?: { id: Id; codigo?: string; fornecedor?: string; fornecedorId?: Id }[]
  /** lote-mãe (separação) ou lotes unificados */
  origens?: { id: Id; codigo?: string }[]
  vendavel?: boolean
  /** a etiqueta já foi impressa: aparece "Errou? Gerar nova" (cancela a antiga, nova via) */
  etiquetaImpressa?: boolean
  reservado?: boolean
}

/**
 * Ações padrão de um lote: abrir, compra(s) e fornecedor de origem, lote de origem, rastrear, vendas, vender,
 * separar, ajustar, imprimir etiqueta (tela Etiquetas) e trocar código (admin). `extras` entra no fim (ex.: "Mover para…" na triagem).
 */
export function acoesLote(
  l: LoteMenu,
  o: { ir(tela: string, p?: Params): void; t(s: string, v?: Record<string, string | number>): string; admin: boolean; extras?: Acao[]; separarParams?: Params; onAjustar?(): void; onTrocarCodigo?(): void; semAbrir?: boolean; onRefazerEtiqueta?(): void; onReservar?(): void },
): Acao[] {
  const { ir, t, admin } = o
  const acoes: Acao[] = []
  if (!o.semAbrir) acoes.push({ rotulo: 'Abrir lote', icone: '📄', onClick: () => ir('lote', { id: l.id }) })
  const compras = l.compras ?? []
  for (const c of compras)
    acoes.push({ rotulo: compras.length > 1 ? `${t('Compra')} ${c.codigo ?? ''}${c.fornecedor ? ` · ${c.fornecedor}` : ''}` : t('Ver compra de origem'), icone: '🛒', onClick: () => ir('pedido', { id: c.id }) })
  const fornecedores = [...new Map(compras.filter((c) => c.fornecedorId).map((c) => [c.fornecedorId!, c.fornecedor])).entries()]
  for (const [pid, nome] of fornecedores) acoes.push({ rotulo: fornecedores.length > 1 ? `${t('Ver fornecedor')} · ${nome ?? ''}` : t('Ver fornecedor'), icone: '👤', onClick: () => ir('pessoa', { id: pid }) })
  for (const x of l.origens ?? []) acoes.push({ rotulo: (l.origens ?? []).length > 1 ? `${t('Ver lote de origem')} ${x.codigo ?? ''}` : t('Ver lote de origem'), icone: '🧬', onClick: () => ir('lote', { id: x.id }) })
  acoes.push({ rotulo: 'Rastrear origem e destino', icone: '🔎', onClick: () => ir('rastreio', { itemId: l.id }), separar: true })
  acoes.push({ rotulo: 'Vendas deste lote', icone: '🧾', onClick: () => ir('rastreio', { itemId: l.id }) })
  if (l.saldo > 0 && l.vendavel !== false) acoes.push({ rotulo: 'Vender', icone: '💰', onClick: () => ir('vender', { modulo: 'cabelo', lote: l.id }), separar: true })
  // encomenda: guarda o pacote para uma cliente (🔒 no estoque; a venda avisa se for para outra)
  if (l.saldo > 0 && l.vendavel !== false && o.onReservar) acoes.push({ rotulo: l.reservado ? 'Mudar ou tirar reserva' : 'Reservar para uma cliente', icone: '🔒', onClick: o.onReservar })
  if (admin && l.saldo > 0) acoes.push({ rotulo: 'Separar', icone: '✂️', onClick: () => ir('separar', { id: l.id, ...(o.separarParams ?? {}) }) })
  if (admin && l.saldo > 0 && o.onAjustar) acoes.push({ rotulo: 'Ajustar', icone: '±', onClick: o.onAjustar })
  // etiqueta: abre a tela Etiquetas com este lote já marcado (lá também ficam os outros sem etiqueta)
  if (admin) acoes.push({ rotulo: 'Imprimir etiqueta', icone: '🏷', onClick: () => ir('etiquetas', { f: 'todas', sel: l.id }) })
  // saiu errada / borrou / perdeu: cancela a antiga e imprime nova (aqui mesmo, se a tela abrir a janela; senão na tela Etiquetas)
  if (admin && l.etiquetaImpressa) acoes.push({ rotulo: 'Errou? Gerar nova', icone: '↻', onClick: o.onRefazerEtiqueta ?? (() => ir('etiquetas', { f: 'todas', sel: l.id, refazer: l.id })) })
  if (admin && o.onTrocarCodigo) acoes.push({ rotulo: 'Trocar código', icone: '#', onClick: o.onTrocarCodigo, separar: true })
  return [...acoes, ...(o.extras ?? [])]
}
