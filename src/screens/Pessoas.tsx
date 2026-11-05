// PESSOAS E CONTAS: clientes, fornecedores, equipe… e a conta corrente de cada um (quem me deve, a quem devo:
// fiado, adiantamento, "falta"). Ficha 360° com tudo o que a pessoa fez e linha do tempo.

import { useState } from 'react'
import { CadastroPessoa } from './cadastros/CadastroPessoa'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id, Papel } from '../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, CartaoNumero, Entrada, Janela, Pagina, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, gramasTexto, ErroTela, moedaPadrao } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { AdiantamentosDaPessoa } from '../ui/financiamento'
import { useT } from '../ui/i18n'
import { Etiqueta, NOME_ETAPA } from './Vendas'

const PAPEIS: Papel[] = ['cliente', 'fornecedor', 'funcionario', 'profissional', 'devedor', 'credor', 'socio']
const SITUACAO_EMPRESTIMO: Record<string, string> = { aberto: 'Em aberto', quitado: 'Quitado', cancelado: 'Cancelado' }

export function Pessoas() {
  const t = useT()
  const { ir, sessao } = useApp()
  const [aba, setAba] = useParamTela<'contas' | 'todas'>('aba', sessao.perfil === 'admin' ? 'contas' : 'todas')
  const [busca, setBusca] = useParamTela('busca', '')
  const [papel, setPapel] = useParamTela('papel', '')
  const [lado, setLado] = useParamTela<'' | 'receber' | 'pagar'>('lado', '')
  const [nova, setNova] = useState(false)
  const { dados: pessoas } = useConsulta('pessoas', { papel: (papel || undefined) as Papel | undefined, busca })
  const { dados: contas } = useConsulta('contas', { somenteAbertas: true }, sessao.perfil === 'admin')
  const { cfg } = useCotacoes()
  const m = cfg?.moedaPrincipal ?? moedaPadrao()
  const lista = (pessoas ?? []).filter((p) => sessao.perfil === 'admin' || !p.localId || p.localId === sessao.localId)
  const doLado = (contas?.lista ?? []).filter((c) => !lado || (lado === 'receber' ? c.saldo > 0 : c.saldo < 0))
  return (
    <div>
      <Titulo acao={<Botao onClick={() => setNova(true)}>+ {t('Pessoa')}</Botao>}>{t('Pessoas e contas')}</Titulo>
      {sessao.perfil === 'admin' && <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'contas', nome: 'Quem deve / a quem devo' }, { id: 'todas', nome: 'Todas as pessoas' }]} />}
      {aba === 'contas' && sessao.perfil === 'admin' ? (
        !contas ? <Carregando /> : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <CartaoNumero c={{ id: 'receber', nome: 'Me devem', valor: contas.aReceber, formato: 'dinheiro', moeda: m, ajuda: 'Soma do que as pessoas me devem. Toque para ver quem.' }} onClick={() => setLado(lado === 'receber' ? '' : 'receber')} />
              <CartaoNumero c={{ id: 'pagar', nome: 'Eu devo', valor: contas.aPagar, formato: 'dinheiro', moeda: m, destaque: contas.aPagar ? 'ruim' : undefined, ajuda: 'Soma do que eu devo às pessoas. Toque para ver a quem.' }} onClick={() => setLado(lado === 'pagar' ? '' : 'pagar')} />
            </div>
            {lado && <div className="mb-3"><Etiqueta texto={t(lado === 'receber' ? 'Me devem' : 'Eu devo')} onTirar={() => setLado('')} /></div>}
            {!doLado.length ? <Vazio texto="Todas as contas estão em dia." /> : (
              <ul className="divide-y divide-[var(--borda)] rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
                {doLado.map((c) => (
                  <li key={c.pessoaId}>
                    <button type="button" onClick={() => ir('pessoa', { id: c.pessoaId })} className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-[var(--marca-suave)]">
                      <div className="min-w-0"><b className="break-words">{c.nome}</b><div className="text-xs text-[var(--suave)]">{t('último movimento')} {dataBR(c.ultimo)}</div></div>
                      <div className="shrink-0 text-right">
                        <div className={cx('num font-bold', c.saldo > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{formatar(Math.abs(c.saldo), m)}</div>
                        <div className="text-xs text-[var(--suave)]">{t(c.saldo > 0 ? 'me deve' : 'eu devo')}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Entrada className="w-auto min-w-0 flex-1" placeholder={t('Buscar nome ou telefone')} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Selecao className="w-auto max-w-full" valor={papel} onChange={setPapel} vazio="Todos" opcoes={PAPEIS.map((p) => ({ id: p, nome: t(p) }))} />
          </div>
          {!pessoas ? <Carregando /> : !lista.length ? (
            <Vazio texto={busca || papel ? 'Ninguém encontrado com essa busca.' : 'Nenhuma pessoa cadastrada ainda.'}>
              <Botao variante="secundario" onClick={() => (busca || papel ? (setBusca(''), setPapel('')) : setNova(true))}>{busca || papel ? t('Limpar busca') : `+ ${t('Pessoa')}`}</Botao>
            </Vazio>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => ir('pessoa', { id: p.id })} className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]">
                    <b className="break-words">{p.nome}</b>
                    <div className="mt-1 flex flex-wrap gap-1">{p.papeis.map((x) => <Pilula key={x}>{t(x)}</Pilula>)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {nova && <CadastroPessoa onFechar={() => setNova(false)} />}
    </div>
  )
}

/** Ficha 360°: compras, vendas, atendimentos, cabelo colocado, empréstimos, conta corrente e linha do tempo. */
export function FichaPessoa() {
  const t = useT()
  const { nav, voltar, ir, sessao } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('fichaPessoa', { id })
  const { dados: conta } = useConsulta('contaPessoa', { pessoaId: id }, sessao.perfil === 'admin')
  const [acerto, setAcerto] = useState<'recebi' | 'paguei'>()
  const [editar, setEditar] = useState(false)
  const { dados: conf } = useConsulta('configuracoes', {})
  const cfg = conf?.config
  const m = cfg?.moedaPrincipal ?? moedaPadrao()
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const p = dados.pessoa
  const mc = conta?.moeda ?? m
  // linha da conta → venda ou compra de origem (o "pago na hora" aponta para a mesma venda)
  const origem = new Map<string, string>()
  for (const l of conta?.linhas ?? []) if (l.origemId && (l.tipo === 'venda' || l.tipo === 'compra')) origem.set(l.origemId, l.tipo === 'venda' ? 'venda' : 'pedido')
  const textoConta = !conta ? '' : conta.saldo > 0 ? t('{nome} me deve {v}', { nome: p.nome, v: formatar(conta.saldo, mc) }) : conta.saldo < 0 ? t('Eu devo {v} a {nome}', { nome: p.nome, v: formatar(-conta.saldo, mc) }) : t('Conta em dia')
  const nomeEtapa = (tipo: string, etapa: string) => tipo === 'emprestimo' ? SITUACAO_EMPRESTIMO[etapa] ?? etapa : NOME_ETAPA[etapa] ?? conf?.modulos.flatMap((x) => x.etapas).find((e) => e.id === etapa)?.nome ?? etapa
  const numeros: [string, string, (() => void) | undefined][] = [
    ['Total gasto', formatar(dados.totalGasto, m), () => ir('vendas', { pessoaId: p.id })],
    ['Visitas / compras', String(dados.visitas), () => ir('vendas', { pessoaId: p.id })],
    ['Ticket médio', formatar(dados.ticketMedio, m), () => ir('vendas', { pessoaId: p.id })],
    ['Última vez', dataBR(dados.ultimaVisita) || '—', dados.ultimaVisita ? () => ir('vendas', { pessoaId: p.id, de: dados.ultimaVisita!.slice(0, 10), ate: dados.ultimaVisita!.slice(0, 10) }) : undefined],
    ['Vendeu para mim', formatar(dados.comprasDela, m), () => ir('comprar', { aba: 'todas', busca: p.nome })],
    ['Gramas que me vendeu', gramasTexto(dados.gramasVendidas), () => ir('comprar', { aba: 'todas', busca: p.nome })],
    ['Atendimentos feitos', String(dados.atendimentosFeitos), () => ir('vendas', { profissionalId: p.id })],
    ['Comissão', formatar(dados.comissao, m), () => ir('equipe', { aba: 'comissoes', pessoaId: p.id })],
  ]
  return (
    <Pagina onVoltar={voltar} titulo={p.nome} subtitulo={<span className="flex flex-wrap items-center gap-1">{p.papeis.map((x) => <Pilula key={x}>{t(x)}</Pilula>)} {p.telefone && <a className="inline-flex min-h-10 items-center underline" href={linkWhatsApp('', p.telefone)} target="_blank" rel="noreferrer">{p.telefone}</a>}</span>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><Botao variante="secundario" onClick={() => setEditar(true)}>{t('Editar')}</Botao></div>
        {conta && sessao.perfil === 'admin' && (
          <Cartao titulo={t('Conta corrente')} ajuda="+ = a pessoa me deve; − = eu devo a ela. Vendas fiado, compras não pagas, adiantamentos e acertos entram aqui." acao={
            <div className="flex flex-wrap gap-2">
              <Botao onClick={() => setAcerto('recebi')}>{t('Recebi')}</Botao>
              <Botao variante="secundario" onClick={() => setAcerto('paguei')}>{t('Paguei / adiantei')}</Botao>
              {conta.saldo > 0 && p.telefone && <a className="min-h-10 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={linkWhatsApp(`${t('Olá')} ${p.nome}! ${t('Seu saldo em aberto é')} ${formatar(conta.saldo, mc)}.`, p.telefone)}>{t('Cobrar')}</a>}
            </div>
          }>
            <p className={cx('mb-2 text-lg font-bold', conta.saldo > 0 ? 'text-[var(--bom)]' : conta.saldo < 0 ? 'text-[var(--ruim)]' : '')}>{textoConta}</p>
            <ul className="max-h-72 divide-y divide-[var(--borda)] overflow-y-auto text-sm">
              {conta.linhas.map((l) => {
                const tela = l.origemId ? origem.get(l.origemId) : undefined
                const corpo = (
                  <>
                    <span className="min-w-0 break-words">{dataBR(l.data)} · {l.descricao}</span>
                    <span className="num shrink-0 text-right"><span className={l.delta > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'}>{l.delta > 0 ? '+' : ''}{formatar(l.delta, mc)}</span><br /><span className="text-xs text-[var(--suave)]">{t('saldo')} {formatar(l.saldo, mc)}</span></span>
                  </>
                )
                return (
                  <li key={l.id}>
                    {tela ? (
                      <button type="button" onClick={() => ir(tela, { id: l.origemId })} className="flex min-h-10 w-full justify-between gap-2 py-1 text-left hover:bg-[var(--marca-suave)]">{corpo}</button>
                    ) : (
                      <div className="flex justify-between gap-2 py-1">{corpo}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Cartao>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {numeros.map(([n, v, abrir]) => {
            const dentro = <><div className="text-xs text-[var(--suave)]">{t(n)}</div><div className="num break-words font-bold">{v}</div></>
            return abrir ? (
              <button key={n} type="button" onClick={abrir} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-left shadow-sm hover:border-[var(--marca)]">{dentro}</button>
            ) : (
              <Cartao key={n}>{dentro}</Cartao>
            )
          })}
        </div>
        {dados.cabeloColocado.length > 0 && (
          <Cartao titulo={t('Cabelo que colocou')}>
            <ul className="text-sm">{dados.cabeloColocado.map((c, i) => <li key={i}>{c.loteId ? <button type="button" className="min-h-10 text-left underline" onClick={() => ir('lote', { id: c.loteId })}>{dataBR(c.data)} · {c.lote}</button> : <span>{dataBR(c.data)} · {c.lote}</span>} · {gramasTexto(c.gramas)}</li>)}</ul>
          </Cartao>
        )}
        {dados.emprestimos.length > 0 && (
          <Cartao titulo={t('Empréstimos')}>
            <ul className="text-sm">{dados.emprestimos.map((e) => <li key={e.id}><button type="button" className="min-h-10 text-left underline" onClick={() => ir('emprestimo', { id: e.id })}>{t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} {formatar(e.principal, e.moeda)}</button> · {t('falta')} {formatar(e.saldo, e.moeda)} · <Pilula tom={e.status === 'atrasada' ? 'ruim' : e.status === 'quitado' ? 'bom' : 'marca'}>{t(e.status)}</Pilula></li>)}</ul>
          </Cartao>
        )}
        <AdiantamentosDaPessoa pessoaId={p.id} />
        <Cartao titulo={t('Tudo o que aconteceu')}>
          {!dados.timeline.length ? <Vazio texto="Nada ainda." /> : (
            <ul className="divide-y divide-[var(--borda)] text-sm">
              {dados.timeline.slice(0, 50).map((e) => (
                <li key={e.id + e.tipo} className="flex flex-wrap justify-between gap-2 py-2">
                  <button type="button" className="min-h-10 min-w-0 text-left underline" onClick={() => ir(e.tipo === 'compra' ? 'pedido' : e.tipo === 'venda' ? 'venda' : 'emprestimo', { id: e.id })}>
                    {dataBR(e.data)} · {t(e.tipo === 'compra' ? 'Comprei dela' : e.tipo === 'venda' ? 'Venda/atendimento' : 'Empréstimo')}: {e.tipo === 'emprestimo' ? t(e.texto) : e.texto}
                  </button>
                  <span className="num shrink-0">{formatar(e.valor, m)} <Pilula>{t(nomeEtapa(e.tipo, e.etapa))}</Pilula></span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo={t('Linha do tempo (log)')}><LinhaDoTempo id={p.id} /></Cartao>
      </div>
      {acerto && <Acerto pessoaId={p.id} direcao={acerto} onFechar={() => setAcerto(undefined)} />}
      {editar && <CadastroPessoa id={p.id} onFechar={() => setEditar(false)} />}
    </Pagina>
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
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={adiantamento} onChange={(e) => setAdiantamento(e.target.checked)} /> {t('É adiantamento (antes da mercadoria/serviço)')}</label>
        <Campo rotulo="Descrição"><Entrada value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
