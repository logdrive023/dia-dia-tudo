// AS SEÇÕES SECUNDÁRIAS DO PAINEL (abrem e fecham): resultado e impostos, evolução, dinheiro, de onde vem e as áreas.
// Cada uma recebe os dados prontos por props e só apresenta; a origem (aparelho ou API) fica no usePainel.
import { formatar } from '../../../core/domain/dinheiro'
import type { Cartao as CartaoDados } from '../../../core/modulos'
import type { ResultadoConsulta } from '../../../core/services'
import { Cartao, fmt } from '../../../shared/ui/base'
import { Barras, Linha, SecaoView } from '../../../shared/ui/graficos'
import { useT } from '../../../shared/ui/i18n'
import { NumeroGrande } from '../../../shared/ui/numeroGrande'
import { NumeroPainel } from './NumeroPainel'
import { Secao } from './Secao'

export type DadosPainel = NonNullable<ResultadoConsulta<'painel'>>
type Relatorio = NonNullable<ResultadoConsulta<'relatorioContabil'>>
export type VisaoImposto = 'antes' | 'depois'

/** Rendimento antes e depois dos impostos estimados (Configurações › Fiscal); tocar escolhe a visão. */
export function ResultadoImpostos({ rel, visao, onVisao, onAbrirEstados }: { rel: Relatorio; visao: VisaoImposto; onVisao(v: VisaoImposto): void; onAbrirEstados(): void }) {
  const t = useT()
  const bruto = rel.numeros.resultado + rel.numeros.impostos
  return (
    <Secao id="impostos" fechadaPadrao titulo="Resultado e impostos" subtitulo="Estimativa do período (todas as unidades, moeda principal), pela lista de impostos de Configurações › Fiscal." resumo={`${visao === 'antes' ? t('antes dos impostos') : t('depois dos impostos')} ${fmt(visao === 'antes' ? bruto : rel.numeros.resultado, 'dinheiro', rel.moeda)}`}>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
        <NumeroGrande rotulo="Rendimento bruto (antes dos impostos)" icone="💼" cor="var(--marca)" ativo={visao === 'antes'} onClick={() => onVisao('antes')} valor={fmt(bruto, 'dinheiro', rel.moeda)} />
        <NumeroGrande rotulo="Impostos estimados" icone="🧾" cor="var(--alerta)" colorirValor valor={fmt(rel.numeros.impostos, 'dinheiro', rel.moeda)} selos={[{ texto: rel.regimeNome }]} onClick={onAbrirEstados} />
        <NumeroGrande rotulo="Rendimento líquido (depois dos impostos)" icone="🏁" cor={rel.numeros.resultado < 0 ? 'var(--ruim)' : 'var(--bom)'} colorirValor ativo={visao === 'depois'} onClick={() => onVisao('depois')} valor={fmt(rel.numeros.resultado, 'dinheiro', rel.moeda)} />
      </div>
    </Secao>
  )
}

/** Faturamento por dia; a linha clara é o período anterior. */
export function EvolucaoPainel({ p }: { p: DadosPainel }) {
  return (
    <Secao id="evolucao" titulo="Evolução no período" subtitulo="Faturamento por dia; a linha clara é o período anterior." fechadaPadrao>
      <Cartao>
        <Linha serie={p.serie} anterior={p.serieAnterior} formato="dinheiro" moeda={p.moedaVis} />
      </Cartao>
    </Secao>
  )
}

/** A receber, a pagar (e o caixa fora do cabelo) e o caixa em cada moeda — não depende do período. */
export function DinheiroPainel({ p, cartao, mostrarCaixa }: { p: DadosPainel; cartao(id: string): CartaoDados | undefined; mostrarCaixa: boolean }) {
  const t = useT()
  const valor = (id: string) => { const c = cartao(id); return c ? fmt(c.valor, c.formato, c.moeda) : '' }
  return (
    <Secao id="dinheiro" titulo="Dinheiro" subtitulo="O que falta receber ou pagar e o caixa em cada moeda (não depende do período)." resumo={`${t('a receber')} ${valor('receber')} · ${t('a pagar')} ${valor('pagar')}`} fechadaPadrao>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[1fr_1fr_1fr_1.3fr]">
        {mostrarCaixa && <NumeroPainel c={cartao('caixa')} icone="💵" />}
        <NumeroPainel c={cartao('receber')} icone="⬇️" />
        <NumeroPainel c={cartao('pagar')} icone="⬆️" />
        <Cartao className="col-span-2 lg:col-span-1" titulo={t('Por moeda')} ajuda="Dinheiro na mão (efectivo) e no banco (QR, Pix, cartão), em cada moeda.">
          <ul className="space-y-2 text-sm">
            {p.caixa.map((m) => (
              <li key={m.moeda} className="flex items-center justify-between gap-2">
                <span className="shrink-0 font-semibold">{m.moeda}</span>
                <span className="num text-right">
                  <b>{formatar(m.total, m.moeda)}</b>
                  <span className="block text-xs text-[var(--suave)]">{t('Mão')} {formatar(m.mao, m.moeda)} · {t('banco')} {formatar(m.banco, m.moeda)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </Secao>
  )
}

/** Por área (tocar abre a área), por forma de pagamento (tocar abre as vendas) e por moeda recebida. */
export function DeOndeVem({ p, principal, onArea, onForma }: { p: DadosPainel; principal: string; onArea(id: string): void; onForma(id: string): void }) {
  const t = useT()
  return (
    <Secao id="divisoes" titulo="De onde vem o dinheiro" subtitulo="Por área, forma de pagamento e moeda." fechadaPadrao>
      <div className="grid gap-3 md:grid-cols-3">
        <Cartao titulo={t('Por área')}>
          <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porArea.map((a) => ({ rotulo: `${a.icone} ${t(a.nome)}`, valor: a.valor, onClick: () => onArea(a.id) }))} />
        </Cartao>
        <Cartao titulo={t('Por forma de pagamento')}>
          <Barras formato="dinheiro" moeda={p.moedaVis} itens={p.porForma.map((f) => ({ rotulo: t(f.nome), valor: f.valor, onClick: () => onForma(f.id) }))} />
        </Cartao>
        <Cartao titulo={t('Por moeda recebida')} ajuda="Quanto entrou em cada moeda e quanto isso vale convertido.">
          <ul className="space-y-1 text-sm">
            {p.porMoeda.map((m) => (
              <li key={m.moeda} className="flex justify-between border-b border-[var(--borda)] py-1 last:border-0">
                <span className="num">{formatar(m.valor, m.moeda)}</span>
                <span className="num text-[var(--suave)]">≈ {formatar(m.principal, principal)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </Secao>
  )
}

/** Uma seção por área (módulo) com as seções que o módulo monta; na visão geral começam fechadas. */
export function AreasPainel({ p, principal, fechadas }: { p: DadosPainel; principal: string; fechadas: boolean }) {
  const t = useT()
  return (
    <>
      {p.areas.map((a) => (
        <Secao key={a.id} id={`area-${a.id}`} titulo={`${a.icone} ${t(a.nome)}`} fechadaPadrao={fechadas}>
          <div className="grid gap-3 lg:grid-cols-2">
            {a.secoes.map((s, i) => (
              <div key={i} className={s.tipo === 'cartoes' ? 'lg:col-span-2' : ''}>
                <SecaoView s={s} moeda={principal} />
              </div>
            ))}
          </div>
        </Secao>
      ))}
    </>
  )
}
