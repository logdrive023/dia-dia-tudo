// ADIANTAMENTOS A PARCEIROS (financiamento pago com cabelo): a loja dá dinheiro a uma pessoa para comprar cabelo em
// nome da loja; cada entrega de cabelo é uma compra normal que abate a dívida (não sai do caixa).
// LISTA — o PADRÃO DE CONTA (components/conta): os números (na mão dos compradores · financiado · cabelo entregue ·
// a pagar a parceiros — tocar filtra) → o FILTRO PADRÃO (situação em abas, só as que têm algo; busca; período;
// prazo) → um CartaoConta por adiantamento. A ficha fica em pages/FichaFinanciamento.
import { dataLocal } from '../../../core/domain/datas'
import { formatar } from '../../../core/domain/dinheiro'
import type { StatusFinanciamento } from '../../../core/services/financiamentos'
import { Botao, Carregando, Titulo, Vazio, gramasTexto, moedaPadrao } from '../../../shared/ui/base'
import { useApp, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { BotaoEscolha, FiltroLista, VazioFiltro } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { Paginada } from '../../../shared/ui/paginacao'
import { CartaoAdiantamento } from '../components/adiantamento'

export { FichaFinanciamento } from './FichaFinanciamento'

type FiltroStatus = 'ativos' | StatusFinanciamento | 'todos'

const PRAZOS = [{ id: '', nome: 'Qualquer prazo' }, { id: 'vencido', nome: 'Vencido', icone: '🔴' }, { id: 'semana', nome: 'Vence em 7 dias', icone: '🟡' }, { id: 'sem', nome: 'Sem data limite', icone: '⚪' }]

export function Financiamentos() {
  const t = useT()
  const { ir, sessao } = useApp()
  const admin = sessao.perfil === 'admin'
  const [status, setStatus] = useParamTela<FiltroStatus>('status', 'ativos')
  const [busca, setBusca] = useParamTela('busca', '')
  const [de, setDe] = useParamTela('de', '')
  const [ate, setAte] = useParamTela('ate', '')
  const [prazo, setPrazo] = useParamTela<'' | 'vencido' | 'semana' | 'sem'>('prazo', '')
  const { dados, erro } = useConsulta('financiamentos', { status: status === 'todos' ? undefined : status, busca: busca || undefined, de: de || undefined, ate: ate || undefined, prazo: prazo || undefined })
  const hoje = dataLocal()
  const limpar = () => (setBusca(''), setDe(''), setAte(''), setPrazo(''))
  const m = dados?.moeda ?? moedaPadrao()
  const c = dados?.contagem
  // as abas: "Em andamento" e "Todos" sempre; as outras só quando têm algo (ou estão escolhidas)
  const abas: { id: FiltroStatus; nome: string; n?: number; tom?: 'alerta' }[] = [
    { id: 'ativos', nome: 'Em andamento', n: c ? c.aberto + c.aPagar : undefined },
    { id: 'aberto', nome: 'Em aberto', n: c?.aberto },
    { id: 'aPagar', nome: 'A pagar ao parceiro', n: c?.aPagar, tom: 'alerta' },
    { id: 'quitado', nome: 'Quitados', n: c?.quitado },
    { id: 'encerrado', nome: 'Encerrados', n: c?.encerrado },
    { id: 'todos', nome: 'Todos', n: c?.todos },
  ]
  const abasVisiveis = abas.filter((a) => a.id === 'ativos' || a.id === 'todos' || a.id === status || !c || (a.n ?? 0) > 0)
  const novo = () => ir('novoFinanciamento')
  return (
    <div>
      <Titulo acao={admin && <Botao onClick={novo}>+ {t('Adiantamento')}</Botao>}
        subtitulo={t('Dinheiro dado a um parceiro para comprar cabelo para a loja. A dívida é paga com o cabelo que ele entrega.')}>
        {t('Adiantamentos')}
      </Titulo>
      {erro && <p className="mb-3 text-sm text-[var(--ruim)]">{erro}</p>}
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Na mão dos compradores" icone="🤲" valor={formatar(dados?.totais.naMao ?? 0, m)} tom="marca" ativo={status === 'aberto'} onClick={() => setStatus(status === 'aberto' ? 'ativos' : 'aberto')} carregando={!dados}
          ajuda="O que ainda falta voltar dos adiantamentos em aberto (em cabelo, dinheiro ou comissão)." />
        <NumeroGrande rotulo="Financiado" icone="💸" valor={formatar(dados?.totais.financiado ?? 0, m)} carregando={!dados} />
        <NumeroGrande rotulo="Cabelo entregue" icone="💇‍♀️" valor={formatar(dados?.totais.entregue ?? 0, m)} tom={dados?.totais.entregue ? 'bom' : undefined} sub={gramasTexto(dados?.totais.gramas ?? 0)} carregando={!dados} />
        <NumeroGrande rotulo="A pagar a parceiros" icone="⬆" valor={formatar(dados?.totais.aPagarParceiros ?? 0, m)} tom={dados?.totais.aPagarParceiros ? 'alerta' : undefined} ativo={status === 'aPagar'} onClick={() => setStatus(status === 'aPagar' ? 'ativos' : 'aPagar')} carregando={!dados} />
      </GrupoNumeros>
      <FiltroLista
        className="mb-3"
        situacao={{ valor: status, onChange: (v) => setStatus(v as FiltroStatus), opcoes: abasVisiveis.map((a) => ({ id: a.id, nome: a.nome, n: a.n, tom: a.tom })) }}
        busca={busca} onBusca={setBusca} placeholder="Buscar por código, pessoa ou viagem"
        periodo={{ de, ate, onChange: (d, a) => (setDe(d ?? ''), setAte(a ?? '')), presets: ['30d', 'mes', 'mesPassado', 'ano'] }}
        extra={<BotaoEscolha icone="⏰" rotulo="Prazo" valor={prazo} onChange={(v) => setPrazo(v as typeof prazo)} opcoes={PRAZOS} />}
        ativos={prazo ? [{ k: 'prazo', rotulo: `⏰ ${t(PRAZOS.find((x) => x.id === prazo)?.nome ?? prazo)}` }] : []}
        onTirar={() => setPrazo('')} onLimpar={limpar} temAtivos={!!(busca || de || prazo)}
        resultados={dados?.linhas.length} total={dados?.contagem.todos} unidade="adiantamento(s)"
      />
      {!dados ? <Carregando /> : !dados.linhas.length && (busca || de || prazo) ? <VazioFiltro filtrando onLimpar={limpar} /> : !dados.linhas.length ? (
        <Vazio texto={status === 'ativos' ? 'Nenhum adiantamento em andamento.' : 'Nenhum adiantamento.'}>
          {admin && <Botao className="mt-2" onClick={novo}>+ {t('Adiantamento')}</Botao>}
        </Vazio>
      ) : (
        <Paginada itens={dados.linhas} unidade="adiantamento(s)" reiniciar={String(dados.linhas.length)}>{(pagina) => (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pagina.map((f) => <li key={f.id}><CartaoAdiantamento f={f} moeda={dados.moeda} hoje={hoje} onAbrir={(id) => ir('financiamento', { id })} /></li>)}
          </ul>
        )}</Paginada>
      )}
    </div>
  )
}
