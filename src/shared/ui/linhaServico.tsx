// SERVIÇOS DO SALÃO na tela: escolher serviço (botões grandes, busca, favoritos e mais usados), criar serviço novo na
// hora, ajustar a linha (preço, insumos, % da comissão) e a MEMÓRIA DO CÁLCULO
// ("Valor 300 − Insumos 20 (Tinta 15 + Água oxigenada 5) = Base 280 → Salão 140 · Profissional 140 (50%, regra do serviço)").
// A memória é interna (tela, venda, extrato): o recibo da cliente no WhatsApp NÃO mostra a divisão.

import { useMemo, useState } from 'react'
import { NOME_REGRA, dividir, memoriaCalculo, nomeComparavel, pct, resolverComissao } from '../../core/domain/comissao'
import { formatar, type TabelaCotacoes } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import type { Item, Linha, Pessoa } from '../../core/domain/tipos'
import { Botao, Campo, Cartao, Entrada, Escolha, Janela, Pilula, Selecao, ValorInput, Vazio, cx } from './base'
import { conv } from './compartilhados'
import { useApp, useComando, useConsulta } from './contexto'
import { useT } from './i18n'

/** o que o atendimento mudou na linha em relação ao catálogo */
export interface AjusteServico {
  /** undefined = insumos do catálogo */
  insumo?: { moeda: string; itens: { nome: string; valor?: number }[]; motivo?: string }
  /** undefined = vale a regra (serviço > profissional > padrão) */
  comissaoBp?: number
  motivoPreco?: string
}

/** Prévia da divisão de uma linha (mesma regra do núcleo), em moeda principal. */
export function previaServico(p: {
  total: number
  moeda: string
  item?: Pick<Item, 'insumo' | 'comissaoBp' | 'unidade'>
  profissional?: Pick<Pessoa, 'comissaoBp'>
  temProfissional: boolean
  padraoBp?: number
  ajuste?: AjusteServico
  cot: TabelaCotacoes
  moedaPrincipal: string
}) {
  const paraP = (v: number, m: string) => conv(v, m, p.moedaPrincipal, p.cot) ?? 0
  const totalPrincipal = paraP(p.total, p.moeda)
  const fonte = p.ajuste?.insumo
    ? p.ajuste.insumo.itens.filter((i) => i.valor).map((i) => ({ nome: i.nome || 'Insumos', valorPrincipal: paraP(i.valor!, p.ajuste!.insumo!.moeda) }))
    : p.item?.insumo?.valor
      ? (p.item.insumo.itens?.length ? p.item.insumo.itens : [{ nome: 'Insumos', valor: p.item.insumo.valor }]).map((i) => ({ nome: i.nome, valorPrincipal: paraP(i.valor, p.item!.insumo!.moeda) }))
      : []
  const insumoPrincipal = fonte.reduce((s, i) => s + i.valorPrincipal, 0)
  const regra = resolverComissao({ profissional: p.temProfissional, servico: p.item?.unidade === 'servico', linhaBp: p.ajuste?.comissaoBp, servicoBp: p.item?.comissaoBp, profissionalBp: p.profissional?.comissaoBp, padraoBp: p.padraoBp })
  const d = dividir(totalPrincipal, insumoPrincipal, regra?.bp)
  const linha: Pick<Linha, 'totalPrincipal' | 'insumoPrincipal' | 'insumos' | 'comissaoBp' | 'comissaoPrincipal' | 'comissaoRegra' | 'baseComissao' | 'parteSalao'> = {
    totalPrincipal,
    insumoPrincipal,
    insumos: fonte,
    comissaoBp: regra?.bp,
    comissaoRegra: regra?.regra,
    comissaoPrincipal: regra?.bp ? d.comissao : undefined,
    baseComissao: d.base,
    parteSalao: regra?.bp ? d.parteSalao : d.base,
  }
  return { linha, insumoCatalogo: p.item?.insumo ? paraP(p.item.insumo.valor, p.item.insumo.moeda) : 0, insumoPrincipal }
}

/** Memória do cálculo de uma linha já gravada (venda, extrato). */
export function MemoriaLinha({ linha, moeda, className, sempre }: { linha: Linha | Parameters<typeof memoriaCalculo>[0]; moeda: string; className?: string; sempre?: boolean }) {
  const t = useT()
  const l = linha as Linha
  if (!sempre && l.comissaoBp === undefined && !l.insumoPrincipal) return null
  return (
    <div className={cx('num text-xs text-[var(--suave)]', className)}>
      🧮 {memoriaCalculo(l, moeda, t)}
      {l.insumoMotivo && <span className="block">{t('Insumos')}: {l.insumoMotivo}</span>}
      {l.motivoPreco && l.precoCatalogo !== undefined && <span className="block">{t('Preço do catálogo')} {formatar(l.precoCatalogo, moeda)} · {l.motivoPreco}</span>}
    </div>
  )
}

