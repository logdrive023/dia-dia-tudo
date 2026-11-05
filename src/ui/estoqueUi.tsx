// Peças da tela de ESTOQUE: situação do lote em cor, barra "para onde foi cada grama", leitor de código pela câmera
// e o aviso de tela larga (tabela) × estreita (cartões).

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { brilho, decodificar } from './leitorImagem'
import { BarraPartes } from './barras'
import type { StatusLote } from '../core/services/estoque'
import { Botao, Janela, Pilula, cx, gramasTexto } from './base'
import { useT } from './i18n'
import { useApp } from './contexto'
import { lerEnderecoQr } from './etiquetas'

export const STATUS_LOTE: Record<StatusLote, { nome: string; tom: 'bom' | 'alerta' | 'neutro' | 'marca' }> = {
  disponivel: { nome: 'Disponível', tom: 'bom' },
  parcial: { nome: 'Parcial', tom: 'marca' },
  bruto: { nome: 'Bruto · para separar', tom: 'alerta' },
  naoIdentificado: { nome: 'Não identificado', tom: 'alerta' },
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
      <BarraPartes altura="h-4" total={base} partes={partes.map((p) => ({ chave: p.nome, valor: p.valor, cor: p.cor }))} rotulo={partes.map((p) => `${t(p.nome)} ${gramasTexto(p.valor)}`).join(', ')} />
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

/** o navegador lê QR/código de barras pela câmera (Chrome no Android, por exemplo) */
export const temDetectorCodigo = () => typeof window !== 'undefined' && 'BarcodeDetector' in window

/** O botão da câmera aparece SEMPRE: o leitor próprio (jsQR) lê em qualquer navegador com câmera. */
export const temLeitorCodigo = () => true

/** o que a câmera deste aparelho deixa controlar (lanterna e zoom), quando deixa */
type Capacidades = { torch?: boolean; zoom?: { min: number; max: number; step?: number } }

/**
 * LER CÓDIGO PELA CÂMERA — feito para o balcão de verdade (etiqueta com tinta fraca, pouca luz, reflexo, papel ruim):
 *   · câmera traseira em ALTA resolução e foco contínuo; 🔦 LANTERNA e ZOOM quando o celular deixa
 *   · DOIS leitores: o do navegador (rápido, lê também código de barras) e o próprio (jsQR, em qualquer navegador,
 *     com realce de contraste e suavização para etiqueta desbotada e foto escura)
 *   · lê o QUADRADO do meio primeiro (mais detalhe onde a pessoa mira) e a imagem inteira de vez em quando
 *   · DICAS na hora: pouca luz → "ligue a lanterna"; demorou → "aproxime, incline para tirar o reflexo"
 *   · e sempre dá para DIGITAR o código (o código está impresso na etiqueta, embaixo do QR)
 * QR da ETIQUETA do lote (…#/lotes/<id>): abre o lote direto (abrirLote=false: devolve o texto, ex.: a venda adiciona).
 */
/** o que a tela respondeu a uma leitura (modo contínuo): aparece na lista de dentro do leitor */
export interface RespostaLeitura { ok: boolean; texto: string }

/**
 * `continuo`: a câmera NÃO fecha a cada código — lê um atrás do outro (o mesmo código lido de novo em poucos segundos é
 * ignorado), mostra embaixo o que entrou ("✓ L-0002 · 1,2 kg" / "✗ já saiu") e "Concluir (N)" volta para a tela.
 * Para isso `onLer` devolve a resposta da tela. Sem `continuo`: lê um e a tela decide (fecha ou abre o lote).
 */
export function LeitorCodigo({ onLer: onLerTexto, onFechar, abrirLote = true, continuo }: { onLer(codigo: string): void | RespostaLeitura; onFechar(): void; abrirLote?: boolean; continuo?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const [lidos, setLidos] = useState<(RespostaLeitura & { id: number; codigo: string })[]>([])
  const ref = useRef({ onLerTexto, onFechar, ir, abrirLote, continuo, ultimo: undefined as { c: string; em: number } | undefined, n: 0 })
  Object.assign(ref.current, { onLerTexto, onFechar, ir, abrirLote, continuo })
  /** devolve true quando a leitura conta (contínuo: o mesmo código seguido não conta de novo) */
  const onLer = useCallback((texto: string) => {
    const r = ref.current
    const agora = Date.now()
    if (r.continuo && r.ultimo?.c === texto && agora - r.ultimo.em < 3000) return false
    r.ultimo = { c: texto, em: agora }
    try { navigator.vibrate?.(40) } catch { /* sem vibração */ }
    const lido = lerEnderecoQr(texto)
    if (lido && r.abrirLote && !r.continuo) return (r.onFechar(), lido.qr ? r.ir('qr', { id: lido.qr }) : r.ir('lote', { id: lido.id! }), true)
    const resp = r.onLerTexto(texto)
    if (r.continuo && resp) setLidos((ls) => [{ ...resp, id: ++r.n, codigo: texto }, ...ls].slice(0, 30))
    return true
  }, [])
  const video = useRef<HTMLVideoElement>(null)
  const trilha = useRef<MediaStreamTrack>()
  const [erro, setErro] = useState<string>()
  const [caps, setCaps] = useState<Capacidades>({})
  const [lanterna, setLanterna] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [dica, setDica] = useState<'escuro' | 'demora' | undefined>()
  const [digitado, setDigitado] = useState('')
  useEffect(() => {
    let stream: MediaStream | undefined
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const inicio = Date.now()
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmera')
        // alta resolução + foco contínuo (se o aparelho não aceitar, cai para o simples)
        const pedir = (v: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video: v, audio: false })
        stream = await pedir({ facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
          .catch(() => pedir({ facingMode: 'environment' }))
        // fechou enquanto a câmera ligava (ex.: na pergunta de permissão): desliga a câmera que acabou de abrir
        if (!vivo || !video.current) return stream.getTracks().forEach((x) => x.stop())
        const tr = stream.getVideoTracks()[0]
        trilha.current = tr
        const c = (tr?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number; step?: number } }
        setCaps({ torch: !!c.torch, zoom: c.zoom && c.zoom.max > (c.zoom.min ?? 1) ? { min: c.zoom.min ?? 1, max: c.zoom.max, step: c.zoom.step } : undefined })
        video.current.srcObject = stream
        await video.current.play()
        const Ctor = temDetectorCodigo() ? (window as unknown as { BarcodeDetector: new (o?: object) => Detector }).BarcodeDetector : undefined
        let detector: Detector | undefined
        try { detector = Ctor ? new Ctor({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] }) : undefined } catch { detector = Ctor ? new Ctor() : undefined }
        const tela = document.createElement('canvas')
        const ctx2d = tela.getContext('2d', { willReadFrequently: true })
        let volta = 0
        const ler = async () => {
          const v = video.current
          if (!vivo || !v) return
          volta++
          try {
            // 1) o leitor do navegador (rápido; lê código de barras também)
            if (detector) {
              const r = await detector.detect(v)
              if (r[0]?.rawValue && vivo && (onLer(r[0].rawValue.trim()), !ref.current.continuo)) return
            }
            // 2) o leitor próprio: o QUADRADO do meio (onde a pessoa mira) e, a cada 4 voltas, a imagem inteira
            if (ctx2d && v.videoWidth) {
              const inteiro = volta % 4 === 0
              const lado = Math.min(v.videoWidth, v.videoHeight) * (inteiro ? 1 : 0.7)
              const sx = inteiro ? 0 : (v.videoWidth - lado) / 2
              const sy = inteiro ? 0 : (v.videoHeight - lado) / 2
              const sw = inteiro ? v.videoWidth : lado
              const sh = inteiro ? v.videoHeight : lado
              const escala = Math.min(1, 800 / Math.max(sw, sh))
              tela.width = Math.round(sw * escala)
              tela.height = Math.round(sh * escala)
              ctx2d.drawImage(v, sx, sy, sw, sh, 0, 0, tela.width, tela.height)
              const img = ctx2d.getImageData(0, 0, tela.width, tela.height)
              const texto = decodificar(img.data, tela.width, tela.height)
              if (texto && vivo && (onLer(texto), !ref.current.continuo)) return
              // dicas: pouca luz (brilho baixo) e demora
              if (volta % 6 === 0) setDica(brilho(img.data) < 60 ? 'escuro' : Date.now() - inicio > 5000 ? 'demora' : undefined)
            }
          } catch {
            /* quadro ruim: tenta de novo */
          }
          timer = setTimeout(ler, 160)
        }
        ler()
      } catch {
        if (vivo) setErro('Não deu para abrir a câmera. Confira a permissão — ou digite o código da etiqueta abaixo.')
      }
    })()
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((x) => x.stop())
    }
  }, [onLer])
  const aplicar = (c: MediaTrackConstraintSet) => { try { void trilha.current?.applyConstraints({ advanced: [c] }) } catch { /* o aparelho não deixou */ } }
  const trocarLanterna = () => { const v = !lanterna; setLanterna(v); aplicar({ torch: v } as MediaTrackConstraintSet) }
  const trocarZoom = (z: number) => { setZoom(z); aplicar({ zoom: z } as MediaTrackConstraintSet) }
  const zooms = caps.zoom ? [1, 2, 3].filter((z) => z >= caps.zoom!.min && z <= caps.zoom!.max) : []
  const enviar = () => { const c = digitado.trim(); if (c) (ref.current.ultimo = undefined, onLer(c), setDigitado('')) }
  const certos = lidos.filter((x) => x.ok).length
  return (
    <Janela aberta titulo={t(continuo ? 'Ler vários códigos' : 'Ler código')} onFechar={onFechar} rodape={continuo
      ? <Botao grande className="w-full" onClick={onFechar}>{certos ? t('Concluir · {n} adicionado(s)', { n: certos }) : t('Concluir')}</Botao>
      : <Botao variante="leve" className="w-full" onClick={onFechar}>{t('Fechar')}</Botao>}>
      <div className="space-y-3">
        {erro ? <p className="rounded-xl bg-[var(--ruim)]/10 p-3 text-sm text-[var(--ruim)]">{t(erro)}</p> : (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
            {/* o QUADRADO onde mirar (é onde o leitor olha primeiro) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative aspect-square w-[62%] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,.35)]">
                {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => <span key={c} className={cx('absolute h-8 w-8 border-white', c)} />)}
              </div>
            </div>
            {/* lanterna e zoom (quando o celular deixa) */}
            {(caps.torch || zooms.length > 1) && (
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
                {caps.torch && <button type="button" aria-pressed={lanterna} onClick={trocarLanterna} className={cx('min-h-10 rounded-full px-4 text-sm font-semibold backdrop-blur', lanterna ? 'bg-yellow-300 text-black' : 'bg-black/55 text-white')}>🔦 {t(lanterna ? 'Lanterna ligada' : 'Lanterna')}</button>}
                {zooms.length > 1 && zooms.map((z) => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => trocarZoom(z)} className={cx('min-h-10 min-w-10 rounded-full px-3 text-sm font-bold backdrop-blur', zoom === z ? 'bg-white text-black' : 'bg-black/55 text-white')}>{z}×</button>)}
              </div>
            )}
          </div>
        )}
        {!erro && (
          <p className={cx('rounded-xl px-3 py-2 text-center text-sm', dica ? 'bg-[var(--alerta)]/12 font-semibold' : 'text-[var(--suave)]')}>
            {dica === 'escuro'
              ? (caps.torch ? t('Pouca luz: ligue a 🔦 lanterna.') : t('Pouca luz: chegue perto de uma luz ou aproxime a etiqueta.'))
              : dica === 'demora' ? t('Não está lendo? Ponha o QR inteiro dentro do quadrado, segure firme e incline um pouco para tirar o reflexo do plástico.')
                : t(continuo ? 'Mire um QR de cada vez: cada um entra na venda e a câmera continua para o próximo.' : 'Mire o QR da etiqueta no quadrado.')}
          </p>
        )}
        {/* CONTÍNUO: o que já foi lido (o mais novo em cima), para conferir sem sair da câmera */}
        {continuo && lidos.length > 0 && (
          <ul aria-live="polite" className="max-h-40 divide-y divide-[var(--borda)] overflow-y-auto rounded-xl border border-[var(--borda)] text-sm">
            {lidos.map((x) => (
              <li key={x.id} className={cx('flex items-center gap-2 px-3 py-2', !x.ok && 'bg-[var(--ruim)]/8')}>
                <span aria-hidden className={cx('font-bold', x.ok ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{x.ok ? '✓' : '✗'}</span>
                <span className="min-w-0 flex-1 truncate">{x.texto}</span>
              </li>
            ))}
          </ul>
        )}
        {/* último recurso: o código impresso na etiqueta */}
        <div className="flex gap-2">
          <input aria-label={t('Digitar o código')} placeholder={t('Ou digite o código (ex.: L-0022)')} value={digitado} onChange={(e) => setDigitado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), enviar())}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 font-mono outline-none focus:border-[var(--marca)]" />
          <Botao disabled={!digitado.trim()} onClick={enviar}>OK</Botao>
        </div>
      </div>
    </Janela>
  )
}
