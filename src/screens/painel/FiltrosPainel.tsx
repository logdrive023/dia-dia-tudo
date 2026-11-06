// FILTROS DO PAINEL — o filtro padrão do sistema, sem busca: atalhos de período · Comparar · "⚙ Filtros · N" → painel em
// grupos (moeda, unidade, impostos) com "Limpar · Pronto" → os filtros ligados em chips ✕.
import { useState } from 'react'
import { Campo, Escolha, Selecao, cx } from '../../ui/base'
import { BotaoFiltros, BotaoPeriodo, ChipsFiltros, type FiltroAtivo, GrupoFiltro, PainelFiltros } from '../../ui/filtroPadrao'
import { calcularPeriodo, type Periodo, type Preset } from '../../ui/filtros'
import { useT } from '../../ui/i18n'

const PRESETS: { id: Exclude<Preset, 'livre'>; nome: string }[] = [{ id: 'hoje', nome: 'Hoje' }, { id: '7d', nome: '7 dias' }, { id: '30d', nome: '30 dias' }, { id: 'mes', nome: 'Este mês' }, { id: 'mesPassado', nome: 'Mês passado' }, { id: 'ano', nome: 'Ano' }]

export interface FiltrosPainelProps {
  periodo: Periodo
  setPeriodo(x: Periodo): void
  /** 'convertido' = tudo na moeda principal */
  moeda: string
  setMoeda(x: string): void
  localId: string
  setLocalId(x: string): void
  comparar: boolean
  setComparar(x: boolean): void
  moedas: string[]
  principal: string
  locais: { id: string; nome: string }[]
  /** impostos ligados em Configurações › Fiscal: escolher ver antes ou depois dos impostos */
  impostos?: { valor: 'antes' | 'depois'; onChange(v: 'antes' | 'depois'): void }
}

export function FiltrosPainel(p: FiltrosPainelProps) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  const ativos: FiltroAtivo[] = [
    ...(p.moeda !== 'convertido' ? [{ k: 'moeda', rotulo: `💱 ${t('Só')} ${p.moeda}` }] : []),
    ...(p.localId ? [{ k: 'local', rotulo: `📍 ${p.locais.find((l) => l.id === p.localId)?.nome ?? ''}` }] : []),
    ...(p.impostos?.valor === 'depois' ? [{ k: 'impostos', rotulo: `🧾 ${t('Depois dos impostos')}` }] : []),
  ]
  const tirar = (k: string) => (k === 'moeda' ? p.setMoeda('convertido') : k === 'impostos' ? p.impostos?.onChange('antes') : p.setLocalId(''))
  const limpar = () => (p.setMoeda('convertido'), p.setLocalId(''), p.impostos?.onChange('antes'))
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <BotaoPeriodo obrigatorio de={p.periodo.de} ate={p.periodo.ate} presets={PRESETS.map((x) => x.id)} onChange={(de, ate) => {
          if (!de || !ate) return
          const pr = PRESETS.find((x) => { const c = calcularPeriodo(x.id); return c.de === de && c.ate === ate })
          p.setPeriodo(pr ? calcularPeriodo(pr.id) : { preset: 'livre', de, ate })
        }} />
        <span className="min-w-0 flex-1" />
        <button type="button" role="switch" aria-checked={p.comparar} onClick={() => p.setComparar(!p.comparar)} title={t('Comparar com o período anterior')} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-1 text-sm">
          <span className="hidden text-[var(--suave)] sm:inline">{t('Comparar')}</span>
          <span aria-hidden className={cx('relative h-6 w-11 rounded-full transition-colors', p.comparar ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
            <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', p.comparar ? 'left-[22px]' : 'left-0.5')} />
          </span>
          <span className="sr-only sm:hidden">{t('Comparar')}</span>
        </button>
        <BotaoFiltros ativos={ativos.length} aberto={aberto} onAlternar={() => setAberto(!aberto)} />
      </div>
      {aberto && (
        <PainelFiltros temAtivos={ativos.length > 0} onLimpar={limpar} onFechar={() => setAberto(false)}>
          <GrupoFiltro titulo="Dinheiro e lugar" icone="💱">
            <Campo rotulo="Moeda"><Selecao valor={p.moeda === 'convertido' ? '' : p.moeda} onChange={(v) => p.setMoeda(v || 'convertido')} vazio={`${t('Tudo em')} ${p.principal}`} opcoes={p.moedas.map((m) => ({ id: m, nome: `${t('Só')} ${m}` }))} /></Campo>
            {p.locais.length > 0 && <Campo rotulo="Unidade"><Selecao valor={p.localId} onChange={p.setLocalId} vazio="Todas" opcoes={p.locais.map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
          </GrupoFiltro>
          {p.impostos && (
            <GrupoFiltro titulo="Impostos" icone="🧾">
              <Campo rotulo="Mostrar o resultado" comoDiv><Escolha<'antes' | 'depois'> rotulo="Mostrar o resultado" valor={p.impostos.valor} onChange={p.impostos.onChange} opcoes={[{ id: 'antes', nome: 'Antes dos impostos' }, { id: 'depois', nome: 'Depois dos impostos' }]} /></Campo>
            </GrupoFiltro>
          )}
        </PainelFiltros>
      )}
      <ChipsFiltros itens={ativos} onTirar={tirar} onLimpar={limpar} />
    </div>
  )
}
