// DETALHE da venda com linha do tempo (a LISTA de vendas é a tela Vender: ListaVendas.tsx).

import { type LinhaRastreio, ListaRastreio, RastreioTotal } from '../ui/rastreioTotal'
import { SelosViagem } from '../ui/seloViagem'
import { CaminhoDoCabelo } from '../ui/caminhoCabelo'
import { useState } from 'react'
import { fatorValido, formatar, multiplicarFator } from '../core/domain/dinheiro'
import type { Id, Transacao } from '../core/domain/tipos'
import { Abas, Botao, Campo, Carregando, Cartao, Entrada, GramasInput, Janela, Pagina, Pilula, Selecao, ValorInput, cx, dataBR, ErroTela, gramasTexto, loc, Confirmar } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { cotacaoDoPagamento, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { AbaAnexos } from '../ui/anexos'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { MenuAcoes } from '../ui/menuAcoes'
import { useT } from '../ui/i18n'
import { MemoriaLinha } from '../ui/linhaServico'
import { dividir, memoriaCalculo, pct } from '../core/domain/comissao'
import { SeloPendencias } from '../ui/pendencias'

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

export function DetalheVenda() {
  const t = useT()
  const { nav, voltar, ir, sessao } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('venda', { id })
  const { cfg } = useCotacoes()
  const { executar } = useComando()
  const [cancelar, setCancelar] = useState(false)
  const [corrigir, setCorrigir] = useState(false)
  const [aba, setAba] = useParamTela<'resumo' | 'historico' | 'arquivos' | 'correcoes'>('aba', 'resumo')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const v = dados.venda
  const nomeForma = (forma: string) => t(cfg?.formas.find((x) => x.id === forma)?.nome ?? forma)
  const correcoes = v.historico.filter((h) => h.tipo === 'correcao')
  const pago = v.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0)
  const faltaReceber = v.etapa === 'concluido' && v.totalPrincipal - pago > v.pagamentos.length ? v.totalPrincipal - pago : 0
  const naoVivo = v.pagamentos.some((x) => x.forma !== 'dinheiro')
  const semComprovante = v.etapa === 'concluido' && naoVivo && !dados.anexos.some((a) => a.categoria === 'comprovante')
  // desconto da venda: "desconto 2,5% = Bs 878,50" (guardado na venda) e o de cada linha
  const descontoVenda = v.campos.desconto ? String(v.campos.desconto) : ''
  const comCotacao = (p: (typeof v.pagamentos)[number]) => {
    const c = cotacaoDoPagamento(p, v.moedaPrincipal)
    return c ? ` · ${c}` : ''
  }
  // recibo da CLIENTE: só itens e total (a divisão salão × profissional e os insumos são internos)
  const texto = [
    `${t('Venda')} ${dataBR(v.data)}`,
    dados.cliente ? `${t('Cliente')}: ${dados.cliente.nome}` : '',
    ...v.linhas.map((l) => (l.campos.calculo ? String(l.campos.calculo) : `${l.descricao}: ${formatar(l.bruto ?? l.total, l.moeda)}`)),
    descontoVenda ? descontoVenda.charAt(0).toUpperCase() + descontoVenda.slice(1) : '',
    `${t('Total')}: ${formatar(v.totalPrincipal, v.moedaPrincipal)}`,
    v.campos.cobranca ? String(v.campos.cobranca) : '',
  ].filter(Boolean).join('\n')
  return (
    <Pagina onVoltar={voltar} trilha={[t('Venda'), v.codigo].filter(Boolean).join(' ')} titulo={<>{t('Venda')} · {dados.cliente ? <button type="button" className="underline-offset-4 hover:underline" onClick={() => ir('pessoa', { id: dados.cliente!.id })}>{dados.cliente.nome}</button> : t('Sem nome')}</>} subtitulo={<>{dataBR(v.data)} · <Pilula tom={v.etapa === 'concluido' ? 'bom' : v.etapa === 'cancelado' ? 'ruim' : 'marca'}>{t(NOME_ETAPA[v.etapa] ?? v.etapa)}</Pilula>{dados.local ? ` · ${dados.local.nome}` : ''}{dados.profissional ? ` · ${dados.profissional.nome}` : ''}{dados.viagens.length > 0 && <span className="ml-2 inline-flex align-middle"><SelosViagem vs={dados.viagens} /></span>}</>}>
      <div className="space-y-4">
        {v.etapa === 'concluido' && (
          <SeloPendencias moeda={v.moedaPrincipal} pendencias={[...(faltaReceber ? [{ id: 'faltaReceber' as const, texto: 'Falta receber', valor: faltaReceber, nivel: 'urgente' as const }] : []), ...(semComprovante ? [{ id: 'semComprovante' as const, texto: 'Sem comprovante do pagamento', nivel: 'atencao' as const }] : [])]} />
        )}
        {/* TOTAL + AÇÕES no alto (como no pacote): o que importa e o que fazer, sem rolar */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 shadow-sm">
          <div className="min-w-0">
            <div className="text-xs text-[var(--suave)]">{t('Total')}</div>
            <div className="num text-2xl font-bold">{formatar(v.totalPrincipal, v.moedaPrincipal)}</div>
            <div className="truncate text-sm text-[var(--suave)]">{t('Pago')}: {v.pagamentos.map((p) => `${formatar(p.valor, p.moeda)} (${nomeForma(p.forma)})`).join(' + ') || '—'}</div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <a className="flex min-h-11 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-[#25d366] px-3 text-sm font-semibold text-white sm:flex-none" href={linkWhatsApp(texto, dados.cliente?.telefone)} target="_blank" rel="noreferrer" aria-label={t('Recibo no WhatsApp')}>📲 <span className="sm:hidden">{t('Recibo')}</span><span className="hidden sm:inline">{t('Recibo no WhatsApp')}</span></a>
            {sessao.perfil === 'admin' && (v.etapa === 'concluido' || v.etapa === 'agendado') && <Botao variante="secundario" onClick={() => setCorrigir(true)}>✏️ {t('Corrigir')}</Botao>}
            {sessao.perfil === 'admin' && v.etapa !== 'cancelado' && <MenuAcoes acoes={[{ rotulo: 'Cancelar venda', icone: '✕', onClick: () => setCancelar(true) }]} />}
          </div>
        </div>
        <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a as typeof aba)} abas={[
          { id: 'resumo', nome: 'Resumo' },
          { id: 'arquivos', nome: 'Arquivos', extra: dados.anexos.length ? <span className="num text-xs opacity-70">{dados.anexos.length}</span> : undefined },
          { id: 'historico', nome: 'Histórico' },
          ...(correcoes.length ? [{ id: 'correcoes', nome: 'Correções', extra: <span className="num text-xs opacity-70">{correcoes.length}</span> }] : []),
        ]} />
        {aba === 'historico' || (aba as string) === 'tempo' ? (
          // UM bloco só: o caminho do cabelo (com o registro desta venda dentro); venda sem cabelo: só o registro
          v.linhas.some((l) => l.itemId)
            ? <CaminhoDoCabelo de={{ vendaId: v.id }} atual="venda" semCadeia={<LinhaDoTempo id={v.id} />} />
            : <Cartao titulo={t('Histórico')}><LinhaDoTempo id={v.id} /></Cartao>
        ) : aba === 'arquivos' ? (
          // ARQUIVOS padrão de toda ficha (o mesmo do pedido e do pacote)
          <AbaAnexos donoId={v.id} categorias={['comprovante', 'pedido', 'resultado']} padrao="comprovante" />
        ) : aba === 'correcoes' && correcoes.length ? (
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
        ) : <>
        {/* bater o olho: de qual compra veio, qual pacote saiu e QUAL ETIQUETA ele tem (o completo fica em Linha do tempo) */}
        {v.linhas.some((l) => l.itemId) && <CaminhoDoCabelo de={{ vendaId: v.id }} atual="venda" compacto className="mb-4" />}
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao titulo={t('Itens')}>
            <ul className="divide-y divide-[var(--borda)] text-sm">
              {v.linhas.map((l) => (
                <li key={l.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0 break-words">{l.descricao}{l.campos.calculo ? <span className="num block text-[var(--suave)]">{String(l.campos.calculo)}</span> : null}{l.desconto ? <span className="num block text-[var(--suave)]">− {t('desconto')} {formatar(l.desconto, l.moeda)}</span> : null}</span>
                    <b className="num shrink-0">{formatar(l.total, l.moeda)}</b>
                  </div>
                  {(sessao.perfil === 'admin' || (l.profissionalId && l.profissionalId === (sessao.pessoaId ?? sessao.usuarioId))) && <MemoriaLinha linha={l} moeda={v.moedaPrincipal} />}
                </li>
              ))}
            </ul>
            {descontoVenda && <p className="num mt-2 text-sm font-semibold text-[var(--bom)]">{descontoVenda.charAt(0).toUpperCase() + descontoVenda.slice(1)}</p>}
            <div className="mt-2 flex justify-between gap-2 border-t border-[var(--borda)] pt-2 font-bold"><span>{t('Total')}</span><span className="num">{formatar(v.totalPrincipal, v.moedaPrincipal)}</span></div>
            {v.pagamentos.some((p) => comCotacao(p)) && <p className="num text-xs text-[var(--suave)]">{v.pagamentos.map((p) => `${formatar(p.valor, p.moeda)}${comCotacao(p)}`).join(' + ')}</p>}
            {v.campos.cobranca ? <p className="text-sm font-semibold">💱 {String(v.campos.cobranca)}</p> : null}
          </Cartao>
          {v.linhas.some((l) => l.itemId) && <OrigemDaVenda vendaId={v.id} admin={sessao.perfil === 'admin'} />}
        </div>
        </>}
      </div>
      {corrigir && <CorrigirVenda venda={v} temCliente={!!v.pessoaId} onFechar={() => setCorrigir(false)} />}
      {cancelar && (
        <Confirmar
          perigo
          pedirMotivo
          titulo="Cancelar venda"
          texto="O estoque volta e cada pagamento é estornado. Nada é apagado."
          rotulo="Cancelar venda"
          onConfirmar={(motivo) => executar('cancelarVenda', { id, motivo }, t('Venda cancelada: estoque e dinheiro voltaram.'))}
          onFechar={() => setCancelar(false)}
        />
      )}
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
    // com fator: cheio − desconto da linha (valor digitado é o final, sem desconto)
    const tot = c.total !== undefined ? c.total : f && fatorValido(f) && (c.fator || c.quantidade !== undefined) ? Math.max(0, multiplicarFator(q, f, l.moeda) - (l.desconto ?? 0)) : l.total
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

/**
 * De onde veio este cabelo: a parte de cada compra NESTA venda, em gramas ("1,5 kg da compra C1 · Maria"), para quem
 * vendeu também (sem custo), uma linha por compra. O admin vê também a conta numa linha e, sob demanda, o rastreio completo.
 */
function OrigemDaVenda({ vendaId, admin }: { vendaId: Id; admin: boolean }) {
  const t = useT()
  const { ir } = useApp()
  const [completo, setCompleto] = useState(false)
  const { dados: origem } = useConsulta('origemDaVenda', { vendaId }, admin)
  const { dados } = useConsulta('genealogia', { vendaId }, admin)
  const temRastreio = admin && !!dados?.lotes.length
  if (!origem?.length && !temRastreio) return null
  // uma linha por compra de origem: "1,5 kg de P-0001 · Maria" (a página da compra é do admin; quem vendeu vê sem abrir, e sem custo)
  const linhas: LinhaRastreio[] = (origem ?? []).map((o) => ({
    id: o.compraId,
    principal: <><span aria-hidden>🛒</span> {t('{g} de {compra}', { g: gramasTexto(o.gramas), compra: o.codigo ?? o.compraId.slice(-4).toUpperCase() })}</>,
    detalhe: o.fornecedor,
    onClick: admin ? () => ir('pedido', { id: o.compraId }) : undefined,
  }))
  // simples: só as compras desta venda; a conta da compra inteira (estoque, vendido, perda) fica no rastreio completo
  return (
    <Cartao titulo={t('De onde veio este cabelo')} ajuda="As compras que formaram este cabelo, em gramas. Ex.: 1,5 kg da Maria + 1 kg do Celso.">
      <ListaRastreio linhas={linhas} />
      {temRastreio && dados && (
        <>
          <button type="button" aria-expanded={completo} onClick={() => setCompleto(!completo)} className="min-h-10 text-sm font-semibold text-[var(--marca)] hover:underline">{completo ? t('Fechar o rastreio') : t('Ver rastreio completo →')}</button>
          {completo && <div className="mt-2"><RastreioTotal g={dados} /></div>}
        </>
      )}
    </Cartao>
  )
}
