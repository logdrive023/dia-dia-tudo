// EMPRÉSTIMOS: o sistema só registra e calcula o que foi combinado (não é conselho financeiro).
// Saldo devedor = soma dos movimentos (principal + juros − pagamentos).

import { dividirEmPartes, type CodigoMoeda } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import { diasEntre, somarDias, somarMeses } from '../domain/datas'
import type { Emprestimo, Id, MovDivida, Parcela, TipoJuros } from '../domain/tipos'
import { novoId } from '../domain/ids'
import { auditar, type Ctx, exigirInteiroPositivo, novo, tocar } from './contexto'
import { moverCaixa } from './caixa'

export interface JurosEntrada {
  tipo: TipoJuros
  /** % ao mês em pontos-base: 500 = 5% */
  taxaMensalBp?: number
  valorFixo?: number
}

/**
 * Calcula as parcelas. Ex.: R$ 1.000 em 4× com 5% a.m. simples → juros 200 → 4 × R$ 300.
 * Composto usa a tabela Price (parcelas iguais).
 */
export function calcularParcelas(principal: number, juros: JurosEntrada, n: number, primeiroVencimento: string) {
  exigirInteiroPositivo(principal, 'Valor emprestado')
  exigir(Number.isInteger(n) && n >= 1 && n <= 120, 'Número de parcelas entre 1 e 120.')
  const bp = juros.taxaMensalBp ?? 0
  if (juros.tipo === 'simples' || juros.tipo === 'composto') exigir(Number.isInteger(bp) && bp > 0 && bp <= 10000, 'Taxa de juros inválida.')
  let valores: number[]
  if (juros.tipo === 'composto') {
    const i = bp / 10000
    const pmt = Math.round((principal * i) / (1 - Math.pow(1 + i, -n)))
    valores = Array.from({ length: n }, () => pmt)
  } else {
    let jurosTotal = 0
    if (juros.tipo === 'simples') jurosTotal = Math.round((principal * bp * n) / 10000)
    if (juros.tipo === 'fixo') {
      jurosTotal = juros.valorFixo ?? 0
      exigirInteiroPositivo(jurosTotal, 'Valor dos juros', true)
    }
    valores = dividirEmPartes(principal + jurosTotal, n)
  }
  const total = valores.reduce((s, v) => s + v, 0)
  const parcelas: Parcela[] = valores.map((valor, k) => ({ id: novoId(), numero: k + 1, vencimento: somarMeses(primeiroVencimento, k), valor }))
  return { parcelas, total, juros: total - principal }
}

async function moverDivida(ctx: Ctx, e: Emprestimo, m: { id?: Id; delta: number; tipo: MovDivida['tipo']; parcelaId?: Id; forma?: string; descricao?: string }) {
  const movs = await ctx.repos.movDivida.listar({ emprestimoId: e.id })
  const antes = movs.reduce((s, x) => s + x.delta, 0)
  const mov = novo<MovDivida>(ctx, {
    id: m.id,
    emprestimoId: e.id,
    parcelaId: m.parcelaId,
    data: ctx.relogio.hoje(),
    delta: m.delta,
    saldoAntes: antes,
    saldoDepois: antes + m.delta,
    tipo: m.tipo,
    forma: m.forma,
    descricao: m.descricao,
  })
  await ctx.repos.movDivida.salvar(mov)
  return mov
}

