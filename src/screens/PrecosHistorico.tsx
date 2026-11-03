// HISTÓRICO DA TABELA DE PREÇO (versões + comparação), responsivo:
//  · "Comparar vA → vB" em cima (duas escolhas), com atalho "anterior → esta" em cada versão da linha do tempo
//  · números grandes (Mudaram · Subiram · Desceram · Novos · Removidos) que FILTRAM a lista ao tocar
//  · filtro por medida e comprador; lista em cartões no celular e tabela no computador; a grade fica em "Ver na grade"

import { useState } from 'react'
import type { TabelaPreco } from '../core/domain/tipos'
import type { DiferencaCelula } from '../core/services/precos'
import { Campo, Carregando, Info, Pilula, Selecao, Vazio, cx, loc } from '../ui/base'
import { useConsulta } from '../ui/contexto'
import { useT } from '../ui/i18n'
import { NumeroGrande } from '../ui/numeroGrande'

type GradeDados = Pick<TabelaPreco, 'linhas' | 'colunas' | 'valores'>
type Versao = { numero: number; em: string; por?: string; nota: string }
type Tipo = 'subiu' | 'desceu' | 'novo' | 'removido'

const quando = (iso: string) => new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const tipoDe = (c: DiferencaCelula): Tipo => (!c.antes ? 'novo' : !c.depois ? 'removido' : (c.pct ?? 0) >= 0 ? 'subiu' : 'desceu')
const COR: Record<Tipo, string> = { subiu: 'var(--bom)', desceu: 'var(--ruim)', novo: 'var(--bom)', removido: 'var(--ruim)' }

export const AJUDA_HISTORICO =
  'Cada vez que a tabela é publicada nasce uma versão nova (v1, v2…), e as antigas ficam guardadas. Escolha duas para ver o que mudou. Ex.: v1 → v2: 60 cm × Henrique era 17, ficou 17,5 (+2,9%).'

