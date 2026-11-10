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

// ---------- bipe (som gerado aqui, sem arquivo) + vibração ----------

// DESEMPENHO NO TOQUE: o bipe é um <audio> com um WAV curto montado na hora (≈ 1,5 KB). Antes era um AudioContext,
// que liga o áudio do aparelho DE UMA VEZ na linha principal: travava a tela ~0,24 s (medido com CPU de celular), no
// toque ou logo ao abrir o Modo caixa. O <audio> monta em ~4 ms e toca sem travar (o navegador decodifica fora da tela).
// bipe() vibra na hora e toca DEPOIS do próximo quadro — a lista atualiza primeiro.
type Som = { ok?: HTMLAudioElement; erro?: HTMLAudioElement }
const sons: Som = {}

/** WAV PCM 16 bits mono, 8 kHz: o bipe certo (agudo e curto) ou o de erro (grave, quadrado e mais longo) */
function wavBipe(ok: boolean): Blob {
  const taxa = 8000
  const dur = ok ? 0.09 : 0.28
  const freq = ok ? 1500 : 190
  const volume = ok ? 0.12 : 0.08
  const n = Math.round(taxa * dur)
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const texto = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  texto(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); texto(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  texto(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) {
    const fase = (freq * i) / taxa
    const onda = ok ? Math.sin(2 * Math.PI * fase) : fase % 1 < 0.5 ? 1 : -1
    // some aos poucos (sem "clique" no fim)
    v.setInt16(44 + i * 2, Math.round(onda * volume * 32767 * Math.pow(1 - i / n, 2)), true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

function som(ok: boolean): HTMLAudioElement | undefined {
  const k = ok ? 'ok' : 'erro'
  if (!sons[k]) {
    if (typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined
    const a = new Audio(URL.createObjectURL(wavBipe(ok)))
    a.preload = 'auto'
    sons[k] = a
  }
  return sons[k]
}

/** deixa os dois sons prontos quando a tela abre (barato: ~4 ms, nada de ligar o áudio do aparelho) */
export function prepararBipe() {
  try {
    som(true)
    som(false)
  } catch {
    /* sem som: segue */
  }
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
    const a = som(ok)
    if (!a) return
    // leitura seguida (pistola): recomeça o mesmo bipe em vez de esperar o anterior terminar
    a.currentTime = 0
    void a.play()?.catch(() => { /* navegador bloqueou o som (sem toque ainda): segue em silêncio */ })
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
          <span className="mt-0.5 block whitespace-nowrap text-[8px] font-semibold uppercase leading-none text-[var(--suave)]">{t('Sem foto')}</span>
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
