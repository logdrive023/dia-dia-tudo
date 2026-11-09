// A LISTA DE COMPRAS do comprador: fica neste aparelho (voltou depois, a lista está lá) e pacote que saiu da vitrine
// some sozinho. A prévia do gerador não grava nada.
import { useCallback, useEffect, useMemo, useState } from 'react'

const CHAVE = 'tudo.vitrine.lista'
/** o link do WhatsApp tem tamanho limitado: a lista cabe numa mensagem só */
export const MAX_LISTA = 30

function ler(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** disponiveis: os ids que estão na vitrine agora (undefined = ainda carregando) */
export function useListaCompras(disponiveis: string[] | undefined, gravar: boolean) {
  const [escolhidos, setEscolhidos] = useState<string[]>(() => (gravar ? ler() : []))
  const ids = useMemo(() => (disponiveis ? escolhidos.filter((id) => disponiveis.includes(id)) : []), [disponiveis, escolhidos])
  useEffect(() => {
    if (!gravar || !disponiveis) return
    try {
      localStorage.setItem(CHAVE, JSON.stringify(ids))
    } catch {
      /* sem armazenamento: a lista vale até fechar a página */
    }
  }, [gravar, disponiveis, ids])
  const cheia = ids.length >= MAX_LISTA
  // estável: o cartão do pacote fica em memo
  const alternar = useCallback((id: string) => setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= MAX_LISTA ? l : [...l, id])), [])
  return {
    ids,
    cheia,
    tem: (id: string) => ids.includes(id),
    alternar,
    tirar: (id: string) => setEscolhidos(ids.filter((x) => x !== id)),
    limpar: () => setEscolhidos([]),
  }
}
