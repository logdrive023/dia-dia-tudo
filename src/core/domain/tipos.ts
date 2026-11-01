// Registros do núcleo. Todos são JSON puro (sem Date, Blob ou classes): servem igual no aparelho e numa API.
// Dinheiro = inteiro na menor unidade da moeda. Quantidade = inteiro na unidade base do item (grama, peça…).

import type { CodigoMoeda, Cotacao } from './dinheiro'

export type Id = string
export type Campos = Record<string, string | number | boolean | null | undefined>

/** Campos que todo registro tem (prontos para servidor e vários usuários). */
export interface Base {
  id: Id
  empresaId: Id
  criadoEm: string
  atualizadoEm: string
  criadoPor: Id
  versao: number
  apagadoEm?: string
}

export type Papel = 'cliente' | 'fornecedor' | 'doadora' | 'profissional' | 'funcionario' | 'devedor' | 'credor' | 'socio'

export interface Pessoa extends Base {
  nome: string
  telefone?: string
  documento?: string
  papeis: Papel[]
  obs?: string
  /** comissão padrão do profissional em pontos-base (1000 = 10%) */
  comissaoBp?: number
  /** unidade (salão) onde trabalha ou costuma ser atendida */
  localId?: Id
  /** equipe: cargo, salário/custo fixo mensal e a quem responde (organograma) */
  cargo?: string
  /** quanto ganha e por qual período (varia: por mês, semana ou dia). Serve de estimativa; o pago de verdade fica no caixa. */
  salario?: { moeda: string; valor: number; periodo?: 'mes' | 'semana' | 'dia' }
  superiorId?: Id
  /** acesso ao sistema: admin vê tudo; funcionário só a própria unidade e agenda */
  acesso?: 'admin' | 'funcionario'
}

export interface Local extends Base {
  nome: string
  tipo: 'salao' | 'ponto' | 'outro'
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  pais?: string
  referencia?: string
}

export type Unidade = 'grama' | 'peca' | 'servico'

export interface Item extends Base {
  moduloId: string
  tipoItem: string
  nome: string
  unidade: Unidade
  controlaEstoque: boolean
  ativo: boolean
  /** saldo atual (cópia rápida; a verdade é a soma dos movimentos, conferida pelo diagnóstico) */
  saldo: number
  /** preço sugerido (para gramas: por 100 g) */
  precoSugerido?: { moeda: CodigoMoeda; valor: number }
  estoqueIdeal?: number
  /** serviço: minutos e retorno (ex.: manutenção do mega hair em 45 dias) */
  duracaoMin?: number
  retornoDias?: number
  /** lote: custo total na moeda principal e quantidade com que nasceu */
  custoPrincipal?: number
  quantidadeInicial?: number
  /** de onde veio: compra, separação/transformação de outro lote ou cadastro */
  origem?: { tipo: 'compra' | 'transformacao' | 'cadastro'; id?: Id; pessoaId?: Id; compraId?: Id }
  /** código curto para etiqueta e busca: "L-0007" */
  codigo?: string
  campos: Campos
}

export interface Pagamento {
  id: Id
  forma: string
  moeda: CodigoMoeda
  valor: number
  /** cotação usada no momento (guardada para nunca recalcular o passado) */
  cotacao?: Cotacao
  valorPrincipal: number
}

export interface Linha {
  id: Id
  itemId?: Id
  descricao: string
  quantidade: number
  moeda: CodigoMoeda
  total: number
  totalPrincipal: number
  cotacao?: Cotacao
  /** custo do que saiu (lote de cabelo) na moeda principal */
  custoPrincipal?: number
  profissionalId?: Id
  comissaoBp?: number
  comissaoPrincipal?: number
  campos: Campos
}

export interface EventoEtapa {
  de: string
  para: string
  em: string
  /** quem fez (usuário da sessão) */
  por?: Id
  porNome?: string
  /** 'correcao' = venda corrigida depois de concluída (antes → depois fica guardado) */
  tipo?: 'etapa' | 'correcao'
  /** total antes e depois da correção (moeda principal) */
  totalAntes?: number
  totalDepois?: number
  motivo?: string
  ajustes?: string[]
}

export type TipoTransacao = 'compra' | 'venda'

export interface Transacao extends Base {
  tipo: TipoTransacao
  moduloId: string
  /** dia do caixa (AAAA-MM-DD) */
  data: string
  etapa: string
  pessoaId?: Id
  localId?: Id
  profissionalId?: Id
  agendadoPara?: string
  linhas: Linha[]
  pagamentos: Pagamento[]
  moedaPrincipal: CodigoMoeda
  totalPrincipal: number
  historico: EventoEtapa[]
  obs?: string
  campos: Campos
}

export type MotivoEstoque = 'compra' | 'venda' | 'uso' | 'ajuste' | 'perda' | 'cancelamento' | 'transformacao' | 'correcao'

