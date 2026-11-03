// AGENDA em CALENDÁRIO (Mês, Semana, Dia): atendimentos do salão ✂️, viagens ✈️ e compromissos/lembretes 📌.
// Administrador vê tudo (filtra por profissional, unidade e tipo) e marca compromisso para quem quiser; funcionária vê
// só o que é dela, marca o próprio trabalho e diz "Feito" e "Pago" em dois toques.
// Atender = lançar o que foi feito e o pagamento (a venda nasce do agendamento).

import { useRef, useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal, diaDaSemana, somarDias, somarMeses } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, Linha } from '../core/domain/tipos'
import type { ItemCalendario, TipoCalendario } from '../core/services/agenda'
import { Botao, Campo, Carregando, Confirmar, Entrada, Erro, Escolha, Info, Janela, Selecao, Titulo, cx, dataBR, loc } from '../ui/base'
import { TIPOS_CAL, PilulasStatus, VistaDia, VistaMes, VistaSemana, gradeMes, inicioSemana, tipoCal, useLargo } from '../ui/calendario'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { EditorPagamentos, SeletorPessoa, type PagamentoTela, conv, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { type AjusteServico, EditorServico, SeletorServicos, ajusteParaEntrada, faltaNoAjuste } from '../ui/linhaServico'
import { useT } from '../ui/i18n'

type Modo = 'mes' | 'semana' | 'dia'

export function Agenda() {
  const t = useT()
  const { sessao, ir } = useApp()
  const largo = useLargo()
  const admin = sessao.perfil === 'admin'
  const [modo, setModo] = useParamTela<Modo>('modo', largo ? 'mes' : 'semana')
  const [data, setData] = useParamTela('data', dataLocal())
  const [localId, setLocalId] = useParamTela('localId', '')
  const [profissionalId, setProfissionalId] = useParamTela('profissionalId', '')
  const [tiposTxt, setTipos] = useParamTela('tipos', '')
  const tipos = tiposTxt ? (tiposTxt.split(',') as TipoCalendario[]) : []
  const [abertoId, setAberto] = useState<string>()
  const [mais, setMais] = useState(false)
  const [novo, setNovo] = useState<{ tipo: 'trabalho' | 'compromisso'; data: string; hora?: string; editar?: Id }>()
  const grade = modo === 'mes' ? gradeMes(data) : undefined
  const de = grade ? grade[0] : modo === 'semana' ? inicioSemana(data) : data
  const ate = grade ? grade[grade.length - 1] : modo === 'semana' ? somarDias(de, 6) : data
  const { dados, erro } = useConsulta('calendario', { de, ate, localId: localId || undefined, pessoaId: admin ? profissionalId || undefined : undefined, tipos: tipos.length ? tipos : undefined })
  const { dados: locais } = useConsulta('locais', {}, admin)
  const { dados: pessoas } = useConsulta('pessoas', {}, admin)
  const aberto = dados?.find((i) => i.id === abertoId)
  const hoje = dataLocal()

  const passo = (n: number) => setData(modo === 'mes' ? somarMeses(data, n) : somarDias(data, modo === 'semana' ? 7 * n : n))
  const abrirDia = (d: string) => (setData(d), setModo('dia'))
  const rotulo =
    modo === 'mes'
      ? new Date(data + 'T12:00').toLocaleDateString(loc(), { month: 'long', year: 'numeric' })
      : modo === 'semana'
        ? `${dataBR(de).slice(0, 5)} – ${dataBR(ate)}`
        : `${t(diaDaSemana(data))} ${dataBR(data)}`
  // arrastar para o lado troca o período (celular)
  const toque = useRef<{ x: number; y: number }>()
  const fimToque = (e: React.TouchEvent) => {
    const a = toque.current
    const b = e.changedTouches[0]
    toque.current = undefined
    if (!a || !b) return
    const dx = b.clientX - a.x
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(b.clientY - a.y)) passo(dx < 0 ? 1 : -1)
  }
  const alternarTipo = (id: TipoCalendario) => setTipos(tipos.includes(id) ? tipos.filter((x) => x !== id).join(',') : [...tipos, id].join(','))
  const unidades = (locais ?? []).filter((l) => l.tipo === 'salao')
  const equipe = (pessoas ?? []).filter((p) => p.papeis.some((x) => x === 'profissional' || x === 'funcionario' || x === 'socio')).filter((p) => !localId || !p.localId || p.localId === localId)
  const marcar = (tipo: 'trabalho' | 'compromisso', hora?: string) => (setMais(false), setNovo({ tipo, data, hora }))

  return (
    <div>
      <Titulo
        subtitulo={admin ? t('Todas as agendas, em tempo real.') : t('Seus atendimentos.')}
        acao={
          <div className="relative flex items-center">
            <Botao onClick={() => setMais(!mais)} aria-expanded={mais} aria-haspopup="menu">+ {t('Marcar')}</Botao>
            <Info texto="Marque um trabalho ou um lembrete. Ex.: Corte da Ana · 04/11 15:00." />
            {mais && <div aria-hidden className="fixed inset-0 z-20" onClick={() => setMais(false)} />}
            {mais && (
              <div role="menu" onKeyDown={(e) => e.key === 'Escape' && setMais(false)} className="absolute right-0 top-12 z-30 w-60 rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-1 shadow-xl">
                <ItemMenu icone="✂️" texto={admin ? 'Atendimento' : 'Trabalho'} onClick={() => marcar('trabalho')} />
                <ItemMenu icone="📌" texto="Compromisso / lembrete" onClick={() => marcar('compromisso')} />
                {admin && <ItemMenu icone="✈️" texto="Viagem" onClick={() => (setMais(false), ir('novaViagem'))} />}
              </div>
            )}
          </div>
        }
      >
        {admin ? t('Agenda') : t('Minha agenda')}
      </Titulo>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto">
          <Escolha<Modo> rotulo="Ver por" valor={modo} onChange={setModo} opcoes={[{ id: 'mes', nome: 'Mês' }, { id: 'semana', nome: 'Semana' }, { id: 'dia', nome: 'Dia' }]} />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Botao variante="leve" className="min-w-10 px-2" aria-label={t(modo === 'dia' ? 'Dia anterior' : modo === 'semana' ? 'Semana anterior' : 'Mês anterior')} onClick={() => passo(-1)}>‹</Botao>
          <label className="relative min-w-0">
            <span className="block truncate rounded-xl px-2 py-2 text-center text-sm font-bold first-letter:uppercase">{rotulo}</span>
            <input type="date" aria-label={t('Dia')} value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <Botao variante="leve" className="min-w-10 px-2" aria-label={t(modo === 'dia' ? 'Próximo dia' : modo === 'semana' ? 'Próxima semana' : 'Próximo mês')} onClick={() => passo(1)}>›</Botao>
          <Botao variante={data === hoje ? 'secundario' : 'leve'} onClick={() => setData(hoje)}>{t('Hoje')}</Botao>
        </div>
      </div>

      {admin && (
        <div className="mb-3 space-y-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {TIPOS_CAL.map((x) => (
              <Ficha key={x.id} ativo={!tipos.length || tipos.includes(x.id)} cor={x.cor} onClick={() => alternarTipo(x.id)}>{x.icone} {t(x.nome)}</Ficha>
            ))}
            {unidades.length > 1 && <span className="mx-1 w-px shrink-0 bg-[var(--borda)]" />}
            {unidades.length > 1 && <Ficha ativo={!localId} onClick={() => setLocalId('')}>{t('Todas as unidades')}</Ficha>}
            {unidades.length > 1 && unidades.map((u) => <Ficha key={u.id} ativo={localId === u.id} onClick={() => setLocalId(localId === u.id ? '' : u.id)}>{u.nome}</Ficha>)}
          </div>
          {equipe.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              <Ficha ativo={!profissionalId} onClick={() => setProfissionalId('')}>{t('Todas as pessoas')}</Ficha>
              {equipe.map((p) => <Ficha key={p.id} ativo={profissionalId === p.id} onClick={() => setProfissionalId(profissionalId === p.id ? '' : p.id)}>{p.nome}</Ficha>)}
            </div>
          )}
        </div>
      )}

      <div onTouchStart={(e) => (toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={fimToque}>
        {erro ? (
          <Erro texto={erro} />
        ) : !dados ? (
          <Carregando />
        ) : modo === 'mes' ? (
          <VistaMes data={data} itens={dados} largo={largo} onDia={abrirDia} onAbrir={(i) => setAberto(i.id)} />
        ) : modo === 'semana' ? (
          <VistaSemana de={de} itens={dados} largo={largo} onDia={abrirDia} onAbrir={(i) => setAberto(i.id)} />
        ) : (
          <VistaDia data={data} itens={dados} onAbrir={(i) => setAberto(i.id)} onHora={(h) => marcar('trabalho', h)} />
        )}
      </div>

      {aberto && <Detalhe i={aberto} onFechar={() => setAberto(undefined)} onEditar={() => (setAberto(undefined), setNovo({ tipo: 'compromisso', data: aberto.data, editar: aberto.ref.id }))} />}
      {novo?.tipo === 'trabalho' && <NovoTrabalho dataInicial={novo.data} horaInicial={novo.hora} localPadrao={localId || undefined} profissionalPadrao={profissionalId || undefined} onFechar={() => setNovo(undefined)} />}
      {novo?.tipo === 'compromisso' && <FormCompromisso dataInicial={novo.data} editar={novo.editar} onFechar={() => setNovo(undefined)} />}
    </div>
  )
}

