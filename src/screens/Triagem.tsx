// TRIAGEM: o passo mais importante — daqui saem as vendas. Compra → Triagem → Venda.
// Quadro (arrastar entre colunas) ou lista por coluna (celular). As COLUNAS são do negócio (Configurações › Etapas da
// triagem). Números do topo que filtram, "Hoje na triagem", "Pronto para vender" lote a lote (origem clara, preço da
// tabela, margem), seleção com ações em massa e o menu "⋯" que leva a compra, fornecedor, lote de origem, rastreio…

import { type DragEvent, type ReactNode, useCallback, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import type { ResultadoConsulta } from '../core/services'
import { COLUNA_VENDIDO, type ColunaTriagem, camposUnificados } from '../core/services/triagem'
import { Abas, Botao, Campo, Carregando, Confirmar, Entrada, ErroTela, Escolha, Janela, Pilula, Selecao, Titulo, cx, dataBR, fmt, gramasTexto, moedaPadrao } from '../ui/base'
import { resumoCampos } from '../ui/camposDinamicos'
import { clicavel } from '../ui/compartilhados'
import { type Params, useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useTelaLarga } from '../ui/estoqueUi'
import { useT } from '../ui/i18n'
import { type Acao, MenuAcoes, acoesLote } from '../ui/menuAcoes'
import { EditarAtributos, useCamposModulo } from './Estoque'
import { CampoCodigo, TrocarCodigo } from '../ui/codigos'
import { CadeiaChips, RastreioTotal } from '../ui/rastreioTotal'
import { LinkTirarFoto, MiniaturaLote, marcadorLote, useTirarFoto } from '../ui/fotos'
import { ImprimirEtiquetas } from '../ui/etiquetas'
import { LeitorCodigo, temLeitorCodigo } from '../ui/estoqueUi'

type Dados = ResultadoConsulta<'triagem'>
type Lote = Dados['lotes'][number]
type T = ReturnType<typeof useT>

const MAX_COLUNA = 20
const MAX_PRONTOS = 12
const corDe = (c?: ColunaTriagem) => c?.cor ?? 'var(--marca)'

/** De onde veio, por extenso: "de P-0003 · Helena · separado de L-0001" (unificado: "de P-0001 + P-0004 · unificado de L-1 + L-2"). */
function origemTexto(l: Lote, t: T) {
  const fornecedores = [...new Set(l.compras.map((c) => c.fornecedor).filter(Boolean))]
  const compras = l.compras.length ? `${t('de')} ${l.compras.map((c) => c.codigo ?? '?').join(' + ')}${fornecedores.length ? ` · ${fornecedores.join(', ')}` : ''}` : t('sem compra (cadastro)')
  const pai = l.pai ? ` · ${t('separado de')} ${l.pai.codigo ?? '?'}` : ''
  const uni = l.unificadoDe?.length ? ` · ${t('unificado de')} ${l.unificadoDe.map((x) => x.codigo ?? '?').join(' + ')}` : ''
  return compras + pai + uni
}

export function Triagem() {
  const t = useT()
  const { ir, ajustarParams, nav } = useApp()
  const larga = useTelaLarga()
  const [visaoP, setVisao] = useParamTela<'' | 'quadro' | 'lista'>('visao', '')
  const visao = visaoP || (larga ? 'quadro' : 'lista')
  const [filtro, setFiltro] = useParamTela('f', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [trocar, setTrocar] = useState<Lote>()
  const medida = nav.params.m === undefined ? '' : String(nav.params.m)
  const [colunaPreco, setColunaPreco] = useParamTela('coluna', '')
  const [vendidos, setVendidos] = useParamTela('vendidos', '')
  const { dados, erro } = useConsulta('triagem', { moduloId: 'cabelo', colunaId: colunaPreco || undefined, vendidosDias: vendidos === 'todos' ? 0 : 30 })
  const campos = useCamposModulo('cabelo', 'lote')
  const { executar, ocupado } = useComando()
  const [sel, setSel] = useState<Set<Id>>(new Set())
  const [janela, setJanela] = useState<'unificar' | 'triado'>()
  const [moverPara, setMoverPara] = useState('')
  const [editar, setEditar] = useState<Lote>()
  const [arrastando, setArrastando] = useState<Id[]>()
  const [opcoes, setOpcoes] = useState(false)
  const [aba, setAba] = useParamTela('aba', 'quadro')
  const [alvo, setAlvo] = useState<string>()
  const [etiquetas, setEtiquetas] = useState<Id[]>()
  const [lendo, setLendo] = useState(false)
  const { tirar } = useTirarFoto()
  if (erro) return <ErroTela texto={erro} onVoltar={() => ir('painel')} />
  if (!dados) return <Carregando />

  const cols = dados.colunas
  const colDe = (id: string) => cols.find((c) => c.id === id)
  const trabalho = cols.filter((c) => c.id !== COLUNA_VENDIDO)
  const primeiraPronta = cols.find((c) => c.pronto)
  const naFila = (l: Lote) => l.fase !== COLUNA_VENDIDO && !colDe(l.fase)?.pronto
  const tt = dados.totais
  const termo = busca.trim().toLowerCase()
  const passa = (l: Lote) =>
    (!termo || l.busca.includes(termo)) &&
    (!medida || String(l.campos.comprimento ?? '') === medida) &&
    (!filtro ||
      (filtro === 'atrasados' ? l.atrasado
        : filtro === 'semana' ? !!colDe(l.fase)?.pronto && !!l.triadoEm && l.triadoEm >= dados.semanaDesde
          : filtro === 'mes' ? !!colDe(l.fase)?.pronto && !!l.triadoEm && l.triadoEm >= dados.mesDesde
            : filtro === 'pronto' ? !!colDe(l.fase)?.pronto
              : l.fase === filtro))
  const lotes = dados.lotes.filter(passa)
  const selecionados = dados.lotes.filter((l) => sel.has(l.id))
  const brutos = selecionados.length > 0 && selecionados.every((l) => l.campos.estado === 'Bruto' && l.fase !== COLUNA_VENDIDO)
  const marcar = (id: Id, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n })
  const limparSel = () => setSel(new Set())

  // ---------- ações ----------
  const mover = async (ids: Id[], fase: string) => {
    const c = colDe(fase)
    const r = await executar('moverFaseTriagem', { ids, fase }, t('Movido para “{c}”.', { c: c?.nome ?? fase }))
    if (r) limparSel()
  }
  const separar = (id: Id) => ir('separar', { id, volta: 'triagem' })
  const vender = (p: Params) => ir('vender', { modulo: 'cabelo', coluna: dados.colunaPrecoId, ...p })
  /** entrar na coluna: "separar ao entrar" abre a separação (lote bruto); senão muda de coluna */
  const entrar = (col: ColunaTriagem, ids: Id[]) => {
    const ls = ids.map((id) => dados.lotes.find((x) => x.id === id)).filter((l): l is Lote => !!l && l.fase !== col.id && l.fase !== COLUNA_VENDIDO)
    if (!ls.length) return
    if (col.separarAoEntrar && ls.length === 1 && ls[0].campos.estado === 'Bruto') return separar(ls[0].id)
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
          ...(l.fase === COLUNA_VENDIDO ? [] : trabalho.filter((c) => c.id !== l.fase).map((c, k) => ({ rotulo: `${t('Mover para')} “${c.nome}”`, icone: '→', onClick: () => entrar(c, [l.id]), separar: k === 0 }))),
        ],
      },
    )

  const cartao = (l: Lote) => {
    const k = trabalho.findIndex((c) => c.id === l.fase)
    const col = colDe(l.fase)
    const prox = naFila(l) ? trabalho[k + 1] : undefined
    const ant = naFila(l) && k > 0 ? trabalho[k - 1] : undefined
    const acao: { rotulo: string; f(): void } | undefined = col?.pronto
      ? { rotulo: '💰 Vender', f: () => vender({ lote: l.id }) }
      : prox
        ? prox.separarAoEntrar && l.campos.estado === 'Bruto'
          ? { rotulo: '✂️ Separar agora', f: () => separar(l.id) }
          : { rotulo: `→ ${prox.nome}`, f: () => mover([l.id], prox.id) }
        : undefined
    return (
      <CartaoLote
        key={l.id}
        l={l}
        col={col}
        marcado={sel.has(l.id)}
        onMarcar={(v) => marcar(l.id, v)}
        arrastavel={visao === 'quadro' && l.fase !== COLUNA_VENDIDO}
        onArrastar={(e) => {
          e.dataTransfer.setData('text/plain', l.id)
          e.dataTransfer.effectAllowed = 'move'
          setArrastando(sel.has(l.id) ? [...sel] : [l.id])
        }}
        onSoltar={() => (setArrastando(undefined), setAlvo(undefined))}
        onAbrir={() => ir('lote', { id: l.id })}
        acao={acao}
        secundarias={[
          ...(naFila(l) && !acao?.rotulo.startsWith('✂️') && l.campos.estado === 'Bruto' ? [{ rotulo: '✂️', titulo: 'Separar', f: () => separar(l.id) }] : []),
          ...(ant ? [{ rotulo: '↩', titulo: `${t('Voltar para')} “${ant.nome}”`, f: () => mover([l.id], ant.id) }] : []),
        ]}
        menu={menuDe(l)}
        ocupado={ocupado}
      />
    )
  }

  const esperando = dados.lotes.filter(naFila).sort((a, b) => b.dias - a.dias).slice(0, 3)
  const prontos = dados.lotes.filter((l) => colDe(l.fase)?.pronto)
  const nomeFiltro = (f: string) => colDe(f)?.nome ?? { atrasados: 'Esperando há mais tempo', semana: 'Triado nesta semana', mes: 'Triado neste mês', pronto: 'Pronto para vender' }[f] ?? f

  return (
    <div className="space-y-4 pb-24">
      <Titulo
        subtitulo={<span>🛒 {t('Compra')} → <b className="text-[var(--texto)]">🧺 {t('Triagem')}</b> → 💰 {t('Venda')} · {t('daqui saem as vendas')}</span>}
        acao={<Botao variante="secundario" aria-expanded={opcoes} onClick={() => setOpcoes(!opcoes)}>⚙ {t('Opções')}</Botao>}
      >
        {t('Triagem')}
      </Titulo>
      {opcoes && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--fundo)] p-2">
          {dados.colunasPreco.length > 1 && (
            <div className="min-w-[12rem]"><Selecao valor={dados.colunaPrecoId} onChange={(v) => setColunaPreco(v === dados.colunasPreco[0]?.id ? '' : v)} opcoes={dados.colunasPreco.map((c) => ({ id: c.id, nome: `${t('Preço de')} ${c.nome}` }))} /></div>
          )}
          <Escolha rotulo="Ver como" valor={visao} onChange={(v) => setVisao(v === (larga ? 'quadro' : 'lista') ? '' : v)} opcoes={[{ id: 'quadro', nome: 'Quadro' }, { id: 'lista', nome: 'Lista' }]} />
          <Botao variante="leve" onClick={() => ir('config', { aba: 'triagem' })}>⚙ {t('Personalizar colunas')}</Botao>
        </div>
      )}
      <Abas atual={aba} onChange={setAba} abas={[{ id: 'quadro', nome: 'Lotes' }, { id: 'triagens', nome: 'Triagens feitas' }]} />
      {aba === 'triagens' ? <ListaTriagens aberta={nav.params.t as string | undefined} /> : <>

      <div className="flex items-center gap-2">
        <Entrada type="search" className="min-w-0 flex-1" aria-label={t('Buscar lote por código (atual ou antigo), compra, sigla ou fornecedor')} placeholder={t('Buscar lote por código (atual ou antigo), compra, sigla ou fornecedor')} value={busca} onChange={(e) => setBusca(e.target.value)} />
        {temLeitorCodigo() && <Botao variante="secundario" className="shrink-0" aria-label={t('Ler código')} title={t('Ler código')} onClick={() => setLendo(true)}>📷</Botao>}
      </div>

      {/* números grandes que filtram: uma por coluna de trabalho + triado na semana + perda do mês */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {trabalho.filter((c) => !c.pronto).map((c) => (
          <Numero key={c.id} rotulo={c.nome} valor={gramasTexto(tt.porColuna[c.id]?.g ?? 0)} sub={t('{n} lote(s)', { n: tt.porColuna[c.id]?.n ?? 0 })} cor={corDe(c)} ativo={filtro === c.id} onClick={() => setFiltro(filtro === c.id ? '' : c.id)} />
        ))}
        <Numero rotulo="Pronto para vender" valor={gramasTexto(tt.pronto)} sub={formatar(tt.prontoValor, moedaPadrao())} cor={corDe(primeiraPronta)} ativo={filtro === 'pronto'} onClick={() => setFiltro(filtro === 'pronto' ? '' : 'pronto')} />
        <Numero rotulo="Triado nesta semana" valor={gramasTexto(tt.triadoSemana)} sub={t('desde {d}', { d: dataBR(dados.semanaDesde) })} cor="var(--bom)" ativo={filtro === 'semana'} onClick={() => setFiltro(filtro === 'semana' ? '' : 'semana')} />
        <Numero rotulo="Perda no mês" valor={fmt(tt.perdaMesBp, 'percentual')} sub={tt.usadoMes ? t('{p} de {u} separados', { p: gramasTexto(tt.perdaMes), u: gramasTexto(tt.usadoMes) }) : t('nada separado ainda')} cor={tt.perdaMesBp > 500 ? 'var(--ruim)' : 'var(--suave)'} ativo={filtro === 'mes'} onClick={() => setFiltro(filtro === 'mes' ? '' : 'mes')} />
      </div>

      {/* hoje na triagem */}
      <section aria-label={t('Hoje na triagem')} className="grid gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm md:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-1 text-sm font-bold">⏳ {t('Esperando há mais tempo')}</h2>
          {!esperando.length ? <p className="text-sm text-[var(--suave)]">{t('Ninguém esperando. 👏')}</p> : (
            <ul className="space-y-0.5">
              {esperando.map((l) => (
                <li key={l.id} className="flex items-center gap-1">
                  <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} tamanho="sm" />
                  <button type="button" onClick={() => ir('lote', { id: l.id })} className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1 text-left text-sm hover:bg-[var(--marca-suave)]">
                    <span className="min-w-0">
                      <span className="block truncate"><span className="font-mono text-xs">{l.codigo}</span> · <b>{l.nome}</b></span>
                      <span className="block truncate text-xs text-[var(--suave)]">{colDe(l.fase)?.nome} · {origemTexto(l, t)}</span>
                    </span>
                    <span className="num shrink-0 whitespace-nowrap text-right">{gramasTexto(l.saldo)}<b className={cx('block', l.atrasado ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>{t('{n} d', { n: l.dias })}</b></span>
                  </button>
                  <MenuAcoes acoes={menuDe(l)} />
                </li>
              ))}
            </ul>
          )}
          {dados.lotes.some((l) => l.atrasado) && <button type="button" onClick={() => setFiltro('atrasados')} className="mt-1 min-h-10 text-sm font-semibold text-[var(--marca)]">{t('Ver os parados há mais de {n} dias →', { n: dados.diasAviso })}</button>}
        </div>
        <div className="min-w-0 md:border-l md:border-[var(--borda)] md:pl-3">
          <h2 className="mb-1 text-sm font-bold">✂️ {t('Perda no mês')}</h2>
          <button type="button" onClick={() => setFiltro(filtro === 'mes' ? '' : 'mes')} className="w-full rounded-lg px-1 text-left hover:bg-[var(--marca-suave)]">
            <span className={cx('num block text-3xl font-black', tt.perdaMesBp > 500 && 'text-[var(--ruim)]')}>{fmt(tt.perdaMesBp, 'percentual')}</span>
            <span className="block text-sm text-[var(--suave)]">{tt.usadoMes ? t('{p} perdidos de {u} separados desde {d}', { p: gramasTexto(tt.perdaMes), u: gramasTexto(tt.usadoMes), d: dataBR(dados.mesDesde) }) : t('Nenhuma separação neste mês.')}</span>
          </button>
        </div>
      </section>

      <ProntoParaVender
        lotes={prontos}
        total={tt.pronto}
        valor={tt.prontoValor}
        menuDe={menuDe}
        onLote={(id) => ir('lote', { id })}
        onVender={vender}
        onEstoque={(med) => ir('estoque', { modulo: 'cabelo', 'min.comprimento': med, 'max.comprimento': med })}
        onFiltrar={(med) => ajustarParams({ f: 'pronto', m: med || undefined })}
      />

      {(filtro || medida) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--suave)]">{t('Mostrando')}:</span>
          {filtro && <Pilula tom="marca">{t(nomeFiltro(filtro))}</Pilula>}
          {medida && <Pilula tom="marca">{medida} cm</Pilula>}
          <button type="button" onClick={() => ajustarParams({ f: undefined, m: undefined })} className="min-h-10 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">✕ {t('Ver tudo')}</button>
        </div>
      )}

      {visao === 'quadro' ? (
        <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-2">
          {cols.map((c) => (
            <Coluna key={c.id} col={c} lotes={lotes.filter((l) => l.fase === c.id)} alvo={alvo === c.id} {...zona(c)} rodape={c.id === COLUNA_VENDIDO ? <VerVendidos dados={dados} todos={vendidos === 'todos'} onTodos={(v) => setVendidos(v ? 'todos' : '')} /> : undefined}>
              {(ls) => ls.map(cartao)}
            </Coluna>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {cols.map((c) => (
            <Coluna key={c.id} col={c} lotes={lotes.filter((l) => l.fase === c.id)} lista rodape={c.id === COLUNA_VENDIDO ? <VerVendidos dados={dados} todos={vendidos === 'todos'} onTodos={(v) => setVendidos(v ? 'todos' : '')} /> : undefined}>
              {(ls) => ls.map(cartao)}
            </Coluna>
          ))}
        </div>
      )}

      </>}
      {/* ações em massa */}
      {sel.size > 0 && (
        <div role="toolbar" aria-label={t('Ações nos selecionados')} className="fixed inset-x-2 bottom-20 z-30 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-2 shadow-xl md:bottom-4">
          <span className="px-2 text-sm font-bold">{t('{n} selecionado(s)', { n: sel.size })} · <span className="num">{gramasTexto(selecionados.reduce((s, l) => s + l.saldo, 0))}</span></span>
          <Botao disabled={ocupado || !selecionados.length || selecionados.some((l) => l.fase === COLUNA_VENDIDO)} onClick={() => ir('separar', { ids: selecionados.map((l) => l.id).join(','), volta: 'triagem' })}>✂️ {t(sel.size > 1 ? 'Juntar e separar' : 'Separar')}</Botao>
          <Botao variante="secundario" disabled={ocupado || sel.size < 2 || selecionados.some((l) => l.fase === COLUNA_VENDIDO)} title={t('Junta 2 ou mais lotes num lote só')} onClick={() => setJanela('unificar')}>🔗 {t('Só juntar')}</Botao>
          <span className="flex items-center gap-1">
            <Selecao className="min-w-[10rem]" valor={moverPara} onChange={setMoverPara} vazio={t('Mover para…')} opcoes={trabalho.map((c) => ({ id: c.id, nome: c.nome }))} />
            <Botao variante="secundario" disabled={ocupado || !moverPara} onClick={() => mover(selecionados.filter((l) => l.fase !== moverPara && l.fase !== COLUNA_VENDIDO).map((l) => l.id), moverPara)}>{t('Mover')}</Botao>
          </span>
          {primeiraPronta && <Botao variante="secundario" disabled={ocupado || !brutos} onClick={() => setJanela('triado')}>✓ {t('Marcar como triado')}</Botao>}
          <Botao variante="secundario" onClick={() => setEtiquetas([...sel])}>🏷 {t('Etiquetas')}</Botao>
          <Botao variante="leve" className="ml-auto" onClick={limparSel}>{t('Limpar')}</Botao>
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
      {editar && <EditarAtributos id={editar.id} campos={campos} valores={editar.campos} onFechar={() => setEditar(undefined)} />}
      {trocar && <TrocarCodigo tipo="lote" id={trocar.id} atual={trocar.codigo} onFechar={() => setTrocar(undefined)} />}
      {etiquetas && <ImprimirEtiquetas ids={etiquetas} onFechar={() => setEtiquetas(undefined)} />}
      {lendo && <LeitorCodigo onLer={(c) => (setLendo(false), setBusca(c))} onFechar={() => setLendo(false)} />}
    </div>
  )
}

/** PRONTO PARA VENDER: por medida (abre e fecha); cada LOTE numa linha com origem, gramas, valor, margem, Vender e "⋯". */
function ProntoParaVender({ lotes, total, valor, menuDe, onLote, onVender, onEstoque, onFiltrar }: { lotes: Lote[]; total: number; valor: number; menuDe(l: Lote): Acao[]; onLote(id: Id): void; onVender(p: Params): void; onEstoque(med: string): void; onFiltrar(med: string): void }) {
  const t = useT()
  const m = moedaPadrao()
  const grupos = new Map<string, Lote[]>()
  for (const l of [...lotes].sort((a, b) => b.saldo - a.saldo)) {
    const k = l.campos.comprimento ? String(l.campos.comprimento) : ''
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }
  const ordem = [...grupos].sort((a, b) => Number(b[0] || 0) - Number(a[0] || 0))
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(lotes.length <= MAX_PRONTOS ? ordem.map(([k]) => k) : []))
  const [todos, setTodos] = useState<Set<string>>(new Set())
  const semPreco = lotes.filter((l) => l.semPreco).length
  const alternar = (k: string) => setAbertos((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  return (
    <section aria-label={t('Pronto para vender')} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-bold">💰 {t('Pronto para vender')}</h2>
        <span className="num text-sm text-[var(--suave)]"><span className="whitespace-nowrap">{t('{n} lote(s)', { n: lotes.length })}</span> · <span className="whitespace-nowrap">{gramasTexto(total)}</span> · <b className="whitespace-nowrap text-[var(--texto)]">{formatar(valor, m)}</b></span>
      </div>
      {semPreco > 0 && <p className="mb-2 rounded-xl bg-[var(--alerta)]/10 p-2 text-sm font-semibold text-[var(--alerta)]">⚠️ {t('{n} lote(s) triado(s) sem preço na tabela', { n: semPreco })}</p>}
      {!lotes.length ? <p className="text-sm text-[var(--suave)]">{t('Nada triado ainda: separe um lote para começar a vender.')}</p> : (
        <div className="space-y-2">
          {ordem.map(([med, ls]) => {
            const aberto = abertos.has(med)
            const mostrar = todos.has(med) ? ls : ls.slice(0, MAX_PRONTOS)
            const g = ls.reduce((s, l) => s + l.saldo, 0)
            const v = ls.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
            return (
              <div key={med} className="rounded-xl border border-[var(--borda)]">
                <div className="flex items-center gap-1 rounded-xl bg-[var(--fundo)] pl-2">
                  <button type="button" aria-expanded={aberto} onClick={() => alternar(med)} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0 py-1 text-left text-sm">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={cx('inline-block text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
                      <b className="whitespace-nowrap text-base">{med ? `${med} cm` : t('Sem medida')}</b>
                    </span>
                    <span className="num text-[var(--suave)]"><span className="whitespace-nowrap">{t('{n} lote(s)', { n: ls.length })}</span> · <span className="whitespace-nowrap">{gramasTexto(g)}</span> · <b className="whitespace-nowrap text-[var(--texto)]">{v ? formatar(v, m) : '—'}</b></span>
                  </button>
                  <MenuAcoes acoes={[
                    { rotulo: aberto ? 'Esconder os lotes' : 'Mostrar os lotes', icone: aberto ? '▴' : '▾', onClick: () => alternar(med) },
                    ...(med ? [
                      { rotulo: 'Ver lotes desta medida no estoque', icone: '📦', onClick: () => onEstoque(med) },
                      { rotulo: 'Só esta medida no quadro', icone: '🔍', onClick: () => onFiltrar(med) },
                      { rotulo: 'Vender esta medida', icone: '💰', onClick: () => onVender({ medida: med, categoria: String(ls[0].campos.categoria || 'Normal') }) },
                    ] : []),
                  ]} />
                </div>
                {aberto && (
                  <ul className="divide-y divide-[var(--borda)]">
                    {mostrar.map((l) => {
                      const pct = l.preco && l.margem !== undefined && l.preco.valorPrincipal ? Math.round((l.margem * 10000) / l.preco.valorPrincipal) : undefined
                      return (
                        <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2">
                          <MiniaturaLote itemId={l.id} foto={l.foto} marcador={marcadorLote(l.campos, l.nome)} />
                          <div {...clicavel(() => onLote(l.id))} className="min-w-0 flex-1 basis-40 cursor-pointer rounded-lg outline-none hover:underline focus-visible:bg-[var(--marca-suave)]">
                            <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-mono text-xs text-[var(--suave)]">{l.codigo}</span><b className="[overflow-wrap:anywhere]">{l.nome}</b></div>
                            <div className="text-xs text-[var(--suave)] [overflow-wrap:anywhere]">🛒 {origemTexto(l, t)}</div>
                            <CadeiaChips className="mt-1" cadeia={l.cadeia} />
                          </div>
                          <div className="num flex w-full shrink-0 items-center gap-2 text-right sm:ml-auto sm:w-auto">
                            <span className="mr-auto whitespace-nowrap font-semibold sm:mr-0">{gramasTexto(l.saldo)}</span>
                            <span className="min-w-0 sm:min-w-[6.5rem]">
                              {l.preco ? <b className="block whitespace-nowrap">{formatar(l.preco.valor, l.preco.moeda)}</b> : <span className="block text-xs font-semibold text-[var(--alerta)]">⚠️ {l.semPreco === 'medida' ? t('sem medida') : t('sem preço na tabela')}</span>}
                              {l.margem !== undefined && <span className={cx('block text-xs font-semibold', l.margem < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{t('margem')} <span className="whitespace-nowrap">{formatar(l.margem, m)}</span>{pct !== undefined && <span className="whitespace-nowrap"> ({fmt(pct, 'percentual')})</span>}</span>}
                            </span>
                            <Botao className="shrink-0 px-3" onClick={() => onVender({ lote: l.id })}>💰 <span className="hidden sm:inline">{t('Vender')}</span><span className="sr-only sm:hidden">{t('Vender')}</span></Botao>
                            <MenuAcoes acoes={menuDe(l)} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {aberto && ls.length > MAX_PRONTOS && (
                  <button type="button" onClick={() => setTodos((s) => { const n = new Set(s); if (n.has(med)) n.delete(med); else n.add(med); return n })} className="min-h-10 w-full text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                    {todos.has(med) ? t('Mostrar menos') : t('Ver todos ({n})', { n: ls.length })}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Numero({ rotulo, valor, sub, cor, ativo, onClick }: { rotulo: string; valor: string; sub: string; cor: string; ativo: boolean; onClick(): void }) {
  const t = useT()
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick} className={cx('min-w-0 rounded-2xl border-2 bg-[var(--cartao)] p-4 text-left shadow-sm transition hover:border-[var(--marca)]', ativo ? 'border-[var(--marca)]' : 'border-transparent')}>
      <span className="flex items-start gap-2 text-xs font-semibold leading-tight text-[var(--suave)]"><span aria-hidden className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />{t(rotulo)}</span>
      <span className="num mt-1 block whitespace-nowrap text-2xl font-black">{valor}</span>
      <span className="num block truncate text-xs text-[var(--suave)]">{sub}</span>
    </button>
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
  secundarias: { rotulo: string; titulo: string; f(): void }[]
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
        {!vendido && <input type="checkbox" className="h-5 w-5 shrink-0" checked={p.marcado} onChange={(e) => p.onMarcar(e.target.checked)} aria-label={t('Selecionar {c}', { c: l.codigo ?? l.nome })} />}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="font-mono text-xs text-[var(--suave)]">{l.codigo}</span>
          {l.unificado > 0 && <Pilula tom="marca">🔗 {t('{n} lotes', { n: l.unificado })}</Pilula>}
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
      {(p.acao || p.secundarias.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {p.acao && <Botao className="min-w-0 flex-1 [overflow-wrap:anywhere]" disabled={p.ocupado} onClick={p.acao.f}>{t(p.acao.rotulo)}</Botao>}
          {p.secundarias.map((s) => <Botao key={s.titulo} variante="leve" disabled={p.ocupado} onClick={s.f} title={t(s.titulo)} aria-label={t(s.titulo)}>{s.rotulo}</Botao>)}
        </div>
      )}
    </li>
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
    <Janela aberta larga titulo={t('Unificar {n} lotes', { n: lotes.length })} onFechar={onFechar} rodape={
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
function ListaTriagens({ aberta }: { aberta?: string }) {
  const t = useT()
  const { ir, ajustarParams } = useApp()
  const { dados } = useConsulta('triagens', { moduloId: 'cabelo' })
  if (!dados) return <Carregando />
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