/**
 * Ajuste da linha no atendimento: preço (menor que o catálogo pede motivo), insumos (produto especial, quantidade extra:
 * com motivo; baixar do catálogo só o administrador) e % da comissão (administrador, ou funcionária se a configuração deixar).
 */
export function EditorServico(p: {
  item?: Item
  total: number
  moeda: string
  onTotal(v: number): void
  ajuste: AjusteServico
  onAjuste(a: AjusteServico): void
  profissional?: Pessoa
  temProfissional: boolean
  cot: TabelaCotacoes
  moedaPrincipal: string
  padraoBp?: number
  podeMudarComissao: boolean
}) {
  const t = useT()
  const { sessao } = useApp()
  const [aberto, setAberto] = useState(false)
  const prev = previaServico({ ...p, ajuste: p.ajuste })
  const precoCat = p.item?.precoSugerido?.moeda === p.moeda ? p.item.precoSugerido.valor : undefined
  const abaixo = precoCat !== undefined && p.total < precoCat
  const ins = p.ajuste.insumo
  const insumoMudou = !!ins && prev.insumoPrincipal !== prev.insumoCatalogo
  const insumoAbaixo = !!ins && prev.insumoPrincipal < prev.insumoCatalogo
  const itensCatalogo = () =>
    p.item?.insumo?.valor ? (p.item.insumo.itens?.length ? p.item.insumo.itens.map((i) => ({ ...i })) : [{ nome: t('Insumos'), valor: p.item.insumo.valor }]) : []
  const setItens = (itens: { nome: string; valor?: number }[]) => p.onAjuste({ ...p.ajuste, insumo: { moeda: ins?.moeda ?? p.item?.insumo?.moeda ?? p.moedaPrincipal, itens, motivo: ins?.motivo } })
  const itens = ins?.itens ?? itensCatalogo()
  const moedaIns = ins?.moeda ?? p.item?.insumo?.moeda ?? p.moedaPrincipal
  return (
    <div className="mt-1">
      <MemoriaLinha sempre linha={prev.linha} moeda={p.moedaPrincipal} />
      {(abaixo || insumoMudou || p.ajuste.comissaoBp !== undefined) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {abaixo && <Pilula tom="alerta">{t('Abaixo do catálogo')}</Pilula>}
          {insumoMudou && <Pilula tom="marca">{t('Insumos ajustados')}</Pilula>}
          {p.ajuste.comissaoBp !== undefined && <Pilula tom="marca">{t('Comissão ajustada')}</Pilula>}
        </div>
      )}
      <button type="button" className="mt-1 min-h-9 text-xs font-semibold text-[var(--marca)] underline" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? t('Fechar ajuste') : t('Ajustar preço, insumos ou comissão')}
      </button>
      {aberto && (
        <div className="mt-2 space-y-3 rounded-xl bg-[var(--fundo)] p-3">
          <Campo rotulo="Preço" ajuda={precoCat !== undefined ? `${t('Catálogo')}: ${formatar(precoCat, p.moeda)}` : undefined}>
            <ValorInput moeda={p.moeda} valor={p.total} onChange={(v) => v !== undefined && p.onTotal(v)} />
          </Campo>
          {abaixo && (
            <Campo rotulo="Motivo do desconto" ajuda="Fica guardado na venda e no log.">
              <Entrada value={p.ajuste.motivoPreco ?? ''} placeholder={t('Ex.: cliente fiel, promoção')} onChange={(e) => p.onAjuste({ ...p.ajuste, motivoPreco: e.target.value })} />
            </Campo>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--suave)]">{t('Insumos do salão')}</span>
              {ins && <button type="button" className="min-h-9 text-xs text-[var(--marca)] underline" onClick={() => p.onAjuste({ ...p.ajuste, insumo: undefined })}>{t('Voltar ao catálogo')}</button>}
            </div>
            <ul className="space-y-2">
              {itens.map((i, k) => (
                <li key={k} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                  <Entrada aria-label={t('Insumo')} value={i.nome} onChange={(e) => setItens(itens.map((x, j) => (j === k ? { ...x, nome: e.target.value } : x)))} />
                  <ValorInput moeda={moedaIns} valor={i.valor} onChange={(v) => setItens(itens.map((x, j) => (j === k ? { ...x, valor: v } : x)))} />
                  <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-lg hover:bg-[var(--marca-suave)]" onClick={() => setItens(itens.filter((_, j) => j !== k))}>×</button>
                </li>
              ))}
            </ul>
            <Botao variante="leve" className="mt-1" onClick={() => setItens([...itens, { nome: t('Produto especial'), valor: undefined }])}>+ {t('Insumo (produto especial / quantidade extra)')}</Botao>
            {insumoMudou && (
              <Campo rotulo="Motivo dos insumos" className="mt-2">
                <Entrada value={ins?.motivo ?? ''} placeholder={t('Ex.: cabelo longo, tinta extra')} onChange={(e) => p.onAjuste({ ...p.ajuste, insumo: { ...ins!, motivo: e.target.value } })} />
              </Campo>
            )}
            {insumoAbaixo && sessao.perfil !== 'admin' && <p className="mt-1 text-xs font-semibold text-[var(--ruim)]">{t('Só o administrador baixa os insumos abaixo do catálogo.')}</p>}
          </div>
          {p.temProfissional && (
            <Campo rotulo="Comissão da profissional (%)" ajuda={p.podeMudarComissao ? 'Vazio = vale a regra (serviço › profissional › padrão).' : 'Só o administrador muda a comissão.'}>
              <Entrada
                inputMode="decimal"
                disabled={!p.podeMudarComissao}
                value={p.ajuste.comissaoBp !== undefined ? String(p.ajuste.comissaoBp / 100).replace('.', ',') : ''}
                placeholder={prev.linha.comissaoBp !== undefined ? `${pct(prev.linha.comissaoBp)} · ${t(NOME_REGRA[prev.linha.comissaoRegra!])}` : '—'}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(',', '.'))
                  p.onAjuste({ ...p.ajuste, comissaoBp: e.target.value.trim() === '' || !Number.isFinite(n) ? undefined : Math.max(0, Math.min(10000, Math.round(n * 100))) })
                }}
              />
            </Campo>
          )}
        </div>
      )}
    </div>
  )
}

