// O RASCUNHO DO GERADOR: cada controle muda só este estado, e a prévia lê dele (nada é salvo enquanto a pessoa testa).
// "Salvar e publicar" grava; "Desfazer" volta ao publicado; sair da tela com rascunho pergunta antes.
import { useState } from 'react'
import { APARENCIA_PADRAO, type AparenciaVitrine, type ConfigVitrine } from '../../../core/services/vitrine'
import { useAvisoSaida } from '../../../shared/ui/contexto'

export interface RascunhoVitrine {
  nome: string
  descricao: string
  whatsapp: string
  aparencia: AparenciaVitrine
}

/** para comparar: mesma ordem e sem diferença de vazio × ausente */
const chave = (r: RascunhoVitrine) => JSON.stringify([r.nome.trim(), r.descricao.trim(), r.whatsapp.trim(), r.aparencia.slogan?.trim() ?? '', r.aparencia.banner ?? '', r.aparencia.corPrimaria.toLowerCase(), r.aparencia.corSecundaria.toLowerCase(), r.aparencia.fundo])

export function useRascunhoVitrine(publicado: ConfigVitrine) {
  const base: RascunhoVitrine = { nome: publicado.nome ?? '', descricao: publicado.descricao ?? '', whatsapp: publicado.whatsapp ?? '', aparencia: { ...APARENCIA_PADRAO, ...publicado.aparencia } }
  const [editado, setEditado] = useState<RascunhoVitrine>()
  const rascunho = editado ?? base
  const sujo = !!editado && chave(editado) !== chave(base)
  useAvisoSaida(sujo)
  return {
    rascunho,
    sujo,
    mudar: (p: Partial<Omit<RascunhoVitrine, 'aparencia'>>) => setEditado({ ...rascunho, ...p }),
    mudarAparencia: (p: Partial<AparenciaVitrine>) => setEditado({ ...rascunho, aparencia: { ...rascunho.aparencia, ...p } }),
    desfazer: () => setEditado(undefined),
  }
}
