// + MARCAR (agenda) — o assistente único, passo a passo:
//   1 O que vai marcar   cartões: ✂️ Atendimento · 📌 Compromisso/lembrete · 💵 Empréstimo (parcelas) · ✈️ Viagem
//   ✂️ Atendimento   2 Cliente · 3 O que vai fazer · 4 Quando e quem atende (avisa horário ocupado)
//   📌 Compromisso   2 O quê · 3 Quando (hora ou dia todo, duração, toda semana) · 4 Para quem (admin)
//   💵 Empréstimo e ✈️ Viagem abrem o cadastro deles (as parcelas e a viagem aparecem sozinhas na agenda)
// Quem vê / para quem marca: admin marca para qualquer pessoa; funcionária marca para ela (o servidor confere).
import { useState } from 'react'
import { ImpostosDaOperacao } from '../../ui/impostosOperacao'
import { formatar } from '../../core/domain/dinheiro'
import { dataBR } from '../../ui/base'
import { novoId } from '../../core/domain/ids'
import type { Id } from '../../core/domain/tipos'
import { Botao, Campo, Carregando, Entrada, Escolha, Janela, Selecao } from '../../ui/base'
import { useApp, useComando, useConsulta } from '../../ui/contexto'
import { SeletorPessoa, useCotacoes } from '../../ui/compartilhados'
import { EscolhaCartoes } from '../../ui/escolhaCartoes'
import { SeletorServicos } from '../../ui/linhaServico'
import { useT } from '../../ui/i18n'
import { Passo, Passos, useAssistente } from '../../ui/passoAPasso'

export type TipoMarcar = 'atendimento' | 'compromisso' | 'emprestimo' | 'viagem'

interface LinhaNova { id: Id; itemId: Id; nome: string; moeda: string; total: number }

const DURACOES = [15, 30, 45, 60, 90, 120, 180]

export function MarcarAgenda({ dataInicial, horaInicial, tipoInicial, editar, localPadrao, profissionalPadrao, onFechar }: {
  dataInicial: string
  horaInicial?: string
  /** já sabe o que é (tocou numa hora livre = atendimento; editar = compromisso) */
  tipoInicial?: TipoMarcar
  /** editar um compromisso */
  editar?: Id
  localPadrao?: Id
  profissionalPadrao?: Id
  onFechar(): void
}) {
  const t = useT()
  const { sessao, ir } = useApp()
  const admin = sessao.perfil === 'admin'
  const [tipo, setTipo] = useState<TipoMarcar | undefined>(editar ? 'compromisso' : tipoInicial)
  const w = useAssistente(tipo ? 2 : 1)
  const escolher = (v: TipoMarcar) => {
    if (v === 'emprestimo') return (onFechar(), ir('novoEmprestimo'))
    if (v === 'viagem') return (onFechar(), ir('novaViagem'))
    setTipo(v)
    w.ir(2)
  }
  const OPCOES = [
    { id: 'atendimento' as const, icone: '✂️', nome: admin ? 'Atendimento' : 'Trabalho', descricao: 'Cliente, serviço, dia e hora' },
    { id: 'compromisso' as const, icone: '📌', nome: 'Compromisso / lembrete', descricao: 'Ex.: buscar mechas no correio' },
    ...(admin ? [
      { id: 'emprestimo' as const, icone: '💵', nome: 'Empréstimo', descricao: 'As parcelas entram na agenda no dia de receber/pagar' },
      { id: 'viagem' as const, icone: '✈️', nome: 'Viagem de compra', descricao: 'Aparece na agenda os dias da viagem' },
    ] : []),
  ]
  const passo1 = (
    <Passo n={1} de={4} titulo="O que vai marcar" feito={!!tipo} aberto={w.aberto(1)} onAlternar={() => w.alternar(1)}
      resumo={tipo ? t(OPCOES.find((o) => o.id === tipo)?.nome ?? '') : t('escolha')}
      ajuda="Atendimento é com cliente e serviço; compromisso é qualquer lembrete. Empréstimo e viagem abrem o cadastro deles e aparecem sozinhos na agenda."
      exemplo="Ex.: Corte da Ana sexta 15:00 → Atendimento">
      <EscolhaCartoes rotulo="O que vai marcar" valor={tipo} onChange={escolher} opcoes={OPCOES} />
    </Passo>
  )
  if (tipo === 'compromisso') return <Compromisso passo1={editar ? undefined : passo1} w={w} dataInicial={dataInicial} editar={editar} onFechar={onFechar} />
  if (tipo === 'atendimento') return <Atendimento passo1={passo1} w={w} dataInicial={dataInicial} horaInicial={horaInicial} localPadrao={localPadrao} profissionalPadrao={profissionalPadrao} onFechar={onFechar} />
  return <Janela aberta larga titulo={`📅 ${t('Marcar na agenda')}`} onFechar={onFechar}><Passos rotulo="Passos da agenda">{passo1}</Passos></Janela>
}

