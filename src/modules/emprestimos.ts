// MÓDULO EMPRÉSTIMOS: carteira, parcelas, atraso por faixa e cobrança. Tela própria (não é compra nem venda).

import type { Id } from '../core/domain/tipos'
import type { DadosPainel, ModuloDef, Secao } from '../core/modulos'
import { statusParcela } from '../core/services/emprestimos'

export function situacoes(d: DadosPainel) {
  return d.emprestimos
    .filter((e) => e.situacao !== 'cancelado')
    .map((e) => {
      const movs = d.movDivida.filter((m) => m.emprestimoId === e.id)
      const saldo = movs.reduce((s, m) => s + m.delta, 0)
      const pago = new Map<Id, number>()
      for (const m of movs.filter((x) => x.tipo === 'pagamento' && x.parcelaId)) pago.set(m.parcelaId!, (pago.get(m.parcelaId!) ?? 0) - m.delta)
      const parcelas = e.parcelas.map((p) => {
        const falta = Math.max(0, p.valor - (pago.get(p.id) ?? 0))
        return { ...p, falta, status: statusParcela(p.vencimento, falta, d.hoje) }
      })
      const recebidoNoPeriodo = -movs.filter((m) => m.tipo === 'pagamento' && m.data >= d.de && m.data <= d.ate).reduce((s, m) => s + m.delta, 0)
      return { e, saldo, parcelas, recebidoNoPeriodo, conv: (v: number) => d.paraPrincipal(v, e.moeda) }
    })
}

function painelEmprestimos(d: DadosPainel): Secao[] {
  const sit = situacoes(d)
  const dados = sit.filter((s) => s.e.direcao === 'dado')
  const tomados = sit.filter((s) => s.e.direcao === 'tomado')
  const soma = (xs: typeof sit, f: (s: (typeof sit)[number]) => number) => xs.reduce((a, s) => a + s.conv(f(s)), 0)
  const carteira = soma(dados, (s) => s.saldo)
  const atrasado = soma(dados, (s) => s.parcelas.filter((p) => p.status === 'atrasada').reduce((a, p) => a + p.falta, 0))
  const faixas = [
    ['1–15 dias', 1, 15],
    ['16–30 dias', 16, 30],
    ['31–60 dias', 31, 60],
    ['mais de 60', 61, 99999],
  ] as const
  const atrasoFaixa = faixas.map(([rotulo, a, b]) => ({
    rotulo,
    valor: soma(dados, (s) =>
      s.parcelas
        .filter((p) => p.status === 'atrasada')
        .filter((p) => {
          const dias = Math.round((Date.parse(d.hoje) - Date.parse(p.vencimento)) / 86400000)
          return dias >= a && dias <= b
        })
        .reduce((x, p) => x + p.falta, 0),
    ),
  }))
  const vencer = (dias: number) =>
    soma(dados, (s) => s.parcelas.filter((p) => p.falta && p.vencimento >= d.hoje && Date.parse(p.vencimento) - Date.parse(d.hoje) <= dias * 86400000).reduce((x, p) => x + p.falta, 0))
  const porPessoa = new Map<string, { saldo: number; atrasado: number; pessoaId: Id }>()
  for (const s of dados.filter((x) => x.saldo > 0)) {
    const nome = d.pessoas.get(s.e.pessoaId)?.nome ?? '—'
    const a = porPessoa.get(nome) ?? { saldo: 0, atrasado: 0, pessoaId: s.e.pessoaId }
    a.saldo += s.conv(s.saldo)
    a.atrasado += s.conv(s.parcelas.filter((p) => p.status === 'atrasada').reduce((x, p) => x + p.falta, 0))
    porPessoa.set(nome, a)
  }
  return [
    {
      tipo: 'cartoes',
      titulo: 'Empréstimos',
      cartoes: [
        { id: 'emp.carteira', nome: 'A receber', valor: carteira, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Tudo que falta receber dos empréstimos que você deu.', detalhe: { tela: 'emprestimos', filtro: { direcao: 'dado' } } },
        { id: 'emp.atraso', nome: 'Em atraso', valor: atrasado, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Parcelas vencidas e não pagas.', detalhe: { tela: 'emprestimos', filtro: { status: 'atrasada' } }, destaque: atrasado ? 'ruim' : undefined },
        { id: 'emp.pctAtraso', nome: '% em atraso', valor: carteira ? Math.round((atrasado / carteira) * 10000) : 0, formato: 'percentual', ajuda: 'Atrasado ÷ a receber.' },
        { id: 'emp.7', nome: 'Vence em 7 dias', valor: vencer(7), formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Parcelas que vencem na próxima semana.', detalhe: { tela: 'emprestimos', filtro: { status: 'vencendo' } } },
        { id: 'emp.30', nome: 'Vence em 30 dias', valor: vencer(30), formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Parcelas que vencem no próximo mês.' },
        { id: 'emp.recebido', nome: 'Recebido no período', valor: soma(dados, (s) => s.recebidoNoPeriodo), formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Pagamentos de empréstimo que entraram no período.' },
        { id: 'emp.devo', nome: 'Eu devo', valor: soma(tomados, (s) => s.saldo), formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'O que falta pagar dos empréstimos que você pegou.', detalhe: { tela: 'emprestimos', filtro: { direcao: 'tomado' } } },
      ],
    },
    { tipo: 'barras', titulo: 'Atraso por faixa', formato: 'dinheiro', itens: atrasoFaixa.map((f) => ({ rotulo: f.rotulo, valor: f.valor, detalhe: { tela: 'emprestimos', filtro: { status: 'atrasada' } } })) },
    {
      tipo: 'tabela',
      titulo: 'Quem deve',
      colunas: [
        { id: 'nome', nome: 'Pessoa' },
        { id: 'saldo', nome: 'Falta', formato: 'dinheiro' },
        { id: 'atrasado', nome: 'Atrasado', formato: 'dinheiro' },
      ],
      linhas: [...porPessoa].sort((a, b) => b[1].saldo - a[1].saldo).map(([nome, a]) => ({ valores: { nome, saldo: a.saldo, atrasado: a.atrasado }, detalhe: { tela: 'pessoa', filtro: { id: a.pessoaId } } })),
    },
  ]
}

export const moduloEmprestimos: ModuloDef = {
  id: 'emprestimos',
  nome: 'Empréstimos',
  icone: '🤝',
  descricao: 'Dinheiro emprestado e pego emprestado, com parcelas, atraso e cobrança.',
  tiposItem: [],
  telaPropria: 'emprestimos',
  painel: painelEmprestimos,
}
