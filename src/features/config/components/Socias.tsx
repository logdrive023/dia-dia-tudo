// CONFIGURAÇÕES › Sócias: quem divide o lucro e em que parte.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { novoId } from '../../../core/domain/ids'
import type { Socio } from '../../../core/services/contexto'
import { Botao, Carregando, Cartao, Entrada, cx, loc } from '../../../shared/ui/base'
import { BarraSalvar } from '../../../shared/ui/barraSalvar'
import { useAvisoSaida, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'

export function Socias() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [socios, setSociosEst] = useState<Socio[]>()
  // a lista como estava quando começou a editar: outra aba mudou no meio → o servidor recusa em vez de gravar por cima
  const [antes, setAntes] = useState<Socio[]>()
  useAvisoSaida(socios !== undefined)
  if (!dados) return <Carregando />
  const lista = socios ?? dados.config.socios
  const setSocios = (l?: Socio[]) => (l && !socios && setAntes(dados.config.socios), setSociosEst(l))
  const soma = lista.reduce((s, x) => s + x.parteBp, 0)
  return (
    <div className="max-w-xl">
      <Cartao titulo={t('Divisão do lucro')} ajuda="O resultado do período é dividido pelas partes (ex.: 50% + 50% = o “÷ 2” do caderno).">
        <ul className="space-y-2">
          {lista.map((s, i) => (
            <li key={s.id} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
              <Entrada aria-label={t('Nome')} value={s.nome} onChange={(e) => setSocios(lista.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
              <Entrada aria-label="%" inputMode="decimal" value={String(s.parteBp / 100)} onChange={(e) => setSocios(lista.map((x, k) => (k === i ? { ...x, parteBp: Math.round(Number(e.target.value.replace(',', '.')) * 100) || 0 } : x)))} />
              <button type="button" className="min-h-11 min-w-11 rounded-lg text-xl" aria-label={t('Tirar')} onClick={() => setSocios(lista.filter((_, k) => k !== i))}>×</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Botao variante="secundario" onClick={() => setSocios([...lista, { id: novoId(), nome: '', parteBp: 0 }])}>+ {t('Sócia')}</Botao>
          <span className={cx('num text-sm', soma === 10000 ? 'text-[var(--suave)]' : 'font-semibold text-[var(--alerta)]')}>{t('Total')}: {(soma / 100).toLocaleString(loc())}%</span>
        </div>
      </Cartao>
      <BarraSalvar sujo={socios !== undefined}>
        {socios && <Botao variante="leve" onClick={() => setSocios(undefined)}>{t('Desfazer')}</Botao>}
        <Botao disabled={!socios || ocupado} onClick={async () => (await executar('salvarConfig', { socios, antes: { socios: antes ?? dados.config.socios } }, t('Salvo.'))) && setSocios(undefined)}>{t('Salvar')}</Botao>
      </BarraSalvar>
    </div>
  )
}
