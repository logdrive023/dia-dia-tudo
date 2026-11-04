// VENDER — o módulo de vendas: registrar (botão "+ Nova venda") e encontrar qualquer venda já feita. Padrões de
// Shopify (pedidos em abas por situação, busca + filtros numa barra, tocar abre), Square (busca por cliente, recibo e
// item; filtros de data, forma de pagamento, funcionário) e Stripe (cada linha: valor, situação e data com nome fixo).
// Tudo com as peças do sistema: Titulo · GrupoNumeros/NumeroGrande · FiltroLista · tabela (computador) ou linha curta
// que abre no lugar (celular) · Paginacao. A lista é a MESMA consulta `vendas` que forma os números do Painel.

import { type ReactNode, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { Botao, Campo, Carregando, Confirmar, Entrada, Pilula, Selecao, Titulo, Vazio, cx, dataBR, hora, moedaPadrao } from '../ui/base'
import { useApp, useComando, useConsulta, useFiltrosTela } from '../ui/contexto'
import { AtalhosPeriodo, CampoFaixa, FiltroLista, GrupoFiltro, VazioFiltro, type FiltroAtivo } from '../ui/filtroPadrao'
import { useT } from '../ui/i18n'
import { MenuAcoes, type Acao } from '../ui/menuAcoes'
import { GrupoNumeros, NumeroGrande } from '../ui/numeroGrande'
import { Paginacao, paginar } from '../ui/paginacao'
import { SeloPendencias } from '../ui/pendencias'
import { useTelaLarga } from '../ui/estoqueUi'
import { baixarCSV } from './Relatorios'

const POR_PAGINA = 25
/** as abas (situação): concluídas · com pendência · canceladas · todas */
const ABAS = [{ id: '', nome: 'Concluídas' }, { id: 'pendencia', nome: 'Com pendência' }, { id: 'canceladas', nome: 'Canceladas' }, { id: 'todas', nome: 'Todas' }] as const
const PENDENCIAS = [{ id: 'faltaReceber', nome: 'Falta receber' }, { id: 'semComprovante', nome: 'Sem comprovante' }]
/** os filtros do endereço (para "Limpar"); a aba e a página ficam de fora */
const CHAVES = ['busca', 'de', 'ate', 'pendencia', 'forma', 'moeda', 'usuarioId', 'profissionalId', 'pessoaId', 'moduloId', 'localId'] as const

export function ListaVendas({ novaVenda, aviso }: { novaVenda: ReactNode; aviso?: ReactNode }) {
  const t = useT()
  const { ir, ajustarParams, sessao } = useApp()
  const { p, setP, tirar } = useFiltrosTela()
  const { executar } = useComando()
  const larga = useTelaLarga()
  const admin = sessao.perfil === 'admin'
  const { dados: conf } = useConsulta('configuracoes', {})
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const cfg = conf?.config
  // a mesma consulta do Painel; as canceladas vêm da mesma consulta pedindo a etapa "cancelado"
  const base = { de: p('de') || undefined, ate: p('ate') || undefined, moduloId: p('moduloId') || undefined, forma: p('forma') || undefined, moeda: p('moeda') || undefined, localId: p('localId') || undefined, profissionalId: p('profissionalId') || undefined, pessoaId: p('pessoaId') || undefined, usuarioId: p('usuarioId') || undefined }
  const { dados: concluidas } = useConsulta('vendas', base)
  const { dados: canceladas } = useConsulta('vendas', { ...base, etapa: 'cancelado' })
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [cancelar, setCancelar] = useState<string>()

  const aba = p('aba') as (typeof ABAS)[number]['id']
  const pendencia = p('pendencia')
  const termo = p('busca').trim().toLowerCase()
  const ordem = p('ordem') || 'data'
  const carregando = !concluidas || !canceladas
  type V = NonNullable<typeof concluidas>[number]
  const nomeForma = (id: string) => t(cfg?.formas.find((x) => x.id === id)?.nome ?? id)
  const formas = (v: V) => [...new Set(v.pagamentos.map((x) => x.forma))].map(nomeForma).join(' + ')
  const textoBusca = (v: V) => [v.codigo, v.cliente, v.feitoPor, ...v.linhas.map((l) => l.descricao)].filter(Boolean).join(' ').toLowerCase()
  const passa = (v: V) => (!termo || textoBusca(v).includes(termo)) && (!pendencia || v.pendencias.some((x) => x.id === pendencia))
  const conc = (concluidas ?? []).filter(passa)
  const canc = (canceladas ?? []).filter(passa)
  const daAba = aba === 'canceladas' ? canc : aba === 'todas' ? [...conc, ...canc] : aba === 'pendencia' ? conc.filter((v) => v.pendencias.length) : conc
  const lista = [...daAba].sort((a, b) => (ordem === 'valor' ? b.valor - a.valor : ordem === 'valorMenor' ? a.valor - b.valor : (a.data + a.criadoEm < b.data + b.criadoEm ? 1 : -1)))
  const pag = paginar(lista, Number(p('pagina')) || 1, POR_PAGINA)
  const moeda = p('moeda') || concluidas?.[0]?.moedaPrincipal || moedaPadrao()

  // NÚMEROS do que está filtrado (período, busca e filtros; a aba não muda os números)
  const vendido = conc.reduce((s, v) => s + v.valor, 0)
  const comPend = conc.filter((v) => v.pendencias.length)
  const faltaReceber = conc.filter((v) => v.pendencias.some((x) => x.id === 'faltaReceber')).length
  const irAba = (id: string) => ajustarParams({ aba: id || undefined, pagina: undefined })

  // FILTROS ligados (chips ✕)
  const nomePessoa = (id: string) => pessoas?.find((x) => x.id === id)?.nome ?? id
  const periodo = p('de') || p('ate') ? `📅 ${p('de') ? dataBR(p('de')) : '…'} – ${p('ate') ? dataBR(p('ate')) : '…'}` : ''
  const ativos: FiltroAtivo[] = [
    ...(periodo ? [{ k: 'de,ate', rotulo: periodo }] : []),
    ...(pendencia ? [{ k: 'pendencia', rotulo: `⚠️ ${t(PENDENCIAS.find((x) => x.id === pendencia)?.nome ?? pendencia)}` }] : []),
    ...(p('forma') ? [{ k: 'forma', rotulo: `💳 ${nomeForma(p('forma'))}` }] : []),
    ...(p('moeda') ? [{ k: 'moeda', rotulo: `💱 ${t('Só')} ${p('moeda')}` }] : []),
    ...(p('usuarioId') ? [{ k: 'usuarioId', rotulo: `👤 ${t('por')} ${nomePessoa(p('usuarioId'))}` }] : []),
    ...(p('profissionalId') ? [{ k: 'profissionalId', rotulo: `✂️ ${nomePessoa(p('profissionalId'))}` }] : []),
    ...(p('pessoaId') ? [{ k: 'pessoaId', rotulo: `🧑 ${nomePessoa(p('pessoaId'))}` }] : []),
    ...(p('moduloId') ? [{ k: 'moduloId', rotulo: t(conf?.modulos.find((m) => m.id === p('moduloId'))?.nome ?? p('moduloId')) }] : []),
    ...(p('localId') ? [{ k: 'localId', rotulo: `📍 ${locais?.find((l) => l.id === p('localId'))?.nome ?? p('localId')}` }] : []),
  ]
  const filtrando = ativos.length > 0 || !!termo
  const limpar = () => ajustarParams({ ...Object.fromEntries(CHAVES.map((k) => [k, undefined])), pagina: undefined })
  const mudar = (k: string, v: string) => ajustarParams({ [k]: v || undefined, pagina: undefined })
  const funcionarios = (pessoas ?? []).filter((u) => u.papeis.includes('funcionario'))
  const clientes = (pessoas ?? []).filter((u) => u.papeis.includes('cliente'))
  const modulosVenda = (conf?.modulos ?? []).filter((m) => cfg?.modulosAtivos.includes(m.id) && m.temVenda)

  const situacao = (v: V) => (v.etapa === 'cancelado' ? <Pilula tom="neutro">✕ {t('Cancelada')}</Pilula> : <SeloPendencias compacto pendencias={v.pendencias} moeda={v.moedaPrincipal} />)
  const acoes = (v: V): Acao[] => [
    { rotulo: 'Abrir venda', icone: '🧾', onClick: () => ir('venda', { id: v.id }) },
    ...(v.pessoaId ? [{ rotulo: 'Ver cliente', icone: '🧑', onClick: () => ir('pessoa', { id: v.pessoaId! }) }] : []),
    ...(admin && v.etapa === 'concluido' ? [{ rotulo: 'Cancelar venda', icone: '✕', perigo: true, separar: true, onClick: () => setCancelar(v.id) }] : []),
  ]
  const exportar = () => baixarCSV('vendas', lista.map((v) => ({ codigo: v.codigo ?? '', data: v.data, hora: hora(v.criadoEm), cliente: v.cliente ?? '', itens: v.linhas.map((l) => l.descricao).join(' + '), pagamento: formas(v), situacao: v.etapa === 'cancelado' ? t('Cancelada') : v.pendencias.length ? v.pendencias.map((x) => t(x.texto)).join(' · ') : t('Completa'), valor: v.valor / 100, feito_por: v.feitoPor ?? '' })))
  const alternar = (id: string) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const Th = ({ children, por, direita }: { children: ReactNode; por?: 'data' | 'valor'; direita?: boolean }) => (
    <th className={cx('whitespace-nowrap px-3 py-2 text-xs font-medium text-[var(--suave)]', direita && 'text-right')}>
      {por ? (
        <button type="button" onClick={() => mudar('ordem', por === 'data' ? '' : ordem === 'valor' ? 'valorMenor' : 'valor')} className="inline-flex items-center gap-1 hover:text-[var(--texto)]">
          {children}{(por === 'data' ? ordem === 'data' : ordem.startsWith('valor')) && <span aria-hidden>{ordem === 'valorMenor' ? '↑' : '↓'}</span>}
        </button>
      ) : children}
    </th>
  )

  return (
    <div>
      {/* CABEÇALHO PADRÃO: nome · para que serve · a ação principal (+ Nova venda ▾ com os caminhos de venda) */}
      <Titulo subtitulo={t('Registre vendas e encontre qualquer uma já feita.')} acao={novaVenda}>{t('Vender')}</Titulo>
      {aviso}

      {/* NÚMEROS GRANDES (fileira padrão) do que está filtrado: tocar abre a aba correspondente */}
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Vendido" icone="💰" cor="var(--marca)" valor={formatar(vendido, moeda)} selos={[{ texto: t('{n} venda(s)', { n: conc.length }), tom: 'marca' }]} ativo={!aba} onClick={() => irAba('')} carregando={carregando} />
        <NumeroGrande rotulo="Ticket médio" icone="🧾" cor="var(--bom)" valor={conc.length ? formatar(Math.round(vendido / conc.length), moeda) : '—'} selos={[{ texto: t('por venda') }]} ajuda="Vendido ÷ número de vendas. Ex.: Bs 900 em 3 vendas = Bs 300." carregando={carregando} />
        <NumeroGrande rotulo="Com pendência" icone="⚠️" cor="var(--alerta)" colorirValor={comPend.length > 0} valor={String(comPend.length)} selos={comPend.length ? [...(faltaReceber ? [{ texto: `● ${t('{n} falta receber', { n: faltaReceber })}`, tom: 'ruim' as const }] : []), { texto: t('toque para ver') }] : [{ texto: `✓ ${t('tudo em dia')}`, tom: 'bom' }]} ativo={aba === 'pendencia'} onClick={() => irAba('pendencia')} carregando={carregando} />
        <NumeroGrande rotulo="Canceladas" icone="✕" cor="var(--suave)" valor={String(canc.length)} selos={[{ texto: t('estornadas') }]} ajuda="Venda cancelada: o estoque volta e cada pagamento é estornado. Nada é apagado." ativo={aba === 'canceladas'} onClick={() => irAba('canceladas')} carregando={carregando} />
      </GrupoNumeros>

      {/* FILTRO PADRÃO: abas da situação · período · busca · ⚙ Filtros (quando · pagamento · quem · onde) → chips ✕ */}
      <FiltroLista
        className="mb-3"
        topo={
          <div className="space-y-2">
            <div role="tablist" aria-label={t('Situação')} className="flex w-max max-w-full gap-1 overflow-x-auto rounded-xl bg-[var(--marca-suave)] p-1 [scrollbar-width:none]">
              {ABAS.map((a) => {
                const n = a.id === 'canceladas' ? canc.length : a.id === 'todas' ? conc.length + canc.length : a.id === 'pendencia' ? comPend.length : conc.length
                return (
                  <button key={a.id || 'conc'} type="button" role="tab" aria-selected={aba === a.id} onClick={() => irAba(a.id)} className={cx('min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-semibold', aba === a.id ? 'bg-[var(--cartao)] text-[var(--marca)] shadow' : 'text-[var(--suave)]')}>
                    <span>{t(a.nome)} <span className="num opacity-70">{carregando ? '' : n}</span></span>
                  </button>
                )
              })}
            </div>
            <AtalhosPeriodo de={p('de')} ate={p('ate')} onChange={(de, ate) => ajustarParams({ de, ate, pagina: undefined })} />
          </div>
        }
        busca={p('busca')} onBusca={(v) => mudar('busca', v)} placeholder="Buscar cliente, código (V-0001), item ou quem vendeu"
        ativos={ativos} onTirar={(k) => (tirar(k), setP('pagina', ''))} onLimpar={limpar}
        resultados={carregando ? undefined : lista.length} total={carregando ? undefined : (aba === 'canceladas' ? canceladas!.length : aba === 'todas' ? concluidas!.length + canceladas!.length : concluidas!.length)} unidade="venda(s)"
        detalhe={!carregando && lista.length > 0 && formatar(lista.reduce((s, v) => s + v.valor, 0), moeda)}
        ferramentas={<Botao variante="leve" className="px-3" disabled={!lista.length} onClick={exportar} aria-label={t('Exportar CSV')}>⬇<span className="hidden sm:inline"> CSV</span></Botao>}
        painel={<>
          <GrupoFiltro titulo="Quando e o quê" icone="📅">
            <CampoFaixa rotulo="Data da venda">
              <Entrada type="date" aria-label={t('De')} value={p('de')} max={p('ate') || undefined} onChange={(e) => mudar('de', e.target.value)} />
              <Entrada type="date" aria-label={t('Até')} value={p('ate')} min={p('de') || undefined} onChange={(e) => mudar('ate', e.target.value)} />
            </CampoFaixa>
            {modulosVenda.length > 1 && <Campo rotulo="Área"><Selecao valor={p('moduloId')} onChange={(v) => mudar('moduloId', v)} vazio="Todas" opcoes={modulosVenda.map((m) => ({ id: m.id, nome: `${m.icone} ${t(m.nome)}` }))} /></Campo>}
            <Campo rotulo="Pendência"><Selecao valor={pendencia} onChange={(v) => mudar('pendencia', v)} vazio="Qualquer" opcoes={PENDENCIAS} /></Campo>
          </GrupoFiltro>
          <GrupoFiltro titulo="Pagamento" icone="💳">
            <Campo rotulo="Forma de pagamento"><Selecao valor={p('forma')} onChange={(v) => mudar('forma', v)} vazio="Todas" opcoes={(cfg?.formas ?? []).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
            {(cfg?.moedasAtivas.length ?? 0) > 1 && <Campo rotulo="Moeda recebida"><Selecao valor={p('moeda')} onChange={(v) => mudar('moeda', v)} vazio="Todas" opcoes={(cfg?.moedasAtivas ?? []).map((m) => ({ id: m, nome: m }))} /></Campo>}
          </GrupoFiltro>
          <GrupoFiltro titulo="Quem e onde" icone="👤">
            <Campo rotulo="Quem vendeu"><Selecao valor={p('usuarioId')} onChange={(v) => mudar('usuarioId', v)} vazio="Qualquer pessoa" opcoes={funcionarios.map((u) => ({ id: u.id, nome: u.nome }))} /></Campo>
            {clientes.length > 0 && <Campo rotulo="Cliente"><Selecao valor={p('pessoaId')} onChange={(v) => mudar('pessoaId', v)} vazio="Todos" opcoes={clientes.map((u) => ({ id: u.id, nome: u.nome }))} /></Campo>}
            {(locais ?? []).length > 0 && <Campo rotulo="Unidade"><Selecao valor={p('localId')} onChange={(v) => mudar('localId', v)} vazio="Todas" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>}
          </GrupoFiltro>
        </>}
      />

      {carregando ? (
        <Carregando />
      ) : !concluidas!.length && !canceladas!.length && !filtrando ? (
        <Vazio texto="Ainda não há vendas registradas.">{novaVenda}</Vazio>
      ) : !lista.length ? (
        <VazioFiltro texto="Nenhuma venda com esse filtro." filtrando={filtrando || !!aba} onLimpar={() => (limpar(), irAba(''))} />
      ) : larga ? (
        // COMPUTADOR: tabela (venda · data · itens · pagamento · situação · valor · ⋯); tocar na linha abre a venda
        <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--fundo)] text-left">
              <tr>
                <Th>{t('Venda')}</Th>
                <Th por="data">{t('Data')}</Th>
                <Th>{t('Itens')}</Th>
                <Th>{t('Pagamento')}</Th>
                <Th>{t('Situação')}</Th>
                <Th por="valor" direita>{t('Valor')}</Th>
                <th className="w-12 px-2"><span className="sr-only">{t('Ações')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--borda)]">
              {pag.itens.map((v) => (
                <tr key={v.id} tabIndex={0} onClick={() => ir('venda', { id: v.id })} onKeyDown={(e) => e.key === 'Enter' && ir('venda', { id: v.id })} className={cx('cursor-pointer align-top hover:bg-[var(--marca-suave)]/50 focus-visible:bg-[var(--marca-suave)]', v.etapa === 'cancelado' && 'opacity-70')}>
                  <td className="px-3 py-2.5">
                    <span className="block font-mono text-xs font-bold text-[var(--marca)]">{v.codigo ?? '—'}</span>
                    <b className="block">{v.cliente ?? t('Sem nome')}</b>
                  </td>
                  <td className="num whitespace-nowrap px-3 py-2.5">{dataBR(v.data)}<span className="block text-xs text-[var(--suave)]">{hora(v.criadoEm)}{v.feitoPor ? ` · ${v.feitoPor}` : ''}</span></td>
                  <td className="max-w-72 px-3 py-2.5"><span className="line-clamp-2">{v.linhas.map((l) => l.descricao).join(' + ')}</span><span className="text-xs text-[var(--suave)]">{t('{n} item(ns)', { n: v.linhas.length })}</span></td>
                  <td className="px-3 py-2.5 text-[var(--suave)]">{formas(v) || '—'}</td>
                  <td className="px-3 py-2.5">{situacao(v)}</td>
                  <td className={cx('num whitespace-nowrap px-3 py-2.5 text-right font-bold', v.etapa === 'cancelado' && 'line-through')}>{formatar(v.valor, moeda)}</td>
                  <td className="px-2 py-2"><MenuAcoes acoes={acoes(v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // CELULAR: uma linha curta por venda (cliente · valor · código · situação); tocar abre o resto no lugar
        <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
          {pag.itens.map((v) => {
            const aberta = abertas.has(v.id)
            return (
              <li key={v.id} className={cx(aberta && 'bg-[var(--marca-suave)]/40', v.etapa === 'cancelado' && 'opacity-80')}>
                <button type="button" aria-expanded={aberta} onClick={() => alternar(v.id)} className="flex w-full items-start gap-2 p-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <b className="truncate">{v.cliente ?? t('Sem nome')}</b>
                      <span className={cx('num shrink-0 font-bold', v.etapa === 'cancelado' && 'line-through')}>{formatar(v.valor, moeda)}</span>
                    </span>
                    <span className="num mt-0.5 block truncate text-xs text-[var(--suave)]"><span className="font-mono font-bold text-[var(--marca)]">{v.codigo ?? '—'}</span> · {dataBR(v.data)} {hora(v.criadoEm)}</span>
                    <span className="mt-1 block">{situacao(v)}</span>
                  </span>
                  <span aria-hidden className={cx('mt-1 text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
                </button>
                {aberta && (
                  <div className="space-y-2 px-3 pb-3 text-sm">
                    <p>{v.linhas.map((l) => l.descricao).join(' + ')}</p>
                    <p className="text-xs text-[var(--suave)]">{[formas(v) && `💳 ${formas(v)}`, v.feitoPor && `${t('por')} ${v.feitoPor}`].filter(Boolean).join(' · ')}</p>
                    <div className="flex items-center gap-2">
                      <Botao className="flex-1" onClick={() => ir('venda', { id: v.id })}>{t('Abrir venda')} →</Botao>
                      <MenuAcoes comRotulo acoes={acoes(v).slice(1)} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!carregando && <Paginacao {...pag} total={lista.length} unidade="venda(s)" onPagina={(n) => setP('pagina', n > 1 ? String(n) : '')} />}

      {cancelar && (
        <Confirmar perigo pedirMotivo titulo="Cancelar venda" texto="O estoque volta e cada pagamento é estornado. Nada é apagado." rotulo="Cancelar venda"
          onConfirmar={(motivo) => executar('cancelarVenda', { id: cancelar, motivo }, t('Venda cancelada: estoque e dinheiro voltaram.'))}
          onFechar={() => setCancelar(undefined)} />
      )}
    </div>
  )
}
