// TABELAS DE PREÇO com VERSÕES.
//  #/precos        lista: cada tabela com a versão atual, quando mudou, quem mudou e quantas vendas/compras usaram
//  #/precos/:id    tela da tabela: Tabela (atual) · Editar (publica versão nova) · Versões · Comparar ("era X → ficou Y")
//  #/precos/novo   nova tabela
// Toda alteração publica uma versão nova; as anteriores ficam guardadas e dá para comparar quaisquer duas.

import { useState } from 'react'
import { fatorValido, formatar } from '../core/domain/dinheiro'
import { dataLocal } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { TabelaPreco } from '../core/domain/tipos'
import type { DiferencaCelula } from '../core/services/precos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, ErroTela, Pilula, Selecao, Titulo, Vazio, cx, dataBR, loc, moedaPadrao } from '../ui/base'
import { useApp, useAvisoSaida, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { useT } from '../ui/i18n'

type Rascunho = Pick<TabelaPreco, 'id' | 'moduloId' | 'nome' | 'categoria' | 'validaDesde' | 'moeda' | 'unidadeMedida' | 'fatorPor' | 'linhas' | 'colunas' | 'valores'>
type GradeDados = Pick<TabelaPreco, 'linhas' | 'colunas' | 'valores'>
const quando = (iso: string) => new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const n = (x?: string) => (x ? Number(x.replace(',', '.')) : undefined)
type T = ReturnType<typeof useT>

function rascunhoDe(tb: TabelaPreco | undefined, t: T): Rascunho {
  return tb
    ? { ...tb, valores: { ...tb.valores }, colunas: tb.colunas.map((c) => ({ ...c })), linhas: [...tb.linhas] }
    : { id: novoId(), moduloId: 'cabelo', nome: t('Nova tabela'), moeda: moedaPadrao(), unidadeMedida: 'cm', fatorPor: 'grama', validaDesde: dataLocal(), linhas: [40, 50, 55, 60, 70, 80, 90, 100], colunas: [{ id: 'c1', nome: t('Comprador {n}', { n: 1 }) }], valores: {} }
}

/** quantos preços mudaram e se mudou a estrutura (nome, categoria, medidas, compradores) */
function mudancasDe(tb: TabelaPreco | undefined, r: Rascunho) {
  if (!tb) return { mudancas: 0, mudouEstrutura: true }
  const mudancas = Object.keys({ ...tb.valores, ...r.valores }).filter((k) => (tb.valores[k] ?? '') !== (r.valores[k] ?? '').trim()).length
  const mudouEstrutura = JSON.stringify([tb.linhas, tb.colunas, tb.nome, tb.categoria, tb.validaDesde]) !== JSON.stringify([r.linhas, r.colunas, r.nome, r.categoria, r.validaDesde])
  return { mudancas, mudouEstrutura }
}

// ---------- lista ----------

export function Precos() {
  const t = useT()
  const { ir, nav } = useApp()
  const { dados } = useConsulta('tabelasPreco', {})
  if (nav.params.id || nav.tela === 'tabelaPreco') return <TabelaTela />
  return (
    <div>
      <Titulo subtitulo={t('Valor = gramas × fator. Ex.: 40 cm, 2.000 g × 3,5 = Bs 7.000.')} acao={<Botao grande onClick={() => ir('tabelaPreco', { id: 'novo' })}>+ {t('Tabela')}</Botao>}>{t('Tabelas de preço')}</Titulo>
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhuma tabela ainda." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {dados.map((tb) => <CartaoTabela key={tb.id} tb={tb} />)}
        </div>
      )}
    </div>
  )
}

