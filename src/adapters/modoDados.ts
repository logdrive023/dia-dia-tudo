// ONDE FICAM OS DADOS — a chave de TESTE entre "neste aparelho" (IndexedDB, a demonstração) e "servidor" (a API Go,
// pelo canal cifrado). Fica só neste aparelho (localStorage) e vale ao recarregar a página.
//
// SEGURANÇA: só existe em DESENVOLVIMENTO (npm run dev) ou com VITE_PERMITIR_TROCAR_DADOS=1 no build. No site
// publicado a origem dos dados é a do build (VITE_STORAGE / VITE_API_URL) e ninguém consegue apontar o app para
// outro endereço (login e dados iriam para lá).
//
// Ordem de quem vale: criarBackend({ tipo }) (testes) › esta chave › VITE_STORAGE do build › "local".

export type ModoDados = { tipo: 'local' } | { tipo: 'api'; url: string }

const CHAVE = 'tudo:modo-dados'
/** o endereço do servidor Go rodando nesta máquina (../dia-dia-tudo-backend › scripts/rodar) */
export const URL_SERVIDOR_LOCAL = 'http://127.0.0.1:8080'

export function podeTrocarDados(): boolean {
  return !!import.meta.env.DEV || import.meta.env.VITE_PERMITIR_TROCAR_DADOS === '1'
}

/** a escolha deste aparelho (ou undefined = segue o build) */
export function lerModoDados(): ModoDados | undefined {
  if (!podeTrocarDados()) return undefined
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as ModoDados | null
    if (v?.tipo === 'local') return v
    if (v?.tipo === 'api' && /^https?:\/\/[^\s/]+/.test(v.url)) return { tipo: 'api', url: v.url.replace(/\/+$/, '') }
  } catch {
    /* sem armazenamento: segue o build */
  }
  return undefined
}

/**
 * Troca e RECARREGA (o backend é criado uma vez, na abertura). A sessão salva é esquecida: a do aparelho não vale
 * no servidor (lá o login gera um token) e vice-versa.
 */
export function trocarModoDados(m: ModoDados) {
  if (!podeTrocarDados()) return
  try {
    localStorage.setItem(CHAVE, JSON.stringify(m))
    localStorage.removeItem('tudo.sessao')
  } catch {
    /* modo privado: não troca */
  }
  window.location.reload()
}
