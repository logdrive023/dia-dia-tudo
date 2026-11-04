// PAINEL — a porta de entrada. Baseado em padrões reais (Shopify/Stripe: "ver rápido e agir rápido", notificações do
// que pede ação + poucos números com comparação; Stephen Few: o essencial à vista, por exceção; NN/g: divulgação
// progressiva e cor forte só para o que importa). A ordem responde às perguntas de quem abre o sistema de manhã:
//  1. O QUE PRECISA DE MIM? — pendências (urgente/atenção), fechadas numa linha cada; tocar abre os registros;
//  2. COMO ESTÁ A OPERAÇÃO? — o caminho do cabelo (compras → triagem → estoque → etiqueta) com o MESMO número de
//     cada tela e o que trava cada etapa; tocar abre o módulo;
//  3. COMO ESTÁ INDO? — vendas e lucro do período, com a comparação ao período anterior, e a evolução;
//  4. o resto (dinheiro, de onde vem, viagens, áreas) em seções que abrem e fecham — as secundárias começam fechadas.
// Cor só com função: vermelho = urgente/travado, âmbar = atenção, verde = em dia. Nada simulado: sem dado, não aparece.

import { type ReactNode, useState } from 'react'
import { CodigoTexto } from '../ui/codigos'
import { BarraLimite } from '../ui/barras'
import { MOEDAS, formatar } from '../core/domain/dinheiro'
import type { Cartao as CartaoDados } from '../core/modulos'
import type { Alerta } from '../core/services/painel'
import { Abas, Campo, Carregando, Cartao, Entrada, Erro, Info, Selecao, Titulo, cx, fmt, gramasTexto, moedaPadrao, Pilula, Vazio } from '../ui/base'
import { AtalhosChips, BotaoFiltros, CampoFaixa, ChipsFiltros, type FiltroAtivo, GrupoFiltro, PainelFiltros } from '../ui/filtroPadrao'
import { NumeroGrande, type Selo } from '../ui/numeroGrande'
import { useApp, useConsulta } from '../ui/contexto'
import { calcularPeriodo, type Periodo, type Preset, useLembrado, usePeriodo } from '../ui/filtros'
import { Barras, Linha, SecaoView } from '../ui/graficos'
import { useT } from '../ui/i18n'

// ---------- filtros (FILTRO PADRÃO do sistema, sem busca) ----------

const PRESETS: { id: Exclude<Preset, 'livre'>; nome: string }[] = [{ id: 'hoje', nome: 'Hoje' }, { id: '7d', nome: '7 dias' }, { id: '30d', nome: '30 dias' }, { id: 'mes', nome: 'Este mês' }, { id: 'mesPassado', nome: 'Mês passado' }, { id: 'ano', nome: 'Ano' }]

/**
 * O mesmo jeito das outras telas: atalhos de período (chips de um toque) · Comparar · "⚙ Filtros · N" → painel em grupos
 * (datas livres, moeda, unidade) com "Limpar · Pronto" → os filtros ligados em chips ✕. Datas livres = "Escolher datas".
 */
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
  const livre = p.periodo.preset === 'livre'
  const dataBr = (d: string) => d.split('-').reverse().join('/')
  const ativos: FiltroAtivo[] = [
    ...(livre ? [{ k: 'datas', rotulo: `📅 ${dataBr(p.periodo.de)} – ${dataBr(p.periodo.ate)}` }] : []),
    ...(p.moeda !== 'convertido' ? [{ k: 'moeda', rotulo: `💱 ${t('Só')} ${p.moeda}` }] : []),
    ...(p.localId ? [{ k: 'local', rotulo: `📍 ${p.locais.find((l) => l.id === p.localId)?.nome ?? ''}` }] : []),
  ]
  const tirar = (k: string) => (k === 'datas' ? p.setPeriodo(calcularPeriodo('30d')) : k === 'moeda' ? p.setMoeda('convertido') : p.setLocalId(''))
  const limpar = () => (p.setMoeda('convertido'), p.setLocalId(''), livre && p.setPeriodo(calcularPeriodo('30d')))
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><AtalhosChips rotulo="Período" icone="📅" valor={livre ? '' : p.periodo.preset} umaLinha opcoes={PRESETS} onChange={(id) => p.setPeriodo(calcularPeriodo(id as Preset))} /></div>
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
          <GrupoFiltro titulo="Período" icone="📅">
            <CampoFaixa rotulo="Escolher datas">
              <Entrada type="date" aria-label={t('De')} value={p.periodo.de} max={p.periodo.ate} onChange={(e) => e.target.value && p.setPeriodo({ preset: 'livre', de: e.target.value, ate: p.periodo.ate })} />
              <Entrada type="date" aria-label={t('Até')} value={p.periodo.ate} min={p.periodo.de} onChange={(e) => e.target.value && p.setPeriodo({ preset: 'livre', de: p.periodo.de, ate: e.target.value })} />
            </CampoFaixa>
          </GrupoFiltro>
          <GrupoFiltro titulo="Dinheiro e lugar" icone="💱">
            <Campo rotulo="Moeda"><Selecao valor={p.moeda === 'convertido' ? '' : p.moeda} onChange={(v) => p.setMoeda(v || 'convertido')} vazio={`${t('Tudo em')} ${p.principal}`} opcoes={p.moedas.map((m) => ({ id: m, nome: `${t('Só')} ${m}` }))} /></Campo>
            {p.locais.length > 0 && <Campo rotulo="Unidade"><Selecao valor={p.localId} onChange={p.setLocalId} vazio="Todas" opcoes={p.locais.map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
          </GrupoFiltro>
        </PainelFiltros>
      )}
      <ChipsFiltros itens={ativos} onTirar={tirar} onLimpar={limpar} />
    </div>
  )
}

