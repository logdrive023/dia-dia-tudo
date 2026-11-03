// HISTÓRICO DO PACOTE: um só lugar com tudo o que entrou e saiu do pacote, no formato do caixa do dia — agrupado por
// dia (mais novo em cima), com o saldo do começo e do fim do dia; cada movimento com antes → depois, hora, quem fez e a
// referência clicável; "detalhes" abre a ficha (na entrada da triagem, as compras de origem com os gramas de cada uma).

import { type ReactNode, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { MovHistorico } from '../core/services/livro'
import { Carregando, cx, gramasTexto, loc } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

const dataCurta = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit' })
const hora = (em: string) => new Date(em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
/** ícone e cor por tipo (os mesmos do Livro do cabelo): bater o olho e saber o que foi */
const ICONE: Record<string, string> = { entrada: '🛒', venda: '💰', triagemSaida: '✂️', triagemEntrada: '✂️', diferenca: '⚖️', lavagem: '💧', perda: '⚠️', ajuste: '✎', evento: '🏷' }
const COR: Record<string, string> = { entrada: 'var(--bom)', venda: 'var(--ruim)', triagemSaida: 'var(--marca)', triagemEntrada: 'var(--marca)', diferenca: 'var(--alerta)', lavagem: 'var(--alerta)', perda: 'var(--alerta)', ajuste: 'var(--alerta)', evento: 'var(--suave)' }
const sinal = (n: number) => (n > 0 ? `+${gramasTexto(n)}` : n < 0 ? `−${gramasTexto(-n)}` : gramasTexto(0))

export function HistoricoPacote({ id }: { id: Id }) {
  const t = useT()
  const { dados } = useConsulta('historicoPacote', { itemId: id })
  const [tudo, setTudo] = useState(false)
  if (!dados) return <Carregando />
  if (!dados.dias.length) return <p className="text-sm text-[var(--suave)]">{t('Nada registrado ainda.')}</p>
  // hoje sem movimento não vira um bloco vazio: o saldo de agora vai numa linha no alto
  const comMov = dados.dias.filter((d) => d.movs.length > 0)
  const dias = tudo ? comMov : comMov.slice(0, 7)
  const semana = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(loc(), { weekday: 'short' })
  return (
    // cada dia é um bloco próprio: cabeçalho com a data e "começou → terminou" (onde o dia começa e termina) e,
    // dentro, os movimentos do dia — entre um dia e outro, espaço e borda
    <div className="space-y-3">
      <p className="num flex items-center justify-between rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm"><b>{t('Agora')}</b><b>{gramasTexto(dados.item!.saldo)}</b></p>
      {dias.map((d) => {
        const fim = d.aberto ? dados.item!.saldo : d.fim
        const mudou = fim - d.inicio
        return (
          <section key={d.data} aria-label={dataCurta(d.data)} className="overflow-hidden rounded-2xl border border-[var(--borda)]">
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--borda)] bg-[var(--fundo)] px-3 py-2">
              <span className="flex items-center gap-2">
                <b className="num text-base">{dataCurta(d.data)}</b>
                <span className="text-xs capitalize text-[var(--suave)]">{semana(d.data)}</span>
                <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold', d.aberto ? 'bg-[var(--marca-suave)] text-[var(--marca)]' : 'bg-[var(--borda)] text-[var(--suave)]')}>{t(d.aberto ? 'aberto' : 'encerrado')}</span>
              </span>
              <span className="num text-sm">
                <span className="text-[var(--suave)]">{gramasTexto(d.inicio)} → </span><b>{gramasTexto(fim)}</b>
                {mudou !== 0 && <span className={cx('ml-1 text-xs font-semibold', mudou < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>({sinal(mudou)})</span>}
              </span>
            </header>
            {d.movs.length ? (
              <ul className="divide-y divide-[var(--borda)]">{d.movs.map((m) => <Movimento key={m.id} m={m} pacote={{ id, codigo: dados.item?.codigo }} />)}</ul>
            ) : (
              <p className="px-3 py-2 text-sm text-[var(--suave)]">{t('Sem movimento neste dia.')}</p>
            )}
          </section>
        )
      })}
      {!tudo && comMov.length > dias.length && (
        <button type="button" onClick={() => setTudo(true)} className="min-h-10 text-sm font-semibold text-[var(--marca)]">{t('Ver tudo ({n})', { n: comMov.length })}</button>
      )}
    </div>
  )
}

function Movimento({ m, pacote }: { m: MovHistorico; pacote: { id: Id; codigo?: string } }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState(false)
  // referência OBRIGATÓRIA: o que não traz (eventos como "etiqueta impressa") aponta para a etiqueta deste pacote
  const ref = m.ref ?? { tela: 'etiquetas' as const, params: { f: 'todas', sel: pacote.id }, rotulo: ` ${pacote.codigo ?? ''}`.trim() }
  const abrirRef = () => ir(ref.tela, ref.params)
  // linha de detalhe: no celular o rótulo fica em cima do valor (nada espremido); no computador, lado a lado
  const linha = (rotulo: string, valor: ReactNode) => (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs text-[var(--suave)] sm:text-sm">{t(rotulo)}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{valor}</dd>
    </div>
  )
  return (
    <li className="text-sm">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} style={{ borderLeftColor: COR[m.tipo] ?? 'var(--borda)' }} className="flex w-full items-start gap-2 border-l-4 px-3 py-2.5 text-left hover:bg-[var(--fundo)]">
        <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fundo)] text-sm">{ICONE[m.tipo] ?? '•'}</span>
        <span className="min-w-0 flex-1">
          <b className="block [overflow-wrap:anywhere]">{m.titulo}</b>
          <span className="num block text-xs text-[var(--suave)]">{hora(m.em)}{m.delta !== 0 && <> · {gramasTexto(m.antes)} → <b className="text-[var(--texto)]">{gramasTexto(m.depois)}</b></>}</span>
          <span role="link" tabIndex={0} onClick={(e) => (e.stopPropagation(), abrirRef())} onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), abrirRef())} className="mt-0.5 inline-block text-xs font-semibold text-[var(--marca)] hover:underline">↗ {ref.rotulo}</span>
        </span>
        {m.delta !== 0 && <b className={cx('num shrink-0 whitespace-nowrap', m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{sinal(m.delta)}</b>}
        <span aria-hidden className={cx('shrink-0 text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
      </button>
      {aberto && (
        <dl className="mx-3 mb-3 space-y-2 rounded-xl bg-[var(--fundo)] p-3">
          {linha('Tipo', <b>{t(m.nomeTipo)}</b>)}
          {linha('Data e hora', <span className="num">{dataCurta(m.em)} {hora(m.em)}</span>)}
          {linha('Antes → depois', (
            <span className="num grid max-w-xs grid-cols-3 gap-1 text-center">
              <span className="rounded-lg bg-[var(--cartao)] px-1 py-1"><span className="block text-[10px] text-[var(--suave)]">{t('antes')}</span>{gramasTexto(m.antes)}</span>
              <span className={cx('rounded-lg bg-[var(--cartao)] px-1 py-1 font-semibold', m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}><span className="block text-[10px] font-normal text-[var(--suave)]">{t('movimentou')}</span>{sinal(m.delta)}</span>
              <span className="rounded-lg bg-[var(--cartao)] px-1 py-1 font-bold"><span className="block text-[10px] font-normal text-[var(--suave)]">{t('depois')}</span>{gramasTexto(m.depois)}</span>
            </span>
          ))}
          {linha('Quem', m.por ?? '—')}
          {linha('Referência', <button type="button" onClick={abrirRef} className="font-semibold text-[var(--marca)] hover:underline">{ref.rotulo} →</button>)}
          {m.descricao && linha('Descrição', m.descricao)}
          {!!m.fontes?.length && linha('Entrou de', (
            <span className="flex flex-wrap gap-1">
              {m.fontes.map((f) => <button key={f.id} type="button" onClick={() => ir('lote', { id: f.id })} className="rounded-full bg-[var(--cartao)] px-2 font-semibold hover:bg-[var(--marca-suave)]">📦 {f.codigo ?? '?'} · <span className="num">{gramasTexto(f.g)}</span></button>)}
            </span>
          ))}
          {m.origem && linha('Origem', !m.origem.length ? '—' : (
            <ul className="space-y-0.5">
              {m.origem.map((o) => (
                <li key={o.compraId}>
                  <button type="button" onClick={() => ir('pedido', { id: o.compraId })} className="text-left hover:underline">
                    🛒 <b className="num">{gramasTexto(o.gramas)}</b> {t('da compra')} <b className="font-mono">{o.codigo ?? '?'}</b>{o.fornecedor ? ` · ${o.fornecedor}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </dl>
      )}
    </li>
  )
}
