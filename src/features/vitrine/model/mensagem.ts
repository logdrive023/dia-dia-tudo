// A MENSAGEM PRONTA DO WHATSAPP (botões da vitrine): vem com um texto pronto em espanhol e em português, e o dono pode
// reescrever cada um (Minha vitrine › Mensagem do WhatsApp). Vai em espanhol para o comprador da Bolívia; em português
// só quando a página e o celular de quem compra estão em português. O pronto: chave em PT, espanhol em shared/ui/es.ts.
import type { MensagensVitrine, PacoteVitrine, TipoMensagemVitrine } from '../../../core/services/vitrine'
import { type Idioma, traduzir } from '../../../shared/ui/i18n'

const PRONTA: Record<TipoMensagemVitrine, string> = {
  pacote: 'Olá, {loja}! Tenho interesse no pacote {codigo}: {detalhe}. Ainda está disponível?',
  perguntaPreco: 'Qual é o valor?',
  loja: 'Olá, {loja}! Vi a vitrine e quero saber mais.',
}

/** o que dá para colocar no texto; o `rotulo` é o nome no botão de inserir */
export const VARIAVEIS_MENSAGEM = [
  { id: 'loja', rotulo: 'Nome da loja' },
  { id: 'codigo', rotulo: 'Código' },
  { id: 'medida', rotulo: 'Medida' },
  { id: 'cor', rotulo: 'Cor' },
  { id: 'peso', rotulo: 'Peso' },
  { id: 'detalhe', rotulo: 'Tudo do pacote' },
] as const

export function idiomaDaMensagem(daTela: Idioma, doCelular: string): Idioma {
  return daTela === 'pt' && doCelular.toLowerCase().startsWith('pt') ? 'pt' : 'es'
}

export const textoPronto = (idioma: Idioma, tipo: TipoMensagemVitrine) => traduzir(idioma, PRONTA[tipo])

/** o texto personalizado ou o pronto. A pergunta do preço pode ficar vazia de propósito (a mensagem sai sem ela) */
function modelo(idioma: Idioma, tipo: TipoMensagemVitrine, m?: MensagensVitrine) {
  const proprio = m?.[idioma]?.[tipo]
  if (proprio === undefined) return textoPronto(idioma, tipo)
  return tipo === 'perguntaPreco' ? proprio.trim() : proprio.trim() || textoPronto(idioma, tipo)
}

const preencher = (texto: string, v: Record<string, string>) => texto.replace(/\{(\w+)\}/g, (inteiro, k: string) => v[k] ?? inteiro)

/** "{nome}" escrito errado sairia assim mesmo para o comprador: o editor avisa */
export const variaveisDesconhecidas = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).filter((k) => !VARIAVEIS_MENSAGEM.some((v) => v.id === k))

/** "Quero este" / "Entrar em contato" de um pacote; `peso` já vem escrito (ex.: "1,2 kg") */
export function mensagemPacote(idioma: Idioma, p: PacoteVitrine, loja: string, peso: string, perguntaPreco: boolean, m?: MensagensVitrine) {
  const t = (texto: string) => traduzir(idioma, texto)
  const medida = `${p.medida} cm${p.categoria !== 'Normal' ? ` ${t(p.categoria)}` : ''}`
  const cor = p.cor ? t(p.cor) : ''
  const v = { loja, codigo: p.codigo ?? '', medida, cor, peso, detalhe: [medida, cor, peso].filter(Boolean).join(' · ') }
  return [preencher(modelo(idioma, 'pacote', m), v), perguntaPreco ? preencher(modelo(idioma, 'perguntaPreco', m), v) : ''].filter(Boolean).join(' ')
}

/** o botão geral da loja (sem pacote escolhido) */
export const mensagemLoja = (idioma: Idioma, loja: string, m?: MensagensVitrine) => preencher(modelo(idioma, 'loja', m), { loja })
