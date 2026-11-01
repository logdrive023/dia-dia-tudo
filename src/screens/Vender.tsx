// VENDER: assistente que pensa junto. "É cabelo?" (tabela medida × comprador, gramas × fator), "É serviço?"
// (unidade, cliente, o que vai fazer, quem atende, agora ou agendar) ou qualquer outra modalidade ativa.

import { useMemo, useState } from 'react'
import { formatar, multiplicarFator, fatorValido } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, Item, TabelaPreco } from '../core/domain/tipos'
import { fatorDaTabela } from '../core/services/precos'
import { Botao, Campo, Cartao, Entrada, GramasInput, Selecao, Titulo, ValorInput, Vazio, cx, gramasTexto } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { Anexos, EditorPagamentos, type PagamentoTela, SeletorPessoa, ValoresConvertidos, linkWhatsApp, useCotacoes, conv } from '../ui/compartilhados'
import { useT } from '../ui/i18n'

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
}

export function Vender() {
  const t = useT()
  const { nav, ir, sessao } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const [vendaId, setVendaId] = useState(() => novoId())
  const [caminho, setCaminho] = useState<string | undefined>(nav.params.modulo as string | undefined)
  const [concluida, setConcluida] = useState<{ id: Id; texto: string; telefone?: string }>()
  const ativos = (cfg?.modulos ?? []).filter((m) => cfg?.config.modulosAtivos.includes(m.id) && m.temVenda)

  const reiniciar = () => {
    setVendaId(novoId())
    setCaminho(undefined)
    setConcluida(undefined)
  }

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
          {sessao.perfil === 'admin' && <Botao variante="leve" onClick={() => ir('caixa')}>{t('Ver no caixa')}</Botao>}
        </div>
      </div>
    )

  if (!caminho)
    return (
      <div>
        <Titulo subtitulo={t('Escolha e o assistente pergunta o resto.')}>{t('O que você está vendendo?')}</Titulo>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ativos.map((m) => (
            <button key={m.id} type="button" onClick={() => setCaminho(m.id)} className="min-h-28 rounded-2xl border-2 border-[var(--borda)] bg-[var(--cartao)] p-4 text-left hover:border-[var(--marca)]">
              <div className="text-3xl">{m.icone}</div>
              <div className="mt-1 text-lg font-bold">{t(m.pergunta ?? perguntaDe(m.id, m.nome))}</div>
              <div className="text-sm text-[var(--suave)]">{t(m.descricao)}</div>
            </button>
          ))}
        </div>
      </div>
    )

  const mod = ativos.find((m) => m.id === caminho)
  const porTabela = caminho === 'cabelo' || !!mod?.recursos?.tabelaPreco
  const atendimento = caminho === 'salao' || !!mod?.recursos?.agenda
  return (
    <AssistenteVenda key={vendaId} vendaId={vendaId} moduloId={caminho} porTabela={porTabela} atendimento={atendimento} titulo={mod ? `${mod.icone} ${t(mod.pergunta ?? perguntaDe(mod.id, mod.nome))}` : ''} onVoltar={() => setCaminho(undefined)} onConcluir={setConcluida} moedaPrincipal={cfg?.config.moedaPrincipal ?? 'BOB'} nomeNegocio={cfg?.config.nomeNegocio ?? ''} />
  )
}

function perguntaDe(id: string, nome: string) {
  return id === 'cabelo' ? 'É cabelo?' : id === 'salao' ? 'É serviço?' : `É ${nome.toLowerCase()}?`
}

