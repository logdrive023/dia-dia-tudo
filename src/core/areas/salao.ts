// MÓDULO SALÃO: serviços, agenda por profissional e unidade, manutenção do mega hair, comissões.

import { diasEntre, diaDaSemana, somarDias } from '../domain/datas'
import type { DadosPainel, ModuloDef, Secao } from '../modulos'

/** Manutenções: última vez que a cliente fez um serviço com retorno (ex.: mega hair a cada 45 dias). */
export function manutencoes(d: DadosPainel) {
  const servicos = new Map(d.itens.filter((i) => i.moduloId === 'salao' && i.retornoDias).map((i) => [i.id, i]))
  const ultimo = new Map<string, { pessoaId: string; itemId: string; data: string }>()
  for (const t of d.todasTransacoes.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && t.pessoaId)) {
    for (const l of t.linhas) {
      if (!l.itemId || !servicos.has(l.itemId)) continue
      const k = `${t.pessoaId}|${l.itemId}`
      if ((ultimo.get(k)?.data ?? '') < t.data) ultimo.set(k, { pessoaId: t.pessoaId!, itemId: l.itemId, data: t.data })
    }
  }
  return [...ultimo.values()].map((u) => {
    const s = servicos.get(u.itemId)!
    const vence = somarDias(u.data, s.retornoDias!)
    return { ...u, servico: s.nome, cliente: d.pessoas.get(u.pessoaId)?.nome ?? '—', telefone: d.pessoas.get(u.pessoaId)?.telefone, vence, dias: diasEntre(d.hoje, vence) }
  })
}

