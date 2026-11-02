// RASTREIO TOTAL: cada grama, como entrou e para onde foi. Uma peça só, usada no lote, na compra, na triagem, na venda
// e na tela de rastreio. Lê a consulta `genealogia` (compras → triagens → lotes → vendas, em gramas em cada ligação).
//  - CadeiaChips: a linha curta "Compra P-0003 · Helena → Triagem T-2 → Venda V-12" (cada chip abre a sua tela)
//  - Caminho: a barra "você está aqui" com o próximo passo
//  - RastreioTotal: o grafo inteiro em colunas (Compras | Triagens | Lotes | Para onde foi) e a conta que fecha

import { type ReactNode, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import type { Cadeia } from '../core/services/estoque'
import { Botao, cx, dataBR, fmt, gramasTexto } from './base'
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
 * CAMINHO ("você está aqui"): compra(s) → triagem(ns) → [este lote] → venda(s), com os passos que já aconteceram
 * cheios e clicáveis, e o próximo passo tracejado com o botão do que fazer (Separar / Vender).
 */
export function Caminho({ g, onSeparar, onVender }: { g: Genealogia; onSeparar?(): void; onVender?(): void }) {
  const t = useT()
  const { ir } = useApp()
  const c = g.caminho
  const passo = (tipo: keyof typeof COR, rotulo: string, conteudo: ReactNode, aqui?: boolean) => (
    <li className={cx('flex min-w-0 flex-col gap-1 rounded-2xl p-2', aqui ? 'bg-[var(--marca-suave)] ring-2 ring-[var(--marca)]' : 'bg-[var(--fundo)]')}>
      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[var(--suave)]">{ICONE[tipo]} {t(rotulo)}{aqui && <span className="normal-case tracking-normal text-[var(--marca)]">· {t('você está aqui')}</span>}</span>
      <span className="flex flex-wrap items-center gap-1">{conteudo}</span>
    </li>
  )
  const mais = <X,>(xs: X[], f: (x: X) => ReactNode, n = 2) => <>{xs.slice(0, n).map(f)}{xs.length > n && <span className="text-xs font-semibold text-[var(--suave)]">+{xs.length - n}</span>}</>
  const sep = <li aria-hidden className="flex items-center justify-center px-1 text-lg font-bold text-[var(--marca)]"><span className="md:hidden">↓</span><span className="hidden md:inline">→</span></li>
  const aqui = g.tipoFoco
  return (
    <nav aria-label={t('Caminho')}>
      <ol className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-stretch">
        {passo('compra', c.compras.length > 1 ? 'Compras' : 'Compra', c.compras.length ? mais(c.compras, (x) => <Chip key={x.id} tipo="compra" ativo={aqui === 'compra'} onClick={() => ir('pedido', { id: x.id })}>{x.codigo ?? t('Compra')}{x.fornecedor ? ` · ${x.fornecedor}` : ''}</Chip>) : <span className="text-xs text-[var(--suave)]">{t('sem compra (cadastro)')}</span>, aqui === 'compra')}
        {sep}
        {passo('triagem', 'Triagem', c.triagens.length
          ? mais(c.triagens, (x) => <Chip key={x.id} tipo="triagem" ativo={aqui === 'triagem' && g.foco === x.id} onClick={() => ir('triagem', { aba: 'triagens', t: x.id })}>{x.codigo}</Chip>, 3)
          : <>{onSeparar ? <Botao className="min-h-8 px-3 py-1 text-xs" onClick={onSeparar}>✂️ {t('Separar agora')}</Botao> : <Chip tipo="triagem" fantasma>{t('ainda não')}</Chip>}</>, aqui === 'triagem')}
        {c.lote && <>{sep}{passo('lote', 'Este lote', <><b className="text-sm">{c.lote.codigo}</b><span className="num text-xs text-[var(--suave)]">{gramasTexto(c.lote.saldo)} {t('em estoque')}</span></>, true)}</>}
        {sep}
        {passo('venda', c.vendas.length > 1 ? 'Vendas' : 'Venda', <>
          {mais(c.vendas, (v) => <Chip key={v.id} tipo="venda" ativo={aqui === 'venda'} onClick={() => ir('venda', { id: v.id })}>{v.codigo}</Chip>, 3)}
          {onVender ? <Botao className="min-h-8 px-3 py-1 text-xs" onClick={onVender}>💰 {t('Vender')}</Botao> : !c.vendas.length && <Chip tipo="venda" fantasma>{t('próximo passo')}</Chip>}
        </>, aqui === 'venda')}
      </ol>
    </nav>
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
        {t('Entrou')} {gramasTexto(tt.entrou)} = {t('vendido')} {gramasTexto(tt.vendido)} + {t('em estoque')} {gramasTexto(tt.emEstoque)} + {t('perda')} {gramasTexto(tt.perda)} {tt.confere ? '✓' : `⚠️ ${g.parcial ? t('(mostrando só uma parte)') : t('(não fecha: confira os ajustes)')}`}
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
