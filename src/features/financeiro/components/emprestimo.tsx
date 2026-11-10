// EMPRÉSTIMO › as peças da lista e da ficha (o padrão de conta está em ./conta):
//   CartaoEmprestimo  o cartão da lista (falta receber/pagar em destaque, a próxima parcela, a barra do que já foi pago)
//   ProximaParcela    "📅 Próxima 13/11 · Bs 5.000" (vermelha se atrasada)
//   ListaParcelas     as parcelas numa linha do tempo, a próxima marcada
//   JanelaPagamento   registrar um pagamento (parcial, a próxima parcela ou quitar tudo)
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import { formasEmUso } from '../../../core/domain/formas'
import { novoId } from '../../../core/domain/ids'
import type { ResultadoConsulta } from '../../../core/services'
import { Botao, Campo, Janela, Pilula, Selecao, ValorInput, cx, dataBR } from '../../../shared/ui/base'
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

export function ListaParcelas({ dados }: { dados: DadosEmprestimo }) {
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
            <div className={cx('flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2', proxima ? 'bg-[var(--marca-suave)] ring-1 ring-[var(--marca)]/40' : 'bg-[var(--cartao)] border border-[var(--borda)]')}>
              <span className="min-w-0 flex-1 text-sm">
                <b className="num block">{p.numero}ª · {dataBR(p.vencimento)}</b>
                {proxima && <span className="block text-xs font-semibold text-[var(--marca)]">{t('Próxima')}</span>}
                {p.diasAtraso > 0 && <span className="block text-xs font-semibold text-[var(--ruim)]">{t('{n} dia(s) de atraso', { n: p.diasAtraso })}</span>}
              </span>
              <span className="num text-right text-sm">
                <b className={cx('block', paga && 'text-[var(--suave)] line-through')}>{formatar(p.valor, moeda)}</b>
                {p.falta > 0 && p.falta < p.valor && <span className="block text-xs">{t('Falta')} {formatar(p.falta, moeda)}</span>}
              </span>
              <Pilula tom={TOM_EMPRESTIMO[p.status]}>{t(p.status)}</Pilula>
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
