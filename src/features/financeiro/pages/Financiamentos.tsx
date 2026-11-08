// ADIANTAMENTOS A PARCEIROS (financiamento pago com cabelo): a loja dá dinheiro a uma pessoa para comprar cabelo em
// nome da loja; cada entrega de cabelo é uma compra normal que abate a dívida (não sai do caixa).
// Lista (cartões com financiado × entregue × saldo e barra), novo adiantamento e a ficha com a LINHA DO TEMPO
// (dinheiro → entregas → acertos → quitação) e as ações: entrega, receber, abater da comissão, pagar diferença, encerrar.

import { useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { dataLocal, diasEntre } from '../../../core/domain/datas'
import { BotaoEscolha, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { NumeroGrande, GrupoNumeros } from '../../../shared/ui/numeroGrande'
import { formatar } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id } from '../../../core/domain/tipos'
import type { PassoFinanciamento, StatusFinanciamento } from '../../../core/services/financiamentos'
import { CATEGORIAS_CABELO } from '../../../core/areas/cabelo'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, ErroTela, Escolha, GramasInput, Janela, Pagina, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, gramasTexto, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { Anexos, linkWhatsApp, useCotacoes } from '../../../shared/ui/compartilhados'
import { BarraFinanciamento, StatusFinanciamentoPilula } from '../../../shared/ui/financiamento'
import { LinhaDoTempo } from '../../../shared/ui/linhaTempo'
import { useT } from '../../../shared/ui/i18n'
import { Paginada } from '../../../shared/ui/paginacao'

type FiltroStatus = 'ativos' | StatusFinanciamento | 'todos'

const PRAZOS = [{ id: '', nome: 'Qualquer prazo' }, { id: 'vencido', nome: 'Vencido', icone: '🔴' }, { id: 'semana', nome: 'Vence em 7 dias', icone: '🟡' }, { id: 'sem', nome: 'Sem data limite', icone: '⚪' }]

/** a data limite no cartão: "⏰ até 30/11 · faltam 12 dias" (vermelho se passou e ainda deve) */
function SeloPrazo({ prazo, status, hoje }: { prazo?: string; status: string; hoje: string }) {
  const t = useT()
  if (!prazo || status !== 'aberto') return null
  const dias = diasEntre(hoje, prazo)
  const tom = dias < 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : dias <= 7 ? 'bg-[var(--alerta)]/12 text-[var(--alerta)]' : 'bg-[var(--fundo)] text-[var(--suave)]'
  return <span className={cx('num self-start rounded-full px-2.5 py-0.5 text-xs font-semibold', tom)}>⏰ {t('até')} {dataBR(prazo)} · {dias < 0 ? t('vencido há {n} dia(s)', { n: -dias }) : dias === 0 ? t('vence hoje') : t('faltam {n} dia(s)', { n: dias })}</span>
}

export function Financiamentos() {
  const t = useT()
  const { ir, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const [status, setStatus] = useParamTela<FiltroStatus>('status', 'ativos')
  const [busca, setBusca] = useParamTela('busca', '')
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const [prazo, setPrazo] = useParamTela<'' | 'vencido' | 'semana' | 'sem'>('prazo', '')
  const { dados, erro } = useConsulta('financiamentos', { status: status === 'todos' ? undefined : status, busca: busca || undefined, de: de || undefined, ate: ate || undefined, prazo: prazo || undefined })
  const hoje = dataLocal()
  const limpar = () => (setBusca(''), setDe(''), setAte(''), setPrazo(''))
  const m = dados?.moeda ?? moedaPadrao()
  const c = dados?.contagem
  const abas: { id: FiltroStatus; nome: string; n?: number }[] = [
    { id: 'ativos', nome: 'Em andamento', n: c ? c.aberto + c.aPagar : undefined },
    { id: 'aberto', nome: 'Em aberto', n: c?.aberto },
    { id: 'aPagar', nome: 'A pagar ao parceiro', n: c?.aPagar },
    { id: 'quitado', nome: 'Quitados', n: c?.quitado },
    { id: 'encerrado', nome: 'Encerrados', n: c?.encerrado },
    { id: 'todos', nome: 'Todos', n: c?.todos },
  ]
  return (
    <div>
      <Titulo
        acao={admin && <Botao onClick={() => ir('novoFinanciamento')}>+ {t('Adiantamento')}</Botao>}
        subtitulo={t('Dinheiro dado a um parceiro para comprar cabelo para a loja. A dívida é paga com o cabelo que ele entrega.')}
      >
        {t('Adiantamentos')}
      </Titulo>
      {erro && <p className="mb-3 text-sm text-[var(--ruim)]">{erro}</p>}
      {dados && (
        <GrupoNumeros colunas={4}>
          <NumeroGrande rotulo="Na mão dos compradores" icone="🤲" valor={formatar(dados.totais.naMao, m)} tom="marca" ativo={status === 'aberto'} onClick={() => setStatus('aberto')} />
          <NumeroGrande rotulo="Financiado" icone="💸" valor={formatar(dados.totais.financiado, m)} />
          <NumeroGrande rotulo="Cabelo entregue" icone="💇‍♀️" valor={formatar(dados.totais.entregue, m)} tom={dados.totais.entregue ? 'bom' : undefined} sub={gramasTexto(dados.totais.gramas)} />
          <NumeroGrande rotulo="A pagar a parceiros" icone="⬆" valor={formatar(dados.totais.aPagarParceiros, m)} tom={dados.totais.aPagarParceiros ? 'alerta' : undefined} ativo={status === 'aPagar'} onClick={() => setStatus('aPagar')} />
        </GrupoNumeros>
      )}
      <FiltroLista
        className="mb-3"
        situacao={{ valor: status, onChange: (v) => setStatus(v as FiltroStatus), opcoes: abas.map((a) => ({ id: a.id, nome: a.nome, n: a.n, tom: a.id === 'aPagar' ? 'alerta' : undefined })) }}
        busca={busca} onBusca={setBusca} placeholder="Buscar por código, pessoa ou viagem"
        periodo={{ de, ate, onChange: (d, a) => (setDe(d ?? ''), setAte(a ?? '')), presets: ['30d', 'mes', 'mesPassado', 'ano'] }}
        extra={<BotaoEscolha icone="⏰" rotulo="Prazo" valor={prazo} onChange={(v) => setPrazo(v as typeof prazo)} opcoes={PRAZOS} />}
        ativos={prazo ? [{ k: 'prazo', rotulo: `⏰ ${t(PRAZOS.find((x) => x.id === prazo)?.nome ?? prazo)}` }] : []}
        onTirar={() => setPrazo('')} onLimpar={limpar} temAtivos={!!(busca || de || prazo)}
        resultados={dados?.linhas.length} total={dados?.contagem.todos} unidade="adiantamento(s)"
      />
      {!dados ? <Carregando /> : !dados.linhas.length && (busca || de || prazo) ? <VazioFiltro filtrando onLimpar={limpar} /> : !dados.linhas.length ? (
        <Vazio texto={status === 'ativos' ? 'Nenhum adiantamento em andamento.' : 'Nenhum adiantamento.'}>
          {admin && <Botao className="mt-2" onClick={() => ir('novoFinanciamento')}>+ {t('Adiantamento')}</Botao>}
        </Vazio>
      ) : (
        <Paginada itens={dados.linhas} unidade="adiantamento(s)" reiniciar={String(dados.linhas.length)}>{(pagina) => (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pagina.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => ir('financiamento', { id: f.id })} className="flex h-full w-full flex-col gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-left shadow-sm hover:border-[var(--marca)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="num text-xs font-semibold text-[var(--suave)]">{f.codigo} · {dataBR(f.data)}</div>
                    <b className="block break-words text-base">{f.pessoa}</b>
                  </div>
                  <StatusFinanciamentoPilula status={f.status} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-[var(--suave)]">{t('Financiado')}</dt><dd className="num font-semibold">{formatar(f.valor, f.moeda)}</dd></div>
                  <div><dt className="text-xs text-[var(--suave)]">{t('Entregue')}</dt><dd className="num font-semibold">{formatar(f.entregue, dados.moeda)}</dd><dd className="num text-xs text-[var(--suave)]">{gramasTexto(f.gramas)}</dd></div>
                  <div>
                    <dt className="text-xs text-[var(--suave)]">{t(f.saldo < 0 ? 'Devo a ele' : 'Saldo devedor')}</dt>
                    <dd className={cx('num font-bold', f.saldo > 0 ? 'text-[var(--marca)]' : f.saldo < 0 ? 'text-[var(--alerta)]' : 'text-[var(--bom)]')}>{formatar(Math.abs(f.saldo), dados.moeda)}</dd>
                  </div>
                </dl>
                <BarraFinanciamento progressoBp={f.progressoBp} status={f.status} />
                <div className="flex flex-wrap gap-x-3 text-xs text-[var(--suave)]">
                  <span>{t('{n} entrega(s)', { n: f.entregas })}</span>
                  {f.viagem && <span>✈ {f.viagem.codigo}</span>}
                  {f.abaterComissoes && <span>{t('abate das comissões')}</span>}
                </div>
                <SeloPrazo prazo={f.prazo} status={f.status} hoje={hoje} />
              </button>
            </li>
          ))}
        </ul>
        )}</Paginada>
      )}
    </div>
  )
}

