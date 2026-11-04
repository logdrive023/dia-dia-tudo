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
import { GrupoNumeros, NumeroGrande } from './numeroGrande'
import { useApp } from './contexto'
import { LinhaDoTempo } from './linhaTempo'
import { HistoricoPacote } from './historicoPacote'
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
          {/* basis: o texto não encolhe até uma palavra por linha; o botão desce quando não cabe */}
          <span className="min-w-0 flex-1 basis-48 break-words">
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
        <li className="flex min-w-0 flex-wrap items-baseline gap-x-2 py-2 text-sm"><span className="text-xs font-semibold text-[var(--suave)]">{t(rotulo)}</span><span className="min-w-0 flex-1 text-[var(--suave)] break-words">{conteudo}</span></li>
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

/**
 * RASTREIO TOTAL — o mapa inteiro, grama a grama, na ordem do negócio. Regra: CADA INFORMAÇÃO APARECE UMA VEZ, no lugar
 * dela (nada de repetir "3 kg" em cinco lugares):
 *   1. BALANÇO: os números grandes (entrou · vendido · em estoque · perda) + a barra + "✓ a conta fecha"
 *   2. AS ETAPAS, de cima para baixo: 🛒 Compras → 📦 Entrou no estoque → ✂️ Triagens → 🏷 Pacotes separados → 💰 Vendas
 *      cada registro num cartão: código + nome + data, o peso dele (uma vez, à direita) e DE ONDE veio (os códigos,
 *      só para trás — o "para onde foi" é a etapa de baixo). O pacote diz o que aconteceu com os gramas (barra, ou
 *      "tudo em estoque" quando é uma coisa só) e a etiqueta. "Histórico ▾" abre o registro completo daquele cartão.
 * O registro desta tela fica com anel e "você está aqui". Tocar qualquer código abre a tela dele.
 */
