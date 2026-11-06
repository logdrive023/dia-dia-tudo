// CAIXA do dia, simples como o caderno: escolher o dia na fita de dias → "Saldo do caixa" (veio de ontem + hoje = o que
// tem agora; na mão × no banco; vendas de hoje por forma) → "Lançar dinheiro" em botões grandes (Dei dinheiro,
// Entrada, Despesa, Retirada, Pagamento) → "Movimentado no dia" (desfazer sem apagar, abrir a origem) → Encerrar o dia.
// O caixa continua POR MOEDA (cada lançamento fica na moeda dele); a tela soma tudo numa moeda só para ver
// ("Ver em Bs | US$ | R$"), com a cotação digitada aqui (só para ver: não muda nenhum lançamento).

import { useEffect, useState } from 'react'
import { TurnosFechados } from '../components/Turno'
import { formatar } from '../../../core/domain/dinheiro'
import { dataCurta, dataLocal, somarDias } from '../../../core/domain/datas'
import type { Id, MovCaixa, TipoCaixa } from '../../../core/domain/tipos'
import { NOMES_TIPO_CAIXA } from '../../../core/services/caixa'
import { Botao, Carregando, Cartao, Confirmar, Pilula, Vazio, cx, dataBR, loc, Titulo } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'
import { MenuAcoes, type Acao } from '../../../shared/ui/menuAcoes'
import { BOTOES, NOME_STATUS, type TipoLancar } from '../model/caixaDia'
import { FitaDias } from '../components/FitaDias'
import { SaldoDoCaixa } from '../components/SaldoDoCaixa'
import { Lancar } from '../components/Lancar'
import { Encerrar } from '../components/Encerrar'

/** tipos que se desfazem aqui (lançamento manual); vendas e compras se cancelam na própria venda/compra */
const DESFAZ = ['entrada', 'despesa', 'retirada', 'dar', 'saldoInicial']

const ICONE: Record<TipoCaixa, string> = {
  venda: '🛍️',
  compra: '📦',
  entrada: '➕',
  despesa: '🧾',
  retirada: '🏦',
  dar: '🤝',
  emprestimo: '💸',
  recebimento: '📥',
  estorno: '↩️',
  saldoInicial: '🏁',
  correcao: '✏️',
}

// ---------- preferências do aparelho (moeda da visão e cotações digitadas) ----------

/** De onde veio cada lançamento (venda, compra ou empréstimo); acerto de conta não tem tela própria. */
function useOrigens(movs: MovCaixa[]) {
  const { backend } = useApp()
  const [mapa, setMapa] = useState<Record<string, { tela: string; id: Id }>>({})
  const chave = [...new Set(movs.filter((m) => m.origemId).map((m) => m.origemId!))].sort().join(',')
  useEffect(() => {
    let vivo = true
    const ids = chave ? chave.split(',') : []
    Promise.all(
      ids.map(async (id): Promise<[string, { tela: string; id: Id }] | undefined> => {
        try {
          const r = await backend.consulta('venda', { id })
          return [id, { tela: r.venda.tipo === 'compra' ? 'pedido' : 'venda', id }]
        } catch {
          /* não é venda nem compra */
        }
        try {
          await backend.consulta('emprestimo', { id })
          return [id, { tela: 'emprestimo', id }]
        } catch {
          return undefined
        }
      }),
    ).then((r) => vivo && setMapa(Object.fromEntries(r.filter((x): x is [string, { tela: string; id: Id }] => !!x))))
    return () => {
      vivo = false
    }
  }, [backend, chave])
  return mapa
}

