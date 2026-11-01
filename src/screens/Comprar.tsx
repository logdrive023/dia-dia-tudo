// COMPRAR — a alma do negócio.
//  /pedidos           lista em TABELA (ordenável, busca, filtros de situação e pendência) — "Comprar"
//  /pedidos/novo      tela de NOVA COMPRA (formulário + resumo ao lado: total, peso, custo/kg, conta do fornecedor)
//  /pedidos/:id       tela do PEDIDO (etapas, o que falta, itens, pagamento, conta, lotes, arquivos, linha do tempo)
// Todo pedido passa pela triagem (quem fez fica registrado) e só então entra no estoque.

import { type ReactNode, useState } from 'react'
import { formatar, multiplicarFator, fatorValido } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Campos, Id, Transacao } from '../core/domain/tipos'
import { fatorDaTabela } from '../core/services/precos'
import { Botao, Campo, Carregando, Cartao, Confirmar, Entrada, Erro, GramasInput, Info, Pilula, Selecao, ValorInput, Vazio, cx, dataBR, gramasTexto } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { Anexos, EditorPagamentos, type PagamentoTela, SeletorPessoa } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { FiltroPendencia, SeloPendencias } from '../ui/pendencias'
import { useT } from '../ui/i18n'

const ENCERRADAS = ['concluido', 'recusado', 'cancelado']
const codigoDe = (c: { codigo?: string; id: string }) => c.codigo ?? `#${c.id.slice(-5)}`

/** Progresso das etapas em miniatura (lista) ou completo (tela do pedido). */
function Progresso({ etapas, atual, mini }: { etapas: { id: string; nome: string }[]; atual: string; mini?: boolean }) {
  const t = useT()
  const idx = atual === 'concluido' ? etapas.length - 1 : etapas.findIndex((e) => e.id === atual)
  const parou = atual === 'recusado' || atual === 'cancelado'
  if (mini)
    return (
      <span className="flex items-center gap-1" title={etapas.map((e) => t(e.nome)).join(' → ')}>
        {etapas.map((e, i) => (
          <span key={e.id} className={cx('h-1.5 w-5 rounded-full', parou ? 'bg-[var(--ruim)]/40' : i <= idx ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')} />
        ))}
      </span>
    )
  return (
    <ol className="flex w-full items-start">
      {etapas.map((e, i) => {
        const feito = !parou && i < idx
        const agora = !parou && i === idx
        return (
          <li key={e.id} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cx('absolute right-1/2 top-4 h-0.5 w-full', feito || agora ? 'bg-[var(--marca)]' : 'bg-[var(--borda)]')} aria-hidden />}
            <span className={cx('relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold', feito ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : agora ? 'border-[var(--marca)] bg-[var(--cartao)] text-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)] text-[var(--suave)]')}>
              {feito || (agora && atual === 'concluido') ? '✓' : i + 1}
            </span>
            <span className={cx('mt-1 px-1 text-xs', agora ? 'font-bold text-[var(--marca)]' : 'text-[var(--suave)]')}>{t(e.nome)}</span>
          </li>
        )
      })}
    </ol>
  )
}

type Ordem = 'data' | 'total' | 'parada'

