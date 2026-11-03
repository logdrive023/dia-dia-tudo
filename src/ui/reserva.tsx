// RESERVA de pacote (encomenda): o selo 🔒 que aparece no estoque, no pacote e na venda, e a janela para reservar/tirar.

import { useState } from 'react'
import type { Id, Item } from '../core/domain/tipos'
import { Botao, Campo, Entrada, Info, Janela, cx, dataBR } from './base'
import { useComando } from './contexto'
import { useT } from './i18n'

export const AJUDA_RESERVA =
  'Reserva: a cliente pediu e o pacote fica guardado para ela. Aparece 🔒 no estoque e, se alguém for vender para outra pessoa, o sistema avisa. Ex.: Ana pediu 60 cm Preto para sexta → reserva o L-0004 para Ana até sexta. Vendeu para ela ou desistiu? Tire a reserva.'

type ComReserva = Pick<Item, 'reserva' | 'saldo'>

/** reservado (e ainda com peso)? */
export const reservado = (i: ComReserva) => !!i.reserva && i.saldo > 0

/** 🔒 Reservado para Ana · até 07/11 (vermelho se a data já passou) */
export function SeloReserva({ i, className }: { i: ComReserva; className?: string }) {
  const t = useT()
  if (!reservado(i)) return null
  const r = i.reserva!
  const venceu = !!r.ate && r.ate < new Date().toISOString().slice(0, 10)
  return (
    <span title={r.obs} className={cx('inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold', venceu ? 'bg-[var(--ruim)]/15 text-[var(--ruim)]' : 'bg-[var(--alerta)]/15 text-[var(--alerta)]', className)}>
      🔒 {t('Reservado para {p}', { p: r.para })}{r.ate ? ` · ${venceu ? t('venceu') : t('até')} ${dataBR(r.ate)}` : ''}
    </span>
  )
}

export function ReservarLote({ id, codigo, atual, onFechar }: { id: Id; codigo?: string; atual?: Item['reserva']; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [para, setPara] = useState(atual?.para ?? '')
  const [ate, setAte] = useState(atual?.ate ?? '')
  const [obs, setObs] = useState(atual?.obs ?? '')
  return (
    <Janela aberta titulo={<span className="flex items-center">🔒 {t('Reservar')} {codigo ?? ''}<Info texto={AJUDA_RESERVA} /></span>} onFechar={onFechar} rodape={
      <div className="flex flex-wrap justify-end gap-2">
        {atual && <Botao variante="leve" disabled={ocupado} onClick={async () => (await executar('reservarLote', { id, tirar: true }, t('Reserva tirada.'))) && onFechar()}>{t('Tirar reserva')}</Botao>}
        <Botao disabled={ocupado || !para.trim()} onClick={async () => (await executar('reservarLote', { id, para, ate: ate || undefined, obs }, t('Pacote reservado.'))) && onFechar()}>🔒 {t('Reservar')}</Botao>
      </div>
    }>
      <div className="space-y-3">
        <Campo rotulo="Para quem?"><Entrada autoFocus value={para} placeholder={t('Ex.: Ana Paula')} onChange={(e) => setPara(e.target.value)} /></Campo>
        <Campo rotulo="Até quando? (opcional)"><Entrada type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>
        <Campo rotulo="Observação (opcional)"><Entrada value={obs} placeholder={t('Ex.: pagou sinal de Bs 500')} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
