// JANELAS DO MODO CAIXA: quantas gramas vendeu (parte do pacote), como pagou (formas, troco, dividir) e conferir o
// pacote sem sair da venda.

import { useEffect, useRef, useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { formatar } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Campo, Info, Janela, ValorInput, cx, ehToque, gramasTexto } from '../../../shared/ui/base'
import { EditorPagamentos, type PagamentoTela, useCotacoes } from '../../../shared/ui/compartilhados'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { StatusBadge } from '../../../shared/ui/estoqueUi'
import { VisorFotos } from '../../../shared/ui/fotos'
import { HistoricoPacote } from '../../../shared/ui/historicoPacote'
import { useT } from '../../../shared/ui/i18n'
import { Miniatura, type Pacote, origemCurta } from './pecas'

/** Gramas vendidas (venda de uma parte): número grande, Enter confirma. */
export function EditarQuantidade({ titulo, grama, valor, max, onSalvar, onFechar }: { titulo: string; grama: boolean; valor: number; max: number; onSalvar(q: number): void; onFechar(): void }) {
  const t = useT()
  const [texto, setTexto] = useState(String(valor))
  const q = Number(texto.replace(/\D/g, ''))
  const erro = !q ? t('Digite a quantidade.') : q > max ? t('Só tem {v} neste pacote.', { v: grama ? gramasTexto(max) : max }) : undefined
  const salvar = () => !erro && onSalvar(q)
  return (
    <Janela
      aberta
      titulo={titulo}
      onFechar={onFechar}
      rodape={
        <div className="flex gap-2">
          <Botao variante="secundario" grande className="flex-1" onClick={() => onSalvar(max)}>{t('Tudo')} ({grama ? gramasTexto(max) : max})</Botao>
          <Botao grande className="flex-1" disabled={!!erro} onClick={salvar}>OK</Botao>
        </div>
      }
    >
      <div>
        <span className="mb-1 flex items-center text-sm font-semibold text-[var(--suave)]">
          {grama ? t('Quantas gramas vendeu?') : t('Quantidade')}
          <Info texto="Vendeu só uma parte? Toque e digite as gramas. Ex.: 500 g do P4" />
        </span>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            aria-label={grama ? t('Gramas') : t('Quantidade')}
            value={texto}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), salvar())}
            className="num min-h-16 w-full rounded-2xl border-2 border-[var(--marca)] bg-[var(--cartao)] px-4 text-4xl font-bold outline-none"
          />
          {grama && <span className="text-2xl font-bold text-[var(--suave)]">g</span>}
        </div>
      </div>
      <p className={cx('mt-2 text-sm', erro ? 'font-semibold text-[var(--ruim)]' : 'text-[var(--suave)]')}>{erro ?? `${t('Disponível')}: ${grama ? gramasTexto(max) : max}`}</p>
    </Janela>
  )
}

