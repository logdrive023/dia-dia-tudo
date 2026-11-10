// EMPRÉSTIMOS: dado (me devem) ou tomado (eu devo), parcelas, pagamentos parciais, atraso e cobrança.
// O sistema só registra e calcula o combinado. O PADRÃO DE CONTA (components/conta), igual ao dos adiantamentos:
//   LISTA: os números (me devem · eu devo · atrasado · ativos — tocar filtra) → o FILTRO PADRÃO (lado em abas com o
//          número, busca, 📅 período do início, situação) → um CartaoConta por empréstimo.
//   FICHA: CabecalhoFicha (pessoa, lado, situação, combinado, juros + a ação principal e o ⋯) → ResumoConta (o que
//          falta em destaque, a barra do que já foi pago e as partes) → Abas: Parcelas · Comprovantes · Linha do tempo.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { Id } from '../../../core/domain/tipos'
import { Abas, Botao, Carregando, ErroTela, Pilula, Titulo, Vazio, dataBR, moedaPadrao } from '../../../shared/ui/base'
import { CabecalhoFicha } from '../../../shared/ui/cabecalhoFicha'
import { Anexos } from '../../../shared/ui/compartilhados'
import { useApp, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { BotaoEscolha, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { BarraConta } from '../../../shared/ui/financiamento'
import { useT } from '../../../shared/ui/i18n'
import { LinhaDoTempo } from '../../../shared/ui/linhaTempo'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { Paginada } from '../../../shared/ui/paginacao'
import { Trilha } from '../../../shared/ui/trilha'
import { JanelaCobranca } from '../components/JanelaCobranca'
import { AcoesConta, AvatarConta, ResumoConta } from '../components/conta'
import { COR_LADO, CartaoEmprestimo, JanelaPagamento, ListaParcelas, TOM_EMPRESTIMO, pctPago } from '../components/emprestimo'

const SITUACOES = [{ id: '', nome: 'Todas' }, { id: 'atrasada', nome: 'Atrasada', icone: '🔴' }, { id: 'vencendo', nome: 'Vencendo', icone: '🟡' }, { id: 'em dia', nome: 'Em dia', icone: '🟢' }, { id: 'quitado', nome: 'Quitado', icone: '✓' }]
const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Emprestimos() {
  const t = useT()
  const { ir } = useApp()
  const [direcao, setDirecao] = useParamTela('direcao', '')
  const [status, setStatus] = useParamTela('status', '')
  const [busca, setBusca] = useParamTela('busca', '')
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const { dados } = useConsulta('emprestimos', {})
  const m = dados?.[0]?.moeda ?? moedaPadrao()
  const todos = dados ?? []
  const b = semAcento(busca.trim())
  // tudo menos o lado (para os números das abas)
  const base = todos.filter((e) => (!status || e.status === status) && (!b || semAcento(e.pessoa).includes(b)) && (!de || e.inicio >= de) && (!ate || e.inicio <= ate))
  const lista = base.filter((e) => !direcao || e.direcao === direcao)
  const soma = (f: (e: (typeof todos)[number]) => number) => todos.reduce((s, e) => s + f(e), 0)
  const ativos = todos.filter((e) => e.saldo > 0)
  const situacao = SITUACOES.find((x) => x.id === status)
  const limpar = () => (setStatus(''), setBusca(''), setDe(''), setAte(''))
  const novo = () => ir('novoEmprestimo')
  return (
    <div>
      <Titulo acao={<Botao onClick={novo}>+ {t('Empréstimo')}</Botao>} subtitulo={t('Dinheiro emprestado ou pego emprestado: parcelas, atraso e cobrança. O sistema só registra e calcula o combinado.')}>{t('Empréstimos')}</Titulo>
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Me devem" valor={formatar(soma((e) => (e.direcao === 'dado' ? e.saldo : 0)), m)} icone="⬇" tom="bom" ativo={direcao === 'dado'} onClick={() => setDirecao(direcao === 'dado' ? '' : 'dado')} carregando={!dados} />
        <NumeroGrande rotulo="Eu devo" valor={formatar(soma((e) => (e.direcao === 'tomado' ? e.saldo : 0)), m)} icone="⬆" tom="ruim" ativo={direcao === 'tomado'} onClick={() => setDirecao(direcao === 'tomado' ? '' : 'tomado')} carregando={!dados} />
        <NumeroGrande rotulo="Atrasado" valor={formatar(soma((e) => e.atrasado), m)} icone="⏰" tom={soma((e) => e.atrasado) ? 'ruim' : undefined} ativo={status === 'atrasada'} onClick={() => setStatus(status === 'atrasada' ? '' : 'atrasada')} carregando={!dados} />
        <NumeroGrande rotulo="Ativos" valor={ativos.length} icone="🤝" sub={`${todos.length - ativos.length} ${t('quitados')}`} carregando={!dados} />
      </GrupoNumeros>
      <FiltroLista
        className="mb-3"
        situacao={{ valor: direcao, onChange: setDirecao, opcoes: [{ id: '', nome: 'Todos', n: base.length }, { id: 'dado', nome: 'Me devem', n: base.filter((e) => e.direcao === 'dado').length }, { id: 'tomado', nome: 'Eu devo', n: base.filter((e) => e.direcao === 'tomado').length }] }}
        busca={busca} onBusca={setBusca} placeholder="Buscar pessoa"
        periodo={{ de, ate, onChange: (d, a) => (setDe(d ?? ''), setAte(a ?? '')), presets: ['30d', 'mes', 'mesPassado', 'ano'] }}
        extra={<BotaoEscolha icone="🚦" rotulo="Situação" valor={status} onChange={setStatus} opcoes={SITUACOES} />}
        ativos={situacao && status ? [{ k: 'status', rotulo: `${situacao.icone ?? ''} ${t(situacao.nome)}` }] : []} onTirar={() => setStatus('')} onLimpar={limpar} temAtivos={!!(status || busca || de)}
        resultados={dados ? lista.length : undefined} total={todos.length} unidade="empréstimo(s)"
      />
      {!dados ? <Carregando /> : !todos.length ? <Vazio texto="Nenhum empréstimo."><Botao className="mt-2" onClick={novo}>+ {t('Empréstimo')}</Botao></Vazio> : !lista.length ? <VazioFiltro filtrando onLimpar={limpar} /> : (
        <Paginada itens={lista} unidade="empréstimo(s)" reiniciar={String(lista.length)}>{(pagina) => (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pagina.map((e) => <li key={e.id}><CartaoEmprestimo e={e} onAbrir={(id) => ir('emprestimo', { id })} /></li>)}
          </ul>
        )}</Paginada>
      )}
    </div>
  )
}

const NOME_JUROS: Record<string, string> = { nenhum: 'sem juros', simples: 'juros simples', composto: 'juros compostos', fixo: 'juros fixo' }

/** FICHA DO EMPRÉSTIMO (#/emprestimos/:id) */
export function FichaEmprestimo() {
  const t = useT()
  const { nav, voltar, ir } = useApp()
  const id = nav.params.id as Id
  const { dados, erro } = useConsulta('emprestimo', { id })
  const [pagar, setPagar] = useState(false)
  const [cobrar, setCobrar] = useState(false)
  const [aba, setAba] = useParamTela<'parcelas' | 'comprovantes' | 'historico'>('aba', 'parcelas')
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const e = dados.emprestimo
  const pessoa = dados.pessoa
  const nome = pessoa?.nome ?? '—'
  const cor = COR_LADO[e.direcao]
  const dado = e.direcao === 'dado'
  const juros = e.juros?.tipo && e.juros.tipo !== 'nenhum'
    ? `${t(NOME_JUROS[e.juros.tipo])}${e.juros.taxaMensalBp ? ` ${e.juros.taxaMensalBp / 100}% ${t('ao mês')}` : ''}${e.juros.valorFixo ? ` ${formatar(e.juros.valorFixo, e.moeda)}` : ''}`
    : t('sem juros')
  const pagas = dados.parcelas.filter((p) => !p.falta).length
  const pct = pctPago(dados.recebido, dados.saldo)
  const outras = [
    ...(dado && dados.saldo > 0 ? [{ rotulo: 'Cobrar no WhatsApp', icone: '💬', descricao: t('A mensagem já vai com as parcelas em aberto.'), onClick: () => setCobrar(true) }] : []),
    ...(pessoa ? [{ rotulo: 'Abrir ficha da pessoa', icone: '👤', onClick: () => ir('pessoa', { id: pessoa.id }) }] : []),
  ]
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Trilha atual={nome} />
      <CabecalhoFicha
        midia={<AvatarConta nome={nome} grande />}
        titulo={pessoa ? <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => ir('pessoa', { id: pessoa.id })}>{nome}</button> : nome}
        selos={<>
          <Pilula tom={dado ? 'bom' : 'ruim'}>{t(dado ? '⬇ Me deve' : '⬆ Eu devo')}</Pilula>
          <Pilula tom={TOM_EMPRESTIMO[dados.status]}>{t(dados.status)}</Pilula>
        </>}
        detalhes={[`💸 ${t(dado ? 'Emprestei' : 'Peguei')} ${formatar(e.principal, e.moeda)}`, `📅 ${t('desde')} ${dataBR(e.inicio)}`, `％ ${juros}`]}
        acoes={<AcoesConta principal={dados.saldo > 0 ? { rotulo: dado ? 'Recebi pagamento' : 'Paguei', icone: '💵', onClick: () => setPagar(true) } : undefined} outras={outras} />}
      />

      <ResumoConta
        rotulo={dados.saldo ? (dado ? 'Falta receber' : 'Falta pagar') : 'Quitado'}
        valor={dados.saldo ? formatar(dados.saldo, e.moeda) : '✓'}
        cor={dados.saldo ? cor : 'var(--bom)'}
        frase={dados.proxima
          ? t(dados.proxima.status === 'atrasada' ? 'Parcela atrasada desde {d}: {v}.' : 'Próxima parcela em {d}: {v}.', { d: dataBR(dados.proxima.vencimento), v: formatar(dados.proxima.falta, e.moeda) })
          : t('Todas as parcelas foram pagas.')}
        barra={<BarraConta pct={pct} cor={cor} rotulo="Quanto já foi pago" legenda={`${t('{p}% pago', { p: pct })} · ${pagas}/${dados.parcelas.length} ${t('parcelas pagas')}`} />}
        partes={[
          { rotulo: dado ? 'Emprestei' : 'Peguei', valor: formatar(e.principal, e.moeda) },
          { rotulo: 'Já pago', valor: formatar(dados.recebido, e.moeda), onClick: () => setAba('historico') },
          { rotulo: 'Atrasado', valor: formatar(dados.atrasado, e.moeda), cor: dados.atrasado ? 'var(--ruim)' : undefined, onClick: () => setAba('parcelas') },
          { rotulo: 'Maior atraso', valor: `${dados.maiorAtraso} ${t('dias')}`, cor: dados.maiorAtraso ? 'var(--alerta)' : undefined, onClick: () => setAba('parcelas') },
        ]}
      />

      <Abas atual={aba} onChange={(v) => setAba(v as typeof aba)} abas={[
        { id: 'parcelas', nome: `🗓 ${t('Parcelas')}`, extra: <Pilula pequena>{dados.parcelas.length}</Pilula> },
        { id: 'comprovantes', nome: `📎 ${t('Comprovantes')}` },
        { id: 'historico', nome: `📜 ${t('Linha do tempo')}` },
      ]} />
      <div>
        {aba === 'comprovantes' ? <Anexos donoId={e.id} categorias={['comprovante', 'outro']} />
          : aba === 'historico' ? <LinhaDoTempo id={e.id} />
            : <ListaParcelas dados={dados} />}
      </div>
      {pagar && <JanelaPagamento dados={dados} onFechar={() => setPagar(false)} />}
      {cobrar && (
        <JanelaCobranca tipo="emprestimo" telefone={pessoa?.telefone} onFechar={() => setCobrar(false)} valores={{
          nome,
          falta: formatar(dados.saldo, e.moeda),
          parcelas: dados.parcelas.filter((p) => p.falta).map((p) => `${p.numero}ª · ${dataBR(p.vencimento)} · ${formatar(p.falta, e.moeda)}${p.status === 'atrasada' ? ' ⚠️' : ''}`).join('\n'),
          proxima: dados.proxima ? `${dataBR(dados.proxima.vencimento)} · ${formatar(dados.proxima.falta, e.moeda)}` : '',
          atrasado: formatar(dados.atrasado, e.moeda),
        }} />
      )}
    </div>
  )
}
