// PEÇAS DO MODO CAIXA (usadas pelos componentes da tela): os tipos da venda em andamento, o bipe, a largura da tela,
// o que fica guardado no aparelho (moeda, modo do desconto) e a miniatura/origem do pacote.

import { useEffect, useRef, useState } from 'react'
import type { Id } from '../../../core/domain/tipos'
import type { ResultadoConsulta } from '../../../core/services'
import { cx, loc } from '../../../shared/ui/base'
import { lerCotacaoTexto } from '../../../shared/ui/compartilhados'
import { marcadorLote, useUrlFoto } from '../../../shared/ui/fotos'
import { useT } from '../../../shared/ui/i18n'

export type Pacote = ResultadoConsulta<'estoque'>[number]

export interface LinhaCaixa {
  id: Id
  itemId: Id
  /** gramas (cabelo) ou unidades (produto) */
  quantidade: number
  /** preço digitado (pacote sem preço de tabela: bruto, sem medida) — na moeda principal */
  precoManual?: number
}

export interface Preco {
  moeda: string
  total: number
  calculo?: { medida: number; fator: string; categoria: string; tabelaId: Id; colunaId: string }
  erro?: string
}

export interface Feita {
  id: Id
  total: number
  moeda: string
  /** total na moeda da tabela quando cobrou em outra */
  totalPrincipal?: number
  moedaPrincipal: string
  troco?: number
  texto: string
  telefone?: string
}

// ---------- bipe (WebAudio, sem arquivo) + vibração ----------

// DESEMPENHO NO TOQUE: criar o AudioContext liga o áudio do aparelho e TRAVA a tela (medido: 232 ms com CPU de celular,
// dentro do toque que põe o pacote na venda). Por isso: (1) prepararBipe() cria o áudio quando a tela abre, num
// momento ocioso; (2) bipe() vibra na hora e toca o som DEPOIS do próximo quadro — a lista atualiza primeiro.
let audio: AudioContext | undefined
const ClasseAudio = () => window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

/** cria o áudio fora do toque (ocioso); o navegador deixa "suspenso" até o 1º toque, e o bipe só retoma */
export function prepararBipe() {
  if (audio) return
  const criar = () => {
    try {
      const C = ClasseAudio()
      if (C && !audio) audio = new C()
    } catch {
      /* sem som: segue */
    }
  }
  const ocioso = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (ocioso) ocioso(criar, { timeout: 3000 })
  else setTimeout(criar, 600)
}

export function bipe(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 40 : [90, 60, 90])
  } catch {
    /* sem vibração */
  }
  // o som sai depois do próximo quadro: o pacote aparece na lista sem esperar o áudio
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(() => tocar(ok), 0))
  else setTimeout(() => tocar(ok), 0)
}

function tocar(ok: boolean) {
  try {
    const C = ClasseAudio()
    if (C) {
      audio ??= new C()
      if (audio.state === 'suspended') void audio.resume()
      const o = audio.createOscillator()
      const g = audio.createGain()
      const dur = ok ? 0.09 : 0.28
      o.type = ok ? 'sine' : 'square'
      o.frequency.value = ok ? 1500 : 190
      g.gain.setValueAtTime(ok ? 0.12 : 0.08, audio.currentTime)
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur)
      o.connect(g).connect(audio.destination)
      o.start()
      o.stop(audio.currentTime + dur + 0.02)
    }
  } catch {
    /* sem som: segue */
  }
}

/** largura do conteúdo (o menu lateral come espaço no tablet); sem ResizeObserver, como nos testes, conta como larga */
export function useLargura() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1280)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const o = new ResizeObserver(() => setW(el.clientWidth))
    o.observe(el)
    setW(el.clientWidth)
    return () => o.disconnect()
  }, [])
  return { ref, w }
}

/** media query no JS (sem matchMedia, como nos testes, vale o padrão) */
export { useMidia } from '../../../shared/ui/midia'

/** ainda não separado: pode vender (nunca trava), com um aviso; o preço é digitado se a tabela não tiver */
export const NAO_SEPARADO = new Set(['bruto', 'naoIdentificado', 'preparando'])

/** modo do desconto (% ou valor): o último escolhido fica no aparelho */
export const CHAVE_MODO_DESCONTO = 'tudo.caixa.modoDesconto'
export function lerModoDesconto(): 'pct' | 'valor' {
  try {
    return localStorage.getItem(CHAVE_MODO_DESCONTO) === 'pct' ? 'pct' : 'valor'
  } catch {
    return 'valor'
  }
}
/** "2,5" → 2.5 (inválido → undefined) */
export function lerPct(texto: string) {
  const s = texto.trim().replace('%', '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined
  return Number(s)
}
export const pctTexto = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 2 })

/** moeda de cobrança: a última escolhida fica no aparelho */
export const CHAVE_MOEDA_COBRANCA = 'tudo.caixa.moedaCobranca'
export function lerMoedaCobranca() {
  try {
    return localStorage.getItem(CHAVE_MOEDA_COBRANCA) ?? ''
  } catch {
    return ''
  }
}
export const lerCotacao = lerCotacaoTexto

/** foto do pacote (miniatura guardada) ou a medida no lugar; só mostra (o toque é de quem usa) */
export function Miniatura({ item, tamanho = 'h-14 w-14' }: { item: Pick<Pacote, 'foto' | 'campos' | 'nome'>; tamanho?: string }) {
  const t = useT()
  const url = useUrlFoto(item.foto)
  return (
    <span className={cx('relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--fundo)]', !item.foto && 'border-dashed', tamanho)}>
      {item.foto ? (
        url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-[var(--borda)]" />
      ) : (
        <>
          <span className="num block font-black leading-none">{marcadorLote(item.campos, item.nome)}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[8px] font-semibold uppercase leading-none text-[var(--suave)]">{t('sem foto')}</span>
        </>
      )}
    </span>
  )
}

/** "P-0003 · Helena" (+2 quando vem de várias compras) */
export function origemCurta(i: Pick<Pacote, 'compras' | 'fornecedor'>) {
  const c = i.compras?.[0]
  if (!c) return i.fornecedor
  return [c.codigo, c.fornecedor].filter(Boolean).join(' · ') + (i.compras.length > 1 ? ` +${i.compras.length - 1}` : '')
}


/** uma linha da venda já com o pacote e o preço calculado (o que as peças da tela mostram) */
export type Vista = LinhaCaixa & { item: Pacote; preco: Preco }
