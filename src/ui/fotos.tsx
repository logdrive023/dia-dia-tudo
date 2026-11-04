// FOTOS DOS LOTES (controle visual): tirar/escolher foto com um toque (a câmera abre direto no celular), reduzir antes
// de guardar (máx. 1600 px JPEG + miniatura de ~240 px para as listas), miniatura do lote em qualquer lista (com
// "sem foto" e a medida quando não tem), VISOR em tela cheia (deslizar/setas entre as fotos, pinçar ou dois toques
// para ampliar, legenda com a origem e a data, fecha no Esc ou no "voltar" do celular) e o bloco de fotos do lote.

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { novoId } from '../core/domain/ids'
import type { CategoriaAnexo, Id } from '../core/domain/tipos'
import type { FotoLote, FotoResumo } from '../core/services/fotos'
import { Carregando, cx, dataBR, TituloSecao } from './base'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'

// ---------- reduzir e guardar ----------

const carregarImagem = async (arquivo: Blob) => createImageBitmap(arquivo)

function desenhar(img: ImageBitmap, max: number) {
  const escala = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * escala))
  canvas.height = Math.max(1, Math.round(img.height * escala))
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Prepara a foto antes de guardar: a grande (máx. 1600 px, JPEG 0,8; fica a original se já for menor) e a miniatura
 * (~240 px, JPEG 0,7, em data URL) que as listas mostram sem baixar o arquivo. Não é imagem (ou o aparelho não
 * consegue ler): guarda como veio, sem miniatura.
 */
export async function prepararFoto(arquivo: Blob, max = 1600, mini = 240): Promise<{ arquivo: Blob; miniatura?: string }> {
  if (!arquivo.type.startsWith('image/') || typeof createImageBitmap !== 'function') return { arquivo }
  try {
    const img = await carregarImagem(arquivo)
    const grande = desenhar(img, max)
    const blob = await new Promise<Blob | null>((r) => grande.toBlob(r, 'image/jpeg', 0.8))
    const miniatura = desenhar(img, mini).toDataURL('image/jpeg', 0.7)
    img.close?.()
    return { arquivo: blob && blob.size < arquivo.size ? blob : arquivo, miniatura: miniatura.startsWith('data:image/') ? miniatura : undefined }
  } catch {
    return { arquivo }
  }
}

/** Guarda fotos/arquivos de um registro (lote, compra…): reduz, anexa e grava a miniatura. Devolve quantas entraram. */
export function useEnviarFotos() {
  const t = useT()
  const { backend, avisar } = useApp()
  const [enviando, setEnviando] = useState(false)
  const enviar = useCallback(
    async (donoId: Id, arquivos: File[], categoria: CategoriaAnexo = 'produto', aviso = true) => {
      if (!arquivos.length) return 0
      setEnviando(true)
      let n = 0
      try {
        for (const f of arquivos) {
          const { arquivo, miniatura } = await prepararFoto(f)
          const id = novoId()
          await backend.anexar({ id, donoId, categoria, nome: f.name || `foto-${id.slice(-6)}.jpg`, arquivo })
          if (miniatura) await backend.comando('definirMiniatura', { id, miniatura }).catch(() => undefined)
          n++
        }
        if (aviso) avisar(n === 1 ? t('Foto guardada.') : t('{n} fotos guardadas.', { n }), 'ok')
      } catch (e) {
        avisar(e instanceof Error ? e.message : String(e), 'erro')
      } finally {
        setEnviando(false)
      }
      return n
    },
    [backend, avisar, t],
  )
  return { enviar, enviando }
}

/**
 * Abre a câmera (celular: direto, traseira) ou a galeria SEM precisar de um botão de arquivo na tela: serve para
 * menus "⋯" e para tocar no "sem foto" de uma lista. Tem que ser chamado dentro do toque (o navegador exige).
 */
export function useTirarFoto() {
  const { enviar, enviando } = useEnviarFotos()
  const tirar = useCallback(
    (donoId: Id, o: { galeria?: boolean; categoria?: CategoriaAnexo } = {}) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      if (o.galeria) input.multiple = true
      else input.setAttribute('capture', 'environment')
      input.style.display = 'none'
      input.onchange = () => {
        const fs = [...(input.files ?? [])]
        input.remove()
        void enviar(donoId, fs, o.categoria ?? 'produto')
      }
      document.body.appendChild(input)
      input.click()
    },
    [enviar],
  )
  return { tirar, enviando }
}

const parar = (e: React.SyntheticEvent) => e.stopPropagation()

