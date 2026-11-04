// TABELAS DE PREÇO com VERSÕES.
//  #/precos        lista: um cartão por tabela (nome, padrão/categoria, faixa de fatores, medidas · compradores · vendas · compras, última versão)
//  #/precos/:id    tela da tabela: UMA grade editável (toque no número e digite) + Histórico (versões e comparação)
//  #/precos/novo   nova tabela
// Toda alteração publica uma versão nova (barra "3 mudanças · Publicar v3"); as anteriores ficam guardadas e dá para
// comparar quaisquer duas ("era X → ficou Y"). Vendas e compras guardam o fator que usaram: o passado não muda.

import { Fragment, useRef, useState } from 'react'
import { fatorValido, formatar, moeda } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { TabelaPreco } from '../core/domain/tipos'
import { chaveCelula } from '../core/services/precos'
import { Abas, Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, Escolha, Info, Janela, Pilula, Selecao, Vazio, cx, dataBR, gramasTexto, loc, moedaPadrao, diaCurto } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela, useFiltrosTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { Trilha } from '../ui/trilha'
import { MenuAcoes, type Acao } from '../ui/menuAcoes'
import { Historico } from './PrecosHistorico'
import { NumeroGrande } from '../ui/numeroGrande'
import { BarraFiltros, CampoFaixa, ChipsFiltros, GrupoFiltro, PainelFiltros } from '../ui/filtroPadrao'
import {
  type Alvo, adicionarColuna, adicionarMedidas, ajustarPct, chave, comValor, contarMudancas, copiarColuna, invalidos, moverColuna,
  precosDaColuna, precosDaMedida, preencherVazios, tirarColuna, tirarMedida, trocarMedida,
} from '../ui/tabelaPrecoEdicao'

type Rascunho = Pick<TabelaPreco, 'id' | 'moduloId' | 'nome' | 'categoria' | 'validaDesde' | 'moeda' | 'unidadeMedida' | 'fatorPor' | 'linhas' | 'colunas' | 'valores'>
type T = ReturnType<typeof useT>
const CATEGORIAS = ['Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque']

/** como o preço sai da tabela (tooltip com exemplos variados) */
const AJUDA_CONTA =
  'Como calcula: valor = gramas × fator. O fator é o número da tabela no cruzamento da medida (linha) com o comprador (coluna). Ex.: 40 cm, 2.000 g × 3,5 = Bs 7.000. Ex.: 60 cm para Helena (fator 16), 500 g × 16 = Bs 8.000. Ex.: 80 cm para Henrique (fator 20), 1,2 kg = 1.200 g × 20 = Bs 24.000. Ex.: 50 cm, 150 g × 6 = Bs 900. Célula com “–” = sem preço: digite o valor na hora da venda.'
/** versões: toda mudança publica uma nova e dá para comparar */
const AJUDA_VERSOES =
  'A tabela tem VERSÕES. Toda vez que você muda e publica, nasce uma versão nova (v1, v2, v3…) e a anterior fica guardada. Em Histórico você compara quaisquer duas e vê o que mudou: o que subiu, desceu, entrou ou saiu. Vendas e compras guardam o fator e a versão que usaram, então mudar a tabela não muda o passado. Ex.: v1 tinha 60 cm × Henrique = 17; a v2 subiu para 17,5 → as vendas antigas continuam com 17.'

function rascunhoDe(tb: TabelaPreco | undefined, t: T): Rascunho {
  return tb
    ? { id: tb.id, moduloId: tb.moduloId, nome: tb.nome, categoria: tb.categoria, validaDesde: tb.validaDesde, moeda: tb.moeda, unidadeMedida: tb.unidadeMedida, fatorPor: tb.fatorPor, valores: { ...tb.valores }, colunas: tb.colunas.map((c) => ({ ...c })), linhas: [...tb.linhas] }
    : { id: novoId(), moduloId: 'cabelo', nome: t('Nova tabela'), moeda: moedaPadrao(), unidadeMedida: 'cm', fatorPor: 'grama', validaDesde: dataLocal(), linhas: [40, 50, 55, 60, 70, 80, 90, 100], colunas: [{ id: 'c1', nome: t('Comprador {n}', { n: 1 }) }], valores: {} }
}

// ---------- lista ----------

export function Precos() {
  const t = useT()
  const { ir, nav } = useApp()
  const { dados } = useConsulta('tabelasPreco', {})
  // key: trocar de tabela (ou ir para "novo") recomeça o rascunho do zero
  if (nav.params.id || nav.tela === 'tabelaPreco') return <TabelaTela key={String(nav.params.id)} />
  const nova = () => ir('tabelaPreco', { id: 'novo' })
  // a geral (sem categoria) primeiro: é a padrão; depois as das categorias
  const lista = [...(dados ?? [])].sort((a, b) => Number(!!a.categoria) - Number(!!b.categoria))
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t('Tabelas de preço')}</h1>
          {/* as duas regras da tela, curtas; o detalhe com exemplos fica no ⓘ */}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--suave)]">
            <span className="inline-flex items-center">🧮 {t('Como calcula o preço')}<Info texto={AJUDA_CONTA} /></span>
            <span className="inline-flex items-center">🕓 {t('Versões e comparação')}<Info texto={AJUDA_VERSOES} /></span>
          </p>
        </div>
        {!!dados?.length && <Botao className="shrink-0" onClick={nova}>+ {t('Tabela')}</Botao>}
      </div>
      {!dados ? <Carregando /> : !dados.length ? (
        <Vazio texto="Nenhuma tabela ainda.">
          <p className="mb-3">{t('Uma tabela diz o fator por medida e comprador: 60 cm × Helena = 16 → valor = gramas × 16.')}</p>
          <Botao onClick={nova}>+ {t('Criar a primeira tabela')}</Botao>
        </Vazio>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((tb) => <CartaoTabela key={tb.id} tb={tb} />)}
        </div>
      )}
    </div>
  )
}

/** menor e maior fator da tabela (só os preenchidos e válidos) */
function faixaDe(tb: TabelaPreco): [number, number] | undefined {
  const ns = Object.values(tb.valores).filter((v) => fatorValido(v)).map((v) => Number(String(v).replace(',', '.')))
  return ns.length ? [Math.min(...ns), Math.max(...ns)] : undefined
}