export async function criarEmprestimo(
  ctx: Ctx,
  d: {
    id: Id
    direcao: 'dado' | 'tomado'
    pessoaId: Id
    moeda: CodigoMoeda
    principal: number
    juros: JurosEntrada
    parcelas: number
    primeiroVencimento: string
    forma: string
    obs?: string
  },
) {
  if (await ctx.repos.emprestimos.obter(d.id)) return { id: d.id }
  const pessoa = await ctx.repos.pessoas.obter(d.pessoaId)
  exigir(pessoa, 'Escolha a pessoa.', 'pessoaId')
  const calc = calcularParcelas(d.principal, d.juros, d.parcelas, d.primeiroVencimento)
  const e = novo<Emprestimo>(ctx, {
    id: d.id,
    direcao: d.direcao,
    pessoaId: d.pessoaId,
    moeda: d.moeda,
    principal: d.principal,
    juros: d.juros,
    inicio: ctx.relogio.hoje(),
    parcelas: calc.parcelas,
    obs: d.obs,
    situacao: 'aberto',
  })
  await ctx.repos.emprestimos.salvar(e)
  await moverDivida(ctx, e, { delta: d.principal, tipo: 'principal', descricao: 'Valor emprestado' })
  if (calc.juros) await moverDivida(ctx, e, { delta: calc.juros, tipo: 'juros', descricao: 'Juros combinados' })
  // dado: o dinheiro sai do caixa; tomado: entra
  await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: d.moeda,
    forma: d.forma,
    delta: d.direcao === 'dado' ? -d.principal : d.principal,
    tipo: 'emprestimo',
    origemId: e.id,
    descricao: d.direcao === 'dado' ? `Emprestei para ${pessoa.nome}` : `Peguei emprestado de ${pessoa.nome}`,
  })
  await auditar(ctx, 'criarEmprestimo', e.id, `${d.direcao} · ${pessoa.nome}`)
  return { id: e.id }
}

/** Registra um pagamento: abate das parcelas mais antigas primeiro (parcial, adiantado ou atrasado). */
export async function pagarEmprestimo(ctx: Ctx, d: { id: Id; emprestimoId: Id; valor: number; forma: string }) {
  const e = await ctx.repos.emprestimos.obter(d.emprestimoId)
  exigir(e, 'Empréstimo não encontrado.')
  exigir(e.situacao === 'aberto', 'Esse empréstimo já foi encerrado.')
  if ((await ctx.repos.movDivida.listar({ emprestimoId: e.id })).some((m) => m.id.startsWith(`${d.id}-`))) return { id: d.id }
  exigirInteiroPositivo(d.valor, 'Valor do pagamento')
  const situacao = await situacaoDe(ctx, e)
  exigir(d.valor <= situacao.saldo, `O valor passa do que falta (${situacao.saldo}).`)
  let resta = d.valor
  for (const p of situacao.parcelas) {
    if (resta === 0) break
    if (p.falta === 0) continue
    const parte = Math.min(resta, p.falta)
    await moverDivida(ctx, e, { id: `${d.id}-${p.numero}`, delta: -parte, tipo: 'pagamento', parcelaId: p.id, forma: d.forma, descricao: `Pagamento · parcela ${p.numero}` })
    resta -= parte
  }
  const pessoa = await ctx.repos.pessoas.obter(e.pessoaId)
  await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: e.moeda,
    forma: d.forma,
    delta: e.direcao === 'dado' ? d.valor : -d.valor,
    tipo: e.direcao === 'dado' ? 'recebimento' : 'emprestimo',
    origemId: e.id,
    descricao: e.direcao === 'dado' ? `Recebi de ${pessoa?.nome}` : `Paguei a ${pessoa?.nome}`,
  })
  if (situacao.saldo - d.valor === 0) await ctx.repos.emprestimos.salvar(tocar(ctx, { ...e, situacao: 'quitado' }))
  await auditar(ctx, 'pagarEmprestimo', e.id, String(d.valor))
  return { id: d.id }
}

// ---------- mudar o combinado ----------
// Tudo (status, atraso, próxima, painel, agenda, cobrança) sai das parcelas + movimentos da dívida: mudou aqui, muda em
// todo lugar. Regra que nunca quebra: soma das parcelas = saldo + o que já foi pago (conferida no diagnóstico do painel).

type ParcelaPaga = Parcela & { pago: number }
const DATA = /^\d{4}-\d{2}-\d{2}$/

