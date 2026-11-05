// DADOS DE EXEMPLO da demonstração, montados a partir do caderno real (tabelas, contas e nomes de exemplo).
// Tudo entra pelos mesmos comandos das telas, "como se fosse" nos últimos 45 dias: as contas batem de verdade.

import type { BackendNoAparelho } from '../adapters/noAparelho'
import { novoId } from '../core/domain/ids'
import { dataLocal, somarDias } from '../core/domain/datas'
import type { Id } from '../core/domain/tipos'
import type { DadosComando, NomeComando } from '../core/services'

const bs = (v: number) => Math.round(v * 100)

/** Tabela do caderno (out/2026): linha = cm, coluna = com quem negocia, célula = fator por grama (Bs). */
const COLUNAS = [
  { id: 'lp', nome: 'LP' },
  { id: 'cb', nome: 'CB' },
  { id: 'elena', nome: 'Helena' },
  { id: 'bethy', nome: 'Grupo B' },
  { id: 'brigith', nome: 'Grupo C' },
  { id: 'cirila', nome: 'Cecília' },
  { id: 'henry', nome: 'Henrique' },
  { id: 'pw', nome: 'P.W. (Paraguai)' },
  { id: 'pf', nome: 'P.F. (Paraguai)' },
  { id: 'bb', nome: 'B.B.' },
  { id: 'chm', nome: 'CH+' },
  { id: 'ch', nome: 'CH' },
]
const VALORES: Record<number, (string | null)[]> = {
  38: ['0,7', null, null, null, null, '1', null, '2', null, null, null, null],
  40: ['3', '3', '3', '2,9', '2,8', '3', '3', null, '3,5', '3,8', '8,5', '5'],
  50: ['6', '6', '6', '6', '6', '6', '6,5', '7,5', '8,5', '8', '14', '10'],
  55: ['6', '6,5', '6,4', '6,4', '6', '6,4', '7,5', '8,5', null, '8', null, '9,5'],
  60: ['15', '16', '16', '16,4', '15', '16', '17', '18', '17,5', '17,5', '18', '21'],
  70: ['18', '17', '17', '17,4', '16,5', '17', '18,2', '19,5', '19,5', '20', '21', '22'],
  80: ['18,5', '18', '18,2', null, '17,5', '18,5', '20', '21', null, null, null, null],
  90: [null, null, '19', null, null, null, null, '22', null, null, null, null],
}

/** Usuários de teste (senha demo1234). "admin" vê tudo; as outras entram com o perfil do cargo. */
export const SENHA_DEMO = 'demo1234'
/** a senha dos dados de exemplo carregados antes da regra de senha (8 caracteres): o botão de entrar tenta as duas */
export const SENHA_DEMO_ANTIGA = '1234'

export async function carregarDemo(b: BackendNoAparelho) {
  await b.comoSistema(() => montar(b))
}

