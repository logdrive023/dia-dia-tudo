// CAIXA do dia, simples como o caderno: escolher o dia na fita de dias → "Saldo do caixa" (veio de ontem + hoje = o que
// tem agora; na mão × no banco; vendas de hoje por forma) → "Lançar dinheiro" em botões grandes (Dei dinheiro,
// Entrada, Despesa, Retirada, Pagamento) → "Movimentado no dia" (desfazer sem apagar, abrir a origem) → Encerrar o dia.
// O caixa continua POR MOEDA (cada lançamento fica na moeda dele); a tela soma tudo numa moeda só para ver
// ("Ver em Bs | US$ | R$"), com a cotação digitada aqui (só para ver: não muda nenhum lançamento).

import { useEffect, useRef, useState } from 'react'
import { formasEmUso } from '../core/domain/formas'
import { BarraPartes } from '../ui/barras'
import { MOEDAS, formatar, moeda as moedaDe, type TabelaCotacoes, valorDeUm } from '../core/domain/dinheiro'
import { dataCurta, dataLocal, somarDias } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, MovCaixa, TipoCaixa } from '../core/domain/tipos'
import type { ContaMoeda } from '../core/services/caixa'
import { NOMES_TIPO_CAIXA } from '../core/services/caixa'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, Info, Janela, Pilula, Selecao, ValorInput, Vazio, cx, dataBR, loc, moedaPadrao, Titulo } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { CampoCotacao, SeletorPessoa, conv, cotacaoDigitada, cotacaoTexto, lerCotacaoTexto, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { useT } from '../ui/i18n'
import { MenuAcoes, type Acao } from '../ui/menuAcoes'

const NOME_STATUS: Record<string, string> = { aberto: 'Aberto', encerrado: 'Encerrado', 'sem movimento': 'Sem movimento' }

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

/** Os botões de "Lançar dinheiro". Pagamento = paguei a uma pessoa (fornecedor, quem eu devo): acerto de conta. */
type TipoLancar = 'dar' | 'entrada' | 'despesa' | 'retirada' | 'pagamento'
const BOTOES: { tipo: TipoLancar; icone: string; nome: string; dica: string }[] = [
  { tipo: 'dar', icone: '🤝', nome: 'Dei dinheiro', dica: 'vale, ajuda, troco' },
  { tipo: 'entrada', icone: '➕', nome: 'Entrada', dica: 'entrou sem venda' },
  { tipo: 'despesa', icone: '🧾', nome: 'Despesa', dica: 'luz, aluguel, comida' },
  { tipo: 'retirada', icone: '🏦', nome: 'Retirada', dica: 'tirei do caixa' },
  { tipo: 'pagamento', icone: '💼', nome: 'Pagamento', dica: 'paguei a uma pessoa' },
]

const CATEGORIAS_DESPESA = ['Aluguel', 'Luz e água', 'Comida', 'Transporte', 'Material', 'Outras despesas']

// ---------- preferências do aparelho (moeda da visão e cotações digitadas) ----------

const CHAVE_VER = 'caixa.verEm'
const CHAVE_COT = 'caixa.cotacoes'
function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch {
    return padrao
  }
}
function gravarLocal(chave: string, v: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(v))
  } catch {
    /* sem armazenamento (aba anônima): só não lembra */
  }
}

/**
 * Tabela só para ver: a principal vale 1 e cada outra moeda vale o que foi digitado ("1 US$ = 6,96 Bs").
 * A conversão continua exata (a mesma do sistema).
 */
function tabelaDaVisao(principal: string, textos: Record<string, string>): TabelaCotacoes {
  const tab: TabelaCotacoes = { [principal]: { moeda: principal, valor: '1', sentido: 'basePorMoeda', data: '' } }
  for (const [m, x] of Object.entries(textos)) {
    const v = lerCotacaoTexto(x)
    if (m !== principal && v) tab[m] = cotacaoDigitada(m, v, principal)
  }
  return tab
}

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

