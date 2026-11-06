// TRIAGEM › TRIAGENS FEITAS: o histórico das separações (entrou → saiu, perda), cada uma abre no lugar com as
// etiquetas, o rastreio e "desfazer".
import { useState } from 'react'
import { CaminhoDoCabelo } from '../../ui/caminhoCabelo'
import { NumeroGrande, GrupoNumeros } from '../../ui/numeroGrande'
import { formatar } from '../../core/domain/dinheiro'
import type { Id } from '../../core/domain/tipos'
import type { ResultadoConsulta } from '../../core/services'
import { Botao, Campo, Carregando, Confirmar, Entrada, Info, Selecao, cx, dataBR, fmt, gramasTexto, TituloSecao, BotaoExpandir } from '../../ui/base'
import { clicavel } from '../../ui/compartilhados'
import { useApp, useComando, useConsulta, useParamTela } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { CodigoTexto } from '../../ui/codigos'
import { CadeiaChips, RastreioTotal } from '../../ui/rastreioTotal'
import { ImprimirEtiquetas } from '../../ui/etiquetas'
import { GrupoFiltro, FiltroLista, VazioFiltro } from '../../ui/filtroPadrao'
import { type T } from './comum'

type TriagemFeita = ResultadoConsulta<'triagens'>[number]

const ORDENS = [{ id: '', nome: 'Mais recentes' }, { id: 'perda', nome: 'Mais perda (%)' }, { id: 'peso', nome: 'Mais peso' }]

const AJUDA_PERDA = 'Perda = o que entrou − o que saiu. Ex.: 10 kg → 9,6 kg = 400 g (4%).'

/** "o que se busca" de uma triagem: código, quem, compras (código e fornecedor) e pacotes que saíram */
const buscaTriagem = (x: TriagemFeita) => [x.codigo, x.por, ...x.compras.flatMap((c) => [c.codigo, c.fornecedor]), ...x.saidas.map((s) => s.codigo)].filter(Boolean).join(' ').toLowerCase()

/**
 * TRIAGENS FEITAS: números de resumo (do que está filtrado), filtros (período, quem, compra, perda acima de X%,
 * busca, ordenar; tudo no endereço) e UMA linha por triagem — T-0003 · 03/11 · Paula · 10 kg → 9,6 kg · perda 4% ·
 * 3 pacotes · etiquetas. Tocar abre no lugar: compras → pacotes → vendas e o rastreio em gramas.
 */