export interface MovEstoque extends Base {
  itemId: Id
  data: string
  delta: number
  saldoAntes: number
  saldoDepois: number
  motivo: MotivoEstoque
  origemId?: Id
  corrigeId?: Id
  descricao?: string
}

export interface Dia extends Base {
  data: string
  status: 'aberto' | 'encerrado'
  /** dinheiro vivo contado no encerramento, por moeda */
  contado: Record<CodigoMoeda, number>
}

export type TipoCaixa =
  | 'venda'
  | 'compra'
  | 'entrada'
  | 'despesa'
  | 'retirada'
  | 'dar'
  | 'emprestimo'
  | 'recebimento'
  | 'estorno'
  | 'saldoInicial'
  | 'correcao'

export interface MovCaixa extends Base {
  data: string
  moeda: CodigoMoeda
  forma: string
  delta: number
  tipo: TipoCaixa
  origemId?: Id
  descricao: string
  categoria?: string
  /** retirada de sócio (divisão do lucro) */
  socioId?: Id
  /** despesa da unidade (salão) */
  localId?: Id
  /** pagamento de salário/diária a esta pessoa */
  pessoaId?: Id
  /** lançamento desfeito por este outro (o original nunca some) */
  estornadoPor?: Id
  estornaId?: Id
}

/**
 * CONTA CORRENTE por pessoa (o "caderno de quem deve"): + = a pessoa me deve; − = eu devo a ela.
 * Venda a ela soma; compra dela subtrai; recebimento, pagamento e adiantamento acertam. Saldo = soma.
 */
export interface MovConta extends Base {
  pessoaId: Id
  data: string
  moeda: string
  delta: number
  tipo: 'venda' | 'compra' | 'recebimento' | 'pagamento' | 'adiantamento' | 'ajuste' | 'estorno'
  origemId?: Id
  forma?: string
  descricao: string
}

export interface CotacaoRegistro extends Base, Cotacao {
  fonte?: 'manual' | 'auto'
}

/**
 * TABELA DE PREÇO (genérica): linhas = medida (ex.: comprimento em cm), colunas = comprador/canal (ex.: Iver, Henry,
 * Paraguai), célula = fator (ex.: 3,5 por grama). Valor = quantidade × fator. Ex.: 2.000 g × 3,5 = Bs 7.000.
 */
export interface TabelaPreco extends Base {
  moduloId: string
  nome: string
  /** categoria do produto (ex.: Normal, Tinte, CH): a venda escolhe a tabela da categoria */
  categoria?: string
  /** a partir de quando vale (as tabelas mudam com o tempo) */
  validaDesde?: string
  moeda: string
  /** rótulo da medida das linhas: "cm" */
  unidadeMedida: string
  /** o fator multiplica: 'grama' = por grama */
  fatorPor: 'grama' | 'unidade'
  linhas: number[]
  colunas: { id: string; nome: string; pessoaId?: Id }[]
  /** "40|iver" → "3,5" */
  valores: Record<string, string>
}

export type TipoJuros = 'nenhum' | 'simples' | 'composto' | 'fixo'

export interface Parcela {
  id: Id
  numero: number
  vencimento: string
  valor: number
}

export interface Emprestimo extends Base {
  direcao: 'dado' | 'tomado'
  pessoaId: Id
  moeda: CodigoMoeda
  principal: number
  juros: { tipo: TipoJuros; taxaMensalBp?: number; valorFixo?: number }
  inicio: string
  parcelas: Parcela[]
  obs?: string
  situacao: 'aberto' | 'quitado' | 'cancelado'
}

export interface MovDivida extends Base {
  emprestimoId: Id
  parcelaId?: Id
  data: string
  delta: number
  saldoAntes: number
  saldoDepois: number
  tipo: 'principal' | 'juros' | 'pagamento' | 'ajuste'
  forma?: string
  descricao?: string
}

export type CategoriaAnexo = 'pedido' | 'produto' | 'comprovante' | 'origem' | 'resultado' | 'outro'

export interface Anexo extends Base {
  donoId: Id
  categoria: CategoriaAnexo
  nome: string
  mime: string
  tamanho: number
}

export interface ConfigRegistro extends Base {
  valor: unknown
}

/** LOG DETALHADO: toda ação guarda quem fez (criadoPor + nome), quando (criadoEm), em quê (alvoId) e o resumo. */
export interface Auditoria extends Base {
  acao: string
  alvoId?: Id
  resumo: string
  usuarioNome?: string
  /** outros registros ligados (ex.: a pessoa da venda), para aparecer na linha do tempo deles também */
  ligados?: Id[]
}

/** Usuário que entra no sistema. Senha guardada só como hash (PBKDF2 + sal). Com a API, quem confere é o servidor. */
export interface Usuario extends Base {
  login: string
  nome: string
  perfil: 'admin' | 'funcionario'
  pessoaId?: Id
  localId?: Id
  senhaHash: string
  sal: string
  ativo: boolean
  ultimoAcesso?: string
}

export interface Outbox extends Base {
  comando: string
  dados: unknown
  enviadoEm?: string
}
