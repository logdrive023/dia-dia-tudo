// FUNÇÃO ESTÁVEL COM O ESTADO DE AGORA: a identidade não muda entre renders, então uma linha em `memo` não redesenha só
// porque o pai criou a função de novo. Serve para responder a toques e cliques; não chame durante o render.
import { useCallback, useLayoutEffect, useRef } from 'react'

export function useEvento<A extends unknown[], R>(f: (...a: A) => R) {
  const atual = useRef(f)
  useLayoutEffect(() => {
    atual.current = f
  })
  return useCallback((...a: A) => atual.current(...a), [])
}
