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

/** uma regra de juntar (mesma etapa · compras diferentes · sobra pequena): ligada ou não */
export interface RegraJuntar { icone: string; titulo: string; texto: string; ligado: boolean }

/**
 * O PAINEL DA TRIAGEM — UMA composição para o que antes eram dois cartões ("Próximo passo" e "Juntar pacotes"):
 *   · em cima, a trilha do caminho (Compra › Juntar › Separar › Etiqueta › Pronto);
 *   · à esquerda (o principal), o PRÓXIMO PASSO: rótulo pequeno, a frase, o porquê e o botão;
 *   · à direita (secundário, fundo mais calmo), JUNTAR ANTES (opcional): as regras numa lista simples e as ações.
 * Computador: duas colunas com um divisor fino; celular: uma embaixo da outra, divisor na horizontal. Um só contorno,
 * um só fundo. Sem o próximo passo (marcando pacotes), só o juntar; sem 2+ pacotes, só o próximo passo.
 */
export function PainelTriagem({ agora, tom = 'marca', rotulo = 'Próximo passo', titulo, texto, acoes, juntar }: {
  agora: EtapaFluxo
  tom?: 'marca' | 'bom'
  /** o rótulo pequeno do próximo passo ("Próximo passo", "Nada para separar 🎉") */
  rotulo?: string
  titulo?: string
  texto?: ReactNode
  acoes?: ReactNode
  juntar?: { titulo: string; regras: RegraJuntar[]; acoes?: ReactNode }
}) {
  const t = useT()
  const cor = tom === 'bom' ? 'var(--bom)' : 'var(--marca)'
  const passo = !!titulo
  return (
    <section aria-label={t(titulo ?? juntar?.titulo ?? 'Triagem')} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="border-b border-[var(--borda)] px-4 py-2.5" style={{ background: `color-mix(in srgb, ${cor} 7%, transparent)` }}>
        <TrilhaFluxo agora={agora} />
      </div>
      <div className={cx('grid divide-y divide-[var(--borda)]', passo && juntar && 'md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:divide-x md:divide-y-0')}>
        {passo && (
          <div role="status" className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t(rotulo)}</p>
              <p className="mt-1 text-lg font-bold leading-snug" style={{ color: cor }}>{t(titulo!)}</p>
              {texto && <p className="mt-1 text-sm text-[var(--suave)]">{texto}</p>}
            </div>
            {acoes && <div className="mt-auto flex flex-wrap items-center gap-2 [&>button]:min-w-max">{acoes}</div>}
          </div>
        )}
        {juntar && (
          <div className={cx('flex min-w-0 flex-col gap-3 p-4 sm:p-5', passo && 'bg-[var(--fundo)]/50')}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              {passo && <p className="basis-full text-[11px] font-bold uppercase tracking-wider text-[var(--suave)]">{t('Antes, se quiser')}</p>}
              <p className="text-sm font-bold">🔗 {t(juntar.titulo)}</p>
            </div>
            {/* as regras: lista simples (ícone · título · explicação), sem cartão dentro de cartão */}
            <ul className={cx('grid gap-x-5 gap-y-2.5 text-xs', !passo && 'sm:grid-cols-3')}>
              {juntar.regras.map((r) => (
                <li key={r.icone} className={cx('flex min-w-0 items-start gap-2.5', !r.ligado && 'opacity-70')}>
                  <span aria-hidden className="mt-px w-5 shrink-0 text-center text-sm leading-none">{r.icone}</span>
                  <span className="min-w-0 flex-1"><b className="block break-words text-[var(--texto)]">{t(r.titulo)}</b><span className="block text-[var(--suave)]">{t(r.texto)}</span></span>
                </li>
              ))}
            </ul>
            {juntar.acoes && <div className="mt-auto flex flex-wrap items-center gap-2 [&>button]:min-w-max">{juntar.acoes}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * A TRIAGEM VAZIA (nada para separar) — a mesma moldura do PainelTriagem (contorno + trilha), com a composição de um
 * estado vazio bem acabado: o símbolo num círculo, o título, UMA frase de onde está tudo agora, os números do que
 * ficou pronto e as ações. Computador: símbolo · texto · ações numa linha; celular: tudo centrado, um embaixo do outro.
 */
export function TriagemVazia({ agora, tom = 'bom', icone, titulo, texto, fatos = [], acoes }: {
  agora: EtapaFluxo
  tom?: 'marca' | 'bom'
  icone: string
  titulo: string
  texto: ReactNode
  /** os números do que ficou pronto ("19 pacotes", "21,7 kg"): selos pequenos embaixo do texto */
  fatos?: string[]
  acoes?: ReactNode
}) {
  const t = useT()
  const cor = tom === 'bom' ? 'var(--bom)' : 'var(--marca)'
  return (
    <section role="status" aria-label={t(titulo)} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="border-b border-[var(--borda)] px-4 py-2.5" style={{ background: `color-mix(in srgb, ${cor} 7%, transparent)` }}>
        <TrilhaFluxo agora={agora} />
      </div>
      <div className="flex flex-col items-center gap-4 px-5 py-7 text-center md:flex-row md:items-center md:gap-6 md:px-6 md:py-6 md:text-left">
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl" style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, boxShadow: `0 0 0 6px color-mix(in srgb, ${cor} 6%, transparent)` }}>{icone}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold leading-snug">{t(titulo)}</p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--suave)] md:mx-0">{texto}</p>
          {fatos.length > 0 && (
            <p className="mt-2.5 flex flex-wrap justify-center gap-1.5 md:justify-start">
              {fatos.map((f) => <span key={f} className="num rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: cor, background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>{f}</span>)}
            </p>
          )}
        </div>
        {acoes && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center md:shrink-0 md:flex-col md:items-stretch lg:flex-row [&>button]:min-w-max">{acoes}</div>}
      </div>
    </section>
  )
}
