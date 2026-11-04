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
import { Botao, Campo, Carregando, Entrada, Info, Pilula, Selecao, Titulo, Vazio, cx, fmt, diaMes } from '../ui/base'
import { useApp, useConsulta, useParamTela, useFiltrosTela } from '../ui/contexto'
import { ImprimirEtiquetas, RefazerEtiqueta } from '../ui/etiquetas'
import { MenuAcoes } from '../ui/menuAcoes'
import { MiniaturaLote, marcadorLote } from '../ui/fotos'
import { useT } from '../ui/i18n'
import { useCamposModulo } from './Estoque'
import { NumeroGrande, type Selo } from '../ui/numeroGrande'
import { CampoFaixa, GrupoFiltro, FiltroLista, VazioFiltro } from '../ui/filtroPadrao'

type Linha = ResultadoConsulta<'estoque'>[number]
type Filtro = 'sem' | 'impressa' | 'todas'

const AJUDA_SEM = 'Sem etiqueta: pacotes que ainda não ganharam etiqueta. Ex.: os 3 que você acabou de separar. Também volta para cá o pacote que vendeu parte depois de imprimir (⚖ peso mudou). Ex.: a etiqueta diz 18 kg, vendeu 2 kg → reimprima com 16 kg.'
const CARTOES_ETIQUETA: { f: Filtro; rotulo: string; icone: string; cor: string }[] = [
  { f: 'sem', rotulo: 'Sem etiqueta', icone: '🏷', cor: 'var(--alerta)' },
  { f: 'impressa', rotulo: 'Já impressa', icone: '✓', cor: 'var(--bom)' },
  { f: 'todas', rotulo: 'Todas', icone: '📦', cor: 'var(--marca)' },
]
const FILTROS = ['compra', 'lote', 'pessoa', 'quem', 'impr', 'medida', 'pmin', 'pmax', 'de', 'ate', 'busca']


