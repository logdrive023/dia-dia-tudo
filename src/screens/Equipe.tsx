// EQUIPE E UNIDADES: organograma por salão (toque na pessoa → resumo rápido), cadastro simples de funcionário
// (salário por mês, semana ou dia) e a "ponta do lápis" de cada unidade: entradas × saídas = margem.

import { useState } from 'react'
import { FiltroUnidade } from '../ui/filtroUnidade'
import { Unidades } from './equipe/Unidades'
import { Comissoes } from './equipe/Comissoes'
import { GrupoNumeros, NumeroGrande } from '../ui/numeroGrande'
import { FiltroLista, VazioFiltro } from '../ui/filtroPadrao'
import { corDoNome, iniciais } from '../ui/tabelaDados'
import { FolhaItem } from '../ui/folhaItem'
import { CadastroFuncionario } from './cadastros/CadastroFuncionario'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id, Pessoa } from '../core/domain/tipos'
import type { NoOrganograma } from '../core/services/equipe'
import { Abas, Botao, Campo, Carregando, Entrada, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, moedaPadrao } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useLembrado, usePeriodo } from '../ui/filtros'
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
  const [busca, setBusca] = useState('')
  const admin = sessao.perfil === 'admin'
  const nomeLocal = new Map((locais ?? []).map((l) => [l.id, l.nome]))
  // o período no padrão (📅 ▾); "Tudo" = desde sempre
  // o período é obrigatório aqui (comissão e margem são sempre de um intervalo): atalhos ou datas livres
  const mudarPeriodo = (de?: string, ate?: string) => de && ate && setPeriodo({ preset: 'livre', de, ate })
  const tot = org ? contar(org.raizes) : undefined
  const m = moedaPadrao()
  const ativos = localId ? [{ k: 'local', rotulo: `🏢 ${nomeLocal.get(localId) ?? ''}` }] : []
  return (
    <div>
      <Titulo subtitulo={t('Quem é quem, quanto cada uma atendeu e as comissões do período.')} acao={admin && <Botao onClick={() => setEditar('novo')}>+ {t('Funcionário')}</Botao>}>{t('Equipe e unidades')}</Titulo>
      <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[{ id: 'organograma', nome: 'Organograma' }, { id: 'comissoes', nome: 'Comissões' }, ...(admin ? [{ id: 'unidades', nome: 'Entradas × saídas' }] : [])]} />
      <FiltroLista
        className="mb-4 mt-3"
        busca={busca}
        onBusca={setBusca}
        placeholder={aba === 'unidades' ? 'Buscar unidade' : 'Buscar pessoa ou cargo'}
        periodo={{ de: periodo.de, ate: periodo.ate, onChange: mudarPeriodo, obrigatorio: true, presets: ['hoje', '7d', '30d', 'mes', 'mesPassado', 'ano'] }}
        extra={admin ? <FiltroUnidade valor={localId} onChange={setLocalId} tipos={['salao']} /> : undefined}
        ativos={ativos}
        onTirar={() => setLocalId('')}
        temAtivos={!!(localId || busca)}
        onLimpar={() => (setLocalId(''), setBusca(''))}
        resultados={aba === 'organograma' && tot ? (busca.trim() ? achar(org!.raizes, busca).length : tot.pessoas) : undefined}
        total={aba === 'organograma' ? tot?.pessoas : undefined}
        unidade="pessoa(s)"
      />
      {aba === 'organograma' ? (
        !org ? <Carregando /> : !org.raizes.length ? <Vazio texto="Ninguém na equipe desta unidade ainda." /> : (
          <>
            <GrupoNumeros colunas={3} celular={3}>
              <NumeroGrande rotulo="Pessoas" valor={tot!.pessoas} icone="👥" sub={localId ? nomeLocal.get(localId) : t('todas as unidades')} />
              <NumeroGrande rotulo="Atendimentos" valor={tot!.atend} icone="✂️" sub={t('no período')} />
              <NumeroGrande rotulo="Faturado" valor={formatar(tot!.fat, m)} icone="💰" tom={tot!.fat ? 'bom' : undefined} sub={t('no período')} />
            </GrupoNumeros>
            <OrganogramaVisual raizes={org.raizes} busca={busca} eu={sessao.pessoaId} nomeLocal={nomeLocal} onClick={setResumo} onLimpar={() => setBusca('')} />
          </>
        )
      ) : aba === 'comissoes' ? (
        <Comissoes de={periodo.de} ate={periodo.ate} busca={busca} />
      ) : !admin ? null : (
        <Unidades de={periodo.de} ate={periodo.ate} busca={busca} onComissoes={() => setAba('comissoes')} />
      )}
      {resumo && <Resumo id={resumo} de={periodo.de} ate={periodo.ate} onFechar={() => setResumo(undefined)} onEditar={(p) => (setResumo(undefined), setEditar(p))} onComissoes={(id) => (setResumo(undefined), ajustarParams({ aba: 'comissoes', pessoaId: id }))} />}
      {editar && <CadastroFuncionario pessoa={editar === 'novo' ? undefined : editar} localPadrao={localId} onFechar={() => setEditar(undefined)} />}
    </div>
  )
}

