// NOVIDADES (#/novidades) — só do ADMINISTRADOR (menu, rota e App: SO_ADMIN). O changelog em palavras simples:
//   · os números: quantas mudanças nesta rodada · quantas são novas para você (desde a última visita, neste aparelho)
//   · FiltroLista: busca + tipo (Tudo · Novo · Melhoria · Correção) + chips das áreas, cada uma na sua cor
//   · uma LINHA DO TEMPO: cada rodada é um bloco (a mais recente em destaque), com as mudanças agrupadas por área;
//     cada mudança diz o tipo e, quando dá, "Ver ›" abre a tela onde mudou.

import { useContext, useEffect, useMemo, useState } from 'react'
import { AREAS_NOVIDADE, NOVIDADES, naLingua, type AreaNovidade, type ItemNovidade, type TipoNovidade } from '../model/novidades'
import { Titulo, cx, dataBR } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { FiltroLista } from '../../../shared/ui/filtroPadrao'
import { useLembrado } from '../../../shared/ui/filtros'
import { IdiomaContexto, useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'

const TIPOS: Record<TipoNovidade, { nome: string; icone: string; classe: string }> = {
  novo: { nome: 'Novo', icone: '✨', classe: 'bg-[var(--bom)]/15 text-[var(--bom)]' },
  melhoria: { nome: 'Melhoria', icone: '⬆', classe: 'bg-[var(--marca-suave)] text-[var(--marca)]' },
  correcao: { nome: 'Correção', icone: '🔧', classe: 'bg-[var(--alerta)]/15 text-[var(--alerta)]' },
}
const tipoDe = (i: ItemNovidade): TipoNovidade => i.tipo ?? 'melhoria'

export function Novidades() {
  const t = useT()
  const { ir } = useApp()
  // os textos das novidades vêm nas duas línguas (pt/es) já no arquivo: nada de tradução solta
  const idioma = useContext(IdiomaContexto)
  const L = (x: Parameters<typeof naLingua>[0]) => naLingua(x, idioma)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<'' | TipoNovidade>('')
  const [area, setArea] = useState<'' | AreaNovidade>('')
  // a última rodada que a pessoa já viu (neste aparelho): o que veio depois ganha o selo "novo para você"
  const [vista, setVista] = useLembrado<string>('novidades.vista', '')
  const [vistaAoAbrir] = useState(vista)
  const maisNova = NOVIDADES[0]?.data ?? ''
  useEffect(() => {
    if (maisNova && maisNova !== vista) setVista(maisNova)
  }, [maisNova, vista, setVista])

  const termo = busca.trim().toLowerCase()
  const passa = (i: ItemNovidade) =>
    (!tipo || tipoDe(i) === tipo) && (!area || i.area === area) && (!termo || `${t(i.area)} ${L(i.texto)}`.toLowerCase().includes(termo))
  const todos = NOVIDADES.flatMap((n) => n.itens)
  const achados = todos.filter(passa).length
  const novosParaVoce = NOVIDADES.filter((n) => !vistaAoAbrir || n.data > vistaAoAbrir).reduce((s, n) => s + n.itens.length, 0)
  const areas = useMemo(() => {
    const m = new Map<AreaNovidade, number>()
    for (const i of todos) if ((!tipo || tipoDe(i) === tipo)) m.set(i.area, (m.get(i.area) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [todos, tipo])
  const ativos = [
    ...(area ? [{ k: 'area', rotulo: `${AREAS_NOVIDADE[area].icone} ${t(area)}` }] : []),
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo subtitulo={t('O que mudou no sistema, em palavras simples. "Ver ›" abre a tela onde mudou.')}>{t('Novidades')}</Titulo>

      <GrupoNumeros colunas={3} celular={3}>
        <NumeroGrande rotulo="Nesta rodada" valor={maisNova ? NOVIDADES[0].itens.length : 0} sub={maisNova ? dataBR(maisNova) : undefined} icone="📣" />
        <NumeroGrande rotulo="Novas para você" valor={novosParaVoce} sub={t('desde a última visita')} icone="✨" tom={novosParaVoce ? 'bom' : undefined} />
        <NumeroGrande rotulo="Rodadas" valor={NOVIDADES.length} sub={`${todos.length} ${t('mudanças')}`} icone="🗂" />
      </GrupoNumeros>

      <FiltroLista
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar mudança"
        situacao={{
          valor: tipo,
          onChange: (v) => setTipo(v as '' | TipoNovidade),
          opcoes: [
            { id: '', nome: 'Tudo', n: todos.length },
            ...(Object.keys(TIPOS) as TipoNovidade[]).map((k) => ({ id: k, nome: TIPOS[k].nome, n: todos.filter((i) => tipoDe(i) === k).length })),
          ],
        }}
        ativos={ativos}
        onTirar={() => setArea('')}
        temAtivos={!!(area || tipo || termo)}
        onLimpar={() => (setArea(''), setTipo(''), setBusca(''))}
        resultados={achados}
        total={todos.length}
        unidade="mudança(s)"
      />
      {/* as áreas numa linha própria (ao lado da busca espremiam o campo) */}
      <div className="mt-2">
            <div className="sem-barra -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {areas.map(([a, n]) => {
                const c = AREAS_NOVIDADE[a]
                const sel = area === a
                return (
                  <button key={a} type="button" aria-pressed={sel} onClick={() => setArea(sel ? '' : a)}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold"
                    style={sel ? { background: c.cor, color: '#fff' } : { background: `color-mix(in srgb, ${c.cor} 12%, transparent)`, color: c.cor, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.cor} 35%, transparent)` }}>
                    <span aria-hidden>{c.icone}</span>{t(a)}<span className="num text-xs opacity-75">{n}</span>
                  </button>
                )
              })}
            </div>
      </div>

      {/* a LINHA DO TEMPO das rodadas */}
      <ol className="relative mt-4 space-y-5 border-l-2 border-[var(--borda)] pl-4 xs:pl-5">
        {NOVIDADES.map((n, k) => {
          const itens = n.itens.filter(passa)
          if (!itens.length) return null
          const recente = k === 0
          const nova = !vistaAoAbrir || n.data > vistaAoAbrir
          // as mudanças agrupadas por área (na ordem em que aparecem)
          const porArea = new Map<AreaNovidade, ItemNovidade[]>()
          for (const i of itens) porArea.set(i.area, [...(porArea.get(i.area) ?? []), i])
          return (
            <li key={n.data + n.titulo.pt} className="relative">
              <span aria-hidden className={cx('absolute top-4 h-3.5 w-3.5 rounded-full ring-4 ring-[var(--fundo)]', recente ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')} style={{ left: 'calc(-1rem - 8px)' }} />
              <section aria-label={L(n.titulo)} className={cx('overflow-hidden rounded-2xl border bg-[var(--cartao)] shadow-sm', recente ? 'border-[var(--marca)]/50' : 'border-[var(--borda)]')}>
                <header className={cx('px-4 py-3', recente ? 'bg-[var(--marca-suave)]' : 'bg-[var(--fundo)]')}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="num text-xs font-semibold text-[var(--suave)]">{dataBR(n.data)}</span>
                    {recente && <span className="rounded-full bg-[var(--marca)] px-2 py-0.5 text-[11px] font-bold text-white">{t('Mais recente')}</span>}
                    {nova && <span className="rounded-full bg-[var(--bom)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--bom)]">✨ {t('Novo para você')}</span>}
                    <span className="num ml-auto text-xs text-[var(--suave)]">{itens.length} {t('mudança(s)')}</span>
                  </div>
                  <h2 className="mt-0.5 text-base font-bold leading-snug">{L(n.titulo)}</h2>
                  {n.resumo && <p className="mt-0.5 text-sm text-[var(--suave)]">{L(n.resumo)}</p>}
                </header>
                <div className="space-y-3 p-3">
                  {[...porArea.entries()].map(([a, lista]) => {
                    const c = AREAS_NOVIDADE[a]
                    return (
                      <div key={a} className="rounded-xl" style={{ background: `color-mix(in srgb, ${c.cor} 6%, transparent)`, borderLeft: `3px solid ${c.cor}` }}>
                        <h3 className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.cor }}><span aria-hidden>{c.icone}</span>{t(a)}</h3>
                        <ul className="divide-y divide-[var(--borda)]/60 px-1 pb-1">
                          {lista.map((i, j) => {
                            const tp = TIPOS[tipoDe(i)]
                            return (
                              <li key={j} className="flex flex-wrap items-start gap-x-2 gap-y-1 px-2 py-2 text-sm">
                                <span className={cx('mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', tp.classe)}><span aria-hidden>{tp.icone}</span>{t(tp.nome)}</span>
                                <span className="linha-texto leading-snug">{L(i.texto)}</span>
                                {i.tela && (
                                  <button type="button" onClick={() => ir(i.tela!, i.params ?? {})} className="ml-auto min-h-8 shrink-0 rounded-lg px-2 text-xs font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                                    {t('Ver')} ›
                                  </button>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </section>
            </li>
          )
        })}
      </ol>
      {!achados && <p className="mt-4 rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>}
    </div>
  )
}
