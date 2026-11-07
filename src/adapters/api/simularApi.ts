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

// SIMULAR FALHA (teste do estado de erro e do "Tentar de novo"): em X% das consultas a resposta não vem, como sem
// internet. Desligado no padrão; só neste aparelho; só CONSULTAS (nenhum comando falha de mentira: nada fica pela metade).
const CHAVE_FALHA = 'tudo:simular-api-falha'
export const OPCOES_FALHA = [0, 10, 30, 100] as const
export const ERRO_SIMULADO = 'Sem conexão com o servidor (falha simulada em Configurações › Dados).'

export function lerFalha(): number {
  try {
    return Math.min(100, Math.max(0, Number(localStorage.getItem(CHAVE_FALHA)) || 0))
  } catch {
    return 0
  }
}

export function salvarFalha(pct: number) {
  try { localStorage.setItem(CHAVE_FALHA, String(Math.min(100, Math.max(0, pct)))) } catch { /* modo privado */ }
}
