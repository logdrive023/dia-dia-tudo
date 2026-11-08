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
  /** funcionária: vê também a agenda das colegas da unidade dela (sem isso, só o que é dela) */
  verAgendaEquipe?: boolean
}

export interface Local extends Base {
  nome: string
  /** como a equipe chama a unidade ("Centro", "a do shopping"); aparece no lugar do nome nos filtros */
  apelido?: string
  tipo: 'salao' | 'ponto' | 'outro'
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  pais?: string
  referencia?: string
}

export type Unidade = 'grama' | 'peca' | 'servico'

/** id da coluna da triagem (as colunas são configuráveis) */
export type FaseTriagem = string

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
  /** serviço: comissão própria em pontos-base (5000 = 50%); sem = vale a da profissional ou a padrão (Configurações) */
  comissaoBp?: number
  /**
   * serviço: custo fixo dos insumos do salão (tinta, água oxigenada, descolorante…), descontado ANTES da comissão.
   * itens (opcional) somam o valor. Ex.: Tinta 15 + Água oxigenada 5 = 20.
   */
  insumo?: InsumoServico
  /** lote: custo total na moeda principal e quantidade com que nasceu */
  custoPrincipal?: number
  quantidadeInicial?: number
  /**
   * de onde veio: compra, separação/transformação de outro lote, unificação de vários lotes (ids) ou cadastro.
   * compraIds = TODAS as compras de onde vem o cabelo (lote unificado e seus filhos conhecem todas).
   */
  origem?: { tipo: 'compra' | 'transformacao' | 'cadastro' | 'unificacao'; id?: Id; ids?: Id[]; pessoaId?: Id; compraId?: Id; compraIds?: Id[] }
  /** triagem: coluna do quadro onde o lote está, desde quando, observação e se é a coluna de entrada */
  faseTriagem?: { fase: FaseTriagem; desde: string; obs?: string; entrada?: boolean }
  /** TRIAGEM que criou este lote ("T-0003"): a mesma operação junta e/ou separa; 'intermediario' = lote unificado que foi separado na hora */
  triagem?: { id: Id; codigo: string; em: string; por?: string; papel: 'saida' | 'intermediario' }
  /** código curto para etiqueta e busca: "L-0007", "M1-1a" (regra em Configurações › Códigos; único entre os lotes) */
  codigo?: string
  /** códigos que o lote já teve (trocados pelo admin): continuam achando o lote na busca */
  codigosAnteriores?: string[]
  /** etiqueta: quando foi impressa pela última vez e por quem (Etiquetas › "Sem etiqueta" / "Já impressa") */
  etiquetaImpressaEm?: string
  etiquetaImpressaPor?: string
  /** RESERVA: cliente pediu e o pacote fica guardado para ela (aparece 🔒 no estoque e um aviso ao vender para outra) */
  reserva?: { para: string; ate?: string; obs?: string; em: string; porNome?: string }
  /** peso impresso na etiqueta (o saldo na hora): vendeu parte depois → a etiqueta ficou velha, pede reimprimir */
  etiquetaPeso?: number
  /** via da etiqueta (1, 2, 3…): sobe quando a antiga é cancelada ("Errou? Gerar nova"); o código do lote não muda */
  etiquetaVia?: number
  /**
   * CÓDIGO DO QR (aleatório, ver domain/ids.ts novoCodigoQr): o QR da etiqueta leva só ele (…#/q/<código>), nunca o id.
   * Nasce ao preparar a impressão; reimprimir (nova via) troca o código e o antigo deixa de abrir o pacote.
   */
  qr?: string
  /** a última etiqueta cancelada: por quê, quando e quem */
  etiquetaCancelada?: { motivo: string; em: string; porNome?: string; via: number }
  campos: Campos
}

/** insumos de um serviço (catálogo) ou de uma linha de venda: valor total e, se quiser, os nomes */
export interface InsumoServico {
  moeda: string
  valor: number
  itens?: { nome: string; valor: number }[]
}

