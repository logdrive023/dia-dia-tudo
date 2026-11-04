// PAINEL DA SELEÇÃO — o padrão do sistema quando a pessoa marca itens numa lista (Triagem, Estoque, Etiquetas…).
// Fica grudado embaixo da lista e deixa na cara:
//   1. O QUE FOI SELECIONADO: quantos, o peso somado, um resumo da tela (de quantas compras, custo médio…), uma barra
//      com quanto cada item pesa no total e um chip por item (cor, código, peso, origem; ✕ tira só ele);
//   2. O QUE DÁ PARA FAZER: cartões grandes, cada um com ícone, nome, uma linha do que faz e um ⓘ com exemplo. O
//      principal em destaque; os que não valem agora ficam apagados dizendo POR QUÊ;
//   3. OUTRAS AÇÕES à vista (sem menu escondido): botões simples, cada um com a explicação embaixo, e um ⓘ do grupo.
// POSIÇÃO (inteligente): sempre preso ao RODAPÉ da tela (acima da barra do celular), na largura exata da coluna de
// conteúdo (não cobre o menu lateral), e deixa no fim da página um espaço do mesmo tamanho — o fim da lista nunca
// fica escondido atrás dele. Tela baixa (< 760 px) ou muitos itens: os chips começam recolhidos ("Ver os N").
// MINIMIZADO por padrão: marcou 1, marcou 2… fica só uma barra fina no rodapé com o NÚMERO em destaque, o peso e UM
// botão "Escolher o que fazer ▴". Tocar nele abre o painel inteiro; "▾ Minimizar" (ou Esc) volta para a barra.
// A tela só passa os itens e as opções; o visual e o comportamento são daqui.

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Botao, Info, cx, gramasTexto } from './base'
import { useT } from './i18n'
import type { Acao } from './menuAcoes'

export interface ItemSelecionado {
  id: string
  codigo?: string
  /** peso (gramas) ou quantidade; vira a barra e o número do chip */
  peso: number
  /** origem curta no chip ("P-0005 · Wagner") */
  detalhe?: string
  /** pede atenção (ex.: sobra pequena): o chip fica em âmbar com ⚠ */
  alerta?: boolean
}

export interface OpcaoSelecao {
  id: string
  icone: string
  titulo: string
  /** uma linha do que faz (aparece sempre) */
  legenda: string
  /** explicação com exemplo (no ⓘ) */
  ajuda: string
  principal?: boolean
  /** não vale agora: o cartão fica apagado e mostra este motivo no lugar da legenda */
  desligado?: string
  onClick(): void
}

const CORES = ['#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6']

