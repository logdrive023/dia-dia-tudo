// CONTRATO DOS MÓDULOS. O núcleo não sabe o que é cabelo, salão ou empréstimo: cada módulo se descreve aqui
// e o núcleo (regras, assistente de venda, triagem e painel) lê só este registro.

import type { CodigoMoeda } from './domain/dinheiro'
import type { Emprestimo, Id, Item, MovDivida, MovEstoque, Pessoa, Transacao, Unidade } from './domain/tipos'

export type TipoCampo = 'texto' | 'numero' | 'lista' | 'simNao'

export interface CampoDef {
  id: string
  nome: string
  tipo: TipoCampo
  opcoes?: string[]
  unidade?: string
  ajuda?: string
  obrigatorio?: boolean
}

export interface TipoItemDef {
  id: string
  nome: string
  unidade: Unidade
  controlaEstoque: boolean
  campos: CampoDef[]
  /** o item nasce na compra (ex.: cada compra de cabelo vira um lote novo) */
  nasceNaCompra?: boolean
  /** monta o nome do item a partir dos campos */
  nomear?: (campos: Record<string, unknown>) => string
}

export interface EtapaDef {
  id: string
  nome: string
  ajuda: string
  /** 'pagamento' bloqueia sem pagamento; 'estoque' = aqui entra no estoque */
  faz?: ('pagamento' | 'estoque')[]
  /** só lembretes (não bloqueiam) */
  lembrar?: string[]
}

export interface Formato {
  tipo: 'dinheiro' | 'gramas' | 'numero' | 'percentual' | 'dias'
}

/** Para onde o toque num número leva (a lista que forma aquele número). */
export interface Detalhe {
  tela: string
  filtro?: Record<string, string | number | boolean | undefined>
}

export interface Cartao {
  id: string
  nome: string
  valor: number
  formato: Formato['tipo']
  ajuda: string
  anterior?: number
  detalhe?: Detalhe
  moeda?: CodigoMoeda
  destaque?: 'bom' | 'alerta' | 'ruim'
}

/** Peças genéricas do painel: qualquer módulo monta seu painel com elas. */
export type Secao =
  | { tipo: 'cartoes'; titulo: string; cartoes: Cartao[] }
  | {
      tipo: 'barras'
      titulo: string
      ajuda?: string
      formato: Formato['tipo']
      itens: { rotulo: string; valor: number; detalhe?: Detalhe; extra?: string }[]
    }
  | {
      tipo: 'tabela'
      titulo: string
      ajuda?: string
      colunas: { id: string; nome: string; formato?: Formato['tipo'] }[]
      linhas: { valores: Record<string, string | number>; detalhe?: Detalhe }[]
    }
  | {
      tipo: 'mapa'
      titulo: string
      ajuda?: string
      formato: Formato['tipo']
      linhas: string[]
      colunas: string[]
      valores: number[][]
    }
  | {
      tipo: 'funil'
      titulo: string
      ajuda?: string
      etapas: { nome: string; quantidade: number; detalhe?: Detalhe }[]
    }

/** Tudo que um módulo pode usar para calcular o próprio painel (já filtrado pelo período). */
export interface DadosPainel {
  de: string
  ate: string
  hoje: string
  moedaPrincipal: CodigoMoeda
  vendas: Transacao[]
  compras: Transacao[]
  todasTransacoes: Transacao[]
  itens: Item[]
  movEstoque: MovEstoque[]
  pessoas: Map<Id, Pessoa>
  emprestimos: Emprestimo[]
  movDivida: MovDivida[]
  moduloDoItem: (itemId: Id | undefined) => string | undefined
  /** converte para a moeda principal pela cotação de hoje (0 se faltar cotação) */
  paraPrincipal: (valor: number, moeda: CodigoMoeda) => number
  localId?: Id
  profissionalId?: Id
}

export interface PerguntaVenda {
  /** "É cabelo?" */
  pergunta: string
  ajuda: string
  /** tipos de item vendidos por este caminho */
  tiposItem: string[]
  /** pergunta endereço, profissional e horário (salão) */
  atendimento?: boolean
  /** preço mostrado por 100 g */
  precoPor100g?: boolean
  /** pode usar itens de outros módulos junto (ex.: cabelo do estoque num serviço) */
  usaTambem?: string[]
}

export interface ModuloDef {
  id: string
  nome: string
  icone: string
  descricao: string
  tiposItem: TipoItemDef[]
  compra?: { tipoItem: string; etapas: EtapaDef[]; avisarParadaDias: number; pedirComprovanteOrigem?: boolean }
  venda?: PerguntaVenda
  /** área própria (ex.: empréstimos não é compra nem venda) */
  telaPropria?: string
  /** cartões, gráficos e tabelas deste módulo no painel */
  painel?: (dados: DadosPainel) => Secao[]
  /** recursos ligados (para as telas se adaptarem: tabela de preço, agenda…) */
  recursos?: { estoque: false | Unidade; tabelaPreco?: boolean; agenda?: boolean; triagem?: string[]; loteNaCompra?: boolean; retornoDias?: number }
  /** criado pela tela (pode ser editado/removido) */
  personalizado?: boolean
  /** alertas deste módulo para "Atenção agora" */
  alertas?: (dados: DadosPainel) => { id: string; texto: string; quantidade: number; nivel: 'info' | 'alerta' | 'ruim'; detalhe?: Detalhe }[]
}

export class RegistroModulos {
  private mapa = new Map<string, ModuloDef>()

  constructor(modulos: ModuloDef[] = []) {
    modulos.forEach((m) => this.registrar(m))
  }

  registrar(m: ModuloDef) {
    if (this.mapa.has(m.id)) throw new Error(`Módulo repetido: ${m.id}`)
    this.mapa.set(m.id, m)
  }

  /** Troca as modalidades criadas pela tela (as de código ficam). */
  definirPersonalizados(ms: ModuloDef[]) {
    for (const [id, m] of this.mapa) if (m.personalizado) this.mapa.delete(id)
    for (const m of ms) if (!this.mapa.has(m.id)) this.mapa.set(m.id, m)
  }

  todos(): ModuloDef[] {
    return [...this.mapa.values()]
  }

  obter(id: string): ModuloDef {
    const m = this.mapa.get(id)
    if (!m) throw new Error(`Módulo não registrado: ${id}`)
    return m
  }

  tem(id: string) {
    return this.mapa.has(id)
  }

  tipoItem(moduloId: string, tipoId: string): TipoItemDef {
    const t = this.obter(moduloId).tiposItem.find((x) => x.id === tipoId)
    if (!t) throw new Error(`Tipo de item ${tipoId} não existe no módulo ${moduloId}`)
    return t
  }
}
