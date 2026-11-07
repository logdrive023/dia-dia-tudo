// O MAPA DAS TELAS (rota → componente) e QUEM PODE ABRIR (só o administrador). Um lugar só: o App e a Tela leem daqui.
import { AbrirQr, FichaLote, Rastreio } from '../features/lote'
import { MinhaVitrine } from '../features/vitrine'
import { NovoFuncionarioTela, Equipe } from '../features/equipe'
import { NovaPessoaTela, FichaPessoa, Pessoas } from '../features/cadastros'
import { Auditoria } from '../features/auditoria'
import { Agenda } from '../features/agenda'
import { Caixa, VendaRapida } from '../features/caixa'
import { Comprar, NovaCompraTela, Pedido } from '../features/compra'
import { Config } from '../features/config'
import { Emprestimos, FichaEmprestimo, CadastroEmprestimo, Financiamentos, FichaFinanciamento, CadastroAdiantamento } from '../features/financeiro'
import { Estoque, Etiquetas, Livro } from '../features/estoque'
import { SepararTela, Triagem } from '../features/triagem'
import { Painel } from '../features/painel'
import { Precos } from '../features/precos'
import { Relatorios } from '../features/relatorio'
import { Novidades } from '../features/novidades'
import { DetalheVenda, Vender } from '../features/venda'
import { FichaViagem, Viagens, NovaViagemTela } from '../features/viagem'
import { MENU } from './Shell'

export const TELAS: Record<string, () => JSX.Element> = {
  painel: Painel,
  vender: Vender,
  vendaRapida: VendaRapida,
  comprar: Comprar,
  pedido: Pedido,
  novaCompra: NovaCompraTela,
  triagem: Triagem,
  etiquetas: Etiquetas,
  livro: Livro,
  estoque: Estoque,
  lote: FichaLote,
  rastreio: Rastreio,
  caixa: Caixa,
  agenda: Agenda,
  equipe: Equipe,
  pessoas: Pessoas,
  pessoa: FichaPessoa,
  emprestimos: Emprestimos,
  emprestimo: FichaEmprestimo,
  novoEmprestimo: CadastroEmprestimo,
  separar: SepararTela,
  precos: Precos,
  tabelaPreco: Precos,
  relatorios: Relatorios,
  novidades: Novidades,
  auditoria: Auditoria,
  config: Config,
  configSecao: Config,
  vendas: Vender,
  venda: DetalheVenda,
  viagens: Viagens,
  vitrine: MinhaVitrine,
  qr: AbrirQr,
  viagem: FichaViagem,
  adiantamentos: Financiamentos,
  financiamento: FichaFinanciamento,
  novoFinanciamento: CadastroAdiantamento,
  novaPessoa: NovaPessoaTela,
  novoFuncionario: NovoFuncionarioTela,
  novaViagem: NovaViagemTela,
}

/** telas só do administrador (as do menu marcadas como admin + as fichas e formulários delas) */
export const SO_ADMIN = new Set([...MENU.filter((m) => m.admin).map((m) => m.tela), 'rastreio', 'emprestimo', 'vendas', 'pedido', 'novaCompra', 'tabelaPreco', 'novoEmprestimo', 'separar', 'novoFuncionario', 'viagem', 'novaViagem', 'novoFinanciamento'])

/** a tela inicial de cada perfil */
export const telaInicial = (perfil: string | undefined) => (perfil === 'admin' ? 'painel' : 'agenda')
