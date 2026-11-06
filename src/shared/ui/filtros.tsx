// Filtro de período e afins (o último usado fica lembrado no aparelho).

import { useEffect, useState } from 'react'
import { dataLocal, inicioDoMes, somarDias, somarMeses, fimDoMes } from '../../core/domain/datas'

export type Preset = 'hoje' | '7d' | '30d' | 'mes' | 'mesPassado' | 'ano' | 'livre'

export interface Periodo {
  preset: Preset
  de: string
  ate: string
}

export function calcularPeriodo(p: Preset, de?: string, ate?: string): Periodo {
  const hoje = dataLocal()
  switch (p) {
    case 'hoje':
      return { preset: p, de: hoje, ate: hoje }
    case '7d':
      return { preset: p, de: somarDias(hoje, -6), ate: hoje }
    case '30d':
      return { preset: p, de: somarDias(hoje, -29), ate: hoje }
    case 'mes':
      return { preset: p, de: inicioDoMes(hoje), ate: hoje }
    case 'mesPassado': {
      const ini = somarMeses(inicioDoMes(hoje), -1)
      return { preset: p, de: ini, ate: fimDoMes(ini) }
    }
    case 'ano':
      return { preset: p, de: hoje.slice(0, 4) + '-01-01', ate: hoje }
    default:
      return { preset: 'livre', de: de ?? somarDias(hoje, -29), ate: ate ?? hoje }
  }
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch {
    return padrao
  }
}

/** Estado lembrado no aparelho (só conveniência: se não der para guardar, funciona igual). */
export function useLembrado<T>(chave: string, padrao: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => ler(`tudo.${chave}`, padrao))
  useEffect(() => {
    try {
      localStorage.setItem(`tudo.${chave}`, JSON.stringify(v))
    } catch {
      /* ignora */
    }
  }, [chave, v])
  return [v, setV]
}

export function usePeriodo(chave = 'periodo', padrao: Preset = '30d') {
  const [salvo, setSalvo] = useLembrado<{ preset: Preset; de?: string; ate?: string }>(chave, { preset: padrao })
  const periodo = calcularPeriodo(salvo.preset, salvo.de, salvo.ate)
  return [periodo, (p: Periodo) => setSalvo({ preset: p.preset, de: p.de, ate: p.ate })] as const
}
