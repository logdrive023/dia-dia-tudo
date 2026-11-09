// ONDE ESTA TABELA FOI USADA (aba da tabela) — a VERSÃO é obrigatória: a tela sempre mostra UMA versão (começa na
// que está em uso) e nunca mistura usos de versões diferentes. Trocar a versão atualiza na hora.
//   · o seletor de versão (v3 em uso · 2 usos | v2 · 5 usos | v1 · 1 uso) — a escolhida em destaque
//   · os números da versão (vendas · compras · valor) e o filtro padrão (tipo em abas, busca, 📅 período)
//   · uma linha por uso: data · código · cliente/fornecedor · versão · comprador · valor · quem fez; tocar abre o
//     detalhe ali mesmo (medida, gramas × fator, e o aviso quando o fator foi mudado à mão)
// Venda antiga (de antes de a versão ser guardada na linha) aparece com a versão da data, marcada como "estimada".
import { useState } from 'react'
import { AreaPaginada, Paginacao, usePaginacao } from '../../../shared/ui/paginacao'
import { formatar } from '../../../core/domain/dinheiro'
import { Pilula, Vazio, cx, dataBR, gramasTexto } from '../../../shared/ui/base'
import { useApp, useFiltrosTela } from '../../../shared/ui/contexto'
import { FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'

type Uso = Awaited<ReturnType<typeof import('../../../core/services/precos').tabelaPreco>>['usos'][number]
type Versao = { numero: number; em: string; por?: string; nota: string }

export function UsadaEm({ usos, versoes, atual, moeda: m }: { usos: Uso[]; versoes: Versao[]; atual: number; moeda: string }) {
  const t = useT()
  const { p, setP, ajustarParams } = { ...useFiltrosTela(), ...useApp() }
  const versao = Number(p('uv')) && versoes.some((v) => v.numero === Number(p('uv'))) ? Number(p('uv')) : atual
  const tipo = p('ut')
  const busca = p('ub').trim().toLowerCase()
  const daVersao = usos.filter((u) => u.versao === versao)
  const base = daVersao.filter((u) => (!busca || [u.codigo, u.pessoa, u.responsavel, ...u.colunas].filter(Boolean).join(' ').toLowerCase().includes(busca)) && (!p('ude') || u.data >= p('ude')) && (!p('uate') || u.data <= p('uate')))
  const lista = base.filter((u) => !tipo || (tipo === 'compra') === (u.tipo === 'compra'))
  const soma = (xs: Uso[]) => xs.reduce((s, u) => s + u.valorTabela, 0)
  const pag = usePaginacao(lista, { padrao: 25, reiniciar: JSON.stringify([versao, tipo, busca, p('ude'), p('uate')]) })
  const contagem = (n: number) => usos.filter((u) => u.versao === n).length
  const v = versoes.find((x) => x.numero === versao)
  const limpar = () => ajustarParams({ ut: undefined, ub: undefined, ude: undefined, uate: undefined })
  return (
    <div className="space-y-3">
      {/* A VERSÃO (obrigatória): uma de cada vez */}
      <section aria-label={t('Versão consultada')} className="rounded-2xl border border-[var(--marca)]/40 bg-[var(--marca-suave)]/40 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--marca)]">🔖 {t('Versão consultada')}</p>
        <div role="radiogroup" aria-label={t('Versão')} className="sem-barra -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {versoes.map((x) => {
            const sel = x.numero === versao
            return (
              <button key={x.numero} type="button" role="radio" aria-checked={sel} onClick={() => setP('uv', x.numero === atual ? '' : String(x.numero))}
                className={cx('flex min-h-12 shrink-0 flex-col justify-center rounded-xl px-3 text-left ring-1 transition', sel ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] ring-[var(--borda)] hover:ring-[var(--marca)]')}>
                <span className="flex items-center gap-1.5 text-sm font-bold">v{x.numero}{x.numero === atual && <span className={cx('rounded-full px-1.5 text-[10px]', sel ? 'bg-white/25' : 'bg-[var(--bom)]/15 text-[var(--bom)]')}>{t('em uso')}</span>}</span>
                <span className={cx('num text-[11px]', sel ? 'text-white/80' : 'text-[var(--suave)]')}>{contagem(x.numero)} {t('uso(s)')} · {dataBR(x.em)}</span>
              </button>
            )
          })}
        </div>
        {v && <p className="mt-1.5 text-xs text-[var(--suave)]">{t('Mostrando só o que usou a v{n}', { n: versao })}{v.por ? ` · ${t('publicada por {q}', { q: v.por })}` : ''}{v.nota ? ` · “${v.nota}”` : ''}</p>}
      </section>

      <GrupoNumeros colunas={3} celular={3} className="mb-0">
        <NumeroGrande rotulo="Vendas" icone="💰" valor={base.filter((u) => u.tipo !== 'compra').length} ativo={tipo === 'venda'} onClick={() => setP('ut', tipo === 'venda' ? '' : 'venda')} />
        <NumeroGrande rotulo="Compras" icone="🛒" valor={base.filter((u) => u.tipo === 'compra').length} ativo={tipo === 'compra'} onClick={() => setP('ut', tipo === 'compra' ? '' : 'compra')} />
        <NumeroGrande rotulo="Valor pela tabela" icone="🧾" valor={formatar(soma(lista), m)} />
      </GrupoNumeros>
      <FiltroLista
        busca={p('ub')} onBusca={(x) => setP('ub', x)} placeholder="Buscar código, pessoa ou comprador"
        periodo={{ de: p('ude'), ate: p('uate'), onChange: (d, a) => ajustarParams({ ude: d, uate: a }) }}
        onLimpar={limpar} temAtivos={!!(tipo || busca || p('ude'))}
        resultados={lista.length} total={daVersao.length} unidade="uso(s)"
      />
      <AreaPaginada pag={pag}>
      {!daVersao.length ? <Vazio texto={t('Nenhuma venda ou compra usou a v{n}.', { n: versao })} /> : !lista.length ? <VazioFiltro filtrando onLimpar={limpar} /> : (
        <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
          {pag.itens.map((u) => <LinhaUso key={u.id} u={u} moeda={m} />)}
        </ul>
      )}
      </AreaPaginada>
      {lista.length > 0 && <Paginacao {...pag} unidade="uso(s)" />}
    </div>
  )
}