export function ListaTriagens({ aberta }: { aberta?: string }) {
  const t = useT()
  const { ir, ajustarParams } = useApp()
  const { dados } = useConsulta('triagens', { moduloId: 'cabelo' })
  const [tde, setTde] = useParamTela('tde', '')
  const [tate, setTate] = useParamTela('tate', '')
  const periodo = tde || tate
  const [quem, setQuem] = useParamTela('tq', '')
  const [compra, setCompra] = useParamTela('tc', '')
  const [perdaMin, setPerdaMin] = useParamTela('tperda', '')
  const [busca, setBusca] = useParamTela('tb', '')
  const [ordem, setOrdem] = useParamTela('to', '')
  const [maisFiltros, setMaisFiltros] = useState(!!(quem || compra || perdaMin))
  const [imprimir, setImprimir] = useState<Id[]>()
  if (!dados) return <Carregando />
  if (!dados.length) return <p className="rounded-xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nenhuma triagem ainda. Selecione lotes no quadro e toque em “Separar” ou “Juntar e separar”.')}</p>

  const pessoas = [...new Set(dados.map((x) => x.por).filter((p): p is string => !!p))].sort()
  const termo = busca.trim().toLowerCase()
  const termoCompra = compra.trim().toLowerCase()
  const minBp = perdaMin ? Math.round(Number(perdaMin.replace(',', '.')) * 100) : undefined
  const lista = dados
    .filter((x) =>
      (!tde || x.em.slice(0, 10) >= tde) && (!tate || x.em.slice(0, 10) <= tate) &&
      (!quem || x.por === quem) &&
      (!termoCompra || x.compras.some((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' ').toLowerCase().includes(termoCompra))) &&
      (minBp === undefined || !Number.isFinite(minBp) || x.perdaPct > minBp) &&
      (!termo || buscaTriagem(x).includes(termo)))
    .sort((a, b) => (ordem === 'perda' ? b.perdaPct - a.perdaPct : ordem === 'peso' ? b.pesoEntrada - a.pesoEntrada : 0) || (a.em < b.em ? 1 : -1))
  const entrou = lista.reduce((s, x) => s + x.pesoEntrada, 0)
  const saiu = lista.reduce((s, x) => s + x.pesoSaida, 0)
  const perdaBp = entrou ? Math.round(((entrou - saiu) * 10000) / entrou) : 0
  const ativos = [quem, compra, perdaMin].filter(Boolean).length
  const ativosT = [
    ...(quem ? [{ k: 'tq', rotulo: `👤 ${quem}` }] : []),
    ...(compra ? [{ k: 'tc', rotulo: `🛒 ${compra}` }] : []),
    ...(perdaMin ? [{ k: 'tperda', rotulo: `📉 ${t('perda')} > ${perdaMin}%` }] : []),
  ]
  const limpar = () => ajustarParams({ tde: undefined, tate: undefined, tq: undefined, tc: undefined, tperda: undefined, tb: undefined, to: undefined })

  return (
    <div className="space-y-3">
      {imprimir && <ImprimirEtiquetas ids={imprimir} onFechar={() => setImprimir(undefined)} />}
      {/* resumo do que está filtrado */}
      {/* celular: 2 × 2 (cada número inteiro, sem "41,…"); computador: os 4 numa linha */}
      <GrupoNumeros colunas={4} className="mb-0">
        <NumeroGrande rotulo="Triagens" valor={String(lista.length)} />
        <NumeroGrande rotulo="Entrou" valor={gramasTexto(entrou)} />
        <NumeroGrande rotulo="Saiu" valor={gramasTexto(saiu)} />
        <NumeroGrande rotulo="Perda" ajuda={AJUDA_PERDA} valor={fmt(perdaBp, 'percentual')} sub={gramasTexto(entrou - saiu)} tom={perdaBp > 500 ? 'ruim' : undefined} />
      </GrupoNumeros>

      {/* FILTRO PADRÃO: período em atalhos (no topo) · busca · ⚙ Filtros (quem, compra, perda, ordem) → resultado + chips ✕ */}
      <FiltroLista
        periodo={{ de: tde, ate: tate, onChange: (d, a) => (setTde(d ?? ''), setTate(a ?? '')) }}
        busca={busca} onBusca={setBusca} placeholder="T-0003, compra, fornecedor, pacote…"
        ativos={ativosT} onTirar={(k) => ajustarParams({ [k]: undefined })} onLimpar={limpar} temAtivos={!!(periodo || ativos > 0 || termo || ordem)}
        resultados={lista.length} total={dados.length} unidade="triagem(ns)"
        aberto={maisFiltros} onAberto={setMaisFiltros}
        painel={<>
          <GrupoFiltro titulo="Quem e de onde" icone="👤">
            <Campo rotulo="Quem triou"><Selecao valor={quem} onChange={setQuem} vazio="Todos" opcoes={pessoas.map((p) => ({ id: p, nome: p }))} /></Campo>
            <Campo rotulo="Compra"><Entrada placeholder={t('Ex.: P-0003 ou Maria')} value={compra} onChange={(e) => setCompra(e.target.value)} /></Campo>
          </GrupoFiltro>
          <GrupoFiltro titulo="Perda e ordem" icone="📉">
            <Campo rotulo="Perda acima de (%)"><Entrada inputMode="decimal" placeholder={t('Ex.: 5')} value={perdaMin} onChange={(e) => setPerdaMin(e.target.value.replace(/[^\d,.]/g, ''))} /></Campo>
            <Campo rotulo="Ordenar"><Selecao valor={ordem} onChange={setOrdem} opcoes={ORDENS} /></Campo>
          </GrupoFiltro>
        </>}
      />

      {!lista.length ? (
        <VazioFiltro texto="Nenhuma triagem com esses filtros." filtrando={!!(periodo || ativos > 0 || termo)} onLimpar={limpar} />
      ) : (
        <ul className="space-y-3">
          {lista.map((x) => <LinhaTriagem key={x.id} x={x} aberta={aberta === x.id} t={t} ir={ir} onAlternar={() => ajustarParams({ t: aberta === x.id ? undefined : x.id })} onImprimir={setImprimir} />)}
        </ul>
      )}
    </div>
  )
}

