// Regressões da OPERAÇÃO CAOS (concorrência, auditoria e unidades): pequenos e rápidos (backend em memória).
// CAOS-C-05..C-13, CAOS-D-01..D-03 e D-05 (índice de códigos por comando / transação que só copia o que mudou).
import { describe, expect, it } from 'vitest'
import type { BackendNoAparelho } from '../adapters/noAparelho'
import { criarReposMemoria } from '../adapters/memory/memoria'
import { bs, novoBackend } from './ajuda'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any
const repos = (b: BackendNoAparelho) => (b as unknown as { repos: Q }).repos
const auditoria = async (b: BackendNoAparelho, acao: string) => ((await repos(b).auditoria.listar()) as Q[]).filter((a) => a.acao === acao)
const ALTERADO = /alterado por outra pessoa/

describe('LOST UPDATE: formulário velho é recusado (versaoBase)', () => {
  it('C-05 salvarPessoa: versão velha recusa; o registro velho inteiro (com versao) também; a versão certa grava', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p', nome: 'Ana', papeis: ['cliente'], telefone: '111' })
    const velho = await repos(b).pessoas.obter('p')
    await b.comando('salvarPessoa', { id: 'p', nome: 'Ana', papeis: ['cliente'], telefone: '999', versaoBase: velho.versao })
    await expect(b.comando('salvarPessoa', { id: 'p', nome: 'Ana', papeis: ['cliente'], telefone: '111', obs: 'x', versaoBase: velho.versao })).rejects.toThrow(ALTERADO)
    await expect(b.comando('salvarPessoa', { ...velho, obs: 'x' })).rejects.toThrow(ALTERADO)
    expect((await repos(b).pessoas.obter('p')).telefone).toBe('999')
    const atual = await repos(b).pessoas.obter('p')
    await b.comando('salvarPessoa', { id: 'p', nome: 'Ana', papeis: ['cliente'], obs: 'ok', versaoBase: atual.versao })
    expect((await repos(b).pessoas.obter('p')).obs).toBe('ok')
  })

  it('C-06 salvarTabelaPreco: grade aberta na v1 não publica por cima da v2', async () => {
    const { b } = await novoBackend()
    const tab = (valores: Record<string, string>, extra: Q = {}) => ({ id: 't', moduloId: 'cabelo', nome: 'Geral', moeda: 'BOB', unidadeMedida: 'cm', fatorPor: 'grama' as const, linhas: [60], colunas: [{ id: 'lp', nome: 'LP' }, { id: 'h', nome: 'H' }], valores, ...extra })
    await b.comando('salvarTabelaPreco', tab({ '60|lp': '17', '60|h': '18' }))
    expect((await b.comando('salvarTabelaPreco', tab({ '60|lp': '20', '60|h': '18' }, { versaoBase: 1 }))).versao).toBe(2)
    await expect(b.comando('salvarTabelaPreco', tab({ '60|lp': '17', '60|h': '19' }, { versaoBase: 1 }))).rejects.toThrow(ALTERADO)
    expect((await repos(b).tabelasPreco.obter('t')).valores['60|lp']).toBe('20')
    expect((await b.comando('salvarTabelaPreco', tab({ '60|lp': '20', '60|h': '19' }, { versaoBase: 2 }))).versao).toBe(3)
  })

  it('C-07 salvarConfig: lista velha de módulos junta com a mudança da outra aba (antes); sem antes e versão velha recusa', async () => {
    const { b } = await novoBackend()
    const cfg0 = await repos(b).config.obter('geral')
    const ativos: string[] = ((await b.consulta('configuracoes', {})) as Q).config.modulosAtivos
    // aba B desliga "salao"; aba A (tela velha) desliga "emprestimos" mandando a lista que tinha
    await b.comando('salvarConfig', { modulosAtivos: ativos.filter((m) => m !== 'salao'), antes: { modulosAtivos: ativos } })
    await b.comando('salvarConfig', { modulosAtivos: ativos.filter((m) => m !== 'emprestimos'), antes: { modulosAtivos: ativos } })
    const depois = (await repos(b).config.obter('geral')).valor.modulosAtivos
    expect(depois).not.toContain('salao')
    expect(depois).not.toContain('emprestimos')
    expect(depois).toContain('cabelo')
    await expect(b.comando('salvarConfig', { nomeNegocio: 'X', versaoBase: cfg0.versao })).rejects.toThrow(ALTERADO)
    // as duas abas mudaram o MESMO valor de jeitos diferentes: recusa
    await b.comando('salvarConfig', { nomeNegocio: 'B', antes: { nomeNegocio: 'Meu negócio' } })
    await expect(b.comando('salvarConfig', { nomeNegocio: 'A', antes: { nomeNegocio: 'Meu negócio' } })).rejects.toThrow(ALTERADO)
  })

  it('C-08 salvarUsuario: formulário velho não reativa quem outro administrador desativou', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarUsuario', { id: 'u', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', senha: 'senha123' })
    const velho = ((await b.consulta('usuarios', {})) as Q[]).find((u) => u.id === 'u')
    await b.comando('salvarUsuario', { id: 'u', login: 'sofia', nome: 'Sofia', perfil: 'funcionario', ativo: false, versaoBase: velho.versao })
    await expect(b.comando('salvarUsuario', { id: 'u', login: 'sofia', nome: 'Sofia F.', perfil: 'funcionario', ativo: true, versaoBase: velho.versao })).rejects.toThrow(ALTERADO)
    expect((await repos(b).usuarios.obter('u')).ativo).toBe(false)
  })

  it('C-10 salvarViagem: viagem velha (mudar rateio) não apaga o orçamento gravado pela outra aba', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p', nome: 'P', papeis: ['funcionario'] })
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', viajantes: ['p'], inicio: r.hoje })
    const v = await repos(b).viagens.obter('vg')
    await b.comando('salvarViagem', { id: 'vg', nome: 'Feira', viajantes: ['p'], inicio: r.hoje, orcamento: bs(3000), versaoBase: v.versao })
    await expect(b.comando('salvarViagem', { id: 'vg', nome: 'Feira', viajantes: ['p'], inicio: r.hoje, rateio: 'valor', versaoBase: v.versao })).rejects.toThrow(ALTERADO)
    expect((await repos(b).viagens.obter('vg')).orcamento).toBe(bs(3000))
  })

  it('C-11 desfazerLigacao: compra que outra aba já mudou de viagem não volta', async () => {
    const { b, r } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'p', nome: 'P', papeis: ['funcionario'] })
    await b.comando('salvarPessoa', { id: 'f', nome: 'F', papeis: ['fornecedor'] })
    await b.comando('salvarViagem', { id: 'v1', nome: 'Oruro', destino: 'Oruro', viajantes: ['p'], inicio: r.hoje })
    await b.comando('salvarViagem', { id: 'v2', nome: 'Potosi', destino: 'Potosi', viajantes: ['p'], inicio: r.hoje, confirmarParecida: true })
    await b.comando('criarCompra', { id: 'c1', moduloId: 'cabelo', pessoaId: 'f', linhas: [{ id: 'l', quantidade: 100, moeda: 'BOB', total: bs(10), campos: { estado: 'Bruto' } }] })
    const lig = (await b.comando('vincularCompras', { viagemId: 'v1', compraIds: ['c1'] })) as Q
    await b.comando('vincularCompras', { viagemId: 'v2', compraIds: ['c1'], mover: true })
    await expect(b.comando('desfazerLigacao', { antes: lig.antes })).rejects.toThrow(/mudada de viagem por outra pessoa/)
    expect((await repos(b).transacoes.obter('c1')).viagemId).toBe('v2')
    // o desfazer do último passo continua valendo
    const lig2 = (await b.comando('desvincularCompra', { viagemId: 'v2', compraId: 'c1' })) as Q
    await b.comando('desfazerLigacao', { antes: lig2.antes })
    expect((await repos(b).transacoes.obter('c1')).viagemId).toBe('v2')
  })
})

