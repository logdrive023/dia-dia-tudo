// ETIQUETAS DOS LOTES: código grande, QR (abre o lote quando lido pela câmera do app ou do celular), medida · categoria ·
// cor, peso, data e a foto. Uma ou várias; dois tamanhos: pequena (50 × 30 mm, impressora de etiqueta) ou folha A4
// (grade de 3 × 7, etiquetas de 63,5 × 38,1 mm). Abre por cima da tela e imprime só as etiquetas (@media print).
// Tipo (Configurações › Códigos, trocável em cada impressão): QR + código de barras (Code 128, leitor "pistola"), só QR
// (celular) ou sem etiqueta (o código aparece grande para escrever à mão).

import { type CSSProperties, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Id } from '../core/domain/tipos'
import type { Etiqueta } from '../core/services/fotos'
import type { ModoEtiqueta } from '../core/services/codigos'
import { Botao, Campo, Carregando, Entrada, Escolha, Erro, Info, Janela, cx, dataBR, fmt, loc } from './base'
import { caminhoCode128 } from './code128'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'
import { caminhoQR, gerarQR } from './qr'
import { useUrlFoto } from './fotos'

export type TamanhoEtiqueta = 'pequena' | 'a4'

/** O que vai no QR: o endereço do lote neste app (o leitor da câmera abre o lote; outro celular abre o app nele). */
export function enderecoDoLote(id: Id) {
  const base = typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`
  return `${base}#/lotes/${encodeURIComponent(id)}`
}

/** Lê um texto vindo do leitor: endereço de lote (…#/lotes/<id>) → id do lote; senão undefined. */
export function loteDoCodigoLido(texto: string): Id | undefined {
  const m = /#\/lotes\/([^?#/\s]+)/.exec(texto.trim())
  return m ? decodeURIComponent(m[1]) : undefined
}

