// VENDER: a entrada é "⚡ Vender cabelo" (Modo caixa) + botões pequenos para os outros módulos (serviço, produto…).
// O assistente por medida (tabela medida × comprador, gramas × fator) fica no link "Sem etiqueta? Vender por medida";
// serviço: unidade, cliente, o que vai fazer, quem atende, agora ou agendar.

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatar, multiplicarFator, fatorValido } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, Item, TabelaPreco } from '../core/domain/tipos'
import { fatorDaTabela } from '../core/services/precos'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, Escolha, GramasInput, Info, Selecao, Titulo, ValorInput, Vazio, cx, gramasTexto, loc, moedaPadrao } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { Anexos, EditorPagamentos, type PagamentoTela, SeletorPessoa, ValoresConvertidos, linkWhatsApp, useCotacoes, conv } from '../ui/compartilhados'
import { useT } from '../ui/i18n'
import { type AjusteServico, EditorServico, SeletorServicos, ajusteParaEntrada, faltaNoAjuste } from '../ui/linhaServico'
import { LeitorCodigo } from '../ui/estoqueUi'
import { acharPorCodigo, buscarPacotes, usePistola } from '../ui/leitorPistola'

/** categorias de reserva (quando a configuração de atributos não tem a lista) */
const CATEGORIAS_RESERVA = ['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque']

interface LinhaTela {
  id: Id
  itemId: Id
  nome: string
  quantidade: number
  moeda: string
  total: number
  profissionalId?: Id
  calculo?: { medida?: number; fator: string; categoria?: string; tabelaId?: Id; colunaId?: string }
  unidade: Item['unidade']
  /** salão: preço/insumos/% mudados no atendimento (vazio = catálogo e regra) */
  ajuste?: AjusteServico
}

/** o que já foi montado na venda: sobrevive a voltar para a escolha do que vender e à troca de passo */
interface Carrinho {
  moduloId: string
  linhas: LinhaTela[]
  pagamentos: PagamentoTela[]
  pessoaId?: Id
}

