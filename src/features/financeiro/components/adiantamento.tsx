// ADIANTAMENTO A PARCEIRO › as peças da lista e da ficha (o padrão de conta está em ./conta):
//   CartaoAdiantamento    o cartão da lista (saldo em destaque, barra, entregas, viagem, prazo)
//   SeloPrazo             "⏰ até 30/11 · faltam 12 dias" (vermelho se passou e ainda deve)
//   LinhaTempoAdiantamento do dinheiro entregue até a quitação: entregas (compra e lotes), acertos e o saldo depois
import { diasEntre } from '../../../core/domain/datas'
import { formatar } from '../../../core/domain/dinheiro'
import type { ResultadoConsulta } from '../../../core/services'
import type { PassoFinanciamento } from '../../../core/services/financiamentos'
import { cx, dataBR, gramasTexto } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { BarraFinanciamento, StatusFinanciamentoPilula, corFinanciamento } from '../../../shared/ui/financiamento'
import { useT } from '../../../shared/ui/i18n'
import { CartaoConta } from './conta'

type LinhaLista = ResultadoConsulta<'financiamentos'>['linhas'][number]

/** a data limite: "⏰ até 30/11 · faltam 12 dias" (vermelho se passou e ainda deve) */
export function SeloPrazo({ prazo, status, hoje }: { prazo?: string; status: string; hoje: string }) {
  const t = useT()
  if (!prazo || status !== 'aberto') return null
  const dias = diasEntre(hoje, prazo)
  const tom = dias < 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : dias <= 7 ? 'bg-[var(--alerta)]/12 text-[var(--alerta)]' : 'bg-[var(--fundo)] text-[var(--suave)]'
  return <span className={cx('num shrink-0 rounded-xl px-2.5 py-1 text-right text-xs font-semibold', tom)}>⏰ {t('até')} {dataBR(prazo)}<span className="block font-normal">{dias < 0 ? t('vencido há {n} dia(s)', { n: -dias }) : dias === 0 ? t('vence hoje') : t('faltam {n} dia(s)', { n: dias })}</span></span>
}

/** o número que importa num adiantamento: o que falta voltar, ou o que a loja deve ao parceiro */
export function saldoAdiantamento(saldo: number) {
  return saldo > 0 ? { rotulo: 'Saldo devedor', cor: 'var(--marca)' } : saldo < 0 ? { rotulo: 'A loja deve a ele', cor: 'var(--alerta)' } : { rotulo: 'Quitado', cor: 'var(--bom)' }
}

export function CartaoAdiantamento({ f, moeda, hoje, onAbrir }: { f: LinhaLista; moeda: string; hoje: string; onAbrir(id: string): void }) {
  const t = useT()
  const s = saldoAdiantamento(f.saldo)
  return (
    <CartaoConta
      cor={corFinanciamento(f.status)}
      nome={f.pessoa}
      sub={`${f.codigo} · ${t('adiantei')} ${f.financiado !== f.inicial ? formatar(f.financiado, moeda) : formatar(f.valor, f.moeda)} · ${dataBR(f.data)}`}
      situacao={<StatusFinanciamentoPilula status={f.status} />}
      rotuloValor={s.rotulo}
      valor={f.saldo ? formatar(Math.abs(f.saldo), moeda) : '✓'}
      corValor={s.cor}
      lado={<SeloPrazo prazo={f.prazo} status={f.status} hoje={hoje} />}
      barra={<BarraFinanciamento progressoBp={f.progressoBp} status={f.status} />}
      rodape={<>
        <span>💇‍♀️ {t('{n} entrega(s)', { n: f.entregas })} · {formatar(f.entregue, moeda)} · {gramasTexto(f.gramas)}</span>
        {f.viagem && <span>✈ {f.viagem.codigo}</span>}
        {f.abaterComissoes && <span>🧾 {t('Abate das comissões')}</span>}
      </>}
      onAbrir={() => onAbrir(f.id)}
    />
  )
}