export function Historico({ id, versoes }: { id: string; versoes: Versao[] }) {
  const t = useT()
  // padrão: a anterior → a em uso
  const [de, setDe] = useState(() => versoes[1]?.numero)
  const [para, setPara] = useState(() => versoes[0]?.numero)
  if (versoes.length < 2) return <Vazio texto="Só existe a v1. Quando você publicar uma mudança, ela aparece aqui e dá para comparar." />
  const opcoes = versoes.map((v, i) => ({ id: String(v.numero), nome: `v${v.numero}${i === 0 ? ` (${t('em uso')})` : ''}` }))
  const [a, b] = de !== undefined && para !== undefined && de > para ? [para, de] : [de, para]
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* ESCOLHER (no celular vem primeiro; no computador fica na coluna da direita, em cima da comparação) */}
      <section aria-label={t('Comparar versões')} className="rounded-2xl border border-[var(--marca)]/40 bg-[var(--marca-suave)] p-3 lg:col-start-2 lg:row-start-1">
        <p className="mb-2 flex items-center text-sm font-bold">⇄ {t('Comparar versões')}<Info texto={AJUDA_HISTORICO} /></p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Campo rotulo="Era assim"><Selecao valor={String(de ?? '')} onChange={(v) => setDe(Number(v))} opcoes={opcoes} /></Campo>
          <span aria-hidden className="pb-3 text-lg font-bold text-[var(--marca)]">→</span>
          <Campo rotulo="Ficou assim"><Selecao valor={String(para ?? '')} onChange={(v) => setPara(Number(v))} opcoes={opcoes} /></Campo>
        </div>
      </section>

      {/* LINHA DO TEMPO das versões (a mais nova em cima) */}
      <section aria-label={t('Versões')} className="lg:row-span-2 lg:row-start-1">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Versões')} · {versoes.length}</h3>
        <ol className="relative space-y-2 border-l-2 border-[var(--borda)] pl-4">
          {versoes.map((v, i) => {
            const naComparacao = v.numero === a || v.numero === b
            const anterior = versoes[i + 1]
            return (
              <li key={v.numero} className="relative">
                <span aria-hidden className={cx('absolute -left-[1.4rem] top-3 h-3 w-3 rounded-full border-2', i === 0 ? 'border-[var(--bom)] bg-[var(--bom)]' : naComparacao ? 'border-[var(--marca)] bg-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)]')} />
                <div className={cx('rounded-2xl border p-3', naComparacao ? 'border-[var(--marca)] bg-[var(--cartao)]' : 'border-[var(--borda)] bg-[var(--cartao)]')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-mono text-base">v{v.numero}</b>
                    {i === 0 && <Pilula tom="bom">{t('em uso')}</Pilula>}
                    {v.numero === a && <Pilula>{t('era')}</Pilula>}
                    {v.numero === b && <Pilula tom="marca">{t('ficou')}</Pilula>}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--suave)]">{quando(v.em)}{v.por ? ` · ${v.por}` : ''}</p>
                  {v.nota && <p className="mt-1 text-sm [overflow-wrap:anywhere]">“{v.nota}”</p>}
                  {anterior && !(a === anterior.numero && b === v.numero) && (
                    <button type="button" onClick={() => (setDe(anterior.numero), setPara(v.numero))} className="mt-1 min-h-9 text-sm font-semibold text-[var(--marca)] hover:underline">
                      {t('Ver o que mudou da v{a} para a v{b}', { a: anterior.numero, b: v.numero })} →
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="min-w-0 lg:col-start-2">
        {a !== undefined && b !== undefined && a !== b ? <Comparacao key={`${a}-${b}`} id={id} de={a} para={b} /> : <Vazio texto="Escolha duas versões diferentes." />}
      </div>
    </div>
  )
}

function Comparacao({ id, de, para }: { id: string; de: number; para: number }) {
  const t = useT()
  const { dados } = useConsulta('compararVersoes', { id, de, para })
  const [tipo, setTipo] = useState<Tipo | ''>('')
  const [medida, setMedida] = useState('')
  const [comprador, setComprador] = useState('')
  const [verGrade, setVerGrade] = useState(false)
  if (!dados) return <Carregando />
  const r = dados.resumo
  const mapa = new Map(dados.celulas.map((c) => [`${c.linha}|${c.colunaId}`, c]))
  const lista = dados.celulas.filter((c) => (!tipo || tipoDe(c) === tipo) && (!medida || String(c.linha) === medida) && (!comprador || c.coluna === comprador))
  const medidas = [...new Set(dados.celulas.map((c) => String(c.linha)))].sort((x, y) => Number(x) - Number(y))
  const compradores = [...new Set(dados.celulas.map((c) => c.coluna))].sort((x, y) => x.localeCompare(y, 'pt-BR'))
  const alternar = (x: Tipo | '') => setTipo(tipo === x ? '' : x)
  const pct = (c: DiferencaCelula) => (c.pct !== undefined ? `${c.pct > 0 ? '+' : ''}${c.pct.toLocaleString(loc())}%` : !c.antes ? t('novo') : t('removido'))
  const estrutura = [
    r.medidasNovas.length ? `${t('Medidas novas')}: ${r.medidasNovas.join(', ')}` : '',
    r.medidasRemovidas.length ? `${t('Medidas removidas')}: ${r.medidasRemovidas.join(', ')}` : '',
    r.colunasNovas.length ? `${t('Compradores novos')}: ${r.colunasNovas.join(', ')}` : '',
    r.colunasRemovidas.length ? `${t('Compradores removidos')}: ${r.colunasRemovidas.join(', ')}` : '',
  ].filter(Boolean)
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">v{de} → v{para}: {t('{n} preço(s) mudaram', { n: r.mudaram })}</h2>
      {/* números grandes: tocar filtra a lista */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumeroGrande rotulo="Subiram" icone="▲" cor="var(--bom)" colorirValor valor={String(r.subiram)} ativo={tipo === 'subiu'} onClick={() => alternar('subiu')} />
        <NumeroGrande rotulo="Desceram" icone="▼" cor="var(--ruim)" colorirValor valor={String(r.desceram)} ativo={tipo === 'desceu'} onClick={() => alternar('desceu')} />
        <NumeroGrande rotulo="Novos preços" icone="＋" cor="var(--bom)" valor={String(r.entraram)} ativo={tipo === 'novo'} onClick={() => alternar('novo')} />
        <NumeroGrande rotulo="Removidos" icone="−" cor="var(--ruim)" valor={String(r.sairam)} ativo={tipo === 'removido'} onClick={() => alternar('removido')} />
      </div>
      {estrutura.length > 0 && <p className="rounded-xl bg-[var(--fundo)] px-3 py-2 text-sm">{estrutura.join(' · ')}</p>}
      {r.mudaram === 0 ? <Vazio texto="Os preços são iguais nas duas versões." /> : (
        <section className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 shadow-sm">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Campo rotulo="Medida"><Selecao valor={medida} onChange={setMedida} vazio={t('Todas')} opcoes={medidas.map((m) => ({ id: m, nome: `${m} cm` }))} /></Campo>
            <Campo rotulo="Comprador"><Selecao valor={comprador} onChange={setComprador} vazio={t('Todos')} opcoes={compradores.map((c) => ({ id: c, nome: c }))} /></Campo>
          </div>
          {(tipo || medida || comprador) && (
            <button type="button" onClick={() => (setTipo(''), setMedida(''), setComprador(''))} className="mb-2 min-h-9 text-sm font-semibold text-[var(--marca)]">✕ {t('Limpar filtros')} · {t('Mostrando {n} de {t}', { n: lista.length, t: dados.celulas.length })}</button>
          )}
          {!lista.length ? <Vazio texto="Nada com estes filtros." /> : (
            <>
              {/* celular: um cartão por mudança */}
              <ul className="space-y-1.5 md:hidden">
                {lista.map((c) => (
                  <li key={`${c.linha}|${c.colunaId}`} className="flex items-center gap-3 rounded-xl border border-[var(--borda)] px-3 py-2">
                    <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: COR[tipoDe(c)] }} />
                    <span className="min-w-0 flex-1">
                      <b className="block">{c.linha} cm · <span className="font-semibold">{c.coluna}</span></b>
                      <span className="num text-sm"><span className="text-[var(--suave)] line-through">{c.antes ?? '—'}</span> → <b>{c.depois ?? '—'}</b></span>
                    </span>
                    <span className="num shrink-0 text-sm font-bold" style={{ color: COR[tipoDe(c)] }}>{pct(c)}</span>
                  </li>
                ))}
              </ul>
              {/* computador: tabela */}
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="text-left text-xs text-[var(--suave)]">
                    <th className="py-1 font-medium">{t('Medida')}</th>
                    <th className="py-1 font-medium">{t('Comprador')}</th>
                    <th className="py-1 text-right font-medium">{t('Era')}</th>
                    <th className="py-1 text-right font-medium">{t('Ficou')}</th>
                    <th className="py-1 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={`${c.linha}|${c.colunaId}`} className="border-t border-[var(--borda)]">
                      <td className="py-1.5 font-semibold">{c.linha} cm</td>
                      <td className="py-1.5">{c.coluna}</td>
                      <td className="num py-1.5 text-right text-[var(--suave)] line-through">{c.antes ?? '—'}</td>
                      <td className="num py-1.5 text-right font-bold">{c.depois ?? '—'}</td>
                      <td className="num py-1.5 text-right font-semibold" style={{ color: COR[tipoDe(c)] }}>{pct(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <button type="button" aria-expanded={verGrade} onClick={() => setVerGrade(!verGrade)} className="mt-3 min-h-10 text-sm font-semibold text-[var(--marca)]">{verGrade ? '▾' : '▸'} {t('Ver na grade (riscado = era; embaixo = ficou)')}</button>
          {verGrade && <GradeComparacao tb={{ linhas: dados.linhas, colunas: dados.colunas, valores: dados.para.valores }} diferencas={mapa} base={dados.de} />}
        </section>
      )}
    </div>
  )
}

/** Grade só para ler a comparação: "era" riscado em cima, "ficou" embaixo, com a cor da mudança. */
function GradeComparacao({ tb, diferencas, base }: { tb: GradeDados; diferencas: Map<string, DiferencaCelula>; base: GradeDados }) {
  const t = useT()
  return (
    <div className="mt-2 max-h-[70vh] overflow-auto rounded-xl border border-[var(--borda)]">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 border-b border-r border-[var(--borda)] bg-[var(--fundo)] px-2 py-2 text-xs text-[var(--suave)]">{t('cm')}</th>
            {tb.colunas.map((c) => (
              <th key={c.id} className={cx('sticky top-0 z-10 min-w-[4.5rem] border-b border-[var(--borda)] bg-[var(--fundo)] px-2 py-2 text-xs font-semibold', !base.colunas.some((x) => x.id === c.id) && 'text-[var(--bom)]')}>{c.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tb.linhas.map((l) => (
            <tr key={l}>
              <th className={cx('sticky left-0 z-10 border-r border-[var(--borda)] bg-[var(--cartao)] px-2 text-right font-bold', !base.linhas.includes(l) && 'text-[var(--bom)]')}>{l}</th>
              {tb.colunas.map((c) => {
                const k = `${l}|${c.id}`
                const v = tb.valores[k] ?? ''
                const d = diferencas.get(k)
                return (
                  <td key={c.id} className="border-b border-r border-[var(--borda)] p-0 last:border-r-0" style={d ? { background: `color-mix(in srgb, ${COR[tipoDe(d)]} 16%, transparent)` } : undefined}>
                    {d ? (
                      <div className="num px-1 py-1.5 text-center leading-tight" title={`${d.antes ?? '—'} → ${d.depois ?? '—'}`}>
                        <span className="block text-[11px] text-[var(--suave)] line-through">{d.antes ?? '—'}</span>
                        <span className="block font-bold">{d.depois ?? '—'}</span>
                      </div>
                    ) : (
                      <div className={cx('num h-10 py-2.5 text-center', !v && 'text-[var(--suave)] opacity-40')}>{v || '–'}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
