// LIVRO DO CABELO (#/livro): como o livro caixa, mas em gramas. Todos os lançamentos (entrada da compra, diferença de
// peso, triagem, lavagem, perda, venda, ajuste) em ordem, separados por DIA (com o subtotal do dia), com resumo em
// cartões (entrou · saiu · saldo · perdas e ajustes), atalhos por tipo (Entradas · Vendas · Separações · Perdas e
// ajustes), filtros (compra, pacote, pessoa, período, tipo), CSV, e cada linha abre o registro de origem (pacote,
// venda, compra). Embaixo, o fechamento de cada compra: comprado = em pacotes + vendido + perda + diferença ✓.

import { useState } from 'react'
import { CodigoTexto } from '../ui/codigos'
import { BarraPartes } from '../ui/barras'
import { dataLocal, somarDias } from '../core/domain/datas'
import type { LinhaLivro, TipoLivro } from '../core/services/livro'
import type { ResultadoConsulta } from '../core/services'
import { Botao, Campo, Carregando, Cartao, Entrada, ErroTela, Info, Selecao, Titulo, cx, dataBR, gramasTexto, sinalGramas, hora, diaSemana, Vazio, BotaoExpandir } from '../ui/base'
import { clicavel } from '../ui/compartilhados'
import { useApp, useConsulta, useParamTela, useFiltrosTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { useLembrado } from '../ui/filtros'
import { baixarCSV } from './Relatorios'
import { BarraFiltros, CampoFaixa, ChipsFiltros, GrupoFiltro, PainelFiltros, AtalhosPeriodo } from '../ui/filtroPadrao'
import { NumeroGrande, NumeroPequeno } from '../ui/numeroGrande'

const DICA_CONFERE = 'Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6.'
const MAX = 200

/** atalhos por tipo: cada lançamento cai em um grupo */
type Grupo = 'entradas' | 'vendas' | 'separacoes' | 'ajustes'
const GRUPO: Record<TipoLivro, Grupo> = {
  entrada: 'entradas', venda: 'vendas', triagemSaida: 'separacoes', triagemEntrada: 'separacoes',
  diferenca: 'ajustes', lavagem: 'ajustes', perda: 'ajustes', ajuste: 'ajustes',
}
const GRUPOS: { id: '' | Grupo; nome: string }[] = [
  { id: '', nome: 'Todos' },
  { id: 'entradas', nome: 'Entradas' },
  { id: 'vendas', nome: 'Vendas' },
  { id: 'separacoes', nome: 'Separações' },
  { id: 'ajustes', nome: 'Perdas e ajustes' },
]
/** cor do lançamento: entrada verde, venda vermelha, separação na cor da marca, perda/correção/ajuste âmbar */
const corDe = (l: Pick<LinhaLivro, 'tipo' | 'delta' | 'titulo'>) =>
  l.tipo === 'entrada' ? (l.delta < 0 ? 'var(--alerta)' : 'var(--bom)')
  : l.tipo === 'venda' ? (l.delta > 0 || /^Corre[cç][aã]o/.test(l.titulo) ? 'var(--alerta)' : 'var(--ruim)')
  : GRUPO[l.tipo] === 'separacoes' ? 'var(--marca)'
  : 'var(--alerta)'
const iconeDe = (tipo: TipoLivro) => ({ entradas: '🛒', vendas: '💰', separacoes: '✂', ajustes: '⚖' })[GRUPO[tipo]]

export function Livro() {
  const t = useT()
  const { ir, ajustarParams } = useApp()
  const { dados, erro } = useConsulta('livroCabelo', { moduloId: 'cabelo' })
  const [compra, setCompra] = useParamTela('compra', '')
  const [pacote, setPacote] = useParamTela('pacote', '')
  const [pessoa, setPessoa] = useParamTela('pessoa', '')
  const [tipo] = useParamTela('tipo', '')
  const [grupo] = useParamTela<'' | Grupo>('grupo', '')
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const [busca, setBusca] = useParamTela('b', '')
  const [quem, setQuem] = useParamTela('quem', '')
  const [sentido, setSentido] = useParamTela<'' | 'entrou' | 'saiu'>('sentido', '')
  const [gMin, setGMin] = useParamTela('gmin', '')
  const [gMax, setGMax] = useParamTela('gmax', '')
  const [tudo, setTudo] = useState(false)
  const { tirar: tirarFiltro } = useFiltrosTela()
  const [verFiltros, setVerFiltros] = useState(false)
  // minimizar: dias fechados (só a linha do dia com o subtotal), "compacto" (uma linha por lançamento) e o fechamento
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [compacto, setCompacto] = useLembrado('livro.compacto', false)
  const [verFechamento, setVerFechamento] = useLembrado('livro.fechamento', true)
  if (erro) return <ErroTela texto={erro} />
  if (!dados) return <Carregando />
  const p = pacote.trim().toLowerCase()
  const b = busca.trim().toLowerCase()
  const gmin = Number(gMin) || 0
  const gmax = Number(gMax) || 0
  // filtros (menos o tipo): base para os atalhos com contagem
  const base = dados.linhas.filter(
    (l) =>
      (!compra || l.compras.some((c) => c.id === compra)) &&
      (!p || [l.lote.codigo, l.lote.nome].some((x) => x?.toLowerCase().includes(p))) &&
      (!b || [l.titulo, l.lote.codigo, l.lote.nome, l.descricao, l.por, ...l.compras.map((c) => `${c.codigo ?? ''} ${c.fornecedor ?? ''}`), ...l.pessoas.map((x) => x.nome)].filter(Boolean).join(' ').toLowerCase().includes(b)) &&
      (!pessoa || l.pessoas.some((x) => x.id === pessoa)) &&
      (!quem || l.por === quem) &&
      (!sentido || (sentido === 'entrou' ? l.delta > 0 : l.delta < 0)) &&
      (!gmin || Math.abs(l.delta) >= gmin) &&
      (!gmax || Math.abs(l.delta) <= gmax) &&
      (!de || l.data >= de) &&
      (!ate || l.data <= ate),
  )
  const linhas = base.filter((l) => (!tipo || l.tipo === (tipo as TipoLivro)) && (!grupo || GRUPO[l.tipo] === grupo))
  const visiveis = tudo ? linhas : linhas.slice(0, MAX)
  const pessoas = [...new Map(dados.linhas.flatMap((l) => l.pessoas).map((x) => [x.id, x.nome ?? x.id])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const compras = dados.porCompra.filter((c) => !compra || c.compraId === compra)
  const nFiltros = [compra, pacote, pessoa, quem, sentido, gMin || gMax, tipo, de || ate].filter(Boolean).length
  const quemFez = [...new Set(dados.linhas.map((l) => l.por).filter((x): x is string => !!x))].sort((a, c) => a.localeCompare(c, 'pt-BR'))
  const nomeCompra = (id: string) => { const c = dados.porCompra.find((x) => x.compraId === id); return c ? [c.codigo, c.fornecedor].filter(Boolean).join(' · ') : id }
  // o que está ligado, em chips com ✕ (padrão)
  const ativos = [
    ...(compra ? [{ k: 'compra', rotulo: `🛒 ${nomeCompra(compra)}` }] : []),
    ...(pacote ? [{ k: 'pacote', rotulo: `📦 ${pacote}` }] : []),
    ...(pessoa ? [{ k: 'pessoa', rotulo: `👤 ${pessoas.find(([id]) => id === pessoa)?.[1] ?? pessoa}` }] : []),
    ...(quem ? [{ k: 'quem', rotulo: `${t('fez')}: ${quem}` }] : []),
    ...(sentido ? [{ k: 'sentido', rotulo: sentido === 'entrou' ? `▲ ${t('Só o que entrou')}` : `▼ ${t('Só o que saiu')}` }] : []),
    ...(gMin || gMax ? [{ k: 'gmin,gmax', rotulo: `⚖ ${gMin ? gramasTexto(gmin) : '0'} – ${gMax ? gramasTexto(gmax) : '∞'}` }] : []),
    ...(tipo ? [{ k: 'tipo', rotulo: t(dados.tipos.find((x) => x.id === tipo)?.nome ?? tipo) }] : []),
    ...(de || ate ? [{ k: 'de,ate', rotulo: `📅 ${de ? dataBR(de) : '…'} – ${ate ? dataBR(ate) : '…'}` }] : []),
  ]
  const soma = (ls: LinhaLivro[], f: (l: LinhaLivro) => boolean = () => true) => ls.filter(f).reduce((s, l) => s + l.delta, 0)
  const entrou = soma(linhas, (l) => l.delta > 0)
  const saiu = -soma(linhas, (l) => l.delta < 0)
  const ajustes = linhas.filter((l) => GRUPO[l.tipo] === 'ajustes')
  const abrir = (l: LinhaLivro) => (l.ref ? ir(l.ref.tela, l.ref.params) : ir('lote', { id: l.lote.id }))
  const limpar = () => ajustarParams({ compra: undefined, pacote: undefined, pessoa: undefined, quem: undefined, sentido: undefined, gmin: undefined, gmax: undefined, tipo: undefined, de: undefined, ate: undefined })
  const exportar = () =>
    baixarCSV(`livro-do-cabelo-${new Date().toISOString().slice(0, 10)}`, linhas.map((l) => ({
      [t('Data')]: l.data, [t('Hora')]: hora(l.em), [t('Tipo')]: t(l.nomeTipo), [t('Lançamento')]: l.titulo, [t('Pacote')]: l.lote.codigo ?? l.lote.nome,
      [t('Compras')]: l.compras.map((c) => c.codigo ?? '').join(' + '), [t('Antes (g)')]: l.antes, [t('Movimentou (g)')]: l.delta, [t('Depois (g)')]: l.depois, [t('Quem')]: l.por ?? '', [t('Descrição')]: l.descricao ?? '',
    })))

  // por dia (a lista já vem do mais novo para o mais antigo); o subtotal conta todas as linhas do dia, não só as visíveis
  const hoje = dataLocal()
  const ontem = somarDias(hoje, -1)
  const totalDia = new Map<string, { entrou: number; saiu: number; n: number }>()
  for (const l of linhas) {
    const d = totalDia.get(l.data) ?? { entrou: 0, saiu: 0, n: 0 }
    if (l.delta > 0) d.entrou += l.delta
    else d.saiu -= l.delta
    d.n++
    totalDia.set(l.data, d)
  }
  const dias: [string, LinhaLivro[]][] = []
  for (const l of visiveis) {
    const ult = dias[dias.length - 1]
    if (ult?.[0] === l.data) ult[1].push(l)
    else dias.push([l.data, [l]])
  }
  const nomeDia = (d: string) => {
    const semana = diaSemana(d)
    return d === hoje ? `${t('Hoje')} · ${dataBR(d)}` : d === ontem ? `${t('Ontem')} · ${dataBR(d)}` : `${semana} · ${dataBR(d)}`
  }

  return (
    <div className="space-y-4">
      <Titulo
        subtitulo={t('Como o livro caixa, mas em gramas: tudo o que entrou e saiu, e de quais compras.')}
        acao={<Botao variante="secundario" disabled title={t('Em breve')} onClick={exportar}>⬇ {t('Exportar CSV')}</Botao>}
      >
        {t('Livro do cabelo')}
      </Titulo>

      {/* resumo do que está na lista (respeita os filtros) */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <NumeroGrande colorirValor rotulo="Entrou" valor={`+${gramasTexto(entrou)}`} cor="var(--bom)" ajuda="Tudo o que entrou nos pacotes: compras e os pacotes novos da separação. Ex.: compra de 10 kg + 9,8 kg separados = 19,8 kg." />
        <NumeroGrande colorirValor rotulo="Saiu" valor={`−${gramasTexto(saiu)}`} cor="var(--ruim)" ajuda="Tudo o que saiu dos pacotes: vendas, o bruto que foi para a separação, perdas. Ex.: venda de 1,5 kg + 10 kg para separar = 11,5 kg." />
        <NumeroGrande colorirValor rotulo="Saldo do período" valor={sinalGramas(entrou - saiu)} cor={entrou - saiu < 0 ? 'var(--ruim)' : 'var(--bom)'} ajuda="Entrou − saiu na lista. Ex.: entrou 10 kg, saiu 7 kg = +3 kg no estoque." />
        <NumeroGrande colorirValor rotulo="Perdas e ajustes" valor={sinalGramas(soma(ajustes))} cor="var(--alerta)" sub={t(ajustes.length === 1 ? '1 lançamento' : '{n} lançamentos', { n: ajustes.length })} ajuda="Perda, lavagem, diferença de peso na conferência e ajuste de contagem. Ex.: lavagem −300 g + contagem −20 g = −320 g." />
      </div>

      {/* FILTRO PADRÃO: período (atalhos) · tipo (atalhos) · busca + ⚙ Filtros → chips ✕ → painel em grupos */}
      <div className="space-y-2">
        {/* atalhos de período (no início, fora do painel): um toque e a lista fica só daquele tempo */}
        <AtalhosPeriodo de={de} ate={ate} onChange={(d, a) => ajustarParams({ de: d, ate: a })} />
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap" role="group" aria-label={t('Tipo')}>
            {GRUPOS.map((g) => {
              const n = g.id ? base.filter((l) => GRUPO[l.tipo] === g.id).length : base.length
              const on = grupo === g.id && !tipo
              return (
                <button key={g.id || 'todos'} type="button" aria-pressed={on} onClick={() => ajustarParams({ grupo: g.id || undefined, tipo: undefined })}
                  className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold', on ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] bg-[var(--cartao)] hover:border-[var(--marca)]')}>
                  {t(g.nome)} <span className={cx('num text-xs', on ? 'opacity-80' : 'text-[var(--suave)]')}>{n}</span>
                </button>
              )
            })}
          </div>
        </div>
        <BarraFiltros busca={busca} onBusca={setBusca} placeholder="Buscar lançamento, pacote, compra ou pessoa" ativos={nFiltros} aberto={verFiltros} onAlternar={() => setVerFiltros(!verFiltros)} />
        <ChipsFiltros itens={ativos} onTirar={tirarFiltro} onLimpar={limpar} />
        {verFiltros && (
          <PainelFiltros resultados={linhas.length} temAtivos={nFiltros > 0} onLimpar={limpar} onFechar={() => setVerFiltros(false)}>
            <GrupoFiltro titulo="De onde veio" icone="🛒">
              <Campo rotulo="Compra"><Selecao valor={compra} onChange={setCompra} vazio="Todas" opcoes={dados.porCompra.map((c) => ({ id: c.compraId, nome: [c.codigo, c.fornecedor].filter(Boolean).join(' · ') }))} /></Campo>
              <Campo rotulo="Pacote"><Entrada type="search" value={pacote} placeholder={t('Código ou nome')} onChange={(e) => setPacote(e.target.value)} /></Campo>
            </GrupoFiltro>
            <GrupoFiltro titulo="Quem" icone="👤">
              <Campo rotulo="Cliente / fornecedor"><Selecao valor={pessoa} onChange={setPessoa} vazio="Todas" opcoes={pessoas.map(([id, nome]) => ({ id, nome }))} /></Campo>
              <Campo rotulo="Quem fez o lançamento"><Selecao valor={quem} onChange={setQuem} vazio="Todos" opcoes={quemFez.map((x) => ({ id: x, nome: x }))} /></Campo>
            </GrupoFiltro>
            <GrupoFiltro titulo="O lançamento" icone="⚖">
              <Campo rotulo="Tipo"><Selecao valor={tipo} onChange={(v) => ajustarParams({ tipo: v || undefined, grupo: undefined })} vazio="Todos" opcoes={dados.tipos.map((x) => ({ id: x.id, nome: t(x.nome) }))} /></Campo>
              <Campo rotulo="Entrou ou saiu"><Selecao valor={sentido} onChange={(v) => setSentido(v as typeof sentido)} vazio="Os dois" opcoes={[{ id: 'entrou', nome: '▲ Só o que entrou' }, { id: 'saiu', nome: '▼ Só o que saiu' }]} /></Campo>
              <CampoFaixa rotulo="Quantidade (g)">
                <Entrada inputMode="numeric" aria-label={t('Mínimo (g)')} placeholder={t('de')} value={gMin} onChange={(e) => setGMin(e.target.value.replace(/\D/g, ''))} />
                <Entrada inputMode="numeric" aria-label={t('Máximo (g)')} placeholder={t('até')} value={gMax} onChange={(e) => setGMax(e.target.value.replace(/\D/g, ''))} />
              </CampoFaixa>
            </GrupoFiltro>
            <GrupoFiltro titulo="Quando" icone="📅">
              <CampoFaixa rotulo="Período">
                <Entrada type="date" aria-label={t('De')} value={de} onChange={(e) => setDe(e.target.value)} />
                <Entrada type="date" aria-label={t('Até')} value={ate} onChange={(e) => setAte(e.target.value)} />
              </CampoFaixa>
            </GrupoFiltro>
          </PainelFiltros>
        )}
      </div>

      <Cartao titulo={`${t('Lançamentos')} · ${linhas.length}`}>
        {linhas.length > 0 && (
          // minimizar: fechar/abrir todos os dias e o modo compacto (uma linha por lançamento)
          <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2 text-sm">
            <BotaoExpandir aberto={!fechados.size} onClick={() => setFechados(fechados.size ? new Set() : new Set(dias.map(([d]) => d)))} rotuloAberto={t('Fechar todos os dias')}>{t('Abrir todos os dias')}</BotaoExpandir>
            <label className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5" checked={compacto} onChange={(e) => setCompacto(e.target.checked)} />
              {t('Compacto')}<Info texto="Compacto: uma linha por lançamento (o quê e quanto). Toque na linha para abrir. Ex.: Venda V-0004 · −1,5 kg." />
            </label>
          </div>
        )}
        {!linhas.length ? <Vazio compacto texto="Nenhum lançamento com esse filtro." /> : (
          // cada dia é um bloco próprio (borda + cabeçalho + linhas divididas): nada "grudado" entre um dia e outro
          <div className="space-y-3">
            {dias.map(([dia, ls]) => {
              const s = totalDia.get(dia)!
              const fechado = fechados.has(dia)
              return (
                <section key={dia} aria-label={dataBR(dia)} className="overflow-hidden rounded-xl border border-[var(--borda)]">
                  <button type="button" aria-expanded={!fechado} onClick={() => setFechados((f) => { const n = new Set(f); if (n.has(dia)) n.delete(dia); else n.add(dia); return n })} className={cx('flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 bg-[var(--fundo)] px-3 py-2 text-left text-sm hover:bg-[var(--marca-suave)]', !fechado && 'border-b border-[var(--borda)]')}>
                    <b className="capitalize"><span aria-hidden className={cx('mr-1 inline-block text-[var(--suave)] transition-transform', !fechado && 'rotate-90')}>›</span>{nomeDia(dia)} <span className="text-xs font-normal text-[var(--suave)]">· {s.n}</span></b>
                    <span className="num text-xs">
                      {s.entrou > 0 && s.saiu > 0 && (
                        <span className="text-[var(--suave)]">
                          <span className="text-[var(--bom)]">+{gramasTexto(s.entrou)}</span> · <span className="text-[var(--ruim)]">−{gramasTexto(s.saiu)}</span> ={' '}
                        </span>
                      )}
                      <b className={s.entrou - s.saiu < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{sinalGramas(s.entrou - s.saiu)}</b>
                    </span>
                  </button>
                  {!fechado && (
                    <ul className="divide-y divide-[var(--borda)]">
                      {ls.map((l) => <Linha key={l.id} l={l} compacto={compacto} onAbrir={() => abrir(l)} />)}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
        {!tudo && linhas.length > MAX && <Botao variante="leve" className="mt-2" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: linhas.length })}</Botao>}
      </Cartao>

      <FechamentoCompras compras={compras} aberto={verFechamento} onAlternar={() => setVerFechamento(!verFechamento)} onAbrir={(id) => ir('pedido', { id })} />
    </div>
  )
}

type FechamentoCompra = ResultadoConsulta<'livroCabelo'>['porCompra'][number]
type FiltroFech = '' | 'fecha' | 'naoFecha' | 'comEstoque' | 'acabou'
const PARTES_FECH = [
  { k: 'emPacotes', nome: 'em pacotes', cor: 'var(--marca)' },
  { k: 'vendido', nome: 'vendido', cor: 'var(--bom)' },
  { k: 'perda', nome: 'perda', cor: 'var(--ruim)' },
  { k: 'diferenca', nome: 'diferença', cor: 'var(--alerta)' },
] as const

/**
 * FECHAMENTO POR COMPRA (peça própria): números grandes que filtram (fecham ✓ · não fecham ⚠ · com estoque · acabou),
 * busca por código/fornecedor e, em cada compra, a barra de para onde foi cada grama + os 4 números em blocos.
 */
function FechamentoCompras({ compras, aberto, onAlternar, onAbrir }: { compras: FechamentoCompra[]; aberto: boolean; onAlternar(): void; onAbrir(id: string): void }) {
  const t = useT()
  const [filtro, setFiltro] = useParamTela<FiltroFech>('fech', '')
  const [busca, setBusca] = useState('')
  const passa = (c: FechamentoCompra, f: FiltroFech) => (f === 'fecha' ? c.confere : f === 'naoFecha' ? !c.confere : f === 'comEstoque' ? c.emPacotes > 0 : f === 'acabou' ? c.emPacotes === 0 : true)
  const b = busca.trim().toLowerCase()
  const lista = compras.filter((c) => passa(c, filtro) && (!b || `${c.codigo ?? ''} ${c.fornecedor ?? ''}`.toLowerCase().includes(b)))
  const n = (f: FiltroFech) => compras.filter((c) => passa(c, f)).length
  const alternar = (f: FiltroFech) => setFiltro(filtro === f ? '' : f)
  return (
    <section aria-label={t('Fechamento por compra')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center text-base font-bold">{t('Fechamento por compra')}<span className="num ml-1 text-sm font-normal text-[var(--suave)]">· {compras.length}</span><Info texto={DICA_CONFERE} /></h2>
        <BotaoExpandir aberto={aberto} onClick={onAlternar} rotuloAberto={t('Esconder')}>{t('Mostrar ({n})', { n: compras.length })}</BotaoExpandir>
      </div>
      {aberto && (!compras.length ? <Vazio compacto texto="Nenhuma compra de cabelo ainda." /> : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <NumeroGrande rotulo="Fecham" icone="✓" cor="var(--bom)" valor={String(n('fecha'))} ativo={filtro === 'fecha'} onClick={() => alternar('fecha')} selos={[{ texto: t('cada grama tem lugar'), tom: 'bom' }]} />
            <NumeroGrande rotulo="Não fecham" icone="⚠" cor="var(--alerta)" colorirValor={n('naoFecha') > 0} valor={String(n('naoFecha'))} ativo={filtro === 'naoFecha'} onClick={() => alternar('naoFecha')} selos={n('naoFecha') ? [{ texto: t('conferir'), tom: 'alerta' }] : [{ texto: t('nada a conferir'), tom: 'bom' }]} />
            <NumeroGrande rotulo="Com estoque" icone="📦" cor="var(--marca)" valor={String(n('comEstoque'))} ativo={filtro === 'comEstoque'} onClick={() => alternar('comEstoque')} selos={[{ texto: gramasTexto(compras.reduce((s, c) => s + c.emPacotes, 0)), tom: 'marca' }]} />
            <NumeroGrande rotulo="Acabou" icone="✔" cor="var(--suave)" valor={String(n('acabou'))} ativo={filtro === 'acabou'} onClick={() => alternar('acabou')} selos={[{ texto: t('tudo vendido ou perdido') }]} />
          </div>
          <Entrada type="search" aria-label={t('Buscar compra ou fornecedor')} placeholder={t('Buscar compra ou fornecedor')} value={busca} onChange={(e) => setBusca(e.target.value)} />
          {/* legenda das cores da barra (uma vez) */}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--suave)]">
            {PARTES_FECH.map((x) => <span key={x.k} className="inline-flex items-center gap-1"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: x.cor }} />{t(x.nome)}</span>)}
          </p>
          {!lista.length ? <Vazio compacto texto="Nada com estes filtros." /> : (
            <ul className="space-y-2">
              {lista.map((c) => (
                <li key={c.compraId} {...clicavel(() => onAbrir(c.compraId))} className={cx('cursor-pointer rounded-xl border p-3 outline-none hover:border-[var(--marca)] focus-visible:ring-2 focus-visible:ring-[var(--marca)]', c.confere ? 'border-[var(--borda)]' : 'border-[var(--alerta)]')}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <b className="min-w-0 truncate"><CodigoTexto codigo={c.codigo} />{c.fornecedor ? ` · ${c.fornecedor}` : ''}</b>
                    <span className="num text-xs text-[var(--suave)]">{dataBR(c.data)} · {t('comprou')} <b className="text-[var(--texto)]">{gramasTexto(c.comprado)}</b></span>
                  </div>
                  {/* para onde foi cada grama */}
                  <BarraPartes className="mt-2" total={c.comprado} partes={PARTES_FECH.map((x) => ({ chave: x.k, valor: c[x.k], cor: x.cor }))} />
                  <div className="num mt-2 grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4">
                    {PARTES_FECH.filter((x) => x.k !== 'diferenca' || c.diferenca).map((x) => (
                      <NumeroPequeno key={x.k} rotulo={x.nome} valor={gramasTexto(c[x.k])} cor={c[x.k] ? x.cor : undefined} />
                    ))}
                  </div>
                  <p className={cx('mt-2 text-xs font-semibold', c.confere ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>{c.confere ? `✓ ${t('Fecha: cada grama tem lugar')}` : `⚠️ ${t('não fecha: faltam {g}', { g: gramasTexto(c.resto) })}`}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}

/** uma linha do livro: marca colorida do tipo, título, pacote e compra(s) de origem clicáveis, saldo e movimento */
function Linha({ l, onAbrir, compacto }: { l: LinhaLivro; onAbrir(): void; compacto?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const cor = corDe(l)
  // compacto: só o quê e quanto, numa linha
  if (compacto)
    return (
      <li {...clicavel(onAbrir)} style={{ borderLeftColor: cor }} className="flex min-h-11 cursor-pointer items-center gap-2 border-l-4 bg-[var(--cartao)] py-1.5 pl-3 pr-3 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
        <span aria-hidden className="shrink-0">{iconeDe(l.tipo)}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{l.titulo}</span>
        <span className="num shrink-0 whitespace-nowrap font-bold" style={{ color: cor }}>{sinalGramas(l.delta)}</span>
      </li>
    )
  const compras = l.compras.filter((c) => c.codigo)
  const ate = 2
  const link = 'font-mono font-semibold text-[var(--marca)] hover:underline'
  return (
    <li {...clicavel(onAbrir)} style={{ borderLeftColor: cor }} className="flex cursor-pointer items-start gap-2 border-l-4 bg-[var(--cartao)] py-2.5 pl-3 pr-3 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
      <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)` }}>{iconeDe(l.tipo)}</span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <b>{l.titulo}</b>
          <span className="num text-xs text-[var(--suave)]">{hora(l.em)}</span>
        </span>
        <span className="block text-xs text-[var(--suave)]">
          <button type="button" className={link} title={t('Abrir o pacote')} onClick={(e) => (e.stopPropagation(), ir('lote', { id: l.lote.id }))}>📦 {l.lote.codigo ?? l.lote.nome}</button>
          {compras.length > 0 && (
            <>
              {' · 🛒 '}
              {compras.slice(0, ate).map((c, k) => (
                <span key={c.id}>
                  {k > 0 && ' + '}
                  <button type="button" className={link} title={[t('Abrir a compra'), c.fornecedor].filter(Boolean).join(' · ')} onClick={(e) => (e.stopPropagation(), ir('pedido', { id: c.id }))}>{c.codigo}</button>
                </span>
              ))}
              {compras.length > ate && <span title={compras.slice(ate).map((c) => c.codigo).join(' + ')}> +{compras.length - ate}</span>}
            </>
          )}
          {l.por && <> · {l.por}</>}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="num block whitespace-nowrap font-bold" style={{ color: cor }}>{sinalGramas(l.delta)}</span>
        <span className="num block whitespace-nowrap text-[11px] text-[var(--suave)]">{gramasTexto(l.antes)} → {gramasTexto(l.depois)}</span>
      </span>
    </li>
  )
}
