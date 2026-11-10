// EQUIPE E UNIDADES: organograma por salão (toque na pessoa → resumo rápido), cadastro simples de funcionário
// (salário por mês, semana ou dia) e a "ponta do lápis" de cada unidade: entradas × saídas = margem.

import { useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { FiltroUnidade } from '../../../shared/ui/filtroUnidade'
import { Unidades } from '../components/Unidades'
import { Comissoes } from '../components/Comissoes'
import { Organograma, acharNoOrganograma, contarOrganograma } from '../components/Organograma'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { FiltroLista } from '../../../shared/ui/filtroPadrao'
import { corDoNome, iniciais } from '../../../shared/ui/tabelaDados'
import { FolhaItem } from '../../../shared/ui/folhaItem'
import { formatar } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id, Pessoa } from '../../../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Entrada, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, dataBR, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useLembrado, usePeriodo } from '../../../shared/ui/filtros'
import { useT } from '../../../shared/ui/i18n'

const PERIODOS = { mes: 'por mês', semana: 'por semana', dia: 'por dia' } as const

export function Equipe() {
  const t = useT()
  const { sessao, ajustarParams, ir } = useApp()
  const [aba, setAba] = useParamTela<'organograma' | 'unidades' | 'comissoes'>('aba', 'organograma')
  const [periodo, setPeriodo] = usePeriodo('equipe.periodo', 'mes')
  const [localId, setLocalId] = useLembrado<string>('equipe.local', '')
  const [resumo, setResumo] = useState<Id>()
  const { dados: locais } = useConsulta('locais', {})
  const { dados: org } = useConsulta('organograma', { localId: localId || undefined, de: periodo.de, ate: periodo.ate })
  const [busca, setBusca] = useState('')
  const admin = sessao.perfil === 'admin'
  const nomeLocal = new Map((locais ?? []).map((l) => [l.id, l.nome]))
  // o período no padrão (📅 ▾); "Tudo" = desde sempre
  // o período é obrigatório aqui (comissão e margem são sempre de um intervalo): atalhos ou datas livres
  const mudarPeriodo = (de?: string, ate?: string) => de && ate && setPeriodo({ preset: 'livre', de, ate })
  const tot = org ? contarOrganograma(org.raizes) : undefined
  const m = moedaPadrao()
  const ativos = localId ? [{ k: 'local', rotulo: `🏢 ${nomeLocal.get(localId) ?? ''}` }] : []
  return (
    <div>
      <Titulo subtitulo={t('Quem é quem, quanto cada uma atendeu e as comissões do período.')} acao={admin && <Botao onClick={() => ir('novoFuncionario', { local: localId || undefined })}>+ {t('Funcionário')}</Botao>}>{t('Equipe e unidades')}</Titulo>
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
        resultados={aba === 'organograma' && tot ? (busca.trim() ? acharNoOrganograma(org!.raizes, busca).length : tot.pessoas) : undefined}
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
            <Organograma raizes={org.raizes} busca={busca} eu={sessao.pessoaId} nomeLocal={nomeLocal} onClick={setResumo} onLimpar={() => setBusca('')} />
          </>
        )
      ) : aba === 'comissoes' ? (
        <Comissoes de={periodo.de} ate={periodo.ate} busca={busca} />
      ) : !admin ? null : (
        <Unidades de={periodo.de} ate={periodo.ate} busca={busca} onComissoes={() => setAba('comissoes')} />
      )}
      {resumo && <Resumo id={resumo} de={periodo.de} ate={periodo.ate} onFechar={() => setResumo(undefined)} onEditar={(p) => (setResumo(undefined), ir('novoFuncionario', { id: p.id }))} onComissoes={(id) => (setResumo(undefined), ajustarParams({ aba: 'comissoes', pessoaId: id }))} />}
    </div>
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
          { icone: '📜', rotulo: 'O que fez (log)', onClick: () => ir('auditoria', { usuarioId: p.id }) },
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
        <Campo rotulo="Forma"><Selecao valor={forma ?? sug?.forma ?? 'dinheiro'} onChange={setForma} opcoes={formasEmUso(cfg?.config.formas, moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Referência (opcional)"><Entrada value={ref} placeholder={t('Ex.: semana 1 a 7, diária de sábado')} onChange={(e) => setRef(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
