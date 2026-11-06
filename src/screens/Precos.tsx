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
import { Abas, Botao, Carregando, Confirmar, Entrada, ErroTela, Escolha, Info, Pilula, cx, moedaPadrao, diaCurto } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { Trilha } from '../ui/trilha'
import { MenuAcoes, type Acao } from '../ui/menuAcoes'
import { Historico } from './PrecosHistorico'
import { type Alvo, adicionarColuna, adicionarMedidas, chave, comValor, contarMudancas, invalidos, moverColuna, precosDaColuna, precosDaMedida, tirarColuna, tirarMedida, trocarMedida } from '../ui/tabelaPrecoEdicao'
import { type Direcao, type Ferramenta, type Rascunho, type T } from './precos/tipos'
import { Celula, GradeEditavel } from './precos/GradeEditavel'
import { Ferramentas, JanelaComprador, JanelaDetalhes, JanelaMedida } from './precos/janelas'

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
  // versao = número da versão publicada sobre a qual o rascunho começou (outra aba publicou depois → o servidor recusa)
  const [est, setEst] = useState<{ r?: Rascunho; pilha: Rascunho[]; versao?: number }>({ r: inicial, pilha: [] })
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
      return { r: para, pilha: [...s.pilha, de].slice(-100), versao: s.versao ?? atual }
    })
  const desfazer = () => setEst((s) => (s.pilha.length ? { r: s.pilha[s.pilha.length - 1], pilha: s.pilha.slice(0, -1), versao: s.versao } : s))
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
    const res = await executar('salvarTabelaPreco', { ...g, nota, versaoBase: novo ? undefined : est.versao ?? atual }, t('Versão publicada.'))
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

// ---------- grade editável ----------

// ---------- janelas ----------