// ---------- seção que abre e fecha ----------

/** `fechadaPadrao`: seção secundária, começa fechada (abre e fica lembrado). `subtitulo`: uma linha do que ela responde. */
function Secao({ id, titulo, subtitulo, resumo, children, acao, fechadaPadrao }: { id: string; titulo: string; subtitulo?: string; resumo?: ReactNode; children: ReactNode; acao?: ReactNode; fechadaPadrao?: boolean }) {
  const t = useT()
  const [fechadas, setFechadas] = useLembrado<string[]>('painel.fechadas', [])
  const [abertas, setAbertas] = useLembrado<string[]>('painel.abertas', [])
  const aberta = fechadaPadrao ? abertas.includes(id) : !fechadas.includes(id)
  const alternar = () => (fechadaPadrao
    ? setAbertas(aberta ? abertas.filter((x) => x !== id) : [...abertas, id])
    : setFechadas(aberta ? [...fechadas, id] : fechadas.filter((x) => x !== id)))
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={alternar} aria-expanded={aberta} className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg pr-2 text-left">
          <span className={cx('inline-block text-[var(--suave)] transition-transform', aberta ? 'rotate-90' : '')} aria-hidden>›</span>
          <span className="min-w-min">
            <h2 className="text-base font-bold">{t(titulo)}</h2>
            {aberta && subtitulo && <span className="block text-xs text-[var(--suave)]">{t(subtitulo)}</span>}
          </span>
        </button>
        {!aberta && resumo && <span className="num truncate text-sm text-[var(--suave)]">{resumo}</span>}
        <span className="ml-auto">{acao}</span>
      </div>
      {aberta && children}
    </section>
  )
}

// ---------- número ----------

/** Variação em selo, só quando a base existe e é comparável; acima de ±500% vira "muito acima/abaixo". */
function seloVariacao(t: ReturnType<typeof useT>, atual: number, anterior?: number): Selo | undefined {
  if (anterior === undefined) return undefined
  if (anterior <= 0) return { texto: t('sem base anterior') }
  const v = Math.round(((atual - anterior) / anterior) * 100)
  const sobe = v >= 0
  return { texto: `${sobe ? '↑' : '↓'} ${Math.abs(v) > 500 ? t(sobe ? 'muito acima' : 'muito abaixo') : `${Math.abs(v)}%`}`, tom: sobe ? 'bom' : 'ruim' }
}

