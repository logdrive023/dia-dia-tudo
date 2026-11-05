// AUDITORIA (#/auditoria · menu Gestão · só administrador) — o log do sistema, BRUTO, para conferir o que foi feito:
//   · os números do período (ações · hoje · quem agiu · tentativas recusadas — tocar filtra)
//   · o FILTRO PADRÃO: a área em abas com o número, busca (texto, código, id), 📅 período, 👤 quem e, no ⚙, a ação
//     exata; "Baixar planilha" dentro do ⚙
//   · a lista: uma linha por ação — data e hora com segundos, quem, a ação (nome + código técnico), o resumo e as
//     REFERÊNCIAS (compra, venda, pacote, pessoa, viagem… cada uma abre a tela dela)
//   · tocar numa linha abre o DETALHE (DetalheAuditoria): os campos crus, as referências e as outras ações sobre o
//     mesmo registro
import { useState } from 'react'
import { Botao, Campo, Carregando, Janela, Pilula, Selecao, Titulo, Vazio, cx, loc } from '../ui/base'
import { useApp, useConsulta, useParamTela } from '../ui/contexto'
import { baixarCSV } from '../ui/csv'
import { BotaoEscolha, FiltroLista, GrupoFiltro, VazioFiltro } from '../ui/filtroPadrao'
import { useT } from '../ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../ui/numeroGrande'
import { Paginacao, usePaginacao } from '../ui/paginacao'
import { corDoNome, iniciais } from '../ui/tabelaDados'
import type { CategoriaAuditoria, RefAuditoria } from '../core/services/auditoria'

const COR_AREA: Record<CategoriaAuditoria, string> = {
  venda: '#16a34a', compra: '#ea580c', estoque: '#9333ea', viagens: '#0284c7', dinheiro: '#ca8a04',
  pessoas: '#0ea5e9', acesso: '#dc2626', config: '#64748b', recusa: '#e11d48', outros: '#94a3b8',
}
const ICONE_REF: Record<string, string> = { compra: '🛒', venda: '💰', pacote: '📦', item: '🏷', pessoa: '👤', viagem: '🧳', adiantamento: '🤲', 'empréstimo': '🤝', 'usuário': '🔑' }

/** data e hora com segundos (o log é para conferir) */
const quando = (iso: string) => new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function Refs({ refs, onAbrir }: { refs: RefAuditoria[]; onAbrir(r: RefAuditoria): void }) {
  if (!refs.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {refs.map((r) => (
        <button key={r.id} type="button" onClick={(e) => (e.stopPropagation(), onAbrir(r))}
          className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md bg-[var(--marca-suave)] px-1.5 text-[11px] font-semibold text-[var(--marca)] hover:ring-1 hover:ring-[var(--marca)]">
          <span aria-hidden>{ICONE_REF[r.tipo] ?? '🔗'}</span><span className="num truncate">{r.rotulo}</span>
        </button>
      ))}
    </span>
  )
}

