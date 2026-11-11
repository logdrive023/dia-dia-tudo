// O que o servidor Go precisa saber do SISTEMA (não da empresa): configuração padrão, impostos padrão e módulos.
// Exportado por scripts/exportar-padroes.ts para api-contract/padroes.json (e a cópia do servidor).
import { criarRegistro } from '../areas'
import { IMPOSTOS_PADRAO_BO, IMPOSTOS_PADRAO_BR } from '../dados/impostos'
import { resumoModulos } from './cadastros'
import { CONFIG_PADRAO } from './contexto'

export function padroesServidor() {
  return { config: CONFIG_PADRAO, impostosPadrao: [...IMPOSTOS_PADRAO_BO, ...IMPOSTOS_PADRAO_BR], modulos: resumoModulos(criarRegistro()) }
}
