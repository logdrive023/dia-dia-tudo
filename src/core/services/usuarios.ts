// USUÁRIOS E LOGIN. Na demonstração a conferência da senha acontece no aparelho (hash PBKDF2 + sal, nunca a senha).
// Com a API, o mesmo fluxo vira POST /v1/auth/entrar e o servidor confere e devolve um token.

import { ErroNegocio, exigir } from '../domain/erros'
import { MENSAGEM_SENHA_FRACA, faltaNaSenha } from '../domain/senha'
import type { Id, Usuario } from '../domain/tipos'
import type { Sessao } from '../ports/portas'
import { auditar, type Ctx, exigirVersao, novo, tocar, versaoDoFormulario } from './contexto'

const ITERACOES = 20000

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashSenha(senha: string, sal: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(sal), iterations: ITERACOES, hash: 'SHA-256' }, chave, 256)
  return hex(bits)
}

function novoSal() {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return hex(b.buffer)
}

const limparLogin = (l: string) => l.trim().toLowerCase()

/** Hash já calculado FORA da transação (o IndexedDB fecha a transação se ela esperar a criptografia). */
export interface SenhaPreparada {
  sal: string
  senhaHash: string
}

/**
 * Prepara as senhas de um comando antes da transação e tira a senha em texto dos dados
 * (assim ela não vai para o log, nem para a fila de saída).
 */
export async function prepararSenhas(ctx: Ctx, nome: string, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (nome === 'salvarUsuario' && typeof dados.senha === 'string' && dados.senha) {
    const { senha, ...resto } = dados
    exigir(!faltaNaSenha(senha as string).length, MENSAGEM_SENHA_FRACA, 'senha')
    const sal = novoSal()
    return { ...resto, _senha: { sal, senhaHash: await hashSenha(senha as string, sal) } satisfies SenhaPreparada }
  }
  if (nome === 'trocarMinhaSenha') {
    const { atual, nova } = dados as { atual: string; nova: string }
    exigir(typeof nova === 'string' && !faltaNaSenha(nova).length, MENSAGEM_SENHA_FRACA, 'nova')
    const u = await ctx.repos.usuarios.obter(ctx.sessao.usuarioId)
    exigir(u, 'Entre de novo.')
    const sal = novoSal()
    return { _atualHash: await hashSenha(atual ?? '', u.sal), _senha: { sal, senhaHash: await hashSenha(nova, sal) } satisfies SenhaPreparada }
  }
  return dados
}

export async function salvarUsuario(
  ctx: Ctx,
  d: { id: Id; login: string; nome: string; perfil: 'admin' | 'funcionario'; pessoaId?: Id; localId?: Id; senha?: string; ativo?: boolean; _senha?: SenhaPreparada; versaoBase?: number },
) {
  if (d.senha && !d._senha) {
    // chamado direto (fora do backend): prepara aqui mesmo
    const sal = novoSal()
    d = { ...d, _senha: { sal, senhaHash: await hashSenha(d.senha, sal) } }
  }
  const login = limparLogin(d.login)
  exigir(/^[a-z0-9._-]{3,30}$/.test(login), 'Usuário: 3 a 30 letras minúsculas, números, ponto ou traço.', 'login')
  exigir(d.nome?.trim(), 'Diga o nome.', 'nome')
  const outro = (await ctx.repos.usuarios.listar({ login }))[0]
  exigir(!outro || outro.id === d.id, 'Esse usuário já existe.', 'login')
  const existente = await ctx.repos.usuarios.obter(d.id)
  exigir(existente || d._senha, 'Defina uma senha.', 'senha')
  // formulário aberto antes de outro administrador mudar (ex.: desativar): não grava o velho por cima
  exigirVersao(existente, versaoDoFormulario(d))
  const todos = await ctx.repos.usuarios.listar()
  const vaiFicarSemAdmin = existente?.perfil === 'admin' && (d.perfil !== 'admin' || d.ativo === false) && !todos.some((u) => u.id !== d.id && u.perfil === 'admin' && u.ativo)
  exigir(!vaiFicarSemAdmin, 'Precisa ficar pelo menos um administrador ativo.')
  const sal = d._senha?.sal ?? existente!.sal
  const senhaHash = d._senha?.senhaHash ?? existente!.senhaHash
  const dados = { login, nome: d.nome.trim(), perfil: d.perfil, pessoaId: d.pessoaId || undefined, localId: d.localId || undefined, sal, senhaHash, ativo: d.ativo ?? existente?.ativo ?? true }
  await ctx.repos.usuarios.salvar(existente ? tocar(ctx, { ...existente, ...dados }) : novo<Usuario>(ctx, { id: d.id, ...dados }))
  await auditar(ctx, existente ? 'alterarUsuario' : 'criarUsuario', d.id, `${login} · ${d.perfil}${d._senha && existente ? ' · senha trocada' : ''}`)
  return { id: d.id }
}

/** Confere login e senha e devolve a sessão (quem está usando). */
export async function entrar(ctx: Ctx, d: { login: string; senha: string; hashConferido?: string }): Promise<Sessao> {
  const u = (await ctx.repos.usuarios.listar({ login: limparLogin(d.login) }))[0]
  const ok = u && u.ativo && (d.hashConferido ?? (await hashSenha(d.senha, u.sal))) === u.senhaHash
  if (!ok) throw new ErroNegocio('Usuário ou senha não conferem.')
  await ctx.repos.usuarios.salvar({ ...u, ultimoAcesso: ctx.relogio.agora() })
  const sessao: Sessao = { empresaId: u.empresaId, usuarioId: u.id, nome: u.nome, login: u.login, perfil: u.perfil, pessoaId: u.pessoaId, localId: u.localId }
  await ctx.repos.auditoria.salvar(novo(ctx, { acao: 'entrar', alvoId: u.id, resumo: u.login, usuarioNome: u.nome, ...{ criadoPor: u.id } }))
  return sessao
}

export async function trocarMinhaSenha(ctx: Ctx, d: { atual?: string; nova?: string; _atualHash?: string; _senha?: SenhaPreparada }) {
  const u = await ctx.repos.usuarios.obter(ctx.sessao.usuarioId)
  exigir(u, 'Entre de novo.')
  exigir(d._atualHash && d._senha, 'Senha inválida.')
  exigir(d._atualHash === u.senhaHash, 'A senha atual não confere.', 'atual')
  await ctx.repos.usuarios.salvar(tocar(ctx, { ...u, sal: d._senha.sal, senhaHash: d._senha.senhaHash }))
  await auditar(ctx, 'trocarSenha', u.id, u.login)
  return { id: u.id }
}

/** Lista sem senha (nem hash). */
export async function usuarios(ctx: Ctx, _p: object = {}) {
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x.nome]))
  const locais = new Map((await ctx.repos.locais.listar()).map((x) => [x.id, x.nome]))
  return (await ctx.repos.usuarios.listar())
    .map(({ senhaHash: _h, sal: _s, ...u }) => ({ ...u, pessoa: u.pessoaId ? pessoas.get(u.pessoaId) : undefined, local: u.localId ? locais.get(u.localId) : undefined }))
    .sort((a, b) => (a.perfil === b.perfil ? a.nome.localeCompare(b.nome, 'pt-BR') : a.perfil === 'admin' ? -1 : 1))
}

/** Usuários de demonstração para a tela de entrar (só existe no modo demonstração). */
export async function usuariosDemo(ctx: Ctx, _p: object = {}) {
  return (await ctx.repos.usuarios.listar()).filter((u) => u.ativo).map((u) => ({ login: u.login, nome: u.nome, perfil: u.perfil }))
}
