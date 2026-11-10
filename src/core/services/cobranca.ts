// COBRANÇA NO WHATSAPP (adiantamento e empréstimo): o texto que já vai escrito quando o administrador toca em "Cobrar
// no WhatsApp". Vem pronto em espanhol e em português (o pronto fica na tela: features/financeiro/model/cobranca.ts) e
// o dono pode reescrever cada um — o que ele salvar fica aqui, na configuração (Configuracoes.cobrancas).
import { exigir } from '../domain/erros'

export type TipoCobranca = 'adiantamento' | 'emprestimo'
export const TIPOS_COBRANCA: TipoCobranca[] = ['adiantamento', 'emprestimo']
export const COBRANCA_MAX = 600

/** só o que o dono reescreveu; o que não vier usa o texto pronto */
export type MensagensCobranca = Partial<Record<'pt' | 'es', Partial<Record<TipoCobranca, string>>>>

/** limpa e confere: só idiomas e tipos conhecidos, até 600 letras; texto vazio = volta ao pronto */
export function validarCobrancas(m?: MensagensCobranca): MensagensCobranca | undefined {
  const r: MensagensCobranca = {}
  for (const idioma of ['pt', 'es'] as const) {
    for (const tipo of TIPOS_COBRANCA) {
      const texto = m?.[idioma]?.[tipo]
      if (texto === undefined) continue
      exigir(typeof texto === 'string' && texto.trim().length <= COBRANCA_MAX, `A mensagem de cobrança pode ter até ${COBRANCA_MAX} letras.`)
      if (texto.trim()) r[idioma] = { ...r[idioma], [tipo]: texto.trim() }
    }
  }
  return Object.keys(r).length ? r : undefined
}