/** pendências do ajuste que o núcleo vai recusar (a tela avisa antes) */
export function faltaNoAjuste(p: { item?: Item; total: number; moeda: string; ajuste: AjusteServico; perfil: string; cot: TabelaCotacoes; moedaPrincipal: string }): string | undefined {
  const precoCat = p.item?.precoSugerido?.moeda === p.moeda ? p.item.precoSugerido.valor : undefined
  if (precoCat !== undefined && p.total < precoCat && p.perfil !== 'admin' && !p.ajuste.motivoPreco?.trim()) return 'Diga o motivo do desconto.'
  if (p.ajuste.insumo) {
    const prev = previaServico({ ...p, temProfissional: false })
    if (prev.insumoPrincipal !== prev.insumoCatalogo && !p.ajuste.insumo.motivo?.trim()) return 'Diga o motivo dos insumos.'
  }
  return undefined
}

/** Entrada do núcleo a partir do ajuste da tela. */
export function ajusteParaEntrada(a: AjusteServico | undefined) {
  if (!a) return {}
  return {
    ...(a.insumo ? { insumo: { moeda: a.insumo.moeda, itens: a.insumo.itens.filter((i) => i.valor).map((i) => ({ nome: i.nome, valor: i.valor! })), motivo: a.insumo.motivo } } : {}),
    ...(a.comissaoBp !== undefined ? { comissaoBp: a.comissaoBp } : {}),
    ...(a.motivoPreco?.trim() ? { motivoPreco: a.motivoPreco.trim() } : {}),
  }
}

// ---------- escolher serviço: botões grandes, busca, favoritos e mais usados ----------