type Assistente = ReturnType<typeof useAssistente>

// ---------- ✂️ atendimento ----------

function Atendimento({ passo1, w, dataInicial, horaInicial, localPadrao, profissionalPadrao, onFechar }: { passo1: JSX.Element; w: Assistente; dataInicial: string; horaInicial?: string; localPadrao?: Id; profissionalPadrao?: Id; onFechar(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes('venda')
  const { dados: locais } = useConsulta('locais', {})
  const { dados: profissionais } = useConsulta('pessoas', { papel: 'profissional' }, admin)
  const { dados: pessoas } = useConsulta('pessoas', {})
  const [id] = useState(() => novoId())
  const [cliente, setCliente] = useState<Id>()
  const [linhas, setLinhas] = useState<LinhaNova[]>([])
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
  const nomeCliente = pessoas?.find((p) => p.id === cliente)?.nome
  const total = linhas.reduce((s, l) => s + l.total, 0)
  const falta = !cliente ? t('a cliente') : !linhas.length ? t('o serviço') : !quando ? t('o dia e a hora') : admin && !prof ? t('quem atende') : ''
  const salvar = async () => {
    const r = await executar(
      'concluirVenda',
      { id, pessoaId: cliente, localId, profissionalId: prof, agendadoPara: quando, linhas: linhas.map((l) => ({ id: l.id, itemId: l.itemId, quantidade: 1, moeda: l.moeda as never, total: l.total, profissionalId: prof })), pagamentos: [], ignorarConflito: temConflito },
      t('Agendado.'),
    )
    if (r) onFechar()
  }
  return (
    <Janela aberta larga titulo={`✂️ ${t(admin ? 'Atendimento' : 'Trabalho')}`} onFechar={() => (!(cliente || linhas.length) || window.confirm(t('Sair sem salvar?'))) && onFechar()} rodape={
      <>
        {temConflito && <p className="mb-2 text-sm font-semibold text-[var(--alerta)]">⚠️ {t('Horário ocupado')}: {conflitos!.map((c) => `${c.cliente ?? ''} ${c.inicio.slice(11)}–${c.fim.slice(11)}`).join(', ')}. {t('Dá para agendar mesmo assim.')}</p>}
        <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={salvar}>{falta ? t('Falta: {x}', { x: falta }) : temConflito ? t('Agendar mesmo assim') : t('Agendar')}</Botao>
      </>
    }>
      <Passos rotulo="Passos do atendimento">
        {passo1}
        <Passo n={2} de={4} titulo="Cliente" feito={!!cliente} aberto={w.aberto(2)} onAlternar={() => w.alternar(2)} resumo={nomeCliente ?? t('ninguém escolhido')}
          ajuda="Quem vai ser atendida. Não tem cadastro? Toque em + Nova." exemplo="Ex.: Ana Paula">
          <SeletorPessoa rotulo="Cliente" papel="cliente" valor={cliente} onChange={setCliente} localId={localId} />
          {w.proximo(2, 'O que vai fazer', !!cliente)}
        </Passo>
        <Passo n={3} de={4} titulo="O que vai fazer" feito={linhas.length > 0} aberto={w.aberto(3)} onAlternar={() => w.alternar(3)}
          resumo={linhas.length ? `${linhas.map((l) => l.nome).join(' + ')} · ${formatar(total, principal)}` : t('nenhum serviço')}
          ajuda="Os serviços (dá para pôr mais de um). O tempo de cada um vem do cadastro do serviço." exemplo="Ex.: Corte + Escova">
          {linhas.length > 0 && (
            <ul className="space-y-1 text-sm">
              {linhas.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--cartao)] px-3 py-1.5 ring-1 ring-[var(--borda)]">
                  <span className="min-w-0 break-words font-semibold">{l.nome}</span>
                  <span className="flex items-center gap-1"><b className="num">{formatar(l.total, l.moeda)}</b><button type="button" aria-label={t('Tirar')} className="min-h-10 min-w-10 rounded-full text-lg hover:bg-[var(--marca-suave)]" onClick={() => setLinhas(linhas.filter((x) => x.id !== l.id))}>×</button></span>
                </li>
              ))}
            </ul>
          )}
          <ImpostosDaOperacao servico={total} moeda={principal} />
          <SeletorServicos moeda={principal} rotulo={linhas.length ? 'Mais um serviço' : 'O que vai fazer?'} onAdd={(i, preco) => setLinhas([...linhas, { id: novoId(), itemId: i.id, nome: i.nome, moeda: i.precoSugerido?.moeda ?? principal, total: preco }])} />
          {w.proximo(3, 'Quando e quem', linhas.length > 0)}
        </Passo>
        <Passo n={4} de={4} titulo="Quando e quem" feito={!!quando && (!admin || !!prof)} falta={temConflito} aberto={w.aberto(4)} onAlternar={() => w.alternar(4)}
          resumo={[dia && `📅 ${dataBR(dia)} ${hora}`, profP?.nome && `✂️ ${profP.nome}`, temConflito && `⚠️ ${t('horário ocupado')}`].filter(Boolean).join(' · ')}
          ajuda="O dia, a hora e quem atende. Se o horário já estiver ocupado, avisa (dá para marcar mesmo assim)." exemplo="Ex.: sexta 15:00 com a Paula">
          <div className="grid gap-2 xs:grid-cols-2">
            <Campo rotulo="Dia"><Entrada type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
            <Campo rotulo="Hora"><Entrada type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
          </div>
          {admin && <Campo rotulo="Quem atende"><Selecao valor={prof} onChange={(v) => setProf(v || undefined)} vazio="Escolha…" opcoes={(profissionais ?? []).filter((p) => !localEscolhido || !p.localId || p.localId === localEscolhido).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>}
          {unidades.length > 1 && <Campo rotulo="Unidade"><Selecao valor={localId} onChange={(v) => setLocal(v || undefined)} vazio="—" opcoes={unidades.map((u) => ({ id: u.id, nome: u.nome }))} /></Campo>}
        </Passo>
      </Passos>
    </Janela>
  )
}

