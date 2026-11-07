// O AVISO RÁPIDO ("Venda salva.", "Sem permissão…"): some sozinho (ok 2,5 s · erro 6 s) ou no toque.
// Fica no ALTO (abaixo da faixa da demonstração): nunca cobre os botões das barras fixas nem das folhas de baixo.
import { useCallback, useEffect, useState } from 'react'
import { useT } from '../shared/ui/i18n'

export type TipoAviso = 'ok' | 'erro'

export function useAviso() {
  const [aviso, setAviso] = useState<{ texto: string; tipo: TipoAviso }>()
  const avisar = useCallback((texto: string, tipo: TipoAviso = 'ok') => setAviso({ texto, tipo }), [])
  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(undefined), aviso.tipo === 'erro' ? 6000 : 2500)
    return () => clearTimeout(id)
  }, [aviso])
  return { aviso, avisar, fechar: () => setAviso(undefined) }
}

export function Aviso({ texto, tipo, onFechar }: { texto: string; tipo: TipoAviso; onFechar(): void }) {
  const t = useT()
  return (
    <div role="status" className={`nao-imprimir fixed inset-x-4 top-[calc(env(safe-area-inset-top)+2.25rem)] z-50 mx-auto max-w-md rounded-2xl px-3 py-2 text-center text-sm font-semibold text-white shadow-lg ${tipo === 'erro' ? 'bg-[var(--ruim)]' : 'bg-[var(--bom)]'}`} onClick={onFechar}>
      {t(texto)}
    </div>
  )
}
