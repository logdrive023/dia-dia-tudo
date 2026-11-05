// EMPRÉSTIMOS: dado (me devem) ou tomado (eu devo), parcelas, pagamentos parciais, atraso e cobrança.
// O sistema só registra e calcula o combinado.
//   LISTA: os números (me devem · eu devo · atrasado · ativos) → o FILTRO PADRÃO (lado em abas com o número, busca,
//          📅 período do início, situação) → um cartão por empréstimo: faixa da cor do lado, avatar, quanto falta em
//          destaque, a barra do que já foi pago e a próxima parcela (vermelha se atrasada).
//   FICHA: o cabeçalho padrão (pessoa, lado, situação, combinado, falta) → os números → a barra → as parcelas numa
//          linha do tempo (a próxima marcada) → comprovantes e linha do tempo.

import { useState } from 'react'
import { formatar } from '../core/domain/dinheiro'
import { novoId } from '../core/domain/ids'
import type { Id } from '../core/domain/tipos'
import { Botao, Campo, Carregando, Cartao, Janela, Pilula, Selecao, Titulo, ValorInput, Vazio, cx, dataBR, ErroTela, moedaPadrao } from '../ui/base'
import { CabecalhoFicha } from '../ui/cabecalhoFicha'
import { useApp, useComando, useConsulta, useParamTela } from '../ui/contexto'
import { Anexos, linkWhatsApp, useCotacoes } from '../ui/compartilhados'
import { BotaoEscolha, FiltroLista, VazioFiltro } from '../ui/filtroPadrao'
import { LinhaDoTempo } from '../ui/linhaTempo'
import { useT } from '../ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../ui/numeroGrande'
import { corDoNome, iniciais } from '../ui/tabelaDados'
import { Trilha } from '../ui/trilha'