export function QR({ texto, className }: { texto: string; className?: string }) {
  const { d, lado } = caminhoQR(gerarQR(texto, 'M'))
  return (
    <svg viewBox={`0 0 ${lado} ${lado}`} className={className} role="img" aria-label="QR" shapeRendering="crispEdges">
      <rect width={lado} height={lado} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

/** Código de barras Code 128 do código do lote (o leitor "pistola" digita o código na busca). */
export function Barras({ texto, className, style }: { texto: string; className?: string; style?: CSSProperties }) {
  const { d, largura, altura } = caminhoCode128(texto)
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" className={className} style={style} role="img" aria-label={`Code 128 ${texto}`} shapeRendering="crispEdges">
      <rect width={largura} height={altura} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

export const TIPOS_ETIQUETA: { id: ModoEtiqueta; nome: string }[] = [
  { id: 'qrBarras', nome: 'QR + barras' },
  { id: 'qr', nome: 'Só QR' },
  { id: 'nenhuma', nome: 'Sem etiqueta' },
]
export const AJUDA_TIPO_ETIQUETA = 'QR + barras: para leitor de balcão. Só QR: para celular. Sem etiqueta: escreva o código à mão. Ex.: tag presa com elástico no pacote.'

const TAM = {
  pequena: { w: 50, h: 30, qr: 22, foto: 10, codigo: 5.2, texto: 2.4 },
  a4: { w: 63.5, h: 38.1, qr: 26, foto: 13, codigo: 6, texto: 2.8 },
} as const

function UmaEtiqueta({ e, tamanho, barras }: { e: Etiqueta; tamanho: TamanhoEtiqueta; barras: boolean }) {
  const t = useT()
  const s = TAM[tamanho]
  const foto = useUrlFoto(e.foto)
  const linha = [e.medida, e.categoria ? t(e.categoria) : undefined, e.cor ? t(e.cor) : undefined].filter(Boolean).join(' · ')
  const peso = fmt(e.saldo, e.unidade === 'grama' ? 'gramas' : 'numero')
  // código grande numa linha só: diminui a letra se o código for comprido (largura do texto ≈ 0,62 × letra × n)
  const largura = s.w - s.qr - 4.5
  const tamCodigo = Math.min(s.codigo, largura / (0.62 * Math.max(1, e.codigo.length)))
  return (
    <div className="etiqueta flex overflow-hidden bg-white text-black" style={{ width: `${s.w}mm`, height: `${s.h}mm`, padding: '1.5mm', gap: '1.5mm', border: '0.2mm dashed #bbb', boxSizing: 'border-box', breakInside: 'avoid' }}>
      <QR texto={enderecoDoLote(e.id)} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col justify-between" style={{ fontSize: `${s.texto}mm`, lineHeight: 1.15 }}>
        <b className="font-mono" style={{ fontSize: `${tamCodigo}mm`, lineHeight: 1, whiteSpace: 'nowrap' }}>{e.codigo}</b>
        {barras && <Barras texto={e.codigo} className="barras block w-full" style={{ height: `${tamanho === 'pequena' ? 4.5 : 6}mm` }} />}
        {linha && <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{linha}</div>}
        <div className="flex items-end justify-between" style={{ gap: '1mm' }}>
          <div className="min-w-0">
            <div className="num" style={{ fontWeight: 700 }}>{peso}</div>
            <div style={{ color: '#444', overflowWrap: 'anywhere' }}>{dataBR(e.data)}{e.compras ? ` · ${e.compras}` : ''}{e.via ? <b style={{ color: '#000' }}> · {t('{n}ª via', { n: e.via })}</b> : null}</div>
          </div>
          {foto && <img src={foto} alt="" className="shrink-0 object-cover" style={{ width: `${s.foto}mm`, height: `${s.foto}mm`, borderRadius: '1mm' }} />}
        </div>
      </div>
      <style>{`.etiqueta svg:not(.barras){width:${s.qr}mm;height:${s.qr}mm}`}</style>
    </div>
  )
}

/** Sem etiqueta: o código grande na tela, para escrever à mão no pacote. */
function CodigoAMao({ e }: { e: Etiqueta }) {
  const t = useT()
  const linha = [e.medida, e.categoria ? t(e.categoria) : undefined, e.cor ? t(e.cor) : undefined].filter(Boolean).join(' · ')
  return (
    <div className="etiqueta rounded-2xl border border-[var(--borda)] bg-white p-4 text-black" style={{ breakInside: 'avoid' }}>
      <b className="block break-all font-mono text-5xl leading-none">{e.codigo}</b>
      <div className="mt-2 text-sm">{[linha, fmt(e.saldo, e.unidade === 'grama' ? 'gramas' : 'numero'), dataBR(e.data), e.compras, e.via ? t('{n}ª via', { n: e.via }) : ''].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

/**
 * Tela de impressão por cima de tudo: escolher o tamanho e o tipo, ver como fica e imprimir (só as etiquetas saem no
 * papel). `modo` vem da compra/triagem quando ela escolheu; senão vale o de Configurações › Códigos.
 */
export function ImprimirEtiquetas({ ids, onFechar, modo: modoInicial, onImpresso }: { ids: Id[]; onFechar(): void; modo?: ModoEtiqueta; onImpresso?(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const { executar } = useComando()
  const [tamanho, setTamanho] = useState<TamanhoEtiqueta>(ids.length > 4 ? 'a4' : 'pequena')
  const { dados, erro } = useConsulta('etiquetas', { ids })
  const { dados: modoPadrao } = useConsulta('modoEtiqueta', {}, !modoInicial)
  const [escolhido, setModo] = useState<ModoEtiqueta>()
  const [impresso, setImpresso] = useState(false)
  const modo = escolhido ?? modoInicial ?? modoPadrao ?? 'qr'
  // mandou imprimir: o lote sai de Etiquetas › "Sem etiqueta" (fica "impressa em 03/11 por Paula")
  const imprimir = async () => {
    window.print()
    if (sessao.perfil !== 'admin') return
    if (await executar('marcarEtiquetasImpressas', { ids })) (setImpresso(true), onImpresso?.())
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  const pagina = tamanho === 'pequena' ? '@page{size:50mm 30mm;margin:0}' : '@page{size:A4;margin:10mm 7mm}'
  const conteudo = (
    <div id="etiquetas-impressao" role="dialog" aria-modal="true" aria-label={t('Imprimir etiquetas')} className="fixed inset-0 z-[60] flex flex-col bg-[var(--fundo)]">
      <style>{`${pagina}
@media print{
  body>*:not(#etiquetas-impressao){display:none!important}
  #etiquetas-impressao{position:static!important;background:#fff!important;overflow:visible!important}
  #etiquetas-impressao .nao-imprimir{display:none!important}
  #etiquetas-impressao .folha{padding:0!important;overflow:visible!important}
  #etiquetas-impressao .grade{gap:0!important}
  #etiquetas-impressao .etiqueta{border:none!important}
  #etiquetas-impressao .pequena .etiqueta{break-after:page}
}`}</style>
      <div className="nao-imprimir flex flex-wrap items-center gap-2 border-b border-[var(--borda)] bg-[var(--cartao)] p-3">
        <Botao variante="leve" onClick={onFechar}>← {t('Voltar')}</Botao>
        <h2 className="min-w-0 flex-1 font-bold">🏷 {t('{n} etiqueta(s)', { n: ids.length })}</h2>
        <span className="inline-flex items-center">
          <Escolha rotulo="Tipo de etiqueta" valor={modo} onChange={(v) => setModo(v as ModoEtiqueta)} opcoes={TIPOS_ETIQUETA} />
          <Info texto={AJUDA_TIPO_ETIQUETA} />
        </span>
        {modo !== 'nenhuma' && <Escolha rotulo="Tamanho" valor={tamanho} onChange={(v) => setTamanho(v as TamanhoEtiqueta)} opcoes={[{ id: 'pequena', nome: '50 × 30 mm' }, { id: 'a4', nome: 'Folha A4' }]} />}
        <Botao disabled={!dados} onClick={imprimir}>🖨 {t(impresso ? 'Imprimir de novo' : 'Imprimir')}</Botao>
        {impresso && <span role="status" className="text-sm font-semibold text-[var(--bom)]">✓ {t('Marcadas como impressas')}</span>}
      </div>
      <div className="folha min-h-0 flex-1 overflow-auto p-3">
        {erro ? <Erro texto={erro} /> : !dados ? <Carregando /> : modo === 'nenhuma' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dados.map((e) => <CodigoAMao key={e.id} e={e} />)}
          </div>
        ) : (
          <div className={tamanho === 'pequena' ? 'pequena grade flex flex-wrap gap-2' : 'grade grid w-max max-w-full gap-1 [grid-template-columns:repeat(auto-fill,63.5mm)] print:[grid-template-columns:repeat(3,63.5mm)]'}>
            {dados.map((e) => <UmaEtiqueta key={e.id} e={e} tamanho={tamanho} barras={modo === 'qrBarras'} />)}
          </div>
        )}
        <p className="nao-imprimir mt-3 text-xs text-[var(--suave)]">{t(modo === 'nenhuma' ? 'Escreva o código no pacote: a busca acha o pacote pelo código.' : modo === 'qrBarras' ? 'O QR abre o lote pela câmera; o código de barras é lido pelo leitor de balcão, que digita o código na busca.' : 'O QR abre o lote: pelo “Ler código” do Estoque ou pela câmera de qualquer celular.')}</p>
      </div>
    </div>
  )
  return createPortal(conteudo, document.body)
}

/**
 * Depois de separar (a tela volta para o quadro ou para o pacote com ?novos=a,b,c): um cartão no alto com
 * "✓ 3 pacotes novos · [🏷 Imprimir etiquetas] [Depois]". "Depois" fecha e os pacotes ficam em Etiquetas › Sem etiqueta.
 */
export function AvisoPacotesNovos() {
  const t = useT()
  const { nav, ajustarParams, ir, avisar } = useApp()
  const [imprimir, setImprimir] = useState(false)
  const ids = String(nav.params.novos ?? '').split(',').filter(Boolean)
  if (!ids.length) return null
  const fechar = () => ajustarParams({ novos: undefined })
  return (
    <div role="status" className="mb-4 rounded-2xl border border-[var(--bom)]/40 bg-[var(--bom)]/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 pt-2">
          <b className="text-[var(--bom)]">✓ {t(ids.length === 1 ? '1 pacote novo' : '{n} pacotes novos', { n: ids.length })}</b>
          <span className="text-[var(--suave)]"> · {t('sem etiqueta ainda')}</span>
        </p>
        <button type="button" aria-label={t('Fechar')} onClick={fechar} className="-mr-1 -mt-1 h-10 w-10 shrink-0 rounded-xl text-lg hover:bg-[var(--fundo)]">×</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Botao onClick={() => setImprimir(true)}>🏷 {t('Imprimir etiquetas')}</Botao>
        <Botao variante="leve" onClick={() => (fechar(), avisar(t('Ficam em Etiquetas › Sem etiqueta para imprimir depois.')))}>{t('Depois')}</Botao>
        <button type="button" onClick={() => ir('etiquetas')} className="min-h-10 text-xs font-semibold text-[var(--marca)] hover:underline">{t('ficam em Etiquetas para imprimir depois')} ›</button>
      </div>
      {imprimir && <ImprimirEtiquetas ids={ids} onImpresso={fechar} onFechar={() => setImprimir(false)} />}
    </div>
  )
}

const MOTIVOS_REFAZER = ['Saiu errada', 'Borrou/rasgou', 'Perdeu', 'Outro'] as const

/**
 * "Errou? Gerar nova" em 2 toques: o motivo já vem em "Saiu errada" → "Cancelar a antiga e imprimir nova". Grava no
 * histórico (refazerEtiqueta: nova via, mesmo código) e abre a impressão do lote na hora.
 */
export function RefazerEtiqueta({ id, codigo, onFechar }: { id: Id; codigo?: string; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [motivo, setMotivo] = useState<(typeof MOTIVOS_REFAZER)[number]>('Saiu errada')
  const [outro, setOutro] = useState('')
  const [imprimir, setImprimir] = useState(false)
  if (imprimir) return <ImprimirEtiquetas ids={[id]} onFechar={onFechar} />
  const confirmar = async () => {
    const texto = motivo === 'Outro' ? (outro.trim() ? `${t('Outro')}: ${outro.trim()}` : t('Outro')) : t(motivo)
    if (await executar('refazerEtiqueta', { id, motivo: texto })) setImprimir(true)
  }
  return (
    <Janela aberta titulo={`↻ ${t('Errou? Gerar nova')}${codigo ? ` · ${codigo}` : ''}`} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado} onClick={confirmar}>{t('Cancelar a antiga e imprimir nova')}</Botao>
    }>
      <p className="mb-2 text-sm text-[var(--suave)]">{t('O que aconteceu?')}</p>
      <div role="radiogroup" aria-label={t('Motivo')} className="flex flex-wrap gap-2">
        {MOTIVOS_REFAZER.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={motivo === m} onClick={() => setMotivo(m)} className={cx('min-h-10 rounded-full border px-3 text-sm font-semibold', motivo === m ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)]')}>
            {t(m)}
          </button>
        ))}
      </div>
      {motivo === 'Outro' && <div className="mt-3"><Campo rotulo="O que houve? (opcional)"><Entrada value={outro} maxLength={150} placeholder={t('Ex.: medida trocada')} onChange={(e) => setOutro(e.target.value)} /></Campo></div>}
      <p className="mt-3 text-xs text-[var(--suave)]">{t('Fica no histórico do pacote. O código não muda; a nova sai marcada como “2ª via”.')}</p>
    </Janela>
  )
}

/** "03/11" (dia/mês no formato do idioma) */
export const diaMesEtiqueta = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit' })
const pararEv = (e: React.SyntheticEvent) => e.stopPropagation()

/**
 * Situação da etiqueta numa linha (Triagem e listas): "🏷 Sem etiqueta" (âmbar; um toque abre a impressão deste pacote)
 * ou "✓ Etiqueta" (verde discreto; "impressa em 03/11 por Paula · 2ª via" no title).
 */
export function SeloEtiqueta({ id, impressaEm, por, via, className }: { id: Id; impressaEm?: string; por?: string; via?: number; className?: string }) {
  const t = useT()
  const [imprimir, setImprimir] = useState(false)
  const viaTxt = via && via > 1 ? t('{n}ª via', { n: via }) : ''
  if (impressaEm) {
    const quando = por ? t('impressa em {d} por {p}', { d: diaMesEtiqueta(impressaEm), p: por }) : t('impressa em {d}', { d: diaMesEtiqueta(impressaEm) })
    return (
      <span title={[quando, viaTxt].filter(Boolean).join(' · ')} className={cx('inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--bom)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--bom)]', className)}>
        ✓ {t('Etiqueta')}{viaTxt && <span className="ml-1 font-normal">· {viaTxt}</span>}<span className="sr-only"> · {quando}</span>
      </span>
    )
  }
  // o clique não chega na linha (que abre o pacote), nem o que acontece dentro da folha de impressão
  return (
    <span className={cx('inline-flex shrink-0', className)} onClick={pararEv} onKeyDown={pararEv}>
      <button type="button" onClick={() => setImprimir(true)} title={t('Imprimir a etiqueta deste pacote')} className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--alerta)_16%,transparent)] px-2 text-xs font-semibold text-[var(--alerta)] hover:brightness-95">
        🏷 {t('Sem etiqueta')}{viaTxt && <span className="ml-1 font-normal">· {viaTxt}</span>}
      </button>
      {imprimir && <ImprimirEtiquetas ids={[id]} onImpresso={() => setImprimir(false)} onFechar={() => setImprimir(false)} />}
    </span>
  )
}
