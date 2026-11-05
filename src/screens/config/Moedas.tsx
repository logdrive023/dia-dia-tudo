// CONFIGURAÇÕES › Moedas e câmbio: moedas ativas, a principal e o câmbio de cada uma (CambioMoeda).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { atualizarCambio } from '../../app/cambio'
import { MOEDAS } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import { Botao, Campo, Carregando, Cartao, Entrada, Info, Pilula, Selecao, cx, loc } from '../../ui/base'
import { useApp, useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function Moedas() {
  const t = useT()
  const { backend, avisar } = useApp()
  const { dados } = useConsulta('configuracoes', {})
  const { dados: cambio } = useConsulta('cambio', {})
  const { executar } = useComando()
  const [buscando, setBuscando] = useState(false)
  if (!dados || !cambio) return <Carregando />
  const c = dados.config
  const p = cambio.principal
  const n4 = (v?: number) => (v === undefined ? '—' : v.toLocaleString(loc(), { maximumFractionDigits: v >= 100 ? 2 : 4 }))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Cartao titulo={t('Moeda principal')} ajuda="Os totais e relatórios são mostrados nela. Cada lançamento guarda a cotação do dia: o passado não muda.">
          <Selecao valor={c.moedaPrincipal} onChange={(v) => executar('salvarConfig', { moedaPrincipal: v }, t('Salvo.'))} opcoes={MOEDAS.map((m) => ({ id: m.codigo, nome: `${m.simbolo} ${m.nome} (${m.pais})` }))} />
          <div className="mt-3 flex flex-wrap gap-3">
            {MOEDAS.map((m) => (
              <label key={m.codigo} className="flex items-center gap-1 text-sm"><input type="checkbox" className="h-5 w-5" checked={c.moedasAtivas.includes(m.codigo)} onChange={(e) => executar('salvarConfig', { moedasAtivas: e.target.checked ? [...c.moedasAtivas, m.codigo] : c.moedasAtivas.filter((x) => x !== m.codigo), antes: { moedasAtivas: c.moedasAtivas } })} /> {m.codigo}</label>
            ))}
          </div>
        </Cartao>
        <Cartao titulo={t('Base da internet (guardada no aparelho)')} ajuda="Quando tem internet, o app busca a cotação de mercado e GUARDA aqui. Sem internet, usa a última guardada e mostra a data. Ex.: buscou às 08:00; ficou sem internet às 15:00 → as vendas usam a de 08:00.">
          <div className="space-y-2">
            <Selecao valor={c.cambioAuto} onChange={(v) => executar('salvarConfig', { cambioAuto: v as 'inicioDoDia' })} opcoes={[{ id: 'inicioDoDia', nome: t('Uma vez no começo do dia (todas as vendas do dia usam a mesma)') }, { id: 'momento', nome: t('Na hora de usar (atualiza a cada hora)') }, { id: 'desligado', nome: t('Desligado (só manual)') }]} />
            <Botao variante="secundario" disabled={buscando} onClick={async () => { setBuscando(true); const r = await atualizarCambio(backend, { forcar: true }); setBuscando(false); avisar(t(r.mensagem), r.ok ? 'ok' : 'erro') }}>⟳ {t(buscando ? 'Buscando…' : 'Buscar agora')}</Botao>
            {cambio.status ? (
              <p className={cx('rounded-xl p-2 text-sm', cambio.status.ok ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
                {cambio.status.ok ? '✓' : '⚠️'} {t(cambio.status.mensagem)} · {new Date(cambio.status.em).toLocaleString(loc())}
                {!cambio.status.ok && cambio.status.ultimaOk && <> · {t('última base boa')}: {new Date(cambio.status.ultimaOk).toLocaleString(loc())}</>}
              </p>
            ) : <p className="text-sm text-[var(--suave)]">{t('Ainda não buscou na internet.')}</p>}
          </div>
        </Cartao>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        {cambio.moedas.map((m) => <CambioMoeda key={m.moeda} m={m} principal={p} n4={n4} />)}
      </div>

      <Cartao titulo={t('Histórico de cotações')} ajuda="Toda cotação fica guardada com data e origem (internet ou digitada). Cada venda guarda a que usou: mudar o câmbio não muda o passado.">
        <ul className="max-h-64 overflow-y-auto text-sm">
          {cambio.historico.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] py-1">
              <span className="text-xs text-[var(--suave)]">{new Date(h.em).toLocaleString(loc())}</span>
              <span className="num">{h.texto}</span>
              <Pilula tom={h.fonte === 'auto' ? 'marca' : 'neutro'}>{t(h.fonte === 'auto' ? 'internet' : 'digitada')}</Pilula>
              {h.uso !== 'base' && <Pilula tom="alerta">{t(h.uso === 'venda' ? 'fixa · venda' : 'fixa · compra')}</Pilula>}
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  )
}

type LinhaCambio = { moeda: string; modo: 'dinamico' | 'fixo'; ajusteVendaBp: number; ajusteCompraBp: number; base?: number; venda?: number; compra?: number; baseData?: string; baseFonte: string; fixoVenda?: string; fixoCompra?: string; fixoData?: string }

/** Um cartão por moeda: Dinâmico (internet ± ajuste) ou Fixo (valores digitados), com venda e compra lado a lado. */
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
  const info = MOEDAS.find((x) => x.codigo === m.moeda)
  return (
    <Cartao
      titulo={<>{info?.simbolo} {info?.nome} ({m.moeda})</>}
      acao={
        <div className="flex rounded-xl bg-[var(--marca-suave)] p-1">
          {(['dinamico', 'fixo'] as const).map((x) => (
            <button key={x} type="button" onClick={() => setModo(x)} className={cx('min-h-9 rounded-lg px-3 text-sm font-semibold', modo === x ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
              {t(x === 'dinamico' ? 'Dinâmico' : 'Fixo')}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--suave)]">
        {t('Base')}: <b className="num text-[var(--texto)]">1 {m.moeda} = {n4(m.base)} {principal}</b>
        {m.baseData && <> · {t(m.baseFonte === 'auto' ? 'internet' : 'digitada')} {new Date(m.baseData).toLocaleString(loc())}</>}
        <Info texto={modo === 'dinamico' ? 'Dinâmico: venda e compra seguem a base da internet, com um ajuste em % se quiser. Ex.: base 6,96; venda −1,5% = 6,8556 (recebo dólar valendo um pouco menos); compra +1% = 7,0296.' : 'Fixo: você decide o valor e ele não muda com a internet. Ex.: para vender 1 USD = 6,90; para comprar 1 USD = 7,00.'} />
      </p>
      {modo === 'dinamico' ? (
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Venda: ajuste %" ajuda="Usado quando a cliente paga nesta moeda (venda, recebimento). Negativo = a moeda vale menos para você. Ex.: −1,5.">
            <Entrada inputMode="decimal" value={ajV} onChange={(e) => setAjV(e.target.value)} />
            <span className="num mt-1 block text-sm">= 1 {m.moeda} = <b>{n4(previa(ajV))}</b> {principal}</span>
          </Campo>
          <Campo rotulo="Compra: ajuste %" ajuda="Usado quando você paga nesta moeda (compra, pagamento a fornecedor). Ex.: +1.">
            <Entrada inputMode="decimal" value={ajC} onChange={(e) => setAjC(e.target.value)} />
            <span className="num mt-1 block text-sm">= 1 {m.moeda} = <b>{n4(previa(ajC))}</b> {principal}</span>
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="num text-xs text-[var(--suave)]">{t('Em uso agora')}: {t('venda')} {n4(m.venda)} · {t('compra')} {n4(m.compra)}</span>
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
          {t('Salvar')}
        </Botao>
      </div>
    </Cartao>
  )
}
