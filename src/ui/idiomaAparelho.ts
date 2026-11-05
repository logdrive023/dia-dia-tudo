// IDIOMA DE QUEM NÃO É ADMIN: a funcionária escolhe o idioma da tela dela (fica neste aparelho) sem mudar o do sistema.
// O admin muda o idioma do sistema (Configurações); a escolha do aparelho, se houver, vale por cima só neste aparelho.
import { useEffect, useState } from 'react'

const CHAVE = 'tudo.idioma'
const EVENTO = 'tudo:idioma'

export function lerIdiomaAparelho(): 'pt' | 'es' | undefined {
  try { const v = localStorage.getItem(CHAVE); return v === 'pt' || v === 'es' ? v : undefined } catch { return undefined }
}

export function salvarIdiomaAparelho(v: 'pt' | 'es' | undefined) {
  try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE) } catch { /* modo privado */ }
  window.dispatchEvent(new Event(EVENTO))
}

export function useIdiomaAparelho() {
  const [v, setV] = useState(lerIdiomaAparelho)
  useEffect(() => {
    const ouvir = () => setV(lerIdiomaAparelho())
    window.addEventListener(EVENTO, ouvir)
    return () => window.removeEventListener(EVENTO, ouvir)
  }, [])
  return v
}
