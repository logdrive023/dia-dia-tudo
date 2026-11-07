// TRIAGEM › como o PRÓXIMO PASSO escolhe — as possibilidades À VISTA (nada escondido num seletor fechado):
//   "Agora: ⏳ mais tempo parado · todas as categorias"   ← diz de cara como está
//   2 · Escolher por  [⏳ Mais tempo parado] [⚖️ Mais pesado]   ← os 4 critérios, o atual destacado (grade 2 × 2)
//                     [🪶 Mais leve]         [🆕 Chegou por último]
//   1 · O quê         [Todas] [Normal] [Tinte] …            ← só as categorias que estão na fila (rola para o lado)
// Celular primeiro: alvos de 44 px; a conta fica em model/proximo.ts.
import { cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { CRITERIOS_PROXIMO, type PreferenciaProximo } from '../model/proximo'

function Opcao({ ativo, onClick, children, className }: { ativo: boolean; onClick(): void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" role="radio" aria-checked={ativo} onClick={onClick}
      className={cx('min-h-11 touch-manipulation rounded-xl border px-2.5 text-left text-sm font-semibold transition duration-100 active:scale-[0.98] motion-reduce:transform-none',
        ativo ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] text-[var(--texto)] hover:border-[var(--marca)]', className)}>
      {children}
    </button>
  )
}

export function FiltroProximo({ categorias, valor, onChange }: { categorias: string[]; valor: PreferenciaProximo; onChange(p: PreferenciaProximo): void }) {
  const t = useT()
  const atual = CRITERIOS_PROXIMO.find((c) => c.id === valor.criterio) ?? CRITERIOS_PROXIMO[0]
  return (
    <div className="space-y-3 rounded-xl bg-[var(--fundo)] p-3">
      {/* como está AGORA, numa frase */}
      <p className="text-xs text-[var(--suave)]">
        {t('Agora')}: <b className="text-[var(--texto)]">{atual.icone} {t(atual.nome)}</b> · <b className="text-[var(--texto)]">{valor.categoria ? t(valor.categoria) : t('todas as categorias')}</b>
      </p>
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t('Escolher por')}</p>
        <div role="radiogroup" aria-label={t('Escolher por')} className="grid grid-cols-2 gap-1.5">
          {CRITERIOS_PROXIMO.map((c) => (
            <Opcao key={c.id} ativo={c.id === valor.criterio} onClick={() => onChange({ ...valor, criterio: c.id })}>
              <span aria-hidden className="mr-1">{c.icone}</span>{t(c.nome)}
            </Opcao>
          ))}
        </div>
      </div>
      {categorias.length > 1 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t('O quê')}</p>
          <div role="radiogroup" aria-label={t('O quê')} className="sem-barra -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {['', ...categorias].map((c) => (
              <Opcao key={c || 'todas'} className="shrink-0 whitespace-nowrap px-3" ativo={valor.categoria === c} onClick={() => onChange({ ...valor, categoria: c })}>
                {c ? t(c) : t('Todas')}
              </Opcao>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