export function Vender() {
  const t = useT()
  const { ir, sessao, ajustarParams } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const [vendaId, setVendaId] = useState(() => novoId())
  const [caminho, setCaminho] = useParamTela('modulo', '')
  const [passo, setPasso] = useParamTela<'itens' | 'pagar'>('passo', 'itens')
  const [carrinho, setCarrinho] = useState<Carrinho>()
  const [trocar, setTrocar] = useState<string>()
  const [concluida, setConcluida] = useState<{ id: Id; texto: string; telefone?: string }>()
  const ativos = (cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.temVenda)
  const temItens = !!carrinho?.linhas.length
  useAvisoSaida(temItens && !concluida)

  const reiniciar = () => {
    setVendaId(novoId())
    setCarrinho(undefined)
    setConcluida(undefined)
    ajustarParams({ modulo: undefined, passo: undefined, lote: undefined, coluna: undefined, medida: undefined, categoria: undefined })
  }
  const escolher = (id: string) => {
    if (temItens && carrinho!.moduloId !== id) return setTrocar(id)
    setCaminho(id)
  }
  const pergunta = (m: { id: string; nome: string; pergunta?: string }) => (m.pergunta ? t(m.pergunta) : perguntaDe(m.id, m.nome, t))

  if (concluida)
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold">{t('Pronto!')}</h1>
        <Cartao className="text-left">
          <pre className="whitespace-pre-wrap font-sans text-sm">{concluida.texto}</pre>
        </Cartao>
        <Anexos donoId={concluida.id} categorias={['comprovante', 'resultado']} />
        <div className="flex flex-col gap-2">
          <a className="min-h-12 rounded-xl bg-[#25d366] px-4 py-3 font-semibold text-white" href={linkWhatsApp(concluida.texto, concluida.telefone)} target="_blank" rel="noreferrer">
            {t('Enviar recibo no WhatsApp')}
          </a>
          <Botao grande onClick={reiniciar}>{t('Nova venda')}</Botao>
          <Botao variante="secundario" onClick={() => ir('venda', { id: concluida.id })}>{t('Ver venda')}</Botao>
          {sessao.perfil === 'admin' && <Botao variante="leve" onClick={() => ir('caixa')}>{t('Ver no caixa')}</Botao>}
        </div>
      </div>
    )

  const mod = ativos.find((m) => m.id === caminho)
  if (!caminho || (cfg && !mod)) {
    const emAndamento = temItens ? ativos.find((m) => m.id === carrinho!.moduloId) : undefined
    const temCabelo = ativos.some((m) => m.id === 'cabelo')
    // o resto (serviço, produto…) vira botões pequenos; cabelo é pelo Modo caixa (ou "por medida", no link)
    const outros = ativos.filter((m) => m.id !== 'cabelo')
    return (
      <div className="mx-auto max-w-2xl">
        <Titulo>{t('Vender')}</Titulo>
        {temCabelo && (
          <div className="mb-4">
            {/* MODO CAIXA: passa a pistola / lê o QR, o pacote entra inteiro com o preço da tabela e fecha num toque */}
            <button type="button" onClick={() => ir('vendaRapida')} className="flex min-h-24 w-full items-center gap-3 rounded-2xl bg-[var(--marca)] p-4 text-left text-white shadow-md hover:brightness-110">
              <span className="text-4xl" aria-hidden>⚡</span>
              <span>
                <span className="block text-xl font-black">{t('Vender cabelo')}</span>
                <span className="block text-sm opacity-90">{t('Passe a pistola ou leia o QR')}</span>
              </span>
            </button>
            {/* sem etiqueta: o assistente antigo por medida (pega o pacote mais antigo daquela medida) */}
            <div className="mt-1 flex items-center">
              <button type="button" onClick={() => escolher('cabelo')} className="min-h-10 px-1 text-sm font-semibold text-[var(--marca)] underline-offset-4 hover:underline">
                {t('Sem etiqueta? Vender por medida')}
              </button>
              <Info texto="Para pacote sem etiqueta: escolha a medida e o sistema pega o pacote mais antigo. Ex.: 60 cm · 2 kg." />
            </div>
          </div>
        )}
        {emAndamento && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--marca-suave)] p-3">
            <span className="text-sm font-semibold">{emAndamento.icone} {t('Venda em andamento: {n} item(ns).', { n: carrinho!.linhas.length })}</span>
            <div className="flex gap-2">
              <Botao variante="leve" onClick={() => setTrocar('')}>{t('Descartar')}</Botao>
              <Botao onClick={() => setCaminho(emAndamento.id)}>{t('Continuar')}</Botao>
            </div>
          </div>
        )}
        {outros.length > 0 && (
          <div className={cx('grid gap-2', temCabelo ? 'grid-cols-2 sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {outros.map((m) => (
              <button key={m.id} type="button" onClick={() => escolher(m.id)} className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-[var(--borda)] bg-[var(--cartao)] px-3 py-2 text-left font-bold hover:border-[var(--marca)]">
                <span className="text-2xl" aria-hidden>{m.icone}</span>
                <span className="min-w-0">{rotuloCurto(m.id, m.nome, t)}</span>
              </button>
            ))}
          </div>
        )}
        {trocar !== undefined && (
          <Confirmar
            titulo="Descartar a venda em andamento?"
            texto="Os itens já adicionados vão ser tirados da venda."
            rotulo="Descartar"
            perigo
            onConfirmar={() => {
              setVendaId(novoId())
              setCarrinho(undefined)
              if (trocar) ajustarParams({ modulo: trocar, passo: undefined })
            }}
            onFechar={() => setTrocar(undefined)}
          />
        )}
      </div>
    )
  }

  if (!mod) return <Carregando />
  const porTabela = caminho === 'cabelo' || !!mod.recursos?.tabelaPreco
  const atendimento = caminho === 'salao' || !!mod.recursos?.agenda
  const atual: Carrinho = carrinho?.moduloId === caminho ? carrinho : { moduloId: caminho, linhas: [], pagamentos: [] }
  return (
    <AssistenteVenda
      key={vendaId}
      vendaId={vendaId}
      moduloId={caminho}
      porTabela={porTabela}
      atendimento={atendimento}
      titulo={`${mod.icone} ${caminho === 'cabelo' ? t('Vender por medida') : pergunta(mod)}`}
      carrinho={atual}
      onCarrinho={(c) => setCarrinho((x) => ({ ...(x?.moduloId === caminho ? x : atual), ...c, moduloId: caminho }))}
      passo={atual.linhas.length ? passo : 'itens'}
      onPasso={setPasso}
      onVoltar={() => ajustarParams({ modulo: undefined, passo: undefined, lote: undefined, coluna: undefined, medida: undefined, categoria: undefined })}
      onConcluir={(r) => {
        setConcluida(r)
        ajustarParams({ modulo: undefined, passo: undefined, lote: undefined, coluna: undefined, medida: undefined, categoria: undefined })
      }}
      moedaPrincipal={cfg?.config.moedaPrincipal ?? moedaPadrao()}
      nomeNegocio={cfg?.config.nomeNegocio ?? ''}
    />
  )
}

/** nome do botão pequeno na entrada do Vender ("Serviço", "Produto" ou o nome do módulo) */
function rotuloCurto(id: string, nome: string, t: ReturnType<typeof useT>) {
  return id === 'salao' ? t('Serviço') : id === 'produtos' ? t('Produto') : t(nome)
}