export function RastreioTotal({ g, admin = true }: { g: Genealogia; admin?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const tt = g.totais
  const abrir = (tipo: string, id: Id) => (tipo === 'compra' ? ir('pedido', { id }) : tipo === 'triagem' ? ir('triagem', { aba: 'triagens', t: id }) : tipo === 'venda' ? ir('venda', { id }) : ir('lote', { id }))
  const doEstoque = g.lotes.filter((l) => !l.de.some((x) => x.tipo === 'triagem'))
  const separados = g.lotes.filter((l) => l.de.some((x) => x.tipo === 'triagem'))
  const soma = (xs: { g: number }[]) => xs.reduce((s, x) => s + x.g, 0)
  const esperando = g.lotes.filter((l) => l.bruto).reduce((s, l) => s + Math.max(0, l.saldo), 0)
  const partes = [
    { nome: 'vendido', g: tt.vendido, cor: COR.venda },
    { nome: 'em estoque', g: tt.emEstoque - esperando, cor: COR.lote },
    { nome: 'esperando triagem', g: esperando, cor: COR.triagem },
    { nome: 'perda', g: tt.perda, cor: 'var(--ruim)' },
    { nome: 'cancelado', g: tt.cancelado, cor: 'var(--suave)' },
  ]
  const barra = partes.filter((p) => p.g > 0)
  const somaBarra = barra.reduce((s, p) => s + p.g, 0)
  const pct = (n: number) => (tt.entrou && n ? `${Math.round((n * 100) / tt.entrou)}%` : undefined)

  /** de onde veio: os códigos (um toque abre); gramas só quando veio de mais de um lugar */
  const origem = (xs: Ligacao[]) => xs.length > 0 && (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-[var(--suave)]">{t('de')}</span>
      {xs.map((x) => <Chip key={x.tipo + x.id} tipo={x.tipo} onClick={() => abrir(x.tipo, x.id)}>{x.codigo ?? '—'}{xs.length > 1 ? <span className="num font-normal"> · {gramasTexto(x.g)}</span> : null}</Chip>)}
    </div>
  )
  const cartao = (tipo: keyof typeof COR, id: Id, p: { codigo: ReactNode; nome?: ReactNode; data?: string; peso?: ReactNode; midia?: ReactNode; menu?: ReactNode; corpo?: ReactNode; historico?: ReactNode }) => (
    <Cartaozinho key={id} cor={COR[tipo]} foco={g.foco === id} historico={p.historico}
      cabeca={<>
        {p.midia ?? <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${COR[tipo]} 14%, transparent)` }}>{ICONE[tipo]}</span>}
        <button type="button" onClick={() => abrir(tipo, id)} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-x-2">
            <b className="font-mono text-xs" style={{ color: COR[tipo] }}>{p.codigo}</b>
            {p.data && <span className="num text-xs text-[var(--suave)]">{dataBR(p.data)}</span>}
            {g.foco === id && <span className="rounded-full bg-[var(--marca)] px-2 text-[11px] font-bold text-white">{t('você está aqui')}</span>}
          </span>
          {p.nome && <b className="block truncate leading-tight">{p.nome}</b>}
        </button>
        {p.peso && <b className="num shrink-0 whitespace-nowrap text-lg">{p.peso}</b>}
        {p.menu}
      </>}
      corpo={p.corpo}
    />
  )
  // o que aconteceu com os gramas do pacote: uma frase quando é uma coisa só; a barra quando dividiu
  const vidaLote = (l: Lote) => {
    const ps = [
      { nome: 'vendido', g: l.vendido, cor: COR.venda },
      { nome: 'triado', g: l.triado, cor: COR.triagem },
      { nome: l.bruto ? 'esperando triagem' : 'em estoque', g: Math.max(0, l.saldo), cor: l.bruto ? COR.triagem : COR.lote },
      { nome: 'ajuste', g: Math.max(0, l.ajustes), cor: 'var(--ruim)' },
      { nome: 'cancelado', g: l.cancelado, cor: 'var(--suave)' },
    ].filter((p) => p.g > 0)
    if (!ps.length) return <span className="text-xs text-[var(--suave)]">{t('nada em estoque')}</span>
    if (ps.length === 1) {
      const frase = ps[0].nome === 'vendido' ? 'tudo vendido' : ps[0].nome === 'triado' ? 'tudo foi para a triagem' : ps[0].nome === 'em estoque' ? 'tudo em estoque' : ps[0].nome
      return <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ps[0].cor }}><span aria-hidden className="inline-block size-2 rounded-full" style={{ background: ps[0].cor }} />{t(frase)}</span>
    }
    return (
      <div className="min-w-0 flex-1">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--fundo)]" aria-hidden>
          {ps.map((p) => <span key={p.nome} style={{ width: `${Math.min(100, (p.g * 100) / (l.entrou || 1))}%`, background: p.cor }} />)}
        </div>
        <p className="num mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--suave)]">
          {ps.map((p) => <span key={p.nome} className="inline-flex items-center gap-1"><span aria-hidden className="inline-block size-2 rounded-full" style={{ background: p.cor }} />{t(p.nome)} {gramasTexto(p.g)}</span>)}
        </p>
      </div>
    )
  }
  const cartaoLote = (l: Lote) => cartao('lote', l.id, {
    codigo: l.codigo ?? '—', nome: l.nome, data: l.criadoEm, peso: gramasTexto(l.entrou),
    midia: <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} tamanho="sm" semCamera={!admin} />,
    menu: admin ? <MenuAcoes acoes={acoesLote({ id: l.id, saldo: l.saldo, compras: l.compras, vendavel: !l.bruto }, { ir, t, admin, semAbrir: false })} /> : undefined,
    corpo: <>
      {origem(l.de)}
      <div className="flex flex-wrap items-center gap-2">
        {vidaLote(l)}
        {!l.bruto && (
          <span className={cx('ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold', l.etiquetaEm ? 'bg-[var(--bom)]/15 text-[var(--bom)]' : 'bg-[var(--alerta)]/15 text-[var(--alerta)]')}>
            🏷 {l.etiquetaEm ? `${t('impressa')} ${dataBR(l.etiquetaEm)}${l.etiquetaPor ? ` · ${l.etiquetaPor}` : ''}` : t('sem etiqueta')}
          </span>
        )}
      </div>
    </>,
    historico: <HistoricoPacote id={l.id} />,
  })
  const etapas: { id: string; icone: string; cor: string; titulo: string; explica: string; vazio?: string; itens: ReactNode[] }[] = [
    {
      id: 'compra', icone: ICONE.compra, cor: COR.compra, titulo: 'Compras', explica: 'de onde veio o cabelo', vazio: 'Sem compra (cadastro direto).',
      itens: g.compras.map((c, k) => cartao('compra', c.id, { codigo: c.codigo ?? t('Compra'), nome: c.fornecedor, data: c.data, peso: gramasTexto(c.g), historico: <LinhaDoTempo id={c.id} prefixo={`rc${k}`} simples /> })),
    },
    { id: 'estoque', icone: ICONE.lote, cor: COR.lote, titulo: 'Entrou no estoque', explica: 'os pacotes como chegaram (bruto ou já separado na compra)', itens: doEstoque.map(cartaoLote) },
    {
      id: 'triagem', icone: ICONE.triagem, cor: COR.triagem, titulo: 'Triagens', explica: 'juntar e separar por medida', vazio: 'Ainda não passou por triagem.',
      itens: g.triagens.map((x) => cartao('triagem', x.id, {
        codigo: x.codigo, nome: x.por, data: x.em, peso: gramasTexto(soma(x.saidas)),
        corpo: <>
          {origem(x.entradas)}
          <p className="num flex flex-wrap items-center gap-x-2 text-xs text-[var(--suave)]">
            <span>{[x.juntou && `🔗 ${t('juntou')}`, x.separou && `✂️ ${t('separou')}`].filter(Boolean).join(' · ')}</span>
            <span className={cx('rounded-full px-2 py-0.5 font-semibold', x.perda > 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : 'bg-[var(--fundo)]')}>{t('perda')} {gramasTexto(x.perda)} · {fmt(x.perdaPct, 'percentual')}</span>
          </p>
        </>,
      })),
    },
    { id: 'separados', icone: '🏷', cor: COR.lote, titulo: 'Pacotes separados', explica: 'o que saiu da triagem, com a etiqueta de cada um', itens: separados.map(cartaoLote) },
    {
      id: 'venda', icone: ICONE.venda, cor: COR.venda, titulo: 'Vendas', explica: 'para onde foi', vazio: 'Ainda não foi vendido.',
      itens: g.vendas.map((v, k) => cartao('venda', v.id, {
        codigo: v.codigo, nome: v.cliente, data: v.data, peso: gramasTexto(v.g),
        corpo: <>{origem(v.lotes)}{v.agendada && <span className="w-fit rounded-full bg-[var(--alerta)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--alerta)]">{t('agendada')}</span>}</>,
        historico: <LinhaDoTempo id={v.id} prefixo={`rv${k}`} simples />,
      })),
    },
  ]
  // etapas de pacote sem nada somem; as do negócio ficam com o aviso
  const visiveis = etapas.filter((e) => e.itens.length || e.vazio)
  return (
    <div className="space-y-4">
      {/* 1. BALANÇO: os números uma vez só */}
      <section aria-label={t('Balanço')} className="space-y-2">
        <GrupoNumeros colunas={tt.cancelado ? 5 : 4} className="mb-0">
          <NumeroGrande icone="🛒" rotulo="Entrou" valor={gramasTexto(tt.entrou)} cor={COR.compra} />
          <NumeroGrande icone="💰" rotulo="Vendido" valor={gramasTexto(tt.vendido)} sub={pct(tt.vendido)} cor={COR.venda} />
          <NumeroGrande icone="📦" rotulo="Em estoque" valor={gramasTexto(tt.emEstoque)} sub={esperando ? `${t('esperando triagem')} ${pct(esperando) ?? ''}` : pct(tt.emEstoque)} cor={COR.lote} />
          <NumeroGrande icone="⚠️" rotulo="Perda" valor={gramasTexto(tt.perda)} sub={pct(tt.perda)} tom={tt.perda > 0 ? 'ruim' : undefined} />
          {tt.cancelado > 0 && <NumeroGrande icone="↩️" rotulo="Devolvido" valor={gramasTexto(tt.cancelado)} sub={pct(tt.cancelado)} />}
        </GrupoNumeros>
        <div className="flex items-center gap-2">
          {somaBarra > 0 && (
            <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--fundo)] ring-1 ring-[var(--borda)]" aria-hidden>
              {barra.map((p) => <span key={p.nome} title={`${t(p.nome)} ${gramasTexto(p.g)}`} style={{ width: `${(p.g * 100) / somaBarra}%`, background: p.cor }} />)}
            </div>
          )}
          <span className={cx('inline-flex shrink-0 items-center gap-1 text-xs font-semibold', tt.confere ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
            {tt.confere ? `✓ ${t('A conta fecha')}` : `⚠️ ${g.parcial ? t('(mostrando só uma parte)') : t('(não fecha: confira os ajustes)')}`}
            <Info texto="Comprado = em pacotes + vendido + perda. Ex.: 10 kg = 4 + 5,4 + 0,6." />
          </span>
        </div>
      </section>

      {/* 2. AS ETAPAS, na ordem do negócio */}
      {visiveis.map((e) => (
        <section key={e.id} aria-label={t(e.titulo)} className="rounded-2xl bg-[var(--fundo)] p-2 ring-1 ring-[var(--borda)] sm:p-3">
          <header className="mb-2 flex items-center gap-3 px-1">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: e.cor }}>{e.icone}</span>
            <span className="min-w-0 flex-1">
              <b className="block">{t(e.titulo)} <span className="num text-sm font-normal text-[var(--suave)]">· {e.itens.length}</span></b>
              <span className="block text-xs text-[var(--suave)]">{t(e.explica)}</span>
            </span>
          </header>
          {e.itens.length
            ? <Mais itens={e.itens} />
            : <p className="rounded-xl border border-dashed border-[var(--borda)] bg-[var(--cartao)] p-3 text-center text-sm text-[var(--suave)]">{t(e.vazio!)}</p>}
        </section>
      ))}
    </div>
  )
}

/** cartão de um registro do mapa: cabeça (código, nome, peso), o corpo curto e o "Histórico ▾" que abre o registro inteiro */
function Cartaozinho({ cor, foco, cabeca, corpo, historico }: { cor: string; foco: boolean; cabeca: ReactNode; corpo?: ReactNode; historico?: ReactNode }) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  return (
    <li className={cx('relative min-w-0 overflow-hidden rounded-2xl border bg-[var(--cartao)] shadow-sm', aberto && 'sm:col-span-2 xl:col-span-3', foco ? 'border-[var(--marca)] ring-2 ring-[var(--marca)]' : 'border-[var(--borda)]')}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
      <div className="flex items-start gap-2 py-2.5 pl-3.5 pr-2.5">{cabeca}</div>
      {corpo && <div className="space-y-2 pb-2.5 pl-3.5 pr-2.5">{corpo}</div>}
      {historico && (
        <>
          <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-10 w-full items-center justify-between border-t border-[var(--borda)] px-3.5 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
            <span>📜 {t('Histórico')}</span><span aria-hidden className={cx('transition-transform', aberto && 'rotate-180')}>▾</span>
          </button>
          {aberto && <div className="border-t border-[var(--borda)] bg-[var(--fundo)] p-2 sm:p-3">{historico}</div>}
        </>
      )}
    </li>
  )
}

/** a grade de cartões de uma etapa: até 9, depois "Ver todos" */
function Mais({ itens }: { itens: ReactNode[] }) {
  const t = useT()
  const [todos, setTodos] = useState(false)
  const MAX = 9
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{todos ? itens : itens.slice(0, MAX)}</ul>
      {itens.length > MAX && <button type="button" onClick={() => setTodos(!todos)} className="mt-2 min-h-10 w-full rounded-xl bg-[var(--cartao)] text-sm font-semibold text-[var(--marca)] ring-1 ring-[var(--borda)] hover:bg-[var(--marca-suave)]">{todos ? t('Mostrar menos') : t('Ver todos ({n})', { n: itens.length })}</button>}
    </>
  )
}