/** Fita de dias (QUA 28 · QUI 29 · … · HOJE 3): ponto nos dias com movimento; 📅 escolhe qualquer data. */
function FitaDias({ data, hoje, dias, onEscolher }: { data: string; hoje: string; dias: { data: string; status: string }[]; onEscolher(d: string): void }) {
  const t = useT()
  const fita = useRef<HTMLDivElement>(null)
  const status = new Map(dias.map((d) => [d.data, d.status]))
  // 14 dias até hoje; se o dia escolhido é mais antigo, a fita vai até ele (+3)
  const fim = data > hoje ? data : data >= somarDias(hoje, -13) ? hoje : somarDias(data, 3)
  const lista = Array.from({ length: 14 }, (_, i) => somarDias(fim, i - 13))
  useEffect(() => {
    const el = fita.current
    const sel = el?.querySelector<HTMLElement>('[aria-current="date"]')
    if (el && sel) el.scrollLeft = sel.offsetLeft - el.clientWidth + sel.offsetWidth + 8
  }, [data, fim])
  const semana = (d: string) => {
    const [a, m, dd] = d.split('-').map(Number)
    return new Date(a, m - 1, dd, 12).toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '').toUpperCase()
  }
  return (
    <div className="mb-4 flex min-w-0 items-stretch gap-2">
      <div ref={fita} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label={t('Dias')}>
        {lista.map((d) => {
          const escolhido = d === data
          const st = status.get(d)
          return (
            <button
              key={d}
              type="button"
              aria-current={escolhido ? 'date' : undefined}
              aria-label={`${dataBR(d)}${st ? ` · ${t(NOME_STATUS[st] ?? st)}` : ''}`}
              onClick={() => onEscolher(d)}
              className={cx(
                'flex min-h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-xs font-semibold',
                escolhido ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] bg-[var(--cartao)]',
                d === hoje && !escolhido && 'border-[var(--marca)] text-[var(--marca)]',
              )}
            >
              <span className="text-[10px] opacity-80">{d === hoje ? t('HOJE') : semana(d)}</span>
              <span className="num text-base font-black leading-tight">{Number(d.slice(8))}</span>
              <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', st ? (st === 'encerrado' ? 'bg-[var(--suave)]' : escolhido ? 'bg-white' : 'bg-[var(--marca)]') : 'bg-transparent')} />
            </button>
          )
        })}
      </div>
      <label className="relative grid min-h-14 w-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-[var(--borda)] bg-[var(--cartao)] text-xl" title={t('Escolher dia')}>
        <span aria-hidden>📅</span>
        <Entrada type="date" aria-label={t('Dia')} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={data} onChange={(e) => e.target.value && onEscolher(e.target.value)} />
      </label>
    </div>
  )
}

/**
 * "Saldo do caixa" numa moeda só (Ver em Bs | US$ | R$), somando todas as moedas pela cotação digitada aqui.
 * Embaixo, cada moeda com a conta dela (veio de ontem + linhas de hoje = hoje; na mão · no banco; contado).
 */
