// A MENSAGEM PRONTA DO WHATSAPP (botões da vitrine): vem com um texto pronto em espanhol e em português, e o dono pode
// reescrever cada um (Minha vitrine › Mensagem do WhatsApp). Vai em espanhol para o comprador da Bolívia; em português
// só quando a página e o celular de quem compra estão em português. O pronto: chave em PT, espanhol em shared/ui/es.ts.
// Duas formas de pedir: um pacote só ("Quero este") ou a LISTA de compras, com vários pacotes numerados.
import type { MensagensVitrine, ModoPrecoVitrine, PacoteVitrine, TipoMensagemVitrine } from '../../../core/services/vitrine'
import { type Idioma, traduzir } from '../../../shared/ui/i18n'
import { dinheiroLoja, kg, numeroFator } from './formato'

const PRONTA: Record<TipoMensagemVitrine, string> = {
  pacote: 'Olá, {loja}! Tenho interesse no pacote {codigo}: {detalhe}. Ainda está disponível?',
  lista: 'Olá, {loja}! 👋\nTem disponível?\n\n{itens}\n\n*Total:* {total}',
  perguntaPreco: 'Qual é o valor?',
  loja: 'Olá, {loja}! Vi a vitrine e quero saber mais.',
}

/** o que dá para colocar no texto; o `rotulo` é o nome no botão de inserir e `em`, as mensagens que têm esse dado */
export const VARIAVEIS_MENSAGEM = [
  { id: 'loja', rotulo: 'Nome da loja', em: ['pacote', 'lista', 'loja'] },
  { id: 'codigo', rotulo: 'Código', em: ['pacote'] },
  { id: 'medida', rotulo: 'Medida', em: ['pacote'] },
  { id: 'cor', rotulo: 'Cor', em: ['pacote'] },
  { id: 'peso', rotulo: 'Peso', em: ['pacote'] },
  { id: 'detalhe', rotulo: 'Tudo do pacote', em: ['pacote'] },
  { id: 'itens', rotulo: 'Os itens', em: ['lista'] },
  { id: 'quantidade', rotulo: 'Quantidade', em: ['lista'] },
  { id: 'total', rotulo: 'Total', em: ['lista'] },
] as const satisfies readonly { id: string; rotulo: string; em: readonly TipoMensagemVitrine[] }[]

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

function dadosPacote(idioma: Idioma, p: PacoteVitrine) {
  const medida = `${p.medida} cm${p.categoria !== 'Normal' ? ` ${traduzir(idioma, p.categoria)}` : ''}`
  return { medida, cor: p.cor ? traduzir(idioma, p.cor) : '' }
}

/** "Quero este" / "Entrar em contato" de um pacote; `peso` já vem escrito (ex.: "1,2 kg") */
export function mensagemPacote(idioma: Idioma, p: PacoteVitrine, loja: string, peso: string, perguntaPreco: boolean, m?: MensagensVitrine) {
  const { medida, cor } = dadosPacote(idioma, p)
  const v = { loja, codigo: p.codigo ?? '', medida, cor, peso, detalhe: [medida, cor, peso].filter(Boolean).join(' · ') }
  return [preencher(modelo(idioma, 'pacote', m), v), perguntaPreco ? preencher(modelo(idioma, 'perguntaPreco', m), v) : ''].filter(Boolean).join(' ')
}

/** o valor do pacote, se a loja mostra preço e ele tem */
export function valorPacote(p: PacoteVitrine, modoPreco: ModoPrecoVitrine) {
  return modoPreco !== 'contato' && p.preco ? numeroFator(p.preco.fator) * p.gramas : undefined
}

/** peso somado e, se todos têm preço na mesma moeda, o valor: "2,4 kg · Bs 3.000,00" */
export function totalLista(pacotes: PacoteVitrine[], modoPreco: ModoPrecoVitrine) {
  const peso = kg(pacotes.reduce((s, p) => s + p.gramas, 0))
  const valores = pacotes.map((p) => valorPacote(p, modoPreco))
  const moedas = new Set(pacotes.map((p) => p.preco?.moeda))
  if (!pacotes.length || valores.some((v) => v === undefined) || moedas.size !== 1) return peso
  return `${peso} · ${dinheiroLoja(valores.reduce<number>((s, v) => s + (v ?? 0), 0), pacotes[0].preco?.moeda ?? '')}`
}

/** a lista de compras: uma linha numerada por pacote; com algum pacote sem preço à vista, a pergunta do valor vai junto */
export function mensagemLista(idioma: Idioma, pacotes: PacoteVitrine[], loja: string, modoPreco: ModoPrecoVitrine, m?: MensagensVitrine) {
  const itens = pacotes.map((p, k) => {
    const { medida, cor } = dadosPacote(idioma, p)
    const valor = valorPacote(p, modoPreco)
    return `*${k + 1}.* ${[p.codigo, medida, cor, kg(p.gramas), valor !== undefined && p.preco ? dinheiroLoja(valor, p.preco.moeda) : ''].filter(Boolean).join(' · ')}`
  }).join('\n')
  const v = { loja, itens, quantidade: String(pacotes.length), total: totalLista(pacotes, modoPreco) }
  const faltaPreco = pacotes.some((p) => valorPacote(p, modoPreco) === undefined)
  return [preencher(modelo(idioma, 'lista', m), v), faltaPreco ? preencher(modelo(idioma, 'perguntaPreco', m), v) : ''].filter(Boolean).join('\n\n')
}

/** o botão geral da loja (sem pacote escolhido) */
export const mensagemLoja = (idioma: Idioma, loja: string, m?: MensagensVitrine) => preencher(modelo(idioma, 'loja', m), { loja })
