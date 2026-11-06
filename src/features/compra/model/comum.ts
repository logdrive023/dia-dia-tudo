// COMPRAS — o que a lista, a nova compra e a ficha da compra usam juntas: as etapas que encerram a compra e as
// categorias dos anexos.
import type { CategoriaAnexo } from '../../../core/domain/tipos'


export const ENCERRADAS = ['concluido', 'recusado', 'cancelado']

/** compra recusada/cancelada não entra em viagem */
export const encerradaSemViagem = (etapa: string) => etapa === 'recusado' || etapa === 'cancelado'

/** Tela do PEDIDO (pedidos/:id): tudo de uma compra num lugar. */
/** tipos de anexo de uma compra (as pendências sem fotos / sem comprovante de origem saem da categoria) */
export const CATEGORIAS_COMPRA: CategoriaAnexo[] = ['pedido', 'produto', 'comprovante', 'origem', 'outro']
