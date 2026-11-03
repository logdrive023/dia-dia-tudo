// TRIAGEM: o passo mais importante — daqui saem as vendas. Tela BEM SIMPLES: bater o olho e saber o que fazer.
// Topo: uma frase ("2 pacotes para separar · 4,2 kg") + 🔍 📷 ⚙. Três chips que filtram. UMA lista "Para separar"
// (bruto + não identificado, o mais antigo primeiro) com um botão grande "Separar" por linha; "Pronto para vender"
// fechado numa linha; o quadro (colunas do negócio, arrastar) fica atrás de "Ver quadro" (lembrado no aparelho).
// Seleção (juntar e separar, mover, etiquetas) só aparece ao tocar "Selecionar". O resto fica no "⋯" de cada linha.

import { type DragEvent, type ReactNode, useCallback, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import { COLUNA_VENDIDO, type ColunaTriagem, camposUnificados } from '../core/services/triagem'
import { Abas, Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, GramasInput, Info, Janela, Pilula, Selecao, cx, dataBR, fmt, gramasTexto, moedaPadrao } from '../ui/base'
import { resumoCampos } from '../ui/camposDinamicos'
import { clicavel } from '../ui/compartilhados'
import { type Params, useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { type Acao, MenuAcoes, acoesLote } from '../ui/menuAcoes'
import { EditarAtributos, useCamposModulo } from './Estoque'
import { CampoCodigo, TrocarCodigo } from '../ui/codigos'
import { CadeiaChips, RastreioTotal } from '../ui/rastreioTotal'
import { LinkTirarFoto, MiniaturaLote, marcadorLote, useTirarFoto } from '../ui/fotos'
import { ImprimirEtiquetas } from '../ui/etiquetas'
import { LeitorCodigo } from '../ui/estoqueUi'
import { usePistola } from '../ui/leitorPistola'
import { useLembrado } from '../ui/filtros'
import { Icone } from '../ui/icones'
import { FiltrosProntos, PARAMS_PRONTOS, ResumoFiltroProntos, agruparProntos, filtrarProntos, useFiltroProntos } from '../ui/filtrosProntos'

const NAO_ID = 'Não identificado'
/** ainda precisa separar: bruto ou "não identificado" (ficou para depois) */
const precisaSeparar = (l: { campos: { estado?: unknown } }) => l.campos.estado === 'Bruto' || l.campos.estado === NAO_ID
const DICA_JUNTAR = 'Junta pacotes de compras diferentes; a origem de cada grama fica guardada. Ex.: 2 kg do P3 (compra da Maria) + 4 kg da compra do Celso → P4 com 6 kg.'
const DICA_SEPARAR = 'Digite o peso e o que é cada parte; o que sobrar é perda. Ex.: 10 kg bruto → 2 kg loiro + 2 kg moreno + 6 kg para depois.'
const DICA_LAVAGEM = 'Opcional. Se lavar, digite o peso depois. Ex.: 6.000 g → 5.700 g (−300 g).'

type Dados = ResultadoConsulta<'triagem'>
type Lote = Dados['lotes'][number]
type T = ReturnType<typeof useT>

const MAX_COLUNA = 20
const MAX_PRONTOS = 12
const corDe = (c?: ColunaTriagem) => c?.cor ?? 'var(--marca)'
const rolarPara = (id: string) => {
  try {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {
    /* sem rolagem (testes) */
  }
}

/** De onde veio, por extenso: "de P-0003 · Helena · separado de L-0001" (unificado: "de P-0001 + P-0004 · unificado de L-1 + L-2"). */
function origemTexto(l: Lote, t: T) {
  const fornecedores = [...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))]
  const compras = l.compras.length ? `${t('de')} ${l.compras.map((c) => c.codigo ?? '?').join(' + ')}${fornecedores.length ? ` · ${fornecedores.join(', ')}` : ''}` : t('sem compra (cadastro)')
  const pai = l.pai ? ` · ${t('separado de')} ${l.pai.codigo ?? '?'}` : ''
  const uni = l.unificadoDe?.length ? ` · ${t('unificado de')} ${l.unificadoDe.map((x) => x.codigo ?? '?').join(' + ')}` : ''
  return compras + pai + uni
}

/** Rótulo curto: só o que se sabe (medida · cor · categoria); se nada, "Bruto". */
function rotuloCurto(l: Lote, t: T) {
  const c = l.campos
  const partes = [c.comprimento ? `${c.comprimento} cm` : '', c.cor ? t(String(c.cor)) : '', c.categoria && c.categoria !== 'Normal' ? t(String(c.categoria)) : ''].filter(Boolean)
  return partes.join(' · ') || t('Bruto')
}

export function Triagem() {
  const t = useT()
  const { ir, ajustarParams, nav } = useApp()
  const [visaoP, setVisao] = useParamTela<'' | 'quadro' | 'lista'>('visao', '')
  const [quadroLembrado, setQuadroLembrado] = useLembrado('triagem.quadro', false)
  const visao = visaoP || (quadroLembrado ? 'quadro' : 'lista')
  const [filtro, setFiltro] = useParamTela('f', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [buscaAberta, setBuscaAberta] = useState(!!busca)
  const [trocar, setTrocar] = useState<Lote>()
  const medida = nav.params.m === undefined ? '' : String(nav.params.m)
  const [colunaPreco, setColunaPreco] = useParamTela('coluna', '')
  const [vendidos, setVendidos] = useParamTela('vendidos', '')
  const { dados, erro } = useConsulta('triagem', { moduloId: 'cabelo', colunaId: colunaPreco || undefined, vendidosDias: vendidos === 'todos' ? 0 : 30 })
  const campos = useCamposModulo('cabelo', 'lote')
  const { executar, ocupado } = useComando()
  const [sel, setSel] = useState<Set<Id>>(new Set())
  const [selecionando, setSelecionando] = useState(false)
  const [janela, setJanela] = useState<'unificar' | 'triado'>()
  // sair de uma coluna de lavagem ("pedir peso depois"): pergunta o peso depois, opcional
  const [pesar, setPesar] = useState<{ ids: Id[]; fase: string }>()
  const [editar, setEditar] = useState<Lote>()
  const [arrastando, setArrastando] = useState<Id[]>()
  const [opcoes, setOpcoes] = useState(false)
  const [aba, setAba] = useParamTela('aba', 'quadro')
  const [alvo, setAlvo] = useState<string>()
  const [etiquetas, setEtiquetas] = useState<Id[]>()
  const [lendo, setLendo] = useState(false)
  const [prontoAberto, setProntoAberto] = useState(false)
  const [maisSeparar, setMaisSeparar] = useState(false)
  const { tirar } = useTirarFoto()
  // leitor pistola: Enter com o código exato abre o pacote
  const pistola = usePistola(dados?.lotes, (l) => ir('lote', { id: l.id }))
  if (erro) return <ErroTela texto={erro} onVoltar={() => ir('painel')} />
  if (!dados) return <Carregando />

  const cols = dados.colunas
  const colDe = (id: string) => cols.find((c) => c.id === id)
  const trabalho = cols.filter((c) => c.id !== COLUNA_VENDIDO)
  const primeiraPronta = cols.find((c) => c.pronto)
  const naFila = (l: Lote) => l.fase !== COLUNA_VENDIDO && !colDe(l.fase)?.pronto
  const ehPronto = (l: Lote) => !!colDe(l.fase)?.pronto
  const tt = dados.totais
  const termo = busca.trim().toLowerCase()
  const passaBusca = (l: Lote) => (!termo || l.busca.includes(termo)) && (!medida || String(l.campos.comprimento ?? '') === medida)
  const passaFiltro = (l: Lote) =>
    !filtro ||
    (filtro === 'atrasados' ? l.atrasado
      : filtro === 'depois' ? l.campos.estado === NAO_ID
        : filtro === 'semana' ? ehPronto(l) && !!l.triadoEm && l.triadoEm >= dados.semanaDesde
          : filtro === 'mes' ? ehPronto(l) && !!l.triadoEm && l.triadoEm >= dados.mesDesde
            : filtro === 'pronto' ? ehPronto(l)
              : l.fase === filtro)
  const filtroDePronto = filtro === 'pronto' || filtro === 'semana' || filtro === 'mes' || !!colDe(filtro)?.pronto
  const lotes = dados.lotes.filter((l) => passaBusca(l) && passaFiltro(l))
  const selecionados = dados.lotes.filter((l) => sel.has(l.id))
  const brutos = selecionados.length > 0 && selecionados.every((l) => precisaSeparar(l) && l.fase !== COLUNA_VENDIDO)
  const marcar = (id: Id, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n })
  const limparSel = () => setSel(new Set())
  const comSelecao = selecionando || sel.size > 0

  // ---------- ações ----------
  const mover = async (ids: Id[], fase: string, pesos?: Record<Id, number | undefined>) => {
    const c = colDe(fase)
    // saindo de uma coluna de lavagem: antes, pergunta o peso depois (opcional)
    if (!pesos && ids.some((id) => { const l = dados.lotes.find((x) => x.id === id); return !!l && l.fase !== fase && !!colDe(l.fase)?.pedirPeso })) return setPesar({ ids, fase })
    const r = await executar('moverFaseTriagem', { ids, fase, pesos }, t('Movido para “{c}”.', { c: c?.nome ?? fase }))
    if (r) limparSel()
  }
  const separar = (id: Id) => ir('separar', { id, volta: 'triagem' })
  const vender = (p: Params) => ir('vender', { modulo: 'cabelo', coluna: dados.colunaPrecoId, ...p })
  /** entrar na coluna: "separar ao entrar" abre a separação (lote bruto); senão muda de coluna */
  const entrar = (col: ColunaTriagem, ids: Id[]) => {
    const ls = ids.map((id) => dados.lotes.find((x) => x.id === id)).filter((l): l is Lote => !!l && l.fase !== col.id && l.fase !== COLUNA_VENDIDO)
    if (!ls.length) return
    if (col.separarAoEntrar && ls.length === 1 && precisaSeparar(ls[0])) return separar(ls[0].id)
    mover(ls.map((l) => l.id), col.id)
  }
  const zona = (col: ColunaTriagem) =>
    col.id === COLUNA_VENDIDO
      ? {}
      : {
          onDragOver: (e: DragEvent) => { if (arrastando) { e.preventDefault(); setAlvo(col.id) } },
          onDragLeave: () => setAlvo((a) => (a === col.id ? undefined : a)),
          onDrop: (e: DragEvent) => { e.preventDefault(); const ids = arrastando ?? [e.dataTransfer.getData('text/plain')]; setAlvo(undefined); setArrastando(undefined); entrar(col, ids) },
        }
  const menuDe = (l: Lote): Acao[] =>
    acoesLote(
      { id: l.id, saldo: l.saldo, compras: l.compras, origens: l.pai ? [l.pai] : l.unificadoDe, vendavel: !!colDe(l.fase)?.pronto },
      {
        ir: (tela, p) => (tela === 'vender' ? vender(p ?? {}) : ir(tela, p)),
        t,
        admin: true,
        separarParams: { volta: 'triagem' },
        onTrocarCodigo: () => setTrocar(l),
        extras: [
          { rotulo: 'Tirar foto', icone: '📷', onClick: () => tirar(l.id), separar: true },
          { rotulo: 'Escolher foto da galeria', icone: '🖼', onClick: () => tirar(l.id, { galeria: true }) },
          { rotulo: 'Imprimir etiqueta', icone: '🏷', onClick: () => setEtiquetas([l.id]) },
          ...(l.saldo > 0 ? [{ rotulo: 'Editar atributos', icone: '✎', onClick: () => setEditar(l), separar: true }] : []),
          // "Marcar como triado" e "Mover para…" ficam aqui (o caminho principal é Separar; arrastar continua no quadro)
          ...(primeiraPronta && precisaSeparar(l) && l.saldo > 0 ? [{ rotulo: 'Marcar como triado', icone: '✓', onClick: () => (setSel(new Set([l.id])), setJanela('triado')), separar: true }] : []),
          ...(l.fase === COLUNA_VENDIDO ? [] : trabalho.filter((c) => c.id !== l.fase).map((c, k) => ({ rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', onClick: () => entrar(c, [l.id]), separar: k === 0 && !(primeiraPronta && precisaSeparar(l)) }))),
        ],
      },
    )

  /** o caminho principal do lote: Separar (bruto / não identificado); Vender (pronto); senão a próxima coluna */
  const acaoDe = (l: Lote): { rotulo: string; f(): void } | undefined => {
    const k = trabalho.findIndex((c) => c.id === l.fase)
    const prox = naFila(l) ? trabalho[k + 1] : undefined
    return ehPronto(l)
      ? { rotulo: '💰 Vender', f: () => vender({ lote: l.id }) }
      : precisaSeparar(l) && l.saldo > 0
        ? { rotulo: 'Separar', f: () => separar(l.id) }
        : prox
          ? { rotulo: `→ ${prox.nome}`, f: () => mover([l.id], prox.id) }
          : undefined
  }

  const cartao = (l: Lote) => (
    <CartaoLote
      key={l.id}
      l={l}
      col={colDe(l.fase)}
      marcado={sel.has(l.id)}
      selecionavel={comSelecao}
      onMarcar={(v) => marcar(l.id, v)}
      arrastavel={l.fase !== COLUNA_VENDIDO}
      onArrastar={(e) => {
        e.dataTransfer.setData('text/plain', l.id)
        e.dataTransfer.effectAllowed = 'move'
        setArrastando(sel.has(l.id) ? [...sel] : [l.id])
      }}
      onSoltar={() => (setArrastando(undefined), setAlvo(undefined))}
      onAbrir={() => ir('lote', { id: l.id })}
      acao={acaoDe(l)}
      menu={menuDe(l)}
      ocupado={ocupado}
    />
  )

  // ---------- o que mostrar ----------
  const aguardando = dados.lotes.filter(naFila)
  const gAguardando = aguardando.reduce((s, l) => s + l.saldo, 0)
  const paraSeparar = aguardando.filter((l) => passaBusca(l) && (filtroDePronto || passaFiltro(l))).sort((a, b) => b.dias - a.dias)
  const visiveis = maisSeparar ? paraSeparar : paraSeparar.slice(0, MAX_COLUNA)
  const prontos = dados.lotes.filter((l) => ehPronto(l) && passaBusca(l) && (!filtroDePronto || passaFiltro(l)))
  const abrirPronto = prontoAberto || filtroDePronto || !!medida || (!!termo && prontos.length > 0) || PARAMS_PRONTOS.some((k) => nav.params[k] !== undefined)
  const nomeFiltro = (f: string) => colDe(f)?.nome ?? { atrasados: 'Esperando há mais tempo', depois: 'Para depois', semana: 'Triado nesta semana', mes: 'Triado neste mês', pronto: 'Pronto para vender' }[f] ?? f
  const verPronto = () => { setProntoAberto(true); setTimeout(() => rolarPara('triagem-pronto'), 0) }
  const alternarQuadro = () => { setQuadroLembrado(visao !== 'quadro'); if (visaoP) setVisao('') }
  const icone = 'flex h-11 w-11 items-center justify-center rounded-xl text-lg hover:bg-[var(--marca-suave)] aria-pressed:bg-[var(--marca-suave)]'

  return (
    <div className="space-y-5 pb-24">
      {/* topo: o que fazer agora */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t('Triagem')}</h1>
          <p className="num mt-0.5 text-base text-[var(--suave)]">
            {aguardando.length
              ? <><b className="text-[var(--texto)]">{aguardando.length === 1 ? t('1 pacote para separar') : t('{n} pacotes para separar', { n: aguardando.length })}</b> <span className="whitespace-nowrap">· {gramasTexto(gAguardando)}</span></>
              : <b className="text-[var(--bom)]">{t('Tudo separado ✓')}</b>}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" className={icone} aria-pressed={buscaAberta || !!busca} aria-label={t('Buscar')} title={t('Buscar')} onClick={() => { if (buscaAberta && busca) setBusca(''); setBuscaAberta(!(buscaAberta || !!busca)) }}>🔍</button>
          <button type="button" className={icone} aria-label={t('Ler código')} title={t('Ler código')} onClick={() => setLendo(true)}>📷</button>
          <button type="button" className={icone} aria-pressed={opcoes} aria-expanded={opcoes} aria-label={t('Opções')} title={t('Opções')} onClick={() => setOpcoes(!opcoes)}>⚙</button>
        </div>
      </header>

      {opcoes && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--fundo)] p-2">
          {dados.colunasPreco.length > 1 && (
            <div className="min-w-[12rem]"><Selecao valor={dados.colunaPrecoId} onChange={(v) => setColunaPreco(v === dados.colunasPreco[0]?.id ? '' : v)} opcoes={dados.colunasPreco.map((c) => ({ id: c.id, nome: `${t('Preço de')} ${c.nome}` }))} /></div>
          )}
          <Botao variante="leve" onClick={alternarQuadro}>▦ {t(visao === 'quadro' ? 'Ver lista' : 'Ver quadro')}</Botao>
          <Botao variante="leve" onClick={() => ir('config', { aba: 'triagem' })}>⚙ {t('Personalizar colunas')}</Botao>
        </div>
      )}

      {(buscaAberta || !!busca) && (
        <Entrada type="search" autoFocus={buscaAberta && !busca} className="w-full" aria-label={t('Buscar lote por código (atual ou antigo), compra, sigla ou fornecedor')} placeholder={t('Código, compra ou fornecedor')} value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={pistola.onKeyDown} />
      )}

      <Abas variante="sublinhado" atual={aba} onChange={setAba} abas={[{ id: 'quadro', nome: 'Lotes' }, { id: 'triagens', nome: 'Triagens feitas' }]} />
      {aba === 'triagens' ? (
        <ListaTriagens
          aberta={nav.params.t as string | undefined}
          resumo={
            <p className="num text-sm text-[var(--suave)]">
              {t('Triado nesta semana')}: <b className="text-[var(--texto)]">{gramasTexto(tt.triadoSemana)}</b>
              {' · '}{t('Perda no mês')}: <b className={tt.perdaMesBp > 500 ? 'text-[var(--ruim)]' : 'text-[var(--texto)]'}>{fmt(tt.perdaMesBp, 'percentual')}</b>
              {tt.usadoMes > 0 && <> ({t('{p} de {u} separados', { p: gramasTexto(tt.perdaMes), u: gramasTexto(tt.usadoMes) })})</>}
            </p>
          }
        />
      ) : <>

      {/* três chips que filtram / levam ao lugar */}
      <div className="-mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <Chip ativo={!filtro && !abrirPronto} rotulo={`⏳ ${t('Para separar')}`} valor={gramasTexto(gAguardando)} onClick={() => { ajustarParams({ f: undefined, m: undefined }); setProntoAberto(false); rolarPara('triagem-separar') }} />
        <Chip ativo={abrirPronto} rotulo={`✅ ${t('Prontos')}`} valor={gramasTexto(tt.pronto)} onClick={() => (abrirPronto && !filtroDePronto ? setProntoAberto(false) : verPronto())} />
        <Chip ativo={filtro === 'depois'} rotulo={`❓ ${t('Para depois')}`} valor={tt.naoIdentificado.n ? gramasTexto(tt.naoIdentificado.g) : '0'} onClick={() => setFiltro(filtro === 'depois' ? '' : 'depois')} />
      </div>

      {(filtro || medida) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--suave)]">{t('Mostrando')}:</span>
          {filtro && <Pilula tom="marca">{t(nomeFiltro(filtro))}</Pilula>}
          {medida && <Pilula tom="marca">{medida} cm</Pilula>}
          <button type="button" onClick={() => ajustarParams({ f: undefined, m: undefined })} className="min-h-10 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">✕ {t('Ver tudo')}</button>
        </div>
      )}

      {/* a lista principal (ou o quadro, para quem escolher) */}
      <section id="triagem-separar" aria-label={t(visao === 'quadro' ? 'Quadro' : 'Para separar')} className="scroll-mt-4">
        <div className="mb-2 flex items-center gap-1">
          <h2 className="text-lg font-bold">{t(visao === 'quadro' ? 'Quadro' : 'Para separar')}</h2>
          {visao !== 'quadro' && <Info texto={DICA_SEPARAR} />}
          <span className="ml-auto flex items-center">
            <Botao variante="leve" className="px-3" aria-pressed={comSelecao} onClick={() => { if (comSelecao) limparSel(); setSelecionando(!comSelecao) }}>{t(comSelecao ? 'Cancelar' : 'Selecionar')}</Botao>
            <Botao variante="leve" className="px-3" onClick={alternarQuadro}>{t(visao === 'quadro' ? 'Ver lista' : 'Ver quadro')}</Botao>
          </span>
        </div>

        {visao === 'quadro' ? (
          <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-2">
            {cols.map((c) => (
              <Coluna key={c.id} col={c} lotes={lotes.filter((l) => l.fase === c.id)} alvo={alvo === c.id} {...zona(c)} rodape={c.id === COLUNA_VENDIDO ? <VerVendidos dados={dados} todos={vendidos === 'todos'} onTodos={(v) => setVendidos(v ? 'todos' : '')} /> : undefined}>
                {(ls) => ls.map(cartao)}
              </Coluna>
            ))}
          </div>
        ) : !aguardando.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--borda)] px-4 py-10 text-center">
            <p className="text-2xl font-bold">{t('Nada para separar 🎉')}</p>
            {prontos.length > 0 && <button type="button" onClick={verPronto} className="mt-2 min-h-11 px-3 font-semibold text-[var(--marca)] hover:underline">{t('Ver o que está pronto para vender →')}</button>}
          </div>
        ) : !paraSeparar.length ? (
          <p className="rounded-2xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nada encontrado.')}</p>
        ) : (
          <>
            <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
              {visiveis.map((l) => {
                const col = colDe(l.fase)
                const acao = acaoDe(l)
                const fornecedores = [...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))]
                return (
                  <li key={l.id} className={cx('flex items-center gap-2 px-3 py-3 sm:gap-3', sel.has(l.id) && 'bg-[var(--marca-suave)]')}>
                    {comSelecao && <input type="checkbox" className="h-5 w-5 shrink-0" checked={sel.has(l.id)} onChange={(e) => marcar(l.id, e.target.checked)} aria-label={t('Selecionar {c}', { c: l.codigo ?? l.nome })} />}
                    <FotoOuIcone l={l} />
                    <div {...clicavel(() => ir('lote', { id: l.id }))} className="min-w-0 flex-1 cursor-pointer rounded-lg outline-none focus-visible:bg-[var(--marca-suave)]">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-base font-bold">{l.codigo ?? '—'}</span>
                        <span className="min-w-0 truncate text-base">{rotuloCurto(l, t)}</span>
                        {l.atrasado && <Pilula tom="ruim">{t('parado')}</Pilula>}
                        {l.campos.estado === NAO_ID && <Pilula tom="alerta">❓ {t('para depois')}</Pilula>}
                        {col && !col.entrada && <Pilula>{t(col.nome)}</Pilula>}
                      </div>
                      {/* peso e dias sempre aparecem; o fornecedor vai ao lado (computador) ou embaixo (celular) */}
                      <div className="num mt-0.5 min-w-0 text-sm text-[var(--suave)] sm:flex sm:items-center sm:gap-1">
                        <span className="shrink-0 whitespace-nowrap"><b className="font-semibold text-[var(--texto)]">{gramasTexto(l.saldo)}</b> · {!l.dias ? t('hoje') : l.dias === 1 ? t('há 1 dia') : t('há {n} dias', { n: l.dias })}</span>
                        {fornecedores.length > 0 && <span className="block min-w-0 truncate"><span className="hidden sm:inline">· </span>{fornecedores.join(', ')}</span>}
                      </div>
                    </div>
                    {acao && <Botao className="min-h-12 shrink-0 px-3 text-base sm:px-6" disabled={ocupado} onClick={acao.f}>{t(acao.rotulo)}</Botao>}
                    <MenuAcoes acoes={menuDe(l)} />
                  </li>
                )
              })}
            </ul>
            {paraSeparar.length > MAX_COLUNA && (
              <button type="button" onClick={() => setMaisSeparar(!maisSeparar)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{maisSeparar ? t('Mostrar menos') : t('Ver mais ({n})', { n: paraSeparar.length - MAX_COLUNA })}</button>
            )}
          </>
        )}
      </section>

      <ProntoParaVender
        aberto={abrirPronto}
        onAlternar={() => (abrirPronto ? (setProntoAberto(false), ajustarParams({ ...(filtroDePronto ? { f: undefined } : {}), m: undefined, ...Object.fromEntries(PARAMS_PRONTOS.map((k) => [k, undefined])) })) : setProntoAberto(true))}
        lotes={prontos}
        total={prontos.length === dados.lotes.filter(ehPronto).length ? tt.pronto : prontos.reduce((s, l) => s + l.saldo, 0)}
        valor={prontos.length === dados.lotes.filter(ehPronto).length ? tt.prontoValor : prontos.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)}
        menuDe={menuDe}
        onLote={(id) => ir('lote', { id })}
        onVender={vender}
        onEstoque={(med) => ir('estoque', { modulo: 'cabelo', 'min.comprimento': med, 'max.comprimento': med })}
        onFiltrar={(med) => ajustarParams({ f: 'pronto', m: med || undefined })}
      />

      </>}
      {/* ações em massa: só com algo selecionado */}
      {sel.size > 0 && (
        <div role="toolbar" aria-label={t('Ações nos selecionados')} className="fixed inset-x-2 bottom-20 z-30 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-xl md:bottom-4">
          <span className="px-2 text-sm font-bold">{t('{n} selecionado(s)', { n: sel.size })} · <span className="num">{gramasTexto(selecionados.reduce((s, l) => s + l.saldo, 0))}</span></span>
          <span className="inline-flex items-center"><Botao disabled={ocupado || !selecionados.length || selecionados.some((l) => l.fase === COLUNA_VENDIDO)} onClick={() => ir('separar', { ids: selecionados.map((l) => l.id).join(','), volta: 'triagem' })}>✂️ {t(sel.size > 1 ? 'Juntar e separar' : 'Separar')}</Botao><Info texto={sel.size > 1 ? DICA_JUNTAR : DICA_SEPARAR} /></span>
          <Botao variante="secundario" disabled={ocupado || sel.size < 2 || selecionados.some((l) => l.fase === COLUNA_VENDIDO)} title={t('Junta 2 ou mais lotes num lote só')} onClick={() => setJanela('unificar')}>🔗 {t('Só juntar')}</Botao>
          <Botao variante="secundario" onClick={() => setEtiquetas([...sel])}>🏷 {t('Etiquetas')}</Botao>
          <MenuAcoes comRotulo acoes={[
            ...(primeiraPronta && brutos ? [{ rotulo: 'Marcar como triado', icone: '✓', onClick: () => setJanela('triado') }] : []),
            ...trabalho.map((c, k) => ({ rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', separar: k === 0 && !!primeiraPronta && brutos, onClick: () => { const ids = selecionados.filter((l) => l.fase !== c.id && l.fase !== COLUNA_VENDIDO).map((l) => l.id); if (ids.length) mover(ids, c.id) } })),
          ]} />
          <Botao variante="leve" className="ml-auto" onClick={() => (limparSel(), setSelecionando(false))}>{t('Limpar')}</Botao>
        </div>
      )}

      {janela === 'unificar' && <Unificar lotes={selecionados} campos={campos} onFechar={() => setJanela(undefined)} onFeito={limparSel} />}
      {janela === 'triado' && primeiraPronta && (
        <Confirmar
          titulo="Marcar como triado?"
          texto={t('{n} lote(s) vão para “{c}” sem dividir: ficam prontos para vender. Fica no histórico.', { n: selecionados.length, c: primeiraPronta.nome })}
          rotulo="Marcar como triado"
          onConfirmar={() => mover(selecionados.map((l) => l.id), primeiraPronta.id)}
          onFechar={() => setJanela(undefined)}
        />
      )}
      {pesar && <PesoDepois lotes={pesar.ids.map((id) => dados.lotes.find((l) => l.id === id)).filter((l): l is Lote => !!l)} destino={colDe(pesar.fase)?.nome ?? pesar.fase} ocupado={ocupado} onFechar={() => setPesar(undefined)} onMover={async (pesos) => { setPesar(undefined); await mover(pesar.ids, pesar.fase, pesos) }} />}
      {editar && <EditarAtributos id={editar.id} campos={campos} valores={editar.campos} onFechar={() => setEditar(undefined)} />}
      {trocar && <TrocarCodigo tipo="lote" id={trocar.id} atual={trocar.codigo} onFechar={() => setTrocar(undefined)} />}
      {etiquetas && <ImprimirEtiquetas ids={etiquetas} onFechar={() => setEtiquetas(undefined)} />}
      {lendo && <LeitorCodigo onLer={(c) => (setLendo(false), setBuscaAberta(true), setBusca(c))} onFechar={() => setLendo(false)} />}
    </div>
  )
}

/** Chip fino que filtra / leva ao lugar (substitui os 4 cartões de números). */
function Chip({ ativo, onClick, rotulo, valor }: { ativo: boolean; onClick(): void; rotulo: string; valor: string }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick} className={cx('num min-h-11 min-w-0 rounded-xl border px-2 py-1 text-left transition sm:inline-flex sm:items-center sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0', ativo ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--texto)] hover:border-[var(--marca)]')}>
      <span className={cx('block truncate text-xs sm:inline sm:text-sm', !ativo && 'text-[var(--suave)]')}>{rotulo}</span>
      <b className="block whitespace-nowrap text-base sm:inline sm:text-sm">{valor}</b>
    </button>
  )
}

