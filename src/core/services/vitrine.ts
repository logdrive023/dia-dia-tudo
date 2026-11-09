// MINHA VITRINE: os pacotes PRONTOS PARA VENDER, como um comprador de fora veria (link #/loja).
// Pronto = cabelo já separado na triagem (tem medida), com ETIQUETA impressa, com saldo e sem reserva.
// O administrador escolhe (Minha vitrine): ligar/desligar, nome e texto da loja, WhatsApp, como aparece o preço (entrar
// em contato = padrão · preço da tabela · preço por pacote) e esconder pacotes. O comprador vê: código, medida, categoria,
// cor, gramas, foto e o preço (se escolhido) — NUNCA custo, fornecedor, compra ou viagem. O botão abre o WhatsApp.
// Hoje o link abre neste aparelho (os dados estão nele); com a API, o mesmo link vira público.
import type { Id, Item } from '../domain/tipos'
import { fatorValido } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import { type Ctx, lerConfig } from './contexto'
import { type FotoResumo, leitorFotos } from './fotos'
import { tabelaVigente } from './precos'

/** o fundo da página da loja: 'tema' segue o claro/escuro de quem abre; os outros valem para todo comprador */
export type FundoVitrine = 'tema' | 'claro' | 'escuro' | 'gradiente' | 'pontos'
export const FUNDOS_VITRINE: FundoVitrine[] = ['tema', 'claro', 'escuro', 'gradiente', 'pontos']

/** O VISUAL DA LOJA (Minha vitrine › gerador): cores, frase e banner que o comprador vê */
export interface AparenciaVitrine {
  /** a frase pequena acima do nome (sem ela: "Vitrine de cabelo") */
  slogan?: string
  /** a imagem do topo: SÓ imagem enviada (data:), porque o site publicado não carrega imagem de outros endereços (CSP) */
  banner?: string
  corPrimaria: string
  corSecundaria: string
  fundo: FundoVitrine
}
export const APARENCIA_PADRAO: AparenciaVitrine = { corPrimaria: '#7c3aed', corSecundaria: '#a21caf', fundo: 'tema' }
/** tamanho máximo do banner guardado (o texto da imagem): ele fica na configuração, que é lida em toda tela */
export const BANNER_MAX = 700_000
export const corValida = (c?: string) => /^#[0-9a-f]{6}$/i.test(c ?? '')
export const bannerValido = (b?: string) => !!b && b.length <= BANNER_MAX && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(b)

/** como o preço aparece: sem preço (o comprador chama no WhatsApp) · o da tabela · um preço digitado para cada pacote */
export type ModoPrecoVitrine = 'contato' | 'tabela' | 'individual'
export const MODOS_PRECO_VITRINE: ModoPrecoVitrine[] = ['contato', 'tabela', 'individual']

/** o texto que já vem escrito no WhatsApp: botão do pacote, lista de compras, pergunta do preço e botão da loja */
export type TipoMensagemVitrine = 'pacote' | 'lista' | 'perguntaPreco' | 'loja'
export const TIPOS_MENSAGEM_VITRINE: TipoMensagemVitrine[] = ['pacote', 'lista', 'perguntaPreco', 'loja']
export const MENSAGEM_VITRINE_MAX = 500
/** só o que o dono reescreveu; o que não vier usa o texto pronto */
export type MensagensVitrine = Partial<Record<'pt' | 'es', Partial<Record<TipoMensagemVitrine, string>>>>

export interface ConfigVitrine {
  ativa: boolean
  nome?: string
  descricao?: string
  /** WhatsApp para o "Quero este" (com código do país). Ex.: +591 70000000 */
  whatsapp?: string
  /** sem escolha: 'contato' */
  modoPreco?: ModoPrecoVitrine
  /** modo 'tabela': a coluna da tabela de preço (sem escolha: a primeira coluna) */
  colunaId?: string
  /** modo 'individual': o preço por grama de cada pacote, como na tabela (ex.: "17,5") */
  precos?: Record<Id, string>
  /** o texto do WhatsApp reescrito pelo dono */
  mensagens?: MensagensVitrine
  /** pacotes que o administrador escondeu da vitrine */
  ocultos: Id[]
  /** o visual da loja (o que não vier usa APARENCIA_PADRAO) */
  aparencia?: AparenciaVitrine
}
export const VITRINE_PADRAO: ConfigVitrine = { ativa: true, modoPreco: 'contato', ocultos: [] }

function validarMensagens(m?: MensagensVitrine): MensagensVitrine | undefined {
  const r: MensagensVitrine = {}
  for (const idioma of ['pt', 'es'] as const) {
    for (const tipo of TIPOS_MENSAGEM_VITRINE) {
      const texto = m?.[idioma]?.[tipo]
      if (texto === undefined) continue
      exigir(typeof texto === 'string' && texto.trim().length <= MENSAGEM_VITRINE_MAX, `A mensagem do WhatsApp pode ter até ${MENSAGEM_VITRINE_MAX} letras.`)
      r[idioma] = { ...r[idioma], [tipo]: texto.trim() }
    }
  }
  return Object.keys(r).length ? r : undefined
}

