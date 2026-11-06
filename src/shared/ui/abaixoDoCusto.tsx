// ALERTA DE VENDA ABAIXO DO CUSTO (Modo caixa e Vender): antes de cobrar, o servidor diz se alguma linha está sendo
// vendida por menos do que custou (custo do lote proporcional às gramas, com o gasto de viagem quando incorporado).
// A tela mostra o aviso e pede confirmação; a venda pode passar (às vezes é de propósito), mas fica na auditoria.
// A funcionária vê o aviso, nunca o valor do custo (a resposta chega sem ele).
import { formatar } from '../../core/domain/dinheiro'
import type { Id } from '../../core/domain/tipos'
import { useConsulta } from './contexto'
import { useT } from './i18n'

export interface LinhaCusto { itemId: Id; quantidade: number; total: number; moeda: string }

export function useAbaixoDoCusto(linhas: LinhaCusto[]) {
  const validas = linhas.filter((l) => l.quantidade > 0 && Number.isFinite(l.total))
  const { dados } = useConsulta('custoDaVenda', { linhas: validas as never }, validas.length > 0)
  const abaixo = (dados ?? []).filter((x) => x.abaixo)
  return { abaixo, chave: abaixo.map((x) => x.itemId).join(',') }
}

/** a faixa vermelha antes do FECHAR: "2 pacotes abaixo do custo" (com o custo, para quem pode ver) */
export function AvisoAbaixoDoCusto({ abaixo, nomeDe, moeda }: { abaixo: { itemId: Id; custoPrincipal?: number; vendaPrincipal: number }[]; nomeDe(id: Id): string; moeda: string }) {
  const t = useT()
  if (!abaixo.length) return null
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-[var(--ruim)]/40 bg-[var(--ruim)]/10 px-3 py-2 text-sm">
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ruim)] text-base font-bold text-white">!</span>
      <span className="min-w-0">
        <b className="block text-[var(--ruim)]">{t(abaixo.length === 1 ? 'Preço abaixo do custo' : '{n} pacotes abaixo do custo', { n: abaixo.length })}</b>
        <span className="block text-xs text-[var(--suave)]">
          {t(abaixo.length === 1 ? 'Pacote' : 'Pacotes')}: {abaixo.map((x) => `${nomeDe(x.itemId)}${x.custoPrincipal !== undefined ? ` · ${t('vende')} ${formatar(x.vendaPrincipal, moeda)} · ${t('custou')} ${formatar(x.custoPrincipal, moeda)}` : ''}`).join(' — ')}
        </span>
        <span className="block text-xs text-[var(--suave)]">{t('Confira o preço (medida, coluna da tabela, desconto). Dá para vender assim mesmo: fica registrado.')}</span>
      </span>
    </div>
  )
}