async function montar(b: BackendNoAparelho) {
  await b.limparTudo()
  const hoje = dataLocal()
  const em = (diasAtras: number, hora = 10) => {
    const [a, m, d] = somarDias(hoje, -diasAtras).split('-').map(Number)
    return new Date(a, m - 1, d, hora, 0, 0).toISOString()
  }
  const c = <N extends NomeComando>(diasAtras: number, nome: N, dados: DadosComando<N>, hora?: number) => b.comandoEm(em(diasAtras, hora), nome, dados)
  const id = () => novoId()

  // ---------- configuração, moedas, sócias ----------
  await c(45, 'salvarConfig', {
    nomeNegocio: 'Cabelos & Salão (demonstração)',
    moedaPrincipal: 'BOB',
    socios: [
      { id: 'socia-a', nome: 'Sócia A', parteBp: 5000 },
      { id: 'socia-b', nome: 'Sócia B', parteBp: 5000 },
    ],
  })
  for (const d of [45, 0]) {
    await c(d, 'salvarCotacao', { id: id(), moeda: 'BOB', valor: '1,28', sentido: 'moedaPorBase' })
    await c(d, 'salvarCotacao', { id: id(), moeda: 'PYG', valor: '1450', sentido: 'moedaPorBase' })
    await c(d, 'salvarCotacao', { id: id(), moeda: 'USD', valor: '5,40', sentido: 'basePorMoeda' })
  }

  // câmbio: dólar dinâmico (internet) com ajuste; real fixo digitado para vender e comprar
  await c(45, 'salvarCambio', { moeda: 'USD', modo: 'dinamico', ajusteVendaBp: -100, ajusteCompraBp: 100 })
  await c(45, 'salvarCambio', { moeda: 'BRL', modo: 'fixo', fixoVenda: '1,25', fixoCompra: '1,30', idVenda: id(), idCompra: id() })

  // ---------- unidades ----------
  const centro = 'loc-centro'
  const norte = 'loc-norte'
  await c(45, 'salvarLocal', { id: centro, nome: 'Salão Centro', tipo: 'salao', rua: 'Av. Principal', numero: '120', bairro: 'Centro', cidade: 'Santa Cruz', pais: 'Bolívia' })
  await c(45, 'salvarLocal', { id: norte, nome: 'Salão Norte', tipo: 'salao', rua: 'Calle 4', numero: '55', bairro: 'Norte', cidade: 'Santa Cruz', pais: 'Bolívia' })
  await c(45, 'salvarLocal', { id: 'loc-deposito', nome: 'Depósito de cabelo', tipo: 'ponto', cidade: 'Santa Cruz', pais: 'Bolívia' })

  // ---------- pessoas ----------
  const P = async (pid: string, d: Omit<DadosComando<'salvarPessoa'>, 'id'>) => {
    await c(45, 'salvarPessoa', { id: pid, ...d })
    return pid
  }
  // equipe (organograma)
  const rosa = await P('p-rosa', { nome: 'Bianca', papeis: ['funcionario', 'socio'], cargo: 'Diretora geral', salario: { moeda: 'BOB', valor: bs(6000) }, localId: centro, acesso: 'admin' })
  const mariana = await P('p-mariana', { nome: 'Paula', papeis: ['funcionario'], cargo: 'Gerente', salario: { moeda: 'BOB', valor: bs(4000) }, localId: centro, superiorId: rosa, acesso: 'funcionario', telefone: '+591 70000001', verAgendaEquipe: true })
  const alison = await P('p-alison', { nome: 'Renata', papeis: ['funcionario'], cargo: 'Gerente', salario: { moeda: 'BOB', valor: bs(4000) }, localId: norte, superiorId: rosa, acesso: 'funcionario' })
  const vero = await P('p-vero', { nome: 'Sofia', papeis: ['funcionario', 'profissional'], cargo: 'Cabeleireira sênior', salario: { moeda: 'BOB', valor: bs(3000) }, comissaoBp: 4000, localId: centro, superiorId: mariana, acesso: 'funcionario' })
  const china = await P('p-china', { nome: 'Lia', papeis: ['funcionario', 'profissional'], cargo: 'Cabeleireira', salario: { moeda: 'BOB', valor: bs(2500) }, comissaoBp: 3000, localId: centro, superiorId: vero, acesso: 'funcionario' })
  const dina = await P('p-dina', { nome: 'Nina', papeis: ['funcionario', 'profissional'], cargo: 'Escova e manicure', salario: { moeda: 'BOB', valor: bs(120), periodo: 'dia' }, comissaoBp: 2000, localId: centro, superiorId: vero, acesso: 'funcionario' })
  const luz = await P('p-luz', { nome: 'Clara', papeis: ['funcionario', 'profissional'], cargo: 'Cabeleireira sênior', salario: { moeda: 'BOB', valor: bs(3000) }, comissaoBp: 4000, localId: norte, superiorId: alison, acesso: 'funcionario' })
  const karen = await P('p-karen', { nome: 'Júlia', papeis: ['funcionario', 'profissional'], cargo: 'Cabeleireira', salario: { moeda: 'BOB', valor: bs(600), periodo: 'semana' }, comissaoBp: 3000, localId: norte, superiorId: luz, acesso: 'funcionario' })
  // clientes do salão
  const ana = await P('p-ana', { nome: 'Ana Paula', papeis: ['cliente'], localId: centro, telefone: '+591 71111111' })
  const bia = await P('p-bia', { nome: 'Beatriz', papeis: ['cliente'], localId: centro, telefone: '+591 72222222' })
  const carla = await P('p-carla', { nome: 'Carla', papeis: ['cliente'], localId: norte })
  const dani = await P('p-dani', { nome: 'Daniela', papeis: ['cliente'], localId: norte })
  const elisa = await P('p-elisa', { nome: 'Elisa', papeis: ['cliente'], localId: centro })
  // cabelo: fornecedores e compradores
  const iran = await P('p-iran', { nome: 'Atacado Norte (fictício)', papeis: ['fornecedor'] })
  const cirila = await P('p-cirila', { nome: 'Cecília', papeis: ['fornecedor'] })
  const elena = await P('p-elena', { nome: 'Helena', papeis: ['fornecedor'] })
  const maria = await P('p-maria', { nome: 'Marta', papeis: ['fornecedor'] })
  const henry = await P('p-henry', { nome: 'Henrique', papeis: ['cliente'], telefone: '+591 73333333' })
  const pw = await P('p-pw', { nome: 'P.W. (Paraguai)', papeis: ['cliente'], telefone: '+595 900000000' })
  const wilson = await P('p-wilson', { nome: 'Wagner', papeis: ['cliente', 'fornecedor'] })
  const lucho = await P('p-lucho', { nome: 'Lucas', papeis: ['devedor'] })
  const papa = await P('p-papa', { nome: 'Investidor', papeis: ['credor'] })

  // ---------- tabelas de preço ----------
  const valores: Record<string, string> = {}
  for (const [linha, vs] of Object.entries(VALORES)) vs.forEach((v, k) => v && (valores[`${linha}|${COLUNAS[k].id}`] = v))
  const tabGeral = 'tab-geral'
  await c(45, 'salvarTabelaPreco', {
    id: tabGeral,
    moduloId: 'cabelo',
    nome: 'Tabela geral (Normal)',
    validaDesde: somarDias(hoje, -45),
    moeda: 'BOB',
    unidadeMedida: 'cm',
    fatorPor: 'grama',
    linhas: Object.keys(VALORES).map(Number),
    colunas: COLUNAS.map((x) => ({ ...x, pessoaId: x.id === 'cirila' ? cirila : x.id === 'elena' ? elena : x.id === 'henry' ? henry : x.id === 'pw' ? pw : undefined })),
    valores,
  })
  await c(45, 'salvarTabelaPreco', {
    id: 'tab-tinte',
    moduloId: 'cabelo',
    nome: 'Tinte (tingido)',
    categoria: 'Tinte',
    validaDesde: somarDias(hoje, -45),
    moeda: 'BOB',
    unidadeMedida: 'cm',
    fatorPor: 'grama',
    linhas: [38, 40, 50, 55, 60],
    colunas: [
      { id: 'cirila', nome: 'Cecília', pessoaId: cirila },
      { id: 'venda', nome: 'Venda' },
    ],
    valores: { '38|cirila': '1', '40|cirila': '2', '50|cirila': '5', '55|cirila': '5', '60|cirila': '12', '40|venda': '2,5', '50|venda': '6', '55|venda': '6,5', '60|venda': '14,5' },
  })

  // nova versão da tabela (o caderno muda toda semana): sobe 60 e 70 cm para P.W. e Henrique
  const tg = (await b.consulta('tabelasPreco', {})).find((x) => x.id === tabGeral)!
  await c(20, 'salvarTabelaPreco', { ...tg, valores: { ...tg.valores, '60|pw': '18,5', '70|pw': '20', '60|henry': '17,5', '40|lp': '3,2', '100|pw': '24' }, linhas: [...tg.linhas, 100], nota: 'Subiu 60–70 cm para P.W. e Henrique; entrou 100 cm' })

  // ---------- serviços do salão ----------
  const S = async (sid: string, nome: string, preco: number, duracaoMin: number, retornoDias?: number, cat?: string) => {
    await c(45, 'salvarItem', { id: sid, moduloId: 'salao', tipoItem: 'servico', nome, precoSugerido: { moeda: 'BOB', valor: bs(preco) }, duracaoMin, retornoDias, campos: { categoria: cat } })
    return sid
  }
  const corte = await S('s-corte', 'Corte', 80, 40, undefined, 'Corte')
  const cor = await S('s-cor', 'Coloração', 250, 90, undefined, 'Cor')
  const mega = await S('s-mega', 'Aplicação de mega hair', 600, 180, 60, 'Mega hair')
  const manut = await S('s-manut', 'Manutenção do mega hair', 250, 90, 45, 'Mega hair')
  const escova = await S('s-escova', 'Escova', 60, 40, undefined, 'Escova')
  // biblioteca padrão de serviços (Tintura, Mechas, Unha, Depilação… com insumos)
  await c(45, 'restaurarBibliotecaServicos', {})
  // produtos (módulo de exemplo)
  await c(45, 'salvarItem', { id: 'pr-presilha', moduloId: 'produtos', tipoItem: 'peca', nome: 'Presilha · Dourada', precoSugerido: { moeda: 'BOB', valor: bs(25) }, estoqueIdeal: 20, saldoInicial: 14, campos: { grupo: 'Presilha', cor: 'Dourada' } })

  // ---------- caixa inicial ----------
  await c(45, 'lancarCaixa', { id: id(), tipo: 'saldoInicial', moeda: 'BOB', forma: 'dinheiro', valor: bs(150000), descricao: 'Saldo inicial (efectivo)' })
  await c(45, 'lancarCaixa', { id: id(), tipo: 'saldoInicial', moeda: 'BOB', forma: 'qr', valor: bs(120000), descricao: 'Saldo inicial (banco/QR)' })
  await c(45, 'lancarCaixa', { id: id(), tipo: 'saldoInicial', moeda: 'USD', forma: 'dinheiro', valor: 200000, descricao: 'Saldo inicial em dólar' })

  // ---------- 1) compra de lote BRUTO (40 kg) → triagem → separação ----------
  const compraBruto = 'c-bruto'
  await c(40, 'criarCompra', { id: compraBruto, moduloId: 'cabelo', pessoaId: iran, localId: 'loc-deposito', linhas: [{ id: id(), quantidade: 40000, moeda: 'BOB', total: bs(240000), campos: { estado: 'Bruto', categoria: 'Normal', cor: 'Misturado', origem: 'Bolívia' } }], obs: 'Lote bruto de 40 kg' })
  const linhaBruto = (await b.consulta('compra', { id: compraBruto })).compra.linhas[0].id
  await c(40, 'avancarTriagem', { compraId: compraBruto, para: 'conferido', ajustes: [{ linhaId: linhaBruto, quantidade: 39800 }], motivo: 'Na balança deu 39,8 kg' })
  await c(39, 'avancarTriagem', { compraId: compraBruto, para: 'pago', pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: bs(120000) }, { id: id(), forma: 'dinheiro', moeda: 'BOB', valor: bs(80000) }] })
  await c(39, 'avancarTriagem', { compraId: compraBruto, para: 'concluido' })
  const loteBruto = (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.id === compraBruto)!.id
  const l60 = 'lote-60-preto'
  const l50 = 'lote-50-castanho'
  const l40 = 'lote-40-castanho'
  const l55t = 'lote-55-tinte'
  await c(38, 'separarLote', {
    id: id(),
    loteId: loteBruto,
    quantidadeUsada: 39800,
    saidas: [
      { id: l60, quantidade: 18000, valorReferencia: '18', campos: { estado: 'Separado', comprimento: 60, categoria: 'Normal', cor: 'Preto' } },
      { id: l50, quantidade: 11500, valorReferencia: '7,5', campos: { estado: 'Separado', comprimento: 50, categoria: 'Normal', cor: 'Castanho' } },
      { id: l40, quantidade: 7800, valorReferencia: '3,9', campos: { estado: 'Separado', comprimento: 40, categoria: 'Normal', cor: 'Castanho' } },
      { id: l55t, quantidade: 2000, valorReferencia: '6,5', campos: { estado: 'Separado', comprimento: 55, categoria: 'Tinte', cor: 'Castanho claro' } },
    ],
  })
  // os 4 pacotes já ganharam etiqueta (Etiquetas › Já impressa); os das compras seguintes ficam em "Sem etiqueta"
  await c(38, 'marcarEtiquetasImpressas', { ids: [l60, l50, l40, l55t] }, 16)
  await c(36, 'registrarAcerto', { id: id(), pessoaId: iran, direcao: 'paguei', valor: bs(25000), moeda: 'BOB', forma: 'qr', descricao: 'Parte do que faltava' })

  // ---------- 2) adiantamento e compra da Cirila pela tabela (já separado por medida) ----------
  await c(33, 'registrarAcerto', { id: id(), pessoaId: cirila, direcao: 'paguei', adiantamento: true, valor: bs(5000), moeda: 'BOB', forma: 'dinheiro', descricao: 'Anticipo' })
  const compraCirila = 'c-cirila'
  const linhaTab = (medida: number, g: number, coluna: string, fator: string, extra: Record<string, string> = {}) => ({
    id: id(),
    quantidade: g,
    moeda: 'BOB',
    total: 0,
    calculo: { medida, fator, tabelaId: tabGeral, colunaId: coluna, categoria: extra.categoria },
    campos: { estado: 'Separado', categoria: extra.categoria ?? 'Normal', cor: extra.cor ?? 'Castanho' },
  })
  await c(30, 'criarCompra', {
    id: compraCirila,
    moduloId: 'cabelo',
    pessoaId: cirila,
    linhas: [linhaTab(38, 367, 'cirila', '1'), linhaTab(40, 135, 'cirila', '3'), linhaTab(50, 159, 'cirila', '6'), linhaTab(55, 162, 'cirila', '6,4'), linhaTab(60, 137, 'cirila', '16')],
  })
  await c(30, 'avancarTriagem', { compraId: compraCirila, para: 'conferido' })
  await c(30, 'avancarTriagem', { compraId: compraCirila, para: 'pago', pagamentos: [] })
  await c(30, 'avancarTriagem', { compraId: compraCirila, para: 'concluido' })

  // ---------- 3) compra da Elena, paga na hora ----------
  const compraElena = 'c-elena'
  await c(28, 'criarCompra', {
    id: compraElena,
    moduloId: 'cabelo',
    pessoaId: elena,
    linhas: [linhaTab(40, 73, 'elena', '3'), linhaTab(50, 121, 'elena', '6'), linhaTab(55, 419, 'elena', '6,4'), linhaTab(60, 725, 'elena', '16'), linhaTab(70, 500, 'elena', '17', { cor: 'Preto' }), linhaTab(80, 183, 'elena', '18,2', { cor: 'Preto' })],
  })
  const totalElena = (await b.consulta('compra', { id: compraElena })).compra.linhas.reduce((s, l) => s + l.total, 0)
  await c(28, 'avancarTriagem', { compraId: compraElena, para: 'conferido' })
  await c(28, 'avancarTriagem', { compraId: compraElena, para: 'pago', pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: totalElena }] })
  await c(28, 'avancarTriagem', { compraId: compraElena, para: 'concluido' })
  // ---------- viagem de compra (Paula foi a Oruro: adiantamento, gastos, 2 compras, prestação de contas) ----------
  await c(32, 'salvarViagem', { id: 'vg-oruro', nome: 'Feira de cabelo · Oruro', destino: 'Oruro', viajantes: [mariana], inicio: somarDias(hoje, -32), fim: somarDias(hoje, -27), orcamento: bs(1500), orcamentoCompra: bs(70000) })
  await c(32, 'adiantarViagem', { id: id(), viagemId: 'vg-oruro', moeda: 'BOB', forma: 'dinheiro', valor: bs(2000) })
  await c(32, 'adiantarViagem', { id: id(), viagemId: 'vg-oruro', moeda: 'USD', forma: 'dinheiro', valor: 10000 })
  await c(32, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-oruro', categoria: 'combustivel', moeda: 'BOB', valor: bs(450), nota: 'Ida' }, 9)
  await c(31, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-oruro', categoria: 'hospedagem', moeda: 'BOB', valor: bs(600), nota: '3 noites' }, 20)
  await c(30, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-oruro', categoria: 'comida', moeda: 'BOB', valor: bs(280) }, 13)
  await c(29, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-oruro', categoria: 'transporte', moeda: 'USD', valor: 2500, nota: 'Táxi para a feira' }, 11)
  await c(28, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-oruro', categoria: 'imprevisto', moeda: 'BOB', valor: bs(120), nota: 'Pneu furado' }, 18)
  await c(28, 'vincularCompras', { viagemId: 'vg-oruro', compraIds: [compraCirila, compraElena] }, 19)
  // voltou com Bs 500 (esperado 550: faltaram 50) e US$ 75; o gasto entra no custo dos lotes
  await c(27, 'encerrarViagem', { viagemId: 'vg-oruro', contado: { BOB: bs(500), USD: 7500 }, incorporar: true, obs: 'Faltaram Bs 50 sem recibo' })

  const loteDe = async (compraId: Id, medida: number) => (await b.consulta('estoque', { moduloId: 'cabelo' })).find((i) => i.origem?.id === compraId && Number(i.campos.comprimento) === medida)!.id

  // ---------- vendas de cabelo (vendas parciais da mesma compra) ----------
  const venda = (lote: Id, medida: number, g: number, coluna: string, fator: string, categoria?: string) => ({
    id: id(),
    itemId: lote,
    quantidade: g,
    moeda: 'BOB',
    total: 0,
    calculo: { medida, fator, tabelaId: categoria === 'Tinte' ? 'tab-tinte' : tabGeral, colunaId: coluna, categoria },
  })
  const elena70 = await loteDe(compraElena, 70)
  const elena55 = await loteDe(compraElena, 55)
  await c(20, 'concluirVenda', {
    id: 'v-henry',
    pessoaId: henry,
    linhas: [venda(l60, 60, 7584, 'henry', '17'), venda(elena70, 70, 500, 'henry', '18,2'), venda(elena55, 55, 300, 'henry', '7,5')],
    pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: bs(70000) }],
    obs: 'Restante fica na conta (falta)',
  })
  await c(15, 'registrarAcerto', { id: id(), pessoaId: henry, direcao: 'recebi', valor: bs(50000), moeda: 'BOB', forma: 'qr', descricao: '50.000 por QR' })
  await c(12, 'concluirVenda', {
    id: 'v-pw',
    pessoaId: pw,
    linhas: [venda(l50, 50, 4327, 'pw', '7,5'), venda(l40, 40, 5287, 'pw', '3,9')],
    pagamentos: [
      { id: id(), forma: 'dinheiro', moeda: 'BOB', valor: bs(46000) },
      { id: id(), forma: 'dinheiro', moeda: 'USD', valor: 100000 },
    ],
  })
  await c(8, 'concluirVenda', { id: 'v-wilson', pessoaId: wilson, linhas: [venda(l55t, 55, 1200, 'venda', '6,5', 'Tinte')], pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: bs(7800) }] })
  await c(5, 'concluirVenda', { id: 'v-henry2', pessoaId: henry, linhas: [venda(l60, 60, 2008, 'henry', '17'), venda(l50, 50, 1500, 'henry', '6,5')], pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: bs(43886) }] })

  // ---------- compras ainda na triagem ----------
  await c(6, 'criarCompra', { id: 'c-maria', moduloId: 'cabelo', pessoaId: maria, linhas: [linhaTab(40, 480, 'lp', '3'), linhaTab(50, 159, 'lp', '6'), linhaTab(60, 31, 'lp', '15'), linhaTab(70, 183, 'lp', '18')] })
  await c(5, 'avancarTriagem', { compraId: 'c-maria', para: 'conferido' })
  await c(1, 'criarCompra', { id: 'c-wilson', moduloId: 'cabelo', pessoaId: wilson, linhas: [{ id: id(), quantidade: 3000, moeda: 'BOB', total: bs(15000), campos: { estado: 'Bruto', categoria: 'Normal', cor: 'Misturado' } }], obs: 'Ofereceu 3 kg bruto' })

  // ---------- salão: atendimentos de 30 dias ----------
  const pagar = async (dias: number, hora: number, cliente: Id, local: Id, prof: Id, servicos: [Id, number][], forma = 'dinheiro', cabelo?: [Id, number, string]) => {
    const linhas: DadosComando<'concluirVenda'>['linhas'] = servicos.map(([sid, preco]) => ({ id: id(), itemId: sid, quantidade: 1, moeda: 'BOB', total: bs(preco), profissionalId: prof }))
    let total = servicos.reduce((s, [, p]) => s + bs(p), 0)
    if (cabelo) {
      linhas.push({ id: id(), itemId: cabelo[0], quantidade: cabelo[1], moeda: 'BOB', total: 0, calculo: { medida: 60, fator: cabelo[2], tabelaId: tabGeral, colunaId: 'henry' } })
      total += Math.round(cabelo[1] * Number(cabelo[2].replace(',', '.')) * 100)
    }
    await c(dias, 'concluirVenda', { id: id(), pessoaId: cliente, localId: local, profissionalId: prof, linhas, pagamentos: [{ id: id(), forma, moeda: 'BOB', valor: total }] }, hora)
  }
  await pagar(44, 15, bia, centro, vero, [[manut, 250]], 'qr')
  await pagar(25, 9, ana, centro, vero, [[mega, 600]], 'qr', [l60, 150, '17'])
  const roteiro: [number, Id, Id, Id, [Id, number][], string][] = [
    [28, carla, norte, luz, [[cor, 250]], 'dinheiro'],
    [27, elisa, centro, china, [[corte, 80], [escova, 60]], 'qr'],
    [24, dani, norte, karen, [[corte, 80]], 'dinheiro'],
    [22, ana, centro, dina, [[escova, 60]], 'dinheiro'],
    [21, carla, norte, luz, [[corte, 80]], 'qr'],
    [18, bia, centro, china, [[cor, 250]], 'qr'],
    [16, dani, norte, luz, [[cor, 250], [escova, 60]], 'dinheiro'],
    [14, elisa, centro, vero, [[cor, 250]], 'qr'],
    [11, carla, norte, karen, [[escova, 60]], 'dinheiro'],
    [9, ana, centro, china, [[corte, 80]], 'dinheiro'],
    [7, dani, norte, luz, [[corte, 80]], 'qr'],
    [4, bia, centro, dina, [[escova, 60]], 'dinheiro'],
    [3, elisa, centro, vero, [[corte, 80], [cor, 250]], 'qr'],
    [2, carla, norte, karen, [[cor, 250]], 'qr'],
    [1, ana, centro, vero, [[escova, 60]], 'dinheiro'],
  ]
  for (const [d, cli, loc, prof, sv, forma] of roteiro) await pagar(d, 11, cli, loc, prof, sv, forma)

  // agendados (de hoje em diante)
  const agendar = async (diasDepois: number, hora: number, cliente: Id, local: Id, prof: Id, sid: Id, preco: number) => {
    const [a, m, d] = somarDias(hoje, diasDepois).split('-').map(Number)
    await b.comando('concluirVenda', { id: id(), pessoaId: cliente, localId: local, profissionalId: prof, agendadoPara: new Date(a, m - 1, d, hora).toISOString(), linhas: [{ id: id(), itemId: sid, quantidade: 1, moeda: 'BOB', total: bs(preco), profissionalId: prof }], pagamentos: [] })
  }
  await agendar(0, 15, ana, centro, vero, corte, 80)
  await agendar(0, 16, carla, norte, luz, cor, 250)
  await agendar(1, 11, elisa, centro, dina, escova, 60)
  await agendar(2, 10, bia, centro, vero, manut, 250)

  // ---------- despesas por unidade, retiradas das sócias ----------
  await c(30, 'lancarCaixa', { id: 'd-aluguel-centro', tipo: 'despesa', moeda: 'BOB', forma: 'qr', valor: bs(3500), descricao: 'Aluguel', categoria: 'Aluguel', localId: centro })
  await c(30, 'lancarCaixa', { id: id(), tipo: 'despesa', moeda: 'BOB', forma: 'qr', valor: bs(2800), descricao: 'Aluguel', categoria: 'Aluguel', localId: norte })
  await c(10, 'lancarCaixa', { id: id(), tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(400), descricao: 'Luz', categoria: 'Luz e água', localId: centro })
  await c(9, 'lancarCaixa', { id: id(), tipo: 'despesa', moeda: 'BOB', forma: 'dinheiro', valor: bs(1200), descricao: 'Transporte do cabelo', categoria: 'Transporte' })
  await c(2, 'lancarCaixa', { id: id(), tipo: 'retirada', moeda: 'BOB', forma: 'dinheiro', valor: bs(10000), descricao: 'Retirada', socioId: 'socia-a' })
  await c(2, 'lancarCaixa', { id: id(), tipo: 'retirada', moeda: 'BOB', forma: 'dinheiro', valor: bs(8000), descricao: 'Retirada', socioId: 'socia-b' })

  await c(3, 'pagarSalario', { id: id(), pessoaId: karen, valor: bs(600), moeda: 'BOB', forma: 'dinheiro', referencia: 'Semana passada' })
  await c(1, 'pagarSalario', { id: id(), pessoaId: dina, valor: bs(120), moeda: 'BOB', forma: 'dinheiro', referencia: 'Diária' })

  // ---------- empréstimos ----------
  await c(35, 'criarEmprestimo', { id: 'e-lucho', direcao: 'dado', pessoaId: lucho, moeda: 'BOB', principal: bs(28000), juros: { tipo: 'simples', taxaMensalBp: 500 }, parcelas: 4, primeiroVencimento: somarDias(hoje, -5), forma: 'dinheiro' })
  await c(35, 'criarEmprestimo', { id: 'e-papa', direcao: 'tomado', pessoaId: papa, moeda: 'BOB', principal: bs(50000), juros: { tipo: 'nenhum' }, parcelas: 10, primeiroVencimento: somarDias(hoje, -25), forma: 'qr' })
  await c(25, 'pagarEmprestimo', { id: id(), emprestimoId: 'e-papa', valor: bs(5000), forma: 'qr' })

  // ---------- adiantamento a parceiro (dinheiro para comprar cabelo; a dívida é paga com o cabelo entregue) ----------
  await c(20, 'salvarPessoa', { id: 'p-parceiro', nome: 'Parceiro do interior (fictício)', papeis: ['fornecedor'] })
  await c(20, 'criarFinanciamento', { id: 'ad-parceiro', pessoaId: 'p-parceiro', moeda: 'BOB', valor: bs(5000), forma: 'dinheiro', obs: 'Comprar cabelo nas feiras do interior' })
  await c(12, 'registrarEntregaFinanciamento', { id: 'c-ad-parceiro', financiamentoId: 'ad-parceiro', linhas: [{ id: id(), quantidade: 1200, moeda: 'BOB', total: bs(3000), campos: { estado: 'Bruto', categoria: 'Normal', cor: 'Castanho', origem: 'Bolívia' } }] })

  // ---------- comissão paga (parte do que a Sofia ganhou) e uma venda corrigida ----------
  await c(1, 'pagarComissao', { id: id(), pessoaId: vero, valor: bs(200), moeda: 'BOB', forma: 'dinheiro', referencia: 'Adiantamento de comissão' })
  await c(4, 'corrigirVenda', { id: 'v-wilson', linhas: [{ linhaId: (await b.consulta('venda', { id: 'v-wilson' })).venda.linhas[0].id, quantidade: 1180 }], motivo: 'Na balança deu 1.180 g', diferenca: 'conta' })

  // ---------- viagem aberta (prospecção, já passou do orçamento: alerta no painel) ----------
  await c(2, 'salvarViagem', { id: 'vg-cocha', nome: 'Prospecção · Cochabamba', destino: 'Cochabamba', viajantes: [mariana], inicio: somarDias(hoje, -2), fim: somarDias(hoje, 1), orcamento: bs(400) })
  await c(2, 'adiantarViagem', { id: id(), viagemId: 'vg-cocha', moeda: 'BOB', forma: 'dinheiro', valor: bs(800) })
  await c(2, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-cocha', categoria: 'combustivel', moeda: 'BOB', valor: bs(300) }, 12)
  await c(1, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-cocha', categoria: 'hospedagem', moeda: 'BOB', valor: bs(250) }, 21)

  // ==========================================================================================================
  // CENÁRIOS PARA A DEMONSTRAÇÃO: cada tela com tudo o que ela sabe mostrar
  // ==========================================================================================================

  // ---------- 2ª viagem com compra (Renata em Sucre): Relatórios › Viagens compara uma contra a outra ----------
  await c(26, 'salvarViagem', { id: 'vg-sucre', nome: 'Feira de cabelo · Sucre', destino: 'Sucre', viajantes: [alison], inicio: somarDias(hoje, -26), fim: somarDias(hoje, -24), orcamento: bs(800), orcamentoCompra: bs(25000) })
  await c(26, 'adiantarViagem', { id: id(), viagemId: 'vg-sucre', moeda: 'BOB', forma: 'dinheiro', valor: bs(1000) })
  await c(26, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-sucre', categoria: 'combustivel', moeda: 'BOB', valor: bs(350), nota: 'Ida e volta' }, 8)
  await c(25, 'registrarDespesaViagem', { id: id(), viagemId: 'vg-sucre', categoria: 'hospedagem', moeda: 'BOB', valor: bs(300), nota: '2 noites' }, 21)
  await c(25, 'criarCompra', { id: 'c-sucre', moduloId: 'cabelo', pessoaId: maria, linhas: [{ id: id(), quantidade: 6000, moeda: 'BOB', total: bs(21000), campos: { estado: 'Bruto', categoria: 'Normal', cor: 'Castanho', origem: 'Bolívia' } }], obs: 'Comprado na feira de Sucre' })
  await c(25, 'avancarTriagem', { compraId: 'c-sucre', para: 'conferido' })
  await c(25, 'avancarTriagem', { compraId: 'c-sucre', para: 'pago', pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: bs(21000) }] })
  await c(25, 'avancarTriagem', { compraId: 'c-sucre', para: 'concluido' })
  await c(24, 'vincularCompras', { viagemId: 'vg-sucre', compraIds: ['c-sucre'] }, 18)
  await c(24, 'encerrarViagem', { viagemId: 'vg-sucre', contado: { BOB: bs(350) }, incorporar: true })

  // ---------- compra cancelada (Comprar › Canceladas) ----------
  await c(10, 'criarCompra', { id: 'c-cancelada', moduloId: 'cabelo', pessoaId: maria, linhas: [{ id: id(), quantidade: 800, moeda: 'BOB', total: bs(2400), campos: { estado: 'Bruto', categoria: 'Normal', cor: 'Misturado' } }] })
  await c(10, 'cancelarCompra', { compraId: 'c-cancelada', motivo: 'Cabelo chegou molhado e com nós: devolvido' })

  // ---------- pacote JUNTADO (Triagem › 🔗 juntado): os dois brutos castanhos viram um só ----------
  const estoqueAgora = await b.consulta('estoque', { moduloId: 'cabelo' })
  const brutoSucre = estoqueAgora.find((i) => i.origem?.id === 'c-sucre')?.id
  const brutoParceiro = estoqueAgora.find((i) => i.origem?.id === 'c-ad-parceiro')?.id
  if (brutoSucre && brutoParceiro) await c(9, 'unificarLotes', { id: 'lote-juntado', ids: [brutoSucre, brutoParceiro], motivo: 'Mesma cor e origem: separar de uma vez' })

  // ---------- vendas: cancelada, com desconto, de produto (com vendedora), em aberto e com divisão de valores ----------
  await c(6, 'concluirVenda', { id: 'v-cancelada', pessoaId: henry, profissionalId: mariana, linhas: [venda(l40, 40, 500, 'lp', '3')], pagamentos: [{ id: id(), forma: 'qr', moeda: 'BOB', valor: bs(1500) }] })
  await c(6, 'cancelarVenda', { id: 'v-cancelada', motivo: 'A cliente desistiu na hora' })
  await c(3, 'concluirVenda', { id: 'v-produto', pessoaId: bia, localId: centro, profissionalId: mariana, linhas: [{ id: id(), itemId: 'pr-presilha', quantidade: 2, moeda: 'BOB', total: bs(50) }], desconto: { moeda: 'BOB', pct: 10 }, pagamentos: [{ id: id(), forma: 'dinheiro', moeda: 'BOB', valor: bs(45) }] })
  await c(5, 'salvarDivisaoVenda', {
    id: 'v-henry2',
    partes: [
      { id: id(), nome: 'Sócia A', modo: 'pct', pctBp: 5000, base: 'lucro' },
      { id: id(), nome: 'Sócia B', modo: 'pct', pctBp: 5000, base: 'lucro' },
      { id: id(), nome: 'Indicação (Paula)', pessoaId: mariana, modo: 'valor', valor: bs(200), base: 'total', obs: 'Trouxe o cliente' },
    ],
  })
  // começou e não fechou: fica guardada (Vender › Em aberto · o Modo caixa retoma)
  await c(0, 'salvarVendaAberta', { id: 'va-pw', pessoaId: pw, vendedorId: mariana, linhas: [{ id: id(), itemId: l40, quantidade: 300 }], total: bs(1170), moedaTotal: 'BOB', obs: 'Volta à tarde para pagar' }, 9)

  // ---------- agenda: compromissos (meu, de uma funcionária e um já feito) ----------
  await c(5, 'salvarEvento', { id: 'ev-contador', titulo: 'Fechar o mês com o contador', data: somarDias(hoje, 3), hora: '10:00', duracaoMin: 60, nota: 'Levar as facturas de compra' })
  await c(5, 'salvarEvento', { id: 'ev-correio', titulo: 'Buscar mechas no correio', data: somarDias(hoje, 1), pessoaId: vero })
  await c(3, 'salvarEvento', { id: 'ev-aluguel', titulo: 'Pagar o aluguel do Norte', data: somarDias(hoje, -2), pessoaId: alison })
  await c(2, 'concluirEvento', { id: 'ev-aluguel' })

  // ---------- Imposto de Renda: compra com factura, compra sem factura (retenção), recibo de aluguel e IVA pago ----------
  await c(27, 'classificarDocumentoFiscal', { alvo: 'compra', id: compraElena, documento: 'factura', numero: '000123' })
  await c(38, 'classificarDocumentoFiscal', { alvo: 'compra', id: compraBruto, documento: 'sem' })
  await c(29, 'classificarDocumentoFiscal', { alvo: 'despesa', id: 'd-aluguel-centro', documento: 'recibo', dedutivel: true })
  {
    const [a, m] = somarDias(hoje, -30).split('-').map(Number)
    const periodo = `${a}-${String(m).padStart(2, '0')}`
    await c(2, 'registrarObrigacaoFiscal', { id: 'ob-iva', ano: a, periodo, obrigacao: 'iva', formulario: 'F-200', numeroOrden: '1029384756', declaradoEm: somarDias(hoje, -2), valorDeclarado: bs(1200), pagoEm: somarDias(hoje, -2), valorPago: bs(1200), obs: 'Declarado pelo contador (exemplo)' })
  }

  // ---------- acesso: o que a funcionária faz (Paula é gerente e viaja) e uma forma de pagamento desligada ----------
  {
    const cfg = (await b.consulta('configuracoes', {})).config
    await c(1, 'salvarConfig', {
      funcionariaTelas: ['viagens'],
      funcionariaConfig: ['catalogo'],
      formas: cfg.formas.map((f) => (f.id === 'debito' ? { ...f, desligada: true } : f)),
    })
  }

  // ---------- MINHA VITRINE: mais pacotes prontos (triagem + etiqueta) e a loja configurada ----------
  // o pacote juntado é separado em 4 medidas e ganha etiqueta; 2 pacotes da Helena também ganham etiqueta
  if (brutoSucre && brutoParceiro) {
    await c(8, 'separarLote', {
      id: id(),
      loteId: 'lote-juntado',
      quantidadeUsada: 7200,
      saidas: [
        { id: 'vit-45-claro', quantidade: 1800, campos: { estado: 'Separado', comprimento: 45, categoria: 'Normal', cor: 'Castanho claro', origem: 'Bolívia' } },
        { id: 'vit-65-castanho', quantidade: 2200, campos: { estado: 'Separado', comprimento: 65, categoria: 'Normal', cor: 'Castanho', origem: 'Bolívia' } },
        { id: 'vit-70-loiro', quantidade: 1300, campos: { estado: 'Separado', comprimento: 70, categoria: 'Normal', cor: 'Loiro', origem: 'Bolívia' } },
        { id: 'vit-50-ruivo', quantidade: 1700, campos: { estado: 'Separado', comprimento: 50, categoria: 'Tinte', cor: 'Ruivo', origem: 'Bolívia' } },
      ],
    })
    await c(8, 'marcarEtiquetasImpressas', { ids: ['vit-45-claro', 'vit-65-castanho', 'vit-70-loiro', 'vit-50-ruivo'] }, 15)
  }
  await c(27, 'marcarEtiquetasImpressas', { ids: [await loteDe(compraElena, 60), await loteDe(compraElena, 80)] }, 17)
  await c(1, 'salvarConfig', {
    vitrine: {
      ativa: true,
      nome: 'Cabelos da Família · Santa Cruz',
      descricao: 'Cabelo natural boliviano, separado por medida e pesado na balança. Atacado e varejo.',
      whatsapp: '+591 70000000',
      mostrarPreco: true,
      ocultos: [l40],
    },
  })

  // ---------- metas do mês (Painel; a Sofia vê as dela em Vender, só a %) ----------
  await c(1, 'salvarConfig', {
    metas: {
      painel: true,
      mostrarValor: true,
      funcionaria: true,
      funcionariaValor: false,
      itens: [
        { id: 'meta-empresa', alvo: 'empresa', indicador: 'faturamento', valor: bs(150000), ativa: true, nome: 'Faturamento da empresa' },
        { id: 'meta-centro', alvo: 'unidade', alvoId: centro, indicador: 'atendimentos', valor: 40, ativa: true },
        { id: 'meta-sofia', alvo: 'pessoa', alvoId: vero, indicador: 'faturamento', valor: bs(3000), ativa: true },
      ],
    },
  })

  // ---------- QR seguro: os pacotes com etiqueta já usam o código aleatório (…#/q/<código>) ----------
  {
    const comEtiqueta = (await b.consulta('estoque', { moduloId: 'cabelo' })).filter((i) => i.etiquetaImpressaEm).map((i) => i.id)
    if (comEtiqueta.length) await c(0, 'prepararQrEtiquetas', { ids: comEtiqueta })
  }

  // ---------- usuários (senha demo1234) ----------
  const U = (login: string, nome: string, perfil: 'admin' | 'funcionario', pessoaId?: string, localId?: string) =>
    c(0, 'salvarUsuario', { id: `u-${login}`, login, nome, perfil, pessoaId, localId, senha: SENHA_DEMO })
  await U('admin', 'Administrador', 'admin')
  await U('bianca', 'Bianca (diretora)', 'admin', rosa, centro)
  await U('paula', 'Paula (gerente Centro)', 'funcionario', mariana, centro)
  await U('renata', 'Renata (gerente Norte)', 'funcionario', alison, norte)
  await U('sofia', 'Sofia', 'funcionario', vero, centro)
  await U('lia', 'Lia', 'funcionario', china, centro)
  await U('nina', 'Nina', 'funcionario', dina, centro)
  await U('clara', 'Clara', 'funcionario', luz, norte)
  await U('julia', 'Júlia', 'funcionario', karen, norte)
  // usuário desativado (Configurações › Usuários): não entra mais, o que fez continua no histórico
  await c(0, 'salvarUsuario', { id: 'u-ex', login: 'ex.funcionaria', nome: 'Ex-funcionária', perfil: 'funcionario', senha: SENHA_DEMO, ativo: false })
}