export function Auditoria() {
  const t = useT()
  const { ir } = useApp()
  const [busca, setBusca] = useParamTela('busca', '')
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const [usuarioId, setUsuarioId] = useParamTela('usuarioId', '')
  const [acao, setAcao] = useParamTela('acao', '')
  const [area, setArea] = useParamTela<'' | CategoriaAuditoria>('area', '')
  const [aberto, setAberto] = useState<string>()
  const { dados } = useConsulta('auditoria', { de: de || undefined, ate: ate || undefined, usuarioId: usuarioId || undefined, acao: acao || undefined, categoria: area || undefined, busca: busca || undefined })
  const linhas = dados?.linhas ?? []
  const pag = usePaginacao(linhas, { padrao: 50, reiniciar: JSON.stringify([busca, de, ate, usuarioId, acao, area]) })
  const abrirRef = (r: RefAuditoria) => ir(r.tela, r.params)
  const nomeUsuario = dados?.usuarios.find((u) => u.id === usuarioId)?.nome
  const ativos = [
    ...(usuarioId ? [{ k: 'usuarioId', rotulo: `👤 ${nomeUsuario ?? usuarioId}` }] : []),
    ...(acao ? [{ k: 'acao', rotulo: `⚡ ${t(dados?.acoes.find((a) => a.id === acao)?.nome ?? acao)}` }] : []),
  ]
  const limpar = () => (setBusca(''), setDe(''), setAte(''), setUsuarioId(''), setAcao(''), setArea(''))
  const exportar = () => baixarCSV('auditoria', linhas.map((l) => ({ quando: l.em, quem: l.usuarioNome, usuario_id: l.usuarioId, area: NOME_AREA(l.categoria), acao: l.nomeAcao, codigo_acao: l.acao, resumo: l.resumo, referencias: l.refs.map((r) => `${r.tipo}:${r.rotulo}`).join(' | '), alvo_id: l.alvoId ?? '', registro_id: l.id })))
  return (
    <div>
      <Titulo subtitulo={t('Tudo o que foi feito no sistema, por quem e quando — com as referências. Só o administrador vê.')}>{t('Auditoria')}</Titulo>
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Ações" valor={dados?.noPeriodo ?? 0} icone="📜" sub={t(de || ate ? 'no período' : 'desde sempre')} carregando={!dados} onClick={() => limpar()} />
        <NumeroGrande rotulo="Hoje" valor={dados?.hoje ?? 0} icone="⏱" carregando={!dados} />
        <NumeroGrande rotulo="Quem agiu" valor={dados?.usuarios.length ?? 0} icone="👥" carregando={!dados} />
        <NumeroGrande rotulo="Recusadas" valor={dados?.recusadas ?? 0} icone="⛔" tom={dados?.recusadas ? 'ruim' : undefined} ativo={area === 'recusa'} carregando={!dados} onClick={() => setArea(area === 'recusa' ? '' : 'recusa')} ajuda="Tentativas que o sistema não deixou fazer (sem permissão, saldo, regra do negócio). Ficam registradas com o motivo." />
      </GrupoNumeros>
      <FiltroLista
        className="mb-3"
        situacao={{ valor: area, onChange: (v) => setArea(v as typeof area), opcoes: [{ id: '', nome: 'Tudo', n: dados?.categorias.reduce((s, c) => s + c.n, 0) }, ...(dados?.categorias ?? []).map((c) => ({ id: c.id, nome: `${c.icone} ${t(c.nome)}`, n: c.n, tom: c.id === 'recusa' ? ('alerta' as const) : undefined }))] }}
        busca={busca} onBusca={setBusca} placeholder="Buscar texto, código ou id"
        periodo={{ de, ate, onChange: (d, a) => (setDe(d ?? ''), setAte(a ?? '')) }}
        extra={<BotaoEscolha icone="👤" rotulo="Quem" valor={usuarioId} onChange={setUsuarioId} opcoes={[{ id: '', nome: 'Todos os usuários' }, ...(dados?.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome, sub: `${t(u.perfil === 'admin' ? 'Administrador' : u.perfil ? 'Funcionário' : 'Sistema')} · ${u.n} ${t('ações')}` }))]} />}
        painel={
          <GrupoFiltro titulo="Ação" icone="⚡">
            <Campo rotulo="Ação exata"><Selecao valor={acao} onChange={setAcao} vazio="Todas as ações" opcoes={(dados?.acoes ?? []).map((a) => ({ id: a.id, nome: `${t(a.nome)} (${a.n})` }))} /></Campo>
          </GrupoFiltro>
        }
        exportar={{ onExportar: exportar, quantos: linhas.length, unidade: 'ação(ões)' }}
        ativos={ativos} onTirar={(k) => (k === 'usuarioId' ? setUsuarioId('') : setAcao(''))} onLimpar={limpar}
        temAtivos={!!(busca || de || ate || usuarioId || acao || area)}
        resultados={dados ? dados.total : undefined} total={dados?.noPeriodo} unidade="ação(ões)"
      />
      {!dados ? <Carregando /> : !dados.noPeriodo ? <Vazio texto="Nada registrado ainda." /> : !linhas.length ? <VazioFiltro filtrando onLimpar={limpar} /> : (
        <>
          <ul className="divide-y divide-[var(--borda)] overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
            {pag.itens.map((l) => {
              const cor = COR_AREA[l.categoria]
              return (
                <li key={l.id}>
                  <div role="button" tabIndex={0} onClick={() => setAberto(l.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setAberto(l.id))}
                    className={cx('relative flex cursor-pointer gap-3 py-2.5 pl-4 pr-3 text-left hover:bg-[var(--fundo)] focus-visible:bg-[var(--fundo)]', l.categoria === 'recusa' && 'bg-[var(--ruim)]/5')}>
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="num font-mono text-[var(--suave)]">{quando(l.em)}</span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: `color-mix(in srgb, ${corDoNome(l.usuarioNome)} 18%, transparent)`, color: corDoNome(l.usuarioNome) }}>{iniciais(l.usuarioNome)}</span>
                          {l.usuarioNome}
                        </span>
                      </span>
                      <span className="block text-sm">
                        <b style={{ color: l.categoria === 'recusa' ? 'var(--ruim)' : undefined }}>{t(l.nomeAcao)}</b>
                        <span className="ml-1.5 rounded bg-[var(--fundo)] px-1 font-mono text-[10px] text-[var(--suave)]">{l.acao}</span>
                      </span>
                      <span className="block break-words text-sm text-[var(--suave)]">{l.resumo}</span>
                      <Refs refs={l.refs} onAbrir={abrirRef} />
                    </span>
                    <span aria-hidden className="self-center text-[var(--suave)]">›</span>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-3"><Paginacao {...pag} unidade="ação(ões)" /></div>
        </>
      )}
      {aberto && <DetalheAuditoria id={aberto} onFechar={() => setAberto(undefined)} onAbrir={(r) => (setAberto(undefined), abrirRef(r))} onOutro={setAberto} />}
    </div>
  )
}

