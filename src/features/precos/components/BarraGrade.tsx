// PREÇOS › ABA TABELA: a barra de ações da grade (+ Medida · + Comprador · ⋯ Ferramentas · como calcula) e a legenda
// que ensina a ler a grade (medida na esquerda, comprador em cima, o número é o fator).
// CELULAR PRIMEIRO: no celular a barra cabe numa linha (Ferramentas vira só "⋯") e a legenda fica recolhida em
// "▸ Como ler a tabela", com o "i" da conta ao lado; do sm para cima, tudo à vista como sempre.
import { type ReactNode, useState } from 'react'
import { moeda } from '../../../core/domain/dinheiro'
import { Botao, BotaoExpandir, cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { type Rascunho } from '../model/tipos'
import { AjudaConta } from './AjudaConta'

export interface BarraGradeProps {
  /** moeda da tabela (o ⓘ "como calcula" mostra os valores nela) — no celular o ⓘ fica na linha da legenda */
  moeda: Rascunho['moeda']
  onMedida(): void
  onComprador(): void
  onFerramentas(): void
}

export function BarraGrade({ moeda: codMoeda, onMedida, onComprador, onFerramentas }: BarraGradeProps) {
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
        <AjudaConta moeda={codMoeda} />
      </span>
    </div>
  )
}

/** um sinal da legenda: [símbolo] Título / explicação curta */
function Sinal({ simbolo, titulo, texto, destaque }: { simbolo: string; titulo: string; texto: ReactNode; destaque?: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--fundo)] p-1.5 sm:bg-transparent sm:p-0">
      <span aria-hidden className={cx('num flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 text-xs font-bold', destaque ? 'bg-[var(--marca-suave)] text-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--texto)] ring-1 ring-[var(--borda)]')}>{simbolo}</span>
      <span className="min-w-0 leading-tight">
        <b className="block text-[var(--texto)]">{titulo}</b>
        <span className="block text-[11px]">{texto}</span>
      </span>
    </li>
  )
}

export interface LegendaGradeProps {
  /** unidade da medida (linha); sem tabela publicada ainda → "cm" */
  unidade?: string
  moeda: Rascunho['moeda']
  fatorPor: Rascunho['fatorPor']
}

export function LegendaGrade({ unidade, moeda: codMoeda, fatorPor }: LegendaGradeProps) {
  const t = useT()
  const [aberta, setAberta] = useState(false)
  return (
    <div className="rounded-xl bg-[var(--cartao)] px-3 py-1 text-xs text-[var(--suave)] sm:py-2">
      {/* celular: uma linha só; a legenda abre no lugar */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <BotaoExpandir aberto={aberta} onClick={() => setAberta(!aberta)} className="-ml-2">{t('Como ler a tabela')}</BotaoExpandir>
        {/* o ⓘ "como calcula": no celular fica aqui (na barra ele só aparece do sm para cima) */}
        <AjudaConta moeda={codMoeda} />
      </div>
      {/* os 4 sinais da grade, cada um com o símbolo em destaque (o mesmo que aparece na grade) e uma linha curta:
          celular = 2 × 2 cartõezinhos; do sm para cima = uma fileira só */}
      <ul className={cx('grid-cols-2 gap-1.5 pb-2 pt-1 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-1 sm:p-0', aberta ? 'grid' : 'hidden')}>
        <Sinal simbolo="↓" titulo={t('Medida')} texto={`${t('linha')} · ${unidade ?? 'cm'}`} />
        <Sinal simbolo="→" titulo={t('Comprador')} texto={<><span aria-hidden>👤</span> = {t('ligado a uma pessoa')}</>} />
        <Sinal simbolo="3,5" titulo={t('Número')} texto={`${t('fator')} · ${moeda(codMoeda).simbolo} ${t(fatorPor === 'grama' ? 'por grama' : 'por unidade')}`} destaque />
        <Sinal simbolo="–" titulo={t('Sem preço')} texto={t('digite o valor na hora da venda')} />
      </ul>
    </div>
  )
}
