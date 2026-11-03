// EQUIPE E UNIDADES: organograma por salão (toque na pessoa → resumo rápido), cadastro simples de funcionário
// (salário por mês, semana ou dia) e a "ponta do lápis" de cada unidade: entradas × saídas = margem.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id, Pessoa } from '../core/domain/tipos'
import type { NoOrganograma } from '../core/services/equipe'
import { memoriaCalculo } from '../core/domain/comissao'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, Info, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, moedaPadrao } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useCotacoes } from '../ui/compartilhados'
import { SeletorPeriodo, useLembrado, usePeriodo } from '../ui/filtros'
import { useT } from '../ui/i18n'
import { useLargo } from '../ui/calendario'

const PERIODOS = { mes: 'por mês', semana: 'por semana', dia: 'por dia' } as const

export function Equipe() {
  const t = useT()
  const { sessao, ajustarParams } = useApp()
  const [aba, setAba] = useParamTela<'organograma' | 'unidades' | 'comissoes'>('aba', 'organograma')
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
        {sessao.perfil === 'admin' && <Selecao className="w-auto max-w-full" valor={localId} onChange={setLocalId} vazio="Todas as unidades" opcoes={(locais ?? []).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome }))} />}
      </div>
      <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'organograma', nome: 'Organograma' }, { id: 'comissoes', nome: 'Comissões' }, { id: 'unidades', nome: 'Entradas × saídas por unidade' }]} />
      {aba === 'organograma' ? (
        !org ? <Carregando /> : !org.raizes.length ? <Vazio texto="Ninguém na equipe desta unidade ainda." /> : (
          <OrganogramaVisual raizes={org.raizes} onClick={setResumo} />
        )
      ) : aba === 'comissoes' ? (
        <Comissoes de={periodo.de} ate={periodo.ate} />
      ) : (
        <Unidades de={periodo.de} ate={periodo.ate} onComissoes={() => setAba('comissoes')} />
      )}
      {resumo && <Resumo id={resumo} de={periodo.de} ate={periodo.ate} onFechar={() => setResumo(undefined)} onEditar={(p) => (setResumo(undefined), setEditar(p))} onComissoes={(id) => (setResumo(undefined), ajustarParams({ aba: 'comissoes', pessoaId: id }))} />}
      {editar && <EditarFuncionario pessoa={editar === 'novo' ? undefined : editar} localPadrao={localId} onFechar={() => setEditar(undefined)} />}
    </div>
  )
}

// ORGANOGRAMA (minimalista, para ler informação): cartão branco, avatar com a cor do nível, nome, cargo e os dois
// números do período (atendimentos · faturado). Computador: árvore com linhas finas; celular: lista em níveis.
const COR_NIVEL = ['#1f2937', '#64748b', 'var(--marca)', '#a78bfa']
const corNivel = (nivel: number) => COR_NIVEL[Math.min(nivel, COR_NIVEL.length - 1)]
const contar = (ns: NoOrganograma[]): { pessoas: number; atend: number; fat: number } =>
  ns.reduce((s, n) => { const f = contar(n.subordinados); return { pessoas: s.pessoas + 1 + f.pessoas, atend: s.atend + n.atendimentos + f.atend, fat: s.fat + n.faturamento + f.fat } }, { pessoas: 0, atend: 0, fat: 0 })