/** põe em ordem de vencimento e numera de novo (1ª, 2ª…) */
function renumerar(ps: Parcela[]): Parcela[] {
  return [...ps].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero).map((p, k) => ({ id: p.id, numero: k + 1, vencimento: p.vencimento, valor: p.valor }))
}

/**
 * Muda o dia e/ou o valor de UMA parcela. O total combinado fica igual: se a parcela diminui, a diferença é dividida
 * nas próximas em aberto (sem próximas, vira uma parcela nova um mês depois da última); se aumenta, sai das últimas.
 * `mudaTotal`: só esta parcela muda e a dívida acompanha (ex.: juros de atraso ou desconto combinados).
 * Ex.: 4 × 300, a 2ª passa para 100 → 1ª 300 · 2ª 100 · 3ª 400 · 4ª 400.
 */
export function replanejarParcela(parcelas: ParcelaPaga[], parcelaId: Id, novo: { vencimento?: string; valor?: number }, mudaTotal = false) {
  const p = parcelas.find((x) => x.id === parcelaId)
  exigir(p, 'Parcela não encontrada.')
  const vencimento = novo.vencimento ?? p.vencimento
  exigir(DATA.test(vencimento), 'Data inválida.', 'vencimento')
  const valor = novo.valor ?? p.valor
  exigirInteiroPositivo(valor, 'Valor da parcela', mudaTotal)
  exigir(valor >= p.pago, `Dessa parcela já foi pago ${p.pago}: o valor não pode ser menor.`, 'valor')
  const lista: ParcelaPaga[] = parcelas.map((x) => (x.id === p.id ? { ...x, vencimento, valor } : { ...x }))
  const diferenca = valor - p.valor
  if (!mudaTotal && diferenca) {
    const seguintes = lista.filter((x) => x.numero > p.numero && x.valor > x.pago).sort((a, b) => a.numero - b.numero)
    if (diferenca < 0) {
      if (seguintes.length) dividirEmPartes(-diferenca, seguintes.length).forEach((v, k) => (seguintes[k].valor += v))
      else {
        const ultima = [...lista].sort((a, b) => b.vencimento.localeCompare(a.vencimento))[0]
        lista.push({ id: novoId(), numero: lista.length + 1, vencimento: somarMeses(ultima.vencimento, 1), valor: -diferenca, pago: 0 })
      }
    } else {
      let tirar = diferenca
      for (const x of [...seguintes].reverse()) {
        const parte = Math.min(tirar, x.valor - x.pago)
        x.valor -= parte
        tirar -= parte
        if (!tirar) break
      }
      exigir(tirar === 0, 'O aumento passa do que falta nas próximas parcelas. Para a dívida crescer junto, marque "Muda o total da dívida".', 'valor')
    }
  }
  return { parcelas: renumerar(lista.filter((x) => x.valor > 0 || x.pago > 0)), diferenca }
}