function ItemMenu({ icone, texto, onClick }: { icone: string; texto: string; onClick(): void }) {
  const t = useT()
  return (
    <button type="button" role="menuitem" onClick={onClick} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-[var(--marca-suave)]">
      <span aria-hidden>{icone}</span> {t(texto)}
    </button>
  )
}

/** Filtro em ficha (chip): liga/desliga. */
function Ficha({ ativo, cor, onClick, children }: { ativo: boolean; cor?: string; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cx('min-h-9 shrink-0 rounded-full border px-3 text-sm font-semibold', ativo ? 'border-[var(--marca)] bg-[var(--marca-suave)] text-[var(--marca)]' : 'border-[var(--borda)] text-[var(--suave)]')}
      style={ativo && cor ? { borderColor: cor, background: `${cor}1f`, color: 'var(--texto)' } : undefined}
    >
      {children}
    </button>
  )
}

// ---------- folha do item ----------

function Detalhe({ i, onFechar, onEditar }: { i: ItemCalendario; onFechar(): void; onEditar(): void }) {
  const t = useT()
  const { sessao, ir } = useApp()
  const { executar, ocupado } = useComando()
  const [acao, setAcao] = useState<'atender' | 'depois' | 'desmarcar' | 'receber' | 'excluir'>()
  const { dados: venda } = useConsulta('venda', { id: i.ref.id }, i.tipo === 'atendimento')
  const tp = tipoCal(i.tipo)
  const admin = sessao.perfil === 'admin'
  const quando = i.diaTodo
    ? i.data !== i.ateData
      ? `${dataBR(i.data)} – ${dataBR(i.ateData)}`
      : `${t(diaDaSemana(i.data))} ${dataBR(i.data)} · ${t('Dia todo')}`
    : `${t(diaDaSemana(i.data))} ${dataBR(i.data)} · ${i.hora}${i.horaFim ? `–${i.horaFim}` : ''}`
  const linhas: [string, string | undefined][] = [
    ['Quando', quando + (i.semanal ? ` · ${t('toda semana')}` : '')],
    ['Cliente', i.cliente],
    [i.tipo === 'atendimento' ? 'Serviço' : i.tipo === 'viagem' ? 'Destino' : 'Nota', i.tipo === 'atendimento' && i.cliente ? i.detalhe : i.tipo !== 'atendimento' ? i.detalhe : undefined],
    [i.tipo === 'atendimento' ? 'Quem atende' : i.tipo === 'viagem' ? 'Quem viaja' : 'Para quem', i.pessoa],
    ['Unidade', i.local],
    ['Valor', i.valor !== undefined && i.moeda ? formatar(i.valor, i.moeda) : undefined],
  ]
  const lembrar = `${t('Olá')} ${i.cliente ?? ''}! ${t('Lembrete do seu horário')}: ${dataBR(i.data)} ${i.hora ?? ''}${i.local ? ` · ${i.local}` : ''}`
  const tel = venda?.cliente?.telefone
  const concluir = (desfazer?: boolean) => executar('concluirEvento', { id: i.ref.id, data: i.data, desfazer }, t(desfazer ? 'Voltou para agendado.' : 'Feito.'))
  return (
    <>
      <Janela aberta={!acao || acao === 'depois' || acao === 'desmarcar' || acao === 'excluir'} titulo={<span><span aria-hidden>{tp.icone}</span> {t(tp.nome)}</span>} onFechar={onFechar}>
        <div className="mb-3 rounded-xl p-3" style={{ background: `${tp.cor}14`, borderLeft: `4px solid ${tp.cor}` }}>
          <p className={cx('break-words text-lg font-bold', i.tipo === 'compromisso' && i.status === 'feito' && 'line-through')}>{i.titulo}</p>
          <div className="mt-1 flex flex-wrap gap-1"><PilulasStatus i={i} /></div>
        </div>
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {linhas.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[var(--suave)]">{t(k)}</dt>
              <dd className="min-w-0 break-words font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {i.tipo === 'atendimento' && i.status === 'agendado' && (
            <>
              <Botao onClick={() => setAcao('atender')}>✓ {t('Feito e pago')}</Botao>
              <Botao variante="secundario" onClick={() => setAcao('depois')}>{t('Feito, pagar depois')}</Botao>
              <a className="inline-flex min-h-10 items-center rounded-xl bg-[var(--marca-suave)] px-3 py-2 text-sm font-semibold text-[var(--marca)]" target="_blank" rel="noreferrer" href={linkWhatsApp(lembrar, tel)}>{t('Lembrar')}</a>
              <Botao variante="leve" onClick={() => setAcao('desmarcar')}>{t('Desmarcar')}</Botao>
            </>
          )}
          {i.tipo === 'atendimento' && i.status === 'feito' && !i.pago && <Botao onClick={() => setAcao('receber')}>{t('Pago')}</Botao>}
          {i.tipo === 'atendimento' && <Botao variante="leve" onClick={() => (onFechar(), ir('venda', { id: i.ref.id }))}>{t('Abrir venda')}</Botao>}
          {i.tipo === 'viagem' && <Botao variante="secundario" onClick={() => (onFechar(), admin ? ir('viagem', { id: i.ref.id }) : ir('viagens'))}>{t('Abrir viagem')}</Botao>}
          {i.tipo === 'compromisso' && (
            <>
              {i.status === 'agendado' ? <Botao disabled={ocupado} onClick={() => concluir()}>✓ {t('Feito')}</Botao> : <Botao variante="secundario" disabled={ocupado} onClick={() => concluir(true)}>{t('Desfazer feito')}</Botao>}
              {i.meu && <Botao variante="secundario" onClick={onEditar}>{t('Editar')}</Botao>}
              {i.meu && <Botao variante="leve" onClick={() => setAcao('excluir')}>{t('Excluir')}</Botao>}
            </>
          )}
        </div>
      </Janela>
      {acao === 'atender' && <Atender id={i.ref.id} onFechar={() => setAcao(undefined)} onPronto={onFechar} />}
      {acao === 'receber' && !!i.falta && !!i.moeda && <Receber vendaId={i.ref.id} falta={i.falta!} moeda={i.moeda!} onFechar={() => setAcao(undefined)} onPronto={onFechar} />}
      {acao === 'depois' && (
        <Confirmar
          titulo="Feito, pagar depois?"
          texto="O atendimento fica feito e o valor vai para a conta da cliente (falta receber). Quando ela pagar, toque em Pago."
          rotulo="Confirmar"
          onFechar={() => setAcao(undefined)}
          onConfirmar={async () => (await executar('atenderAgendamento', { id: i.ref.id, pagamentos: [] }, t('Atendimento registrado.'))) && onFechar()}
        />
      )}
      {acao === 'desmarcar' && (
        <Confirmar titulo="Desmarcar atendimento?" texto="O horário fica livre e o atendimento sai da agenda (fica no histórico)." rotulo="Desmarcar" perigo pedirMotivo motivoPadrao={t('Cliente desmarcou')} onFechar={() => setAcao(undefined)} onConfirmar={async (motivo) => (await executar('cancelarVenda', { id: i.ref.id, motivo }, t('Desmarcado.'))) && onFechar()} />
      )}
      {acao === 'excluir' && (
        <Confirmar titulo="Excluir compromisso?" texto={i.semanal ? 'Sai da agenda em todas as semanas (fica no histórico).' : 'Sai da agenda (fica no histórico).'} rotulo="Excluir" perigo onFechar={() => setAcao(undefined)} onConfirmar={async () => (await executar('excluirEvento', { id: i.ref.id }, t('Excluído.'))) && onFechar()} />
      )}
    </>
  )
}

