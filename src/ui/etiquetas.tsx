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
import { Botao, Campo, Carregando, Entrada, Escolha, Erro, Info, Janela, cx, dataBR, fmt, loc, BotaoExpandir } from './base'
import { caminhoCode128 } from './code128'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'
import { caminhoQR, gerarQR } from './qr'
import { useUrlFoto } from './fotos'
import { useLembrado } from './filtros'

export type TamanhoEtiqueta = 'pequena' | 'a4' | 'livre'

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

/** Medidas de uma etiqueta (mm). Tudo sai da largura × altura: QR, letra, foto e código de barras acompanham. */
export interface MedidasEtiqueta { w: number; h: number; qr: number; foto: number; codigo: number; texto: number; barras: number }
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
export function medidasEtiqueta(w: number, h: number): MedidasEtiqueta {
  // etiqueta baixa (tag enrolada no pacote, < 25 mm): o QR ocupa mais da largura e o texto fica só com o código
  const qr = Math.max(8, Math.min(h - 3, w * (h < 25 ? 0.6 : 0.45)))
  return { w, h, qr, foto: h >= 25 ? limitar(h * 0.34, 8, 18) : 0, codigo: limitar(h * 0.17, 3, 9), texto: limitar(h * 0.08, 1.8, 3.4), barras: limitar(h * 0.15, 3.5, 9) }
}
/** QR menor que isso: a câmera do celular pode não ler (impressora térmica de 203 dpi ≈ 3 pontos por quadradinho). */
export const QR_MINIMO_MM = 15
const TAM: Record<'pequena' | 'a4', MedidasEtiqueta> = {
  pequena: { w: 50, h: 30, qr: 22, foto: 10, codigo: 5.2, texto: 2.4, barras: 4.5 },
  a4: { w: 63.5, h: 38.1, qr: 26, foto: 13, codigo: 6, texto: 2.8, barras: 6 },
}

function UmaEtiqueta({ e, s, barras }: { e: Etiqueta; s: MedidasEtiqueta; barras: boolean }) {
  const t = useT()
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
        {barras && <Barras texto={e.codigo} className="barras block w-full" style={{ height: `${s.barras}mm` }} />}
        {linha && <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{linha}</div>}
        <div className="flex items-end justify-between" style={{ gap: '1mm' }}>
          <div className="min-w-0">
            <div className="num" style={{ fontWeight: 700 }}>{peso}</div>
            <div style={{ color: '#444', overflowWrap: 'anywhere' }}>{dataBR(e.data)}{e.compras ? ` · ${e.compras}` : ''}{e.via ? <b style={{ color: '#000' }}> · {t('{n}ª via', { n: e.via })}</b> : null}</div>
          </div>
          {foto && s.foto > 0 && <img src={foto} alt="" className="shrink-0 object-cover" style={{ width: `${s.foto}mm`, height: `${s.foto}mm`, borderRadius: '1mm' }} />}
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

/** Folha A4 de etiquetas (tipo Pimaco 6180/A4256): 3 colunas × 7 linhas de 63,5 × 38,1 mm = 21 por folha. */
export const POR_FOLHA_A4 = 21
/** Máximo por impressão (acima disso o navegador do celular trava ao montar a impressão): 10 folhas A4 ou 200 do rolo. */
export const LIMITE_IMPRESSAO: Record<TamanhoEtiqueta, number> = { a4: POR_FOLHA_A4 * 10, pequena: 200, livre: 200 }
const MAX_COPIAS = 50
const AJUDA_PAPEL = 'Rolo: 1 etiqueta de 50 × 30 mm por vez (impressora de etiqueta). Folha A4: 21 por folha (3 × 7, etiquetas de 63,5 × 38,1 mm). Ex.: 25 etiquetas = 2 folhas (21 + 4).'
const AJUDA_INICIO = 'Para usar uma folha que já foi usada: toque na primeira etiqueta livre. Ex.: sobraram 10 → comece na 12.'
const AJUDA_COPIAS = 'Quantas etiquetas de cada pacote. Ex.: 2× para uma no pacote e outra no saco.'

/** − [n] + (cópias); alvos de toque de 40 px. */
function Contador({ valor, onChange, min = 0, max = MAX_COPIAS, rotulo }: { valor: number; onChange(n: number): void; min?: number; max?: number; rotulo: string }) {
  const t = useT()
  const botao = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-[var(--marca)] hover:bg-[var(--marca-suave)] disabled:opacity-30'
  return (
    <div role="group" aria-label={t(rotulo)} className="inline-flex shrink-0 items-center rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
      <button type="button" className={botao} aria-label={t('Menos')} disabled={valor <= min} onClick={() => onChange(Math.max(min, valor - 1))}>−</button>
      <input type="text" inputMode="numeric" aria-label={t(rotulo)} className="num h-10 w-10 bg-transparent text-center font-bold outline-none" value={valor}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min) }} />
      <button type="button" className={botao} aria-label={t('Mais')} disabled={valor >= max} onClick={() => onChange(Math.min(max, valor + 1))}>+</button>
    </div>
  )
}