export function Caixa() {
  const t = useT()
  const { ir } = useApp()
  const hoje = dataLocal()
  const [data, setData] = useParamTela('data', hoje)
  const { dados } = useConsulta('caixaDoDia', { data })
  const { dados: dias } = useConsulta('diasDoCaixa', {})
  const { cfg, cot } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [lancar, setLancar] = useState<TipoLancar>()
  const [encerrar, setEncerrar] = useState(false)
  const [desfazer, setDesfazer] = useState<MovCaixa>()
  const [reabrir, setReabrir] = useState(false)
  const origens = useOrigens(dados?.movimentos ?? [])
  const nomeForma = new Map((cfg?.formas ?? []).map((f) => [f.id, f.nome]))
  if (!dados) return <Carregando />
  const aberto = dados.status !== 'encerrado'
  // o dia anterior com movimento ficou sem encerrar?
  const anterior = (dias ?? []).find((d) => d.data < data)
  const anteriorAberto = aberto && anterior?.status === 'aberto' ? anterior.data : undefined
  const verMovimentos = () => document.getElementById('cx-movimentos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  /** linha da conta → rótulo traduzido e para onde leva */
  const linha = (l: { rotulo: string; tipo: string; valor: number }, moeda: string): { rotulo: string; abrir(): void } => {
    if (l.tipo === 'grupo') {
      for (const tipo of ['venda', 'recebimento'] as const)
        for (const forma of new Set(dados.movimentos.filter((m) => m.tipo === tipo && m.moeda === moeda).map((m) => m.forma)))
          if (l.rotulo === `${NOMES_TIPO_CAIXA[tipo]}s · ${nomeForma.get(forma) ?? forma}`)
            return { rotulo: `${t(`${NOMES_TIPO_CAIXA[tipo]}s`)} · ${t(nomeForma.get(forma) ?? forma)}`, abrir: tipo === 'venda' ? () => ir('vendas', { de: data, ate: data, forma, moeda }) : verMovimentos }
      return { rotulo: l.rotulo, abrir: verMovimentos }
    }
    const m = dados.movimentos.find((x) => x.tipo === l.tipo && x.moeda === moeda && x.delta === l.valor && x.descricao === l.rotulo)
    const o = m?.origemId ? origens[m.origemId] : undefined
    return { rotulo: l.rotulo, abrir: o ? () => ir(o.tela, { id: o.id }) : verMovimentos }
  }
  const irEncerrarAnterior = () => {
    if (!anteriorAberto) return
    setData(anteriorAberto)
    setEncerrar(true)
  }
  return (
    <div className="min-w-0">
      <Titulo acao={<span className="text-sm text-[var(--suave)]">{t('Situação')}: <Pilula tom={aberto ? 'bom' : 'neutro'}>{t(NOME_STATUS[dados.status] ?? dados.status)}</Pilula></span>}>
        {t('Caixa')} · {dataBR(data)}
      </Titulo>

      <FitaDias data={data} hoje={hoje} dias={dias ?? []} onEscolher={setData} />

      {/* aviso curto quando há o que fazer com o dia */}
      {!aberto ? (
        <Aviso texto={t('Dia encerrado')} rotulo={t('Reabrir')} disabled={ocupado} onClick={() => setReabrir(true)} />
      ) : (
        anteriorAberto && <Aviso texto={t('O dia {d} não foi encerrado', { d: dataCurta(anteriorAberto) })} rotulo={t('Encerrar')} onClick={irEncerrarAnterior} />
      )}

      {dados.alteracoesDepois.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--alerta)] bg-[var(--alerta)]/10 p-3 text-sm">
          <p className="font-semibold">{t('Alterado depois de encerrado')}</p>
          <p className="text-[var(--suave)]">{t('O dinheiro contado deste dia não mudou: a diferença entrou no caixa do dia da correção.')}</p>
          <ul className="mt-2 space-y-1">
            {dados.alteracoesDepois.map((a, i) => (
              <li key={i}>
                <button type="button" className="min-h-10 text-left font-semibold text-[var(--marca)] underline-offset-2 hover:underline" onClick={() => ir('venda', { id: a.origemId })}>
                  {a.codigo ?? t('Venda')}
                </button>{' '}
                · {a.descricao} · {dataBR(a.em)} · {a.porNome}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <SaldoDoCaixa contas={dados.contas} movimentos={dados.movimentos} data={data} cot={cot} linha={linha} onOntem={() => setData(somarDias(data, -1))} />

        <div className="min-w-0 space-y-4">
          {aberto && (
            <Cartao titulo={t('Lançar dinheiro')} ajuda="Para o que não é venda. Ex.: paguei a luz Bs 150 → Despesa">
              <p className="-mt-2 mb-3 text-sm text-[var(--suave)]">{t('Dinheiro que entrou ou saiu sem ser venda')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BOTOES.map((b) => (
                  <button
                    key={b.tipo}
                    type="button"
                    onClick={() => setLancar(b.tipo)}
                    className="flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl last:col-span-2 sm:last:col-span-1 border border-[var(--borda)] bg-[var(--fundo)] p-2 text-center transition hover:border-[var(--marca)] active:scale-[0.98]"
                  >
                    <span className="text-2xl" aria-hidden>
                      {b.icone}
                    </span>
                    <span className="text-sm font-bold">{t(b.nome)}</span>
                    <span className="text-xs text-[var(--suave)]">{t(b.dica)}</span>
                  </button>
                ))}
              </div>
            </Cartao>
          )}

          <div id="cx-movimentos" className="scroll-mt-4">
            <Cartao titulo={t('Movimentado no dia')}>
              {!dados.movimentos.length ? (
                <Vazio texto="Nenhum dinheiro entrou ou saiu neste dia.">
                  {aberto && <Botao variante="secundario" onClick={() => setLancar('despesa')}>+ {t('Lançar dinheiro')}</Botao>}
                </Vazio>
              ) : (
                <ul className="divide-y divide-[var(--borda)] text-sm">
                  {dados.movimentos.map((m) => {
                    const o = m.origemId ? origens[m.origemId] : undefined
                    const acoes: Acao[] = []
                    if (DESFAZ.includes(m.tipo) && !m.estornadoPor && aberto) acoes.push({ rotulo: 'Desfazer', icone: '↩️', perigo: true, onClick: () => setDesfazer(m) })
                    if (o) acoes.push({ rotulo: 'Abrir origem', icone: '↗', onClick: () => ir(o.tela, { id: o.id }) })
                    const texto = (
                      <>
                        <div className={cx('break-words font-semibold', m.estornadoPor && 'line-through opacity-60')}>{m.descricao}</div>
                        <div className="text-xs text-[var(--suave)]">
                          {t(nomeForma.get(m.forma) ?? m.forma)} · {new Date(m.criadoEm).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })}
                          {m.categoria ? ` · ${m.categoria}` : ''}
                          {m.estornadoPor ? ` · ${t('desfeito')}` : ''}
                        </div>
                      </>
                    )
                    return (
                      <li key={m.id} className="flex items-center gap-2 py-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--fundo)] text-base" aria-hidden>
                          {ICONE[m.tipo] ?? '•'}
                        </span>
                        {o ? (
                          <button type="button" className="min-h-10 min-w-0 flex-1 text-left hover:underline" onClick={() => ir(o.tela, { id: o.id })}>
                            {texto}
                          </button>
                        ) : (
                          <div className="min-w-0 flex-1">{texto}</div>
                        )}
                        <span className={cx('num shrink-0 whitespace-nowrap font-bold', m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>
                          {m.delta > 0 ? '+' : ''}
                          {formatar(m.delta, m.moeda)}
                        </span>
                        {acoes.length ? <MenuAcoes acoes={acoes} /> : <span className="w-10 shrink-0" />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Cartao>
          </div>

          {aberto ? (
            <Botao grande variante="secundario" className="w-full" onClick={() => setEncerrar(true)}>
              🔒 {t('Encerrar o dia')}
            </Botao>
          ) : (
            <Botao grande variante="secundario" className="w-full" disabled={ocupado} onClick={() => setReabrir(true)}>
              🔓 {t('Reabrir o dia')}
            </Botao>
          )}
        </div>
      </div>

      {lancar && <Lancar tipoInicial={lancar} data={data} hoje={hoje} onFechar={() => setLancar(undefined)} />}
      {desfazer && (
        <Confirmar
          titulo="Desfazer lançamento?"
          texto={`${desfazer.descricao}: ${formatar(desfazer.delta, desfazer.moeda)}. ${t('Entra um lançamento inverso; o original fica no histórico.')}`}
          rotulo="Desfazer"
          perigo
          onFechar={() => setDesfazer(undefined)}
          onConfirmar={(motivo) => executar('estornarLancamento', { lancamentoId: desfazer.id, motivo: motivo || undefined }, t('Desfeito (fica no histórico).'))}
        />
      )}
      {reabrir && <Confirmar titulo="Reabrir o dia?" texto="O dia volta a aceitar lançamentos. O dinheiro contado no encerramento fica guardado." rotulo="Reabrir o dia" onFechar={() => setReabrir(false)} onConfirmar={() => executar('reabrirDia', { data }, t('Dia reaberto.'))} />}
      {/* só abre com a conta do dia certo (no "Encerrar" do aviso, a tela troca de dia antes) */}
      {encerrar && dados.data === data && <Encerrar data={data} contas={dados.contas} movimentos={dados.movimentos} onFechar={() => setEncerrar(false)} />}
      {/* os turnos de cada pessoa (conferência cega): quem contou, o esperado e a diferença */}
      <TurnosFechados />
    </div>
  )
}

/** Aviso amarelo curto com uma ação. */
function Aviso({ texto, rotulo, onClick, disabled }: { texto: string; rotulo: string; onClick(): void; disabled?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--alerta)] bg-[var(--alerta)]/10 px-3 py-2 text-sm">
      <span className="font-semibold">⚠️ {texto}</span>
      <Botao variante="leve" className="min-h-10 text-[var(--alerta)]" disabled={disabled} onClick={onClick}>
        {rotulo}
      </Botao>
    </div>
  )
}
