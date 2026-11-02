// AGENDA: administrador vê todas (filtra por unidade e profissional); funcionária vê só a dela.
// Atender = lançar o que foi feito e o pagamento (a venda nasce do agendamento).

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal, diaDaSemana, somarDias } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, Linha } from '../core/domain/tipos'
import { Botao, Carregando, Confirmar, Erro, Cartao, Entrada, Escolha, Janela, Pilula, Selecao, Titulo, Vazio, cx, dataBR, loc } from '../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { EditorPagamentos, type PagamentoTela, conv, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { type AjusteServico, EditorServico, SeletorServicos, ajusteParaEntrada, faltaNoAjuste } from '../ui/linhaServico'
import { useT } from '../ui/i18n'
import { NOME_ETAPA } from './Vendas'

const hora = (iso: string) => new Date(iso).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })

export function Agenda() {
  const t = useT()
  const { sessao, ir } = useApp()
  const [modo, setModo] = useParamTela<'dia' | 'semana'>('modo', 'dia')
  const [data, setData] = useParamTela('data', dataLocal())
  const [localId, setLocalId] = useParamTela('localId', '')
  const [profissionalId, setProfissionalId] = useParamTela('profissionalId', '')
  const [atender, setAtender] = useState<Id>()
  const [desmarcar, setDesmarcar] = useState<Id>()
  const de = modo === 'dia' ? data : somarDias(data, -((new Date(data + 'T12:00').getDay() + 6) % 7))
  const ate = modo === 'dia' ? data : somarDias(de, 6)
  const { dados, erro } = useConsulta('agenda', { de, ate, localId: localId || undefined, profissionalId: profissionalId || undefined })
  const { dados: locais } = useConsulta('locais', {})
  const { dados: pessoas } = useConsulta('pessoas', { papel: 'profissional' })
  const { executar } = useComando()
  const dias = modo === 'dia' ? [data] : Array.from({ length: 7 }, (_, i) => somarDias(de, i))
  const admin = sessao.perfil === 'admin'
  return (
    <div>
      <Titulo subtitulo={admin ? t('Todas as agendas, em tempo real.') : t('Seus atendimentos.')} acao={<Botao onClick={() => ir('vender', { modulo: 'salao' })}>+ {t('Agendar')}</Botao>}>
        {admin ? t('Agenda') : t('Minha agenda')}
      </Titulo>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto"><Escolha<typeof modo> rotulo="Ver por" valor={modo} onChange={setModo} opcoes={[{ id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }]} /></div>
        <Botao variante="leve" className="min-w-10 px-2" aria-label={t(modo === 'dia' ? 'Dia anterior' : 'Semana anterior')} onClick={() => setData(somarDias(data, modo === 'dia' ? -1 : -7))}>‹</Botao>
        <Entrada type="date" aria-label={t('Dia')} className="w-auto min-w-0 max-w-[11rem]" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
        <Botao variante="leve" className="min-w-10 px-2" aria-label={t(modo === 'dia' ? 'Próximo dia' : 'Próxima semana')} onClick={() => setData(somarDias(data, modo === 'dia' ? 1 : 7))}>›</Botao>
        <Botao variante="leve" onClick={() => setData(dataLocal())}>{t('Hoje')}</Botao>
        {admin && (
          <>
            <Selecao className="w-auto max-w-full" valor={localId} onChange={setLocalId} vazio="Todas as unidades" opcoes={(locais ?? []).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome }))} />
            <Selecao className="w-auto max-w-full" valor={profissionalId} onChange={setProfissionalId} vazio="Todas as profissionais" opcoes={(pessoas ?? []).filter((p) => !localId || p.localId === localId).map((p) => ({ id: p.id, nome: p.nome }))} />
          </>
        )}
      </div>
      {erro ? (
        <Erro texto={erro} />
      ) : !dados ? (
        <Carregando />
      ) : (
        <div className={cx('grid gap-3', modo === 'semana' && 'md:grid-cols-2 xl:grid-cols-4')}>
          {dias.map((d) => {
            const doDia = dados.filter((a) => a.agendadoPara!.slice(0, 10) === d || new Date(a.agendadoPara!).toISOString().slice(0, 10) === d).filter((a) => dataLocal(new Date(a.agendadoPara!)) === d)
            return (
              <Cartao key={d} titulo={`${t(diaDaSemana(d))} ${dataBR(d)}`}>
                {!doDia.length ? (
                  <Vazio texto="Nada agendado." />
                ) : (
                  <ul className="space-y-2">
                    {doDia.map((a) => (
                      <li key={a.id} className="rounded-xl border border-[var(--borda)] p-2">
                        <button type="button" onClick={() => ir('venda', { id: a.id })} className="block w-full rounded-lg text-left hover:bg-[var(--marca-suave)]">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <b className="num">{hora(a.agendadoPara!)}</b>
                            {a.conflito && <Pilula tom="alerta">⚠️ {t('horário ocupado')}</Pilula>}
                            <Pilula tom={a.etapa === 'concluido' ? 'bom' : a.etapa === 'cancelado' ? 'ruim' : 'marca'}>{t(a.etapa === 'agendado' ? 'Agendado' : a.etapa === 'concluido' ? 'Atendido' : (NOME_ETAPA[a.etapa] ?? a.etapa))}</Pilula>
                          </span>
                          <span className="block break-words font-semibold">{a.cliente ?? '—'}</span>
                          <span className="block break-words text-sm text-[var(--suave)]">{[a.linhas.map((l) => l.descricao).join(', '), a.profissional ?? '—', a.local].filter(Boolean).join(' · ')}</span>
                          <span className="num block text-sm">{formatar(a.totalPrincipal, a.moedaPrincipal)}</span>
                        </button>
                        {a.etapa === 'agendado' && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Botao onClick={() => setAtender(a.id)}>{t('Atender')}</Botao>
                            <a className="min-h-10 rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm font-semibold text-[var(--marca)]" target="_blank" rel="noreferrer" href={linkWhatsApp(`${t('Olá')} ${a.cliente ?? ''}! ${t('Lembrete do seu horário')}: ${dataBR(a.agendadoPara)} ${hora(a.agendadoPara!)}${a.local ? ` · ${a.local}` : ''}`)}>{t('Lembrar')}</a>
                            <Botao variante="leve" onClick={() => setDesmarcar(a.id)}>{t('Desmarcar')}</Botao>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Cartao>
            )
          })}
        </div>
      )}
      {atender && <Atender id={atender} onFechar={() => setAtender(undefined)} />}
      {desmarcar && <Confirmar titulo="Desmarcar atendimento?" texto="O horário fica livre e o atendimento sai da agenda (fica no histórico)." rotulo="Desmarcar" perigo pedirMotivo motivoPadrao={t('Cliente desmarcou')} onFechar={() => setDesmarcar(undefined)} onConfirmar={(motivo) => executar('cancelarVenda', { id: desmarcar, motivo }, t('Desmarcado.'))} />}
    </div>
  )
}

interface LinhaAtender {
  id: Id
  itemId?: Id
  nome: string
  quantidade: number
  moeda: string
  total: number
  profissionalId?: Id
  calculo?: { medida?: number; fator: string; categoria?: string; tabelaId?: Id; colunaId?: string }
  ajuste?: AjusteServico
}

/** linha gravada → linha editável (o que foi ajustado no agendamento continua valendo) */
function paraEditar(l: Linha, moedaPrincipal: string): LinhaAtender {
  const ajuste: AjusteServico = {}
  if (l.insumoMotivo) ajuste.insumo = { moeda: moedaPrincipal, itens: (l.insumos ?? []).map((i) => ({ nome: i.nome, valor: i.valorPrincipal })), motivo: l.insumoMotivo }
  if (l.comissaoRegra === 'linha') ajuste.comissaoBp = l.comissaoBp
  if (l.motivoPreco) ajuste.motivoPreco = l.motivoPreco
  const fator = l.campos.fator as string | undefined
  return {
    id: l.id,
    itemId: l.itemId,
    nome: l.descricao,
    quantidade: l.quantidade,
    moeda: l.moeda,
    total: l.total,
    profissionalId: l.profissionalId,
    calculo: fator ? { medida: l.campos.medida as number | undefined, fator, categoria: l.campos.categoria as string | undefined, tabelaId: l.campos.tabelaId as string | undefined, colunaId: l.campos.colunaId as string | undefined } : undefined,
    ajuste,
  }
}

function Atender({ id, onFechar }: { id: Id; onFechar(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const { dados } = useConsulta('venda', { id })
  const { dados: servicos } = useConsulta('catalogo', { moduloId: 'salao', incluirAvulsos: true })
  const { dados: pessoas } = useConsulta('pessoas', {})
  const { cot, cfg } = useCotacoes('venda')
  const { executar, ocupado } = useComando()
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  const [linhas, setLinhas] = useState<LinhaAtender[]>()
  const [mexeu, setMexeu] = useState(false)
  const [maisServico, setMaisServico] = useState(false)
  const fechar = () => (!(mexeu || pagamentos.some((p) => p.valor)) || window.confirm(t('Sair sem salvar?'))) && onFechar()
  if (dados && !linhas) setLinhas(dados.venda.linhas.map((l) => paraEditar(l, dados.venda.moedaPrincipal)))
  if (!dados || !linhas) return <Janela aberta titulo={t('Atender')} onFechar={onFechar}><Carregando /></Janela>
  const v = dados.venda
  const mudar = (ls: LinhaAtender[]) => (setLinhas(ls), setMexeu(true))
  const servicoDe = (itemId?: Id) => servicos?.find((i) => i.id === itemId)
  const total = mexeu ? linhas.reduce((s, l) => s + (conv(l.total, l.moeda, v.moedaPrincipal, cot) ?? 0), 0) : v.totalPrincipal
  const pendencia = linhas.map((l) => (l.ajuste && servicoDe(l.itemId) ? faltaNoAjuste({ item: servicoDe(l.itemId), total: l.total, moeda: l.moeda, ajuste: l.ajuste, perfil: sessao.perfil, cot, moedaPrincipal: v.moedaPrincipal }) : undefined)).find(Boolean)
  const registrar = async () => {
    const r = await executar(
      'atenderAgendamento',
      {
        id,
        linhas: mexeu ? linhas.map((l) => ({ id: l.id, itemId: l.itemId!, quantidade: l.quantidade, moeda: l.moeda, total: l.total, profissionalId: l.profissionalId, calculo: l.calculo, ...ajusteParaEntrada(l.ajuste) })) : undefined,
        pagamentos: pagamentos.filter((p) => p.valor).map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })),
      },
      t('Atendimento registrado.'),
    )
    if (r) onFechar()
  }
  return (
    <Janela
      aberta
      larga
      titulo={`${t('Atender')}${dados.cliente ? ` · ${dados.cliente.nome}` : ''}`}
      onFechar={fechar}
      rodape={
        <>
          {pendencia && <p className="mb-2 text-sm font-semibold text-[var(--alerta)]">{t(pendencia)}</p>}
          <Botao grande className="w-full" disabled={ocupado || !linhas.length || !!pendencia} onClick={registrar}>{t('Registrar atendimento')}</Botao>
        </>
      }
    >
      <ul className="mb-3 space-y-2 text-sm">
        {linhas.map((l) => {
          const item = servicoDe(l.itemId)
          const prof = l.profissionalId ?? v.profissionalId
          return (
            <li key={l.id} className="border-b border-[var(--borda)] pb-2">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 break-words font-semibold">{l.nome}</span>
                <span className="flex items-center gap-1">
                  <b className="num">{formatar(l.total, l.moeda)}</b>
                  <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-lg hover:bg-[var(--marca-suave)]" onClick={() => mudar(linhas.filter((x) => x.id !== l.id))}>×</button>
                </span>
              </div>
              {item?.unidade === 'servico' && (
                <EditorServico
                  item={item}
                  total={l.total}
                  moeda={l.moeda}
                  onTotal={(x) => mudar(linhas.map((y) => (y.id === l.id ? { ...y, total: x } : y)))}
                  ajuste={l.ajuste ?? {}}
                  onAjuste={(a) => mudar(linhas.map((y) => (y.id === l.id ? { ...y, ajuste: a } : y)))}
                  profissional={pessoas?.find((x) => x.id === prof)}
                  temProfissional={!!prof}
                  cot={cot}
                  moedaPrincipal={v.moedaPrincipal}
                  padraoBp={cfg?.comissaoPadraoBp}
                  podeMudarComissao={sessao.perfil === 'admin' || !!cfg?.comissaoFuncionarioMuda}
                />
              )}
            </li>
          )
        })}
      </ul>
      {maisServico ? (
        <div className="mb-3">
          <SeletorServicos moeda={v.moedaPrincipal} rotulo="Mais um serviço" onAdd={(i, preco) => (mudar([...linhas, { id: novoId(), itemId: i.id, nome: i.nome, quantidade: 1, moeda: i.precoSugerido?.moeda ?? v.moedaPrincipal, total: preco, profissionalId: v.profissionalId }]), setMaisServico(false))} />
        </div>
      ) : (
        <Botao variante="secundario" className="mb-3" onClick={() => setMaisServico(true)}>+ {t('Mais um serviço')}</Botao>
      )}
      <EditorPagamentos total={total} moedaTotal={v.moedaPrincipal} pagamentos={pagamentos} onChange={setPagamentos} permiteFiado={!!v.pessoaId} />
    </Janela>
  )
}
