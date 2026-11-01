// PAINEL. Padrões (painéis de gestão como Stripe/Shopify e guias de dashboard SaaS):
//  - filtros num só lugar, em chips de um toque, com o que está ativo visível e "limpar";
//  - primeiro o que pede AÇÃO (pendências com os registros e link direto), depois os números;
//  - números em SEÇÕES com título (Vendas · Dinheiro · Gráficos · Divisões · Áreas), que abrem e fecham;
//  - cada número com a comparação explícita ("vs 30 dias antes") e sem porcentagem absurda quando não há base;
//  - cor só com função: vermelho = urgente, âmbar = atenção.

import { type ReactNode, useState } from 'react'
import { MOEDAS, formatar } from '../core/domain/dinheiro'
import type { Cartao as CartaoDados } from '../core/modulos'
import type { Alerta } from '../core/services/painel'
import { Carregando, Cartao, Entrada, Erro, Info, cx, fmt } from '../ui/base'
import { useApp, useConsulta } from '../ui/contexto'
import { calcularPeriodo, type Periodo, type Preset, useLembrado, usePeriodo } from '../ui/filtros'
import { Barras, Linha, SecaoView } from '../ui/graficos'
import { useT } from '../ui/i18n'

// ---------- filtros em chips ----------

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cx('min-h-9 shrink-0 rounded-full border px-3 text-sm transition-colors', ativo ? 'border-[var(--marca)] bg-[var(--marca)] font-semibold text-white' : 'border-[var(--borda)] text-[var(--texto)] hover:border-[var(--marca)]')}
    >
      {children}
    </button>
  )
}

function Grupo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium text-[var(--suave)]">{rotulo}</span>
      <div className="sem-barra flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">{children}</div>
    </div>
  )
}

