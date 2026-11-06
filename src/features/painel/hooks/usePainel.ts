// DADOS DO PAINEL — o estado da tela (período, comparar, moeda, unidade, área, visão dos impostos; lembrados no aparelho)
// e as consultas. A tela e as seções só recebem o resultado. As consultas passam pelo backend do app (no aparelho hoje,
// API amanhã): trocar a origem não mexe aqui nem nas seções.
import { MOEDAS } from '../../../core/domain/dinheiro'
import { moedaPadrao } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { useLembrado, usePeriodo } from '../../../shared/ui/filtros'
import type { VisaoImposto } from '../components/SecoesPainel'

export function usePainel() {
  const { nav, ajustarParams } = useApp()
  const [periodo, setPeriodo] = usePeriodo()
  const [comparar, setComparar] = useLembrado('painel.comparar', true)
  const [moeda, setMoeda] = useLembrado('painel.moeda', 'convertido')
  const [area, setArea] = useLembrado<string>('painel.area', '')
  const [localId, setLocalId] = useLembrado<string>('painel.local', '')
  const [visaoImposto, setVisaoImposto] = useLembrado<VisaoImposto>('painel.impostos', 'antes')
  // a aba vem do endereço (?area=) e, sem ele, da última escolhida
  const areaAtual = (nav.params.area as string | undefined) ?? area
  const escolherArea = (id: string) => (setArea(id), ajustarParams({ area: id || undefined }))
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { dados: locais } = useConsulta('locais', {})
  // moeda lembrada que saiu das ativas → volta para "tudo convertido"
  const moedaFiltro = moeda !== 'convertido' && !cfg?.config.moedasAtivas.includes(moeda) ? 'convertido' : moeda
  const { dados: p, erro } = useConsulta('painel', { de: periodo.de, ate: periodo.ate, comparar, moeda: moedaFiltro, area: areaAtual && areaAtual !== 'viagens' ? areaAtual : undefined, localId: localId || undefined })
  // IMPOSTOS (Configurações › Fiscal): ligado → o Painel mostra o resultado antes e depois dos impostos estimados
  const impostosLigados = !!cfg?.config.fiscal?.mostrarNasOperacoes
  const { dados: rel } = useConsulta('relatorioContabil', { de: periodo.de, ate: periodo.ate }, impostosLigados)
  return {
    periodo, setPeriodo, comparar, setComparar, moedaFiltro, setMoeda, localId, setLocalId, visaoImposto, setVisaoImposto,
    areaAtual, escolherArea, p, erro, rel, impostosLigados,
    /** as abas de área: os módulos ativos que vendem ou têm tela própria */
    modulos: cfg ? cfg.modulos.filter((m) => cfg.config.modulosAtivos.includes(m.id) && (m.temVenda || m.telaPropria)) : [],
    principal: cfg?.config.moedaPrincipal ?? moedaPadrao(),
    moedas: (cfg?.config.moedasAtivas ?? []).filter((m) => MOEDAS.some((x) => x.codigo === m)),
    /** as unidades do filtro (só salões) */
    saloes: (locais ?? []).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome })),
    cartao: (id: string) => p?.cartoes.find((x) => x.id === id),
  }
}