/** NOVO ADIANTAMENTO (#/adiantamentos/novo): quem, quanto, em que moeda e de onde sai. */
const ICONE_PASSO: Record<PassoFinanciamento['tipo'], string> = { emprestimo: '💸', entrega: '💇‍♀️', recebimento: '💵', comissao: '🧾', diferenca: '↩️', baixa: '✂️', quitacao: '✅', encerramento: '🔒' }

/** Linha do tempo do adiantamento: um passo por acontecimento, com o efeito na dívida e o saldo depois. */
function LinhaFinanciamento({ passos, moeda, nomeForma }: { passos: PassoFinanciamento[]; moeda: string; nomeForma(id: string): string }) {
  const t = useT()
  const { ir } = useApp()
  return (
    <ol className="relative ml-3 border-l-2 border-[var(--borda)]">
      {passos.map((p) => (
        <li key={p.id} className="relative mb-4 ml-5 last:mb-0">
          <span aria-hidden className={cx('absolute -left-[2.05rem] flex h-8 w-8 items-center justify-center rounded-full border-2 bg-[var(--cartao)] text-sm', p.tipo === 'quitacao' ? 'border-[var(--bom)]' : p.tipo === 'encerramento' ? 'border-[var(--suave)]' : 'border-[var(--marca)]')}>{ICONE_PASSO[p.tipo]}</span>
          <div className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="break-words">{t(p.titulo)}</b>
                <div className="text-xs text-[var(--suave)]">{dataBR(p.data)}{p.porNome ? ` · ${p.porNome}` : ''}</div>
              </div>
              {p.efeito !== undefined && p.efeito !== 0 && (
                <div className="text-right">
                  <div className={cx('num font-bold', p.efeito > 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{p.efeito > 0 ? '+' : '−'}{formatar(Math.abs(p.efeito), moeda)}</div>
                  {p.saldoDepois !== undefined && <div className="num text-xs text-[var(--suave)]">{t('saldo')} {formatar(p.saldoDepois, moeda)}</div>}
                </div>
              )}
            </div>
            {p.dinheiro && <div className="mt-1 text-sm">{formatar(p.dinheiro.valor, p.dinheiro.moeda)}{p.dinheiro.forma ? ` · ${t(nomeForma(p.dinheiro.forma))}` : ''}</div>}
            {p.compra && (
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => ir('pedido', { id: p.compra!.id })} className="min-h-9 rounded-full bg-[var(--marca-suave)] px-3 text-xs font-semibold text-[var(--marca)] hover:brightness-95">🛒 {p.compra.codigo ?? t('Compra')}</button>
                  <span className="num">{gramasTexto(p.compra.gramas)} · {formatar(p.compra.valor, moeda)}</span>
                  <span className={cx('text-xs', p.compra.cancelada && 'font-semibold text-[var(--ruim)]')}>{t(p.compra.nomeEtapa)}</span>
                </div>
                <ul className="text-xs text-[var(--suave)]">{p.compra.linhas.map((l, i) => <li key={i}>{l.descricao} · {gramasTexto(l.quantidade)} · {formatar(l.total, l.moeda)}</li>)}</ul>
                {!!p.lotes?.length && (
                  <div className="flex flex-wrap gap-1" aria-label={t('Lotes')}>
                    {p.lotes.slice(0, 8).map((l) => (
                      <button key={l.id} type="button" onClick={() => ir('lote', { id: l.id })} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold hover:brightness-95" style={{ background: 'color-mix(in srgb, var(--alerta) 16%, transparent)', color: 'var(--alerta)' }}>
                        📦 {l.codigo ?? l.nome} <span className="num opacity-80">{gramasTexto(l.saldo)}</span>
                      </button>
                    ))}
                    {p.lotes.length > 8 && <span className="text-xs text-[var(--suave)]">+{p.lotes.length - 8}</span>}
                  </div>
                )}
                {!p.lotes?.length && !p.compra.cancelada && <div className="text-xs text-[var(--suave)]">{t('Ainda não entrou no estoque: continue em Comprar.')}</div>}
              </div>
            )}
            {p.obs && <div className="mt-1 text-sm italic text-[var(--suave)]">{p.obs}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

interface LinhaEntrega { id: Id; medida?: number; categoria: string; gramas?: number; valor?: number }
const novaLinha = (): LinhaEntrega => ({ id: novoId(), categoria: 'Normal' })

type Acao = 'entrega' | 'receber' | 'comissao' | 'diferenca' | 'encerrar'

export function FichaFinanciamento() {
  const t = useT()
  const { nav, voltar, ir, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('financiamento', { id })
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [acao, setAcao] = useState<Acao>()
  const [opId, setOpId] = useState(() => novoId())
  // entrega
  const [linhas, setLinhas] = useState<LinhaEntrega[]>(() => [novaLinha()])
  const [estado, setEstado] = useState<'Bruto' | 'Separado'>('Bruto')
  const [entrarNoEstoque, setEntrar] = useState(true)
  const [obs, setObs] = useState('')
  // dinheiro
  const [moedaEscolhida, setMoeda] = useState<string>()
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const f = dados.financiamento
  const mp = dados.moedaPrincipal
  const moeda = moedaEscolhida ?? mp
  const formas = formasEmUso(cfg?.formas, moeda)
  const totalEntrega = linhas.reduce((s, l) => s + (l.valor ?? 0), 0)
  const gramasEntrega = linhas.reduce((s, l) => s + (l.gramas ?? 0), 0)
  const entregaOk = linhas.length > 0 && linhas.every((l) => l.gramas && l.valor)
  const limpar = () => {
    setAcao(undefined)
    setOpId(novoId())
    setLinhas([novaLinha()])
    setObs('')
    setValor(undefined)
    setMoeda(undefined)
    setForma('dinheiro')
  }
  const abrir = (a: Acao) => {
    setOpId(novoId())
    if (a === 'diferenca') setValor(dados.aPagarParceiro)
    if (a === 'receber') setValor(undefined)
    if (a === 'comissao') setValor(Math.min(dados.saldo, dados.comissaoAPagar))
    setAcao(a)
  }
  const fechar = () => ((acao === 'entrega' ? !totalEntrega : valor === undefined) || window.confirm(t('Sair sem salvar?'))) && limpar()
  const att = (i: number, p: Partial<LinhaEntrega>) => setLinhas(linhas.map((l, k) => (k === i ? { ...l, ...p } : l)))
  const ok = (r: unknown) => r && limpar()
  const cobranca = `${t('Olá')} ${dados.pessoa?.nome ?? ''}! ${t('Adiantamento')} ${f.codigo}: ${t('falta entregar')} ${formatar(dados.saldo, mp)}.`
  const seletorMoeda = (
    <Campo rotulo="Valor" comoDiv>
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma(formasEmUso(cfg?.formas, v)[0]?.id ?? 'dinheiro'))} opcoes={(cfg?.moedasAtivas ?? [mp]).map((x) => ({ id: x, nome: x }))} />
        <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
      </div>
    </Campo>
  )
  const seletorForma = <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formas.map((x) => ({ id: x.id, nome: t(x.nome) }))} /></Campo>
  const saldoDepoisEntrega = dados.saldo - totalEntrega
  return (
    <Pagina
      onVoltar={voltar}
      voltarRotulo="Adiantamentos"
      trilha={f.codigo}
      titulo={<span className="flex flex-wrap items-center gap-2"><span className="num">{f.codigo}</span> · {dados.pessoa ? <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => ir('pessoa', { id: dados.pessoa!.id })}>{dados.pessoa.nome}</button> : '—'}</span>}
      subtitulo={<span className="flex flex-wrap items-center gap-2">{t('Adiantado')} {formatar(f.valor, f.moeda)} · {dataBR(f.data)} <StatusFinanciamentoPilula status={dados.status} /></span>}
    >
      <div className="space-y-4">
        {admin && dados.status !== 'encerrado' && (
          <div className="flex flex-wrap gap-2">
            {dados.status === 'aberto' && <Botao onClick={() => abrir('entrega')}>💇‍♀️ {t('Registrar entrega de cabelo')}</Botao>}
            {dados.status === 'aPagar' && <Botao onClick={() => abrir('diferenca')}>↩️ {t('Pagar diferença')} {formatar(dados.aPagarParceiro, mp)}</Botao>}
            {dados.status === 'aberto' && <Botao variante="secundario" onClick={() => abrir('receber')}>{t('Receber em dinheiro')}</Botao>}
            {dados.status === 'aberto' && <Botao variante="secundario" disabled={!dados.comissaoAPagar} title={dados.comissaoAPagar ? undefined : t('Essa pessoa não tem comissão a pagar.')} onClick={() => abrir('comissao')}>{t('Abater da comissão')}</Botao>}
            {dados.status === 'aberto' && dados.pessoa?.telefone && <a className="inline-flex min-h-10 items-center rounded-xl bg-[#25d366] px-3 text-sm font-semibold text-white" href={linkWhatsApp(cobranca, dados.pessoa.telefone)} target="_blank" rel="noreferrer">{t('Cobrar no WhatsApp')}</a>}
            <Botao variante="leve" onClick={() => abrir('encerrar')}>{t('Encerrar')}</Botao>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <NumeroGrande rotulo="Valor financiado" valor={formatar(f.valor, f.moeda)} sub={f.moeda !== mp ? formatar(dados.financiado, mp) : undefined} />
          <NumeroGrande rotulo="Cabelo entregue" valor={formatar(dados.entregue, mp)} sub={gramasTexto(dados.gramas)} />
          <NumeroGrande rotulo="Recebido / abatido" valor={formatar(dados.recebido + dados.comissao, mp)} sub={dados.comissao ? `${t('comissão')} ${formatar(dados.comissao, mp)}` : undefined} />
          <NumeroGrande
            rotulo={dados.saldo < 0 ? 'A pagar ao parceiro' : 'Saldo devedor atual'}
            valor={formatar(Math.abs(dados.saldo), mp)}
            tom={dados.saldo > 0 ? 'marca' : dados.saldo < 0 ? 'alerta' : 'bom'}
            colorirValor
          />
        </div>
        <Cartao>
          <BarraFinanciamento progressoBp={dados.progressoBp} status={dados.status} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {dados.viagem && <button type="button" className="min-h-9 underline" onClick={() => ir('viagem', { id: dados.viagem!.id })}>✈ {dados.viagem.codigo} · {dados.viagem.nome}</button>}
            {admin && dados.status !== 'encerrado' && (
              <label className="flex min-h-9 items-center gap-2">
                <input type="checkbox" checked={!!f.abaterComissoes} disabled={ocupado} onChange={(e) => executar('ajustarFinanciamento', { financiamentoId: f.id, abaterComissoes: e.target.checked }, t('Salvo.'))} />
                {t('Abater sozinho das próximas comissões')}
              </label>
            )}
            {dados.baixa !== 0 && <span>{t('Baixa ao encerrar')}: <b className="num">{formatar(dados.baixa, mp)}</b></span>}
            {admin && dados.saldoConta !== dados.saldo && <span className="text-[var(--suave)]">{t('Conta corrente inteira da pessoa')}: <span className="num">{formatar(dados.saldoConta, mp)}</span></span>}
          </div>
          {f.encerramento && <p className="mt-2 text-sm">🔒 {t('Encerrado em {d} por {quem}', { d: dataBR(f.encerramento.data), quem: f.encerramento.porNome })} · {f.encerramento.motivo}</p>}
        </Cartao>
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Cartao titulo={t('Linha do tempo')} ajuda="Do dinheiro entregue até a quitação: cada entrega de cabelo (compra e lotes), cada acerto e o saldo depois.">
            <LinhaFinanciamento passos={dados.passos} moeda={mp} nomeForma={(x) => cfg?.formas.find((y) => y.id === x)?.nome ?? x} />
          </Cartao>
          <div className="space-y-4">
            <Cartao titulo={t('Comprovantes')}><Anexos donoId={f.id} categorias={['comprovante', 'outro']} /></Cartao>
            {admin && <Cartao titulo={t('Histórico')}><LinhaDoTempo id={f.id} /></Cartao>}
          </div>
        </div>
      </div>

      {/* ENTREGA DE CABELO: vira uma compra normal (fornecedor = o parceiro), sem sair do caixa */}
      <Janela larga aberta={acao === 'entrega'} titulo={t('Entrega de cabelo')} onFechar={fechar} rodape={
        <div className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="num">{gramasTexto(gramasEntrega)} · <b>{formatar(totalEntrega, mp)}</b></span>
            <span className={cx('num font-semibold', saldoDepoisEntrega < 0 ? 'text-[var(--alerta)]' : '')}>{saldoDepoisEntrega >= 0 ? `${t('Falta depois')}: ${formatar(saldoDepoisEntrega, mp)}` : `${t('A loja vai dever')}: ${formatar(-saldoDepoisEntrega, mp)}`}</span>
          </div>
          <Botao grande className="w-full" disabled={ocupado || !entregaOk} onClick={async () => ok(await executar('registrarEntregaFinanciamento', {
            id: opId,
            financiamentoId: f.id,
            moduloId: 'cabelo',
            entrarNoEstoque,
            obs,
            linhas: linhas.map((l) => ({ id: l.id, quantidade: l.gramas!, moeda: mp, total: l.valor!, campos: { estado, categoria: l.categoria, comprimento: l.medida } })),
          }, t('Entrega registrada: compra criada e abatida do adiantamento.')))}>{t('Registrar entrega')}</Botao>
        </div>
      }>
        <div className="space-y-3">
          <p className="rounded-xl bg-[var(--fundo)] p-3 text-sm">{t('Vira uma compra normal de {nome}, paga com o adiantamento (não sai do caixa). Depois segue para a Triagem como qualquer compra.', { nome: dados.pessoa?.nome ?? '' })}</p>
          <Escolha<'Bruto' | 'Separado'> rotulo="Situação" valor={estado} onChange={setEstado} opcoes={[{ id: 'Bruto', nome: 'Bruto (misturado)' }, { id: 'Separado', nome: 'Já separado' }]} />
          <ul className="space-y-2">
            {linhas.map((l, i) => (
              <li key={l.id} className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--borda)] p-2 sm:grid-cols-[6rem_8rem_1fr_1fr_auto] sm:items-end">
                <Campo rotulo="Medida (cm)"><Entrada inputMode="numeric" value={l.medida ?? ''} onChange={(e) => att(i, { medida: Number(e.target.value.replace(/\D/g, '')) || undefined })} placeholder="60" /></Campo>
                <Campo rotulo="Categoria"><Selecao valor={l.categoria} onChange={(v) => att(i, { categoria: v })} opcoes={CATEGORIAS_CABELO.map((c) => ({ id: c, nome: c }))} /></Campo>
                <Campo rotulo="Peso" comoDiv><GramasInput valor={l.gramas} onChange={(g) => att(i, { gramas: g })} /></Campo>
                <Campo rotulo="Valor" comoDiv><ValorInput moeda={mp} valor={l.valor} onChange={(v) => att(i, { valor: v })} /></Campo>
                <Botao variante="leve" className="col-span-2 sm:col-span-1" disabled={linhas.length === 1} onClick={() => setLinhas(linhas.filter((_, k) => k !== i))} aria-label={t('Tirar linha')}>✕</Botao>
              </li>
            ))}
          </ul>
          <Botao variante="secundario" onClick={() => setLinhas([...linhas, novaLinha()])}>+ {t('Outra medida')}</Botao>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={entrarNoEstoque} onChange={(e) => setEntrar(e.target.checked)} /> {t('Já marcar a entrega como concluída (o cabelo vai para a Triagem de qualquer jeito)')}</label>
          <Campo rotulo="Observação (opcional)"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        </div>
      </Janela>

      <Janela aberta={acao === 'receber'} titulo={t('Receber em dinheiro')} onFechar={fechar} rodape={
        <Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => ok(await executar('receberFinanciamento', { id: opId, financiamentoId: f.id, moeda, valor: valor!, forma, obs }, t('Recebimento registrado.')))}>{t('Registrar')}</Botao>
      }>
        <div className="space-y-3">
          <p className="text-sm">{t('O parceiro devolveu o dinheiro que não virou cabelo. Falta')}: <b className="num">{formatar(dados.saldo, mp)}</b></p>
          {seletorMoeda}
          {moeda === mp && <Botao variante="secundario" onClick={() => setValor(dados.saldo)}>{t('Tudo o que falta')}</Botao>}
          {seletorForma}
        </div>
      </Janela>

      <Janela aberta={acao === 'comissao'} titulo={t('Abater da comissão')} onFechar={fechar} rodape={
        <Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => ok(await executar('abaterComissaoFinanciamento', { id: opId, financiamentoId: f.id, valor: valor!, obs }, t('Abatido da comissão.')))}>{t('Abater')}</Botao>
      }>
        <div className="space-y-3">
          <p className="text-sm">{t('A comissão que a loja deve a {nome} paga a dívida, sem passar pelo caixa. Conta como comissão paga.', { nome: dados.pessoa?.nome ?? '' })}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-[var(--fundo)] p-2">{t('Comissão a pagar')}<br /><b className="num">{formatar(dados.comissaoAPagar, mp)}</b></div>
            <div className="rounded-xl bg-[var(--fundo)] p-2">{t('Falta do adiantamento')}<br /><b className="num">{formatar(dados.saldo, mp)}</b></div>
          </div>
          <Campo rotulo="Valor" comoDiv><ValorInput moeda={mp} valor={valor} onChange={setValor} /></Campo>
          <Botao variante="secundario" onClick={() => setValor(Math.min(dados.saldo, dados.comissaoAPagar))}>{t('O máximo possível')}</Botao>
        </div>
      </Janela>

      <Janela aberta={acao === 'diferenca'} titulo={t('Pagar diferença')} onFechar={fechar} rodape={
        <Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => ok(await executar('pagarDiferencaFinanciamento', { id: opId, financiamentoId: f.id, moeda, valor: valor!, forma }, t('Diferença paga.')))}>{t('Pagar')}</Botao>
      }>
        <div className="space-y-3">
          <p className="text-sm">{t('O cabelo entregue passou do adiantado: a loja deve {v} ao parceiro (sai do caixa).', { v: formatar(dados.aPagarParceiro, mp) })}</p>
          {seletorMoeda}
          {seletorForma}
        </div>
      </Janela>

      {acao === 'encerrar' && (
        <Confirmar
          titulo="Encerrar adiantamento"
          texto={dados.saldo > 0 ? `${t('Ainda falta {v}: vira baixa na conta corrente da pessoa (perda, não volta ao caixa).', { v: formatar(dados.saldo, mp) })}` : dados.saldo < 0 ? t('A loja ainda deve {v} ao parceiro: a diferença vira baixa (ele abre mão).', { v: formatar(-dados.saldo, mp) }) : t('O adiantamento está quitado: fica encerrado.')}
          rotulo="Encerrar"
          perigo={dados.saldo !== 0}
          pedirMotivo
          onFechar={() => setAcao(undefined)}
          onConfirmar={async (motivo) => {
            await executar('encerrarFinanciamento', { id: opId, financiamentoId: f.id, motivo }, t('Adiantamento encerrado.'))
          }}
        />
      )}
    </Pagina>
  )
}