function Filtros(p: {
  periodo: Periodo
  setPeriodo(x: Periodo): void
  moeda: string
  setMoeda(x: string): void
  localId: string
  setLocalId(x: string): void
  comparar: boolean
  setComparar(x: boolean): void
  moedas: string[]
  principal: string
  locais: { id: string; nome: string }[]
}) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  const presets: [Preset, string][] = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['mesPassado', 'Mês passado'], ['ano', 'Ano'], ['livre', 'Escolher datas']]
  const nomePeriodo = presets.find(([id]) => id === p.periodo.preset)?.[1] ?? ''
  const ativos = [
    p.moeda !== 'convertido' && { id: 'moeda', rotulo: `${t('Só')} ${p.moeda}`, limpar: () => p.setMoeda('convertido') },
    p.localId && { id: 'local', rotulo: p.locais.find((l) => l.id === p.localId)?.nome ?? '', limpar: () => p.setLocalId('') },
  ].filter(Boolean) as { id: string; rotulo: string; limpar(): void }[]
  return (
    <div className="mb-4 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
      {/* resumo do filtro: sempre visível, um toque abre/fecha */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-h-9 items-center gap-2 rounded-full bg-[var(--marca-suave)] px-3 text-sm font-semibold text-[var(--marca)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M3 5h18M6 12h12M10 19h4" /></svg>
          {t(nomePeriodo)}
          {p.periodo.preset === 'livre' && <span className="num font-normal">· {p.periodo.de.split('-').reverse().join('/')} – {p.periodo.ate.split('-').reverse().join('/')}</span>}
          <span aria-hidden>{aberto ? '▴' : '▾'}</span>
        </button>
        {ativos.map((a) => (
          <span key={a.id} className="flex min-h-9 items-center gap-1 rounded-full border border-[var(--borda)] pl-3 pr-1 text-sm">
            {a.rotulo}
            <button type="button" onClick={a.limpar} aria-label={t('Tirar filtro')} className="h-7 w-7 rounded-full hover:bg-[var(--fundo)]">×</button>
          </span>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <span className="text-[var(--suave)]">{t('Comparar')}</span>
          <button type="button" role="switch" aria-checked={p.comparar} onClick={() => p.setComparar(!p.comparar)} className={cx('relative h-6 w-11 rounded-full transition-colors', p.comparar ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
            <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', p.comparar ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </label>
        {ativos.length > 0 && (
          <button type="button" onClick={() => (p.setMoeda('convertido'), p.setLocalId(''))} className="text-sm font-semibold text-[var(--marca)]">
            {t('Limpar')}
          </button>
        )}
      </div>
      {aberto && (
        <div className="mt-3 space-y-2 border-t border-[var(--borda)] pt-3">
          <Grupo rotulo={t('Período')}>
            {presets.map(([id, nome]) => (
              <Chip key={id} ativo={p.periodo.preset === id} onClick={() => p.setPeriodo(calcularPeriodo(id, p.periodo.de, p.periodo.ate))}>{t(nome)}</Chip>
            ))}
          </Grupo>
          {p.periodo.preset === 'livre' && (
            <div className="flex flex-wrap gap-2 pl-[72px]">
              <Entrada type="date" className="w-auto" value={p.periodo.de} onChange={(e) => p.setPeriodo({ ...p.periodo, de: e.target.value })} />
              <Entrada type="date" className="w-auto" value={p.periodo.ate} onChange={(e) => p.setPeriodo({ ...p.periodo, ate: e.target.value })} />
            </div>
          )}
          <Grupo rotulo={t('Moeda')}>
            <Chip ativo={p.moeda === 'convertido'} onClick={() => p.setMoeda('convertido')}>{t('Tudo em')} {p.principal}</Chip>
            {p.moedas.map((m) => (
              <Chip key={m} ativo={p.moeda === m} onClick={() => p.setMoeda(m)}>{t('Só')} {m}</Chip>
            ))}
          </Grupo>
          {p.locais.length > 0 && (
            <Grupo rotulo={t('Unidade')}>
              <Chip ativo={!p.localId} onClick={() => p.setLocalId('')}>{t('Todas')}</Chip>
              {p.locais.map((l) => (
                <Chip key={l.id} ativo={p.localId === l.id} onClick={() => p.setLocalId(l.id)}>{l.nome}</Chip>
              ))}
            </Grupo>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- seção que abre e fecha ----------

function Secao({ id, titulo, resumo, children, acao }: { id: string; titulo: string; resumo?: ReactNode; children: ReactNode; acao?: ReactNode }) {
  const t = useT()
  const [fechadas, setFechadas] = useLembrado<string[]>('painel.fechadas', [])
  const aberta = !fechadas.includes(id)
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => setFechadas(aberta ? [...fechadas, id] : fechadas.filter((x) => x !== id))} aria-expanded={aberta} className="flex min-h-9 items-center gap-2 rounded-lg pr-2 text-left">
          <span className={cx('inline-block text-[var(--suave)] transition-transform', aberta ? 'rotate-90' : '')} aria-hidden>›</span>
          <h2 className="text-base font-bold">{t(titulo)}</h2>
        </button>
        {!aberta && resumo && <span className="num truncate text-sm text-[var(--suave)]">{resumo}</span>}
        <span className="ml-auto">{acao}</span>
      </div>
      {aberta && children}
    </section>
  )
}

// ---------- número ----------

/** Variação só quando a base existe e é comparável; acima de ±500% vira "muito acima/abaixo". */
function Variacao({ atual, anterior }: { atual: number; anterior?: number }) {
  const t = useT()
  if (anterior === undefined) return null
  if (anterior <= 0) return <span className="text-xs text-[var(--suave)]">{t('sem base anterior')}</span>
  const v = Math.round(((atual - anterior) / anterior) * 100)
  const sobe = v >= 0
  return (
    <span className={cx('num text-xs font-semibold', sobe ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>
      {sobe ? '↑' : '↓'} {Math.abs(v) > 500 ? t(sobe ? 'muito acima' : 'muito abaixo') : `${Math.abs(v)}%`}
    </span>
  )
}

function Numero({ c, sub, grande }: { c?: CartaoDados; sub?: ReactNode; grande?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  if (!c) return null
  const cor = c.destaque === 'ruim' ? 'text-[var(--ruim)]' : c.destaque === 'alerta' ? 'text-[var(--alerta)]' : ''
  const abrir = () => c.detalhe && ir(c.detalhe.tela, c.detalhe.filtro)
  // div (e não button): o ⓘ dentro também é botão, e botão dentro de botão não vale
  return (
    <div
      role={c.detalhe ? 'button' : undefined}
      tabIndex={c.detalhe ? 0 : undefined}
      onClick={abrir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir())}
      className={cx('group rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-left transition-colors', c.detalhe && 'cursor-pointer hover:border-[var(--marca)]')}
    >
      <div className="flex items-center gap-1 text-sm text-[var(--suave)]">
        {t(c.nome)}
        <Info texto={c.ajuda} />
      </div>
      <div className={cx('num mt-1 font-bold tracking-tight', grande ? 'text-3xl' : 'text-2xl', cor)}>{fmt(c.valor, c.formato, c.moeda)}</div>
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 text-sm text-[var(--suave)]">
        <Variacao atual={c.valor} anterior={c.anterior} />
        {sub}
      </div>
    </div>
  )
}

// ---------- atenção agora ----------

const NIVEL = {
  urgente: { cor: 'var(--ruim)', nome: 'Urgente' },
  atencao: { cor: 'var(--alerta)', nome: 'Atenção' },
  info: { cor: 'var(--suave)', nome: 'Para acompanhar' },
} as const

function AtencaoAgora({ alertas, moeda }: { alertas: Alerta[]; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState<string | undefined>(alertas[0]?.id)
  if (!alertas.length)
    return <p className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-sm text-[var(--bom)]">✓ {t('Nada pendente. Tudo em dia.')}</p>
  return (
    <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
      {alertas.map((a) => {
        const abrir = aberto === a.id
        return (
          <li key={a.id} className="relative">
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: NIVEL[a.nivel].cor }} aria-hidden />
            <button type="button" onClick={() => setAberto(abrir ? undefined : a.id)} aria-expanded={abrir} className="flex w-full items-center gap-3 py-3 pl-5 pr-4 text-left hover:bg-[var(--fundo)]">
              <span className="num flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold" style={{ background: `color-mix(in srgb, ${NIVEL[a.nivel].cor} 15%, transparent)`, color: NIVEL[a.nivel].cor }}>{a.quantidade}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(a.titulo)}</span>
                {a.acao && <span className="block text-sm text-[var(--suave)]">{t(a.acao)}</span>}
              </span>
              {a.valor !== undefined && <span className="num hidden shrink-0 font-semibold sm:block">{formatar(a.valor, moeda)}</span>}
              <span className={cx('text-[var(--suave)] transition-transform', abrir && 'rotate-90')} aria-hidden>›</span>
            </button>
            {abrir && (
              <div className="pb-3 pl-5 pr-4">
                {a.itens.length > 0 && (
                  <ul className="mb-2 overflow-hidden rounded-xl border border-[var(--borda)]">
                    {a.itens.slice(0, 5).map((i, k) => (
                      <li key={k}>
                        <button type="button" onClick={() => ir(i.detalhe.tela, i.detalhe.filtro)} className="flex w-full items-center gap-3 border-t border-[var(--borda)] px-3 py-2 text-left text-sm first:border-t-0 hover:bg-[var(--marca-suave)]">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{i.texto}</span>
                            {i.sub && <span className="block truncate text-xs text-[var(--suave)]">{i.sub}</span>}
                          </span>
                          {i.valor !== undefined && <span className="num shrink-0">{formatar(i.valor, moeda)}</span>}
                          <span className="shrink-0 text-[var(--marca)]" aria-hidden>→</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {a.detalhe && (
                  <button type="button" onClick={() => ir(a.detalhe!.tela, a.detalhe!.filtro)} className="text-sm font-semibold text-[var(--marca)]">
                    {a.quantidade > 5 ? t('Ver todos ({n}) →', { n: a.quantidade }) : t('Abrir a lista →')}
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- tela ----------

export function Painel() {
  const t = useT()
  const { ir, nav } = useApp()
  const [periodo, setPeriodo] = usePeriodo()
  const [comparar, setComparar] = useLembrado('painel.comparar', true)
  const [moeda, setMoeda] = useLembrado('painel.moeda', 'convertido')
  const [area, setArea] = useLembrado<string>('painel.area', '')
  const [localId, setLocalId] = useLembrado<string>('painel.local', '')
  const areaAtual = (nav.params.area as string | undefined) ?? area
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: locais } = useConsulta('locais', {})
  const moedaFiltro = moeda !== 'convertido' && !cfg?.config.moedasAtivas.includes(moeda) ? 'convertido' : moeda
  const { dados: p, erro } = useConsulta('painel', { de: periodo.de, ate: periodo.ate, comparar, moeda: moedaFiltro, area: areaAtual || undefined, localId: localId || undefined })
  const ativos = cfg ? cfg.modulos.filter((m) => cfg.config.modulosAtivos.includes(m.id) && (m.temVenda || m.telaPropria)) : []
  const principal = cfg?.config.moedaPrincipal ?? 'BOB'
  const c = (id: string) => p?.cartoes.find((x) => x.id === id)
  const fmtC = (id: string) => (c(id) ? fmt(c(id)!.valor, c(id)!.formato, c(id)!.moeda) : '')

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('Painel')}</h1>
          <p className="text-sm text-[var(--suave)]">{t('Toque em qualquer número para ver de onde ele vem.')}</p>
        </div>
      </div>

      <Filtros
        periodo={periodo}
        setPeriodo={setPeriodo}
        moeda={moedaFiltro}
        setMoeda={setMoeda}
        localId={localId}
        setLocalId={setLocalId}
        comparar={comparar}
        setComparar={setComparar}
        moedas={(cfg?.config.moedasAtivas ?? []).filter((m) => MOEDAS.some((x) => x.codigo === m))}
        principal={principal}
        locais={(locais ?? []).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome }))}
      />

      {/* áreas: abas simples */}
      <div role="tablist" className="sem-barra mb-5 flex gap-1 overflow-x-auto border-b border-[var(--borda)]">
        {[{ id: '', nome: 'Visão geral', icone: '' }, ...ativos.map((m) => ({ id: m.id, nome: m.nome, icone: m.icone }))].map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={areaAtual === a.id}
            type="button"
            onClick={() => (setArea(a.id), ir('painel', { area: a.id || undefined }))}
            className={cx('-mb-px min-h-10 shrink-0 border-b-2 px-3 text-sm', areaAtual === a.id ? 'border-[var(--marca)] font-semibold text-[var(--marca)]' : 'border-transparent text-[var(--suave)] hover:text-[var(--texto)]')}
          >
            {a.icone && <span className="mr-1" aria-hidden>{a.icone}</span>}
            {t(a.nome)}
          </button>
        ))}
      </div>

      <Erro texto={erro} />
      {!p ? (
        <Carregando />
      ) : (
        <>
          {!areaAtual && (
            <Secao id="atencao" titulo="Atenção agora" resumo={t('{n} pendência(s)', { n: p.alertas.reduce((s, a) => s + a.quantidade, 0) })}>
              <AtencaoAgora alertas={p.alertas} moeda={principal} />
            </Secao>
          )}

          <Secao id="vendas" titulo="Vendas" resumo={`${fmtC('faturamento')} · ${t('lucro')} ${fmtC('lucro')}`} acao={comparar && <span className="text-xs text-[var(--suave)]">{t('vs período anterior')}</span>}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Numero c={c('faturamento')} grande />
              <Numero c={c('lucro')} grande sub={c('margem') && <span>{t('margem')} {fmt(c('margem')!.valor, 'percentual')}</span>} />
              <Numero c={c('vendas')} sub={c('ticket') && <span>{t('ticket')} {fmtC('ticket')}</span>} />
              <Numero c={c('compras')} />
            </div>
          </Secao>

          <Secao id="dinheiro" titulo="Dinheiro" resumo={`${t('caixa')} ${fmtC('caixa')}`}>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.3fr]">
              <Numero c={c('caixa')} />
              <Numero c={c('receber')} />
              <Numero c={c('pagar')} />
              <Cartao titulo={t('Por moeda')} ajuda="Dinheiro na mão (efectivo) e no banco (QR, Pix, cartão), em cada moeda.">
                <ul className="space-y-2 text-sm">
                  {p.caixa.map((m) => (
                    <li key={m.moeda} className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{m.moeda}</span>
                      <span className="num text-right">
                        <b>{formatar(m.total, m.moeda)}</b>
                        <span className="block text-xs text-[var(--suave)]">{t('mão')} {formatar(m.mao, m.moeda)} · {t('banco')} {formatar(m.banco, m.moeda)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            </div>
          </Secao>

          <Secao id="evolucao" titulo="Evolução no período">
            <Cartao>
              <Linha serie={p.serie} anterior={p.serieAnterior} formato="dinheiro" moeda={p.moedaVis} />
            </Cartao>
          </Secao>

          {!areaAtual && (
            <Secao id="divisoes" titulo="De onde vem o dinheiro">
              <div className="grid gap-3 md:grid-cols-3">
                <Cartao titulo={t('Por área')}>
                  <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porArea.map((a) => ({ rotulo: `${a.icone} ${t(a.nome)}`, valor: a.valor, onClick: () => ir('painel', { area: a.id }) }))} />
                </Cartao>
                <Cartao titulo={t('Por forma de pagamento')}>
                  <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porForma.map((f) => ({ rotulo: t(f.nome), valor: f.valor, onClick: () => ir('vendas', { de: periodo.de, ate: periodo.ate, forma: f.id }) }))} />
                </Cartao>
                <Cartao titulo={t('Por moeda recebida')} ajuda="Quanto entrou em cada moeda e quanto isso vale convertido.">
                  <ul className="space-y-1 text-sm">
                    {p.porMoeda.map((m) => (
                      <li key={m.moeda} className="flex justify-between border-b border-[var(--borda)] py-1 last:border-0">
                        <span className="num">{formatar(m.valor, m.moeda)}</span>
                        <span className="num text-[var(--suave)]">≈ {formatar(m.principal, principal)}</span>
                      </li>
                    ))}
                  </ul>
                </Cartao>
              </div>
            </Secao>
          )}

          {p.areas.map((a) => (
            <Secao key={a.id} id={`area-${a.id}`} titulo={`${a.icone} ${a.nome}`}>
              <div className="grid gap-3 lg:grid-cols-2">
                {a.secoes.map((s, i) => (
                  <div key={i} className={s.tipo === 'cartoes' ? 'lg:col-span-2' : ''}>
                    <SecaoView s={s} moeda={principal} />
                  </div>
                ))}
              </div>
            </Secao>
          ))}
        </>
      )}
    </div>
  )
}
