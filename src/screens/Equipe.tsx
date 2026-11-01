// EQUIPE E UNIDADES: organograma por salão (toque na pessoa → resumo rápido), cadastro simples de funcionário
// (salário por mês, semana ou dia) e a "ponta do lápis" de cada unidade: entradas × saídas = margem.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id, Pessoa } from '../core/domain/tipos'
import type { NoOrganograma } from '../core/services/equipe'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Info, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { SeletorPeriodo, useLembrado, usePeriodo } from '../ui/filtros'
import { useT } from '../ui/i18n'

const PERIODOS = { mes: 'por mês', semana: 'por semana', dia: 'por dia' } as const

export function Equipe() {
  const t = useT()
  const { sessao } = useApp()
  const [aba, setAba] = useLembrado<'organograma' | 'unidades' | 'comissoes'>('equipe.aba', 'organograma')
  const [periodo, setPeriodo] = usePeriodo('equipe.periodo', 'mes')
  const [localId, setLocalId] = useLembrado<string>('equipe.local', '')
  const [resumo, setResumo] = useState<Id>()
  const [editar, setEditar] = useState<Pessoa | 'novo'>()
  const { dados: locais } = useConsulta('locais', {})
  const { dados: org } = useConsulta('organograma', { localId: localId || undefined, de: periodo.de, ate: periodo.ate })
  return (
    <div>
      <Titulo acao={sessao.perfil === 'admin' && <Botao onClick={() => setEditar('novo')}>+ {t('Funcionário')}</Botao>}>{t('Equipe e unidades')}</Titulo>
      <div className="mb-3 flex flex-wrap gap-2">
        <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
        {sessao.perfil === 'admin' && <Selecao className="w-auto" valor={localId} onChange={setLocalId} vazio="Todas as unidades" opcoes={(locais ?? []).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome }))} />}
      </div>
      <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'organograma', nome: 'Organograma' }, { id: 'comissoes', nome: 'Comissões' }, { id: 'unidades', nome: 'Entradas × saídas por unidade' }]} />
      {aba === 'organograma' ? (
        !org ? <Carregando /> : !org.raizes.length ? <Vazio texto="Ninguém na equipe desta unidade ainda." /> : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4">
            <div className="flex min-w-max justify-center gap-6">
              {org.raizes.map((n) => <NoArvore key={n.pessoa.id} n={n} nivel={0} onClick={setResumo} />)}
            </div>
          </div>
        )
      ) : aba === 'comissoes' ? (
        <Comissoes de={periodo.de} ate={periodo.ate} />
      ) : (
        <Unidades de={periodo.de} ate={periodo.ate} />
      )}
      {resumo && <Resumo id={resumo} de={periodo.de} ate={periodo.ate} onFechar={() => setResumo(undefined)} onEditar={(p) => (setResumo(undefined), setEditar(p))} />}
      {editar && <EditarFuncionario pessoa={editar === 'novo' ? undefined : editar} localPadrao={localId} onFechar={() => setEditar(undefined)} />}
    </div>
  )
}

const CORES_NIVEL = ['bg-[#1f2937] text-white', 'bg-[#94a3b8] text-white', 'bg-[var(--marca)] text-white', 'bg-[var(--marca-suave)] text-[var(--marca)]']

function NoArvore({ n, nivel, onClick }: { n: NoOrganograma; nivel: number; onClick(id: Id): void }) {
  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={() => onClick(n.pessoa.id)} className={cx('w-40 rounded-2xl p-3 text-center shadow-sm transition hover:scale-105', CORES_NIVEL[Math.min(nivel, 3)])}>
        <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-lg font-bold">{n.pessoa.nome.slice(0, 1)}</div>
        <div className="font-bold">{n.pessoa.nome}</div>
        <div className="text-xs opacity-90">{n.pessoa.cargo ?? ''}</div>
        <div className="mt-1 text-xs opacity-90">{n.atendimentos} atend.</div>
      </button>
      {n.subordinados.length > 0 && (
        <>
          <div className="h-5 w-0.5 bg-[var(--borda)]" />
          <div className="relative flex gap-4 border-t-2 border-[var(--borda)] pt-5">
            {n.subordinados.map((s) => <NoArvore key={s.pessoa.id} n={s} nivel={nivel + 1} onClick={onClick} />)}
          </div>
        </>
      )}
    </div>
  )
}

