// LEITOR "PISTOLA" (teclado): o leitor de código de barras digita o código no campo que está com o foco e aperta
// Enter. Em qualquer busca de pacote, Enter com um código EXATO (o atual ou um antigo, ou o endereço do QR …#/lotes/<id>)
// chama `onAchou` com o pacote: o Estoque/Triagem abrem o pacote, a Venda adiciona. Sem código exato, a busca segue
// filtrando a lista normalmente (nada muda para quem digita).

import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { Id } from '../core/domain/tipos'
import { lerEnderecoQr } from './etiquetas'

export interface PacoteComCodigo {
  id: Id
  codigo?: string
  codigosAnteriores?: string[]
  nome?: string
  /** o código aleatório do QR da etiqueta */
  qr?: string
}

const norm = (s?: string) => (s ?? '').trim().toUpperCase()

/** Pacote cujo código (atual ou antigo) é exatamente o texto; também aceita o endereço do QR e o id. */
export function acharPorCodigo<P extends PacoteComCodigo>(pacotes: readonly P[] | undefined, texto: string): P | undefined {
  const lista = pacotes ?? []
  const doQR = lerEnderecoQr(texto)
  if (doQR?.qr) return lista.find((p) => p.qr === doQR.qr)
  if (doQR?.id) return lista.find((p) => p.id === doQR.id)
  const c = norm(texto)
  if (!c) return undefined
  return lista.find((p) => norm(p.codigo) === c) ?? lista.find((p) => p.codigosAnteriores?.some((x) => norm(x) === c)) ?? lista.find((p) => norm(p.id) === c)
}

/** Busca digitada: código atual, código antigo ou rótulo (nome) contendo o texto; o código exato vem primeiro. */
export function buscarPacotes<P extends PacoteComCodigo>(pacotes: readonly P[] | undefined, texto: string, max = 8): P[] {
  const b = texto.trim().toLowerCase()
  if (!b) return []
  const exato = acharPorCodigo(pacotes, texto)
  const resto = (pacotes ?? []).filter((p) => p !== exato && [p.codigo, p.nome, ...(p.codigosAnteriores ?? [])].some((x) => x?.toLowerCase().includes(b)))
  return [...(exato ? [exato] : []), ...resto].slice(0, max)
}

/**
 * Liga o leitor pistola a um campo de busca: devolve o `onKeyDown` do input. Enter com código exato → onAchou(pacote)
 * (e o campo é limpo pelo chamador, se quiser). `rapido` diz se veio do leitor (teclas a menos de 50 ms em média).
 */
export function usePistola<P extends PacoteComCodigo>(pacotes: readonly P[] | undefined, onAchou: (p: P, info: { rapido: boolean }) => void, onNaoAchou?: (texto: string) => void) {
  const tempos = useRef<number[]>([])
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const agora = Date.now()
    if (e.key !== 'Enter') {
      if (e.key.length === 1) tempos.current = [...tempos.current.slice(-30), agora]
      return
    }
    const ts = tempos.current
    tempos.current = []
    const rapido = ts.length >= 3 && (ts[ts.length - 1] - ts[0]) / (ts.length - 1) < 50
    const texto = e.currentTarget.value
    const p = acharPorCodigo(pacotes, texto)
    if (p) {
      e.preventDefault()
      onAchou(p, { rapido })
    } else if (texto.trim()) onNaoAchou?.(texto)
  }
  return { onKeyDown }
}
