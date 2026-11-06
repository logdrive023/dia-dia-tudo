// CAIXA › ENCERRAR O DIA: conferir o dinheiro contado com o esperado e fechar o dia.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import { dataCurta } from '../../../core/domain/datas'
import type { MovCaixa } from '../../../core/domain/tipos'
import { Botao, Campo, Janela, ValorInput, cx, dataBR } from '../../../shared/ui/base'
import { useComando } from '../../../shared/ui/contexto'
import { linkWhatsApp, useCotacoes } from '../../../shared/ui/compartilhados'
import { useT } from '../../../shared/ui/i18n'

export function Encerrar({ data, contas, movimentos, onFechar }: { data: string; contas: { moeda: string; mao: number; total: number; banco: number; hoje: number }[]; movimentos: MovCaixa[]; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const { cfg } = useCotacoes()
  const [contado, setContado] = useState<Record<string, number | undefined>>({})
  const sujo = Object.values(contado).some((v) => v !== undefined)
  const fechar = () => (!sujo || window.confirm(t('Sair sem salvar?'))) && onFechar()
  const vendas = movimentos.filter((m) => m.tipo === 'venda')
  const texto = [
    `*${cfg?.nomeNegocio ?? ''} · ${dataBR(data)}*`,
    `${t('Vendas')}: ${vendas.length}`,
    ...contas.map((c) => `${c.moeda}: ${t('hoje')} ${formatar(c.hoje, c.moeda)} · ${t('total')} ${formatar(c.total, c.moeda)} (💵 ${formatar(c.mao, c.moeda)} · 🏦 ${formatar(c.banco, c.moeda)})${contado[c.moeda] !== undefined ? ` · ${t('contado')} ${formatar(contado[c.moeda]!, c.moeda)}` : ''}`),
  ].join('\n')
  return (
    <Janela
      aberta
      titulo={`${t('Encerrar o dia')} · ${dataCurta(data)}`}
      onFechar={fechar}
      rodape={
        <div className="flex flex-wrap gap-2">
          <a className="min-h-12 flex-1 rounded-xl bg-[#25d366] px-4 py-3 text-center font-semibold text-white" href={linkWhatsApp(texto)} target="_blank" rel="noreferrer">
            {t('Relatório no WhatsApp')}
          </a>
          <Botao grande className="flex-1" disabled={ocupado} onClick={async () => (await executar('encerrarDia', { data, contado: Object.fromEntries(Object.entries(contado).filter(([, v]) => v !== undefined)) as Record<string, number> }, t('Dia encerrado.'))) && onFechar()}>
            {t('Encerrar')}
          </Botao>
        </div>
      }
    >
      <div className="space-y-3">
        {contas.map((c) => (
          <Campo key={c.moeda} rotulo={`${t('Dinheiro vivo contado')} (${c.moeda})`} ajuda="Conte o dinheiro da gaveta e digite: o app diz se faltou ou sobrou.">
            <ValorInput moeda={c.moeda} valor={contado[c.moeda]} onChange={(v) => setContado({ ...contado, [c.moeda]: v })} />
            {contado[c.moeda] !== undefined && (
              <p className={cx('mt-1 text-sm font-semibold', contado[c.moeda] === c.mao ? 'text-[var(--bom)]' : 'text-[var(--alerta)]')}>
                {contado[c.moeda] === c.mao ? t('bateu ✓') : contado[c.moeda]! < c.mao ? t('faltam {v}', { v: formatar(c.mao - contado[c.moeda]!, c.moeda) }) : t('sobram {v}', { v: formatar(contado[c.moeda]! - c.mao, c.moeda) })}
              </p>
            )}
          </Campo>
        ))}
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--fundo)] p-3 font-sans text-sm">{texto}</pre>
      </div>
    </Janela>
  )
}
