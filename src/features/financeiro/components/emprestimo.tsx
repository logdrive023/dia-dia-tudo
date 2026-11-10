// EMPRÉSTIMO › as peças da lista e da ficha (o padrão de conta está em ./conta):
//   CartaoEmprestimo  o cartão da lista (falta receber/pagar em destaque, a próxima parcela, a barra do que já foi pago)
//   ProximaParcela    "📅 Próxima 13/11 · Bs 5.000" (vermelha se atrasada)
//   ListaParcelas     as parcelas numa linha do tempo, a próxima marcada
//   JanelaPagamento   registrar um pagamento (parcial, a próxima parcela ou quitar tudo)
//   JanelaParcela     mudar o dia e/ou o valor de uma parcela, vendo antes como ficam as outras
//   JanelaEmprestarMais mais dinheiro no mesmo empréstimo: parcelas novas no fim ou juntar com o que falta
import { useMemo, useState } from 'react'
import { dataLocal, somarMeses } from '../../../core/domain/datas'
import { calcularParcelas, replanejarParcela } from '../../../core/services/emprestimos'
import { EscolhaCartoes } from '../../../shared/ui/escolhaCartoes'
import { Interruptor } from '../../../shared/ui/interruptor'
import { formatar } from '../../../core/domain/dinheiro'
import { formasEmUso } from '../../../core/domain/formas'
import { novoId } from '../../../core/domain/ids'
import type { ResultadoConsulta } from '../../../core/services'
import { Botao, Campo, Entrada, Janela, Pilula, Selecao, ValorInput, cx, dataBR } from '../../../shared/ui/base'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useComando } from '../../../shared/ui/contexto'
import { BarraConta } from '../../../shared/ui/financiamento'
import { useT } from '../../../shared/ui/i18n'
import { CartaoConta } from './conta'

type LinhaLista = ResultadoConsulta<'emprestimos'>[number]
export type DadosEmprestimo = ResultadoConsulta<'emprestimo'>

export const TOM_EMPRESTIMO = { atrasada: 'ruim', vencendo: 'alerta', 'em dia': 'marca', paga: 'bom', quitado: 'bom' } as const
export const COR_LADO = { dado: 'var(--bom)', tomado: 'var(--ruim)' } as const

/** % do combinado que já foi pago */
export const pctPago = (pago: number, falta: number) => (pago + falta ? Math.round((pago / (pago + falta)) * 100) : 0)

export function ProximaParcela({ vencimento, falta, atrasada, moeda }: { vencimento: string; falta: number; atrasada: boolean; moeda: string }) {
  const t = useT()
  return (
    <span className={cx('num shrink-0 rounded-xl px-2.5 py-1 text-right text-xs', atrasada ? 'bg-[var(--ruim)]/10 text-[var(--ruim)]' : 'bg-[var(--fundo)]')}>
      <span className="block font-semibold">📅 {t(atrasada ? 'Atrasada desde' : 'Próxima')} {dataBR(vencimento)}</span>
      <b className="block">{formatar(falta, moeda)}</b>
    </span>
  )
}

export function CartaoEmprestimo({ e, onAbrir }: { e: LinhaLista; onAbrir(id: string): void }) {
  const t = useT()
  const cor = COR_LADO[e.direcao]
  const pct = pctPago(e.recebido, e.saldo)
  return (
    <CartaoConta
      cor={cor}
      nome={e.pessoa}
      sub={`${t(e.direcao === 'dado' ? 'Emprestei' : 'Peguei')} ${formatar(e.principal, e.moeda)} · ${dataBR(e.inicio)}`}
      situacao={<Pilula tom={TOM_EMPRESTIMO[e.status]}>{t(e.status)}</Pilula>}
      rotuloValor={e.direcao === 'dado' ? 'Falta receber' : 'Falta pagar'}
      valor={e.saldo ? formatar(e.saldo, e.moeda) : `✓ ${t('quitado')}`}
      corValor={e.saldo ? cor : undefined}
      lado={e.proxima && <ProximaParcela vencimento={e.proxima.vencimento} falta={e.proxima.falta} atrasada={e.proxima.status === 'atrasada'} moeda={e.moeda} />}
      barra={<BarraConta pct={pct} cor={cor} rotulo="Quanto já foi pago" legenda={t('{p}% pago', { p: pct })} />}
      onAbrir={() => onAbrir(e.id)}
    />
  )
}

