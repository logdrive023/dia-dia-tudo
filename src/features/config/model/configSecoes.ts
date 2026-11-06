// SEÇÕES DAS CONFIGURAÇÕES: uma lista só. Cada seção tem endereço próprio (#/config/<id>), aparece no índice,
// na busca "O que você quer configurar?", na coluna da esquerda (desktop) e no submenu de Configurações.
// Nova seção = uma linha aqui (id, grupo, nome, ícone, descrição curta, palavras para a busca, componente).

import { EtapasTriagem } from '../pages/ConfigTriagem'
import { ConfigFiscal } from '../pages/ConfigFiscal'
import { ConfigCodigos } from '../pages/ConfigCodigos'
import { ConfigFormCompra } from '../pages/ConfigFormCompra'
import { Atributos, Catalogo, Dados, EtapasCompra, FormasPagamento, Funcionaria, Geral, Metas, Modulos, Moedas, Socias, Unidades, Usuarios } from '../pages/Config'

export type GrupoConfigId = 'negocio' | 'pessoas' | 'dinheiro' | 'compras' | 'estoque' | 'sistema'

/** as ÁREAS das configurações (cada uma com cor e uma linha do que tem): o índice mostra uma faixa por área */
export const GRUPOS_CONFIG: { id: GrupoConfigId; nome: string; icone: string; cor: string; descricao: string }[] = [
  { id: 'negocio', nome: 'Negócio', icone: '🏢', cor: '#7c3aed', descricao: 'Nome, unidades e sócias' },
  { id: 'pessoas', nome: 'Pessoas e acesso', icone: '👥', cor: '#0ea5e9', descricao: 'Quem entra no sistema e o que pode ver' },
  { id: 'dinheiro', nome: 'Dinheiro e impostos', icone: '💰', cor: '#16a34a', descricao: 'Moedas, formas de pagamento, impostos e relatórios' },
  { id: 'compras', nome: 'Compras', icone: '🛒', cor: '#ea580c', descricao: 'O caminho do pedido, o formulário e os códigos' },
  { id: 'estoque', nome: 'Estoque e triagem', icone: '📦', cor: '#db2777', descricao: 'A triagem, os atributos do cabelo e o catálogo' },
  { id: 'sistema', nome: 'Sistema', icone: '⚙️', cor: '#64748b', descricao: 'Módulos, backup e dados' },
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
  { id: 'pagamentos', grupo: 'dinheiro', nome: 'Formas de pagamento', icone: '💳', descricao: 'Pix, cartão, dinheiro e moedas', palavras: 'pagamento forma pix cartão dinheiro transferência qr', componente: FormasPagamento },
  { id: 'metas', grupo: 'negocio', nome: 'Metas', icone: '🎯', descricao: 'Meta do mês por empresa, unidade ou pessoa', palavras: 'meta objetivo mês faturamento vendas atendimentos barra painel funcionária equipe', componente: Metas },
  { id: 'unidades', grupo: 'negocio', nome: 'Unidades', icone: '📍', descricao: 'Salões, pontos e endereços', palavras: 'unidade endereço salão loja ponto depósito local filial', componente: Unidades },
  { id: 'funcionaria', grupo: 'pessoas', nome: 'O que a funcionária faz', icone: '🔐', descricao: 'O que vende, vê na agenda e nas configurações', palavras: 'funcionária funcionário gerente permissão pode vender agenda ver pessoas acesso papel perfil role', componente: Funcionaria },
  { id: 'usuarios', grupo: 'pessoas', nome: 'Usuários', icone: '👤', descricao: 'Quem entra, perfil e senha', palavras: 'usuário senha login acesso perfil funcionária administrador entrar', componente: Usuarios },
  { id: 'fiscal', grupo: 'dinheiro', nome: 'Fiscal e relatórios', icone: '🧾', descricao: 'Padrão (Bolívia/Brasil), regime, impostos e NIT', palavras: 'fiscal imposto impuesto iva it iue rts nit relatório contabilidade contador regime simples dre estado resultados', componente: ConfigFiscal },
  { id: 'moedas', grupo: 'dinheiro', nome: 'Moedas e câmbio', icone: '💵', descricao: 'Moeda principal e câmbio do dia', palavras: 'moeda câmbio cotação dólar real boliviano taxa conversão', componente: Moedas },
  { id: 'etapas', grupo: 'compras', nome: 'Etapas da compra', icone: '🛒', descricao: 'O caminho do pedido de compra', palavras: 'compra pedido etapa pagamento fotos comprovante fluxo parada', componente: EtapasCompra },
  { id: 'formCompra', grupo: 'compras', nome: 'Formulário de compra', icone: '📝', descricao: 'O que a nova compra pede e em que ordem', palavras: 'formulário compra nova campos ordem obrigatório padrão medidas estado chegada passo simples', componente: ConfigFormCompra },
  { id: 'triagem', grupo: 'estoque', nome: 'Etapas da triagem', icone: '🧺', descricao: 'As colunas do quadro e as cores', palavras: 'triagem coluna quadro cor pronto separar lote kanban', componente: EtapasTriagem },
  { id: 'atributos', grupo: 'estoque', nome: 'Atributos', icone: '🔖', descricao: 'Química, espessura, região…', palavras: 'atributo campo química espessura região lista filtro cor textura', componente: Atributos },
  { id: 'codigos', grupo: 'compras', nome: 'Códigos', icone: '🔢', descricao: 'Como identificar compras e lotes', palavras: 'código número identificação sequência lote compra etiqueta prefixo', componente: ConfigCodigos },
  { id: 'catalogo', grupo: 'estoque', nome: 'Catálogo', icone: '📒', descricao: 'Serviços e produtos com preço', palavras: 'catálogo serviço produto preço duração retorno item', componente: Catalogo },
  { id: 'modulos', grupo: 'sistema', nome: 'Módulos', icone: '🧩', descricao: 'Ligar recursos e criar modalidades', palavras: 'módulo modalidade ligar desligar recurso salão empréstimo', componente: Modulos },
  { id: 'dados', grupo: 'sistema', nome: 'Dados', icone: '💾', descricao: 'Backup e demonstração', palavras: 'backup dados exportar restaurar zerar demonstração armazenamento conferência', componente: Dados },
]

/** seções que ficam sempre só do admin (mexem em acesso, dados e módulos) */
export const CONFIG_SO_ADMIN = new Set(['funcionaria', 'usuarios', 'dados', 'modulos'])

/**
 * As seções que o perfil vê — UMA regra para o menu lateral, o submenu do celular e a tela de Configurações:
 * admin = todas; funcionária (e gerente) = só as liberadas em "O que a funcionária faz" (config.funcionariaConfig).
 */
export function secoesDoPerfil(admin: boolean, liberadas: string[] = []): SecaoConfig[] {
  return admin ? SECOES_CONFIG : SECOES_CONFIG.filter((s) => !CONFIG_SO_ADMIN.has(s.id) && liberadas.includes(s.id))
}

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
