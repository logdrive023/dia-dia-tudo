// FORMULÁRIO DE COMPRA (Configurações › Cabelo e estoque › Formulário de compra): o administrador escolhe o que aparece
// na tela de nova compra, em que ordem, o que já vem aberto (o resto fica como "+ Adicionar …"), o que é obrigatório,
// os valores que já vêm preenchidos e o jeito da tela (uma página simples ou passo a passo).
// Padrão = formulário simples numa página: fornecedor, o que veio e o total; o resto a um toque.
// O que é obrigatório e dá para conferir no servidor (fornecedor, quem comprou, observação, fotos, viagem) é conferido no criarCompra.

import { MOEDAS } from '../domain/dinheiro'
import { exigir } from '../domain/erros'
import { auditar, type Ctx, novo, tocar } from './contexto'
import type { ModoCompra } from './codigos'

export type CampoFormId = 'fornecedor' | 'itens' | 'codigo' | 'comprador' | 'coluna' | 'estado' | 'fotos' | 'obs' | 'atributos' | 'viagem'

export interface CampoForm {
  id: CampoFormId
  /** aparece na tela (escondido = não pede nem mostra) */
  visivel: boolean
  /** já vem aberto; fechado = vira um "+ Adicionar …" que abre com um toque */
  aberto: boolean
  obrigatorio: boolean
}

export interface FormCompraConfig {
  layout: 'simples' | 'passos'
  /** a ordem da lista é a ordem na tela */
  campos: CampoForm[]
  padroes: {
    moduloId?: string
    /** coluna da tabela de preço (vazio = a do fornecedor, senão a primeira) */
    colunaId?: string
    moeda?: string
    /** tipo de código que vem marcado (vazio = o da regra de Configurações › Códigos); dá para trocar em cada compra */
    modoCodigo?: ModoCompra
    /** como começa a linha de cabelo */
    modoLinha: 'bruto' | 'tabela'
  }
  /** medidas favoritas (cm), viram botões rápidos na linha */
  medidas: number[]
  /** opções do "estado na chegada" */
  estados: string[]
}

/** O que cada campo é e o que dá para mudar nele (itens é fixo: sempre aparece, só muda de lugar). */
export const CAMPOS_FORM: Record<CampoFormId, { nome: string; podeEsconder: boolean; podeObrigar: boolean }> = {
  fornecedor: { nome: 'Fornecedor', podeEsconder: true, podeObrigar: true },
  itens: { nome: 'O que veio', podeEsconder: false, podeObrigar: false },
  codigo: { nome: 'Código do pedido', podeEsconder: true, podeObrigar: false },
  comprador: { nome: 'Quem comprou', podeEsconder: true, podeObrigar: true },
  coluna: { nome: 'Coluna da tabela', podeEsconder: true, podeObrigar: false },
  estado: { nome: 'Estado na chegada', podeEsconder: true, podeObrigar: true },
  fotos: { nome: 'Fotos e arquivos', podeEsconder: true, podeObrigar: true },
  obs: { nome: 'Observação', podeEsconder: true, podeObrigar: true },
  atributos: { nome: 'Atributos extras', podeEsconder: true, podeObrigar: false },
  /** viagem de compra aberta (vem aberta e escolhida quando quem comprou está numa viagem aberta) */
  viagem: { nome: 'Viagem', podeEsconder: true, podeObrigar: true },
}

const IDS = Object.keys(CAMPOS_FORM) as CampoFormId[]

export const ESTADOS_CHEGADA_PADRAO = ['Seco e limpo', 'Úmido', 'Com química', 'Com nós', 'Pontas secas', 'Cheiro forte', 'Fios curtos misturados', 'Com caspa/sujeira']

const campo = (id: CampoFormId, aberto = false, obrigatorio = false): CampoForm => ({ id, visivel: true, aberto, obrigatorio })

export const FORM_COMPRA_PADRAO: FormCompraConfig = {
  layout: 'simples',
  campos: [campo('fornecedor', true), campo('itens', true), campo('codigo'), campo('coluna'), campo('comprador'), campo('viagem'), campo('estado'), campo('fotos'), campo('obs'), campo('atributos')],
  padroes: { modoLinha: 'bruto' },
  medidas: [40, 45, 50, 55, 60, 65, 70],
  estados: ESTADOS_CHEGADA_PADRAO,
}

const ID_CONFIG = 'formCompra'

/** Junta o salvo com o padrão: campo novo do sistema entra no fim, campo que não existe mais sai. */
function completar(v: Partial<FormCompraConfig>): FormCompraConfig {
  const salvos = (v.campos ?? []).filter((c) => IDS.includes(c.id))
  const campos = [...salvos, ...FORM_COMPRA_PADRAO.campos.filter((c) => !salvos.some((s) => s.id === c.id))].map((c) => ({
    ...c,
    visivel: !CAMPOS_FORM[c.id].podeEsconder || !!c.visivel,
    aberto: c.id === 'itens' || !!c.aberto,
    obrigatorio: CAMPOS_FORM[c.id].podeObrigar && !!c.visivel && !!c.obrigatorio,
  }))
  return {
    layout: v.layout === 'passos' ? 'passos' : 'simples',
    campos,
    padroes: { ...FORM_COMPRA_PADRAO.padroes, ...(v.padroes ?? {}) },
    medidas: v.medidas ?? FORM_COMPRA_PADRAO.medidas,
    estados: v.estados ?? FORM_COMPRA_PADRAO.estados,
  }
}

