// PESSOAS E CONTAS: clientes, fornecedores, equipe… e a conta corrente de cada um (quem me deve, a quem devo:
// fiado, adiantamento, "falta"). Ficha 360° com tudo o que a pessoa fez e linha do tempo.

import { useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { BotaoEscolha, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { Trilha } from '../../../shared/ui/trilha'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { CabecalhoFicha } from '../../../shared/ui/cabecalhoFicha'
import { formatar } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id, Papel } from '../../../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, gramasTexto, ErroTela, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { linkWhatsApp, useCotacoes } from '../../../shared/ui/compartilhados'
import { LinhaDoTempo } from '../../../shared/ui/linhaTempo'
import { AdiantamentosDaPessoa } from '../../../shared/ui/financiamento'
import { useT } from '../../../shared/ui/i18n'
import { NOME_ETAPA } from '../../venda'
import { Paginada } from '../../../shared/ui/paginacao'

const PAPEIS: Papel[] = ['cliente', 'fornecedor', 'funcionario', 'profissional', 'devedor', 'credor', 'socio']
const SITUACAO_EMPRESTIMO: Record<string, string> = { aberto: 'Em aberto', quitado: 'Quitado', cancelado: 'Cancelado' }

/**
 * PESSOAS E CONTAS — os números (me devem · eu devo · pessoas) → as abas → o FILTRO PADRÃO (busca; nas contas, o lado
 * em abas com o número; em todas, o papel) → a lista: avatar, nome, papéis/último movimento e o valor em destaque.
 */
export function Pessoas() {
  const t = useT()
  const { ir, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const [aba, setAba] = useParamTela<'contas' | 'todas'>('aba', admin ? 'contas' : 'todas')
  const [busca, setBusca] = useParamTela('busca', '')
  const [papel, setPapel] = useParamTela('papel', '')
  const [lado, setLado] = useParamTela<'' | 'receber' | 'pagar'>('lado', '')
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: contas } = useConsulta('contas', { somenteAbertas: true }, admin)
  const { cfg } = useCotacoes()
  const m = cfg?.moedaPrincipal ?? moedaPadrao()
  const b = busca.trim().toLowerCase()
  const daBusca = (nome: string, tel?: string) => !b || nome.toLowerCase().includes(b) || !!tel?.includes(b)
  const todas = (pessoas ?? []).filter((p) => admin || !p.localId || p.localId === sessao.localId)
  const lista = todas.filter((p) => (!papel || p.papeis.includes(papel as Papel)) && daBusca(p.nome, p.telefone))
  const contasB = (contas?.lista ?? []).filter((c) => daBusca(c.nome))
  const doLado = contasB.filter((c) => !lado || (lado === 'receber' ? c.saldo > 0 : c.saldo < 0))
  const papeisUsados = PAPEIS.filter((x) => todas.some((p) => p.papeis.includes(x)))
  const emContas = aba === 'contas' && admin
  const limpar = () => (setBusca(''), setPapel(''), setLado(''))
  return (
    <div>
      <Titulo acao={<Botao onClick={() => ir('novaPessoa')}>+ {t('Pessoa')}</Botao>} subtitulo={t('Clientes, fornecedoras e equipe — e quem deve a quem.')}>{t('Pessoas e contas')}</Titulo>
      {admin && (
        <GrupoNumeros colunas={3} celular={3}>
          <NumeroGrande rotulo="Me devem" valor={formatar(contas?.aReceber ?? 0, m)} icone="⬇" tom="bom" carregando={!contas} ativo={emContas && lado === 'receber'} onClick={() => (setAba('contas'), setLado(lado === 'receber' ? '' : 'receber'))} ajuda="Soma do que as pessoas me devem. Toque para ver quem." />
          <NumeroGrande rotulo="Eu devo" valor={formatar(contas?.aPagar ?? 0, m)} icone="⬆" tom={contas?.aPagar ? 'ruim' : undefined} carregando={!contas} ativo={emContas && lado === 'pagar'} onClick={() => (setAba('contas'), setLado(lado === 'pagar' ? '' : 'pagar'))} ajuda="Soma do que eu devo às pessoas. Toque para ver a quem." />
          <NumeroGrande rotulo="Pessoas" valor={todas.length} icone="👥" carregando={!pessoas} sub={`${todas.filter((p) => p.papeis.includes('cliente')).length} ${t('clientes')}`} onClick={() => setAba('todas')} />
        </GrupoNumeros>
      )}
      {admin && <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'contas', nome: 'Quem deve / a quem devo' }, { id: 'todas', nome: 'Todas as pessoas' }]} />}
      <FiltroLista
        className="mb-3 mt-3"
        busca={busca} onBusca={setBusca} placeholder="Buscar nome ou telefone"
        situacao={emContas ? { valor: lado, onChange: (v) => setLado(v as typeof lado), opcoes: [{ id: '', nome: 'Todas', n: contasB.length }, { id: 'receber', nome: 'Me devem', n: contasB.filter((c) => c.saldo > 0).length }, { id: 'pagar', nome: 'Eu devo', n: contasB.filter((c) => c.saldo < 0).length, tom: 'alerta' }] } : undefined}
        extra={!emContas ? <BotaoEscolha icone="🏷" rotulo="Papel" valor={papel} onChange={setPapel} opcoes={[{ id: '', nome: 'Todos os papéis' }, ...papeisUsados.map((x) => ({ id: x, nome: NOME_PAPEL[x].nome, icone: NOME_PAPEL[x].icone }))]} /> : undefined}
        ativos={!emContas && papel ? [{ k: 'papel', rotulo: `${NOME_PAPEL[papel as Papel]?.icone ?? ''} ${t(NOME_PAPEL[papel as Papel]?.nome ?? papel)}` }] : []}
        onTirar={() => setPapel('')} onLimpar={limpar} temAtivos={!!(busca || papel || lado)}
        resultados={emContas ? (contas ? doLado.length : undefined) : pessoas ? lista.length : undefined}
        total={emContas ? contas?.lista.length : todas.length}
        unidade="pessoa(s)"
      />
      {emContas ? (
        !contas ? <Carregando /> : !doLado.length ? (busca || lado ? <VazioFiltro filtrando onLimpar={limpar} /> : <Vazio texto="Todas as contas estão em dia." />) : (
          <Paginada itens={doLado} unidade="conta(s)" reiniciar={String(doLado.length)}>{(pagina) => (
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
            {pagina.map((c) => {
              const deve = c.saldo > 0
              return (
                <li key={c.pessoaId}>
                  <button type="button" onClick={() => ir('pessoa', { id: c.pessoaId })} className="relative flex w-full items-center gap-3 p-3 pl-4 text-left hover:bg-[var(--fundo)]">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: deve ? 'var(--bom)' : 'var(--ruim)' }} />
                    <AvatarPessoa nome={c.nome} />
                    <span className="min-w-0 flex-1"><b className="block truncate">{c.nome}</b><span className="num block text-xs text-[var(--suave)]">{t('último movimento')} {dataBR(c.ultimo)}</span></span>
                    <span className="shrink-0 text-right">
                      <b className={cx('num block', deve ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{formatar(Math.abs(c.saldo), m)}</b>
                      <span className="block text-xs text-[var(--suave)]">{t(deve ? 'me deve' : 'eu devo')}</span>
                    </span>
                    <span aria-hidden className="text-[var(--suave)]">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
          )}</Paginada>
        )
      ) : !pessoas ? <Carregando /> : !lista.length ? (
        busca || papel ? <VazioFiltro filtrando onLimpar={limpar} /> : (
          <Vazio texto="Nenhuma pessoa cadastrada ainda."><Botao variante="secundario" onClick={() => ir('novaPessoa')}>+ {t('Pessoa')}</Botao></Vazio>
        )
      ) : (
        <Paginada itens={lista} unidade="pessoa(s)" reiniciar={String(lista.length)}>{(pagina) => (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {pagina.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => ir('pessoa', { id: p.id })} className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)] hover:shadow-md">
                <AvatarPessoa nome={p.nome} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{p.nome}</b>
                  {p.telefone && <span className="num block truncate text-xs text-[var(--suave)]">💬 {p.telefone}</span>}
                  <span className="mt-1 flex flex-wrap gap-1">{p.papeis.map((x) => <Pilula key={x} pequena tom={x === 'cliente' ? 'marca' : 'neutro'}>{NOME_PAPEL[x]?.icone} {t(NOME_PAPEL[x]?.nome ?? x)}</Pilula>)}</span>
                </span>
                <span aria-hidden className="text-[var(--suave)] transition group-hover:translate-x-0.5">›</span>
              </button>
            </li>
          ))}
        </ul>
        )}</Paginada>
      )}
    </div>
  )
}

