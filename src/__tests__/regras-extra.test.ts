import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bs, novoBackend } from './ajuda'

describe('separação com custo pelo valor de mercado', () => {
  it('cabelo longo leva mais custo; a soma dos custos é o custo do lote', async () => {
    const { b } = await novoBackend()
    await b.comando('criarCompra', { id: 'c', moduloId: 'cabelo', linhas: [{ id: 'l', quantidade: 10000, moeda: 'BOB', total: bs(100000), campos: { estado: 'Bruto' } }] })
    for (const e of ['conferido', 'pago', 'concluido']) await b.comando('avancarTriagem', { compraId: 'c', para: e, pagamentos: e === 'pago' ? [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(100000) }] : undefined })
    const bruto = (await b.consulta('estoque', { moduloId: 'cabelo' }))[0]
    await b.comando('separarLote', {
      id: 's',
      loteId: bruto.id,
      quantidadeUsada: 10000,
      saidas: [
        { id: 'longo', quantidade: 5000, valorReferencia: '18', campos: { comprimento: 60 } },
        { id: 'curto', quantidade: 5000, valorReferencia: '4', campos: { comprimento: 40 } },
      ],
    })
    const longo = (await b.consulta('fichaItem', { id: 'longo' })).item
    const curto = (await b.consulta('fichaItem', { id: 'curto' })).item
    // mesmo peso, mas valor 18 × 4: o longo leva 18/22 do custo
    expect(longo.custoPrincipal).toBe(Math.round((bs(100000) * 18) / 22))
    expect(longo.custoPrincipal! + curto.custoPrincipal!).toBe(bs(100000))
    expect(longo.campos.rateio).toBe('valor')
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
  })
})

describe('toda ação com o usuário', () => {
  it('o log e a linha do tempo dizem quem fez; filtra por pessoa e período', async () => {
    const { b, sessao } = await novoBackend('2026-11-01')
    await b.comando('salvarPessoa', { id: 'f1', nome: 'Funcionária 1', papeis: ['funcionario', 'profissional'], acesso: 'funcionario' })
    await b.comando('salvarItem', { id: 'corte', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' })
    Object.assign(sessao, { usuarioId: 'f1', nome: 'Funcionária 1', perfil: 'funcionario' })
    await b.comando('concluirVenda', { id: 'v', linhas: [{ id: 'l', itemId: 'corte', quantidade: 1, moeda: 'BOB', total: bs(80) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(80) }] })
    Object.assign(sessao, { usuarioId: 'admin', nome: 'Administrador', perfil: 'admin' })
    const log = await b.consulta('logDetalhado', { usuarioId: 'f1', de: '2026-11-01', ate: '2026-11-01' })
    expect(log.linhas.map((l) => l.acao)).toEqual(['concluirVenda'])
    expect(log.linhas[0].usuarioNome).toBe('Funcionária 1')
    const tempo = await b.consulta('linhaDoTempo', { id: 'v' })
    expect(tempo.some((e) => e.por === 'Funcionária 1')).toBe(true)
    const lista = await b.consulta('vendas', { usuarioId: 'f1' })
    expect(lista).toHaveLength(1)
    expect(lista[0].feitoPor).toBe('Funcionária 1')
  })
})

describe('corrigir venda a qualquer momento', () => {
  it('corrige gramas e fator, acerta estoque, comissão e conta; guarda o histórico; pode corrigir de novo', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarPessoa', { id: 'cli', nome: 'Cliente', papeis: ['cliente'] })
    await b.comando('salvarItem', { id: 'lote', moduloId: 'produtos', tipoItem: 'peca', nome: 'Lote teste', saldoInicial: 5000 })
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'cli', linhas: [{ id: 'l', itemId: 'lote', quantidade: 2000, moeda: 'BOB', total: 0, calculo: { medida: 40, fator: '3,5' } }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(7000) }] })
    await expect(b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', quantidade: 1900 }], motivo: '' })).rejects.toThrow(/motivo/)
    const r = await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', quantidade: 1900 }], motivo: 'Na balança deu 1.900 g' })
    expect(r.diferenca).toBe(-bs(350))
    expect((await b.consulta('estoque', { moduloId: 'produtos' }))[0].saldo).toBe(3100)
    // sem dizer para onde vai a diferença e com cliente: vai para a conta dela (crédito de 350)
    expect((await b.consulta('contaPessoa', { pessoaId: 'cli' })).saldo).toBe(-bs(350))
    // de novo, agora o fator, devolvendo no caixa
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', fator: '4' }], motivo: 'Preço combinado era 4', diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    const v = (await b.consulta('venda', { id: 'v' })).venda
    expect(v.linhas[0].total).toBe(bs(7600))
    expect(v.historico.filter((h) => h.tipo === 'correcao')).toHaveLength(2)
    expect((await b.consulta('diagnostico', {})).problemas).toEqual([])
  })
})

