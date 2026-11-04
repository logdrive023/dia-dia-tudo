// CABEÇALHO DE FICHA (a página de UMA coisa: pacote, pedido, viagem): o mesmo desenho em todas, de cima para baixo
//   [foto/ícone]  Título (o nome da coisa)                                  [valor em destaque]
//                 CÓDIGO ⧉ · situação · selos                                [detalhe do valor]
//                 detalhes em cinza: data · quem · onde
//   ações: o botão principal + 1 ou 2 secundários + "Mais ⋯"
// A tela só diz o que vai em cada lugar; o tamanho, a ordem e o espaçamento são sempre estes.

import type { ReactNode } from 'react'
import { cx } from './base'
import { CodigoSelo } from './codigos'
import { useT } from './i18n'

export function CabecalhoFicha({ midia, titulo, codigo, anteriores, selos, detalhes, valor, valorDetalhe, acoes, className }: {
  /** foto ou ícone à esquerda (opcional) */
  midia?: ReactNode
  titulo: ReactNode
  /** o código da coisa (copiar com um toque) e os códigos antigos */
  codigo?: string
  anteriores?: string[]
  /** situação e selos, na linha do código */
  selos?: ReactNode
  /** pedaços da linha cinza ("04/10/2026", "comprou: Ana"); vazios somem e o resto fica separado por " · " */
  detalhes?: ReactNode[]
  /** número em destaque à direita (no celular vai para baixo do título) */
  valor?: ReactNode
  valorDetalhe?: ReactNode
  /** a linha de ações */
  acoes?: ReactNode
  className?: string
}) {
  const t = useT()
  const partes = (detalhes ?? []).filter((x) => x !== undefined && x !== null && x !== false && x !== '')
  return (
    <header className={cx('space-y-3', className)}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          {midia && <div className="shrink-0">{midia}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-2xl">{titulo}</h1>
            {(codigo || selos) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {codigo && <CodigoSelo codigo={codigo} anteriores={anteriores} />}
                {selos}
              </div>
            )}
            {(partes.length > 0 || !!anteriores?.length) && (
              <p className="mt-1 text-sm text-[var(--suave)]">
                {partes.map((x, k) => <span key={k}>{k > 0 && ' · '}{x}</span>)}
                {!!anteriores?.length && <span className="text-xs">{partes.length > 0 && ' · '}{t('antes')}: <span className="font-mono">{anteriores.join(', ')}</span></span>}
              </p>
            )}
          </div>
        </div>
        {valor !== undefined && (
          <div className="shrink-0 sm:text-right">
            <div className="num text-2xl font-black sm:text-3xl">{valor}</div>
            {valorDetalhe && <div className="num text-sm text-[var(--suave)]">{valorDetalhe}</div>}
          </div>
        )}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </header>
  )
}
