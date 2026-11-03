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
import { Botao, Carregando, Escolha, Erro, Info, dataBR, fmt } from './base'
import { caminhoCode128 } from './code128'
import { useConsulta } from './contexto'
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
            <div style={{ color: '#444', overflowWrap: 'anywhere' }}>{dataBR(e.data)}{e.compras ? ` · ${e.compras}` : ''}</div>
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
      <div className="mt-2 text-sm">{[linha, fmt(e.saldo, e.unidade === 'grama' ? 'gramas' : 'numero'), dataBR(e.data), e.compras].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

/**
 * Tela de impressão por cima de tudo: escolher o tamanho e o tipo, ver como fica e imprimir (só as etiquetas saem no
 * papel). `modo` vem da compra/triagem quando ela escolheu; senão vale o de Configurações › Códigos.
 */
export function ImprimirEtiquetas({ ids, onFechar, modo: modoInicial }: { ids: Id[]; onFechar(): void; modo?: ModoEtiqueta }) {
  const t = useT()
  const [tamanho, setTamanho] = useState<TamanhoEtiqueta>(ids.length > 4 ? 'a4' : 'pequena')
  const { dados, erro } = useConsulta('etiquetas', { ids })
  const { dados: modoPadrao } = useConsulta('modoEtiqueta', {}, !modoInicial)
  const [escolhido, setModo] = useState<ModoEtiqueta>()
  const modo = escolhido ?? modoInicial ?? modoPadrao ?? 'qr'
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
        <Botao disabled={!dados} onClick={() => window.print()}>🖨 {t('Imprimir')}</Botao>
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
