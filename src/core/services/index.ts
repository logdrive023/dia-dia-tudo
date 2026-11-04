// Catálogo de COMANDOS (mudam dados) e CONSULTAS (só leem). É o contrato que as telas usam e que a API
// vai expor: POST /v1/comandos/{nome} e GET /v1/consultas/{nome}. As telas nunca chamam o banco.

import * as agenda from './agenda'
import * as caixa from './caixa'
import * as cadastros from './cadastros'
import * as codigos from './codigos'
import * as comissoes from './comissoes'
import * as compras from './compras'
import * as contas from './contas'
import * as emprestimos from './emprestimos'
import * as equipe from './equipe'
import * as estoque from './estoque'
import * as financiamentos from './financiamentos'
import * as formCompra from './formCompra'
import * as fotos from './fotos'
import * as historico from './historico'
import * as leitura from './leitura'
import * as livro from './livro'
import * as origem from './origem'
import * as painel from './painel'
import * as precos from './precos'
import * as relatorios from './relatorios'
import * as triagem from './triagem'
import * as resumo from './resumoMenu'
import * as servicosSalao from './servicosSalao'
import * as usuarios from './usuarios'
import * as vendas from './vendas'
import * as viagens from './viagens'
import * as vendasAbertas from './vendasAbertas'
import * as viagemCurta from './viagemCurta'
import * as cidades from './cidades'

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
  marcarLotes: estoque.marcarLotes,
  editarAtributosLote: estoque.editarAtributosLote,
  marcarEtiquetasImpressas: estoque.marcarEtiquetasImpressas,
  refazerEtiqueta: estoque.refazerEtiqueta,
  reservarLote: estoque.reservarLote,
  // códigos de compra e lote (Configurações › Códigos; trocar depois fica no log)
  salvarCodigos: codigos.salvarCodigos,
  salvarSigla: codigos.salvarSigla,
  trocarCodigoCompra: codigos.trocarCodigoCompra,
  trocarCodigoLote: codigos.trocarCodigoLote,
  // triagem (compra → unificar → preparar → separar → venda)
  unificarLotes: triagem.unificarLotes,
  moverFaseTriagem: triagem.moverFaseTriagem,
  salvarFluxoTriagem: triagem.salvarFluxoTriagem,
  triarLotes: triagem.triarLotes,
  desfazerTriagem: triagem.desfazerTriagem,
  // tabelas de preço
  salvarTabelaPreco: precos.salvarTabelaPreco,
  // conta corrente
  registrarAcerto: contas.registrarAcerto,
  ajustarConta: contas.ajustarConta,
  // compras e triagem
  criarCompra: compras.criarCompra,
  avancarTriagem: compras.avancarTriagem,
  salvarVendaAberta: vendasAbertas.salvarVendaAberta,
  descartarVendaAberta: vendasAbertas.descartarVendaAberta,
  tirarDaVendaAberta: vendasAbertas.tirarDaVendaAberta,
  salvarCidade: cidades.salvarCidade,
  pagarCompra: compras.pagarCompra,
  cancelarCompra: compras.cancelarCompra,
  conferirPesoCompra: compras.conferirPesoCompra,
  definirValorCompra: compras.definirValorCompra,
  salvarFormCompra: formCompra.salvarFormCompra,
  // vendas e atendimentos
  concluirVenda: vendas.concluirVenda,
  atenderAgendamento: vendas.atenderAgendamento,
  cancelarVenda: vendas.cancelarVenda,
  corrigirVenda: vendas.corrigirVenda,
  pagarComissao: comissoes.pagarComissao,
  // agenda: compromissos/lembretes e "Pago" depois do atendimento
  salvarEvento: agenda.salvarEvento,
  excluirEvento: agenda.excluirEvento,
  concluirEvento: agenda.concluirEvento,
  receberAtendimento: agenda.receberAtendimento,
  // salão: serviço novo na hora do atendimento e biblioteca padrão
  criarServicoRapido: servicosSalao.criarServicoRapido,
  revisarServico: servicosSalao.revisarServico,
  restaurarBibliotecaServicos: servicosSalao.restaurarBibliotecaServicos,
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
  salvarCambio: cadastros.salvarCambio,
  registrarBuscaCambio: cadastros.registrarBuscaCambio,
  salvarConfig: cadastros.salvarConfig,
  salvarModulo: cadastros.salvarModulo,
  salvarFluxoCompra: cadastros.salvarFluxoCompra,
  salvarAtributos: cadastros.salvarAtributos,
  pagarSalario: equipe.pagarSalario,
  registrarAnexo: cadastros.registrarAnexo,
  removerAnexo: cadastros.removerAnexo,
  // fotos do lote: miniatura para as listas
  definirMiniatura: fotos.definirMiniatura,
  // viagens de compra (gastos, carteira, compras ligadas, prestação de contas, custo dos lotes)
  salvarViagem: viagens.salvarViagem,
  adiantarViagem: viagens.adiantarViagem,
  registrarDespesaViagem: viagens.registrarDespesaViagem,
  anularDespesaViagem: viagens.anularDespesaViagem,
  vincularCompras: viagens.vincularCompras,
  desvincularCompra: viagens.desvincularCompra,
  encerrarViagem: viagens.encerrarViagem,
  incorporarCustoViagem: viagens.incorporarCustoViagem,
  reabrirViagem: viagens.reabrirViagem,
  salvarCategoriasViagem: viagens.salvarCategoriasViagem,
  // adiantamentos a parceiros (dinheiro para comprar cabelo; a dívida é paga com o cabelo entregue)
  criarFinanciamento: financiamentos.criarFinanciamento,
  registrarEntregaFinanciamento: financiamentos.registrarEntregaFinanciamento,
  receberFinanciamento: financiamentos.receberFinanciamento,
  pagarDiferencaFinanciamento: financiamentos.pagarDiferencaFinanciamento,
  abaterComissaoFinanciamento: financiamentos.abaterComissaoFinanciamento,
  encerrarFinanciamento: financiamentos.encerrarFinanciamento,
  ajustarFinanciamento: financiamentos.ajustarFinanciamento,
}

