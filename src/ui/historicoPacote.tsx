// HISTÓRICO DO PACOTE: um só lugar com tudo o que entrou e saiu do pacote, no formato do caixa do dia — agrupado por
// dia (mais novo em cima), com o saldo do começo e do fim do dia; cada movimento com antes → depois, hora, quem fez e a
// referência clicável; "detalhes" abre a ficha (na entrada da triagem, as compras de origem com os gramas de cada uma).

import { useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { MovHistorico } from '../core/services/livro'
import { Carregando, cx, gramasTexto, loc } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

const dataCurta = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit' })
const hora = (em: string) => new Date(em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
const sinal = (n: number) => (n > 0 ? `+${gramasTexto(n)}` : n < 0 ? `−${gramasTexto(-n)}` : gramasTexto(0))

export function HistoricoPacote({ id }: { id: Id }) {
  const t = useT()
  const { dados } = useConsulta('historicoPacote', { itemId: id })
  const [tudo, setTudo] = useState(false)
  if (!dados) return <Carregando />
  if (!dados.dias.length) return <p className="text-sm text-[var(--suave)]">{t('Nada registrado ainda.')}</p>
  const dias = tudo ? dados.dias : dados.dias.slice(0, 7)
  return (
    <div className="space-y-4">
      {dias.map((d) => (
        <section key={d.data}>
          <h4 className="mb-1 flex items-center gap-2 text-sm font-bold">
            <span className="num">{dataCurta(d.data)}</span>
            <span className="text-xs font-semibold text-[var(--suave)]">{t(d.aberto ? 'aberto' : 'encerrado')}</span>
          </h4>
          <ul className="divide-y divide-[var(--borda)] rounded-2xl border border-[var(--borda)]">
            <li className="flex justify-between gap-2 p-3 text-sm font-semibold">
              <span>● {t(d.aberto ? 'Agora' : 'Terminou o dia com')}</span>
              <span className="num">{gramasTexto(d.aberto ? dados.item!.saldo : d.fim)}</span>
            </li>
            {d.movs.map((m) => <Movimento key={m.id} m={m} />)}
            <li className="flex justify-between gap-2 p-3 text-sm text-[var(--suave)]">
              <span>○ {t('Começou o dia com')}</span>
              <span className="num">{gramasTexto(d.inicio)}</span>
            </li>
          </ul>
        </section>
      ))}
      {!tudo && dados.dias.length > dias.length && (
        <button type="button" onClick={() => setTudo(true)} className="min-h-10 text-sm font-semibold text-[var(--marca)]">{t('Ver tudo ({n})', { n: dados.dias.length })}</button>
      )}
    </div>
  )
}

function Movimento({ m }: { m: MovHistorico }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState(false)
  const abrirRef = () => m.ref && ir(m.ref.tela, m.ref.params)
  return (
    <li className="p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
          ○ <b>{m.titulo}</b>
          {m.delta !== 0 && <span className={cx('num ml-1 font-semibold', m.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{sinal(m.delta)}</span>}
        </span>
        <span className="num whitespace-nowrap text-[var(--suave)]">{hora(m.em)}</span>
        {m.delta !== 0 && <span className="num whitespace-nowrap">{gramasTexto(m.antes)} → <b>{gramasTexto(m.depois)}</b></span>}
        <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="min-h-10 whitespace-nowrap rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
          {aberto ? `${t('fechar')} ▴` : `${t('detalhes')} ▾`}
        </button>
      </div>
      {aberto && (
        <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-xl bg-[var(--fundo)] p-3">
          <dt className="text-[var(--suave)]">{t('Tipo')}</dt><dd className="font-semibold">{t(m.nomeTipo)}</dd>
          <dt className="text-[var(--suave)]">{t('Data e hora')}</dt><dd className="num">{dataCurta(m.em)} {hora(m.em)}</dd>
          <dt className="text-[var(--suave)]">{t('Antes · Movimentou · Depois')}</dt>
          <dd className="num">{gramasTexto(m.antes)} · {sinal(m.delta)} · <b>{gramasTexto(m.depois)}</b></dd>
          <dt className="text-[var(--suave)]">{t('Quem')}</dt><dd>{m.por ?? '—'}</dd>
          <dt className="text-[var(--suave)]">{t('Referência')}</dt>
          <dd>{m.ref ? <button type="button" onClick={abrirRef} className="font-semibold text-[var(--marca)] hover:underline">{m.ref.rotulo} →</button> : '—'}</dd>
          {m.descricao && <><dt className="text-[var(--suave)]">{t('Descrição')}</dt><dd className="[overflow-wrap:anywhere]">{m.descricao}</dd></>}
          {!!m.fontes?.length && (
            <>
              <dt className="text-[var(--suave)]">{t('Entrou de')}</dt>
              <dd className="flex flex-wrap gap-1">
                {m.fontes.map((f) => <button key={f.id} type="button" onClick={() => ir('lote', { id: f.id })} className="rounded-full bg-[var(--cartao)] px-2 font-semibold hover:bg-[var(--marca-suave)]">📦 {f.codigo ?? '?'} · <span className="num">{gramasTexto(f.g)}</span></button>)}
              </dd>
            </>
          )}
          {m.origem && (
            <>
              <dt className="text-[var(--suave)]">{t('Origem')}</dt>
              <dd>
                {!m.origem.length ? '—' : (
                  <ul className="space-y-0.5">
                    {m.origem.map((o) => (
                      <li key={o.compraId}>
                        <button type="button" onClick={() => ir('pedido', { id: o.compraId })} className="text-left hover:underline">
                          🛒 <b className="num">{gramasTexto(o.gramas)}</b> {t('da compra')} <b className="font-mono">{o.codigo ?? '?'}</b>{o.fornecedor ? ` · ${o.fornecedor}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </>
          )}
        </dl>
      )}
    </li>
  )
}
