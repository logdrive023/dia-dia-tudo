// PREÇOS › ABA TABELA: a barra de ações da grade (+ Medida · + Comprador · ⋯ Ferramentas · como calcula) e a legenda
// que ensina a ler a grade (medida na esquerda, comprador em cima, o número é o fator).
// CELULAR PRIMEIRO: no celular a barra cabe numa linha (Ferramentas vira só "⋯") e a legenda fica recolhida em
// "▸ Como ler a tabela", com o "i" da conta ao lado; do sm para cima, tudo à vista como sempre.
import { useState } from 'react'
import { moeda } from '../../../core/domain/dinheiro'
import { Botao, BotaoExpandir, Info, cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { type Rascunho } from '../model/tipos'

export interface BarraGradeProps {
  /** tooltip "como calcula" (com exemplos) — no celular ele fica na linha da legenda */
  ajudaConta: string
  onMedida(): void
  onComprador(): void
  onFerramentas(): void
}

export function BarraGrade({ ajudaConta, onMedida, onComprador, onFerramentas }: BarraGradeProps) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Botao variante="secundario" onClick={onMedida}>+ {t('Medida')}</Botao>
      <Botao variante="secundario" onClick={onComprador}>+ {t('Comprador')}</Botao>
      <Botao variante="leve" className="px-3 sm:px-4" aria-label={t('Ferramentas')} title={t('Ferramentas')} onClick={onFerramentas}>
        ⋯<span className="hidden sm:inline"> {t('Ferramentas')}</span>
      </Botao>
      <span className="ml-auto hidden items-center text-xs text-[var(--suave)] sm:inline-flex">
        {t('Toque no número para mudar · como calcula')}
        <Info texto={ajudaConta} />
      </span>
    </div>
  )
}

export interface LegendaGradeProps {
  /** unidade da medida (linha); sem tabela publicada ainda → "cm" */
  unidade?: string
  moeda: Rascunho['moeda']
  fatorPor: Rascunho['fatorPor']
  /** tooltip "como calcula": no celular aparece aqui (na barra ele só aparece do sm para cima) */
  ajudaConta: string
}

export function LegendaGrade({ unidade, moeda: codMoeda, fatorPor, ajudaConta }: LegendaGradeProps) {
  const t = useT()
  const [aberta, setAberta] = useState(false)
  return (
    <div className="rounded-xl bg-[var(--cartao)] px-3 py-1 text-xs text-[var(--suave)] sm:py-2">
      {/* celular: uma linha só; a legenda abre no lugar */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <BotaoExpandir aberto={aberta} onClick={() => setAberta(!aberta)} className="-ml-2">{t('Como ler a tabela')}</BotaoExpandir>
        <Info texto={ajudaConta} />
      </div>
      <div className={cx('flex-wrap items-center gap-x-3 gap-y-1 pb-1 sm:flex sm:pb-0', aberta ? 'flex' : 'hidden')}>
        <span>↓ <b className="text-[var(--texto)]">{t('Medida')}</b> ({unidade ?? 'cm'})</span>
        <span>→ <b className="text-[var(--texto)]">{t('Comprador')}</b> <span aria-hidden>👤</span> = {t('ligado a uma pessoa')}</span>
        <span><b className="text-[var(--texto)]">{t('Número')}</b> = {t('fator')} ({moeda(codMoeda).simbolo} {t(fatorPor === 'grama' ? 'por grama' : 'por unidade')})</span>
        <span><b className="text-[var(--texto)]">–</b> = {t('sem preço')}</span>
      </div>
    </div>
  )
}