/** Largura (px) disponível para a prévia: a folha A4 (210 mm) é reduzida para caber na tela. */
function useLargura() {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!el) return
    setW(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w] as const
}

const MM = 96 / 25.4

/**
 * Tela de impressão por cima de tudo, no visual do sistema: à esquerda (embaixo no celular) o que imprimir — tipo,
 * papel, cópias de cada pacote, onde começar na folha — e à direita a prévia de cada folha como vai sair. O rodapé diz
 * "25 etiquetas · 2 folhas (21 + 4)" e o limite por vez. Só as etiquetas saem no papel (@media print).
 * `modo` vem da compra/triagem quando ela escolheu; senão vale o de Configurações › Códigos.
 */
export function ImprimirEtiquetas({ ids, onFechar, modo: modoInicial, onImpresso }: { ids: Id[]; onFechar(): void; modo?: ModoEtiqueta; onImpresso?(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const { executar } = useComando()
  const [papelLembrado, setPapel] = useLembrado<TamanhoEtiqueta | ''>('etiquetas.papel', '')
  const tamanho: TamanhoEtiqueta = papelLembrado || (ids.length > 4 ? 'a4' : 'pequena')
  // "Outro tamanho": largura × altura digitadas (lembradas no aparelho); o rolo 50 × 30 usa as medidas fixas
  const [largLivre, setLargLivre] = useLembrado('etiquetas.largura', 50)
  const [altLivre, setAltLivre] = useLembrado('etiquetas.altura', 30)
  const medRolo = tamanho === 'livre' ? medidasEtiqueta(largLivre, altLivre) : TAM.pequena
  const { dados, erro } = useConsulta('etiquetas', { ids })
  const { dados: modoPadrao } = useConsulta('modoEtiqueta', {}, !modoInicial)
  const [escolhido, setModo] = useState<ModoEtiqueta>()
  const [impresso, setImpresso] = useState(false)
  const [copias, setCopias] = useState<Record<Id, number>>({})
  const [inicio, setInicio] = useState(1)
  const [verInicio, setVerInicio] = useState(false)
  const [verLista, setVerLista] = useState(ids.length <= 6)
  const [refPrevia, largura] = useLargura()
  const modo = escolhido ?? modoInicial ?? modoPadrao ?? 'qr'
  const a4 = modo !== 'nenhuma' && tamanho === 'a4'
  const qrPequeno = modo !== 'nenhuma' && tamanho === 'livre' && medRolo.qr < QR_MINIMO_MM
  const copiasDe = (id: Id) => copias[id] ?? 1
  const todasIguais = (dados ?? []).every((e) => copiasDe(e.id) === copiasDe(dados![0].id))
  const cada = dados?.length ? copiasDe(dados[0].id) : 1
  const fila = (dados ?? []).flatMap((e) => Array.from({ length: copiasDe(e.id) }, () => e))
  const total = fila.length
  const limite = LIMITE_IMPRESSAO[tamanho]
  const passou = modo !== 'nenhuma' && total > limite
  const comeco = a4 ? inicio - 1 : 0
  const folhas = a4 ? Math.ceil((comeco + total) / POR_FOLHA_A4) : 0
  const naUltima = a4 && total ? (comeco + total) % POR_FOLHA_A4 || POR_FOLHA_A4 : 0
  const sobram = a4 && total ? POR_FOLHA_A4 - naUltima : 0
  const paginas = a4 ? Array.from({ length: folhas }, (_, k) => Array.from({ length: POR_FOLHA_A4 }, (_, j) => fila[k * POR_FOLHA_A4 + j - comeco])) : []
  const escala = largura ? Math.min(1, (largura - 2) / (210 * MM)) : 0.5
  const pacotes = (dados ?? []).filter((e) => copiasDe(e.id) > 0).length

  // mandou imprimir: o lote sai de Etiquetas › "Sem etiqueta" (fica "impressa em 03/11 por Paula")
  const imprimir = async () => {
    window.print()
    if (sessao.perfil !== 'admin') return
    const feitos = ids.filter((id) => copiasDe(id) > 0)
    if (feitos.length && (await executar('marcarEtiquetasImpressas', { ids: feitos }))) (setImpresso(true), onImpresso?.())
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  // "2 folhas A4 (21 + 4)": quantas etiquetas em cada folha
  const resumoFolhas = !a4 ? '' : folhas <= 1 ? t('1 folha A4') : t('{n} folhas A4 ({a})', { n: folhas, a: paginas.map((v) => v.filter(Boolean).length).join(' + ') })
  const pagina = tamanho === 'a4' ? '@page{size:A4;margin:0}' : `@page{size:${medRolo.w}mm ${medRolo.h}mm;margin:0}`
  const secao = 'rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm'
  const conteudo = (
    <div id="etiquetas-impressao" role="dialog" aria-modal="true" aria-label={t('Imprimir etiquetas')} className="fixed inset-0 z-[60] flex flex-col bg-[var(--fundo)] text-[var(--texto)]">
      <style>{`${pagina}
@media print{
  body>*:not(#etiquetas-impressao){display:none!important}
  #etiquetas-impressao{position:static!important;background:#fff!important;overflow:visible!important;display:block!important}
  #etiquetas-impressao .nao-imprimir{display:none!important}
  #etiquetas-impressao .folha,#etiquetas-impressao .previa{padding:0!important;margin:0!important;overflow:visible!important;border:none!important;background:none!important;box-shadow:none!important;display:block!important}
  #etiquetas-impressao .escala{width:auto!important;height:auto!important;overflow:visible!important}
  #etiquetas-impressao .escala>div{transform:none!important}
  #etiquetas-impressao .grade{gap:0!important}
  #etiquetas-impressao .etiqueta{border:none!important}
  #etiquetas-impressao .vaga{border:none!important}
  #etiquetas-impressao .pagina-a4{box-shadow:none!important;margin:0!important;break-after:page}
  #etiquetas-impressao .pagina-a4:last-child{break-after:auto}
  #etiquetas-impressao .pequena .etiqueta{break-after:page}
}`}</style>
      {/* topo: voltar · título · quantas */}
      <header className="nao-imprimir flex items-center gap-2 border-b border-[var(--borda)] bg-[var(--cartao)] px-3 py-2">
        <Botao variante="leve" onClick={onFechar}>← {t('Voltar')}</Botao>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">🏷 {t('Etiquetas')}</h2>
          <p className="num truncate text-xs text-[var(--suave)]">{t('{p} pacote(s) · {n} etiqueta(s)', { p: pacotes, n: total })}</p>
        </div>
      </header>

      <div className="folha min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 p-3 md:flex-row md:items-start">
          {/* o que imprimir */}
          <div className="nao-imprimir flex w-full flex-col gap-3 md:sticky md:top-0 md:w-80 md:shrink-0 lg:w-96">
            <section className={secao}>
              <h3 className="mb-2 flex items-center text-sm font-bold">{t('Tipo de etiqueta')}<Info texto={AJUDA_TIPO_ETIQUETA} /></h3>
              <Escolha rotulo="Tipo de etiqueta" valor={modo} onChange={(v) => setModo(v as ModoEtiqueta)} opcoes={TIPOS_ETIQUETA} />
            </section>
            {modo !== 'nenhuma' && (
              <section className={secao}>
                <h3 className="mb-2 flex items-center text-sm font-bold">{t('Papel')}<Info texto={AJUDA_PAPEL} /></h3>
                <Escolha rotulo="Papel" valor={tamanho} onChange={(v) => (setPapel(v as TamanhoEtiqueta), setInicio(1))} opcoes={[{ id: 'pequena', nome: 'Rolo 50 × 30' }, { id: 'a4', nome: 'Folha A4' }, { id: 'livre', nome: 'Outro tamanho' }]} />
                {tamanho === 'livre' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block text-sm font-semibold text-[var(--suave)]">{t('Largura (mm)')}
                      <Entrada inputMode="decimal" value={String(largLivre)} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) setLargLivre(Math.min(200, Math.max(0, n))) }} />
                    </label>
                    <label className="block text-sm font-semibold text-[var(--suave)]">{t('Altura (mm)')}
                      <Entrada inputMode="decimal" value={String(altLivre)} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) setAltLivre(Math.min(200, Math.max(0, n))) }} />
                    </label>
                  </div>
                )}
                <p className="num mt-2 text-xs text-[var(--suave)]">{t(tamanho === 'a4' ? '21 por folha (3 × 7) · até {n} por vez' : '1 por etiqueta do rolo · até {n} por vez', { n: limite })}</p>
                {tamanho === 'livre' && (
                  <p role={qrPequeno ? 'alert' : undefined} className={cx('num mt-1 text-xs font-semibold', qrPequeno ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>
                    {qrPequeno ? `⚠️ ${t('QR com {n} mm: pequeno, a câmera pode não ler. Use etiqueta com pelo menos 18 mm de altura.', { n: medRolo.qr.toFixed(0) })}` : `✓ ${t('QR com {n} mm: a câmera lê.', { n: medRolo.qr.toFixed(0) })}`}
                  </p>
                )}
                {a4 && (
                  <div className="mt-2">
                    {/* fechado: "Começar na etiqueta 1 · Mudar"; aberto: a folha em miniatura (toque na primeira livre) */}
                    <p className="flex items-center text-sm font-semibold text-[var(--suave)]">
                      {t('Começar na etiqueta')} <b className="num ml-1 text-[var(--texto)]">{inicio}</b><Info texto={AJUDA_INICIO} />
                      <button type="button" aria-expanded={verInicio} onClick={() => setVerInicio(!verInicio)} className="ml-auto min-h-10 rounded-lg px-2 text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t(verInicio ? 'Fechar' : 'Mudar')}</button>
                    </p>
                    {verInicio && <div role="radiogroup" aria-label={t('Começar na etiqueta')} className="grid w-max grid-cols-3 gap-1 rounded-lg bg-[var(--fundo)] p-1">
                      {Array.from({ length: POR_FOLHA_A4 }, (_, k) => (
                        <button key={k} type="button" role="radio" aria-checked={inicio === k + 1} aria-label={String(k + 1)} onClick={() => setInicio(k + 1)}
                          className={cx('num h-6 w-10 rounded text-[10px] font-semibold', k + 1 < inicio ? 'bg-transparent text-[var(--suave)] line-through' : k + 1 === inicio ? 'bg-[var(--marca)] text-white' : 'bg-[var(--cartao)] text-[var(--suave)]')}>{k + 1}</button>
                      ))}
                    </div>}
                  </div>
                )}
              </section>
            )}
            <section className={secao}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center text-sm font-bold">{t('Cópias de cada')}<Info texto={AJUDA_COPIAS} /></h3>
                <Contador rotulo="Cópias de cada" min={1} valor={todasIguais ? Math.max(1, cada) : 1} onChange={(n) => setCopias(Object.fromEntries((dados ?? []).map((e) => [e.id, n])))} />
              </div>
              {!todasIguais && <p className="mt-1 text-xs text-[var(--alerta)]">{t('Cada pacote com a sua quantidade (abaixo).')}</p>}
              {(dados?.length ?? 0) > 1 && (
                <BotaoExpandir aberto={verLista} onClick={() => setVerLista(!verLista)} className="-ml-2 mt-2">{t('Ajustar por pacote ({n})', { n: dados!.length })}</BotaoExpandir>
              )}
              {verLista && dados && dados.length > 1 && (
                <ul className="mt-1 max-h-72 divide-y divide-[var(--borda)] overflow-auto rounded-xl border border-[var(--borda)]">
                  {dados.map((e) => (
                    <li key={e.id} className={cx('flex items-center gap-2 px-2 py-1', !copiasDe(e.id) && 'opacity-50')}>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate font-mono text-sm">{e.codigo}</b>
                        <span className="num block truncate text-xs text-[var(--suave)]">{[e.medida, fmt(e.saldo, e.unidade === 'grama' ? 'gramas' : 'numero')].filter(Boolean).join(' · ')}</span>
                      </span>
                      <Contador rotulo={`${t('Cópias')} ${e.codigo}`} valor={copiasDe(e.id)} onChange={(n) => setCopias({ ...Object.fromEntries(dados.map((x) => [x.id, copiasDe(x.id)])), [e.id]: n })} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* prévia: como vai sair no papel */}
          <div ref={refPrevia} className="previa min-w-0 flex-1">
            <p className="nao-imprimir mb-2 text-sm font-semibold text-[var(--suave)]">{t('Como vai sair')}</p>
            {erro ? <Erro texto={erro} /> : !dados ? <Carregando /> : !total ? (
              <p className="nao-imprimir rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nenhuma etiqueta: aumente as cópias de algum pacote.')}</p>
            ) : modo === 'nenhuma' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {dados.filter((e) => copiasDe(e.id) > 0).map((e) => <CodigoAMao key={e.id} e={e} />)}
              </div>
            ) : a4 ? (
              <div className="space-y-3">
                {paginas.map((vagas, k) => (
                  <div key={k} className="escala overflow-hidden" style={{ width: 210 * MM * escala, height: 297 * MM * escala }}>
                    <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: '210mm' }}>
                      <div className="pagina-a4 bg-white shadow-md" style={{ width: '210mm', height: '297mm', padding: '15.15mm 9.75mm', boxSizing: 'border-box' }}>
                        <div className="grade grid" style={{ gridTemplateColumns: 'repeat(3,63.5mm)', gridAutoRows: '38.1mm' }}>
                          {vagas.map((e, j) => (e ? <UmaEtiqueta key={j} e={e} s={TAM.a4} barras={modo === 'qrBarras'} /> : <div key={j} className="vaga" style={{ border: '0.2mm dashed #e5e5e5' }} />))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pequena grade flex flex-wrap gap-2">
                {fila.map((e, k) => <UmaEtiqueta key={k} e={e} s={medRolo} barras={modo === 'qrBarras'} />)}
              </div>
            )}
            <p className="nao-imprimir mt-3 text-xs text-[var(--suave)]">{t(modo === 'nenhuma' ? 'Escreva o código no pacote: a busca acha o pacote pelo código.' : modo === 'qrBarras' ? 'O QR abre o lote pela câmera; o código de barras é lido pelo leitor de balcão, que digita o código na busca.' : 'O QR abre o lote: pelo “Ler código” do Estoque ou pela câmera de qualquer celular.')}</p>
          </div>
        </div>
      </div>

      {/* rodapé: quanto sai e o botão */}
      <footer className="nao-imprimir border-t border-[var(--borda)] bg-[var(--cartao)] px-3 py-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
          <div className="num min-w-0 flex-1 text-sm">
            <b>{t('{n} etiqueta(s)', { n: total })}</b>
            {a4 && total > 0 && <span className="text-[var(--suave)]"> · {resumoFolhas}{sobram > 0 ? ` · ${t('sobram {n} na última', { n: sobram })}` : ''}</span>}
            {passou && <span role="alert" className="block font-semibold text-[var(--ruim)]">{t('Máximo {n} por vez: diminua as cópias ou imprima em partes.', { n: limite })}</span>}
            {impresso && <span role="status" className="block font-semibold text-[var(--bom)]">✓ {t('Marcadas como impressas')}</span>}
          </div>
          <Botao grande className="shrink-0" disabled={!dados || !total || passou} onClick={imprimir}>🖨 {t(impresso ? 'Imprimir de novo' : 'Imprimir')}</Botao>
        </div>
      </footer>
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
/**
 * VER A ETIQUETA de um pacote que já tem etiqueta: a etiqueta como ela saiu no papel (QR, código, medida, peso), quando
 * e por quem foi impressa e quantas vias; embaixo, "Imprimir de novo" e "Errou? Gerar nova". É o que abre no "Ver
 * etiqueta" (⋯ da triagem e do estoque, botão 🏷 do pacote).
 */
export function VerEtiqueta({ id, onFechar, admin }: { id: Id; onFechar(): void; admin?: boolean }) {
  const t = useT()
  const { dados } = useConsulta('etiquetas', { ids: [id] })
  const { dados: modo } = useConsulta('modoEtiqueta', {})
  const { dados: ficha } = useConsulta('fichaItem', { id })
  const [imprimir, setImprimir] = useState(false)
  const [refazer, setRefazer] = useState(false)
  const e = dados?.[0]
  const i = ficha?.item
  if (imprimir) return <ImprimirEtiquetas ids={[id]} onImpresso={() => setImprimir(false)} onFechar={() => setImprimir(false)} />
  if (refazer) return <RefazerEtiqueta id={id} codigo={i?.codigo} onFechar={() => setRefazer(false)} />
  return (
    <Janela aberta titulo={`🏷 ${t('Etiqueta')} ${i?.codigo ?? ''}`} onFechar={onFechar}
      rodape={admin && <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="leve" onClick={() => setRefazer(true)}>↻ {t('Errou? Gerar nova')}</Botao>
        <Botao onClick={() => setImprimir(true)}>🖨 {t('Imprimir de novo')}</Botao>
      </div>}>
      <div className="space-y-3">
        <div className="flex justify-center overflow-x-auto rounded-xl bg-[var(--fundo)] p-4">
          {e ? <UmaEtiqueta e={e} s={TAM.pequena} barras={modo === 'qrBarras'} /> : <span className="text-sm text-[var(--suave)]">{t('Carregando…')}</span>}
        </div>
        {i && (
          <p className="num flex flex-wrap items-center gap-1.5 text-sm">
            {i.etiquetaImpressaEm
              ? <span className="rounded-full bg-[var(--bom)]/12 px-2.5 py-1 font-semibold text-[var(--bom)]">✓ {i.etiquetaImpressaPor ? t('impressa em {d} por {p}', { d: diaMesEtiqueta(i.etiquetaImpressaEm), p: i.etiquetaImpressaPor }) : t('impressa em {d}', { d: diaMesEtiqueta(i.etiquetaImpressaEm) })}</span>
              : <span className="rounded-full bg-[var(--alerta)]/15 px-2.5 py-1 font-semibold text-[var(--alerta)]">🏷 {t('Sem etiqueta')}</span>}
            {(i.etiquetaVia ?? 1) > 1 && <span className="rounded-full bg-[var(--fundo)] px-2.5 py-1 ring-1 ring-[var(--borda)]">{t('{n}ª via', { n: i.etiquetaVia! })}</span>}
          </p>
        )}
        <p className="text-xs text-[var(--suave)]">{t('O peso na etiqueta é o de agora. Mudou o peso ou rasgou? "Imprimir de novo"; saiu errada? "Errou? Gerar nova" (a antiga deixa de valer).')}</p>
      </div>
    </Janela>
  )
}

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
