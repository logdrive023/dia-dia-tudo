// NOVA COMPRA — o ESTADO e as REGRAS do formulário (linhas, valores, cotação, tabela de preço, o que falta,
// rascunho, salvar). A tela (NovaCompra.tsx) e a linha (LinhaCompra.tsx) só mostram e chamam o que vem daqui.
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatar, multiplicarFator, fatorValido, moeda as moedaDe } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id, Transacao } from '../../../core/domain/tipos'
import type { ModoCompra } from '../../../core/services/codigos'
import { type CampoFormId, type FormCompraConfig } from '../../../core/services/formCompra'
import { fatorDaTabela } from '../../../core/services/precos'
import { moedaPadrao, ehToque } from '../../../shared/ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { converterDigitado, cotacaoSistema, moedasDoCampo } from '../../../shared/ui/valorMoeda'
import { useT } from '../../../shared/ui/i18n'
import { CAMPOS_FIXOS, SELETOR_CAMPO, deLinhas, moedaDaAnterior, type LinhaNova } from '../model/linhaNova'

export function useNovaCompra({ modulos, base, form }: { modulos: { id: string; nome: string; icone: string }[]; base?: Transacao; form: FormCompraConfig }) {
  const t = useT()
  const { ir, marcarSujo, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { executar, ocupado } = useComando()
  // id do rascunho (as fotos já anexadas ficam nele); começar de novo = id novo
  const [id, setId] = useState(() => novoId())
  const cfgCampo = (c: CampoFormId) => form.campos.find((x) => x.id === c)
  const visivel = (c: CampoFormId) => !!cfgCampo(c)?.visivel
  const obrig = (c: CampoFormId) => !!cfgCampo(c)?.obrigatorio
  const [moduloId, setModuloId] = useState(base?.moduloId ?? (form.padroes.moduloId && modulos.some((m) => m.id === form.padroes.moduloId) ? form.padroes.moduloId : modulos[0]?.id ?? 'cabelo'))
  const ehCabelo = moduloId === 'cabelo'
  const modulo = modulos.find((m) => m.id === moduloId)
  const [pessoaId, setPessoaIdBruto] = useState<Id | undefined>(base?.pessoaId)
  const [compradorId, setCompradorId] = useState<Id | undefined>(sessao.pessoaId)
  const moeda = form.padroes.moeda ?? moedaPadrao()

  // código do pedido: o tipo vem da regra (ou do formulário) e dá para trocar só nesta compra
  const { dados: codigos } = useConsulta('codigos', {}, admin)
  const regraCompra = codigos?.regras.compra
  const [modoEscolhido, setModoEscolhido] = useState<ModoCompra | undefined>(form.padroes.modoCodigo)
  const modoCodigo: ModoCompra = modoEscolhido ?? regraCompra?.modo ?? 'incremental'
  const [codigo, setCodigo] = useState('')
  const [codigoOk, setCodigoOk] = useState(true)
  const marcarCodigo = useCallback((ok: boolean) => setCodigoOk(ok), [])
  const porComprador = modoCodigo === 'porPessoa' && regraCompra?.base === 'comprador'
  const { dados: previsto } = useConsulta('codigoDisponivel', { tipo: 'compra', codigo: '', modoCodigo, pessoaId, compradorId }, admin)
  const codigoMostrado = modoCodigo === 'manual' && codigo.trim() ? codigo.trim() : previsto?.sugestao

  const [obs, setObs] = useState('')
  const [estado, setEstado] = useState<string[]>([])
  // VIAGEM: as abertas (funcionária vê só as dela); vem escolhida a viagem aberta de quem comprou (ou de quem registra)
  const { dados: vgs } = useConsulta('viagens', { status: 'aberta' })
  const viagensAbertas = vgs?.linhas ?? []
  const [viagemEscolhida, setViagemEscolhida] = useState<string>()
  const quemViaja = compradorId ?? sessao.pessoaId
  const viagemSugerida = quemViaja ? viagensAbertas.find((v) => v.viajantes.some((x) => x.id === quemViaja)) : undefined
  const [abertos, setAbertos] = useState<Set<CampoFormId>>(() => new Set(form.campos.filter((c) => c.aberto || c.obrigatorio).map((c) => c.id)))
  const viagemId = viagemEscolhida === undefined ? (abertos.has('viagem') ? viagemSugerida?.id : undefined) : viagemEscolhida || undefined
  const viagemAtual = viagensAbertas.find((v) => v.id === viagemId)
  const nomeViagem = (v: (typeof viagensAbertas)[number]) => [v.codigo, v.nome, v.destino].filter(Boolean).join(' · ')
  const [tentou, setTentou] = useState(false)
  const [focarCampo, setFocarCampo] = useState<CampoFormId>()
  const [attrAbertos, setAttrAbertos] = useState<Set<Id>>(new Set())
  // PASSO A PASSO (como o Separar): 1 Fornecedor · 2 O que veio · 3 Detalhes; repetir compra já começa no 2
  const [passosAbertos, setPassosAbertos] = useState<Set<number>>(() => new Set([base?.pessoaId ? 2 : 1]))
  // um passo aberto por vez (abrir outro fecha o de antes); o Passo rola até o que abriu
  const alternarPasso = (n: number) => setPassosAbertos((s) => (s.has(n) ? new Set([...s].filter((x) => x !== n)) : new Set([n])))
  const irPasso = (n: number) => setPassosAbertos(new Set([n]))
  // com várias linhas, só uma fica aberta (as outras numa linha: "2 · Bruto · 2 kg · Bs 3.000")
  const [linhaAberta, setLinhaAberta] = useState<Id>()

  const novaLinha = (cabelo: boolean, ant?: LinhaNova): LinhaNova =>
    cabelo
      ? { id: novoId(), modo: ant?.modo === 'tabela' || ant?.modo === 'bruto' ? ant.modo : form.padroes.modoLinha, medida: ant?.modo === 'tabela' ? ant.medida : undefined, ...moedaDaAnterior(ant), campos: { categoria: (ant?.campos.categoria as string | undefined) ?? 'Normal', ...(ant?.campos.cor ? { cor: ant.campos.cor } : {}) } }
      : { id: novoId(), modo: 'item', ...moedaDaAnterior(ant), campos: {} }
  const [linhas, setLinhas] = useState<LinhaNova[]>(() => (base ? deLinhas(base.linhas, ehCabelo) : [novaLinha(ehCabelo)]))
  const att = (i: number, d: Partial<LinhaNova>) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...d } : l)))
  // VALOR EM OUTRA MOEDA: digita em US$/R$ (cotação de compra do sistema, dá para mudar) e a linha fica na moeda do pedido
  const { cot: cotCompra, cfg: cfgMoedas } = useCotacoes('compra')
  const moedasValor = moedasDoCampo(moeda, cfgMoedas?.moedasAtivas)
  const moedaDig = (l: LinhaNova) => (l.moedaDig && moedasValor.includes(l.moedaDig) ? l.moedaDig : moeda)
  const textoCot = (l: LinhaNova) => (moedaDig(l) === moeda ? '' : l.cotacao ?? cotacaoSistema(moedaDig(l), moeda, cotCompra))
  /** total da linha (moeda do pedido) a partir do digitado: bruto = o valor; produto = custo unitário × quantidade */
  const totalDigitado = (l: LinhaNova) => {
    if (l.modo === 'tabela' || l.digitado === undefined) return l.total
    const bruto = l.modo === 'item' ? (l.quantidade ? l.digitado * l.quantidade : undefined) : l.digitado
    return bruto === undefined ? undefined : converterDigitado(bruto, moedaDig(l), moeda, textoCot(l), cotCompra)
  }
  /** muda peso/quantidade/valor/moeda/cotação e recalcula o total da linha */
  const attValor = (i: number, d: Partial<LinhaNova>) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...d, total: totalDigitado({ ...l, ...d }) } : l)))

  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { dados: catalogo } = useConsulta('catalogo', { moduloId })
  const { dados: cfgApp } = useConsulta('configuracoes', {})
  // LINHA JÁ PAGA (por linha): a forma em que as linhas marcadas foram pagas (uma só para todas; dinheiro é o comum)
  const [formaPaga, setFormaPaga] = useState('dinheiro')
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: true })
  const { dados: conta } = useConsulta('contaPessoa', { pessoaId: pessoaId ?? '' }, !!pessoaId)
  const { dados: anexos } = useConsulta('anexosDe', { donoId: id })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  const modCfg = cfgApp?.modulos.find((m) => m.id === moduloId)
  const etapasFluxo = modCfg?.etapas ?? []
  // atributos do tipo de item (os do código + os criados em Configurações › Atributos)
  const camposTipo = modCfg?.tiposItem.find((x) => x.controlaEstoque)?.campos ?? []
  const extras = camposTipo.filter((c) => !CAMPOS_FIXOS.includes(c.id))

  // fornecedor: recentes, sigla, última compra e a coluna de costume
  const recentes = [...new Set((fila ?? []).map((c) => c.pessoaId).filter((x): x is Id => !!x))].slice(0, 5)
  const siglas: Record<Id, string> = Object.fromEntries([...(fila ?? []).filter((c) => c.pessoaId && c.sigla).map((c) => [c.pessoaId!, c.sigla!]), ...(codigos?.pessoas ?? []).map((p) => [p.id, p.sigla])])
  const ultima = pessoaId ? (fila ?? []).find((c) => c.pessoaId === pessoaId) : undefined
  const [coluna, setColuna] = useState<string>()
  const colunaUsual = tabela?.colunas.find((c) => c.pessoaId && c.pessoaId === pessoaId)?.id ?? (ultima?.linhas.map((l) => l.campos.colunaId).find((x) => typeof x === 'string') as string | undefined) ?? form.padroes.colunaId
  const existeColuna = (c?: string) => !!c && !!tabela?.colunas.some((x) => x.id === c)
  const col = existeColuna(coluna) ? coluna : existeColuna(colunaUsual) ? colunaUsual : tabela?.colunas[0]?.id
  const nomeColuna = tabela?.colunas.find((c) => c.id === col)?.nome
  const aplicarPessoa = (p?: Id) => (setPessoaIdBruto(p), setColuna(undefined))

  const fatorDaLinha = (l: LinhaNova) => {
    if (l.fator?.trim()) return fatorValido(l.fator) ? l.fator.trim() : undefined
    return (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined) ?? l.fatorAntigo
  }
  const totalLinha = (l: LinhaNova) => {
    if (l.campos.semValor) return 0
    if (l.modo === 'tabela') {
      const f = fatorDaLinha(l)
      return l.quantidade && f ? multiplicarFator(l.quantidade, f, moeda) : undefined
    }
    return l.total
  }
  const total = linhas.reduce((s, l) => s + (totalLinha(l) ?? 0), 0)
  const pagas = linhas.filter((l) => l.campos.jaPaga)
  const totalPago = pagas.reduce((s, l) => s + (totalLinha(l) ?? 0), 0)
  // todas pagas → a compra entra paga e concluída; só algumas → o valor delas entra como já pago e o resto fica em aberto
  const todasPagas = linhas.length > 0 && pagas.length === linhas.length
  const pesoTotal = linhas.reduce((s, l) => s + (l.quantidade ?? 0), 0)
  const custoKg = ehCabelo && pesoTotal > 0 && total > 0 ? Math.round((total * 1000) / pesoTotal) : undefined
  const descLinha = (l: LinhaNova) =>
    l.modo === 'tabela' ? `${l.medida ?? '?'} cm · ${t(String(l.campos.categoria ?? 'Normal'))}` : l.modo === 'bruto' ? `${t('Bruto')}${l.campos.cor ? ` · ${t(String(l.campos.cor))}` : ''}` : catalogo?.find((x) => x.id === l.itemId)?.nome ?? '—'

  // o que falta (o botão diz; cada campo mostra o seu depois da primeira tentativa)
  const faltasLinha = (l: LinhaNova, i: number) => {
    const n = i + 1
    const r: string[] = []
    if (l.modo === 'item' && !l.itemId) r.push(t('item da linha {n}', { n }))
    if (!l.quantidade) r.push(t(ehCabelo ? 'peso da linha {n}' : 'quantidade da linha {n}', { n }))
    if (l.modo === 'tabela') {
      if (l.fator?.trim() && !fatorValido(l.fator)) r.push(t('fator da linha {n}', { n }))
      else if (!l.medida) r.push(t('medida da linha {n}', { n }))
      else if (!l.campos.semValor && !fatorDaLinha(l)) r.push(t('fator da linha {n}', { n }))
    } else if (!l.campos.semValor && !l.total) r.push(t('valor da linha {n}', { n }))
    if (l.modo !== 'item') for (const c of extras.filter((x) => x.obrigatorio)) if (l.campos[c.id] === undefined || l.campos[c.id] === '') r.push(`${t(c.nome)} (${t('linha {n}', { n })})`)
    return r
  }
  const mostrarCodigo = visivel('codigo') && admin && !!codigos
  const faltas = [
    ...(obrig('fornecedor') && !pessoaId ? [t('fornecedor')] : []),
    ...(!linhas.length ? [t('o que veio')] : linhas.flatMap(faltasLinha)),
    ...(obrig('comprador') && !compradorId ? [t('quem comprou')] : []),
    ...(mostrarCodigo && modoCodigo === 'manual' && !codigoOk ? [t('código livre')] : []),
    ...(obrig('estado') && !estado.length ? [t('estado na chegada')] : []),
    ...(obrig('obs') && !obs.trim() ? [t('observação')] : []),
    ...(obrig('fotos') && !anexos?.length ? [t('fotos')] : []),
    ...(obrig('viagem') && !viagemId ? [t('viagem')] : []),
  ]
  const pode = !faltas.length && !ocupado

  // os dois jeitos da tela (Configurações › Formulário) usam o passo a passo vertical; "passo a passo" acrescenta o passo
  // Revisar no fim (confere tudo antes de registrar)
  const comRevisar = form.layout === 'passos'
  const aplicavel = (c: CampoFormId) => (c === 'coluna' ? ehCabelo && !!tabela : c === 'codigo' ? mostrarCodigo : c === 'viagem' ? viagensAbertas.length > 0 || obrig('viagem') : c !== 'atributos')
  const campos = form.campos.filter((c) => c.visivel && aplicavel(c.id))

  // algo digitado e não registrado: sair pede confirmação
  useAvisoSaida(!ocupado && (linhas.some((l) => l.quantidade || l.total) || !!obs.trim() || estado.length > 0))

  const caixa = useRef<HTMLDivElement>(null)
  // começa no primeiro campo
  useEffect(() => {
    if (!ehToque()) caixa.current?.querySelector<HTMLElement>(SELETOR_CAMPO)?.focus()
  }, [])
  // campo aberto pelo "+": o cursor vai para ele
  useEffect(() => {
    if (!focarCampo) return
    caixa.current?.querySelector<HTMLElement>(`[data-campo="${focarCampo}"] :is(${SELETOR_CAMPO})`)?.focus()
    setFocarCampo(undefined)
  }, [focarCampo])

  // a viagem NÃO abre sozinha: fica no "+ Viagem"; ao abrir já vem a viagem de quem comprou (se houver). O X fecha.
  const abrir = (c: CampoFormId) => (setAbertos(new Set([...abertos, c])), setFocarCampo(c))
  const estaAberto = (c: CampoFormId) => abertos.has(c) || (c === 'comprador' && porComprador)
  // TROCAR fornecedor ou módulo com algo preenchido: pergunta e começa limpo (só o módulo/fornecedor novo fica)
  const preenchido = linhas.some((l) => l.quantidade || l.total || l.itemId) || estado.length > 0 || !!obs.trim() || (anexos?.length ?? 0) > 0 || !!codigo.trim()
  const limparRascunho = (cabelo: boolean) => {
    setLinhas([novaLinha(cabelo)])
    setEstado([])
    setObs('')
    setCodigo('')
    setTentou(false)
    setAttrAbertos(new Set())
    setColuna(undefined)
    setId(novoId())
  }
  /** último fornecedor escolhido ("Trocar" limpa a escolha antes de escolher outro) */
  const ultimoFornecedor = useRef<Id | undefined>(base?.pessoaId)
  const [trocando, setTrocando] = useState<{ tipo: 'fornecedor' | 'modulo'; valor?: string; antes?: Id }>()
  const confirmou = useRef(false)
  // a ordem dos passos do formulário (a tela monta a lista e atualiza aqui a cada render; usada ao escolher o
  // fornecedor e ao tentar salvar com falta, para abrir o passo certo)
  const ordemPassos = useRef<string[]>([])
  const setPessoaId = (p?: Id) => {
    const antes = ultimoFornecedor.current
    if (p && antes && p !== antes && preenchido) {
      aplicarPessoa(p)
      confirmou.current = false
      return setTrocando({ tipo: 'fornecedor', valor: p, antes })
    }
    if (p) ultimoFornecedor.current = p
    aplicarPessoa(p)
    // escolheu: o passo 1 fecha (fica o nome no resumo) e abre "O que veio"
    const k = ordemPassos.current.indexOf('itens')
    if (p && k >= 0) irPasso(k + 1)
  }
  const trocarModulo = (m: string) => {
    if (m === moduloId) return
    if (preenchido) {
      confirmou.current = false
      return setTrocando({ tipo: 'modulo', valor: m })
    }
    setModuloId(m)
    setLinhas([novaLinha(m === 'cabelo')])
  }
  const confirmarTroca = () => {
    if (!trocando) return
    confirmou.current = true
    if (trocando.tipo === 'fornecedor') {
      ultimoFornecedor.current = trocando.valor
      limparRascunho(ehCabelo)
    } else {
      setModuloId(trocando.valor!)
      limparRascunho(trocando.valor === 'cabelo')
    }
  }
  const fecharTroca = () => {
    // "Voltar": fica o fornecedor de antes (e o módulo de antes) com tudo o que foi preenchido
    if (!confirmou.current && trocando?.tipo === 'fornecedor') aplicarPessoa(trocando.antes)
    setTrocando(undefined)
  }

  // valor digitado em outra moeda: o original e a cotação ficam na observação ("Linha 1: US$ 100,00 (1 US$ = 6,96 Bs)")
  const notasMoeda = linhas.flatMap((l, i) => {
    const m = moedaDig(l)
    if (m === moeda || l.modo === 'tabela' || l.digitado === undefined) return []
    const qtd = l.modo === 'item' && l.quantidade ? `${l.quantidade} × ` : ''
    return [`${t('Linha {n}', { n: i + 1 })}: ${qtd}${formatar(l.digitado, m)} (1 ${moedaDe(m).simbolo} = ${textoCot(l)} ${moedaDe(moeda).simbolo})`]
  })
  const salvar = async () => {
    if (!pode) {
      setTentou(true)
      // abre o passo onde está o que falta e rola até ele
      const alvo = obrig('fornecedor') && !pessoaId ? 'fornecedor' : !linhas.length || linhas.some((l, i) => faltasLinha(l, i).length) ? 'itens' : 'detalhes'
      const k = ordemPassos.current.indexOf(alvo)
      if (k >= 0) irPasso(k + 1)
      // a linha com falta abre (as outras ficam fechadas)
      const lf = linhas.find((l, i) => faltasLinha(l, i).length)
      if (lf) setLinhaAberta(lf.id)
      setTimeout(() => document.querySelector<HTMLElement>('[data-falta]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 50)
      return
    }
    const r = await executar('criarCompra', {
      id,
      moduloId,
      pessoaId,
      compradorId,
      modoCodigo: modoEscolhido,
      codigo: modoCodigo === 'manual' ? codigo.trim() || undefined : undefined,
      viagemId,
      pagarNoAto: todasPagas ? (totalPago > 0 ? [{ id: `${id}-pg`, forma: formaPaga, moeda, valor: totalPago }] : []) : undefined,
      pagoParcial: !todasPagas && totalPago > 0 ? [{ id: `${id}-pg`, forma: formaPaga, moeda, valor: totalPago }] : undefined,
      obs: [estado.length ? `${t('Estado na chegada')}: ${estado.map((x) => t(x)).join(', ')}` : '', obs.trim(), ...notasMoeda].filter(Boolean).join(' · ') || undefined,
      linhas: linhas.map((l) => {
        const fator = l.modo === 'tabela' && !l.campos.semValor ? fatorDaLinha(l) : undefined
        return {
          id: l.id,
          itemId: l.itemId,
          quantidade: l.quantidade ?? 0,
          moeda,
          total: l.campos.semValor ? 0 : l.total ?? 0,
          campos: { ...l.campos, estado: l.modo === 'bruto' ? 'Bruto' : ehCabelo ? 'Separado' : undefined },
          calculo: fator ? { medida: l.medida, fator, tabelaId: tabela?.id, colunaId: col, categoria: l.campos.categoria as string | undefined } : undefined,
        }
      }),
    })
    if (r) {
      marcarSujo(false)
      // padrão = separar depois (quase sempre se compra em viagem): o pedido abre com o aviso e um "Separar agora" discreto
      ir('pedido', { id: r.id, registrada: true })
    }
  }

  // teclado (desktop): Enter vai para o próximo campo; no último, faz o botão principal. Ctrl+Enter registra.
  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.defaultPrevented) return
    const el = e.target as HTMLElement
    if (e.ctrlKey || e.metaKey) return (e.preventDefault(), void salvar())
    if (!['INPUT', 'SELECT'].includes(el.tagName) || el.dataset.enter === 'proprio') return
    e.preventDefault()
    const todos = [...e.currentTarget.querySelectorAll<HTMLElement>(SELETOR_CAMPO)].filter((x) => x.tagName !== 'TEXTAREA')
    const k = todos.indexOf(el)
    if (k >= 0 && k < todos.length - 1) todos[k + 1].focus()
    else void salvar()
  }

  return { modulos, base, form, ordemPassos, t, ir, marcarSujo, sessao, admin, executar, ocupado, id, setId, cfgCampo, visivel, obrig, moduloId, setModuloId, ehCabelo, modulo, pessoaId, setPessoaIdBruto, compradorId, setCompradorId, moeda, codigos, regraCompra, modoEscolhido, setModoEscolhido, modoCodigo, codigo, setCodigo, codigoOk, setCodigoOk, marcarCodigo, porComprador, previsto, codigoMostrado, obs, setObs, estado, setEstado, vgs, viagensAbertas, viagemEscolhida, setViagemEscolhida, quemViaja, viagemSugerida, abertos, setAbertos, viagemId, viagemAtual, nomeViagem, tentou, setTentou, focarCampo, setFocarCampo, attrAbertos, setAttrAbertos, passosAbertos, setPassosAbertos, alternarPasso, irPasso, linhaAberta, setLinhaAberta, novaLinha, linhas, setLinhas, att, cotCompra, cfgMoedas, moedasValor, moedaDig, textoCot, totalDigitado, attValor, tabelas, catalogo, cfgApp, formaPaga, setFormaPaga, fila, conta, anexos, tabela, modCfg, etapasFluxo, camposTipo, extras, recentes, siglas, ultima, coluna, setColuna, colunaUsual, existeColuna, col, nomeColuna, aplicarPessoa, fatorDaLinha, totalLinha, total, pagas, totalPago, todasPagas, pesoTotal, custoKg, descLinha, faltasLinha, mostrarCodigo, faltas, pode, comRevisar, aplicavel, campos, caixa, abrir, estaAberto, preenchido, limparRascunho, ultimoFornecedor, trocando, setTrocando, confirmou, setPessoaId, trocarModulo, confirmarTroca, fecharTroca, notasMoeda, salvar, aoTeclar }
}

/** tudo o que o formulário da compra sabe e faz (o resultado do useNovaCompra) */
export type EstadoNovaCompra = ReturnType<typeof useNovaCompra>
