// O MAPA DAS TELAS (rota → componente) e QUEM PODE ABRIR (só o administrador). Um lugar só: o App e a Tela leem daqui.
// Cada domínio é um pedaço separado do pacote, baixado só quando a tela abre (o Suspense fica na Tela, em Moldura.tsx).
import { type ComponentType, lazy } from 'react'
import { Config } from '../features/config'
import { MENU } from './Shell'

const MARCA_RECARGA = 'tudo.recarregouPedaco'

/** publicou versão nova com a aba aberta: o pedaço antigo não existe mais → recarrega uma vez e já pega o novo */
function comRecarga<M>(carregar: () => Promise<M>): Promise<M> {
  return carregar().then(
    (m) => {
      try { sessionStorage.removeItem(MARCA_RECARGA) } catch { /* modo privado */ }
      return m
    },
    (e) => {
      let ja = true
      try {
        ja = !!sessionStorage.getItem(MARCA_RECARGA)
        sessionStorage.setItem(MARCA_RECARGA, '1')
      } catch { /* modo privado: não recarrega */ }
      if (ja) throw e
      window.location.reload()
      return new Promise<M>(() => undefined)
    },
  )
}

const tela = <M,>(carregar: () => Promise<M>, escolher: (m: M) => ComponentType): ComponentType => lazy(() => comRecarga(carregar).then((m) => ({ default: escolher(m) })))

const lote = () => import('../features/lote')
const vitrine = () => import('../features/vitrine')
const equipe = () => import('../features/equipe')
const cadastros = () => import('../features/cadastros')
const caixa = () => import('../features/caixa')
const compra = () => import('../features/compra')
const financeiro = () => import('../features/financeiro')
const estoque = () => import('../features/estoque')
const triagem = () => import('../features/triagem')
const venda = () => import('../features/venda')
const viagem = () => import('../features/viagem')
const auditoria = () => import('../features/auditoria')
const agenda = () => import('../features/agenda')
const painel = () => import('../features/painel')
const precos = () => import('../features/precos')
const relatorio = () => import('../features/relatorio')
const novidades = () => import('../features/novidades')

// a mesma tela em duas rotas usa a mesma peça (trocar de rota não remonta)
const Vender = tela(venda, (m) => m.Vender)
const Precos = tela(precos, (m) => m.Precos)
export const Painel = tela(painel, (m) => m.Painel)
export const Agenda = tela(agenda, (m) => m.Agenda)
export const PacoteVenda = tela(lote, (m) => m.PacoteVenda)

export const TELAS: Record<string, ComponentType> = {
  painel: Painel,
  vender: Vender,
  vendaRapida: tela(caixa, (m) => m.VendaRapida),
  comprar: tela(compra, (m) => m.Comprar),
  pedido: tela(compra, (m) => m.Pedido),
  novaCompra: tela(compra, (m) => m.NovaCompraTela),
  triagem: tela(triagem, (m) => m.Triagem),
  etiquetas: tela(estoque, (m) => m.Etiquetas),
  livro: tela(estoque, (m) => m.Livro),
  estoque: tela(estoque, (m) => m.Estoque),
  lote: tela(lote, (m) => m.FichaLote),
  rastreio: tela(lote, (m) => m.Rastreio),
  caixa: tela(caixa, (m) => m.Caixa),
  agenda: Agenda,
  equipe: tela(equipe, (m) => m.Equipe),
  pessoas: tela(cadastros, (m) => m.Pessoas),
  pessoa: tela(cadastros, (m) => m.FichaPessoa),
  emprestimos: tela(financeiro, (m) => m.Emprestimos),
  emprestimo: tela(financeiro, (m) => m.FichaEmprestimo),
  novoEmprestimo: tela(financeiro, (m) => m.CadastroEmprestimo),
  separar: tela(triagem, (m) => m.SepararTela),
  precos: Precos,
  tabelaPreco: Precos,
  relatorios: tela(relatorio, (m) => m.Relatorios),
  novidades: tela(novidades, (m) => m.Novidades),
  auditoria: tela(auditoria, (m) => m.Auditoria),
  config: Config,
  configSecao: Config,
  vendas: Vender,
  venda: tela(venda, (m) => m.DetalheVenda),
  viagens: tela(viagem, (m) => m.Viagens),
  vitrine: tela(vitrine, (m) => m.MinhaVitrine),
  qr: tela(lote, (m) => m.AbrirQr),
  viagem: tela(viagem, (m) => m.FichaViagem),
  adiantamentos: tela(financeiro, (m) => m.Financiamentos),
  financiamento: tela(financeiro, (m) => m.FichaFinanciamento),
  novoFinanciamento: tela(financeiro, (m) => m.CadastroAdiantamento),
  novaPessoa: tela(cadastros, (m) => m.NovaPessoaTela),
  novoFuncionario: tela(equipe, (m) => m.NovoFuncionarioTela),
  novaViagem: tela(viagem, (m) => m.NovaViagemTela),
}

/** telas só do administrador (as do menu marcadas como admin + as fichas e formulários delas) */
export const SO_ADMIN = new Set([...MENU.filter((m) => m.admin).map((m) => m.tela), 'rastreio', 'emprestimo', 'vendas', 'pedido', 'novaCompra', 'tabelaPreco', 'novoEmprestimo', 'separar', 'novoFuncionario', 'viagem', 'novaViagem', 'novoFinanciamento'])

/** a tela inicial de cada perfil */
export const telaInicial = (perfil: string | undefined) => (perfil === 'admin' ? 'painel' : 'agenda')