export function PainelSelecao({ itens, unidade = 'pacote', fatos = [], aviso, topo, opcoes, mais, ajudaMais, ocupado, onTirar, onLimpar }: {
  itens: ItemSelecionado[]
  /** "pacote" → "1 pacote selecionado" / "3 pacotes selecionados" */
  unidade?: 'pacote' | 'lote'
  /** os dados da seleção em selos padronizados, depois do peso: [{ icone: '🛒', texto: 'de 2 compras' }] */
  fatos?: { icone: string; texto: string }[]
  /** uma linha de aviso embaixo dos chips (ex.: misturando compras) */
  aviso?: ReactNode
  /** botão extra no alto (ex.: "Selecionar todos os 20 filtrados") */
  topo?: ReactNode
  opcoes: OpcaoSelecao[]
  /** ações de menos uso, à vista embaixo (cada uma com `descricao`) */
  mais?: Acao[]
  /** o ⓘ do grupo "Outras ações" (o que elas têm em comum) */
  ajudaMais?: string
  ocupado?: boolean
  onTirar?(id: string): void
  onLimpar(): void
}) {
  const t = useT()
  const g = itens.reduce((s, i) => s + i.peso, 0)
  // o espaço reservado (no fluxo da página) mede a coluna; o painel (fixo) copia a largura e a posição dele
  const lugar = useRef<HTMLDivElement>(null)
  const painel = useRef<HTMLElement>(null)
  const [caixa, setCaixa] = useState<{ left: number; width: number }>()
  const [altura, setAltura] = useState(0)
  const baixa = () => { try { return window.innerHeight < 760 } catch { return false } }
  const [verChips, setVerChips] = useState(() => !baixa() && itens.length <= 6)
  const [aberto, setAberto] = useState(false)
  // Esc com o painel aberto: minimiza (não limpa a seleção)
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto])
  useLayoutEffect(() => {
    const medir = () => {
      const r = lugar.current?.getBoundingClientRect()
      if (r && r.width) setCaixa({ left: r.left, width: r.width })
      if (painel.current) setAltura(painel.current.offsetHeight)
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : undefined
    if (lugar.current) ro?.observe(lugar.current)
    if (painel.current) ro?.observe(painel.current)
    window.addEventListener('resize', medir)
    return () => { ro?.disconnect(); window.removeEventListener('resize', medir) }
  }, [])
  const muitos = itens.length > 6
  useEffect(() => { if (muitos) setVerChips(false) }, [muitos])
  const cor = (k: number) => CORES[k % CORES.length]
  const nome = unidade === 'lote' ? (itens.length === 1 ? '1 lote selecionado' : '{n} lotes selecionados') : itens.length === 1 ? '1 pacote selecionado' : '{n} pacotes selecionados'
  return (
    <>
    {/* o lugar reservado: mede a coluna e guarda o espaço do painel no fim da página */}
    <div ref={lugar} aria-hidden style={{ height: altura ? altura + 12 : 0 }} />
    <section ref={painel} role="region" aria-label={t('Selecionados')} style={caixa ? { left: caixa.left, width: caixa.width } : undefined}
      className={cx('fixed bottom-[calc(5rem_+_env(safe-area-inset-bottom))] z-30 overflow-y-auto border-2 border-[var(--marca)] bg-[var(--cartao)] shadow-2xl md:bottom-4', aberto ? 'max-h-[60vh] rounded-3xl' : 'rounded-2xl', !caixa && 'inset-x-2')}>
      {!aberto ? (
        // BARRA MINIMIZADA: o número em destaque · o que é e quanto pesa · UM botão para escolher o que fazer · ✕
        <div className="flex items-center gap-3 p-2 pl-2.5">
          <span aria-hidden className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] px-2 text-2xl font-black text-white shadow-md">{itens.length}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm sm:text-base">{t(nome, { n: itens.length })}</b>
            <span className="num block truncate text-xs text-[var(--suave)]"><b className="text-[var(--texto)]">{gramasTexto(g)}</b>{fatos[0] && <span className="hidden sm:inline"> · {fatos[0].texto}</span>}</span>
            <span aria-hidden className="mt-1 flex h-1.5 w-full max-w-60 gap-px overflow-hidden rounded-full bg-[var(--fundo)]">
              {itens.map((i, k) => <span key={i.id} className="h-full min-w-[3px]" style={{ flexGrow: Math.max(i.peso, 1), flexBasis: 0, background: cor(k) }} />)}
            </span>
          </span>
          <Botao className="shrink-0 px-4" aria-expanded={false} onClick={() => setAberto(true)}>
            <span className="sm:hidden">{t('Continuar')}</span><span className="hidden sm:inline">{t('Escolher o que fazer')}</span> <span aria-hidden>▴</span>
          </Botao>
          <button type="button" onClick={onLimpar} aria-label={t('Limpar seleção')} title={t('Limpar seleção')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-[var(--suave)] hover:bg-[var(--fundo)] hover:text-[var(--ruim)]">✕</button>
        </div>
      ) : <>
      {/* 1. O QUE FOI SELECIONADO */}
      <div className="border-b border-[var(--borda)] bg-[linear-gradient(180deg,var(--marca-suave),transparent)] p-3 sm:p-4">
        {/* LINHA 1: o número · "2 pacotes selecionados" · à direita só ▾ minimizar e ✕ limpar (como na barra minimizada) */}
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] px-2 text-xl font-black text-white shadow-md">{itens.length}</span>
          <b className="min-w-0 flex-1 truncate text-base sm:text-lg">{t(nome, { n: itens.length })}</b>
          <button type="button" aria-expanded onClick={() => setAberto(false)} aria-label={t('Minimizar')} title={t('Minimizar')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-[var(--marca)] hover:border-[var(--marca)]">▾</button>
          <button type="button" onClick={onLimpar} aria-label={t('Limpar seleção')} title={t('Limpar seleção')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-[var(--suave)] hover:border-[var(--ruim)] hover:text-[var(--ruim)]">✕</button>
        </div>
        {/* LINHA 2: os dados em selos iguais (peso sempre primeiro) e o extra da tela (ex.: selecionar todos) */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {[{ icone: '⚖', texto: gramasTexto(g) }, ...fatos].map((f, k) => (
            <span key={k} className={cx('num inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--borda)] bg-[var(--cartao)] px-2.5 text-xs', k === 0 ? 'font-bold text-[var(--texto)]' : 'font-medium text-[var(--suave)]')}>
              <span aria-hidden>{f.icone}</span>{f.texto}
            </span>
          ))}
          {topo && <span className="ml-auto">{topo}</span>}
        </div>
        {/* LINHA 3: quanto cada item pesa no total (a cor é a do chip) + ver/esconder os itens */}
        <div className="mt-3 flex items-center gap-3">
          <div role="img" aria-label={itens.map((i) => `${i.codigo ?? ''} ${gramasTexto(i.peso)}`).join(' + ')} className="flex h-3 min-w-0 flex-1 gap-px overflow-hidden rounded-full bg-[var(--fundo)]">
            {itens.map((i, k) => <span key={i.id} className="h-full min-w-[3px]" style={{ flexGrow: Math.max(i.peso, 1), flexBasis: 0, background: cor(k) }} />)}
          </div>
          <button type="button" aria-expanded={verChips} onClick={() => setVerChips(!verChips)} className="shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{verChips ? t('Esconder itens') : t('Ver os {n}', { n: itens.length })} <span aria-hidden className={cx('inline-block transition-transform', verChips && 'rotate-180')}>▾</span></button>
        </div>
        {/* os itens: UMA faixa que rola de lado (com 2 ou com 50 não quebra nem empurra o painel); cada chip tem largura
            máxima e corta a origem com … ; o ✕ tira só ele */}
        {verChips && <ul className="-mx-1 mt-2 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {itens.map((i, k) => (
            <li key={i.id} className={cx('inline-flex min-h-10 w-max max-w-[15rem] shrink-0 snap-start items-center gap-2 rounded-full border pl-2.5 pr-1 text-sm shadow-sm sm:max-w-[20rem]', i.alerta ? 'border-[var(--alerta)] bg-[var(--alerta)]/10' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: cor(k) }} />
              {i.alerta && <span aria-hidden>⚠️</span>}
              <b className="shrink-0 font-mono">{i.codigo ?? '—'}</b>
              <span className="num shrink-0 whitespace-nowrap font-semibold">{gramasTexto(i.peso)}</span>
              {i.detalhe && <span className="min-w-0 truncate text-xs text-[var(--suave)]" title={i.detalhe}>{i.detalhe}</span>}
              {onTirar ? <button type="button" onClick={() => onTirar(i.id)} aria-label={`${t('Tirar da seleção')} ${i.codigo ?? ''}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--suave)] hover:bg-[var(--fundo)] hover:text-[var(--ruim)]">✕</button> : <span className="w-1" />}
            </li>
          ))}
        </ul>}
        {aviso && <p className="mt-2 text-xs text-[var(--suave)]">{aviso}</p>}
      </div>
      {/* 2. O QUE DÁ PARA FAZER */}
      <div className={cx('grid gap-2 p-3 sm:p-4', opcoes.length >= 3 ? 'md:grid-cols-3' : opcoes.length === 2 ? 'sm:grid-cols-2' : '')}>
        {opcoes.map((o) => (
          <div key={o.id} className="relative">
            <button type="button" disabled={ocupado || !!o.desligado} onClick={o.onClick}
              className={cx('flex h-full min-h-16 w-full items-start gap-3 rounded-2xl border-2 p-2.5 pr-10 text-left sm:min-h-20 sm:p-3 transition disabled:cursor-not-allowed disabled:opacity-50',
                o.principal ? 'border-[var(--marca)] bg-[var(--marca)] text-white shadow-md enabled:hover:brightness-110' : 'border-[var(--borda)] bg-[var(--cartao)] enabled:hover:border-[var(--marca)] enabled:hover:bg-[var(--marca-suave)]')}>
              <span aria-hidden className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl', o.principal ? 'bg-white/20' : 'bg-[var(--fundo)]')}>{o.icone}</span>
              <span className="min-w-0">
                <b className="block text-base">{t(o.titulo)}</b>
                <span className={cx('block text-xs leading-snug', o.principal ? 'text-white/85' : 'text-[var(--suave)]')}>{t(o.desligado ?? o.legenda)}</span>
              </span>
            </button>
            <span className="absolute right-2 top-2"><Info texto={o.ajuda} /></span>
          </div>
        ))}
      </div>
      {/* 3. OUTRAS AÇÕES à vista: botões simples, cada um com o que faz embaixo */}
      {mais && mais.length > 0 && (
        <div className="border-t border-[var(--borda)] px-3 pb-3 pt-2 sm:px-4">
          <p className="mb-1.5 flex items-center text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Outras ações')}{ajudaMais && <Info texto={ajudaMais} />}</p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {mais.map((a, k) => (
              <button key={k} type="button" disabled={ocupado} onClick={a.onClick} title={a.descricao ? t(a.descricao) : undefined}
                className={cx('flex min-h-12 items-start gap-2 rounded-xl border border-[var(--borda)] bg-[var(--fundo)] px-3 py-2 text-left text-sm transition hover:border-[var(--marca)] hover:bg-[var(--marca-suave)] disabled:opacity-50', a.perigo && 'text-[var(--ruim)]')}>
                <span aria-hidden className="w-4 shrink-0 text-center">{a.icone}</span>
                <span className="min-w-0">
                  <b className="block font-semibold [overflow-wrap:anywhere]">{t(a.rotulo)}</b>
                  {a.descricao && <span className="block text-xs leading-snug text-[var(--suave)]">{t(a.descricao)}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      </>}
    </section>
    </>
  )
}
