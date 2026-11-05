// ENTRADAS × SAÍDAS POR UNIDADE (Equipe, só administrador) — os números de todas as unidades em cima (entradas · saídas
// · margem) e um CARTÃO por unidade com a conta em linhas (LinhaConta): + atendimentos − salários − comissões − cabelo
// − insumos − despesas = margem; cada linha com a barra do quanto pesa sobre as entradas. Embaixo: agendados,
// clientes e salários pagos. A busca do filtro da tela procura a unidade pelo nome.
import { formatar } from '../../core/domain/dinheiro'
import { Carregando, Pilula, Vazio, cx } from '../../ui/base'
import { useApp, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../ui/numeroGrande'
import { LinhaConta, semAcento } from './pecas'

export function Unidades({ de, ate, busca = '', onComissoes }: { de: string; ate: string; busca?: string; onComissoes(): void }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('unidades', { de, ate })
  if (!dados) return <Carregando />
  const m = dados.moeda
  const b = semAcento(busca.trim())
  const lista = dados.lista.filter((u) => (u.local.tipo === 'salao' || u.entradas || u.saidas) && (!b || semAcento(u.local.nome).includes(b)))
  const f = (v: number) => formatar(v, m)
  return (
    <div className="space-y-4">
      <GrupoNumeros colunas={3} celular={3}>
        <NumeroGrande rotulo="Entradas" valor={f(dados.total.entradas)} icone="⬆" tom="bom" onClick={() => ir('vendas', { de, ate })} />
        <NumeroGrande rotulo="Saídas" valor={f(dados.total.saidas)} icone="⬇" tom="ruim" />
        <NumeroGrande rotulo="Margem" valor={f(dados.total.margem)} icone="=" tom={dados.total.margem >= 0 ? 'bom' : 'ruim'} ajuda={t('Salários entram proporcionais aos {n} dias do período (mensal ÷ 30 × dias).', { n: dados.dias })} />
      </GrupoNumeros>
      {!lista.length ? <Vazio texto="Nenhuma unidade com esse nome." /> : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {lista.map((u) => {
            const base = Math.max(u.entradas, u.saidas, 1)
            const parte = (v: number) => v / base
            const pct = u.entradas ? Math.round((u.margem / u.entradas) * 100) : undefined
            return (
              <section key={u.local.id} aria-label={u.local.nome} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
                <header className={cx('flex items-center gap-3 px-4 py-3', u.margem >= 0 ? 'bg-[var(--bom)]/8' : 'bg-[var(--ruim)]/8')}>
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cartao)] text-xl ring-1 ring-[var(--borda)]">🏢</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{u.local.nome}</b>
                    <span className="num block text-xs text-[var(--suave)]">✂️ {u.atendimentos} {t('atend.')} · 👥 {u.funcionarios}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Margem')}</span>
                    <b className={cx('num block text-lg leading-tight', u.margem >= 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{f(u.margem)}</b>
                    {pct !== undefined && <span className="num block text-xs text-[var(--suave)]">{pct}% {t('das entradas')}</span>}
                  </span>
                </header>
                <div className="px-3 py-2">
                  <LinhaConta tom="entra" rotulo={`+ ${t('Entradas (atendimentos)')}`} valor={`+${f(u.entradas)}`} parte={parte(u.entradas)} onClick={() => ir('vendas', { localId: u.local.id, de, ate })} />
                  <LinhaConta tom="sai" rotulo={`− ${t('Salários')}`} detalhe={`${u.funcionarios} · ${f(u.salarioMensal)}/${t('mês')}`} valor={`−${f(u.salarios)}`} parte={parte(u.salarios)} />
                  <LinhaConta tom="sai" rotulo={`− ${t('Comissões')}`} valor={`−${f(u.comissoes)}`} parte={parte(u.comissoes)} onClick={onComissoes} />
                  <LinhaConta tom="sai" rotulo={`− ${t('Cabelo usado')}`} valor={`−${f(u.custoCabelo)}`} parte={parte(u.custoCabelo)} />
                  {u.insumos > 0 && <LinhaConta tom="sai" rotulo={`− ${t('Insumos dos serviços')}`} valor={`−${f(u.insumos)}`} parte={parte(u.insumos)} />}
                  <LinhaConta tom="sai" rotulo={`− ${t('Despesas da unidade')}`} valor={`−${f(u.despesas)}`} parte={parte(u.despesas)} />
                  <LinhaConta tom={u.margem >= 0 ? 'resultado' : 'ruim'} rotulo={`= ${t('Margem')}`} valor={f(u.margem)} />
                </div>
                <footer className="flex flex-wrap gap-1.5 border-t border-[var(--borda)] px-4 py-2.5 text-xs">
                  <button type="button" className="min-h-8" onClick={() => ir('agenda', { localId: u.local.id, modo: 'semana' })}><Pilula tom="marca">📅 {t('Agendados')}: {u.agendados} ›</Pilula></button>
                  <Pilula>👤 {t('Clientes')}: {u.clientes}</Pilula>
                  <Pilula>💵 {t('Salários pagos no período')}: {f(u.salariosPagos)}</Pilula>
                </footer>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
