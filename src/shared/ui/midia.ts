// MEDIA QUERY como estado do React (a única implementação do sistema): `useMidia('(min-width: 768px)', true)` devolve se
// a tela bate com a consulta agora e acompanha quando muda (girar o celular, redimensionar a janela).
// `padrao`: o valor quando o ambiente não tem matchMedia (testes, navegador antigo).
import { useEffect, useState } from 'react'

export function useMidia(q: string, padrao: boolean) {
  const ler = () => {
    try {
      return window.matchMedia ? window.matchMedia(q).matches : padrao
    } catch {
      return padrao
    }
  }
  const [v, setV] = useState(ler)
  useEffect(() => {
    try {
      const m = window.matchMedia(q)
      const f = () => setV(m.matches)
      m.addEventListener('change', f)
      return () => m.removeEventListener('change', f)
    } catch {
      return undefined
    }
  }, [q])
  return v
}
