// MINHA VITRINE: os pacotes PRONTOS PARA VENDER, como um comprador de fora veria (link #/loja).
// Pronto = cabelo já separado na triagem (tem medida), com ETIQUETA impressa, com saldo e sem reserva.
// O administrador escolhe (Minha vitrine): ligar/desligar, nome e texto da loja, WhatsApp, mostrar o preço (de qual
// coluna da tabela) e esconder pacotes. O comprador vê: código, medida, categoria, cor, gramas, foto e o preço por grama
// (se ligado) — NUNCA custo, fornecedor, compra ou viagem. O botão "Quero este" abre o WhatsApp com a mensagem pronta.
// Hoje o link abre neste aparelho (os dados estão nele); com a API, o mesmo link vira público.
import type { Id, Item } from '../domain/tipos'
import { exigir } from '../domain/erros'
import { type Ctx, lerConfig } from './contexto'
import { type FotoResumo, leitorFotos } from './fotos'
import { tabelaVigente } from './precos'

export interface ConfigVitrine {
  ativa: boolean
  nome?: string
  descricao?: string
  /** WhatsApp para o "Quero este" (com código do país). Ex.: +591 70000000 */
  whatsapp?: string
  mostrarPreco: boolean
  /** a coluna da tabela de preço usada na vitrine (sem escolha: a primeira coluna da tabela) */
  colunaId?: string
  /** pacotes que o administrador escondeu da vitrine */
  ocultos: Id[]
}
export const VITRINE_PADRAO: ConfigVitrine = { ativa: true, mostrarPreco: true, ocultos: [] }

export function validarVitrine(v: ConfigVitrine): ConfigVitrine {
  const w = (v.whatsapp ?? '').replace(/[^\d+]/g, '')
  exigir(!w || /^\+?\d{8,15}$/.test(w), 'WhatsApp: use o número com o código do país. Ex.: +591 70000000.')
  return { ...VITRINE_PADRAO, ...v, whatsapp: w || undefined, nome: v.nome?.trim() || undefined, descricao: v.descricao?.trim() || undefined, ocultos: [...new Set(v.ocultos ?? [])] }
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
  /** preço por grama da tabela (texto como na tabela, ex.: "17,5") */
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
    if (conf.mostrarPreco) {
      const tb = await tabelaDe(categoria)
      const col = conf.colunaId && tb?.colunas.some((c) => c.id === conf.colunaId) ? conf.colunaId : tb?.colunas[0]?.id
      const f = tb && col ? tb.valores[`${medida}|${col}`] : undefined
      if (f) preco = { fator: f, moeda: tb!.moeda }
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
      mostrarPreco: conf.mostrarPreco,
      colunaId: conf.colunaId,
    },
    // vitrine desligada: o comprador não vê nada (o administrador continua vendo a prévia)
    pacotes: publico && !conf.ativa ? [] : pacotes,
    filtros: { medidas: [...new Set(pacotes.map((x) => x.medida))].sort((a, b) => a - b), cores: vistos('cor'), categorias: vistos('categoria') },
    gramas: pacotes.reduce((s, x) => s + x.gramas, 0),
  }
}