export async function lerFormCompra(ctx: Ctx): Promise<FormCompraConfig> {
  return completar(((await ctx.repos.config.obter(ID_CONFIG))?.valor ?? {}) as Partial<FormCompraConfig>)
}

/** Campo obrigatório (e visível)? */
export const obrigatorioNoForm = (f: FormCompraConfig, id: CampoFormId) => !!f.campos.find((c) => c.id === id)?.obrigatorio

/** Consulta da tela de nova compra e de Configurações › Formulário de compra. */
export async function formCompra(ctx: Ctx, _p: object = {}) {
  return lerFormCompra(ctx)
}

function resumo(f: FormCompraConfig) {
  const nome = (c: CampoForm) => `${CAMPOS_FORM[c.id].nome}${c.obrigatorio ? '*' : ''}${c.aberto ? '' : ' (+)'}`
  return [
    f.layout === 'passos' ? 'passo a passo' : 'uma página',
    f.campos.filter((c) => c.visivel).map(nome).join(', '),
    `medidas ${f.medidas.join('/') || '—'}`,
    `${f.estados.length} estado(s) na chegada`,
    f.padroes.modoCodigo ? `código ${f.padroes.modoCodigo}` : '',
  ].filter(Boolean).join(' · ')
}

/** Salva o formulário (admin). null = volta ao padrão. Fica no log com antes → depois. */
export async function salvarFormCompra(ctx: Ctx, d: { form: FormCompraConfig | null }) {
  exigir(ctx.sessao.perfil === 'admin', 'Só o administrador muda o formulário de compra.')
  const antes = await lerFormCompra(ctx)
  const f = d.form
  let depois = FORM_COMPRA_PADRAO
  if (f) {
    exigir(f.layout === 'simples' || f.layout === 'passos', 'Escolha: uma página ou passo a passo.')
    exigir(Array.isArray(f.campos) && f.campos.every((c) => IDS.includes(c.id)), 'Campo desconhecido no formulário.')
    exigir(new Set(f.campos.map((c) => c.id)).size === f.campos.length, 'Campo repetido no formulário.')
    exigir(f.campos.length === IDS.length, 'Faltam campos no formulário.')
    exigir(Array.isArray(f.medidas) && f.medidas.length <= 20 && f.medidas.every((m) => Number.isInteger(m) && m > 0 && m <= 300), 'Medidas favoritas: até 20, de 1 a 300 cm.', 'medidas')
    const estados = (f.estados ?? []).map((e) => String(e ?? '').trim()).filter(Boolean)
    exigir(estados.length <= 30 && estados.every((e) => e.length <= 40), 'Estado na chegada: até 30 opções de até 40 letras.', 'estados')
    exigir(new Set(estados.map((e) => e.toLowerCase())).size === estados.length, 'Há dois estados na chegada iguais.', 'estados')
    const p = f.padroes ?? FORM_COMPRA_PADRAO.padroes
    exigir(!p.moduloId || (ctx.modulos.tem(p.moduloId) && !!ctx.modulos.obter(p.moduloId).compra), 'Módulo padrão sem compras.')
    exigir(!p.moeda || MOEDAS.some((m) => m.codigo === p.moeda), 'Moeda padrão inválida.')
    exigir(!p.modoCodigo || ['incremental', 'porPessoa', 'manual'].includes(p.modoCodigo), 'Tipo de código inválido.')
    exigir(p.modoLinha === 'bruto' || p.modoLinha === 'tabela', 'Linha nova: bruto ou pela tabela.')
    for (const c of f.campos) exigir(!c.obrigatorio || CAMPOS_FORM[c.id].podeObrigar, `${CAMPOS_FORM[c.id].nome} não pode ser obrigatório.`)
    depois = completar({
      layout: f.layout,
      campos: f.campos,
      padroes: { moduloId: p.moduloId || undefined, colunaId: p.colunaId || undefined, moeda: p.moeda || undefined, modoCodigo: p.modoCodigo || undefined, modoLinha: p.modoLinha },
      medidas: [...new Set(f.medidas)].sort((a, b) => a - b),
      estados,
    })
  }
  const r = await ctx.repos.config.obter(ID_CONFIG)
  exigir(JSON.stringify(antes) !== JSON.stringify(depois) || (!f && r), 'Nada mudou.')
  await ctx.repos.config.salvar(r ? tocar(ctx, { ...r, valor: depois }) : novo(ctx, { id: ID_CONFIG, valor: depois }))
  await auditar(ctx, 'salvarFormCompra', ID_CONFIG, f ? `${resumo(antes)} → ${resumo(depois)}` : 'voltou ao padrão')
  return { id: ID_CONFIG }
}
