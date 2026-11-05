// SENHA DE ACESSO DA DEMONSTRAÇÃO (o site fica aberto na internet): antes de entrar com qualquer usuário de teste
// (ou pelo formulário), pede uma senha só de acesso — vale até fechar o navegador.
// ⚠ É uma TRAVA SIMPLES, não segurança de verdade: o site é estático e a conferência roda no navegador. Por isso só
// o resumo (SHA-256) fica no código, nunca a senha em texto. Segurança de verdade = a API com login no servidor.

/** SHA-256 (hex) da senha de acesso — para trocar: node -e "console.log(require('crypto').createHash('sha256').update('NOVA').digest('hex'))" */
export const HASH_ACESSO = 'f126705cae4cc0432dad84506e586d6e83fde9afce3783e61c3a2519543e3b14'

const CHAVE = 'tudo:acesso-liberado'

export async function resumo(texto: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** confere a senha; certa → fica liberado nesta aba/sessão do navegador */
export async function liberarAcesso(senha: string) {
  const ok = (await resumo(senha)) === HASH_ACESSO
  if (ok) try { sessionStorage.setItem(CHAVE, '1') } catch { /* modo privado: pede de novo depois */ }
  return ok
}

export function acessoLiberado() {
  try { return sessionStorage.getItem(CHAVE) === '1' } catch { return false }
}