/** Pagamento num toque: botões grandes por forma; dinheiro pergunta o recebido e mostra o troco; dividir é opcional. */
export function Pagamento({ total, moeda, cotacoes, comCliente, ocupado, onPagar, onFechar }: { total: number; moeda: string; cotacoes: Record<string, string>; comCliente: boolean; ocupado: boolean; onPagar(p: PagamentoTela[], troco?: number): void; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes('venda')
  const formas = formasEmUso(cfg?.formas, moeda)
  const [dinheiro, setDinheiro] = useState<string>()
  const [recebido, setRecebido] = useState<number>()
  const [dividir, setDividir] = useState(false)
  const [pags, setPags] = useState<PagamentoTela[]>([])
  const caixaRecebido = useRef<HTMLDivElement>(null)
  const grade = useRef<HTMLDivElement>(null)
  useEffect(() => {
    grade.current?.querySelector('button')?.focus()
  }, [formas.length])
  const troco = recebido !== undefined && recebido > total ? recebido - total : 0
  const falta = recebido !== undefined && recebido < total ? total - recebido : 0
  const podeDinheiro = !falta || comCliente

  const escolher = (id: string) => {
    if (ocupado) return
    const f = formas.find((x) => x.id === id)
    if (!f) return
    if (f.vivo) {
      setDinheiro(f.id)
      setRecebido(undefined)
      if (!ehToque()) setTimeout(() => caixaRecebido.current?.querySelector('input')?.focus(), 0)
      return
    }
    onPagar([{ id: novoId(), forma: f.id, moeda, valor: total }])
  }
  const confirmarDinheiro = () => {
    if (!dinheiro || ocupado || !podeDinheiro) return
    onPagar([{ id: novoId(), forma: dinheiro, moeda, valor: falta ? recebido : total }], troco || undefined)
  }
  // teclado: 1, 2, 3… escolhe a forma (fora de um campo); Enter confirma o dinheiro
  const ref = useRef({ escolher, confirmarDinheiro, formas, dividir })
  ref.current = { escolher, confirmarDinheiro, formas, dividir }
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (ref.current.dividir || alvo?.tagName === 'INPUT' || alvo?.tagName === 'SELECT' || alvo?.tagName === 'TEXTAREA') return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= ref.current.formas.length) {
        e.preventDefault()
        ref.current.escolher(ref.current.formas[n - 1].id)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // atalhos de dinheiro: exato e as próximas notas redondas
  const passo = 10 ** Math.max(0, String(Math.round(total / 100)).length - 1) * 100
  const redondos = [...new Set([Math.ceil(total / passo) * passo, Math.ceil(total / (passo * 5)) * passo * 5])].filter((v) => v > total).slice(0, 2)

  return (
    <Janela aberta titulo={t('Como pagou?')} onFechar={onFechar}>
      <div className="mb-3 text-center">
        <div className="text-sm text-[var(--suave)]">{t('Total')}</div>
        <div className="num text-4xl font-black">{formatar(total, moeda)}</div>
      </div>
      {!dividir ? (
        <>
          <div ref={grade} className="grid grid-cols-2 gap-2">
            {formas.map((f, i) => (
              <button
                key={f.id}
                type="button"
                disabled={ocupado}
                aria-pressed={dinheiro === f.id}
                onClick={() => escolher(f.id)}
                className={cx('min-h-16 touch-manipulation rounded-2xl border-2 px-3 text-lg font-bold transition duration-100 enabled:active:scale-[0.97] disabled:opacity-50 motion-reduce:transform-none', dinheiro === f.id ? 'border-[var(--marca)] bg-[var(--marca)] text-white' : 'border-[var(--borda)] hover:border-[var(--marca)]')}
              >
                <span className="mr-1 text-xs opacity-60">{i + 1}</span> {t(f.nome)}
              </button>
            ))}
          </div>
          {dinheiro && (
            <div className="mt-3 space-y-2 rounded-2xl bg-[var(--fundo)] p-3">
              <div ref={caixaRecebido} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmarDinheiro())}>
                <Campo rotulo="Recebido" ajuda="Quanto a cliente entregou. Ex.: total Bs 35.000, recebeu Bs 35.100 → troco Bs 100.">
                  <ValorInput moeda={moeda} valor={recebido} onChange={setRecebido} placeholder={formatar(total, moeda, { semSimbolo: true })} />
                </Campo>
              </div>
              <div className="flex flex-wrap gap-2">
                {redondos.map((v) => (
                  <Botao key={v} variante="secundario" onClick={() => setRecebido(v)}>{formatar(v, moeda)}</Botao>
                ))}
              </div>
              {troco > 0 && <p className="num text-2xl font-black text-[var(--bom)]">{t('Troco')}: {formatar(troco, moeda)}</p>}
              {falta > 0 && (
                <p className="text-sm font-semibold text-[var(--alerta)]">
                  {comCliente ? t('Faltam {v}: fica na conta da pessoa (fiado).', { v: formatar(falta, moeda) }) : t('Faltam {v}. Fiado só com cliente (em "+ mais").', { v: formatar(falta, moeda) })}
                </p>
              )}
              <Botao grande className="min-h-14 w-full text-lg" carregando={ocupado} disabled={!podeDinheiro} onClick={confirmarDinheiro}>
                {recebido === undefined || recebido === total ? t('Valor exato ✓') : t('Confirmar ✓')}
              </Botao>
            </div>
          )}
          <button type="button" className="mt-3 min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => (setDividir(true), setPags([{ id: novoId(), forma: formas[0]?.id ?? 'dinheiro', moeda, valor: total }]))}>
            {t('Dividir pagamento')}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {/* cada pagamento em outra moeda tem a sua cotação ("1 US$ = [6,96] Bs"), sugerida pela já digitada ou a do sistema */}
          <EditorPagamentos total={total} moedaTotal={moeda} pagamentos={pags} onChange={setPags} permiteFiado={comCliente} cotacaoEditavel cotacoesSugeridas={cotacoes} />
          <Botao grande className="min-h-14 w-full text-lg" carregando={ocupado} onClick={() => onPagar(pags)}>{t('Confirmar venda')}</Botao>
          <button type="button" className="min-h-10 text-sm font-semibold text-[var(--marca)]" onClick={() => setDividir(false)}>← {t('Uma forma só')}</button>
        </div>
      )}
    </Janela>
  )
}