const ICONE_PASSO: Record<PassoFinanciamento['tipo'], string> = { emprestimo: '💸', entrega: '💇‍♀️', recebimento: '💵', comissao: '🧾', diferenca: '↩️', baixa: '✂️', reforco: '💸', quitacao: '✅', encerramento: '🔒' }

/** Linha do tempo do adiantamento: um passo por acontecimento, com o efeito na dívida e o saldo depois. */
export function LinhaTempoAdiantamento({ passos, moeda, nomeForma }: { passos: PassoFinanciamento[]; moeda: string; nomeForma(id: string): string }) {
  const t = useT()
  const { ir } = useApp()
  return (
    <ol className="relative ml-3 border-l-2 border-[var(--borda)]">
      {passos.map((p) => (
        <li key={p.id} className="relative mb-4 ml-5 last:mb-0">
          <span aria-hidden className={cx('absolute -left-[2.05rem] flex h-8 w-8 items-center justify-center rounded-full border-2 bg-[var(--cartao)] text-sm', p.tipo === 'quitacao' ? 'border-[var(--bom)]' : p.tipo === 'encerramento' ? 'border-[var(--suave)]' : 'border-[var(--marca)]')}>{ICONE_PASSO[p.tipo]}</span>
          <div className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="break-words">{t(p.titulo)}</b>
                <div className="text-xs text-[var(--suave)]">{dataBR(p.data)}{p.porNome ? ` · ${p.porNome}` : ''}</div>
              </div>
              {p.efeito !== undefined && p.efeito !== 0 && (
                <div className="text-right">
                  <div className={cx('num font-bold', p.efeito > 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{p.efeito > 0 ? '+' : '−'}{formatar(Math.abs(p.efeito), moeda)}</div>
                  {p.saldoDepois !== undefined && <div className="num text-xs text-[var(--suave)]">{t('Saldo')} {formatar(p.saldoDepois, moeda)}</div>}
                </div>
              )}
            </div>
            {p.dinheiro && <div className="mt-1 text-sm">{formatar(p.dinheiro.valor, p.dinheiro.moeda)}{p.dinheiro.forma ? ` · ${t(nomeForma(p.dinheiro.forma))}` : ''}</div>}
            {p.compra && (
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => ir('pedido', { id: p.compra!.id })} className="min-h-9 rounded-full bg-[var(--marca-suave)] px-3 text-xs font-semibold text-[var(--marca)] hover:brightness-95">🛒 {p.compra.codigo ?? t('Compra')}</button>
                  <span className="num">{gramasTexto(p.compra.gramas)} · {formatar(p.compra.valor, moeda)}</span>
                  <span className={cx('text-xs', p.compra.cancelada && 'font-semibold text-[var(--ruim)]')}>{t(p.compra.nomeEtapa)}</span>
                </div>
                <ul className="text-xs text-[var(--suave)]">{p.compra.linhas.map((l, i) => <li key={i}>{l.descricao} · {gramasTexto(l.quantidade)} · {formatar(l.total, l.moeda)}</li>)}</ul>
                {!!p.lotes?.length && (
                  <div className="flex flex-wrap gap-1" aria-label={t('Lotes')}>
                    {p.lotes.slice(0, 8).map((l) => (
                      <button key={l.id} type="button" onClick={() => ir('lote', { id: l.id })} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold hover:brightness-95" style={{ background: 'color-mix(in srgb, var(--alerta) 16%, transparent)', color: 'var(--alerta)' }}>
                        📦 {l.codigo ?? l.nome} <span className="num opacity-80">{gramasTexto(l.saldo)}</span>
                      </button>
                    ))}
                    {p.lotes.length > 8 && <span className="text-xs text-[var(--suave)]">+{p.lotes.length - 8}</span>}
                  </div>
                )}
                {!p.lotes?.length && !p.compra.cancelada && <div className="text-xs text-[var(--suave)]">{t('Ainda não entrou no estoque: continue em Comprar.')}</div>}
              </div>
            )}
            {p.obs && <div className="mt-1 text-sm italic text-[var(--suave)]">{p.obs}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
