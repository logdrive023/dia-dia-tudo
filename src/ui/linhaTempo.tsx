// LINHA DO TEMPO como LISTA: um evento por linha, agrupado por dia (mais novo em cima, ou o mais antigo se pedir).
// Em cima, filtros que ficam no endereço (tipo, quem, período, busca). Cada linha é curta — ícone · o quê · hora ·
// quem · valor — e "detalhes ▾" abre a ficha completa: antes → movimentou → depois, etapa, motivo, ajustes,
// pagamentos, itens, anexo e as referências clicáveis (lote, venda, compra, triagem, viagem, adiantamento).

import { useState } from 'react'
import { CartaoEvento, SeloEvento, DetalhesEvento, BlocoDetalhe, AntesDepois, BotaoReferencia, CabecalhoDia, ListaEventos, type TomEvento } from './cartaoEvento'
import { BarraFiltros, ChipsFiltros, PainelFiltros, GrupoFiltro, CampoFaixa } from './filtroPadrao'
import { formatar } from '../core/domain/dinheiro'
import type { EventoTempo } from '../core/services/historico'
import { Botao, Info, cx, gramasTexto, loc, Vazio, BotaoExpandir, Campo, Selecao, Entrada, diaMes } from './base'
import { baixarCSV } from './csv'
import { useApp, useConsulta } from './contexto'
import { useT } from './i18n'

const ICONES = { etapa: '🔁', acao: '✳️', anexo: '📎', estoque: '📦', caixa: '💵', conta: '📒', correcao: '✏️' } as const
const NOMES = { etapa: 'Etapas', acao: 'Ações', anexo: 'Arquivos', estoque: 'Estoque', caixa: 'Dinheiro', conta: 'Conta', correcao: 'Correções' } as const
/** ordem dos chips de tipo */
const FILTROS = ['etapa', 'estoque', 'caixa', 'conta', 'anexo', 'acao', 'correcao'] as const
type Filtro = (typeof FILTROS)[number]

type Ev = EventoTempo & { refs?: EventoTempo['ref'][]; grupo?: EventoTempo[] }

function quantidade(q: number, u?: string) {
  const sinal = q < 0 ? '−' : ''
  if (u === 'grama') return sinal + gramasTexto(Math.abs(q))
  return `${sinal}${Math.abs(q).toLocaleString(loc())}${u === 'peca' ? ' un.' : ''}`
}

/** quantidade ou dinheiro do saldo (antes → depois) */
function medida(n: number, s: NonNullable<EventoTempo['saldo']>, comSinal = false) {
  const txt = s.moeda && !s.unidade ? formatar(Math.abs(n), s.moeda) : quantidade(Math.abs(n), s.unidade)
  return (n < 0 ? '−' : comSinal && n > 0 ? '+' : '') + txt
}

/** Lotes que entraram/saíram no mesmo minuto viram um evento só, com a lista de lotes (os originais ficam em `grupo`). */
function juntar(eventos: EventoTempo[]) {
  const r: Ev[] = []
  for (const e of eventos) {
    const ant = r[r.length - 1]
    if (ant && e.tipo === 'estoque' && ant.tipo === 'estoque' && ant.titulo === e.titulo && ant.em.slice(0, 16) === e.em.slice(0, 16) && e.itens) {
      r[r.length - 1] = {
        ...ant,
        itens: [...(ant.itens ?? []), ...e.itens],
        detalhe: undefined,
        ref: undefined,
        saldo: undefined,
        refs: [...(ant.refs ?? (ant.ref ? [ant.ref] : [])), ...(e.ref ? [e.ref] : [])],
        grupo: [...(ant.grupo ?? [ant]), e],
        links: [...(ant.links ?? []), ...(e.links ?? [])].filter((l, i, a) => a.findIndex((x) => x.tela === l.tela && x.params?.id === l.params?.id) === i),
      }
    } else r.push(e)
  }
  return r
}