function Resumo({ id, de, ate, onFechar, onEditar }: { id: Id; de: string; ate: string; onFechar(): void; onEditar(p: Pessoa): void }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const { dados } = useConsulta('resumoFuncionario', { id, de, ate })
  const [pagar, setPagar] = useState(false)
  if (!dados) return null
  const p = dados.pessoa
  const moeda = 'BOB'
  return (
    <Janela aberta titulo={p.nome} onFechar={onFechar}>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-[var(--suave)]">{t('Cargo')}</dt><dd className="font-semibold">{p.cargo ?? '—'}</dd>
        <dt className="text-[var(--suave)]">{t('Unidade')}</dt><dd className="font-semibold">{dados.local?.nome ?? '—'}</dd>
        <dt className="text-[var(--suave)]">{t('Responde a')}</dt><dd className="font-semibold">{dados.superior?.nome ?? '—'}</dd>
        <dt className="text-[var(--suave)]">{t('Salário / custo')}</dt><dd className="num font-semibold">{p.salario ? `${formatar(p.salario.valor, p.salario.moeda)} ${t(PERIODOS[p.salario.periodo ?? 'mes'])}` : '—'}<div className="text-xs text-[var(--suave)]">≈ {formatar(dados.salarioPrincipal, moeda)} {t('por mês')}</div></dd>
        <dt className="text-[var(--suave)]">{t('Comissão')}</dt><dd className="font-semibold">{p.comissaoBp ? `${p.comissaoBp / 100}%` : '—'}</dd>
        <dt className="text-[var(--suave)]">{t('Acesso')}</dt><dd><Pilula tom="marca">{t(p.acesso === 'admin' ? 'Administrador' : p.acesso === 'funcionario' ? 'Funcionário' : 'Sem acesso')}</Pilula></dd>
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-bold text-[var(--suave)]">{t('Desempenho no período')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Atendimentos', String(dados.atendimentos)],
          ['Faturamento', formatar(dados.faturamento, moeda)],
          ['Ticket médio', formatar(dados.ticket, moeda)],
          ['Comissão no período', formatar(dados.comissao, moeda)],
          ['Agendados', String(dados.agendados)],
          ['Pago no período', formatar(dados.pagoNoPeriodo, moeda)],
        ].map(([n, v]) => (
          <div key={n} className="rounded-xl bg-[var(--fundo)] p-2"><div className="text-xs text-[var(--suave)]">{t(n)}</div><div className="num font-bold">{v}</div></div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sessao.perfil === 'admin' && <Botao onClick={() => setPagar(true)}>{t('Pagar salário')}</Botao>}
        {sessao.perfil === 'admin' && <Botao variante="secundario" onClick={() => onEditar(p)}>{t('Editar')}</Botao>}
        <Botao variante="leve" onClick={() => ir('relatorios', { relatorio: 'log', usuarioId: p.id })}>{t('O que fez (log)')}</Botao>
      </div>
      {pagar && <PagarSalario pessoa={p} onFechar={() => setPagar(false)} />}
    </Janela>
  )
}

