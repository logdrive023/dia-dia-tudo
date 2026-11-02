// PENDÊNCIAS: o que falta em cada venda e compra para ficar COMPLETA. A mesma regra serve à lista (selo "Completa"
// ou "falta: …"), ao filtro "só com pendência" e ao "Atenção agora" do painel (que leva direto a cada registro).

import type { Anexo, Transacao } from '../domain/tipos'

export type IdPendencia = 'faltaReceber' | 'semComprovante' | 'semFotos' | 'semComprovanteOrigem' | 'faltaPagar' | 'paradaTriagem'

export interface Pendencia {
  id: IdPendencia
  texto: string
  /** valor que falta (moeda principal), quando é dinheiro */
  valor?: number
  nivel: 'urgente' | 'atencao'
}

export const NOMES_PENDENCIA: Record<IdPendencia, string> = {
  faltaReceber: 'Falta receber',
  semComprovante: 'Sem comprovante do pagamento',
  semFotos: 'Sem fotos',
  semComprovanteOrigem: 'Sem comprovante de origem',
  faltaPagar: 'Falta pagar',
  paradaTriagem: 'Parada na triagem',
}

/**
 * Venda concluída:
 *  - falta receber (fiado: pago < total);
 *  - pagamento que não é dinheiro vivo (QR, Pix, cartão, transferência) sem foto do comprovante.
 * saldoConta: saldo da conta corrente da pessoa (+ = ela me deve). Um acerto feito depois (recebi/paguei) quita a
 * pendência: o que falta é o menor entre o que faltou na venda/compra e o que a conta ainda mostra.
 */
export function pendenciasVenda(t: Transacao, anexos: Anexo[], formasVivas: Set<string>, saldoConta?: number): Pendencia[] {
  if (t.tipo !== 'venda' || t.etapa !== 'concluido') return []
  const p: Pendencia[] = []
  const pago = t.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0)
  const tolerancia = t.pagamentos.filter((x) => x.moeda !== t.moedaPrincipal).length
  const falta = Math.min(t.totalPrincipal - pago, t.pessoaId ? Math.max(0, saldoConta ?? 0) : Infinity)
  if (falta > tolerancia) p.push({ id: 'faltaReceber', texto: NOMES_PENDENCIA.faltaReceber, valor: falta, nivel: 'urgente' })
  const precisaComprovante = t.pagamentos.some((x) => !formasVivas.has(x.forma) && x.valor > 0)
  if (precisaComprovante && !anexos.some((a) => a.donoId === t.id && a.categoria === 'comprovante')) p.push({ id: 'semComprovante', texto: NOMES_PENDENCIA.semComprovante, nivel: 'atencao' })
  return p
}

/** Compra: fotos, comprovante de origem (se o módulo pede), falta pagar (depois do "Pago") e parada na triagem. */
export function pendenciasCompra(t: Transacao & { diasParada?: number }, anexos: Anexo[], opcoes: { pedeFotos?: boolean; pedeOrigem: boolean; jaPassouDoPago: boolean; diasParadaLimite: number; saldoConta?: number }): Pendencia[] {
  if (t.tipo !== 'compra' || t.etapa === 'cancelado' || t.etapa === 'recusado') return []
  const p: Pendencia[] = []
  const meus = anexos.filter((a) => a.donoId === t.id)
  if (opcoes.pedeFotos !== false && !meus.some((a) => a.categoria === 'pedido' || a.categoria === 'produto')) p.push({ id: 'semFotos', texto: NOMES_PENDENCIA.semFotos, nivel: 'atencao' })
  if (opcoes.pedeOrigem && !meus.some((a) => a.categoria === 'origem')) p.push({ id: 'semComprovanteOrigem', texto: NOMES_PENDENCIA.semComprovanteOrigem, nivel: 'atencao' })
  if (opcoes.jaPassouDoPago) {
    const pago = t.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0)
    const falta = Math.min(t.totalPrincipal - pago, t.pessoaId ? Math.max(0, -(opcoes.saldoConta ?? 0)) : Infinity)
    if (falta > t.pagamentos.length) p.push({ id: 'faltaPagar', texto: NOMES_PENDENCIA.faltaPagar, valor: falta, nivel: 'urgente' })
  }
  if (t.etapa !== 'concluido' && (t.diasParada ?? 0) >= opcoes.diasParadaLimite) p.push({ id: 'paradaTriagem', texto: NOMES_PENDENCIA.paradaTriagem, nivel: 'urgente' })
  return p
}