function SaldoDoCaixa({ contas, movimentos, data, cot, linha, onOntem }: { contas: ContaMoeda[]; movimentos: MovCaixa[]; data: string; cot: TabelaCotacoes; linha(l: { rotulo: string; tipo: string; valor: number }, moeda: string): { rotulo: string; abrir(): void }; onOntem(): void }) {
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

/** Folha simples de lançar: valor grande, forma em botões, descrição (categorias na despesa), pessoa no pagamento. */
function Lancar({ tipoInicial, data, hoje, onFechar }: { tipoInicial: TipoLancar; data: string; hoje: string; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const { backend } = useApp()
  const { dados: locais } = useConsulta('locais', {})
  const [id] = useState(() => novoId())
  const [tipo, setTipo] = useState<TipoLancar>(tipoInicial)
  const [moedaEscolhida, setMoeda] = useState<string>()
  const principal = cfg?.moedaPrincipal ?? moedaPadrao()
  const moeda = moedaEscolhida ?? principal
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState<number>()
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [localId, setLocalId] = useState('')
  const [socioId, setSocioId] = useState('')
  const [pessoaId, setPessoaId] = useState<Id>()
  const sujo = valor !== undefined || !!descricao.trim() || !!categoria.trim()
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const info = BOTOES.find((b) => b.tipo === tipo)!
  const formas = formasEmUso(cfg?.formas, moeda)
  const moedas = [principal, ...(cfg?.moedasAtivas ?? []).filter((m) => m !== principal)]
  const repetir = async () => {
    if (tipo === 'pagamento') return
    const u = (await backend.consulta('ultimoLancamento', { tipo })) as MovCaixa | undefined
    if (!u) return
    setMoeda(u.moeda)
    setForma(u.forma)
    setValor(Math.abs(u.delta))
    setDescricao(u.descricao)
    setCategoria(u.categoria ?? '')
    setLocalId(u.localId ?? '')
    setSocioId(u.socioId ?? '')
  }
  const podeLancar = !!valor && (tipo !== 'pagamento' || !!pessoaId)
  const salvar = async () => {
    if (!podeLancar) return
    const ok =
      tipo === 'pagamento'
        ? await executar('registrarAcerto', { id, pessoaId: pessoaId!, direcao: 'paguei', valor: valor!, moeda, forma, descricao: descricao || undefined }, t('Lançado.'))
        : await executar(
            'lancarCaixa',
            { id, tipo, moeda, forma, valor: valor!, descricao: descricao.trim() || (tipo === 'despesa' ? categoria : ''), categoria: tipo === 'despesa' ? categoria || undefined : undefined, localId: tipo === 'despesa' ? localId || undefined : undefined, socioId: tipo === 'retirada' ? socioId || undefined : undefined },
            t('Lançado.'),
          )
    if (ok) onFechar()
  }
  const chip = (ativo: boolean) => cx('min-h-10 rounded-full border px-3 text-sm font-semibold', ativo ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] bg-[var(--cartao)]')
  return (
    <Janela
      aberta
      titulo={`${info.icone} ${t(info.nome)}`}
      onFechar={fechar}
      rodape={
        <Botao grande className="w-full" disabled={ocupado || !podeLancar} onClick={salvar}>
          {t('Lançar')}
        </Botao>
      }
    >
      <div className="space-y-4">
        {/* trocar o tipo sem fechar */}
        <div className="flex gap-1 overflow-x-auto pb-1" role="radiogroup" aria-label={t('Tipo')}>
          {BOTOES.map((b) => (
            <button key={b.tipo} type="button" role="radio" aria-checked={b.tipo === tipo} onClick={() => setTipo(b.tipo)} className={cx(chip(b.tipo === tipo), 'shrink-0 whitespace-nowrap')}>
              {b.icone} {t(b.nome)}
            </button>
          ))}
        </div>
        {data !== hoje && <p className="rounded-xl bg-[var(--alerta)]/10 p-2 text-sm text-[var(--alerta)]">{t('Entra no caixa de hoje ({d}).', { d: dataCurta(hoje) })}</p>}

        <div className="[&_input]:min-h-14 [&_input]:text-2xl [&_input]:font-black">
          <Campo rotulo="Quanto?">
            <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
          </Campo>
        </div>
        {moedas.length > 1 && (
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('Moeda')}>
            {moedas.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === moeda} onClick={() => (setMoeda(m), setForma('dinheiro'))} className={chip(m === moeda)}>
                {moedaDe(m).simbolo}
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 text-sm font-semibold text-[var(--suave)]">{t('Forma')}</div>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('Forma')}>
            {formas.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={f.id === forma} onClick={() => setForma(f.id)} className={chip(f.id === forma)}>
                {f.vivo ? '💵' : '🏦'} {t(f.nome)}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'pagamento' && (
          <div>
            <SeletorPessoa rotulo="Para quem?" valor={pessoaId} onChange={setPessoaId} />
            <p className="mt-1 text-xs text-[var(--suave)]">{t('Sai do caixa e abate o que você deve a ela (conta da pessoa).')}</p>
          </div>
        )}

        {tipo === 'despesa' && (
          <div>
            <div className="mb-1 text-sm font-semibold text-[var(--suave)]">{t('Com o quê?')}</div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIAS_DESPESA.map((c) => (
                <button key={c} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? '' : c)} className={chip(categoria === c)}>
                  {t(c)}
                </button>
              ))}
            </div>
          </div>
        )}

        <Campo rotulo={tipo === 'dar' ? 'Para quem / para quê? (opcional)' : 'Descrição (opcional)'}>
          <Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={t(tipo === 'dar' ? 'Ex.: vale para a Chico' : tipo === 'despesa' ? 'Ex.: conta de luz de outubro' : 'Ex.: Luz, transporte, Chico…')} />
        </Campo>

        {tipo === 'despesa' && !!locais?.length && (
          <Campo rotulo="Unidade" ajuda="Despesa de um salão entra no custo dele (Equipe e unidades).">
            <Selecao valor={localId} onChange={setLocalId} vazio="Geral" opcoes={locais.map((l) => ({ id: l.id, nome: l.nome }))} />
          </Campo>
        )}
        {tipo === 'retirada' && !!cfg?.socios.length && (
          <Campo rotulo="Retirada de qual sócia?" ajuda="Abate da parte dela na divisão do lucro (Relatórios › Resultado).">
            <Selecao valor={socioId} onChange={setSocioId} vazio="Não é de sócia" opcoes={cfg.socios.map((s) => ({ id: s.id, nome: s.nome }))} />
          </Campo>
        )}

        {tipo !== 'pagamento' && (
          <Botao variante="leve" onClick={repetir}>
            ⟳ {t('Repetir o último')}
          </Botao>
        )}
      </div>
    </Janela>
  )
}

