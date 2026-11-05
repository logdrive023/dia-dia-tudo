// SIMULAR A API: atraso de cada consulta/comando enquanto os dados ficam no aparelho (ver o carregamento das telas como
// vai ser com o servidor). Fica só NESTE aparelho (localStorage), não vai para os dados nem para o backup.
// Quando a API entrar (VITE_STORAGE=api), o atraso é o de verdade e esta opção some de Configurações › Dados.

const CHAVE = 'tudo:simular-api-ms'
export const OPCOES_ATRASO = [0, 300, 500, 800, 2000] as const
/** PADRÃO (sem escolha no aparelho): meio segundo — as telas mostram o carregamento como vai ser com o servidor */
export const ATRASO_PADRAO = 500

export function lerAtraso(): number {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === null ? ATRASO_PADRAO : Math.max(0, Number(v) || 0)
  } catch {
    return ATRASO_PADRAO
  }
}

/** guarda a escolha (0 = desligado fica guardado: desligar não volta para o padrão) */
export function salvarAtraso(ms: number) {
  try { localStorage.setItem(CHAVE, String(Math.max(0, ms))) } catch { /* modo privado */ }
}
