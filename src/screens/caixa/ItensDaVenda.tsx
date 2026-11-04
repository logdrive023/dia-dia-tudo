// NESTA VENDA — a lista do que já entrou. Uma linha só para todas as larguras (nada de tabela que espreme):
//   [foto] L-0004 🔎                     [ 2.513 g × 3,2 ]   Bs 8.041,60   ✕
//          40 cm · Normal · Castanho     [ acaba o pacote ]
//          de P-0001 · Atacado Norte
// Larga: tudo numa linha. Estreita: o pacote em cima (com a largura toda) e a conta embaixo — o texto do pacote corta
// com "…" e NUNCA passa por baixo dos botões. Toque no pacote = conferir; nas gramas = vender só uma parte.

import { formatar } from '../../core/domain/dinheiro'
import type { Id } from '../../core/domain/tipos'
import { Info, cx, gramasTexto, loc } from '../../ui/base'
import { useT } from '../../ui/i18n'
import { SeloReserva } from '../../ui/reserva'
import { Miniatura, type Vista, origemCurta } from './pecas'

export function ItensDaVenda({ vistas, onConferir, onEditar, onRemover, onPreco }: {
  vistas: Vista[]
  onConferir(itemId: Id): void
  onEditar(linhaId: Id): void
  onRemover(linhaId: Id): void
  /** preço digitado (pacote sem preço de tabela), em centavos; undefined = apagou */
  onPreco(linhaId: Id, valor?: number): void
}) {
  const t = useT()
  if (!vistas.length)
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--borda)] px-4 py-8 text-center text-[var(--suave)]">
        <div className="text-4xl" aria-hidden>🧾</div>
        <p className="mt-2 font-semibold">{t('Passe a pistola ou leia o QR do pacote.')}</p>
        <p className="text-sm">{t('O pacote entra inteiro com o preço da tabela.')}</p>
      </div>
    )
  const qtd = (l: Vista) => (l.item.unidade === 'grama' ? `${l.quantidade.toLocaleString(loc())} g` : `${l.quantidade}`)
  // sem preço de tabela/catálogo (bruto, preço digitado): só a quantidade — nada de "× Bs" vazio
  const conta = (l: Vista) => (l.preco.calculo ? `${qtd(l)} × ${l.preco.calculo.fator}` : l.item.precoSugerido && l.precoManual === undefined ? `${qtd(l)} × ${formatar(l.item.precoSugerido.valor, l.preco.moeda)}` : qtd(l))
  // o estoque mudou DEPOIS que entrou (outro aparelho vendeu/ajustou): a linha avisa e o FECHAR não deixa
  const faltou = (l: Vista) => l.quantidade > l.item.saldo
  const fica = (l: Vista) => {
    const resta = l.item.saldo - l.quantidade
    return resta <= 0 ? t('acaba o pacote') : t('fica no estoque: {v}', { v: l.item.unidade === 'grama' ? gramasTexto(resta) : resta })
  }
  return (
    <>
      <ul className="divide-y divide-[var(--borda)]">
        {vistas.map((l) => (
          <li key={l.id} className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5', faltou(l) && '-mx-2 rounded-xl bg-[var(--ruim)]/8 px-2')}>
            {/* o pacote: ocupa o que sobra e corta o texto (nunca por baixo da conta) */}
            <button type="button" aria-label={t('Conferir {c}', { c: l.item.codigo ?? l.item.nome })} title={t('Conferir o pacote')} onClick={() => onConferir(l.item.id)}
              className="flex min-w-0 flex-[1_1_15rem] items-center gap-3 rounded-xl p-1 text-left hover:bg-[var(--marca-suave)]">
              <Miniatura item={l.item} tamanho="h-14 w-14" />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-lg font-black leading-tight">{l.item.codigo ?? '—'} <span aria-hidden className="text-sm font-semibold text-[var(--marca)]">🔎</span></span>
                <span className="block truncate text-sm">{l.item.nome}</span>
                <SeloReserva i={l.item} />
                {origemCurta(l.item) && <span className="block truncate text-xs text-[var(--suave)]">{t('de')} {origemCurta(l.item)}</span>}
                {faltou(l) && <span className="block text-xs font-semibold text-[var(--ruim)]">⚠ {l.item.saldo <= 0 ? t('vendido ou baixado em outro lugar: tire da venda') : t('o peso mudou: toque nas gramas')}</span>}
              </span>
            </button>
            {/* a conta: quantidade (toque = vender só uma parte) · total · tirar */}
            <span className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <button type="button" aria-label={t('Mudar a quantidade de {c}', { c: l.item.codigo ?? l.item.nome })} onClick={() => onEditar(l.id)}
                className="num min-h-11 whitespace-nowrap rounded-xl border border-dashed border-[var(--marca)] px-3 py-1 text-right text-sm font-semibold hover:bg-[var(--marca-suave)]">
                {conta(l)}
                <span className={cx('block text-xs font-normal', faltou(l) ? 'font-semibold text-[var(--ruim)]' : l.item.saldo - l.quantidade <= 0 ? 'text-[var(--alerta)]' : 'text-[var(--suave)]')}>{faltou(l) ? (l.item.saldo <= 0 ? t('já saiu do estoque') : t('só tem {v} agora', { v: l.item.unidade === 'grama' ? gramasTexto(l.item.saldo) : l.item.saldo })) : fica(l)}</span>
              </button>
              <span className="num min-w-[6.5rem] text-right text-base font-bold">
                {l.preco.erro || l.precoManual !== undefined ? (
                  <label className="inline-flex items-center gap-1">
                    <span className="text-xs font-normal text-[var(--suave)]">{t('Preço')}</span>
                    <input inputMode="decimal" aria-label={t('Preço de {c}', { c: l.item.codigo ?? l.item.nome })} placeholder="0,00"
                      defaultValue={l.precoManual ? (l.precoManual / 100).toLocaleString(loc(), { minimumFractionDigits: 2 }) : ''}
                      onChange={(e) => { const v = Number(e.target.value.replace(/\./g, '').replace(',', '.')); onPreco(l.id, Number.isFinite(v) && v > 0 ? Math.round(v * 100) : undefined) }}
                      className="num w-28 rounded-lg border-2 border-[var(--alerta)] bg-[var(--cartao)] px-2 py-1 text-right font-bold" />
                  </label>
                ) : formatar(l.preco.total, l.preco.moeda)}
              </span>
              <button type="button" aria-label={t('Tirar {c}', { c: l.item.codigo ?? l.item.nome })} onClick={() => onRemover(l.id)} className="min-h-11 min-w-11 shrink-0 rounded-full text-xl text-[var(--ruim)] hover:bg-[var(--ruim)]/10">✕</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center text-xs text-[var(--suave)]">{t('Toque na foto para conferir o pacote · toque nas gramas para vender só uma parte.')} <Info texto="Vendeu só uma parte? Toque e digite as gramas. Ex.: 500 g do P4" /></p>
    </>
  )
}
