// IDIOMA: o texto em português é a chave; o espanhol fica no dicionário (es.ts). Falta tradução → mostra em português.
// Trocar de idioma: Configurações › Idioma (fica salvo). Novo idioma = novo dicionário.

import { createContext, useContext } from 'react'
import { ES } from './es'

export type Idioma = 'pt' | 'es'

const DICIONARIOS: Record<Idioma, Record<string, string>> = { pt: {}, es: ES }

export function traduzir(idioma: Idioma, texto: string, vars?: Record<string, string | number>): string {
  let t = DICIONARIOS[idioma][texto] ?? texto
  if (vars) for (const [k, v] of Object.entries(vars)) t = t.replaceAll(`{${k}}`, String(v))
  return t
}

export const IdiomaContexto = createContext<Idioma>('pt')

/** const t = useT(); t('Vender') */
export function useT() {
  const idioma = useContext(IdiomaContexto)
  return (texto: string, vars?: Record<string, string | number>) => traduzir(idioma, texto, vars)
}

export function localeDe(idioma: Idioma) {
  return idioma === 'es' ? 'es-BO' : 'pt-BR'
}
