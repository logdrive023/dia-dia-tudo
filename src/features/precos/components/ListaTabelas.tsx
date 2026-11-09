// LISTA DAS TABELAS DE PREÇO (#/precos) — o cabeçalho padrão, os números (tabelas · vigentes · usos), o FILTRO PADRÃO
// (situação em abas com o número · busca por nome, categoria ou comprador · categoria) e uma LISTA LIMPA: uma linha por
// tabela, sem cartões nem mapa — nome + situação, a versão em uso (quando, quem, nota), a faixa de preço e os usos.
import { moeda } from '../../../core/domain/dinheiro'
import { AjudaConta } from './AjudaConta'
import { CartaoTabela } from './CartaoTabela'
import { SITUACAO_TABELA, type Situacao } from '../model/situacao'
import { useLembrado } from '../../../shared/ui/filtros'
import { AreaPaginada, Paginacao, usePaginacao } from '../../../shared/ui/paginacao'
import { Botao, Carregando, Info, Pilula, Titulo, Vazio, cx, diaCurto, loc } from '../../../shared/ui/base'
import { useApp, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { BotaoEscolha, EscolhaVista, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'

const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ListaTabelas({ ajudaVersoes }: { ajudaVersoes: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('listaTabelasPreco', {})
  const [busca, setBusca] = useParamTela('busca', '')
  const [situacao, setSituacao] = useParamTela<'' | Situacao>('situacao', '')
  const [categoria, setCategoria] = useParamTela('categoria', '')
  // duas vistas: LISTA (limpa) ou CARTÕES (com a faixa e o mapa de calor) — fica lembrada neste aparelho
  const [vista, setVista] = useLembrado<'lista' | 'cartoes'>('precos.vista', 'lista')
  const { dados: tabelas } = useConsulta('tabelasPreco', {}, vista === 'cartoes')
  const porId = new Map((tabelas ?? []).map((x) => [x.id, x]))
  const todas = dados ?? []
  const b = semAcento(busca.trim())
  const base = todas.filter((x) => (!categoria || (x.categoria ?? '') === (categoria === '—' ? '' : categoria)) && (!b || semAcento([x.nome, x.categoria, ...x.colunas].filter(Boolean).join(' ')).includes(b)))
  const lista = base.filter((x) => !situacao || x.situacao === situacao)
  const pag = usePaginacao(lista, { padrao: 25, reiniciar: JSON.stringify([busca, situacao, categoria]) })
  const categorias = [...new Set(todas.map((x) => x.categoria ?? ''))]
  const nova = () => ir('tabelaPreco', { id: 'novo' })
  const limpar = () => (setBusca(''), setSituacao(''), setCategoria(''))
  const n = (x: number) => x.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div>
      <Titulo
        subtitulo={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center">🧮 {t('Como calcula o preço')}<AjudaConta /></span>
          <span className="inline-flex items-center">🕓 {t('Versões e comparação')}<Info texto={ajudaVersoes} /></span>
        </span>}
        acao={<Botao onClick={nova}>+ {t('Tabela')}</Botao>}
      >
        {t('Tabelas de preço')}
      </Titulo>
      <GrupoNumeros colunas={3} celular={3}>
        <NumeroGrande rotulo="Tabelas" valor={todas.length} icone="▦" carregando={!dados} onClick={() => setSituacao('')} />
        <NumeroGrande rotulo="Vigentes" valor={todas.filter((x) => x.situacao === 'vigente').length} icone="★" tom="bom" ativo={situacao === 'vigente'} carregando={!dados} onClick={() => setSituacao(situacao === 'vigente' ? '' : 'vigente')} />
        <NumeroGrande rotulo="Usos" valor={todas.reduce((s, x) => s + x.vendas + x.compras, 0)} icone="🧾" sub={t('vendas e compras')} carregando={!dados} />
      </GrupoNumeros>
      <FiltroLista
        className="mb-3"
        situacao={{ valor: situacao, onChange: (v) => setSituacao(v as typeof situacao), opcoes: [
          { id: '', nome: 'Todas', n: base.length },
          ...(Object.keys(SITUACAO_TABELA) as Situacao[]).map((s) => ({ id: s, nome: SITUACAO_TABELA[s].nome, n: base.filter((x) => x.situacao === s).length })).filter((o) => o.n > 0 || o.id === situacao),
        ] }}
        busca={busca} onBusca={setBusca} placeholder="Buscar tabela, categoria ou comprador"
        acaoTopo={<EscolhaVista vista={vista} onChange={setVista} />}
        extra={categorias.length > 1 ? <BotaoEscolha icone="🏷" rotulo="Categoria" valor={categoria} onChange={setCategoria} opcoes={[{ id: '', nome: 'Categoria' }, ...categorias.map((c) => ({ id: c || '—', nome: c || 'Normal (geral)' }))]} /> : undefined}
        ativos={categoria ? [{ k: 'categoria', rotulo: `🏷 ${categoria === '—' ? t('Normal (geral)') : t(categoria)}` }] : []}
        onTirar={() => setCategoria('')} onLimpar={limpar} temAtivos={!!(busca || situacao || categoria)}
        resultados={dados ? lista.length : undefined} total={todas.length} unidade="tabela(s)"
      />
      <AreaPaginada pag={pag}>
      {!dados ? <Carregando /> : !todas.length ? (
        <Vazio texto="Nenhuma tabela ainda.">
          <p className="mb-3">{t('Uma tabela diz o fator por medida e comprador: 60 cm × Helena = 16 → valor = gramas × 16.')}</p>
          <Botao onClick={nova}>+ {t('Criar a primeira tabela')}</Botao>
        </Vazio>
      ) : !lista.length ? <VazioFiltro filtrando onLimpar={limpar} /> : vista === 'cartoes' ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pag.itens.map((x) => <li key={x.id}><CartaoTabela x={x} tb={porId.get(x.id)} /></li>)}
        </ul>
      ) : (
        <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
          {pag.itens.map((x) => {
            const s = SITUACAO_TABELA[x.situacao]
            const simbolo = moeda(x.moeda).simbolo
            return (
              <li key={x.id}>
                {/* Celular: cartão em blocos — nome (› ao lado) · etiquetas · faixa de preço em destaque · números
                    (cada um inteiro, sem quebrar no meio) · versão. sm+: uma linha, com o preço numa coluna à direita. */}
                <button type="button" onClick={() => ir('tabelaPreco', { id: x.id })} className={cx('group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left hover:bg-[var(--fundo)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-y-1 sm:py-3', x.situacao === 'substituida' && 'opacity-75')}>
                  <span className="col-start-1 row-start-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <b className="min-w-0 basis-full truncate text-base sm:basis-auto sm:text-sm">{x.nome}</b>
                    <Pilula pequena tom={s.tom} title={t(s.ajuda)}>{x.situacao === 'vigente' ? '● ' : ''}{t(s.nome)}</Pilula>
                    <Pilula pequena tom={x.categoria ? 'marca' : 'neutro'}>{x.categoria ? t(x.categoria) : t('Normal (geral)')}</Pilula>
                  </span>
                  <span className="num col-span-2 col-start-1 row-start-2 flex flex-wrap items-baseline gap-x-1.5 rounded-xl bg-[var(--marca-suave)] px-3 py-2 sm:col-span-1 sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:block sm:bg-transparent sm:p-0 sm:text-right">
                    {x.faixa ? <><b className="whitespace-nowrap text-lg leading-tight sm:block sm:text-sm">{simbolo} {n(x.faixa[0])} – {n(x.faixa[1])}</b><span className="text-xs text-[var(--suave)] sm:block sm:text-[11px]">{t(x.fatorPor === 'grama' ? 'por grama' : 'por unidade')}</span></> : <span className="text-xs text-[var(--suave)]">{t('Sem preços ainda')}</span>}
                  </span>
                  <span className="num col-span-2 col-start-1 row-start-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:flex sm:flex-wrap text-[var(--suave)] sm:col-span-1 sm:row-start-2">
                    <span className="whitespace-nowrap"><b className="text-[var(--texto)]">{x.medidas}</b> {t('medidas')} ({x.medidaMin}–{x.medidaMax} {x.unidadeMedida})</span>
                    <span className="whitespace-nowrap"><b className="text-[var(--texto)]">{x.compradores}</b> {t('compradores')}</span>
                    <span className="whitespace-nowrap"><b className="text-[var(--texto)]">{x.vendas}</b> {t('vendas')}</span>
                    <span className="whitespace-nowrap"><b className="text-[var(--texto)]">{x.compras}</b> {t('compras')}</span>
                  </span>
                  <span className="col-span-2 col-start-1 row-start-4 block min-w-0 truncate text-xs text-[var(--suave)] sm:col-span-1 sm:row-start-3">
                    <b className="text-[var(--marca)]">v{x.versao}</b> · {t('mudou em {d}', { d: diaCurto(x.mudouEm) })}{x.por ? ` · ${x.por}` : ''}{x.nota ? ` · “${x.nota}”` : ''}
                  </span>
                  <span aria-hidden className="col-start-2 row-start-1 self-center text-xl text-[var(--suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--marca)] sm:col-start-3 sm:row-span-3">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      </AreaPaginada>
      {lista.length > 0 && <div className="mt-3"><Paginacao {...pag} unidade="tabela(s)" /></div>}
      <p className="mt-2 text-xs text-[var(--suave)]">{t('Toque numa tabela para ver a grade, onde foi usada, o histórico e como os valores funcionam.')}</p>
    </div>
  )
}