export function validarVitrine(v: ConfigVitrine): ConfigVitrine {
  const w = (v.whatsapp ?? '').replace(/[^\d+]/g, '')
  exigir(!w || /^\+?\d{8,15}$/.test(w), 'WhatsApp: use o número com o código do país. Ex.: +591 70000000.')
  const a = v.aparencia ? { ...APARENCIA_PADRAO, ...v.aparencia, slogan: v.aparencia.slogan?.trim() || undefined, banner: v.aparencia.banner || undefined } : undefined
  if (a) {
    exigir(corValida(a.corPrimaria) && corValida(a.corSecundaria), 'Cor inválida: use o formato #7c3aed.')
    exigir(FUNDOS_VITRINE.includes(a.fundo), 'Fundo da vitrine inválido.')
    exigir((a.slogan ?? '').length <= 80, 'A frase do topo pode ter até 80 letras.')
    exigir(!a.banner || bannerValido(a.banner), 'Banner inválido: envie uma imagem JPG, PNG ou WebP de até 500 KB.')
  }
  exigir(MODOS_PRECO_VITRINE.includes(v.modoPreco ?? 'contato'), 'Modo de preço da vitrine inválido.')
  const precos = Object.fromEntries(Object.entries(v.precos ?? {}).map(([id, f]): [Id, string] => [id, String(f).trim()]).filter(([, f]) => f))
  exigir(Object.values(precos).every((f) => fatorValido(f)), 'Preço inválido: use só números. Ex.: 17,5.')
  return { ...VITRINE_PADRAO, ...v, precos, mensagens: validarMensagens(v.mensagens), aparencia: a, whatsapp: w || undefined, nome: v.nome?.trim() || undefined, descricao: v.descricao?.trim() || undefined, ocultos: [...new Set(v.ocultos ?? [])] }
}

export interface PacoteVitrine {
  id: Id
  codigo?: string
  medida: number
  categoria: string
  cor?: string
  textura?: string
  origem?: string
  gramas: number
  /** só a imagem (de qual compra veio a foto não sai na vitrine) */
  foto?: Pick<FotoResumo, 'id' | 'miniatura'>
  /** preço por grama (texto como na tabela, ex.: "17,5"); sem ele, o comprador chama no WhatsApp */
  preco?: { fator: string; moeda: string }
  /** só para o administrador: escondido da vitrine */
  oculto?: boolean
}

const fotoDe = (f?: FotoResumo) => (f ? { id: f.id, miniatura: f.miniatura } : undefined)

const pronto = (i: Item) =>
  !i.apagadoEm && i.moduloId === 'cabelo' && i.controlaEstoque && i.unidade === 'grama' && i.saldo > 0 && !!Number(i.campos?.comprimento) && !!i.etiquetaImpressaEm && !i.reserva

/** publico: o que o comprador vê (sem os escondidos; vazio se a vitrine está desligada). Admin sem `publico`: tudo, com o "escondido". */
export async function vitrine(ctx: Ctx, p: { publico?: boolean } = {}) {
  const cfg = await lerConfig(ctx)
  const conf: ConfigVitrine = { ...VITRINE_PADRAO, ...(cfg.vitrine ?? {}) }
  const publico = p.publico || ctx.sessao.perfil !== 'admin'
  const ocultos = new Set(conf.ocultos)
  const modoPreco = conf.modoPreco ?? 'contato'
  const itens = (await ctx.repos.itens.listar()).filter(pronto).filter((i) => !publico || !ocultos.has(i.id))
  const F = await leitorFotos(ctx, { porId: new Map(itens.map((i) => [i.id, i])) })
  const tabelas = new Map<string, Awaited<ReturnType<typeof tabelaVigente>>>()
  const tabelaDe = async (cat: string) => {
    if (!tabelas.has(cat)) tabelas.set(cat, await tabelaVigente(ctx, { moduloId: 'cabelo', categoria: cat }))
    return tabelas.get(cat)
  }
  const pacotes: PacoteVitrine[] = []
  for (const i of itens.sort((a, b) => Number(b.campos.comprimento) - Number(a.campos.comprimento) || (a.codigo ?? '').localeCompare(b.codigo ?? ''))) {
    const medida = Number(i.campos.comprimento)
    const categoria = String(i.campos.categoria || 'Normal')
    let preco: { fator: string; moeda: string } | undefined
    if (modoPreco === 'tabela') {
      const tb = await tabelaDe(categoria)
      const col = conf.colunaId && tb?.colunas.some((c) => c.id === conf.colunaId) ? conf.colunaId : tb?.colunas[0]?.id
      const f = tb && col ? tb.valores[`${medida}|${col}`] : undefined
      if (tb && f) preco = { fator: f, moeda: tb.moeda }
    } else if (modoPreco === 'individual') {
      const f = conf.precos?.[i.id]
      if (f) preco = { fator: f, moeda: cfg.moedaPrincipal }
    }
    pacotes.push({
      id: i.id,
      codigo: i.codigo,
      medida,
      categoria,
      cor: i.campos.cor ? String(i.campos.cor) : undefined,
      textura: i.campos.textura ? String(i.campos.textura) : undefined,
      origem: i.campos.origem ? String(i.campos.origem) : undefined,
      gramas: i.saldo,
      foto: fotoDe(F.principal(i.id)),
      preco,
      ...(publico ? {} : { oculto: ocultos.has(i.id) }),
    })
  }
  const vistos = (k: 'cor' | 'categoria') => [...new Set(pacotes.map((x) => x[k]).filter(Boolean))].sort() as string[]
  return {
    loja: {
      ativa: conf.ativa,
      nome: conf.nome || cfg.nomeNegocio,
      descricao: conf.descricao,
      whatsapp: conf.whatsapp,
      modoPreco,
      mensagens: conf.mensagens,
      aparencia: { ...APARENCIA_PADRAO, ...conf.aparencia },
    },
    // vitrine desligada: o comprador não vê nada (o administrador continua vendo a prévia)
    pacotes: publico && !conf.ativa ? [] : pacotes,
    filtros: { medidas: [...new Set(pacotes.map((x) => x.medida))].sort((a, b) => a - b), cores: vistos('cor'), categorias: vistos('categoria') },
    gramas: pacotes.reduce((s, x) => s + x.gramas, 0),
  }
}
