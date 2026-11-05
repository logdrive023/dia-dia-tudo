// O CAMINHO DA TRIAGEM, sempre à vista: 🛒 Compra → 🔗 Juntar (opcional) → ✂️ Separar → 🏷 Etiqueta → ✅ Pronto.
// Uma faixa curta com a etapa de agora marcada e UMA frase "Próximo passo: …" com o botão. Depois de separar, o cartão
// "Próximo passo: gerar a etiqueta" (abre a janela de impressão, que também deixa só marcar como gerada); com tudo feito,
// "Tudo pronto ✓ — os pacotes estão no estoque para vender".
import { type ReactNode, useState } from 'react'
import type { Id } from '../../core/domain/tipos'
import { Botao, cx } from '../../ui/base'
import { useApp } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { ImprimirEtiquetas } from '../../ui/etiquetas'

export type EtapaFluxo = 'compra' | 'juntar' | 'separar' | 'etiqueta' | 'pronto'
const ETAPAS: { id: EtapaFluxo; icone: string; nome: string; opcional?: boolean }[] = [
  { id: 'compra', icone: '🛒', nome: 'Compra' },
  { id: 'juntar', icone: '🔗', nome: 'Juntar', opcional: true },
  { id: 'separar', icone: '✂️', nome: 'Separar' },
  { id: 'etiqueta', icone: '🏷', nome: 'Etiqueta' },
  { id: 'pronto', icone: '✅', nome: 'Pronto' },
]

/** A faixa das etapas: as que já passaram com ✓, a de agora em destaque, o resto apagado. Rola de lado se não couber. */
export function TrilhaFluxo({ agora }: { agora: EtapaFluxo }) {
  const t = useT()
  const k = ETAPAS.findIndex((e) => e.id === agora)
  return (
    <ol aria-label={t('Caminho da triagem')} className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 text-xs [scrollbar-width:none]">
      {ETAPAS.map((e, i) => (
        <li key={e.id} className="flex shrink-0 items-center gap-1" aria-current={i === k ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className="text-[var(--suave)]">›</span>}
          {/* etapa opcional que ficou para trás não ganha ✓ (pode não ter sido feita): fica neutra */}
          <span className={cx('inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-full px-2 font-semibold', i === k ? 'bg-[var(--marca)] text-white' : i < k && !e.opcional ? 'bg-[var(--bom)]/12 text-[var(--bom)]' : 'text-[var(--suave)] ring-1 ring-[var(--borda)]')}>
            <span aria-hidden>{i < k && !e.opcional ? '✓' : e.icone}</span>
            {/* no celular, só a etapa de agora tem nome (as outras ficam no ícone): a de agora nunca sai da tela */}
            <span className={i === k ? undefined : 'sr-only sm:not-sr-only'}>{t(e.nome)}{e.opcional && i !== k && <span className="font-normal opacity-80"> ({t('opcional')})</span>}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Cartão "Próximo passo": a trilha, a frase do que fazer e o(s) botão(ões). */
export function ProximoPasso({ agora, titulo, texto, acoes, tom = 'marca', onFechar }: { agora: EtapaFluxo; titulo: string; texto?: ReactNode; acoes?: ReactNode; tom?: 'marca' | 'bom'; onFechar?(): void }) {
  const t = useT()
  const cor = tom === 'bom' ? 'var(--bom)' : 'var(--marca)'
  return (
    <section role="status" aria-label={t(titulo)} className="space-y-2 rounded-2xl border p-3" style={{ borderColor: `color-mix(in srgb, ${cor} 40%, transparent)`, background: `color-mix(in srgb, ${cor} 8%, transparent)` }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><TrilhaFluxo agora={agora} /></div>
        {onFechar && <button type="button" aria-label={t('Fechar')} onClick={onFechar} className="-mr-1 -mt-1 h-10 w-10 shrink-0 rounded-xl text-lg hover:bg-[var(--fundo)]">×</button>}
      </div>
      <p className="text-sm"><b className="block" style={{ color: cor }}>{t(titulo)}</b>{texto}</p>
      {acoes && <div className="flex flex-wrap items-center gap-2 [&>button]:min-w-max">{acoes}</div>}
    </section>
  )
}

/**
 * Depois de separar (?novos=… no endereço): "Próximo passo: gerar a etiqueta" → janela de impressão. Impressa (ou só
 * marcada como gerada): "Tudo pronto ✓", com o caminho para os prontos e o estoque.
 */
export function DepoisDeSeparar({ onProntos }: { onProntos(): void }) {
  const t = useT()
  const { nav, ajustarParams, ir } = useApp()
  const [imprimir, setImprimir] = useState(false)
  const [feito, setFeito] = useState<string>()
  const ids: Id[] = String(nav.params.novos ?? '').split(',').filter(Boolean)
  const chave = ids.join(',')
  if (!ids.length) return null
  const fechar = () => ajustarParams({ novos: undefined })
  if (feito === chave)
    return (
      <ProximoPasso agora="pronto" tom="bom" onFechar={fechar} titulo="Tudo pronto ✓ — os pacotes estão no estoque para vender"
        texto={<span className="text-[var(--suave)]">{t(ids.length === 1 ? '1 pacote com etiqueta.' : '{n} pacotes com etiqueta.', { n: ids.length })}</span>}
        acoes={<>
          <Botao onClick={() => (fechar(), onProntos())}>✅ {t('Ver os prontos')}</Botao>
          <Botao variante="secundario" onClick={() => ir('estoque', { modulo: 'cabelo' })}>📦 {t('Estoque')}</Botao>
          <Botao variante="leve" onClick={fechar}>{t('Separar outro')}</Botao>
        </>} />
    )
  return (
    <>
      <ProximoPasso agora="etiqueta" onFechar={fechar} titulo="Próximo passo: gerar a etiqueta"
        texto={<span className="text-[var(--suave)]">{t(ids.length === 1 ? '✓ Separado: 1 pacote novo, ainda sem etiqueta.' : '✓ Separado: {n} pacotes novos, ainda sem etiqueta.', { n: ids.length })}</span>}
        acoes={<>
          <Botao onClick={() => setImprimir(true)}>🏷 {t(ids.length === 1 ? 'Gerar a etiqueta' : 'Gerar as {n} etiquetas', { n: ids.length })}</Botao>
          <Botao variante="leve" onClick={() => (fechar(), ir('etiquetas'))}>{t('Depois (ficam em Etiquetas)')}</Botao>
        </>} />
      {imprimir && <ImprimirEtiquetas ids={ids} onImpresso={() => setFeito(chave)} onFechar={() => setImprimir(false)} />}
    </>
  )
}
