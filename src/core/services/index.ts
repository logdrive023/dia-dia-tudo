// Catálogo de COMANDOS (mudam dados) e CONSULTAS (só leem). É o contrato que as telas usam e que a API
// vai expor: POST /v1/comandos/{nome} e GET /v1/consultas/{nome}. As telas nunca chamam o banco.

import * as caixa from './caixa'
import * as cadastros from './cadastros'
import * as comissoes from './comissoes'
import * as compras from './compras'
import * as contas from './contas'
import * as emprestimos from './emprestimos'
import * as equipe from './equipe'
import * as estoque from './estoque'
import * as historico from './historico'
import * as painel from './painel'
import * as precos from './precos'
import * as relatorios from './relatorios'
import * as resumo from './resumoMenu'
import * as usuarios from './usuarios'
import * as vendas from './vendas'

export const comandos = {
  // caixa
  lancarCaixa: caixa.lancarCaixa,
  estornarLancamento: caixa.estornarLancamento,
  encerrarDia: caixa.encerrarDia,
  reabrirDia: caixa.reabrirDia,
  // estoque e catálogo
  salvarItem: estoque.salvarItem,
  ajustarEstoque: estoque.ajustarEstoque,
  transformarLote: estoque.transformarLote,
  separarLote: estoque.separarLote,
  // tabelas de preço
  salvarTabelaPreco: precos.salvarTabelaPreco,
  // conta corrente
  registrarAcerto: contas.registrarAcerto,
  ajustarConta: contas.ajustarConta,
  // compras e triagem
  criarCompra: compras.criarCompra,
  avancarTriagem: compras.avancarTriagem,
  cancelarCompra: compras.cancelarCompra,
  // vendas e atendimentos
  concluirVenda: vendas.concluirVenda,
  atenderAgendamento: vendas.atenderAgendamento,
  cancelarVenda: vendas.cancelarVenda,
  corrigirVenda: vendas.corrigirVenda,
  pagarComissao: comissoes.pagarComissao,
  // usuários
  salvarUsuario: usuarios.salvarUsuario,
  trocarMinhaSenha: usuarios.trocarMinhaSenha,
  // empréstimos
  criarEmprestimo: emprestimos.criarEmprestimo,
  pagarEmprestimo: emprestimos.pagarEmprestimo,
  // cadastros
  salvarPessoa: cadastros.salvarPessoa,
  salvarLocal: cadastros.salvarLocal,
  salvarCotacao: cadastros.salvarCotacao,
  salvarConfig: cadastros.salvarConfig,
  salvarModulo: cadastros.salvarModulo,
  pagarSalario: equipe.pagarSalario,
  registrarAnexo: cadastros.registrarAnexo,
  removerAnexo: cadastros.removerAnexo,
}

export const consultas = {
  painel: painel.painel,
  resumoMenu: resumo.resumoMenu,
  diagnostico: painel.diagnostico,
  caixaDoDia: caixa.caixaDoDia,
  diasDoCaixa: caixa.diasDoCaixa,
  estoque: estoque.estoque,
  catalogo: estoque.catalogo,
  movimentosDoItem: estoque.movimentosDoItem,
  fichaItem: estoque.fichaItem,
  rastreio: estoque.rastreio,
  tabelasPreco: precos.tabelasPreco,
  tabelaVigente: precos.tabelaVigente,
  historicoTabela: precos.historicoTabela,
  calcularPreco: precos.calcularPreco,
  contas: contas.contas,
  contaPessoa: contas.contaPessoa,
  organograma: equipe.organograma,
  resumoFuncionario: equipe.resumoFuncionario,
  unidades: equipe.unidades,
  sugestaoSalario: equipe.sugestaoSalario,
  ultimoLancamento: equipe.ultimoLancamento,
  linhaDoTempo: historico.linhaDoTempo,
  logDetalhado: historico.logDetalhado,
  dre: relatorios.dre,
  livroCaixa: relatorios.livroCaixa,
  inventario: relatorios.inventario,
  balanco: relatorios.balanco,
  vendasDetalhadas: relatorios.vendasDetalhadas,
  comprasDetalhadas: relatorios.comprasDetalhadas,
  filaTriagem: compras.filaTriagem,
  compra: compras.compra,
  vendas: vendas.vendas,
  venda: vendas.venda,
  agenda: vendas.agenda,
  conflitosAgenda: vendas.conflitosAgenda,
  comissoes: comissoes.comissoes,
  usuarios: usuarios.usuarios,
  usuariosDemo: usuarios.usuariosDemo,
  emprestimos: emprestimos.emprestimos,
  emprestimo: emprestimos.emprestimo,
  pessoas: cadastros.pessoas,
  fichaPessoa: cadastros.fichaPessoa,
  locais: cadastros.locais,
  configuracoes: cadastros.configuracoes,
  anexosDe: cadastros.anexosDe,
}

export type Comandos = typeof comandos
export type Consultas = typeof consultas
export type NomeComando = keyof Comandos
export type NomeConsulta = keyof Consultas
export type DadosComando<N extends NomeComando> = Parameters<Comandos[N]>[1]
export type ResultadoComando<N extends NomeComando> = Awaited<ReturnType<Comandos[N]>>
export type ParamsConsulta<N extends NomeConsulta> = Parameters<Consultas[N]>[1]
export type ResultadoConsulta<N extends NomeConsulta> = Awaited<ReturnType<Consultas[N]>>
