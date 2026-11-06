// METAS DO MÊS (Configurações › Metas · Painel · Vender): tudo configurável pelo administrador.
//   · cada meta: um ALVO (a empresa, uma unidade ou uma pessoa), um INDICADOR (faturamento, nº de vendas ou
//     atendimentos do salão) e o VALOR do mês; dá para desligar uma meta sem apagar
//   · onde aparece: no Painel (liga/desliga), com ou sem o valor (só a %); para a funcionária, as metas DELA e da
//     unidade dela (liga/desliga), também com ou sem o valor
// Realizado = vendas CONCLUÍDAS do mês corrente. Pessoa: as linhas em que ela é a vendedora/profissional.
// Ex.: meta da Sofia, faturamento Bs 12.000; vendeu Bs 9.000 até o dia 20 → 75%, faltam Bs 3.000 (Bs 300/dia em 10 dias).
import { exigir } from '../domain/erros'
import { diasEntre } from '../domain/datas'
import { novoId } from '../domain/ids'
import type { Id, Transacao } from '../domain/tipos'
import { type Ctx, lerConfig, euPessoa } from './contexto'

export type IndicadorMeta = 'faturamento' | 'vendas' | 'atendimentos'
export interface Meta {
  id: Id
  nome?: string
  alvo: 'empresa' | 'unidade' | 'pessoa'
  alvoId?: Id
  indicador: IndicadorMeta
  /** faturamento: centavos na moeda principal; vendas/atendimentos: quantidade */
  valor: number
  ativa: boolean
}
export interface ConfigMetas {
  /** mostrar no Painel */
  painel: boolean
  /** mostrar o valor da meta e do realizado (senão só a %) */
  mostrarValor: boolean
  /** a funcionária vê as metas dela e da unidade dela (na tela Vender) */
  funcionaria: boolean
  /** a funcionária vê o valor (senão só a %) */
  funcionariaValor: boolean
  itens: Meta[]
}
export const METAS_PADRAO: ConfigMetas = { painel: true, mostrarValor: true, funcionaria: false, funcionariaValor: false, itens: [] }

export function validarMetas(m: ConfigMetas) {
  for (const x of m.itens ?? []) {
    exigir(['empresa', 'unidade', 'pessoa'].includes(x.alvo), 'Meta: escolha de quem é (empresa, unidade ou pessoa).')
    exigir(x.alvo === 'empresa' || x.alvoId, x.alvo === 'unidade' ? 'Meta: escolha a unidade.' : 'Meta: escolha a pessoa.')
    exigir(['faturamento', 'vendas', 'atendimentos'].includes(x.indicador), 'Meta: escolha o que medir.')
    exigir(Number.isInteger(x.valor) && x.valor > 0, 'Meta: o valor precisa ser maior que zero.')
  }
  return { ...METAS_PADRAO, ...m, itens: (m.itens ?? []).map((x) => ({ ...x, id: x.id || novoId() })) }
}

const ultimoDia = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()

/** o que a linha/venda conta para o indicador e para a pessoa */
function medir(t: Transacao, ind: IndicadorMeta, pessoa?: Id, ehServico?: (itemId?: Id) => boolean) {
  const dela = (l: Transacao['linhas'][number]) => !pessoa || (l.profissionalId ?? t.profissionalId) === pessoa
  const linhas = t.linhas.filter(dela)
  if (!linhas.length) return 0
  if (ind === 'faturamento') return linhas.reduce((s, l) => s + l.totalPrincipal, 0)
  if (ind === 'vendas') return 1
  return linhas.filter((l) => ehServico?.(l.itemId)).length
}

export async function metas(ctx: Ctx, _p: object = {}) {
  const cfg = await lerConfig(ctx)
  const conf: ConfigMetas = { ...METAS_PADRAO, ...(cfg.metas ?? {}) }
  const admin = ctx.sessao.perfil === 'admin'
  const hoje = ctx.relogio.hoje()
  const [ano, mes] = hoje.split('-').map(Number)
  const de = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ate = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia(ano, mes)).padStart(2, '0')}`
  const diasRestantes = Math.max(0, diasEntre(hoje, ate))
  const eu = euPessoa(ctx)
  const visivel = (m: Meta) => m.ativa && (admin || (conf.funcionaria && ((m.alvo === 'pessoa' && m.alvoId === eu) || (m.alvo === 'unidade' && !!ctx.sessao.localId && m.alvoId === ctx.sessao.localId))))
  const lista = conf.itens.filter(visivel)
  const verValor = admin ? conf.mostrarValor : conf.funcionariaValor
  if (!lista.length) return { mes: de.slice(0, 7), diasRestantes, mostrar: admin ? conf.painel : conf.funcionaria, verValor, moeda: cfg.moedaPrincipal, metas: [] }
  const vendas = (await ctx.repos.transacoes.listar({ tipo: 'venda' })).filter((t) => t.etapa === 'concluido' && t.data >= de && t.data <= ate)
  const itens = new Map((await ctx.repos.itens.listar()).map((i) => [i.id, i]))
  const ehServico = (id?: Id) => !!id && itens.get(id)?.unidade === 'servico'
  const pessoas = new Map((await ctx.repos.pessoas.listar()).map((p) => [p.id, p.nome]))
  const locais = new Map((await ctx.repos.locais.listar()).map((l) => [l.id, l.apelido || l.nome]))
  return {
    mes: de.slice(0, 7),
    diasRestantes,
    mostrar: admin ? conf.painel : conf.funcionaria,
    verValor,
    moeda: cfg.moedaPrincipal,
    metas: lista.map((m) => {
      const conta = vendas.filter((t) => m.alvo !== 'unidade' || t.localId === m.alvoId)
      const realizado = conta.reduce((s, t) => s + medir(t, m.indicador, m.alvo === 'pessoa' ? m.alvoId : undefined, ehServico), 0)
      const pctBp = Math.round((realizado * 10000) / m.valor)
      const falta = Math.max(0, m.valor - realizado)
      const alvoNome = m.alvo === 'empresa' ? 'Empresa' : m.alvo === 'unidade' ? locais.get(m.alvoId!) ?? '—' : pessoas.get(m.alvoId!) ?? '—'
      return {
        id: m.id,
        nome: m.nome || alvoNome,
        alvo: m.alvo,
        alvoNome,
        indicador: m.indicador,
        pctBp,
        batida: realizado >= m.valor,
        // sem permissão de ver o valor: só a %
        ...(verValor ? { valor: m.valor, realizado, falta, porDia: diasRestantes ? Math.ceil(falta / (diasRestantes + 1)) : falta } : {}),
      }
    }),
  }
}
