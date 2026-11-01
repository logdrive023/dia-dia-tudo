// AGENDA: administrador vê todas (filtra por unidade e profissional); funcionária vê só a dela.
// Atender = lançar o que foi feito e o pagamento (a venda nasce do agendamento).

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal, diaDaSemana, somarDias } from '../core/domain/datas'
import type { Id } from '../core/domain/tipos'
import { Abas, Botao, Carregando, Confirmar, Erro, Cartao, Entrada, Janela, Pilula, Selecao, Titulo, Vazio, cx, dataBR } from '../ui/base'
import { useApp, useComando, useConsulta } from '../ui/contexto'
import { EditorPagamentos, type PagamentoTela, linkWhatsApp } from '../ui/compartilhados'
import { useT } from '../ui/i18n'

export function Agenda() {
  const t = useT()
  const { sessao, ir } = useApp()
  const [modo, setModo] = useState<'dia' | 'semana'>('dia')
  const [data, setData] = useState(dataLocal())
  const [localId, setLocalId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
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
        <Abas atual={modo} onChange={(v) => setModo(v as typeof modo)} abas={[{ id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }]} />
        <Botao variante="leve" onClick={() => setData(somarDias(data, modo === 'dia' ? -1 : -7))}>‹</Botao>
        <Entrada type="date" className="w-auto" value={data} onChange={(e) => setData(e.target.value)} />
        <Botao variante="leve" onClick={() => setData(somarDias(data, modo === 'dia' ? 1 : 7))}>›</Botao>
        <Botao variante="leve" onClick={() => setData(dataLocal())}>{t('Hoje')}</Botao>
        {admin && (
          <>
            <Selecao className="w-auto" valor={localId} onChange={setLocalId} vazio="Todas as unidades" opcoes={(locais ?? []).filter((l) => l.tipo === 'salao').map((l) => ({ id: l.id, nome: l.nome }))} />
            <Selecao className="w-auto" valor={profissionalId} onChange={setProfissionalId} vazio="Todas as profissionais" opcoes={(pessoas ?? []).filter((p) => !localId || p.localId === localId).map((p) => ({ id: p.id, nome: p.nome }))} />
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
                        <div className="flex items-center justify-between gap-2">
                          <b className="num">{new Date(a.agendadoPara!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b>
                          {a.conflito && <Pilula tom="alerta">⚠️ {t('horário ocupado')}</Pilula>}
                          <Pilula tom={a.etapa === 'concluido' ? 'bom' : a.etapa === 'cancelado' ? 'ruim' : 'marca'}>{t(a.etapa === 'agendado' ? 'Agendado' : a.etapa === 'concluido' ? 'Atendido' : a.etapa)}</Pilula>
                        </div>
                        <div className="font-semibold">{a.cliente ?? '—'}</div>
                        <div className="text-sm text-[var(--suave)]">{a.linhas.map((l) => l.descricao).join(', ')} · {a.profissional ?? '—'} · {a.local ?? ''}</div>
                        <div className="num text-sm">{formatar(a.totalPrincipal, a.moedaPrincipal)}</div>
                        {a.etapa === 'agendado' && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Botao onClick={() => setAtender(a.id)}>{t('Atender')}</Botao>
                            <a className="min-h-10 rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm font-semibold text-[var(--marca)]" target="_blank" rel="noreferrer" href={linkWhatsApp(`${t('Olá')} ${a.cliente ?? ''}! ${t('Lembrete do seu horário')}: ${dataBR(a.agendadoPara)} ${new Date(a.agendadoPara!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${a.local ?? ''}`)}>{t('Lembrar')}</a>
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

function Atender({ id, onFechar }: { id: Id; onFechar(): void }) {
  const t = useT()
  const { dados } = useConsulta('venda', { id })
  const { executar, ocupado } = useComando()
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  if (!dados) return null
  const v = dados.venda
  return (
    <Janela aberta titulo={`${t('Atender')} · ${dados.cliente?.nome ?? ''}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado} onClick={async () => (await executar('atenderAgendamento', { id, pagamentos: pagamentos.filter((p) => p.valor).map((p) => ({ id: p.id, forma: p.forma, moeda: p.moeda, valor: p.valor! })) }, t('Atendimento registrado.'))) && onFechar()}>{t('Registrar atendimento')}</Botao>}>
      <ul className="mb-3 text-sm">{v.linhas.map((l) => <li key={l.id} className="flex justify-between"><span>{l.descricao}</span><b className="num">{formatar(l.total, l.moeda)}</b></li>)}</ul>
      <EditorPagamentos total={v.totalPrincipal} moedaTotal={v.moedaPrincipal} pagamentos={pagamentos} onChange={setPagamentos} permiteFiado={!!v.pessoaId} />
    </Janela>
  )
}