export function Comprar() {
  const t = useT()
  const { nav, ir } = useApp()
  const [aba, setAba] = useState<'abertas' | 'encerradas' | 'todas'>(nav.params.encerradas ? 'encerradas' : 'abertas')
  const [pendencia, setPendencia] = useState(((nav.params.pendencia as string) ?? (nav.params.semComprovante ? 'semComprovanteOrigem' : '')) as string)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<{ por: Ordem; desc: boolean }>({ por: 'data', desc: true })
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: true })
  const { dados: cfg } = useConsulta('configuracoes', {})
  if (nav.params.id) return <Pedido />
  const etapasDo = (moduloId: string) => cfg?.modulos.find((m) => m.id === moduloId)?.etapas ?? []
  const todas = fila ?? []
  const daAba = todas.filter((c) => (aba === 'todas' ? true : aba === 'abertas' ? !ENCERRADAS.includes(c.etapa) : ENCERRADAS.includes(c.etapa)))
  const tem = (c: (typeof daAba)[number], id: string) => (id === 'qualquer' ? c.pendencias.length > 0 : c.pendencias.some((x) => x.id === id))
  const b = busca.trim().toLowerCase()
  const lista = daAba
    .filter((c) => !pendencia || tem(c, pendencia))
    .filter((c) => !b || `${codigoDe(c)} ${c.pessoa ?? ''} ${c.linhas.map((l) => l.descricao).join(' ')} ${c.obs ?? ''}`.toLowerCase().includes(b))
    .sort((x, y) => {
      const v = ordem.por === 'total' ? x.totalPrincipal - y.totalPrincipal : ordem.por === 'parada' ? x.diasParada - y.diasParada : x.data + x.criadoEm < y.data + y.criadoEm ? -1 : 1
      return ordem.desc ? -v : v
    })
  const opcoesPend = [{ id: 'paradaTriagem', nome: 'Parada na triagem' }, { id: 'semFotos', nome: 'Sem fotos' }, { id: 'semComprovanteOrigem', nome: 'Sem comprovante de origem' }, { id: 'faltaPagar', nome: 'Falta pagar' }]
  const contagem = Object.fromEntries([['', daAba.length], ['qualquer', daAba.filter((c) => tem(c, 'qualquer')).length], ...opcoesPend.map((o) => [o.id, daAba.filter((c) => tem(c, o.id)).length])])
  const abertas = todas.filter((c) => !ENCERRADAS.includes(c.etapa))
  const resumo = [
    { nome: 'Na triagem', valor: String(abertas.length) },
    { nome: 'Valor na triagem', valor: formatar(abertas.reduce((s, c) => s + c.totalPrincipal, 0), cfg?.config.moedaPrincipal ?? 'BOB') },
    { nome: 'Peso na triagem', valor: gramasTexto(abertas.reduce((s, c) => s + c.linhas.reduce((x, l) => x + l.quantidade, 0), 0)) },
    { nome: 'Com pendência', valor: String(todas.filter((c) => c.pendencias.length).length) },
  ]
  const Th = ({ por, children, direita }: { por?: Ordem; children: ReactNode; direita?: boolean }) => (
    <th className={cx('whitespace-nowrap px-3 py-2 text-xs font-medium text-[var(--suave)]', direita && 'text-right')}>
      {por ? (
        <button type="button" onClick={() => setOrdem({ por, desc: ordem.por === por ? !ordem.desc : true })} className="inline-flex items-center gap-1 hover:text-[var(--texto)]">
          {children} {ordem.por === por && <span aria-hidden>{ordem.desc ? '↓' : '↑'}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('Pedidos de compra')}</h1>
          <p className="text-sm text-[var(--suave)]">{t('Todo pedido passa pela triagem antes de entrar no estoque.')}</p>
        </div>
        <Botao grande onClick={() => ir('novaCompra')}>+ {t('Nova compra')}</Botao>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {resumo.map((r) => (
          <div key={r.nome} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
            <div className="text-xs text-[var(--suave)]">{t(r.nome)}</div>
            <div className="num text-xl font-bold">{r.valor}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[var(--borda)]">
        {([['abertas', 'Na triagem'], ['encerradas', 'Encerradas'], ['todas', 'Todas']] as const).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={cx('-mb-px min-h-10 border-b-2 px-3 text-sm', aba === id ? 'border-[var(--marca)] font-semibold text-[var(--marca)]' : 'border-transparent text-[var(--suave)]')}>
            {t(nome)}
          </button>
        ))}
        <Entrada className="mb-1 ml-auto w-full sm:w-64" placeholder={t('Buscar pedido, fornecedor, item…')} value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="mb-3">
        <FiltroPendencia valor={pendencia} onChange={setPendencia} contagem={contagem} opcoes={opcoesPend.filter((o) => contagem[o.id] || pendencia === o.id)} />
      </div>

      {!fila ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio texto="Nenhum pedido com esse filtro." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-[var(--borda)] bg-[var(--fundo)] text-left md:table-header-group">
              <tr>
                <Th por="data">{t('Pedido')}</Th>
                <Th>{t('Fornecedor')}</Th>
                <Th>{t('Itens')}</Th>
                <Th>{t('Etapa')}</Th>
                <Th>{t('O que falta')}</Th>
                <Th por="parada" direita>{t('Parada')}</Th>
                <Th por="total" direita>{t('Total')}</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const gramas = c.linhas.reduce((s, l) => s + l.quantidade, 0)
                return (
                  <tr key={c.id} onClick={() => ir('pedido', { id: c.id })} className="cursor-pointer border-t border-[var(--borda)] first:border-t-0 hover:bg-[var(--marca-suave)] max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-3 max-md:p-3">
                    <td className="px-3 py-3 max-md:p-0">
                      <span className="font-mono text-xs font-semibold text-[var(--marca)]">{codigoDe(c)}</span>
                      <span className="block text-xs text-[var(--suave)]">{dataBR(c.data)}</span>
                    </td>
                    <td className="px-3 py-3 font-semibold max-md:order-first max-md:col-span-2 max-md:p-0">{c.pessoa ?? t('Sem fornecedor')}</td>
                    <td className="px-3 py-3 max-md:hidden">
                      <span className="block max-w-[16rem] truncate">{c.linhas.map((l) => l.descricao).join(' · ')}</span>
                      <span className="num text-xs text-[var(--suave)]">{c.linhas.length} {t('item(ns)')} · {gramasTexto(gramas)}</span>
                    </td>
                    <td className="px-3 py-3 max-md:p-0">
                      <span className={cx('block text-xs font-semibold', c.etapa === 'concluido' ? 'text-[var(--bom)]' : ENCERRADAS.includes(c.etapa) ? 'text-[var(--ruim)]' : 'text-[var(--marca)]')}>{t(c.nomeEtapa)}</span>
                      <Progresso etapas={etapasDo(c.moduloId)} atual={c.etapa} mini />
                    </td>
                    <td className="px-3 py-3 max-md:col-span-2 max-md:p-0 max-md:pt-1">
                      <SeloPendencias pendencias={c.pendencias} moeda={c.moedaPrincipal} compacto />
                    </td>
                    <td className="num px-3 py-3 text-right text-[var(--suave)] max-md:hidden">{ENCERRADAS.includes(c.etapa) ? '—' : `${c.diasParada} d`}</td>
                    <td className="num px-3 py-3 text-right font-bold max-md:col-start-2 max-md:row-start-2 max-md:p-0">{formatar(c.totalPrincipal, c.moedaPrincipal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface LinhaNova {
  id: Id
  modo: 'bruto' | 'tabela' | 'item'
  itemId?: Id
  quantidade?: number
  total?: number
  medida?: number
  fator?: string
  campos: Campos
}

/** Tela de NOVA COMPRA (também usada para "repetir" uma compra: os campos vêm preenchidos). */
export function NovaCompraTela() {
  const { nav } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const repetir = nav.params.repetir as Id | undefined
  const { dados: base } = useConsulta('compra', { id: repetir ?? '' }, !!repetir)
  if (!cfg || (repetir && !base)) return <Carregando />
  const modulos = cfg.modulos.filter((m) => m.temCompra && cfg.config.modulosAtivos.includes(m.id))
  return <NovaCompra key={repetir ?? 'nova'} modulos={modulos} base={base?.compra} />
}

function NovaCompra({ modulos, base }: { modulos: { id: string; nome: string; icone: string }[]; base?: Transacao }) {
  const t = useT()
  const { ir, voltar } = useApp()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [moduloId, setModuloId] = useState(base?.moduloId ?? modulos[0]?.id ?? 'cabelo')
  const [pessoaId, setPessoaId] = useState<Id | undefined>(base?.pessoaId)
  const [obs, setObs] = useState('')
  const ehCabelo = moduloId === 'cabelo'
  const [linhas, setLinhas] = useState<LinhaNova[]>(
    base
      ? base.linhas.map((l) => ({ id: novoId(), modo: l.campos.fator ? 'tabela' : ehCabelo ? 'bruto' : 'item', itemId: ehCabelo ? undefined : l.itemId, quantidade: l.quantidade, total: l.total, medida: l.campos.comprimento as number | undefined, fator: l.campos.fator as string | undefined, campos: { ...l.campos } }))
      : [{ id: novoId(), modo: ehCabelo ? 'bruto' : 'item', campos: ehCabelo ? { estado: 'Bruto', categoria: 'Normal' } : {} }],
  )
  const { dados: tabelas } = useConsulta('tabelasPreco', { moduloId: 'cabelo' })
  const { dados: catalogo } = useConsulta('catalogo', { moduloId })
  const tabela = tabelas?.find((x) => !x.categoria) ?? tabelas?.[0]
  const colunaFornecedor = tabela?.colunas.find((c) => c.pessoaId === pessoaId)?.id
  const [coluna, setColuna] = useState<string>()
  const col = coluna ?? colunaFornecedor ?? tabela?.colunas[0]?.id
  const att = (i: number, d: Partial<LinhaNova>) => setLinhas(linhas.map((l, k) => (k === i ? { ...l, ...d } : l)))
  const totalLinha = (l: LinhaNova) => {
    if (l.modo === 'tabela') {
      const f = l.fator || (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined)
      return l.quantidade && f && fatorValido(f) ? multiplicarFator(l.quantidade, f, 'BOB') : undefined
    }
    return l.total
  }
  const total = linhas.reduce((s, l) => s + (totalLinha(l) ?? 0), 0)
  const pesoTotal = linhas.reduce((s, l) => s + (l.quantidade ?? 0), 0)

  const salvar = async () => {
    const r = await executar('criarCompra', {
      id,
      moduloId,
      pessoaId,
      obs,
      linhas: linhas.map((l) => {
        const fator = l.modo === 'tabela' ? l.fator || (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : undefined) : undefined
        return {
          id: l.id,
          itemId: l.itemId,
          quantidade: l.quantidade ?? 0,
          moeda: 'BOB',
          total: l.total ?? 0,
          campos: { ...l.campos, estado: l.modo === 'bruto' ? 'Bruto' : ehCabelo ? 'Separado' : undefined },
          calculo: fator ? { medida: l.medida, fator, tabelaId: tabela?.id, colunaId: col, categoria: l.campos.categoria as string | undefined } : undefined,
        }
      }),
    }, t('Compra registrada. Agora é só andar a triagem.'))
    if (r) ir('pedido', { id: r.id })
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Botao variante="leve" onClick={voltar}>← {t('Pedidos')}</Botao>
      </div>
      <h1 className="mb-4 text-2xl font-bold">{t(base ? 'Repetir compra' : 'Nova compra')}</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Cartao titulo={t('1. Fornecedor e tipo')}>
        <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="O que está comprando?">
            <Selecao valor={moduloId} onChange={setModuloId} opcoes={modulos.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} />
          </Campo>
          <SeletorPessoa rotulo="De quem?" valor={pessoaId} onChange={setPessoaId} papel="fornecedor" />
        </div>
        {ehCabelo && tabela && (
          <Campo rotulo="Coluna da tabela (preço do fornecedor)" ajuda="Compra pela tabela: medida | gramas × fator da coluna do fornecedor.">
            <Selecao valor={col} onChange={setColuna} opcoes={tabela.colunas.map((c) => ({ id: c.id, nome: c.nome }))} />
          </Campo>
        )}
        </div>
        </Cartao>
        <Cartao titulo={t('2. O que veio')}>
        <div className="space-y-3">
        {linhas.map((l, i) => (
          <div key={l.id} className="rounded-xl border border-[var(--borda)] p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {ehCabelo && (
                <div className="flex gap-1">
                  {(['bruto', 'tabela'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => att(i, { modo: m })} className={cx('rounded-lg px-3 py-1 text-sm font-semibold', l.modo === m ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')}>
                      {t(m === 'bruto' ? 'Lote bruto (separar depois)' : 'Já separado (pela tabela)')}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="ml-auto text-xl" aria-label={t('Tirar')} onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}>×</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {l.modo === 'item' && (
                <Campo rotulo="Item" className="sm:col-span-2">
                  <Selecao valor={l.itemId} onChange={(v) => att(i, { itemId: v })} vazio="Escolha…" opcoes={(catalogo ?? []).map((x) => ({ id: x.id, nome: x.nome }))} />
                </Campo>
              )}
              {l.modo === 'tabela' && (
                <>
                  <Campo rotulo="Medida (cm)"><Entrada inputMode="numeric" value={l.medida ?? ''} onChange={(e) => att(i, { medida: Number(e.target.value) || undefined })} /></Campo>
                  <Campo rotulo="Categoria"><Selecao valor={String(l.campos.categoria ?? 'Normal')} onChange={(v) => att(i, { campos: { ...l.campos, categoria: v } })} opcoes={['Normal', 'Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo', 'Entresaque'].map((c) => ({ id: c, nome: c }))} /></Campo>
                </>
              )}
              <Campo rotulo={moduloId === 'cabelo' ? 'Peso' : 'Quantidade'}>
                {moduloId === 'cabelo' ? <GramasInput valor={l.quantidade} onChange={(q) => att(i, { quantidade: q })} /> : <Entrada inputMode="numeric" value={l.quantidade ?? ''} onChange={(e) => att(i, { quantidade: Number(e.target.value) || undefined })} />}
              </Campo>
              {l.modo === 'tabela' ? (
                <Campo rotulo="Fator">
                  <Entrada inputMode="decimal" value={l.fator ?? ''} placeholder={tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator ?? '?' : '?'} onChange={(e) => att(i, { fator: e.target.value })} />
                </Campo>
              ) : (
                <Campo rotulo="Valor total"><ValorInput moeda="BOB" valor={l.total} onChange={(v) => att(i, { total: v })} /></Campo>
              )}
            </div>
            {l.modo === 'bruto' && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Campo rotulo="Cor"><Selecao valor={String(l.campos.cor ?? '')} vazio="—" onChange={(v) => att(i, { campos: { ...l.campos, cor: v } })} opcoes={['Misturado', 'Preto', 'Castanho', 'Loiro'].map((c) => ({ id: c, nome: c }))} /></Campo>
                <Campo rotulo="Origem"><Selecao valor={String(l.campos.origem ?? '')} vazio="—" onChange={(v) => att(i, { campos: { ...l.campos, origem: v } })} opcoes={['Bolívia', 'Paraguai', 'Brasil', 'Peru', 'Outro'].map((c) => ({ id: c, nome: c }))} /></Campo>
                {l.quantidade && l.total ? <p className="self-end text-sm text-[var(--suave)]">{t('Custo por kg')}: <b className="num">{formatar(Math.round((l.total * 1000) / l.quantidade), 'BOB')}</b></p> : null}
              </div>
            )}
            {l.modo === 'tabela' && totalLinha(l) !== undefined && (
              <p className="num mt-2 font-bold">{l.medida} | {l.quantidade?.toLocaleString('pt-BR')} × {l.fator || (tabela && l.medida && col ? fatorDaTabela(tabela, l.medida, col).fator : '?')} = {formatar(totalLinha(l)!, 'BOB')}</p>
            )}
          </div>
        ))}
        <Botao variante="secundario" onClick={() => setLinhas([...linhas, { id: novoId(), modo: ehCabelo ? 'tabela' : 'item', campos: ehCabelo ? { categoria: 'Normal' } : {} }])}>+ {t('Outra linha')}</Botao>
        </div>
        </Cartao>
        <Cartao titulo={t('3. Fotos, PDF e arquivos')} ajuda="Foto do cabelo/pedido e o comprovante de origem. Ex.: foto do lote na balança + recibo de quem vendeu.">
          <Anexos donoId={id} categorias={['pedido', 'produto', 'comprovante', 'origem']} />
          <div className="mt-3"><Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo></div>
        </Cartao>
      </div>

      {/* resumo fixo ao lado */}
      <aside className="h-fit space-y-3 lg:sticky lg:top-4">
        <Cartao titulo={t('Resumo do pedido')}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Linhas')}</dt><dd className="num">{linhas.length}</dd></div>
            {ehCabelo && <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Peso')}</dt><dd className="num">{gramasTexto(pesoTotal)}</dd></div>}
            {ehCabelo && pesoTotal > 0 && total > 0 && <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Custo por kg')}</dt><dd className="num">{formatar(Math.round((total * 1000) / pesoTotal), 'BOB')}</dd></div>}
            <div className="flex justify-between border-t border-[var(--borda)] pt-2 text-base font-bold"><dt>{t('Total')}</dt><dd className="num">{formatar(total, 'BOB')}</dd></div>
          </dl>
          <Botao grande className="mt-4 w-full" disabled={ocupado || !linhas.length || total <= 0} onClick={salvar}>{t('Registrar pedido')}</Botao>
          <p className="mt-2 text-xs text-[var(--suave)]">{t('Depois de registrar, o pedido anda pela triagem: Chegou → Conferido → Pago → No estoque.')}</p>
        </Cartao>
        {pessoaId && <ContaFornecedor pessoaId={pessoaId} />}
      </aside>
      </div>
    </div>
  )
}

/** Situação do fornecedor ao lado da compra: saldo da conta e as últimas compras dele. */
function ContaFornecedor({ pessoaId }: { pessoaId: Id }) {
  const t = useT()
  const { ir } = useApp()
  const { dados: conta } = useConsulta('contaPessoa', { pessoaId })
  const { dados: fila } = useConsulta('filaTriagem', { incluirEncerradas: true })
  const ultimas = (fila ?? []).filter((c) => c.pessoaId === pessoaId).slice(0, 3)
  if (!conta) return null
  return (
    <Cartao titulo={conta.pessoa?.nome}>
      <p className={cx('text-sm font-semibold', conta.saldo > 0 ? 'text-[var(--bom)]' : conta.saldo < 0 ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>{t(conta.texto)}</p>
      {ultimas.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {ultimas.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => ir('pedido', { id: c.id })} className="flex w-full justify-between gap-2 text-left hover:text-[var(--marca)]">
                <span className="truncate"><span className="font-mono text-xs">{codigoDe(c)}</span> · {dataBR(c.data)}</span>
                <span className="num">{formatar(c.totalPrincipal, c.moedaPrincipal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}


/** Tela do PEDIDO (pedidos/:id): tudo de uma compra num lugar. */
export function Pedido() {
  const t = useT()
  const { nav, ir, voltar } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('pedido', { id })
  const { executar, ocupado } = useComando()
  const [ajustes, setAjustes] = useState<Record<Id, { quantidade?: number; total?: number }>>({})
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  const [motivo, setMotivo] = useState('')
  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  const c = dados.compra
  const m = c.moedaPrincipal
  const encerrado = ENCERRADAS.includes(c.etapa)
  const falta = c.totalPrincipal - dados.pago
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Botao variante="leve" onClick={voltar}>← {t('Pedidos')}</Botao>
      </div>

      {/* cabeçalho */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-[var(--marca)]">{codigoDe(c)}</span>
            <Pilula tom={c.etapa === 'concluido' ? 'bom' : encerrado ? 'ruim' : 'marca'}>{t(c.nomeEtapa)}</Pilula>
            <span className="text-sm text-[var(--suave)]">{dados.modulo.icone} {t(dados.modulo.nome)}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold">{dados.pessoa?.nome ?? t('Sem fornecedor')}</h1>
          <p className="text-sm text-[var(--suave)]">{dataBR(c.data)}{c.obs ? ` · ${c.obs}` : ''}{!encerrado ? ` · ${t('parada há {n} dias', { n: c.diasParada })}` : ''}</p>
        </div>
        <div className="text-right">
          <div className="num text-3xl font-black">{formatar(c.totalPrincipal, m)}</div>
          <div className="num text-sm text-[var(--suave)]">{gramasTexto(dados.gramas)}{dados.custoKg ? ` · ${formatar(dados.custoKg, m)}/kg` : ''}</div>
        </div>
      </div>

      {/* etapas */}
      <Cartao className="mb-4">
        <Progresso etapas={dados.etapas} atual={c.etapa} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--suave)]">{t('O que falta')}:</span>
          <SeloPendencias pendencias={c.pendencias} moeda={m} />
        </div>
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          <Cartao titulo={t('Itens')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--suave)]">
                    <th className="py-2 pr-3 font-medium">{t('Item')}</th>
                    <th className="py-2 pr-3 font-medium">{t('Conta')}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t('Peso')}</th>
                    <th className="py-2 text-right font-medium">{t('Total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.linhas.map((l) => (
                    <tr key={l.id} className="border-t border-[var(--borda)]">
                      <td className="py-2 pr-3 font-medium">{l.descricao}</td>
                      <td className="num whitespace-nowrap py-2 pr-3 text-[var(--suave)]">{l.campos.calculo ? String(l.campos.calculo).split(' = ')[0] : '—'}</td>
                      <td className="num whitespace-nowrap py-2 pr-3 text-right">{gramasTexto(l.quantidade)}</td>
                      <td className="num whitespace-nowrap py-2 text-right font-semibold">{formatar(l.total, l.moeda)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--borda)] font-bold">
                    <td className="py-2" colSpan={2}>{t('Total')}</td>
                    <td className="num whitespace-nowrap py-2 pr-3 text-right">{gramasTexto(dados.gramas)}</td>
                    <td className="num whitespace-nowrap py-2 text-right">{formatar(c.totalPrincipal, m)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Cartao>

          <EtapasCompra
            compra={c}
            ocupado={ocupado}
            ajustes={ajustes}
            setAjustes={setAjustes}
            pagamentos={pagamentos}
            setPagamentos={setPagamentos}
            motivo={motivo}
            setMotivo={setMotivo}
            avancar={async (para, motivoDado) => {
              const r = await executar('avancarTriagem', {
                compraId: c.id,
                para,
                motivo: motivoDado || motivo || undefined,
                ajustes: Object.entries(ajustes).map(([linhaId, a]) => ({ linhaId, ...a })),
                pagamentos: pagamentos.filter((p) => p.valor).map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })),
              }, t('Etapa registrada.'))
              if (r) {
                setAjustes({})
                setPagamentos([])
                setMotivo('')
              }
            }}
            cancelar={async () => {
              await executar('cancelarCompra', { compraId: c.id, motivo }, t('Compra cancelada.'))
            }}
          />

          <Cartao titulo={t('Fotos, PDF e arquivos')}>
            <Anexos donoId={c.id} categorias={['pedido', 'produto', 'comprovante', 'origem']} />
          </Cartao>

          <Cartao titulo={t('Linha do tempo')}>
            <LinhaDoTempo id={c.id} />
          </Cartao>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-4">
          <Cartao titulo={t('Pagamento')}>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Total')}</dt><dd className="num">{formatar(c.totalPrincipal, m)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--suave)]">{t('Pago no pedido')}</dt><dd className="num">{formatar(dados.pago, m)}</dd></div>
              {c.pagamentos.map((p) => (
                <div key={p.id} className="flex justify-between pl-3 text-xs text-[var(--suave)]"><dt>{t(p.forma)}</dt><dd className="num">{formatar(p.valor, p.moeda)}</dd></div>
              ))}
              {c.pagamentos.length > 0 && falta > 0 && <div className="flex justify-between font-semibold"><dt>{t('Diferença no pedido')}</dt><dd className="num">{formatar(falta, m)}</dd></div>}
            </dl>
          </Cartao>
          {dados.pessoa && (
            <Cartao titulo={t('Conta do fornecedor')} ajuda="Saldo de tudo com esta pessoa: compras, pagamentos, adiantamentos e acertos. Ex.: comprei Bs 6.000, paguei 5.000 → devo Bs 1.000." acao={<Botao variante="leve" onClick={() => ir('pessoa', { id: dados.pessoa!.id })}>{t('Abrir')}</Botao>}>
              <p className={cx('num text-lg font-bold', (dados.saldoConta ?? 0) < 0 ? 'text-[var(--ruim)]' : (dados.saldoConta ?? 0) > 0 ? 'text-[var(--bom)]' : '')}>
                {(dados.saldoConta ?? 0) < 0 ? `${t('Devo')} ${formatar(-(dados.saldoConta ?? 0), m)}` : (dados.saldoConta ?? 0) > 0 ? `${t('Me deve')} ${formatar(dados.saldoConta ?? 0, m)}` : t('Conta em dia')}
              </p>
              {dados.outras.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {dados.outras.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => ir('pedido', { id: o.id })} className="flex w-full justify-between gap-2 text-left hover:text-[var(--marca)]">
                        <span className="truncate"><span className="font-mono text-xs">{o.codigo ?? ''}</span> {dataBR(o.data)} · {t(o.etapa)}</span>
                        <span className="num">{formatar(o.total, m)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          )}
          {dados.lotes.length > 0 && (
            <Cartao titulo={t('Lotes deste pedido')} acao={<Botao variante="leve" onClick={() => ir('rastreio', { compraId: c.id })}>{t('Rastrear')}</Botao>}>
              <ul className="space-y-1 text-sm">
                {dados.lotes.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => ir('lote', { id: l.id })} className="flex w-full justify-between gap-2 text-left hover:text-[var(--marca)]">
                      <span className="truncate"><span className="font-mono text-xs">{l.codigo}</span> {l.nome}</span>
                      <span className="num shrink-0">{l.unidade === 'grama' ? gramasTexto(l.saldo) : l.saldo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
          <Cartao>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" onClick={() => ir('novaCompra', { repetir: c.id })}>⟳ {t('Repetir esta compra')}</Botao>
              {c.etapa === 'concluido' && <Botao variante="secundario" onClick={() => ir('rastreio', { compraId: c.id })}>{t('Rastrear: para onde foi')}</Botao>}
            </div>
          </Cartao>
        </aside>
      </div>
    </div>
  )
}

function EtapasCompra(p: {
  compra: Transacao
  ocupado: boolean
  ajustes: Record<Id, { quantidade?: number; total?: number }>
  setAjustes(a: Record<Id, { quantidade?: number; total?: number }>): void
  pagamentos: PagamentoTela[]
  setPagamentos(x: PagamentoTela[]): void
  motivo: string
  setMotivo(m: string): void
  avancar(para: string, motivo?: string): void
  cancelar(): void
}) {
  const t = useT()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const c = p.compra
  // as etapas vêm do módulo (genérico: cada modalidade define as suas)
  const etapas = cfg?.modulos.find((m) => m.id === c.moduloId)?.etapas ?? []
  const idx = etapas.findIndex((e) => e.id === c.etapa)
  const prox = etapas[idx + 1]
  const encerrada = ['concluido', 'recusado', 'cancelado'].includes(c.etapa)
  const [recusar, setRecusar] = useState(false)
  return (
    <Cartao titulo={t('Andar a triagem')}>
      {prox && !encerrada && <p className="mb-3 text-sm text-[var(--suave)]">{t('Próximo passo')}: <b className="text-[var(--texto)]">{t(prox.nome)}</b> <Info texto={prox.ajuda ?? ''} /></p>}
      {(c.etapa === 'recusado' || c.etapa === 'cancelado') && <Pilula tom="ruim">{t(c.etapa === 'recusado' ? 'Recusado' : 'Cancelado')}</Pilula>}
      {!encerrada && prox && (
        <div className="space-y-3">
          {!c.pagamentos.length && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--marca)]">{t('Ajustar peso ou valor (conferência)')}</summary>
              <div className="mt-2 space-y-2">
                {c.linhas.map((l) => (
                  <div key={l.id} className="grid grid-cols-2 gap-2 text-sm">
                    <Campo rotulo={`${l.descricao} · ${t('peso real')}`}><GramasInput valor={p.ajustes[l.id]?.quantidade ?? l.quantidade} onChange={(q) => p.setAjustes({ ...p.ajustes, [l.id]: { ...p.ajustes[l.id], quantidade: q } })} /></Campo>
                    <Campo rotulo="Valor"><ValorInput moeda={l.moeda} valor={p.ajustes[l.id]?.total ?? l.total} onChange={(v) => p.setAjustes({ ...p.ajustes, [l.id]: { ...p.ajustes[l.id], total: v } })} /></Campo>
                  </div>
                ))}
              </div>
            </details>
          )}
          {prox.faz?.includes('pagamento') && (
            <EditorPagamentos uso="compra" total={c.totalPrincipal} moedaTotal={c.moedaPrincipal} pagamentos={p.pagamentos} onChange={p.setPagamentos} permiteFiado={!!c.pessoaId} />
          )}
          <Campo rotulo="Observação / motivo (fica no histórico)"><Entrada value={p.motivo} onChange={(e) => p.setMotivo(e.target.value)} /></Campo>
          <div className="flex flex-wrap gap-2">
            <Botao grande disabled={p.ocupado} onClick={() => p.avancar(prox.id)}>→ {t(prox.nome)}</Botao>
            {!c.pagamentos.length && <Botao variante="perigo" disabled={p.ocupado} onClick={() => setRecusar(true)}>{t('Recusar')}</Botao>}
            {c.pagamentos.length > 0 && <Botao variante="leve" disabled={p.ocupado || !p.motivo} onClick={p.cancelar}>{t('Cancelar compra')}</Botao>}
          </div>
        </div>
      )}
      {recusar && <Confirmar titulo="Recusar este pedido?" texto="O pedido sai da triagem e não entra no estoque. Fica no histórico com o motivo." rotulo="Recusar" perigo pedirMotivo motivoPadrao={p.motivo} onFechar={() => setRecusar(false)} onConfirmar={(motivo) => (p.setMotivo(motivo), p.avancar('recusado', motivo))} />}
      {c.etapa === 'concluido' && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--bom)]">✓ {t('No estoque.')}</p>
          <Campo rotulo="Motivo para cancelar (devolve o dinheiro)"><Entrada value={p.motivo} onChange={(e) => p.setMotivo(e.target.value)} /></Campo>
          <Botao variante="leve" disabled={p.ocupado || !p.motivo} onClick={p.cancelar}>{t('Cancelar compra')}</Botao>
        </div>
      )}
    </Cartao>
  )
}