export async function ajustarParcela(ctx: Ctx, d: { emprestimoId: Id; parcelaId: Id; vencimento?: string; valor?: number; mudaTotal?: boolean; motivo?: string }) {
  const e = await ctx.repos.emprestimos.obter(d.emprestimoId)
  exigir(e, 'Empréstimo não encontrado.')
  exigir(e.situacao === 'aberto', 'Esse empréstimo já foi encerrado.')
  const s = await situacaoDe(ctx, e)
  const antes = s.parcelas.find((p) => p.id === d.parcelaId)
  exigir(antes, 'Parcela não encontrada.')
  const r = replanejarParcela(s.parcelas, d.parcelaId, d, !!d.mudaTotal)
  const mudou = [
    d.vencimento && d.vencimento !== antes.vencimento && `dia ${antes.vencimento} → ${d.vencimento}`,
    r.diferenca && `valor ${antes.valor} → ${antes.valor + r.diferenca}${d.mudaTotal ? ' (a dívida acompanha)' : ' (a diferença nas outras parcelas)'}`,
  ].filter(Boolean)
  if (!mudou.length) return { id: e.id }
  const motivo = d.motivo?.trim()
  if (d.mudaTotal && r.diferenca) await moverDivida(ctx, e, { delta: r.diferenca, tipo: 'ajuste', parcelaId: antes.id, descricao: `Parcela ${antes.numero}: ${r.diferenca > 0 ? 'aumentou' : 'diminuiu'}${motivo ? ` · ${motivo}` : ''}` })
  const saldo = s.saldo + (d.mudaTotal ? r.diferenca : 0)
  await ctx.repos.emprestimos.salvar(tocar(ctx, { ...e, parcelas: r.parcelas, situacao: saldo === 0 ? 'quitado' : 'aberto' }))
  await auditar(ctx, 'ajustarParcela', e.id, `Parcela ${antes.numero}: ${mudou.join('; ')}${motivo ? ` · ${motivo}` : ''}`, [e.pessoaId])
  return { id: e.id }
}

/**
 * EMPRESTAR MAIS no mesmo empréstimo (ex.: emprestei 1.000 e depois mais 1.000). Duas formas:
 *   'novas'  o que já estava combinado continua igual; o valor novo vira parcelas novas no fim
 *   'juntar' o que falta + o valor novo viram um parcelamento só, refeito a partir do 1º vencimento
 * Os juros do valor novo seguem os do empréstimo (ou os informados). Reabre um empréstimo quitado.
 */
export async function aumentarEmprestimo(
  ctx: Ctx,
  d: { id: Id; emprestimoId: Id; valor: number; forma: string; modo: 'novas' | 'juntar'; parcelas: number; primeiroVencimento: string; juros?: JurosEntrada },
) {
  const e = await ctx.repos.emprestimos.obter(d.emprestimoId)
  exigir(e, 'Empréstimo não encontrado.')
  const movs = await ctx.repos.movDivida.listar({ emprestimoId: e.id })
  if (movs.some((m) => m.id === d.id)) return { id: d.id }
  exigir(DATA.test(d.primeiroVencimento), 'Data do 1º vencimento inválida.', 'primeiroVencimento')
  const juros = d.juros ?? (e.juros.tipo === 'fixo' ? { tipo: 'nenhum' as const } : e.juros)
  const calc = calcularParcelas(d.valor, juros, d.parcelas, d.primeiroVencimento)
  const s = await situacaoDe(ctx, e)
  let parcelas: Parcela[]
  if (d.modo === 'juntar') {
    // as já pagas (ou pagas em parte) ficam com o que foi pago; o resto + o novo viram as parcelas novas
    const fechadas = s.parcelas.filter((p) => p.pago > 0).map((p) => ({ ...p, valor: p.pago }))
    const valores = dividirEmPartes(s.saldo + calc.total, d.parcelas)
    parcelas = renumerar([...fechadas, ...valores.map((valor, k) => ({ id: novoId(), numero: 0, vencimento: somarMeses(d.primeiroVencimento, k), valor }))])
  } else parcelas = renumerar([...e.parcelas, ...calc.parcelas])
  const pessoa = await ctx.repos.pessoas.obter(e.pessoaId)
  await moverDivida(ctx, e, { id: d.id, delta: d.valor, tipo: 'principal', descricao: 'Emprestei mais' })
  if (calc.juros) await moverDivida(ctx, e, { delta: calc.juros, tipo: 'juros', descricao: 'Juros do valor a mais' })
  await ctx.repos.emprestimos.salvar(tocar(ctx, { ...e, principal: e.principal + d.valor, parcelas, situacao: 'aberto' }))
  await moverCaixa(ctx, {
    data: ctx.relogio.hoje(),
    moeda: e.moeda,
    forma: d.forma,
    delta: e.direcao === 'dado' ? -d.valor : d.valor,
    tipo: 'emprestimo',
    origemId: e.id,
    descricao: e.direcao === 'dado' ? `Emprestei mais para ${pessoa?.nome}` : `Peguei mais emprestado de ${pessoa?.nome}`,
  })
  await auditar(ctx, 'aumentarEmprestimo', e.id, `+${d.valor} · ${d.modo === 'juntar' ? 'juntou com o que faltava' : 'parcelas novas'} · ${d.parcelas}×`, [e.pessoaId])
  return { id: d.id }
}

