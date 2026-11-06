// UM NÚMERO DO PAINEL no cartão padrão do sistema (NumeroGrande): ⓘ, valor, variação e detalhe em selos; tocar abre a lista.
import type { Cartao as CartaoDados } from '../../core/modulos'
import { fmt } from '../../ui/base'
import { useApp } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { NumeroGrande, type Selo } from '../../ui/numeroGrande'
import { variacaoPct } from './calculos'

/** Variação em selo, só quando há período anterior; base ≤ 0 → "sem base anterior"; acima de ±500% vira "muito acima/abaixo". */
export function seloVariacao(t: ReturnType<typeof useT>, atual: number, anterior?: number): Selo | undefined {
  if (anterior === undefined) return undefined
  const v = variacaoPct(atual, anterior)
  if (v === undefined) return { texto: t('sem base anterior') }
  const sobe = v >= 0
  return { texto: `${sobe ? '↑' : '↓'} ${Math.abs(v) > 500 ? t(sobe ? 'muito acima' : 'muito abaixo') : `${Math.abs(v)}%`}`, tom: sobe ? 'bom' : 'ruim' }
}

/** `neutro`: subir ou descer não é bom nem ruim (ex.: compras) → a variação fica cinza */
export function NumeroPainel({ c, sub, icone, neutro }: { c?: CartaoDados; sub?: string; icone?: string; neutro?: boolean }) {
  const t = useT()
  const { ir } = useApp()
  if (!c) return null
  const v = seloVariacao(t, c.valor, c.anterior)
  const variacao = v && neutro ? { texto: v.texto } : v
  const selos = [...(variacao ? [variacao] : []), ...(sub ? [{ texto: sub }] : [])]
  return (
    <NumeroGrande rotulo={c.nome} icone={icone} ajuda={c.ajuda} valor={fmt(c.valor, c.formato, c.moeda)} selos={selos}
      tom={c.destaque === 'ruim' ? 'ruim' : c.destaque === 'alerta' ? 'alerta' : undefined}
      onClick={c.detalhe ? () => ir(c.detalhe!.tela, c.detalhe!.filtro) : undefined} />
  )
}
