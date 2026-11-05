// REGRA DA SENHA: uma só, usada na tela (lista que vai ficando verde enquanto digita) e no serviço (recusa a senha fraca).
// Vale para senha NOVA (criar usuário, trocar senha). Quem já tinha senha antiga continua entrando com ela.

export const SENHA_MINIMO = 8

export interface RegraSenha {
  id: 'tamanho' | 'letra' | 'numeroOuEspecial'
  texto: string
  ok(s: string): boolean
}

export const REGRAS_SENHA: RegraSenha[] = [
  { id: 'tamanho', texto: `Pelo menos ${SENHA_MINIMO} caracteres`, ok: (s) => [...s].length >= SENHA_MINIMO },
  { id: 'letra', texto: 'Uma letra', ok: (s) => /\p{L}/u.test(s) },
  { id: 'numeroOuEspecial', texto: 'Um número ou caractere especial (ex.: 7, !, @, #)', ok: (s) => /[\p{N}\p{P}\p{S}]/u.test(s) },
]

/** as regras que a senha ainda não cumpre (vazio = senha boa) */
export const faltaNaSenha = (s: string) => REGRAS_SENHA.filter((r) => !r.ok(s))

/** mensagem única do serviço quando a senha não serve */
export const MENSAGEM_SENHA_FRACA = `Senha fraca: use pelo menos ${SENHA_MINIMO} caracteres, com uma letra e um número ou caractere especial.`

/** senha forte aleatória (o admin gera e passa para a pessoa): sem letras que confundem (l, I, O, 0), sempre com número */
export function gerarSenha(tamanho = 10): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
  const numeros = '23456789'
  const sorte = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n
  const todos = letras + numeros
  const c = Array.from({ length: tamanho }, (_, i) => (i === 0 ? letras : i === 1 ? numeros : todos)).map((a) => a[sorte(a.length)])
  for (let i = c.length - 1; i > 0; i--) { const j = sorte(i + 1); [c[i], c[j]] = [c[j], c[i]] }
  return c.join('')
}