/** Botões "📷 Tirar foto" (câmera direto) e "🖼 Galeria" (várias de uma vez). compacto = só o ícone da câmera. */
export function BotoesFoto({ donoId, categoria = 'produto', compacto, semGaleria, className }: { donoId: Id; categoria?: CategoriaAnexo; compacto?: boolean; semGaleria?: boolean; className?: string }) {
  const t = useT()
  const { enviar, enviando } = useEnviarFotos()
  const pegar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = [...(e.target.files ?? [])]
    e.target.value = ''
    void enviar(donoId, fs, categoria)
  }
  const estilo = (principal: boolean) =>
    cx(
      'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl text-sm font-semibold focus-within:ring-2 focus-within:ring-[var(--marca)] focus-within:ring-offset-2',
      principal ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]',
      compacto ? 'min-w-10 px-2' : 'px-3',
      enviando && 'cursor-wait opacity-60',
    )
  return (
    <span className={cx('inline-flex flex-wrap gap-2', className)} onClick={parar} onKeyDown={parar}>
      <label className={estilo(!compacto)} title={t('Tirar foto')} aria-disabled={enviando}>
        <span aria-hidden>📷</span>
        {compacto ? <span className="sr-only">{t('Tirar foto')}</span> : enviando ? t('Enviando…') : t('Tirar foto')}
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={enviando} onChange={pegar} />
      </label>
      {!semGaleria && !compacto && (
        <label className={estilo(false)} aria-disabled={enviando}>
          <span aria-hidden>🖼</span> {t('Galeria')}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={enviando} onChange={pegar} />
        </label>
      )}
    </span>
  )
}

// ---------- miniatura ----------

