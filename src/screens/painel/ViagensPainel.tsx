// VIAGENS DE COMPRA NO PAINEL — o custo da logística em destaque, as viagens abertas com o orçamento e, na aba Viagens,
// o comparativo por viajante. As contas vêm de `resumoViagens` (calculos.ts).
import { formatar } from '../../core/domain/dinheiro'
import { BarraLimite } from '../../ui/barras'
import { Cartao, Info, Pilula, Vazio, cx } from '../../ui/base'
import { CodigoTexto } from '../../ui/codigos'
import { useApp, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { pctBpNavegador, resumoViagens } from './calculos'
import { Secao } from './Secao'

/** `completo`: aba Viagens (aberta, com o comparativo e o "nenhuma viagem"); na visão geral só aparece se houver viagem. */
export function ViagensPainel({ de, ate, completo }: { de: string; ate: string; completo?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const { dados } = useConsulta('viagens', {})
  if (!dados) return null
  if (!dados.linhas.length && !completo) return null
  const m = dados.moeda
  const r = resumoViagens(dados.linhas, de, ate)
  const cartoes: { nome: string; valor: string; ajuda: string; cor?: string; destaque?: boolean }[] = [
    { nome: 'Gasto das viagens', valor: formatar(r.gasto, m), ajuda: 'Logística das viagens do período: combustível, hospedagem, comida… (não inclui o cabelo).', destaque: true },
    { nome: 'Custo/kg real', valor: r.custoKgReal !== undefined ? formatar(r.custoKgReal, m) : '—', ajuda: '(Cabelo + gastos da viagem) ÷ kg comprados. Ex.: (14.000 + 800) ÷ 4 kg = Bs 3.700/kg.', destaque: true },
    { nome: 'Logística por kg', valor: r.logisticaKg !== undefined ? formatar(r.logisticaKg, m) : '—', ajuda: 'Quanto a viagem somou em cada kg comprado.' },
    { nome: 'Resultado', valor: formatar(r.resultado, m), ajuda: 'Receita do cabelo das viagens − (cabelo + gastos). Enquanto há estoque tende a ser negativo.', cor: r.resultado < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]' },
    { nome: 'ROI médio', valor: pctBpNavegador(r.roiBp), ajuda: 'Média do retorno das viagens com compra.' },
    { nome: 'Abertas', valor: String(r.abertas.length), ajuda: 'Viagens em andamento.' },
  ]
  return (
    <Secao id="viagens" titulo={`✈️ ${t('Viagens de compra')}`} fechadaPadrao={!completo} resumo={`${t('Gasto das viagens')}: ${formatar(r.gasto, m)}`} acao={<button type="button" onClick={() => ir('viagens')} className="min-h-10 rounded-xl px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Abrir')} →</button>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map((c) => (
          <button key={c.nome} type="button" onClick={() => ir('viagens')} className={cx('rounded-2xl border bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]', c.destaque ? 'border-[var(--alerta)]' : 'border-[var(--borda)]')}>
            <div className="flex items-center text-xs font-semibold text-[var(--suave)]">{t(c.nome)}<Info texto={c.ajuda} /></div>
            <div className={cx('num mt-1 text-xl font-bold', c.cor)}>{c.valor}</div>
          </button>
        ))}
      </div>
      {r.abertas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {r.abertas.map((v) => {
            const usado = v.orcamento ? Math.min(100, Math.round((v.gasto / v.orcamento) * 100)) : undefined
            return (
              <li key={v.id}>
                <button type="button" onClick={() => ir('viagem', { id: v.id })} className="w-full rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 text-left hover:border-[var(--marca)]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold"><CodigoTexto codigo={v.codigo} className="text-xs" /> {v.nome} {v.acimaOrcamento && <Pilula tom="ruim" className="ml-1">{t('Acima do orçamento')}</Pilula>}</span>
                    <span className="num text-sm"><b>{formatar(v.gasto, m)}</b>{v.orcamento ? <span className="text-[var(--suave)]"> / {formatar(v.orcamento, m)}</span> : null}</span>
                  </div>
                  <div className="text-xs text-[var(--suave)]">{v.viajantes.map((x) => x.nome).join(', ')} · {v.gramas ? `${(v.gramas / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : t('sem compra ainda')}</div>
                  {usado !== undefined && <BarraLimite className="mt-2" altura="h-2" usado={v.gasto} previsto={v.orcamento} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {completo && dados.comparativo.length > 0 && (
        <Cartao titulo={t('Por viajante')} className="mt-3">
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {dados.comparativo.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold">{c.nome} <span className="font-normal text-[var(--suave)]">· {t('{n} viagem(ns)', { n: c.viagens })}</span></span>
                <span className="num">{t('Custo/kg real')}: <b>{c.custoKgReal !== undefined ? formatar(c.custoKgReal, m) : '—'}</b> · ROI {pctBpNavegador(c.roiMedioBp)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
      {completo && !dados.linhas.length && <Vazio compacto texto="Nenhuma viagem por aqui." />}
    </Secao>
  )
}
