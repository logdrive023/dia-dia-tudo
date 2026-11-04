// TABELA DE DADOS — a listagem padrão do sistema (Compras, Vender, Estoque e as próximas). Quem usa só diz O QUE muda:
// as colunas, as linhas, o que abre ao tocar, as ações (⋯), a ordenação e, se precisar, a seleção. O resto é daqui:
// cabeçalho das colunas, alinhamento (texto à esquerda; datas, números e valores à direita e com algarismos iguais),
// altura e espaçamento das linhas, realce no passar do mouse e no foco do teclado, carregando, vazio e erro.
//
// CELULAR: em vez da tabela, a LINHA PADRÃO por registro — três linhas curtas, cada coisa no seu lugar, sem selo em
// cima de selo (o que é normal não aparece: venda concluída não diz "Concluída"):
//   Quem (título)                                         Valor
//   o que aconteceu (resumo, uma linha)                   quando / quanto (valorSub)
//   CÓDIGO · ● situação · ⚠ o que pede atenção                                       ›
// tocar abre no lugar: o progresso, os fatos em selos (📅 data · 📦 itens · ⏱ parada), o extra da tela e a linha de
// ações ("Abrir →" + ⋯). Regra do sistema: lista resumida que expande. Sem `celular`, a tabela rola de lado.
// Os selos (SeloCodigo, SeloSituacao, SeloAlerta) são os mesmos nas colunas da tabela do computador.
//
// Fica FORA daqui (é do módulo): a consulta, os filtros (FiltroLista), as regras e a paginação (usePaginacao/Paginacao).

import { Fragment, type ReactNode, useState } from 'react'
import { Botao, cx } from './base'
import { useTelaLarga } from './estoqueUi'
import { useT } from './i18n'
import { type Acao, MenuAcoes } from './menuAcoes'

export interface Coluna<T> {
  id: string
  /** nome da coluna (traduzido aqui) */
  titulo: string
  celula(l: T): ReactNode
  /** números, datas de valor e dinheiro: à direita */
  direita?: boolean
  /** chave de ordenação (tocar no cabeçalho ordena por ela) */
  ordenar?: string
  /** largura/quebra da célula (ex.: 'whitespace-nowrap', 'w-full min-w-[11rem]') */
  classe?: string
  /** some no tablet (só aparece de 1280 px para cima) */
  larga?: boolean
}

export interface Selecao {
  marcados: Set<string>
  onAlternar(id: string): void
  onTodos(): void
  /** para o leitor de tela: "Selecionar L-0012" */
  rotulo(id: string): string
}

export type TomLista = 'bom' | 'ruim' | 'alerta' | 'marca' | 'suave'
const COR_TOM: Record<TomLista, string> = { bom: 'var(--bom)', ruim: 'var(--ruim)', alerta: 'var(--alerta)', marca: 'var(--marca)', suave: 'var(--suave)' }

export interface LinhaCelular<T> {
  titulo(l: T): ReactNode
  valor?(l: T): ReactNode
  /** embaixo do valor, pequeno (ex.: "3 kg", "02/11 11:00") */
  valorSub?(l: T): ReactNode
  /** o que aconteceu, numa linha (ex.: "60 cm · Normal · Preto + 1 item") */
  resumo?(l: T): ReactNode
  /** o código do registro (P-0005), no selo padrão */
  codigo?(l: T): string | undefined
  /** a situação/etapa (● Chegou), na cor do tom */
  situacao?(l: T): { texto: string; tom: TomLista } | undefined
  /** o que pede atenção (○ 2 pendências), em selo; vazio = nada */
  alerta?(l: T): { texto: string; tom: TomLista } | undefined
  /** ao abrir: a barra de progresso (etapas) */
  progresso?(l: T): ReactNode
  /** ao abrir: os fatos, cada um num selo ("📅 02/11/2026", "📦 1 item · 3 kg", "⏱ parada há 2 d") */
  fatos?(l: T): ReactNode[]
  /** a linha de detalhe livre (telas antigas; prefira código/situação/alerta) */
  sub?(l: T): ReactNode
  /** o selo da situação, embaixo (telas antigas; prefira `situacao`) */
  selo?(l: T): ReactNode
  /** ao abrir: o extra da tela (ex.: a lista do que falta) */
  aberto?(l: T): ReactNode
}

/** o código do registro, igual em toda lista */
export function SeloCodigo({ codigo }: { codigo?: string }) {
  return <span className="inline-flex shrink-0 items-center rounded-md bg-[var(--marca-suave)] px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-[var(--marca)]">{codigo ?? '—'}</span>
}
/** a situação: bolinha + texto na cor do tom */
export function SeloSituacao({ texto, tom }: { texto: string; tom: TomLista }) {
  const t = useT()
  return <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: COR_TOM[tom] }}><span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: COR_TOM[tom] }} />{t(texto)}</span>
}
/** o que pede atenção: selo com fundo suave na cor do tom */
export function SeloAlerta({ texto, tom }: { texto: string; tom: TomLista }) {
  const t = useT()
  return <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: COR_TOM[tom], background: `color-mix(in srgb, ${COR_TOM[tom]} 12%, transparent)` }}>{t(texto)}</span>
}
/** um fato (aberto da linha): selo cinza */
export function SeloFato({ children }: { children: ReactNode }) {
  return <span className="num inline-flex min-h-7 items-center gap-1 rounded-full bg-[var(--cartao)] px-2.5 text-xs text-[var(--suave)] ring-1 ring-[var(--borda)]">{children}</span>
}

