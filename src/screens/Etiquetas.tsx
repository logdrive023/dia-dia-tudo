// ETIQUETAS (#/etiquetas, administrador): a casa das etiquetas dos pacotes, tão à mão quanto a Triagem.
// Abre em "Sem etiqueta" (os pacotes que acabaram de sair da separação estão ali); "Já impressa" mostra quando e quem
// imprimiu; "Todas". Filtros no endereço (compra, medida, entrada de/até, busca) — voltar reencontra a lista.
// Marcar (um a um ou "selecionar todos os filtrados") → "Imprimir N etiquetas" (ImprimirEtiquetas, com o tipo QR /
// QR + barras / sem etiqueta). Mandou imprimir → marcarEtiquetasImpressas: o pacote sai de "Sem etiqueta".
// Chega-se aqui pelo menu, pelo cabeçalho do pacote ("🏷 Etiqueta"), pelo ⋯ de qualquer pacote, pela compra, pela
// barra de seleção da Triagem e do Estoque e pelo cartão "pacotes novos" depois de separar (?sel=a,b já marcados).

import { useEffect, useMemo, useState } from 'react'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import { passaEtiqueta } from '../core/services/estoque'
import { Botao, Campo, Carregando, Entrada, Info, Pilula, Selecao, Titulo, Vazio, cx, fmt, loc } from '../ui/base'
import { useApp, useConsulta, useParamTela } from '../ui/contexto'
import { ImprimirEtiquetas, RefazerEtiqueta } from '../ui/etiquetas'
import { MenuAcoes } from '../ui/menuAcoes'
import { MiniaturaLote, marcadorLote } from '../ui/fotos'
import { useT } from '../ui/i18n'

type Linha = ResultadoConsulta<'estoque'>[number]
type Filtro = 'sem' | 'impressa' | 'todas'

const AJUDA_SEM = 'Sem etiqueta: pacotes que ainda não ganharam etiqueta. Ex.: os 3 que você acabou de separar.'
const FILTROS = ['compra', 'medida', 'de', 'ate', 'busca']

/** "03/11" (dia/mês no formato do idioma) */
const diaMes = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit' })