function CartaoTabela({ tb }: { tb: TabelaPreco }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('tabelaPreco', { id: tb.id })
  const v = dados?.versoes[0]
  const preenchidas = Object.keys(tb.valores).length
  return (
    <button type="button" onClick={() => ir('tabelaPreco', { id: tb.id })} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-left hover:border-[var(--marca)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold">{tb.nome}</div>
          <div className="text-sm text-[var(--suave)]">{t(tb.categoria ?? 'Normal')} · {tb.moeda} {t('por grama')}</div>
        </div>
        {v && <Pilula tom="marca">v{v.numero}</Pilula>}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-[var(--suave)]">{t('Medidas')}</dt><dd className="num font-semibold">{tb.linhas.length}</dd></div>
        <div><dt className="text-xs text-[var(--suave)]">{t('Compradores')}</dt><dd className="num font-semibold">{tb.colunas.length}</dd></div>
        <div><dt className="text-xs text-[var(--suave)]">{t('Usos')}</dt><dd className="num font-semibold">{dados?.totalUsos ?? '…'}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-[var(--suave)]">
        {v ? <>{t('Última versão')} {quando(v.em)}{v.por ? ` · ${v.por}` : ''}{v.nota ? ` · “${v.nota}”` : ''}</> : null}
        <span className="block">{preenchidas} {t('preços preenchidos')} · {t('vale desde')} {dataBR(tb.validaDesde)}</span>
      </p>
    </button>
  )
}

// ---------- grade ----------

/** Grade medida × comprador. Leitura com intensidade pela faixa de preço; edição célula a célula; comparação com antes → depois. */
function Grade({ tb, editar, diferencas, base }: { tb: GradeDados; editar?: (k: string, v: string) => void; diferencas?: Map<string, DiferencaCelula>; base?: GradeDados }) {
  const t = useT()
  const todos = Object.values(tb.valores).map((x) => n(x)!).filter((x) => x > 0)
  const max = Math.max(1, ...todos)
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--borda)]">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-r border-[var(--borda)] bg-[var(--fundo)] px-2 py-2 text-xs text-[var(--suave)]">{t('cm')}</th>
            {tb.colunas.map((c) => (
              <th key={c.id} className={cx('min-w-[4.5rem] border-b border-[var(--borda)] bg-[var(--fundo)] px-2 py-2 text-xs font-semibold', base && !base.colunas.some((x) => x.id === c.id) && 'text-[var(--bom)]')}>{c.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tb.linhas.map((l) => (
            <tr key={l}>
              <th className={cx('sticky left-0 z-10 border-r border-[var(--borda)] bg-[var(--cartao)] px-2 text-right font-bold', base && !base.linhas.includes(l) && 'text-[var(--bom)]')}>{l}</th>
              {tb.colunas.map((c) => {
                const k = `${l}|${c.id}`
                const v = tb.valores[k] ?? ''
                const d = diferencas?.get(k)
                const intens = !editar && !diferencas && n(v) ? Math.round(6 + (n(v)! / max) * 22) : 0
                return (
                  <td key={c.id} className="border-b border-r border-[var(--borda)] p-0 last:border-r-0" style={intens ? { background: `color-mix(in srgb, var(--marca) ${intens}%, transparent)` } : d ? { background: `color-mix(in srgb, ${!d.antes ? 'var(--bom)' : !d.depois ? 'var(--ruim)' : (d.pct ?? 0) >= 0 ? 'var(--bom)' : 'var(--ruim)'} 16%, transparent)` } : undefined}>
                    {editar ? (
                      <input aria-label={`${l} ${c.nome}`} inputMode="decimal" value={v} onChange={(e) => editar(k, e.target.value)} className={cx('num h-10 w-[4.5rem] bg-transparent text-center outline-none focus:bg-[var(--marca-suave)]', v && !fatorValido(v) && 'text-[var(--ruim)]', base && (base.valores[k] ?? '') !== v && 'font-bold text-[var(--marca)]')} />
                    ) : d ? (
                      <div className="num px-1 py-1.5 text-center leading-tight" title={`${d.antes ?? '—'} → ${d.depois ?? '—'}`}>
                        <span className="block text-[11px] text-[var(--suave)] line-through">{d.antes ?? '—'}</span>
                        <span className="block font-bold">{d.depois ?? '—'}</span>
                      </div>
                    ) : (
                      <div className={cx('num h-10 py-2.5 text-center', !v && 'text-[var(--suave)]')}>{v || '·'}</div>
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

// ---------- tela da tabela ----------

function TabelaTela() {
  const t = useT()
  const { nav, ir, voltar, marcarSujo } = useApp()
  const id = nav.params.id as string
  const novo = id === 'novo'
  const { dados, erro } = useConsulta('tabelaPreco', { id }, !novo)
  const [abaUrl, setAba] = useParamTela<'tabela' | 'editar' | 'versoes' | 'comparar'>('aba', 'tabela')
  const aba = novo ? 'editar' : abaUrl
  const [comparar, setComparar] = useState<{ de?: number; para?: number }>({})
  // rascunho fica aqui (acima das abas): trocar de aba não perde o que foi digitado
  const [rascunho, setRascunho] = useState<Rascunho>()
  const [nota, setNota] = useState('')
  const tb = dados?.tabela
  const m = rascunho ? mudancasDe(tb, rascunho) : undefined
  const sujo = !!rascunho && (novo || !!m?.mudancas || !!m?.mudouEstrutura)
  useAvisoSaida(sujo)
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!novo && !dados) return <Carregando />
  const versoes = dados?.versoes ?? []
  const abas = novo
    ? [{ id: 'editar', nome: 'Nova tabela' }]
    : [{ id: 'tabela', nome: 'Tabela' }, { id: 'editar', nome: 'Editar', extra: sujo ? <Pilula key="r" tom="alerta">{t('não publicado')}</Pilula> : undefined }, { id: 'versoes', nome: 'Versões', extra: <Pilula key="v">{versoes.length}</Pilula> }, { id: 'comparar', nome: 'Comparar' }]
  const de = comparar.de ?? versoes[1]?.numero ?? versoes[0]?.numero
  const para = comparar.para ?? versoes[0]?.numero
  return (
    <div>
      <Botao variante="leve" className="mb-3" onClick={voltar}>← {t('Voltar')}</Botao>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{tb?.nome ?? rascunho?.nome ?? t('Nova tabela')}</h1>
            {!novo && <Pilula tom="marca">v{dados!.atual}</Pilula>}
          </div>
          {tb && <p className="text-sm text-[var(--suave)]">{t(tb.categoria ?? 'Normal')} · {tb.moeda} {t('por grama')} · {t('vale desde')} {dataBR(tb.validaDesde)} · {versoes[0]?.por ? `${t('última versão por')} ${versoes[0].por}, ${quando(versoes[0].em)}` : ''}</p>}
        </div>
      </div>
      <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a as typeof aba)} abas={abas} />

      {aba === 'tabela' && tb && (
        <div className="space-y-4">
          <Grade tb={tb} />
          {dados!.usos.length > 0 && (
            <Cartao titulo={`${t('Usada em')} ${dados!.totalUsos}`} ajuda="Vendas e compras que calcularam o preço com esta tabela. Cada uma guarda o fator que usou: mudar a tabela não muda o passado.">
              <ul className="divide-y divide-[var(--borda)] text-sm">
                {dados!.usos.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => ir(u.tipo === 'compra' ? 'pedido' : 'venda', { id: u.id })} className="flex w-full justify-between gap-2 py-2 text-left hover:text-[var(--marca)]">
                      <span>{t(u.tipo === 'compra' ? 'Compra' : 'Venda')} {u.codigo ?? ''} · {dataBR(u.data)} · {u.linhas} {t('linha(s)')}</span>
                      <span className="num">{formatar(u.total, tb.moeda)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      )}

      {aba === 'editar' && (
        <Editar
          tb={tb}
          versao={dados?.atual}
          r={rascunho ?? rascunhoDe(tb, t)}
          setR={setRascunho}
          nota={nota}
          setNota={setNota}
          onPublicada={(nid) => {
            marcarSujo(false)
            setRascunho(undefined)
            setNota('')
            if (novo) ir('tabelaPreco', { id: nid })
            else setAba('versoes')
          }}
        />
      )}

      {aba === 'versoes' && (
        <ol className="relative ml-3 border-l-2 border-[var(--borda)]">
          {versoes.map((v, i) => (
            <li key={v.numero} className="mb-4 ml-5">
              <span className={cx('absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2', i === 0 ? 'border-[var(--marca)] bg-[var(--marca)]' : 'border-[var(--borda)] bg-[var(--cartao)]')} aria-hidden />
              <div className="flex flex-wrap items-center gap-2">
                <b>v{v.numero}</b>
                {i === 0 && <Pilula tom="bom">{t('em uso')}</Pilula>}
                <span className="text-sm text-[var(--suave)]">{quando(v.em)}{v.por ? ` · ${v.por}` : ''}</span>
              </div>
              {v.nota && <p className="text-sm">“{v.nota}”</p>}
              {versoes[i + 1] && (
                <button type="button" onClick={() => (setComparar({ de: versoes[i + 1].numero, para: v.numero }), setAba('comparar'))} className="mt-1 min-h-10 text-sm font-semibold text-[var(--marca)]">
                  {t('O que mudou em relação à v{n} →', { n: versoes[i + 1].numero })}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {aba === 'comparar' && versoes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--suave)]">{t('Era assim')}</span>
            <Selecao className="w-auto" valor={String(de)} onChange={(x) => setComparar({ de: Number(x), para })} opcoes={versoes.map((v) => ({ id: String(v.numero), nome: `v${v.numero} · ${quando(v.em)}` }))} />
            <span className="text-sm text-[var(--suave)]">{t('ficou assim')}</span>
            <Selecao className="w-auto" valor={String(para)} onChange={(x) => setComparar({ de, para: Number(x) })} opcoes={versoes.map((v) => ({ id: String(v.numero), nome: `v${v.numero} · ${quando(v.em)}` }))} />
          </div>
          {de !== undefined && para !== undefined && <Comparacao id={id} de={de} para={para} />}
        </div>
      )}
    </div>
  )
}

function Comparacao({ id, de, para }: { id: string; de: number; para: number }) {
  const t = useT()
  const { dados } = useConsulta('compararVersoes', { id, de, para })
  if (!dados) return <Carregando />
  const r = dados.resumo
  const mapa = new Map(dados.celulas.map((c) => [`${c.linha}|${c.colunaId}`, c]))
  if (de === para) return <Vazio texto="Escolha duas versões diferentes." />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Mudaram', r.mudaram, ''],
          ['Subiram', r.subiram, 'text-[var(--bom)]'],
          ['Desceram', r.desceram, 'text-[var(--ruim)]'],
          ['Novos preços', r.entraram, 'text-[var(--bom)]'],
          ['Removidos', r.sairam, 'text-[var(--ruim)]'],
        ].map(([nome, v, cor]) => (
          <div key={nome as string} className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3">
            <div className="text-xs text-[var(--suave)]">{t(nome as string)}</div>
            <div className={cx('num text-2xl font-bold', cor as string)}>{v}</div>
          </div>
        ))}
      </div>
      {(r.medidasNovas.length > 0 || r.medidasRemovidas.length > 0 || r.colunasNovas.length > 0 || r.colunasRemovidas.length > 0) && (
        <p className="text-sm">
          {r.medidasNovas.length > 0 && <>{t('Medidas novas')}: <b>{r.medidasNovas.join(', ')}</b>. </>}
          {r.medidasRemovidas.length > 0 && <>{t('Medidas removidas')}: <b>{r.medidasRemovidas.join(', ')}</b>. </>}
          {r.colunasNovas.length > 0 && <>{t('Compradores novos')}: <b>{r.colunasNovas.join(', ')}</b>. </>}
          {r.colunasRemovidas.length > 0 && <>{t('Compradores removidos')}: <b>{r.colunasRemovidas.join(', ')}</b>.</>}
        </p>
      )}
      {r.mudaram === 0 ? (
        <Vazio texto="Os preços são iguais nas duas versões." />
      ) : (
        <>
          <Cartao titulo={t('Na grade (riscado = era; embaixo = ficou)')}>
            <Grade tb={{ linhas: dados.linhas, colunas: dados.colunas, valores: dados.para.valores }} diferencas={mapa} base={dados.de} />
          </Cartao>
          <Cartao titulo={t('Lista do que mudou')}>
            <table className="w-full text-sm">
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
                {dados.celulas.map((c) => (
                  <tr key={`${c.linha}|${c.colunaId}`} className="border-t border-[var(--borda)]">
                    <td className="py-1.5 font-semibold">{c.linha} cm</td>
                    <td className="py-1.5">{c.coluna}</td>
                    <td className="num py-1.5 text-right text-[var(--suave)]">{c.antes ?? '—'}</td>
                    <td className="num py-1.5 text-right font-bold">{c.depois ?? '—'}</td>
                    <td className={cx('num py-1.5 text-right', (c.pct ?? 0) > 0 ? 'text-[var(--bom)]' : (c.pct ?? 0) < 0 ? 'text-[var(--ruim)]' : 'text-[var(--suave)]')}>
                      {c.pct !== undefined ? `${c.pct > 0 ? '+' : ''}${c.pct.toLocaleString(loc())}%` : !c.antes ? t('novo') : t('removido')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </>
      )}
    </div>
  )
}

// ---------- editar e publicar ----------

function Editar({ tb, versao, r, setR, nota, setNota, onPublicada }: { tb?: TabelaPreco; versao?: number; r: Rascunho; setR(r: Rascunho): void; nota: string; setNota(n: string): void; onPublicada(id: string): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { dados: pessoas } = useConsulta('pessoas', {})
  const [novaLinha, setNovaLinha] = useState('')
  const { mudancas, mudouEstrutura } = mudancasDe(tb, r)
  const addLinha = () => {
    const x = Number(novaLinha)
    if (x > 0) setR({ ...r, linhas: [...new Set([...r.linhas, x])].sort((a, b) => a - b) })
    setNovaLinha('')
  }
  return (
    <div className="space-y-4">
      <Cartao>
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo rotulo="Nome" className="sm:col-span-2"><Entrada value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} /></Campo>
          <Campo rotulo="Categoria" ajuda="Vazio = tabela geral (Normal). Tinte, CH… usam a própria tabela."><Entrada list="cats-t" value={r.categoria ?? ''} onChange={(e) => setR({ ...r, categoria: e.target.value || undefined })} /><datalist id="cats-t">{['Tinte', 'CH', 'CH+', 'Rojo', 'Quemado', 'Menudo'].map((c) => <option key={c} value={c}>{t(c)}</option>)}</datalist></Campo>
          <Campo rotulo="Vale desde"><Entrada type="date" value={r.validaDesde ?? ''} onChange={(e) => setR({ ...r, validaDesde: e.target.value })} /></Campo>
        </div>
      </Cartao>
      <p className="text-sm text-[var(--suave)]">{t('Toque numa célula e digite o fator (3,5 · 17.5). Célula vazia = sem preço. O que você mudou fica em destaque.')}</p>
      <Grade tb={r} base={tb} editar={(k, v) => setR({ ...r, valores: { ...r.valores, [k]: v } })} />
      <div className="grid gap-3 md:grid-cols-2">
        <Cartao titulo={t('Colunas (compradores)')}>
          <ul className="space-y-2">
            {r.colunas.map((c, i) => (
              <li key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                <Entrada aria-label={t('Nome do comprador')} value={c.nome} onChange={(e) => setR({ ...r, colunas: r.colunas.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) })} />
                <Selecao valor={c.pessoaId} vazio="Ligar a pessoa…" onChange={(v) => setR({ ...r, colunas: r.colunas.map((x, k) => (k === i ? { ...x, pessoaId: v || undefined } : x)) })} opcoes={(pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome }))} />
                <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-xl hover:bg-[var(--marca-suave)]" onClick={() => setR({ ...r, colunas: r.colunas.filter((_, k) => k !== i) })}>×</button>
              </li>
            ))}
          </ul>
          <Botao className="mt-2" variante="secundario" onClick={() => setR({ ...r, colunas: [...r.colunas, { id: novoId().slice(-6).toLowerCase(), nome: t('Coluna {n}', { n: r.colunas.length + 1 }) }] })}>+ {t('Coluna')}</Botao>
        </Cartao>
        <Cartao titulo={t('Linhas (medidas)')}>
          <div className="flex flex-wrap gap-1">{r.linhas.map((l) => <button key={l} type="button" aria-label={t('Tirar a medida {n}', { n: l })} className="min-h-10 min-w-10 rounded-full bg-[var(--marca-suave)] px-3 text-sm" onClick={() => setR({ ...r, linhas: r.linhas.filter((x) => x !== l) })}>{l} ×</button>)}</div>
          <div className="mt-2 flex gap-2"><Entrada inputMode="numeric" aria-label={t('Nova medida (cm)')} placeholder="65" value={novaLinha} onChange={(e) => setNovaLinha(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLinha()} /><Botao variante="secundario" aria-label={t('Adicionar medida')} onClick={addLinha}>+</Botao></div>
        </Cartao>
      </div>
      {/* barra de publicação fixa embaixo */}
      <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--marca)] bg-[var(--cartao)] p-3 shadow-lg md:bottom-4">
        <span className="text-sm">
          {tb ? (mudancas || mudouEstrutura ? <><b>{mudancas}</b> {t('preço(s) alterado(s)')} · {t('vai publicar a')} <b>v{(versao ?? 1) + 1}</b></> : t('Nada mudou ainda.')) : t('Vai publicar a v1')}
        </span>
        <Entrada className="min-w-[12rem] flex-1" placeholder={t('O que mudou e por quê (opcional)')} value={nota} onChange={(e) => setNota(e.target.value)} />
        <Botao disabled={ocupado || (!!tb && !mudancas && !mudouEstrutura)} onClick={async () => {
          const res = await executar('salvarTabelaPreco', { ...r, nota }, t('Versão publicada.'))
          if (res) onPublicada(res.id)
        }}>{t(tb ? 'Publicar versão nova' : 'Criar tabela')}</Botao>
      </div>
    </div>
  )
}