function LinhaUso({ u, moeda }: { u: Uso; moeda: string }) {
  const t = useT()
  const { ir } = useApp()
  const [aberto, setAberto] = useState(false)
  const compra = u.tipo === 'compra'
  return (
    <li>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((x) => !x)} className="relative flex w-full items-center gap-3 py-3 pl-4 pr-3 text-left hover:bg-[var(--fundo)]">
        <span aria-hidden className={cx('absolute inset-y-0 left-0 w-1', compra ? 'bg-[var(--bom)]' : 'bg-[var(--marca)]')} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <b className="num">{u.codigo ?? t(compra ? 'Compra' : 'Venda')}</b>
            {u.pessoa && <span className="truncate text-sm">{u.pessoa}</span>}
          </span>
          <span className="num mt-0.5 block text-xs text-[var(--suave)]">{dataBR(u.data)} · {t(compra ? 'compra' : 'venda')}{u.responsavel ? ` · ${t('por {q}', { q: u.responsavel })}` : ''}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            <Pilula pequena tom="marca">v{u.versao}{u.versaoEstimada ? ` · ${t('estimada')}` : ''}</Pilula>
            {u.colunas.map((c) => <Pilula key={c} pequena>▦ {c}</Pilula>)}
            {u.manual && <Pilula pequena tom="alerta">✎ {t('fator mudado à mão')}</Pilula>}
          </span>
        </span>
        <span className="num shrink-0 text-right">
          <b className="block">{formatar(u.valorTabela, moeda)}</b>
          <span className="block text-[11px] text-[var(--suave)]">{gramasTexto(u.gramas)}</span>
        </span>
        <span aria-hidden className={cx('shrink-0 text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
      </button>
      {aberto && (
        <div className="mx-4 mb-3 rounded-xl bg-[var(--fundo)] p-3 text-sm">
          <ul className="space-y-1.5">
            {u.detalhe.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="min-w-0">
                  {l.medida !== undefined ? `${l.medida} cm` : l.descricao}{l.coluna ? ` · ${l.coluna}` : ''}
                  <span className="num ml-2 text-xs text-[var(--suave)]">{gramasTexto(l.gramas)}{l.fator !== undefined ? ` × ${l.fator}` : ''}</span>
                  {l.manual && l.fatorTabela && <span className="ml-2 text-xs font-semibold text-[var(--alerta)]">{t('A tabela dava {f}', { f: l.fatorTabela })}</span>}
                </span>
                <span className="num">{formatar(l.total, moeda)}{l.desconto ? <span className="ml-1 text-xs text-[var(--suave)]">(−{formatar(l.desconto, moeda)})</span> : null}</span>
              </li>
            ))}
          </ul>
          {u.versaoEstimada && <p className="mt-2 text-xs text-[var(--suave)]">ℹ️ {t('Feita antes de a versão ser guardada na venda: a versão é a que valia na data.')}</p>}
          <button type="button" onClick={() => ir(compra ? 'pedido' : 'venda', { id: u.id })} className="mt-2 text-sm font-semibold text-[var(--marca)]">{t(compra ? 'Abrir a compra' : 'Abrir a venda')} →</button>
        </div>
      )}
    </li>
  )
}
