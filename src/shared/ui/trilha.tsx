// TRILHA DE NAVEGAÇÃO (breadcrumb) — UM componente para o sistema todo:
//   ←  🛒 Compras  ›  Pedido P-0007
//   ←  📦 Estoque  ›  L-0022  ›  Rastreio total
// · o 1º nível é a ORIGEM: a tela para onde o "voltar" leva agora (mesma regra do App: IR E VOLTAR — veio da venda
//   V-0004 → "← Venda V-0004"; abriu por link → a lista da área). Mostra o NOME de onde veio (o mesmo que aquela tela
//   mostrava na trilha dela), não só o tipo da tela. Tocar nele ou na ← volta para lá.
// · níveis do meio (opcionais) vêm da tela, com destino próprio (ex.: o pacote dentro do rastreio)
// · o último é a página ATUAL: em negrito, sem link (aria-current="page")
// · celular: os níveis do meio viram "…" e o atual corta com reticências; separadores discretos (›)
// Não depende de nenhum módulo: recebe rótulos e destinos.

import { type ReactNode, useLayoutEffect, useRef } from 'react'
import type { Navegacao } from './contexto'
import { NOME_TELA } from '../navegacao/rotas'
import { useApp } from './contexto'
import { useT } from './i18n'
import { Icone } from './icones'

export interface NivelTrilha {
  rotulo: ReactNode
  /** destino do nível (sem destino = só texto) */
  onClick?(): void
}

/** o nome que cada tela mostrou na trilha ("Venda V-0004"): a tela seguinte usa no "← voltar" */
const ROTULOS = new Map<string, string>()
const chave = (n: Navegacao) => `${n.tela}|${String(n.params.id ?? n.params.compraId ?? n.params.itemId ?? n.params.vendaId ?? '')}`

const SEP = <span aria-hidden className="shrink-0 select-none px-0.5 text-[var(--suave)] opacity-60">›</span>
const ICONES = new Set(['painel', 'vender', 'agenda', 'caixa', 'viagens', 'comprar', 'triagem', 'estoque', 'etiquetas', 'precos', 'pessoas', 'equipe', 'emprestimos', 'adiantamentos', 'relatorios', 'auditoria', 'novidades', 'config'])

export function Trilha({ atual, niveis = [], onVoltar, rotuloVoltar, className = '' }: {
  /** a página atual (último nível) */
  atual?: ReactNode
  /** níveis entre a origem e a atual */
  niveis?: NivelTrilha[]
  /** voltar próprio da tela (ex.: um passo de formulário); sem ele usa o voltar do App */
  onVoltar?(): void
  /** com onVoltar próprio: o nome do 1º nível ("Voltar à triagem") */
  rotuloVoltar?: string
  className?: string
}) {
  const t = useT()
  const { voltar, origem, nav } = useApp()
  const atualRef = useRef<HTMLSpanElement>(null)
  // guarda o nome desta tela (o texto do último nível) para o "← voltar" da próxima
  useLayoutEffect(() => {
    const txt = atualRef.current?.textContent?.trim()
    if (txt) ROTULOS.set(chave(nav), txt.length > 32 ? txt.slice(0, 31) + '…' : txt)
  })
  const sair = onVoltar ?? voltar
  const telaOrigem = onVoltar ? undefined : origem?.tela
  const lembrado = !onVoltar && origem ? ROTULOS.get(chave(origem)) : undefined
  const nomeOrigem = rotuloVoltar ?? lembrado ?? (telaOrigem && NOME_TELA[telaOrigem]) ?? 'Voltar'
  const link = 'inline-flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg px-2 font-semibold text-[var(--marca)] transition-colors hover:bg-[var(--marca-suave)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marca)]'
  return (
    <nav aria-label={t('Você está em')} className={`mb-3 flex min-w-0 items-center gap-0.5 text-sm ${className}`}>
      <ol className="flex min-w-0 flex-1 items-center gap-0.5">
        {/* a origem é o próprio "voltar": ← + ícone + nome (um botão só, sem ← repetido ao lado) */}
        <li className="flex min-w-0 shrink-0 items-center">
          <button type="button" onClick={sair} title={t('Voltar')} className={`${link} -ml-2`}>
            <span aria-hidden className="text-base font-bold">←</span>
            {telaOrigem && ICONES.has(telaOrigem) && <Icone nome={telaOrigem} className="h-4 w-4 shrink-0" />}
            <span className="truncate">{lembrado ?? t(nomeOrigem)}</span>
          </button>
        </li>
        {niveis.map((n, k) => (
          // celular: os do meio somem (fica "…"); a origem e a atual sempre à vista
          <li key={k} className="hidden min-w-0 items-center sm:flex">
            {SEP}
            {n.onClick ? <button type="button" onClick={n.onClick} className={link}><span className="truncate">{n.rotulo}</span></button> : <span className="truncate px-2 text-[var(--suave)]">{n.rotulo}</span>}
          </li>
        ))}
        {niveis.length > 0 && <li aria-hidden className="flex items-center sm:hidden">{SEP}<span className="px-1 text-[var(--suave)]">…</span></li>}
        {atual !== undefined && (
          <li className="flex min-w-0 items-center">
            {SEP}
            <span ref={atualRef} aria-current="page" className="truncate px-2 font-semibold text-[var(--texto)]">{atual}</span>
          </li>
        )}
      </ol>
    </nav>
  )
}