/** endereço do lote para abrir em OUTRA aba (a venda em andamento não se perde) */
function abrirLoteNovaAba(id: Id) {
  try {
    window.open(`${window.location.pathname}${window.location.search}#/lotes/${encodeURIComponent(id)}`, '_blank', 'noopener')
  } catch {
    /* navegador bloqueou: segue na venda */
  }
}

/**
 * CONFERIR o pacote sem sair da venda: foto grande (toque abre o visor), código, rótulo e situação, peso atual,
 * compras de origem em gramas e os últimos movimentos. Celular: folha que sobe; tablet/desktop: painel à direita.
 */
export function Conferir({ item, naVenda, lateral, onFechar }: { item: Pacote; naVenda?: number; lateral: boolean; onFechar(): void }) {
  const t = useT()
  const [ver, setVer] = useState(false)
  const grama = item.unidade === 'grama'
  const { sessao } = useApp()
  // de que compra veio (e de quem): só o administrador
  const { dados: origem } = useConsulta('origemDoPacote', { itemId: item.id, gramas: item.saldo }, grama && item.saldo > 0 && sessao.perfil === 'admin')
  const q = (n: number) => (grama ? gramasTexto(n) : String(n))
  useEffect(() => {
    if (!lateral) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]') && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [lateral, onFechar])
  const titulo = <span className="font-mono">{t('Conferir')} {item.codigo ?? ''}</span>
  const conteudo = (
    <div className="space-y-4">
      <button type="button" onClick={() => item.foto && setVer(true)} aria-label={t('Ver fotos')} className={cx('block w-full', !item.foto && 'cursor-default')}>
        <Miniatura item={item} tamanho="h-56 w-full text-3xl" />
      </button>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-3xl font-black">{item.codigo ?? '—'}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="text-base">{item.nome}</div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-[var(--fundo)] p-2">
          <dt className="text-[var(--suave)]">{t('Peso atual')}</dt>
          <dd className="num text-xl font-bold">{q(item.saldo)}</dd>
        </div>
        {naVenda !== undefined && (
          <div className="rounded-xl bg-[var(--fundo)] p-2">
            <dt className="text-[var(--suave)]">{t('Nesta venda')}</dt>
            <dd className="num text-xl font-bold">{q(naVenda)}</dd>
            <dd className="text-xs text-[var(--suave)]">{item.saldo - naVenda <= 0 ? t('acaba o pacote') : t('fica no estoque: {v}', { v: q(item.saldo - naVenda) })}</dd>
          </div>
        )}
      </dl>
      <section>
        <h3 className="mb-1 text-sm font-bold">{t('Compras de origem')}</h3>
        {grama && origem?.length ? (
          <ul className="space-y-1 text-sm">
            {origem.map((o) => (
              <li key={o.compraId} className="flex justify-between gap-2 rounded-lg border border-[var(--borda)] px-2 py-1">
                <span className="min-w-0 truncate"><b className="font-mono">{o.codigo ?? '—'}</b>{o.fornecedor ? ` · ${o.fornecedor}` : ''}</span>
                <span className="num shrink-0 font-semibold">{gramasTexto(o.gramas)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--suave)]">{origemCurta(item) ?? t('Sem compra ligada.')}</p>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-bold">{t('Histórico do pacote')}</h3>
        <HistoricoPacote id={item.id} />
      </section>
    </div>
  )
  const abrir = (
    <Botao variante="secundario" className="w-full" onClick={() => abrirLoteNovaAba(item.id)}>
      {t('Abrir página do lote ↗')}
    </Botao>
  )
  return (
    <>
      {lateral ? (
        <aside role="dialog" aria-label={t('Conferir o pacote')} className="fixed inset-y-0 right-0 z-40 flex w-[26rem] max-w-full flex-col border-l border-[var(--borda)] bg-[var(--cartao)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--borda)] px-4 py-3">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <button type="button" onClick={onFechar} aria-label={t('Fechar')} className="h-10 w-10 rounded-full text-xl hover:bg-[var(--marca-suave)]">×</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{conteudo}</div>
          <div className="border-t border-[var(--borda)] p-3">{abrir}</div>
        </aside>
      ) : (
        <Janela aberta titulo={titulo} onFechar={onFechar} rodape={abrir}>
          {conteudo}
        </Janela>
      )}
      {ver && <VisorFotos itemId={item.id} onFechar={() => setVer(false)} />}
    </>
  )
}

