// PREÇOS › a barra do rascunho (presa embaixo): "● 3 mudança(s)" · Desfazer · Descartar tudo · Publicar vN, e a nota
// do que mudou. Só aparece quando algo mudou (quem decide é a tela).
import { Botao, Entrada } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'

export interface BarraRascunhoProps {
  /** tabela nova (ainda sem versão publicada) */
  novo: boolean
  /** total de mudanças em relação à versão publicada */
  mudancas: number
  /** quantos valores não são número válido (bloqueia publicar) */
  invalidos: number
  podeDesfazer: boolean
  ocupado: boolean
  /** versão em uso: publicar cria a seguinte */
  atual: number
  nota: string
  onNota(nota: string): void
  onDesfazer(): void
  onDescartar(): void
  onPublicar(): void
}

export function BarraRascunho({ novo, mudancas, invalidos, podeDesfazer, ocupado, atual, nota, onNota, onDesfazer, onDescartar, onPublicar }: BarraRascunhoProps) {
  const t = useT()
  return (
    <div className="sticky bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-20 mt-4 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-3 shadow-lg md:bottom-4">
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="mr-auto text-sm font-semibold text-[var(--marca)]">
          ● {novo ? t('Tabela nova') : t('{n} mudança(s)', { n: mudancas })}
          {invalidos > 0 && <span className="block text-xs font-normal text-[var(--ruim)]">{t('{n} valor(es) inválido(s): use números como 3,5.', { n: invalidos })}</span>}
        </span>
        <Botao variante="leve" disabled={!podeDesfazer} onClick={onDesfazer}>↶ {t('Desfazer')}</Botao>
        {!novo && <Botao variante="leve" className="hidden sm:inline-block" onClick={onDescartar}>{t('Descartar tudo')}</Botao>}
        <Botao disabled={ocupado || invalidos > 0 || (!novo && !mudancas)} onClick={onPublicar}>{novo ? t('Criar tabela') : t('Publicar v{n}', { n: atual + 1 })}</Botao>
      </div>
      <Entrada className="mt-2" aria-label={t('O que mudou e por quê (opcional)')} placeholder={t('O que mudou e por quê (opcional)')} value={nota} onChange={(e) => onNota(e.target.value)} />
    </div>
  )
}