/** URL da foto: a miniatura guardada (na hora) ou o arquivo (busca uma vez). cheia = sempre o arquivo. */
export function useUrlFoto(foto?: Pick<FotoResumo, 'id' | 'miniatura'>, cheia = false) {
  const { backend } = useApp()
  const [url, setUrl] = useState<string>()
  const id = foto?.id
  const precisa = !!id && (cheia || !foto?.miniatura)
  useEffect(() => {
    setUrl(undefined)
    if (!precisa || !id) return
    let vivo = true
    backend.urlDoAnexo(id).then((u) => vivo && setUrl(u)).catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [backend, id, precisa])
  return cheia ? url ?? foto?.miniatura : foto?.miniatura ?? url
}

const TAMANHOS = { xs: 'h-8 w-8 text-[9px]', sm: 'h-10 w-10 text-[10px]', md: 'h-14 w-14 text-xs', ficha: 'h-16 w-16 text-sm', lg: 'h-24 w-24 text-sm' } as const

/** Texto do lugar da foto quando não tem: a medida ("60") ou as iniciais do nome. */
export function marcadorLote(campos?: Record<string, unknown>, nome?: string) {
  const med = campos?.comprimento
  if (med !== undefined && med !== null && med !== '') return String(med)
  return (nome ?? '').split(/[\s·]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}

/**
 * MINIATURA de um lote em qualquer lista: com foto → toque abre o visor (todas as fotos do lote, próprias e herdadas);
 * sem foto → mostra a medida e um "sem foto" discreto, e o toque abre a CÂMERA (celular) para tirar a primeira.
 * Foto herdada (da compra ou do lote de origem) ganha um ↑ no canto.
 */
export function MiniaturaLote({ itemId, foto, marcador, tamanho = 'md', semCamera, className, iconeSemFoto }: { itemId: Id; foto?: FotoResumo; marcador?: string; tamanho?: keyof typeof TAMANHOS; semCamera?: boolean; className?: string; /** sem foto: só um ícone neutro de câmera (sem número nem "sem foto") */ iconeSemFoto?: boolean }) {
  const t = useT()
  const url = useUrlFoto(foto)
  const [ver, setVer] = useState(false)
  const { tirar, enviando } = useTirarFoto()
  const base = cx('relative shrink-0 overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--fundo)]', TAMANHOS[tamanho], className)
  if (!foto) {
    const conteudo = iconeSemFoto ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-[var(--suave)] opacity-70" aria-hidden>
        <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      </svg>
    ) : (
      <>
        <span className="num block font-black leading-none text-[var(--texto)]">{marcador ?? '?'}</span>
        {tamanho !== 'xs' && <span className="mt-0.5 block whitespace-nowrap text-[8px] font-semibold uppercase leading-none text-[var(--suave)]">{enviando ? '…' : t('sem foto')}</span>}
      </>
    )
    if (semCamera) return <span className={cx(base, 'flex flex-col items-center justify-center')} title={t('Sem foto')}>{conteudo}</span>
    return (
      <button type="button" className={cx(base, 'flex flex-col items-center justify-center border-dashed hover:border-[var(--marca)]')} title={t('Tirar a primeira foto deste lote')} aria-label={t('Tirar a primeira foto deste lote')} disabled={enviando} onClick={(e) => (e.stopPropagation(), tirar(itemId))} onKeyDown={parar}>
        {conteudo}
      </button>
    )
  }
  return (
    <>
      <button type="button" className={cx(base, 'hover:ring-2 hover:ring-[var(--marca)]')} title={foto.propria ? t('Ver fotos') : `${t('Ver fotos')} · ${textoOrigem(foto, t)}`} aria-label={t('Ver fotos')} onClick={(e) => (e.stopPropagation(), setVer(true))} onKeyDown={parar}>
        {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-[var(--borda)]" />}
        {!foto.propria && <span aria-hidden className="absolute right-0.5 top-0.5 rounded bg-black/60 px-0.5 text-[9px] font-bold leading-tight text-white">↑</span>}
      </button>
      {ver && <VisorFotos itemId={itemId} onFechar={() => setVer(false)} />}
    </>
  )
}

/** "da compra P-0003" / "do lote L-0001" / "deste lote", traduzido. */
export function textoOrigem(f: Pick<FotoResumo, 'origem' | 'propria'>, t: ReturnType<typeof useT>) {
  if (f.propria || !f.origem) return t('deste lote')
  const c = f.origem.codigo ?? f.origem.id.slice(-4).toUpperCase()
  return f.origem.tipo === 'compra' ? t('da compra {c}', { c }) : t('do lote {c}', { c })
}

// ---------- visor em tela cheia ----------

/** "voltar" do celular fecha o visor (e não a tela de trás): engole o próximo popstate quando o visor fecha sozinho. */
let engolir = 0
let instalado = false
function instalarEngolir() {
  if (instalado || typeof window === 'undefined') return
  instalado = true
  window.addEventListener(
    'popstate',
    (e) => {
      if (engolir > 0) {
        engolir--
        e.stopImmediatePropagation()
      }
    },
    true,
  )
}

type FotoVisor = Pick<FotoLote, 'id' | 'miniatura' | 'nome' | 'em' | 'propria' | 'origem'>

/**
 * VISOR: tela cheia, preto. Deslizar ou setas (← →) entre as fotos; pinçar, dois toques ou a lupa para ampliar (e
 * arrastar); legenda com a origem ("da compra P-0003") e a data; fecha no ×, no Esc ou no "voltar" do celular.
 * Com itemId busca as fotos do lote (próprias + herdadas) e oferece "Tirar foto" deste lote.
 */
export function VisorFotos({ fotos: dadas, itemId, inicio = 0, onFechar, titulo }: { fotos?: FotoVisor[]; itemId?: Id; inicio?: number; onFechar(): void; titulo?: ReactNode }) {
  const t = useT()
  const { dados } = useConsulta('fotosDoLote', { itemId: itemId ?? '' }, !dadas && !!itemId)
  const fotos: FotoVisor[] = dadas ?? dados?.fotos ?? []
  const [k, setK] = useState(inicio)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const atual = fotos[Math.min(k, Math.max(0, fotos.length - 1))]
  const url = useUrlFoto(atual, true)
  const { tirar, enviando } = useTirarFoto()
  const { executar, ocupado } = useComando()
  const [remover, setRemover] = useState(false)
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  const total = useRef(fotos.length)
  total.current = fotos.length
  const ir = useCallback((d: number) => {
    setK((x) => (total.current ? (x + d + total.current) % total.current : 0))
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])
  // Esc, setas e o "voltar" do navegador/celular
  useEffect(() => {
    instalarEngolir()
    let pelaHistoria = false
    let empurrou = false
    // um passo no histórico (o "voltar" fecha o visor); depois de um instante: o StrictMode monta e desmonta na hora
    const timer = setTimeout(() => {
      try {
        history.pushState({ visorFotos: true }, '', location.href)
        empurrou = true
      } catch {
        /* sem histórico (teste): só Esc e × */
      }
    }, 0)
    const voltar = (e: PopStateEvent) => {
      if (engolir > 0 || !empurrou) return
      e.stopImmediatePropagation()
      pelaHistoria = true
      fechar.current()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (e.stopPropagation(), fechar.current())
      else if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('popstate', voltar, true)
    window.addEventListener('keydown', tecla, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      window.removeEventListener('popstate', voltar, true)
      window.removeEventListener('keydown', tecla, true)
      document.body.style.overflow = overflow
      if (empurrou && !pelaHistoria && (history.state as { visorFotos?: boolean } | null)?.visorFotos) {
        engolir++
        history.back()
      }
    }
  }, [ir])
  // gestos: deslizar (sem zoom), pinçar (2 dedos), arrastar (com zoom), dois toques
  const pontos = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<{ dist?: number; zoom: number; x: number; y: number; pan: { x: number; y: number }; t: number }>()
  const ultimoToque = useRef(0)
  const distancia = () => {
    const [a, b] = [...pontos.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : undefined
  }
  const down = (e: React.PointerEvent) => {
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    gesto.current = { dist: distancia(), zoom, x: e.clientX, y: e.clientY, pan, t: Date.now() }
  }
  const move = (e: React.PointerEvent) => {
    if (!pontos.current.has(e.pointerId) || !gesto.current) return
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const d = distancia()
    if (d && gesto.current.dist) setZoom(Math.min(4, Math.max(1, (gesto.current.zoom * d) / gesto.current.dist)))
    else if (zoom > 1) setPan({ x: gesto.current.pan.x + e.clientX - gesto.current.x, y: gesto.current.pan.y + e.clientY - gesto.current.y })
  }
  const up = (e: React.PointerEvent) => {
    const g = gesto.current
    pontos.current.delete(e.pointerId)
    if (!g || pontos.current.size) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (zoom <= 1.05 && !g.dist && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) ir(dx < 0 ? 1 : -1)
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - g.t < 300) {
      if (Date.now() - ultimoToque.current < 300) alternarZoom()
      ultimoToque.current = Date.now()
    }
    if (zoom <= 1.05) (setZoom(1), setPan({ x: 0, y: 0 }))
    gesto.current = undefined
  }
  const alternarZoom = () => {
    setZoom((z) => (z > 1 ? 1 : 2.5))
    setPan({ x: 0, y: 0 })
  }
  const legenda = atual ? [itemId || !atual.propria ? textoOrigem(atual, t) : undefined, dataBR(atual.em)].filter(Boolean).join(' · ') : ''
  const conteudo = (
    <div role="dialog" aria-modal="true" aria-label={t('Fotos')} className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={() => fechar.current()} aria-label={t('Fechar')} className="h-11 w-11 shrink-0 rounded-full text-2xl hover:bg-white/15">×</button>
        <div className="min-w-0 flex-1">
          {titulo && <div className="truncate text-sm font-bold">{titulo}</div>}
          {fotos.length > 0 && <div className="num text-xs text-white/70">{Math.min(k, fotos.length - 1) + 1} / {fotos.length}</div>}
        </div>
        {fotos.length > 0 && <button type="button" onClick={alternarZoom} aria-label={t(zoom > 1 ? 'Diminuir' : 'Ampliar')} className="h-11 w-11 shrink-0 rounded-full text-lg hover:bg-white/15">{zoom > 1 ? '－' : '🔍'}</button>}
        {/* remover: só a foto que é DESTE registro (a herdada da compra se remove lá) */}
        {atual && (atual.propria || !itemId) && <button type="button" disabled={ocupado} onClick={() => setRemover(true)} aria-label={t('Remover esta foto')} title={t('Remover esta foto')} className="h-11 w-11 shrink-0 rounded-full text-lg hover:bg-white/15">🗑</button>}
        {itemId && <button type="button" disabled={enviando} onClick={() => tirar(itemId)} className="min-h-11 shrink-0 rounded-full bg-white/15 px-3 text-sm font-semibold hover:bg-white/25">📷 <span className="hidden sm:inline">{t('Tirar foto')}</span><span className="sr-only sm:hidden">{t('Tirar foto')}</span></button>}
      </div>
      {remover && atual && (
        // confirmação no próprio visor (2 toques): fica no histórico como "Anexo removido"
        <div role="alertdialog" aria-label={t('Remover esta foto')} className="mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 p-3 text-sm">
          <span className="min-w-0 flex-1">{t('Remover esta foto? Fica no histórico.')}</span>
          <button type="button" onClick={() => setRemover(false)} className="min-h-10 rounded-xl px-3 font-semibold hover:bg-white/15">{t('Não')}</button>
          <button type="button" disabled={ocupado} onClick={async () => { if (await executar('removerAnexo', { id: atual.id }, t('Foto removida.'))) { setRemover(false); if (fotos.length <= 1) fechar.current(); else ir(0) } }} className="min-h-10 rounded-xl bg-[var(--ruim)] px-3 font-semibold text-white">{t('Sim, remover')}</button>
        </div>
      )}
      <div
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={alternarZoom}
      >
        {!atual ? (
          !dadas && itemId && !dados ? <Carregando /> : <p className="p-6 text-center text-white/80">{t('Este lote ainda não tem foto.')}</p>
        ) : url ? (
          <img src={url} alt={atual.nome} draggable={false} className="max-h-full max-w-full object-contain transition-transform duration-75" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />
        ) : (
          <Carregando />
        )}
        {fotos.length > 1 && (
          <>
            <button type="button" aria-label={t('Foto anterior')} onClick={(e) => (e.stopPropagation(), ir(-1))} onPointerDown={parar} className="absolute left-1 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-black/40 text-2xl hover:bg-white/20">‹</button>
            <button type="button" aria-label={t('Próxima foto')} onClick={(e) => (e.stopPropagation(), ir(1))} onPointerDown={parar} className="absolute right-1 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-black/40 text-2xl hover:bg-white/20">›</button>
          </>
        )}
      </div>
      {atual && (
        <div className="space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-sm"><b>{legenda}</b></p>
          {fotos.length > 1 && (
            <div className="flex justify-center gap-1 overflow-x-auto">
              {fotos.map((f, j) => (
                <button key={f.id} type="button" aria-label={`${t('Foto')} ${j + 1}`} aria-current={j === k} onClick={() => (setK(j), setZoom(1), setPan({ x: 0, y: 0 }))} className={cx('h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2', j === k ? 'border-white' : 'border-transparent opacity-60')}>
                  {f.miniatura ? <img src={f.miniatura} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-white/20" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
  return typeof document === 'undefined' ? conteudo : createPortal(conteudo, document.body)
}

// ---------- bloco de fotos do lote ----------

/** FOTOS DO LOTE (prontuário): as próprias primeiro, depois as herdadas com a origem; câmera e galeria a um toque. */
export function FotosDoLote({ itemId, codigo }: { itemId: Id; codigo?: string }) {
  const t = useT()
  const { dados } = useConsulta('fotosDoLote', { itemId })
  const [ver, setVer] = useState<number>()
  if (!dados) return <Carregando />
  const proprias = dados.fotos.filter((f) => f.propria)
  const herdadas = dados.fotos.filter((f) => !f.propria)
  const grade = (fs: FotoLote[], desde: number) => (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {fs.map((f, j) => (
        <li key={f.id} className="min-w-0">
          <MiniaturaFoto foto={f} onAbrir={() => setVer(desde + j)} />
          <p className="mt-0.5 truncate text-[11px] text-[var(--suave)]" title={`${textoOrigem(f, t)} · ${dataBR(f.em)}`}>{f.propria ? dataBR(f.em) : textoOrigem(f, t)}</p>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="space-y-3">
      <BotoesFoto donoId={itemId} />
      {!dados.fotos.length && <p className="text-sm text-[var(--suave)]">{t('Sem foto ainda. Uma foto ajuda a achar e conferir o lote no dia a dia.')}</p>}
      {proprias.length > 0 && grade(proprias, 0)}
      {herdadas.length > 0 && (
        <div>
          <TituloSecao className="mb-1">↑ {t('Herdadas da origem')}</TituloSecao>
          {grade(herdadas, proprias.length)}
        </div>
      )}
      {ver !== undefined && <VisorFotos fotos={[...proprias, ...herdadas]} itemId={itemId} inicio={ver} titulo={codigo} onFechar={() => setVer(undefined)} />}
    </div>
  )
}

/** Uma foto quadrada clicável (usa a miniatura; sem ela, busca o arquivo). */
export function MiniaturaFoto({ foto, onAbrir, className }: { foto: Pick<FotoResumo, 'id' | 'miniatura'>; onAbrir(): void; className?: string }) {
  const t = useT()
  const url = useUrlFoto(foto)
  return (
    <button type="button" onClick={onAbrir} aria-label={t('Ver foto')} className={cx('block aspect-square w-full overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--fundo)] hover:ring-2 hover:ring-[var(--marca)]', className)}>
      {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-[var(--borda)]" />}
    </button>
  )
}

/** Botão discreto "Tirar foto" para usar como texto (cartões que pedem foto). */
export function LinkTirarFoto({ itemId, children }: { itemId: Id; children: ReactNode }) {
  const { tirar, enviando } = useTirarFoto()
  return (
    <button type="button" disabled={enviando} onClick={(e) => (e.stopPropagation(), tirar(itemId))} className="min-h-8 rounded-lg text-left font-semibold underline decoration-dotted underline-offset-2 hover:text-[var(--marca)]">
      {children}
    </button>
  )
}