const CHAVE_USO = 'tudo.servicosUso'
const CHAVE_FAV = 'tudo.servicosFav'
function ler<T>(k: string, padrao: T): T {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? padrao
  } catch {
    return padrao
  }
}
function gravar(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/** Serviços do salão como botões grandes (mobile): favoritos e mais usados primeiro; busca; "+ Serviço novo". */
export function SeletorServicos({ moeda, onAdd, rotulo = 'O que vai fazer?' }: { moeda: string; onAdd(item: Item, preco: number): void; rotulo?: string }) {
  const t = useT()
  const { dados: itens } = useConsulta('catalogo', { moduloId: 'salao' })
  const [busca, setBusca] = useState('')
  const [uso, setUso] = useState<Record<string, number>>(() => ler(CHAVE_USO, {}))
  const [fav, setFav] = useState<string[]>(() => ler(CHAVE_FAV, []))
  const [novo, setNovo] = useState<string>()
  const { sessao } = useApp()
  const { executar, ocupado } = useComando()
  const lista = useMemo(() => {
    const b = nomeComparavel(busca)
    return (itens ?? [])
      .filter((i) => i.ativo && i.unidade === 'servico')
      .filter((i) => !b || nomeComparavel(`${i.nome} ${i.campos.categoria ?? ''}`).includes(b))
      .sort((a, c) => Number(fav.includes(c.id)) - Number(fav.includes(a.id)) || (uso[c.id] ?? 0) - (uso[a.id] ?? 0) || a.nome.localeCompare(c.nome, 'pt-BR'))
  }, [itens, busca, uso, fav])
  const usar = (i: Item, preco: number) => {
    const u = { ...uso, [i.id]: (uso[i.id] ?? 0) + 1 }
    setUso(u)
    gravar(CHAVE_USO, u)
    onAdd(i, preco)
  }
  const alternarFav = (id: string) => {
    const f = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id]
    setFav(f)
    gravar(CHAVE_FAV, f)
  }
  return (
    <Cartao titulo={t(rotulo)} acao={<Botao variante="secundario" onClick={() => setNovo(busca)}>+ {t('Serviço novo')}</Botao>}>
      <Entrada type="search" aria-label={t('Buscar serviço')} placeholder={t('Buscar serviço…')} value={busca} onChange={(e) => setBusca(e.target.value)} />
      {!lista.length ? (
        <div className="mt-3">
          <Vazio texto={busca ? 'Nenhum serviço com esse nome.' : 'Nenhum serviço cadastrado neste módulo.'}>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Botao onClick={() => setNovo(busca)}>+ {t('Serviço novo')}{busca ? `: ${busca}` : ''}</Botao>
              {!busca && sessao.perfil === 'admin' && <Botao variante="secundario" disabled={ocupado} onClick={() => executar('restaurarBibliotecaServicos', {}, t('Serviços comuns carregados.'))}>{t('Carregar serviços comuns')}</Botao>}
            </div>
          </Vazio>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {lista.map((i) => {
            const preco = i.precoSugerido?.valor ?? 0
            const m = i.precoSugerido?.moeda ?? moeda
            return (
              <li key={i.id} className="relative">
                <button type="button" onClick={() => usar(i, preco)} className="flex min-h-20 w-full flex-col items-start justify-between rounded-2xl border-2 border-[var(--borda)] bg-[var(--cartao)] p-3 pr-9 text-left hover:border-[var(--marca)] active:bg-[var(--marca-suave)]">
                  <span className="font-bold leading-tight">{i.nome}</span>
                  <span className="num text-sm text-[var(--suave)]">
                    {formatar(preco, m)}
                    {i.insumo?.valor ? ` · ${t('insumos')} ${formatar(i.insumo.valor, i.insumo.moeda)}` : ''}
                  </span>
                  {!!i.campos.revisar && <span className="text-[10px] font-semibold text-[var(--alerta)]">{t('Novo · revisar')}</span>}
                </button>
                <button type="button" aria-label={t(fav.includes(i.id) ? 'Tirar dos favoritos' : 'Favoritar')} aria-pressed={fav.includes(i.id)} onClick={() => alternarFav(i.id)} className="absolute right-1 top-1 min-h-9 min-w-9 rounded-full text-lg">
                  {fav.includes(i.id) ? '★' : '☆'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {novo !== undefined && (
        <NovoServico
          nomeInicial={novo}
          moeda={moeda}
          existentes={(itens ?? []).filter((i) => i.unidade === 'servico')}
          onFechar={() => setNovo(undefined)}
          onUsar={(i, preco) => {
            setNovo(undefined)
            setBusca('')
            usar(i, preco)
          }}
        />
      )}
    </Cartao>
  )
}

/** "+ Serviço novo" no atendimento: nome e preço (o resto é opcional). Guarda no catálogo ou vale só para este atendimento. */
export function NovoServico({ nomeInicial, moeda, existentes, onFechar, onUsar }: { nomeInicial: string; moeda: string; existentes: Item[]; onFechar(): void; onUsar(i: Item, preco: number): void }) {
  const t = useT()
  const { sessao } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [nome, setNome] = useState(nomeInicial)
  const [preco, setPreco] = useState<number>()
  const [mais, setMais] = useState(false)
  const [duracao, setDuracao] = useState('')
  const [insumo, setInsumo] = useState<number>()
  const [categoria, setCategoria] = useState('')
  const [comissao, setComissao] = useState('')
  const [guardar, setGuardar] = useState<'catalogo' | 'so'>('catalogo')
  const igual = nome.trim() ? existentes.find((i) => !i.campos.avulso && nomeComparavel(i.nome) === nomeComparavel(nome)) : undefined
  const podeComissao = sessao.perfil === 'admin' || !!cfg?.config.comissaoFuncionarioMuda
  const criar = async () => {
    if (!preco || !nome.trim()) return
    const id = novoId()
    const n = Number(comissao.replace(',', '.'))
    const d = {
      id,
      nome: nome.trim(),
      preco: { moeda, valor: preco },
      duracaoMin: Number(duracao) || undefined,
      categoria: categoria || undefined,
      insumo: insumo ? { moeda, valor: insumo } : undefined,
      comissaoBp: podeComissao && comissao.trim() && Number.isFinite(n) ? Math.round(n * 100) : undefined,
      guardar: guardar === 'catalogo',
    }
    const r = await executar('criarServicoRapido', d, t(guardar === 'catalogo' ? 'Serviço guardado no catálogo.' : 'Serviço só para este atendimento.'))
    if (!r) return
    const agora = new Date().toISOString()
    onUsar(
      {
        id,
        empresaId: '',
        criadoEm: agora,
        atualizadoEm: agora,
        criadoPor: sessao.usuarioId,
        versao: 1,
        moduloId: 'salao',
        tipoItem: 'servico',
        nome: d.nome,
        unidade: 'servico',
        controlaEstoque: false,
        ativo: true,
        saldo: 0,
        precoSugerido: d.preco,
        duracaoMin: d.duracaoMin,
        comissaoBp: d.comissaoBp,
        insumo: d.insumo,
        campos: { categoria: d.categoria },
      },
      preco,
    )
  }
  const categorias = ['Corte', 'Cor', 'Tratamento', 'Mega hair', 'Escova', 'Estética', 'Unhas', 'Maquiagem', 'Penteado', 'Barba', 'Outro']
  return (
    <Janela aberta titulo={t('Serviço novo')} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !preco || !nome.trim() || !!igual} onClick={criar}>{t('Criar e adicionar')}</Botao>}>
      <div className="space-y-3">
        <Campo rotulo="Nome do serviço">
          <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('Ex.: Botox capilar')} />
        </Campo>
        {igual && (
          <div className="rounded-xl bg-[var(--alerta)]/10 p-2 text-sm">
            <b>{t('Já existe')}: {igual.nome}</b>
            {igual.precoSugerido && <span className="num"> ({formatar(igual.precoSugerido.valor, igual.precoSugerido.moeda)})</span>}
            <Botao className="ml-2" variante="secundario" onClick={() => onUsar(igual, igual.precoSugerido?.valor ?? 0)}>{t('Usar este')}</Botao>
          </div>
        )}
        <Campo rotulo="Preço">
          <ValorInput moeda={moeda} valor={preco} onChange={setPreco} />
        </Campo>
        <Campo rotulo="Onde fica?" comoDiv>
          <Escolha<'catalogo' | 'so'> rotulo="Onde fica?" valor={guardar} onChange={setGuardar} opcoes={[{ id: 'catalogo', nome: 'Guardar no catálogo' }, { id: 'so', nome: 'Só para este atendimento' }]} />
          {guardar === 'catalogo' && sessao.perfil !== 'admin' && <p className="mt-1 text-xs text-[var(--suave)]">{t('Entra no catálogo como "criado por {nome}" para o administrador revisar.', { nome: sessao.nome })}</p>}
        </Campo>
        {!mais ? (
          <Botao variante="leve" onClick={() => setMais(true)}>+ {t('Duração, insumos, comissão, tipo')}</Botao>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Duração (min)">
              <Entrada inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ''))} />
            </Campo>
            <Campo rotulo="Insumos do salão" ajuda="Custo fixo de materiais (tinta, água oxigenada…): sai antes da comissão.">
              <ValorInput moeda={moeda} valor={insumo} onChange={setInsumo} />
            </Campo>
            <Campo rotulo="Tipo">
              <Selecao valor={categoria} onChange={setCategoria} vazio="—" opcoes={categorias.map((c) => ({ id: c, nome: c }))} />
            </Campo>
            {podeComissao && (
              <Campo rotulo="Comissão própria (%)" ajuda="Vazio = regra padrão.">
                <Entrada inputMode="decimal" value={comissao} onChange={(e) => setComissao(e.target.value)} />
              </Campo>
            )}
          </div>
        )}
      </div>
    </Janela>
  )
}

