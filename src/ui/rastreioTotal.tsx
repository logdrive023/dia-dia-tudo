// RASTREIO TOTAL: cada grama, como entrou e para onde foi. Uma peça só, usada no lote, na compra, na triagem, na venda
// e na tela de rastreio. Lê a consulta `genealogia` (compras → triagens → lotes → vendas, em gramas em cada ligação).
//  - CadeiaChips: a linha curta "Compra P-0003 · Helena → Triagem T-2 → Venda V-12" (cada chip abre a sua tela)
//  - Caminho: a linha de chips "você está aqui" com o próximo passo (cabeçalho do lote e tela de rastreio)
//  - RastreioResumo: o quadro padrão (a conta numa linha + a lista curta do que importa + "Ver rastreio completo")
//  - RastreioTotal: o grafo inteiro em colunas (Compras | Triagens | Lotes | Para onde foi) e a conta que fecha; aberto sob demanda

import { type ReactNode, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import type { Cadeia } from '../core/services/estoque'
import type { Ligacao } from '../core/services/triagem'
import { Botao, Info, cx, dataBR, fmt, gramasTexto } from './base'
import { useApp } from './contexto'
import { useT } from './i18n'
import { MenuAcoes, acoesLote } from './menuAcoes'
import { MiniaturaLote, marcadorLote } from './fotos'

export type Genealogia = ResultadoConsulta<'genealogia'>

const COR = { compra: '#0ea5e9', triagem: '#8b5cf6', lote: 'var(--alerta)', venda: 'var(--bom)' } as const
const ICONE = { compra: '🛒', triagem: '✂️', lote: '📦', venda: '💰' } as const

/** Chip clicável de um registro (compra, triagem, lote ou venda). */
export function Chip({ tipo, children, onClick, ativo, fantasma, titulo }: { tipo: keyof typeof COR; children: ReactNode; onClick?(): void; ativo?: boolean; fantasma?: boolean; titulo?: string }) {
  const cls = cx(
    'inline-flex min-h-8 max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-semibold',
    fantasma ? 'border-dashed border-[var(--borda)] text-[var(--suave)]' : 'border-transparent',
    ativo && 'ring-2 ring-[var(--marca)]',
    onClick && 'hover:brightness-95',
  )
  const estilo = fantasma ? undefined : { background: `color-mix(in srgb, ${COR[tipo]} 16%, transparent)`, color: COR[tipo] }
  const conteudo = <><span aria-hidden>{ICONE[tipo]}</span><span className="truncate">{children}</span></>
  return onClick ? <button type="button" title={titulo} onClick={(e) => (e.stopPropagation(), onClick())} className={cls} style={estilo}>{conteudo}</button> : <span title={titulo} className={cls} style={estilo}>{conteudo}</span>
}

const seta = <span aria-hidden className="text-xs text-[var(--suave)]">→</span>

/** "Compra P-0003 · Helena → Triagem T-2 → Venda V-12, V-15 +1" numa linha (quebra no celular). */
export function CadeiaChips({ cadeia, max = 2, className }: { cadeia: Cadeia; max?: number; className?: string }) {
  const t = useT()
  const { ir } = useApp()
  const grupo = <X,>(xs: X[], f: (x: X) => ReactNode) => <>{xs.slice(0, max).map(f)}{xs.length > max && <span className="text-xs font-semibold text-[var(--suave)]">+{xs.length - max}</span>}</>
  if (!cadeia.compras.length && !cadeia.triagens.length && !cadeia.vendas.length) return null
  return (
    <div className={cx('flex flex-wrap items-center gap-1', className)} aria-label={t('Caminho')}>
      {grupo(cadeia.compras, (c) => <Chip key={c.id} tipo="compra" onClick={() => ir('pedido', { id: c.id })}>{c.codigo ?? t('Compra')}{c.fornecedor ? ` · ${c.fornecedor}` : ''}</Chip>)}
      {cadeia.triagens.length > 0 && <>{cadeia.compras.length > 0 && seta}{grupo(cadeia.triagens, (x) => <Chip key={x.id} tipo="triagem" onClick={() => ir('triagem', { aba: 'triagens', t: x.id })}>{x.codigo}</Chip>)}</>}
      {cadeia.vendas.length > 0 && <>{seta}{grupo(cadeia.vendas, (v) => <Chip key={v.id} tipo="venda" onClick={() => ir('venda', { id: v.id })}>{v.codigo}</Chip>)}</>}
    </div>
  )
}

/**
 * CAMINHO ("você está aqui"), numa linha só de chips: compra(s) → triagem(ns) → [este lote] → venda(s); cada chip abre
 * a sua tela e o próximo passo vira um botão pequeno (Separar agora / Vender). Quebra de linha no celular, sem rolar.
 */
export function Caminho({ g, onSeparar, onVender }: { g: Genealogia; onSeparar?(): void; onVender?(): void }) {
  const t = useT()
  const { ir } = useApp()
  const c = g.caminho
  const aqui = g.tipoFoco
  const mais = <X,>(xs: X[], f: (x: X) => ReactNode, n = 2) => <>{xs.slice(0, n).map(f)}{xs.length > n && <span className="text-xs font-semibold text-[var(--suave)]">+{xs.length - n}</span>}</>
  const botao = 'min-h-8 px-3 py-1 text-xs'
  return (
    <nav aria-label={t('Caminho')} className="flex min-w-0 flex-wrap items-center gap-1">
      {c.compras.length
        ? mais(c.compras, (x) => <Chip key={x.id} tipo="compra" ativo={aqui === 'compra'} titulo={aqui === 'compra' ? t('você está aqui') : undefined} onClick={() => ir('pedido', { id: x.id })}>{x.codigo ?? t('Compra')}{x.fornecedor ? ` · ${x.fornecedor}` : ''}</Chip>)
        : <Chip tipo="compra" fantasma>{t('sem compra (cadastro)')}</Chip>}
      {(c.triagens.length > 0 || onSeparar) && <>{seta}{c.triagens.length
        ? mais(c.triagens, (x) => <Chip key={x.id} tipo="triagem" ativo={aqui === 'triagem' && g.foco === x.id} onClick={() => ir('triagem', { aba: 'triagens', t: x.id })}>{x.codigo}</Chip>, 3)
        : <Botao className={botao} onClick={onSeparar}>✂️ {t('Separar agora')}</Botao>}</>}
      {c.lote && <>{seta}<Chip tipo="lote" ativo titulo={t('você está aqui')}>{c.lote.codigo} · <span className="num">{gramasTexto(c.lote.saldo)}</span></Chip></>}
      {(c.vendas.length > 0 || onVender) && <>{seta}
        {mais(c.vendas, (v) => <Chip key={v.id} tipo="venda" ativo={aqui === 'venda'} onClick={() => ir('venda', { id: v.id })}>{v.codigo}</Chip>, 3)}
        {onVender && <Botao className={botao} onClick={onVender}>💰 {t('Vender')}</Botao>}
      </>}
    </nav>
  )
}

type Lote = Genealogia['lotes'][number]
const DIA = 86400000

/** Uma linha da lista curta (sem caixa): o principal abre a tela; o detalhe vem em texto; botão opcional à direita. */
export interface LinhaRastreio { id: string; principal: ReactNode; detalhe?: ReactNode; acao?: ReactNode; onClick?(): void }

/** Lista curta: até 5 linhas, depois "+N" (mostra o resto), separadas por um traço fino. */
export function ListaRastreio({ linhas, max = 5 }: { linhas: LinhaRastreio[]; max?: number }) {
  const [todas, setTodas] = useState(false)
  if (!linhas.length) return null
  const vis = todas ? linhas : linhas.slice(0, max)
  return (
    <ul className="divide-y divide-[var(--borda)]">
      {vis.map((l) => (
        <li key={l.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {l.onClick ? <button type="button" onClick={l.onClick} className="text-left font-semibold hover:underline">{l.principal}</button> : <span className="font-semibold">{l.principal}</span>}
            {l.detalhe && <span className="text-[var(--suave)]"> · {l.detalhe}</span>}
          </span>
          {l.acao}
        </li>
      ))}
      {linhas.length > max && <li className="py-1"><button type="button" onClick={() => setTodas(!todas)} className="min-h-8 text-xs font-semibold text-[var(--marca)] hover:underline">{todas ? '−' : `+${linhas.length - max}`}</button></li>}
    </ul>
  )
}

/**
 * RESUMO DO RASTREIO (o quadro padrão da compra, da venda e do lote): uma linha com a conta e uma barra fina
 * ("30 g · 30 g esperando triagem ✓"), a lista curta do que importa nesta tela e o link para o grafo inteiro.
 *  - compra → os lotes dela e o que aconteceu com cada um (esperando triagem / separado em / vendido em / em estoque)
 *  - venda → as compras de origem em gramas (vêm de fora, em `linhas`)
 *  - lote → "Veio de" e "Para onde foi" em duas linhas
 */
export function RastreioResumo({ g, admin = true, linhas }: { g: Genealogia; admin?: boolean; linhas?: LinhaRastreio[] }) {
  const t = useT()
  const { ir } = useApp()
  const [completo, setCompleto] = useState(false)
  const tt = g.totais
  const esperando = g.lotes.filter((l) => l.bruto).reduce((s, l) => s + Math.max(0, l.saldo), 0)
  const partes = [
    { nome: 'esperando triagem', g: esperando, cor: COR.triagem },
    { nome: 'em estoque', g: tt.emEstoque - esperando, cor: COR.lote },
    { nome: 'vendido', g: tt.vendido, cor: COR.venda },
    { nome: 'perda', g: tt.perda, cor: 'var(--ruim)' },
    { nome: 'cancelado', g: tt.cancelado, cor: 'var(--suave)' },
  ]
  // só as partes que têm grama; tudo zerado → mostra "0 em estoque · 0 vendido · 0 perda"
  const tudoZero = partes.every((p) => !p.g)
  const texto = tudoZero ? partes.slice(1, 4) : partes.filter((p) => p.g)
  const barra = partes.filter((p) => p.g > 0)
  const somaBarra = barra.reduce((s, p) => s + p.g, 0)
  const aviso = g.parcial ? t('(mostrando só uma parte)') : t('(não fecha: confira os ajustes)')
  const cliente = (id: string) => g.vendas.find((v) => v.id === id)?.cliente
  const comCliente = (id: string, codigo?: string) => `${codigo ?? '—'}${cliente(id) ? ` · ${cliente(id)}` : ''}`
  const lista = (xs: string[], n = 2) => xs.slice(0, n).join(', ') + (xs.length > n ? ` +${xs.length - n}` : '')
  // o que aconteceu com um lote, em poucas palavras
  const situacao = (l: Lote) => {
    const ps: string[] = []
    for (const x of g.triagens.filter((x) => l.para.some((p) => p.tipo === 'triagem' && p.id === x.id)))
      ps.push(`${t(x.separou ? 'separado em' : 'juntado em')} ${x.codigo} → ${lista(x.saidas.map((s) => s.codigo ?? '—'), 3)}`)
    const vs = l.para.filter((p) => p.tipo === 'venda')
    if (vs.length) ps.push(`${t('vendido em')} ${lista(vs.map((v) => comCliente(v.id, v.codigo)))}`)
    if (l.saldo > 0) {
      const dias = l.criadoEm ? Math.max(0, Math.floor((Date.now() - new Date(l.criadoEm).getTime()) / DIA)) : 0
      ps.push(l.bruto ? t('esperando triagem há {n} d', { n: dias }) : ps.length ? `${gramasTexto(l.saldo)} ${t('em estoque')}` : t('em estoque'))
    }
    return ps.length ? ps.join(' · ') : t('nada em estoque')
  }
  let corpo: ReactNode = null
  if (linhas) corpo = <ListaRastreio linhas={linhas} />
  else if (g.tipoFoco === 'compra') {
    const c = g.compras.find((x) => x.id === g.foco)
    const lotes = (c?.lotes ?? []).flatMap((x) => {
      const l = g.lotes.find((y) => y.id === x.id)
      return l ? [{ l, g: x.g || l.entrou }] : []
    })
    corpo = <ListaRastreio linhas={lotes.map(({ l, g: gr }) => ({
      id: l.id,
      principal: <><span aria-hidden>📦</span> <span className="font-mono">{l.codigo ?? '—'}</span></>,
      onClick: () => ir('lote', { id: l.id }),
      detalhe: <><span className="text-[var(--texto)]">{l.nome}</span> · <b className="num text-[var(--texto)]">{gramasTexto(gr)}</b> · {situacao(l)}</>,
      acao: admin && l.bruto && l.saldo > 0 ? <Botao variante="secundario" className="min-h-8 px-3 py-1 text-xs" onClick={() => ir('separar', { id: l.id })}>✂️ {t('Separar')}</Botao> : undefined,
    }))} />
  } else if (g.tipoFoco === 'lote') {
    const l = g.lotes.find((x) => x.id === g.foco)
    if (l) {
      const fornecedor = (id: string) => g.compras.find((c) => c.id === id)?.fornecedor
      const nome = (x: Ligacao) => (x.tipo === 'compra' ? `${x.codigo ?? t('Compra')}${fornecedor(x.id) ? ` · ${fornecedor(x.id)}` : ''}` : x.tipo === 'venda' ? comCliente(x.id, x.codigo) : (x.codigo ?? '—'))
      const abrir = (x: Ligacao) => (x.tipo === 'compra' ? ir('pedido', { id: x.id }) : x.tipo === 'triagem' ? ir('triagem', { aba: 'triagens', t: x.id }) : x.tipo === 'venda' ? ir('venda', { id: x.id }) : ir('lote', { id: x.id }))
      const link = (x: Ligacao) => <button type="button" onClick={() => abrir(x)} className="font-semibold text-[var(--texto)] hover:underline">{nome(x)}</button>
      // até 3 ligações, depois "+N" (o resto está no rastreio completo)
      const ligs = (xs: Ligacao[], entre: boolean) => <>{xs.slice(0, 3).map((x, k) => (
        <span key={x.tipo + x.id}>{k > 0 && ', '}{link(x)}<span className="num"> {entre ? `(${gramasTexto(x.g)})` : gramasTexto(x.g)}</span></span>
      ))}{xs.length > 3 && <span className="font-semibold"> +{xs.length - 3}</span>}</>
      // veio de uma triagem: mostra antes a(s) compra(s) de onde o cabelo saiu ("P-0001 · Maria → T-3 (18 kg)")
      const origem = l.de.some((x) => x.tipo === 'triagem') && l.compras.length
        ? <>{l.compras.slice(0, 2).map((c, k) => <span key={c.id}>{k > 0 && ', '}{link({ tipo: 'compra', id: c.id, codigo: c.codigo, g: 0 })}</span>)}{l.compras.length > 2 && ` +${l.compras.length - 2}`} → </>
        : null
      const linha = (rotulo: string, conteudo: ReactNode) => (
        <li className="flex min-w-0 flex-wrap items-baseline gap-x-2 py-2 text-sm"><span className="text-xs font-semibold text-[var(--suave)]">{t(rotulo)}</span><span className="min-w-0 flex-1 text-[var(--suave)] [overflow-wrap:anywhere]">{conteudo}</span></li>
      )
      corpo = (
        <ul className="divide-y divide-[var(--borda)]">
          {linha('Veio de', l.de.length ? <>{origem}{ligs(l.de, true)}</> : t('sem compra (cadastro)'))}
          {linha('Para onde foi', <>{ligs(l.para, false)}{l.para.length > 0 && l.saldo > 0 && ' · '}{l.saldo > 0 ? <>{t('em estoque')} <b className="num text-[var(--texto)]">{gramasTexto(l.saldo)}</b></> : !l.para.length && t('nada em estoque')}</>)}
        </ul>
      )
    }
  }
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="num flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <b>{gramasTexto(tt.entrou)}</b>
          {texto.map((p) => (
            <span key={p.nome} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: p.cor }} />
              {p.g ? gramasTexto(p.g) : '0'} {t(p.nome)}
            </span>
          ))}
          <span className={cx('font-bold', tt.confere ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')} title={tt.confere ? t('Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6.') : aviso}>
            {tt.confere ? '✓' : <>⚠️ <span className="text-xs font-semibold">{aviso}</span></>}
          </span>
        </p>
        {somaBarra > 0 && (
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--fundo)]" aria-hidden>
            {barra.map((p) => <span key={p.nome} style={{ width: `${(p.g * 100) / somaBarra}%`, background: p.cor }} />)}
          </div>
        )}
      </div>
      {corpo}
      <button type="button" aria-expanded={completo} onClick={() => setCompleto(!completo)} className="min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">{completo ? t('Fechar o rastreio') : t('Ver rastreio completo →')}</button>
      {completo && <RastreioTotal g={g} admin={admin} />}
    </div>
  )
}