function CartaoTabela({ tb }: { tb: TabelaPreco }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('tabelaPreco', { id: tb.id })
  const v = dados?.versoes[0]
  const faixa = faixaDe(tb)
  const n = (x: number) => x.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const simbolo = moeda(tb.moeda).simbolo
  const porQue = tb.fatorPor === 'grama' ? '/g' : `/${t('un.')}`
  const medidas = [...tb.linhas].sort((a, b) => a - b)
  const stats: [string, number | undefined][] = [
    ['Medidas', tb.linhas.length],
    ['Compradores', tb.colunas.length],
    ['Vendas', dados?.totalVendas],
    ['Compras', dados?.totalCompras],
  ]
  // PRÉVIA EM MAPA DE CALOR: a grade (medida × comprador) em quadradinhos; mais escuro = fator maior; vazio = sem preço.
  // Bate o olho e vê onde a tabela tem preço e como ele sobe com a medida — sem abrir.
  const colsPrevia = tb.colunas.slice(0, 12)
  const linhasPrevia = medidas.slice(0, 10)
  const intensidade = (val?: string) => {
    if (!faixa || !val || !fatorValido(val)) return 0
    const x = Number(String(val).replace(',', '.'))
    return faixa[1] === faixa[0] ? 1 : 0.2 + (0.8 * (x - faixa[0])) / (faixa[1] - faixa[0])
  }
  return (
    <button type="button" onClick={() => ir('tabelaPreco', { id: tb.id })} className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)] hover:shadow-md">
      <div className="flex w-full items-start gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold leading-tight [overflow-wrap:anywhere]">{tb.nome}</span>
            {tb.categoria ? <Pilula tom="marca">{t(tb.categoria)}</Pilula> : <Pilula tom="bom">★ {t('Padrão')}</Pilula>}
          </div>
          {v && <p className="mt-0.5 truncate text-xs text-[var(--suave)]"><b className="text-[var(--marca)]">v{v.numero}</b> · {t('mudou em {d}', { d: diaCurto(v.em) })}{v.nota ? ` · “${v.nota}”` : ''}</p>}
        </div>
        <span aria-hidden className="text-2xl leading-none text-[var(--suave)] group-hover:text-[var(--marca)]">›</span>
      </div>
      {/* faixa de preço como barra: do mais barato ao mais caro */}
      <div className="px-4">
        {faixa ? (
          <div className="num">
            <div className="flex items-baseline justify-between text-sm"><b>{simbolo} {n(faixa[0])}</b><span className="text-xs text-[var(--suave)]">{porQue}</span><b>{simbolo} {n(faixa[1])}</b></div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--marca) 20%, transparent), var(--marca))' }} />
            {medidas.length > 0 && <div className="mt-0.5 flex justify-between text-[11px] text-[var(--suave)]"><span>{medidas[0]} {tb.unidadeMedida}</span><span>{medidas[medidas.length - 1]} {tb.unidadeMedida}</span></div>}
          </div>
        ) : <p className="text-sm text-[var(--suave)]">{t('sem preços ainda')}</p>}
      </div>
      {linhasPrevia.length > 0 && colsPrevia.length > 0 && (
        <div aria-hidden className="mx-4 mt-3 overflow-hidden rounded-xl bg-[var(--fundo)] p-2">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `2rem repeat(${colsPrevia.length}, minmax(0, 1fr))` }}>
            {linhasPrevia.map((l) => (
              <Fragment key={l}>
                <span className="num pr-1 text-right text-[9px] leading-3 text-[var(--suave)]">{l}</span>
                {colsPrevia.map((c) => {
                  const a = intensidade(tb.valores[chaveCelula(l, c.id)])
                  return <span key={c.id} className="h-3 rounded-[3px]" style={{ background: a ? `color-mix(in srgb, var(--marca) ${Math.round(a * 100)}%, transparent)` : 'var(--borda)', opacity: a ? 1 : 0.5 }} />
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--borda)] px-4 py-2.5">
        {stats.map(([rotulo, valor]) => (
          <Pilula key={rotulo} tom={valor ? 'marca' : 'suave'}><b>{valor ?? '…'}</b> <span className="font-normal">{t(rotulo).toLowerCase()}</span></Pilula>
        ))}
      </div>
    </button>
  )
}

// ---------- tela da tabela ----------

type Direcao = 'direita' | 'esquerda' | 'baixo' | 'cima'
type Ferramenta = { tipo: 'pct' | 'copiar' | 'preencher'; alvo?: Alvo; para?: string }

function TabelaTela() {
  const t = useT()
  const { nav, ir, voltar, marcarSujo, avisar } = useApp()
  const { executar, ocupado } = useComando()
  const id = nav.params.id as string
  const novo = id === 'novo'
  const { dados, erro } = useConsulta('tabelaPreco', { id }, !novo)
  const [abaUrl, setAba] = useParamTela<string>('aba', 'tabela')
  // links antigos (?aba=versoes / comparar / editar) continuam abrindo o lugar certo
  const aba = novo ? 'tabela' : ['versoes', 'comparar', 'historico'].includes(abaUrl) ? 'historico' : 'tabela'
  const [ver, setVer] = useParamTela<'grade' | 'medida'>('ver', 'grade')
  const tb = dados?.tabela
  const [inicial] = useState(() => (novo ? rascunhoDe(undefined, t) : undefined))
  // rascunho + pilha para o "Desfazer" (um passo por vez)
  const [est, setEst] = useState<{ r?: Rascunho; pilha: Rascunho[] }>({ r: inicial, pilha: [] })
  const [nota, setNota] = useState('')
  const [edit, setEditState] = useState<{ k: string; texto: string }>()
  const editRef = useRef<{ k: string; texto: string }>()
  const setEdit = (e?: { k: string; texto: string }) => ((editRef.current = e), setEditState(e))
  const [janela, setJanela] = useState<null | { tipo: 'medida' } | { tipo: 'trocarMedida'; l: number } | { tipo: 'comprador'; id?: string } | { tipo: 'detalhes' } | { tipo: 'ferramenta'; f: Ferramenta }>(null)
  const [tirar, setTirar] = useState<null | { tipo: 'medida'; l: number; n: number } | { tipo: 'coluna'; id: string; nome: string; n: number }>(null)
  const [editandoNome, setEditandoNome] = useState<string>()

  const base = tb ? rascunhoDe(tb, t) : undefined
  const g: Rascunho | undefined = est.r ?? base
  const m = g ? contarMudancas(base, g) : { total: 0, precos: 0, estrutura: 0 }
  const sujo = novo || m.total > 0
  const ruins = g ? invalidos(g) : []
  useAvisoSaida(!!g && sujo && (novo ? est.pilha.length > 0 : true))
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!g || (!novo && !dados)) return <Carregando />
  const versoes = dados?.versoes ?? []
  const atual = dados?.atual ?? 0

  const mudar = (f: (x: Rascunho) => Rascunho | undefined) =>
    setEst((s) => {
      const de = s.r ?? base!
      const para = f(de)
      if (!para || JSON.stringify(para) === JSON.stringify(de)) return s
      return { r: para, pilha: [...s.pilha, de].slice(-100) }
    })
  const desfazer = () => setEst((s) => (s.pilha.length ? { r: s.pilha[s.pilha.length - 1], pilha: s.pilha.slice(0, -1) } : s))
  const descartar = () => (setEst({ r: novo ? inicial : undefined, pilha: [] }), setNota(''))

  // ----- edição célula a célula -----
  const gravar = (k: string, texto: string) => mudar((x) => comValor(x, k, texto))
  const proxima = (k: string, d: Direcao): string | undefined => {
    const [ls, c] = k.split('|')
    const i = g.linhas.indexOf(Number(ls))
    const j = g.colunas.findIndex((x) => x.id === c)
    const L = g.linhas.length
    const C = g.colunas.length
    // na visão "por medida" a lista é vertical: descer = próximo comprador
    const dir = ver === 'medida' && (d === 'baixo' || d === 'cima') ? (d === 'baixo' ? 'direita' : 'esquerda') : d
    let p: [number, number] | undefined
    if (dir === 'direita') p = j + 1 < C ? [i, j + 1] : i + 1 < L ? [i + 1, 0] : undefined
    if (dir === 'esquerda') p = j > 0 ? [i, j - 1] : i > 0 ? [i - 1, C - 1] : undefined
    if (dir === 'baixo') p = i + 1 < L ? [i + 1, j] : j + 1 < C ? [0, j + 1] : undefined
    if (dir === 'cima') p = i > 0 ? [i - 1, j] : j > 0 ? [L - 1, j - 1] : undefined
    return p ? chave(g.linhas[p[0]], g.colunas[p[1]].id) : undefined
  }
  const abrir = (k?: string) => setEdit(k ? { k, texto: g.valores[k] ?? '' } : undefined)
  const celula = {
    edit,
    setTexto: (texto: string) => edit && setEdit({ ...edit, texto }),
    abrir,
    /** Enter/Tab: grava e vai para a próxima; Esc: cancela; sair do campo: grava */
    tecla(e: React.KeyboardEvent<HTMLInputElement>) {
      const cur = editRef.current
      if (!cur) return
      if (e.key === 'Escape') return e.preventDefault(), e.stopPropagation(), setEdit(undefined)
      if (e.key !== 'Enter' && e.key !== 'Tab') return
      e.preventDefault()
      gravar(cur.k, cur.texto)
      abrir(proxima(cur.k, e.key === 'Tab' ? (e.shiftKey ? 'esquerda' : 'direita') : e.shiftKey ? 'cima' : 'baixo'))
    },
    sair(k: string) {
      const cur = editRef.current
      if (cur?.k !== k) return
      gravar(cur.k, cur.texto)
      setEdit(undefined)
    },
  }

  // ----- menus de linha e coluna -----
  const pedirTirarMedida = (l: number) => {
    const n = precosDaMedida(g, l)
    if (n) setTirar({ tipo: 'medida', l, n })
    else mudar((x) => tirarMedida(x, l))
  }
  const pedirTirarColuna = (cid: string) => {
    const c = g.colunas.find((x) => x.id === cid)!
    if (g.colunas.length === 1) return avisar(t('A tabela precisa de pelo menos uma coluna (comprador).'), 'erro')
    const n = precosDaColuna(g, cid)
    if (n) setTirar({ tipo: 'coluna', id: cid, nome: c.nome, n })
    else mudar((x) => tirarColuna(x, cid))
  }
  const acoesMedida = (l: number): Acao[] => [
    { rotulo: 'Trocar a medida', icone: '✎', onClick: () => setJanela({ tipo: 'trocarMedida', l }) },
    { rotulo: 'Aumentar/diminuir % nesta medida', icone: '%', onClick: () => setJanela({ tipo: 'ferramenta', f: ferr('pct', { tipo: 'medidas', de: l, ate: l }) }) },
    { rotulo: 'Tirar a medida', icone: '×', perigo: true, separar: true, onClick: () => pedirTirarMedida(l) },
  ]
  const acoesColuna = (cid: string): Acao[] => {
    const j = g.colunas.findIndex((x) => x.id === cid)
    const a: Acao[] = [{ rotulo: 'Renomear / ligar a pessoa', icone: '✎', onClick: () => setJanela({ tipo: 'comprador', id: cid }) }]
    if (j > 0) a.push({ rotulo: '← Mover para a esquerda', icone: '', onClick: () => mudar((x) => moverColuna(x, cid, -1)) })
    if (j < g.colunas.length - 1) a.push({ rotulo: 'Mover para a direita →', icone: '', onClick: () => mudar((x) => moverColuna(x, cid, 1)) })
    a.push({ rotulo: 'Aumentar/diminuir % neste comprador', icone: '%', separar: true, onClick: () => setJanela({ tipo: 'ferramenta', f: ferr('pct', { tipo: 'coluna', colunaId: cid }) }) })
    a.push({ rotulo: 'Copiar preços de outro comprador', icone: '⧉', onClick: () => setJanela({ tipo: 'ferramenta', f: ferr('copiar', undefined, cid) }) })
    a.push({ rotulo: 'Tirar o comprador', icone: '×', perigo: true, separar: true, onClick: () => pedirTirarColuna(cid) })
    return a
  }

  const publicar = async () => {
    const res = await executar('salvarTabelaPreco', { ...g, nota }, t('Versão publicada.'))
    if (!res) return
    marcarSujo(false)
    setEst({ r: undefined, pilha: [] })
    setNota('')
    setEdit(undefined)
    if (novo) ir('tabelaPreco', { id: res.id })
  }

  const nome = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {editandoNome !== undefined ? (
        <Entrada
          autoFocus
          focoSempre
          aria-label={t('Nome')}
          className="max-w-md text-xl font-bold"
          value={editandoNome}
          onChange={(e) => setEditandoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditandoNome(undefined)
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          }}
          onBlur={() => {
            if (editandoNome?.trim()) mudar((x) => ({ ...x, nome: editandoNome.trim() }))
            setEditandoNome(undefined)
          }}
        />
      ) : (
        <h1 className="min-w-0 text-2xl font-bold leading-tight">
          <button type="button" onClick={() => setEditandoNome(g.nome)} className="group inline-flex items-center gap-2 rounded-lg text-left hover:text-[var(--marca)]" aria-label={`${g.nome} · ${t('Mudar o nome')}`}>
            <span className="[overflow-wrap:anywhere]">{g.nome}</span>
            <span aria-hidden className="text-base text-[var(--suave)] group-hover:text-[var(--marca)]">✎</span>
          </button>
        </h1>
      )}
      {/* categoria: rótulo claro + ✎ (tocar troca ou cria outra) e o ⓘ explica para que serve */}
      <span className="inline-flex items-center">
        <button type="button" onClick={() => setJanela({ tipo: 'detalhes' })} className={cx('inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm', g.categoria ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
          <span className="text-[var(--suave)]">{t('Categoria')}:</span> <b>{g.categoria ? t(g.categoria) : `${t('Normal')} (${t('geral')})`}</b> <span aria-hidden className="text-[var(--suave)]">✎</span>
        </button>
        <Info texto="Categoria: para qual tipo de cabelo esta tabela vale. Toque para trocar ou criar outra (Tinte, CH, Platinado…). Ex.: pacote 60 cm Tinte → usa a tabela Tinte; sem ela, usa a Normal." />
      </span>
    </div>
  )

  return (
    <div className={cx(sujo && 'pb-4')}>
      <Trilha atual={novo ? t('Nova tabela') : g.nome} />
      <div className="mb-3">
        {nome}
        <p className="mt-1 flex flex-wrap items-center text-sm text-[var(--suave)]">
          {novo ? t('Nova tabela · vai publicar a v1') : <><b className="text-[var(--marca)]">{t('versão')} v{atual}</b>&nbsp;· {t('vale desde {d}', { d: diaCurto(g.validaDesde) })}{tb && tb.moeda !== moedaPadrao() ? ` · ${tb.moeda}` : ''}</>}
          <Info texto={AJUDA_VERSOES} />
        </p>
      </div>
      {!novo && <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a)} abas={[{ id: 'tabela', nome: 'Tabela', extra: sujo ? <Pilula key="r" tom="alerta">{t('não publicado')}</Pilula> : undefined }, { id: 'historico', nome: 'Histórico', extra: <Pilula key="v">{versoes.length}</Pilula> }]} />}

      {aba === 'tabela' && (
        <div className="space-y-3">
          {/* barra de ferramentas da grade */}
          <div className="flex flex-wrap items-center gap-2">
            <Botao variante="secundario" onClick={() => setJanela({ tipo: 'medida' })}>+ {t('Medida')}</Botao>
            <Botao variante="secundario" onClick={() => setJanela({ tipo: 'comprador' })}>+ {t('Comprador')}</Botao>
            <Botao variante="leve" onClick={() => setJanela({ tipo: 'ferramenta', f: ferr('pct') })}>⋯ {t('Ferramentas')}</Botao>
            <span className="ml-auto inline-flex items-center text-xs text-[var(--suave)]">
              <span className="hidden sm:inline">{t('Toque no número para mudar · como calcula')}</span>
              <Info texto={AJUDA_CONTA} />
            </span>
          </div>
          {/* como ler a grade (uma linha): medida na esquerda, comprador em cima, o número é o fator */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[var(--fundo)] px-3 py-2 text-xs text-[var(--suave)]">
            <span>↓ <b className="text-[var(--texto)]">{t('Medida')}</b> ({tb?.unidadeMedida ?? 'cm'})</span>
            <span>→ <b className="text-[var(--texto)]">{t('Comprador')}</b> <span aria-hidden>👤</span> = {t('ligado a uma pessoa')}</span>
            <span><b className="text-[var(--texto)]">{t('Número')}</b> = {t('fator')} ({moeda(g.moeda).simbolo} {t(g.fatorPor === 'grama' ? 'por grama' : 'por unidade')})</span>
            <span><b className="text-[var(--texto)]">–</b> = {t('sem preço')}</span>
          </div>
          {g.colunas.length > 2 && (
            <div className="md:hidden">
              <Escolha<'grade' | 'medida'> rotulo="Ver" valor={ver} onChange={setVer} opcoes={[{ id: 'grade', nome: 'Grade' }, { id: 'medida', nome: 'Por medida' }]} />
            </div>
          )}

          <div className={cx(ver === 'medida' && g.colunas.length > 2 && 'hidden md:block')}>
            <GradeEditavel g={g} base={base} baixa={sujo} celula={celula} acoesMedida={acoesMedida} acoesColuna={acoesColuna} onMedida={() => setJanela({ tipo: 'medida' })} onComprador={() => setJanela({ tipo: 'comprador' })} />
          </div>
          {ver === 'medida' && g.colunas.length > 2 && (
            <div className="space-y-3 md:hidden">
              {g.linhas.map((l) => (
                <section key={l} className={cx('rounded-2xl border bg-[var(--cartao)] p-3', base && !base.linhas.includes(l) ? 'border-[var(--bom)]' : 'border-[var(--borda)]')}>
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-lg font-bold">{l} cm <span className="text-xs font-normal text-[var(--suave)]">· {precosDaMedida(g, l)}/{g.colunas.length}</span></h2>
                    <MenuAcoes acoes={acoesMedida(l)} rotulo={t('Medida {n} cm', { n: l })} />
                  </div>
                  <ul className="divide-y divide-[var(--borda)]">
                    {g.colunas.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className="min-w-0 truncate text-sm">{c.nome}</span>
                        <Celula k={chave(l, c.id)} rotulo={`${l} cm · ${c.nome}`} valor={g.valores[chave(l, c.id)]} antes={base?.valores[chave(l, c.id)]} comBase={!!base} c={celula} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <Botao variante="secundario" className="w-full" onClick={() => setJanela({ tipo: 'medida' })}>+ {t('Medida')}</Botao>
            </div>
          )}

          {tb && dados!.usos.length > 0 && <UsadaEm usos={dados!.usos} total={dados!.totalUsos} moeda={tb.moeda} />}
        </div>
      )}

      {aba === 'historico' && <Historico id={id} versoes={versoes} />}

      {/* barra do rascunho: só aparece quando algo mudou */}
      {(sujo || ocupado) && (
        <div className="sticky bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-20 mt-4 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-3 shadow-lg md:bottom-4">
          <div className="flex flex-wrap items-center gap-2">
            <span role="status" className="mr-auto text-sm font-semibold text-[var(--marca)]">
              ● {novo ? t('Tabela nova') : t('{n} mudança(s)', { n: m.total })}
              {ruins.length > 0 && <span className="block text-xs font-normal text-[var(--ruim)]">{t('{n} valor(es) inválido(s): use números como 3,5.', { n: ruins.length })}</span>}
            </span>
            <Botao variante="leve" disabled={!est.pilha.length} onClick={desfazer}>↶ {t('Desfazer')}</Botao>
            {!novo && <Botao variante="leve" className="hidden sm:inline-block" onClick={descartar}>{t('Descartar tudo')}</Botao>}
            <Botao disabled={ocupado || ruins.length > 0 || (!novo && !m.total)} onClick={publicar}>{novo ? t('Criar tabela') : t('Publicar v{n}', { n: atual + 1 })}</Botao>
          </div>
          <Entrada className="mt-2" aria-label={t('O que mudou e por quê (opcional)')} placeholder={t('O que mudou e por quê (opcional)')} value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      )}

      {janela?.tipo === 'medida' && (
        <JanelaMedida titulo={t('Nova medida')} onFechar={() => setJanela(null)} onOk={(txt) => {
          const { novas } = adicionarMedidas(g, txt)
          if (!novas.length) return t('Essa medida já existe ou não é um número.')
          mudar((x) => adicionarMedidas(x, txt).grade)
        }} />
      )}
      {janela?.tipo === 'trocarMedida' && (
        <JanelaMedida titulo={t('Trocar a medida {n} cm', { n: janela.l })} inicial={String(janela.l)} uma onFechar={() => setJanela(null)} onOk={(txt) => {
          const x = trocarMedida(g, janela.l, Number(txt.replace(',', '.')))
          if (!x) return t('Essa medida já existe ou não é um número.')
          mudar((y) => trocarMedida(y, janela.l, Number(txt.replace(',', '.'))))
        }} />
      )}
      {janela?.tipo === 'comprador' && (
        <JanelaComprador coluna={g.colunas.find((c) => c.id === janela.id)} numero={g.colunas.length + 1} onFechar={() => setJanela(null)} onOk={(c) => mudar((x) => (janela.id ? { ...x, colunas: x.colunas.map((y) => (y.id === janela.id ? { ...y, ...c } : y)) } : adicionarColuna(x, { id: novoId().slice(-6).toLowerCase(), ...c })))} />
      )}
      {janela?.tipo === 'detalhes' && <JanelaDetalhes g={g} onFechar={() => setJanela(null)} onOk={(d) => mudar((x) => ({ ...x, ...d }))} />}
      {janela?.tipo === 'ferramenta' && (
        <Ferramentas g={g} inicial={janela.f} onFechar={() => setJanela(null)} onAplicar={(grade, n) => {
          mudar(() => grade)
          avisar(t('{n} preço(s) mudado(s) no rascunho. Confira e publique.', { n }), 'ok')
        }} />
      )}
      {tirar && (
        <Confirmar
          titulo={tirar.tipo === 'medida' ? t('Tirar a medida {n} cm?', { n: tirar.l }) : t('Tirar o comprador {nome}?', { nome: tirar.nome })}
          texto={t('Tem {n} preço(s). Eles saem da próxima versão; as versões antigas ficam guardadas e as vendas feitas não mudam.', { n: tirar.n })}
          rotulo="Tirar"
          perigo
          onFechar={() => setTirar(null)}
          onConfirmar={() => mudar((x) => (tirar.tipo === 'medida' ? tirarMedida(x, tirar.l) : tirarColuna(x, tirar.id)))}
        />
      )}
    </div>
  )
}

function ferr(tipo: Ferramenta['tipo'], alvo?: Alvo, para?: string): Ferramenta {
  return { tipo, alvo, para }
}

// ---------- célula ----------

interface CelulaCtl {
  edit?: { k: string; texto: string }
  setTexto(t: string): void
  abrir(k: string): void
  tecla(e: React.KeyboardEvent<HTMLInputElement>): void
  sair(k: string): void
}

/** Um preço: mostra o número (ou "–"); toque → campo. Mudou em relação à versão publicada → destaque + "era 15". */
function Celula({ k, rotulo, valor, antes, comBase, c }: { k: string; rotulo: string; valor?: string; antes?: string; comBase: boolean; c: CelulaCtl }) {
  const t = useT()
  const mudou = comBase && (antes ?? '') !== (valor ?? '')
  const ruim = !!valor && !fatorValido(valor)
  if (c.edit?.k === k)
    return (
      <input
        autoFocus
        aria-label={rotulo}
        inputMode="decimal"
        enterKeyHint="next"
        value={c.edit.texto}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => c.setTexto(e.target.value)}
        onKeyDown={c.tecla}
        onBlur={() => c.sair(k)}
        className={cx('num h-12 w-[4.75rem] rounded-lg bg-[var(--cartao)] text-center text-base font-bold outline-none ring-2', c.edit.texto.trim() && !fatorValido(c.edit.texto.trim()) ? 'ring-[var(--ruim)]' : 'ring-[var(--marca)]')}
      />
    )
  return (
    <button
      type="button"
      aria-label={`${rotulo}: ${valor || t('sem preço')}${mudou ? ` (${t('era {v}', { v: antes || '–' })})` : ''}`}
      onClick={() => c.abrir(k)}
      className={cx('num flex h-12 w-[4.75rem] flex-col items-center justify-center rounded-lg leading-tight hover:ring-1 hover:ring-[var(--marca)]', mudou && 'bg-[var(--marca-suave)]', ruim && 'bg-[var(--ruim)]/10')}
    >
      <span className={cx(!valor ? 'text-[var(--suave)] opacity-40' : mudou ? 'font-bold text-[var(--marca)]' : 'font-semibold', ruim && 'text-[var(--ruim)]')}>{valor || '–'}</span>
      {mudou && <span className="text-[10px] text-[var(--suave)]">{t('era {v}', { v: antes || '–' })}</span>}
    </button>
  )
}

// ---------- grade editável ----------

function GradeEditavel({ g, base, baixa, celula, acoesMedida, acoesColuna, onMedida, onComprador }: { g: Rascunho; base?: Rascunho; baixa?: boolean; celula: CelulaCtl; acoesMedida(l: number): Acao[]; acoesColuna(id: string): Acao[]; onMedida(): void; onComprador(): void }) {
  const t = useT()
  return (
    // altura limitada: o cabeçalho (compradores) fica grudado ao rolar; com a barra de publicar aberta, fica mais baixa
    <div className={cx('overflow-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]', baixa ? 'max-h-[calc(100dvh-22rem)] min-h-[16rem] md:max-h-[calc(100dvh-19rem)]' : 'max-h-[calc(100dvh-15rem)] md:max-h-[calc(100dvh-13rem)]')}>
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-[var(--borda)] bg-[var(--fundo)] px-2 py-2 text-left text-xs font-semibold text-[var(--suave)]">{t('cm')}</th>
            {g.colunas.map((c) => (
              <th key={c.id} scope="col" className={cx('sticky top-0 z-20 min-w-[5.25rem] border-b border-[var(--borda)] bg-[var(--fundo)] py-1 pl-2 pr-0 text-left text-xs font-semibold', base && !base.colunas.some((x) => x.id === c.id) && 'text-[var(--bom)]')}>
                <div className="flex items-center justify-between gap-0.5">
                  <span className="max-w-[7rem] truncate" title={c.nome}>{c.nome}{c.pessoaId ? <span aria-hidden className="ml-0.5 text-[var(--suave)]">·👤</span> : null}</span>
                  <MenuAcoes acoes={acoesColuna(c.id)} rotulo={t('Comprador {nome}', { nome: c.nome })} />
                </div>
              </th>
            ))}
            <th className="sticky top-0 z-20 border-b border-[var(--borda)] bg-[var(--fundo)] px-1">
              <button type="button" onClick={onComprador} aria-label={t('Adicionar comprador')} title={t('Adicionar comprador')} className="h-10 w-10 rounded-xl text-lg font-bold text-[var(--marca)] hover:bg-[var(--marca-suave)]">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {g.linhas.map((l) => (
            <tr key={l}>
              <th scope="row" className={cx('sticky left-0 z-10 border-b border-r border-[var(--borda)] bg-[var(--cartao)] py-0 pl-2 pr-0 text-left', base && !base.linhas.includes(l) && 'text-[var(--bom)]')}>
                <div className="flex items-center gap-0.5">
                  <span className="num min-w-[2.25rem] text-base font-bold">{l}</span>
                  <MenuAcoes acoes={acoesMedida(l)} rotulo={t('Medida {n} cm', { n: l })} />
                </div>
              </th>
              {g.colunas.map((c) => {
                const k = chave(l, c.id)
                return (
                  <td key={c.id} className="border-b border-[var(--borda)] p-0.5 text-center">
                    <Celula k={k} rotulo={`${l} cm · ${c.nome}`} valor={g.valores[k]} antes={base?.valores[k]} comBase={!!base} c={celula} />
                  </td>
                )
              })}
              <td className="border-b border-[var(--borda)]" />
            </tr>
          ))}
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--cartao)] p-1 text-left">
              <button type="button" onClick={onMedida} className="min-h-10 rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">+ {t('Medida')}</button>
            </th>
            <td colSpan={g.colunas.length + 1} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ---------- janelas ----------

function JanelaMedida({ titulo, inicial, uma, onFechar, onOk }: { titulo: string; inicial?: string; uma?: boolean; onFechar(): void; onOk(txt: string): string | void }) {
  const t = useT()
  const [txt, setTxt] = useState(inicial ?? '')
  const [erro, setErro] = useState<string>()
  const ok = () => {
    const e = onOk(txt)
    if (e) return setErro(e)
    onFechar()
  }
  return (
    <Janela aberta titulo={titulo} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao><Botao disabled={!txt.trim()} onClick={ok}>{t(uma ? 'Trocar' : 'Adicionar')}</Botao></div>}>
      <Campo rotulo="Nova medida (cm)" ajuda={uma ? 'Os preços desta medida vão junto.' : 'Pode digitar várias: 65, 75, 85.'}>
        <Entrada autoFocus inputMode="decimal" placeholder="65" value={txt} onChange={(e) => (setTxt(e.target.value), setErro(undefined))} onKeyDown={(e) => e.key === 'Enter' && txt.trim() && ok()} />
      </Campo>
      {erro && <p className="mt-2 text-sm text-[var(--ruim)]">{erro}</p>}
    </Janela>
  )
}

function JanelaComprador({ coluna, numero, onFechar, onOk }: { coluna?: TabelaPreco['colunas'][number]; numero: number; onFechar(): void; onOk(c: { nome: string; pessoaId?: string }): void }) {
  const t = useT()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const [nome, setNome] = useState(coluna?.nome ?? '')
  const [pessoaId, setPessoaId] = useState(coluna?.pessoaId)
  const ok = () => {
    onOk({ nome: nome.trim() || t('Coluna {n}', { n: numero }), pessoaId })
    onFechar()
  }
  return (
    <Janela aberta titulo={t(coluna ? 'Comprador' : 'Novo comprador')} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao><Botao onClick={ok}>{t(coluna ? 'Pronto' : 'Adicionar')}</Botao></div>}>
      <div className="space-y-3">
        <Campo rotulo="Nome do comprador"><Entrada autoFocus value={nome} placeholder="Helena" onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok()} /></Campo>
        <Campo rotulo="Ligar a pessoa (opcional)" ajuda="Ligada a uma pessoa, ao vender para ela esta coluna vem sozinha." comoDiv>
          <Selecao valor={pessoaId} vazio="Ligar a pessoa…" onChange={(v) => {
            setPessoaId(v || undefined)
            const p = pessoas?.find((x) => x.id === v)
            if (p && !nome.trim()) setNome(p.nome)
          }} opcoes={(pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome }))} />
        </Campo>
      </div>
    </Janela>
  )
}