type ParcelaSituacao = DadosEmprestimo['parcelas'][number]

export function ListaParcelas({ dados, onMudar }: { dados: DadosEmprestimo; onMudar?(p: ParcelaSituacao): void }) {
  const t = useT()
  const moeda = dados.emprestimo.moeda
  return (
    <ol className="relative ml-3 space-y-2 border-l-2 border-[var(--borda)] pl-4">
      {dados.parcelas.map((p) => {
        const proxima = dados.proxima?.id === p.id
        const paga = !p.falta
        return (
          <li key={p.id} className="relative">
            <span aria-hidden className={cx('absolute -left-[1.6rem] top-3 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-4 ring-[var(--cartao)]', paga ? 'bg-[var(--bom)] text-white' : p.status === 'atrasada' ? 'bg-[var(--ruim)] text-white' : proxima ? 'bg-[var(--marca)] text-white' : 'bg-[var(--fundo)] text-[var(--suave)]')}>{paga ? '✓' : p.numero}</span>
            {/* celular: data e valor em cima; situação e "Mudar" embaixo (no computador, tudo numa linha) */}
            <div className={cx('grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2 sm:flex sm:min-h-14', proxima ? 'bg-[var(--marca-suave)] ring-1 ring-[var(--marca)]/40' : 'bg-[var(--cartao)] border border-[var(--borda)]')}>
              <span className="min-w-0 text-sm sm:flex-1">
                <b className="num block">{p.numero}ª · {dataBR(p.vencimento)}</b>
                {(proxima || p.diasAtraso > 0) && (
                  <span className="block text-xs font-semibold">
                    {proxima && <span className="text-[var(--marca)]">{t('Próxima')}</span>}
                    {proxima && p.diasAtraso > 0 && ' · '}
                    {p.diasAtraso > 0 && <span className="text-[var(--ruim)]">{t('{n} dia(s) de atraso', { n: p.diasAtraso })}</span>}
                  </span>
                )}
              </span>
              <span className="num text-right text-sm">
                <b className={cx('block whitespace-nowrap', paga && 'text-[var(--suave)] line-through')}>{formatar(p.valor, moeda)}</b>
                {p.falta > 0 && p.falta < p.valor && <span className="block whitespace-nowrap text-xs">{t('Falta')} {formatar(p.falta, moeda)}</span>}
              </span>
              <span className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                <Pilula tom={TOM_EMPRESTIMO[p.status]}>{t(p.status)}</Pilula>
                {onMudar && !paga && (
                  <button type="button" onClick={() => onMudar(p)} aria-label={t('Mudar a parcela {n}', { n: p.numero })}
                    className="min-h-10 shrink-0 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-xs font-semibold text-[var(--marca)] hover:border-[var(--marca)] toque:min-h-11">✏️ {t('Mudar')}</button>
                )}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function JanelaPagamento({ dados, onFechar }: { dados: DadosEmprestimo; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const e = dados.emprestimo
  const [pid] = useState(() => novoId())
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  return (
    <Janela aberta titulo={`💵 ${t(e.direcao === 'dado' ? 'Recebi pagamento' : 'Paguei')}`} onFechar={() => (valor === undefined || window.confirm(t('Sair sem salvar?'))) && onFechar()}
      rodape={<Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => (await executar('pagarEmprestimo', { id: pid, emprestimoId: e.id, valor: valor!, forma }, t('Pagamento registrado.'))) && onFechar()}>{t('Registrar')}</Botao>}>
      <div className="space-y-3">
        <Campo rotulo="Valor" ajuda="Pode ser parcial ou adiantado: abate das parcelas mais antigas primeiro."><ValorInput moeda={e.moeda} valor={valor} onChange={setValor} /></Campo>
        <div className="flex flex-wrap gap-2">
          {dados.proxima && <Botao variante="secundario" onClick={() => setValor(dados.proxima?.falta)}>{t('Valor da próxima parcela')}</Botao>}
          <Botao variante="secundario" onClick={() => setValor(dados.saldo)}>{t('Quitar tudo')}</Botao>
        </div>
        <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formasEmUso(cfg?.formas, e.moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
      </div>
    </Janela>
  )
}

/** "Como fica": as parcelas depois da mudança, com as que mudaram em destaque */
function ComoFica({ antes, depois, moeda }: { antes: { id: string; vencimento: string; valor: number }[]; depois: { id: string; numero: number; vencimento: string; valor: number }[]; moeda: string }) {
  const t = useT()
  const velhas = new Map(antes.map((p) => [p.id, p]))
  return (
    <div className="rounded-2xl bg-[var(--fundo)] p-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">{t('Como fica')}</p>
      <ol className="space-y-1 text-sm">
        {depois.map((p) => {
          const v = velhas.get(p.id)
          const mudou = !v || v.valor !== p.valor || v.vencimento !== p.vencimento
          return (
            <li key={p.id} className={cx('num flex justify-between gap-3 rounded-lg px-2 py-1', mudou && 'bg-[var(--marca-suave)] font-semibold')}>
              <span>{p.numero}ª · {dataBR(p.vencimento)}{!v && <span className="ml-1 text-xs text-[var(--marca)]">{t('nova')}</span>}</span>
              <span>{v && v.valor !== p.valor && <s className="mr-1.5 font-normal text-[var(--suave)]">{formatar(v.valor, moeda)}</s>}{formatar(p.valor, moeda)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function JanelaParcela({ dados, parcela, onFechar }: { dados: DadosEmprestimo; parcela: ParcelaSituacao; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const e = dados.emprestimo
  const [vencimento, setVencimento] = useState(parcela.vencimento)
  const [valor, setValor] = useState<number | undefined>(parcela.valor)
  const [mudaTotal, setMudaTotal] = useState(false)
  const [motivo, setMotivo] = useState('')
  const mexeu = vencimento !== parcela.vencimento || valor !== parcela.valor
  const previa = useMemo(() => {
    try {
      return { ok: replanejarParcela(dados.parcelas, parcela.id, { vencimento, valor: valor ?? 0 }, mudaTotal) }
    } catch (x) {
      return { erro: (x as Error).message }
    }
  }, [dados.parcelas, parcela.id, vencimento, valor, mudaTotal])
  const salvar = async () => (await executar('ajustarParcela', { emprestimoId: e.id, parcelaId: parcela.id, vencimento, valor, mudaTotal, motivo }, t('Parcela alterada.'))) && onFechar()
  return (
    <Janela aberta titulo={`✏️ ${t('Mudar a {n}ª parcela', { n: parcela.numero })}`} onFechar={() => (!mexeu || window.confirm(t('Sair sem salvar?'))) && onFechar()}
      rodape={<Botao grande className="w-full" disabled={ocupado || !mexeu || !previa.ok || valor === undefined} onClick={salvar}>{t('Salvar')}</Botao>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Dia"><Entrada type="date" value={vencimento} onChange={(x) => setVencimento(x.target.value)} /></Campo>
          <Campo rotulo="Valor"><ValorInput moeda={e.moeda} valor={valor} onChange={setValor} /></Campo>
        </div>
        {parcela.pago > 0 && <p className="text-xs text-[var(--suave)]">{t('Dessa parcela já foi pago {v}.', { v: formatar(parcela.pago, e.moeda) })}</p>}
        {valor !== parcela.valor && (
          <Interruptor ligado={mudaTotal} onChange={setMudaTotal} titulo="Muda o total da dívida"
            texto={mudaTotal ? 'Só esta parcela muda, e o total junto (ex.: juros de atraso ou desconto combinados).' : 'Desligado: o total fica igual e a diferença vai para as próximas parcelas.'} />
        )}
        {mudaTotal && valor !== parcela.valor && <Campo rotulo="Motivo"><Entrada value={motivo} onChange={(x) => setMotivo(x.target.value)} placeholder={t('Ex.: juros de atraso combinados')} /></Campo>}
        {previa.erro ? <p role="alert" className="rounded-xl bg-[var(--ruim)]/10 p-2 text-sm text-[var(--ruim)]">{t(previa.erro)}</p>
          : mexeu && previa.ok && <ComoFica antes={dados.parcelas} depois={previa.ok.parcelas} moeda={e.moeda} />}
        <p className="text-xs text-[var(--suave)]">{t('Muda em todo lugar: próxima parcela, atrasos, painel, agenda e cobrança.')}</p>
      </div>
    </Janela>
  )
}

const MODOS_MAIS = [
  { id: 'novas', icone: '➕', nome: 'Parcelas novas', descricao: 'O que já estava combinado continua igual; o valor novo vira parcelas no fim.' },
  { id: 'juntar', icone: '🔗', nome: 'Juntar com o que falta', descricao: 'O que falta + o valor novo viram um parcelamento só.' },
]

export function JanelaEmprestarMais({ dados, onFechar }: { dados: DadosEmprestimo; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const e = dados.emprestimo
  const dado = e.direcao === 'dado'
  const [opId] = useState(() => novoId())
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [modo, setModo] = useState<'novas' | 'juntar'>('novas')
  const [n, setN] = useState(dados.parcelas.filter((p) => p.falta).length || 1)
  const ultima = dados.parcelas[dados.parcelas.length - 1]?.vencimento
  const [primeiro, setPrimeiro] = useState(() => (modo === 'novas' && ultima && ultima >= dataLocal() ? somarMeses(ultima, 1) : somarMeses(dataLocal(), 1)))
  // os juros do valor novo seguem os do empréstimo (valor fixo não se repete)
  const juros = e.juros.tipo === 'fixo' ? { tipo: 'nenhum' as const } : e.juros
  let previa: ReturnType<typeof calcularParcelas> | undefined
  try {
    if (valor) previa = calcularParcelas(valor, juros, n, primeiro)
  } catch {
    previa = undefined
  }
  const totalNovo = previa ? (modo === 'juntar' ? dados.saldo + previa.total : previa.total) : 0
  const salvar = async () => (await executar('aumentarEmprestimo', { id: opId, emprestimoId: e.id, valor: valor!, forma, modo, parcelas: n, primeiroVencimento: primeiro }, t('Valor a mais registrado.'))) && onFechar()
  return (
    <Janela aberta titulo={`💸 ${t(dado ? 'Emprestar mais' : 'Pegar mais emprestado')}`} onFechar={() => (valor === undefined || window.confirm(t('Sair sem salvar?'))) && onFechar()}
      rodape={<Botao grande className="w-full" disabled={ocupado || !previa} onClick={salvar}>{t('Registrar')}</Botao>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Valor a mais"><ValorInput moeda={e.moeda} valor={valor} onChange={setValor} /></Campo>
          <Campo rotulo="Forma"><Selecao valor={forma} onChange={setForma} opcoes={formasEmUso(cfg?.formas, e.moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        </div>
        <EscolhaCartoes rotulo="Como pagar" valor={modo} onChange={(v) => setModo(v as 'novas' | 'juntar')} opcoes={MODOS_MAIS} />
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Parcelas"><Entrada inputMode="numeric" value={n} onChange={(x) => setN(Math.max(1, Math.min(120, Number(x.target.value) || 1)))} /></Campo>
          <Campo rotulo="1º vencimento"><Entrada type="date" value={primeiro} onChange={(x) => setPrimeiro(x.target.value)} /></Campo>
        </div>
        <p className="text-xs text-[var(--suave)]">％ {e.juros.tipo === 'nenhum' || e.juros.tipo === 'fixo' ? t('O valor a mais vai sem juros.') : t('O valor a mais segue os juros do empréstimo ({p}% ao mês).', { p: (e.juros.taxaMensalBp ?? 0) / 100 })}</p>
        {previa && (
          <div className="rounded-2xl bg-[var(--fundo)] p-3 text-sm">
            <p className="flex justify-between gap-3"><span>{t(dado ? 'Falta receber hoje' : 'Falta pagar hoje')}</span><b className="num">{formatar(dados.saldo, e.moeda)}</b></p>
            <p className="flex justify-between gap-3"><span>+ {t('valor a mais')}{previa.juros ? ` + ${t('juros')}` : ''}</span><b className="num">{formatar(previa.total, e.moeda)}</b></p>
            <p className="mt-1 flex justify-between gap-3 border-t border-[var(--borda)] pt-1 font-bold"><span>{t('Fica')}</span><span className="num">{formatar(dados.saldo + previa.total, e.moeda)}</span></p>
            <p className="mt-1 text-xs text-[var(--suave)]">{modo === 'juntar'
              ? t('{n}× de {v} a partir de {d}', { n, v: formatar(Math.floor(totalNovo / n), e.moeda), d: dataBR(primeiro) })
              : t('+ {n}× de {v} a partir de {d}; as parcelas de antes continuam iguais', { n, v: formatar(previa.parcelas[0].valor, e.moeda), d: dataBR(primeiro) })}</p>
          </div>
        )}
      </div>
    </Janela>
  )
}