// ORGANOGRAMA — cada pessoa num cartão: avatar com a cor dela (iniciais), nome, cargo e unidade, e os números do período
// (✂️ atendimentos · 💰 faturado · 👥 quantas respondem a ela). Computador: árvore com linhas; celular: níveis com a
// linha colorida de quem responde a quem. Buscando: só os cartões que batem, numa lista (com "responde a").
const contar = (ns: NoOrganograma[]): { pessoas: number; atend: number; fat: number } =>
  ns.reduce((s, n) => { const f = contar(n.subordinados); return { pessoas: s.pessoas + 1 + f.pessoas, atend: s.atend + n.atendimentos + f.atend, fat: s.fat + n.faturamento + f.fat } }, { pessoas: 0, atend: 0, fat: 0 })
const semAcento = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** quem bate com a busca (nome ou cargo), com o nome de quem é o chefe */
function achar(ns: NoOrganograma[], busca: string, chefe?: string): { n: NoOrganograma; chefe?: string }[] {
  const b = semAcento(busca.trim())
  return ns.flatMap((n) => [
    ...(semAcento(`${n.pessoa.nome} ${n.pessoa.cargo ?? ''}`).includes(b) ? [{ n, chefe }] : []),
    ...achar(n.subordinados, busca, n.pessoa.nome),
  ])
}

function OrganogramaVisual({ raizes, busca, eu, nomeLocal, onClick, onLimpar }: { raizes: NoOrganograma[]; busca: string; eu?: Id; nomeLocal: Map<Id, string>; onClick(id: Id): void; onLimpar(): void }) {
  const t = useT()
  const largo = useLargo()
  const p = { eu, nomeLocal, onClick }
  if (busca.trim()) {
    const achados = achar(raizes, busca)
    if (!achados.length) return <VazioFiltro texto="Ninguém com esse nome ou cargo." filtrando onLimpar={onLimpar} />
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {achados.map(({ n, chefe }) => <li key={n.pessoa.id}><CartaoPessoa n={n} {...p} chefe={chefe} /></li>)}
      </ul>
    )
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--fundo)] p-3 sm:p-6 [scrollbar-width:thin]">
      {largo ? (
        <div className="flex min-w-max justify-center gap-8">
          {raizes.map((n) => <NoArvore key={n.pessoa.id} n={n} {...p} />)}
        </div>
      ) : (
        <ul className="space-y-2">{raizes.map((n) => <NoLista key={n.pessoa.id} n={n} {...p} />)}</ul>
      )}
      <p className="mt-3 text-center text-xs text-[var(--suave)]">{t('Toque numa pessoa para ver o resumo.')}</p>
    </div>
  )
}

type PropsNo = { n: NoOrganograma; eu?: Id; nomeLocal: Map<Id, string>; onClick(id: Id): void }