export function Etiquetas() {
  const t = useT()
  const { ir, ajustarParams } = useApp()
  const [filtro, setFiltro] = useParamTela<Filtro>('f', 'sem')
  const { p, setP, tirar } = useFiltrosTela()
  const { dados } = useConsulta('estoque', { moduloId: 'cabelo', somenteComSaldo: true })
  const camposLote = useCamposModulo('cabelo', 'lote')
  // já marcados quando vem de um pacote, da compra, da triagem ou do estoque (?sel=a,b)
  const selUrl = p('sel')
  const [sel, setSel] = useState<Set<Id>>(() => new Set(selUrl.split(',').filter(Boolean)))
  useEffect(() => {
    if (selUrl) setSel(new Set(selUrl.split(',').filter(Boolean)))
  }, [selUrl])
  const [imprimir, setImprimir] = useState<Id[]>()
  // 'Errou? Gerar nova' (aqui ou vindo do ⋯ de um pacote: ?refazer=<id>)
  const refazer = p('refazer')

  const termo = p('busca').trim().toLowerCase()
  const compra = p('compra').trim().toLowerCase()
  const lote = p('lote').trim().toLowerCase()
  // atributos do cabelo que são lista (categoria, cor, textura… e os criados pela tela): um filtro para cada um
  const atributos = camposLote.filter((c) => c.tipo === 'lista' && c.id !== 'comprimento')
  const filtrosAttr = atributos.map((c) => `a.${c.id}`)
  const pmin = Number(p('pmin')) || 0
  const pmax = Number(p('pmax')) || 0
  const doLote = (i: Linha) => [i.codigo, ...(i.codigosAnteriores ?? []), i.pai?.codigo, ...(i.unificadoDe ?? [])].filter(Boolean).join(' ').toLowerCase()
  const base = (dados ?? []).filter(
    (i) =>
      (!termo || i.busca.includes(termo) || i.nome.toLowerCase().includes(termo)) &&
      (!compra || i.busca.includes(compra)) &&
      (!lote || doLote(i).includes(lote)) &&
      (!p('pessoa') || i.compras.some((c) => c.fornecedor === p('pessoa'))) &&
      (!p('quem') || i.criadoPorNome === p('quem')) &&
      (!p('impr') || i.etiquetaImpressaPor === p('impr')) &&
      (!p('medida') || String(i.campos.comprimento ?? '') === p('medida')) &&
      atributos.every((c) => !p(`a.${c.id}`) || String(i.campos[c.id] ?? '') === p(`a.${c.id}`)) &&
      (!pmin || i.saldo >= pmin) &&
      (!pmax || i.saldo <= pmax) &&
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
  const semNaLista = lista.filter((i) => !i.etiquetaImpressaEm)
  const gSel = selecionados.reduce((s, i) => s + i.saldo, 0)
  // Shift + clique: marca (ou desmarca) do último tocado até este, como o primeiro ficou
  const [ultimo, setUltimo] = useState<number>()
  const marcarAte = (k: number, intervalo?: boolean) => {
    const id = lista[k].id
    if (intervalo && ultimo !== undefined && lista[ultimo]) {
      const valor = sel.has(lista[ultimo].id)
      const [a, b] = ultimo < k ? [ultimo, k] : [k, ultimo]
      setSel((s) => { const n = new Set(s); for (const i of lista.slice(a, b + 1)) if (valor) n.add(i.id); else n.delete(i.id); return n })
    } else setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
    setUltimo(k)
  }
  const todosFiltros = [...FILTROS, ...filtrosAttr]
  const avancados = todosFiltros.filter((k) => k !== 'busca' && p(k)).length
  const limpar = () => ajustarParams(Object.fromEntries(todosFiltros.map((k) => [k, undefined])))
  // opções só com o que existe nos pacotes (nada de escolher e dar lista vazia)
  const valores = (f: (i: Linha) => unknown) => [...new Set((dados ?? []).map(f).filter((v) => v !== undefined && v !== null && v !== '').map(String))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const todasPessoas = [...new Set((dados ?? []).flatMap((i) => i.compras.map((c) => c.fornecedor).filter((x): x is string => !!x)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const quemGerou = valores((i) => i.criadoPorNome)
  const quemImprimiu = valores((i) => i.etiquetaImpressaPor)
  // o que está ligado, em chips com ✕ (bater o olho e ver por que a lista está assim)
  const ativos: { k: string; rotulo: string }[] = [
    ...(p('compra') ? [{ k: 'compra', rotulo: `🛒 ${p('compra')}` }] : []),
    ...(p('lote') ? [{ k: 'lote', rotulo: `📦 ${p('lote')}` }] : []),
    ...(p('pessoa') ? [{ k: 'pessoa', rotulo: `👤 ${p('pessoa')}` }] : []),
    ...(p('quem') ? [{ k: 'quem', rotulo: `${t('gerou')}: ${p('quem')}` }] : []),
    ...(p('impr') ? [{ k: 'impr', rotulo: `${t('imprimiu')}: ${p('impr')}` }] : []),
    ...(p('medida') ? [{ k: 'medida', rotulo: `${p('medida')} cm` }] : []),
    ...atributos.filter((c) => p(`a.${c.id}`)).map((c) => ({ k: `a.${c.id}`, rotulo: `${t(c.nome)}: ${t(p(`a.${c.id}`))}` })),
    ...(p('pmin') || p('pmax') ? [{ k: 'pmin,pmax', rotulo: `${p('pmin') ? fmt(pmin, 'gramas') : '0'} – ${p('pmax') ? fmt(pmax, 'gramas') : '∞'}` }] : []),
    ...(p('de') || p('ate') ? [{ k: 'de,ate', rotulo: `📅 ${p('de') ? diaMes(p('de')) : '…'} – ${p('ate') ? diaMes(p('ate')) : '…'}` }] : []),
  ]
  const impressoOk = () => (setSel(new Set()), ajustarParams({ sel: undefined }))

  return (
    <div className={cx(selecionados.length > 0 && 'pb-24')}>
      <Titulo subtitulo={t('Imprima, reimprima e veja quais pacotes ainda não têm etiqueta.')}>🏷 {t('Etiquetas')}</Titulo>

      {/* três NÚMEROS GRANDES (mesmo padrão de Compras, Triagem e Estoque): tocar troca a lista; selos dizem o peso e o que pede atenção */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-end"><Info texto={AJUDA_SEM} /></div>
        <div role="tablist" aria-label={t('Etiqueta')} className="grid grid-cols-3 gap-2">
          {CARTOES_ETIQUETA.map((c) => {
            const n = conta(c.f)
            const g = base.filter((i) => passaEtiqueta(i, c.f)).reduce((s, i) => s + i.saldo, 0)
            const selos: Selo[] = [{ texto: fmt(g, 'gramas') }]
            if (c.f === 'sem') selos.push(n ? { texto: `🖨 ${t('falta imprimir')}`, tom: 'alerta' } : { texto: `✓ ${t('tudo em dia')}`, tom: 'bom' })
            const velhas = c.f === 'sem' ? base.filter((i) => i.etiquetaVelha).length : 0
            if (velhas) selos.push({ texto: `⚖ ${t('{n} peso mudou', { n: velhas })}`, tom: 'ruim' })
            if (c.f === 'impressa') {
              const hoje = base.filter((i) => i.etiquetaImpressaEm?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
              if (hoje) selos.push({ texto: t('{n} hoje', { n: hoje }), tom: 'marca' })
            }
            return <NumeroGrande key={c.f} role="tab" rotulo={c.rotulo} icone={c.icone} cor={c.cor} valor={dados ? String(n) : '…'} selos={dados ? selos : undefined} colorirValor={c.f === 'sem' && n > 0} ativo={filtro === c.f} onClick={() => setFiltro(c.f)} />
          })}
        </div>
      </div>

      {/* FILTRO PADRÃO: busca + ⚙ Filtros · N → chips ✕ → painel em grupos com "Ver N resultados" */}
      <FiltroLista
        className="mb-2"
        busca={p('busca')} onBusca={(v) => setP('busca', v)} placeholder="Buscar código, nome ou compra"
        ativos={ativos} onTirar={tirar} onLimpar={limpar} temAtivos={avancados > 0}
        resultados={dados ? lista.length : undefined} total={dados ? dados.filter((i) => passaEtiqueta(i, filtro)).length : undefined} unidade="pacote(s)"
        painel={<>
            <GrupoFiltro titulo="De onde veio" icone="🛒">
              <Campo rotulo="Compra (código)"><Entrada placeholder={t('Ex.: P-0003')} value={p('compra')} onChange={(e) => setP('compra', e.target.value)} /></Campo>
              <Campo rotulo="Lote (ou lote de origem)"><Entrada placeholder={t('Ex.: L-0012')} value={p('lote')} onChange={(e) => setP('lote', e.target.value)} /></Campo>
              <Campo rotulo="Fornecedor / cliente"><Selecao valor={p('pessoa')} onChange={(v) => setP('pessoa', v)} vazio="Todos" opcoes={todasPessoas.map((x) => ({ id: x, nome: x }))} /></Campo>
              <CampoFaixa rotulo="Entrada (período)">
                <Entrada type="date" aria-label={t('De')} value={p('de')} onChange={(e) => setP('de', e.target.value)} />
                <Entrada type="date" aria-label={t('Até')} value={p('ate')} onChange={(e) => setP('ate', e.target.value)} />
              </CampoFaixa>
            </GrupoFiltro>
            <GrupoFiltro titulo="Quem" icone="👤">
              <Campo rotulo="Quem gerou o pacote"><Selecao valor={p('quem')} onChange={(v) => setP('quem', v)} vazio="Todos" opcoes={quemGerou.map((x) => ({ id: x, nome: x }))} /></Campo>
              <Campo rotulo="Quem imprimiu"><Selecao valor={p('impr')} onChange={(v) => setP('impr', v)} vazio="Todos" opcoes={quemImprimiu.map((x) => ({ id: x, nome: x }))} /></Campo>
            </GrupoFiltro>
            <GrupoFiltro titulo="O cabelo" icone="💇‍♀️">
              <Campo rotulo="Medida"><Selecao valor={p('medida')} onChange={(v) => setP('medida', v)} vazio="Todas" opcoes={medidas.map((m) => ({ id: m, nome: `${m} cm` }))} /></Campo>
              {atributos.map((c) => {
                const ops = valores((i) => i.campos[c.id])
                return ops.length ? <Campo key={c.id} rotulo={c.nome}><Selecao valor={p(`a.${c.id}`)} onChange={(v) => setP(`a.${c.id}`, v)} vazio="Todos" opcoes={ops.map((x) => ({ id: x, nome: t(x) }))} /></Campo> : null
              })}
              <CampoFaixa rotulo="Peso (g)">
                <Entrada inputMode="numeric" aria-label={t('Peso mínimo (g)')} placeholder={t('de')} value={p('pmin')} onChange={(e) => setP('pmin', e.target.value.replace(/\D/g, ''))} />
                <Entrada inputMode="numeric" aria-label={t('Peso máximo (g)')} placeholder={t('até')} value={p('pmax')} onChange={(e) => setP('pmax', e.target.value.replace(/\D/g, ''))} />
              </CampoFaixa>
            </GrupoFiltro>
        </>}
      />

      {!dados ? (
        <Carregando />
      ) : !lista.length ? (
        filtro === 'sem' && !avancados && !termo && dados.length > 0 ? (
          <Vazio texto="Todos os pacotes já têm etiqueta ✓"><Botao variante="secundario" onClick={() => setFiltro('impressa')}>{t('Ver as já impressas')}</Botao></Vazio>
        ) : (
          <VazioFiltro filtrando={avancados > 0 || !!termo} onLimpar={limpar} />
        )
      ) : (
        <>
          {/* seleção em lote: todos os filtrados, só os sem etiqueta, limpar; no computador Shift+clique marca um intervalo */}
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] px-3 py-1 text-sm">
            <label className="flex min-h-10 items-center gap-2 font-semibold">
              <input type="checkbox" className="h-5 w-5 cursor-pointer" checked={todos} onChange={() => setSel((s) => { const n = new Set(s); for (const i of lista) if (todos) n.delete(i.id); else n.add(i.id); return n })} />
              {t('Selecionar todos os filtrados')} <span className="num font-normal text-[var(--suave)]">({lista.length})</span>
            </label>
            {filtro !== 'sem' && semNaLista.length > 0 && semNaLista.length < lista.length && (
              <button type="button" onClick={() => setSel(new Set(semNaLista.map((i) => i.id)))} className="min-h-10 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Só os sem etiqueta ({n})', { n: semNaLista.length })}</button>
            )}
            {selecionados.length > 0 && (
              <span className="num ml-auto flex items-center gap-1 text-[var(--suave)]">
                {/* no computador a contagem já está na barra de baixo */}
                <span className="sm:hidden"><b className="text-[var(--texto)]">{t('{n} selecionado(s)', { n: selecionados.length })}</b> · {fmt(gSel, 'gramas')}</span>
                <button type="button" onClick={impressoOk} className="min-h-10 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Limpar')}</button>
              </span>
            )}
            <span className="hidden w-full pb-1 text-xs text-[var(--suave)] lg:block">{t('Toque no pacote para marcar. Shift + clique marca todos entre dois.')}</span>
          </div>
          <ul id="lista-etiquetas" className="grid gap-2 lg:grid-cols-2">
            {lista.map((i, k) => <LinhaEtiqueta key={i.id} i={i} marcado={sel.has(i.id)} onAlternar={(intervalo) => marcarAte(k, intervalo)} onAbrir={() => ir('lote', { id: i.id })} onImprimir={() => setImprimir([i.id])} onRefazer={() => ajustarParams({ refazer: i.id })} />)}
          </ul>
        </>
      )}

      {selecionados.length > 0 && (
        <div className="fixed inset-x-2 bottom-20 z-30 mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-xl md:bottom-4" role="region" aria-label={t('Ações em massa')}>
          <b className="num hidden min-w-0 flex-1 truncate px-2 text-sm sm:block">{t('{n} selecionado(s)', { n: selecionados.length })} · {fmt(gSel, 'gramas')}</b>
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
function LinhaEtiqueta({ i, marcado, onAlternar, onAbrir, onImprimir, onRefazer }: { i: Linha; marcado: boolean; onAlternar(intervalo?: boolean): void; onAbrir(): void; onImprimir(): void; onRefazer(): void }) {
  const t = useT()
  const parar = (e: React.SyntheticEvent) => e.stopPropagation()
  const origem = i.compras.map((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' · ')).join(' + ')
  return (
    <li onClick={(e) => onAlternar(e.shiftKey)} className={cx('flex min-w-0 cursor-pointer select-none items-center gap-2 rounded-2xl border p-2 pr-3 shadow-sm', marcado ? 'border-[var(--marca)] bg-[var(--marca-suave)] ring-2 ring-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
      <span className="flex min-h-10 min-w-8 shrink-0 items-center justify-center">
        <input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={`${t('Selecionar')} ${i.codigo ?? i.nome}`} checked={marcado} onChange={() => undefined} onClick={(e) => (parar(e), onAlternar(e.shiftKey))} />
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
          {i.etiquetaVelha
            ? <Pilula tom="alerta">⚖ {t('Peso mudou: a etiqueta diz {g}', { g: fmt(i.etiquetaPeso ?? 0, 'gramas') })}</Pilula>
            : i.etiquetaImpressaEm
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
