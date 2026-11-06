// CAIXA › SALDO: quanto tem em cada moeda (na mão e no banco), ontem × hoje, as vendas por forma de pagamento e a
// visão convertida numa moeda escolhida (com a cotação digitada, guardada no aparelho).
import { useState } from 'react'
import { formasEmUso } from '../../core/domain/formas'
import { BarraPartes } from '../../ui/barras'
import { MOEDAS, formatar, moeda as moedaDe, type TabelaCotacoes, valorDeUm } from '../../core/domain/dinheiro'
import type { MovCaixa } from '../../core/domain/tipos'
import type { ContaMoeda } from '../../core/services/caixa'
import { Cartao, Info, cx, moedaPadrao } from '../../ui/base'
import { useApp } from '../../ui/contexto'
import { CampoCotacao, conv, cotacaoTexto, useCotacoes } from '../../ui/compartilhados'
import { useT } from '../../ui/i18n'
import { CHAVE_COT, CHAVE_VER, gravarLocal, lerLocal, tabelaDaVisao } from './caixaDia'

/**
 * "Saldo do caixa" numa moeda só (Ver em Bs | US$ | R$), somando todas as moedas pela cotação digitada aqui.
 * Embaixo, cada moeda com a conta dela (veio de ontem + linhas de hoje = hoje; na mão · no banco; contado).
 */