function CartaoPessoa({ n, eu, nomeLocal, onClick, chefe, largura }: PropsNo & { chefe?: string; largura?: string }) {
  const t = useT()
  const m = moedaPadrao()
  const cor = corDoNome(n.pessoa.nome)
  const equipe = contar(n.subordinados).pessoas
  const local = n.pessoa.localId ? nomeLocal.get(n.pessoa.localId) : undefined
  const souEu = !!eu && n.pessoa.id === eu
  return (
    <button type="button" onClick={() => onClick(n.pessoa.id)}
      className={cx('group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-[var(--cartao)] p-3 pl-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', souEu ? 'border-[var(--marca)]' : 'border-[var(--borda)] hover:border-[var(--marca)]', largura)}>
      {/* a faixa da cor da pessoa (a mesma do avatar) */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>{iniciais(n.pessoa.nome)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <b className="truncate">{n.pessoa.nome}</b>
          {souEu && <span className="shrink-0 rounded-full bg-[var(--marca)] px-1.5 py-px text-[10px] font-bold text-white">{t('você')}</span>}
        </span>
        <span className="block truncate text-xs text-[var(--suave)]">{[n.pessoa.cargo, local && `🏢 ${local}`].filter(Boolean).join(' · ') || '—'}</span>
        {chefe && <span className="block truncate text-xs text-[var(--suave)]">↑ {t('responde a')} {chefe}</span>}
        <span className="num mt-1.5 flex flex-wrap gap-1 text-[11px]">
          <span className="whitespace-nowrap rounded-md bg-[var(--fundo)] px-1.5 py-0.5">✂️ <b>{n.atendimentos}</b> {t('atend.')}</span>
          {n.faturamento > 0 && <span className="whitespace-nowrap rounded-md bg-[var(--bom)]/12 px-1.5 py-0.5 text-[var(--bom)]">💰 <b>{formatar(n.faturamento, m)}</b></span>}
          {equipe > 0 && <span className="whitespace-nowrap rounded-md bg-[var(--fundo)] px-1.5 py-0.5">👥 <b>{equipe}</b></span>}
        </span>
      </span>
      <span aria-hidden className="self-center text-lg text-[var(--suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--marca)]">›</span>
    </button>
  )
}

function NoArvore(p: PropsNo) {
  const { n } = p
  return (
    <div className="flex flex-col items-center">
      <CartaoPessoa {...p} largura="w-60" />
      {n.subordinados.length > 0 && (
        <>
          <div className="h-6 w-px bg-[var(--suave)]/40" />
          <div className="flex gap-4">
            {n.subordinados.map((s, k) => (
              // traço horizontal só entre o primeiro e o último filho (cantos limpos)
              <div key={s.pessoa.id} className="relative flex flex-col items-center pt-6">
                <span aria-hidden className={cx('absolute top-0 h-px bg-[var(--suave)]/40', n.subordinados.length === 1 ? 'hidden' : k === 0 ? 'left-1/2 right-[-0.5rem]' : k === n.subordinados.length - 1 ? 'left-[-0.5rem] right-1/2' : '-left-2 -right-2')} />
                <span aria-hidden className="absolute left-1/2 top-0 h-6 w-px bg-[var(--suave)]/40" />
                <NoArvore {...p} n={s} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** celular: a árvore em níveis — a linha à esquerda tem a cor de quem é o chefe, e cada cartão tem o seu "cotovelo" */
function NoLista(p: PropsNo) {
  const { n } = p
  const cor = corDoNome(n.pessoa.nome)
  const linha = `color-mix(in srgb, ${cor} 45%, transparent)`
  return (
    <li>
      <CartaoPessoa {...p} />
      {n.subordinados.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 pl-3" style={{ borderColor: linha }}>
          {n.subordinados.map((s) => (
            <li key={s.pessoa.id} className="relative list-none">
              <span aria-hidden className="absolute -left-3 top-7 h-0.5 w-3" style={{ background: linha }} />
              <ul><NoLista {...p} n={s} /></ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** RESUMO DA PESSOA DA EQUIPE (toque no organograma) — a folha padrão (FolhaItem), a mesma da agenda:
 *  avatar + nome · cargo e acesso · os fatos (unidade, a quem responde, salário, comissão) · o faturamento em destaque ·
 *  os números do período em cartões (cada um abre a lista certa) · Pagar salário / Editar / O que fez · Abrir ficha. */
function Resumo({ id, de, ate, onFechar, onEditar, onComissoes }: { id: Id; de: string; ate: string; onFechar(): void; onEditar(p: Pessoa): void; onComissoes(id: Id): void }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const { dados, erro } = useConsulta('resumoFuncionario', { id, de, ate })
  const [pagar, setPagar] = useState(false)
  if (erro) return <Janela aberta titulo={t('Resumo')} onFechar={onFechar}><p className="text-sm">{erro}</p></Janela>
  if (!dados) return <Janela aberta titulo={t('Resumo')} onFechar={onFechar}><Carregando /></Janela>
  const p = dados.pessoa
  const admin = sessao.perfil === 'admin'
  const moeda = moedaPadrao()
  const cor = corDoNome(p.nome)
  const vendas = () => ir('vendas', { profissionalId: p.id, de, ate })
  const salario = p.salario ? `${formatar(p.salario.valor, p.salario.moeda)} ${t(PERIODOS[p.salario.periodo ?? 'mes'])}` : undefined
  // o "≈ por mês" só quando muda algo (outra moeda ou pago por semana/dia)
  const salarioMes = p.salario && (p.salario.moeda !== moeda || (p.salario.periodo ?? 'mes') !== 'mes') ? `≈ ${formatar(dados.salarioPrincipal, moeda)} ${t('por mês')}` : undefined
  const acesso = p.acesso === 'admin' ? 'Administrador' : p.acesso === 'funcionario' ? 'Funcionário' : 'Sem acesso'
  return (
    <>
      <FolhaItem
        aberta={!pagar}
        onFechar={onFechar}
        icone={<span className="text-base font-bold" style={{ color: cor }}>{iniciais(p.nome)}</span>}
        cor={cor}
        tipo={p.cargo || 'Equipe'}
        titulo={p.nome}
        selos={<Pilula tom={p.acesso === 'admin' ? 'marca' : 'neutro'}>{t(acesso)}</Pilula>}
        fatos={[
          { icone: '🏢', rotulo: 'Unidade', valor: dados.local?.nome },
          { icone: '👤', rotulo: 'Responde a', valor: dados.superior?.nome },
          { icone: '💵', rotulo: 'Salário', valor: salario && <span className="num">{salario}{salarioMes && <span className="block text-xs font-normal text-[var(--suave)]">{salarioMes}</span>}</span> },
          { icone: '%', rotulo: 'Comissão', valor: p.comissaoBp ? `${p.comissaoBp / 100}%` : undefined },
        ]}
        destaque={{ rotulo: 'Faturamento', valor: formatar(dados.faturamento, moeda), sub: `${dataBR(de)} – ${dataBR(ate)}` }}
        numeros={{
          titulo: 'Desempenho no período',
          itens: [
            { icone: '✂️', rotulo: 'Atendimentos', valor: String(dados.atendimentos), onClick: admin ? vendas : undefined },
            { icone: '🎯', rotulo: 'Ticket médio', valor: formatar(dados.ticket, moeda) },
            { icone: '💰', rotulo: 'Comissão no período', valor: formatar(dados.comissao, moeda), tom: dados.comissao ? 'bom' : undefined, onClick: () => onComissoes(p.id) },
            { icone: '📅', rotulo: 'Agendados', valor: String(dados.agendados), onClick: () => ir('agenda', { profissionalId: p.id, modo: 'semana' }) },
            ...(admin ? [{ icone: '🧾', rotulo: 'Pago no período', valor: formatar(dados.pagoNoPeriodo, moeda) }] : []),
          ],
        }}
        principal={admin ? { icone: '💵', rotulo: 'Pagar salário', onClick: () => setPagar(true) } : undefined}
        secundarias={admin ? [
          { icone: '✎', rotulo: 'Editar', onClick: () => onEditar(p) },
          { icone: '📜', rotulo: 'O que fez (log)', onClick: () => ir('relatorios', { relatorio: 'log', usuarioId: p.id }) },
        ] : []}
        abrir={{ rotulo: 'Abrir ficha', onClick: () => ir('pessoa', { id: p.id }) }}
      />
      {pagar && <PagarSalario pessoa={p} onFechar={() => setPagar(false)} />}
    </>
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
