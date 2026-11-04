// LINHA DO TEMPO como LISTA: um evento por linha, agrupado por dia (mais novo em cima, ou o mais antigo se pedir).
// Em cima, filtros que ficam no endereço (tipo, quem, período, busca). Cada linha é curta — ícone · o quê · hora ·
// quem · valor — e "detalhes ▾" abre a ficha completa: antes → movimentou → depois, etapa, motivo, ajustes,
// pagamentos, itens, anexo e as referências clicáveis (lote, venda, compra, triagem, viagem, adiantamento).

import { useState } from 'react'
import { BarraFiltros, ChipsFiltros, PainelFiltros, GrupoFiltro, CampoFaixa } from './filtroPadrao'
import { formatar } from '../core/domain/dinheiro'
import type { EventoTempo } from '../core/services/historico'
import { Botao, Info, cx, gramasTexto, loc, Pilula, Vazio, TituloSecao, BotaoExpandir, Campo, Selecao, Entrada, diaMes } from './base'
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
          <PainelFiltros resultados={filtrados.length} temAtivos={!!(quem || de || ate)} onLimpar={limpar} onFechar={() => setVerFiltros(false)}>
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
          {lista.length > 0 && <button type="button" onClick={exportar} className="min-h-10 whitespace-nowrap rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">⬇ {t('Exportar CSV')}</button>}
        </div>
      </div>

      {!lista.length ? (
        <div className="rounded-2xl border border-dashed border-[var(--borda)] p-4 text-center text-sm text-[var(--suave)]">
          <p>{t('Nada com esses filtros.')}</p>
          {ativo && <Botao variante="leve" className="mt-1" onClick={limpar}>{t('Limpar')}</Botao>}
        </div>
      ) : (
        <div className="space-y-4">
          {[...dias].map(([dia, evs]) => (
            <section key={dia}>
              <TituloSecao className="mb-1">
                {new Date(dia + 'T12:00:00').toLocaleDateString(loc(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </TituloSecao>
              <ul className="divide-y divide-[var(--borda)] rounded-2xl border border-[var(--borda)]">
                {evs.map(({ e, c }) => <Evento key={c} e={e} aberto={abertos.has(c)} onAlternar={() => alternar(c)} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      {!tudo && lista.length > visiveis.length && <Botao variante="leve" className="mt-2" onClick={() => setTudo(true)}>{t('Ver tudo ({n})', { n: lista.length })}</Botao>}
    </div>
  )
}

function Evento({ e, aberto, onAlternar }: { e: Ev; aberto: boolean; onAlternar(): void }) {
  const t = useT()
  const { ir } = useApp()
  const hora = new Date(e.em).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
  const totalAntes = e.detalhe?.startsWith('antes:') ? Number(e.detalhe.slice(6)) : undefined
  const unidade = e.itens?.[0]?.unidade
  const mesmaUnidade = !!e.itens?.length && e.itens.every((it) => it.quantidade !== undefined && it.unidade === unidade)
  const totalQtd = mesmaUnidade ? e.itens!.reduce((s, it) => s + (it.quantidade ?? 0), 0) : undefined
  // resumo curto na segunda linha: o item (ou quantos), senão o texto do registro
  const resumo = e.itens?.length === 1 ? e.itens[0].texto : e.itens && e.itens.length > 1 ? t('{n} item(ns)', { n: e.itens.length }) : textoLivre(e)
  return (
    <li className="p-3">
      <div className="flex gap-3">
        <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--marca-suave)] text-base">{e.correcao && e.tipo !== 'etapa' ? ICONES.correcao : ICONES[e.tipo]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">
              {t(e.titulo)}
              {e.de && e.para && (
                <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold">
                  <Pilula>{t(e.de)}</Pilula>→<Pilula tom="marca">{t(e.para)}</Pilula>
                </span>
              )}
              {!e.de && e.para && <Pilula tom="marca" className="ml-2">{t(e.para)}</Pilula>}
            </p>
            {e.valor ? (
              <span className={cx('num whitespace-nowrap font-bold', (e.tipo === 'caixa' || e.tipo === 'conta') && (e.valor.valor > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'))}>
                {totalAntes !== undefined && <s className="mr-1 font-normal text-[var(--suave)]">{formatar(totalAntes, e.valor.moeda)}</s>}
                {(e.tipo === 'caixa' || e.tipo === 'conta') && e.valor.valor > 0 ? '+' : ''}
                {formatar(e.valor.valor, e.valor.moeda)}
              </span>
            ) : (
              totalQtd !== undefined && e.tipo === 'estoque' && (
                <span className={cx('num whitespace-nowrap font-bold', totalQtd > 0 ? 'text-[var(--bom)]' : 'text-[var(--ruim)]')}>{totalQtd > 0 ? '+' : ''}{quantidade(totalQtd, unidade)}</span>
              )
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <p className="min-w-0 flex-1 truncate text-sm text-[var(--suave)]">
              <span className="num">{hora}</span>
              {e.por && <> · {e.por}</>}
              {e.valor?.forma && <> · {t(e.valor.forma)}</>}
              {resumo && <> · {resumo}</>}
            </p>
            {/* referência à vista: leva direto ao que foi catalogado (sem abrir os detalhes) */}
            {linksDe(e).length > 0 && (
              <button type="button" onClick={() => { const l = linksDe(e)[0]; ir(l.tela, l.params ?? {}) }} className="-my-1 min-h-10 max-w-[45%] truncate rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">↗ {t(linksDe(e)[0].rotulo)}{linksDe(e).length > 1 ? ` +${linksDe(e).length - 1}` : ''}</button>
            )}
            <button type="button" aria-expanded={aberto} onClick={onAlternar} className="-my-1 min-h-10 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
              {aberto ? `${t('fechar')} ▴` : `${t('detalhes')} ▾`}
            </button>
          </div>
        </div>
      </div>
      {aberto && <Detalhes e={e} />}
    </li>
  )
}

/** As referências do evento (para onde ele leva): os links dele ou, sem links, o registro de origem. */
function linksDe(e: Ev) {
  return e.links?.length ? e.links : e.ref ? [{ tipo: e.ref.tela, tela: e.ref.tela, params: { id: e.ref.id }, rotulo: e.ref.tela === 'venda' ? 'Abrir venda' : e.ref.tela === 'lote' ? 'Abrir lote' : 'Abrir' }] : []
}

/** Ficha do evento: tudo o que ele sabe, no mesmo formato do histórico do pacote. */
function Detalhes({ e }: { e: Ev }) {
  const t = useT()
  const { ir } = useApp()
  const unidade = e.itens?.[0]?.unidade
  const texto = textoLivre(e)
  const saldos = e.grupo ? e.grupo.filter((g) => g.saldo) : e.saldo ? [e] : []
  const links = linksDe(e)
  const ICONE_LINK: Record<string, string> = { lote: '📦', venda: '🧾', compra: '🛒', triagem: '🧺', viagem: '🧳', adiantamento: '🤝', pessoa: '👤', emprestimo: '💸', caixa: '💵' }
  // no celular o rótulo fica em cima do valor; da tela média para cima, lado a lado
  const dt = 'mt-1.5 text-xs font-semibold text-[var(--suave)] first:mt-0 sm:mt-0 sm:text-sm sm:font-normal'
  return (
    <dl className="mt-2 grid grid-cols-1 gap-x-3 sm:grid-cols-[auto,minmax(0,1fr)] sm:gap-y-1 rounded-xl bg-[var(--fundo)] p-3 text-sm sm:ml-11">
      <dt className={dt}>{t('Tipo')}</dt>
      <dd className="font-semibold">
        {ICONES[e.tipo]} {t(NOMES[e.tipo])}
        {e.categoria && <span className="font-normal"> · {t(e.categoria)}</span>}
        {e.correcao && <span className="ml-1 rounded-full bg-[var(--marca-suave)] px-2 text-xs text-[var(--marca)]">{ICONES.correcao} {t('Correção')}</span>}
      </dd>
      <dt className={dt}>{t('Data e hora')}</dt><dd className="num">{dataCompleta(e.em)}</dd>
      <dt className={dt}>{t('Quem')}</dt><dd>{e.por ?? '—'}</dd>
      {saldos.length > 0 && (
        <>
          <dt className={dt}>{t('Antes · Movimentou · Depois')}</dt>
          <dd>
            <ul className="space-y-0.5">
              {saldos.map((g, i) => (
                <li key={i} className="num [overflow-wrap:anywhere]">
                  {saldos.length > 1 || g.saldo!.rotulo !== 'Total' ? <span className="text-[var(--suave)]">{t(g.saldo!.rotulo)}: </span> : null}
                  {medida(g.saldo!.antes, g.saldo!)} · <span className={g.saldo!.delta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]'}>{medida(g.saldo!.delta, g.saldo!, true)}</span> · <b>{medida(g.saldo!.depois, g.saldo!)}</b>
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {(e.de || e.para) && (
        <>
          <dt className={dt}>{t('Etapa')}</dt>
          <dd>{e.de ? <>{t(e.de)} → </> : null}<b>{e.para ? t(e.para) : '—'}</b></dd>
        </>
      )}
      {e.valor && (
        <>
          <dt className={dt}>{t('Valor')}</dt>
          <dd className="num">{formatar(e.valor.valor, e.valor.moeda)}{e.valor.forma && <span className="text-[var(--suave)]"> · {t(e.valor.forma)}</span>}</dd>
        </>
      )}
      {e.motivo && <><dt className={dt}>{t('Motivo')}</dt><dd className="[overflow-wrap:anywhere]">{e.motivo}</dd></>}
      {!!e.ajustes?.length && (
        <>
          <dt className={dt}>{t('Ajustes')}</dt>
          <dd><ul className="list-disc pl-4">{e.ajustes.map((a, k) => <li key={k} className="[overflow-wrap:anywhere]">{a}</li>)}</ul></dd>
        </>
      )}
      {!!e.pagamentos?.length && (
        <>
          <dt className={dt}>{t('Pagamentos')}</dt>
          <dd>
            <ul className="space-y-0.5">
              {e.pagamentos.map((p, k) => (
                <li key={k} className="num">
                  {t(p.forma)} · <b>{formatar(p.valor, p.moeda)}</b>
                  {p.cotacao && <span className="text-[var(--suave)]"> · {t('Cotação')} {p.cotacao}</span>}
                  {p.valorPrincipal !== undefined && p.moedaPrincipal && <span className="text-[var(--suave)]"> ≈ {formatar(p.valorPrincipal, p.moedaPrincipal)}</span>}
                </li>
              ))}
            </ul>
          </dd>
        </>
      )}
      {!!e.itens?.length && (
        <>
          <dt className={dt}>{t('Itens')}</dt>
          <dd>
            <ul className="space-y-0.5">
              {e.itens.map((it, k) => (
                <li key={k} className="flex justify-between gap-3">
                  {e.refs?.[k] ? (
                    <button type="button" onClick={() => ir(e.refs![k]!.tela, { id: e.refs![k]!.id })} className="min-w-0 text-left font-semibold text-[var(--marca)] hover:underline">{it.texto}</button>
                  ) : (
                    <span className="min-w-0 [overflow-wrap:anywhere]">{it.texto}</span>
                  )}
                  <span className="num shrink-0 text-right">
                    {it.quantidade !== undefined && <b>{quantidade(it.quantidade, it.unidade)}</b>}
                    {it.valor !== undefined && it.moeda && <span className="ml-2 text-[var(--suave)]">{formatar(it.valor, it.moeda)}</span>}
                  </span>
                </li>
              ))}
              {e.itens.length > 1 && e.itens.every((it) => it.quantidade !== undefined && it.unidade === unidade) && (
                <li className="flex justify-between gap-3 border-t border-[var(--borda)] pt-1 font-semibold">
                  <span>{t('Total')} · {t('{n} item(ns)', { n: e.itens.length })}</span>
                  <span className="num">{quantidade(e.itens.reduce((s, it) => s + (it.quantidade ?? 0), 0), unidade)}</span>
                </li>
              )}
            </ul>
          </dd>
        </>
      )}
      {e.anexo && (
        <>
          <dt className={dt}>{t('Anexo')}</dt>
          <dd className="[overflow-wrap:anywhere]">
            📎 {e.anexo.nome}
            <span className="text-[var(--suave)]">
              {e.anexo.mime && <> · {e.anexo.mime}</>}
              {e.anexo.tamanho !== undefined && <> · <span className="num">{Math.max(1, Math.round(e.anexo.tamanho / 1024)).toLocaleString(loc())} KB</span></>}
            </span>
          </dd>
        </>
      )}
      {texto && <><dt className={dt}>{t('Descrição')}</dt><dd className="[overflow-wrap:anywhere]">{texto}</dd></>}
      <dt className={dt}>{t('Referência')}</dt>
      <dd className="flex flex-wrap gap-1">
        {!links.length
          ? '—'
          : links.map((l, k) => (
              <button key={k} type="button" onClick={() => ir(l.tela, l.params ?? {})} className="min-h-8 rounded-full bg-[var(--cartao)] px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">
                {ICONE_LINK[l.tipo] ?? '→'} {t(l.rotulo)} →
              </button>
            ))}
      </dd>
    </dl>
  )
}
