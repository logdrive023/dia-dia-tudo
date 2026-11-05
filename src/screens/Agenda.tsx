// AGENDA em CALENDÁRIO (Mês, Semana, Dia): atendimentos ✂️, viagens ✈️, compromissos 📌 e parcelas de empréstimo 💵.
// Filtro padrão (FiltroLista): tipo em abas, busca e ⚙ (unidade e pessoa — só para quem pode ver a equipe).
// QUEM VÊ (o servidor decide): administrador tudo; funcionária o que é dela, e a equipe da unidade se tiver permissão.
// "+ Marcar" é o assistente (MarcarAgenda): o que vai marcar → os passos daquele tipo.
// Atender = lançar o que foi feito e o pagamento (a venda nasce do agendamento).

import { useRef, useState } from 'react'
import { FiltroUnidade } from '../ui/filtroUnidade'
import { FolhaItem, type AcaoFolha, type FatoFolha } from '../ui/folhaItem'
import { FiltroLista, GrupoFiltro } from '../ui/filtroPadrao'
import { MarcarAgenda, type TipoMarcar } from './agenda/MarcarAgenda'
import { formatar } from '../core/domain/dinheiro'
import { dataLocal, diaDaSemana, somarDias, somarMeses } from '../core/domain/datas'
import { novoId } from '../core/domain/ids'
import type { Id, Linha } from '../core/domain/tipos'
import type { ItemCalendario, TipoCalendario } from '../core/services/agenda'
import { Botao, Campo, Carregando, Confirmar, Erro, Escolha, Janela, Selecao, Titulo, dataBR, loc } from '../ui/base'
import { TIPOS_CAL, PilulasStatus, VistaDia, VistaMes, VistaSemana, gradeMes, inicioSemana, tipoCal, useLargo } from '../ui/calendario'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { EditorPagamentos, type PagamentoTela, conv, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { type AjusteServico, EditorServico, SeletorServicos, ajusteParaEntrada, faltaNoAjuste } from '../ui/linhaServico'
import { useT } from '../ui/i18n'
import { useLembrado } from '../ui/filtros'
import { CAT_FERIADO, LegendaCalendario } from '../ui/feriadosAgenda'
import type { CategoriaFeriado } from '../core/dados/feriados'

type Modo = 'mes' | 'semana' | 'dia'

export function Agenda() {
  const t = useT()
  const { sessao } = useApp()
  const largo = useLargo()
  const admin = sessao.perfil === 'admin'
  const [modo, setModo] = useParamTela<Modo>('modo', largo ? 'mes' : 'semana')
  const [data, setData] = useParamTela('data', dataLocal())
  const [localId, setLocalId] = useParamTela('localId', '')
  const [profissionalId, setProfissionalId] = useParamTela('profissionalId', '')
  const [tipo, setTipo] = useParamTela<TipoCalendario | ''>('tipo', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [abertoId, setAberto] = useState<string>()
  const [marcar, setMarcar] = useState<{ data: string; hora?: string; tipo?: TipoMarcar; editar?: Id }>()
  const grade = modo === 'mes' ? gradeMes(data) : undefined
  const de = grade ? grade[0] : modo === 'semana' ? inicioSemana(data) : data
  const ate = grade ? grade[grade.length - 1] : modo === 'semana' ? somarDias(de, 6) : data
  // o servidor decide quem a sessão pode ver (admin: todos; funcionária: ela, ou a equipe se tiver permissão)
  const { dados: filtros } = useConsulta('agendaFiltros', {})
  const { dados, erro } = useConsulta('calendario', { de, ate, localId: localId || undefined, pessoaId: profissionalId || undefined })
  const aberto = dados?.find((i) => i.id === abertoId)
  // FERIADOS (só visual — nada bloqueia): cada categoria liga e desliga sozinha; fica lembrado neste aparelho
  const [verNacional, setVerNacional] = useLembrado('agenda.feriadosNacionais', true)
  const [verSantaCruz, setVerSantaCruz] = useLembrado('agenda.feriadosSantaCruz', true)
  const categorias: CategoriaFeriado[] = [...(verNacional ? ['nacional' as const] : []), ...(verSantaCruz ? ['santaCruz' as const] : [])]
  const { dados: feriados } = useConsulta('feriados', { de, ate, categorias }, categorias.length > 0)
  const fer = categorias.length ? feriados ?? [] : []
  const hoje = dataLocal()
  const b = busca.trim().toLowerCase()
  const porBusca = (dados ?? []).filter((i) => !b || [i.titulo, i.cliente, i.pessoa, i.detalhe, i.local].filter(Boolean).join(' ').toLowerCase().includes(b))
  const itens = porBusca.filter((i) => !tipo || i.tipo === tipo)

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
    const bt = e.changedTouches[0]
    toque.current = undefined
    if (!a || !bt) return
    const dx = bt.clientX - a.x
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(bt.clientY - a.y)) passo(dx < 0 ? 1 : -1)
  }
  const unidades = filtros?.unidades ?? []
  const pessoasFiltro = (filtros?.pessoas ?? []).filter((p) => !localId || !p.localId || p.localId === localId)
  const nomeLocal = unidades.find((u) => u.id === localId)?.nome
  const nomePessoa = filtros?.pessoas.find((p) => p.id === profissionalId)?.nome
  const ativos = [
    ...(localId ? [{ k: 'localId', rotulo: `📍 ${nomeLocal ?? localId}` }] : []),
    ...(profissionalId ? [{ k: 'profissionalId', rotulo: `👤 ${nomePessoa ?? profissionalId}` }] : []),
  ]
  const limpar = () => (setLocalId(''), setProfissionalId(''), setBusca(''))
  const temPainel = !!filtros?.equipe && pessoasFiltro.length > 1

  return (
    <div>
      <Titulo
        subtitulo={admin ? t('Atendimentos, compromissos, viagens e parcelas, de toda a equipe.') : filtros?.equipe ? t('A sua agenda e a da equipe.') : t('A sua agenda.')}
        acao={<Botao onClick={() => setMarcar({ data })}>+ {t('Marcar')}</Botao>}
      >
        {admin || filtros?.equipe ? t('Agenda') : t('Minha agenda')}
      </Titulo>

      {/* o período: Mês · Semana · Dia e ‹ hoje › */}
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

      {/* FILTRO PADRÃO: tipo em abas (com quantos) · busca · ⚙ unidade e pessoa (só quem pode ver a equipe) */}
      <FiltroLista
        className="mb-3"
        situacao={{
          valor: tipo,
          onChange: (v) => setTipo(v as TipoCalendario | ''),
          opcoes: [
            { id: '', nome: 'Tudo', n: porBusca.length },
            ...TIPOS_CAL.map((x) => ({ id: x.id, nome: `${x.icone} ${t(x.nome)}`, n: porBusca.filter((i) => i.tipo === x.id).length })).filter((x) => x.n > 0 || x.id === tipo),
          ],
        }}
        busca={busca} onBusca={setBusca} placeholder="Buscar cliente, serviço ou pessoa"
        extra={unidades.length > 1 ? <FiltroUnidade valor={localId} onChange={setLocalId} /> : undefined}
        ativos={ativos} onTirar={(k) => (k === 'localId' ? setLocalId('') : setProfissionalId(''))} onLimpar={limpar}
        resultados={dados ? itens.length : undefined} total={dados?.length} unidade="item(ns)"
        painel={<>
          {temPainel && <GrupoFiltro titulo="Quem e onde" icone="👤">
            {filtros?.equipe && pessoasFiltro.length > 1 && <Campo rotulo="Pessoa"><Selecao valor={profissionalId} onChange={setProfissionalId} vazio={admin ? 'Todas as pessoas' : 'Eu e a equipe'} opcoes={pessoasFiltro.map((p) => ({ id: p.id, nome: p.nome }))} /></Campo>}
          </GrupoFiltro>}
          {/* FERIADOS: só o que aparece na agenda (não muda datas nem trava vendas, compras ou triagens) */}
          <GrupoFiltro titulo="Feriados" icone="🗓">
            {([['nacional', verNacional, setVerNacional, 'Mostrar feriados nacionais da Bolívia'], ['santaCruz', verSantaCruz, setVerSantaCruz, 'Mostrar feriados de Santa Cruz']] as const).map(([c, on, set, rot]) => (
              <label key={c} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--cartao)] px-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={on} onChange={(e) => set(e.target.checked)} />
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CAT_FERIADO[c].cor }} />
                <span>{t(rot)}</span>
              </label>
            ))}
            <p className="col-span-full text-xs text-[var(--suave)]">{t('Só muda o que aparece na agenda: o feriado não bloqueia nada e não muda nenhuma data.')}</p>
          </GrupoFiltro>
        </>}
      />

      <div onTouchStart={(e) => (toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={fimToque}>
        {erro ? (
          <Erro texto={erro} />
        ) : !dados ? (
          <Carregando />
        ) : modo === 'mes' ? (
          <VistaMes data={data} itens={itens} largo={largo} onDia={abrirDia} onAbrir={(i) => setAberto(i.id)} feriados={fer} />
        ) : modo === 'semana' ? (
          <VistaSemana de={de} itens={itens} largo={largo} onDia={abrirDia} onAbrir={(i) => setAberto(i.id)} feriados={fer} />
        ) : (
          <VistaDia data={data} itens={itens} onAbrir={(i) => setAberto(i.id)} onHora={(h) => setMarcar({ data, hora: h, tipo: 'atendimento' })} feriados={fer} />
        )}
        {/* a LEGENDA: o que cada bolinha (eventos) e cada quadradinho (feriados) quer dizer */}
        {dados && modo === 'mes' && <LegendaCalendario tipos={TIPOS_CAL.filter((x) => (!tipo || x.id === tipo) && (!filtros?.tipos || filtros.tipos.includes(x.id)))} categorias={categorias} />}
      </div>

      {aberto && <Detalhe i={aberto} onFechar={() => setAberto(undefined)} onEditar={() => (setAberto(undefined), setMarcar({ data: aberto.data, editar: aberto.ref.id }))} />}
      {marcar && <MarcarAgenda dataInicial={marcar.data} horaInicial={marcar.hora} tipoInicial={marcar.tipo} editar={marcar.editar} localPadrao={localId || undefined} profissionalPadrao={profissionalId || undefined} onFechar={() => setMarcar(undefined)} />}
    </div>
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
  const lembrar = `${t('Olá')} ${i.cliente ?? ''}! ${t('Lembrete do seu horário')}: ${dataBR(i.data)} ${i.hora ?? ''}${i.local ? ` · ${i.local}` : ''}`
  const tel = venda?.cliente?.telefone
  const concluir = (desfazer?: boolean) => executar('concluirEvento', { id: i.ref.id, data: i.data, desfazer }, t(desfazer ? 'Voltou para agendado.' : 'Feito.'))
  const valor = i.valor !== undefined && i.moeda ? formatar(i.valor, i.moeda) : undefined
  const fechar = (fn: () => void) => () => (onFechar(), fn())

  // O QUE MOSTRAR E O QUE DÁ PARA FAZER, por tipo (o desenho é sempre o da FolhaItem)
  let fatos: FatoFolha[] = [{ icone: '📅', rotulo: 'Quando', valor: quando + (i.semanal ? ` · ${t('toda semana')}` : '') }]
  let principal: AcaoFolha | undefined
  let secundarias: AcaoFolha[] = []
  let abrir: AcaoFolha | undefined
  let perigo: AcaoFolha | undefined
  let destaque: { rotulo: string; valor: string; tom?: 'bom' | 'ruim' | 'alerta' } | undefined
  let aviso: { texto: string; tom: 'alerta' | 'ruim' } | undefined
  if (i.tipo === 'atendimento') {
    fatos = [...fatos, { icone: '👤', rotulo: 'Cliente', valor: i.cliente }, { icone: '✂️', rotulo: 'Serviço', valor: i.detalhe }, { icone: '💇‍♀️', rotulo: 'Quem atende', valor: i.pessoa }, { icone: '📍', rotulo: 'Unidade', valor: i.local }]
    destaque = valor ? { rotulo: i.status === 'feito' && !i.pago ? 'Falta receber' : 'Valor', valor: i.status === 'feito' && !i.pago && i.falta && i.moeda ? formatar(i.falta, i.moeda) : valor, tom: i.status === 'feito' ? (i.pago ? 'bom' : 'alerta') : undefined } : undefined
    if (i.conflito) aviso = { texto: t('Horário ocupado: tem outro atendimento da mesma pessoa perto deste horário.'), tom: 'alerta' }
    if (i.status === 'agendado') {
      principal = { rotulo: 'Feito e pago', icone: '✓', onClick: () => setAcao('atender') }
      secundarias = [
        { rotulo: 'Feito, pagar depois', icone: '🕗', onClick: () => setAcao('depois') },
        { rotulo: 'Lembrar no WhatsApp', icone: '💬', onClick: () => undefined, href: linkWhatsApp(lembrar, tel) },
      ]
      perigo = { rotulo: 'Desmarcar', onClick: () => setAcao('desmarcar') }
    } else if (i.status === 'feito' && !i.pago) principal = { rotulo: 'Receber o que falta', icone: '💵', onClick: () => setAcao('receber') }
    abrir = { rotulo: 'Abrir venda', onClick: fechar(() => ir('venda', { id: i.ref.id })) }
  } else if (i.tipo === 'compromisso') {
    fatos = [...fatos, { icone: '📝', rotulo: 'Nota', valor: i.detalhe }, { icone: '👤', rotulo: 'Para quem', valor: i.pessoa }, { icone: '📍', rotulo: 'Unidade', valor: i.local }]
    if (i.status === 'agendado') principal = { rotulo: 'Feito', icone: '✓', disabled: ocupado, onClick: () => void concluir() }
    else secundarias = [{ rotulo: 'Desfazer feito', icone: '↩', disabled: ocupado, onClick: () => void concluir(true) }]
    if (i.meu) {
      secundarias = [...secundarias, { rotulo: 'Editar', icone: '✎', onClick: onEditar }]
      perigo = { rotulo: 'Excluir', onClick: () => setAcao('excluir') }
    }
  } else if (i.tipo === 'viagem') {
    fatos = [...fatos, { icone: '📍', rotulo: 'Destino', valor: i.detalhe }, { icone: '👥', rotulo: 'Quem viaja', valor: i.pessoa }]
    principal = { rotulo: 'Abrir viagem', icone: '✈️', onClick: fechar(() => (admin ? ir('viagem', { id: i.ref.id }) : ir('viagens'))) }
  } else if (i.tipo === 'emprestimo') {
    fatos = [...fatos, { icone: '🤝', rotulo: 'Com quem', valor: i.pessoa }]
    destaque = valor ? { rotulo: i.pago ? 'Paga' : i.sentido === 'pagar' ? 'A pagar' : 'A receber', valor, tom: i.pago ? 'bom' : i.atrasada ? 'ruim' : undefined } : undefined
    if (i.atrasada) aviso = { texto: t('Parcela atrasada: {d}.', { d: i.detalhe ?? '' }), tom: 'ruim' }
    if (!i.pago) principal = { rotulo: i.sentido === 'pagar' ? 'Pagar a parcela' : 'Receber a parcela', icone: '💵', onClick: fechar(() => ir('emprestimo', { id: i.ref.id })) }
    abrir = { rotulo: 'Abrir empréstimo', onClick: fechar(() => ir('emprestimo', { id: i.ref.id })) }
  }
  return (
    <>
      <FolhaItem aberta={!acao || acao === 'depois' || acao === 'desmarcar' || acao === 'excluir'} onFechar={onFechar}
        icone={tp.icone} cor={tp.cor} tipo={tp.nome} titulo={i.titulo} riscado={i.status === 'feito' && i.tipo === 'compromisso'}
        selos={<PilulasStatus i={i} />} fatos={fatos} destaque={destaque} aviso={aviso} principal={principal} secundarias={secundarias} abrir={abrir} perigo={perigo} />
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
/** registrar o que falta receber de uma venda (atendimento ou venda): usado na Agenda e na venda ("O que falta") */
export function Receber({ vendaId, falta, moeda, onFechar, onPronto }: { vendaId: Id; falta: number; moeda: string; onFechar(): void; onPronto(): void }) {
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
