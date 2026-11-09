// CAIXA › VER EM OUTRA MOEDA (dentro do ⚙): escolhe a moeda da visão e a cotação, só para ver.
import { moeda as moedaDe } from '../../../core/domain/dinheiro'
import { Escolha } from '../../../shared/ui/base'
import { CampoCotacao } from '../../../shared/ui/compartilhados'
import { GrupoFiltro, PainelFiltros } from '../../../shared/ui/filtroPadrao'
import { useT } from '../../../shared/ui/i18n'
import type { VisaoCaixa } from '../hooks/useVisaoCaixa'

export function VerEmMoeda({ visao, onFechar }: { visao: VisaoCaixa; onFechar(): void }) {
  const t = useT()
  const { moedasVer, ver, principal, envolvidas, textos, digitadas, sistema, digitar, voltarSistema, escolher } = visao
  return (
    <PainelFiltros temAtivos={ver !== principal} onLimpar={() => escolher(principal)} onFechar={onFechar}>
      <GrupoFiltro titulo="Ver em" icone="💱">
        <Escolha rotulo="Ver em" valor={ver} onChange={escolher} opcoes={moedasVer.map((m) => ({ id: m, nome: moedaDe(m).simbolo }))} />
        {envolvidas.map((m) => (
          <div key={m} className="flex flex-wrap items-center gap-1">
            <CampoCotacao moeda={m} principal={principal} texto={textos[m]} onChange={(x) => digitar(m, x)} />
            {digitadas[m] !== undefined && digitadas[m] !== sistema(m) && sistema(m) && (
              <button type="button" className="min-h-10 px-1 text-xs text-[var(--marca)] underline" onClick={() => voltarSistema(m)} title={t('Usar a cotação do sistema')}>↺ {sistema(m)}</button>
            )}
          </div>
        ))}
        <p className="text-xs text-[var(--suave)]">{t('Só para ver: os lançamentos continuam na moeda deles.')}</p>
      </GrupoFiltro>
    </PainelFiltros>
  )
}
