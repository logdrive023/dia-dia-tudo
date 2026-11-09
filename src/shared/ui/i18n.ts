// IDIOMA: o texto em português é a chave; o espanhol fica no dicionário (es.ts). Falta tradução → mostra em português.
// Trocar de idioma: Configurações › Idioma (fica salvo). Novo idioma = novo dicionário.

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'

export type Idioma = 'pt' | 'es'

// O ESPANHOL É BAIXADO SÓ QUANDO ALGUÉM PRECISA (é o maior arquivo do sistema). Enquanto não chega, o texto sai em
// português; quem desenha a tela espera com useDicionario.
const DICIONARIOS: Record<Idioma, Record<string, string>> = { pt: {}, es: {} }
let esPronto = false
let promessa: Promise<void> | undefined
const ouvintes = new Set<() => void>()

export function carregarIdioma(idioma: Idioma): Promise<void> {
  if (idioma === 'pt' || esPronto) return Promise.resolve()
  promessa ??= import('./es').then(
    (m) => { DICIONARIOS.es = m.ES },
    () => { /* sem o arquivo: segue em português, sem travar a tela */ },
  ).then(() => {
    esPronto = true
    ouvintes.forEach((f) => f())
  })
  return promessa
}

export const idiomaCarregado = (idioma: Idioma) => idioma === 'pt' || esPronto

/** pede o dicionário e redesenha quando ele chegar; true = já dá para desenhar neste idioma */
export function useDicionario(idioma: Idioma) {
  useEffect(() => { void carregarIdioma(idioma) }, [idioma])
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }, () => idiomaCarregado(idioma))
}

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
