// CAIXA › RESUMO: os 4 números do dia (quanto tem, onde está e o que mudou). A conta completa fica em DetalhesDia.
import type { MovCaixa } from '../../../core/domain/tipos'
import { useT } from '../../../shared/ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import type { VisaoCaixa } from '../hooks/useVisaoCaixa'
import { entrouSaiu } from '../model/caixaDia'

export function ResumoCaixa({ visao, movimentos }: { visao: VisaoCaixa; movimentos: MovCaixa[] }) {
  const t = useT()
  const { somar, mostrar, converter } = visao
  const total = somar((c) => c.total)
  const ontem = somar((c) => c.ontemMao + c.ontemBanco)
  const hoje = somar((c) => c.hoje)
  const { entrou, saiu } = entrouSaiu(movimentos, converter)
  return (
    <GrupoNumeros colunas={4}>
      <NumeroGrande rotulo="Tem agora" icone="💰" cor="var(--marca)" valor={<span data-testid="saldo-total">{total === undefined ? t('Digite a cotação') : mostrar(total)}</span>} selos={[{ texto: `${t('Ontem')} ${mostrar(ontem)}` }]} ajuda="O que veio de ontem mais o que mudou neste dia. Ex.: 200 + (−150) = 50." />
      <NumeroGrande rotulo="Na mão" icone="💵" valor={mostrar(somar((c) => c.mao))} ajuda="Dinheiro vivo: é o que você conta na gaveta ao fechar o dia." />
      <NumeroGrande rotulo="No banco" icone="🏦" valor={mostrar(somar((c) => c.banco))} ajuda="O que entrou por Pix, QR, cartão ou transferência." />
      <NumeroGrande rotulo="Neste dia" icone="📅" tom={(hoje ?? 0) < 0 ? 'ruim' : undefined} valor={`${(hoje ?? 0) > 0 ? '+' : ''}${mostrar(hoje)}`} selos={[{ texto: `${t('Entrou')} ${mostrar(entrou)}`, tom: 'bom' }, { texto: `${t('Saiu')} ${mostrar(saiu)}`, tom: 'ruim' }]} />
    </GrupoNumeros>
  )
}
