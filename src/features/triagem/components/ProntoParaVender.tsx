// TRIAGEM › PRONTO PARA VENDER: os lotes já triados, agrupados (medida, faixa, categoria, cor), com o preço pela
// tabela; tocar abre o lote, e daqui vende ou manda para o estoque. Recebe tudo por props.
import { type KeyboardEvent, useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Info, cx, gramasTexto, moedaPadrao, Vazio } from '../../../shared/ui/base'
import { clicavel } from '../../../shared/ui/compartilhados'
import { type Params, useApp, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { type Acao, MenuAcoes } from '../../../shared/ui/menuAcoes'
import { ImprimirEtiquetas } from '../../../shared/ui/etiquetas'
import { FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { FiltrosProntos, PARAMS_PRONTOS, agruparProntos, filtrarProntos, useFiltroProntos, ativosProntos } from '../../../shared/ui/filtrosProntos'
import { type Lote } from '../model/comum'

const MAX_PRONTOS = 12

/** colunas da tabela "Prontos para vender": grupo | lotes | peso | valor | ⋯ (iguais no cabeçalho, nas linhas e no total) */
const GRADE_PRONTOS = 'grid grid-cols-[minmax(0,1fr)_3.75rem_6rem_2.5rem] items-center gap-x-1.5 sm:grid-cols-[minmax(0,1fr)_3.5rem_6rem_8rem_2.75rem] sm:gap-x-3'

const NOME_GRUPO: Record<string, string> = { medida: 'Medida', faixa: 'Faixa', categoria: 'Categoria', cor: 'Cor' }

const DICA_PRONTOS = 'Lotes já triados, agrupados por medida, com o preço pela tabela. Ex.: 60 cm · 4 lotes · 9 kg · Bs 137.000. Toque na linha para ver os lotes.'

/**
 * PRONTO PARA VENDER: fechado numa linha ("✅ 19,4 kg prontos · Bs 183.972 ›"); aberto, por medida (abre e fecha) e cada
 * LOTE numa linha com origem, gramas, valor, margem, Vender e "⋯".
 */
export function ProntoParaVender({ lotes, totalLotes, busca, onBusca, onKeyDown, onLote, onVender, onEstoque, onFiltrar }: { lotes: Lote[]; totalLotes: number; busca: string; onBusca(v: string): void; onKeyDown?(e: KeyboardEvent<HTMLInputElement>): void; total: number; valor: number; menuDe?(l: Lote): Acao[]; onLote(id: Id): void; onVender(p: Params): void; onEstoque(med: string): void; onFiltrar(med: string): void }) {
  const t = useT()
  const { ajustarParams } = useApp()
  const m = moedaPadrao()
  const secaoAberta = true
  const filtro = useFiltroProntos()
  // filtros abertos quando já há algum ligado (vindo de um link) ou quando a pessoa toca em "⚙ Filtros"
  const [verFiltrosEscolha, setVerFiltros] = useState<boolean>()
  const verFiltros = verFiltrosEscolha ?? filtro.ativo
  const todosFiltrados = filtrarProntos(lotes, filtro.f)
  // etiqueta à vista: 'N sem etiqueta' filtra (?se=1) e 'Imprimir N' imprime de uma vez
  const [soSem, setSoSem] = useParamTela('se', '')
  const [imprimir, setImprimir] = useState<Id[]>()
  const semEtiqueta = todosFiltrados.filter((l) => !l.etiqueta.impressaEm)
  const [soSemPreco] = useParamTela('sp', '')
  const semPrecoL = todosFiltrados.filter((l) => l.semPreco)
  const filtrados = soSem && semEtiqueta.length ? semEtiqueta : soSemPreco && semPrecoL.length ? semPrecoL : todosFiltrados
  const ordem = agruparProntos(filtrados, filtro.f, t)
  // o que está ligado (chips) e o "Limpar filtros" (medida, faixa, peso, só sem etiqueta e a busca)
  const ativosP = ativosProntos(filtro.f)
  const filtrando = ativosP.length > 0 || !!busca.trim()
  const limparP = () => ajustarParams({ ...Object.fromEntries(PARAMS_PRONTOS.map((k) => [k, undefined])), se: undefined, sp: undefined, busca: undefined })
  const gFiltrado = filtrados.reduce((s, l) => s + l.saldo, 0)
  const vFiltrado = filtrados.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
  // grupos fechados (o resto abre sozinho quando há poucos lotes); muda de "Agrupar por" → recomeça
  const [fechados, setFechados] = useState<{ por: string; k: Set<string> }>({ por: '', k: new Set() })
  const fechadosAgora = fechados.por === filtro.f.agrupar + filtro.f.passo ? fechados.k : new Set<string>()
  const poucos = filtrados.length <= MAX_PRONTOS || ordem.length === 1
  const abertos = new Set(ordem.map((g) => g.chave).filter((k) => (poucos ? !fechadosAgora.has(k) : fechadosAgora.has(k))))
  const [todos, setTodos] = useState<Set<string>>(new Set())
  // em "fechados" fica o que o usuário inverteu (fechou quando abre sozinho; abriu quando começa fechado)
  const alternar = (k: string) => setFechados(() => { const n = new Set(fechadosAgora); if (n.has(k)) n.delete(k); else n.add(k); return { por: filtro.f.agrupar + filtro.f.passo, k: n } })
  return (
    // aba "Prontos": o total numa linha e os filtros (medida, peso, agrupar) atrás do botão padrão "⚙ Filtros"
    <section id="triagem-pronto" aria-label={t('Pronto para vender')} className="scroll-mt-4">
      <div className="mb-3 flex min-h-11 items-center gap-1">
        <h2 className="min-w-0 truncate text-lg font-bold">{t('Prontos para vender')}</h2>
        <Info texto={DICA_PRONTOS} />
      </div>
      {secaoAberta && <div>
      {/* FILTRO PADRÃO: busca + ⚙ Filtros (medida · peso · como mostrar) → resultado (peso e valor do filtrado) + chips ✕ */}
      {totalLotes > 0 && (
        <FiltroLista
          className="mb-3"
          situacao={{ valor: soSem ? 'sem' : soSemPreco ? 'preco' : '', onChange: (id) => ajustarParams({ se: id === 'sem' ? '1' : undefined, sp: id === 'preco' ? '1' : undefined }), opcoes: [
            { id: '', nome: 'Todos', n: todosFiltrados.length },
            { id: 'sem', nome: '🏷 Sem etiqueta', n: semEtiqueta.length, tom: semEtiqueta.length ? 'alerta' as const : undefined },
            ...(semPrecoL.length || soSemPreco ? [{ id: 'preco', nome: '⚠️ Sem preço', n: semPrecoL.length, tom: 'alerta' as const }] : []),
          ] }}
          busca={busca} onBusca={onBusca} placeholder="Código, compra ou fornecedor" onKeyDown={onKeyDown}
          ativos={ativosP} onTirar={(k) => ajustarParams(Object.fromEntries(k.split(',').map((x) => [x, undefined])))} onLimpar={limparP}
          resultados={filtrados.length} total={totalLotes} unidade="lote(s)"
          detalhe={filtrando && <>{gramasTexto(gFiltrado)}{vFiltrado > 0 && ` · ${formatar(vFiltrado, m)}`}</>}
          aberto={verFiltros} onAberto={setVerFiltros}
          painel={<FiltrosProntos todos={lotes} filtro={filtro} />}
        />
      )}
      {todosFiltrados.length > 0 && (
        // ETIQUETAS dos prontos numa faixa que se explica: o que falta · ver só eles · imprimir todos de uma vez
        semEtiqueta.length ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--alerta)]/40 bg-[var(--alerta)]/10 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 font-semibold text-[var(--alerta)]">🏷 {t(semEtiqueta.length === 1 ? '1 pacote pronto está sem etiqueta' : '{n} pacotes prontos estão sem etiqueta', { n: semEtiqueta.length })}</span>
            <Botao onClick={() => setImprimir(semEtiqueta.map((l) => l.id))}>🖨 {t(semEtiqueta.length === 1 ? 'Imprimir a etiqueta' : 'Imprimir as {n}', { n: semEtiqueta.length })}</Botao>
          </div>
        ) : null
      )}
      {imprimir && <ImprimirEtiquetas ids={imprimir} onImpresso={() => setSoSem('')} onFechar={() => setImprimir(undefined)} />}
      {!totalLotes ? <Vazio compacto texto="Nada triado ainda: separe um lote para começar a vender." /> : !filtrados.length ? <VazioFiltro texto="Nenhum lote com esses filtros." filtrando={filtrando} onLimpar={limparP} /> : (
        // tabela por grupo: Medida | Lotes | Peso | Valor | ⋯ (cabeçalho em cima, total embaixo); tocar na linha abre os lotes
        <div className="overflow-hidden rounded-xl border border-[var(--borda)]">
          {filtro.f.agrupar !== 'nenhum' && (
            <p className="bg-[var(--fundo)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Por {g}', { g: t(NOME_GRUPO[filtro.f.agrupar] ?? 'Grupo').toLowerCase() })} · {t('toque para ver os lotes')}</p>
          )}
          {ordem.map(({ chave: med, rotulo, medida, lotes: ls }) => {
            const aberto = abertos.has(med)
            const semCabecalho = filtro.f.agrupar === 'nenhum'
            const mostrar = todos.has(med) ? ls : ls.slice(0, MAX_PRONTOS)
            const g = ls.reduce((s, l) => s + l.saldo, 0)
            const v = ls.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0)
            return (
              <div key={med} className="border-t border-[var(--borda)] first:border-t-0">
                {!semCabecalho && <div className={cx('num flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3', aberto ? 'bg-[var(--marca-suave)]' : 'hover:bg-[var(--marca-suave)]/50')}>
                  <button type="button" aria-expanded={aberto} onClick={() => alternar(med)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left">
                    {/* a medida em destaque */}
                    <span className="flex h-11 min-w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--cartao)] px-2 text-base font-black shadow-sm ring-1 ring-[var(--borda)]">{rotulo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm text-[var(--suave)]"><b className="text-[var(--texto)]">{gramasTexto(g)}</b> · {t('{n} lote(s)', { n: ls.length })}</span>
                        <b className="whitespace-nowrap text-base">{v ? formatar(v, m) : '—'}</b>
                      </span>
                      {/* quanto este grupo pesa no total do que está pronto */}
                      <span aria-hidden className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-[var(--fundo)]"><span className="block h-full rounded-full bg-[var(--bom)]" style={{ width: `${Math.max(2, Math.round((g * 100) / Math.max(gFiltrado, 1)))}%` }} /></span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--borda)] bg-[var(--cartao)] px-2.5 py-1 text-xs font-semibold text-[var(--marca)] sm:inline-flex">{t(aberto ? 'Esconder' : 'Ver lotes')} <span aria-hidden className={cx('transition-transform', aberto && 'rotate-180')}>▾</span></span>
                    <span aria-hidden className={cx('shrink-0 text-[var(--suave)] transition-transform sm:hidden', aberto && 'rotate-90')}>›</span>
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
                  <ul className={cx('divide-y divide-[var(--borda)]', !semCabecalho && 'border-t border-[var(--borda)] sm:pl-5')}>
                    {/* um lote = uma linha nas mesmas colunas da tabela: código · peso · valor · 💰 (tocar abre o pacote,
                        onde estão foto, origem, margem e o resto) */}
                    {mostrar.map((l) => {
                      const valorLote = l.preco
                        ? <span className="whitespace-nowrap">{formatar(l.preco.valor, l.preco.moeda)}</span>
                        : <span className="text-xs font-semibold text-[var(--alerta)]">⚠️ {t(l.semPreco === 'medida' ? 'sem medida' : 'sem preço')}</span>
                      const semEtq = !l.etiqueta.impressaEm && <span title={t('Sem etiqueta')} aria-label={t('Sem etiqueta')} className="shrink-0 text-xs">🏷</span>
                      const vender = <button type="button" aria-label={`${t('Vender')} ${l.codigo ?? ''}`} title={t('Vender')} onClick={(e) => (e.stopPropagation(), onVender({ lote: l.id }))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--marca-suave)]">💰</button>
                      return (
                        <li key={l.id} {...clicavel(() => onLote(l.id))} className="num cursor-pointer px-2 text-sm outline-none hover:bg-[var(--fundo)] focus-visible:bg-[var(--marca-suave)]">
                          {/* celular: código inteiro + peso embaixo | valor + 💰 */}
                          <span className="flex min-h-12 items-center gap-2 py-1 pl-3.5 sm:hidden">
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1"><b className="font-mono">{l.codigo}</b>{semEtq}</span>
                              <span className="block text-xs text-[var(--suave)]">{gramasTexto(l.saldo)}</span>
                            </span>
                            <span className="text-right">{valorLote}</span>
                            {vender}
                          </span>
                          {/* computador: nas colunas da tabela */}
                          <span className={cx(GRADE_PRONTOS, 'hidden min-h-11 sm:grid')}>
                            <span className="flex min-w-0 items-center gap-1 pl-5"><b className="truncate font-mono">{l.codigo}</b>{semEtq}</span>
                            <span />
                            <span className="whitespace-nowrap text-right">{gramasTexto(l.saldo)}</span>
                            <span className="text-right">{valorLote}</span>
                            {vender}
                          </span>
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
          {/* total de tudo o que está na tabela */}
          {/* TOTAL em destaque (bloco próprio, não mais uma linha grudada na tabela) */}
          {ordem.length > 1 && (
            <div className="num flex items-center justify-between gap-3 border-t-2 border-[var(--marca)] bg-[var(--marca-suave)] px-4 py-3">
              <span>
                <b className="block text-base text-[var(--marca)]">{t('Total')}</b>
                <span className="block text-xs text-[var(--suave)]">{t('{n} lote(s)', { n: filtrados.length })}</span>
              </span>
              <span className="text-right">
                <b className="block whitespace-nowrap text-lg">{formatar(filtrados.reduce((s, l) => s + (l.preco?.valorPrincipal ?? 0), 0), m)}</b>
                <span className="block whitespace-nowrap text-sm text-[var(--suave)]">{gramasTexto(filtrados.reduce((s, l) => s + l.saldo, 0))}</span>
              </span>
            </div>
          )}
        </div>
      )}
      </div>}
    </section>
  )
}
