// AVISOS DO MODO CAIXA, embaixo do campo de leitura:
//   · AvisoLeitura: o que acabou de acontecer ("✓ L-0004 · 2,5 kg · Bs 8.041", "já está na venda", bruto/reserva em
//     amarelo) — verde, amarelo ou vermelho, com a foto do pacote
//   · JaSaiu: leu um pacote que JÁ SAIU do estoque. Quem responde "para onde foi" é o servidor (lerCodigoPacote); aqui
//     só se mostra: vendido (venda, cliente, quando) · separado (os pacotes em que virou — um toque adiciona) · zerado

import type { ReactNode } from 'react'
import type { Id } from '../../core/domain/tipos'
import { Botao, cx, dataBR, gramasTexto } from '../../ui/base'
import { useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function AvisoLeitura({ texto, tom, foto, acao }: { texto: string; tom: 'ok' | 'alerta' | 'erro'; foto?: ReactNode; acao?: ReactNode }) {
  return (
    <p role="status" className={cx('mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold', tom === 'alerta' ? 'bg-[var(--alerta)]/12 text-[var(--texto)]' : tom === 'ok' ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--ruim)]/10 text-[var(--ruim)]')}>
      {foto}
      <span className="min-w-0 flex-1">{texto}</span>
      {acao}
    </p>
  )
}

/** abre em OUTRA aba (a venda em andamento não se perde) */
function abrirNovaAba(hash: string) {
  try {
    window.open(`${window.location.pathname}${window.location.search}${hash}`, '_blank', 'noopener')
  } catch {
    /* navegador bloqueou: segue na venda */
  }
}

export function JaSaiu({ texto, onAdicionar, onFechar }: { texto: string; onAdicionar(id: Id): void; onFechar(): void }) {
  const t = useT()
  const { dados: r } = useConsulta('lerCodigoPacote', { texto })
  if (!r) return <AvisoLeitura tom="alerta" texto={t('Procurando {c}…', { c: texto })} />
  if (r.situacao === 'naoExiste') return <AvisoLeitura tom="erro" texto={t('Nenhum pacote com o código {c}.', { c: texto })} acao={<button type="button" aria-label={t('Fechar')} onClick={onFechar} className="h-8 w-8 rounded-full">×</button>} />
  const c = r.item?.codigo ?? texto
  const titulo = r.situacao === 'vendido' ? t('{c} já foi vendido', { c }) : r.situacao === 'separado' ? t('{c} já foi separado', { c }) : r.situacao === 'zerado' ? t('{c} está sem peso', { c }) : t('{c} está disponível', { c })
  return (
    <section role="alert" aria-label={titulo} className="mt-2 rounded-2xl border-2 border-[var(--alerta)] bg-[var(--alerta)]/8 p-3 text-sm">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-xl">⚠️</span>
        <div className="min-w-0 flex-1">
          <b className="block text-base">{titulo}</b>
          <span className="text-[var(--suave)]">{t('Este código já deu baixa: nada entrou na venda. Veja para onde foi o cabelo.')}</span>
        </div>
        <button type="button" aria-label={t('Fechar')} onClick={onFechar} className="h-9 w-9 shrink-0 rounded-full text-lg hover:bg-[var(--cartao)]">×</button>
      </div>
      {r.situacao === 'vendido' && (
        <ul className="mt-2 space-y-1">
          {r.vendas?.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--cartao)] px-3 py-2">
              <span className="num">💰 <b className="font-mono">{v.codigo}</b>{v.cliente ? ` · ${v.cliente}` : ''} · {dataBR(v.data)} · {gramasTexto(v.g)}</span>
              <Botao variante="leve" onClick={() => abrirNovaAba(`#/vendas/${encodeURIComponent(v.id)}`)}>{t('Ver venda ↗')}</Botao>
            </li>
          ))}
        </ul>
      )}
      {r.situacao === 'separado' && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold text-[var(--suave)]">{t('Virou estes pacotes — venda um deles:')}</p>
          <ul className="space-y-1">
            {r.viraram?.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--cartao)] px-3 py-2">
                <span className="num min-w-0"><b className="font-mono">{l.codigo ?? '—'}</b> · {l.nome} · <b>{l.saldo > 0 ? gramasTexto(l.saldo) : t('sem saldo')}</b></span>
                {l.saldo > 0 && <Botao onClick={() => onAdicionar(l.id)}>+ {t('Adicionar')}</Botao>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.situacao === 'zerado' && r.item && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--cartao)] px-3 py-2">
          <span>{t('O peso saiu por ajuste, perda ou compra cancelada.')}</span>
          <Botao variante="leve" onClick={() => abrirNovaAba(`#/lotes/${encodeURIComponent(r.item!.id)}?aba=historico`)}>{t('Ver o histórico ↗')}</Botao>
        </div>
      )}
    </section>
  )
}