describe('comissões: histórico do ganho + pagamento lançado', () => {
  it('a pagar = ganho − pago; correção da venda muda o ganho; pagamento não vira despesa duas vezes', async () => {
    const { b } = await novoBackend('2026-11-01')
    await b.comando('salvarPessoa', { id: 'pro', nome: 'Pro', papeis: ['profissional'], comissaoBp: 4000 })
    await b.comando('salvarItem', { id: 's', moduloId: 'salao', tipoItem: 'servico', nome: 'Corte' })
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000), descricao: 'x' })
    await b.comando('concluirVenda', { id: 'v', profissionalId: 'pro', linhas: [{ id: 'l', itemId: 's', quantidade: 1, moeda: 'BOB', total: bs(300) }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'BOB', valor: bs(300) }] })
    expect((await b.consulta('comissoes', {})).porPessoa[0].aPagar).toBe(bs(120))
    await b.comando('pagarComissao', { id: 'pc', pessoaId: 'pro', valor: bs(100), moeda: 'BOB', forma: 'dinheiro' })
    await b.comando('corrigirVenda', { id: 'v', linhas: [{ linhaId: 'l', total: bs(400) }], motivo: 'Era 400', diferenca: { forma: 'dinheiro', moeda: 'BOB' } })
    const c = (await b.consulta('comissoes', {})).porPessoa[0]
    expect(c.ganhoTotal).toBe(bs(160))
    expect(c.pagoTotal).toBe(bs(100))
    expect(c.aPagar).toBe(bs(60))
    const dre = await b.consulta('dre', { de: '2026-11-01', ate: '2026-11-01' })
    expect(dre.comissoes).toBe(bs(160))
    expect(dre.despesas).toBe(0)
  })
})

describe('agenda: horário ocupado', () => {
  it('avisa sobreposição da mesma profissional e deixa marcar se confirmar', async () => {
    const { b } = await novoBackend('2026-11-01')
    await b.comando('salvarPessoa', { id: 'pro', nome: 'Pro', papeis: ['profissional'] })
    await b.comando('salvarPessoa', { id: 'c1', nome: 'Ana', papeis: ['cliente'] })
    await b.comando('salvarItem', { id: 'cor', moduloId: 'salao', tipoItem: 'servico', nome: 'Cor', duracaoMin: 90 })
    const ag = (id: string, hora: string, ignorar?: boolean) =>
      b.comando('concluirVenda', { id, pessoaId: 'c1', profissionalId: 'pro', agendadoPara: `2026-11-05T${hora}:00.000Z`, linhas: [{ id: `${id}l`, itemId: 'cor', quantidade: 1, moeda: 'BOB', total: bs(250) }], pagamentos: [], ignorarConflito: ignorar })
    await ag('a1', '14:00')
    await expect(ag('a2', '15:00')).rejects.toThrow(/Horário ocupado/)
    await ag('a3', '15:30') // 14:00 + 90 min = 15:30: não sobrepõe
    await ag('a4', '14:30', true)
    expect((await b.consulta('agenda', { de: '2026-11-01', ate: '2026-11-30' })).length).toBe(3)
  })
})

describe('login e permissões', () => {
  it('senha errada não entra; funcionária não faz o que é de admin; toda ação fica no nome dela', async () => {
    const { b } = await novoBackend()
    await b.comando('salvarUsuario', { id: 'u1', login: 'Sofia', nome: 'Sofia', perfil: 'funcionario', senha: '1234' })
    await expect(b.comando('salvarUsuario', { id: 'u2', login: 'sofia', nome: 'Outra', perfil: 'funcionario', senha: '1234' })).rejects.toThrow(/já existe/)
    await expect(b.entrar('sofia', 'xxxx')).rejects.toThrow(/não conferem/)
    const s = await b.entrar('SOFIA', '1234')
    expect(s.perfil).toBe('funcionario')
    await expect(b.comando('lancarCaixa', { id: 'x', tipo: 'retirada', moeda: 'BOB', forma: 'dinheiro', valor: 100, descricao: 'x' })).rejects.toThrow(/permissão/)
    await expect(b.consulta('dre', { de: '2026-11-01', ate: '2026-11-01' })).rejects.toThrow(/permissão/)
    await b.sair()
    await expect(b.consulta('pessoas', {})).rejects.toThrow(/Entre/)
    // a lista nunca mostra a senha
    await b.entrar('sofia', '1234')
    await b.sair()
  })
})