function AvatarPessoa({ nome }: { nome: string }) {
  const cor = corDoNome(nome)
  return <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>{iniciais(nome)}</span>
}

/** o nome do papel para gente (o id é técnico: "funcionario" → "Funcionária") */
const NOME_PAPEL: Record<Papel, { nome: string; icone: string }> = {
  cliente: { nome: 'Cliente', icone: '👤' }, fornecedor: { nome: 'Fornecedora', icone: '🛒' }, doadora: { nome: 'Doadora', icone: '🎁' },
  profissional: { nome: 'Profissional', icone: '✂️' }, funcionario: { nome: 'Funcionária', icone: '🧑‍💼' }, devedor: { nome: 'Devedor', icone: '⬇' },
  credor: { nome: 'Credor', icone: '⬆' }, socio: { nome: 'Sócia', icone: '🤝' },
}
const ICONE_EVENTO: Record<string, string> = { venda: '💰', compra: '🛒', emprestimo: '🤝' }

/**
 * FICHA DA PESSOA — o cabeçalho padrão (CabecalhoFicha: avatar, nome, papéis, contato, saldo e ações) e, embaixo, só o
 * que vale para ELA: os números como cliente, como fornecedora e como profissional (cada grupo só aparece se ela tem
 * aquele papel ou movimento), a conta corrente (admin), o cabelo que colocou, empréstimos, adiantamentos e a história.
 */
