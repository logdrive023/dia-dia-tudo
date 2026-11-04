// CAMINHO DO CABELO — a linha do tempo PADRÃO do sistema (Compra, Triagem, Estoque/pacote e Venda usam a mesma).
// Bater o olho e entender: as 4 etapas da vida do cabelo, sempre na mesma ordem —
//   🛒 Compra → ✂️ Triagem → 📦 Estoque → 💰 Venda
//   · ✓ verde = já aconteceu (com o resumo: quanto, quando, quem);
//   · destaque = a etapa DESTA tela ("você está aqui");
//   · cinza tracejado = ainda vai acontecer.
// Cada código (P-0005, T-0001, L-0022, V-0006) é UM CLIQUE para abrir o registro daquela etapa — da venda dá para
// pular direto para a triagem ou para a compra. O histórico detalhado (o log) de cada tela continua embaixo dela.
// Os dados vêm da consulta "genealogia" (a mesma do rastreio em gramas): nada é calculado de outro jeito aqui.

import type { Id } from '../core/domain/tipos'
import { cx, dataBR, gramasTexto, pctBp } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

export type EtapaCabelo = 'compra' | 'triagem' | 'estoque' | 'venda'

const MAX = 3

export function CaminhoDoCabelo({ de, atual, className }: {
  /** de onde olhar a cadeia: a compra, o pacote, a venda ou a triagem */
  de: { compraId: Id } | { itemId: Id } | { vendaId: Id } | { triagemId: Id }
  /** a etapa desta tela (fica em destaque) */
  atual: EtapaCabelo
  className?: string
}) {
  const t = useT()
  const { ir, sessao } = useApp()
  const { dados: g } = useConsulta('genealogia', de, sessao.perfil === 'admin')
  if (!g) return null
  const compras = g.compras
  const triagens = g.triagens
  const lotes = g.lotes.filter((l) => !l.bruto)
  const vendas = g.vendas
  const comprado = compras.reduce((s, c) => s + c.g, 0) || g.totais.entrou
  const etapas: { id: EtapaCabelo; icone: string; nome: string; feito: boolean; resumo: string; detalhe?: string; itens: { id: Id; codigo?: string; abrir(): void }[] }[] = [
    {
      id: 'compra', icone: '🛒', nome: 'Compra', feito: compras.length > 0,
      resumo: compras.length ? `${gramasTexto(comprado)}${compras[0].fornecedor ? ` · ${compras.map((c) => c.fornecedor).filter(Boolean).join(', ')}` : ''}` : t('ainda não'),
      detalhe: compras[0]?.data ? dataBR(compras[0].data) : undefined,
      itens: compras.map((c) => ({ id: c.id, codigo: c.codigo, abrir: () => ir('pedido', { id: c.id }) })),
    },
    {
      id: 'triagem', icone: '✂️', nome: 'Triagem', feito: triagens.length > 0,
      resumo: triagens.length
        ? `${gramasTexto(triagens.reduce((s, x) => s + x.entradas.reduce((a, e) => a + e.g, 0), 0))} → ${gramasTexto(triagens.reduce((s, x) => s + x.saidas.reduce((a, e) => a + e.g, 0), 0))}`
        : t('ainda não separado'),
      detalhe: triagens.length ? [`${t('perda')} ${pctBp(triagens[0].perdaPct)}`, triagens[0].por, triagens[0].em && dataBR(triagens[0].em)].filter(Boolean).join(' · ') : undefined,
      itens: triagens.map((x) => ({ id: x.id, codigo: x.codigo, abrir: () => ir('triagem', { aba: 'triagens', t: x.id }) })),
    },
    {
      id: 'estoque', icone: '📦', nome: 'Estoque', feito: lotes.length > 0,
      resumo: lotes.length ? `${t('{n} pacote(s)', { n: lotes.length })} · ${t('{g} agora', { g: gramasTexto(g.totais.emEstoque) })}` : t('ainda não'),
      detalhe: lotes.length ? t('entraram {g}', { g: gramasTexto(lotes.reduce((s, l) => s + l.entrou, 0)) }) : undefined,
      itens: lotes.map((l) => ({ id: l.id, codigo: l.codigo, abrir: () => ir('lote', { id: l.id }) })),
    },
    {
      id: 'venda', icone: '💰', nome: 'Venda', feito: vendas.length > 0,
      resumo: vendas.length ? `${t('{n} venda(s)', { n: vendas.length })} · ${gramasTexto(g.totais.vendido)}` : t('ainda não vendido'),
      detalhe: vendas.length ? vendas.map((v) => v.cliente).filter(Boolean).slice(0, 2).join(', ') || undefined : undefined,
      itens: vendas.map((v) => ({ id: v.id, codigo: v.codigo, abrir: () => ir('venda', { id: v.id }) })),
    },
  ]
  return (
    <section aria-label={t('Caminho do cabelo')} className={cx('rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4', className)}>
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">
        {t('Caminho do cabelo')}<span className="font-normal normal-case tracking-normal">· {t('toque num código para abrir')}</span>
      </p>
      {/* celular: vertical; computador: as 4 etapas lado a lado, ligadas por um traço */}
      <ol className="grid gap-0 md:grid-cols-4 md:gap-3">
        {etapas.map((e, k) => {
          const aqui = e.id === atual
          const estado = aqui ? 'aqui' : e.feito ? 'feito' : 'falta'
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0 md:flex-col md:gap-2 md:pb-0">
              {/* o traço que liga as etapas (vertical no celular, horizontal no computador) */}
              {k < etapas.length - 1 && <span aria-hidden className={cx('absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 md:left-10 md:top-5 md:h-0.5 md:w-[calc(100%-1.75rem)]', etapas[k + 1].feito || etapas[k + 1].id === atual ? 'bg-[var(--bom)]' : 'border-l-2 border-dashed border-[var(--borda)] bg-transparent md:border-l-0 md:border-t-2')} />}
              <span aria-hidden className={cx('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg',
                estado === 'aqui' ? 'bg-[var(--marca)] text-white shadow-[0_0_0_4px_var(--marca-suave)]' : estado === 'feito' ? 'bg-[var(--bom)] text-white' : 'border-2 border-dashed border-[var(--borda)] bg-[var(--cartao)] opacity-70')}>
                {estado === 'feito' ? '✓' : e.icone}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <b className={cx('text-sm', estado === 'falta' && 'text-[var(--suave)]')}>{e.icone} {t(e.nome)}</b>
                  {aqui && <span className="rounded-full bg-[var(--marca-suave)] px-2 py-0.5 text-[11px] font-bold text-[var(--marca)]">{t('você está aqui')}</span>}
                </p>
                <p className={cx('num text-sm', estado === 'falta' ? 'text-[var(--suave)]' : 'font-semibold')}>{e.resumo}</p>
                {e.detalhe && <p className="num truncate text-xs text-[var(--suave)]">{e.detalhe}</p>}
                {e.itens.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {e.itens.slice(0, MAX).map((x) => (
                      <button key={x.id} type="button" onClick={x.abrir} title={t('Abrir')} className="min-h-8 rounded-lg bg-[var(--marca-suave)] px-2 font-mono text-xs font-bold text-[var(--marca)] hover:brightness-95">{x.codigo ?? '—'} →</button>
                    ))}
                    {e.itens.length > MAX && <span className="self-center text-xs text-[var(--suave)]">+{e.itens.length - MAX}</span>}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
