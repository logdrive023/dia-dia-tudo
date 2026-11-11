// O que o servidor Go precisa saber do SISTEMA (não da empresa): configuração padrão, impostos padrão e módulos.
// Exportado por scripts/exportar-padroes.ts para api-contract/padroes.json (e a cópia do servidor).
import { criarRegistro } from '../areas'
import { IMPOSTOS_PADRAO_BO, IMPOSTOS_PADRAO_BR } from '../dados/impostos'
import { NOMES_CATEGORIA } from './auditoria'
import { resumoModulos } from './cadastros'
import { CONFIG_PADRAO } from './contexto'
import { NOMES_ACAO } from './historico'

export function padroesServidor() {
  const registro = criarRegistro()
  return {
    config: CONFIG_PADRAO,
    impostosPadrao: [...IMPOSTOS_PADRAO_BO, ...IMPOSTOS_PADRAO_BR],
    modulos: resumoModulos(registro),
    // como a compra anda em cada módulo (etapas, avisos) e o tipo de item que ela compra (nasce na compra? campos obrigatórios)
    compras: registro.todos().flatMap((m) => {
      if (!m.compra) return []
      const t = registro.tipoItem(m.id, m.compra.tipoItem)
      const obrigatorios = t.campos.filter((c) => c.obrigatorio).map((c) => ({ id: c.id, nome: c.nome }))
      return [{ moduloId: m.id, ...m.compra, tipo: { id: t.id, nome: t.nome, unidade: t.unidade, controlaEstoque: t.controlaEstoque, nasceNaCompra: !!t.nasceNaCompra, obrigatorios } }]
    }),
    // a auditoria: o nome de cada ação e as áreas (a área de cada ação o servidor calcula como categoriaDe)
    nomesAcao: NOMES_ACAO,
    categoriasAuditoria: NOMES_CATEGORIA,
  }
}
