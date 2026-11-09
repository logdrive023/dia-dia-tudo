// LISTA GRANDE NO CELULAR: desenha só as linhas perto da tela; o resto vira espaço em branco do mesmo tamanho. A altura de
// cada linha é medida de verdade, então linha que abre no lugar continua funcionando. A rolagem é a da própria página.
// Abaixo do limite não muda nada: a lista inteira é desenhada normalmente.
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export const LIMITE_VIRTUAL = 40

export function useListaVirtual(total: number, { estimativa, ativo = true, chave, gap }: { estimativa: number; ativo?: boolean; chave?(i: number): string; gap?: number }) {
  const usar = ativo && total >= LIMITE_VIRTUAL
  const el = useRef<HTMLElement | null>(null)
  const [margem, setMargem] = useState(0)
  // onde a lista começa na página (o que está acima dela pode mudar de altura)
  useLayoutEffect(() => {
    if (usar && el.current) setMargem(Math.round(el.current.getBoundingClientRect().top + window.scrollY))
  })
  const v = useWindowVirtualizer({ count: usar ? total : 0, estimateSize: () => estimativa, overscan: 8, scrollMargin: margem, gap, getItemKey: chave })
  const itens = usar ? v.getVirtualItems() : []
  const antes = usar && itens.length ? Math.max(0, itens[0].start - margem) : 0
  const depois = usar && itens.length ? Math.max(0, v.getTotalSize() - (itens[itens.length - 1].end - margem)) : 0
  return {
    usar,
    antes,
    depois,
    ref: useCallback((e: HTMLElement | null) => { el.current = e }, []),
    medir: usar ? v.measureElement : undefined,
    estilo: usar ? { paddingTop: antes, paddingBottom: depois } : undefined,
    /** as linhas a desenhar agora, cada uma com a posição dela na lista completa */
    fatia: <T,>(lista: T[]): { item: T; indice: number }[] => (usar ? itens.flatMap((x) => (x.index < lista.length ? [{ item: lista[x.index], indice: x.index }] : [])) : lista.map((item, indice) => ({ item, indice }))),
  }
}
