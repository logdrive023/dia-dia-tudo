// Peças comuns da tela do PEDIDO (compra): o tipo dos dados e o atalho de separar.
import type { Id } from '../../../core/domain/tipos'
import type { useConsulta } from '../../../shared/ui/contexto'

export type DadosPedido = NonNullable<ReturnType<typeof useConsulta<'pedido'>>['dados']>

export const codigoDe = (c: { codigo?: string; id: string }) => c.codigo ?? `#${c.id.slice(-5)}`

/** Abre a separação do bruto desta compra: um lote → separar; vários → juntar e separar. */
export function irSeparar(ir: (tela: string, params?: Record<string, string | number | boolean | undefined>) => void, ids: Id[]) {
  if (ids.length === 1) ir('separar', { id: ids[0] })
  else if (ids.length > 1) ir('separar', { ids: ids.join(',') })
}

/** em viagem (ou quem registrou está viajando): separar fica para a volta — o botão de separar não é o principal */
export const emViagemAgora = (dados: DadosPedido, pessoaId?: Id) =>
  dados.viagem?.status === 'aberta' || (!!pessoaId && dados.comprador?.id === pessoaId && !!dados.viagem)
