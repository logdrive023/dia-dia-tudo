// CAIXA › DETALHES DO DIA (fechado no começo): as vendas por forma de pagamento e a conta de cada moeda, linha por linha.
import { useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { MOEDAS, formatar } from '../../../core/domain/dinheiro'
import type { MovCaixa } from '../../../core/domain/tipos'
import type { ContaMoeda } from '../../../core/services/caixa'
import { BarraPartes } from '../../../shared/ui/barras'
import { BotaoExpandir, cx } from '../../../shared/ui/base'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import type { VisaoCaixa } from '../hooks/useVisaoCaixa'

const CORES = ['var(--bom)', 'var(--marca)', 'var(--alerta)', 'var(--ruim)', 'var(--suave)', 'var(--texto)']

export function DetalhesDia({ visao, contas, movimentos, data, linha }: { visao: VisaoCaixa; contas: ContaMoeda[]; movimentos: MovCaixa[]; data: string; linha(l: { rotulo: string; tipo: string; valor: number }, moeda: string): { rotulo: string; abrir(): void } }) {
  const t = useT()
  const { ir } = useApp()
  const { cfg } = useCotacoes()
  const [aberto, setAberto] = useState(false)
  const { ver, principal, converter } = visao
  if (!contas.length) return null
  const ativas = cfg?.moedasAtivas ?? [principal]
  const vendas = movimentos.filter((m) => m.tipo === 'venda')
  const porForma = formasEmUso(cfg?.formas).filter((f) => f.moedas.some((m) => ativas.includes(m)))
    .map((f) => ({ f, valor: vendas.filter((m) => m.forma === f.id).reduce((s, m) => s + (converter(m.delta, m.moeda) ?? 0), 0) }))
    .filter((x) => x.valor !== 0)
  const totalVendas = porForma.reduce((s, x) => s + x.valor, 0)
  return (
    <div>
      <BotaoExpandir aberto={aberto} onClick={() => setAberto(!aberto)} className="-ml-2">{t('Ver a conta do dia')}</BotaoExpandir>
      {aberto && (
        <div className="mt-2 space-y-4 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4">
          {porForma.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{t('Vendas por forma de pagamento')}</span>
                <span className="num font-black">{formatar(totalVendas, ver)}</span>
              </div>
              <BarraPartes className="mt-1" altura="h-2" partes={porForma.map((x, i) => ({ chave: x.f.id, valor: x.valor, cor: CORES[i % CORES.length] }))} />
              <ul className="mt-1">
                {porForma.map((x, i) => (
                  <li key={x.f.id}>
                    <button type="button" onClick={() => ir('vendas', { de: data, ate: data, forma: x.f.id })} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-1 text-left text-sm hover:bg-[var(--fundo)]">
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                      <span className="min-w-0 flex-1 truncate">{t(x.f.nome)}</span>
                      <b className="num whitespace-nowrap">{formatar(x.valor, ver)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {contas.map((c) => (
            <div key={c.moeda}>
              <p className="font-bold">{t(MOEDAS.find((m) => m.codigo === c.moeda)?.nome ?? c.moeda)} ({c.moeda})</p>
              <table className="mt-1 w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-0.5">📅 {t('Veio de ontem')}</td>
                    <td className="num text-right">{formatar(c.ontemMao + c.ontemBanco, c.moeda)}</td>
                  </tr>
                  {c.linhas.map((l, i) => {
                    const x = linha(l, c.moeda)
                    return (
                      <tr key={i} className="border-t border-[var(--borda)]">
                        <td className="py-0.5">
                          <button type="button" className="min-h-10 w-full break-words text-left hover:underline" onClick={x.abrir}>{l.vivo ? '💵' : '🏦'} {x.rotulo}</button>
                        </td>
                        <td className={cx('num whitespace-nowrap pl-2 text-right', l.valor < 0 && 'text-[var(--ruim)]')}>{l.valor > 0 ? '+' : ''}{formatar(l.valor, c.moeda)}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-[var(--texto)] font-bold">
                    <td className="py-1">{t('Total')}</td>
                    <td className="num text-right">{formatar(c.total, c.moeda)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
