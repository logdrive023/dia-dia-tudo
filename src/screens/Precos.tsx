// TABELAS DE PREÇO com VERSÕES.
//  #/precos        lista (ListaTabelas): filtro padrão e uma linha por tabela (situação, versão em uso, faixa, usos)
//  #/precos/:id    tela da tabela: Tabela (grade editável) · Onde foi usada (por VERSÃO) · Histórico · Entenda os valores
//  #/precos/novo   nova tabela
// Toda alteração publica uma versão nova (barra "3 mudanças · Publicar v3"); as anteriores ficam guardadas e dá para
// comparar quaisquer duas ("era X → ficou Y"). Vendas e compras guardam o fator que usaram: o passado não muda.

import { useRef, useState } from 'react'
import { CabecalhoFicha } from '../ui/cabecalhoFicha'
import { EntendaValores } from './precos/EntendaValores'
import { UsadaEm } from './precos/UsadaEm'
import { ListaTabelas, SITUACAO_TABELA } from './precos/ListaTabelas'
import { fatorValido, moeda } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { TabelaPreco } from '../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, Escolha, Info, Janela, Pilula, Selecao, cx, moedaPadrao, diaCurto } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { Trilha } from '../ui/trilha'
import { MenuAcoes, type Acao } from '../ui/menuAcoes'
import { Historico } from './PrecosHistorico'
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
  const { nav } = useApp()
  // key: trocar de tabela (ou ir para "novo") recomeça o rascunho do zero
  if (nav.params.id || nav.tela === 'tabelaPreco') return <TabelaTela key={String(nav.params.id)} />
  return <ListaTabelas ajudaConta={AJUDA_CONTA} ajudaVersoes={AJUDA_VERSOES} />
}

// ---------- tela da tabela ----------

type Direcao = 'direita' | 'esquerda' | 'baixo' | 'cima'
type Ferramenta = { tipo: 'pct' | 'copiar' | 'preencher'; alvo?: Alvo; para?: string }

