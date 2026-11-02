// SEÇÕES DAS CONFIGURAÇÕES: uma lista só. Cada seção tem endereço próprio (#/config/<id>), aparece no índice,
// na busca "O que você quer configurar?", na coluna da esquerda (desktop) e no submenu de Configurações.
// Nova seção = uma linha aqui (id, grupo, nome, ícone, descrição curta, palavras para a busca, componente).

import { EtapasTriagem } from './ConfigTriagem'
import { ConfigCodigos } from './ConfigCodigos'
import { ConfigFormCompra } from './ConfigFormCompra'
import { Atributos, Catalogo, Dados, EtapasCompra, FormasPagamento, Geral, Modulos, Moedas, Socias, Unidades, Usuarios } from './Config'

export type GrupoConfigId = 'negocio' | 'dinheiro' | 'cabelo' | 'sistema'

export const GRUPOS_CONFIG: { id: GrupoConfigId; nome: string; icone: string }[] = [
  { id: 'negocio', nome: 'Negócio', icone: '🏢' },
  { id: 'dinheiro', nome: 'Dinheiro', icone: '💱' },
  { id: 'cabelo', nome: 'Cabelo e estoque', icone: '💇‍♀️' },
  { id: 'sistema', nome: 'Sistema', icone: '⚙️' },
]

export interface SecaoConfig {
  id: string
  grupo: GrupoConfigId
  nome: string
  icone: string
  descricao: string
  /** palavras que a busca também entende (sem acento, minúsculas não precisa: a busca normaliza) */
  palavras: string
  componente: () => JSX.Element
}

export const SECOES_CONFIG: SecaoConfig[] = [
  { id: 'geral', grupo: 'negocio', nome: 'Geral', icone: '🏪', descricao: 'Nome do negócio e idioma', palavras: 'nome negócio idioma língua português espanhol español', componente: Geral },
  { id: 'socias', grupo: 'negocio', nome: 'Sócias', icone: '🤝', descricao: 'Como o lucro é dividido', palavras: 'sócia sócio lucro divisão parte porcentagem resultado', componente: Socias },
  { id: 'pagamentos', grupo: 'negocio', nome: 'Formas de pagamento', icone: '💳', descricao: 'Pix, cartão, dinheiro e moedas', palavras: 'pagamento forma pix cartão dinheiro transferência qr', componente: FormasPagamento },
  { id: 'unidades', grupo: 'negocio', nome: 'Unidades', icone: '📍', descricao: 'Salões, pontos e endereços', palavras: 'unidade endereço salão loja ponto depósito local filial', componente: Unidades },
  { id: 'usuarios', grupo: 'negocio', nome: 'Usuários', icone: '👤', descricao: 'Quem entra, perfil e senha', palavras: 'usuário senha login acesso perfil funcionária administrador entrar', componente: Usuarios },
  { id: 'moedas', grupo: 'dinheiro', nome: 'Moedas e câmbio', icone: '💵', descricao: 'Moeda principal e câmbio do dia', palavras: 'moeda câmbio cotação dólar real boliviano taxa conversão', componente: Moedas },
  { id: 'etapas', grupo: 'cabelo', nome: 'Etapas da compra', icone: '🛒', descricao: 'O caminho do pedido de compra', palavras: 'compra pedido etapa pagamento fotos comprovante fluxo parada', componente: EtapasCompra },
  { id: 'formCompra', grupo: 'cabelo', nome: 'Formulário de compra', icone: '📝', descricao: 'O que a nova compra pede e em que ordem', palavras: 'formulário compra nova campos ordem obrigatório padrão medidas estado chegada passo simples', componente: ConfigFormCompra },
  { id: 'triagem', grupo: 'cabelo', nome: 'Etapas da triagem', icone: '🧺', descricao: 'As colunas do quadro e as cores', palavras: 'triagem coluna quadro cor pronto separar lote kanban', componente: EtapasTriagem },
  { id: 'atributos', grupo: 'cabelo', nome: 'Atributos', icone: '🔖', descricao: 'Química, espessura, região…', palavras: 'atributo campo química espessura região lista filtro cor textura', componente: Atributos },
  { id: 'codigos', grupo: 'cabelo', nome: 'Códigos', icone: '🔢', descricao: 'Como identificar compras e lotes', palavras: 'código número identificação sequência lote compra etiqueta prefixo', componente: ConfigCodigos },
  { id: 'catalogo', grupo: 'cabelo', nome: 'Catálogo', icone: '📒', descricao: 'Serviços e produtos com preço', palavras: 'catálogo serviço produto preço duração retorno item', componente: Catalogo },
  { id: 'modulos', grupo: 'sistema', nome: 'Módulos', icone: '🧩', descricao: 'Ligar recursos e criar modalidades', palavras: 'módulo modalidade ligar desligar recurso salão empréstimo', componente: Modulos },
  { id: 'dados', grupo: 'sistema', nome: 'Dados', icone: '💾', descricao: 'Backup e demonstração', palavras: 'backup dados exportar restaurar zerar demonstração armazenamento conferência', componente: Dados },
]

export function secaoConfig(id?: string): SecaoConfig | undefined {
  return SECOES_CONFIG.find((s) => s.id === id)
}

export function grupoConfig(id: GrupoConfigId) {
  return GRUPOS_CONFIG.find((g) => g.id === id)!
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca por nome, descrição, palavras e grupo (no idioma da tela e em português). Todas as palavras digitadas precisam aparecer. */
export function buscarSecoes(q: string, t: (s: string) => string): SecaoConfig[] {
  const termos = sem(q).split(/\s+/).filter(Boolean)
  if (!termos.length) return SECOES_CONFIG
  return SECOES_CONFIG.filter((s) => {
    const g = grupoConfig(s.grupo).nome
    const texto = sem([s.nome, t(s.nome), s.descricao, t(s.descricao), s.palavras, g, t(g)].join(' '))
    return termos.every((x) => texto.includes(x))
  })
}
