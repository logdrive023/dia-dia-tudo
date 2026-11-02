// ETIQUETAS DOS LOTES: código grande, QR (abre o lote quando lido pela câmera do app ou do celular), medida · categoria ·
// cor, peso, data e a foto. Uma ou várias; dois tamanhos: pequena (50 × 30 mm, impressora de etiqueta) ou folha A4
// (grade de 3 × 7, etiquetas de 63,5 × 38,1 mm). Abre por cima da tela e imprime só as etiquetas (@media print).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Id } from '../core/domain/tipos'
import type { Etiqueta } from '../core/services/fotos'
import { Botao, Carregando, Escolha, Erro, dataBR, fmt } from './base'
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

const TAM = {
  pequena: { w: 50, h: 30, qr: 22, foto: 10, codigo: 5.2, texto: 2.4 },
  a4: { w: 63.5, h: 38.1, qr: 26, foto: 13, codigo: 6, texto: 2.8 },
} as const

function UmaEtiqueta({ e, tamanho }: { e: Etiqueta; tamanho: TamanhoEtiqueta }) {
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
        {linha && <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{linha}</div>}
        <div className="flex items-end justify-between" style={{ gap: '1mm' }}>
          <div className="min-w-0">
            <div className="num" style={{ fontWeight: 700 }}>{peso}</div>
            <div style={{ color: '#444', overflowWrap: 'anywhere' }}>{dataBR(e.data)}{e.compras ? ` · ${e.compras}` : ''}</div>
          </div>
          {foto && <img src={foto} alt="" className="shrink-0 object-cover" style={{ width: `${s.foto}mm`, height: `${s.foto}mm`, borderRadius: '1mm' }} />}
        </div>
      </div>
      <style>{`.etiqueta svg{width:${s.qr}mm;height:${s.qr}mm}`}</style>
    </div>
  )
}

/** Tela de impressão por cima de tudo: escolher o tamanho, ver como fica e imprimir (só as etiquetas saem no papel). */
export function ImprimirEtiquetas({ ids, onFechar }: { ids: Id[]; onFechar(): void }) {
  const t = useT()
  const [tamanho, setTamanho] = useState<TamanhoEtiqueta>(ids.length > 4 ? 'a4' : 'pequena')
  const { dados, erro } = useConsulta('etiquetas', { ids })
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
        <Escolha rotulo="Tamanho" valor={tamanho} onChange={(v) => setTamanho(v as TamanhoEtiqueta)} opcoes={[{ id: 'pequena', nome: '50 × 30 mm' }, { id: 'a4', nome: 'Folha A4' }]} />
        <Botao disabled={!dados} onClick={() => window.print()}>🖨 {t('Imprimir')}</Botao>
      </div>
      <div className="folha min-h-0 flex-1 overflow-auto p-3">
        {erro ? <Erro texto={erro} /> : !dados ? <Carregando /> : (
          <div className={tamanho === 'pequena' ? 'pequena grade flex flex-wrap gap-2' : 'grade grid w-max max-w-full gap-1 [grid-template-columns:repeat(auto-fill,63.5mm)] print:[grid-template-columns:repeat(3,63.5mm)]'}>
            {dados.map((e) => <UmaEtiqueta key={e.id} e={e} tamanho={tamanho} />)}
          </div>
        )}
        <p className="nao-imprimir mt-3 text-xs text-[var(--suave)]">{t('O QR abre o lote: pelo “Ler código” do Estoque ou pela câmera de qualquer celular.')}</p>
      </div>
    </div>
  )
  return createPortal(conteudo, document.body)
}
