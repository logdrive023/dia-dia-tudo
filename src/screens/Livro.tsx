// LIVRO DO CABELO (#/livro): como o livro caixa, mas em gramas. Todos os lançamentos (entrada da compra, diferença de
// peso, triagem, lavagem, perda, venda, ajuste) em ordem, separados por DIA (com o subtotal do dia), com resumo em
// cartões (entrou · saiu · saldo · perdas e ajustes), atalhos por tipo (Entradas · Vendas · Separações · Perdas e
// ajustes), filtros (compra, pacote, pessoa, período, tipo), CSV, e cada linha abre o registro de origem (pacote,
// venda, compra). Embaixo, o fechamento de cada compra: comprado = em pacotes + vendido + perda + diferença ✓.

import { useState } from 'react'
import { dataLocal, somarDias } from '../core/domain/datas'
import type { LinhaLivro, TipoLivro } from '../core/services/livro'
import { Botao, Campo, Carregando, Cartao, Entrada, ErroTela, Info, Selecao, Titulo, cx, dataBR, gramasTexto, loc } from '../ui/base'
import { clicavel } from '../ui/compartilhados'
import { useApp, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { baixarCSV } from './Relatorios'

const DICA_CONFERE = 'Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6.'
const MAX = 200
const sinal = (n: number) => (n > 0 ? `+${gramasTexto(n)}` : n < 0 ? `−${gramasTexto(-n)}` : gramasTexto(0))
const hora = (em: string) => new Date(em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })

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
  const [tudo, setTudo] = useState(false)
  const [verFiltros, setVerFiltros] = useState(false)
  if (erro) return <ErroTela texto={erro} onVoltar={() => ir('estoque')} />
  if (!dados) return <Carregando />
  const p = pacote.trim().toLowerCase()
  // filtros (menos o tipo): base para os atalhos com contagem
  const base = dados.linhas.filter(
    (l) =>
      (!compra || l.compras.some((c) => c.id === compra)) &&
      (!p || [l.lote.codigo, l.lote.nome].some((x) => x?.toLowerCase().includes(p))) &&
      (!pessoa || l.pessoas.some((x) => x.id === pessoa)) &&
      (!de || l.data >= de) &&
      (!ate || l.data <= ate),
  )
  const linhas = base.filter((l) => (!tipo || l.tipo === (tipo as TipoLivro)) && (!grupo || GRUPO[l.tipo] === grupo))
  const visiveis = tudo ? linhas : linhas.slice(0, MAX)
  const pessoas = [...new Map(dados.linhas.flatMap((l) => l.pessoas).map((x) => [x.id, x.nome ?? x.id])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  const compras = dados.porCompra.filter((c) => !compra || c.compraId === compra)
  const nFiltros = [compra, pacote, pessoa, tipo, de || ate].filter(Boolean).length
  const soma = (ls: LinhaLivro[], f: (l: LinhaLivro) => boolean = () => true) => ls.filter(f).reduce((s, l) => s + l.delta, 0)
  const entrou = soma(linhas, (l) => l.delta > 0)
  const saiu = -soma(linhas, (l) => l.delta < 0)
  const ajustes = linhas.filter((l) => GRUPO[l.tipo] === 'ajustes')
  const abrir = (l: LinhaLivro) => (l.ref ? ir(l.ref.tela, l.ref.params) : ir('lote', { id: l.lote.id }))
  const limpar = () => ajustarParams({ compra: undefined, pacote: undefined, pessoa: undefined, tipo: undefined, de: undefined, ate: undefined })
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
    const semana = new Date(`${d}T12:00:00`).toLocaleDateString(loc(), { weekday: 'short' })
    return d === hoje ? `${t('Hoje')} · ${dataBR(d)}` : d === ontem ? `${t('Ontem')} · ${dataBR(d)}` : `${semana} · ${dataBR(d)}`
  }

  return (
    <div className="space-y-4">
      <Titulo
        subtitulo={t('Como o livro caixa, mas em gramas: tudo o que entrou e saiu, e de quais compras.')}
        acao={<Botao variante="secundario" disabled={!linhas.length} onClick={exportar}>⬇ {t('Exportar CSV')}</Botao>}
      >
        {t('Livro do cabelo')}
      </Titulo>

      {/* resumo do que está na lista (respeita os filtros) */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Resumo rotulo="Entrou" valor={`+${gramasTexto(entrou)}`} cor="var(--bom)" ajuda="Tudo o que entrou nos pacotes: compras e os pacotes novos da separação. Ex.: compra de 10 kg + 9,8 kg separados = 19,8 kg." />
        <Resumo rotulo="Saiu" valor={`−${gramasTexto(saiu)}`} cor="var(--ruim)" ajuda="Tudo o que saiu dos pacotes: vendas, o bruto que foi para a separação, perdas. Ex.: venda de 1,5 kg + 10 kg para separar = 11,5 kg." />
        <Resumo rotulo="Saldo do período" valor={sinal(entrou - saiu)} cor={entrou - saiu < 0 ? 'var(--ruim)' : 'var(--bom)'} ajuda="Entrou − saiu na lista. Ex.: entrou 10 kg, saiu 7 kg = +3 kg no estoque." />
        <Resumo rotulo="Perdas e ajustes" valor={sinal(soma(ajustes))} cor="var(--alerta)" extra={t(ajustes.length === 1 ? '1 lançamento' : '{n} lançamentos', { n: ajustes.length })} ajuda="Perda, lavagem, diferença de peso na conferência e ajuste de contagem. Ex.: lavagem −300 g + contagem −20 g = −320 g." />
      </div>

      {/* atalhos por tipo + filtros */}
      <div className="space-y-2">
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
          <button type="button" aria-expanded={verFiltros} aria-label={t('Filtros')} onClick={() => setVerFiltros(!verFiltros)}
            className={cx('inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold lg:hidden', nFiltros ? 'border-[var(--marca)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
            ⚙ <span className="hidden sm:inline">{t('Filtros')}</span>{nFiltros ? ` ${nFiltros}` : ''} {verFiltros ? '▴' : '▾'}
          </button>
        </div>

        <div className={cx('gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 grid-cols-2 lg:grid lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)_auto] lg:items-end', verFiltros ? 'grid' : 'hidden')}>
          <Campo rotulo="Compra"><Selecao valor={compra} onChange={setCompra} vazio="Todas" opcoes={dados.porCompra.map((c) => ({ id: c.compraId, nome: [c.codigo, c.fornecedor].filter(Boolean).join(' · ') }))} /></Campo>
          <Campo rotulo="Pacote"><Entrada type="search" value={pacote} placeholder={t('Código ou nome')} onChange={(e) => setPacote(e.target.value)} /></Campo>
          <Campo rotulo="Pessoa"><Selecao valor={pessoa} onChange={setPessoa} vazio="Todas" opcoes={pessoas.map(([id, nome]) => ({ id, nome }))} /></Campo>
          <Campo rotulo="Tipo"><Selecao valor={tipo} onChange={(v) => ajustarParams({ tipo: v || undefined, grupo: undefined })} vazio="Todos" opcoes={dados.tipos.map((x) => ({ id: x.id, nome: t(x.nome) }))} /></Campo>
          <Campo comoDiv rotulo="Período" className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-1">
              <Entrada type="date" aria-label={t('De')} value={de} onChange={(e) => setDe(e.target.value)} />
              <Entrada type="date" aria-label={t('Até')} value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </Campo>
          <div className="col-span-2 flex items-end lg:col-span-1">
            <Botao variante="leve" disabled={!nFiltros} onClick={limpar}>× {t('Limpar filtros')}</Botao>
          </div>
        </div>
      </div>

      <Cartao titulo={`${t('Lançamentos')} · ${linhas.length}`}>
        {!linhas.length ? <p className="text-sm text-[var(--suave)]">{t('Nenhum lançamento com esse filtro.')}</p> : (
          <div className="space-y-4">
            {dias.map(([dia, ls]) => {
              const s = totalDia.get(dia)!
              return (
                <section key={dia} aria-label={dataBR(dia)}>
                  <div className="-mx-1 mb-1 flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-[var(--fundo)] px-2 py-1.5 text-sm">
                    <b className="capitalize">{nomeDia(dia)} <span className="text-xs font-normal text-[var(--suave)]">· {s.n}</span></b>
                    <span className="num text-xs">
                      {s.entrou > 0 && s.saiu > 0 && (
                        <span className="text-[var(--suave)]">
                          <span className="text-[var(--bom)]">+{gramasTexto(s.entrou)}</span> · <span className="text-[var(--ruim)]">−{gramasTexto(s.saiu)}</span> ={' '}
                        </span>
                      )}
                      <b className={s.entrou - s.saiu < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{sinal(s.entrou - s.saiu)}</b>
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {ls.map((l) => <Linha key={l.id} l={l} onAbrir={() => abrir(l)} />)}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
        {!tudo && linhas.length > MAX && <Botao variante="leve" className="mt-2" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: linhas.length })}</Botao>}
      </Cartao>

      <Cartao titulo={t('Fechamento por compra')} ajuda={DICA_CONFERE}>
        {!compras.length ? <p className="text-sm text-[var(--suave)]">{t('Nenhuma compra de cabelo ainda.')}</p> : (
          <ul className="divide-y divide-[var(--borda)]">
            {compras.map((c) => (
              <li key={c.compraId} {...clicavel(() => ir('pedido', { id: c.compraId }))} className="cursor-pointer rounded-lg px-1 py-2 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <b><span className="font-mono">{c.codigo}</span>{c.fornecedor ? ` · ${c.fornecedor}` : ''}</b>
                  <span className="text-xs text-[var(--suave)]">{dataBR(c.data)}</span>
                </div>
                <p className={cx('num mt-0.5', c.confere ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
                  {t('comprado')} {gramasTexto(c.comprado)} = {t('em pacotes')} {gramasTexto(c.emPacotes)} + {t('vendido')} {gramasTexto(c.vendido)} + {t('perda')} {gramasTexto(c.perda)}{c.diferenca ? <> + {t('diferença')} {gramasTexto(c.diferenca)}</> : null}{' '}
                  {c.confere ? '✓' : `⚠️ ${t('não fecha: faltam {g}', { g: gramasTexto(c.resto) })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 flex items-center text-xs text-[var(--suave)]">{t('Confere ✓')}<Info texto={DICA_CONFERE} /></p>
      </Cartao>
    </div>
  )
}

/** cartão do resumo: rótulo pequeno, número grande na cor do tipo */
function Resumo({ rotulo, valor, cor, ajuda, extra }: { rotulo: string; valor: string; cor: string; ajuda: string; extra?: string }) {
  const t = useT()
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm" style={{ borderTop: `3px solid ${cor}` }}>
      <div className="flex items-center text-xs font-semibold text-[var(--suave)]">{t(rotulo)}<Info texto={ajuda} /></div>
      <div className="num mt-0.5 truncate text-xl font-bold sm:text-2xl" style={{ color: cor }}>{valor}</div>
      {extra && <div className="text-xs text-[var(--suave)]">{extra}</div>}
    </div>
  )
}

/** uma linha do livro: marca colorida do tipo, título, pacote e compra(s) de origem clicáveis, saldo e movimento */
function Linha({ l, onAbrir }: { l: LinhaLivro; onAbrir(): void }) {
  const t = useT()
  const { ir } = useApp()
  const cor = corDe(l)
  const compras = l.compras.filter((c) => c.codigo)
  const ate = 2
  const link = 'font-mono font-semibold text-[var(--marca)] hover:underline'
  return (
    <li {...clicavel(onAbrir)} style={{ borderLeftColor: cor }} className="flex cursor-pointer items-start gap-2 rounded-lg border-l-4 bg-[var(--cartao)] py-1.5 pl-2 pr-1 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
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
        <span className="num block whitespace-nowrap font-bold" style={{ color: cor }}>{sinal(l.delta)}</span>
        <span className="num block whitespace-nowrap text-[11px] text-[var(--suave)]">{gramasTexto(l.antes)} → {gramasTexto(l.depois)}</span>
      </span>
    </li>
  )
}