describe('AUDITORIA de configuração e unidades', () => {
  it('C-12 salvarConfig fica no log com antes → depois (sócios e impostos inclusive)', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarConfig', { saldoPequenoG: 80, socios: [{ id: 's1', nome: 'A', parteBp: 10000 }] })
    const fiscal = ((await b.consulta('configuracoes', {})) as Q).config.fiscal
    await b.comando('salvarConfig', { fiscal: { ...fiscal, ivaBp: fiscal.ivaBp + 100 } })
    const logs = (await auditoria(b, 'salvarConfig')).map((a) => a.resumo).join(' | ')
    expect(logs).toContain('saldoPequenoG: 50 → 80')
    expect(logs).toContain('socios')
    expect(logs).toContain(`fiscal.ivaBp: ${fiscal.ivaBp} → ${fiscal.ivaBp + 100}`)
  })

  it('C-13 salvarLocal fica no log (criação e mudança)', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarLocal', { id: 'loc', nome: 'Salão', tipo: 'salao' })
    await b.comando('salvarLocal', { id: 'loc', nome: 'Salão Centro', tipo: 'salao' })
    const logs = (await auditoria(b, 'salvarLocal')).map((a) => a.resumo)
    expect(logs.length).toBe(2)
    expect(logs.join(' | ')).toContain('nome: Salão → Salão Centro')
  })
})