export function FichaPessoa() {
  const t = useT()
  const { nav, voltar, ir, sessao } = useApp()
  const id = nav.params.id as Id
  const admin = sessao.perfil === 'admin'
  const { dados, erro } = useConsulta('fichaPessoa', { id })
  const { dados: conta } = useConsulta('contaPessoa', { pessoaId: id }, admin)
  const [acerto, setAcerto] = useState<'recebi' | 'paguei'>()
  const { dados: conf } = useConsulta('configuracoes', {})
  const cfg = conf?.config
  const m = cfg?.moedaPrincipal ?? moedaPadrao()
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const p = dados.pessoa
  const mc = conta?.moeda ?? m
  const cor = corDoNome(p.nome)
  // linha da conta → venda ou compra de origem (o "pago na hora" aponta para a mesma venda)
  const origem = new Map<string, string>()
  for (const l of conta?.linhas ?? []) if (l.origemId && (l.tipo === 'venda' || l.tipo === 'compra')) origem.set(l.origemId, l.tipo === 'venda' ? 'venda' : 'pedido')
  const nomeEtapa = (tipo: string, etapa: string) => tipo === 'emprestimo' ? SITUACAO_EMPRESTIMO[etapa] ?? etapa : NOME_ETAPA[etapa] ?? conf?.modulos.flatMap((x) => x.etapas).find((e) => e.id === etapa)?.nome ?? etapa
  const tem = (x: Papel) => p.papeis.includes(x)
  const ehCliente = tem('cliente') || dados.visitas > 0
  const ehFornecedora = tem('fornecedor') || dados.comprasDela > 0
  const ehEquipe = tem('profissional') || tem('funcionario') || dados.atendimentosFeitos > 0
  const vendas = () => ir('vendas', { pessoaId: p.id })
  const saldo = conta?.saldo ?? 0
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Trilha atual={p.nome} />
      <CabecalhoFicha
        midia={<span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black" style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>{iniciais(p.nome)}</span>}
        titulo={p.nome}
        selos={<>{p.papeis.map((x) => <Pilula key={x} tom={x === 'cliente' ? 'marca' : 'neutro'}>{NOME_PAPEL[x]?.icone} {t(NOME_PAPEL[x]?.nome ?? x)}</Pilula>)}</>}
        detalhes={[
          p.telefone && <a key="tel" className="inline-flex items-center gap-1 font-semibold text-[#16a34a]" href={linkWhatsApp('', p.telefone)} target="_blank" rel="noreferrer">💬 {p.telefone}</a>,
          p.cargo,
          dados.ultimaVisita && `${t('última vez')}: ${dataBR(dados.ultimaVisita)}`,
          p.obs,
        ]}
        valor={conta ? <span className={saldo > 0 ? 'text-[var(--bom)]' : saldo < 0 ? 'text-[var(--ruim)]' : ''}>{saldo ? formatar(Math.abs(saldo), mc) : '✓'}</span> : undefined}
        valorDetalhe={conta ? t(saldo > 0 ? 'me deve' : saldo < 0 ? 'eu devo' : 'conta em dia') : undefined}
        acoes={<div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => ir('novaPessoa', { editar: p.id })}>✎ {t('Editar')}</Botao>
          {conta && admin && <Botao onClick={() => setAcerto('recebi')}>⬇ {t('Recebi')}</Botao>}
          {conta && admin && <Botao variante="secundario" onClick={() => setAcerto('paguei')}>⬆ {t('Paguei / adiantei')}</Botao>}
          {saldo > 0 && p.telefone && <a className="inline-flex min-h-11 items-center rounded-xl bg-[#25d366] px-4 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={linkWhatsApp(`${t('Olá')} ${p.nome}! ${t('Seu saldo em aberto é')} ${formatar(saldo, mc)}.`, p.telefone)}>💬 {t('Cobrar')}</a>}
        </div>}
      />

      {ehCliente && (
        <Grupo titulo="Como cliente" icone="👤">
          <GrupoNumeros colunas={4} className="mb-0">
            <NumeroGrande rotulo="Total gasto" valor={formatar(dados.totalGasto, m)} icone="💰" tom={dados.totalGasto ? 'bom' : undefined} onClick={vendas} />
            <NumeroGrande rotulo="Visitas" valor={dados.visitas} icone="📅" onClick={vendas} />
            <NumeroGrande rotulo="Ticket médio" valor={formatar(dados.ticketMedio, m)} icone="🎯" />
            <NumeroGrande rotulo="Última vez" valor={dataBR(dados.ultimaVisita) || '—'} icone="⏱" onClick={dados.ultimaVisita ? () => ir('vendas', { pessoaId: p.id, de: dados.ultimaVisita!.slice(0, 10), ate: dados.ultimaVisita!.slice(0, 10) }) : undefined} />
          </GrupoNumeros>
        </Grupo>
      )}
      {admin && ehFornecedora && (
        <Grupo titulo="Como fornecedora" icone="🛒">
          <GrupoNumeros colunas={2} className="mb-0">
            <NumeroGrande rotulo="Vendeu para mim" valor={formatar(dados.comprasDela, m)} icone="🛒" onClick={() => ir('comprar', { aba: 'todas', busca: p.nome })} />
            <NumeroGrande rotulo="Gramas que me vendeu" valor={gramasTexto(dados.gramasVendidas)} icone="⚖" onClick={() => ir('comprar', { aba: 'todas', busca: p.nome })} />
          </GrupoNumeros>
        </Grupo>
      )}
      {ehEquipe && (
        <Grupo titulo="Como profissional" icone="✂️">
          <GrupoNumeros colunas={2} className="mb-0">
            <NumeroGrande rotulo="Atendimentos feitos" valor={dados.atendimentosFeitos} icone="✂️" onClick={admin ? () => ir('vendas', { profissionalId: p.id }) : undefined} />
            <NumeroGrande rotulo="Comissão" valor={formatar(dados.comissao, m)} icone="💵" tom={dados.comissao ? 'bom' : undefined} onClick={() => ir('equipe', { aba: 'comissoes', pessoaId: p.id })} />
          </GrupoNumeros>
        </Grupo>
      )}

      {conta && admin && (
        <Cartao titulo={t('Conta corrente')} ajuda="+ = a pessoa me deve; − = eu devo a ela. Vendas fiado, compras não pagas, adiantamentos e acertos entram aqui.">
          {!conta.linhas.length ? <Vazio compacto texto="Nada na conta ainda." /> : (
            <ul className="max-h-80 divide-y divide-[var(--borda)] overflow-y-auto">
              {conta.linhas.map((l) => {
                const tela = l.origemId ? origem.get(l.origemId) : undefined
                const entra = l.delta > 0
                const corpo = (
                  <>
                    <span aria-hidden className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', entra ? 'bg-[var(--bom)]/12 text-[var(--bom)]' : 'bg-[var(--ruim)]/10 text-[var(--ruim)]')}>{entra ? '+' : '−'}</span>
                    <span className="min-w-0 flex-1 text-sm"><span className="block truncate">{l.descricao}</span><span className="num block text-xs text-[var(--suave)]">{dataBR(l.data)}</span></span>
                    <span className="num shrink-0 text-right text-sm"><b className={entra ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'}>{entra ? '+' : ''}{formatar(l.delta, mc)}</b><span className="block text-xs text-[var(--suave)]">{t('saldo')} {formatar(l.saldo, mc)}</span></span>
                    {tela && <span aria-hidden className="text-[var(--suave)]">›</span>}
                  </>
                )
                return (
                  <li key={l.id}>
                    {tela
                      ? <button type="button" onClick={() => ir(tela, { id: l.origemId })} className="flex w-full items-center gap-3 py-2 text-left hover:bg-[var(--fundo)]">{corpo}</button>
                      : <div className="flex items-center gap-3 py-2">{corpo}</div>}
                  </li>
                )
              })}
            </ul>
          )}
        </Cartao>
      )}

      {dados.cabeloColocado.length > 0 && (
        <Cartao titulo={`💇 ${t('Cabelo que colocou')} · ${dados.cabeloColocado.length}`}>
          <ul className="divide-y divide-[var(--borda)]">
            {dados.cabeloColocado.map((c, i) => {
              const corpo = <><span className="num w-24 shrink-0 text-xs text-[var(--suave)]">{dataBR(c.data)}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.lote}</span><b className="num shrink-0 text-sm">{gramasTexto(c.gramas)}</b></>
              return <li key={i}>{c.loteId ? <button type="button" className="flex w-full items-center gap-2 py-2 text-left hover:bg-[var(--fundo)]" onClick={() => ir('lote', { id: c.loteId })}>{corpo}<span aria-hidden className="text-[var(--suave)]">›</span></button> : <div className="flex items-center gap-2 py-2">{corpo}</div>}</li>
            })}
          </ul>
        </Cartao>
      )}
      {dados.emprestimos.length > 0 && (
        <Cartao titulo={`🤝 ${t('Empréstimos')} · ${dados.emprestimos.length}`}>
          <ul className="divide-y divide-[var(--borda)]">
            {dados.emprestimos.map((e) => (
              <li key={e.id}>
                <button type="button" className="flex w-full items-center gap-3 py-2 text-left hover:bg-[var(--fundo)]" onClick={() => ir('emprestimo', { id: e.id })}>
                  <span className="min-w-0 flex-1 text-sm"><b className="block">{t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} {formatar(e.principal, e.moeda)}</b><span className="num block text-xs text-[var(--suave)]">{t('falta')} {formatar(e.saldo, e.moeda)}</span></span>
                  <Pilula tom={e.status === 'atrasada' ? 'ruim' : e.status === 'quitado' ? 'bom' : 'marca'}>{t(e.status)}</Pilula>
                  <span aria-hidden className="text-[var(--suave)]">›</span>
                </button>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
      <AdiantamentosDaPessoa pessoaId={p.id} />

      <Cartao titulo={`🕘 ${t('Tudo o que aconteceu')}`}>
        {!dados.timeline.length ? <Vazio compacto texto="Nada ainda." /> : (
          <ul className="divide-y divide-[var(--borda)]">
            {dados.timeline.slice(0, 50).map((e) => (
              <li key={e.id + e.tipo}>
                <button type="button" className="flex w-full items-center gap-3 py-2 text-left hover:bg-[var(--fundo)]" onClick={() => ir(e.tipo === 'compra' ? 'pedido' : e.tipo === 'venda' ? 'venda' : 'emprestimo', { id: e.id })}>
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fundo)] text-base">{ICONE_EVENTO[e.tipo] ?? '•'}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold">{e.tipo === 'emprestimo' ? t(e.texto) : e.texto || t(e.tipo === 'compra' ? 'Comprei dela' : 'Venda/atendimento')}</span>
                    <span className="num block text-xs text-[var(--suave)]">{dataBR(e.data)} · {t(e.tipo === 'compra' ? 'Comprei dela' : e.tipo === 'venda' ? 'Venda/atendimento' : 'Empréstimo')}</span>
                  </span>
                  <span className="shrink-0 text-right"><b className="num block text-sm">{formatar(e.valor, m)}</b><Pilula pequena>{t(nomeEtapa(e.tipo, e.etapa))}</Pilula></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {admin && <Cartao titulo={`📜 ${t('Linha do tempo (log)')}`}><LinhaDoTempo id={p.id} /></Cartao>}
      {acerto && <Acerto pessoaId={p.id} direcao={acerto} onFechar={() => setAcerto(undefined)} />}
    </div>
  )
}

/** um grupo de números com título ("👤 Como cliente") */
function Grupo({ titulo, icone, children }: { titulo: string; icone: string; children: import('react').ReactNode }) {
  const t = useT()
  return (
    <section aria-label={t(titulo)}>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--suave)]"><span aria-hidden>{icone}</span>{t(titulo)}</h2>
      {children}
    </section>
  )
}

function Acerto({ pessoaId, direcao, onFechar }: { pessoaId: Id; direcao: 'recebi' | 'paguei'; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? moedaPadrao()
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState<number>()
  const [adiantamento, setAdiantamento] = useState(false)
  const [desc, setDesc] = useState('')
  const sujo = valor !== undefined || !!desc.trim()
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  return (
    <Janela aberta titulo={t(direcao === 'recebi' ? 'Recebi da pessoa' : 'Paguei à pessoa')} onFechar={fechar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('registrarAcerto', { id, pessoaId, direcao, adiantamento, valor: valor!, moeda, forma, descricao: desc }, t('Registrado na conta e no caixa.'))) && onFechar()}>{t('Registrar')}</Botao>}>
      <div className="space-y-3">
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma('dinheiro'))} opcoes={(cfg?.moedasAtivas ?? []).map((x) => ({ id: x, nome: x }))} />
          <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
        </div>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formasEmUso(cfg?.formas, moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={adiantamento} onChange={(e) => setAdiantamento(e.target.checked)} /> {t('É adiantamento (antes da mercadoria/serviço)')}</label>
        <Campo rotulo="Descrição"><Entrada value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