export function Etiquetas() {
  const t = useT()
  const { nav, ir, ajustarParams } = useApp()
  const [filtro, setFiltro] = useParamTela<Filtro>('f', 'sem')
  const p = (k: string) => (nav.params[k] === undefined ? '' : String(nav.params[k]))
  const setP = (k: string, v: string) => ajustarParams({ [k]: v || undefined })
  const { dados } = useConsulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
  // já marcados quando vem de um pacote, da compra, da triagem ou do estoque (?sel=a,b)
  const selUrl = p('sel')
  const [sel, setSel] = useState<Set<Id>>(() => new Set(selUrl.split(',').filter(Boolean)))
  useEffect(() => {
    if (selUrl) setSel(new Set(selUrl.split(',').filter(Boolean)))
  }, [selUrl])
  const [imprimir, setImprimir] = useState<Id[]>()
  const [abrirFiltros, setAbrirFiltros] = useState(false)
  // 'Errou? Gerar nova' (aqui ou vindo do ⋯ de um pacote: ?refazer=<id>)
  const refazer = p('refazer')

  const termo = p('busca').trim().toLowerCase()
  const compra = p('compra').trim().toLowerCase()
  const base = (dados ?? []).filter(
    (i) =>
      (!termo || i.busca.includes(termo) || i.nome.toLowerCase().includes(termo)) &&
      (!compra || i.busca.includes(compra)) &&
      (!p('medida') || String(i.campos.comprimento ?? '') === p('medida')) &&
      (!p('de') || i.entrada >= p('de')) &&
      (!p('ate') || i.entrada <= p('ate')),
  )
  const conta = (f: Filtro) => base.filter((i) => passaEtiqueta(i, f)).length
  // os que vieram marcados no endereço primeiro (quem veio de um pacote acha o pacote no alto), depois os mais novos;
  // marcar na tela não muda a ordem (a linha não pula)
  const doEndereco = new Set(selUrl.split(',').filter(Boolean))
  const lista = base
    .filter((i) => passaEtiqueta(i, filtro))
    .sort((a, b) => Number(doEndereco.has(b.id)) - Number(doEndereco.has(a.id)) || (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))
  const medidas = useMemo(
    () => [...new Set((dados ?? []).map((i) => i.campos.comprimento).filter((v) => v !== undefined && v !== null && v !== '').map(String))].sort((a, b) => Number(a) - Number(b)),
    [dados],
  )
  const selecionados = (dados ?? []).filter((i) => sel.has(i.id))
  const todos = lista.length > 0 && lista.every((i) => sel.has(i.id))
  const alternar = (id: Id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const avancados = FILTROS.filter((k) => k !== 'busca' && p(k)).length
  const limpar = () => ajustarParams(Object.fromEntries(FILTROS.map((k) => [k, undefined])))
  const impressoOk = () => (setSel(new Set()), ajustarParams({ sel: undefined }))

  return (
    <div className={cx(selecionados.length > 0 && 'pb-24')}>
      <Titulo subtitulo={t('Imprima, reimprima e veja quais pacotes ainda não têm etiqueta.')}>🏷 {t('Etiquetas')}</Titulo>

      {/* três filtros sempre inteiros (também em 320 px): nome em cima, quantos embaixo */}
      <div className="mb-3 flex items-center gap-1">
        <div role="tablist" aria-label={t('Etiqueta')} className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl bg-[var(--marca-suave)] p-1">
          {(['sem', 'impressa', 'todas'] as const).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)} className={cx('min-h-11 rounded-lg px-1 text-center text-sm font-semibold leading-tight', filtro === f ? 'bg-[var(--cartao)] text-[var(--marca)] shadow-sm' : 'text-[var(--suave)]')}>
              <span className="block truncate">{t(f === 'sem' ? 'Sem etiqueta' : f === 'impressa' ? 'Já impressa' : 'Todas')}</span>
              {dados && <span className="num block text-xs font-normal">{conta(f)}</span>}
            </button>
          ))}
        </div>
        <Info texto={AJUDA_SEM} />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Entrada type="search" aria-label={t('Buscar código, nome ou compra')} className="w-auto min-w-0 flex-1 basis-48" placeholder={t('Buscar código, nome ou compra')} value={p('busca')} onChange={(e) => setP('busca', e.target.value)} />
        <Botao variante={abrirFiltros || avancados ? 'secundario' : 'leve'} aria-expanded={abrirFiltros} onClick={() => setAbrirFiltros(!abrirFiltros)}>⚙︎ {t('Filtros')}{avancados ? ` · ${avancados}` : ''}</Botao>
      </div>
      {(abrirFiltros || avancados > 0) && (
        <div className="mb-2 grid gap-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Compra (código)"><Entrada placeholder={t('Ex.: P-0003')} value={p('compra')} onChange={(e) => setP('compra', e.target.value)} /></Campo>
          <Campo rotulo="Medida"><Selecao valor={p('medida')} onChange={(v) => setP('medida', v)} vazio="Todas" opcoes={medidas.map((m) => ({ id: m, nome: `${m} cm` }))} /></Campo>
          <Campo comoDiv rotulo="Entrada (período)">
            <div className="flex items-center gap-1">
              <Entrada type="date" aria-label={t('De')} value={p('de')} onChange={(e) => setP('de', e.target.value)} />
              <Entrada type="date" aria-label={t('Até')} value={p('ate')} onChange={(e) => setP('ate', e.target.value)} />
            </div>
          </Campo>
          {avancados > 0 && <div className="flex items-end"><Botao variante="leve" onClick={limpar}>× {t('Limpar filtros')}</Botao></div>}
        </div>
      )}

      {!dados ? (
        <Carregando />
      ) : !lista.length ? (
        filtro === 'sem' && !avancados && !termo && dados.length > 0 ? (
          <Vazio texto="Todos os pacotes já têm etiqueta ✓"><Botao variante="secundario" onClick={() => setFiltro('impressa')}>{t('Ver as já impressas')}</Botao></Vazio>
        ) : (
          <Vazio texto="Nada com esse filtro.">{(avancados > 0 || termo) && <Botao variante="secundario" onClick={limpar}>{t('Limpar filtros')}</Botao>}</Vazio>
        )
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex min-h-10 items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5 cursor-pointer" checked={todos} onChange={() => setSel((s) => { const n = new Set(s); for (const i of lista) if (todos) n.delete(i.id); else n.add(i.id); return n })} />
              {t('Selecionar todos os filtrados')} <span className="num font-normal text-[var(--suave)]">({lista.length})</span>
            </label>
          </div>
          <ul id="lista-etiquetas" className="grid gap-2 lg:grid-cols-2">
            {lista.map((i) => <LinhaEtiqueta key={i.id} i={i} marcado={sel.has(i.id)} onAlternar={() => alternar(i.id)} onAbrir={() => ir('lote', { id: i.id })} onImprimir={() => setImprimir([i.id])} onRefazer={() => ajustarParams({ refazer: i.id })} />)}
          </ul>
        </>
      )}

      {selecionados.length > 0 && (
        <div className="fixed inset-x-2 bottom-20 z-30 mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-xl md:bottom-4" role="region" aria-label={t('Ações em massa')}>
          <b className="hidden min-w-0 flex-1 truncate px-2 text-sm sm:block">{t('{n} selecionado(s)', { n: selecionados.length })}</b>
          <Botao className="min-w-0 flex-1 px-3 sm:flex-none" onClick={() => setImprimir(selecionados.map((i) => i.id))}>🏷 {t(selecionados.length === 1 ? 'Imprimir 1 etiqueta' : 'Imprimir {n} etiquetas', { n: selecionados.length })}</Botao>
          <Botao variante="leve" className="shrink-0 px-2" aria-label={t('Limpar seleção')} onClick={() => (setSel(new Set()), ajustarParams({ sel: undefined }))}>×</Botao>
        </div>
      )}

      {refazer && <RefazerEtiqueta id={refazer} codigo={dados?.find((i) => i.id === refazer)?.codigo} onFechar={() => ajustarParams({ refazer: undefined })} />}
      {imprimir && <ImprimirEtiquetas ids={imprimir} onImpresso={impressoOk} onFechar={() => setImprimir(undefined)} />}
    </div>
  )
}

