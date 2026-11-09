// TRIAGEM › REGRAS PARA JUNTAR: a janela que explica quando dá para juntar pacotes.
import { useState } from 'react'
import { Botao, Entrada, Janela, cx } from '../../../shared/ui/base'
import { useComando } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

/**
 * REGRAS DE JUNTAR (o ⚙ do quadro de regras): o dono decide sem mexer em código. Liga/desliga "uma etapa por vez" e o
 * limite da "sobra pequena". Vale para todos, na tela e no servidor (guardado na configuração geral).
 */
export function RegrasJuntar({ mesmaEtapa, saldoPequeno, onFechar }: { mesmaEtapa: boolean; saldoPequeno: number; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [etapa, setEtapa] = useState(mesmaEtapa)
  const [limite, setLimite] = useState(String(saldoPequeno))
  const n = Number(limite)
  const valido = limite.trim() !== '' && Number.isInteger(n) && n >= 0
  const salvar = async () => {
    const r = await executar('salvarConfig', { juntarMesmaEtapa: etapa, saldoPequenoG: n }, t('Regras salvas ✓'))
    if (r) onFechar()
  }
  return (
    <Janela aberta titulo={t('Regras para juntar pacotes')} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Cancelar')}</Botao><Botao disabled={ocupado || !valido} onClick={salvar}>{t('Salvar regras')}</Botao></div>}>
      <p className="mb-3 text-sm text-[var(--suave)]">{t('Valem para todos, nesta tela e ao registrar. Dá para mudar quando quiser.')}</p>
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--borda)] p-3 hover:border-[var(--marca)]">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-lg">📍</span>
          <span className="min-w-0 flex-1">
            <b className="block">{t('Juntar só pacotes da mesma etapa')}</b>
            <span className="block text-xs text-[var(--suave)]">{t('Ligado: quem está em “Lavando” não entra junto com quem está em “Aguardando triagem”. Desligado: pode misturar etapas.')}</span>
          </span>
          {/* liga/desliga */}
          <input type="checkbox" role="switch" className="peer sr-only" checked={etapa} onChange={(e) => setEtapa(e.target.checked)} aria-label={t('Juntar só pacotes da mesma etapa')} />
          <span aria-hidden className={cx('relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--marca)]', etapa ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')}>
            <span className={cx('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', etapa && 'translate-x-5')} />
          </span>
        </label>
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--borda)] p-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-lg">⚠️</span>
          <span className="min-w-0 flex-1">
            <b className="block">{t('Avisar sobra pequena')}</b>
            <span className="block text-xs text-[var(--suave)]">{t('Pacote com menos que isso ganha ⚠ na lista e no painel (não bloqueia). 0 desliga o aviso.')}</span>
            <span className="mt-2 flex items-center gap-2">
              <Entrada inputMode="numeric" className="w-28" aria-label={t('Limite em gramas')} value={limite} onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))} />
              <span className="text-sm text-[var(--suave)]">g</span>
            </span>
          </span>
        </div>
      </div>
    </Janela>
  )
}