/** Um número do painel no cartão padrão do sistema (NumeroGrande): ⓘ, valor, variação e detalhe em selos; tocar abre a lista. */
/** `neutro`: subir ou descer não é bom nem ruim (ex.: compras) → a variação fica cinza */
function Numero({ c, sub, icone, neutro }: { c?: CartaoDados; sub?: string; icone?: string; neutro?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  if (!c) return null
  const v = seloVariacao(t, c.valor, c.anterior)
  const variacao = v && neutro ? { texto: v.texto } : v
  const selos = [...(variacao ? [variacao] : []), ...(sub ? [{ texto: sub }] : [])]
  return (
    <NumeroGrande rotulo={c.nome} icone={icone} ajuda={c.ajuda} valor={fmt(c.valor, c.formato, c.moeda)} selos={selos}
      tom={c.destaque === 'ruim' ? 'ruim' : c.destaque === 'alerta' ? 'alerta' : undefined}
      onClick={c.detalhe ? () => ir(c.detalhe!.tela, c.detalhe!.filtro) : undefined} />
  )
}

// ---------- operação do cabelo: o caminho compra → triagem → estoque → etiqueta ----------

/**
 * Quatro cartões, um por etapa, com o MESMO número da tela do módulo (consulta `operacao`, que lê as consultas de cada
 * tela) e o que trava a etapa em selo colorido. Não depende do período: é a foto de agora. Tocar abre o módulo.
 */
function OperacaoCabelo() {
  const t = useT()
  const { ir } = useApp()
  const { dados: o, erro } = useConsulta('operacao', {})
  if (erro) return <Erro texto={erro} />
  if (o === null) return null
  const m = moedaPadrao()
  const carregando = o === undefined
  const ok = (texto: string): Selo => ({ texto: `✓ ${t(texto)}`, tom: 'bom' })
  const cartoes = o ? [
    {
      id: 'comprar', rotulo: 'Compras em aberto', icone: '🛒', cor: 'var(--marca)', valor: String(o.compras.abertas),
      ajuda: 'Pedidos que ainda não terminaram (falta pagar, receber ou conferir). O cabelo já vai para a triagem quando a compra é registrada.',
      selos: [
        ...(o.compras.abertas ? [{ texto: `${gramasTexto(o.compras.gramas)} · ${formatar(o.compras.valor, m)}` }] : []),
        ...(o.compras.paradas ? [{ texto: `⏰ ${t('{n} parada(s) na triagem', { n: o.compras.paradas })}`, tom: 'ruim' as const }] : []),
        ...(o.compras.urgentes ? [{ texto: `● ${t('{n} urgente(s)', { n: o.compras.urgentes })}`, tom: 'ruim' as const }] : []),
        ...(!o.compras.paradas && !o.compras.urgentes ? [ok('nada parado')] : []),
      ],
      tom: o.compras.urgentes || o.compras.paradas ? 'ruim' as const : undefined,
      abrir: () => ir('comprar'),
    },
    {
      id: 'triagem', rotulo: 'Para separar', icone: '✂️', cor: 'var(--alerta)', valor: o.triagem.separar ? gramasTexto(o.triagem.gramas) : t('Tudo separado ✓'),
      ajuda: 'Cabelo bruto esperando a triagem (separar por medida). Parado = esperando há mais dias do que o combinado em Configurações.',
      selos: [
        ...(o.triagem.separar ? [{ texto: t('{n} pacote(s)', { n: o.triagem.separar }) }] : []),
        ...(o.triagem.parados ? [{ texto: `⏰ ${t('{n} parado(s)', { n: o.triagem.parados })}`, tom: 'ruim' as const }] : []),
        ...(o.triagem.paraDepois ? [{ texto: `❓ ${t('{n} para depois', { n: o.triagem.paraDepois })}`, tom: 'alerta' as const }] : []),
        ...(!o.triagem.separar && !o.triagem.paraDepois ? [ok('nada esperando')] : []),
      ],
      tom: o.triagem.parados ? 'ruim' as const : undefined,
      abrir: () => ir('triagem'),
    },
    {
      id: 'estoque', rotulo: 'Pronto para vender', icone: '📦', cor: 'var(--bom)', valor: gramasTexto(o.estoque.disponivel),
      ajuda: 'Cabelo já separado, com saldo, no estoque. O valor é pela tabela de preço. Ex.: 2 kg × 17,5 = Bs 35.000.',
      selos: [
        { texto: t('{n} lote(s)', { n: o.estoque.lotes }) },
        ...(o.estoque.prontoValor ? [{ texto: formatar(o.estoque.prontoValor, m), tom: 'bom' as const }] : []),
      ],
      abrir: () => ir('estoque', { status: 'separado' }),
    },
    {
      id: 'etiquetas', rotulo: 'Sem etiqueta', icone: '🏷', cor: o.etiqueta.sem ? 'var(--alerta)' : 'var(--bom)', valor: String(o.etiqueta.sem),
      ajuda: 'Pacotes com saldo que ainda não têm etiqueta, ou cuja etiqueta mostra um peso que não bate mais (vendeu parte).',
      selos: [
        ...(o.etiqueta.sem ? [{ texto: `🖨 ${t('falta imprimir')}`, tom: 'alerta' as const }] : [ok('tudo em dia')]),
        ...(o.etiqueta.velhas ? [{ texto: `⚖ ${t('{n} peso mudou', { n: o.etiqueta.velhas })}`, tom: 'ruim' as const }] : []),
      ],
      tom: o.etiqueta.sem ? 'alerta' as const : undefined,
      abrir: () => ir('etiquetas'),
    },
  ] : []
  return (
    <Secao id="operacao" titulo="Operação do cabelo" subtitulo="Agora: compra → triagem → estoque → etiqueta. Toque para abrir.">
      <ol className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-busy={carregando}>
        {carregando
          ? ['Compras em aberto', 'Para separar', 'Pronto para vender', 'Sem etiqueta'].map((r) => <li key={r}><NumeroGrande rotulo={r} valor="…" /></li>)
          : cartoes.map((c, k) => (
            <li key={c.id} className="relative">
              <NumeroGrande rotulo={c.rotulo} icone={c.icone} cor={c.cor} valor={c.valor} selos={c.selos} ajuda={c.ajuda} colorirValor={!!c.tom} onClick={c.abrir} />
              {/* a seta entre as etapas (computador): o caminho do cabelo */}
              {k < cartoes.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--borda)] bg-[var(--cartao)] text-[11px] text-[var(--suave)] lg:flex">→</span>}
            </li>
          ))}
      </ol>
    </Secao>
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
  // tudo fechado numa linha cada (contagem · o quê · o que fazer); tocar abre os registros. Até 3 à vista; o resto em "Mais"
  const [aberto, setAberto] = useState<string>()
  const [todos, setTodos] = useState(false)
  if (!alertas.length)
    return <p className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-sm text-[var(--bom)]">✓ {t('Nada pendente. Tudo em dia.')}</p>
  const visiveis = todos ? alertas : alertas.slice(0, MAX_ALERTAS)
  return (
    <>
    <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
      {visiveis.map((a) => {
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
    {alertas.length > MAX_ALERTAS && (
      <button type="button" onClick={() => setTodos(!todos)} aria-expanded={todos} className="mt-1 min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
        {todos ? t('Mostrar menos') : t('Mais {n} pendência(s)', { n: alertas.length - MAX_ALERTAS })}
      </button>
    )}
    </>
  )
}
const MAX_ALERTAS = 3

/** "2 urgentes · 3 atenção" (o título da seção fechada e a linha de cima) */
function resumoAlertas(t: ReturnType<typeof useT>, alertas: Alerta[]) {
  const n = (nivel: Alerta['nivel']) => alertas.filter((a) => a.nivel === nivel).reduce((s, a) => s + a.quantidade, 0)
  const u = n('urgente')
  const a = n('atencao')
  return [u && t('{n} urgente(s)', { n: u }), a && t('{n} de atenção', { n: a })].filter(Boolean).join(' · ') || t('{n} pendência(s)', { n: n('info') })
}

// ---------- tela ----------

export function Painel() {
  const t = useT()
  const { ir, nav, ajustarParams } = useApp()
  const [periodo, setPeriodo] = usePeriodo()
  const [comparar, setComparar] = useLembrado('painel.comparar', true)
  const [moeda, setMoeda] = useLembrado('painel.moeda', 'convertido')
  const [area, setArea] = useLembrado<string>('painel.area', '')
  const [localId, setLocalId] = useLembrado<string>('painel.local', '')
  const areaAtual = (nav.params.area as string | undefined) ?? area
  const escolherArea = (id: string) => (setArea(id), ajustarParams({ area: id || undefined }))
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: locais } = useConsulta('locais', {})
  const moedaFiltro = moeda !== 'convertido' && !cfg?.config.moedasAtivas.includes(moeda) ? 'convertido' : moeda
  const { dados: p, erro } = useConsulta('painel', { de: periodo.de, ate: periodo.ate, comparar, moeda: moedaFiltro, area: areaAtual && areaAtual !== 'viagens' ? areaAtual : undefined, localId: localId || undefined })
  const ativos = cfg ? cfg.modulos.filter((m) => cfg.config.modulosAtivos.includes(m.id) && (m.temVenda || m.telaPropria)) : []
  const principal = cfg?.config.moedaPrincipal ?? moedaPadrao()
  const c = (id: string) => p?.cartoes.find((x) => x.id === id)
  const fmtC = (id: string) => (c(id) ? fmt(c(id)!.valor, c(id)!.formato, c(id)!.moeda) : '')

  return (
    <div>
      <Titulo subtitulo={t('O que pede você, a operação e as vendas. Toque num número para ver de onde vem.')}>{t('Painel')}</Titulo>

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
      <Abas variante="sublinhado" atual={areaAtual} onChange={escolherArea} abas={[{ id: '', nome: 'Visão geral' }, ...ativos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` })), { id: 'viagens', nome: '✈️ Viagens' }]} />

      <Erro texto={erro} />
      {!p ? (
        <Carregando />
      ) : (
        <>
          {/* 1. O QUE PRECISA DE VOCÊ (só na visão geral) */}
          {!areaAtual && (
            <Secao id="atencao" titulo="Precisa de você" subtitulo="O que está atrasado ou travado. Toque para ver os registros." resumo={resumoAlertas(t, p.alertas)}>
              <AtencaoAgora alertas={p.alertas} moeda={principal} />
            </Secao>
          )}

          {/* 2. COMO ESTÁ A OPERAÇÃO (o caminho do cabelo; foto de agora) */}
          {(!areaAtual || areaAtual === 'cabelo') && <OperacaoCabelo />}

          {/* 3. COMO ESTÃO AS VENDAS (do período escolhido, com a comparação) */}
          <Secao id="vendas" titulo="Vendas" subtitulo={comparar ? 'No período escolhido, comparado com o período anterior do mesmo tamanho.' : 'No período escolhido.'} resumo={`${fmtC('faturamento')} · ${t('lucro')} ${fmtC('lucro')}`}>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
              <Numero c={c('faturamento')} icone="💰" />
              <Numero c={c('lucro')} icone="📈" sub={c('margem') && `${t('margem')} ${fmt(c('margem')!.valor, 'percentual')}`} />
              <Numero c={c('vendas')} icone="🧾" sub={c('ticket') && `${t('ticket')} ${fmtC('ticket')}`} />
              <Numero c={c('compras')} icone="🛒" neutro />
            </div>
          </Secao>

          <Secao id="evolucao" titulo="Evolução no período" subtitulo="Faturamento por dia; a linha clara é o período anterior.">
            <Cartao>
              <Linha serie={p.serie} anterior={p.serieAnterior} formato="dinheiro" moeda={p.moedaVis} />
            </Cartao>
          </Secao>

          {/* 4. O RESTO, sob demanda */}
          <Secao id="dinheiro" titulo="Dinheiro" subtitulo="Caixa de agora e o que falta receber ou pagar (não depende do período)." resumo={`${t('caixa')} ${fmtC('caixa')}`}>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[1fr_1fr_1fr_1.3fr]">
              <Numero c={c('caixa')} icone="💵" />
              <Numero c={c('receber')} icone="⬇️" />
              <Numero c={c('pagar')} icone="⬆️" />
              <Cartao className="col-span-2 lg:col-span-1" titulo={t('Por moeda')} ajuda="Dinheiro na mão (efectivo) e no banco (QR, Pix, cartão), em cada moeda.">
                <ul className="space-y-2 text-sm">
                  {p.caixa.map((m) => (
                    <li key={m.moeda} className="flex items-center justify-between gap-2">
                      <span className="shrink-0 font-semibold">{m.moeda}</span>
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

          {!areaAtual && (
            <Secao id="divisoes" titulo="De onde vem o dinheiro" subtitulo="Por área, forma de pagamento e moeda." fechadaPadrao>
              <div className="grid gap-3 md:grid-cols-3">
                <Cartao titulo={t('Por área')}>
                  <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porArea.map((a) => ({ rotulo: `${a.icone} ${t(a.nome)}`, valor: a.valor, onClick: () => escolherArea(a.id) }))} />
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

          {(!areaAtual || areaAtual === 'viagens') && <PainelViagens de={periodo.de} ate={periodo.ate} completo={areaAtual === 'viagens'} />}

          {p.areas.map((a) => (
            <Secao key={a.id} id={`area-${a.id}`} titulo={`${a.icone} ${t(a.nome)}`} fechadaPadrao={!areaAtual}>
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

// ---------- viagens de compra (custo da logística em destaque) ----------

function PainelViagens({ de, ate, completo }: { de: string; ate: string; completo?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('viagens', {})
  if (!dados) return null
  if (!dados.linhas.length && !completo) return null
  const m = dados.moeda
  // viagens que tocam o período do painel (as abertas sempre entram)
  const doPeriodo = dados.linhas.filter((v) => v.status === 'aberta' || (v.inicio <= ate && (v.fim ?? v.inicio) >= de))
  const abertas = doPeriodo.filter((v) => v.status === 'aberta')
  const gasto = doPeriodo.reduce((s, v) => s + v.gasto, 0)
  const cabelo = doPeriodo.reduce((s, v) => s + v.custoCabelo, 0)
  const gramas = doPeriodo.reduce((s, v) => s + v.gramas, 0)
  const resultado = doPeriodo.reduce((s, v) => s + v.resultado, 0)
  const comRoi = doPeriodo.filter((v) => v.roiBp !== undefined)
  const roi = comRoi.length ? Math.round(comRoi.reduce((s, v) => s + (v.roiBp ?? 0), 0) / comRoi.length) : undefined
  const pct = (bp?: number) => (bp === undefined ? '—' : `${(bp / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`)
  const cartoes: { nome: string; valor: string; ajuda: string; cor?: string; destaque?: boolean }[] = [
    { nome: 'Gasto das viagens', valor: formatar(gasto, m), ajuda: 'Logística das viagens do período: combustível, hospedagem, comida… (não inclui o cabelo).', destaque: true },
    { nome: 'Custo/kg real', valor: gramas ? formatar(Math.round(((cabelo + gasto) * 1000) / gramas), m) : '—', ajuda: '(Cabelo + gastos da viagem) ÷ kg comprados. Ex.: (14.000 + 800) ÷ 4 kg = Bs 3.700/kg.', destaque: true },
    { nome: 'Logística por kg', valor: gramas ? formatar(Math.round((gasto * 1000) / gramas), m) : '—', ajuda: 'Quanto a viagem somou em cada kg comprado.' },
    { nome: 'Resultado', valor: formatar(resultado, m), ajuda: 'Receita do cabelo das viagens − (cabelo + gastos). Enquanto há estoque tende a ser negativo.', cor: resultado < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]' },
    { nome: 'ROI médio', valor: pct(roi), ajuda: 'Média do retorno das viagens com compra.' },
    { nome: 'Abertas', valor: String(abertas.length), ajuda: 'Viagens em andamento.' },
  ]
  return (
    <Secao id="viagens" titulo={`✈️ ${t('Viagens de compra')}`} fechadaPadrao={!completo} resumo={`${t('Gasto das viagens')}: ${formatar(gasto, m)}`} acao={<button type="button" onClick={() => ir('viagens')} className="min-h-10 rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Abrir')} →</button>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map((c) => (
          <button key={c.nome} type="button" onClick={() => ir('viagens')} className={cx('rounded-2xl border bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]', c.destaque ? 'border-[var(--alerta)]' : 'border-[var(--borda)]')}>
            <div className="flex items-center text-xs font-semibold text-[var(--suave)]">{t(c.nome)}<Info texto={c.ajuda} /></div>
            <div className={cx('num mt-1 text-xl font-bold', c.cor)}>{c.valor}</div>
          </button>
        ))}
      </div>
      {abertas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {abertas.map((v) => {
            const usado = v.orcamento ? Math.min(100, Math.round((v.gasto / v.orcamento) * 100)) : undefined
            return (
              <li key={v.id}>
                <button type="button" onClick={() => ir('viagem', { id: v.id })} className="w-full rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold"><CodigoTexto codigo={v.codigo} className="text-xs" /> {v.nome} {v.acimaOrcamento && <Pilula tom="ruim" className="ml-1">{t('Acima do orçamento')}</Pilula>}</span>
                    <span className="num text-sm"><b>{formatar(v.gasto, m)}</b>{v.orcamento ? <span className="text-[var(--suave)]"> / {formatar(v.orcamento, m)}</span> : null}</span>
                  </div>
                  <div className="text-xs text-[var(--suave)]">{v.viajantes.map((x) => x.nome).join(', ')} · {v.gramas ? `${(v.gramas / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : t('sem compra ainda')}</div>
                  {usado !== undefined && <BarraLimite className="mt-2" altura="h-2" usado={v.gasto} previsto={v.orcamento} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {completo && dados.comparativo.length > 0 && (
        <Cartao titulo={t('Por viajante')} className="mt-3">
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {dados.comparativo.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold">{c.nome} <span className="font-normal text-[var(--suave)]">· {t('{n} viagem(ns)', { n: c.viagens })}</span></span>
                <span className="num">{t('Custo/kg real')}: <b>{c.custoKgReal !== undefined ? formatar(c.custoKgReal, m) : '—'}</b> · ROI {pct(c.roiMedioBp)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
      {completo && !dados.linhas.length && <Vazio compacto texto="Nenhuma viagem por aqui." />}
    </Secao>
  )
}
