// ITENS DA COMPRA (CartaoSecao): uma linha por item — o que é e a conta à esquerda, peso (destaque) e valor à direita;
// "⚖ Corrigir peso" e "✎ Corrigir valor" pequenos na própria linha; a explicação no ⓘ do título.
// O total só aparece (no título) quando há mais de um item — com um só, a linha já é o total (nada repetido).
import { formatar } from '../../core/domain/dinheiro'
import type { Linha } from '../../core/domain/tipos'
import { Pilula, cx, dataBR, gramasTexto } from '../../ui/base'
import { CartaoSecao } from '../../ui/cartaoSecao'
import { useT } from '../../ui/i18n'
import type { DadosPedido } from './pecas'

const botaoLeve = 'inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-semibold hover:bg-[var(--marca-suave)]'

export function ItensCompra({ dados, admin, cancelada, onConferir, onAjustarValor }: { dados: DadosPedido; admin: boolean; cancelada: boolean; onConferir(l: Linha): void; onAjustarValor?(l: Linha): void }) {
  const t = useT()
  const c = dados.compra
  const m = c.moedaPrincipal
  const loteDaLinha = (l: Linha) => dados.lotes.find((x) => x.daCompra && x.linhaId === l.id)
  const corrige = admin && !cancelada
  return (
    <CartaoSecao icone="🧺" titulo="Itens" conta={c.linhas.length}
      ajuda={corrige ? 'Errou? Corrija na linha: ⚖ peso (pesou diferente na chegada) e ✎ valor (vale mesmo depois de pagar ou separar: o custo dos pacotes acompanha).' : undefined}
      exemplo={corrige ? 'Ex.: comprou 10.000 g e pesou 9.850 g → ⚖ Corrigir peso lança 150 g de diferença.' : undefined}
      direita={c.linhas.length > 1 ? <span className="num whitespace-nowrap text-sm"><b>{gramasTexto(dados.gramas)}</b> <span className="text-[var(--suave)]">·</span> <b>{formatar(c.totalPrincipal, m)}</b></span> : undefined}>
      <ul className="divide-y divide-[var(--borda)] border-t border-[var(--borda)]">
        {c.linhas.map((l) => {
          const lote = loteDaLinha(l)
          const confs = dados.conferencias.filter((x) => x.itemId === lote?.id)
          const porKg = l.quantidade ? Math.round((l.totalPrincipal ?? l.total) * 1000 / l.quantidade) : 0
          const conta = l.campos.calculo ? String(l.campos.calculo).split(' = ')[0] : ''
          const semValor = l.campos.semValor && !l.totalPrincipal
          return (
            <li key={l.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <span className="linha-texto">
                  <b className="block break-words leading-snug">{l.descricao}</b>
                  <span className="num block text-xs text-[var(--suave)]">{[conta, porKg ? `${formatar(porKg, m)}/kg` : ''].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <span className="ml-auto shrink-0 text-right">
                  <b className="num block whitespace-nowrap text-lg leading-tight">{gramasTexto(l.quantidade)}</b>
                  {semValor ? <Pilula tom="alerta">{t('sem valor')}</Pilula> : <span className="num block whitespace-nowrap text-sm text-[var(--suave)]">{formatar(l.total, l.moeda)}</span>}
                  {!!l.campos.jaPaga && <Pilula tom="bom">✓ {t('paga')}</Pilula>}
                </span>
              </div>
              {confs.map((x) => (
                <p key={x.id} className={cx('num mt-2 rounded-lg px-2 py-1 text-xs', x.delta < 0 ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : 'bg-[var(--bom)]/10 text-[var(--bom)]')}>⚖ {dataBR(x.data)} · {x.descricao}</p>
              ))}
              {corrige && (lote || onAjustarValor) && (
                <div className="-mb-1 -ml-2 mt-1 flex flex-wrap gap-1">
                  {lote && <button type="button" onClick={() => onConferir(l)} title={t('Pesou na chegada e deu diferente? Ex.: comprou 10.000 g, pesou 9.850 g → 150 g de diferença.')} className={cx(botaoLeve, 'text-[var(--marca)]')}>⚖ {t('Corrigir peso')}</button>}
                  {onAjustarValor && <button type="button" onClick={() => onAjustarValor(l)} title={t('Ex.: combinou Bs 9.500 em vez de 10.000. Vale mesmo depois de pagar ou separar.')} className={cx(botaoLeve, l.total ? 'text-[var(--marca)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>✎ {t(l.total ? 'Corrigir valor' : 'Pôr o valor')}</button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </CartaoSecao>
  )
}
