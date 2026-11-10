// RELATÓRIOS › O PADRÃO "RESUMO → DETALHE" (como o Painel): bater o olho e entender; querendo, abrir mais e mais.
//   EmResumo         a frase do que aconteceu no período + os fatos que mais pesaram (camada 1)
//   CascataResultado "para onde foi o dinheiro": das vendas ao que sobrou, uma barra por etapa; cada grupo de saídas
//                    abre no toque com as contas, e "ver ›" leva ao anexo com cada centavo (camadas 3 e 4)
//   BlocoRelatorio   uma parte do relatório que abre no lugar, com o RESUMO no próprio título (ex.: "Activo 418.540 ·
//                    Pasivo 60.239") — fechada já informa; aberta mostra tudo
// (os números grandes, camada 2, são o GrupoNumeros/NumeroGrande de sempre)
import { type ReactNode, useState } from 'react'
import { cx } from '../../../shared/ui/base'
import { useT } from '../../../shared/ui/i18n'
import { type Anexo, type Cascata, type ContaCascata, larguraBarra } from '../model/cascata'

export function EmResumo({ frase, fatos, tom }: { frase: ReactNode; fatos?: ReactNode[]; tom?: 'bom' | 'ruim' | 'alerta' }) {
  const t = useT()
  const cor = tom === 'ruim' ? 'var(--ruim)' : tom === 'alerta' ? 'var(--alerta)' : tom === 'bom' ? 'var(--bom)' : 'var(--marca)'
  return (
    <section aria-label={t('Em resumo')} className="relative overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 pl-5 shadow-sm">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: cor }} />
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">💡 {t('Em resumo')}</p>
      <p className="mt-1 text-base leading-relaxed sm:text-lg">{frase}</p>
      {!!fatos?.filter(Boolean).length && <div className="mt-2 flex flex-wrap gap-1.5">{fatos.filter(Boolean).map((f, k) => <span key={k} className="num rounded-full bg-[var(--fundo)] px-2.5 py-1 text-xs font-semibold">{f}</span>)}</div>}
    </section>
  )
}

