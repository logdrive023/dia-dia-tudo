// MENU "⋯" (mais ações): o mesmo em toda tela. Abre por toque/clique/teclado, fecha no Esc, ao tocar fora ou ao escolher.
// Visual padrão: as ações em GRUPOS com um título pequeno (VER · RASTREAR · FAZER · ETIQUETA · MAIS), cada uma com o
// ícone num quadradinho do mesmo tamanho (tudo alinhado), o nome e, se tiver, uma linha do que faz. Perigo em vermelho.
// Fica por cima de tudo (posição fixa): não é cortado por cartões com overflow nem por listas com rolagem.

import { useEffect, useId, useRef, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { Params } from './contexto'
import { cx, Janela } from './base'
import { useT } from './i18n'

export interface Acao {
  rotulo: string
  icone?: string
  /** uma linha do que a ação faz, embaixo do nome (para quem bate o olho e não sabe) */
  descricao?: string
  onClick(): void
  perigo?: boolean
  /** linha separadora antes deste item (sem `grupo`) */
  separar?: boolean
  /** o grupo (título pequeno em cima): itens seguidos do mesmo grupo ficam juntos */
  grupo?: string
  /** vários do mesmo tipo (5 compras, 4 fornecedores…): UMA linha "🛒 Compras de origem · 5 ▸" que abre a lista
   *  dentro do próprio menu (o menu não vira uma lista sem fim) */
  filhos?: Acao[]
}

/** junta as ações em blocos: muda o grupo (ou `separar`) → bloco novo */
function emGrupos(acoes: Acao[]) {
  const blocos: { grupo?: string; itens: Acao[] }[] = []
  for (const a of acoes) {
    const ult = blocos[blocos.length - 1]
    if (!ult || (a.grupo !== undefined ? a.grupo !== ult.grupo : !!a.separar)) blocos.push({ grupo: a.grupo, itens: [a] })
    else ult.itens.push(a)
  }
  return blocos
}

/** `principal`: o menu é a AÇÃO PRINCIPAL da tela (botão cheio com o texto, ex.: "+ Nova venda ▾") e não o "⋯". */
export function MenuAcoes({ acoes, rotulo = 'Mais ações', className, comRotulo, principal }: { acoes: Acao[]; rotulo?: string; className?: string; comRotulo?: boolean; principal?: string }) {
  const t = useT()
  const id = useId()
  const botao = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right?: number; left?: number; maxH: number }>()
  const aberto = !!pos
  // celular + ação principal ("+ Nova venda"): abre uma FOLHA de baixo com as opções grandes (o menu solto sairia da tela)
  const [folha, setFolha] = useState(false)
  // a linha com "filhos" que está aberta (uma por vez)
  const [abertoGrupo, setAbertoGrupo] = useState<string>()
  const fechar = (voltarFoco = true) => {
    setPos(undefined)
    if (voltarFoco) botao.current?.focus()
  }
  const abrir = () => {
    if (principal && window.innerWidth < 640) return setFolha(true)
    const r = botao.current!.getBoundingClientRect()
    const abaixo = window.innerHeight - r.bottom
    // abre para o lado que CABE: alinhado à direita do botão; se o botão está perto da borda esquerda, alinhado à esquerda
    const largura = Math.min(300, window.innerWidth - 16)
    const lado = r.right - largura < 8 ? { left: Math.max(8, Math.min(r.left, window.innerWidth - largura - 8)) } : { right: Math.max(8, window.innerWidth - r.right) }
    setPos(abaixo > 260 || abaixo > r.top ? { top: r.bottom + 4, ...lado, maxH: abaixo - 12 } : { bottom: window.innerHeight - r.top + 4, ...lado, maxH: r.top - 12 })
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
    // rolar DENTRO do menu (lista comprida) não fecha; rolar a página, sim (o menu ficaria solto no lugar errado)
    const rolou = (e: Event) => { if (!menu.current?.contains(e.target as Node)) fechar(false) }
    document.addEventListener('pointerdown', fora, true)
    document.addEventListener('keydown', tecla, true)
    window.addEventListener('resize', sair)
    window.addEventListener('scroll', rolou, true)
    return () => {
      document.removeEventListener('pointerdown', fora, true)
      document.removeEventListener('keydown', tecla, true)
      window.removeEventListener('resize', sair)
      window.removeEventListener('scroll', rolou, true)
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
        aria-label={t(principal ?? rotulo)}
        title={principal ? undefined : t(rotulo)}
        aria-haspopup={principal ? 'dialog' : 'menu'}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        aria-expanded={aberto || folha}
        className={principal
          ? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--marca)] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110'
          : cx('inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl text-lg font-black leading-none hover:bg-[var(--marca-suave)] hover:text-[var(--marca)]', comRotulo ? 'border border-[var(--borda)] px-3 text-[var(--marca)]' : 'text-[var(--suave)]', aberto && 'bg-[var(--marca-suave)] text-[var(--marca)]')}
      >
        {principal ? <>{t(principal)} <span aria-hidden className={cx('text-xs transition-transform', aberto && 'rotate-180')}>▾</span></> : <>{comRotulo && <span className="hidden text-sm font-semibold sm:inline">{t('Mais')}</span>}⋯</>}
      </button>
      {pos && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={t(rotulo)}
          onKeyDown={andar}
          style={{ top: pos.top, bottom: pos.bottom, right: pos.right, left: pos.left, maxHeight: Math.max(160, pos.maxH) }}
          className="fixed z-50 w-[min(18.75rem,calc(100vw-16px))] overflow-y-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-1.5 text-left shadow-[0_12px_32px_-8px_rgba(16,24,40,.25)]"
        >
          {emGrupos(acoes).map((g, k) => (
            <div key={k} role="group" aria-label={g.grupo ? t(g.grupo) : undefined} className={cx(k > 0 && 'mt-1 border-t border-[var(--borda)] pt-1')}>
              {g.grupo && <p aria-hidden className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--suave)]">{t(g.grupo)}</p>}
              {g.itens.map((a, j) => a.filhos?.length ? (
                <div key={j}>
                  <button type="button" role="menuitem" aria-expanded={abertoGrupo === `${k}-${j}`} onClick={() => setAbertoGrupo(abertoGrupo === `${k}-${j}` ? undefined : `${k}-${j}`)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm font-medium outline-none transition-colors hover:bg-[var(--marca-suave)] focus-visible:bg-[var(--marca-suave)]">
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fundo)] text-base">{a.icone ?? '•'}</span>
                    <span className="min-w-0 flex-1 break-words">{t(a.rotulo)}</span>
                    <span className="num shrink-0 rounded-full bg-[var(--marca-suave)] px-2 text-xs font-bold text-[var(--marca)]">{a.filhos.length}</span>
                    <span aria-hidden className={cx('shrink-0 text-[var(--suave)] transition-transform', abertoGrupo === `${k}-${j}` && 'rotate-90')}>›</span>
                  </button>
                  {abertoGrupo === `${k}-${j}` && (
                    <div className="mb-1 ml-5 border-l-2 border-[var(--borda)] pl-2">
                      {a.filhos.map((f, m) => (
                        <button key={m} type="button" role="menuitem" onClick={() => (fechar(false), f.onClick())}
                          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-[var(--marca-suave)] focus-visible:bg-[var(--marca-suave)]">
                          <span className="min-w-0 flex-1 truncate">{f.rotulo}</span>{f.descricao && <span className="shrink-0 truncate text-xs text-[var(--suave)]">{f.descricao}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={j}
                  type="button"
                  role="menuitem"
                  onClick={() => (fechar(false), a.onClick())}
                  className={cx('flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm font-medium outline-none transition-colors hover:bg-[var(--marca-suave)] focus-visible:bg-[var(--marca-suave)]', a.perigo && 'text-[var(--ruim)] hover:bg-[var(--ruim)]/10')}
                >
                  <span aria-hidden className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base', a.perigo ? 'bg-[var(--ruim)]/10' : 'bg-[var(--fundo)]')}>{a.icone ?? '•'}</span>
                  <span className="min-w-0 flex-1 break-words">{t(a.rotulo)}{a.descricao && <span className="block text-xs font-normal leading-snug text-[var(--suave)]">{t(a.descricao)}</span>}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {folha && (
        <Janela aberta titulo={t((principal ?? rotulo).replace(/^\+\s*/, ''))} onFechar={() => setFolha(false)}>
          <p className="mb-3 text-sm text-[var(--suave)]">{t('O que vai vender agora?')}</p>
          <ul className="space-y-2">
            {acoes.map((a, k) => (
              <li key={k}>
                <button type="button" onClick={() => (setFolha(false), a.onClick())}
                  className={cx('flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left shadow-sm transition active:scale-[.99] hover:border-[var(--marca)]', k === 0 && 'border-[var(--marca)] bg-[var(--marca-suave)]', a.perigo && 'text-[var(--ruim)]')}>
                  <span aria-hidden className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl', k === 0 ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)]')}>{a.icone}</span>
                  <span className="min-w-0 flex-1 font-semibold break-words">{t(a.rotulo)}{a.descricao && <span className="block text-xs font-normal text-[var(--suave)]">{t(a.descricao)}</span>}</span>
                  <span aria-hidden className="text-[var(--suave)]">›</span>
                </button>
              </li>
            ))}
          </ul>
        </Janela>
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
  o: { ir(tela: string, p?: Params): void; t(s: string, v?: Record<string, string | number>): string; admin: boolean; extras?: Acao[]; separarParams?: Params; onAjustar?(): void; onTrocarCodigo?(): void; semAbrir?: boolean; onRefazerEtiqueta?(): void; onReservar?(): void; sem?: string[]; rotuloVender?: string },
): Acao[] {
  const { ir, t, admin } = o
  const acoes: Acao[] = []
  if (!o.semAbrir) acoes.push({ grupo: 'Ver', rotulo: 'Abrir lote', icone: '📄', onClick: () => ir('lote', { id: l.id }) })
  const compras = l.compras ?? []
  const fornecedores = [...new Map(compras.filter((c) => c.fornecedorId).map((c) => [c.fornecedorId!, c.fornecedor])).entries()]
  const origens = l.origens ?? []
  // um só: abre direto; vários (pacote misturado): uma linha com o número que abre a lista ali mesmo
  if (compras.length === 1) acoes.push({ grupo: 'Ver', rotulo: t('Ver compra de origem'), icone: '🛒', onClick: () => ir('pedido', { id: compras[0].id }) })
  else if (compras.length > 1) acoes.push({ grupo: 'Ver', rotulo: t('Compras de origem'), icone: '🛒', onClick: () => undefined, filhos: compras.map((c) => ({ rotulo: c.codigo ?? t('Compra'), descricao: c.fornecedor, onClick: () => ir('pedido', { id: c.id }) })) })
  if (fornecedores.length === 1) acoes.push({ grupo: 'Ver', rotulo: t('Ver fornecedor'), icone: '👤', onClick: () => ir('pessoa', { id: fornecedores[0][0] }) })
  else if (fornecedores.length > 1) acoes.push({ grupo: 'Ver', rotulo: t('Fornecedores'), icone: '👤', onClick: () => undefined, filhos: fornecedores.map(([pid, nome]) => ({ rotulo: nome ?? '—', onClick: () => ir('pessoa', { id: pid }) })) })
  if (origens.length === 1) acoes.push({ grupo: 'Ver', rotulo: t('Ver lote de origem'), icone: '🧬', onClick: () => ir('lote', { id: origens[0].id }) })
  else if (origens.length > 1) acoes.push({ grupo: 'Ver', rotulo: t('Lotes de origem (misturados)'), icone: '🧬', onClick: () => undefined, filhos: origens.map((x) => ({ rotulo: x.codigo ?? '—', onClick: () => ir('lote', { id: x.id }) })) })
  acoes.push({ grupo: 'Rastrear', rotulo: 'Rastrear origem e destino', icone: '🔎', onClick: () => ir('rastreio', { itemId: l.id }) })
  acoes.push({ grupo: 'Rastrear', rotulo: 'Vendas deste lote', icone: '🧾', onClick: () => ir('rastreio', { itemId: l.id }) })
  if (l.saldo > 0 && l.vendavel !== false) acoes.push({ grupo: 'Fazer', rotulo: o.rotuloVender ?? 'Vender', icone: '💰', onClick: () => ir('vender', { modulo: 'cabelo', lote: l.id }) })
  // encomenda: guarda o pacote para uma cliente (🔒 no estoque; a venda avisa se for para outra)
  if (l.saldo > 0 && l.vendavel !== false && o.onReservar) acoes.push({ grupo: 'Fazer', rotulo: l.reservado ? 'Mudar ou tirar reserva' : 'Reservar para uma cliente', icone: '🔒', onClick: o.onReservar })
  if (admin && l.saldo > 0) acoes.push({ grupo: 'Fazer', rotulo: 'Separar', icone: '✂️', onClick: () => ir('separar', { id: l.id, ...(o.separarParams ?? {}) }) })
  if (admin && l.saldo > 0 && o.onAjustar) acoes.push({ grupo: 'Fazer', rotulo: 'Ajustar', icone: '±', onClick: o.onAjustar })
  // etiqueta: já tem → VER (abre o pacote com a etiqueta à vista: o "voltar" traz de volta para cá);
  // não tem → imprimir (abre a tela Etiquetas com este lote já marcado, lá também ficam os outros sem etiqueta)
  if (l.etiquetaImpressa) acoes.push({ grupo: 'Etiqueta', rotulo: 'Ver etiqueta', icone: '🏷', onClick: () => ir('lote', { id: l.id, etiqueta: 'ver' }) })
  else if (admin) acoes.push({ grupo: 'Etiqueta', rotulo: 'Imprimir etiqueta', icone: '🏷', onClick: () => ir('etiquetas', { f: 'todas', sel: l.id }) })
  // saiu errada / borrou / perdeu: cancela a antiga e imprime nova (aqui mesmo, se a tela abrir a janela; senão na tela Etiquetas)
  if (admin && l.etiquetaImpressa) acoes.push({ grupo: 'Etiqueta', rotulo: 'Errou? Gerar nova', icone: '↻', onClick: o.onRefazerEtiqueta ?? (() => ir('etiquetas', { f: 'todas', sel: l.id, refazer: l.id })) })
  if (admin && o.onTrocarCodigo) acoes.push({ grupo: 'Mais', rotulo: 'Trocar código', icone: '#', onClick: o.onTrocarCodigo })
  // `sem`: o que a tela já mostra em botão na linha (não repete no ⋯)
  return [...acoes, ...(o.extras ?? []).map((a) => ({ grupo: 'Mais', ...a, separar: undefined }))].filter((a) => !o.sem?.includes(a.rotulo))
}
