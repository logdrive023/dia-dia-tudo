// A LISTA DE COMPRAS do comprador: fica neste aparelho (voltou depois, a lista está lá) e pacote que saiu da vitrine
// some sozinho. A prévia do gerador não grava nada.
import { useEffect, useMemo, useState } from 'react'

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
  return {
    ids,
    cheia,
    tem: (id: string) => ids.includes(id),
    alternar: (id: string) => setEscolhidos(ids.includes(id) ? ids.filter((x) => x !== id) : cheia ? ids : [...ids, id]),
    tirar: (id: string) => setEscolhidos(ids.filter((x) => x !== id)),
    limpar: () => setEscolhidos([]),
  }
}
