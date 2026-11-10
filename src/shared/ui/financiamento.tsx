// Peças dos ADIANTAMENTOS A PARCEIROS: situação colorida, barra "quanto já voltou" e o quadro da ficha da pessoa.

import type { ReactNode } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import type { Id } from '../../core/domain/tipos'
import type { StatusFinanciamento } from '../../core/services/financiamentos'
import { Cartao, Pilula, cx, gramasTexto } from './base'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

export const TOM_FINANCIAMENTO: Record<StatusFinanciamento, 'marca' | 'alerta' | 'bom' | 'neutro'> = { aberto: 'marca', aPagar: 'alerta', quitado: 'bom', encerrado: 'neutro' }
export const NOME_STATUS: Record<StatusFinanciamento, string> = { aberto: 'Em aberto', aPagar: 'A pagar ao parceiro', quitado: 'Quitado', encerrado: 'Encerrado' }

export function StatusFinanciamentoPilula({ status }: { status: StatusFinanciamento }) {
  const t = useT()
  return <Pilula tom={TOM_FINANCIAMENTO[status]}>{t(NOME_STATUS[status])}</Pilula>
}

/**
 * BARRA DE CONTA (padrão de adiantamento e empréstimo): quanto da dívida já voltou. A legenda diz a % e, se vier,
 * o "de quanto" (ex.: "60% · Bs 3.000 de Bs 5.000"). Acima de 100% a barra fica cheia (quem decide a cor é a tela).
 */
export function BarraConta({ pct, cor, legenda, rotulo = 'Quanto já voltou', className }: { pct: number; cor: string; legenda?: ReactNode; rotulo?: string; className?: string }) {
  const t = useT()
  const largura = Math.min(100, Math.max(pct, pct > 0 ? 3 : 0))
  return (
    <div className={className}>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--marca-suave)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)} aria-label={t(rotulo)}>
        <div className="h-full rounded-full transition-[width]" style={{ width: `${largura}%`, background: cor }} />
      </div>
      {legenda !== undefined && <div className="num mt-1 text-xs text-[var(--suave)]">{legenda}</div>}
    </div>
  )
}

/** a cor da barra de um adiantamento pela situação */
export const corFinanciamento = (status: StatusFinanciamento) => (status === 'aPagar' ? 'var(--alerta)' : status === 'quitado' ? 'var(--bom)' : status === 'encerrado' ? 'var(--suave)' : 'var(--marca)')

/** Barra: quanto do adiantamento já voltou (cabelo + dinheiro + comissão). Passou de 100% = a loja deve a diferença. */
export function BarraFinanciamento({ progressoBp, status, className }: { progressoBp: number; status: StatusFinanciamento; className?: string }) {
  const t = useT()
  const pct = Math.round(progressoBp / 100)
  return <BarraConta className={className} pct={pct} cor={corFinanciamento(status)} legenda={t('{p}% coberto', { p: pct })} />
}

/** Ficha da pessoa: adiantamentos dela (o que está na mão dela e o que já voltou em cabelo). */
export function AdiantamentosDaPessoa({ pessoaId }: { pessoaId: Id }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('financiamentos', { pessoaId })
  if (!dados?.linhas.length) return null
  return (
    <Cartao titulo={t('Adiantamentos (dinheiro para comprar cabelo)')} ajuda="Dinheiro dado para a pessoa comprar cabelo para a loja. A dívida é paga com o cabelo que ela entrega.">
      <ul className="divide-y divide-[var(--borda)] text-sm">
        {dados.linhas.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => ir('financiamento', { id: f.id })} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-2 text-left hover:bg-[var(--marca-suave)]">
              <span className="min-w-0">
                <b className="num">{f.codigo}</b> · {formatar(f.valor, f.moeda)} · {t('entregou')} {gramasTexto(f.gramas)} ({formatar(f.entregue, dados.moeda)})
              </span>
              <span className="flex items-center gap-2">
                <span className={cx('num font-semibold', f.saldo > 0 ? 'text-[var(--bom)]' : f.saldo < 0 ? 'text-[var(--ruim)]' : '')}>
                  {f.saldo > 0 ? `${t('falta')} ${formatar(f.saldo, dados.moeda)}` : f.saldo < 0 ? `${t('devo')} ${formatar(-f.saldo, dados.moeda)}` : ''}
                </span>
                <StatusFinanciamentoPilula status={f.status} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}
