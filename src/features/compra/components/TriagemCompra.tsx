// A TRIAGEM DA COMPRA, clara no Resumo (sempre à vista, não só no aviso de "compra registrada"):
//   ✂️ Falta separar · 123 g esperando há 2 dias                 [✂ Separar agora]
//   ✂️ Parte separada · T-0003 → 5 pacotes · 400 g ainda esperando [✂ Separar o resto]
//   ✓  Triagem feita · T-0003 em 02/11 por Ana → 5 pacotes · perda 3%   [Ver a triagem →]
// A situação vem do servidor (pedido.triagem); aqui só mostra e leva para separar/ver.
import { cx, dataBR, gramasTexto, pctBp } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { type DadosPedido, irSeparar } from '../model/pecas'

const TOM = {
  falta: { borda: 'ring-[var(--alerta)]/40', fundo: 'bg-[var(--alerta)]/10', icone: 'bg-[var(--alerta)] text-white', titulo: 'text-[var(--alerta)]' },
  parcial: { borda: 'ring-[var(--alerta)]/40', fundo: 'bg-[var(--alerta)]/10', icone: 'bg-[var(--alerta)] text-white', titulo: 'text-[var(--alerta)]' },
  feita: { borda: 'ring-[var(--bom)]/35', fundo: 'bg-[var(--bom)]/10', icone: 'bg-[var(--bom)] text-white', titulo: 'text-[var(--bom)]' },
  sem: { borda: 'ring-[var(--borda)]', fundo: 'bg-[var(--fundo)]', icone: 'bg-[var(--cartao)] text-[var(--suave)]', titulo: 'text-[var(--suave)]' },
} as const

export function TriagemCompra({ dados, admin, cancelada }: { dados: DadosPedido; admin: boolean; cancelada?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const tg = dados.triagem
  if (cancelada && tg.situacao !== 'feita') return null
  const tom = TOM[tg.situacao]
  const ultima = tg.feitas[tg.feitas.length - 1]
  const pacotes = tg.feitas.reduce((s, x) => s + x.pacotes, 0)
  const entrou = tg.feitas.reduce((s, x) => s + x.entrou, 0)
  const perda = tg.feitas.reduce((s, x) => s + x.perda, 0)
  const dias = dados.lotes.find((l) => l.aguardando)?.aguardando?.dias ?? 0

  const titulo = { falta: 'Falta separar', parcial: 'Parte separada', feita: 'Triagem feita', sem: 'Sem triagem' }[tg.situacao]
  const detalhe =
    tg.situacao === 'falta' ? t('{g} esperando na Triagem · há {n} dia(s)', { g: gramasTexto(tg.esperando.gramas), n: dias })
      : tg.situacao === 'sem' ? t('Já veio separada: entrou direto no estoque.')
        : [
          tg.feitas.length === 1 ? `${ultima.codigo} · ${dataBR(ultima.em)}${ultima.por ? ` · ${ultima.por}` : ''}` : t('{n} triagens', { n: tg.feitas.length }),
          t('{n} pacote(s)', { n: pacotes }),
          entrou ? `${t('perda')} ${pctBp(Math.round((perda * 10000) / entrou))}` : '',
          tg.situacao === 'parcial' ? t('{g} ainda esperando', { g: gramasTexto(tg.esperando.gramas) }) : '',
        ].filter(Boolean).join(' · ')

  const separar = admin && !cancelada && tg.esperando.ids.length > 0
  return (
    <section aria-label={t('Triagem')} className={cx('flex flex-wrap items-center gap-3 rounded-2xl p-3 ring-1', tom.fundo, tom.borda)}>
      <span aria-hidden className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg', tom.icone)}>{tg.situacao === 'feita' ? '✓' : '✂️'}</span>
      <span className="linha-texto">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Triagem')}</span>
        <b className={cx('block text-base leading-tight', tom.titulo)}>{t(titulo)}</b>
        <span className="num block text-xs text-[var(--suave)]">{detalhe}</span>
      </span>
      <span className="flex flex-wrap gap-2">
        {separar && (
          <button type="button" onClick={() => irSeparar(ir, tg.esperando.ids)} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--marca)] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110">
            ✂️ {t(tg.situacao === 'parcial' ? 'Separar o resto' : 'Separar agora')}
          </button>
        )}
        {ultima && (
          <button type="button" onClick={() => ir('triagem', { aba: 'triagens', t: ultima.id })} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
            {t(tg.feitas.length > 1 ? 'Ver as triagens' : 'Ver a triagem')} →
          </button>
        )}
      </span>
    </section>
  )
}
