// AUDITORIA › o estado da tela: os filtros (na URL, para voltar e compartilhar), a busca que só consulta quando a
// pessoa para de digitar, a consulta, a paginação, os chips de filtro e a planilha.
import { useEffect, useState } from 'react'
import type { CategoriaAuditoria } from '../../../core/services/auditoria'
import { useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { baixarCSV } from '../../../shared/ui/csv'
import { useT } from '../../../shared/ui/i18n'
import { usePaginacao } from '../../../shared/ui/paginacao'
import { NOME_AREA } from '../model/auditoria'

/** a busca vai para a consulta só 300 ms depois da última letra (cada consulta lê o registro inteiro) */
const ESPERA_BUSCA = 300

export function useAuditoria() {
  const t = useT()
  const [buscaUrl, setBuscaUrl] = useParamTela('busca', '')
  const [busca, setBusca] = useState(buscaUrl)
  useEffect(() => {
    if (busca === buscaUrl) return
    const h = setTimeout(() => setBuscaUrl(busca), ESPERA_BUSCA)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a letra digitada dispara
  }, [busca])
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const [usuarioId, setUsuarioId] = useParamTela('usuarioId', '')
  const [acao, setAcao] = useParamTela('acao', '')
  const [area, setArea] = useParamTela<'' | CategoriaAuditoria>('area', '')
  const { dados } = useConsulta('auditoria', { de: de || undefined, ate: ate || undefined, usuarioId: usuarioId || undefined, acao: acao || undefined, categoria: area || undefined, busca: buscaUrl || undefined })
  const linhas = dados?.linhas ?? []
  const pag = usePaginacao(linhas, { padrao: 50, reiniciar: JSON.stringify([buscaUrl, de, ate, usuarioId, acao, area]) })
  const nomeUsuario = dados?.usuarios.find((u) => u.id === usuarioId)?.nome
  const ativos = [
    ...(usuarioId ? [{ k: 'usuarioId', rotulo: `👤 ${nomeUsuario ?? usuarioId}` }] : []),
    ...(acao ? [{ k: 'acao', rotulo: `⚡ ${t(dados?.acoes.find((a) => a.id === acao)?.nome ?? acao)}` }] : []),
  ]
  const limpar = () => (setBusca(''), setBuscaUrl(''), setDe(''), setAte(''), setUsuarioId(''), setAcao(''), setArea(''))
  const exportar = () => baixarCSV('auditoria', linhas.map((l) => ({
    quando: l.em, quem: l.usuarioNome, usuario_id: l.usuarioId, area: t(NOME_AREA[l.categoria]), acao: l.nomeAcao, codigo_acao: l.acao,
    resumo: l.resumo, referencias: l.refs.map((r) => `${r.tipo}:${r.rotulo}`).join(' | '), alvo_id: l.alvoId ?? '', registro_id: l.id,
  })))
  return {
    dados, linhas, pag, ativos, limpar, exportar,
    filtros: { busca, setBusca, de, ate, setPeriodo: (d?: string, a?: string) => (setDe(d ?? ''), setAte(a ?? '')), usuarioId, setUsuarioId, acao, setAcao, area, setArea },
    filtrando: !!(busca || de || ate || usuarioId || acao || area),
  }
}
