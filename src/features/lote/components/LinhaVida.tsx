// LINHA DA VIDA DO PACOTE: a vida do negócio (compra → triagem → etiqueta → venda) numa timeline vertical simples,
// igual no celular e no computador. Cada passo: ícone, data, o que foi e quanto (gramas) — e tocar leva ao registro
// (P-0001 abre a compra, T-0001 a triagem, V-0006 a venda, L-0025 o pacote). O "agora" fecha a linha com o saldo.
// Ex.: 🛒 P-0001 · Atacado Norte · 40 kg → ✂️ T-0001 · 40 kg → 39,3 kg → 📦 L-0002 entrou 18 kg → 🏷 impressa →
//      💰 V-0006 · Ana Paula · −1,5 kg → ✂️ separado: L-0025 3 kg (60 cm) · L-0026 1,9 kg (40 cm) → ● agora 8,258 kg.

import type { Id } from '../../../core/domain/tipos'
import type { ResultadoConsulta } from '../../../core/services/index'
import { cx, dataBR, gramasTexto } from '../../../shared/ui/base'
import { useApp } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

type Genealogia = ResultadoConsulta<'genealogia'>

interface Passo {
  quando: string
  icone: string
  cor: string
  titulo: string
  codigo?: string
  sub?: string
  g?: string
  ir?(): void
  /** pacotes que saíram (separação): cada um clicável */
  filhos?: { id: Id; codigo?: string; g: number; nome?: string }[]
}

export function LinhaDaVida({ gen, item }: { gen: Genealogia; item: { id: Id; codigo?: string; criadoEm: string; saldo: number; quantidadeInicial?: number; etiquetaImpressaEm?: string; etiquetaImpressaPor?: string } }) {
  const t = useT()
  const { ir } = useApp()
  const meu = gen.lotes.find((l) => l.id === item.id)
  const nomeDe = (id: Id) => gen.lotes.find((l) => l.id === id)?.nome
  const origem = gen.triagens.find((x) => x.saidas.some((s) => s.id === item.id))
  const destinos = gen.triagens.filter((x) => x.entradas.some((e) => e.id === item.id) && x.id !== origem?.id)
  const passos: Passo[] = []

  // de onde veio: as compras (só as que tocaram este pacote) e a triagem que o criou
  const comprasDoLote = gen.compras.filter((c) => !c.lotes?.length || c.lotes.some((l) => l.id === item.id) || !!origem)
  for (const c of comprasDoLote)
    passos.push({ quando: c.data, icone: '🛒', cor: 'var(--bom)', titulo: t('Compra'), codigo: c.codigo, sub: c.fornecedor, g: c.g ? gramasTexto(c.g) : undefined, ir: () => ir('pedido', { id: c.id }) })
  if (origem)
    passos.push({ quando: origem.em, icone: '✂️', cor: 'var(--marca)', titulo: t('Triagem'), codigo: origem.codigo, sub: origem.por, g: `${gramasTexto(origem.entradas.reduce((s, e) => s + e.g, 0))} → ${gramasTexto(origem.saidas.reduce((s, x) => s + x.g, 0))}`, ir: () => ir('triagem', { aba: 'triagens', t: origem.id }) })
  passos.push({ quando: item.criadoEm, icone: '📦', cor: 'var(--alerta)', titulo: t('Este pacote'), codigo: item.codigo, sub: t('entrou'), g: gramasTexto(item.quantidadeInicial ?? meu?.entrou ?? item.saldo) })
  if (item.etiquetaImpressaEm)
    passos.push({ quando: item.etiquetaImpressaEm, icone: '🏷', cor: 'var(--suave)', titulo: t('Etiqueta impressa'), codigo: item.codigo, sub: item.etiquetaImpressaPor, ir: () => ir('etiquetas', { f: 'todas', sel: item.id }) })

  // para onde foi: cada venda (com os gramas DESTE pacote) e cada separação (com os pacotes que saíram)
  for (const v of gen.vendas) {
    const g = v.lotes?.find((l) => l.id === item.id)?.g
    if (!g) continue
    passos.push({ quando: v.data, icone: '💰', cor: 'var(--bom)', titulo: t('Venda'), codigo: v.codigo, sub: v.cliente, g: `−${gramasTexto(g)}`, ir: () => ir('venda', { id: v.id }) })
  }
  for (const x of destinos)
    passos.push({ quando: x.em, icone: '✂️', cor: 'var(--marca)', titulo: t(x.separou ? 'Separado' : 'Juntado'), codigo: x.codigo, sub: x.por, g: `−${gramasTexto(x.entradas.find((e) => e.id === item.id)?.g ?? 0)}`, ir: () => ir('triagem', { aba: 'triagens', t: x.id }), filhos: x.saidas.map((s) => ({ id: s.id, codigo: s.codigo, g: s.g, nome: nomeDe(s.id) })) })
  passos.sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0))

  return (
    <ol aria-label={t('Linha da vida do pacote')} className="relative space-y-1">
      {passos.map((p, k) => (
        <li key={k} className="relative flex gap-3">
          {/* trilho: bolinha com o ícone + linha até o próximo */}
          <span className="relative flex w-8 shrink-0 justify-center">
            <span aria-hidden className="absolute bottom-[-0.25rem] top-0 w-0.5 bg-[var(--borda)]" />
            <span aria-hidden className="relative z-10 mt-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-[var(--cartao)] text-sm" style={{ borderColor: p.cor }}>{p.icone}</span>
          </span>
          <div className="min-w-0 flex-1 pb-2">
            <button type="button" disabled={!p.ir} onClick={p.ir} className={cx('flex w-full min-w-0 items-start justify-between gap-2 rounded-xl px-2 py-1.5 text-left', p.ir && 'hover:bg-[var(--marca-suave)]')}>
              <span className="min-w-0">
                <span className="block text-xs text-[var(--suave)]">{dataBR(p.quando)} · {p.titulo}</span>
                <span className="block truncate">
                  {p.codigo && <b className={cx('font-mono', p.ir ? 'text-[var(--marca)]' : '')}>{p.codigo}</b>}
                  {p.sub && <span className="text-sm text-[var(--suave)]">{p.codigo ? ' · ' : ''}{p.sub}</span>}
                </span>
              </span>
              {p.g && <b className="num shrink-0 whitespace-nowrap text-sm">{p.g}</b>}
            </button>
            {p.filhos && p.filhos.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1.5 px-2">
                {p.filhos.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => ir('lote', { id: f.id })} className="num inline-flex min-h-9 items-center gap-1 rounded-full border border-[var(--borda)] bg-[var(--cartao)] px-3 text-xs hover:border-[var(--marca)]">
                      📦 <b className="font-mono">{f.codigo}</b> · {gramasTexto(f.g)}{f.nome ? <span className="text-[var(--suave)]"> · {f.nome}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
      {/* agora: fecha a linha */}
      <li className="relative flex gap-3">
        <span className="flex w-8 shrink-0 justify-center"><span aria-hidden className="mt-2 h-4 w-4 rounded-full bg-[var(--marca)]" /></span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1">
          <b className="text-sm">{t('Agora')}</b>
          <b className="num whitespace-nowrap">{item.saldo > 0 ? `${gramasTexto(item.saldo)} ${t('em estoque')}` : t('nada em estoque')}</b>
        </span>
      </li>
    </ol>
  )
}