// ---------- consultas ----------

export type StatusParcela = 'paga' | 'atrasada' | 'vencendo' | 'em dia'

export function statusParcela(vencimento: string, falta: number, hoje: string): StatusParcela {
  if (falta === 0) return 'paga'
  if (vencimento < hoje) return 'atrasada'
  if (vencimento <= somarDias(hoje, 7)) return 'vencendo'
  return 'em dia'
}

export async function situacaoDe(ctx: Ctx, e: Emprestimo) {
  const hoje = ctx.relogio.hoje()
  const movs = await ctx.repos.movDivida.listar({ emprestimoId: e.id })
  const saldo = movs.reduce((s, m) => s + m.delta, 0)
  const pagoPor = new Map<Id, number>()
  for (const m of movs.filter((x) => x.tipo === 'pagamento' && x.parcelaId)) pagoPor.set(m.parcelaId!, (pagoPor.get(m.parcelaId!) ?? 0) - m.delta)
  const parcelas = [...e.parcelas]
    .sort((a, b) => a.numero - b.numero)
    .map((p) => {
      const pago = pagoPor.get(p.id) ?? 0
      const falta = Math.max(0, p.valor - pago)
      return { ...p, pago, falta, status: statusParcela(p.vencimento, falta, hoje), diasAtraso: falta && p.vencimento < hoje ? diasEntre(p.vencimento, hoje) : 0 }
    })
  const atrasado = parcelas.filter((p) => p.status === 'atrasada').reduce((s, p) => s + p.falta, 0)
  const proxima = parcelas.find((p) => p.falta > 0)
  const recebido = movs.filter((m) => m.tipo === 'pagamento').reduce((s, m) => s - m.delta, 0)
  const status: StatusParcela | 'quitado' = saldo === 0 ? 'quitado' : atrasado ? 'atrasada' : proxima?.status ?? 'em dia'
  return { saldo, parcelas, atrasado, proxima, recebido, movimentos: movs.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)), status, maiorAtraso: Math.max(0, ...parcelas.map((p) => p.diasAtraso)) }
}

export async function emprestimos(ctx: Ctx, p: { direcao?: 'dado' | 'tomado'; pessoaId?: Id; status?: string } = {}) {
  const todos = await ctx.repos.emprestimos.listar()
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((x) => [x.id, x]))
  const lista = []
  for (const e of todos) {
    if (p.direcao && e.direcao !== p.direcao) continue
    if (p.pessoaId && e.pessoaId !== p.pessoaId) continue
    const s = await situacaoDe(ctx, e)
    if (p.status && s.status !== p.status) continue
    lista.push({ ...e, pessoa: pessoas.get(e.pessoaId)?.nome ?? '—', telefone: pessoas.get(e.pessoaId)?.telefone, ...s })
  }
  return lista.sort((a, b) => (a.proxima?.vencimento ?? '9').localeCompare(b.proxima?.vencimento ?? '9'))
}

export async function emprestimo(ctx: Ctx, p: { id: Id }) {
  const e = await ctx.repos.emprestimos.obter(p.id)
  exigir(e, 'Empréstimo não encontrado.')
  const pessoa = await ctx.repos.pessoas.obter(e.pessoaId)
  const anexos = await ctx.repos.anexos.listar({ donoId: e.id })
  return { emprestimo: e, pessoa, anexos, ...(await situacaoDe(ctx, e)) }
}
