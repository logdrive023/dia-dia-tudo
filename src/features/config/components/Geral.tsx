// CONFIGURAÇÕES › Geral: nome do negócio, idioma e o básico.
// Uma seção = um arquivo (a lista das seções e onde cada uma aparece fica em ../configSecoes.ts).
import { useState } from 'react'
import { Botao, Campo, Carregando, Cartao, Entrada, Selecao } from '../../../shared/ui/base'
import { BarraSalvar } from '../../../shared/ui/barraSalvar'
import { useAvisoSaida, useComando, useConsulta } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { MODELOS_DOCUMENTO } from '../../../core/dados/documentos'
import { PAISES_FERIADO, type PaisFeriado } from '../../../core/dados/feriados'

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
      {/* FERIADOS DA AGENDA: o país (nacionais) e a região (departamento/estado) — só informativo, não trava nada */}
      <Cartao titulo={`🗓 ${t('Feriados da agenda')}`} className="mt-4" ajuda="De que país e de que região são os feriados que aparecem na Agenda. Só informativo: o feriado não bloqueia vendas, compras nem triagens. Ex.: Bolívia · La Paz mostra os nacionais e o 16 de julho.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="País">
            <Selecao valor={c.feriadosPais} vazio="Sem feriados"
              onChange={(v) => { const p = v as PaisFeriado | ''; executar('salvarConfig', { feriadosPais: p, feriadosRegiao: p && PAISES_FERIADO[p].regioes.some((r) => r.id === c.feriadosRegiao) ? c.feriadosRegiao : '' }, t('Salvo.')) }}
              opcoes={(Object.keys(PAISES_FERIADO) as PaisFeriado[]).map((p) => ({ id: p, nome: t(PAISES_FERIADO[p].nome) }))} />
          </Campo>
          {c.feriadosPais && (PAISES_FERIADO[c.feriadosPais].regioes.length ? (
            <Campo rotulo={PAISES_FERIADO[c.feriadosPais].tipoRegiao}>
              <Selecao valor={c.feriadosRegiao} vazio="Só os nacionais" onChange={(v) => executar('salvarConfig', { feriadosRegiao: v }, t('Salvo.'))}
                opcoes={PAISES_FERIADO[c.feriadosPais].regioes.map((r) => ({ id: r.id, nome: r.nome }))} />
            </Campo>
          ) : <p className="self-end text-xs text-[var(--suave)]">{t('Por enquanto só os feriados nacionais deste país.')}</p>)}
        </div>
      </Cartao>
      {/* NOTA DE VENTA: o padrão de toda nota (na venda dá para mudar só naquela impressão) */}
      <Cartao titulo={t('Nota de venda')} className="mt-4" ajuda="O documento da venda (aba Resumo da venda): o papel que sai por padrão e se mostra o detalhe dos impostos. Na venda dá para trocar só naquela impressão.">
        <div className="space-y-3">
          <Campo rotulo="Papel padrão" comoDiv>
            <div className="flex flex-wrap gap-2">
              {Object.values(MODELOS_DOCUMENTO).map((m) => (
                <Botao key={m.id} variante={(c.modeloNota ?? 'carta') === m.id ? 'primario' : 'secundario'} className="min-h-11" onClick={() => executar('salvarConfig', { modeloNota: m.id }, t('Salvo.'))}>{m.formato === 'rollo' ? '🧾' : '📄'} {t(m.nome)}</Botao>
              ))}
            </div>
          </Campo>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-[var(--fundo)] p-3">
            <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={c.impostosNaNota !== false} onChange={(e) => executar('salvarConfig', { impostosNaNota: e.target.checked }, t('Salvo.'))} />
            <span className="text-sm">
              <b className="block">{t('Exibir detalhamento de impostos nas notas impressas')}</b>
              <span className="text-[var(--suave)]">{t('Ligado: a nota mostra os impostos estimados (ex.: IVA 13% e IT 3% dentro do preço). Desligado: não mostra. O total da venda é o mesmo nos dois casos.')}</span>
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
