// PERMISSÕES por perfil. Administrador: tudo. Funcionária: vender/atender, agenda, clientes e o que é dela.
// O backend no aparelho confere aqui antes de executar; com a API, o servidor usa a mesma lista.

import type { NomeComando, NomeConsulta } from '.'

export const COMANDOS_FUNCIONARIO = new Set<NomeComando>([
  'concluirVenda',
  'atenderAgendamento',
  'cancelarVenda',
  'salvarPessoa',
  'registrarAnexo',
  'trocarMinhaSenha',
  'registrarBuscaCambio',
  'salvarCotacao',
])

export const CONSULTAS_FUNCIONARIO = new Set<NomeConsulta>([
  'configuracoes',
  'pessoas',
  'fichaPessoa',
  'locais',
  'catalogo',
  'estoque',
  'tabelasPreco',
  'tabelaVigente',
  'calcularPreco',
  'agenda',
  'conflitosAgenda',
  'venda',
  'organograma',
  'resumoFuncionario',
  'unidades',
  'anexosDe',
  'linhaDoTempo',
  'comissoes',
  'usuariosDemo',
  'resumoMenu',
  'cambio',
])

/** Comandos que funcionam antes de alguém entrar. */
export const SEM_LOGIN = new Set<string>(['usuariosDemo', 'configuracoes'])

export function podeComando(perfil: string | undefined, nome: NomeComando) {
  return perfil === 'admin' || (perfil === 'funcionario' && COMANDOS_FUNCIONARIO.has(nome))
}

export function podeConsulta(perfil: string | undefined, nome: NomeConsulta) {
  return perfil === 'admin' || SEM_LOGIN.has(nome) || (perfil === 'funcionario' && CONSULTAS_FUNCIONARIO.has(nome))
}