/** "Pago" depois: recebe o que falta deste atendimento (caixa + conta da cliente). */
function Receber({ vendaId, falta, moeda, onFechar, onPronto }: { vendaId: Id; falta: number; moeda: string; onFechar(): void; onPronto(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [pagamentos, setPagamentos] = useState<PagamentoTela[]>([])
  const salvar = async () => {
    for (const p of pagamentos.filter((x) => x.valor)) {
      const r = await executar('receberAtendimento', { id: p.id, vendaId, forma: p.forma, moeda: p.moeda as never, valor: p.valor! })
      if (!r) return
    }
    onFechar()
    onPronto()
  }
  return (
    <Janela aberta titulo={`${t('Pago')} · ${t('falta')} ${formatar(falta, moeda)}`} onFechar={onFechar} rodape={<Botao grande className="w-full" disabled={ocupado || !pagamentos.some((p) => p.valor)} onClick={salvar}>{t('Registrar pagamento')}</Botao>}>
      <EditorPagamentos total={falta} moedaTotal={moeda} pagamentos={pagamentos} onChange={setPagamentos} permiteFiado />
    </Janela>
  )
}

// ---------- marcar trabalho (atendimento) ----------

interface LinhaNova {
  id: Id
  itemId: Id
  nome: string
  moeda: string
  total: number
}

/** Trabalho/atendimento agendado: cliente, serviço, dia e hora (o mesmo concluirVenda com agendadoPara do Vender). */
function NovoTrabalho({ dataInicial, horaInicial, localPadrao, profissionalPadrao, onFechar }: { dataInicial: string; horaInicial?: string; localPadrao?: Id; profissionalPadrao?: Id; onFechar(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes('venda')
  const { dados: locais } = useConsulta('locais', {})
  const { dados: profissionais } = useConsulta('pessoas', { papel: 'profissional' }, admin)
  const [id] = useState(() => novoId())
  const [cliente, setCliente] = useState<Id>()
  const [linhas, setLinhas] = useState<LinhaNova[]>([])
  const [escolher, setEscolher] = useState(true)
  const [dia, setDia] = useState(dataInicial)
  const [hora, setHora] = useState(horaInicial ?? '10:00')
  const [prof, setProf] = useState<Id | undefined>(admin ? profissionalPadrao : sessao.pessoaId ?? sessao.usuarioId)
  const unidades = (locais ?? []).filter((l) => l.tipo === 'salao')
  const profP = profissionais?.find((p) => p.id === prof)
  const [localEscolhido, setLocal] = useState<Id>()
  const localId = localEscolhido ?? localPadrao ?? profP?.localId ?? sessao.localId ?? (unidades.length === 1 ? unidades[0].id : undefined)
  const quando = dia && hora ? new Date(`${dia}T${hora}`).toISOString() : ''
  const conflitoParams = prof && quando && linhas.length ? { profissionalId: prof, inicio: quando, itens: linhas.map((l) => l.itemId) } : undefined
  const { dados: conflitos } = useConsulta('conflitosAgenda', conflitoParams ?? { profissionalId: '', inicio: '' }, !!conflitoParams)
  const temConflito = !!conflitoParams && !!conflitos?.length
  const principal = cfg?.moedaPrincipal ?? 'BOB'
  const salvar = async () => {
    const r = await executar(
      'concluirVenda',
      { id, pessoaId: cliente, localId, profissionalId: prof, agendadoPara: quando, linhas: linhas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: 1, moeda: l.moeda as never, total: l.total, profissionalId: prof })), pagamentos: [], ignorarConflito: temConflito },
      t('Agendado.'),
    )
    if (r) onFechar()
  }
  const pronto = !!cliente && linhas.length > 0 && !!quando && (!admin || !!prof)
  return (
    <Janela
      aberta
      titulo={`✂️ ${t(admin ? 'Atendimento' : 'Trabalho')}`}
      onFechar={() => (!(cliente || linhas.length) || window.confirm(t('Sair sem salvar?'))) && onFechar()}
      rodape={
        <>
          {temConflito && <p className="mb-2 text-sm font-semibold text-[var(--alerta)]">⚠️ {t('Horário ocupado')}: {conflitos!.map((c) => `${c.cliente ?? ''} ${c.inicio.slice(11)}–${c.fim.slice(11)}`).join(', ')}. {t('Dá para agendar mesmo assim.')}</p>}
          <Botao grande className="w-full" disabled={ocupado || !pronto} onClick={salvar}>{temConflito ? t('Agendar mesmo assim') : t('Agendar')}</Botao>
        </>
      }
    >
      <div className="space-y-3">
        <SeletorPessoa rotulo="Cliente" papel="cliente" valor={cliente} onChange={setCliente} localId={localId} />
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Dia"><Entrada type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
          <Campo rotulo="Hora"><Entrada type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
        </div>
        {admin && <Campo rotulo="Quem atende"><Selecao valor={prof} onChange={(v) => setProf(v || undefined)} vazio="Escolha…" opcoes={(profissionais ?? []).filter((p) => !localEscolhido || !p.localId || p.localId === localEscolhido).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>}
        {unidades.length > 1 && <Campo rotulo="Unidade"><Selecao valor={localId} onChange={(v) => setLocal(v || undefined)} vazio="—" opcoes={unidades.map((u) => ({ id: u.id, nome: u.nome }))} /></Campo>}
        {linhas.length > 0 && (
          <ul className="space-y-1 text-sm">
            {linhas.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 border-b border-[var(--borda)] pb-1">
                <span className="min-w-0 break-words font-semibold">{l.nome}</span>
                <span className="flex items-center gap-1">
                  <b className="num">{formatar(l.total, l.moeda)}</b>
                  <button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-lg hover:bg-[var(--marca-suave)]" onClick={() => setLinhas(linhas.filter((x) => x.id !== l.id))}>×</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {escolher || !linhas.length ? (
          <SeletorServicos moeda={principal} rotulo={linhas.length ? 'Mais um serviço' : 'O que vai fazer?'} onAdd={(i, preco) => (setLinhas([...linhas, { id: novoId(), itemId: i.id, nome: i.nome, moeda: i.precoSugerido?.moeda ?? principal, total: preco }]), setEscolher(false))} />
        ) : (
          <Botao variante="secundario" onClick={() => setEscolher(true)}>+ {t('Mais um serviço')}</Botao>
        )}
      </div>
    </Janela>
  )
}

// ---------- compromisso / lembrete ----------

const DURACOES = [15, 30, 45, 60, 90, 120, 180]

function FormCompromisso({ dataInicial, editar, onFechar }: { dataInicial: string; editar?: Id; onFechar(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { executar, ocupado } = useComando()
  const { dados: existente } = useConsulta('evento', { id: editar ?? '' }, !!editar)
  const { dados: pessoas } = useConsulta('pessoas', {}, admin)
  const { dados: locais } = useConsulta('locais', {}, admin)
  const [id] = useState(() => editar ?? novoId())
  const [f, setF] = useState<{ titulo: string; data: string; diaTodo: boolean; hora: string; duracaoMin: string; nota: string; pessoaId: string; localId: string; semanal: boolean; repetirAte: string }>()
  const [mexeu, setMexeu] = useState(false)
  if (!f && (!editar || existente))
    setF(
      existente
        ? { titulo: existente.titulo, data: existente.data, diaTodo: !existente.hora, hora: existente.hora ?? '09:00', duracaoMin: existente.duracaoMin ? String(existente.duracaoMin) : '', nota: existente.nota ?? '', pessoaId: existente.pessoaId ?? '', localId: existente.localId ?? '', semanal: !!existente.semanal, repetirAte: existente.repetirAte ?? '' }
        : { titulo: '', data: dataInicial, diaTodo: false, hora: '09:00', duracaoMin: '', nota: '', pessoaId: '', localId: '', semanal: false, repetirAte: '' },
    )
  if (!f) return <Janela aberta titulo={`📌 ${t('Compromisso')}`} onFechar={onFechar}><Carregando /></Janela>
  const mudar = (p: Partial<typeof f>) => (setF({ ...f, ...p }), setMexeu(true))
  const salvar = async () => {
    const r = await executar(
      'salvarEvento',
      {
        id,
        titulo: f.titulo,
        data: f.data,
        hora: f.diaTodo ? undefined : f.hora,
        duracaoMin: !f.diaTodo && f.duracaoMin ? Number(f.duracaoMin) : undefined,
        nota: f.nota,
        pessoaId: f.pessoaId || undefined,
        localId: f.localId || undefined,
        semanal: f.semanal,
        repetirAte: f.semanal ? f.repetirAte || undefined : undefined,
      },
      t('Salvo.'),
    )
    if (r) onFechar()
  }
  return (
    <Janela
      aberta
      titulo={`📌 ${t(editar ? 'Editar compromisso' : 'Compromisso')}`}
      onFechar={() => (!mexeu || window.confirm(t('Sair sem salvar?'))) && onFechar()}
      rodape={<Botao grande className="w-full" disabled={ocupado || !f.titulo.trim() || !f.data} onClick={salvar}>{t('Salvar')}</Botao>}
    >
      <div className="space-y-3">
        <Campo rotulo="O quê?"><Entrada autoFocus value={f.titulo} placeholder={t('Ex.: Buscar mechas no correio')} onChange={(e) => mudar({ titulo: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Dia"><Entrada type="date" value={f.data} onChange={(e) => mudar({ data: e.target.value })} /></Campo>
          {!f.diaTodo && <Campo rotulo="Hora"><Entrada type="time" step={300} value={f.hora} onChange={(e) => mudar({ hora: e.target.value })} /></Campo>}
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.diaTodo} onChange={(e) => mudar({ diaTodo: e.target.checked })} /> {t('Dia todo')}</label>
        {!f.diaTodo && <Campo rotulo="Duração"><Selecao valor={f.duracaoMin} onChange={(v) => mudar({ duracaoMin: v })} vazio="—" opcoes={DURACOES.map((m) => ({ id: String(m), nome: m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ',5') }))} /></Campo>}
        {admin && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo="Para quem"><Selecao valor={f.pessoaId} onChange={(v) => mudar({ pessoaId: v })} vazio="Eu" opcoes={(pessoas ?? []).filter((p) => p.papeis.some((x) => x === 'profissional' || x === 'funcionario' || x === 'socio')).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>
            <Campo rotulo="Unidade"><Selecao valor={f.localId} onChange={(v) => mudar({ localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
          </div>
        )}
        <Campo rotulo="Nota (opcional)"><Entrada value={f.nota} onChange={(e) => mudar({ nota: e.target.value })} /></Campo>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.semanal} onChange={(e) => mudar({ semanal: e.target.checked })} /> {t('Repetir toda semana')}</label>
        {f.semanal && <Campo rotulo="Repetir até (opcional)"><Entrada type="date" min={f.data} value={f.repetirAte} onChange={(e) => mudar({ repetirAte: e.target.value })} /></Campo>}
      </div>
    </Janela>
  )
}

// ---------- atender (feito + pagamento) ----------

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

function Atender({ id, onFechar, onPronto }: { id: Id; onFechar(): void; onPronto?(): void }) {
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
    if (r) {
      onFechar()
      onPronto?.()
    }
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