const TOM = { atrasada: 'ruim', vencendo: 'alerta', 'em dia': 'marca', paga: 'bom', quitado: 'bom' } as const
const COR_LADO = { dado: 'var(--bom)', tomado: 'var(--ruim)' } as const
const SITUACOES = [{ id: '', nome: 'Todas' }, { id: 'atrasada', nome: 'Atrasada', icone: '🔴' }, { id: 'vencendo', nome: 'Vencendo', icone: '🟡' }, { id: 'em dia', nome: 'Em dia', icone: '🟢' }, { id: 'quitado', nome: 'Quitado', icone: '✓' }]
const semAcento = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Avatar({ nome, grande }: { nome: string; grande?: boolean }) {
  const cor = corDoNome(nome)
  return (
    <span aria-hidden className={cx('flex shrink-0 items-center justify-center font-bold', grande ? 'h-14 w-14 rounded-2xl text-lg' : 'h-10 w-10 rounded-full text-sm')}
      style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor, boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 45%, transparent)` }}>{iniciais(nome)}</span>
  )
}

/** a barra do que já foi pago (do total combinado) */
function BarraPago({ pago, falta, cor }: { pago: number; falta: number; cor: string }) {
  const total = pago + falta
  const pct = total ? Math.round((pago / total) * 100) : 0
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--fundo)]"><div className="rounded-full" style={{ width: `${pct}%`, background: cor }} /></div>
      <span className="num mt-0.5 block text-[11px] text-[var(--suave)]">{pct}% pago</span>
    </div>
  )
}

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
  const ativosF = [...(status ? [{ k: 'status', rotulo: `${SITUACOES.find((x) => x.id === status)?.icone ?? ''} ${t(SITUACOES.find((x) => x.id === status)?.nome ?? status)}` }] : [])]
  const limpar = () => (setStatus(''), setBusca(''), setDe(''), setAte(''))
  return (
    <div>
      <Titulo acao={<Botao onClick={() => ir('novoEmprestimo')}>+ {t('Empréstimo')}</Botao>} subtitulo={t('O sistema só registra e calcula o que foi combinado.')}>{t('Empréstimos')}</Titulo>
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
        ativos={ativosF} onTirar={() => setStatus('')} onLimpar={limpar} temAtivos={!!(status || busca || de)}
        resultados={dados ? lista.length : undefined} total={todos.length} unidade="empréstimo(s)"
      />
      {!dados ? <Carregando /> : !todos.length ? <Vazio texto="Nenhum empréstimo." /> : !lista.length ? <VazioFiltro filtrando onLimpar={limpar} /> : (
        <ul className="grid gap-2 md:grid-cols-2">
          {lista.map((e) => {
            const cor = COR_LADO[e.direcao]
            const atrasada = e.proxima?.status === 'atrasada'
            return (
              <li key={e.id}>
                <button type="button" onClick={() => ir('emprestimo', { id: e.id })} className="group relative flex w-full flex-col gap-2.5 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3 pl-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)] hover:shadow-md">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} />
                  <span className="flex items-center gap-3">
                    <Avatar nome={e.pessoa} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{e.pessoa}</b>
                      <span className="num block truncate text-xs text-[var(--suave)]">{t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} {formatar(e.principal, e.moeda)} · {dataBR(e.inicio)}</span>
                    </span>
                    <Pilula tom={TOM[e.status]}>{t(e.status)}</Pilula>
                  </span>
                  <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--suave)]">{t(e.direcao === 'dado' ? 'Falta receber' : 'Falta pagar')}</span>
                      <b className="num block whitespace-nowrap text-xl leading-tight" style={{ color: e.saldo ? cor : undefined }}>{e.saldo ? formatar(e.saldo, e.moeda) : `✓ ${t('quitado')}`}</b>
                    </span>
                    {e.proxima && (
                      <span className={cx('num shrink-0 rounded-xl px-2.5 py-1 text-right text-xs', atrasada ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : 'bg-[var(--fundo)]')}>
                        <span className="block font-semibold">📅 {t(atrasada ? 'Atrasada desde' : 'Próxima')} {dataBR(e.proxima.vencimento)}</span>
                        <b className="block">{formatar(e.proxima.falta, e.moeda)}</b>
                      </span>
                    )}
                  </span>
                  <BarraPago pago={e.recebido} falta={e.saldo} cor={cor} />
                </button>
              </li>
            )
          })}
        </ul>
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
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [pagar, setPagar] = useState(false)
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [pid, setPid] = useState(() => novoId())
  if (erro) return <ErroTela texto={erro} onVoltar={voltar} />
  if (!dados) return <Carregando />
  const e = dados.emprestimo
  const pessoa = dados.pessoa
  const nome = pessoa?.nome ?? '—'
  const cor = COR_LADO[e.direcao]
  const cobranca = `${t('Olá')} ${pessoa?.nome ?? ''}! ${t('Parcelas em aberto')}: ${dados.parcelas.filter((p) => p.falta).map((p) => `${p.numero}ª ${dataBR(p.vencimento)} ${formatar(p.falta, e.moeda)}`).join(' · ')}. ${t('Total que falta')}: ${formatar(dados.saldo, e.moeda)}.`
  const fecharPagar = () => (valor === undefined || window.confirm(t('Sair sem salvar?'))) && (setPagar(false), setValor(undefined))
  const ver = (secao: string) => document.getElementById(secao)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const juros = e.juros?.tipo && e.juros.tipo !== 'nenhum'
    ? `${t(NOME_JUROS[e.juros.tipo])}${e.juros.taxaMensalBp ? ` ${e.juros.taxaMensalBp / 100}% ${t('ao mês')}` : ''}${e.juros.valorFixo ? ` ${formatar(e.juros.valorFixo, e.moeda)}` : ''}`
    : t('sem juros')
  const pagas = dados.parcelas.filter((p) => !p.falta).length
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Trilha atual={nome} />
      <CabecalhoFicha
        midia={<Avatar nome={nome} grande />}
        titulo={pessoa ? <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => ir('pessoa', { id: pessoa.id })}>{nome}</button> : nome}
        selos={<>
          <Pilula tom={e.direcao === 'dado' ? 'bom' : 'ruim'}>{t(e.direcao === 'dado' ? '⬇ Me deve' : '⬆ Eu devo')}</Pilula>
          <Pilula tom={TOM[dados.status]}>{t(dados.status)}</Pilula>
        </>}
        detalhes={[
          `${t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} ${formatar(e.principal, e.moeda)}`,
          `${t('desde')} ${dataBR(e.inicio)}`,
          juros,
          `${pagas}/${dados.parcelas.length} ${t('parcelas pagas')}`,
        ]}
        valor={<span style={{ color: dados.saldo ? cor : undefined }}>{dados.saldo ? formatar(dados.saldo, e.moeda) : '✓'}</span>}
        valorDetalhe={t(dados.saldo ? (e.direcao === 'dado' ? 'falta receber' : 'falta pagar') : 'quitado')}
        acoes={<div className="flex flex-wrap gap-2">
          {dados.saldo > 0 && <Botao onClick={() => setPagar(true)}>💵 {t(e.direcao === 'dado' ? 'Recebi pagamento' : 'Paguei')}</Botao>}
          {e.direcao === 'dado' && dados.saldo > 0 && <a className="inline-flex min-h-11 items-center rounded-xl bg-[#25d366] px-4 text-sm font-semibold text-white" href={linkWhatsApp(cobranca, pessoa?.telefone)} target="_blank" rel="noreferrer">💬 {t('Cobrar no WhatsApp')}</a>}
          {pessoa && <Botao variante="secundario" onClick={() => ir('pessoa', { id: pessoa.id })}>👤 {t('Abrir ficha')}</Botao>}
        </div>}
      />
      <GrupoNumeros colunas={4} className="mb-0">
        <NumeroGrande rotulo="Falta" valor={formatar(dados.saldo, e.moeda)} icone="⏳" tom={dados.saldo ? (e.direcao === 'dado' ? 'bom' : 'ruim') : undefined} onClick={() => ver('emp-parcelas')} />
        <NumeroGrande rotulo="Já pago" valor={formatar(dados.recebido, e.moeda)} icone="✓" onClick={() => ver('emp-historico')} />
        <NumeroGrande rotulo="Atrasado" valor={formatar(dados.atrasado, e.moeda)} icone="⏰" tom={dados.atrasado ? 'ruim' : undefined} onClick={() => ver('emp-parcelas')} />
        <NumeroGrande rotulo="Maior atraso" valor={`${dados.maiorAtraso} ${t('dias')}`} icone="📆" tom={dados.maiorAtraso ? 'alerta' : undefined} onClick={() => ver('emp-parcelas')} />
      </GrupoNumeros>
      <div className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-3"><BarraPago pago={dados.recebido} falta={dados.saldo} cor={cor} /></div>

      <div id="emp-parcelas" className="scroll-mt-4">
        <Cartao titulo={`🗓 ${t('Parcelas')} · ${dados.parcelas.length}`}>
          <ol className="relative space-y-2 border-l-2 border-[var(--borda)] pl-4">
            {dados.parcelas.map((p) => {
              const proxima = dados.proxima?.id === p.id
              const paga = !p.falta
              return (
                <li key={p.id} className="relative">
                  <span aria-hidden className={cx('absolute -left-[1.6rem] top-3 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-4 ring-[var(--cartao)]', paga ? 'bg-[var(--bom)] text-white' : p.status === 'atrasada' ? 'bg-[var(--ruim)] text-white' : proxima ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{paga ? '✓' : p.numero}</span>
                  <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2', proxima ? 'bg-[var(--marca-suave)] ring-1 ring-[var(--marca)]/40' : 'bg-[var(--fundo)]')}>
                    <span className="min-w-0 flex-1 text-sm">
                      <b className="num block">{p.numero}ª · {dataBR(p.vencimento)}</b>
                      {proxima && <span className="block text-xs font-semibold text-[var(--marca)]">{t('próxima')}</span>}
                      {p.diasAtraso > 0 && <span className="block text-xs font-semibold text-[var(--ruim)]">{t('{n} dia(s) de atraso', { n: p.diasAtraso })}</span>}
                    </span>
                    <span className="num text-right text-sm">
                      <b className={cx('block', paga && 'text-[var(--suave)] line-through')}>{formatar(p.valor, e.moeda)}</b>
                      {p.falta > 0 && p.falta < p.valor && <span className="block text-xs">{t('falta')} {formatar(p.falta, e.moeda)}</span>}
                    </span>
                    <Pilula tom={TOM[p.status]}>{t(p.status)}</Pilula>
                  </div>
                </li>
              )
            })}
          </ol>
        </Cartao>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao titulo={`📎 ${t('Comprovantes')}`}><Anexos donoId={e.id} categorias={['comprovante', 'outro']} /></Cartao>
        <div id="emp-historico" className="scroll-mt-4"><Cartao titulo={`📜 ${t('Linha do tempo')}`}><LinhaDoTempo id={e.id} /></Cartao></div>
      </div>
      <Janela aberta={pagar} titulo={t('Pagamento')} onFechar={fecharPagar} rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => {
        if (await executar('pagarEmprestimo', { id: pid, emprestimoId: e.id, valor: valor!, forma }, t('Pagamento registrado.'))) {
          setPagar(false)
          setValor(undefined)
          setPid(novoId())
        }
      }}>{t('Registrar')}</Botao>}>
        <div className="space-y-3">
          <Campo rotulo="Valor" ajuda="Pode ser parcial ou adiantado: abate das parcelas mais antigas primeiro."><ValorInput moeda={e.moeda} valor={valor} onChange={setValor} /></Campo>
          <div className="flex flex-wrap gap-2">
            {dados.proxima && <Botao variante="secundario" onClick={() => setValor(dados.proxima?.falta)}>{t('Valor da próxima parcela')}</Botao>}
            <Botao variante="secundario" onClick={() => setValor(dados.saldo)}>{t('Quitar tudo')}</Botao>
          </div>
          <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={(cfg?.formas ?? []).filter((f) => f.moedas.includes(e.moeda)).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        </div>
      </Janela>
    </div>
  )
}
