// COMPRA REGISTRADA — o aviso logo depois de registrar (uma vez, com ×). Diz que deu certo e o próximo passo:
//   ┌──────────────────────────────────────────────────────────┐
//   │ (✓)  Compra P-0009 registrada                          × │
//   │      123 g · Bs 123,00 · teste2                          │
//   │ ┊ ✂️ O cabelo está esperando a triagem  [✂ Separar agora] │
//   └──────────────────────────────────────────────────────────┘
// Em viagem: separar fica para a volta ("Separe quando voltar" + Ver na Triagem). Sem bruto: já está no estoque.
// A triagem continua à vista no Resumo depois que o aviso some.
import { formatar } from '../../../core/domain/dinheiro'
import { cx, gramasTexto } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { type DadosPedido, codigoDe, emViagemAgora, irSeparar } from '../model/pecas'

export function AvisoCompra({ dados, onFechar }: { dados: DadosPedido; onFechar(): void }) {
  const t = useT()
  const { ir, sessao } = useApp()
  const c = dados.compra
  const esperando = dados.triagem.esperando
  const emViagem = emViagemAgora(dados, sessao.pessoaId)
  const passo = esperando.ids.length
    ? { texto: emViagem ? 'Separe quando voltar: o cabelo fica esperando na Triagem.' : 'O cabelo está esperando a triagem.', principal: !emViagem }
    : undefined
  return (
    <section role="status" aria-label={t('Compra registrada')} className="mb-4 overflow-hidden rounded-2xl border border-[var(--bom)]/30 bg-[var(--cartao)] shadow-sm">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bom)] text-xl font-black text-white shadow-[0_6px_14px_-6px_var(--bom)]">✓</span>
        <span className="linha-texto pt-0.5">
          <b className="block text-base leading-tight">{t('Compra {c} registrada', { c: codigoDe(c) })}</b>
          <span className="num block text-sm text-[var(--suave)]">{[gramasTexto(dados.gramas), formatar(c.totalPrincipal, c.moedaPrincipal), dados.pessoa?.nome].filter(Boolean).join(' · ')}</span>
        </span>
        <button type="button" aria-label={t('Fechar')} onClick={onFechar} className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-[var(--suave)] hover:bg-[var(--fundo)]">×</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--borda)] bg-[var(--fundo)] px-3 py-2.5 sm:px-4">
        <span className="linha-texto text-sm">{passo ? <>✂️ {t(passo.texto)}</> : <>📦 {t('Já entrou no estoque.')}</>}</span>
        {passo?.principal && (
          <button type="button" onClick={() => irSeparar(ir, esperando.ids)} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--marca)] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110">✂️ {t('Separar agora')}</button>
        )}
        <button type="button" onClick={() => (passo ? ir('triagem') : ir('estoque'))}
          className={cx('inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]', !passo?.principal && 'ring-1 ring-[var(--marca)]/30')}>
          {t(passo ? 'Ver na Triagem' : 'Ver no estoque')} →
        </button>
      </div>
    </section>
  )
}