// ---------- 📌 compromisso / lembrete ----------

function Compromisso({ passo1, w, dataInicial, editar, onFechar }: { passo1?: JSX.Element; w: Assistente; dataInicial: string; editar?: Id; onFechar(): void }) {
  const t = useT()
  const { sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const { executar, ocupado } = useComando()
  const { dados: existente } = useConsulta('evento', { id: editar ?? '' }, !!editar)
  const { dados: filtros } = useConsulta('agendaFiltros', {})
  const { dados: locais } = useConsulta('locais', {}, admin)
  const [id] = useState(() => editar ?? novoId())
  const [f, setF] = useState<{ titulo: string; data: string; diaTodo: boolean; hora: string; duracaoMin: string; nota: string; pessoaId: string; localId: string; semanal: boolean; repetirAte: string }>()
  const [mexeu, setMexeu] = useState(false)
  if (!f && (!editar || existente))
    setF(existente
      ? { titulo: existente.titulo, data: existente.data, diaTodo: !existente.hora, hora: existente.hora ?? '09:00', duracaoMin: existente.duracaoMin ? String(existente.duracaoMin) : '', nota: existente.nota ?? '', pessoaId: existente.pessoaId ?? '', localId: existente.localId ?? '', semanal: !!existente.semanal, repetirAte: existente.repetirAte ?? '' }
      : { titulo: '', data: dataInicial, diaTodo: false, hora: '09:00', duracaoMin: '', nota: '', pessoaId: '', localId: '', semanal: false, repetirAte: '' })
  if (!f) return <Janela aberta titulo={`📌 ${t('Compromisso')}`} onFechar={onFechar}><Carregando /></Janela>
  const mudar = (p: Partial<typeof f>) => (setF({ ...f, ...p }), setMexeu(true))
  const total = admin ? 4 : 3
  const n0 = passo1 ? 1 : 0
  const pessoa = filtros?.pessoas.find((p) => p.id === f.pessoaId)?.nome
  const falta = !f.titulo.trim() ? t('o que é') : !f.data ? t('o dia') : ''
  const salvar = async () => {
    const r = await executar('salvarEvento', {
      id, titulo: f.titulo, data: f.data, hora: f.diaTodo ? undefined : f.hora, duracaoMin: !f.diaTodo && f.duracaoMin ? Number(f.duracaoMin) : undefined,
      nota: f.nota, pessoaId: f.pessoaId || undefined, localId: f.localId || undefined, semanal: f.semanal, repetirAte: f.semanal ? f.repetirAte || undefined : undefined,
    }, t('Salvo.'))
    if (r) onFechar()
  }
  return (
    <Janela aberta larga titulo={`📌 ${t(editar ? 'Editar compromisso' : 'Compromisso')}`} onFechar={() => (!mexeu || window.confirm(t('Sair sem salvar?'))) && onFechar()} rodape={
      <Botao grande className="w-full" disabled={ocupado || !!falta} onClick={salvar}>{falta ? t('Falta: {x}', { x: falta }) : t('Salvar')}</Botao>
    }>
      <Passos rotulo="Passos do compromisso">
        {passo1}
        <Passo n={n0 + 1} de={total} titulo="O quê" feito={!!f.titulo.trim()} aberto={w.aberto(2)} onAlternar={() => w.alternar(2)} resumo={f.titulo.trim() || t('falta escrever')}
          ajuda="O que é, em poucas palavras, e uma nota se precisar." exemplo="Ex.: Buscar mechas no correio">
          <Campo rotulo="O quê? *"><Entrada autoFocus value={f.titulo} placeholder={t('Ex.: Buscar mechas no correio')} onChange={(e) => mudar({ titulo: e.target.value })} /></Campo>
          <Campo rotulo="Nota (opcional)"><Entrada value={f.nota} onChange={(e) => mudar({ nota: e.target.value })} /></Campo>
          {w.proximo(2, 'Quando', !!f.titulo.trim())}
        </Passo>
        <Passo n={n0 + 2} de={total} titulo="Quando" feito={!!f.data} aberto={w.aberto(3)} onAlternar={() => w.alternar(3)}
          resumo={[`📅 ${dataBR(f.data)}`, f.diaTodo ? t('dia todo') : f.hora, f.semanal && `🔁 ${t('toda semana')}`].filter(Boolean).join(' · ')}
          ajuda="O dia e a hora (ou o dia todo). Toda semana: repete no mesmo dia da semana." exemplo="Ex.: toda segunda 09:00">
          <Escolha<'hora' | 'dia'> rotulo="Hora" valor={f.diaTodo ? 'dia' : 'hora'} onChange={(v) => mudar({ diaTodo: v === 'dia' })} opcoes={[{ id: 'hora', nome: 'Com hora' }, { id: 'dia', nome: 'Dia todo' }]} />
          <div className="grid gap-2 xs:grid-cols-2">
            <Campo rotulo="Dia"><Entrada type="date" value={f.data} onChange={(e) => mudar({ data: e.target.value })} /></Campo>
            {!f.diaTodo && <Campo rotulo="Hora"><Entrada type="time" step={300} value={f.hora} onChange={(e) => mudar({ hora: e.target.value })} /></Campo>}
          </div>
          {!f.diaTodo && <Campo rotulo="Duração"><Selecao valor={f.duracaoMin} onChange={(v) => mudar({ duracaoMin: v })} vazio="—" opcoes={DURACOES.map((m) => ({ id: String(m), nome: m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ',5') }))} /></Campo>}
          <Escolha<'uma' | 'semana'> rotulo="Repetir" valor={f.semanal ? 'semana' : 'uma'} onChange={(v) => mudar({ semanal: v === 'semana' })} opcoes={[{ id: 'uma', nome: 'Uma vez' }, { id: 'semana', nome: 'Toda semana' }]} />
          {f.semanal && <Campo rotulo="Repetir até (opcional)"><Entrada type="date" min={f.data} value={f.repetirAte} onChange={(e) => mudar({ repetirAte: e.target.value })} /></Campo>}
          {admin && w.proximo(3, 'Para quem')}
        </Passo>
        {admin && (
          <Passo n={n0 + 3} de={total} titulo="Para quem" opcional feito={!!f.pessoaId} aberto={w.aberto(4)} onAlternar={() => w.alternar(4)} resumo={pessoa ?? t('para mim')}
            ajuda="Para quem é o compromisso (aparece na agenda dela) e a unidade." exemplo="Ex.: Para a Paula · Unidade Centro">
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo rotulo="Para quem"><Selecao valor={f.pessoaId} onChange={(v) => mudar({ pessoaId: v })} vazio="Eu" opcoes={(filtros?.pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>
              <Campo rotulo="Unidade"><Selecao valor={f.localId} onChange={(v) => mudar({ localId: v })} vazio="—" opcoes={(locais ?? []).map((l) => ({ id: l.id, nome: l.nome }))} /></Campo>
            </div>
          </Passo>
        )}
      </Passos>
    </Janela>
  )
}
