// ESCOLHA DO PREÇO DA TABELA (modo caixa, embaixo de "Nesta venda") — sempre à vista e em duas linhas (cabe no celular):
//   🏷 Preço da tabela · Tabela geral v2                 ▾
//      P.W. (Paraguai)  [Padrão]        ← o preço que está valendo, inteiro e em destaque
// Um toque abre as opções: cada comprador (coluna) da tabela com o TOTAL que daria para os pacotes da venda e a
// diferença para o padrão; a escolhida em destaque. Tocar troca na hora (a tela recalcula tudo: linhas, total,
// desconto, impostos, cobrança) e o que aparece é o que é salvo. NÃO é obrigatório: sem mexer, vale o padrão.
// Linha com valor mudado à mão fica de fora da troca e aparece avisada.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import { cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

export interface OpcaoPreco {
  id: string
  nome: string
  /** o total dos pacotes da venda com esta coluna (undefined = falta preço para algum pacote) */
  total?: number
  /** pacotes sem preço nesta coluna */
  semPreco?: number
}

export function EscolhaPreco({ tabela, versao, opcoes, valor, padrao, porque, moeda, manuais = 0, onEscolher, onAbrirTabela }: {
  tabela: string
  versao?: number
  opcoes: OpcaoPreco[]
  /** a coluna aplicada agora */
  valor: string
  /** a coluna padrão (a da cliente ou a primeira) */
  padrao: string
  /** por que é o padrão ("da cliente" / "primeira coluna") */
  porque: string
  moeda: string
  /** linhas com valor mudado à mão (a troca não mexe nelas) */
  manuais?: number
  /** undefined = voltar ao padrão */
  onEscolher(id?: string): void
  /** abrir a tela da tabela (para ver ou editar) — só quem pode mexer na tabela */
  onAbrirTabela?(): void
}) {
  const t = useT()
  const [aberto, setAberto] = useState(false)
  if (!opcoes.length) return null
  const atual = opcoes.find((o) => o.id === valor) ?? opcoes[0]
  const base = opcoes.find((o) => o.id === padrao)?.total
  const mudou = valor !== padrao
  return (
    <section aria-label={t('Preço da tabela')} className={cx('overflow-hidden rounded-2xl border bg-[var(--cartao)] shadow-sm', mudou ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-14 w-full items-start gap-2 px-4 py-2.5 text-left">
        <span aria-hidden className="mt-0.5">🏷</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-[var(--suave)]">{t('Preço da tabela')} · {tabela}{versao ? ` · v${versao}` : ''}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="min-w-0 break-words text-base">{atual.nome}</b>
            <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', mudou ? 'bg-[var(--marca)] text-white' : 'bg-[var(--bom)]/15 text-[var(--bom)]')}>{mudou ? t('Escolhido') : t('Padrão')}</span>
          </span>
        </span>
        <span aria-hidden className={cx('mt-2 shrink-0 text-[var(--suave)] transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>
      {aberto && (
        <div className="border-t border-[var(--borda)] p-2">
          <p className="px-2 pb-1.5 text-xs text-[var(--suave)]">{t('Escolher é opcional. Tocar troca o valor de todos os pacotes na hora.')}</p>
          <ul role="radiogroup" aria-label={t('Preço da tabela')} className="space-y-1">
            {opcoes.filter((o) => o.total !== undefined).map((o) => {
              const sel = o.id === atual.id
              const dif = o.total !== undefined && base !== undefined ? o.total - base : undefined
              return (
                <li key={o.id}>
                  <button type="button" role="radio" aria-checked={sel} disabled={o.total === undefined} onClick={() => (onEscolher(o.id === padrao ? undefined : o.id), setAberto(false))}
                    className={cx('flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm transition disabled:opacity-50', sel ? 'bg-[var(--marca-suave)] font-semibold text-[var(--marca)] ring-1 ring-[var(--marca)]' : 'hover:bg-[var(--fundo)]')}>
                    <span aria-hidden className={cx('flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2', sel ? 'ring-[var(--marca)]' : 'ring-[var(--borda)]')}>{sel && <span className="h-2 w-2 rounded-full bg-[var(--marca)]" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words">{o.nome}</span>
                      {o.id === padrao && <span className="mt-0.5 inline-block rounded-full bg-[var(--bom)]/15 px-1.5 text-[10px] font-bold text-[var(--bom)]">★ {t('Padrão')} · {t(porque)}</span>}
                      {o.semPreco ? <span className="block text-[11px] font-normal text-[var(--alerta)]">{t('sem preço para {n} pacote(s)', { n: o.semPreco })}</span> : null}
                    </span>
                    <span className="num shrink-0 text-right">
                      <b className="block">{o.total !== undefined ? formatar(o.total, moeda) : '—'}</b>
                      {dif ? <span className={cx('block text-[11px] font-normal', dif > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{dif > 0 ? '+' : '−'}{formatar(Math.abs(dif), moeda)}</span> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {/* as colunas sem preço para estes pacotes: numa linha só (não enchem a lista) */}
          {opcoes.some((o) => o.total === undefined) && (
            <p className="mt-1.5 px-2 text-xs text-[var(--suave)]">{t('Sem preço para estes pacotes')}: {opcoes.filter((o) => o.total === undefined).map((o) => o.nome).join(', ')}</p>
          )}
          {manuais > 0 && <p className="mt-1.5 rounded-lg bg-[var(--alerta)]/12 px-2 py-1 text-xs font-semibold text-[var(--alerta)]">✎ {t('{n} pacote(s) com valor mudado à mão: a troca não mexe neles.', { n: manuais })}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {mudou && <button type="button" onClick={() => (onEscolher(undefined), setAberto(false))} className="min-h-10 flex-1 rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">↺ {t('Voltar ao padrão')}</button>}
            {onAbrirTabela && <button type="button" onClick={onAbrirTabela} className="min-h-10 flex-1 rounded-xl border border-[var(--borda)] text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">▦ {t('Abrir a tabela ↗')}</button>}
          </div>
        </div>
      )}
    </section>
  )
}
