// LISTA DE VENDAS (a lista que forma os números do painel: a soma é o cartão) e DETALHE da venda com linha do tempo.

import { useState } from 'react'
import { fatorValido, formatar, multiplicarFator } from '../core/domain/dinheiro'
import type { Id, Transacao } from '../core/domain/tipos'
import { Botao, Campo, Carregando, Cartao, Entrada, GramasInput, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, ErroTela } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { Anexos, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'
import { baixarCSV } from './Relatorios'
import { FiltroPendencia, SeloPendencias } from '../ui/pendencias'

export function Vendas() {
  const t = useT()
  const { nav, ir } = useApp()
  const f = nav.params
  const { dados: usuarios } = useConsulta('pessoas', { papel: 'funcionario' })
  const [usuarioId, setUsuarioId] = useState((f.usuarioId as string) ?? '')
  const [pendencia, setPendencia] = useState((f.pendencia as string) ?? '')
  const base = { de: f.de as string, ate: f.ate as string, moduloId: f.moduloId as string, forma: f.forma as string, moeda: f.moeda as string, localId: f.localId as string, profissionalId: f.profissionalId as string, usuarioId: usuarioId || undefined }
  const { dados: todas } = useConsulta('vendas', base)
  const dados = todas?.filter((v) => !pendencia || (pendencia === 'qualquer' ? v.pendencias.length > 0 : v.pendencias.some((p) => p.id === pendencia)))
  const contagem = todas && { '': todas.length, qualquer: todas.filter((v) => v.pendencias.length).length, faltaReceber: todas.filter((v) => v.pendencias.some((p) => p.id === 'faltaReceber')).length, semComprovante: todas.filter((v) => v.pendencias.some((p) => p.id === 'semComprovante')).length }
  const soma = (dados ?? []).reduce((s, v) => s + v.valor, 0)
  const moeda = (f.moeda as string) || dados?.[0]?.moedaPrincipal || 'BOB'
  return (
    <div>
      <Titulo subtitulo={`${f.de ? dataBR(f.de as string) : ''} – ${f.ate ? dataBR(f.ate as string) : ''}${f.moduloId ? ` · ${f.moduloId}` : ''}`} acao={dados && <Botao variante="secundario" onClick={() => baixarCSV('vendas', dados.map((v) => ({ data: v.data, cliente: v.cliente ?? '', itens: v.linhas.map((l) => l.descricao).join(' + '), valor: v.valor / 100, lucro: v.lucroPrincipal / 100, feito_por: v.feitoPor ?? '' })))}>CSV</Botao>}>
        {t('Vendas')}
      </Titulo>
      <div className="mb-2">
        <FiltroPendencia valor={pendencia} onChange={setPendencia} contagem={contagem} opcoes={[{ id: 'faltaReceber', nome: 'Falta receber' }, { id: 'semComprovante', nome: 'Sem comprovante' }]} />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Selecao className="w-auto" valor={usuarioId} onChange={setUsuarioId} vazio="Feitas por qualquer pessoa" opcoes={(usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome }))} />
      </div>
      <Cartao className="mb-3"><div className="flex justify-between font-bold"><span>{dados?.length ?? 0} {t('vendas')}</span><span className="num">{formatar(soma, moeda)}</span></div></Cartao>
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
  const { nav, voltar, sessao } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('venda', { id })
  const { executar, ocupado } = useComando()
  const [cancelar, setCancelar] = useState(false)
  const [corrigir, setCorrigir] = useState(false)
  const [motivo, setMotivo] = useState('')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const v = dados.venda
  const correcoes = v.historico.filter((h) => h.tipo === 'correcao')
  const pago = v.pagamentos.reduce((s, x) => s + x.valorPrincipal, 0)
  const faltaReceber = v.etapa === 'concluido' && v.totalPrincipal - pago > v.pagamentos.length ? v.totalPrincipal - pago : 0
  const naoVivo = v.pagamentos.some((x) => x.forma !== 'dinheiro')
  const semComprovante = v.etapa === 'concluido' && naoVivo && !dados.anexos.some((a) => a.categoria === 'comprovante')
  const texto = [`${t('Venda')} ${dataBR(v.data)}`, dados.cliente ? `${t('Cliente')}: ${dados.cliente.nome}` : '', ...v.linhas.map((l) => (l.campos.calculo ? String(l.campos.calculo) : `${l.descricao}: ${formatar(l.total, l.moeda)}`)), `${t('Total')}: ${formatar(v.totalPrincipal, v.moedaPrincipal)}`].filter(Boolean).join('\n')
  return (
    <div className="space-y-4">
      <Botao variante="leve" onClick={voltar}>← {t('Voltar')}</Botao>
      <Titulo subtitulo={<>{dataBR(v.data)} · <Pilula tom={v.etapa === 'concluido' ? 'bom' : v.etapa === 'cancelado' ? 'ruim' : 'marca'}>{t(v.etapa)}</Pilula>{dados.local ? ` · ${dados.local.nome}` : ''}{dados.profissional ? ` · ${dados.profissional.nome}` : ''}</>}>
        {t('Venda')} · {dados.cliente?.nome ?? t('Sem nome')}
      </Titulo>
      {v.etapa === 'concluido' && (
        <div className="mb-4">
          <SeloPendencias moeda={v.moedaPrincipal} pendencias={[...(faltaReceber ? [{ id: 'faltaReceber' as const, texto: 'Falta receber', valor: faltaReceber, nivel: 'urgente' as const }] : []), ...(semComprovante ? [{ id: 'semComprovante' as const, texto: 'Sem comprovante do pagamento', nivel: 'atencao' as const }] : [])]} />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo={t('Itens')}>
          <ul className="divide-y divide-[var(--borda)] text-sm">
            {v.linhas.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-2">
                <span>{l.descricao}{l.campos.calculo ? <span className="num block text-[var(--suave)]">{String(l.campos.calculo)}</span> : null}</span>
                <b className="num">{formatar(l.total, l.moeda)}</b>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between text-lg font-bold"><span>{t('Total')}</span><span className="num">{formatar(v.totalPrincipal, v.moedaPrincipal)}</span></div>
          <p className="text-sm text-[var(--suave)]">{t('Pago')}: {v.pagamentos.map((p) => `${formatar(p.valor, p.moeda)} (${p.forma})`).join(' + ') || '—'}</p>
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
                  <div className="text-xs text-[var(--suave)]">{new Date(h.em).toLocaleString('pt-BR')} · <b>{h.porNome}</b> · {h.motivo}</div>
                  {h.ajustes?.map((a) => <div key={a} className="num">{a}</div>)}
                  {h.totalAntes !== undefined && <div className="num font-semibold">{formatar(h.totalAntes, v.moedaPrincipal)} → {formatar(h.totalDepois!, v.moedaPrincipal)}</div>}
                </li>
              ))}
            </ul>
          </Cartao>
        )}
        <Cartao titulo={t('Fotos e comprovantes')}><Anexos donoId={v.id} categorias={['pedido', 'comprovante', 'resultado']} /></Cartao>
      </div>
      {corrigir && <CorrigirVenda venda={v} temCliente={!!v.pessoaId} onFechar={() => setCorrigir(false)} />}
      <Janela aberta={cancelar} titulo={t('Cancelar venda')} onFechar={() => setCancelar(false)} rodape={<Botao variante="perigo" grande className="w-full" disabled={ocupado || !motivo} onClick={async () => (await executar('cancelarVenda', { id, motivo }, t('Venda cancelada: estoque e dinheiro voltaram.'))) && setCancelar(false)}>{t('Cancelar venda')}</Botao>}>
        <p className="mb-2 text-sm">{t('O estoque volta e cada pagamento é estornado. Nada é apagado.')}</p>
        <Entrada placeholder={t('Motivo')} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Janela>
    </div>
  )
}

