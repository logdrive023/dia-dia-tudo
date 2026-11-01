// PESSOAS E CONTAS: clientes, fornecedores, equipe… e a conta corrente de cada um (quem me deve, a quem devo:
// fiado, adiantamento, "falta"). Ficha 360° com tudo o que a pessoa fez e linha do tempo.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id, Papel } from '../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, gramasTexto, ErroTela } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'

const PAPEIS: Papel[] = ['cliente', 'fornecedor', 'funcionario', 'profissional', 'devedor', 'credor', 'socio']

export function Pessoas() {
  const t = useT()
  const { ir, sessao } = useApp()
  const [aba, setAba] = useState<'contas' | 'todas'>(sessao.perfil === 'admin' ? 'contas' : 'todas')
  const [busca, setBusca] = useState('')
  const [papel, setPapel] = useState('')
  const [nova, setNova] = useState(false)
  const { dados: pessoas } = useConsulta('pessoas', { papel: (papel || undefined) as Papel | undefined, busca })
  const { dados: contas } = useConsulta('contas', { somenteAbertas: true }, sessao.perfil === 'admin')
  const { cfg } = useCotacoes()
  const m = cfg?.moedaPrincipal ?? 'BOB'
  const lista = (pessoas ?? []).filter((p) => sessao.perfil === 'admin' || !p.localId || p.localId === sessao.localId)
  return (
    <div>
      <Titulo acao={<Botao onClick={() => setNova(true)}>+ {t('Pessoa')}</Botao>}>{t('Pessoas e contas')}</Titulo>
      {sessao.perfil === 'admin' && <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'contas', nome: 'Quem deve / a quem devo' }, { id: 'todas', nome: 'Todas as pessoas' }]} />}
      {aba === 'contas' && contas ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Cartao><div className="text-xs text-[var(--suave)]">{t('Me devem')}</div><div className="num text-xl font-bold text-[var(--bom)]">{formatar(contas.aReceber, m)}</div></Cartao>
            <Cartao><div className="text-xs text-[var(--suave)]">{t('Eu devo')}</div><div className="num text-xl font-bold text-[var(--ruim)]">{formatar(contas.aPagar, m)}</div></Cartao>
          </div>
          {!contas.lista.length ? <Vazio texto="Todas as contas estão em dia." /> : (
            <ul className="divide-y divide-[var(--borda)] rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
              {contas.lista.map((c) => (
                <li key={c.pessoaId}>
                  <button type="button" onClick={() => ir('pessoa', { id: c.pessoaId })} className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-[var(--marca-suave)]">
                    <div><b>{c.nome}</b><div className="text-xs text-[var(--suave)]">{t('último movimento')} {dataBR(c.ultimo)}</div></div>
                    <div className="text-right">
                      <div className={cx('num font-bold', c.saldo > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{formatar(Math.abs(c.saldo), m)}</div>
                      <div className="text-xs text-[var(--suave)]">{t(c.saldo > 0 ? 'me deve' : 'eu devo')}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Entrada className="w-auto flex-1" placeholder={t('Buscar nome ou telefone')} value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Selecao className="w-auto" valor={papel} onChange={setPapel} vazio="Todos" opcoes={PAPEIS.map((p) => ({ id: p, nome: t(p) }))} />
          </div>
          {!pessoas ? <Carregando /> : (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => ir('pessoa', { id: p.id })} className="w-full rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]">
                    <b>{p.nome}</b>
                    <div className="mt-1 flex flex-wrap gap-1">{p.papeis.map((x) => <Pilula key={x}>{t(x)}</Pilula>)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {nova && <EditarPessoa onFechar={() => setNova(false)} />}
    </div>
  )
}

export function EditarPessoa({ id, onFechar }: { id?: Id; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const p = pessoas?.find((x) => x.id === id)
  const [d, setD] = useState({ nome: p?.nome ?? '', telefone: p?.telefone ?? '', documento: p?.documento ?? '', obs: p?.obs ?? '', papeis: p?.papeis ?? (['cliente'] as Papel[]), localId: p?.localId ?? '' })
  if (id && !p) return null
  return (
    <Janela aberta titulo={t(id ? 'Editar pessoa' : 'Nova pessoa')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('salvarPessoa', { ...p, id: id ?? novoId(), ...d, localId: d.localId || undefined }, t('Salvo.'))) && onFechar()}>{t('Salvar')}</Botao>}>
      <div className="space-y-3">
        <Campo rotulo="Nome"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="WhatsApp"><Entrada inputMode="tel" value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} /></Campo>
        <Campo rotulo="Documento (opcional)"><Entrada value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} /></Campo>
        <Campo rotulo="Unidade onde costuma ser atendida"><Selecao valor={d.localId} onChange={(v) => setD({ ...d, localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
        <div>
          <span className="mb-1 block text-sm font-semibold text-[var(--suave)]">{t('Papéis')}</span>
          <div className="flex flex-wrap gap-1">
            {PAPEIS.map((x) => (
              <button key={x} type="button" onClick={() => setD({ ...d, papeis: d.papeis.includes(x) ? d.papeis.filter((y) => y !== x) : [...d.papeis, x] })} className={cx('rounded-full px-3 py-1 text-sm font-semibold', d.papeis.includes(x) ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>{t(x)}</button>
            ))}
          </div>
        </div>
        <Campo rotulo="Observação"><Entrada value={d.obs} onChange={(e) => setD({ ...d, obs: e.target.value })} /></Campo>
      </div>
    </Janela>
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
  const { cfg } = useCotacoes()
  const m = cfg?.moedaPrincipal ?? 'BOB'
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const p = dados.pessoa
  return (
    <div className="space-y-4">
      <Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao>
      <Titulo subtitulo={<span className="flex flex-wrap gap-1">{p.papeis.map((x) => <Pilula key={x}>{t(x)}</Pilula>)} {p.telefone && <a className="underline" href={linkWhatsApp('', p.telefone)} target="_blank" rel="noreferrer">{p.telefone}</a>}</span>} acao={<Botao variante="secundario" onClick={() => setEditar(true)}>{t('Editar')}</Botao>}>{p.nome}</Titulo>
      {conta && sessao.perfil === 'admin' && (
        <Cartao titulo={t('Conta corrente')} ajuda="+ = a pessoa me deve; − = eu devo a ela. Vendas fiado, compras não pagas, adiantamentos e acertos entram aqui." acao={
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setAcerto('recebi')}>{t('Recebi')}</Botao>
            <Botao variante="secundario" onClick={() => setAcerto('paguei')}>{t('Paguei / adiantei')}</Botao>
            {conta.saldo > 0 && p.telefone && <a className="min-h-10 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={linkWhatsApp(`${t('Olá')} ${p.nome}! ${t('Seu saldo em aberto é')} ${formatar(conta.saldo, m)}.`, p.telefone)}>{t('Cobrar')}</a>}
          </div>
        }>
          <p className={cx('mb-2 text-lg font-bold', conta.saldo > 0 ? 'text-[var(--bom)]' : conta.saldo < 0 ? 'text-[var(--ruim)]' : '')}>{t(conta.texto.replace(/[\d.,]+/g, (x) => x))}</p>
          <ul className="max-h-72 divide-y divide-[var(--borda)] overflow-y-auto text-sm">
            {conta.linhas.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-1">
                <span>{dataBR(l.data)} · {l.descricao}</span>
                <span className="num shrink-0 text-right"><span className={l.delta > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'}>{l.delta > 0 ? '+' : ''}{formatar(l.delta, m)}</span><br /><span className="text-xs text-[var(--suave)]">{t('saldo')} {formatar(l.saldo, m)}</span></span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ['Total gasto', formatar(dados.totalGasto, m)],
          ['Visitas / compras', String(dados.visitas)],
          ['Ticket médio', formatar(dados.ticketMedio, m)],
          ['Última vez', dataBR(dados.ultimaVisita) || '—'],
          ['Vendeu para mim', formatar(dados.comprasDela, m)],
          ['Gramas que me vendeu', gramasTexto(dados.gramasVendidas)],
          ['Atendimentos feitos', String(dados.atendimentosFeitos)],
          ['Comissão', formatar(dados.comissao, m)],
        ].map(([n, v]) => <Cartao key={n}><div className="text-xs text-[var(--suave)]">{t(n)}</div><div className="num font-bold">{v}</div></Cartao>)}
      </div>
      {dados.cabeloColocado.length > 0 && (
        <Cartao titulo={t('Cabelo que colocou')}>
          <ul className="text-sm">{dados.cabeloColocado.map((c, i) => <li key={i}><button type="button" className="underline" onClick={() => c.loteId && ir('lote', { id: c.loteId })}>{dataBR(c.data)} · {c.lote}</button> · {gramasTexto(c.gramas)}</li>)}</ul>
        </Cartao>
      )}
      {dados.emprestimos.length > 0 && (
        <Cartao titulo={t('Empréstimos')}>
          <ul className="text-sm">{dados.emprestimos.map((e) => <li key={e.id}><button type="button" className="underline" onClick={() => ir('emprestimo', { id: e.id })}>{t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} {formatar(e.principal, e.moeda)}</button> · {t('falta')} {formatar(e.saldo, e.moeda)} · <Pilula tom={e.status === 'atrasada' ? 'ruim' : e.status === 'quitado' ? 'bom' : 'marca'}>{t(e.status)}</Pilula></li>)}</ul>
        </Cartao>
      )}
      <Cartao titulo={t('Tudo o que aconteceu')}>
        <ul className="divide-y divide-[var(--borda)] text-sm">
          {dados.timeline.slice(0, 50).map((e) => (
            <li key={e.id + e.tipo} className="flex justify-between gap-2 py-2">
              <button type="button" className="text-left underline" onClick={() => ir(e.tipo === 'compra' ? 'pedido' : e.tipo === 'venda' ? 'venda' : 'emprestimo', { id: e.id })}>
                {dataBR(e.data)} · {t(e.tipo === 'compra' ? 'Comprei dela' : e.tipo === 'venda' ? 'Venda/atendimento' : 'Empréstimo')}: {e.texto}
              </button>
              <span className="num shrink-0">{formatar(e.valor, m)} <Pilula>{t(e.etapa)}</Pilula></span>
            </li>
          ))}
        </ul>
      </Cartao>
      <Cartao titulo={t('Linha do tempo (log)')}><LinhaDoTempo id={p.id} /></Cartao>
      {acerto && <Acerto pessoaId={p.id} direcao={acerto} onFechar={() => setAcerto(undefined)} />}
      {editar && <EditarPessoa id={p.id} onFechar={() => setEditar(false)} />}
    </div>
  )
}

function Acerto({ pessoaId, direcao, onFechar }: { pessoaId: Id; direcao: 'recebi' | 'paguei'; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? 'BOB'
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState<number>()
  const [adiantamento, setAdiantamento] = useState(false)
  const [desc, setDesc] = useState('')
  return (
    <Janela aberta titulo={t(direcao === 'recebi' ? 'Recebi da pessoa' : 'Paguei à pessoa')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('registrarAcerto', { id, pessoaId, direcao, adiantamento, valor: valor!, moeda, forma, descricao: desc }, t('Registrado na conta e no caixa.'))) && onFechar()}>{t('Registrar')}</Botao>}>
      <div className="space-y-3">
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Selecao valor={moeda} onChange={(v) => (setMoeda(v), setForma('dinheiro'))} opcoes={(cfg?.moedasAtivas ?? []).map((x) => ({ id: x, nome: x }))} />
          <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
        </div>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={adiantamento} onChange={(e) => setAdiantamento(e.target.checked)} /> {t('É adiantamento (antes da mercadoria/serviço)')}</label>
        <Campo rotulo="Descrição"><Entrada value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
