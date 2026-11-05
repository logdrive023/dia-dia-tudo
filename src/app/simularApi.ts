// SIMULAR A API: atraso de cada consulta/comando enquanto os dados ficam no aparelho (ver o carregamento das telas como
// vai ser com o servidor). Fica só NESTE aparelho (localStorage), não vai para os dados nem para o backup.
// Quando a API entrar (VITE_STORAGE=api), o atraso é o de verdade e esta opção some de Configurações › Dados.

const CHAVE = 'tudo:simular-api-ms'
export const OPCOES_ATRASO = [0, 300, 800, 2000] as const

export function lerAtraso(): number {
  try { return Math.max(0, Number(localStorage.getItem(CHAVE)) || 0) } catch { return 0 }
}

export function salvarAtraso(ms: number) {
  try { if (ms > 0) localStorage.setItem(CHAVE, String(ms)); else localStorage.removeItem(CHAVE) } catch { /* modo privado */ }
}