/** Uma linha: marcar, foto, código grande, rótulo, peso, compra de origem e a situação da etiqueta; Imprimir/Reimprimir. */
function LinhaEtiqueta({ i, marcado, onAlternar, onAbrir, onImprimir, onRefazer }: { i: Linha; marcado: boolean; onAlternar(): void; onAbrir(): void; onImprimir(): void; onRefazer(): void }) {
  const t = useT()
  const parar = (e: React.SyntheticEvent) => e.stopPropagation()
  const origem = i.compras.map((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' · ')).join(' + ')
  return (
    <li onClick={onAlternar} className={cx('flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border bg-[var(--cartao)] p-2 pr-3 shadow-sm', marcado ? 'border-[var(--marca)] ring-2 ring-[var(--marca-suave)]' : 'border-[var(--borda)]')}>
      <span className="flex min-h-10 min-w-8 shrink-0 items-center justify-center">
        <input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={`${t('Selecionar')} ${i.codigo ?? i.nome}`} checked={marcado} onChange={onAlternar} onClick={parar} />
      </span>
      <span onClick={parar}><MiniaturaLote itemId={i.id} foto={i.foto} marcador={marcadorLote(i.campos, i.nome)} /></span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={(e) => (parar(e), onAbrir())} className="max-w-full truncate text-left font-mono text-lg font-black leading-tight text-[var(--marca)] hover:underline" title={t('Abrir lote')}>{i.codigo ?? '—'}</button>
        <div className="truncate text-sm font-semibold" title={i.nome}>{i.nome}</div>
        <div className="truncate text-xs text-[var(--suave)]">
          <span className="num font-semibold text-[var(--texto)]">{fmt(i.saldo, i.unidade === 'grama' ? 'gramas' : 'numero')}</span>
          {origem && <> · 🛒 {origem}</>}
        </div>
        <div className="mt-0.5 text-xs">
          {i.etiquetaImpressaEm
            ? <span className="text-[var(--bom)]">✓ {i.etiquetaImpressaPor ? t('impressa em {d} por {p}', { d: diaMes(i.etiquetaImpressaEm), p: i.etiquetaImpressaPor }) : t('impressa em {d}', { d: diaMes(i.etiquetaImpressaEm) })}</span>
            : <Pilula tom="alerta">{t('Sem etiqueta')}</Pilula>}
          {(i.etiquetaVia ?? 1) > 1 && <span className="ml-1 text-[var(--suave)]" title={i.etiquetaCancelada ? t('antiga cancelada: {m}', { m: i.etiquetaCancelada.motivo }) : undefined}>· {t('{n}ª via', { n: i.etiquetaVia! })}{i.etiquetaCancelada ? ` · ${t('antiga cancelada: {m}', { m: i.etiquetaCancelada.motivo })}` : ''}</span>}
        </div>
      </div>
      {/* no celular só o ícone (o nome do pacote precisa do espaço); o nome do botão fica para o leitor de tela */}
      <Botao variante={i.etiquetaImpressaEm ? 'leve' : 'secundario'} className="shrink-0 px-3" aria-label={t(i.etiquetaImpressaEm ? 'Reimprimir' : 'Imprimir')} title={t(i.etiquetaImpressaEm ? 'Reimprimir' : 'Imprimir')} onClick={(e) => (parar(e), onImprimir())}>
        {i.etiquetaImpressaEm ? '🖨' : '🏷'}<span className="hidden sm:inline"> {t(i.etiquetaImpressaEm ? 'Reimprimir' : 'Imprimir')}</span>
      </Botao>
      {/* já impressa: Reimprimir (mesma etiqueta) fica no botão; cancelar e gerar nova fica no ⋯ (2 toques + confirmar) */}
      {i.etiquetaImpressaEm && <MenuAcoes className="shrink-0" acoes={[{ rotulo: 'Errou? Gerar nova', icone: '↻', onClick: onRefazer }]} />}
    </li>
  )
}
