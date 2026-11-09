// Como peso e dinheiro aparecem na vitrine (nos cartões, na lista de compras e na mensagem do WhatsApp).
import { gramasTexto } from '../../../shared/ui/base'

const SIMBOLO: Record<string, string> = { BOB: 'Bs', USD: 'US$', BRL: 'R$', PYG: '₲' }

export const numeroFator = (fator: string) => Number(fator.replace(/\./g, '').replace(',', '.'))
export const dinheiroLoja = (v: number, moeda: string) => `${SIMBOLO[moeda] ?? moeda} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : gramasTexto(g))
