// Peças da tela de ESTOQUE: situação do lote em cor, barra "para onde foi cada grama", leitor de código pela câmera
// e o aviso de tela larga (tabela) × estreita (cartões).

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { StatusLote } from '../core/services/estoque'
import { Botao, Janela, Pilula, cx, gramasTexto } from './base'
import { useT } from './i18n'
import { useApp } from './contexto'
import { loteDoCodigoLido } from './etiquetas'

export const STATUS_LOTE: Record<StatusLote, { nome: string; tom: 'bom' | 'alerta' | 'neutro' | 'marca' }> = {
  disponivel: { nome: 'Disponível', tom: 'bom' },
  parcial: { nome: 'Parcial', tom: 'marca' },
  bruto: { nome: 'Bruto · para separar', tom: 'alerta' },
  preparando: { nome: 'Em triagem', tom: 'marca' },
  esgotado: { nome: 'Esgotado', tom: 'neutro' },
}

export function StatusBadge({ status }: { status: StatusLote }) {
  const t = useT()
  const s = STATUS_LOTE[status]
  return <Pilula tom={s.tom}>{t(s.nome)}</Pilula>
}

/** true em tela de 1024 px ou mais (sem matchMedia, como nos testes, conta como larga). */
export function useTelaLarga() {
  const ler = () => {
    try {
      return window.matchMedia?.('(min-width: 1024px)').matches ?? true
    } catch {
      return true
    }
  }
  const [larga, setLarga] = useState(ler)
  useEffect(() => {
    try {
      const m = window.matchMedia('(min-width: 1024px)')
      const f = () => setLarga(m.matches)
      m.addEventListener('change', f)
      return () => m.removeEventListener('change', f)
    } catch {
      return undefined
    }
  }, [])
  return larga
}

/** Barra comprado → vendido → separado → perda → em estoque (gramas). */
export function BarraFluxo({ partes, total }: { partes: { nome: string; valor: number; cor: string }[]; total: number }) {
  const t = useT()
  const base = Math.max(total, partes.reduce((s, p) => s + p.valor, 0), 1)
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--fundo)]" role="img" aria-label={partes.map((p) => `${t(p.nome)} ${gramasTexto(p.valor)}`).join(', ')}>
        {partes.filter((p) => p.valor > 0).map((p) => <div key={p.nome} className="h-full" style={{ width: `${(p.valor / base) * 100}%`, background: p.cor }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {partes.map((p) => (
          <li key={p.nome} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: p.cor }} aria-hidden />
            <span className="text-[var(--suave)]">{t(p.nome)}</span> <b className="num">{gramasTexto(p.valor)}</b>
            <span className="text-[var(--suave)]">({Math.round((p.valor / base) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Etapa numerada do prontuário (1 Entrada → 2 Triagem → 3 Destino). */
export function Etapa({ n, titulo, children, acao }: { n: number; titulo: ReactNode; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="relative flex min-w-0 flex-col rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--marca)] text-sm text-white">{n}</span>
          {titulo}
        </h2>
        {acao}
      </div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </section>
  )
}

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> }

export const temLeitorCodigo = () => typeof window !== 'undefined' && 'BarcodeDetector' in window

/**
 * Abre a câmera, lê QR/código de barras e devolve o texto. Sem câmera ou sem permissão: explica e deixa digitar.
 * QR da ETIQUETA do lote (…#/lotes/<id>): abre o lote direto.
 */
export function LeitorCodigo({ onLer: onLerTexto, onFechar }: { onLer(codigo: string): void; onFechar(): void }) {
  const t = useT()
  const { ir } = useApp()
  const ref = useRef({ onLerTexto, onFechar, ir })
  ref.current = { onLerTexto, onFechar, ir }
  const onLer = useCallback((texto: string) => {
    const lote = loteDoCodigoLido(texto)
    if (lote) return (ref.current.onFechar(), ref.current.ir('lote', { id: lote }))
    ref.current.onLerTexto(texto)
  }, [])
  const video = useRef<HTMLVideoElement>(null)
  const [erro, setErro] = useState<string>()
  useEffect(() => {
    let stream: MediaStream | undefined
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    ;(async () => {
      try {
        const Ctor = (window as unknown as { BarcodeDetector: new (o?: object) => Detector }).BarcodeDetector
        const detector = new Ctor()
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!vivo || !video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const ler = async () => {
          if (!vivo || !video.current) return
          try {
            const r = await detector.detect(video.current)
            if (r[0]?.rawValue && vivo) return onLer(r[0].rawValue.trim())
          } catch {
            /* quadro ruim: tenta de novo */
          }
          timer = setTimeout(ler, 300)
        }
        ler()
      } catch {
        if (vivo) setErro('Não deu para abrir a câmera. Confira a permissão ou digite o código.')
      }
    })()
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((x) => x.stop())
    }
  }, [onLer])
  return (
    <Janela aberta titulo={t('Ler código')} onFechar={onFechar} rodape={<Botao variante="leve" className="w-full" onClick={onFechar}>{t('Fechar')}</Botao>}>
      {erro ? <p className="text-sm text-[var(--ruim)]">{t(erro)}</p> : (
        <div className="space-y-2">
          <video ref={video} className={cx('aspect-video w-full rounded-xl bg-black object-cover')} muted playsInline />
          <p className="text-center text-sm text-[var(--suave)]">{t('Aponte para a etiqueta do lote (QR ou código de barras).')}</p>
        </div>
      )}
    </Janela>
  )
}
