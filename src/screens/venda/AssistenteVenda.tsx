// VENDER › ASSISTENTE: a venda passo a passo (o que vendeu, para quem, como pagou), com as perguntas de cada área.
import { useState } from 'react'
import { AvisoAbaixoDoCusto, useAbaixoDoCusto } from '../../ui/abaixoDoCusto'
import { ImpostosDaOperacao } from '../../ui/impostosOperacao'
import { Trilha } from '../../ui/trilha'
import { formatar } from '../../core/domain/dinheiro'
import { dataLocal } from '../../core/domain/datas'
import { novoId } from '../../core/domain/ids'
import type { Id } from '../../core/domain/tipos'
import { Botao, Campo, Cartao, Confirmar, Entrada, Escolha, Selecao, Vazio, loc, Titulo } from '../../ui/base'
import { useApp, useComando, useConsulta } from '../../ui/contexto'
import { Anexos, EditorPagamentos, type PagamentoTela, SeletorPessoa, ValoresConvertidos, useCotacoes, conv } from '../../ui/compartilhados'
import { useT } from '../../ui/i18n'
import { EditorServico, SeletorServicos, ajusteParaEntrada, faltaNoAjuste } from '../../ui/linhaServico'
import { type Carrinho, type LinhaTela } from './tipos'
import { ItensSimples } from './ItensSimples'
import { LinhasCabelo } from './LinhasCabelo'

/** nome do botão pequeno na entrada do Vender ("Serviço", "Produto" ou o nome do módulo) */
export function rotuloCurto(id: string, nome: string, t: ReturnType<typeof useT>) {
  return id === 'salao' ? t('Serviço') : id === 'produtos' ? t('Produto') : t(nome)
}

export function perguntaDe(id: string, nome: string, t: ReturnType<typeof useT>) {
  return id === 'cabelo' ? t('É cabelo?') : id === 'salao' ? t('É serviço?') : t('É {nome}?', { nome: t(nome).toLowerCase() })
}

export function AssistenteVenda(p: {
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
  // ABAIXO DO CUSTO (pacotes de cabelo/produto): aviso antes de cobrar e confirmação ao concluir
  const custo = useAbaixoDoCusto(linhas.map((l) => ({ itemId: l.itemId, quantidade: l.quantidade, total: l.total, moeda: l.moeda })))
  const [perguntarCusto, setPerguntarCusto] = useState(false)
  const confirmar = async (custoOk?: unknown) => {
    if (custo.abaixo.length && custoOk !== true) return setPerguntarCusto(true)
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
      {perguntarCusto && (
        <Confirmar titulo="Vender abaixo do custo?" rotulo="Vender assim mesmo" perigo onFechar={() => setPerguntarCusto(false)}
          texto={t('{n} pacote(s) com preço abaixo do que custou. Confira a medida, a coluna da tabela e o desconto. Se for de propósito, pode seguir: fica registrado na auditoria.', { n: custo.abaixo.length })}
          onConfirmar={() => { setPerguntarCusto(false); void confirmar(true) }} />
      )}
      <Trilha atual={p.titulo} onVoltar={passo === 'pagar' ? () => setPasso('itens') : p.onVoltar} rotuloVoltar={passo === 'pagar' ? 'Itens' : 'Vender'} />
      <Titulo>{p.titulo}</Titulo>
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
              <AvisoAbaixoDoCusto abaixo={custo.abaixo} moeda={p.moedaPrincipal} nomeDe={(id) => linhas.find((l) => l.itemId === id)?.nome ?? id} />
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
          <ImpostosDaOperacao className="mt-2" produto={p.moduloId === 'salao' ? 0 : total} servico={p.moduloId === 'salao' ? total : 0} moeda={moedaVenda} />
          <div className="mt-4">
            {passo === 'itens' ? (
              <>
                {pendenciaAjuste && <p className="mb-2 text-sm font-semibold text-[var(--alerta)]">{t(pendenciaAjuste)}</p>}
                <Botao grande className="w-full" disabled={!linhas.length || !!pendenciaAjuste} onClick={() => (agendar ? void confirmar() : setPasso('pagar'))}>
                  {agendar ? (temConflito ? t('Agendar mesmo assim') : t('Agendar')) : t('Continuar para pagamento')}
                </Botao>
              </>
            ) : (
              <Botao grande className="w-full" disabled={ocupado} onClick={() => void confirmar()}>
                {t('Confirmar venda')}
              </Botao>
            )}
          </div>
        </Cartao>
      </div>
    </div>
  )
}
