// CARTÃO DA TABELA (a vista "Cartões" da lista) — o cartão de antes, melhorado: nome + situação + categoria, a versão
// em uso (quando, quem, nota), a FAIXA de preço em barra e a PRÉVIA EM MAPA DE CALOR (medida × comprador: mais escuro
// = fator maior, vazio = sem preço), e embaixo os números (medidas · compradores · vendas · compras). Os dados vêm da
// mesma consulta da lista (nada de uma consulta por cartão).
import { Fragment } from 'react'
import { fatorValido, moeda } from '../../../core/domain/dinheiro'
import type { TabelaPreco } from '../../../core/domain/tipos'
import { chaveCelula } from '../../../core/services/precos'
import { Pilula, cx, diaCurto, loc } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { SITUACAO_TABELA } from '../model/situacao'

type Linha = Awaited<ReturnType<typeof import('../../../core/services/precos').listaTabelasPreco>>[number]

export function CartaoTabela({ x, tb }: { x: Linha; tb?: TabelaPreco }) {
  const t = useT()
  const { ir } = useApp()
  const s = SITUACAO_TABELA[x.situacao]
  const n = (v: number) => v.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const simbolo = moeda(x.moeda).simbolo
  const faixa = x.faixa
  const medidas = tb ? [...tb.linhas].sort((a, b) => a - b).slice(0, 10) : []
  const cols = tb ? tb.colunas.slice(0, 12) : []
  const intensidade = (val?: string) => {
    if (!faixa || !val || !fatorValido(val)) return 0
    const v = Number(String(val).replace(',', '.'))
    return faixa[1] === faixa[0] ? 1 : 0.2 + (0.8 * (v - faixa[0])) / (faixa[1] - faixa[0])
  }
  return (
    <button type="button" onClick={() => ir('tabelaPreco', { id: x.id })}
      className={cx('group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)] hover:shadow-md', x.situacao === 'substituida' && 'opacity-75')}>
      <div className="flex w-full items-start gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-lg font-bold leading-tight">{x.nome}</span>
            <Pilula pequena tom={s.tom} title={t(s.ajuda)}>{x.situacao === 'vigente' ? '● ' : ''}{t(s.nome)}</Pilula>
            <Pilula pequena tom={x.categoria ? 'marca' : 'neutro'}>{x.categoria ? t(x.categoria) : t('Normal (geral)')}</Pilula>
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--suave)]"><b className="text-[var(--marca)]">v{x.versao}</b> · {t('mudou em {d}', { d: diaCurto(x.mudouEm) })}{x.por ? ` · ${x.por}` : ''}{x.nota ? ` · “${x.nota}”` : ''}</p>
        </div>
        <span aria-hidden className="text-2xl leading-none text-[var(--suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--marca)]">›</span>
      </div>
      {/* a faixa de preço em barra: do mais barato ao mais caro */}
      <div className="px-4">
        {faixa ? (
          <div className="num">
            <div className="flex items-baseline justify-between text-sm"><b>{simbolo} {n(faixa[0])}</b><span className="text-xs text-[var(--suave)]">{x.fatorPor === 'grama' ? '/g' : `/${t('un.')}`}</span><b>{simbolo} {n(faixa[1])}</b></div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--marca) 20%, transparent), var(--marca))' }} />
            <div className="mt-0.5 flex justify-between text-[11px] text-[var(--suave)]"><span>{x.medidaMin} {x.unidadeMedida}</span><span>{x.medidaMax} {x.unidadeMedida}</span></div>
          </div>
        ) : <p className="text-sm text-[var(--suave)]">{t('sem preços ainda')}</p>}
      </div>
      {/* PRÉVIA EM MAPA DE CALOR: bate o olho e vê onde tem preço e como sobe com a medida */}
      {medidas.length > 0 && cols.length > 0 && (
        <div aria-hidden className="mx-4 mt-3 overflow-hidden rounded-xl bg-[var(--fundo)] p-2">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `2rem repeat(${cols.length}, minmax(0, 1fr))` }}>
            {medidas.map((l) => (
              <Fragment key={l}>
                <span className="num pr-1 text-right text-[9px] leading-3 text-[var(--suave)]">{l}</span>
                {cols.map((c) => {
                  const a = intensidade(tb!.valores[chaveCelula(l, c.id)])
                  return <span key={c.id} className="h-3 rounded-[3px]" style={{ background: a ? `color-mix(in srgb, var(--marca) ${Math.round(a * 100)}%, transparent)` : 'var(--borda)', opacity: a ? 1 : 0.5 }} />
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-[var(--borda)] px-4 py-2.5 [margin-top:0.75rem]">
        {([['medidas', x.medidas], ['compradores', x.compradores], ['vendas', x.vendas], ['compras', x.compras]] as const).map(([r, v]) => (
          <Pilula key={r} tom={v ? 'marca' : 'suave'}><b>{v}</b> <span className="font-normal">{t(r)}</span></Pilula>
        ))}
      </div>
    </button>
  )
}
