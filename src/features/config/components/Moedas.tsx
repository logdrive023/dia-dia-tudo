// CONFIGURAÇÕES › Moedas e câmbio — 3 blocos, um assunto por vez:
//   1. Moedas         a principal (totais e relatórios) e as que o negócio aceita (toque para ligar/desligar)
//   2. Câmbio de hoje uma linha curta por moeda ("1 US$ = 6,96 Bs · venda 6,86 · compra 7,03"); tocar abre para mudar
//                     (Dinâmico = internet ± ajuste · Fixo = valor digitado). Embaixo, a busca na internet.
//   3. Histórico      recolhido: toda cotação com data e origem (cada venda guarda a que usou)
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { atualizarCambio } from '../../../adapters/cambio'
import { MOEDAS } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import { Bandeira } from '../../../shared/ui/bandeira'
import { Botao, BotaoExpandir, Campo, Carregando, Cartao, Entrada, Info, Pilula, Selecao, cx, loc } from '../../../shared/ui/base'
import { useApp, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

/** a bandeira da moeda: BOB → BO, USD → US, BRL → BR, PYG → PY */
const paisDaMoeda = (codigo: string) => codigo.slice(0, 2)

export function Moedas() {
  const t = useT()
  const { backend, avisar } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const { dados: cambio } = useConsulta('cambio', {})
  const { executar, ocupado } = useComando()
  const [buscando, setBuscando] = useState(false)
  const [aberta, setAberta] = useState<string>()
  const [historico, setHistorico] = useState(false)
  if (!dados || !cambio) return <Carregando />
  const c = dados.config
  const p = cambio.principal
  const simboloP = MOEDAS.find((m) => m.codigo === p)?.simbolo ?? p
  const n4 = (v?: number) => (v === undefined ? '—' : v.toLocaleString(loc(), { maximumFractionDigits: v >= 100 ? 2 : 4 }))
  const ligarMoeda = (codigo: string, ligar: boolean) =>
    executar('salvarConfig', { moedasAtivas: ligar ? [...c.moedasAtivas, codigo] : c.moedasAtivas.filter((x) => x !== codigo), antes: { moedasAtivas: c.moedasAtivas } }, t(ligar ? 'Moeda ligada.' : 'Moeda desligada.'))
  return (
    <div className="max-w-3xl space-y-4">
      <Cartao titulo={t('Moedas')} ajuda="Os totais e relatórios são mostrados na moeda principal. As outras ligadas aparecem para receber e pagar. Cada lançamento guarda a cotação do dia: o passado não muda.">
        <Campo rotulo="Moeda principal"><Selecao valor={c.moedaPrincipal} onChange={(v) => executar('salvarConfig', { moedaPrincipal: v }, t('Salvo.'))} opcoes={MOEDAS.map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.nome} (${m.pais})` }))} /></Campo>
        <p className="mb-1 mt-3 text-sm font-semibold text-[var(--suave)]">{t('Aceita receber e pagar em')}</p>
        <div className="flex flex-wrap gap-2">
          {MOEDAS.map((m) => {
            const ligada = c.moedasAtivas.includes(m.codigo)
            const principal = m.codigo === c.moedaPrincipal
            return (
              <button key={m.codigo} type="button" aria-pressed={ligada} disabled={principal || ocupado} onClick={() => ligarMoeda(m.codigo, !ligada)}
                title={principal ? t('A principal fica sempre ligada') : undefined}
                className={cx('inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition',
                  ligada ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] text-[var(--suave)] hover:border-[var(--marca)]',
                  principal && 'cursor-default')}>
                <Bandeira pais={paisDaMoeda(m.codigo)} />
                {m.simbolo} {m.codigo}
                <span aria-hidden>{ligada ? '✓' : '+'}</span>
              </button>
            )
          })}
        </div>
      </Cartao>

      <Cartao titulo={t('Câmbio de hoje')} ajuda="Venda = quando a cliente paga nesta moeda. Compra = quando você paga nesta moeda. Toque na moeda para mudar como o valor é definido.">
        {!cambio.moedas.length ? <p className="text-sm text-[var(--suave)]">{t('Só a moeda principal está ligada: não precisa de câmbio.')}</p> : (
          <ul className="divide-y divide-[var(--borda)]">
            {cambio.moedas.map((m) => {
              const info = MOEDAS.find((x) => x.codigo === m.moeda)
              const abre = aberta === m.moeda
              return (
                <li key={m.moeda} className="py-1">
                  <button type="button" aria-expanded={abre} onClick={() => setAberta(abre ? undefined : m.moeda)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 text-left hover:bg-[var(--fundo)]">
                    <Bandeira pais={paisDaMoeda(m.moeda)} />
                    <span className="min-w-0 flex-1">
                      <b className="num block">1 {info?.simbolo ?? m.moeda} = {n4(m.base)} {simboloP}</b>
                      <span className="num block text-xs text-[var(--suave)]">{t('venda')} {n4(m.venda)} · {t('compra')} {n4(m.compra)}</span>
                    </span>
                    <Pilula pequena tom={m.modo === 'fixo' ? 'alerta' : 'marca'}>{t(m.modo === 'fixo' ? 'Fixo' : 'Dinâmico')}</Pilula>
                    <span aria-hidden className={cx('text-xs text-[var(--suave)] transition-transform', abre && 'rotate-90')}>▸</span>
                  </button>
                  {abre && <CambioMoeda m={m} principal={p} n4={n4} />}
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-3 space-y-2 border-t border-[var(--borda)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center text-sm font-semibold text-[var(--suave)]">🌐 {t('Busca na internet')}<Info texto="Quando tem internet, o app busca a cotação de mercado e GUARDA no aparelho. Sem internet, usa a última guardada e mostra a data. Ex.: buscou às 08:00; ficou sem internet às 15:00 → as vendas usam a de 08:00." /></span>
            <Botao variante="secundario" className="ml-auto" disabled={buscando} onClick={async () => { setBuscando(true); const r = await atualizarCambio(backend, { forcar: true }); setBuscando(false); avisar(t(r.mensagem), r.ok ? 'ok' : 'erro') }}>⟳ {t(buscando ? 'Buscando…' : 'Buscar agora')}</Botao>
          </div>
          <Selecao valor={c.cambioAuto} onChange={(v) => executar('salvarConfig', { cambioAuto: v as 'inicioDoDia' })} opcoes={[{ id: 'inicioDoDia', nome: t('Uma vez no começo do dia (todas as vendas do dia usam a mesma)') }, { id: 'momento', nome: t('Na hora de usar (atualiza a cada hora)') }, { id: 'desligado', nome: t('Desligado (só manual)') }]} />
          {cambio.status ? (
            <p className={cx('rounded-xl p-2 text-xs', cambio.status.ok ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
              {cambio.status.ok ? '✓' : '⚠️'} {t(cambio.status.mensagem)} · {new Date(cambio.status.em).toLocaleString(loc())}
              {!cambio.status.ok && cambio.status.ultimaOk && <> · {t('última base boa')}: {new Date(cambio.status.ultimaOk).toLocaleString(loc())}</>}
            </p>
          ) : <p className="text-xs text-[var(--suave)]">{t('Ainda não buscou na internet.')}</p>}
        </div>
      </Cartao>

      <div>
        <BotaoExpandir aberto={historico} onClick={() => setHistorico(!historico)}>{t('Histórico de cotações')} ({cambio.historico.length})</BotaoExpandir>
        {historico && (
          <Cartao className="mt-2" ajuda="Toda cotação fica guardada com data e origem (internet ou digitada). Cada venda guarda a que usou: mudar o câmbio não muda o passado.">
            <ul className="max-h-64 overflow-y-auto text-sm">
              {cambio.historico.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] py-1 first:border-t-0">
                  <span className="text-xs text-[var(--suave)]">{new Date(h.em).toLocaleString(loc())}</span>
                  <span className="num">{h.texto}</span>
                  <Pilula tom={h.fonte === 'auto' ? 'marca' : 'neutro'}>{t(h.fonte === 'auto' ? 'internet' : 'digitada')}</Pilula>
                  {h.uso !== 'base' && <Pilula tom="alerta">{t(h.uso === 'venda' ? 'fixa · venda' : 'fixa · compra')}</Pilula>}
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </div>
    </div>
  )
}

type LinhaCambio = { moeda: string; modo: 'dinamico' | 'fixo'; ajusteVendaBp: number; ajusteCompraBp: number; base?: number; venda?: number; compra?: number; baseData?: string; baseFonte: string; fixoVenda?: string; fixoCompra?: string; fixoData?: string }

/** O que abre na linha da moeda: Dinâmico (internet ± ajuste) ou Fixo (valores digitados), venda e compra lado a lado. */
function CambioMoeda({ m, principal, n4 }: { m: LinhaCambio; principal: string; n4(v?: number): string }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [modo, setModo] = useState(m.modo)
  const [ajV, setAjV] = useState(String(m.ajusteVendaBp / 100))
  const [ajC, setAjC] = useState(String(m.ajusteCompraBp / 100))
  const [fixV, setFixV] = useState(m.fixoVenda ?? '')
  const [fixC, setFixC] = useState(m.fixoCompra ?? '')
  const bp = (x: string) => Math.round(Number(x.replace(',', '.') || 0) * 100)
  const previa = (aj: string) => (m.base !== undefined ? m.base * (1 + bp(aj) / 10000) : undefined)
  return (
    <div className="mb-2 mt-1 space-y-3 rounded-2xl bg-[var(--fundo)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-[var(--marca-suave)] p-1" role="group" aria-label={t('Como o câmbio é definido')}>
          {(['dinamico', 'fixo'] as const).map((x) => (
            <button key={x} type="button" aria-pressed={modo === x} onClick={() => setModo(x)} className={cx('min-h-9 rounded-lg px-3 text-sm font-semibold', modo === x ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
              {t(x === 'dinamico' ? 'Dinâmico' : 'Fixo')}
            </button>
          ))}
        </div>
        <span className="flex items-center text-xs text-[var(--suave)]">
          {t(modo === 'dinamico' ? 'segue a internet' : 'você decide o valor')}
          <Info texto={modo === 'dinamico' ? 'Dinâmico: venda e compra seguem a base da internet, com um ajuste em % se quiser. Ex.: base 6,96; venda −1,5% = 6,8556 (recebo dólar valendo um pouco menos); compra +1% = 7,0296.' : 'Fixo: você decide o valor e ele não muda com a internet. Ex.: para vender 1 USD = 6,90; para comprar 1 USD = 7,00.'} />
        </span>
      </div>
      {m.baseData && <p className="text-xs text-[var(--suave)]">{t('Base')} {t(m.baseFonte === 'auto' ? 'internet' : 'digitada')} · {new Date(m.baseData).toLocaleString(loc())}</p>}
      {modo === 'dinamico' ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Venda: ajuste %" ajuda="Usado quando a cliente paga nesta moeda (venda, recebimento). Negativo = a moeda vale menos para você. Ex.: −1,5.">
            <Entrada inputMode="decimal" value={ajV} onChange={(e) => setAjV(e.target.value)} />
            <span className="num mt-1 block text-sm">= <b>{n4(previa(ajV))}</b> {principal}</span>
          </Campo>
          <Campo rotulo="Compra: ajuste %" ajuda="Usado quando você paga nesta moeda (compra, pagamento a fornecedor). Ex.: +1.">
            <Entrada inputMode="decimal" value={ajC} onChange={(e) => setAjC(e.target.value)} />
            <span className="num mt-1 block text-sm">= <b>{n4(previa(ajC))}</b> {principal}</span>
          </Campo>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={`${t('Para vender')}: 1 ${m.moeda} =`} ajuda="Quando a cliente paga nesta moeda. Ex.: 6,90.">
            <div className="flex items-center gap-1"><Entrada inputMode="decimal" value={fixV} placeholder={n4(m.base)} onChange={(e) => setFixV(e.target.value)} /><span className="shrink-0 whitespace-nowrap text-sm">{principal}</span></div>
          </Campo>
          <Campo rotulo={`${t('Para comprar')}: 1 ${m.moeda} =`} ajuda="Quando você paga nesta moeda. Ex.: 7,00.">
            <div className="flex items-center gap-1"><Entrada inputMode="decimal" value={fixC} placeholder={n4(m.base)} onChange={(e) => setFixC(e.target.value)} /><span className="shrink-0 whitespace-nowrap text-sm">{principal}</span></div>
          </Campo>
          {m.fixoData && <p className="col-span-2 text-xs text-[var(--suave)]">{t('Valores fixos desde')} {new Date(m.fixoData).toLocaleString(loc())}</p>}
        </div>
      )}
      <div className="flex justify-end">
        <Botao
          disabled={ocupado}
          onClick={() =>
            executar(
              'salvarCambio',
              modo === 'dinamico'
                ? { moeda: m.moeda, modo, ajusteVendaBp: bp(ajV), ajusteCompraBp: bp(ajC) }
                : { moeda: m.moeda, modo, fixoVenda: fixV !== m.fixoVenda ? fixV : undefined, fixoCompra: fixC !== m.fixoCompra ? fixC : undefined, idVenda: novoId(), idCompra: novoId() },
              t('Câmbio salvo.'),
            )
          }
        >
          {t('Salvar câmbio')}
        </Botao>
      </div>
    </div>
  )
}
