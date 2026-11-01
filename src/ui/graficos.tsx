// Gráficos simples em SVG/HTML (sem biblioteca): barras, linha com comparação, mapa de calor, funil e tabela.
// Desenham as "seções" genéricas que cada módulo devolve para o painel.

import { useState } from 'react'
import type { Formato, Secao } from '../core/modulos'
import { CartaoNumero, Cartao, cx, dataBR, fmt } from './base'
import { useApp } from './contexto'
import { useT } from './i18n'

export function Barras({ itens, formato, moeda }: { itens: { rotulo: string; valor: number; extra?: string; onClick?: () => void }[]; formato: Formato['tipo']; moeda?: string }) {
  const t = useT()
  if (!itens.length) return <p className="text-sm text-[var(--suave)]">{t('Sem dados no período.')}</p>
  const max = Math.max(...itens.map((i) => Math.abs(i.valor)), 1)
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.rotulo} onClick={i.onClick} className={cx(i.onClick && 'cursor-pointer')}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{i.rotulo}</span>
            <span className="num shrink-0 font-semibold">{fmt(i.valor, formato, moeda)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[var(--marca-suave)]">
            <div className="h-2 rounded-full bg-[var(--marca)]" style={{ width: `${(Math.abs(i.valor) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Linha({ serie, anterior, formato, moeda }: { serie: { data: string; faturamento: number; lucro: number }[]; anterior?: number[]; formato: Formato['tipo']; moeda?: string }) {
  const t = useT()
  const [foco, setFoco] = useState<number>()
  const [tabela, setTabela] = useState(false)
  if (!serie.length) return null
  const L = 640
  const A = 180
  const max = Math.max(1, ...serie.map((s) => s.faturamento), ...(anterior ?? []))
  const x = (i: number) => (serie.length === 1 ? L / 2 : (i / (serie.length - 1)) * (L - 20) + 10)
  const y = (v: number) => A - 10 - (Math.max(0, v) / max) * (A - 30)
  const caminho = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-[var(--suave)]">
        <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 rounded bg-[var(--marca)]" /> {t('Faturamento')}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 rounded bg-[var(--bom)]" /> {t('Lucro')}</span>
        {anterior && <span className="flex items-center gap-1"><i className="inline-block h-0 w-4 border-t-2 border-dashed border-[var(--suave)]" /> {t('Período anterior')}</span>}
        <button type="button" className="ml-auto underline" onClick={() => setTabela(!tabela)}>{t(tabela ? 'Ver gráfico' : 'Ver como tabela')}</button>
      </div>
      {tabela ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[var(--suave)]"><th>{t('Dia')}</th><th className="text-right">{t('Faturamento')}</th><th className="text-right">{t('Lucro')}</th></tr></thead>
            <tbody>{serie.map((s) => <tr key={s.data} className="border-t border-[var(--borda)]"><td>{dataBR(s.data)}</td><td className="num text-right">{fmt(s.faturamento, formato, moeda)}</td><td className="num text-right">{fmt(s.lucro, formato, moeda)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${L} ${A}`} className="h-44 w-full" role="img" aria-label={t('Faturamento por dia')} onMouseLeave={() => setFoco(undefined)}>
            {anterior && <path d={caminho(anterior.slice(0, serie.length))} fill="none" stroke="var(--suave)" strokeDasharray="5 5" strokeWidth="1.5" />}
            <path d={caminho(serie.map((s) => s.lucro))} fill="none" stroke="var(--bom)" strokeWidth="2" />
            <path d={caminho(serie.map((s) => s.faturamento))} fill="none" stroke="var(--marca)" strokeWidth="2.5" />
            {serie.map((s, i) => (
              <rect key={s.data} x={x(i) - L / serie.length / 2} y={0} width={L / serie.length} height={A} fill="transparent" onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)} />
            ))}
            {foco !== undefined && <line x1={x(foco)} x2={x(foco)} y1={10} y2={A - 10} stroke="var(--borda)" />}
          </svg>
          {foco !== undefined && (
            <div className="pointer-events-none absolute top-0 rounded-lg border border-[var(--borda)] bg-[var(--cartao)] p-2 text-xs shadow" style={{ left: `${Math.min(70, (x(foco) / L) * 100)}%` }}>
              <b>{dataBR(serie[foco].data)}</b>
              <div>{t('Faturamento')}: {fmt(serie[foco].faturamento, formato, moeda)}</div>
              <div>{t('Lucro')}: {fmt(serie[foco].lucro, formato, moeda)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Mapa({ linhas, colunas, valores, formato }: { linhas: string[]; colunas: string[]; valores: number[][]; formato: Formato['tipo'] }) {
  const t = useT()
  const max = Math.max(1, ...valores.flat())
  if (!linhas.length || !colunas.length) return <p className="text-sm text-[var(--suave)]">{t('Sem dados.')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead><tr><th />{colunas.map((c) => <th key={c} className="px-1 text-[var(--suave)]">{c}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l}>
              <th className="whitespace-nowrap pr-1 text-left text-[var(--suave)]">{l}</th>
              {colunas.map((c, j) => {
                const v = valores[i]?.[j] ?? 0
                return (
                  <td key={c} title={fmt(v, formato)} className="num rounded-md px-1 py-2 text-center" style={{ background: v ? `color-mix(in srgb, var(--marca) ${Math.round(15 + (v / max) * 70)}%, transparent)` : 'var(--fundo)', color: v / max > 0.5 ? '#fff' : undefined }}>
                    {v ? fmt(v, formato) : '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Funil({ etapas }: { etapas: { nome: string; quantidade: number; onClick?: () => void }[] }) {
  const t = useT()
  const max = Math.max(1, ...etapas.map((e) => e.quantidade))
  return (
    <ol className="space-y-2">
      {etapas.map((e, i) => (
        <li key={e.nome} onClick={e.onClick} className={cx('flex items-center gap-2', e.onClick && 'cursor-pointer')}>
          <span className="w-6 text-center text-xs text-[var(--suave)]">{i + 1}</span>
          <div className="flex-1">
            <div className="flex justify-between text-sm"><span>{t(e.nome)}</span><b className="num">{e.quantidade}</b></div>
            <div className="mt-1 h-2 rounded-full bg-[var(--marca-suave)]"><div className="h-2 rounded-full bg-[var(--marca)]" style={{ width: `${(e.quantidade / max) * 100}%` }} /></div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function TabelaSimples({ colunas, linhas, moeda }: { colunas: { id: string; nome: string; formato?: Formato['tipo'] }[]; linhas: { valores: Record<string, string | number>; onClick?: () => void }[]; moeda?: string }) {
  const t = useT()
  if (!linhas.length) return <p className="text-sm text-[var(--suave)]">{t('Sem dados no período.')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--suave)]">
            {colunas.map((c) => <th key={c.id} className={cx('px-2 py-1', c.formato && 'text-right')}>{t(c.nome)}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} onClick={l.onClick} className={cx('border-t border-[var(--borda)]', l.onClick && 'cursor-pointer hover:bg-[var(--marca-suave)]')}>
              {colunas.map((c) => {
                const v = l.valores[c.id]
                return <td key={c.id} className={cx('px-2 py-2', c.formato && 'num text-right')}>{typeof v === 'number' && c.formato ? fmt(v, c.formato, moeda) : v}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Desenha qualquer seção que um módulo devolver (é isso que deixa o painel genérico). */
export function SecaoView({ s, moeda }: { s: Secao; moeda: string }) {
  const { ir } = useApp()
  const t = useT()
  if (s.tipo === 'cartoes')
    return (
      <div>
        <h3 className="mb-2 text-sm font-bold text-[var(--suave)]">{t(s.titulo)}</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {s.cartoes.map((c) => <CartaoNumero key={c.id} c={c} />)}
        </div>
      </div>
    )
  const corpo =
    s.tipo === 'barras' ? (
      <Barras formato={s.formato} moeda={moeda} itens={s.itens.map((i) => ({ ...i, onClick: i.detalhe ? () => ir(i.detalhe!.tela, i.detalhe!.filtro) : undefined }))} />
    ) : s.tipo === 'mapa' ? (
      <Mapa linhas={s.linhas} colunas={s.colunas} valores={s.valores} formato={s.formato} />
    ) : s.tipo === 'funil' ? (
      <Funil etapas={s.etapas.map((e) => ({ ...e, onClick: e.detalhe ? () => ir(e.detalhe!.tela, e.detalhe!.filtro) : undefined }))} />
    ) : (
      <TabelaSimples colunas={s.colunas} moeda={moeda} linhas={s.linhas.map((l) => ({ ...l, onClick: l.detalhe ? () => ir(l.detalhe!.tela, l.detalhe!.filtro) : undefined }))} />
    )
  return (
    <Cartao titulo={t(s.titulo)} ajuda={'ajuda' in s ? s.ajuda : undefined}>
      {corpo}
    </Cartao>
  )
}