/** Uma triagem numa linha; tocar abre no lugar (compras → pacotes → vendas, etiquetas e rastreio). */
function LinhaTriagem({ x, aberta, t, ir, onAlternar, onImprimir }: { x: TriagemFeita; aberta: boolean; t: T; ir: ReturnType<typeof useApp>['ir']; onAlternar(): void; onImprimir(ids: Id[]): void }) {
  // etiquetas desta separação: '3 de 4 com etiqueta' e imprimir as que faltam (só das que ainda têm peso)
  const faltam = x.saidas.filter((s) => !s.etiquetaImpressaEm && s.saldo > 0)
  const com = x.saidas.filter((s) => s.etiquetaImpressaEm).length
  const fornecedores = [...new Set(x.compras.map((c) => c.fornecedor).filter(Boolean))]
  const rotuloImprimir = t(faltam.length === 1 ? 'Imprimir a que falta' : 'Imprimir as {n} que faltam', { n: faltam.length })
  const [verRastreio, setVerRastreio] = useState(false)
  const corPerda = x.perdaPct > 500 ? 'var(--ruim)' : x.perda > 0 ? 'var(--alerta)' : undefined
  const titulo = (s: string) => <TituloSecao className="mb-1.5">{t(s)}</TituloSecao>
  return (
    // cada triagem é um CARTÃO próprio (espaço entre um e outro): cabeçalho, 3 números e, aberto, seções com título
    <li className={cx('overflow-hidden rounded-2xl border bg-[var(--cartao)] shadow-sm', aberta ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
      <div {...clicavel(onAlternar)} aria-expanded={aberta} className="cursor-pointer px-4 py-3.5 outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
        {/* CABEÇALHO: ícone · código e quando · de quem veio e quem fez · ›  */}
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--marca),color-mix(in_srgb,var(--marca)_70%,#ec4899))] text-lg text-white shadow-sm">✂️</span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-baseline gap-2">
              <b className="font-mono text-base">{x.codigo}</b>
              <span className="num shrink-0 text-xs text-[var(--suave)]">{dataBR(x.em)}</span>
            </span>
            <span className="block truncate text-xs text-[var(--suave)]">{[fornecedores.join(', '), x.por && `${t('por')} ${x.por}`].filter(Boolean).join(' · ') || '—'}</span>
          </span>
          <span aria-hidden className={cx('shrink-0 text-lg text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
        </div>
        {/* O FLUXO: entrou → saiu, a perda em destaque e a barra do que virou pacote × perda */}
        <div className="mt-3 rounded-xl bg-[var(--fundo)] p-3">
          <div className="num flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><span className="block text-[11px] uppercase tracking-wide text-[var(--suave)]">{t('Entrou')}</span><b className="text-lg">{gramasTexto(x.pesoEntrada)}</b></span>
            <span aria-hidden className="text-lg text-[var(--suave)]">→</span>
            <span><span className="block text-[11px] uppercase tracking-wide text-[var(--suave)]">{t('Saiu')}</span><b className="text-lg text-[var(--bom)]">{gramasTexto(x.pesoSaida)}</b></span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `color-mix(in srgb, ${corPerda ?? 'var(--bom)'} 14%, transparent)`, color: corPerda ?? 'var(--bom)' }}>
              {t('perda')} {fmt(x.perdaPct, 'percentual')}{x.perda > 0 && <span className="font-medium opacity-80">· {gramasTexto(x.perda)}</span>}
            </span>
          </div>
          <div aria-hidden className="mt-2 flex h-2 w-full gap-px overflow-hidden rounded-full bg-[var(--cartao)]">
            <span style={{ flexGrow: Math.max(x.pesoSaida, 0), flexBasis: 0, background: 'var(--bom)' }} />
            {x.perda > 0 && <span style={{ flexGrow: x.perda, flexBasis: 0, minWidth: 3, background: corPerda ?? 'var(--alerta)' }} />}
          </div>
        </div>
        {/* O QUE SAIU: os pacotes (códigos) e a situação das etiquetas */}
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-[var(--suave)]">📦 {t('{n} pacote(s)', { n: x.saidas.length })}</span>
          {x.saidas.slice(0, 4).map((s) => <span key={s.id} className="rounded-md bg-[var(--marca-suave)] px-1.5 py-0.5 font-mono font-bold text-[var(--marca)]">{s.codigo ?? '—'}</span>)}
          {x.saidas.length > 4 && <span className="text-[var(--suave)]">+{x.saidas.length - 4}</span>}
          {x.saidas.length > 0 && <span className={cx('ml-auto rounded-full px-2 py-0.5 font-semibold', faltam.length ? 'bg-[var(--alerta)]/12 text-[var(--alerta)]' : 'bg-[var(--bom)]/12 text-[var(--bom)]')}>{faltam.length ? '🏷' : '✓'} {t('{c} de {n} com etiqueta', { c: com, n: x.saidas.length })}</span>}
        </div>
      </div>
      {faltam.length > 0 && (
        <div className="border-t border-[var(--borda)] px-4 py-2">
          <Botao variante="secundario" className="w-full sm:w-auto" onClick={() => onImprimir(faltam.map((s) => s.id))}>🖨 {rotuloImprimir}</Botao>
        </div>
      )}
      {aberta && (
        <div className="space-y-4 border-t border-[var(--borda)] bg-[var(--fundo)] px-4 py-3">
          <CaminhoDoCabelo de={{ triagemId: x.id }} atual="triagem" compacto />
          <section>
            {titulo('Veio de')}
            <CadeiaChips cadeia={{ compras: x.compras, triagens: [], vendas: [] }} max={6} />
          </section>
          <section>
            {titulo('Virou')}
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
              {x.saidas.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => ir('lote', { id: s.id })} className="num flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-[var(--fundo)]">
                    <CodigoTexto codigo={s.codigo} />
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--suave)]">{s.nome}</span>
                    <b className="whitespace-nowrap">{gramasTexto(s.g)}</b>
                    <span aria-label={t(s.etiquetaImpressaEm ? 'Etiqueta' : 'Sem etiqueta')} className={s.etiquetaImpressaEm ? 'text-[var(--bom)]' : 'text-[var(--alerta)]'}>{s.etiquetaImpressaEm ? '✓' : '🏷'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {x.vendasLista.length > 0 && (
            <section>
              {/* cada venda numa linha (como o "Virou"): data, cliente, de quais pacotes, quanto e por quanto; total embaixo */}
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                {titulo('Vendido em')}
                <span className="num text-xs text-[var(--suave)]">{t('{n} venda(s)', { n: x.vendasLista.length })} · <b className="text-[var(--bom)]">{gramasTexto(x.vendasLista.reduce((s, v) => s + v.g, 0))}</b> {t('de {g}', { g: gramasTexto(x.pesoSaida) })}</span>
              </div>
              <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
                {x.vendasLista.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => ir('venda', { id: v.id })} className="num flex min-h-12 w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--fundo)]">
                      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bom)]/15 text-sm">💰</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2"><b className="font-mono text-[var(--bom)]">{v.codigo}</b><span className="text-xs text-[var(--suave)]">{dataBR(v.data)}</span></span>
                        <span className="block truncate text-xs text-[var(--suave)]">{v.cliente ?? t('Sem cliente')}{v.lotes.length ? ` · ${v.lotes.join(', ')}` : ''}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <b className="block whitespace-nowrap">{gramasTexto(v.g)}</b>
                        {v.valor > 0 && <span className="block whitespace-nowrap text-xs text-[var(--suave)]">{formatar(v.valor, v.moeda)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <BotaoExpandir aberto={verRastreio} onClick={() => setVerRastreio(!verRastreio)} rotuloAberto={t('Fechar o rastreio')} className="-ml-2">{t('Ver rastreio completo (gramas)')}</BotaoExpandir>
          {verRastreio && <RastreioDaTriagem id={x.id} />}
          <DesfazerTriagem x={x} t={t} />
        </div>
      )}
    </li>
  )
}

const AJUDA_DESFAZER =
  'Desfazer: volta tudo como era antes da triagem. O peso volta para o pacote de entrada e os pacotes que saíram somem (ficam no histórico como desfeitos). Use quando pesou ou separou errado. Ex.: separou 10 kg, mas eram 9,5 kg → desfaz, corrige o peso na compra e separa de novo. Só dá enquanto nada que saiu foi vendido, separado de novo ou ajustado.'

/** "Errei a triagem": desfaz (só se nada do que saiu foi mexido); senão explica o caminho (ajustar o pacote que sobrou). */
function DesfazerTriagem({ x, t }: { x: TriagemFeita; t: T }) {
  const { executar } = useComando()
  const [aberto, setAberto] = useState(false)
  const comEtiqueta = x.saidas.filter((s) => s.etiquetaImpressaEm).map((s) => s.codigo)
  if (!x.podeDesfazer)
    return <p className="flex items-center text-xs text-[var(--suave)]">{t('Errou? Já venderam ou mexeram num pacote desta triagem: corrija pelo pacote (⋯ › Ajustar).')}<Info texto={AJUDA_DESFAZER} /></p>
  return (
    <div className="flex items-center border-t border-[var(--borda)] pt-3">
      <Botao variante="leve" onClick={() => setAberto(true)}>↩ {t('Errou? Desfazer esta triagem')}</Botao>
      <Info texto={AJUDA_DESFAZER} />
      {aberto && (
        <Confirmar
          perigo
          pedirMotivo
          titulo="Desfazer a triagem?"
          texto={`${t('{g} voltam para o pacote de entrada e {n} pacote(s) somem da lista.', { g: gramasTexto(x.pesoEntrada), n: x.saidas.length })}${comEtiqueta.length ? ` ${t('Jogue fora as etiquetas de {c}.', { c: comEtiqueta.join(', ') })}` : ''}`}
          rotulo="Desfazer"
          onConfirmar={(motivo) => executar('desfazerTriagem', { triagemId: x.id, motivo }, t('Triagem desfeita: o peso voltou para separar.'))}
          onFechar={() => setAberto(false)}
        />
      )}
    </div>
  )
}

function RastreioDaTriagem({ id }: { id: string }) {
  const { dados } = useConsulta('genealogia', { triagemId: id })
  return dados ? <div className="mt-2"><RastreioTotal g={dados} /></div> : <Carregando />
}
