// O BACKEND (criado uma vez) e QUEM ESTÁ USANDO: a sessão é o MESMO objeto que as regras usam; trocar a sessão
// atualiza esse objeto, a tela e o que fica salvo neste aparelho (para não pedir login a cada abertura).
import { useCallback, useMemo, useState } from 'react'
import type { Sessao } from '../core/ports/portas'
import { criarBackend } from './criarBackend'

const CHAVE = 'tudo.sessao'

function lerSessao(padrao: Sessao): Sessao {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Sessao | null
    return s?.usuarioId ? { ...padrao, ...s } : padrao
  } catch {
    return padrao
  }
}

export function useSessao() {
  const inicial = useMemo(() => {
    const c = criarBackend()
    // ninguém entrou ainda, a não ser que a sessão tenha ficado salva neste aparelho
    Object.assign(c.sessao, lerSessao({ ...c.sessao, usuarioId: '', nome: '' }))
    return c
  }, [])
  const [sessao, setSessao] = useState<Sessao>({ ...inicial.sessao })
  const trocarSessao = useCallback(
    (s: Sessao) => {
      Object.assign(inicial.sessao, s)
      setSessao({ ...s })
      try {
        localStorage.setItem(CHAVE, JSON.stringify(s))
      } catch {
        /* ignora */
      }
    },
    [inicial],
  )
  return { backend: inicial.backend, sessao, trocarSessao }
}