/** Foto do lote; sem foto, um ícone neutro (tocar abre a câmera). */
function FotoOuIcone({ l }: { l: Lote }) {
  const t = useT()
  const { tirar, enviando } = useTirarFoto()
  if (l.foto) return <MiniaturaLote itemId={l.id} foto={l.foto} />
  return (
    <button type="button" disabled={enviando} onClick={(e) => (e.stopPropagation(), tirar(l.id))} title={t('Tirar a primeira foto deste lote')} aria-label={t('Tirar a primeira foto deste lote')} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--fundo)] text-[var(--suave)] hover:text-[var(--marca)]">
      {enviando ? '…' : <Icone nome="estoque" className="h-6 w-6" />}
    </button>
  )
}

/**
 * PRONTO PARA VENDER: fechado numa linha ("✅ 19,4 kg prontos · Bs 183.972 ›"); aberto, por medida (abre e fecha) e cada
 * LOTE numa linha com origem, gramas, valor, margem, Vender e "⋯".
 */
function ProntoParaVender({ aberto: secaoAberta, onAlternar, lotes, total, valor, menuDe, onLote, onVender, onEstoque, onFiltrar }: { aberto: boolean; onAlternar(): void; lotes: Lote[]; total: number; valor: number; menuDe(l: Lote): Acao[]; onLote(id: Id): void; onVender(p: Params): void; onEstoque(med: string): void; onFiltrar(med: string): void }) {
  const t = useT()
  const m = moedaPadrao()
  const filtro = useFiltroProntos()
  const filtrados = filtrarProntos(lotes, filtro.f)
  const ordem = agruparProntos(filtrados, filtro.f, t)
  // grupos fechados (o resto abre sozinho quando há poucos lotes); muda de "Agrupar por" → recomeça
  const [fechados, setFechados] = useState<{ por: string; k: Set<string> }>({ por: '', k: new Set() })
  const fechadosAgora = fechados.por === filtro.f.agrupar + filtro.f.passo ? fechados.k : new Set<string>()
  const poucos = filtrados.length <= MAX_PRONTOS || ordem.length === 1
  const abertos = new Set(ordem.map((g) => g.chave).filter((k) => (poucos ? !fechadosAgora.has(k) : fechadosAgora.has(k))))
  const [todos, setTodos] = useState<Set<string>>(new Set())
  const semPreco = lotes.filter((l) => l.semPreco).length
  // em "fechados" fica o que o usuário inverteu (fechou quando abre sozinho; abriu quando começa fechado)
  const alternar = (k: string) => setFechados(() => { const n = new Set(fechadosAgora); if (n.has(k)) n.delete(k); else n.add(k); return { por: filtro.f.agrupar + filtro.f.passo, k: n } })
  return (
    <section id="triagem-pronto" aria-label={t('Pronto para vender')} className="scroll-mt-4 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <button type="button" aria-expanded={secaoAberta} onClick={onAlternar} className="num flex min-h-14 w-full items-center gap-2 rounded-2xl px-4 text-left hover:bg-[var(--marca-suave)]">
        <span className="min-w-0 flex-1 truncate text-base">
          ✅ <b>{t('{g} prontos', { g: gramasTexto(total) })}</b>
          {valor > 0 && <span className="text-[var(--suave)]"> · {formatar(valor, m)}</span>}
        </span>
        {semPreco > 0 && <Pilula tom="alerta">⚠️ {semPreco}</Pilula>}
        <span aria-hidden className={cx('text-xl text-[var(--suave)] transition-transform', secaoAberta && 'rotate-90')}>›</span>
      </button>
      {secaoAberta && <div className="px-4 pb-4">
      {lotes.length > 0 && <FiltrosProntos todos={lotes} filtro={filtro} />}
      <ResumoFiltroProntos lotes={filtrados} filtro={filtro} />
      {semPreco > 0 && <p className="mb-2 rounded-xl bg-[var(--alerta)]/10 p-2 text-sm font-semibold text-[var(--alerta)]">⚠️ {t('{n} lote(s) triado(s) sem preço na tabela', { n: semPreco })}</p>}
      {!lotes.length ? <p className="text-sm text-[var(--suave)]">{t('Nada triado ainda: separe um lote para começar a vender.')}</p> : !filtrados.length ? <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t('Nenhum lote com esses filtros.')}</p> : (
        <div className="space-y-2">
          {ordem.map(({ chave: med, rotulo, medida, lotes: ls }) => {
            const aberto = abertos.has(med)
            const semCabecalho = filtro.f.agrupar === 'nenhum'
            const mostrar = todos.has(med) ? ls : ls.slice(0, MAX_PRONTOS)
            const g = ls.reduce((s, l) => s + l.saldo, 0)
            const v = ls.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
            return (
              <div key={med} className="rounded-xl border border-[var(--borda)]">
                {!semCabecalho && <div className="flex items-center gap-1 rounded-xl bg-[var(--fundo)] pl-2">
                  <button type="button" aria-expanded={aberto} onClick={() => alternar(med)} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0 py-1 text-left text-sm">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={cx('inline-block text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
                      <b className="whitespace-nowrap text-base">{rotulo}</b>
                    </span>
                    <span className="num text-[var(--suave)]"><span className="whitespace-nowrap">{t('{n} lote(s)', { n: ls.length })}</span> · <span className="whitespace-nowrap">{gramasTexto(g)}</span> · <b className="whitespace-nowrap text-[var(--texto)]">{v ? formatar(v, m) : '—'}</b></span>
                  </button>
                  <MenuAcoes acoes={[
                    { rotulo: aberto ? 'Esconder os lotes' : 'Mostrar os lotes', icone: aberto ? '▴' : '▾', onClick: () => alternar(med) },
                    ...(medida ? [
                      { rotulo: 'Ver lotes desta medida no estoque', icone: '📦', onClick: () => onEstoque(medida) },
                      { rotulo: 'Só esta medida no quadro', icone: '🔍', onClick: () => onFiltrar(medida) },
                      { rotulo: 'Vender esta medida', icone: '💰', onClick: () => onVender({ medida, categoria: String(ls[0].campos.categoria || 'Normal') }) },
                    ] : []),
                  ]} />
                </div>}
                {(aberto || semCabecalho) && (
                  <ul className="divide-y divide-[var(--borda)]">
                    {mostrar.map((l) => {
                      const pct = l.preco && l.margem !== undefined && l.preco.valorPrincipal ? Math.round((l.margem * 10000) / l.preco.valorPrincipal) : undefined
                      return (
                        <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2">
                          <FotoOuIcone l={l} />
                          <div {...clicavel(() => onLote(l.id))} className="min-w-0 flex-1 basis-40 cursor-pointer rounded-lg outline-none hover:underline focus-visible:bg-[var(--marca-suave)]">
                            <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-mono text-base font-bold">{l.codigo}</span><span className="[overflow-wrap:anywhere]">{l.nome}</span></div>
                            {/* a origem aparece só nos chips (compra · fornecedor → triagem) */}
                            <CadeiaChips className="mt-1" cadeia={l.cadeia} />
                          </div>
                          <div className="num flex w-full shrink-0 items-center gap-2 text-right sm:ml-auto sm:w-auto">
                            <span className="mr-auto whitespace-nowrap font-semibold sm:mr-0">{gramasTexto(l.saldo)}</span>
                            <span className="min-w-0 sm:min-w-[6.5rem]">
                              {l.preco ? <b className="block whitespace-nowrap">{formatar(l.preco.valor, l.preco.moeda)}</b> : <span className="block text-xs font-semibold text-[var(--alerta)]">⚠️ {l.semPreco === 'medida' ? t('sem medida') : t('sem preço na tabela')}</span>}
                              {l.margem !== undefined && <span className={cx('block text-xs font-semibold', l.margem < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{t('margem')} <span className="whitespace-nowrap">{formatar(l.margem, m)}</span>{pct !== undefined && <span className="whitespace-nowrap"> ({fmt(pct, 'percentual')})</span>}</span>}
                            </span>
                            <Botao className="shrink-0 px-4" onClick={() => onVender({ lote: l.id })}>{t('Vender')}</Botao>
                            <MenuAcoes acoes={menuDe(l)} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {(aberto || semCabecalho) && ls.length > MAX_PRONTOS && (
                  <button type="button" onClick={() => setTodos((s) => { const n = new Set(s); if (n.has(med)) n.delete(med); else n.add(med); return n })} className="min-h-10 w-full text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                    {todos.has(med) ? t('Mostrar menos') : t('Ver todos ({n})', { n: ls.length })}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>}
    </section>
  )
}

function Coluna({ col, lotes, children, alvo, lista, rodape, ...zona }: { col: ColunaTriagem; lotes: Lote[]; children(ls: Lote[]): ReactNode; alvo?: boolean; lista?: boolean; rodape?: ReactNode; onDragOver?(e: DragEvent): void; onDragLeave?(): void; onDrop?(e: DragEvent): void }) {
  const t = useT()
  const [mais, setMais] = useState(false)
  const visiveis = mais ? lotes : lotes.slice(0, MAX_COLUNA)
  const vazio = col.ajuda || (col.entrada ? 'Os lotes brutos das compras caem aqui.' : col.pronto ? 'Lotes prontos para vender aparecem aqui.' : col.id === COLUNA_VENDIDO ? 'Lotes que acabaram nos últimos 30 dias aparecem aqui.' : 'Arraste lotes para cá.')
  return (
    <section
      aria-label={t(col.nome)}
      {...zona}
      className={cx('min-w-0 rounded-2xl border-2 p-2 transition', lista ? '' : 'w-[17rem] shrink-0 bg-[var(--fundo)] xl:w-auto xl:min-w-[17rem] xl:flex-1', alvo ? 'border-dashed border-[var(--marca)] bg-[var(--marca-suave)]' : 'border-transparent')}
    >
      <header className="mb-2 flex items-start gap-2 px-1">
        <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: corDe(col) }} />
        <h2 className="min-w-0 flex-1 font-bold leading-tight">{t(col.nome)}{col.pronto && <span className="ml-1 text-xs font-semibold text-[var(--bom)]">💰</span>}</h2>
        <span className="num shrink-0 whitespace-nowrap text-sm text-[var(--suave)]">{lotes.length} · {gramasTexto(lotes.reduce((s, l) => s + l.saldo, 0))}</span>
      </header>
      {!lotes.length ? (
        <p className="rounded-xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">{t(vazio)}</p>
      ) : (
        <ul className={cx(lista ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2')}>{children(visiveis)}</ul>
      )}
      {lotes.length > MAX_COLUNA && (
        <button type="button" onClick={() => setMais(!mais)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{mais ? t('Mostrar menos') : t('Ver mais ({n})', { n: lotes.length - MAX_COLUNA })}</button>
      )}
      {rodape}
    </section>
  )
}

function VerVendidos({ dados, todos, onTodos }: { dados: Dados; todos: boolean; onTodos(v: boolean): void }) {
  const t = useT()
  if (!todos && !dados.vendidosOcultos) return null
  return (
    <button type="button" onClick={() => onTodos(!todos)} className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
      {todos ? t('Só os últimos 30 dias') : t('Ver mais ({n} mais antigos)', { n: dados.vendidosOcultos })}
    </button>
  )
}

function CartaoLote(p: {
  l: Lote
  col?: ColunaTriagem
  marcado: boolean
  arrastavel: boolean
  ocupado: boolean
  acao?: { rotulo: string; f(): void }
  selecionavel: boolean
  menu: Acao[]
  onMarcar(v: boolean): void
  onArrastar(e: DragEvent): void
  onSoltar(): void
  onAbrir(): void
}) {
  const t = useT()
  const { l, col } = p
  const m = moedaPadrao()
  const vendido = l.fase === COLUNA_VENDIDO
  const pct = l.preco && l.margem !== undefined && l.preco.valorPrincipal ? Math.round((l.margem * 10000) / l.preco.valorPrincipal) : undefined
  return (
    <li
      draggable={p.arrastavel}
      onDragStart={p.onArrastar}
      onDragEnd={p.onSoltar}
      className={cx('min-w-0 list-none rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm transition', p.marcado ? 'border-[var(--marca)] ring-2 ring-[var(--marca)]' : 'border-[var(--borda)]', p.arrastavel && 'cursor-grab active:cursor-grabbing', vendido && 'opacity-75')}
    >
      <div className="flex items-center gap-2">
        {!vendido && p.selecionavel && <input type="checkbox" className="h-5 w-5 shrink-0" checked={p.marcado} onChange={(e) => p.onMarcar(e.target.checked)} aria-label={t('Selecionar {c}', { c: l.codigo ?? l.nome })} />}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="font-mono text-xs text-[var(--suave)]">{l.codigo}</span>
          {l.unificado > 0 && <Pilula tom="marca">🔗 {t('{n} lotes', { n: l.unificado })}</Pilula>}
          {l.campos.estado === NAO_ID && <Pilula tom="alerta">❓ {t('Não identificado')}</Pilula>}
          {l.atrasado && <Pilula tom="ruim">⏳ {t('{n} d', { n: l.dias })}</Pilula>}
        </span>
        <span className="num shrink-0 whitespace-nowrap text-xl font-black">{gramasTexto(l.saldo)}</span>
        <MenuAcoes acoes={p.menu} />
      </div>
      <div className="mt-1 flex items-start gap-2">
        <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} />
        <button type="button" onClick={p.onAbrir} className="block min-w-0 flex-1 text-left font-semibold leading-tight [overflow-wrap:anywhere] hover:underline">{l.nome}</button>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-[var(--suave)]">
        <CadeiaChips cadeia={l.cadeia} />
        {(l.pai || l.unificadoDe?.length) && <p className="[overflow-wrap:anywhere]">{l.pai ? `${t('separado de')} ${l.pai.codigo ?? '?'}` : `${t('unificado de')} ${l.unificadoDe!.map((x) => x.codigo ?? '?').join(' + ')}`}</p>}
        <p className="num">
          {vendido ? `${t('vendido em')} ${dataBR(l.vendidoEm)}` : col?.pronto ? `${t('desde')} ${dataBR(l.desde)}` : t('há {n} dia(s) nesta coluna', { n: l.dias })}
          {l.custoKg !== undefined && !col?.pronto && !vendido && ` · ${formatar(l.custoKg, m)}/kg`}
        </p>
        {l.obs && <p className="italic">“{l.obs}”</p>}
        {col?.exigirFoto && !l.fotosProprias && !vendido ? (
          <p className="font-semibold text-[var(--ruim)]"><LinkTirarFoto itemId={l.id}>📷 {t('Foto obrigatória para sair daqui: tirar agora')}</LinkTirarFoto></p>
        ) : col?.lembrarFotos && !l.fotosProprias && !vendido ? (
          <p className="font-semibold text-[var(--alerta)]"><LinkTirarFoto itemId={l.id}>📷 {t('Lembre das fotos: tirar agora')}</LinkTirarFoto></p>
        ) : null}
      </div>
      {col?.pronto && (
        <div className="mt-2 rounded-xl bg-[var(--fundo)] p-2">
          {l.preco ? (
            <>
              <p className="num text-sm"><b className="whitespace-nowrap text-base">{formatar(l.preco.valor, l.preco.moeda)}</b> <span className="whitespace-nowrap text-xs text-[var(--suave)]">{gramasTexto(l.saldo)} × {l.preco.fator} · {l.preco.coluna}</span></p>
              {l.margem !== undefined && <p className={cx('num text-xs font-semibold', l.margem < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{t('margem')} <span className="whitespace-nowrap">{formatar(l.margem, m)}</span>{pct !== undefined && <span className="whitespace-nowrap"> ({fmt(pct, 'percentual')})</span>}</p>}
            </>
          ) : (
            <p className="text-xs font-semibold text-[var(--alerta)]">⚠️ {l.semPreco === 'medida' ? t('sem medida: edite para ter preço') : t('sem preço na tabela')}</p>
          )}
        </div>
      )}
      {p.acao && (
        <div className="mt-2 flex">
          <Botao className="min-w-0 flex-1 [overflow-wrap:anywhere]" disabled={p.ocupado} onClick={p.acao.f}>{t(p.acao.rotulo)}</Botao>
        </div>
      )}
    </li>
  )
}

/** Saiu da lavagem: peso depois de cada lote (opcional). A diferença vira "perda de lavagem" no livro (antes → depois). */
function PesoDepois({ lotes, destino, ocupado, onFechar, onMover }: { lotes: Lote[]; destino: string; ocupado: boolean; onFechar(): void; onMover(pesos: Record<Id, number | undefined>): void }) {
  const t = useT()
  const [pesos, setPesos] = useState<Record<Id, number | undefined>>({})
  return (
    <Janela aberta titulo={<span className="inline-flex items-center">{t('Peso depois da lavagem')}<Info texto={DICA_LAVAGEM} /></span>} onFechar={onFechar} rodape={
      <div className="flex gap-2">
        <Botao variante="leve" className="flex-1" disabled={ocupado} onClick={() => onMover({})}>{t('Pular')}</Botao>
        <Botao grande className="flex-1" disabled={ocupado} onClick={() => onMover(pesos)}>→ {destino}</Botao>
      </div>
    }>
      <div className="space-y-3">
        <p className="text-sm text-[var(--suave)]">{t('Opcional: pese de novo e a diferença fica registrada como perda de lavagem.')}</p>
        {lotes.map((l) => (
          <Campo key={l.id} rotulo={`${l.codigo ?? l.nome} · ${t('antes')} ${gramasTexto(l.saldo)}`}>
            <GramasInput valor={pesos[l.id]} onChange={(g) => setPesos({ ...pesos, [l.id]: g })} />
            {pesos[l.id] !== undefined && pesos[l.id]! < l.saldo && <span className="num mt-1 block text-sm text-[var(--ruim)]">{gramasTexto(l.saldo)} → {gramasTexto(pesos[l.id]!)} (−{gramasTexto(l.saldo - pesos[l.id]!)})</span>}
          </Campo>
        ))}
      </div>
    </Janela>
  )
}

/** Confirmação da unificação: o que entra, o total (peso e custo) e como fica o lote novo. */
function Unificar({ lotes, campos, onFechar, onFeito }: { lotes: Lote[]; campos: ReturnType<typeof useCamposModulo>; onFechar(): void; onFeito(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [motivo, setMotivo] = useState('')
  const { dados: regras } = useConsulta('codigos', {})
  const [digitar, setDigitar] = useState<boolean>()
  const [codigo, setCodigo] = useState('')
  const [codigoOk, setCodigoOk] = useState(true)
  const marcarCodigo = useCallback((ok: boolean) => setCodigoOk(ok), [])
  const digitarCodigo = digitar ?? regras?.regras.lote.modo === 'manual'
  const m = moedaPadrao()
  const total = lotes.reduce((s, l) => s + l.saldo, 0)
  const custo = lotes.reduce((s, l) => s + (l.custo ?? 0), 0)
  const resultado = resumoCampos(campos, camposUnificados(campos, lotes.map((l) => l.campos)))
  const compras = [...new Set(lotes.flatMap((l) => l.compras.map((c) => [c.codigo, c.fornecedor].filter(Boolean).join(' · '))))]
  return (
    <Janela aberta larga titulo={<span className="inline-flex items-center">{t('Unificar {n} lotes', { n: lotes.length })}<Info texto={DICA_JUNTAR} /></span>} onFechar={onFechar} rodape={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="num text-sm text-[var(--suave)]">{t('Vira 1 lote de')} <b className="text-[var(--texto)]">{gramasTexto(total)}</b></span>
        <div className="flex gap-2">
          <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
          <Botao grande disabled={ocupado || (digitarCodigo && !codigoOk)} onClick={async () => { const r = await executar('triarLotes', { id, ids: lotes.map((l) => l.id), motivo, codigo: digitarCodigo ? codigo.trim() || undefined : undefined }, t('Lotes juntados.')); if (r) (onFechar(), onFeito()) }}>🔗 {t('Unificar')}</Botao>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <div className="rounded-xl bg-[var(--fundo)] p-3">
          <CampoCodigo tipo="lote" rotulo="Código do lote juntado" valor={codigo} onChange={setCodigo} bloqueado={!digitarCodigo} contexto={{ comprasUnificadas: [...new Set(lotes.flatMap((l) => l.compras.map((c) => c.id)))] }} onEstado={marcarCodigo} />
          {regras?.regras.lote.modo !== 'manual' && <button type="button" className="min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => (setDigitar(!digitarCodigo), setCodigo(''))}>{digitarCodigo ? t('Usar o código automático') : `✎ ${t('Digitar outro código')}`}</button>}
        </div>
        <ul className="divide-y divide-[var(--borda)] rounded-xl border border-[var(--borda)]">
          {lotes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
              <span className="min-w-0"><span className="font-mono text-xs">{l.codigo}</span> · <b>{l.nome}</b><span className="block text-xs text-[var(--suave)]">{origemTexto(l, t)}</span></span>
              <span className="num whitespace-nowrap">{gramasTexto(l.saldo)}{l.custo !== undefined ? ` · ${formatar(l.custo, m)}` : ''}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--fundo)] p-3"><div className="text-xs text-[var(--suave)]">{t('Peso total')}</div><div className="num whitespace-nowrap text-xl font-black">{gramasTexto(total)}</div></div>
          <div className="rounded-xl bg-[var(--fundo)] p-3"><div className="text-xs text-[var(--suave)]">{t('Custo total')}</div><div className="num whitespace-nowrap text-xl font-black">{formatar(custo, m)}</div></div>
          <div className="rounded-xl bg-[var(--fundo)] p-3"><div className="text-xs text-[var(--suave)]">{t('Custo por kg')}</div><div className="num whitespace-nowrap text-xl font-black">{total ? formatar(Math.round((custo * 1000) / total), m) : '—'}</div></div>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-bold">{t('Como fica o lote novo')}</h3>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            {resultado.map((a) => <div key={a.id} className="contents"><dt className="text-[var(--suave)]">{t(a.nome)}</dt><dd className="font-semibold">{t(a.valor)}</dd></div>)}
            <dt className="text-[var(--suave)]">{t('Compras')}</dt><dd className="font-semibold">{compras.join(' + ') || '—'}</dd>
          </dl>
          <p className="mt-1 text-xs text-[var(--suave)]">{t('O que é igual em todos fica; o que é diferente vira “Misturado” (ou fica vazio). Dá para editar depois.')}</p>
        </div>
        <Campo rotulo="Motivo (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: mesma qualidade, lavar junto')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <p className="text-xs text-[var(--suave)]">{t('Os lotes de origem ficam zerados e o lote novo guarda de onde veio cada grama (compras, quem e quando).')}</p>
      </div>
    </Janela>
  )
}

/** TRIAGENS FEITAS: cada T-id com data, quem, compras que entraram, lotes que saíram, perda e as vendas depois. */
function ListaTriagens({ aberta, resumo }: { aberta?: string; resumo?: ReactNode }) {
  const t = useT()
  const { ir, ajustarParams } = useApp()
  const { dados } = useConsulta('triagens', { moduloId: 'cabelo' })
  if (!dados) return <Carregando />
  return <div className="space-y-3">{resumo}<ListaTriagensItens dados={dados} aberta={aberta} t={t} ir={ir} ajustarParams={ajustarParams} /></div>
}

function ListaTriagensItens({ dados, aberta, t, ir, ajustarParams }: { dados: ResultadoConsulta<'triagens'>; aberta?: string; t: T; ir: ReturnType<typeof useApp>['ir']; ajustarParams: ReturnType<typeof useApp>['ajustarParams'] }) {
  if (!dados.length) return <p className="rounded-xl border border-dashed border-[var(--borda)] p-6 text-center text-sm text-[var(--suave)]">{t('Nenhuma triagem ainda. Selecione lotes no quadro e toque em “Separar” ou “Juntar e separar”.')}</p>
  return (
    <ul className="space-y-2">
      {dados.map((x) => {
        const abrir = aberta === x.id
        return (
          <li key={x.id} className={cx('rounded-2xl border bg-[var(--cartao)] p-3 shadow-sm', abrir ? 'border-[var(--marca)]' : 'border-[var(--borda)]')}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b className="text-lg">✂️ {x.codigo}</b>
              <span className="text-sm text-[var(--suave)]">{dataBR(x.em)}{x.por ? ` · ${x.por}` : ''}</span>
              <span className="num ml-auto whitespace-nowrap text-sm"><b>{gramasTexto(x.pesoEntrada)}</b> → <b>{gramasTexto(x.pesoSaida)}</b> · <span className={x.perda > 0 ? 'text-[var(--ruim)]' : 'text-[var(--suave)]'}>{t('perda')} {gramasTexto(x.perda)} ({fmt(x.perdaPct, 'percentual')})</span></span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
              <CadeiaChips cadeia={{ compras: x.compras, triagens: [], vendas: [] }} max={4} />
              <span aria-hidden className="text-[var(--suave)]">→</span>
              {x.saidas.map((s) => <button key={s.id} type="button" onClick={() => ir('lote', { id: s.id })} className="min-h-8 rounded-full bg-[var(--fundo)] px-2 text-xs font-semibold hover:bg-[var(--marca-suave)]">📦 {s.codigo} · <span className="num">{gramasTexto(s.g)}</span></button>)}
              {x.vendas.length > 0 && <><span aria-hidden className="text-[var(--suave)]">→</span><CadeiaChips cadeia={{ compras: [], triagens: [], vendas: x.vendas }} max={4} /></>}
            </div>
            <button type="button" aria-expanded={abrir} onClick={() => ajustarParams({ t: abrir ? undefined : x.id })} className="mt-2 min-h-10 text-sm font-semibold text-[var(--marca)]">{abrir ? t('Fechar o rastreio') : t('Ver o rastreio completo (gramas)')}</button>
            {abrir && <RastreioDaTriagem id={x.id} />}
          </li>
        )
      })}
    </ul>
  )
}

function RastreioDaTriagem({ id }: { id: string }) {
  const { dados } = useConsulta('genealogia', { triagemId: id })
  return dados ? <div className="mt-2"><RastreioTotal g={dados} /></div> : <Carregando />
}
