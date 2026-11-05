// CONFIGURAÇÕES › Formas de pagamento: ligar/desligar cada forma (e em que moedas ela vale).
// Desligada = some de toda tela que pede para escolher (venda, compra, caixa, comissão…): ex. não vendem por Pix →
// desligam aqui, sem pedir mudança no sistema. O que já foi pago com ela continua nos relatórios (domain/formas.ts).
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { FORMA_FIXA } from '../../core/domain/formas'
import { Carregando, Cartao, Pilula, cx } from '../../ui/base'
import { useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { Chave } from '../../ui/interruptor'

export function FormasPagamento() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  if (!dados) return <Carregando />
  const formas = dados.config.formas
  const ligadas = formas.filter((f) => f.id === FORMA_FIXA || !f.desligada).length
  const mudar = (id: string, ligada: boolean) =>
    executar('salvarConfig', { formas: formas.map((f) => (f.id === id ? { ...f, desligada: !ligada } : f)), antes: { formas } }, t(ligada ? 'Forma ligada.' : 'Forma desligada: não aparece mais para escolher.'))
  return (
    <Cartao titulo={t('{n} de {total} ligadas', { n: ligadas, total: formas.length })} ajuda="Desligue a forma que o negócio não usa (ex.: não vendem por Pix): ela some da venda, da compra, do caixa e de todo lugar que pede a forma de pagamento. O que já foi pago com ela continua nos relatórios. Dinheiro não desliga: é o caixa da mão.">
      <ul className="divide-y divide-[var(--borda)]">
        {formas.map((f) => {
          const fixa = f.id === FORMA_FIXA
          const ligada = fixa || !f.desligada
          return (
            <li key={f.id} className={cx('flex min-h-14 items-center gap-3 py-1', !ligada && 'opacity-60')}>
              <span aria-hidden className="text-xl">{f.vivo ? '💵' : '🏦'}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(f.nome)}</span>
                <span className="block text-xs text-[var(--suave)]">{fixa ? t('Sempre ligado (o caixa da mão)') : ligada ? t('Aparece na venda, compra e caixa') : t('Desligada: não aparece para escolher')}</span>
              </span>
              <span className="hidden flex-wrap justify-end gap-1 sm:flex">{f.moedas.map((m) => <Pilula key={m} pequena tom={ligada ? (f.vivo ? 'bom' : 'marca') : 'neutro'}>{m}</Pilula>)}</span>
              <Chave ligado={ligada} travado={fixa || ocupado} rotulo={f.nome} onChange={(v) => mudar(f.id, v)} />
            </li>
          )
        })}
      </ul>
    </Cartao>
  )
}
