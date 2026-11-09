// CABEÇALHO DE FICHA (a página de UMA coisa: pacote, pedido, viagem) — o único, no MESMO visual do cabeçalho das listas
// (Titulo): um cartão com o filete da marca no alto, o brilho suave e o ícone do módulo (ou a foto, se a ficha tem).
//   [foto/ícone]  Título (o nome da coisa)                                    [valor em destaque]
//                 CÓDIGO ⧉ · situação · selos                                  [detalhe do valor]
//                 os detalhes em selos iguais (📅 data · 👤 quem · 📍 onde)
//   ───────────────────────────────────────────────────────────────────────────────────────
//   ações: o botão principal + 1 ou 2 secundários + "Mais ⋯"
// Se ajusta sozinho: o valor desce para baixo do título quando não cabe; as ações quebram de linha. A tela só diz o
// que vai em cada lugar; tamanho, ordem e espaçamento são sempre estes.

import type { ReactNode } from 'react'
import { PAI } from '../navegacao/rotas'
import { cx } from './base'
import { CodigoSelo } from './codigos'
import { useApp } from './contexto'
import { useT } from './i18n'
import { Icone, temIcone } from './icones'

export function CabecalhoFicha({ midia, titulo, codigo, anteriores, selos, detalhes, valor, valorDetalhe, acoes, className }: {
  /** foto à esquerda (opcional); sem ela, vai o ícone do módulo (o mesmo do menu) */
  midia?: ReactNode
  titulo: ReactNode
  /** o código da coisa (copiar com um toque) e os códigos antigos */
  codigo?: string
  anteriores?: string[]
  /** situação e selos, na linha do código */
  selos?: ReactNode
  /** os detalhes ("04/10/2026", "comprou: Ana"): cada um num selo igual; vazios somem */
  detalhes?: ReactNode[]
  /** número em destaque à direita (no celular vai para baixo do título) */
  valor?: ReactNode
  valorDetalhe?: ReactNode
  /** a linha de ações (embaixo, separada por uma divisória) */
  acoes?: ReactNode
  className?: string
}) {
  const t = useT()
  const { nav } = useApp()
  let modulo = nav.tela
  for (let i = 0; i < 3 && !temIcone(modulo) && PAI[modulo]; i++) modulo = PAI[modulo]
  const partes = (detalhes ?? []).filter((x) => x !== undefined && x !== null && x !== false && x !== '')
  return (
    <header className={cx('relative overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_16px_-8px_rgba(16,24,40,.08)]', className)}>
      {/* decoração igual à do cabeçalho das listas (não pega toque, não é lida) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--marca)_9%,transparent)_0%,transparent_55%)]" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,var(--marca),color-mix(in_srgb,var(--marca)_55%,#ec4899),transparent)]" />
      <div className="relative flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-[1_1_18rem] items-start gap-3 sm:gap-4">
          {midia ? <div className="shrink-0">{midia}</div> : temIcone(modulo) && (
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] text-white shadow-[0_6px_14px_-6px_color-mix(in_srgb,var(--marca)_70%,transparent)]">
              <Icone nome={modulo} className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight tracking-tight break-words sm:text-2xl">{titulo}</h1>
            {(codigo || selos) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {codigo && <CodigoSelo codigo={codigo} anteriores={anteriores} />}
                {selos}
              </div>
            )}
            {(partes.length > 0 || !!anteriores?.length) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {partes.map((x, k) => <span key={k} className="num inline-flex min-h-7 items-center rounded-full bg-[var(--fundo)] px-2.5 text-xs text-[var(--suave)] ring-1 ring-[var(--borda)]">{x}</span>)}
                {!!anteriores?.length && <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--fundo)] px-2.5 text-xs text-[var(--suave)] ring-1 ring-[var(--borda)]">{t('Antes')}: <span className="ml-1 font-mono">{anteriores.join(', ')}</span></span>}
              </div>
            )}
          </div>
        </div>
        {valor !== undefined && (
          <div className="min-w-0 shrink-0 rounded-xl bg-[var(--fundo)] px-3 py-2 ring-1 ring-[var(--borda)] sm:ml-auto sm:text-right">
            <div className="num text-2xl font-black leading-tight sm:text-3xl">{valor}</div>
            {valorDetalhe && <div className="num text-sm text-[var(--suave)]">{valorDetalhe}</div>}
          </div>
        )}
      </div>
      {acoes && <div className="relative flex flex-wrap items-center gap-2 border-t border-[var(--borda)] bg-[var(--fundo)]/60 px-4 py-3 sm:px-5 [&_button]:min-h-11">{acoes}</div>}
    </header>
  )
}