export const consultas = {
  fluxosCompra: cadastros.fluxosCompra,
  atributosItem: cadastros.atributosItem,
  painel: painel.painel,
  operacao: painel.operacao,
  resumoMenu: resumo.resumoMenu,
  diagnostico: painel.diagnostico,
  caixaDoDia: caixa.caixaDoDia,
  diasDoCaixa: caixa.diasDoCaixa,
  estoque: estoque.estoque,
  catalogo: estoque.catalogo,
  movimentosDoItem: estoque.movimentosDoItem,
  fichaItem: estoque.fichaItem,
  // funcionária: o pacote só para vender (sem custo, margem nem histórico)
  pacoteVenda: estoque.pacoteVenda,
  codigos: codigos.codigos,
  codigoDisponivel: codigos.codigoDisponivel,
  modoEtiqueta: codigos.modoEtiqueta,
  rastreio: estoque.rastreio,
  triagem: triagem.triagem,
  fluxosTriagem: triagem.fluxosTriagem,
  genealogia: triagem.genealogia,
  // origem em gramas por compra (pacote misturado e venda)
  origemDoPacote: origem.origemDoPacote,
  lerCodigoPacote: leitura.lerCodigoPacote,
  vendasAbertas: vendasAbertas.vendasAbertas,
  viagensParaFiltro: viagemCurta.viagensParaFiltro,
  cidades: cidades.cidades,
  origemDaVenda: origem.origemDaVenda,
  triagens: triagem.triagens,
  // livro do cabelo (lançamentos de gramas) e histórico de cada pacote
  livroCabelo: livro.livroCabelo,
  historicoPacote: livro.historicoPacote,
  tabelasPreco: precos.tabelasPreco,
  tabelaVigente: precos.tabelaVigente,
  historicoTabela: precos.historicoTabela,
  versoesTabela: precos.versoesTabela,
  compararVersoes: precos.compararVersoes,
  tabelaPreco: precos.tabelaPreco,
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
  pedido: compras.pedido,
  formCompra: formCompra.formCompra,
  vendas: vendas.vendas,
  venda: vendas.venda,
  agenda: vendas.agenda,
  conflitosAgenda: vendas.conflitosAgenda,
  // calendário: atendimentos + viagens + compromissos numa lista só
  calendario: agenda.calendario,
  evento: agenda.evento,
  comissoes: comissoes.comissoes,
  servicosReceitaInsumos: servicosSalao.servicosReceitaInsumos,
  usuarios: usuarios.usuarios,
  usuariosDemo: usuarios.usuariosDemo,
  emprestimos: emprestimos.emprestimos,
  emprestimo: emprestimos.emprestimo,
  pessoas: cadastros.pessoas,
  fichaPessoa: cadastros.fichaPessoa,
  locais: cadastros.locais,
  configuracoes: cadastros.configuracoes,
  cambio: cadastros.cambio,
  anexosDe: cadastros.anexosDe,
  // fotos do lote (próprias + herdadas) e etiquetas para imprimir
  fotosDoLote: fotos.fotosDoLote,
  etiquetas: fotos.etiquetas,
  viagens: viagens.viagens,
  viagem: viagens.viagem,
  painelViajante: viagens.painelViajante,
  categoriasViagem: viagens.categoriasViagem,
  financiamentos: financiamentos.financiamentos,
  financiamento: financiamentos.financiamento,
  origemFinanciamento: financiamentos.origemFinanciamento,
}

export type Comandos = typeof comandos
export type Consultas = typeof consultas
export type NomeComando = keyof Comandos
export type NomeConsulta = keyof Consultas
export type DadosComando<N extends NomeComando> = Parameters<Comandos[N]>[1]
export type ResultadoComando<N extends NomeComando> = Awaited<ReturnType<Comandos[N]>>
export type ParamsConsulta<N extends NomeConsulta> = Parameters<Consultas[N]>[1]
export type ResultadoConsulta<N extends NomeConsulta> = Awaited<ReturnType<Consultas[N]>>
