// COBRANÇA NO WHATSAPP › o texto pronto (chave em PT; o espanhol em shared/ui/es.ts), as variáveis de cada tipo e a
// mensagem final com os dados da conta. O que o dono reescreve fica na configuração (core/services/cobranca.ts).
import type { MensagensCobranca, TipoCobranca } from '../../../core/services/cobranca'
import { type Idioma, traduzir } from '../../../shared/ui/i18n'
import { preencherModelo } from '../../../shared/ui/previaWhatsapp'

const PRONTA: Record<TipoCobranca, string> = {
  adiantamento: 'Olá, {nome}! 👋\nSobre o adiantamento {codigo}: ainda falta entregar *{falta}*.\nAdiantado: {adiantado} · já entregue: {entregue}.\nObrigado!',
  emprestimo: 'Olá, {nome}! 👋\nParcelas em aberto:\n{parcelas}\n\n*Total que falta:* {falta}',
}

/** o que dá para colocar em cada texto (o rótulo é o nome do botão de inserir) */
export const VARIAVEIS_COBRANCA: Record<TipoCobranca, readonly { id: string; rotulo: string }[]> = {
  adiantamento: [
    { id: 'nome', rotulo: 'Nome' }, { id: 'codigo', rotulo: 'Código' }, { id: 'falta', rotulo: 'Quanto falta' },
    { id: 'adiantado', rotulo: 'Adiantado' }, { id: 'entregue', rotulo: 'Já entregue' }, { id: 'prazo', rotulo: 'Prazo' }, { id: 'loja', rotulo: 'Nome da loja' },
  ],
  emprestimo: [
    { id: 'nome', rotulo: 'Nome' }, { id: 'falta', rotulo: 'Quanto falta' }, { id: 'parcelas', rotulo: 'Parcelas em aberto' },
    { id: 'proxima', rotulo: 'Próxima parcela' }, { id: 'atrasado', rotulo: 'Atrasado' }, { id: 'loja', rotulo: 'Nome da loja' },
  ],
}

export const textoProntoCobranca = (idioma: Idioma, tipo: TipoCobranca) => traduzir(idioma, PRONTA[tipo])

/** o texto do dono (se ele reescreveu) ou o pronto */
export const modeloCobranca = (idioma: Idioma, tipo: TipoCobranca, m?: MensagensCobranca) => m?.[idioma]?.[tipo]?.trim() || textoProntoCobranca(idioma, tipo)

/** a mensagem que vai para o WhatsApp: o modelo com os dados da conta */
export const mensagemCobranca = (modelo: string, valores: Record<string, string>) => preencherModelo(modelo, valores).replace(/\n{3,}/g, '\n\n').trim()