function AssistenteVenda(p: {
  vendaId: Id
  moduloId: string
  porTabela: boolean
  atendimento: boolean
  titulo: string
  moedaPrincipal: string
  nomeNegocio: string
  onVoltar(): void
  onConcluir(r: { id: Id; texto: string; telefone?: string }): void
}) {
  const t = useT()
  const { sessao } = useApp()
  const { executar, ocupado } = useComando()
  const { cot } = useCotacoes()
  const [pessoaId, setPessoaId] = useState<Id>()
  const [localId, setLocalId] = useState<Id | undefined>(sessao.localId)
  const [profissionalId, setProfissionalId] = useState<Id | undefined>(sessao.perfil === 'funcionario' ? sessao.usuarioId : undefined)
  const [agendar, setAgendar] = useState(false)
  const [quando, setQuando] = useState(`${dataLocal()}T10:00`)
  const [linhas, setLinhas] = useState<LinhaTela[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  const [passo, setPasso] = useState<'itens' | 'pagar'>('itens')
  const { dados: locais } = useConsulta('locais', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const moedaVenda = p.porTabela ? 'BOB' : p.moedaPrincipal
  const total = linhas.reduce((s, l) => s + (conv(l.total, l.moeda, moedaVenda, cot) ?? 0), 0)
  const profissionais = (pessoas ?? []).filter((x) => x.papeis.includes('profissional') && (!localId || !x.localId || x.localId === localId))
  const pessoa = pessoas?.find((x) => x.id === pessoaId)

  const textoRecibo = () => {
    const linhasTxt = linhas.map((l) => (l.calculo ? `${l.calculo.medida ?? ''}${l.calculo.categoria && l.calculo.categoria !== 'Normal' ? ' ' + l.calculo.categoria : ''} | ${l.quantidade.toLocaleString('pt-BR')} × ${l.calculo.fator} = ${formatar(l.total, l.moeda)}` : `${l.nome}: ${formatar(l.total, l.moeda)}`))
    return [`*${p.nomeNegocio}*`, pessoa ? `${t('Cliente')}: ${pessoa.nome}` : '', agendar ? `${t('Agendado para')} ${quando.replace('T', ' ')}` : '', ...linhasTxt, `*${t('Total')}: ${formatar(total, moedaVenda)}*`, t('Gracias por tu compra!')].filter(Boolean).join('\n')
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
      linhas: linhas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: l.quantidade, moeda: l.moeda, total: l.total, profissionalId: l.profissionalId, calculo: l.calculo })),
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
                    <Campo rotulo="Quando?">
                      <div className="flex gap-2">
                        <Botao variante={agendar ? 'secundario' : 'primario'} onClick={() => setAgendar(false)}>{t('Agora')}</Botao>
                        <Botao variante={agendar ? 'primario' : 'secundario'} onClick={() => setAgendar(true)}>{t('Agendar')}</Botao>
                      </div>
                      {agendar && <Entrada type="datetime-local" className="mt-2" value={quando} onChange={(e) => setQuando(e.target.value)} />}
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
              {p.atendimento && <ItensSimples moduloId={p.moduloId} moeda={p.moedaPrincipal} rotulo="O que vai fazer?" onAdd={(l) => setLinhas([...linhas, { ...l, profissionalId }])} profissionalId={profissionalId} />}
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
                    {l.calculo && <div className="num text-[var(--suave)]">{l.calculo.medida} | {l.quantidade.toLocaleString('pt-BR')} × {l.calculo.fator}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="num font-bold">{formatar(l.total, l.moeda)}</span>
                    {passo === 'itens' && <button type="button" aria-label={t('Tirar')} className="px-1 text-lg" onClick={() => setLinhas(linhas.filter((x) => x.id !== l.id))}>×</button>}
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
              <Botao grande className="w-full" disabled={!linhas.length} onClick={() => (agendar ? confirmar() : setPasso('pagar'))}>
                {agendar ? (temConflito ? t('Agendar mesmo assim') : t('Agendar')) : t('Continuar para pagamento')}
              </Botao>
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

  const usados = new Map<Id, number>()
  for (const l of jaUsado) usados.set(l.itemId, (usados.get(l.itemId) ?? 0) + l.quantidade)
  const lotes = (estoque ?? [])
    .filter((i) => i.unidade === 'grama' && (!medida || Number(i.campos.comprimento) === medida) && String(i.campos.categoria || 'Normal') === categoria)
    .map((i) => ({ ...i, livre: i.saldo - (usados.get(i.id) ?? 0) }))
    .filter((i) => i.livre > 0)
    .sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))
  const fatorTabela = tabela && medida && colunaAtual ? fatorDaTabela(tabela, medida, colunaAtual).fator : undefined
  const fatorUsado = fator.trim() || fatorTabela || ''
  const disponivel = loteEscolhido ? lotes.find((l) => l.id === loteEscolhido)?.livre ?? 0 : lotes.reduce((s, l) => s + l.livre, 0)
  const totalPrev = gramas && fatorValido(fatorUsado) ? multiplicarFator(gramas, fatorUsado, tabela?.moeda ?? 'BOB') : undefined
  const medidas = [...new Set([...(tabela?.linhas ?? []), ...(estoque ?? []).filter((i) => i.campos.comprimento).map((i) => Number(i.campos.comprimento))])].sort((a, b) => a - b)

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
        moeda: tabela?.moeda ?? 'BOB',
        total: multiplicarFator(q, fatorUsado, tabela?.moeda ?? 'BOB'),
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Categoria">
          <Selecao valor={categoria} onChange={(v) => (setCategoria(v), setFator(''))} opcoes={['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque'].map((c) => ({ id: c, nome: c }))} />
        </Campo>
        <Campo rotulo="Coluna da tabela (comprador)" ajuda="Cada comprador tem seu preço. Se a pessoa estiver ligada a uma coluna, ela já vem escolhida.">
          <Selecao valor={colunaAtual} onChange={(v) => (setColuna(v), setFator(''))} opcoes={(tabela?.colunas ?? []).map((c) => ({ id: c.id, nome: c.nome }))} />
        </Campo>
      </div>
      <div className="mt-3">
        <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Medida (cm)')}</span>
        <div className="flex flex-wrap gap-1">
          {medidas.map((m) => {
            const temEstoque = (estoque ?? []).some((i) => Number(i.campos.comprimento) === m && String(i.campos.categoria || 'Normal') === categoria && i.saldo > (usados.get(i.id) ?? 0))
            return (
              <button key={m} type="button" onClick={() => (setMedida(m), setFator(''), setLoteEscolhido(undefined))} className={cx('min-h-11 min-w-12 rounded-xl border px-2 font-bold', medida === m ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)]', !temEstoque && 'opacity-40')}>
                {m}
              </button>
            )
          })}
        </div>
      </div>
      {medida && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Gramas" ajuda="Digite em gramas (2008) ou troque para kg (2,5).">
            <GramasInput valor={gramas} onChange={setGramas} />
          </Campo>
          <Campo rotulo="Fator" ajuda="Vem da tabela; dá para mudar só nesta venda.">
            <Entrada inputMode="decimal" value={fator} placeholder={fatorTabela ?? '?'} onChange={(e) => setFator(e.target.value)} />
          </Campo>
          <Campo rotulo="Lote">
            <Selecao valor={loteEscolhido} onChange={(v) => setLoteEscolhido(v || undefined)} vazio={t('Automático (mais antigo)')} opcoes={lotes.map((l) => ({ id: l.id, nome: `${l.codigo ?? ''} ${gramasTexto(l.livre)}` }))} />
          </Campo>
        </div>
      )}
      {medida && (
        <div className="mt-3 rounded-xl bg-[var(--fundo)] p-3">
          <div className="num text-lg font-bold">
            {medida} | {gramas ? gramas.toLocaleString('pt-BR') : '—'} × {fatorUsado || '?'} = {totalPrev !== undefined ? formatar(totalPrev, tabela?.moeda ?? 'BOB') : '—'}
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
