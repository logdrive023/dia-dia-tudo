// FICHA DO ADIANTAMENTO (#/adiantamentos/:id) — o PADRÃO DE CONTA (components/conta):
//   CabecalhoFicha  quem (avatar) · código · situação · adiantado e data · a ação principal + ⋯
//   ResumoConta     o saldo devedor (ou o que a loja deve) em destaque, a barra, as partes e os ajustes
//   Abas            Linha do tempo (dinheiro → entregas → acertos) · Comprovantes · Histórico (admin)
// As janelas das ações (entrega, receber, comissão, diferença, encerrar) ficam em components/janelasAdiantamento.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { Abas, Carregando, ErroTela, Pilula, dataBR, gramasTexto } from '../../../shared/ui/base'
import { CabecalhoFicha } from '../../../shared/ui/cabecalhoFicha'
import { Anexos, useCotacoes } from '../../../shared/ui/compartilhados'
import { useApp, useComando, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { BarraConta, StatusFinanciamentoPilula, corFinanciamento } from '../../../shared/ui/financiamento'
import { useT } from '../../../shared/ui/i18n'
import { Interruptor } from '../../../shared/ui/interruptor'
import { LinhaDoTempo } from '../../../shared/ui/linhaTempo'
import { Trilha } from '../../../shared/ui/trilha'
import { LinhaTempoAdiantamento, saldoAdiantamento } from '../components/adiantamento'
import { AcoesConta, AvatarConta, ResumoConta } from '../components/conta'
import { JanelaCobranca } from '../components/JanelaCobranca'
import { type AcaoAdiantamento, ConfirmarEncerrar, JanelaComissao, JanelaDinheiro, JanelaEntrega } from '../components/janelasAdiantamento'

export function FichaFinanciamento() {
  const t = useT()
  const { nav, voltar, ir, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('financiamento', { id })
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [acao, setAcao] = useState<AcaoAdiantamento | 'cobrar'>()
  const [aba, setAba] = useParamTela<'tempo' | 'comprovantes' | 'historico'>('aba', 'tempo')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const f = dados.financiamento
  const mp = dados.moedaPrincipal
  const nome = dados.pessoa?.nome ?? '—'
  const aberto = dados.status === 'aberto'
  const s = saldoAdiantamento(dados.saldo)
  const pct = Math.round(dados.progressoBp / 100)
  const fechar = () => setAcao(undefined)

  // a ação principal: entregar cabelo (aberto) ou pagar a diferença (a loja deve); o resto no ⋯
  const ativo = admin && dados.status !== 'encerrado'
  const principal = !ativo ? undefined
    : aberto ? { rotulo: 'Registrar entrega de cabelo', icone: '💇‍♀️', onClick: () => setAcao('entrega') }
      : dados.status === 'aPagar' ? { rotulo: `${t('Pagar diferença')} ${formatar(dados.aPagarParceiro, mp)}`, icone: '↩️', onClick: () => setAcao('diferenca'), tom: 'alerta' as const }
        : undefined
  const outras = !ativo ? [] : [
    ...(aberto ? [{ rotulo: 'Receber em dinheiro', icone: '💵', descricao: t('O parceiro devolveu o que não virou cabelo.'), onClick: () => setAcao('receber') }] : []),
    ...(aberto && dados.comissaoAPagar ? [{ rotulo: 'Abater da comissão', icone: '🧾', descricao: t('A comissão a pagar a {n} paga a dívida.', { n: nome }), onClick: () => setAcao('comissao') }] : []),
    ...(aberto && dados.saldo > 0 ? [{ rotulo: 'Cobrar no WhatsApp', icone: '💬', descricao: t('A mensagem pronta, com o que falta; dá para mudar antes de enviar.'), onClick: () => setAcao('cobrar') }] : []),
    ...(dados.pessoa ? [{ rotulo: 'Abrir ficha da pessoa', icone: '👤', onClick: () => ir('pessoa', { id: dados.pessoa!.id }) }] : []),
    { rotulo: 'Encerrar', icone: '🔒', descricao: t('Fecha o adiantamento; o que sobrar vira baixa.'), perigo: true, separar: true, onClick: () => setAcao('encerrar') },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Trilha atual={f.codigo} />
      <CabecalhoFicha
        midia={<AvatarConta nome={nome} grande />}
        titulo={dados.pessoa ? <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => ir('pessoa', { id: dados.pessoa!.id })}>{nome}</button> : nome}
        codigo={f.codigo}
        selos={<StatusFinanciamentoPilula status={dados.status} />}
        detalhes={[`💸 ${t('Adiantado')} ${formatar(f.valor, f.moeda)}`, `📅 ${dataBR(f.data)}`, f.prazo ? `⏰ ${t('até')} ${dataBR(f.prazo)}` : undefined, dados.viagem ? `✈ ${dados.viagem.codigo}` : undefined]}
        acoes={<AcoesConta principal={principal} outras={outras} />}
      />

      <ResumoConta
        rotulo={s.rotulo}
        valor={dados.saldo ? formatar(Math.abs(dados.saldo), mp) : '✓'}
        cor={s.cor}
        frase={t(dados.saldo > 0 ? 'Falta voltar em cabelo, dinheiro ou comissão.' : dados.saldo < 0 ? 'O cabelo entregue passou do adiantado: a loja deve a diferença.' : 'Tudo o que foi adiantado já voltou.')}
        barra={<BarraConta pct={pct} cor={corFinanciamento(dados.status)} legenda={`${t('{p}% coberto', { p: pct })} · ${formatar(dados.entregue + dados.recebido + dados.comissao, mp)} ${t('de')} ${formatar(dados.financiado, mp)}`} />}
        partes={[
          { rotulo: 'Adiantado', valor: formatar(f.valor, f.moeda), sub: f.moeda !== mp ? formatar(dados.financiado, mp) : undefined },
          { rotulo: 'Cabelo entregue', valor: formatar(dados.entregue, mp), sub: gramasTexto(dados.gramas), cor: dados.entregue ? 'var(--bom)' : undefined, onClick: () => setAba('tempo') },
          { rotulo: 'Dinheiro e comissão', valor: formatar(dados.recebido + dados.comissao, mp), sub: dados.comissao ? `${t('comissão')} ${formatar(dados.comissao, mp)}` : undefined },
        ]}
        ajustes={(ativo || dados.viagem || dados.baixa !== 0 || f.encerramento || (admin && dados.saldoConta !== dados.saldo)) ? <>
          {ativo && <Interruptor ligado={!!f.abaterComissoes} onChange={(v) => !ocupado && void executar('ajustarFinanciamento', { financiamentoId: f.id, abaterComissoes: v }, t('Salvo.'))}
            titulo="Abater sozinho das próximas comissões" texto="Cada comissão que a loja dever a esta pessoa paga primeiro o adiantamento." />}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {dados.viagem && <button type="button" className="min-h-9 font-semibold text-[var(--marca)] hover:underline" onClick={() => ir('viagem', { id: dados.viagem!.id })}>✈ {dados.viagem.codigo} · {dados.viagem.nome} ›</button>}
            {dados.baixa !== 0 && <span className="self-center">{t('Baixa ao encerrar')}: <b className="num">{formatar(dados.baixa, mp)}</b></span>}
            {admin && dados.saldoConta !== dados.saldo && <span className="self-center text-[var(--suave)]">{t('Conta corrente inteira da pessoa')}: <span className="num">{formatar(dados.saldoConta, mp)}</span></span>}
          </div>
          {f.encerramento && <p>🔒 {t('Encerrado em {d} por {quem}', { d: dataBR(f.encerramento.data), quem: f.encerramento.porNome })} · {f.encerramento.motivo}</p>}
        </> : undefined}
      />

      <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[
        { id: 'tempo', nome: `🕘 ${t('Linha do tempo')}`, extra: <Pilula pequena>{dados.passos.length}</Pilula> },
        { id: 'comprovantes', nome: `📎 ${t('Comprovantes')}` },
        ...(admin ? [{ id: 'historico', nome: `📜 ${t('Histórico')}` }] : []),
      ]} />
      <div>
        {aba === 'comprovantes' ? <Anexos donoId={f.id} categorias={['comprovante', 'outro']} />
          : aba === 'historico' && admin ? <LinhaDoTempo id={f.id} />
            : <LinhaTempoAdiantamento passos={dados.passos} moeda={mp} nomeForma={(x) => cfg?.formas.find((y) => y.id === x)?.nome ?? x} />}
      </div>

      {acao === 'entrega' && <JanelaEntrega dados={dados} onFechar={fechar} />}
      {(acao === 'receber' || acao === 'diferenca') && <JanelaDinheiro tipo={acao} dados={dados} onFechar={fechar} />}
      {acao === 'comissao' && <JanelaComissao dados={dados} onFechar={fechar} />}
      {acao === 'encerrar' && <ConfirmarEncerrar dados={dados} onFechar={fechar} />}
      {acao === 'cobrar' && (
        <JanelaCobranca tipo="adiantamento" telefone={dados.pessoa?.telefone} onFechar={fechar} valores={{
          nome: nome,
          codigo: f.codigo,
          falta: formatar(dados.saldo, mp),
          adiantado: formatar(f.valor, f.moeda),
          entregue: `${formatar(dados.entregue, mp)} · ${gramasTexto(dados.gramas)}`,
          prazo: f.prazo ? dataBR(f.prazo) : '',
        }} />
      )}
    </div>
  )
}
