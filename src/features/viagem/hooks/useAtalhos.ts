// ATALHOS DE TECLADO de uma tela (para quem usa no computador o dia todo). Ignorados enquanto a pessoa digita num campo
// e com Ctrl/⌘ (não briga com o navegador). Teclas: '/' · 'n' · 'alt+n' (Alt pela tecla física: funciona no Mac também).
// Ex.: useAtalhos({ '/': focarBusca, 'alt+n': () => ir('novaViagem') })
import { useEffect, useRef } from 'react'

export function useAtalhos(mapa: Record<string, () => void>, ligado = true) {
  const atual = useRef(mapa)
  atual.current = mapa
  useEffect(() => {
    if (!ligado) return
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.defaultPrevented) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      // com janela aberta, os atalhos da tela ficam quietos
      if (document.querySelector('[role="dialog"]')) return
      const tecla = e.altKey ? `alt+${e.code.replace(/^Key/, '').toLowerCase()}` : e.key.toLowerCase()
      const fn = atual.current[tecla]
      if (!fn) return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [ligado])
}

/** foca a busca da tela (o campo de busca padrão visível) */
export function focarBusca() {
  const el = [...document.querySelectorAll<HTMLInputElement>('input[type="search"]')].find((x) => x.offsetParent !== null)
  el?.focus()
  el?.select()
}