function PagarSalario({ pessoa, onFechar }: { pessoa: Pessoa; onFechar(): void }) {
  const t = useT()
  const { dados: sug } = useConsulta('sugestaoSalario', { pessoaId: pessoa.id })
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState<string>()
  const [ref, setRef] = useState('')
  const v = valor ?? sug?.valor
  const moeda = sug?.moeda ?? pessoa.salario?.moeda ?? 'BOB'
  return (
    <Janela aberta titulo={`${t('Pagar')} · ${pessoa.nome}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !v} onClick={async () => (await executar('pagarSalario', { id, pessoaId: pessoa.id, valor: v!, moeda, forma: forma ?? sug?.forma ?? 'dinheiro', referencia: ref }, t('Pagamento registrado.'))) && onFechar()}>{t('Pagar')}</Botao>}>
      <div className="space-y-3">
        {sug && <p className="rounded-xl bg-[var(--marca-suave)] p-2 text-sm text-[var(--marca)]">⟳ {sug.origem === 'ultimo' ? t('Repetindo o último pagamento ({d}). Mude se precisar.', { d: sug.data?.split('-').reverse().join('/') ?? '' }) : t('Valor do cadastro. Mude se precisar.')}</p>}
        <Campo rotulo="Valor"><ValorInput moeda={moeda} valor={v} onChange={setValor} /></Campo>
        <Campo rotulo="Forma"><Selecao valor={forma ?? sug?.forma ?? 'dinheiro'} onChange={setForma} opcoes={(cfg?.config.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Referência (opcional)"><Entrada value={ref} placeholder={t('Ex.: semana 1 a 7, diária de sábado')} onChange={(e) => setRef(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}

function EditarFuncionario({ pessoa, localPadrao, onFechar }: { pessoa?: Pessoa; localPadrao?: string; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { dados: locais } = useConsulta('locais', {})
  const { dados: todos } = useConsulta('pessoas', { papel: 'funcionario' })
  const [d, setD] = useState({
    id: pessoa?.id ?? novoId(),
    nome: pessoa?.nome ?? '',
    telefone: pessoa?.telefone ?? '',
    cargo: pessoa?.cargo ?? '',
    localId: pessoa?.localId ?? localPadrao ?? '',
    superiorId: pessoa?.superiorId ?? '',
    salario: pessoa?.salario?.valor,
    periodo: pessoa?.salario?.periodo ?? 'mes',
    comissao: pessoa?.comissaoBp ? String(pessoa.comissaoBp / 100) : '',
    atende: pessoa ? pessoa.papeis.includes('profissional') : true,
    acesso: pessoa?.acesso ?? 'funcionario',
  })
  const salvar = async () => {
    const r = await executar('salvarPessoa', {
      id: d.id,
      nome: d.nome,
      telefone: d.telefone,
      papeis: [...new Set([...(pessoa?.papeis ?? []).filter((x) => x !== 'profissional'), 'funcionario', ...(d.atende ? ['profissional' as const] : [])])] as Pessoa['papeis'],
      cargo: d.cargo,
      localId: d.localId || undefined,
      superiorId: d.superiorId || undefined,
      salario: d.salario !== undefined ? { moeda: 'BOB', valor: d.salario, periodo: d.periodo as 'mes' | 'semana' | 'dia' } : undefined,
      comissaoBp: d.comissao ? Math.round(Number(d.comissao.replace(',', '.')) * 100) : undefined,
      acesso: d.acesso as 'admin' | 'funcionario',
    }, t('Salvo.'))
    if (r) onFechar()
  }
  return (
    <Janela aberta titulo={t(pessoa ? 'Editar funcionário' : 'Novo funcionário')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={salvar}>{t('Salvar')}</Botao>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Cargo"><Entrada list="cargos" value={d.cargo} onChange={(e) => setD({ ...d, cargo: e.target.value })} /><datalist id="cargos">{['Diretora geral', 'Gerente', 'Cabeleireira sênior', 'Cabeleireira', 'Manicure', 'Recepção'].map((c) => <option key={c} value={c} />)}</datalist></Campo>
        <Campo rotulo="Unidade"><Selecao valor={d.localId} onChange={(v) => setD({ ...d, localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
        <Campo rotulo="Responde a" ajuda="Monta o organograma."><Selecao valor={d.superiorId} onChange={(v) => setD({ ...d, superiorId: v })} vazio="Ninguém (topo)" opcoes={(todos ?? []).filter((p) => p.id !== d.id).map((p) => ({ id: p.id, nome: `${p.nome}${p.cargo ? ` · ${p.cargo}` : ''}` }))} /></Campo>
        <Campo rotulo="Salário / custo" ajuda="Pode ser por mês, semana ou dia. Serve de estimativa do custo; o pago de verdade fica no caixa."><ValorInput moeda="BOB" valor={d.salario} onChange={(v) => setD({ ...d, salario: v })} /></Campo>
        <Campo rotulo="Período"><Selecao valor={d.periodo} onChange={(v) => setD({ ...d, periodo: v as 'mes' })} opcoes={Object.entries(PERIODOS).map(([id, nome]) => ({ id, nome: t(nome) }))} /></Campo>
        <Campo rotulo="Comissão (%)"><Entrada inputMode="decimal" value={d.comissao} onChange={(e) => setD({ ...d, comissao: e.target.value })} /></Campo>
        <Campo rotulo="WhatsApp"><Entrada value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} /></Campo>
        <Campo rotulo="Acesso ao sistema"><Selecao valor={d.acesso} onChange={(v) => setD({ ...d, acesso: v as 'admin' })} opcoes={[{ id: 'funcionario', nome: t('Funcionário (só a unidade e a própria agenda)') }, { id: 'admin', nome: t('Administrador (tudo)') }]} /></Campo>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" className="h-5 w-5" checked={d.atende} onChange={(e) => setD({ ...d, atende: e.target.checked })} /> {t('Atende clientes (aparece na agenda)')}</label>
      </div>
    </Janela>
  )
}

function Unidades({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados } = useConsulta('unidades', { de, ate })
  if (!dados) return <Carregando />
  const m = dados.moeda
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Salários entram proporcionais aos {n} dias do período (mensal ÷ 30 × dias).', { n: dados.dias })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {dados.lista.filter((u) => u.local.tipo === 'salao' || u.entradas || u.saidas).map((u) => (
          <Cartao key={u.local.id} titulo={u.local.nome} acao={<Pilula tom={u.margem >= 0 ? 'bom' : 'ruim'}>{t('Margem')} {formatar(u.margem, m)}</Pilula>}>
            <table className="w-full text-sm">
              <tbody>
                <tr className="font-semibold text-[var(--bom)]"><td className="py-1">{t('Entradas (atendimentos)')} · {u.atendimentos}</td><td className="num text-right">+{formatar(u.entradas, m)}</td></tr>
                <tr><td className="py-1">− {t('Salários')} ({u.funcionarios} · {formatar(u.salarioMensal, m)}/{t('mês')})</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.salarios, m)}</td></tr>
                <tr><td className="py-1">− {t('Comissões')}</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.comissoes, m)}</td></tr>
                <tr><td className="py-1">− {t('Cabelo usado')}</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.custoCabelo, m)}</td></tr>
                <tr><td className="py-1">− {t('Despesas da unidade')}</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.despesas, m)}</td></tr>
                <tr className="border-t-2 border-[var(--texto)] text-base font-bold"><td className="py-1">= {t('Margem')}</td><td className={cx('num text-right', u.margem < 0 && 'text-[var(--ruim)]')}>{formatar(u.margem, m)}</td></tr>
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              <Pilula>{t('Agendados')}: {u.agendados}</Pilula>
              <Pilula>{t('Clientes')}: {u.clientes}</Pilula>
              <Pilula>{t('Salários pagos no período')}: {formatar(u.salariosPagos, m)}</Pilula>
            </div>
            {u.entradas + u.saidas > 0 && (
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--fundo)]" title={t('Entradas × saídas')}>
                <div className="bg-[var(--bom)]" style={{ width: `${(u.entradas / Math.max(u.entradas, u.saidas)) * 50}%` }} />
                <div className="bg-[var(--ruim)]" style={{ width: `${(u.saidas / Math.max(u.entradas, u.saidas)) * 50}%` }} />
              </div>
            )}
          </Cartao>
        ))}
      </div>
      <Cartao titulo={t('Todas as unidades')}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-xs text-[var(--suave)]">{t('Entradas')}</div><div className="num font-bold text-[var(--bom)]">{formatar(dados.total.entradas, m)}</div></div>
          <div><div className="text-xs text-[var(--suave)]">{t('Saídas')}</div><div className="num font-bold text-[var(--ruim)]">{formatar(dados.total.saidas, m)}</div></div>
          <div><div className="text-xs text-[var(--suave)]">{t('Margem')}</div><div className="num font-bold">{formatar(dados.total.margem, m)}</div></div>
        </div>
      </Cartao>
    </div>
  )
}

/**
 * Comissões dos dois jeitos: o HISTÓRICO do que cada uma ganhou (venda a venda, muda se a venda for corrigida)
 * e os PAGAMENTOS lançados no caixa. A pagar = ganho − pago.
 */
function Comissoes({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const [pessoaId, setPessoaId] = useState<string>()
  const { dados } = useConsulta('comissoes', { de, ate, pessoaId })
  const [pagar, setPagar] = useState<{ id: string; nome: string; aPagar: number }>()
  if (!dados) return <Carregando />
  const m = dados.moeda
  return (
    <div className="space-y-4">
      <Cartao titulo={`${t('A pagar (todas)')}: ${formatar(dados.aPagar, m)}`} ajuda="Ganho = soma das comissões das vendas (desde sempre). Pago = pagamentos de comissão lançados. Ex.: ganhou Bs 1.200, já recebeu Bs 800 → a pagar Bs 400.">
        {!dados.porPessoa.length ? <Vazio texto="Nenhuma comissão ainda." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-[var(--suave)]"><th className="py-1">{t('Profissional')}</th><th className="text-right">{t('Atendimentos')}</th><th className="text-right">{t('Ganhou no período')}</th><th className="text-right">{t('Pago no período')}</th><th className="text-right">{t('A pagar')}</th><th /></tr></thead>
              <tbody>
                {dados.porPessoa.map((x) => (
                  <tr key={x.pessoaId} className={cx('border-t border-[var(--borda)]', pessoaId === x.pessoaId && 'bg-[var(--marca-suave)]')}>
                    <td className="py-2"><button type="button" className="font-semibold underline" onClick={() => setPessoaId(pessoaId === x.pessoaId ? undefined : x.pessoaId)}>{x.nome}</button></td>
                    <td className="num text-right">{x.atendimentos}</td>
                    <td className="num text-right">{formatar(x.ganhoPeriodo, m)}</td>
                    <td className="num text-right">{formatar(x.pagoPeriodo, m)}</td>
                    <td className={cx('num text-right font-bold', x.aPagar > 0 && 'text-[var(--alerta)]')}>{formatar(x.aPagar, m)}</td>
                    <td className="text-right">{sessao.perfil === 'admin' && x.aPagar > 0 && <Botao variante="secundario" onClick={() => setPagar({ id: x.pessoaId, nome: x.nome, aPagar: x.aPagar })}>{t('Pagar')}</Botao>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      <Cartao titulo={t('Histórico (ganhos e pagamentos)')} acao={pessoaId && <Botao variante="leve" onClick={() => setPessoaId(undefined)}>{t('Todas')}</Botao>}>
        {!dados.extrato.length ? <Vazio texto="Nada no período." /> : (
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {dados.extrato.slice(0, 200).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2">
                {e.tipo === 'ganho' ? (
                  <button type="button" className="min-w-0 text-left" onClick={() => ir('venda', { id: e.vendaId })}>
                    <div className="truncate"><b>{dataBR(e.data)}</b> · {e.descricao}{e.cliente ? ` · ${e.cliente}` : ''}{e.corrigida && <> · <Pilula tom="alerta">{t('corrigida')}</Pilula></>}</div>
                    <div className="num text-xs text-[var(--suave)]">{formatar(e.base, m)} × {e.bp / 100}%</div>
                  </button>
                ) : (
                  <div className="min-w-0"><div className="truncate"><b>{dataBR(e.data)}</b> · 💵 {e.descricao}</div><div className="text-xs text-[var(--suave)]">{t('pagamento')} · {formatar(e.valorMoeda, e.moeda)}</div></div>
                )}
                <span className={cx('num shrink-0 font-bold', e.tipo === 'pago' ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{e.tipo === 'pago' ? '−' : '+'}{formatar(e.valor, m)}</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      {pagar && <PagarComissao {...pagar} onFechar={() => setPagar(undefined)} />}
    </div>
  )
}

function PagarComissao({ id: pessoaId, nome, aPagar, onFechar }: { id: string; nome: string; aPagar: number; onFechar(): void }) {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [valor, setValor] = useState<number | undefined>(aPagar)
  const [forma, setForma] = useState('dinheiro')
  const [ref, setRef] = useState('')
  const moeda = cfg?.config.moedaPrincipal ?? 'BOB'
  return (
    <Janela aberta titulo={`${t('Pagar comissão')} · ${nome}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('pagarComissao', { id, pessoaId, valor: valor!, moeda, forma, referencia: ref }, t('Comissão paga (sai do caixa e abate do a pagar).'))) && onFechar()}>{t('Pagar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('A pagar')}: <b className="num">{formatar(aPagar, moeda)}</b> <Info texto="Pode pagar tudo ou uma parte; o resto continua a pagar. Ex.: a pagar Bs 400, pagou Bs 300 → fica Bs 100." /></p>
        <Campo rotulo="Valor"><ValorInput moeda={moeda} valor={valor} onChange={setValor} /></Campo>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.config.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Referência (opcional)"><Entrada value={ref} placeholder={t('Ex.: comissões da quinzena')} onChange={(e) => setRef(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