/** de onde veio o % da comissão (precedência: linha > serviço > profissional > padrão) */
export type RegraComissao = 'linha' | 'servico' | 'profissional' | 'padrao'

/** uma parte da divisão do valor da venda: quem, como (% de uma base ou valor fixo) e uma observação */
export interface ParteDivisao {
  id: Id
  pessoaId?: Id
  nome: string
  modo: 'pct' | 'valor'
  /** % em pontos-base (2500 = 25%), quando modo = pct */
  pctBp?: number
  /** valor fixo na moeda principal, quando modo = valor */
  valor?: number
  /** o % é sobre o quê: o total cobrado, o líquido (sem impostos) ou o lucro */
  base: 'total' | 'liquido' | 'lucro'
  obs?: string
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
  /**
   * SALÃO (guardado na hora: mudar o catálogo depois não mexe no passado):
   * insumos (moeda principal) são custo da venda e saem ANTES da divisão: base = total − insumos;
   * comissão = base × %; parte do salão = base − comissão.
   */
  insumoPrincipal?: number
  insumos?: { nome: string; valorPrincipal: number }[]
  /** motivo quando o insumo da linha difere do catálogo (produto especial, quantidade extra…) */
  insumoMotivo?: string
  baseComissao?: number
  parteSalao?: number
  comissaoRegra?: RegraComissao
  /** preço do catálogo na hora (mesma moeda da linha) e motivo quando cobrou menos */
  precoCatalogo?: number
  motivoPreco?: string
  /**
   * DESCONTO da linha (venda): `bruto` = valor cheio na moeda da linha (gramas × fator da tabela), `desconto` = quanto
   * saiu dele (mesma moeda) e `descontoPrincipal` na moeda principal. `total`/`totalPrincipal` já são o LÍQUIDO
   * (bruto − desconto): comissão, lucro, caixa e relatórios usam o líquido. Vendas antigas não têm esses campos.
   * Ex.: 2.008 g × 17,5 = Bs 35.140 (bruto) − desconto Bs 878,50 = Bs 34.261,50 (total).
   */
  bruto?: number
  desconto?: number
  descontoPrincipal?: number
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
  /** número curto para falar e buscar: "P-0007" ou "M3" (pedido de compra; único entre as compras) */
  codigo?: string
  /** códigos que a compra já teve (trocados pelo admin): continuam achando a compra na busca */
  codigosAnteriores?: string[]
  /** compra: quem da equipe comprou (base do código "por pessoa" quando a base é quem comprou) */
  compradorId?: Id
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
  /** compra: VIAGEM de compra a que pertence (o rateio dos gastos da viagem e o resultado da viagem contam com ela) */
  viagemId?: Id
  /** compra: entrega de cabelo que abate um ADIANTAMENTO a parceiro (AD-0001); não sai do caixa, abate da dívida */
  financiamentoId?: Id
  /** SÓ REGISTRO: os impostos estimados na hora (alíquota vigente e fonte daquele dia) — nunca cobrados */
  impostosEstimados?: { em: string; modoPreco: 'dentro' | 'fora'; total: number; linhas: { sigla: string; nome: string; taxaBp: number; base: number; valor: number; lado: 'venda' | 'compra'; credito?: boolean; fonte?: string; vigenteDesde?: string }[] }
  /** DIVISÃO DO VALOR (só registro: não mexe no caixa) — com quem esta venda é dividida, por % ou por valor fixo */
  divisao?: { partes: ParteDivisao[]; em: string; porNome?: string }
}

export type MotivoEstoque = 'compra' | 'venda' | 'uso' | 'ajuste' | 'perda' | 'cancelamento' | 'transformacao' | 'correcao' | 'unificacao'

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
  /** quem fez (usuário da sessão), para o histórico do pacote e o livro do cabelo */
  usuario?: Id
  porNome?: string
  /**
   * PERDA QUE SAI DO ESTOQUE COM CUSTO (vai para o DRE como despesa, numa linha própria): o custo das gramas no momento
   * da baixa. 'mao' = perda/acerto lançado à mão no estoque · 'lavagem' = o peso que a lavagem tirou.
   * (A perda da separação não entra: o custo dela fica nos pacotes que saíram. A conferência de peso também não.)
   */
  perdaCusto?: { tipo: 'mao' | 'lavagem'; valor: number }
}

