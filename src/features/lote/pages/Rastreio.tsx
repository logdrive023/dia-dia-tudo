// RASTREIO (#/rastreio?id=): o rastreio completo de um lote, em tela própria.
import type { Id } from '../../../core/domain/tipos'
import { Carregando, Titulo, ErroTela } from '../../../shared/ui/base'
import { useApp, useConsulta } from '../../../shared/ui/contexto'
import { RastreioTotal } from '../../../shared/ui/rastreioTotal'
import { useT } from '../../../shared/ui/i18n'
import { Trilha } from '../../../shared/ui/trilha'

/** RASTREIO TOTAL (tela cheia): o grafo compra → triagem → lote → venda em gramas, a partir da compra ou do lote. */
export function Rastreio() {
  const t = useT()
  const { nav, voltar, ir } = useApp()
  const { dados, erro } = useConsulta('genealogia', { compraId: nav.params.compraId as Id | undefined, itemId: nav.params.itemId as Id | undefined })
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  // trilha: origem › o registro em foco (pacote ou compra, tocar abre) › Rastreio total
  const foco = dados.caminho.lote
    ? [{ rotulo: dados.caminho.lote.codigo ?? dados.caminho.lote.nome, onClick: () => ir('lote', { id: dados.caminho.lote!.id }) }]
    : nav.params.compraId && dados.caminho.compras[0] ? [{ rotulo: dados.caminho.compras[0].codigo ?? t('Compra'), onClick: () => ir('pedido', { id: String(nav.params.compraId) }) }] : []
  return (
    <div className="space-y-4">
      <Trilha niveis={foco} atual={t('Rastreio total')} />
      <Titulo subtitulo={t('Cada grama: como entrou e para onde foi.')}>{t('Rastreio: origem → destino')}</Titulo>
      {/* o mapa inteiro; o histórico de cada registro abre no próprio cartão ("Histórico ▾") */}
      <RastreioTotal g={dados} />
    </div>
  )
}