function TabelaTela() {
  const t = useT()
  const { nav, ir, voltar, marcarSujo, avisar, ajustarParams } = useApp()
  const { executar, ocupado } = useComando()
  const id = nav.params.id as string
  const novo = id === 'novo'
  const { dados, erro } = useConsulta('tabelaPreco', { id }, !novo)
  const { dados: listaTabelas } = useConsulta('listaTabelasPreco', {}, !novo)
  const [abaUrl, setAba] = useParamTela<string>('aba', 'tabela')
  // links antigos (?aba=versoes / comparar / editar) continuam abrindo o lugar certo
  const aba = novo ? 'tabela' : ['versoes', 'comparar', 'historico'].includes(abaUrl) ? 'historico' : ['usada', 'entenda'].includes(abaUrl) ? abaUrl : 'tabela'
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

  const nome = editandoNome !== undefined ? (
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
    <button type="button" onClick={() => setEditandoNome(g.nome)} className="group inline-flex items-center gap-2 rounded-lg text-left hover:text-[var(--marca)]" aria-label={`${g.nome} · ${t('Mudar o nome')}`}>
      <span className="break-words">{g.nome}</span>
      <span aria-hidden className="text-base text-[var(--suave)] group-hover:text-[var(--marca)]">✎</span>
    </button>
  )
  // os números do cabeçalho: faixa de preço, a situação (vigente/agendada/substituída) e a última versão
  const nums = Object.values(g.valores).filter((v) => fatorValido(v)).map((v) => Number(String(v).replace(',', '.')))
  const faixa = nums.length ? [Math.min(...nums), Math.max(...nums)] : undefined
  const fmt = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const daLista = listaTabelas?.find((x) => x.id === id)
  const sit = daLista ? SITUACAO_TABELA[daLista.situacao] : undefined
  const ultima = versoes[0]

  return (
    <div className={cx(sujo && 'pb-4')}>
      <Trilha atual={novo ? t('Nova tabela') : g.nome} />
      {/* CABEÇALHO PADRÃO DE FICHA (o mesmo do pacote e da compra): nome (✎ no lugar) · situação, categoria e versão ·
          detalhes · faixa de preço · ações */}
      <CabecalhoFicha
        className="mb-3"
        titulo={nome}
        selos={novo ? <Pilula tom="marca">{t('Nova tabela · vai publicar a v1')}</Pilula> : <>
          {sit && <Pilula tom={sit.tom} title={t(sit.ajuda)}>{daLista?.situacao === 'vigente' ? '● ' : ''}{t(sit.nome)}</Pilula>}
          <Pilula tom="marca">v{atual} · {t('em uso')}</Pilula>
          <button type="button" onClick={() => setJanela({ tipo: 'detalhes' })} title={t('Categoria: para qual tipo de cabelo esta tabela vale. Toque para trocar ou criar outra (Tinte, CH, Platinado…).')}
            className={cx('inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1', g.categoria ? 'bg-[var(--marca-suave)] text-[var(--marca)] ring-[var(--marca)]/40' : 'bg-[var(--fundo)] ring-[var(--borda)]')}>
            🏷 {g.categoria ? t(g.categoria) : t('Normal (geral)')} <span aria-hidden className="text-[var(--suave)]">✎</span>
          </button>
        </>}
        detalhes={[
          g.validaDesde && t('vale desde {d}', { d: diaCurto(g.validaDesde) }),
          `${g.linhas.length} ${t('medidas')} · ${g.colunas.length} ${t('compradores')}`,
          ultima && !novo && `${t('mudou em {d}', { d: diaCurto(ultima.em) })}${ultima.por ? ` · ${ultima.por}` : ''}`,
          tb && tb.moeda !== moedaPadrao() && tb.moeda,
        ]}
        valor={faixa ? <span className="num whitespace-nowrap">{moeda(g.moeda).simbolo} {fmt(faixa[0])} – {fmt(faixa[1])}</span> : undefined}
        valorDetalhe={faixa ? t(g.fatorPor === 'grama' ? 'por grama' : 'por unidade') : undefined}
        acoes={<div className="flex flex-wrap items-center gap-2">
          <Botao variante="secundario" onClick={() => setJanela({ tipo: 'detalhes' })}>✎ {t('Nome, categoria e data')}</Botao>
          {!novo && <Botao variante="leve" onClick={() => setAba('entenda')}>💡 {t('Como funciona')}</Botao>}
          <Info texto={AJUDA_VERSOES} />
        </div>}
      />
      {!novo && <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a)} abas={[{ id: 'tabela', nome: 'Tabela', extra: sujo ? <Pilula key="r" tom="alerta">{t('não publicado')}</Pilula> : undefined }, { id: 'usada', nome: 'Onde foi usada', extra: <Pilula key="u">{dados?.totalUsos ?? 0}</Pilula> }, { id: 'historico', nome: 'Histórico', extra: <Pilula key="v">{versoes.length}</Pilula> }, { id: 'entenda', nome: 'Entenda os valores' }]} />}

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

        </div>
      )}

      {aba === 'usada' && tb && <UsadaEm usos={dados!.usos} versoes={versoes} atual={atual} moeda={tb.moeda} />}
      {aba === 'historico' && <Historico id={id} versoes={versoes} usosPorVersao={Object.fromEntries(versoes.map((v) => [v.numero, (dados?.usos ?? []).filter((u) => u.versao === v.numero).length]))} onVerUsos={(n) => ajustarParams({ aba: 'usada', uv: n === atual ? undefined : String(n) })} />}
      {aba === 'entenda' && <EntendaValores />}

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
    <div className={cx('sem-barra overflow-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] [background:linear-gradient(to_right,var(--cartao)_30%,transparent),linear-gradient(to_left,var(--cartao)_30%,transparent)_100%_0,radial-gradient(farthest-side_at_100%_50%,rgba(0,0,0,.25),transparent)_100%_0] [background-attachment:local,local,scroll] [background-repeat:no-repeat] [background-size:40px_100%,40px_100%,14px_100%]', baixa ? 'max-h-[calc(100dvh-22rem)] min-h-[16rem] md:max-h-[calc(100dvh-19rem)]' : 'max-h-[calc(100dvh-15rem)] md:max-h-[calc(100dvh-13rem)]')}>
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