export interface Dia extends Base {
  data: string
  status: 'aberto' | 'encerrado'
  /** dinheiro vivo contado no encerramento, por moeda */
  contado: Record<CodigoMoeda, number>
  /** vendas deste dia corrigidas/canceladas depois de encerrado (o dinheiro da diferença entra no dia em que corrigiu) */
  alteracoesDepois?: { origemId: Id; codigo?: string; descricao: string; em: string; porNome: string }[]
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
  /** valor na moeda principal no dia (ex.: comissão paga): não muda com o câmbio depois */
  valorPrincipal?: number
  /** despesa da unidade (salão) */
  localId?: Id
  /** pagamento de salário/diária a esta pessoa */
  pessoaId?: Id
  /** lançamento desfeito por este outro (o original nunca some) */
  estornadoPor?: Id
  estornaId?: Id
  /** dinheiro de uma VIAGEM de compra (adiantamento, devolução da sobra, reembolso) */
  viagemId?: Id
  /** DOCUMENTO FISCAL do gasto (Imposto de Renda): factura (dá crédito de IVA), recibo ou sem; e se é dedutível no IUE */
  docFiscal?: { documento: 'factura' | 'recibo' | 'sem'; dedutivel: boolean; numero?: string }
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
  /** 'comissao' = comissão a pagar abatida da dívida (conta como comissão paga, sem passar pelo caixa) */
  tipo: 'venda' | 'compra' | 'recebimento' | 'pagamento' | 'adiantamento' | 'ajuste' | 'estorno' | 'comissao'
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
  /** foto: miniatura (~240 px) em data URL, para as listas mostrarem sem buscar o arquivo (comando definirMiniatura) */
  miniatura?: string
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

/**
 * GASTO OPERACIONAL de uma viagem (combustível, hospedagem, comida…): sai da carteira da viagem, não do caixa.
 * Nunca é apagado: anular guarda quem, quando e o motivo.
 */
export interface DespesaViagem {
  id: Id
  /** dia do gasto (AAAA-MM-DD) e instante do registro */
  data: string
  em: string
  categoria: string
  moeda: CodigoMoeda
  valor: number
  /** valor na moeda principal pela cotação do momento (guardada: o passado não muda) */
  valorPrincipal: number
  cotacao?: Cotacao
  nota?: string
  por: Id
  porNome: string
  anulada?: { em: string; porNome: string; motivo: string }
}

/** Movimento da CARTEIRA da viagem (por moeda): + entra na carteira; − sai. A despesa também mexe nela. */
export interface MovCarteiraViagem {
  id: Id
  tipo: 'adiantamento' | 'devolucao' | 'reembolso' | 'diferenca'
  data: string
  em: string
  moeda: CodigoMoeda
  delta: number
  forma?: string
  /** lançamento do caixa ligado (adiantamento sai do caixa; devolução volta; reembolso sai) */
  movCaixaId?: Id
  porNome: string
  obs?: string
  /** diferença anulada ao reabrir a viagem (nada é apagado) */
  anulada?: boolean
}

/**
 * VIAGEM DE COMPRA: quem viajou, quando, orçamento, carteira (adiantamento por moeda), gastos operacionais e as compras
 * ligadas (Transacao.viagemId). Pode não ter compra nenhuma (viagem de prospecção). Ao encerrar: prestação de contas
 * (sobra volta ao caixa, diferença fica registrada) e, se quiser, o gasto entra no custo dos lotes (reversível).
 */
export interface Viagem extends Base {
  /** "VG-0001" */
  codigo: string
  nome: string
  destino?: string
  /** a viagem é na Bolívia (o destino veio da lista de cidades) — sem marcar: destino escrito à mão */
  naBolivia?: boolean
  /** pessoas (funcionárias/sócias) que viajaram */
  viajantes: Id[]
  inicio: string
  fim?: string
  status: 'aberta' | 'encerrada'
  /** orçamento dos gastos operacionais e do capital de compra (moeda principal) */
  orcamento?: number
  orcamentoCompra?: number
  /** como o gasto da viagem é dividido entre as compras: pelas gramas ou pelo valor */
  rateio: 'grama' | 'valor'
  despesas: DespesaViagem[]
  carteira: MovCarteiraViagem[]
  encerramento?: { em: string; data: string; porNome: string; obs?: string }
  /** gasto da viagem somado ao custo dos lotes que ainda estavam em estoque (antes → depois de cada lote) */
  incorporacao?: { em: string; porNome: string; total: number; lotes: { itemId: Id; codigo?: string; gramas: number; inicial: number; extra: number; antes: number; depois: number }[] }
  /** incorporações desfeitas (ao reabrir): ficam para o histórico */
  incorporacoesDesfeitas?: NonNullable<Viagem['incorporacao']>[]
  obs?: string
}

/** Acontecimento de um ADIANTAMENTO a parceiro (o efeito na dívida vem da conta corrente, pela origem). */
export interface EventoFinanciamento {
  /** entrega: o id é o da compra criada; os outros: o id da operação (origem na conta corrente) */
  id: Id
  tipo: 'entrega' | 'recebimento' | 'comissao' | 'diferenca' | 'baixa'
  data: string
  em: string
  porNome: string
  compraId?: Id
  moeda?: CodigoMoeda
  valor?: number
  forma?: string
  obs?: string
  /** comissão retida sozinha ao pagar comissão (id do pagamento) */
  pagamentoComissaoId?: Id
}

/**
 * FINANCIAMENTO / ADIANTAMENTO A PARCEIRO ("AD-0001"): dinheiro dado a uma pessoa (intermediária, parceira, funcionária)
 * para comprar cabelo em nome da loja. Sai do caixa como empréstimo operacional (não é despesa nem compra) e a pessoa
 * passa a dever na conta corrente; cada entrega de cabelo é uma compra normal que abate a dívida (sem sair do caixa).
 * Saldo = soma dos movimentos da conta corrente ligados a ele (+ = a pessoa me deve; − = devo a ela).
 */
export interface Financiamento extends Base {
  codigo: string
  pessoaId: Id
  data: string
  moeda: CodigoMoeda
  valor: number
  valorPrincipal: number
  cotacao?: Cotacao
  forma: string
  viagemId?: Id
  /** DATA LIMITE (opcional): até quando o parceiro deve entregar o cabelo; passou e ainda deve = vencido */
  prazo?: string
  /** abater sozinho das próximas comissões pagas à pessoa */
  abaterComissoes?: boolean
  obs?: string
  eventos: EventoFinanciamento[]
  /** encerrado à mão (com motivo): a diferença que sobrou vira baixa na conta */
  encerramento?: { em: string; data: string; porNome: string; motivo: string; saldo: number }
}

export interface Outbox extends Base {
  comando: string
  dados: unknown
  enviadoEm?: string
}

/**
 * COMPROMISSO / LEMBRETE da agenda (não mexe em dinheiro nem estoque): "Buscar mechas no correio · 04/11 15:00".
 * Dono = quem criou (criadoPor); pessoaId = para quem é (o administrador pode marcar para outra pessoa).
 * Excluir = apagadoEm (fica no log). Semanal: repete toda semana a partir de `data` (até `repetirAte`, se houver).
 */
export interface Evento extends Base {
  titulo: string
  /** AAAA-MM-DD (dia local) */
  data: string
  /** "HH:MM" local; sem hora = o dia todo */
  hora?: string
  duracaoMin?: number
  nota?: string
  pessoaId?: Id
  localId?: Id
  semanal?: boolean
  repetirAte?: string
  /** dias (AAAA-MM-DD) já feitos — no semanal, cada semana é marcada à parte */
  feitos?: string[]
}
