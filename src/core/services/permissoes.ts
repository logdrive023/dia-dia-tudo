// PERMISSÕES por perfil. Administrador: tudo. Funcionária: vender/atender, agenda, clientes e o que é dela.
// O backend no aparelho confere aqui antes de executar; com a API, o servidor usa a mesma lista.
// Viagens: quem viajou lança e anula os PRÓPRIOS gastos e vê o painel do viajante e a lista das viagens dela (o serviço
// confere que a viagem é dela); criar, adiantar, ligar compras, encerrar, incorporar e o resultado: só administrador.
// Adiantamentos a parceiros: criar, registrar entrega, receber, abater, pagar diferença e encerrar só administrador;
// a funcionária só CONSULTA os adiantamentos dela (o serviço filtra pela pessoa da sessão).
// Códigos (salvarCodigos, salvarSigla, trocarCodigo*, codigos, codigoDisponivel): só administrador (fora das listas).

import type { NomeComando, NomeConsulta } from '.'

export const COMANDOS_FUNCIONARIO = new Set<NomeComando>([
  'concluirVenda',
  'atenderAgendamento',
  'criarServicoRapido',
  'cancelarVenda',
  'salvarPessoa',
  'registrarAnexo',
  'definirMiniatura',
  'trocarMinhaSenha',
  'registrarBuscaCambio',
  'salvarCotacao',
  'registrarDespesaViagem',
  'anularDespesaViagem',
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
  'fotosDoLote',
  'etiquetas',
  'linhaDoTempo',
  'comissoes',
  'usuariosDemo',
  'resumoMenu',
  'cambio',
  'painelViajante',
  'viagens',
  'categoriasViagem',
  'financiamentos',
  'financiamento',
])

/** Comandos que funcionam antes de alguém entrar. */
export const SEM_LOGIN = new Set<string>(['usuariosDemo', 'configuracoes'])

export function podeComando(perfil: string | undefined, nome: NomeComando) {
  return perfil === 'admin' || (perfil === 'funcionario' && COMANDOS_FUNCIONARIO.has(nome))
}

export function podeConsulta(perfil: string | undefined, nome: NomeConsulta) {
  return perfil === 'admin' || SEM_LOGIN.has(nome) || (perfil === 'funcionario' && CONSULTAS_FUNCIONARIO.has(nome))
}