function JanelaDetalhes({ g, onFechar, onOk }: { g: Rascunho; onFechar(): void; onOk(d: Pick<Rascunho, 'nome' | 'categoria' | 'validaDesde'>): void }) {
  const t = useT()
  const [d, setD] = useState({ nome: g.nome, categoria: g.categoria, validaDesde: g.validaDesde })
  // categoria nova (não está na lista): digita e vira uma opção
  const [outra, setOutra] = useState(g.categoria && !CATEGORIAS.includes(g.categoria) ? g.categoria : '')
  const opcoes = ['', ...CATEGORIAS, ...(outra.trim() && !CATEGORIAS.includes(outra.trim()) ? [outra.trim()] : [])]
  return (
    <Janela aberta titulo={t('Categoria e vale desde')} onFechar={onFechar} rodape={<div className="flex justify-end gap-2"><Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao><Botao disabled={!d.nome.trim()} onClick={() => (onOk({ ...d, nome: d.nome.trim() }), onFechar())}>{t('Pronto')}</Botao></div>}>
      <div className="space-y-3">
        <Campo rotulo="Nome"><Entrada value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <div className="rounded-xl border border-[var(--marca)]/30 bg-[var(--marca-suave)] px-3 py-2 text-sm">
          💡 {t('A categoria diz para qual tipo de cabelo esta tabela vale. Na venda e na compra, o sistema usa a tabela da categoria do pacote.')}
          <span className="num mt-1 block text-xs font-semibold text-[var(--marca)]">{t('Ex.: pacote 60 cm Tinte → usa a tabela "Tinte"; sem tabela Tinte, usa a Normal (geral).')}</span>
        </div>
        <Campo rotulo="Categoria" comoDiv>
          <div className="flex flex-wrap gap-1">
            {opcoes.map((c) => (
              <button key={c || 'normal'} type="button" aria-pressed={(d.categoria ?? '') === c} onClick={() => setD({ ...d, categoria: c || undefined })} className={cx('min-h-10 rounded-full border px-3 text-sm font-semibold', (d.categoria ?? '') === c ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)]')}>{c ? t(c) : `${t('Normal')} (${t('geral')})`}</button>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Criar outra categoria">
          <div className="flex gap-2">
            <Entrada value={outra} placeholder={t('Ex.: Platinado')} onChange={(e) => setOutra(e.target.value)} />
            <Botao variante="secundario" disabled={!outra.trim()} onClick={() => setD({ ...d, categoria: outra.trim() })}>+ {t('Usar')}</Botao>
          </div>
        </Campo>
        <Campo rotulo="Vale desde"><Entrada type="date" value={d.validaDesde ?? ''} onChange={(e) => setD({ ...d, validaDesde: e.target.value })} /></Campo>
      </div>
    </Janela>
  )
}

/** ⋯ Ferramentas: aumentar/diminuir %, copiar coluna, preencher vazios. Tudo vai para o rascunho (nada publica sozinho). */
function Ferramentas({ g, inicial, onFechar, onAplicar }: { g: Rascunho; inicial: Ferramenta; onFechar(): void; onAplicar(grade: Rascunho, n: number): void }) {
  const t = useT()
  const [tipo, setTipo] = useState<Ferramenta['tipo']>(inicial.tipo)
  const [alvo, setAlvo] = useState<Alvo>(inicial.alvo ?? { tipo: 'tudo' })
  const [pct, setPct] = useState('5')
  const [passo, setPasso] = useState('0')
  const [de, setDe] = useState(g.colunas.find((c) => c.id !== inicial.para)?.id ?? g.colunas[0]?.id)
  const [para, setPara] = useState(inicial.para ?? g.colunas[1]?.id ?? g.colunas[0]?.id)
  const [soVazios, setSoVazios] = useState(false)
  const [valor, setValor] = useState('')
  const p = Number(pct.replace(',', '.'))
  const res =
    tipo === 'pct' ? (Number.isFinite(p) && p !== 0 && p > -100 ? ajustarPct(g, alvo, p, Number(passo)) : { grade: g, mudou: 0 })
    : tipo === 'copiar' ? copiarColuna(g, de, para, soVazios)
    : preencherVazios(g, alvo, valor)
  const nome = (id: string) => g.colunas.find((c) => c.id === id)?.nome ?? ''
  const onde = alvo.tipo === 'tudo' ? t('em toda a tabela') : alvo.tipo === 'medidas' ? (alvo.de === alvo.ate ? t('em {a} cm', { a: alvo.de }) : t('em {a}–{b} cm', { a: Math.min(alvo.de, alvo.ate), b: Math.max(alvo.de, alvo.ate) })) : t('em {nome}', { nome: nome(alvo.colunaId) })
  const resumo =
    tipo === 'pct' ? `${p > 0 ? '+' : ''}${pct}% ${onde}` : tipo === 'copiar' ? t('{de} → {para}', { de: nome(de), para: nome(para) }) : `${valor || '…'} ${t('nos vazios')} ${onde}`
  const medidas = g.linhas.map((l) => ({ id: String(l), nome: `${l} cm` }))
  const escolherAlvo = (
    <div className="space-y-2">
      <Escolha<Alvo['tipo']> rotulo="Onde" valor={alvo.tipo} onChange={(v) => setAlvo(v === 'tudo' ? { tipo: 'tudo' } : v === 'medidas' ? { tipo: 'medidas', de: g.linhas[0], ate: g.linhas[g.linhas.length - 1] } : { tipo: 'coluna', colunaId: g.colunas[0].id })} opcoes={[{ id: 'tudo', nome: 'Tudo' }, { id: 'medidas', nome: 'Medidas' }, { id: 'coluna', nome: 'Comprador' }]} />
      {alvo.tipo === 'medidas' && (
        <div className="flex items-center gap-2 text-sm">
          <span>{t('de')}</span><Selecao className="w-auto" valor={String(alvo.de)} onChange={(v) => setAlvo({ ...alvo, de: Number(v) })} opcoes={medidas} />
          <span>{t('até')}</span><Selecao className="w-auto" valor={String(alvo.ate)} onChange={(v) => setAlvo({ ...alvo, ate: Number(v) })} opcoes={medidas} />
        </div>
      )}
      {alvo.tipo === 'coluna' && <Selecao valor={alvo.colunaId} onChange={(v) => setAlvo({ tipo: 'coluna', colunaId: v })} opcoes={g.colunas.map((c) => ({ id: c.id, nome: c.nome }))} />}
    </div>
  )
  return (
    <Janela aberta titulo={t('Ferramentas')} onFechar={onFechar} rodape={
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-[var(--suave)]">{res.mudou ? t('Vai mudar {n} preço(s)', { n: res.mudou }) : t('Nada para mudar')}</span>
        <Botao variante="leve" onClick={onFechar}>{t('Voltar')}</Botao>
        <Botao disabled={!res.mudou} onClick={() => (onAplicar(res.grade, res.mudou), onFechar())}>{t('Aplicar')}: {resumo}</Botao>
      </div>
    }>
      <div className="space-y-4">
        <Escolha<Ferramenta['tipo']> rotulo="Ferramenta" valor={tipo} onChange={setTipo} opcoes={[{ id: 'pct', nome: '± %' }, { id: 'copiar', nome: 'Copiar coluna' }, { id: 'preencher', nome: 'Preencher vazios' }]} />
        {tipo === 'pct' && (
          <>
            <Campo rotulo="Aumentar/diminuir (%)" ajuda="Use menos para baixar. Ex.: 5 = +5%; -10 = −10%. Só mexe nos preços preenchidos.">
              <div className="flex flex-wrap gap-2">
                {['-10', '-5', '5', '10'].map((x) => <Botao key={x} className="px-3" variante={pct === x ? 'primario' : 'secundario'} onClick={() => setPct(x)}>{Number(x) > 0 ? '+' : ''}{x}%</Botao>)}
                <Entrada className="w-20" aria-label={t('Outro %')} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
              </div>
            </Campo>
            {escolherAlvo}
            <Campo rotulo="Arredondar" comoDiv>
              <Selecao valor={passo} onChange={setPasso} opcoes={[{ id: '0', nome: t('Não (2 casas)') }, { id: '0.1', nome: '0,1' }, { id: '0.5', nome: '0,5' }, { id: '1', nome: '1' }]} />
            </Campo>
          </>
        )}
        {tipo === 'copiar' && (
          <div className="space-y-3">
            <Campo rotulo="Copiar de" comoDiv><Selecao valor={de} onChange={setDe} opcoes={g.colunas.map((c) => ({ id: c.id, nome: c.nome }))} /></Campo>
            <Campo rotulo="Para" comoDiv><Selecao valor={para} onChange={setPara} opcoes={g.colunas.map((c) => ({ id: c.id, nome: c.nome }))} /></Campo>
            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={soVazios} onChange={(e) => setSoVazios(e.target.checked)} /> {t('Só nos vazios (não apaga o que já tem)')}</label>
          </div>
        )}
        {tipo === 'preencher' && (
          <>
            <Campo rotulo="Fator para os vazios"><Entrada autoFocus inputMode="decimal" placeholder="3,5" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
            {escolherAlvo}
          </>
        )}
      </div>
    </Janela>
  )
}

type Uso = Awaited<ReturnType<typeof import('../core/services/precos').tabelaPreco>>['usos'][number]

const AJUDA_USADA = 'Vendas e compras que calcularam o preço com esta tabela. Cada uma guarda o fator e a versão que usou: mudar a tabela não muda o passado. Ex.: V-0004 usou a v1 (60 cm × 17); a v2 subiu para 17,5, mas a V-0004 continua com 17.'

/**
 * USADA EM (filtro padrão): números grandes Vendas/Compras (tocar filtra), busca e o painel com período, pessoa,
 * versão e comprador (coluna). Tudo no endereço (u*), para voltar e achar a lista igual.
 */
function UsadaEm({ usos, total, moeda: m }: { usos: Uso[]; total: number; moeda: string }) {
  const t = useT()
  const { ajustarParams } = useApp()
  const { p, setP, tirar: tirarFiltro } = useFiltrosTela()
  const [aberto, setAberto] = useState(false)
  const CHAVES = ['ut', 'ub', 'ude', 'uate', 'up', 'uv', 'uc']
  const busca = p('ub').trim().toLowerCase()
  const passa = (u: Uso, sem?: string) =>
    (sem === 'ut' || !p('ut') || (p('ut') === 'compra') === (u.tipo === 'compra')) &&
    (!busca || [u.codigo, u.pessoa, ...u.colunas].filter(Boolean).join(' ').toLowerCase().includes(busca)) &&
    (!p('ude') || u.data >= p('ude')) &&
    (!p('uate') || u.data <= p('uate')) &&
    (!p('up') || u.pessoa === p('up')) &&
    (!p('uv') || String(u.versao) === p('uv')) &&
    (!p('uc') || u.colunas.includes(p('uc')))
  const lista = usos.filter((u) => passa(u))
  // números grandes contam com os outros filtros, menos o tipo (para ver quantas de cada)
  const semTipo = usos.filter((u) => passa(u, 'ut'))
  const vendas = semTipo.filter((u) => u.tipo !== 'compra')
  const compras = semTipo.filter((u) => u.tipo === 'compra')
  const soma = (xs: Uso[]) => xs.reduce((s, u) => s + u.total, 0)
  const gramas = (xs: Uso[]) => xs.reduce((s, u) => s + u.gramas, 0)
  const valores = (f: (u: Uso) => (string | number | undefined)[]) => [...new Set(usos.flatMap(f).filter((x) => x !== undefined && x !== '').map(String))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
  const avancados = CHAVES.filter((k) => k !== 'ut' && k !== 'ub' && p(k)).length
  const limpar = () => ajustarParams(Object.fromEntries(CHAVES.map((k) => [k, undefined])))
  const ativos = [
    ...(p('ude') || p('uate') ? [{ k: 'ude,uate', rotulo: `📅 ${p('ude') ? diaCurto(p('ude')) : '…'} – ${p('uate') ? diaCurto(p('uate')) : '…'}` }] : []),
    ...(p('up') ? [{ k: 'up', rotulo: `👤 ${p('up')}` }] : []),
    ...(p('uv') ? [{ k: 'uv', rotulo: `${t('versão')} v${p('uv')}` }] : []),
    ...(p('uc') ? [{ k: 'uc', rotulo: `▦ ${p('uc')}` }] : []),
  ]
  const alternarTipo = (x: 'venda' | 'compra') => setP('ut', p('ut') === x ? '' : x)
  return (
    <section aria-label={t('Usada em')} className="space-y-2 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm sm:p-4">
      <h2 className="flex items-center gap-1 text-base font-bold">{t('Onde esta tabela foi usada')}<span className="num text-sm font-normal text-[var(--suave)]">· {total}</span><Info texto={AJUDA_USADA} /></h2>
      <div className="grid grid-cols-2 gap-2">
        <NumeroGrande rotulo="Vendas" icone="💰" cor="var(--marca)" valor={String(vendas.length)} ativo={p('ut') === 'venda'} onClick={() => alternarTipo('venda')} selos={[{ texto: formatar(soma(vendas), m), tom: 'marca' }, { texto: gramasTexto(gramas(vendas)) }]} />
        <NumeroGrande rotulo="Compras" icone="🛒" cor="var(--bom)" valor={String(compras.length)} ativo={p('ut') === 'compra'} onClick={() => alternarTipo('compra')} selos={[{ texto: formatar(soma(compras), m), tom: 'bom' }, { texto: gramasTexto(gramas(compras)) }]} />
      </div>
      <BarraFiltros busca={p('ub')} onBusca={(v) => setP('ub', v)} placeholder="Buscar código, pessoa ou comprador" ativos={avancados} aberto={aberto} onAlternar={() => setAberto(!aberto)} />
      <ChipsFiltros itens={ativos} onTirar={tirarFiltro} onLimpar={limpar} />
      {aberto && (
        <PainelFiltros resultados={lista.length} temAtivos={avancados > 0} onLimpar={limpar} onFechar={() => setAberto(false)}>
          <GrupoFiltro titulo="Quando" icone="📅">
            <CampoFaixa rotulo="Período">
              <Entrada type="date" aria-label={t('De')} value={p('ude')} onChange={(e) => setP('ude', e.target.value)} />
              <Entrada type="date" aria-label={t('Até')} value={p('uate')} onChange={(e) => setP('uate', e.target.value)} />
            </CampoFaixa>
          </GrupoFiltro>
          <GrupoFiltro titulo="Quem e como" icone="👤">
            <Campo rotulo="Cliente / fornecedor"><Selecao valor={p('up')} onChange={(v) => setP('up', v)} vazio={t('Todos')} opcoes={valores((u) => [u.pessoa]).map((x) => ({ id: x, nome: x }))} /></Campo>
            <Campo rotulo="Versão da tabela" ajuda="A versão que valia no dia. Ex.: v1 = antes do aumento de 14/10."><Selecao valor={p('uv')} onChange={(v) => setP('uv', v)} vazio={t('Todas')} opcoes={valores((u) => [u.versao]).map((x) => ({ id: x, nome: `v${x}` }))} /></Campo>
            <Campo rotulo="Comprador (coluna)"><Selecao valor={p('uc')} onChange={(v) => setP('uc', v)} vazio={t('Todos')} opcoes={valores((u) => u.colunas).map((x) => ({ id: x, nome: x }))} /></Campo>
          </GrupoFiltro>
        </PainelFiltros>
      )}
      {lista.length ? (
        <>
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {lista.map((u) => <UsoTabela key={u.id} u={u} moeda={m} />)}
          </ul>
          <p className="num flex flex-wrap justify-between gap-2 border-t border-[var(--borda)] pt-2 text-xs text-[var(--suave)]">
            <span>{t('Mostrando {n} de {t}', { n: lista.length, t: total })}</span>
            <span>{gramasTexto(gramas(lista))} · <b className="text-[var(--texto)]">{formatar(soma(lista), m)}</b></span>
          </p>
        </>
      ) : <Vazio texto="Nada com estes filtros." />}
    </section>
  )
}

/** Uma venda/compra que usou a tabela: resumo numa linha; tocar abre o detalhe ali mesmo (sem trocar de tela). */
function UsoTabela({ u, moeda }: { u: Uso; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState(false)
  const compra = u.tipo === 'compra'
  return (
    <li>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((x) => !x)} className="flex w-full items-center gap-3 py-3.5 text-left hover:text-[var(--marca)]">
        <span className={cx('h-8 w-1 shrink-0 rounded-full', compra ? 'bg-[var(--bom)]' : 'bg-[var(--marca)]')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t(compra ? 'Compra' : 'Venda')} {u.codigo ?? ''}{u.pessoa ? ` · ${u.pessoa}` : ''}</span>
          <span className="mt-0.5 block text-xs text-[var(--suave)]">{dataBR(u.data)} · {gramasTexto(u.gramas)} · {u.linhas} {t('linha(s)')}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {u.versao !== undefined && <Pilula pequena tom="marca">v{u.versao}</Pilula>}
            {u.colunas.map((c) => <Pilula key={c} pequena tom="suave">▦ {c}</Pilula>)}
          </span>
        </span>
        <span className="num shrink-0 text-right font-semibold">
          {formatar(u.total, moeda)}
          {u.desconto ? <span className="block text-xs font-normal text-[var(--suave)]">{t('desconto')} {formatar(u.desconto, moeda)}</span> : null}
        </span>
        <span className={cx('shrink-0 text-[var(--suave)] transition-transform', aberto && 'rotate-90')} aria-hidden>›</span>
      </button>
      {aberto && (
        <div className="mb-3 ml-4 rounded-xl bg-[var(--fundo)] p-3">
          <ul className="space-y-1.5">
            {u.detalhe.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="min-w-0">
                  {l.medida !== undefined ? `${l.medida} cm` : l.descricao}
                  <span className="num ml-2 text-xs text-[var(--suave)]">{gramasTexto(l.gramas)}{l.fator !== undefined ? ` × ${l.fator}` : ''}</span>
                </span>
                <span className="num">{formatar(l.total, moeda)}{l.desconto ? <span className="ml-1 text-xs text-[var(--suave)]">(−{formatar(l.desconto, moeda)})</span> : null}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => ir(compra ? 'pedido' : 'venda', { id: u.id })} className="mt-2 text-sm font-semibold text-[var(--marca)]">
            {t(compra ? 'Abrir a compra' : 'Abrir a venda')} →
          </button>
        </div>
      )}
    </li>
  )
}
