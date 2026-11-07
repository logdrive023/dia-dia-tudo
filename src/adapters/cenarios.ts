// MODO TESTE: cenários prontos e "zerar tudo" (só no modo "neste aparelho").
// Os cenários entram pelos MESMOS comandos das telas (as contas batem, as permissões valem): nada de JSON injetado
// direto no banco. Cenário novo = um item em CENARIOS + um `case` em carregarCenario (+ teste em cenarios.test.ts).

import type { BackendNoAparelho } from './noAparelho'
import { SENHA_DEMO, carregarDemo } from './demo'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import type { DadosComando, NomeComando } from '../core/services'

export type CenarioId = 'loja' | 'turnoErro' | 'vazio'

/** a lista que a tela mostra (textos em PT; a tradução vai em es.ts) */
export const CENARIOS: { id: CenarioId; icone: string; nome: string; descricao: string }[] = [
  { id: 'loja', icone: '🏪', nome: 'Loja cheia', descricao: 'Cabelo no estoque, tabelas de preço, compras, vendas, salão e usuários (senha demo1234).' },
  { id: 'turnoErro', icone: '🧮', nome: 'Turno com erro de caixa', descricao: 'A loja cheia + controle de turno ligado: Paula fechou um turno com Bs 50 a menos e está com outro aberto.' },
  { id: 'vazio', icone: '📭', nome: 'Começar do zero', descricao: 'Sem nenhum dado: só o usuário admin (senha demo1234) para entrar e cadastrar do começo.' },
]

const bs = (v: number) => Math.round(v * 100)

// MONTANDO: enquanto o cenário troca os dados, o banco fica um instante sem usuários. Sem esta trava, o primeiro uso
// (app/Moldura.tsx › Preparar) achava que o aparelho é novo e montava a demonstração AO MESMO TEMPO (dados misturados).
let montando = 0
export const montandoCenario = () => montando > 0

/** troca os dados deste aparelho pelos do cenário (apaga o que havia) */
export async function carregarCenario(b: BackendNoAparelho, id: CenarioId) {
  montando++
  try {
    await montar(b, id)
  } finally {
    montando--
  }
}

async function montar(b: BackendNoAparelho, id: CenarioId) {
  switch (id) {
    case 'loja':
      return carregarDemo(b)
    case 'turnoErro':
      await carregarDemo(b)
      return montarTurnoComErro(b)
    case 'vazio':
      // sem nenhum usuário ninguém entra (neste aparelho não há cadastro do 1º admin): fica só o admin
      await b.limparTudo()
      return b.comoSistema(() => b.comando('salvarUsuario', { id: 'u-admin', login: 'admin', nome: 'Administrador', perfil: 'admin', senha: SENHA_DEMO }))
  }
}

/**
 * Paula (gerente do Centro) com o controle de turno ligado:
 *  1º turno (fechado): troco Bs 200 + 2 vendas em dinheiro (Bs 300 + Bs 150) = esperado Bs 650; contou Bs 600 → falta Bs 50
 *  2º turno (aberto):  troco Bs 200 + 1 venda em dinheiro (Bs 250) → para testar o fechamento
 */
async function montarTurnoComErro(b: BackendNoAparelho) {
  const agora = Date.now()
  const haHoras = (h: number) => new Date(agora - h * 3_600_000).toISOString()
  const c = <N extends NomeComando>(h: number, nome: N, dados: DadosComando<N>) => b.comandoEm(haHoras(h), nome, dados)

  // o que tem para vender: lotes de cabelo com saldo (escolhidos como Sistema, que vê tudo)
  const lotes = await b.comoSistema(async () => {
    await c(7, 'salvarConfig', { controleTurno: true })
    return (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.saldo >= 100).map((i) => i.id)
  })
  if (lotes.length < 3) throw new Error('Cenário: faltam lotes com saldo nos dados de exemplo.')

  const paula = { usuarioId: 'u-paula', nome: 'Paula (gerente Centro)', login: 'paula', perfil: 'funcionario' as const, pessoaId: 'p-mariana', localId: 'loc-centro' }
  const vender = (h: number, lote: Id, valor: number) => {
    const id = novoId()
    return c(h, 'concluirVenda', {
      id,
      pessoaId: 'p-ana',
      linhas: [{ id: novoId(), itemId: lote, quantidade: 100, moeda: 'BOB', total: bs(valor) }],
      pagamentos: [{ id: novoId(), forma: 'dinheiro', moeda: 'BOB', valor: bs(valor) }],
    })
  }
  await b.comoUsuario(paula, async () => {
    await c(6, 'abrirTurno', { id: 'turno-teste-1', trocoInicial: { BOB: bs(200) } })
    await vender(5, lotes[0], 300)
    await vender(4, lotes[1], 150)
    await c(3, 'fecharTurno', { id: 'turno-teste-1', contado: { BOB: bs(600) }, obs: 'Cenário de teste: faltaram Bs 50' })
    await c(2, 'abrirTurno', { id: 'turno-teste-2', trocoInicial: { BOB: bs(200) } })
    await vender(1, lotes[2], 250)
  })
}

/**
 * ZERAR TUDO: apaga os dados deste aparelho (banco do navegador e arquivos) E as preferências do app (chaves
 * "tudo…" do localStorage e do sessionStorage: sessão, idioma, filtros, modo dos dados) e recarrega como no primeiro
 * uso deste aparelho (que monta os dados de exemplo de novo).
 */
export async function zerarAparelho(b: BackendNoAparelho, recarregar = () => window.location.reload()) {
  montando++ // até recarregar: não monta a demonstração por cima nesta aba
  await b.limparTudo()
  for (const area of [localStorage, sessionStorage]) {
    try {
      for (const k of Object.keys(area)) if (k.startsWith('tudo')) area.removeItem(k)
    } catch {
      /* modo privado: o banco já foi limpo */
    }
  }
  recarregar()
}