function OrganogramaVisual({ raizes, onClick }: { raizes: NoOrganograma[]; onClick(id: Id): void }) {
  const t = useT()
  const largo = useLargo()
  const tot = contar(raizes)
  const m = moedaPadrao()
  return (
    <div className="space-y-3">
      {/* resumo da equipe no período */}
      <div className="grid grid-cols-3 gap-2">
        {[{ r: 'Pessoas', v: String(tot.pessoas) }, { r: 'Atendimentos', v: String(tot.atend) }, { r: 'Faturado', v: formatar(tot.fat, m) }].map((x) => (
          <div key={x.r} className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-3 py-2">
            <div className="truncate text-xs text-[var(--suave)]">{t(x.r)}</div>
            <div className="num truncate text-lg font-bold">{x.v}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--fundo)] p-3 sm:p-6 [scrollbar-width:thin]">
        {largo ? (
          <div className="flex min-w-max justify-center gap-8">
            {raizes.map((n) => <NoArvore key={n.pessoa.id} n={n} nivel={0} onClick={onClick} />)}
          </div>
        ) : (
          <ul className="space-y-2">{raizes.map((n) => <NoLista key={n.pessoa.id} n={n} nivel={0} onClick={onClick} />)}</ul>
        )}
      </div>
    </div>
  )
}

function CartaoPessoa({ n, nivel, onClick, largura }: { n: NoOrganograma; nivel: number; onClick(id: Id): void; largura?: string }) {
  const t = useT()
  const m = moedaPadrao()
  const cor = corNivel(nivel)
  return (
    <button type="button" onClick={() => onClick(n.pessoa.id)} className={cx('group flex items-center gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)] hover:shadow-md', largura)}>
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white" style={{ background: cor }}>{n.pessoa.nome.slice(0, 1)}</span>
      <span className="min-w-0 flex-1">
        <b className="block truncate">{n.pessoa.nome}</b>
        <span className="block truncate text-xs text-[var(--suave)]">{n.pessoa.cargo ?? '—'}</span>
        <span className="num mt-1 flex gap-1.5 text-[11px]">
          <span className="rounded-md bg-[var(--fundo)] px-1.5 py-0.5"><b>{n.atendimentos}</b> {t('atend.')}</span>
          {n.faturamento > 0 && <span className="truncate rounded-md bg-[var(--fundo)] px-1.5 py-0.5"><b>{formatar(n.faturamento, m)}</b></span>}
        </span>
      </span>
    </button>
  )
}

function NoArvore({ n, nivel, onClick }: { n: NoOrganograma; nivel: number; onClick(id: Id): void }) {
  return (
    <div className="flex flex-col items-center">
      <CartaoPessoa n={n} nivel={nivel} onClick={onClick} largura="w-56" />
      {n.subordinados.length > 0 && (
        <>
          <div className="h-6 w-px bg-[var(--suave)]/40" />
          <div className="flex gap-4">
            {n.subordinados.map((s, k) => (
              // traço horizontal só entre o primeiro e o último filho (cantos limpos)
              <div key={s.pessoa.id} className="relative flex flex-col items-center pt-6">
                <span aria-hidden className={cx('absolute top-0 h-px bg-[var(--suave)]/40', n.subordinados.length === 1 ? 'hidden' : k === 0 ? 'left-1/2 right-[-0.5rem]' : k === n.subordinados.length - 1 ? 'left-[-0.5rem] right-1/2' : '-left-2 -right-2')} />
                <span aria-hidden className="absolute left-1/2 top-0 h-6 w-px bg-[var(--suave)]/40" />
                <NoArvore n={s} nivel={nivel + 1} onClick={onClick} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** celular: a mesma árvore como lista em níveis (linha fina à esquerda mostra quem responde a quem) */
function NoLista({ n, nivel, onClick }: { n: NoOrganograma; nivel: number; onClick(id: Id): void }) {
  return (
    <li>
      <CartaoPessoa n={n} nivel={nivel} onClick={onClick} largura="w-full" />
      {n.subordinados.length > 0 && (
        <ul className="ml-5 mt-2 space-y-2 border-l border-[var(--suave)]/40 pl-3">
          {n.subordinados.map((s) => <NoLista key={s.pessoa.id} n={s} nivel={nivel + 1} onClick={onClick} />)}
        </ul>
      )}
    </li>
  )
}

function Resumo({ id, de, ate, onFechar, onEditar, onComissoes }: { id: Id; de: string; ate: string; onFechar(): void; onEditar(p: Pessoa): void; onComissoes(id: Id): void }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const { dados, erro } = useConsulta('resumoFuncionario', { id, de, ate })
  const [pagar, setPagar] = useState(false)
  if (erro) return <Janela aberta titulo={t('Resumo')} onFechar={onFechar}><p className="text-sm">{erro}</p></Janela>
  if (!dados) return <Janela aberta titulo={t('Resumo')} onFechar={onFechar}><Carregando /></Janela>
  const p = dados.pessoa
  const moeda = moedaPadrao()
  const vendas = () => ir('vendas', { profissionalId: p.id, de, ate })
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
        {([
          ['Atendimentos', String(dados.atendimentos), vendas],
          ['Faturamento', formatar(dados.faturamento, moeda), vendas],
          ['Ticket médio', formatar(dados.ticket, moeda), vendas],
          ['Comissão no período', formatar(dados.comissao, moeda), () => onComissoes(p.id)],
          ['Agendados', String(dados.agendados), () => ir('agenda', { profissionalId: p.id, modo: 'semana' })],
          ['Pago no período', formatar(dados.pagoNoPeriodo, moeda), undefined],
        ] as [string, string, (() => void) | undefined][]).map(([n, v, abrir]) => {
          const dentro = <><div className="text-xs text-[var(--suave)]">{t(n)}</div><div className="num break-words font-bold">{v}</div></>
          return abrir ? (
            <button key={n} type="button" onClick={abrir} className="min-h-10 rounded-xl border border-transparent bg-[var(--fundo)] p-2 text-left hover:border-[var(--marca)]">{dentro}</button>
          ) : (
            <div key={n} className="rounded-xl bg-[var(--fundo)] p-2">{dentro}</div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sessao.perfil === 'admin' && <Botao onClick={() => setPagar(true)}>{t('Pagar salário')}</Botao>}
        {sessao.perfil === 'admin' && <Botao variante="secundario" onClick={() => onEditar(p)}>{t('Editar')}</Botao>}
        <Botao variante="secundario" onClick={() => ir('pessoa', { id: p.id })}>{t('Abrir ficha')}</Botao>
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
  const moeda = sug?.moeda ?? pessoa.salario?.moeda ?? cfg?.config.moedaPrincipal ?? moedaPadrao()
  const fechar = () => ((valor === undefined && !ref.trim()) || window.confirm(t('Sair sem salvar?'))) && onFechar()
  return (
    <Janela aberta titulo={`${t('Pagar')} · ${pessoa.nome}`} onFechar={fechar} rodape={<Botao grande className="w-full" disabled={ocupado || !v} onClick={async () => (await executar('pagarSalario', { id, pessoaId: pessoa.id, valor: v!, moeda, forma: forma ?? sug?.forma ?? 'dinheiro', referencia: ref }, t('Pagamento registrado.'))) && onFechar()}>{t('Pagar')}</Botao>}>
      <div className="space-y-3">
        {sug && <p className="rounded-xl bg-[var(--marca-suave)] p-2 text-sm text-[var(--marca)]">⟳ {sug.origem === 'ultimo' ? t('Repetindo o último pagamento ({d}). Mude se precisar.', { d: dataBR(sug.data) }) : t('Valor do cadastro. Mude se precisar.')}</p>}
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
  const { cfg } = useCotacoes()
  const [d, setD] = useState({
    id: pessoa?.id ?? novoId(),
    nome: pessoa?.nome ?? '',
    telefone: pessoa?.telefone ?? '',
    cargo: pessoa?.cargo ?? '',
    localId: pessoa?.localId ?? localPadrao ?? '',
    superiorId: pessoa?.superiorId ?? '',
    salario: pessoa?.salario?.valor,
    moeda: pessoa?.salario?.moeda as string | undefined,
    periodo: pessoa?.salario?.periodo ?? 'mes',
    comissao: pessoa?.comissaoBp ? String(pessoa.comissaoBp / 100) : '',
    atende: pessoa ? pessoa.papeis.includes('profissional') : true,
    acesso: pessoa?.acesso ?? 'funcionario',
  })
  const [inicial] = useState(() => JSON.stringify(d))
  const moeda = d.moeda ?? cfg?.moedaPrincipal ?? moedaPadrao()
  const fechar = () => (JSON.stringify(d) === inicial || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const salvar = async () => {
    const r = await executar('salvarPessoa', {
      id: d.id,
      nome: d.nome,
      telefone: d.telefone,
      papeis: [...new Set([...(pessoa?.papeis ?? []).filter((x) => x !== 'profissional'), 'funcionario', ...(d.atende ? ['profissional' as const] : [])])] as Pessoa['papeis'],
      cargo: d.cargo,
      localId: d.localId || undefined,
      superiorId: d.superiorId || undefined,
      salario: d.salario !== undefined ? { moeda, valor: d.salario, periodo: d.periodo as 'mes' | 'semana' | 'dia' } : undefined,
      comissaoBp: d.comissao ? Math.round(Number(d.comissao.replace(',', '.')) * 100) : undefined,
      acesso: d.acesso as 'admin' | 'funcionario',
    }, t('Salvo.'))
    if (r) onFechar()
  }
  return (
    <Janela aberta titulo={t(pessoa ? 'Editar funcionário' : 'Novo funcionário')} onFechar={fechar} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={salvar}>{t('Salvar')}</Botao>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Cargo"><Entrada list="cargos" value={d.cargo} onChange={(e) => setD({ ...d, cargo: e.target.value })} /><datalist id="cargos">{['Diretora geral', 'Gerente', 'Cabeleireira sênior', 'Cabeleireira', 'Manicure', 'Recepção'].map((c) => <option key={c} value={c} />)}</datalist></Campo>
        <Campo rotulo="Unidade"><Selecao valor={d.localId} onChange={(v) => setD({ ...d, localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
        <Campo rotulo="Responde a" ajuda="Monta o organograma."><Selecao valor={d.superiorId} onChange={(v) => setD({ ...d, superiorId: v })} vazio="Ninguém (topo)" opcoes={(todos ?? []).filter((p) => p.id !== d.id).map((p) => ({ id: p.id, nome: `${p.nome}${p.cargo ? ` · ${p.cargo}` : ''}` }))} /></Campo>
        <Campo rotulo="Salário / custo" ajuda="Pode ser por mês, semana ou dia. Serve de estimativa do custo; o pago de verdade fica no caixa."><div className="grid grid-cols-[6rem_1fr] gap-2"><Selecao valor={moeda} onChange={(m) => setD({ ...d, moeda: m })} opcoes={(cfg?.moedasAtivas ?? [moeda]).map((m) => ({ id: m, nome: m }))} /><ValorInput moeda={moeda} valor={d.salario} onChange={(v) => setD({ ...d, salario: v })} /></div></Campo>
        <Campo rotulo="Período"><Selecao valor={d.periodo} onChange={(v) => setD({ ...d, periodo: v as 'mes' })} opcoes={Object.entries(PERIODOS).map(([id, nome]) => ({ id, nome: t(nome) }))} /></Campo>
        <Campo rotulo="Comissão (%)"><Entrada inputMode="decimal" value={d.comissao} onChange={(e) => setD({ ...d, comissao: e.target.value })} /></Campo>
        <Campo rotulo="WhatsApp"><Entrada value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} /></Campo>
        <Campo rotulo="Acesso ao sistema"><Selecao valor={d.acesso} onChange={(v) => setD({ ...d, acesso: v as 'admin' })} opcoes={[{ id: 'funcionario', nome: t('Funcionário (só a unidade e a própria agenda)') }, { id: 'admin', nome: t('Administrador (tudo)') }]} /></Campo>
        <label className="flex min-h-10 items-center gap-2 self-end text-sm"><input type="checkbox" className="h-5 w-5" checked={d.atende} onChange={(e) => setD({ ...d, atende: e.target.checked })} /> {t('Atende clientes (aparece na agenda)')}</label>
      </div>
    </Janela>
  )
}

function Unidades({ de, ate, onComissoes }: { de: string; ate: string; onComissoes(): void }) {
  const t = useT()
  const { ir } = useApp()
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
                <tr className="font-semibold text-[var(--bom)]"><td className="py-0.5"><button type="button" className="min-h-10 text-left hover:underline" onClick={() => ir('vendas', { localId: u.local.id, de, ate })}>{t('Entradas (atendimentos)')} · {u.atendimentos}</button></td><td className="num whitespace-nowrap pl-2 text-right">+{formatar(u.entradas, m)}</td></tr>
                <tr><td className="py-1">− {t('Salários')} ({u.funcionarios} · {formatar(u.salarioMensal, m)}/{t('mês')})</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.salarios, m)}</td></tr>
                <tr><td className="py-0.5"><button type="button" className="min-h-10 text-left hover:underline" onClick={onComissoes}>− {t('Comissões')}</button></td><td className="num whitespace-nowrap pl-2 text-right text-[var(--ruim)]">−{formatar(u.comissoes, m)}</td></tr>
                <tr><td className="py-1">− {t('Cabelo usado')}</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.custoCabelo, m)}</td></tr>
                {u.insumos > 0 && <tr><td className="py-1">− {t('Insumos dos serviços')}</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.insumos, m)}</td></tr>}
                <tr><td className="py-1">− {t('Despesas da unidade')}</td><td className="num text-right text-[var(--ruim)]">−{formatar(u.despesas, m)}</td></tr>
                <tr className="border-t-2 border-[var(--texto)] text-base font-bold"><td className="py-1">= {t('Margem')}</td><td className={cx('num text-right', u.margem < 0 && 'text-[var(--ruim)]')}>{formatar(u.margem, m)}</td></tr>
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              <button type="button" className="min-h-10" onClick={() => ir('agenda', { localId: u.local.id, modo: 'semana' })}><Pilula tom="marca">{t('Agendados')}: {u.agendados}</Pilula></button>
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
        <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
          <button type="button" className="min-h-10 rounded-xl hover:bg-[var(--marca-suave)]" onClick={() => ir('vendas', { de, ate })}><div className="text-xs text-[var(--suave)]">{t('Entradas')}</div><div className="num break-words font-bold text-[var(--bom)]">{formatar(dados.total.entradas, m)}</div></button>
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
  const [pessoaFiltro, setPessoaFiltro] = useParamTela('pessoaId', '')
  const pessoaId = pessoaFiltro || undefined
  const setPessoaId = (id?: string) => setPessoaFiltro(id ?? '')
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
              <thead><tr className="text-left text-xs text-[var(--suave)]"><th className="py-1">{t('Profissional')}</th><th className="text-right max-md:hidden">{t('Atendimentos')}</th><th className="text-right max-md:hidden">{t('Ganhou no período')}</th><th className="text-right max-md:hidden">{t('Pago no período')}</th><th className="text-right">{t('A pagar')}</th><th /></tr></thead>
              <tbody>
                {dados.porPessoa.map((x) => (
                  <tr key={x.pessoaId} className={cx('border-t border-[var(--borda)]', pessoaId === x.pessoaId && 'bg-[var(--marca-suave)]')}>
                    <td className="py-1"><button type="button" aria-pressed={pessoaId === x.pessoaId} className="min-h-10 text-left font-semibold underline" onClick={() => setPessoaId(pessoaId === x.pessoaId ? undefined : x.pessoaId)}>{x.nome}</button></td>
                    <td className="num text-right max-md:hidden">{x.atendimentos}</td>
                    <td className="num text-right max-md:hidden">{formatar(x.ganhoPeriodo, m)}</td>
                    <td className="num text-right max-md:hidden">{formatar(x.pagoPeriodo, m)}</td>
                    <td className={cx('num whitespace-nowrap pl-2 text-right font-bold', x.aPagar > 0 && 'text-[var(--alerta)]')}>{formatar(x.aPagar, m)}</td>
                    <td className="pl-2 text-right">{sessao.perfil === 'admin' && x.aPagar > 0 && <Botao variante="secundario" onClick={() => setPagar({ id: x.pessoaId, nome: x.nome, aPagar: x.aPagar })}>{t('Pagar')}</Botao>}</td>
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
                  <button type="button" className="min-h-10 min-w-0 text-left" onClick={() => ir('venda', { id: e.vendaId })}>
                    <div className="truncate"><b>{dataBR(e.data)}</b> · {e.descricao}{e.cliente ? ` · ${e.cliente}` : ''}{e.corrigida && <> · <Pilula tom="alerta">{t('corrigida')}</Pilula></>}</div>
                    <div className="num whitespace-normal text-xs text-[var(--suave)]">{memoriaCalculo({ totalPrincipal: e.valorLinha, insumoPrincipal: e.insumo, insumos: e.insumos, comissaoBp: e.bp, comissaoPrincipal: e.valor, comissaoRegra: e.regra, baseComissao: e.base, parteSalao: e.parteSalao }, m, t)}</div>
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
  const moeda = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const fechar = () => ((valor === aPagar && !ref.trim()) || window.confirm(t('Sair sem salvar?'))) && onFechar()
  return (
    <Janela aberta titulo={`${t('Pagar comissão')} · ${nome}`} onFechar={fechar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('pagarComissao', { id, pessoaId, valor: valor!, moeda, forma, referencia: ref }, t('Comissão paga (sai do caixa e abate do a pagar).'))) && onFechar()}>{t('Pagar')}</Botao>}>
      <div className="space-y-3">
        <p className="text-sm">{t('A pagar')}: <b className="num">{formatar(aPagar, moeda)}</b> <Info texto="Pode pagar tudo ou uma parte; o resto continua a pagar. Ex.: a pagar Bs 400, pagou Bs 300 → fica Bs 100." /></p>
        <Campo rotulo="Valor"><ValorInput moeda={moeda} valor={valor} onChange={setValor} /></Campo>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.config.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Referência (opcional)"><Entrada value={ref} placeholder={t('Ex.: comissões da quinzena')} onChange={(e) => setRef(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