describe('câmbio dinâmico ou fixo, para venda e para compra', () => {
  it('dinâmico usa a base da internet ± ajuste; fixo usa o digitado; venda e compra separados; sem internet vale a última base', async () => {
    const { b } = await novoBackend()
    // base (como se viesse da internet): 1 BRL = 1,28 BOB; 1 USD = 5,40 BRL → 1 USD = 6,912 BOB
    await b.comando('salvarCotacao', { id: 'auto-usd', moeda: 'USD', valor: '5,40', sentido: 'basePorMoeda', fonte: 'auto' })
    const ver = async () => (await b.consulta('cambio', {})).moedas.find((m) => m.moeda === 'USD')!
    expect((await ver()).base).toBeCloseTo(6.912, 4)
    // dinâmico com ajuste: venda −1%, compra +1%
    await b.comando('salvarCambio', { moeda: 'USD', modo: 'dinamico', ajusteVendaBp: -100, ajusteCompraBp: 100 })
    expect((await ver()).venda).toBeCloseTo(6.84288, 4)
    expect((await ver()).compra).toBeCloseTo(6.98112, 4)
    // venda recebendo 100 USD usa a taxa de venda; compra pagando 100 USD usa a de compra
    await b.comando('salvarItem', { id: 'x', moduloId: 'produtos', tipoItem: 'peca', nome: 'X', saldoInicial: 10 })
    await b.comando('lancarCaixa', { id: 'ini', tipo: 'saldoInicial', moeda: 'USD', forma: 'dinheiro', valor: 100000, descricao: 'x' })
    await b.comando('salvarPessoa', { id: 'c', nome: 'C', papeis: ['cliente', 'fornecedor'] })
    await b.comando('concluirVenda', { id: 'v', pessoaId: 'c', linhas: [{ id: 'l', itemId: 'x', quantidade: 1, moeda: 'USD', total: 10000 }], pagamentos: [{ id: 'p', forma: 'dinheiro', moeda: 'USD', valor: 10000 }] })
    const v = (await b.consulta('venda', { id: 'v' })).venda
    expect(v.totalPrincipal).toBe(68429) // 100 USD × 6,84288 = Bs 684,29
    expect(v.linhas[0].cotacao?.uso).toBe('venda')
    // fixo: digitado contra a moeda principal, exato
    await b.comando('salvarCambio', { moeda: 'USD', modo: 'fixo', fixoVenda: '6,90', fixoCompra: '7,00', idVenda: 'fv', idCompra: 'fc' })
    expect((await ver()).venda).toBe(6.9)
    expect((await ver()).compra).toBe(7)
    await b.comando('criarCompra', { id: 'co', moduloId: 'produtos', pessoaId: 'c', linhas: [{ id: 'cl', itemId: 'x', quantidade: 1, moeda: 'USD', total: 10000 }] })
    expect((await b.consulta('compra', { id: 'co' })).compra.totalPrincipal).toBe(70000) // 100 USD × 7,00
    // a internet não muda o fixo; a venda antiga continua com a cotação que usou
    await b.comando('salvarCotacao', { id: 'auto-usd2', moeda: 'USD', valor: '6,00', sentido: 'basePorMoeda', fonte: 'auto' })
    expect((await ver()).venda).toBe(6.9)
    expect((await b.consulta('venda', { id: 'v' })).venda.totalPrincipal).toBe(68429)
    // sem internet: registra a falha e continua com a última base guardada
    await b.comando('registrarBuscaCambio', { ok: false, mensagem: 'Sem internet', fonte: 'teste' })
    const cam = await b.consulta('cambio', {})
    expect(cam.status?.ok).toBe(false)
    expect(cam.moedas.find((m) => m.moeda === 'USD')!.base).toBeCloseTo(7.68, 4) // 6,00 × 1,28
    expect((await b.consulta('diagnostico', {})).ok).toBe(true)
    // o real (base interna) também pode ser fixo ou ajustado
    const real = async () => (await b.consulta('cambio', {})).moedas.find((m) => m.moeda === 'BRL')!
    expect((await real()).base).toBeCloseTo(1.28, 4)
    await b.comando('salvarCambio', { moeda: 'BRL', modo: 'fixo', fixoVenda: '1,25', fixoCompra: '1,30', idVenda: 'rv', idCompra: 'rc' })
    expect((await real()).venda).toBe(1.25)
    expect((await real()).compra).toBe(1.3)
    await b.comando('salvarCambio', { moeda: 'BRL', modo: 'dinamico', ajusteVendaBp: -200 })
    expect((await real()).venda).toBeCloseTo(1.2544, 4)
    expect((await real()).compra).toBeCloseTo(1.28, 4)
  })
})

describe('fronteira da arquitetura', () => {
  it('só o adaptador local conhece o banco (Dexie): trocar pela API não mexe em telas e regras', () => {
    const raiz = join(__dirname, '..')
    const arquivos: string[] = []
    const andar = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n)
        if (statSync(c).isDirectory()) {
          if (n !== '__tests__') andar(c)
        } else if (/\.(ts|tsx)$/.test(n)) arquivos.push(c)
      }
    }
    andar(raiz)
    const violam = arquivos.filter((f) => /from 'dexie'/.test(readFileSync(f, 'utf8')) && !f.replace(/\\/g, '/').includes('/adapters/local/'))
    expect(violam).toEqual([])
    // as regras (core) não importam nada de telas nem de adaptadores
    const core = arquivos.filter((f) => f.replace(/\\/g, '/').includes('/core/'))
    expect(core.filter((f) => /from '\.\.\/\.\.\/(adapters|ui|screens)|from '\.\.\/(adapters|ui|screens)/.test(readFileSync(f, 'utf8')))).toEqual([])
  })
})