function perguntaDe(id: string, nome: string, t: ReturnType<typeof useT>) {
  return id === 'cabelo' ? t('É cabelo?') : id === 'salao' ? t('É serviço?') : t('É {nome}?', { nome: t(nome).toLowerCase() })
}

function AssistenteVenda(p: {
  vendaId: Id
  moduloId: string
  porTabela: boolean
  atendimento: boolean
  titulo: string
  moedaPrincipal: string
  nomeNegocio: string
  carrinho: Carrinho
  onCarrinho(c: Partial<Carrinho>): void
  passo: 'itens' | 'pagar'
  onPasso(p: 'itens' | 'pagar'): void
  onVoltar(): void
  onConcluir(r: { id: Id; texto: string; telefone?: string }): void
}) {
  const t = useT()
  const { sessao } = useApp()
  const { executar, ocupado } = useComando()
  const { cot } = useCotacoes('venda')
  const { linhas, pagamentos, pessoaId } = p.carrinho
  const setLinhas = (l: LinhaTela[]) => p.onCarrinho({ linhas: l })
  const setPagamentos = (x: PagamentoTela[]) => p.onCarrinho({ pagamentos: x })
  const setPessoaId = (id: Id | undefined) => p.onCarrinho({ pessoaId: id })
  const [localId, setLocalId] = useState<Id | undefined>(sessao.localId)
  const [profissionalId, setProfissionalId] = useState<Id | undefined>(sessao.perfil === 'funcionario' ? sessao.pessoaId ?? sessao.usuarioId : undefined)
  const [agendar, setAgendar] = useState(false)
  const [quando, setQuando] = useState(`${dataLocal()}T10:00`)
  const { passo, onPasso: setPasso } = p
  const { dados: locais } = useConsulta('locais', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: p.moduloId }, p.porTabela)
  const moedaVenda = p.porTabela ? linhas.find((l) => l.calculo)?.moeda ?? tabelas?.[0]?.moeda ?? p.moedaPrincipal : p.moedaPrincipal
  const total = linhas.reduce((s, l) => s + (conv(l.total, l.moeda, moedaVenda, cot) ?? 0), 0)
  const profissionais = (pessoas ?? []).filter((x) => x.papeis.includes('profissional') && (!localId || !x.localId || x.localId === localId))
  const pessoa = pessoas?.find((x) => x.id === pessoaId)
  // salão: catálogo e regra da comissão para a memória do cálculo de cada linha
  const salao = p.atendimento && p.moduloId === 'salao'
  const { dados: servicos } = useConsulta('catalogo', { moduloId: 'salao', incluirAvulsos: true }, salao)
  const { cfg } = useCotacoes()
  const servicoDe = (id: Id) => servicos?.find((i) => i.id === id)
  const pendenciaAjuste = linhas.map((l) => (l.unidade === 'servico' && l.ajuste ? faltaNoAjuste({ item: servicoDe(l.itemId), total: l.total, moeda: l.moeda, ajuste: l.ajuste, perfil: sessao.perfil, cot, moedaPrincipal: p.moedaPrincipal }) : undefined)).find(Boolean)

  const textoRecibo = () => {
    const linhasTxt = linhas.map((l) => (l.calculo ? `${l.calculo.medida ?? ''}${l.calculo.categoria && l.calculo.categoria !== 'Normal' ? ' ' + t(l.calculo.categoria) : ''} | ${l.quantidade.toLocaleString(loc())} × ${l.calculo.fator} = ${formatar(l.total, l.moeda)}` : `${l.nome}: ${formatar(l.total, l.moeda)}`))
    return [`*${p.nomeNegocio}*`, pessoa ? `${t('Cliente')}: ${pessoa.nome}` : '', agendar ? `${t('Agendado para')} ${quando.replace('T', ' ')}` : '', ...linhasTxt, `*${t('Total')}: ${formatar(total, moedaVenda)}*`, t('Obrigado pela compra!')].filter(Boolean).join('\n')
  }

  const conflitoParams = agendar && profissionalId && quando ? { profissionalId, inicio: new Date(quando).toISOString(), itens: linhas.map((l) => l.itemId), ignorarId: undefined } : undefined
  const { dados: conflitos } = useConsulta('conflitosAgenda', conflitoParams ?? { profissionalId: '', inicio: '' }, !!conflitoParams)
  const temConflito = !!conflitoParams && !!conflitos?.length
  const confirmar = async () => {
    const r = await executar('concluirVenda', {
      ignorarConflito: temConflito,
      id: p.vendaId,
      pessoaId,
      localId,
      profissionalId,
      agendadoPara: agendar ? new Date(quando).toISOString() : undefined,
      linhas: linhas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: l.quantidade, moeda: l.moeda, total: l.total, profissionalId: l.profissionalId, calculo: l.calculo, ...ajusteParaEntrada(l.ajuste) })),
      pagamentos: agendar ? [] : pagamentos.filter((x) => x.valor).map((x) => ({ id: x.id, forma: x.forma, moeda: x.moeda, valor: x.valor! })),
    })
    if (r) p.onConcluir({ id: r.id, texto: textoRecibo(), telefone: pessoa?.telefone })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex items-center gap-2">
        <Botao variante="leve" onClick={passo === 'pagar' ? () => setPasso('itens') : p.onVoltar}>← {t('Voltar')}</Botao>
        <h1 className="text-xl font-bold">{p.titulo}</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {passo === 'itens' ? (
            <>
              {p.atendimento && (
                <Cartao titulo={t('Atendimento')}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo rotulo="Qual unidade (endereço)?">
                      <Selecao valor={localId} onChange={(v) => setLocalId(v || undefined)} vazio="Escolha…" opcoes={(locais ?? []).filter((l) => l.tipo === 'salao' && (sessao.perfil === 'admin' || l.id === sessao.localId)).map((l) => ({ id: l.id, nome: `${l.nome}${l.rua ? ` · ${l.rua} ${l.numero ?? ''}` : ''}` }))} />
                    </Campo>
                    <SeletorPessoa rotulo="Qual cliente?" valor={pessoaId} onChange={setPessoaId} papel="cliente" localId={localId} />
                    <Campo rotulo="Quem vai atender?">
                      <Selecao valor={profissionalId} onChange={(v) => setProfissionalId(v || undefined)} vazio="Escolha…" opcoes={profissionais.map((x) => ({ id: x.id, nome: `${x.nome}${x.cargo ? ` · ${x.cargo}` : ''}` }))} />
                    </Campo>
                    <Campo rotulo="Quando?" comoDiv>
                      <Escolha rotulo="Quando?" valor={agendar ? 'agendar' : 'agora'} onChange={(v) => setAgendar(v === 'agendar')} opcoes={[{ id: 'agora', nome: 'Agora' }, { id: 'agendar', nome: 'Agendar' }]} />
                      {agendar && <Entrada type="datetime-local" aria-label={t('Data e hora')} className="mt-2" value={quando} onChange={(e) => setQuando(e.target.value)} />}
                      {temConflito && (
                        <p className="mt-2 rounded-xl bg-[var(--alerta)]/10 p-2 text-sm font-semibold text-[var(--alerta)]">
                          ⚠️ {t('Horário ocupado')}: {conflitos!.map((c) => `${c.cliente ?? ''} ${c.inicio.slice(11)}–${c.fim.slice(11)}`).join(', ')}. {t('Dá para agendar mesmo assim.')}
                        </p>
                      )}
                    </Campo>
                  </div>
                </Cartao>
              )}
              {!p.atendimento && <Cartao><SeletorPessoa rotulo={p.porTabela ? 'Quem está comprando?' : 'Cliente'} valor={pessoaId} onChange={setPessoaId} opcional /></Cartao>}

              {p.porTabela || (p.atendimento && p.moduloId === 'salao') ? null : <ItensSimples moduloId={p.moduloId} moeda={p.moedaPrincipal} onAdd={(l) => setLinhas([...linhas, l])} profissionalId={profissionalId} />}
              {p.atendimento &&
                (salao ? (
                  <SeletorServicos moeda={p.moedaPrincipal} onAdd={(i, preco) => setLinhas([...linhas, { id: novoId(), itemId: i.id, nome: i.nome, quantidade: 1, moeda: i.precoSugerido?.moeda ?? p.moedaPrincipal, total: preco, unidade: i.unidade, profissionalId }])} />
                ) : (
                  <ItensSimples moduloId={p.moduloId} moeda={p.moedaPrincipal} rotulo="O que vai fazer?" onAdd={(l) => setLinhas([...linhas, { ...l, profissionalId }])} profissionalId={profissionalId} />
                ))}
              {(p.porTabela || p.atendimento) && (
                <LinhasCabelo
                  moduloId={p.porTabela ? p.moduloId : 'cabelo'}
                  pessoaId={pessoaId}
                  opcional={p.atendimento}
                  jaUsado={linhas}
                  onAdd={(ls) => setLinhas([...linhas, ...ls])}
                />
              )}
            </>
          ) : (
            <>
              <Cartao titulo={t('Como pagou?')}>
                <EditorPagamentos total={total} moedaTotal={moedaVenda} pagamentos={pagamentos} onChange={setPagamentos} permiteFiado={!!pessoaId} />
              </Cartao>
              <Cartao titulo={t('Fotos e comprovante (opcional)')}>
                <Anexos donoId={p.vendaId} categorias={['pedido', 'comprovante']} />
              </Cartao>
            </>
          )}
        </div>

        {/* resumo fixo (como a folha do caderno) */}
        <Cartao titulo={t('Resumo')} className="h-fit lg:sticky lg:top-4">
          {linhas.length === 0 ? (
            <Vazio texto="Nada adicionado ainda." />
          ) : (
            <ul className="space-y-2 text-sm">
              {linhas.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2 border-b border-[var(--borda)] pb-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{l.nome}</div>
                    {l.calculo && <div className="num text-[var(--suave)]">{l.calculo.medida} | {l.quantidade.toLocaleString(loc())} × {l.calculo.fator}</div>}
                    {salao && l.unidade === 'servico' && passo === 'itens' && (
                      <EditorServico
                        item={servicoDe(l.itemId)}
                        total={l.total}
                        moeda={l.moeda}
                        onTotal={(v) => setLinhas(linhas.map((x) => (x.id === l.id ? { ...x, total: v } : x)))}
                        ajuste={l.ajuste ?? {}}
                        onAjuste={(a) => setLinhas(linhas.map((x) => (x.id === l.id ? { ...x, ajuste: a } : x)))}
                        profissional={pessoas?.find((x) => x.id === (l.profissionalId ?? profissionalId))}
                        temProfissional={!!(l.profissionalId ?? profissionalId)}
                        cot={cot}
                        moedaPrincipal={p.moedaPrincipal}
                        padraoBp={cfg?.comissaoPadraoBp}
                        podeMudarComissao={sessao.perfil === 'admin' || !!cfg?.comissaoFuncionarioMuda}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="num font-bold">{formatar(l.total, l.moeda)}</span>
                    {passo === 'itens' && <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-lg hover:bg-[var(--marca-suave)]" onClick={() => setLinhas(linhas.filter((x) => x.id !== l.id))}>×</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-semibold">{t('Total')}</span>
            <span className="num text-2xl font-black">{formatar(total, moedaVenda)}</span>
          </div>
          {total > 0 && <div className="mt-1"><ValoresConvertidos valor={total} moeda={moedaVenda} /></div>}
          <div className="mt-4">
            {passo === 'itens' ? (
              <>
                {pendenciaAjuste && <p className="mb-2 text-sm font-semibold text-[var(--alerta)]">{t(pendenciaAjuste)}</p>}
                <Botao grande className="w-full" disabled={!linhas.length || !!pendenciaAjuste} onClick={() => (agendar ? confirmar() : setPasso('pagar'))}>
                  {agendar ? (temConflito ? t('Agendar mesmo assim') : t('Agendar')) : t('Continuar para pagamento')}
                </Botao>
              </>
            ) : (
              <Botao grande className="w-full" disabled={ocupado} onClick={confirmar}>
                {t('Confirmar venda')}
              </Botao>
            )}
          </div>
        </Cartao>
      </div>
    </div>
  )
}

/** Serviços/produtos com preço sugerido (toque para adicionar; preço editável). */
function ItensSimples({ moduloId, moeda, onAdd, rotulo = 'Itens', profissionalId }: { moduloId: string; moeda: string; onAdd(l: LinhaTela): void; rotulo?: string; profissionalId?: Id }) {
  const t = useT()
  const { dados: itens } = useConsulta('catalogo', { moduloId })
  const { dados: estoque } = useConsulta('estoque', { moduloId })
  const [precos, setPrecos] = useState<Record<Id, number | undefined>>({})
  const lista = (itens ?? []).filter((i) => i.ativo)
  return (
    <Cartao titulo={t(rotulo)}>
      {!lista.length ? (
        <Vazio texto="Nenhum item cadastrado neste módulo." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((i) => {
            const saldo = estoque?.find((e) => e.id === i.id)?.saldo
            const preco = precos[i.id] ?? i.precoSugerido?.valor
            const m = i.precoSugerido?.moeda ?? moeda
            return (
              <li key={i.id} className="rounded-xl border border-[var(--borda)] p-2">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{i.nome}</span>
                  {i.controlaEstoque && <span className="text-xs text-[var(--suave)]">{t('tem')} {saldo ?? 0}</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <ValorInput moeda={m} valor={preco} onChange={(v) => setPrecos({ ...precos, [i.id]: v })} />
                  <Botao disabled={preco === undefined || (i.controlaEstoque && !saldo)} onClick={() => onAdd({ id: novoId(), itemId: i.id, nome: i.nome, quantidade: 1, moeda: m, total: preco!, unidade: i.unidade, profissionalId })}>
                    +
                  </Botao>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Cartao>
  )
}

/**
 * Linha de cabelo pela tabela: medida → categoria → gramas → fator (da tabela, editável) = total.
 * Escolhe sozinha o lote mais antigo daquela medida/categoria e divide entre lotes se precisar (rastreio).
 */
function LinhasCabelo({ moduloId, pessoaId, onAdd, opcional, jaUsado }: { moduloId: string; pessoaId?: Id; onAdd(ls: LinhaTela[]): void; opcional?: boolean; jaUsado: LinhaTela[] }) {
  const t = useT()
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId })
  const { dados: estoque } = useConsulta('estoque', { moduloId, somenteComSaldo: true })
  const { dados: conf } = useConsulta('configuracoes', {})
  const [aberto, setAberto] = useState(!opcional)
  const [categoria, setCategoria] = useState('Normal')
  const tabela: TabelaPreco | undefined = useMemo(() => {
    const ts = tabelas ?? []
    return ts.find((x) => (x.categoria ?? 'Normal') === categoria) ?? ts.find((x) => !x.categoria) ?? ts[0]
  }, [tabelas, categoria])
  const colunaDaPessoa = tabela?.colunas.find((c) => c.pessoaId && c.pessoaId === pessoaId)?.id
  const [coluna, setColuna] = useState<string>()
  const colunaAtual = coluna ?? colunaDaPessoa ?? tabela?.colunas[0]?.id
  const [medida, setMedida] = useState<number>()
  const [gramas, setGramas] = useState<number>()
  const [fator, setFator] = useState('')
  const [loteEscolhido, setLoteEscolhido] = useState<Id>()
  // coluna e fator ficam numa linha só ("60 cm · 17,5 · Bs 35.140") quando vêm da cliente/tabela; "trocar" abre
  const [trocarPreco, setTrocarPreco] = useState(false)
  // LER OU BUSCAR PACOTE: leitor pistola (Enter com código exato), câmera ou digitação (código, código antigo, rótulo)
  const [busca, setBusca] = useState('')
  const [lendo, setLendo] = useState(false)
  const [aviso, setAviso] = useState<string>()
  const [focarGramas, setFocarGramas] = useState(0)
  const caixaGramas = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focarGramas) caixaGramas.current?.querySelector('input')?.focus()
  }, [focarGramas])
  // categorias: da configuração de atributos do módulo (Configurações › Atributos), não fixas na tela
  const categorias = useMemo(() => {
    const def = conf?.modulos.find((m) => m.id === moduloId)?.tiposItem.flatMap((ti) => ti.campos).find((c) => c.id === 'categoria')
    const lista = def?.opcoes?.length ? def.opcoes : CATEGORIAS_RESERVA
    return lista.includes(categoria) ? lista : [...lista, categoria]
  }, [conf, moduloId, categoria])
  // vindo da Triagem (#/vender?modulo=cabelo&lote=… ou &medida=60&categoria=Normal): já abre com a medida, a categoria,
  // o lote e as gramas dele
  const { nav } = useApp()
  const loteParam = nav.params.lote as Id | undefined
  const medidaParam = nav.params.medida ? Number(nav.params.medida) : undefined
  const [aplicado, setAplicado] = useState(false)
  useEffect(() => {
    if (aplicado || (!loteParam && !medidaParam) || !estoque) return
    setAplicado(true)
    if (nav.params.coluna) setColuna(String(nav.params.coluna))
    if (!loteParam) {
      setAberto(true)
      if (nav.params.categoria) setCategoria(String(nav.params.categoria))
      setMedida(medidaParam)
      return
    }
    const l = estoque.find((i) => i.id === loteParam)
    if (!l) return
    setAberto(true)
    setCategoria(String(l.campos.categoria || 'Normal'))
    if (l.campos.comprimento) setMedida(Number(l.campos.comprimento))
    setLoteEscolhido(l.id)
    setGramas(l.saldo)
  }, [aplicado, loteParam, medidaParam, estoque, nav.params.coluna, nav.params.categoria])

  const usados = new Map<Id, number>()
  for (const l of jaUsado) usados.set(l.itemId, (usados.get(l.itemId) ?? 0) + l.quantidade)
  const lotes = (estoque ?? [])
    .filter((i) => i.unidade === 'grama' && (!medida || Number(i.campos.comprimento) === medida) && String(i.campos.categoria || 'Normal') === categoria)
    .map((i) => ({ ...i, livre: i.saldo - (usados.get(i.id) ?? 0) }))
    .filter((i) => i.livre > 0)
    .sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  const moedaTabela = tabela?.moeda ?? moedaPadrao()
  const fatorTabela = tabela && medida && colunaAtual ? fatorDaTabela(tabela, medida, colunaAtual).fator : undefined
  const fatorUsado = fator.trim() || fatorTabela || ''
  // recolhido: o fator veio da tabela (coluna da cliente ou a primeira) e ninguém pediu para trocar
  const precoAberto = trocarPreco || coluna !== undefined || !fatorTabela
  const nomeColuna = tabela?.colunas.find((c) => c.id === colunaAtual)?.nome
  const disponivel = loteEscolhido ? lotes.find((l) => l.id === loteEscolhido)?.livre ?? 0 : lotes.reduce((s, l) => s + l.livre, 0)
  const totalPrev = gramas && fatorValido(fatorUsado) ? multiplicarFator(gramas, fatorUsado, moedaTabela) : undefined
  const medidas = [...new Set([...(tabela?.linhas ?? []), ...(estoque ?? []).filter((i) => i.campos.comprimento).map((i) => Number(i.campos.comprimento))])].sort((a, b) => a - b)

  const usarPacote = (l: NonNullable<typeof estoque>[number]) => {
    setBusca('')
    if (l.unidade !== 'grama' || !l.campos.comprimento) return setAviso(t('{c} ainda não tem medida: separe na triagem antes de vender.', { c: l.codigo ?? l.nome }))
    const livre = l.saldo - (usados.get(l.id) ?? 0)
    if (livre <= 0) return setAviso(t('{c} já está todo nesta venda.', { c: l.codigo ?? l.nome }))
    setAviso(undefined)
    setCategoria(String(l.campos.categoria || 'Normal'))
    setMedida(Number(l.campos.comprimento))
    setFator('')
    setGramas(undefined)
    setLoteEscolhido(l.id)
    setFocarGramas((n) => n + 1)
  }
  const pistola = usePistola(estoque, usarPacote, (x) => setAviso(t('Nenhum pacote com o código {c}.', { c: x.trim() })))
  const achados = buscarPacotes(estoque, busca, 6)

  if (!aberto)
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        + {t('Usar cabelo do estoque (mega hair)')}
      </Botao>
    )

  const adicionar = () => {
    if (!gramas || !totalPrev || !medida) return
    // divide entre lotes (o mais antigo primeiro) quando um só não basta
    const fila = loteEscolhido ? lotes.filter((l) => l.id === loteEscolhido) : lotes
    let resta = gramas
    const novas: LinhaTela[] = []
    for (const l of fila) {
      if (!resta) break
      const q = Math.min(resta, l.livre)
      novas.push({
        id: novoId(),
        itemId: l.id,
        nome: `${l.codigo ? l.codigo + ' · ' : ''}${l.nome}`,
        quantidade: q,
        moeda: moedaTabela,
        total: multiplicarFator(q, fatorUsado, moedaTabela),
        unidade: 'grama',
        calculo: { medida, fator: fatorUsado.replace('.', ','), categoria, tabelaId: tabela?.id, colunaId: colunaAtual },
      })
      resta -= q
    }
    if (resta > 0) return
    onAdd(novas)
    setGramas(undefined)
    setFator('')
    setLoteEscolhido(undefined)
  }

  return (
    <Cartao titulo={t('Cabelo')} ajuda="Como no caderno: medida | gramas × fator = total. Ex.: 40 | 2.000 × 3,5 = Bs 7.000.">
      <div className="relative mb-3">
        <Campo comoDiv rotulo="Ler ou buscar pacote" ajuda="Aponte o leitor ou a câmera para a etiqueta, ou digite o código. Ex.: P4 ou M1-2.">
          <div className="flex gap-2">
            <Entrada
              type="search"
              aria-label={t('Ler ou buscar pacote')}
              placeholder={t('Código, código antigo ou rótulo')}
              value={busca}
              onChange={(e) => (setBusca(e.target.value), setAviso(undefined))}
              onKeyDown={pistola.onKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
            <Botao variante="secundario" className="shrink-0" aria-label={t('Ler código')} title={t('Ler código')} onClick={() => setLendo(true)}>📷</Botao>
          </div>
        </Campo>
        {achados.length > 0 && (
          <ul className="absolute inset-x-0 z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-[var(--borda)] bg-[var(--cartao)] shadow-lg">
            {achados.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => usarPacote(l)} className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--marca-suave)]">
                  <span className="min-w-0 truncate"><b className="font-mono">{l.codigo ?? '—'}</b> · {l.nome}</span>
                  <span className="num shrink-0 text-[var(--suave)]">{gramasTexto(l.saldo)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {aviso && <p className="mt-1 text-sm font-semibold text-[var(--alerta)]">{aviso}</p>}
      </div>
      {lendo && (
        <LeitorCodigo
          abrirLote={false}
          onFechar={() => setLendo(false)}
          onLer={(c) => {
            setLendo(false)
            const l = acharPorCodigo(estoque, c)
            if (l) usarPacote(l)
            else (setBusca(c), setAviso(t('Nenhum pacote com o código {c}.', { c })))
          }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Categoria">
          <Selecao valor={categoria} onChange={(v) => (setCategoria(v), setFator(''), setLoteEscolhido(undefined))} opcoes={categorias.map((c) => ({ id: c, nome: t(c) }))} />
        </Campo>
        {precoAberto && (
          <Campo rotulo="Coluna da tabela (comprador)" ajuda="Cada comprador tem seu preço. Se a pessoa estiver ligada a uma coluna, ela já vem escolhida.">
            <Selecao valor={colunaAtual} onChange={(v) => (setColuna(v), setFator(''))} opcoes={(tabela?.colunas ?? []).map((c) => ({ id: c.id, nome: c.nome }))} />
          </Campo>
        )}
      </div>
      <div className="mt-3">
        <span id="medida-cabelo" className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Medida (cm)')}</span>
        <div role="group" aria-labelledby="medida-cabelo" className="flex flex-wrap gap-1">
          {medidas.map((m) => {
            const temEstoque = (estoque ?? []).some((i) => Number(i.campos.comprimento) === m && String(i.campos.categoria || 'Normal') === categoria && i.saldo > (usados.get(i.id) ?? 0))
            return (
              <button key={m} type="button" aria-pressed={medida === m} onClick={() => (setMedida(m), setFator(''), setLoteEscolhido(undefined))} className={cx('min-h-11 min-w-12 rounded-xl border px-2 font-bold', medida === m ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)]', !temEstoque && 'opacity-40')}>
                {m}
              </button>
            )
          })}
        </div>
      </div>
      {medida && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Gramas" ajuda="Digite em gramas (2008) ou troque para kg (2,5).">
            <div ref={caixaGramas}><GramasInput key={focarGramas} valor={gramas} onChange={setGramas} /></div>
          </Campo>
          {precoAberto && (
            <Campo rotulo="Fator" ajuda="Vem da tabela; dá para mudar só nesta venda.">
              <Entrada inputMode="decimal" value={fator} placeholder={fatorTabela ?? '?'} onChange={(e) => setFator(e.target.value)} />
            </Campo>
          )}
          <Campo rotulo="Lote" ajuda="Pega o pacote mais antigo; se não bastar, divide. Ex.: 1.500 g = 1.000 g do P1 + 500 g do P4.">
            <Selecao valor={loteEscolhido} onChange={(v) => setLoteEscolhido(v || undefined)} vazio="Automático (mais antigo)" opcoes={lotes.map((l) => ({ id: l.id, nome: `${l.codigo ?? ''} ${gramasTexto(l.livre)}` }))} />
          </Campo>
        </div>
      )}
      {medida && !precoAberto && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="num font-semibold">{medida} cm</span>
          <span aria-hidden>·</span>
          <input inputMode="decimal" aria-label={t('Fator')} value={fator} placeholder={fatorTabela} onChange={(e) => setFator(e.target.value)} className="num w-16 rounded-lg border border-transparent bg-transparent px-1 font-semibold outline-none placeholder:text-[var(--texto)] hover:border-[var(--borda)] focus:border-[var(--marca)]" />
          <span aria-hidden>·</span>
          <span className="num font-semibold">{totalPrev !== undefined ? formatar(totalPrev, moedaTabela) : '—'}</span>
          {nomeColuna && <span className="text-[var(--suave)]">({nomeColuna})</span>}
          <button type="button" className="min-h-10 px-2 font-semibold text-[var(--marca)] underline-offset-4 hover:underline" onClick={() => setTrocarPreco(true)}>{t('trocar')}</button>
        </div>
      )}
      {medida && (
        <div className="mt-3 rounded-xl bg-[var(--fundo)] p-3">
          <div className="num text-lg font-bold">
            {medida} | {gramas ? gramas.toLocaleString(loc()) : '—'} × {fatorUsado || '?'} = {totalPrev !== undefined ? formatar(totalPrev, moedaTabela) : '—'}
          </div>
          <div className="text-xs text-[var(--suave)]">
            {t('Disponível')}: {gramasTexto(disponivel)}
            {gramas && gramas > disponivel && <b className="ml-2 text-[var(--ruim)]">{t('Não tem tudo isso em estoque.')}</b>}
            {!fatorUsado && <b className="ml-2 text-[var(--alerta)]">{t('A tabela não tem esse valor: digite o fator.')}</b>}
          </div>
          <Botao className="mt-2" disabled={!gramas || !totalPrev || gramas > disponivel} onClick={adicionar}>
            + {t('Adicionar')}
          </Botao>
        </div>
      )}
    </Cartao>
  )
}
