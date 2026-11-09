// VER O CAIXA NUMA MOEDA SÓ: a moeda escolhida e as cotações digitadas ficam no aparelho e são só para ver (nenhum
// lançamento muda). Soma as contas de todas as moedas na moeda da visão.
import { useState } from 'react'
import { formatar, type TabelaCotacoes, valorDeUm } from '../../../core/domain/dinheiro'
import type { ContaMoeda } from '../../../core/services/caixa'
import { moedaPadrao } from '../../../shared/ui/base'
import { conv, cotacaoTexto, useCotacoes } from '../../../shared/ui/compartilhados'
import { CHAVE_COT, CHAVE_VER, gravarLocal, lerLocal, tabelaDaVisao } from '../model/caixaDia'

export function useVisaoCaixa(contas: ContaMoeda[], cot: TabelaCotacoes) {
  const { cfg } = useCotacoes()
  const principal = cfg?.moedaPrincipal ?? moedaPadrao()
  const moedasVer = [principal, ...(cfg?.moedasAtivas ?? []).filter((m) => m !== principal)]
  const [verEscolhida, setVerEscolhida] = useState<string>(() => lerLocal(CHAVE_VER, principal))
  const [digitadas, setDigitadas] = useState<Record<string, string>>(() => lerLocal(CHAVE_COT, {}))
  const ver = moedasVer.includes(verEscolhida) ? verEscolhida : principal
  const sistema = (m: string) => {
    const v = valorDeUm(m, principal, cot)
    return v ? cotacaoTexto(v) : ''
  }
  const gravar = (novo: Record<string, string>) => (setDigitadas(novo), gravarLocal(CHAVE_COT, novo))
  // moedas que entram na conta: as que têm movimento + a da visão
  const envolvidas = [...new Set([...contas.map((c) => c.moeda), ver])].filter((m) => m !== principal)
  const textos: Record<string, string> = {}
  for (const m of envolvidas) textos[m] = digitadas[m] ?? sistema(m)
  const tab = tabelaDaVisao(principal, textos)
  const converter = (v: number, moeda: string) => conv(v, moeda, ver, tab)
  /** soma de todas as moedas na moeda da visão (undefined = falta cotação) */
  const somar = (f: (c: ContaMoeda) => number) => {
    let s = 0
    for (const c of contas) {
      const v = converter(f(c), c.moeda)
      if (v === undefined) return undefined
      s += v
    }
    return s
  }
  return {
    principal, moedasVer, ver, envolvidas, textos, digitadas, sistema, converter, somar,
    mostrar: (v: number | undefined) => (v === undefined ? '—' : formatar(v, ver)),
    escolher: (m: string) => (setVerEscolhida(m), gravarLocal(CHAVE_VER, m)),
    digitar: (m: string, x: string) => gravar({ ...digitadas, [m]: x }),
    voltarSistema: (m: string) => {
      const novo = { ...digitadas }
      delete novo[m]
      gravar(novo)
    },
  }
}

export type VisaoCaixa = ReturnType<typeof useVisaoCaixa>
