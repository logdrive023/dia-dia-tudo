// CÁLCULOS DO PAINEL (puros, sem tela): o que a tela mostra sai daqui, não de dentro do JSX. Trocar a origem dos dados
// (aparelho → API) não mexe nestas contas.
import { dataCurta as dm, diasEntre, somarDias } from '../../core/domain/datas'
import type { ResultadoConsulta } from '../../core/services'
import type { Alerta } from '../../core/services/painel'

/** Variação inteira em % contra o período anterior; sem base comparável (sem anterior, ou anterior ≤ 0) → undefined. */
export function variacaoPct(atual: number, anterior?: number) {
  if (anterior === undefined || anterior <= 0) return undefined
  return Math.round(((atual - anterior) / anterior) * 100)
}

/** "01/10 – 30/10 · vs. 01/09 – 30/09" (o período e, comparando, o anterior do mesmo tamanho). `vs` já traduzido. */
export function textoPeriodo(de: string, ate: string, comparar: boolean, vs: string) {
  const nDias = diasEntre(de, ate) + 1
  return `${de === ate ? dm(de) : `${dm(de)} – ${dm(ate)}`}${comparar ? ` · ${vs} ${dm(somarDias(de, -nDias))} – ${dm(somarDias(de, -1))}` : ''}`
}

/** Soma das quantidades de um nível de alerta. */
export function somaAlertas(alertas: Alerta[], nivel: Alerta['nivel']) {
  return alertas.filter((a) => a.nivel === nivel).reduce((s, a) => s + a.quantidade, 0)
}

type LinhaViagem = NonNullable<ResultadoConsulta<'viagens'>>['linhas'][number]

/**
 * As viagens de compra que tocam o período (as abertas sempre entram) e os totais delas: gasto da logística, custo do
 * cabelo, gramas, resultado e o ROI médio (basis points) das que têm ROI.
 */
export function resumoViagens(linhas: LinhaViagem[], de: string, ate: string) {
  const doPeriodo = linhas.filter((v) => v.status === 'aberta' || (v.inicio <= ate && (v.fim ?? v.inicio) >= de))
  const abertas = doPeriodo.filter((v) => v.status === 'aberta')
  const gasto = doPeriodo.reduce((s, v) => s + v.gasto, 0)
  const cabelo = doPeriodo.reduce((s, v) => s + v.custoCabelo, 0)
  const gramas = doPeriodo.reduce((s, v) => s + v.gramas, 0)
  const resultado = doPeriodo.reduce((s, v) => s + v.resultado, 0)
  const comRoi = doPeriodo.filter((v) => v.roiBp !== undefined)
  const roiBp = comRoi.length ? Math.round(comRoi.reduce((s, v) => s + (v.roiBp ?? 0), 0) / comRoi.length) : undefined
  return {
    abertas,
    gasto,
    resultado,
    roiBp,
    /** (cabelo + gastos) ÷ kg comprados; sem gramas → undefined */
    custoKgReal: gramas ? Math.round(((cabelo + gasto) * 1000) / gramas) : undefined,
    /** gastos ÷ kg comprados; sem gramas → undefined */
    logisticaKg: gramas ? Math.round((gasto * 1000) / gramas) : undefined,
  }
}

/**
 * "12,5%" de basis points (1 casa); sem valor → "—". ⚠ Formata no idioma do NAVEGADOR, como o Painel sempre fez —
 * diferente de `pctBp` (ui/base), que usa o idioma escolhido no app. Mantido separado para não mudar o que aparece.
 */
export const pctBpNavegador = (bp?: number) => (bp === undefined ? '—' : `${(bp / 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`)
