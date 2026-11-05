// CONFIGURAÇÕES › Metas: tudo configurável — onde aparecem (Painel; a funcionária vê as dela), com ou sem o valor
// (só a %), e a lista de metas do mês (de quem, o que mede, quanto; dá para pausar sem apagar).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { ConfigMetas, Meta } from '../../core/services/metas'
import { Botao, Campo, Carregando, Cartao, Entrada, Selecao, ValorInput, Vazio, cx } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { Chave, Interruptor } from '../../ui/interruptor'
import { GrupoCampos, JanelaCadastro } from '../../ui/janelaCadastro'
import { MetasDoMes } from '../../ui/metas'

const PADRAO: ConfigMetas = { painel: true, mostrarValor: true, funcionaria: false, funcionariaValor: false, itens: [] }
const INDICADORES = [{ id: 'faturamento', nome: '💰 Faturamento' }, { id: 'vendas', nome: '🛒 Número de vendas' }, { id: 'atendimentos', nome: '✂️ Atendimentos do salão' }]

export function Metas() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const { executar, ocupado } = useComando()
  const [ed, setEd] = useState<Meta & { novo?: boolean }>()
  if (!dados) return <Carregando />
  const c: ConfigMetas = { ...PADRAO, ...(dados.config.metas ?? {}) }
  const moeda = dados.config.moedaPrincipal
  const salvar = (m: Partial<ConfigMetas>, aviso?: string) => executar('salvarConfig', { metas: { ...c, ...m }, antes: { metas: dados.config.metas } } as never, aviso)
  const equipe = (pessoas ?? []).filter((p) => p.papeis.some((x) => x === 'funcionario' || x === 'profissional'))
  const alvoNome = (m: Meta) => (m.alvo === 'empresa' ? t('Empresa') : m.alvo === 'unidade' ? locais?.find((l) => l.id === m.alvoId)?.nome ?? '—' : pessoas?.find((p) => p.id === m.alvoId)?.nome ?? '—')
  const valorTexto = (m: Meta) => (m.indicador === 'faturamento' ? formatar(m.valor, moeda) : `${m.valor} ${t(m.indicador === 'vendas' ? 'venda(s)' : 'atendimento(s)')}`)
  const gravarMeta = async () => {
    if (!ed) return
    const { novo: _n, ...m } = ed
    const itens = ed.novo ? [...c.itens, m] : c.itens.map((x) => (x.id === m.id ? m : x))
    if (await salvar({ itens }, t('Meta salva.'))) setEd(undefined)
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo={t('Onde aparecem')} ajuda="O administrador vê as metas no Painel. A funcionária vê só as dela e as da unidade dela, na tela Vender.">
          <div className="space-y-2">
            <Interruptor ligado={c.painel} onChange={(v) => salvar({ painel: v })} titulo="Mostrar no Painel" texto="O cartão “Metas do mês” com a barra de cada meta." />
            <Interruptor ligado={c.mostrarValor} onChange={(v) => salvar({ mostrarValor: v })} titulo="Mostrar o valor no Painel" texto="Desligado, aparece só a % (ex.: 75%), sem Bs nem quantidade." />
            <Interruptor ligado={c.funcionaria} onChange={(v) => salvar({ funcionaria: v })} titulo="A funcionária vê as metas dela" texto="Na tela Vender: as metas dela e as da unidade dela. As das colegas, nunca." />
            {c.funcionaria && <Interruptor ligado={c.funcionariaValor} onChange={(v) => salvar({ funcionariaValor: v })} titulo="A funcionária vê o valor" texto="Desligado, ela vê só a % da meta (sem o valor em Bs)." />}
          </div>
        </Cartao>
        <Cartao titulo={t('Metas do mês')} acao={<Botao onClick={() => setEd({ id: novoId(), alvo: 'empresa', indicador: 'faturamento', valor: 0, ativa: true, novo: true })}>+ {t('Meta')}</Botao>}
          ajuda="Cada meta vale para o mês corrente e conta as vendas concluídas. Pessoa: as vendas e atendimentos em que ela é a vendedora/profissional.">
          {!c.itens.length ? <Vazio compacto texto="Nenhuma meta ainda. Ex.: Faturamento da empresa Bs 80.000 · Atendimentos da Sofia 60." /> : (
            <ul className="divide-y divide-[var(--borda)]">
              {c.itens.map((m) => (
                <li key={m.id} className={cx('flex min-h-14 items-center gap-3 py-1', !m.ativa && 'opacity-60')}>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEd({ ...m })}>
                    <b className="block truncate text-sm">{m.nome || alvoNome(m)}</b>
                    <span className="block truncate text-xs text-[var(--suave)]">{t(INDICADORES.find((x) => x.id === m.indicador)?.nome ?? '')} · {valorTexto(m)}{m.nome ? ` · ${alvoNome(m)}` : ''}</span>
                  </button>
                  <Chave ligado={m.ativa} rotulo={m.nome || alvoNome(m)} travado={ocupado} onChange={(v) => salvar({ itens: c.itens.map((x) => (x.id === m.id ? { ...x, ativa: v } : x)) })} />
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">{t('Como aparece')}</p>
        <MetasDoMes />
      </div>

      {ed && (
        <JanelaCadastro titulo={ed.novo ? 'Nova meta' : 'Editar meta'} onFechar={() => setEd(undefined)} onSalvar={gravarMeta} ocupado={ocupado}
          podeSalvar={ed.valor > 0 && (ed.alvo === 'empresa' || !!ed.alvoId)}>
          <GrupoCampos titulo="De quem">
            <Campo rotulo="Meta de"><Selecao valor={ed.alvo} onChange={(v) => setEd({ ...ed, alvo: v as Meta['alvo'], alvoId: undefined })} opcoes={[{ id: 'empresa', nome: t('Empresa (tudo)') }, { id: 'unidade', nome: t('Uma unidade') }, { id: 'pessoa', nome: t('Uma pessoa') }]} /></Campo>
            {ed.alvo === 'unidade' && <Campo rotulo="Unidade"><Selecao valor={ed.alvoId} vazio="Escolha…" onChange={(v) => setEd({ ...ed, alvoId: v || undefined })} opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
            {ed.alvo === 'pessoa' && <Campo rotulo="Pessoa"><Selecao valor={ed.alvoId} vazio="Escolha…" onChange={(v) => setEd({ ...ed, alvoId: v || undefined })} opcoes={equipe.map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>}
          </GrupoCampos>
          <GrupoCampos titulo="O quê">
            <Campo rotulo="Medir"><Selecao valor={ed.indicador} onChange={(v) => setEd({ ...ed, indicador: v as Meta['indicador'], valor: 0 })} opcoes={INDICADORES} /></Campo>
            <Campo rotulo="Meta do mês" comoDiv>
              {ed.indicador === 'faturamento'
                ? <ValorInput moeda={moeda} valor={ed.valor || undefined} onChange={(v) => setEd({ ...ed, valor: v ?? 0 })} />
                : <Entrada inputMode="numeric" value={ed.valor || ''} placeholder="60" onChange={(e) => setEd({ ...ed, valor: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}
            </Campo>
            <Campo rotulo="Nome (opcional)" className="sm:col-span-2"><Entrada value={ed.nome ?? ''} placeholder={t('Ex.: Meta do Centro em novembro')} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
          </GrupoCampos>
          {!ed.novo && (
            <Botao variante="perigo" onClick={async () => (await salvar({ itens: c.itens.filter((x) => x.id !== ed.id) }, t('Meta apagada.'))) && setEd(undefined)}>{t('Apagar meta')}</Botao>
          )}
        </JanelaCadastro>
      )}
    </div>
  )
}
