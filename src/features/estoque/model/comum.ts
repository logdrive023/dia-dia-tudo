// ESTOQUE — o que a lista do estoque e a ficha do lote usam juntas: a linha da consulta, "é bruto?" e os campos do
// módulo (usado também por Etiquetas e Triagem).
import { useMemo } from 'react'
import type { CampoDef } from '../../../core/modulos'
import type { ResultadoConsulta } from '../../../core/services'
import { useConsulta } from '../../../shared/ui/contexto'


export type Linha = ResultadoConsulta<'estoque'>[number]

/** ainda precisa separar: bruto, em preparação ou "não identificado" (ficou para depois numa separação) */
export const ehBruto = (s: string) => s === 'bruto' || s === 'preparando' || s === 'naoIdentificado'

/** atributos de todos os tipos com estoque do módulo (os do código + os criados em Configurações › Atributos) */
export function useCamposModulo(moduloId: string, tipoItem?: string): CampoDef[] {
  const { dados: cfg } = useConsulta('configuracoes', {})
  return useMemo(() => {
    const tipos = cfg?.modulos.find((m) => m.id === moduloId)?.tiposItem.filter((x) => (tipoItem ? x.id === tipoItem : x.controlaEstoque)) ?? []
    const vistos = new Map<string, CampoDef>()
    for (const c of tipos.flatMap((x) => x.campos)) if (!vistos.has(c.id)) vistos.set(c.id, c)
    return [...vistos.values()]
  }, [cfg, moduloId, tipoItem])
}