/** Corrigir a venda quantas vezes precisar: quantidade, fator ou valor de cada linha. A diferença vai para o caixa ou para a conta da cliente. */
function CorrigirVenda({ venda, temCliente, onFechar }: { venda: Transacao; temCliente: boolean; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [linhas, setLinhas] = useState<Record<string, { quantidade?: number; fator?: string; total?: number }>>({})
  const [motivo, setMotivo] = useState('')
  const [destino, setDestino] = useState<'conta' | 'caixa'>(temCliente ? 'conta' : 'caixa')
  const [forma, setForma] = useState('dinheiro')
  const [moeda, setMoeda] = useState(venda.moedaPrincipal)
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
    <Janela aberta larga titulo={t('Corrigir venda')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !motivo.trim()} onClick={async () => {
        const r = await executar('corrigirVenda', {
          id: venda.id,
          motivo,
          linhas: Object.entries(linhas).map(([linhaId, c]) => ({ linhaId, ...c })),
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
              <div className="mb-2 font-semibold">{l.descricao} <span className="num text-sm font-normal text-[var(--suave)]">· {l.campos.calculo ? String(l.campos.calculo) : formatar(l.total, l.moeda)}</span></div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Campo rotulo={l.quantidade > 1 || temFator ? 'Quantidade / gramas' : 'Quantidade'}>{temFator ? <GramasInput valor={c.quantidade ?? l.quantidade} onChange={(q) => setLinhas({ ...linhas, [l.id]: { ...c, quantidade: q } })} /> : <Entrada inputMode="numeric" value={c.quantidade ?? l.quantidade} onChange={(e) => setLinhas({ ...linhas, [l.id]: { ...c, quantidade: Number(e.target.value) || undefined } })} />}</Campo>
                {temFator ? (
                  <Campo rotulo="Fator"><Entrada inputMode="decimal" placeholder={String(l.campos.fator)} value={c.fator ?? ''} onChange={(e) => setLinhas({ ...linhas, [l.id]: { ...c, fator: e.target.value } })} /></Campo>
                ) : (
                  <Campo rotulo="Valor"><ValorInput moeda={l.moeda} valor={c.total ?? l.total} onChange={(v) => setLinhas({ ...linhas, [l.id]: { ...c, total: v } })} /></Campo>
                )}
              </div>
            </div>
          )
        })}
        <div className={cx('rounded-xl p-3 text-sm font-semibold', dif === 0 ? 'bg-[var(--fundo)]' : dif > 0 ? 'bg-[var(--bom)]/10 text-[var(--bom)]' : 'bg-[var(--alerta)]/10 text-[var(--alerta)]')}>
          {formatar(antes, venda.moedaPrincipal)} → {formatar(novoTotal, venda.moedaPrincipal)} {dif !== 0 && `(${dif > 0 ? '+' : ''}${formatar(dif, venda.moedaPrincipal)})`}
        </div>
        {venda.etapa === 'concluido' && dif !== 0 && (
          <Campo rotulo={dif > 0 ? 'A diferença (a mais) foi…' : 'A diferença (a menos) foi…'} ajuda="Na conta da cliente: ela passa a dever (ou ter crédito). No caixa: entrou ou saiu dinheiro agora. Ex.: corrigiu Bs 7.800 → Bs 7.670: devolveu Bs 130 em efectivo.">
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