function painelSalao(d: DadosPainel): Secao[] {
  const linhas = d.vendas.flatMap((t) => t.linhas.filter((l) => d.moduloDoItem(l.itemId) === 'salao').map((l) => ({ t, l })))
  const atendimentos = new Set(linhas.map((x) => x.t.id)).size
  const faturamento = linhas.reduce((s, x) => s + x.l.totalPrincipal, 0)
  const comissoes = linhas.reduce((s, x) => s + (x.l.comissaoPrincipal ?? 0), 0)
  const insumos = linhas.reduce((s, x) => s + (x.l.insumoPrincipal ?? 0), 0)
  // receita × insumos por serviço: o que sobra para o salão depois dos insumos e da comissão
  const porServicoIns = new Map<string, { n: number; r: number; i: number; c: number }>()
  for (const { l } of linhas) {
    const a = porServicoIns.get(l.descricao) ?? { n: 0, r: 0, i: 0, c: 0 }
    a.n++
    a.r += l.totalPrincipal
    a.i += l.insumoPrincipal ?? 0
    a.c += l.comissaoPrincipal ?? 0
    porServicoIns.set(l.descricao, a)
  }
  const agendados = d.todasTransacoes.filter((t) => t.tipo === 'venda' && t.etapa === 'agendado' && t.data >= d.hoje).length
  const clientesPeriodo = new Set(linhas.map((x) => x.t.pessoaId).filter(Boolean))
  const antes = new Set(
    d.todasTransacoes.filter((t) => t.tipo === 'venda' && t.etapa === 'concluido' && t.data < d.de && t.pessoaId).map((t) => t.pessoaId),
  )
  const novos = [...clientesPeriodo].filter((c) => !antes.has(c)).length
  const porServico = new Map<string, number>()
  for (const { l } of linhas) porServico.set(l.descricao, (porServico.get(l.descricao) ?? 0) + l.totalPrincipal)
  const porProf = new Map<string, { n: number; v: number; c: number }>()
  for (const { t, l } of linhas) {
    const id = l.profissionalId ?? t.profissionalId
    const nome = (id && d.pessoas.get(id)?.nome) || 'Sem profissional'
    const a = porProf.get(nome) ?? { n: 0, v: 0, c: 0 }
    a.n++
    a.v += l.totalPrincipal
    a.c += l.comissaoPrincipal ?? 0
    porProf.set(nome, a)
  }
  const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
  const horas = ['08–10', '10–12', '12–14', '14–16', '16–18', '18–20']
  const mapa = horas.map(() => dias.map(() => 0))
  for (const t of d.vendas.filter((x) => x.agendadoPara)) {
    const h = new Date(t.agendadoPara!).getHours()
    const hi = Math.min(5, Math.max(0, Math.floor((h - 8) / 2)))
    mapa[hi][dias.indexOf(diaDaSemana(t.data))]++
  }
  const man = manutencoes(d)
  const atrasadas = man.filter((m) => m.dias < 0)
  const proximas = man.filter((m) => m.dias >= 0 && m.dias <= 7)
  const cabeloUsado = d.vendas
    .filter((t) => t.linhas.some((l) => d.moduloDoItem(l.itemId) === 'salao'))
    .flatMap((t) => t.linhas.filter((l) => d.moduloDoItem(l.itemId) === 'cabelo'))
    .reduce((s, l) => s + l.quantidade, 0)
  return [
    {
      tipo: 'cartoes',
      titulo: 'Salão no período',
      cartoes: [
        { id: 'sal.atend', nome: 'Atendimentos', valor: atendimentos, formato: 'numero', ajuda: 'Atendimentos concluídos.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: 'salao' } } },
        { id: 'sal.fat', nome: 'Faturamento', valor: faturamento, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Soma dos serviços feitos.', detalhe: { tela: 'vendas', filtro: { de: d.de, ate: d.ate, moduloId: 'salao' } } },
        { id: 'sal.ticket', nome: 'Ticket médio', valor: atendimentos ? Math.round(faturamento / atendimentos) : 0, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Faturamento ÷ atendimentos.' },
        { id: 'sal.comissao', nome: 'Comissões a pagar', valor: comissoes, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Parte de cada profissional sobre a base (valor − insumos). Ex.: Tintura Bs 300 − insumos Bs 20 = 280 × 50% = Bs 140.' },
        { id: 'sal.insumos', nome: 'Insumos dos serviços', valor: insumos, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Tinta, água oxigenada, descolorante… usados nos serviços: custo do salão, descontado antes da comissão.' },
        { id: 'sal.margem', nome: 'Margem do salão', valor: faturamento - insumos - comissoes, formato: 'dinheiro', moeda: d.moedaPrincipal, ajuda: 'Faturamento − insumos − comissões.' },
        { id: 'sal.agendados', nome: 'Agendados', valor: agendados, formato: 'numero', ajuda: 'Atendimentos marcados de hoje em diante.', detalhe: { tela: 'agenda' } },
        { id: 'sal.novos', nome: 'Clientes novas', valor: novos, formato: 'numero', ajuda: 'Clientes que vieram pela primeira vez no período.' },
        { id: 'sal.cabelo', nome: 'Cabelo usado', valor: cabeloUsado, formato: 'gramas', ajuda: 'Gramas de cabelo do estoque usadas em serviços (mega hair).' },
        { id: 'sal.manut', nome: 'Manutenções atrasadas', valor: atrasadas.length, formato: 'numero', ajuda: 'Clientes que passaram do dia de voltar (ex.: manutenção do mega hair).', destaque: atrasadas.length ? 'alerta' : undefined },
      ],
    },
    {
      tipo: 'tabela',
      titulo: 'Profissionais',
      colunas: [
        { id: 'nome', nome: 'Profissional' },
        { id: 'n', nome: 'Serviços', formato: 'numero' },
        { id: 'v', nome: 'Faturamento', formato: 'dinheiro' },
        { id: 'c', nome: 'Comissão', formato: 'dinheiro' },
      ],
      linhas: [...porProf].sort((a, b) => b[1].v - a[1].v).map(([nome, a]) => ({ valores: { nome, n: a.n, v: a.v, c: a.c } })),
    },
    {
      tipo: 'tabela',
      titulo: 'Serviços: receita × insumos',
      ajuda: 'Por serviço: receita, insumos do salão, comissão das profissionais e o que sobra para o salão.',
      colunas: [
        { id: 'nome', nome: 'Serviço' },
        { id: 'n', nome: 'Feitos', formato: 'numero' },
        { id: 'r', nome: 'Receita', formato: 'dinheiro' },
        { id: 'i', nome: 'Insumos', formato: 'dinheiro' },
        { id: 'c', nome: 'Comissão', formato: 'dinheiro' },
        { id: 'm', nome: 'Margem do salão', formato: 'dinheiro' },
      ],
      linhas: [...porServicoIns].sort((a, b) => b[1].r - a[1].r).map(([nome, a]) => ({ valores: { nome, n: a.n, r: a.r, i: a.i, c: a.c, m: a.r - a.i - a.c } })),
    },
    { tipo: 'barras', titulo: 'Faturamento por serviço', formato: 'dinheiro', itens: [...porServico].sort((a, b) => b[1] - a[1]).map(([rotulo, valor]) => ({ rotulo, valor })) },
    { tipo: 'mapa', titulo: 'Movimento: hora × dia da semana', ajuda: 'Atendimentos agendados por horário (para montar escala).', formato: 'numero', linhas: horas, colunas: dias, valores: mapa },
    {
      tipo: 'tabela',
      titulo: 'Manutenções (próximos 7 dias e atrasadas)',
      colunas: [
        { id: 'cliente', nome: 'Cliente' },
        { id: 'servico', nome: 'Serviço' },
        { id: 'vence', nome: 'Volta em' },
        { id: 'dias', nome: 'Dias', formato: 'numero' },
      ],
      linhas: [...atrasadas, ...proximas].sort((a, b) => a.dias - b.dias).map((m) => ({ valores: { cliente: m.cliente, servico: m.servico, vence: m.vence.split('-').reverse().join('/'), dias: m.dias }, detalhe: { tela: 'pessoa', filtro: { id: m.pessoaId } } })),
    },
  ]
}

export const moduloSalao: ModuloDef = {
  id: 'salao',
  nome: 'Salão',
  icone: '✂️',
  descricao: 'Serviços, agenda por profissional e unidade, comissões e manutenção.',
  tiposItem: [
    {
      id: 'servico',
      nome: 'Serviço',
      unidade: 'servico',
      controlaEstoque: false,
      campos: [{ id: 'categoria', nome: 'Tipo', tipo: 'lista', opcoes: ['Corte', 'Cor', 'Tratamento', 'Mega hair', 'Escova', 'Estética', 'Unhas', 'Maquiagem', 'Penteado', 'Barba', 'Outro'] }],
    },
  ],
  venda: {
    pergunta: 'É serviço?',
    ajuda: 'Atendimento no salão: endereço, cliente, o que vai fazer e quem atende. Pode agendar.',
    tiposItem: ['servico'],
    atendimento: true,
    usaTambem: ['cabelo'],
  },
  painel: painelSalao,
  alertas: (d) => {
    const man = manutencoes(d)
    return [{ id: 'sal.manut', texto: 'manutenção(ões) de cliente atrasada(s)', quantidade: man.filter((m) => m.dias < 0).length, nivel: 'info', detalhe: { tela: 'agenda' } }]
  },
}
