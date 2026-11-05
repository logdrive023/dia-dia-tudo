// A FUNCIONÁRIA NÃO VÊ O QUE NÃO PODE (regra do dono): com os dados de exemplo, entra a Sofia (funcionária do Centro)
// e confere consulta por consulta — custo, fornecedor, sócias, salário, comissão das colegas, a venda de outra
// unidade, a linha do tempo (caixa e registro de todos) e a origem do pacote nunca chegam até ela.
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { SENHA_DEMO, carregarDemo } from '../app/demo'
import { criarBackend } from '../app/criarBackend'
import { dataLocal, somarDias } from '../core/domain/datas'

const PROIBIDOS = ['custoPrincipal', 'insumoPrincipal', 'parteSalao', 'salario', 'documento', 'fornecedor', 'cotacoesCompra', 'socios']
const temChave = (v: unknown, chave: string): boolean =>
  Array.isArray(v) ? v.some((x) => temChave(x, chave)) : !!v && typeof v === 'object' && Object.entries(v).some(([k, x]) => (k === chave && x !== undefined && !(Array.isArray(x) && !x.length)) || temChave(x, chave))

async function comSofia() {
  const { backend, sessao } = criarBackend({ tipo: 'memory' })
  const b = backend as BackendNoAparelho
  await carregarDemo(b)
  // o que o administrador vê (para comparar)
  const hoje = dataLocal()
  const de = somarDias(hoje, -60)
  const vendasAdmin = (await b.consulta('agenda', { de, ate: somarDias(hoje, 30) })) as { id: string; profissionalId?: string; localId?: string }[]
  const pessoasAdmin = await b.consulta('pessoas', {})
  Object.assign(sessao, await b.entrar('sofia', SENHA_DEMO))
  return { b, sessao, de, hoje, vendasAdmin, pessoasAdmin }
}

describe('funcionária: só o que é dela', () => {
  it('nenhuma consulta dela traz custo, fornecedor, sócias, salário nem documento', async () => {
    const { b, de, hoje } = await comSofia()
    const respostas: Record<string, unknown> = {
      configuracoes: await b.consulta('configuracoes', {}),
      pessoas: await b.consulta('pessoas', {}),
      estoque: await b.consulta('estoque', {}),
      catalogo: await b.consulta('catalogo', {}),
      agenda: await b.consulta('agenda', { de, ate: hoje }),
      calendario: await b.consulta('calendario', { de, ate: hoje }),
      organograma: await b.consulta('organograma', { de, ate: hoje }),
    }
    for (const [nome, r] of Object.entries(respostas))
      for (const k of PROIBIDOS) expect(temChave(r, k), `${nome} trouxe "${k}"`).toBe(false)
    // a busca do estoque não acha pacote pelo nome da fornecedora
    const est = respostas.estoque as { busca: string }[]
    expect(est.some((i) => i.busca.includes('cecília') || i.busca.includes('helena'))).toBe(false)
  })

  it('pessoas: clientes, ela e a equipe (só o nome); fornecedora e sócia ficam de fora — e a ficha delas é recusada', async () => {
    const { b, pessoasAdmin } = await comSofia()
    const soFornecedora = pessoasAdmin.find((p) => p.papeis.length === 1 && p.papeis[0] === 'fornecedor')!
    const lista = await b.consulta('pessoas', {})
    expect(lista.some((p) => p.id === soFornecedora.id)).toBe(false)
    expect(lista.every((p) => p.papeis.every((x) => ['cliente', 'profissional', 'funcionario'].includes(x)) || p.id === 'p-vero')).toBe(true)
    await expect(b.consulta('fichaPessoa', { id: soFornecedora.id })).rejects.toThrow(/permissão/)
    // e não edita a fornecedora nem cadastra quem não é cliente
    await expect(b.comando('salvarPessoa', { id: soFornecedora.id, nome: 'Outra', papeis: ['fornecedor'] })).rejects.toThrow(/administrador/)
    await expect(b.comando('salvarPessoa', { id: 'nova-f', nome: 'Nova', papeis: ['fornecedor'] })).rejects.toThrow(/administrador/)
  })

  it('o que é só do administrador é recusado: linha do tempo, origem do pacote, unidades e câmbio', async () => {
    const { b, de, hoje, vendasAdmin } = await comSofia()
    const qualquer = vendasAdmin[0].id
    await expect(b.consulta('linhaDoTempo', { id: qualquer })).rejects.toThrow(/permissão/)
    await expect(b.consulta('unidades', { de, ate: hoje })).rejects.toThrow(/permissão/)
    await expect(b.consulta('cambio', {})).rejects.toThrow(/permissão/)
    await expect(b.consulta('origemDaVenda', { vendaId: qualquer })).rejects.toThrow(/permissão/)
  })

  it('venda/atendimento de outra profissional (sem "agenda da equipe") é recusada', async () => {
    const { b, vendasAdmin, sessao } = await comSofia()
    const deOutra = vendasAdmin.find((v) => v.profissionalId && v.profissionalId !== sessao.pessoaId)
    expect(deOutra).toBeTruthy()
    await expect(b.consulta('venda', { id: deOutra!.id })).rejects.toThrow(/permissão/)
    // e os anexos dela também não
    expect(await b.consulta('anexosDe', { donoId: deOutra!.id })).toEqual([])
  })

  it('a configuração que ela recebe não tem sócias, ajustes do câmbio nem o histórico das cotações', async () => {
    const { b } = await comSofia()
    const c = await b.consulta('configuracoes', {})
    expect(c.config.socios).toEqual([])
    expect(c.historico).toEqual([])
    expect(Object.keys(c.config.cambio)).toEqual([])
  })
})