const NOME_AREA = (c: CategoriaAuditoria) => ({ venda: 'Vendas e agenda', compra: 'Compras', estoque: 'Estoque e triagem', viagens: 'Viagens', dinheiro: 'Dinheiro', pessoas: 'Pessoas', acesso: 'Acesso e usuários', config: 'Configurações', recusa: 'Recusadas', outros: 'Outros' })[c]

/** DETALHE DE UM REGISTRO — o que, quem, quando (com segundos), os ids, as referências, as outras ações sobre o mesmo
 *  registro e o registro cru (como está guardado) */
export function DetalheAuditoria({ id, onFechar, onAbrir, onOutro }: { id: string; onFechar(): void; onAbrir(r: RefAuditoria): void; onOutro(id: string): void }) {
  const t = useT()
  const { dados, erro } = useConsulta('registroAuditoria', { id })
  const [cru, setCru] = useState(false)
  if (erro) return <Janela aberta titulo={t('Registro')} onFechar={onFechar}><p className="text-sm">{erro}</p></Janela>
  if (!dados) return <Janela aberta titulo={t('Registro')} onFechar={onFechar}><Carregando /></Janela>
  const r = dados.registro
  const cor = COR_AREA[r.categoria]
  const fato = (rotulo: string, valor: React.ReactNode, mono?: boolean) => (
    <div className="contents">
      <dt className="text-[var(--suave)]">{t(rotulo)}</dt>
      <dd className={cx('min-w-0 break-all font-semibold', mono && 'font-mono text-xs font-normal')}>{valor}</dd>
    </div>
  )
  return (
    <Janela aberta onFechar={onFechar} titulo={
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 35%, transparent)` }}>{({ venda: '💰', compra: '🛒', estoque: '📦', viagens: '🧳', dinheiro: '💵', pessoas: '👤', acesso: '🔒', config: '⚙️', recusa: '⛔', outros: '📜' } as const)[r.categoria]}</span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold leading-tight">{t(r.nomeAcao)}</span>
          <span className="mt-0.5 block text-xs font-semibold" style={{ color: cor }}>{t(NOME_AREA(r.categoria))}</span>
        </span>
      </span>
    }>
      <div className="space-y-4">
        <p className={cx('rounded-xl px-3 py-2 text-sm', r.categoria === 'recusa' ? 'bg-[var(--ruim)]/10 font-semibold text-[var(--ruim)]' : 'bg-[var(--fundo)]')}>{r.resumo || '—'}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {fato('Quando', <span className="num">{quando(r.em)}</span>)}
          {fato('Quem', <>{r.usuarioNome}{r.login && <span className="font-normal text-[var(--suave)]"> · {r.login}</span>} <Pilula pequena tom={r.perfil === 'admin' ? 'marca' : 'neutro'}>{t(r.perfil === 'admin' ? 'Administrador' : r.perfil ? 'Funcionário' : 'Sistema')}</Pilula></>)}
          {fato('Ação', r.acao, true)}
          {fato('Usuário (id)', r.usuarioId, true)}
          {r.alvoId && fato('Registro afetado (id)', r.alvoId, true)}
          {fato('Id deste registro', r.id, true)}
        </dl>
        {dados.refs.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">🔗 {t('Referências')}</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {dados.refs.map((x) => (
                <button key={x.id} type="button" onClick={() => onAbrir(x)} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--borda)] px-3 text-left text-sm hover:border-[var(--marca)]">
                  <span aria-hidden>{ICONE_REF[x.tipo] ?? '🔗'}</span>
                  <span className="min-w-0 flex-1"><b className="num block truncate">{x.rotulo}</b><span className="block text-xs text-[var(--suave)]">{t(x.tipo)}</span></span>
                  <span aria-hidden className="text-[var(--marca)]">›</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {dados.mesmoAlvo.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--suave)]">🕘 {t('Outras ações sobre o mesmo registro')} · {dados.mesmoAlvo.length}</h3>
            <ul className="max-h-64 divide-y divide-[var(--borda)] overflow-y-auto rounded-xl border border-[var(--borda)]">
              {dados.mesmoAlvo.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => onOutro(x.id)} className="relative flex w-full gap-2 py-2 pl-3 pr-2 text-left text-sm hover:bg-[var(--fundo)]">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: COR_AREA[x.categoria] }} />
                    <span className="min-w-0 flex-1">
                      <span className="num block font-mono text-[11px] text-[var(--suave)]">{quando(x.em)} · {x.usuarioNome}</span>
                      <b className="block">{t(x.nomeAcao)}</b>
                      <span className="block truncate text-xs text-[var(--suave)]">{x.resumo}</span>
                    </span>
                    <span aria-hidden className="self-center text-[var(--suave)]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <Botao variante="leve" onClick={() => setCru(!cru)} aria-expanded={cru}>{cru ? '▾' : '▸'} {t('Registro cru (como está guardado)')}</Botao>
          {cru && <pre className="mt-1.5 max-h-72 overflow-auto rounded-xl bg-[var(--fundo)] p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify(dados.bruto, null, 2)}</pre>}
        </section>
      </div>
    </Janela>
  )
}