function Encerrar({ data, contas, movimentos, onFechar }: { data: string; contas: { moeda: string; mao: number; total: number; banco: number; hoje: number }[]; movimentos: MovCaixa[]; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [contado, setContado] = useState<Record<string, number | undefined>>({})
  const sujo = Object.values(contado).some((v) => v !== undefined)
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const vendas = movimentos.filter((m) => m.tipo === 'venda')
  const texto = [
    `*${cfg?.nomeNegocio ?? ''} · ${dataBR(data)}*`,
    `${t('Vendas')}: ${vendas.length}`,
    ...contas.map((c) => `${c.moeda}: ${t('hoje')} ${formatar(c.hoje, c.moeda)} · ${t('total')} ${formatar(c.total, c.moeda)} (💵 ${formatar(c.mao, c.moeda)} · 🏦 ${formatar(c.banco, c.moeda)})${contado[c.moeda] !== undefined ? ` · ${t('contado')} ${formatar(contado[c.moeda]!, c.moeda)}` : ''}`),
  ].join('\n')
  return (
    <Janela
      aberta
      titulo={`${t('Encerrar o dia')} · ${dataCurta(data)}`}
      onFechar={fechar}
      rodape={
        <div className="flex flex-wrap gap-2">
          <a className="min-h-12 flex-1 rounded-xl bg-[#25d366] px-4 py-3 text-center font-semibold text-white" href={linkWhatsApp(texto)} target="_blank" rel="noreferrer">
            {t('Relatório no WhatsApp')}
          </a>
          <Botao grande className="flex-1" disabled={ocupado} onClick={async () => (await executar('encerrarDia', { data, contado: Object.fromEntries(Object.entries(contado).filter(([, v]) => v !== undefined)) as Record<string, number> }, t('Dia encerrado.'))) && onFechar()}>
            {t('Encerrar')}
          </Botao>
        </div>
      }
    >
      <div className="space-y-3">
        {contas.map((c) => (
          <Campo key={c.moeda} rotulo={`${t('Dinheiro vivo contado')} (${c.moeda})`} ajuda="Conte o dinheiro da gaveta e digite: o app diz se faltou ou sobrou.">
            <ValorInput moeda={c.moeda} valor={contado[c.moeda]} onChange={(v) => setContado({ ...contado, [c.moeda]: v })} />
            {contado[c.moeda] !== undefined && (
              <p className={cx('mt-1 text-sm font-semibold', contado[c.moeda] === c.mao ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
                {contado[c.moeda] === c.mao ? t('bateu ✓') : contado[c.moeda]! < c.mao ? t('faltam {v}', { v: formatar(c.mao - contado[c.moeda]!, c.moeda) }) : t('sobram {v}', { v: formatar(contado[c.moeda]! - c.mao, c.moeda) })}
              </p>
            )}
          </Campo>
        ))}
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--fundo)] p-3 font-sans text-sm">{texto}</pre>
      </div>
    </Janela>
  )
}