/** O grafo inteiro em gramas: Compras | Triagens | Lotes | Para onde foi, e a conta "entrou = vendido + estoque + perda". */
export function RastreioTotal({ g, admin = true }: { g: Genealogia; admin?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const [todos, setTodos] = useState(false)
  const tt = g.totais
  const foco = (id: Id) => g.foco === id
  const lig = (x: { tipo: 'compra' | 'triagem' | 'lote' | 'venda'; id: Id; codigo?: string; g: number }) => (
    <li key={x.tipo + x.id} className="flex items-center justify-between gap-2">
      <Chip tipo={x.tipo} onClick={() => abrir(x.tipo, x.id)}>{x.codigo ?? '—'}</Chip>
      <span className="num whitespace-nowrap text-xs font-semibold">{gramasTexto(x.g)}</span>
    </li>
  )
  const abrir = (tipo: string, id: Id) => (tipo === 'compra' ? ir('pedido', { id }) : tipo === 'triagem' ? ir('triagem', { aba: 'triagens', t: id }) : tipo === 'venda' ? ir('venda', { id }) : ir('lote', { id }))
  const no = (tipo: keyof typeof COR, id: Id, cab: ReactNode, corpo: ReactNode, menu?: ReactNode, ante?: ReactNode) => (
    <li key={id} className={cx('min-w-0 rounded-xl border bg-[var(--cartao)] p-2 text-sm', foco(id) ? 'border-[var(--marca)] ring-2 ring-[var(--marca)]' : 'border-[var(--borda)]')} style={{ borderLeft: `4px solid ${COR[tipo]}` }}>
      <div className="flex items-start gap-1">
        {ante}
        <button type="button" onClick={() => abrir(tipo, id)} className="min-w-0 flex-1 text-left hover:underline">{cab}</button>
        {menu}
      </div>
      <div className="mt-1 space-y-1">{corpo}</div>
    </li>
  )
  const MAX = 12
  const lotes = todos ? g.lotes : g.lotes.slice(0, MAX)
  const coluna = (titulo: string, sub: string, n: number, itens: ReactNode) => (
    <section className="min-w-0">
      <h3 className="mb-1 flex items-baseline justify-between gap-2 text-sm font-bold"><span>{t(titulo)}</span><span className="text-xs font-normal text-[var(--suave)]">{t(sub)} · {n}</span></h3>
      {n ? <ul className="space-y-2">{itens}</ul> : <p className="rounded-xl border border-dashed border-[var(--borda)] p-3 text-center text-xs text-[var(--suave)]">—</p>}
    </section>
  )
  const rot = (s: string) => <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t(s)}</p>
  return (
    <div className="space-y-3">
      <p className={cx('num rounded-xl p-2 text-sm font-semibold', tt.confere ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
        {t('Entrou')} {gramasTexto(tt.entrou)} = {t('vendido')} {gramasTexto(tt.vendido)} + {t('em estoque')} {gramasTexto(tt.emEstoque)} + {t('perda')} {gramasTexto(tt.perda)}{tt.cancelado ? <> + {t('cancelado')} {gramasTexto(tt.cancelado)}</> : null} {tt.confere ? '✓' : `⚠️ ${g.parcial ? t('(mostrando só uma parte)') : t('(não fecha: confira os ajustes)')}`}
        <Info texto="Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6." />
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {coluna('Compras', 'de onde veio', g.compras.length, g.compras.map((c) =>
          no('compra', c.id, <><b>{c.codigo ?? t('Compra')}</b>{c.fornecedor ? ` · ${c.fornecedor}` : ''}<span className="block text-xs text-[var(--suave)]">{dataBR(c.data)} · <b className="num">{gramasTexto(c.g)}</b></span></>, <>{rot('virou')}<ul className="space-y-0.5">{c.lotes.map(lig)}</ul></>),
        ))}
        {coluna('Triagens', 'juntar e separar', g.triagens.length, g.triagens.map((x) =>
          no('triagem', x.id, <><b>{x.codigo}</b> <span className="text-xs text-[var(--suave)]">{[x.juntou && t('juntou'), x.separou && t('separou')].filter(Boolean).join(' + ')}</span><span className="block text-xs text-[var(--suave)]">{dataBR(x.em)}{x.por ? ` · ${x.por}` : ''}</span></>, <>
            {rot('entrou')}<ul className="space-y-0.5">{x.entradas.map(lig)}</ul>
            {rot('saiu')}<ul className="space-y-0.5">{x.saidas.map(lig)}</ul>
            <p className={cx('num text-xs font-semibold', x.perda > 0 ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>{t('perda')} {gramasTexto(x.perda)} ({fmt(x.perdaPct, 'percentual')})</p>
          </>),
        ))}
        {coluna('Lotes', 'onde está agora', g.lotes.length, <>
          {lotes.map((l) =>
            no('lote', l.id, <><b>{l.codigo}</b> · {l.nome}</>, <>
              <ul className="space-y-0.5">{l.de.map(lig)}</ul>
              {l.para.length > 0 && <>{rot('foi para')}<ul className="space-y-0.5">{l.para.map(lig)}</ul></>}
              <p className="num text-xs"><b className={l.saldo > 0 ? 'text-[var(--alerta)]' : 'text-[var(--suave)]'}>{l.saldo > 0 ? `${gramasTexto(l.saldo)} ${t('em estoque')}` : t('nada em estoque')}</b>{l.ajustes ? <span className="text-[var(--ruim)]"> · {t('ajuste')} {gramasTexto(l.ajustes)}</span> : null}</p>
            </>, admin ? <MenuAcoes acoes={acoesLote({ id: l.id, saldo: l.saldo, compras: l.compras, vendavel: !l.bruto }, { ir, t, admin, semAbrir: false })} /> : undefined,
            <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} tamanho="sm" semCamera={!admin} />),
          )}
          {g.lotes.length > MAX && <li><button type="button" onClick={() => setTodos(!todos)} className="min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{todos ? t('Mostrar menos') : t('Ver todos ({n})', { n: g.lotes.length })}</button></li>}
        </>)}
        {coluna('Para onde foi', 'vendas', g.vendas.length, g.vendas.map((v) =>
          no('venda', v.id, <><b>{v.codigo}</b>{v.cliente ? ` · ${v.cliente}` : ''}<span className="block text-xs text-[var(--suave)]">{dataBR(v.data)} · <b className="num">{gramasTexto(v.g)}</b>{v.agendada ? ` · ${t('agendada')}` : ''}</span></>, <>{rot('saiu de')}<ul className="space-y-0.5">{v.lotes.map(lig)}</ul></>),
        ))}
      </div>
    </div>
  )
}
