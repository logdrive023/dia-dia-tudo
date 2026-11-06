// LISTA DAS TABELAS DE PREÇO (#/precos) — o cabeçalho padrão, os números (tabelas · vigentes · usos), o FILTRO PADRÃO
// (situação em abas com o número · busca por nome, categoria ou comprador · categoria) e uma LISTA LIMPA: uma linha por
// tabela, sem cartões nem mapa — nome + situação, a versão em uso (quando, quem, nota), a faixa de preço e os usos.
import { moeda } from '../../../core/domain/dinheiro'
import { CartaoTabela } from './CartaoTabela'
import { SITUACAO_TABELA, type Situacao } from '../model/situacao'
import { useLembrado } from '../../../shared/ui/filtros'
import { Paginacao, usePaginacao } from '../../../shared/ui/paginacao'
import { Botao, Carregando, Info, Pilula, Titulo, Vazio, cx, diaCurto, loc } from '../../../shared/ui/base'
import { useApp, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { BotaoEscolha, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'

const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ListaTabelas({ ajudaConta, ajudaVersoes }: { ajudaConta: string; ajudaVersoes: string }) {
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
  const pag = usePaginacao(lista, { padrao: 20, reiniciar: JSON.stringify([busca, situacao, categoria]) })
  const categorias = [...new Set(todas.map((x) => x.categoria ?? ''))]
  const nova = () => ir('tabelaPreco', { id: 'novo' })
  const limpar = () => (setBusca(''), setSituacao(''), setCategoria(''))
  const n = (x: number) => x.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <div>
      <Titulo
        subtitulo={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center">🧮 {t('Como calcula o preço')}<Info texto={ajudaConta} /></span>
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
        acaoTopo={
          <div role="radiogroup" aria-label={t('Ver como')} className="inline-flex rounded-xl bg-[var(--marca-suave)] p-1">
            {([['lista', '☰', 'Lista'], ['cartoes', '▦', 'Cartões']] as const).map(([id, ic, nome]) => (
              <button key={id} type="button" role="radio" aria-checked={vista === id} onClick={() => setVista(id)} title={t(nome)}
                className={cx('inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold', vista === id ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
                <span aria-hidden>{ic}</span><span className="hidden xs:inline">{t(nome)}</span>
              </button>
            ))}
          </div>
        }
        extra={categorias.length > 1 ? <BotaoEscolha icone="🏷" rotulo="Categoria" valor={categoria} onChange={setCategoria} opcoes={[{ id: '', nome: 'Categoria' }, ...categorias.map((c) => ({ id: c || '—', nome: c || 'Normal (geral)' }))]} /> : undefined}
        ativos={categoria ? [{ k: 'categoria', rotulo: `🏷 ${categoria === '—' ? t('Normal (geral)') : t(categoria)}` }] : []}
        onTirar={() => setCategoria('')} onLimpar={limpar} temAtivos={!!(busca || situacao || categoria)}
        resultados={dados ? lista.length : undefined} total={todas.length} unidade="tabela(s)"
      />
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
                <button type="button" onClick={() => ir('tabelaPreco', { id: x.id })} className={cx('group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--fundo)]', x.situacao === 'substituida' && 'opacity-75')}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="truncate">{x.nome}</b>
                      <Pilula pequena tom={s.tom} title={t(s.ajuda)}>{x.situacao === 'vigente' ? '● ' : ''}{t(s.nome)}</Pilula>
                      <Pilula pequena tom={x.categoria ? 'marca' : 'neutro'}>{x.categoria ? t(x.categoria) : t('Normal (geral)')}</Pilula>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--suave)]">
                      <b className="text-[var(--marca)]">v{x.versao}</b> · {t('mudou em {d}', { d: diaCurto(x.mudouEm) })}{x.por ? ` · ${x.por}` : ''}{x.nota ? ` · “${x.nota}”` : ''}
                    </span>
                    <span className="num mt-0.5 block text-xs text-[var(--suave)]">
                      {x.medidas} {t('medidas')} ({x.medidaMin}–{x.medidaMax} {x.unidadeMedida}) · {x.compradores} {t('compradores')} · {x.vendas} {t('vendas')} · {x.compras} {t('compras')}
                    </span>
                  </span>
                  <span className="num shrink-0 text-right">
                    {x.faixa ? <><b className="block whitespace-nowrap text-sm">{simbolo} {n(x.faixa[0])} – {n(x.faixa[1])}</b><span className="block text-[11px] text-[var(--suave)]">{t(x.fatorPor === 'grama' ? 'por grama' : 'por unidade')}</span></> : <span className="text-xs text-[var(--suave)]">{t('sem preços ainda')}</span>}
                  </span>
                  <span aria-hidden className="text-lg text-[var(--suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--marca)]">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {lista.length > 0 && <div className="mt-3"><Paginacao {...pag} unidade="tabela(s)" /></div>}
      <p className="mt-2 text-xs text-[var(--suave)]">{t('Toque numa tabela para ver a grade, onde foi usada, o histórico e como os valores funcionam.')}</p>
    </div>
  )
}
