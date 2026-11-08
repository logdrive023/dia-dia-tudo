// VIAGENS › ADIANTAMENTO: dar dinheiro para a viagem (quem, quanto, em que moeda).
import { useState } from 'react'
import { formasEmUso } from '../../../core/domain/formas'
import { formatar } from '../../../core/domain/dinheiro'
import { novoId } from '../../../core/domain/ids'
import type { Id } from '../../../core/domain/tipos'
import { Botao, Campo, Entrada, Janela, Selecao, ValorInput, moedaPadrao } from '../../../shared/ui/base'
import { useComando } from '../../../shared/ui/contexto'
import { useCotacoes } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'

export function FormAdiantamento({ viagemId, onFechar }: { viagemId: Id; onFechar(): void }) {
  const t = useT()
  const { cfg } = useCotacoes()
  const { executar, ocupado } = useComando()
  const [id] = useState(() => novoId())
  const [moedaEscolhida, setMoeda] = useState<string>()
  const moeda = moedaEscolhida ?? cfg?.moedaPrincipal ?? moedaPadrao()
  const [valor, setValor] = useState<number>()
  const [forma, setForma] = useState('dinheiro')
  const [obs, setObs] = useState('')
  return (
    <Janela aberta titulo={t('Adiantamento para a viagem')} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || !valor} onClick={async () => {
        const r = await executar('adiantarViagem', { id, viagemId, moeda, forma, valor: valor!, obs }, t('Adiantamento registrado.'))
        if (r) onFechar()
      }}>{t('Dar adiantamento')} {valor ? formatar(valor, moeda) : ''}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-sm text-[var(--suave)]">{t('Sai do caixa da loja hoje e vai para a carteira da viagem.')}</p>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Selecao valor={moeda} onChange={setMoeda} opcoes={(cfg?.moedasAtivas ?? [moeda]).map((x) => ({ id: x, nome: x }))} />
          <ValorInput moeda={moeda} valor={valor} onChange={setValor} />
        </div>
        <Campo rotulo="Saiu do caixa como"><Selecao valor={forma} onChange={setForma} opcoes={formasEmUso(cfg?.formas, moeda).map((f) => ({ id: f.id, nome: t(f.nome) }))} /></Campo>
        <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
    </Janela>
  )
}
