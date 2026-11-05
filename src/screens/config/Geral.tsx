// CONFIGURAÇÕES › Geral: nome do negócio, idioma e o básico.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { Botao, Campo, Carregando, Cartao, Entrada } from '../../ui/base'
import { BarraSalvar } from '../../ui/barraSalvar'
import { useAvisoSaida, useComando, useConsulta } from '../../ui/contexto'
import { useT } from '../../ui/i18n'

export function Geral() {
  const t = useT()
  const { dados } = useConsulta('configuracoes', {})
  const { executar, ocupado } = useComando()
  const [nome, setNome] = useState<string>()
  const sujo = nome !== undefined && nome !== dados?.config.nomeNegocio
  useAvisoSaida(sujo)
  if (!dados) return <Carregando />
  const c = dados.config
  return (
    <div className="max-w-xl">
      <Cartao>
        <div className="space-y-4">
          <Campo rotulo="Nome do negócio"><Entrada value={nome ?? c.nomeNegocio} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="Idioma / Idioma" comoDiv>
            <div className="flex flex-wrap gap-2">
              {(['pt', 'es'] as const).map((i) => (
                <Botao key={i} variante={c.idioma === i ? 'primario' : 'secundario'} className="min-h-11" onClick={() => executar('salvarConfig', { idioma: i })}>{i === 'pt' ? '🇧🇷 Português' : '🇧🇴 Español'}</Botao>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--suave)]">{t('O idioma muda na hora, para todo o sistema.')}</p>
          </Campo>
          {/* COMPRA PAGA NO ATO (o normal): a nova compra já sai paga e concluída; desligado, ela fica em aberto */}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-[var(--fundo)] p-3">
            <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={c.compraPagaNoAto !== false} onChange={(e) => executar('salvarConfig', { compraPagaNoAto: e.target.checked }, t('Salvo.'))} />
            <span className="text-sm">
              <b className="block">{t('Compra paga no ato')}</b>
              <span className="text-[var(--suave)]">{t('Ligado (o normal): a nova compra já vem "Pago agora" e a aba Pagamento abre em "Pagar e concluir". Desligado: a compra fica em aberto e segue etapa por etapa (Chegou → Conferido → Pago → Concluído).')}</span>
            </span>
          </label>
          {/* venda de pacote BRUTO: nunca trava; aqui só se escolhe se aparece o aviso */}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-[var(--fundo)] p-3">
            <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={c.avisarVendaBruto !== false} onChange={(e) => executar('salvarConfig', { avisarVendaBruto: e.target.checked }, t('Salvo.'))} />
            <span className="text-sm">
              <b className="block">{t('Avisar ao vender pacote bruto')}</b>
              <span className="text-[var(--suave)]">{t('A venda passa sempre (nada trava). Ligado: o caixa mostra "ainda está bruto" para conferir o preço.')}</span>
            </span>
          </label>
        </div>
      </Cartao>
      <BarraSalvar sujo={sujo}>
        {sujo && <Botao variante="leve" onClick={() => setNome(undefined)}>{t('Desfazer')}</Botao>}
        <Botao disabled={ocupado || !sujo} onClick={() => executar('salvarConfig', { nomeNegocio: nome }, t('Salvo.'))}>{t('Salvar')}</Botao>
      </BarraSalvar>
    </div>
  )
}
