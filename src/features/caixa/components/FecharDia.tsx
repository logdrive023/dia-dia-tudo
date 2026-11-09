// CAIXA › FECHAR O DIA: o que só existe aqui — conferir a gaveta. Mostra o dinheiro vivo que deveria ter em cada moeda
// e, depois de encerrar, se o que foi contado bateu.
import { formatar } from '../../../core/domain/dinheiro'
import type { ContaMoeda } from '../../../core/services/caixa'
import { Botao, Cartao, cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

export function FecharDia({ contas, aberto, ocupado, onEncerrar, onReabrir }: { contas: ContaMoeda[]; aberto: boolean; ocupado: boolean; onEncerrar(): void; onReabrir(): void }) {
  const t = useT()
  const comDinheiro = contas.filter((c) => c.mao !== 0 || c.contado !== undefined)
  return (
    <Cartao titulo={t('Fechar o dia')} ajuda="Conte o dinheiro da gaveta e informe ao encerrar: o sistema diz se faltou ou sobrou. Ex.: deveria ter Bs 500, contou Bs 480 → faltam Bs 20.">
      {comDinheiro.length > 0 ? (
        <ul className="mb-3 divide-y divide-[var(--borda)] text-sm">
          {comDinheiro.map((c) => (
            <li key={c.moeda} className="py-2 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[var(--suave)]">{t('Deve ter na gaveta')} ({c.moeda})</span>
                <b className="num whitespace-nowrap">{formatar(c.mao, c.moeda)}</b>
              </div>
              {c.contado !== undefined && (
                <p className={cx('num mt-1 text-right font-semibold', c.contado === c.mao ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
                  {t('Contado')}: {formatar(c.contado, c.moeda)} · {c.contado === c.mao ? t('Bateu ✓') : c.contado < c.mao ? t('Faltam {v}', { v: formatar(c.mao - c.contado, c.moeda) }) : t('Sobram {v}', { v: formatar(c.contado - c.mao, c.moeda) })}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mb-3 text-sm text-[var(--suave)]">{t('Nenhum dinheiro vivo para contar neste dia.')}</p>}
      {aberto
        ? <Botao grande variante="secundario" className="w-full" onClick={onEncerrar}>🔒 {t('Encerrar o dia')}</Botao>
        : <Botao grande variante="secundario" className="w-full" disabled={ocupado} onClick={onReabrir}>🔓 {t('Reabrir o dia')}</Botao>}
    </Cartao>
  )
}