const passa = (e: Ev, f: Filtro) => (f === 'correcao' ? !!e.correcao : e.tipo === f)
const dataCompleta = (em: string) =>
  `${new Date(em).toLocaleDateString(loc(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
/** texto livre do evento (o que não é código interno "saldo:"/"antes:") */
const textoLivre = (e: EventoTempo) => e.texto ?? (e.detalhe && !e.detalhe.startsWith('saldo:') && !e.detalhe.startsWith('antes:') ? e.detalhe : undefined)

/**
 * `prefixo`: nome dos filtros no endereço (#/pedidos/P1?aba=historico&ltTipo=estoque&ltQuem=Paula…). Duas linhas do
 * tempo na mesma tela com o mesmo prefixo dividem os filtros.
 */
/** `simples`: só a lista (sem a fileira de filtros e busca) — dentro do Caminho do cabelo, onde o filtro é o das etapas */
export function LinhaDoTempo({ id, prefixo = 'lt', simples }: { id: string; prefixo?: string; simples?: boolean }) {
  const t = useT()
  const { nav, ajustarParams } = useApp()
  const { dados } = useConsulta('linhaDoTempo', { id })
  const [tudo, setTudo] = useState(false)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [verFiltros, setVerFiltros] = useState(false)
  const k = (c: string) => `${prefixo}${c}`
  const param = (c: string) => (nav.params[k(c)] as string | undefined) ?? ''
  const filtro = param('Tipo') as Filtro | ''
  const quem = param('Quem')
  const de = param('De')
  const ate = param('Ate')
  const busca = param('Busca')
  const antigoPrimeiro = param('Ordem') === 'antigo'
  const definir = (c: string, v: string) => ajustarParams({ [k(c)]: v || undefined })
  const ativo = !!(filtro || quem || de || ate || busca)
  const limpar = () => ajustarParams({ [k('Tipo')]: undefined, [k('Quem')]: undefined, [k('De')]: undefined, [k('Ate')]: undefined, [k('Busca')]: undefined })

  if (!dados) return null
  if (!dados.length) return <Vazio compacto texto="Nada registrado ainda." />

  const todos = juntar(dados)
  const pessoas = [...new Set(todos.map((e) => e.por).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, loc()))
  const termo = busca.trim().toLowerCase()
  const buscavel = (e: Ev) =>
    [
      e.titulo, t(e.titulo), e.detalhe, e.texto, e.por, e.motivo, e.de, e.para, e.categoria, e.anexo?.nome,
      ...(e.ajustes ?? []), ...(e.itens ?? []).map((i) => i.texto), ...(e.links ?? []).map((l) => l.rotulo), ...(e.pagamentos ?? []).map((p) => p.forma),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  // tipo fica de fora desta base para os chips contarem o que sobra com os outros filtros
  const base = todos.filter(
    (e) => (!quem || e.por === quem) && (!de || e.em.slice(0, 10) >= de) && (!ate || e.em.slice(0, 10) <= ate) && (!termo || buscavel(e).includes(termo)),
  )
  const filtrados = base.filter((e) => !filtro || passa(e, filtro))
  const lista = antigoPrimeiro ? filtrados : [...filtrados].reverse()
  const visiveis = tudo ? lista : lista.slice(0, 15)
  const chaveDe = (e: Ev, i: number) => e.chave ?? `${e.em}-${i}`
  const dias = new Map<string, { e: Ev; c: string }[]>()
  visiveis.forEach((e, i) => dias.set(e.em.slice(0, 10), [...(dias.get(e.em.slice(0, 10)) ?? []), { e, c: chaveDe(e, i) }]))
  const tudoAberto = visiveis.length > 0 && visiveis.every((e, i) => abertos.has(chaveDe(e, i)))
  const alternar = (c: string) => setAbertos((s) => {
    const n = new Set(s)
    if (n.has(c)) n.delete(c)
    else n.add(c)
    return n
  })
  const exportar = () =>
    baixarCSV(
      `historico-${id}`,
      lista.map((e) => ({
        data: e.em.slice(0, 10),
        hora: new Date(e.em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tipo: t(NOMES[e.tipo]),
        categoria: e.categoria ? t(e.categoria) : '',
        correcao: e.correcao ? t('Sim') : '',
        evento: t(e.titulo),
        de: e.de ? t(e.de) : '',
        para: e.para ? t(e.para) : '',
        quem: e.por ?? '',
        valor: e.valor ? formatar(e.valor.valor, e.valor.moeda, { semSimbolo: true }) : '',
        moeda: e.valor?.moeda ?? '',
        forma: e.valor?.forma ? t(e.valor.forma) : '',
        saldo: e.saldo ? t(e.saldo.rotulo) : '',
        antes: e.saldo ? medida(e.saldo.antes, e.saldo) : '',
        movimentou: e.saldo ? medida(e.saldo.delta, e.saldo, true) : '',
        depois: e.saldo ? medida(e.saldo.depois, e.saldo) : '',
        itens: (e.itens ?? []).map((i) => `${i.texto}${i.quantidade !== undefined ? ` ${quantidade(i.quantidade, i.unidade)}` : ''}${i.valor !== undefined && i.moeda ? ` ${formatar(i.valor, i.moeda)}` : ''}`).join(' | '),
        pagamentos: (e.pagamentos ?? []).map((p) => `${t(p.forma)} ${formatar(p.valor, p.moeda)}${p.cotacao ? ` (${p.cotacao})` : ''}`).join(' | '),
        motivo: e.motivo ?? '',
        ajustes: (e.ajustes ?? []).join(' | '),
        descricao: textoLivre(e) ?? '',
        anexo: e.anexo?.nome ?? '',
        referencias: (e.links ?? []).map((l) => t(l.rotulo)).join(' | '),
      })),
    )

  const chip = (on: boolean) => cx('min-h-10 whitespace-nowrap rounded-full px-3 text-sm font-semibold', on ? 'bg-[var(--marca)] text-white' : 'bg-[var(--marca-suave)] text-[var(--marca)]')
  const contagem = (f: Filtro) => base.filter((e) => passa(e, f)).length
  return (
    <div>
      {/* filtros (no endereço: voltar para a tela reencontra os mesmos) */}
      <div className={cx('mb-3 space-y-2', simples && 'hidden')}>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:flex-wrap" role="group" aria-label={t('Filtrar')}>
          <button type="button" aria-pressed={!filtro} onClick={() => definir('Tipo', '')} className={chip(!filtro)}>{t('Tudo')} <span className="num">{base.length}</span></button>
          {FILTROS.filter((f) => f === filtro || contagem(f) > 0).map((f) => (
            <button key={f} type="button" aria-pressed={filtro === f} onClick={() => definir('Tipo', filtro === f ? '' : f)} className={chip(filtro === f)}>
              {ICONES[f]} {t(NOMES[f])} <span className="num">{contagem(f)}</span>
            </button>
          ))}
        </div>
        <BarraFiltros busca={busca} onBusca={(v) => definir('Busca', v)} placeholder="Buscar código ou texto" ativos={(quem ? 1 : 0) + (de || ate ? 1 : 0)} aberto={verFiltros} onAlternar={() => setVerFiltros(!verFiltros)} />
        <ChipsFiltros
          itens={[...(quem ? [{ k: 'Quem', rotulo: `👤 ${quem}` }] : []), ...(de || ate ? [{ k: 'De,Ate', rotulo: `📅 ${de ? diaMes(de) : '…'} – ${ate ? diaMes(ate) : '…'}` }] : [])]}
          onTirar={(k) => k.split(',').forEach((x) => definir(x as 'Quem', ''))}
          onLimpar={limpar}
        />
        {verFiltros && (
          <PainelFiltros resultados={filtrados.length} temAtivos={!!(quem || de || ate)} onLimpar={limpar} onFechar={() => setVerFiltros(false)} exportar={{ onExportar: exportar, quantos: lista.length, unidade: 'registro(s)' }}>
            <GrupoFiltro titulo="Quem" icone="👤">
              <Campo rotulo="Quem fez"><Selecao valor={quem} onChange={(v) => definir('Quem', v)} vazio="Todos" opcoes={pessoas.map((p) => ({ id: p, nome: p }))} /></Campo>
            </GrupoFiltro>
            <GrupoFiltro titulo="Quando" icone="📅">
              <CampoFaixa rotulo="Período">
                <Entrada type="date" aria-label={t('De')} value={de} max={ate || undefined} onChange={(e) => definir('De', e.target.value)} />
                <Entrada type="date" aria-label={t('Até')} value={ate} min={de || undefined} onChange={(e) => definir('Ate', e.target.value)} />
              </CampoFaixa>
            </GrupoFiltro>
          </PainelFiltros>
        )}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          <span className="mr-auto inline-flex items-center text-[var(--suave)]">
            <span className="num">{ativo ? t('{n} de {total}', { n: filtrados.length, total: todos.length }) : t('{n} evento(s)', { n: todos.length })}</span>
            <Info texto="Tudo o que aconteceu neste registro. Toque em detalhes para ver antes → depois. Ex.: Conferido 10.000 → 9.850 g por Paula." />
          </span>
          {ativo && <button type="button" onClick={limpar} className="min-h-10 rounded-lg px-2 font-semibold text-[var(--ruim)] hover:bg-[var(--marca-suave)]">✕ {t('Limpar')}</button>}
          <button type="button" aria-pressed={antigoPrimeiro} onClick={() => definir('Ordem', antigoPrimeiro ? '' : 'antigo')} className="min-h-10 whitespace-nowrap rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
            {antigoPrimeiro ? `↑ ${t('Mais antigo primeiro')}` : `↓ ${t('Mais novo primeiro')}`}
          </button>
          {visiveis.length > 0 && (
            <BotaoExpandir aberto={tudoAberto} onClick={() => setAbertos(tudoAberto ? new Set() : new Set(visiveis.map(chaveDe)))} rotuloAberto={t('Recolher tudo')} className="whitespace-nowrap">{t('Expandir tudo')}</BotaoExpandir>
          )}
        </div>
      </div>

      {!lista.length ? (
        <div className="rounded-2xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">
          <p>{t('Nada com esses filtros.')}</p>
          {ativo && <Botao variante="leve" className="mt-1" onClick={limpar}>{t('Limpar')}</Botao>}
        </div>
      ) : (
        <div className="space-y-5">
          {[...dias].map(([dia, evs]) => (
            <section key={dia} aria-label={dia}>
              <CabecalhoDia data={dia} quantos={evs.length} />
              <ListaEventos>
                {evs.map(({ e, c }) => <Evento key={c} e={e} daTela={id} aberto={abertos.has(c)} onAlternar={() => alternar(c)} />)}
              </ListaEventos>
            </section>
          ))}
        </div>
      )}
      {!tudo && lista.length > visiveis.length && <Botao variante="leve" className="mt-2" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: lista.length })}</Botao>}
    </div>
  )
}

/** cor do evento: entrou/recebeu = verde, saiu/pagou = vermelho, correção = alerta, o resto na cor da marca */
function tomDe(e: Ev, n?: number): TomEvento {
  if (e.correcao) return 'alerta'
  if (n !== undefined && (e.tipo === 'estoque' || e.tipo === 'caixa' || e.tipo === 'conta')) return n > 0 ? 'bom' : n < 0 ? 'ruim' : 'suave'
  if (e.tipo === 'anexo' || e.tipo === 'acao') return 'suave'
  return 'marca'
}

/** Um evento da linha do tempo, no cartão padrão (CartaoEvento): o que foi, o número, os selos, a referência. */
function Evento({ e, daTela, aberto, onAlternar }: { e: Ev; daTela: string; aberto: boolean; onAlternar(): void }) {
  const t = useT()
  const { ir } = useApp()
  const hora = new Date(e.em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
  const totalAntes = e.detalhe?.startsWith('antes:') ? Number(e.detalhe.slice(6)) : undefined
  const unidade = e.itens?.[0]?.unidade
  const mesmaUnidade = !!e.itens?.length && e.itens.every((it) => it.quantidade !== undefined && it.unidade === unidade)
  const totalQtd = mesmaUnidade ? e.itens!.reduce((s, it) => s + (it.quantidade ?? 0), 0) : undefined
  const comSinal = e.tipo === 'caixa' || e.tipo === 'conta'
  // o número que importa: o dinheiro do evento ou, no estoque, quanto entrou/saiu
  const numero = e.valor ? e.valor.valor : e.tipo === 'estoque' ? totalQtd : undefined
  const valor = e.valor
    ? `${comSinal && e.valor.valor > 0 ? '+' : ''}${formatar(e.valor.valor, e.valor.moeda)}`
    : totalQtd !== undefined && e.tipo === 'estoque' ? `${totalQtd > 0 ? '+' : ''}${quantidade(totalQtd, unidade)}` : undefined
  const resumo = e.itens?.length === 1 ? e.itens[0].texto : e.itens && e.itens.length > 1 ? t('{n} item(ns)', { n: e.itens.length }) : textoLivre(e)
  const links = linksDe(e, daTela)
  return (
    <CartaoEvento
      icone={e.correcao && e.tipo !== 'etapa' ? ICONES.correcao : ICONES[e.tipo]}
      tom={tomDe(e, numero)}
      titulo={t(e.titulo)}
      etapa={e.para ? { de: e.de, para: e.para } : undefined}
      resumo={resumo}
      selos={[
        <SeloEvento key="h" icone="🕒">{hora}</SeloEvento>,
        e.por && <SeloEvento key="p" icone="👤">{e.por}</SeloEvento>,
        e.valor?.forma && <SeloEvento key="f" icone="💳">{t(e.valor.forma)}</SeloEvento>,
        e.correcao && <SeloEvento key="c" icone={ICONES.correcao}>{t('Correção')}</SeloEvento>,
      ]}
      valor={valor}
      valorTom={comSinal || e.tipo === 'estoque' ? tomDe({ ...e, correcao: undefined }, numero) : undefined}
      valorAntes={totalAntes !== undefined && e.valor ? formatar(totalAntes, e.valor.moeda) : undefined}
      // referência à vista: leva direto ao que foi catalogado (sem abrir os detalhes)
      referencia={links.length ? { rotulo: t(links[0].rotulo), abrir: () => ir(links[0].tela, links[0].params ?? {}), mais: links.length - 1 } : undefined}
      aberto={aberto}
      onAlternar={onAlternar}
    >
      <Detalhes e={e} daTela={daTela} />
    </CartaoEvento>
  )
}

/** As referências do evento (para onde ele leva): os links dele ou, sem links, o registro de origem. Nunca a própria
 * tela ("↗ V-0004" dentro da V-0004 não leva a lugar nenhum). */
function linksDe(e: Ev, daTela?: string) {
  return linksTodos(e).filter((l) => !daTela || String(l.params?.id ?? '') !== daTela)
}
function linksTodos(e: Ev) {
  return e.links?.length ? e.links : e.ref ? [{ tipo: e.ref.tela, tela: e.ref.tela, params: { id: e.ref.id }, rotulo: e.ref.tela === 'venda' ? 'Abrir venda' : e.ref.tela === 'lote' ? 'Abrir lote' : 'Abrir' }] : []
}

const ICONE_LINK: Record<string, string> = { lote: '📦', venda: '🧾', compra: '🛒', triagem: '🧺', viagem: '🧳', adiantamento: '🤝', pessoa: '👤', emprestimo: '💸', caixa: '💵' }

/** Ficha do evento: cada informação num bloco (rótulo em cima, valor embaixo); o "antes → depois" primeiro e largo. */
function Detalhes({ e, daTela }: { e: Ev; daTela: string }) {
  const t = useT()
  const { ir } = useApp()
  const unidade = e.itens?.[0]?.unidade
  const texto = textoLivre(e)
  const saldos = e.grupo ? e.grupo.filter((g) => g.saldo) : e.saldo ? [e] : []
  const links = linksDe(e, daTela)
  const somaItens = !!e.itens && e.itens.length > 1 && e.itens.every((it) => it.quantidade !== undefined && it.unidade === unidade)
  return (
    <DetalhesEvento>
      {saldos.length > 0 && (
        <BlocoDetalhe rotulo="O que mudou" largo>
          <div className="space-y-2">
            {saldos.map((g, i) => (
              <AntesDepois
                key={i}
                rotulo={saldos.length > 1 || g.saldo!.rotulo !== 'Total' ? t(g.saldo!.rotulo) : undefined}
                antes={medida(g.saldo!.antes, g.saldo!)}
                mudou={medida(g.saldo!.delta, g.saldo!, true)}
                depois={medida(g.saldo!.depois, g.saldo!)}
                negativo={g.saldo!.delta < 0}
              />
            ))}
          </div>
        </BlocoDetalhe>
      )}
      {!!e.itens?.length && (
        <BlocoDetalhe rotulo="Itens" largo>
          <ul className="divide-y divide-[var(--borda)]">
            {e.itens.map((it, k) => (
              <li key={k} className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                {e.refs?.[k] ? (
                  <button type="button" onClick={() => ir(e.refs![k]!.tela, { id: e.refs![k]!.id })} className="min-w-0 text-left font-semibold text-[var(--marca)] hover:underline">{it.texto} →</button>
                ) : (
                  <span className="min-w-0 break-words">{it.texto}</span>
                )}
                <span className="num shrink-0 text-right">
                  {it.quantidade !== undefined && <b>{quantidade(it.quantidade, it.unidade)}</b>}
                  {it.valor !== undefined && it.moeda && <span className="ml-2 text-[var(--suave)]">{formatar(it.valor, it.moeda)}</span>}
                </span>
              </li>
            ))}
            {somaItens && (
              <li className="flex justify-between gap-3 pt-1.5 font-bold">
                <span>{t('Total')} · {t('{n} item(ns)', { n: e.itens.length })}</span>
                <span className="num">{quantidade(e.itens.reduce((s, it) => s + (it.quantidade ?? 0), 0), unidade)}</span>
              </li>
            )}
          </ul>
        </BlocoDetalhe>
      )}
      {!!e.pagamentos?.length && (
        <BlocoDetalhe rotulo="Pagamentos" largo>
          <ul className="space-y-1">
            {e.pagamentos.map((p, k) => (
              <li key={k} className="num flex flex-wrap items-baseline justify-between gap-x-3">
                <span>{t(p.forma)}{p.cotacao && <span className="text-[var(--suave)]"> · {t('Cotação')} {p.cotacao}</span>}</span>
                <span><b>{formatar(p.valor, p.moeda)}</b>{p.valorPrincipal !== undefined && p.moedaPrincipal && <span className="text-[var(--suave)]"> ≈ {formatar(p.valorPrincipal, p.moedaPrincipal)}</span>}</span>
              </li>
            ))}
          </ul>
        </BlocoDetalhe>
      )}
      <BlocoDetalhe rotulo="Quando"><span className="num">{dataCompleta(e.em)}</span></BlocoDetalhe>
      <BlocoDetalhe rotulo="Tipo">
        <b>{ICONES[e.tipo]} {t(NOMES[e.tipo])}</b>
        {e.categoria && <span className="text-[var(--suave)]"> · {t(e.categoria)}</span>}
      </BlocoDetalhe>
      {e.valor && (
        <BlocoDetalhe rotulo="Valor">
          <b className="num">{formatar(e.valor.valor, e.valor.moeda)}</b>
          {e.valor.forma && <span className="text-[var(--suave)]"> · {t(e.valor.forma)}</span>}
        </BlocoDetalhe>
      )}
      {(e.de || e.para) && (
        <BlocoDetalhe rotulo="Etapa">{e.de ? <span className="text-[var(--suave)]">{t(e.de)} → </span> : null}<b>{e.para ? t(e.para) : '—'}</b></BlocoDetalhe>
      )}
      {e.motivo && <BlocoDetalhe rotulo="Motivo">{e.motivo}</BlocoDetalhe>}
      {!!e.ajustes?.length && (
        <BlocoDetalhe rotulo="Ajustes" largo>
          <ul className="list-disc space-y-0.5 pl-4">{e.ajustes.map((a, k) => <li key={k}>{a}</li>)}</ul>
        </BlocoDetalhe>
      )}
      {e.anexo && (
        <BlocoDetalhe rotulo="Anexo">
          📎 {e.anexo.nome}
          <span className="text-[var(--suave)]">
            {e.anexo.mime && <> · {e.anexo.mime}</>}
            {e.anexo.tamanho !== undefined && <> · <span className="num">{Math.max(1, Math.round(e.anexo.tamanho / 1024)).toLocaleString(loc())} KB</span></>}
          </span>
        </BlocoDetalhe>
      )}
      {texto && <BlocoDetalhe rotulo="Descrição" largo>{texto}</BlocoDetalhe>}
      {links.length > 0 && (
        <BlocoDetalhe rotulo="Referências" largo>
          <div className="flex flex-wrap gap-1.5">
            {links.map((l, k) => <BotaoReferencia key={k} icone={ICONE_LINK[l.tipo]} onClick={() => ir(l.tela, l.params ?? {})}>{t(l.rotulo)}</BotaoReferencia>)}
          </div>
        </BlocoDetalhe>
      )}
    </DetalhesEvento>
  )
}