export function TabelaDados<T>({ linhas, chave, colunas, onAbrir, rotuloAbrir = 'Abrir', rotuloLinha, acoes, acaoRapida, ordem, onOrdenar, selecao, realce, detalhe, celular, compacta, carregando, erro, vazio }: {
  linhas: T[]
  chave(l: T): string
  colunas: Coluna<T>[]
  /** tocar na linha (ou Enter) abre o registro */
  onAbrir?(l: T): void
  rotuloAbrir?: string
  /** nome da linha para o leitor de tela ("P-0005 · Wagner") */
  rotuloLinha?(l: T): string
  /** ações do ⋯ (a última coluna, sempre no mesmo lugar) */
  acoes?(l: T): Acao[]
  /** um botão rápido antes do ⋯ (ex.: ✂️ Separar), na mesma coluna de ações */
  acaoRapida?(l: T): ReactNode
  ordem?: { por: string; desc: boolean }
  onOrdenar?(por: string): void
  selecao?: Selecao
  /** a linha fica apagada (cancelada, esgotado…) */
  realce?(l: T): 'apagada' | 'marcada' | undefined
  /** uma linha extra embaixo do registro (ex.: as pendências abertas) */
  detalhe?(l: T): ReactNode
  celular?: LinhaCelular<T>
  /** linhas mais baixas (listas com foto pequena) */
  compacta?: boolean
  carregando?: boolean
  erro?: string
  /** o que mostrar sem nenhuma linha (VazioFiltro ou Vazio) */
  vazio?: ReactNode
}) {
  const t = useT()
  const larga = useTelaLarga()
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const alternar = (id: string) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  if (erro) return <p role="alert" className="rounded-2xl border border-[var(--ruim)] bg-[var(--ruim)]/10 p-4 text-sm font-semibold text-[var(--ruim)]">{t(erro)}</p>
  if (carregando) return (
    <div aria-busy className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
      <span className="sr-only">{t('Carregando…')}</span>
      {[0, 1, 2, 3].map((k) => <div key={k} className="flex items-center gap-3 border-t border-[var(--borda)] px-3 py-3.5 first:border-t-0"><span className="h-4 w-20 animate-pulse rounded bg-[var(--fundo)]" /><span className="h-4 flex-1 animate-pulse rounded bg-[var(--fundo)]" /><span className="h-4 w-16 animate-pulse rounded bg-[var(--fundo)]" /></div>)}
    </div>
  )
  if (!linhas.length) return <>{vazio}</>

  const apagada = (l: T) => realce?.(l) === 'apagada'
  const marcada = (l: T) => realce?.(l) === 'marcada' || (!!selecao && selecao.marcados.has(chave(l)))
  const todos = !!selecao && linhas.length > 0 && linhas.every((l) => selecao.marcados.has(chave(l)))
  const caixa = (l: T) => selecao && (
    <input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={selecao.rotulo(chave(l))} checked={selecao.marcados.has(chave(l))}
      onChange={() => selecao.onAlternar(chave(l))} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
  )

  // ---------- celular: linha curta que abre no lugar ----------
  if (!larga && celular)
    return (
      <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
        {linhas.map((l) => {
          const id = chave(l)
          const aberta = abertas.has(id)
          const mais = acoes?.(l) ?? []
          return (
            <li key={id} className={cx(aberta && 'bg-[var(--marca-suave)]/40', marcada(l) && 'bg-[var(--marca-suave)]', apagada(l) && 'opacity-75')}>
              <div className="flex items-start gap-2 px-4 py-3">
                {selecao && <span className="flex h-6 shrink-0 items-center">{caixa(l)}</span>}
                <button type="button" aria-expanded={aberta} onClick={() => alternar(id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    {/* 1. quem · valor */}
                    <span className="flex min-w-0 items-baseline gap-3">
                      <b className="min-w-0 flex-1 truncate text-[15px] leading-snug">{celular.titulo(l)}</b>
                      {celular.valor && <b className={cx('num shrink-0 whitespace-nowrap text-[15px]', apagada(l) && 'line-through')}>{celular.valor(l)}</b>}
                    </span>
                    {/* 2. o que aconteceu · quando/quanto */}
                    {(celular.resumo || celular.valorSub) && (
                      <span className="mt-0.5 flex min-w-0 items-baseline gap-3 text-[13px] text-[var(--suave)]">
                        <span className="min-w-0 flex-1 truncate">{celular.resumo?.(l)}</span>
                        {celular.valorSub && <span className="num shrink-0 whitespace-nowrap text-xs">{celular.valorSub(l)}</span>}
                      </span>
                    )}
                    {/* 3. código · situação · atenção (texto leve, sem caixa em cima de caixa) */}
                    {(() => {
                      const cod = celular.codigo?.(l)
                      const sit = celular.situacao?.(l)
                      const al = celular.alerta?.(l)
                      return (cod !== undefined || sit || al) && (
                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
                          {celular.codigo && <span className="font-mono font-semibold text-[var(--suave)]">{cod ?? '—'}</span>}
                          {sit && <SeloSituacao {...sit} />}
                          {al && <span className="inline-flex min-w-0 items-center gap-1 font-semibold" style={{ color: COR_TOM[al.tom] }}><span aria-hidden>{al.tom === 'bom' ? '✓' : '⚠'}</span><span className="truncate">{t(al.texto.replace(/^✓\s*/, ''))}</span></span>}
                        </span>
                      )
                    })()}
                    {celular.sub && <span className="num mt-0.5 block truncate text-xs text-[var(--suave)]">{celular.sub(l)}</span>}
                    {celular.selo && <span className="mt-1 block">{celular.selo(l)}</span>}
                  </span>
                  <span aria-hidden className={cx('mt-0.5 shrink-0 text-lg leading-none text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
                </button>
              </div>
              {aberta && (
                <div className="space-y-2.5 border-t border-dashed border-[var(--borda)] px-4 pb-3 pt-2.5 text-sm">
                  {celular.progresso?.(l)}
                  {(() => {
                    const fs = (celular.fatos?.(l) ?? []).filter((x) => x !== undefined && x !== null && x !== false && x !== '')
                    return fs.length > 0 && <div className="flex flex-wrap gap-1.5">{fs.map((x, k) => <SeloFato key={k}>{x}</SeloFato>)}</div>
                  })()}
                  {celular.aberto?.(l)}
                  {(onAbrir || mais.length > 0) && (
                    <div className="flex items-center gap-2">
                      {onAbrir && <Botao className="flex-1" onClick={() => onAbrir(l)}>{t(rotuloAbrir)} →</Botao>}
                      {mais.length > 0 && <MenuAcoes comRotulo acoes={mais} />}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )

  // ---------- computador: a tabela ----------
  const pad = compacta ? 'px-2 py-1.5' : 'px-3 py-2.5'
  const temAcoes = !!acoes || !!acaoRapida
  const nCol = colunas.length + (selecao ? 1 : 0) + (temAcoes ? 1 : 0)
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--borda)] bg-[var(--fundo)] text-left">
          <tr>
            {selecao && <th className="w-10 px-2 py-2"><input type="checkbox" className="h-5 w-5 cursor-pointer" aria-label={t('Selecionar todos os filtrados')} checked={todos} onChange={selecao.onTodos} /></th>}
            {colunas.map((c) => {
              const ativa = !!ordem && !!c.ordenar && ordem.por === c.ordenar
              return (
                <th key={c.id} scope="col" aria-sort={ativa ? (ordem!.desc ? 'descending' : 'ascending') : undefined} className={cx('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]', c.direita && 'text-right', c.larga && 'hidden xl:table-cell')}>
                  {c.ordenar && onOrdenar ? (
                    <button type="button" onClick={() => onOrdenar(c.ordenar!)} className={cx('inline-flex items-center gap-1 uppercase hover:text-[var(--texto)]', ativa && 'text-[var(--texto)]')}>
                      {t(c.titulo)}<span aria-hidden className={cx('text-[10px]', !ativa && 'opacity-30')}>{ativa && !ordem!.desc ? '▲' : '▼'}</span>
                    </button>
                  ) : c.titulo ? t(c.titulo) : <span className="sr-only">{c.id}</span>}
                </th>
              )
            })}
            {temAcoes && <th className="w-12 px-2"><span className="sr-only">{t('Ações')}</span></th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const id = chave(l)
            const extra = detalhe?.(l)
            return (
              <Fragment key={id}>
                <tr tabIndex={onAbrir ? 0 : undefined} role={onAbrir ? 'link' : undefined} aria-label={rotuloLinha?.(l)}
                  onClick={onAbrir && (() => onAbrir(l))} onKeyDown={onAbrir && ((e) => e.key === 'Enter' && e.target === e.currentTarget && onAbrir(l))}
                  className={cx('border-t border-[var(--borda)] align-middle outline-none first:border-t-0', onAbrir && 'cursor-pointer hover:bg-[var(--marca-suave)]/50 focus-visible:bg-[var(--marca-suave)]', marcada(l) && 'bg-[var(--marca-suave)]', apagada(l) && 'text-[var(--suave)]')}>
                  {selecao && <td className="w-10 px-2">{caixa(l)}</td>}
                  {colunas.map((c) => <td key={c.id} className={cx(pad, c.direita && 'num whitespace-nowrap text-right', c.larga && 'hidden xl:table-cell', c.classe)}>{c.celula(l)}</td>)}
                  {temAcoes && <td className="w-12 px-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><span className="flex flex-nowrap items-center justify-end gap-0.5">{acaoRapida?.(l)}{acoes && <MenuAcoes acoes={acoes(l)} />}</span></td>}
                </tr>
                {extra && <tr className="bg-[var(--fundo)]"><td colSpan={nCol} className="px-3 py-2">{extra}</td></tr>}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
