// LISTA DE VENDAS (a lista que forma os números do painel: a soma é o cartão) e DETALHE da venda com linha do tempo.

import { Caminho, RastreioTotal } from '../ui/rastreioTotal'
import { useState } from 'react'
import { fatorValido, formatar, multiplicarFator } from '../core/domain/dinheiro'
import type { Id, Transacao } from '../core/domain/tipos'
import { Botao, Campo, Carregando, Cartao, Entrada, GramasInput, Janela, Pagina, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, ErroTela, loc, moedaPadrao } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { Anexos, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'
import { MemoriaLinha } from '../ui/linhaServico'
import { dividir, memoriaCalculo, pct } from '../core/domain/comissao'
import { baixarCSV } from './Relatorios'
import { FiltroPendencia, SeloPendencias } from '../ui/pendencias'

/** Nome da etapa para gente (o código fica só nos dados). */
export const NOME_ETAPA: Record<string, string> = { concluido: 'Concluída', agendado: 'Agendada', cancelado: 'Cancelada' }

/** Filtro ativo como etiqueta com × (toque de 40px) que tira só ele. */
export function Etiqueta({ texto, onTirar }: { texto: string; onTirar(): void }) {
  const t = useT()
  return (
    <span className="inline-flex min-h-10 max-w-full items-center rounded-full bg-[var(--marca-suave)] pl-3 text-sm font-semibold text-[var(--marca)]">
      <span className="truncate">{texto}</span>
      <button type="button" aria-label={`${t('Tirar filtro')}: ${texto}`} onClick={onTirar} className="h-10 w-10 shrink-0 rounded-full text-lg hover:bg-[var(--marca)]/10">×</button>
    </span>
  )
}

const PENDENCIAS = [{ id: 'faltaReceber', nome: 'Falta receber' }, { id: 'semComprovante', nome: 'Sem comprovante' }]

export function Vendas() {
  const t = useT()
  const { nav, ir, ajustarParams } = useApp()
  const f = nav.params
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { dados: locais } = useConsulta('locais', {})
  const { dados: conf } = useConsulta('configuracoes', {})
  const cfg = conf?.config
  const [usuarioId, setUsuarioId] = useParamTela('usuarioId', '')
  const [pendencia, setPendencia] = useParamTela('pendencia', '')
  const base = { de: f.de as string, ate: f.ate as string, moduloId: f.moduloId as string, forma: f.forma as string, moeda: f.moeda as string, localId: f.localId as string, profissionalId: f.profissionalId as string, pessoaId: f.pessoaId as string, usuarioId: usuarioId || undefined }
  const { dados: todas } = useConsulta('vendas', base)
  const dados = todas?.filter((v) => !pendencia || (pendencia === 'qualquer' ? v.pendencias.length > 0 : v.pendencias.some((p) => p.id === pendencia)))
  const contagem = todas && { '': todas.length, qualquer: todas.filter((v) => v.pendencias.length).length, faltaReceber: todas.filter((v) => v.pendencias.some((p) => p.id === 'faltaReceber')).length, semComprovante: todas.filter((v) => v.pendencias.some((p) => p.id === 'semComprovante')).length }
  const soma = (dados ?? []).reduce((s, v) => s + v.valor, 0)
  const moeda = (f.moeda as string) || dados?.[0]?.moedaPrincipal || moedaPadrao()
  const nomePessoa = (id: string) => pessoas?.find((p) => p.id === id)?.nome ?? id
  const nomeModulo = f.moduloId ? t(conf?.modulos.find((m) => m.id === f.moduloId)?.nome ?? String(f.moduloId)) : ''
  const de = f.de as string | undefined
  const ate = f.ate as string | undefined
  const periodo = de && ate ? (de === ate ? dataBR(de) : `${dataBR(de)} – ${dataBR(ate)}`) : de ? `${t('desde')} ${dataBR(de)}` : ate ? `${t('até')} ${dataBR(ate)}` : ''
  const ativos: { chave: string; texto: string; tirar(): void }[] = [
    ...(periodo ? [{ chave: 'periodo', texto: periodo, tirar: () => ajustarParams({ de: undefined, ate: undefined }) }] : []),
    ...(['moduloId', 'forma', 'moeda', 'localId', 'profissionalId', 'pessoaId'] as const).filter((k) => f[k]).map((k) => ({
      chave: k,
      texto: k === 'moduloId' ? nomeModulo : k === 'forma' ? t(cfg?.formas.find((x) => x.id === f.forma)?.nome ?? String(f.forma)) : k === 'localId' ? (locais?.find((l) => l.id === f.localId)?.nome ?? String(f.localId)) : k === 'profissionalId' || k === 'pessoaId' ? nomePessoa(String(f[k])) : String(f[k]),
      tirar: () => ajustarParams({ [k]: undefined }),
    })),
    ...(usuarioId ? [{ chave: 'usuarioId', texto: `${t('por')} ${nomePessoa(usuarioId)}`, tirar: () => setUsuarioId('') }] : []),
    ...(pendencia ? [{ chave: 'pendencia', texto: t(pendencia === 'qualquer' ? 'Com pendência' : (PENDENCIAS.find((p) => p.id === pendencia)?.nome ?? pendencia)), tirar: () => setPendencia('') }] : []),
  ]
  return (
    <div>
      <Titulo subtitulo={[periodo, nomeModulo].filter(Boolean).join(' · ') || undefined} acao={dados && <Botao variante="secundario" onClick={() => baixarCSV('vendas', dados.map((v) => ({ data: v.data, cliente: v.cliente ?? '', itens: v.linhas.map((l) => l.descricao).join(' + '), valor: v.valor / 100, lucro: v.lucroPrincipal / 100, feito_por: v.feitoPor ?? '' })))}>CSV</Botao>}>
        {t('Vendas')}
      </Titulo>
      <div className="mb-2">
        <FiltroPendencia valor={pendencia} onChange={setPendencia} contagem={contagem} opcoes={PENDENCIAS} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Selecao className="w-auto max-w-full" valor={usuarioId} onChange={setUsuarioId} vazio="Feitas por qualquer pessoa" opcoes={(pessoas ?? []).filter((u) => u.papeis.includes('funcionario')).map((u) => ({ id: u.id, nome: u.nome }))} />
      </div>
      {ativos.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {ativos.map((a) => <Etiqueta key={a.chave} texto={a.texto} onTirar={a.tirar} />)}
        </div>
      )}
      <Cartao className="mb-3"><div className="flex flex-wrap justify-between gap-2 font-bold"><span>{dados?.length ?? 0} {t('vendas')}</span><span className="num">{formatar(soma, moeda)}</span></div></Cartao>
      {!dados ? <Carregando /> : !dados.length ? <Vazio texto="Nenhuma venda com esse filtro." /> : (
        <ul className="divide-y divide-[var(--borda)] rounded-2xl border border-[var(--borda)] bg-[var(--cartao)]">
          {dados.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => ir('venda', { id: v.id })} className="flex w-full justify-between gap-2 p-3 text-left hover:bg-[var(--marca-suave)]">
                <div className="min-w-0">
                  <b>{v.cliente ?? t('Sem nome')}</b>
                  <div className="truncate text-xs text-[var(--suave)]">{dataBR(v.data)} · {v.linhas.map((l) => l.descricao).join(' + ')}{v.feitoPor ? ` · ${t('por')} ${v.feitoPor}` : ''}</div>
                  <div className="mt-1"><SeloPendencias pendencias={v.pendencias} moeda={v.moedaPrincipal} /></div>
                </div>
                <span className="num shrink-0 font-bold">{formatar(v.valor, moeda)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DetalheVenda() {
  const t = useT()
  const { nav, voltar, ir, sessao } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('venda', { id })
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [cancelar, setCancelar] = useState(false)
  const [corrigir, setCorrigir] = useState(false)
  const [motivo, setMotivo] = useState('')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const v = dados.venda
  const nomeForma = (forma: string) => t(cfg?.formas.find((x) => x.id === forma)?.nome ?? forma)
  const correcoes = v.historico.filter((h) => h.tipo === 'correcao')
  const pago = v.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0)
  const faltaReceber = v.etapa === 'concluido' && v.totalPrincipal - pago > v.pagamentos.length ? v.totalPrincipal - pago : 0
  const naoVivo = v.pagamentos.some((x) => x.forma !== 'dinheiro')
  const semComprovante = v.etapa === 'concluido' && naoVivo && !dados.anexos.some((a) => a.categoria === 'comprovante')
  // recibo da CLIENTE: só itens e total (a divisão salão × profissional e os insumos são internos)
  const texto = [`${t('Venda')} ${dataBR(v.data)}`, dados.cliente ? `${t('Cliente')}: ${dados.cliente.nome}` : '', ...v.linhas.map((l) => (l.campos.calculo ? String(l.campos.calculo) : `${l.descricao}: ${formatar(l.total, l.moeda)}`)), `${t('Total')}: ${formatar(v.totalPrincipal, v.moedaPrincipal)}`].filter(Boolean).join('\n')
  return (
    <Pagina onVoltar={voltar} titulo={<>{t('Venda')} · {dados.cliente ? <button type="button" className="underline-offset-4 hover:underline" onClick={() => ir('pessoa', { id: dados.cliente!.id })}>{dados.cliente.nome}</button> : t('Sem nome')}</>} subtitulo={<>{dataBR(v.data)} · <Pilula tom={v.etapa === 'concluido' ? 'bom' : v.etapa === 'cancelado' ? 'ruim' : 'marca'}>{t(NOME_ETAPA[v.etapa] ?? v.etapa)}</Pilula>{dados.local ? ` · ${dados.local.nome}` : ''}{dados.profissional ? ` · ${dados.profissional.nome}` : ''}</>}>
      <div className="space-y-4">
        {v.etapa === 'concluido' && (
          <SeloPendencias moeda={v.moedaPrincipal} pendencias={[...(faltaReceber ? [{ id: 'faltaReceber' as const, texto: 'Falta receber', valor: faltaReceber, nivel: 'urgente' as const }] : []), ...(semComprovante ? [{ id: 'semComprovante' as const, texto: 'Sem comprovante do pagamento', nivel: 'atencao' as const }] : [])]} />
        )}
        {sessao.perfil === 'admin' && v.linhas.some((l) => l.itemId) && <OrigemDaVenda vendaId={v.id} />}
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao titulo={t('Itens')}>
            <ul className="divide-y divide-[var(--borda)] text-sm">
              {v.linhas.map((l) => (
                <li key={l.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0 break-words">{l.descricao}{l.campos.calculo ? <span className="num block text-[var(--suave)]">{String(l.campos.calculo)}</span> : null}</span>
                    <b className="num shrink-0">{formatar(l.total, l.moeda)}</b>
                  </div>
                  {(sessao.perfil === 'admin' || (l.profissionalId && l.profissionalId === (sessao.pessoaId ?? sessao.usuarioId))) && <MemoriaLinha linha={l} moeda={v.moedaPrincipal} />}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between gap-2 text-lg font-bold"><span>{t('Total')}</span><span className="num">{formatar(v.totalPrincipal, v.moedaPrincipal)}</span></div>
            <p className="text-sm text-[var(--suave)]">{t('Pago')}: {v.pagamentos.map((p) => `${formatar(p.valor, p.moeda)} (${nomeForma(p.forma)})`).join(' + ') || '—'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="min-h-10 rounded-xl bg-[#25d366] px-3 py-2 text-sm font-semibold text-white" href={linkWhatsApp(texto, dados.cliente?.telefone)} target="_blank" rel="noreferrer">{t('Recibo no WhatsApp')}</a>
              {sessao.perfil === 'admin' && (v.etapa === 'concluido' || v.etapa === 'agendado') && <Botao variante="secundario" onClick={() => setCorrigir(true)}>✏️ {t('Corrigir')}</Botao>}
              {sessao.perfil === 'admin' && v.etapa !== 'cancelado' && <Botao variante="leve" onClick={() => setCancelar(true)}>{t('Cancelar venda')}</Botao>}
            </div>
          </Cartao>
          <Cartao titulo={t('Linha do tempo')}><LinhaDoTempo id={v.id} /></Cartao>
          {correcoes.length > 0 && (
            <Cartao titulo={`${t('Correções')} (${correcoes.length})`} ajuda="Cada correção guarda antes → depois, quem corrigiu e o motivo. Nada é apagado. Ex.: 1.200 g → 1.180 g · Bs 7.800 → Bs 7.670 · Paula · na balança deu menos.">
              <ul className="space-y-2 text-sm">
                {correcoes.map((h, i) => (
                  <li key={i} className="rounded-xl bg-[var(--fundo)] p-2">
                    <div className="text-xs text-[var(--suave)]">{new Date(h.em).toLocaleString(loc())} · <b>{h.porNome}</b> · {h.motivo}</div>
                    {h.ajustes?.map((a) => <div key={a} className="num">{a}</div>)}
                    {h.totalAntes !== undefined && <div className="num font-semibold">{formatar(h.totalAntes, v.moedaPrincipal)} → {formatar(h.totalDepois!, v.moedaPrincipal)}</div>}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
          <Cartao titulo={t('Fotos e comprovantes')}><Anexos donoId={v.id} categorias={['pedido', 'comprovante', 'resultado']} /></Cartao>
        </div>
      </div>
      {corrigir && <CorrigirVenda venda={v} temCliente={!!v.pessoaId} onFechar={() => setCorrigir(false)} />}
      <Janela aberta={cancelar} titulo={t('Cancelar venda')} onFechar={() => (!motivo || window.confirm(t('Sair sem salvar?'))) && (setCancelar(false), setMotivo(''))} rodape={<Botao variante="perigo" grande className="w-full" disabled={ocupado || !motivo} onClick={async () => (await executar('cancelarVenda', { id, motivo }, t('Venda cancelada: estoque e dinheiro voltaram.'))) && setCancelar(false)}>{t('Cancelar venda')}</Botao>}>
        <p className="mb-2 text-sm">{t('O estoque volta e cada pagamento é estornado. Nada é apagado.')}</p>
        <Entrada placeholder={t('Motivo')} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Janela>
    </Pagina>
  )
}

/** Corrigir a venda quantas vezes precisar: quantidade, fator ou valor de cada linha. A diferença vai para o caixa ou para a conta da cliente. */
function CorrigirVenda({ venda, temCliente, onFechar }: { venda: Transacao; temCliente: boolean; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [linhas, setLinhas] = useState<Record<string, { quantidade?: number; fator?: string; total?: number; insumoTotal?: number; comissaoPct?: string }>>({})
  const [motivo, setMotivo] = useState('')
  const [destino, setDestino] = useState<'conta' | 'caixa'>(temCliente ? 'conta' : 'caixa')
  const [forma, setForma] = useState('dinheiro')
  const [moeda, setMoeda] = useState(venda.moedaPrincipal)
  const sujo = Object.keys(linhas).length > 0 || !!motivo.trim()
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const novoTotal = venda.linhas.reduce((s, l) => {
    const c = linhas[l.id] ?? {}
    const q = c.quantidade ?? l.quantidade
    const f = c.fator || (l.campos.fator as string | undefined)
    const tot = c.total !== undefined ? c.total : f && fatorValido(f) ? multiplicarFator(q, f, l.moeda) : l.total
    return s + tot
  }, 0)
  const antes = venda.linhas.reduce((s, l) => s + l.total, 0)
  const dif = novoTotal - antes
  return (
    <Janela aberta larga titulo={t('Corrigir venda')} onFechar={fechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !motivo.trim()} onClick={async () => {
        const r = await executar('corrigirVenda', {
          id: venda.id,
          motivo,
          linhas: Object.entries(linhas).map(([linhaId, { insumoTotal, comissaoPct, ...c }]) => {
            const n = Number((comissaoPct ?? '').replace(',', '.'))
            return {
              linhaId,
              ...c,
              ...(insumoTotal !== undefined ? { insumo: { moeda: venda.moedaPrincipal, itens: [{ nome: t('Insumos'), valor: insumoTotal }] } } : {}),
              ...(comissaoPct?.trim() && Number.isFinite(n) ? { comissaoBp: Math.round(n * 100) } : {}),
            }
          }),
          diferenca: venda.etapa === 'concluido' && dif !== 0 ? (destino === 'conta' ? 'conta' : { forma, moeda }) : undefined,
        }, t('Venda corrigida (fica no histórico).'))
        if (r) onFechar()
      }}>{t('Salvar correção')}</Botao>
    }>
      <div className="space-y-3">
        {venda.linhas.map((l) => {
          const c = linhas[l.id] ?? {}
          const temFator = !!l.campos.fator
          return (
            <div key={l.id} className="rounded-xl border border-[var(--borda)] p-3">
              <div className="mb-2 break-words font-semibold">{l.descricao} <span className="num text-sm font-normal text-[var(--suave)]">· {l.campos.calculo ? String(l.campos.calculo) : formatar(l.total, l.moeda)}</span></div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Campo rotulo={l.quantidade > 1 || temFator ? 'Quantidade / gramas' : 'Quantidade'}>{temFator ? <GramasInput valor={c.quantidade ?? l.quantidade} onChange={(q) => setLinhas({ ...linhas, [l.id]: { ...c, quantidade: q } })} /> : <Entrada inputMode="numeric" value={c.quantidade ?? l.quantidade} onChange={(e) => setLinhas({ ...linhas, [l.id]: { ...c, quantidade: Number(e.target.value) || undefined } })} />}</Campo>
                {temFator ? (
                  <Campo rotulo="Fator"><Entrada inputMode="decimal" placeholder={String(l.campos.fator)} value={c.fator ?? ''} onChange={(e) => setLinhas({ ...linhas, [l.id]: { ...c, fator: e.target.value } })} /></Campo>
                ) : (
                  <Campo rotulo="Valor"><ValorInput moeda={l.moeda} valor={c.total ?? l.total} onChange={(v) => setLinhas({ ...linhas, [l.id]: { ...c, total: v } })} /></Campo>
                )}
                {(l.insumoPrincipal !== undefined || l.baseComissao !== undefined) && (
                  <Campo rotulo="Insumos do salão"><ValorInput moeda={venda.moedaPrincipal} valor={c.insumoTotal ?? l.insumoPrincipal ?? 0} onChange={(v) => setLinhas({ ...linhas, [l.id]: { ...c, insumoTotal: v ?? 0 } })} /></Campo>
                )}
                {l.profissionalId && l.comissaoBp !== undefined && (
                  <Campo rotulo="Comissão (%)"><Entrada inputMode="decimal" placeholder={pct(l.comissaoBp)} value={c.comissaoPct ?? ''} onChange={(e) => setLinhas({ ...linhas, [l.id]: { ...c, comissaoPct: e.target.value } })} /></Campo>
                )}
              </div>
              {(l.insumoPrincipal !== undefined || l.comissaoBp !== undefined) && <PreviaCorrecao linha={l} c={c} moeda={venda.moedaPrincipal} />}
            </div>
          )
        })}
        <div className={cx('rounded-xl p-3 text-sm font-semibold', dif === 0 ? 'bg-[var(--fundo)]' : dif > 0 ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
          {formatar(antes, venda.moedaPrincipal)} → {formatar(novoTotal, venda.moedaPrincipal)} {dif !== 0 && `(${dif > 0 ? '+' : ''}${formatar(dif, venda.moedaPrincipal)})`}
        </div>
        {venda.etapa === 'concluido' && dif !== 0 && (
          <Campo comoDiv rotulo={dif > 0 ? 'A diferença (a mais) foi…' : 'A diferença (a menos) foi…'} ajuda="Na conta da cliente: ela passa a dever (ou ter crédito). No caixa: entrou ou saiu dinheiro agora. Ex.: corrigiu Bs 7.800 → Bs 7.670: devolveu Bs 130 em efectivo.">
            <div className="flex flex-wrap gap-2">
              {temCliente && <Botao variante={destino === 'conta' ? 'primario' : 'secundario'} onClick={() => setDestino('conta')}>{t('Na conta da cliente')}</Botao>}
              <Botao variante={destino === 'caixa' ? 'primario' : 'secundario'} onClick={() => setDestino('caixa')}>{t(dif > 0 ? 'Recebi agora' : 'Devolvi agora')}</Botao>
            </div>
            {destino === 'caixa' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Selecao valor={moeda} onChange={(m) => (setMoeda(m), setForma('dinheiro'))} opcoes={(cfg?.moedasAtivas ?? []).map((m) => ({ id: m, nome: m }))} />
                <Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} />
              </div>
            )}
          </Campo>
        )}
        <Campo rotulo="Motivo (fica no histórico)"><Entrada value={motivo} placeholder={t('Ex.: na balança deu 1.180 g')} onChange={(e) => setMotivo(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}

/** Memória do cálculo como fica depois da correção (mesmo % guardado; o catálogo de hoje não entra). */
function PreviaCorrecao({ linha: l, c, moeda }: { linha: Transacao['linhas'][number]; c: { total?: number; insumoTotal?: number; comissaoPct?: string }; moeda: string }) {
  const t = useT()
  const totalP = c.total !== undefined && l.total ? Math.round((l.totalPrincipal * c.total) / l.total) : l.totalPrincipal
  const ins = c.insumoTotal ?? l.insumoPrincipal ?? 0
  const n = Number((c.comissaoPct ?? '').replace(',', '.'))
  const bp = c.comissaoPct?.trim() && Number.isFinite(n) ? Math.round(n * 100) : l.comissaoBp
  const d = dividir(totalP, ins, bp)
  const insumos = c.insumoTotal !== undefined ? [{ nome: t('Insumos'), valorPrincipal: ins }] : l.insumos
  return <div className="num mt-2 text-xs text-[var(--suave)]">🧮 {memoriaCalculo({ totalPrincipal: totalP, insumoPrincipal: ins, insumos, comissaoBp: bp, comissaoPrincipal: d.comissao, comissaoRegra: bp !== l.comissaoBp ? 'linha' : l.comissaoRegra, baseComissao: d.base, parteSalao: d.parteSalao }, moeda, t)}</div>
}

/** De onde veio este cabelo: Compra(s) → Triagem(ns) → Lote(s) → esta venda, em gramas. */
function OrigemDaVenda({ vendaId }: { vendaId: Id }) {
  const t = useT()
  const { dados } = useConsulta('genealogia', { vendaId })
  if (!dados || !dados.lotes.length) return null
  return (
    <Cartao titulo={t('De onde veio este cabelo')}>
      <div className="space-y-3">
        <Caminho g={dados} />
        <RastreioTotal g={dados} />
      </div>
    </Cartao>
  )
}