describe('UNIDADES × estornos e período', () => {
  async function base() {
    const x = await novoBackend()
    await x.b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(100000), descricao: 'Saldo inicial' })
    await x.b.comando('salvarLocal', { id: 'loc', nome: 'Salão', tipo: 'salao' })
    await x.b.comando('salvarPessoa', { id: 'prof', nome: 'Prof', papeis: ['funcionario'], localId: 'loc', salario: { moeda: 'BOB', valor: bs(3000), periodo: 'mes' } })
    return x
  }
  const daLoc = (u: Q) => u.lista.find((l: Q) => l.local.id === 'loc')

  it('D-01 salário pago e desfeito: salariosPagos = 0', async () => {
    const { b, r } = await base()
    await b.comando('pagarSalario', { id: 's1', pessoaId: 'prof', valor: bs(3000), moeda: 'BOB', forma: 'dinheiro' })
    await b.comando('estornarLancamento', { lancamentoId: 's1', motivo: 'errado' })
    expect(daLoc(await b.consulta('unidades', { de: r.hoje, ate: r.hoje })).salariosPagos).toBe(0)
  })

  it('D-02 despesa sem categoria desfeita e entrada desfeita não ficam como despesa da unidade', async () => {
    const { b, r } = await base()
    await b.comando('lancarCaixa', { id: 'd1', tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(500), descricao: 'engano', localId: 'loc' })
    await b.comando('estornarLancamento', { lancamentoId: 'd1', motivo: 'engano' })
    await b.comando('lancarCaixa', { id: 'e1', tipo: 'entrada', moeda: 'BOB', forma: 'dinheiro', valor: bs(700), descricao: 'aporte', categoria: 'Aporte', localId: 'loc' })
    await b.comando('estornarLancamento', { lancamentoId: 'e1', motivo: 'engano' })
    expect(daLoc(await b.consulta('unidades', { de: r.hoje, ate: r.hoje })).despesas).toBe(0)
  })

  it('D-03 período ao contrário: 0 dias, 0 salário, 0 margem', async () => {
    const { b } = await base()
    const u = await b.consulta('unidades', { de: '2026-11-30', ate: '2026-11-01' })
    expect({ dias: u.dias, salarios: daLoc(u).salarios, margem: daLoc(u).margem }).toEqual({ dias: 0, salarios: 0, margem: 0 })
  })
})

describe('D-05 desempenho sem perder as regras', () => {
  it('triagem com muitas saídas: códigos únicos; código recém-criado não pode ser digitado de novo', async () => {
    const { b } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 9000, moeda: 'BOB', total: bs(4500), campos: { estado: 'Bruto' } }] })
    const lote = ((await b.consulta('pedido', { id: 'c' })) as Q).lotes[0]
    await b.comando('triarLotes', { id: 't', ids: [lote.id], quantidadeUsada: 9000, saidas: Array.from({ length: 9 }, (_, j) => ({ id: `s${j}`, quantidade: 1000, campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal' } })) })
    const cods = ((await repos(b).itens.listar()) as Q[]).filter((i) => i.controlaEstoque).map((i) => i.codigo)
    expect(new Set(cods).size).toBe(cods.length)
    const usado = (await repos(b).itens.obter('s3')).codigo
    await expect(b.comando('trocarCodigoLote', { id: 's4', codigo: usado })).rejects.toThrow(/Já existe/)
  })

  it('transação em memória desfaz só o que mudou (inclusive registro novo e transação dentro de outra)', async () => {
    const { repos: r, transacao } = criarReposMemoria()
    const reg = (id: string, nome: string) => ({ id, nome, empresaId: 'e', criadoEm: '', atualizadoEm: '', criadoPor: 'u', versao: 1 }) as Q
    await r.pessoas.salvar(reg('a', 'A'))
    await expect(
      transacao(async () => {
        await r.pessoas.salvar(reg('a', 'A2'))
        await r.pessoas.salvar(reg('b', 'B'))
        await transacao(async () => r.locais.salvar(reg('l', 'L')))
        throw new Error('falhou')
      }),
    ).rejects.toThrow('falhou')
    expect((await r.pessoas.obter('a'))?.nome).toBe('A')
    expect(await r.pessoas.obter('b')).toBeUndefined()
    expect(await r.locais.obter('l')).toBeUndefined()
    // transação de dentro que falha não desfaz a de fora
    await transacao(async () => {
      await r.pessoas.salvar(reg('c', 'C'))
      await transacao(async () => { await r.pessoas.salvar(reg('d', 'D')); throw new Error('x') }).catch(() => undefined)
    })
    expect((await r.pessoas.obter('c'))?.nome).toBe('C')
    expect(await r.pessoas.obter('d')).toBeUndefined()
  })
})