export function SaldoDoCaixa({ contas, movimentos, data, cot, linha, onOntem }: { contas: ContaMoeda[]; movimentos: MovCaixa[]; data: string; cot: TabelaCotacoes; linha(l: { rotulo: string; tipo: string; valor: number }, moeda: string): { rotulo: string; abrir(): void }; onOntem(): void }) {
  const t = useT()
  const { ir } = useApp()
  const { cfg } = useCotacoes()
  const principal = cfg?.moedaPrincipal ?? moedaPadrao()
  const moedasVer = [principal, ...(cfg?.moedasAtivas ?? []).filter((m) => m !== principal)]
  const [verEscolhida, setVerEscolhida] = useState<string>(() => lerLocal(CHAVE_VER, principal))
  const [digitadas, setDigitadas] = useState<Record<string, string>>(() => lerLocal(CHAVE_COT, {}))
  const ver = moedasVer.includes(verEscolhida) ? verEscolhida : principal
  const escolherVer = (m: string) => (setVerEscolhida(m), gravarLocal(CHAVE_VER, m))
  const sistema = (m: string) => {
    const v = valorDeUm(m, principal, cot)
    return v ? cotacaoTexto(v) : ''
  }
  const digitar = (m: string, x: string) => {
    const novo = { ...digitadas, [m]: x }
    setDigitadas(novo)
    gravarLocal(CHAVE_COT, novo)
  }
  const voltarSistema = (m: string) => {
    const novo = { ...digitadas }
    delete novo[m]
    setDigitadas(novo)
    gravarLocal(CHAVE_COT, novo)
  }
  // moedas que entram na conta: as que têm movimento + a da visão
  const envolvidas = [...new Set([...contas.map((c) => c.moeda), ver])].filter((m) => m !== principal)
  const textos: Record<string, string> = {}
  for (const m of envolvidas) textos[m] = digitadas[m] ?? sistema(m)
  const tab = tabelaDaVisao(principal, textos)
  /** soma de todas as moedas na moeda da visão (undefined = falta cotação) */
  const somar = (f: (c: ContaMoeda) => number) => {
    let s = 0
    for (const c of contas) {
      const v = conv(f(c), c.moeda, ver, tab)
      if (v === undefined) return undefined
      s += v
    }
    return s
  }
  const mostrar = (v: number | undefined) => (v === undefined ? '—' : formatar(v, ver))
  const total = somar((c) => c.total)
  const ontem = somar((c) => c.ontemMao + c.ontemBanco)
  const hojeV = somar((c) => c.hoje)
  const mao = somar((c) => c.mao)
  const banco = somar((c) => c.banco)
  // vendas de hoje por forma (formas da configuração que aceitam alguma moeda ativa)
  const ativas = cfg?.moedasAtivas ?? [principal]
  const formas = formasEmUso(cfg?.formas).filter((f) => f.moedas.some((m) => ativas.includes(m)))
  const vendas = movimentos.filter((m) => m.tipo === 'venda')
  const porForma = formas.map((f) => ({ f, valor: vendas.filter((m) => m.forma === f.id).reduce((s, m) => s + (conv(m.delta, m.moeda, ver, tab) ?? 0), 0) }))
  const totalVendas = porForma.reduce((s, x) => s + x.valor, 0)
  const pct = (v: number) => (totalVendas > 0 ? Math.round((v / totalVendas) * 100) : 0)
  const CORES = ['var(--bom)', 'var(--marca)', 'var(--alerta)', 'var(--ruim)', 'var(--suave)', 'var(--texto)']
  const faltaCotacao = total === undefined
  return (
    <Cartao
      className="min-w-0"
      titulo={t('Saldo do caixa')}
      ajuda="O que tem agora: o que veio de ontem + o que mudou hoje. Ex.: 200 + (−150) = 50"
      acao={
        moedasVer.length > 1 && (
          <div className="flex items-center gap-1 text-xs font-semibold text-[var(--suave)]">
            {t('Ver em')}
            <Info texto="Mostra tudo numa moeda só, com a cotação que você digitar. Ex.: Bs 696 ÷ 6,96 = US$ 100." />
            <div role="radiogroup" aria-label={t('Ver em')} className="flex rounded-xl bg-[var(--marca-suave)] p-0.5">
              {moedasVer.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={m === ver} onClick={() => escolherVer(m)} className={cx('min-h-9 min-w-10 rounded-lg px-2 text-sm font-bold', m === ver ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
                  {moedaDe(m).simbolo}
                </button>
              ))}
            </div>
          </div>
        )
      }
    >
      {/* cotações da visão: "1 US$ = [6,96] Bs" (só para ver) */}
      {envolvidas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-[var(--fundo)] p-2">
          {envolvidas.map((m) => (
            <div key={m} className="flex items-center gap-1">
              <div className="w-auto">
                <CampoCotacao moeda={m} principal={principal} texto={textos[m]} onChange={(x) => digitar(m, x)} />
              </div>
              {digitadas[m] !== undefined && digitadas[m] !== sistema(m) && sistema(m) && (
                <button type="button" className="min-h-10 px-1 text-xs text-[var(--marca)] underline" onClick={() => voltarSistema(m)} title={t('Usar a cotação do sistema')}>
                  ↺ {sistema(m)}
                </button>
              )}
            </div>
          ))}
          <p className="w-full text-xs text-[var(--suave)]">{t('Só para ver: os lançamentos continuam na moeda deles.')}</p>
        </div>
      )}

      <div className="rounded-2xl bg-[var(--marca)] p-4 text-white">
        <div className="text-xs opacity-80">{t('Tem agora')}</div>
        <div className="num break-words text-3xl font-black" data-testid="saldo-total">
          {faltaCotacao ? t('Digite a cotação') : mostrar(total)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={onOntem} className="min-h-9 rounded-full bg-white/15 px-3 font-semibold hover:bg-white/25">
            📅 {t('Veio de ontem')} <b className="num">{mostrar(ontem)}</b>
          </button>
          <span className={cx('inline-flex min-h-9 items-center rounded-full px-3 font-semibold', (hojeV ?? 0) < 0 ? 'bg-[var(--ruim)] text-white' : 'bg-white/15')}>
            ☀️ {t('Hoje')}&nbsp;
            <b className="num">
              {(hojeV ?? 0) > 0 ? '+' : ''}
              {mostrar(hojeV)}
            </b>
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--fundo)] p-3">
          <div className="text-sm font-semibold">💵 {t('Na mão')}</div>
          <div className={cx('num whitespace-nowrap text-base font-black xs:text-lg', (mao ?? 0) < 0 && 'text-[var(--ruim)]')}>{mostrar(mao)}</div>
          <div className="text-xs text-[var(--suave)]">{t('dinheiro vivo')}</div>
        </div>
        <div className="min-w-0 rounded-2xl border border-[var(--borda)] bg-[var(--fundo)] p-3">
          <div className="text-sm font-semibold">🏦 {t('No banco')}</div>
          <div className={cx('num whitespace-nowrap text-base font-black xs:text-lg', (banco ?? 0) < 0 && 'text-[var(--ruim)]')}>{mostrar(banco)}</div>
          <div className="text-xs text-[var(--suave)]">{t('Pix/QR e cartão')}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold">{t('Vendas de hoje')}</span>
          <span className="num font-black">{formatar(totalVendas, ver)}</span>
        </div>
        <BarraPartes className="mt-1" altura="h-2" partes={porForma.map((x, i) => ({ chave: x.f.id, valor: x.valor, cor: CORES[i % CORES.length] }))} />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {porForma.map((x, i) => (
            <button key={x.f.id} type="button" onClick={() => ir('vendas', { de: data, ate: data, forma: x.f.id })} className="min-w-0 rounded-xl border border-[var(--borda)] p-2 text-left hover:border-[var(--marca)]">
              <div className="flex items-center gap-1 truncate text-xs text-[var(--suave)]">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                <span className="truncate">{t(x.f.nome)}</span>
              </div>
              <div className="num truncate text-sm font-bold">{formatar(x.valor, ver)}</div>
              <div className="text-xs text-[var(--suave)]">{pct(x.valor)}%</div>
            </button>
          ))}
        </div>
      </div>

      {/* cada moeda com a conta dela */}
      {!contas.length ? (
        <p className="mt-3 text-sm text-[var(--suave)]">{t('Nenhum movimento neste dia.')}</p>
      ) : (
        <details className="mt-4 rounded-xl border border-[var(--borda)]">
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 px-3 py-2 text-sm">
            <span className="font-semibold">{t('Por moeda')}:</span>
            {contas.map((c, i) => {
              const v = c.moeda !== ver ? conv(c.total, c.moeda, ver, tab) : undefined
              return (
                <span key={c.moeda} className="num">
                  {i > 0 && '· '}
                  {formatar(c.total, c.moeda)}
                  {v !== undefined && <span className="text-[var(--suave)]"> (= {formatar(v, ver)})</span>}
                </span>
              )
            })}
          </summary>
          <div className="space-y-3 border-t border-[var(--borda)] p-3">
            {contas.map((c) => (
              <div key={c.moeda}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold">
                    {t(MOEDAS.find((m) => m.codigo === c.moeda)?.nome ?? c.moeda)} ({c.moeda})
                  </span>
                  <span className="text-xs text-[var(--suave)]">
                    💵 <b className="num">{formatar(c.mao, c.moeda)}</b> · 🏦 <b className="num">{formatar(c.banco, c.moeda)}</b>
                  </span>
                </div>
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
                            <button type="button" className="min-h-10 w-full break-words text-left hover:underline" onClick={x.abrir}>
                              {l.vivo ? '💵' : '🏦'} {x.rotulo}
                            </button>
                          </td>
                          <td className={cx('num whitespace-nowrap pl-2 text-right', l.valor < 0 && 'text-[var(--ruim)]')}>
                            {l.valor > 0 ? '+' : ''}
                            {formatar(l.valor, c.moeda)}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-t-2 border-[var(--texto)] font-bold">
                      <td className="py-1">= {t('Hoje')}</td>
                      <td className="num text-right">{formatar(c.hoje, c.moeda)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td className="py-1">{t('Total')}</td>
                      <td className="num text-right">{formatar(c.total, c.moeda)}</td>
                    </tr>
                  </tbody>
                </table>
                {c.contado !== undefined && (
                  <p className={cx('mt-1 rounded-xl p-2 text-sm font-semibold', c.contado === c.mao ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
                    {t('Contado')}: {formatar(c.contado, c.moeda)} · {c.contado === c.mao ? t('bateu ✓') : c.contado < c.mao ? t('faltam {v}', { v: formatar(c.mao - c.contado, c.moeda) }) : t('sobram {v}', { v: formatar(c.contado - c.mao, c.moeda) })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </Cartao>
  )
}