/** a barra de uma etapa (a largura é proporcional às vendas) */
function Barra({ pct, cor, fina }: { pct: number; cor: string; fina?: boolean }) {
  return (
    <span aria-hidden className={cx('block overflow-hidden rounded-full bg-[var(--fundo)]', fina ? 'h-1.5' : 'h-2.5')}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(pct, pct ? 2 : 0)}%`, background: cor }} />
    </span>
  )
}

function LinhaConta({ c, base, v, onAnexo }: { c: ContaCascata; base: number; v(n: number): string; onAnexo?(a: Anexo): void }) {
  const t = useT()
  return (
    <li className="space-y-1 py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0">
          {t(c.rotulo)}
          {c.conta && <span className="ml-1.5 text-[11px] text-[var(--suave)]">{c.conta}</span>}
          {onAnexo && c.anexo && <button type="button" onClick={() => onAnexo(c.anexo!)} className="alvo-amplo nao-imprimir ml-2 rounded px-1 text-[11px] font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('ver')} ›</button>}
        </span>
        <span className={cx('num shrink-0 whitespace-nowrap font-semibold', c.valor < 0 && 'text-[var(--ruim)]')}>{v(c.valor)}</span>
      </div>
      <Barra fina pct={larguraBarra(c.valor, base)} cor={c.valor < 0 ? 'color-mix(in srgb, var(--ruim) 55%, transparent)' : 'color-mix(in srgb, var(--bom) 55%, transparent)'} />
    </li>
  )
}

/** "PARA ONDE FOI O DINHEIRO": começo → (saídas) → marco → … → o que sobrou */
export function CascataResultado({ cascata, v, onAnexo, titulo = 'Para onde foi o dinheiro', sub }: { cascata: Cascata; v(n: number): string; onAnexo?(a: Anexo): void; titulo?: string; sub?: string }) {
  const t = useT()
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  const base = Math.max(cascata.inicio.valor, 0)
  const alternar = (k: number) => setAbertos((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n })
  return (
    <section aria-label={t(titulo)} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--borda)] px-4 py-3">
        <b>🌊 {t(titulo)}</b>
        <span className="text-xs text-[var(--suave)]">{sub ?? t('Toque num grupo para ver as contas')}</span>
      </div>
      <ol className="px-4 py-2">
        {/* o começo: as vendas */}
        <li className="space-y-1.5 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <b className="min-w-0">{t(cascata.inicio.rotulo)}{onAnexo && cascata.inicio.anexo && <button type="button" onClick={() => onAnexo(cascata.inicio.anexo!)} className="alvo-amplo nao-imprimir ml-2 rounded px-1 text-[11px] font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('ver')} ›</button>}</b>
            <b className="num shrink-0 whitespace-nowrap text-lg">{v(cascata.inicio.valor)}</b>
          </div>
          <Barra pct={100} cor="var(--marca)" />
        </li>
        {cascata.etapas.map((e, k) => {
          const aberto = abertos.has(k)
          const comMovimento = e.contas.filter((c) => c.valor !== 0)
          const nomes = (comMovimento.length ? comMovimento : e.contas).map((c) => t(c.rotulo))
          return (
            <li key={k} className="py-1">
              {/* o grupo: o que saiu (ou entrou) entre um marco e outro — abre com as contas */}
              {e.contas.length > 0 && (
                <div className="ml-3 border-l-2 border-dashed border-[var(--borda)] pl-3">
                  <button type="button" aria-expanded={aberto} onClick={() => alternar(k)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition hover:bg-[var(--fundo)] active:bg-[var(--fundo)]">
                    <span aria-hidden className={cx('text-xs text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>▸</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--suave)]">{e.variacao <= 0 ? t('Saiu') : t('Entrou')}: {nomes.slice(0, 3).join(' · ')}{nomes.length > 3 ? ` +${nomes.length - 3}` : ''}</span>
                    <span className={cx('num shrink-0 whitespace-nowrap font-semibold', e.variacao < 0 ? 'text-[var(--ruim)]' : e.variacao > 0 ? 'text-[var(--bom)]' : 'text-[var(--suave)]')}>{e.variacao > 0 ? '+' : ''}{v(e.variacao)}</span>
                  </button>
                  {aberto && <ul className="divide-y divide-[var(--borda)] px-2 pb-1">{e.contas.map((c) => <LinhaConta key={c.id} c={c} base={base} v={v} onAnexo={onAnexo} />)}</ul>}
                </div>
              )}
              {/* o marco: quanto sobrou até aqui */}
              <div className={cx('space-y-1.5 py-2', e.marco.final && 'mt-1 rounded-xl bg-[var(--fundo)] px-3 py-3')}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cx('min-w-0', e.marco.final ? 'text-base font-black' : 'font-bold')}>{e.marco.final ? '🏁 ' : '= '}{t(e.marco.rotulo)}</span>
                  <span className={cx('num shrink-0 whitespace-nowrap', e.marco.final ? 'text-xl font-black' : 'font-bold', e.marco.valor < 0 && 'text-[var(--ruim)]', e.marco.final && e.marco.valor >= 0 && 'text-[var(--bom)]')}>{v(e.marco.valor)}</span>
                </div>
                <Barra pct={larguraBarra(e.marco.valor, base)} cor={e.marco.valor < 0 ? 'var(--ruim)' : e.marco.final ? 'var(--bom)' : 'color-mix(in srgb, var(--marca) 60%, var(--bom))'} />
                {e.marco.valor < 0 && base > 0 && <p className="text-[11px] text-[var(--suave)]">{t('Negativo: saiu mais do que entrou (a barra mostra o tamanho do buraco perto das vendas).')}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** UMA PARTE DO RELATÓRIO que abre no lugar: fechada já diz o principal no título */
export function BlocoRelatorio({ id, icone, titulo, resumo, aberto, onAlternar, children }: { id?: string; icone: string; titulo: string; resumo?: ReactNode; aberto: boolean; onAlternar(): void; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <button type="button" aria-expanded={aberto} onClick={onAlternar} className="flex min-h-14 w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2 text-left transition hover:bg-[var(--fundo)]">
        <span aria-hidden>{icone}</span>
        <span className="min-w-0 flex-1 font-semibold">{titulo}</span>
        {resumo && <span className="num order-last w-full truncate pl-7 text-xs text-[var(--suave)] sm:order-none sm:w-auto sm:pl-0 sm:text-sm">{resumo}</span>}
        <span aria-hidden className={cx('text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
      </button>
      {aberto && <div className="border-t border-[var(--borda)] p-3 sm:p-4">{children}</div>}
    </div>
  )
}
