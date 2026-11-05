// CONFIGURAÇÕES › Formas de pagamento: quais aparecem e em que moedas.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { Carregando, Cartao, Pilula } from '../../ui/base'
import { useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function FormasPagamento() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  if (!dados) return <Carregando />
  return (
    <Cartao>
      <ul className="divide-y divide-[var(--borda)]">
        {dados.config.formas.map((f) => (
          <li key={f.id} className="flex min-h-12 flex-wrap items-center gap-2 py-2">
            <span aria-hidden className="text-xl">{f.vivo ? '💵' : '🏦'}</span>
            <span className="flex-1 font-semibold">{t(f.nome)}</span>
            <Pilula tom={f.vivo ? 'bom' : 'marca'}>{f.moedas.join(', ')}</Pilula>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}
