// ESTADOS FINANCIEROS (tela) — "simples por fora, completo por dentro":
//   cabeçalho (empresa · NIT · regime · período · moeda) · os 4 números · o Estado de Resultados e o Balance lado a
//   lado · impostos e conferência · os ANEXOS (cada centavo), cada um abre no lugar. "ver ›" numa linha leva ao anexo.
//   🖨 Vista previa → a impressão em A4 (Impressao.tsx). Padrão 🇧🇴 (motor) ou 🇧🇷, escolhido aqui ou nas Configurações.
import { useState } from 'react'
import { Botao, Carregando, Cartao, Escolha, ErroTela, cx, dataBR } from '../../ui/base'
import { useApp, useConsulta, useParamTela } from '../../ui/contexto'
import { useT } from '../../ui/i18n'
import { GrupoNumeros, NumeroGrande } from '../../ui/numeroGrande'
import { ConteudoSecao, type IdSecao, SECOES, tituloSecao } from './conteudo'
import { Impressao } from './Impressao'
import { TEXTO, valorContabil } from './pecas'

export function EstadosFinanceiros({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { ir } = useApp()
  const { dados: cfg } = useConsulta('configuracoes', {})
  const [padrao, setPadrao] = useParamTela<'' | 'BO' | 'BR'>('padrao', '')
  const pais = (padrao || cfg?.config.fiscal.pais || 'BO') as 'BO' | 'BR'
  const { dados: rel, erro } = useConsulta('relatorioContabil', { de, ate, padrao: pais })
  const [abertos, setAbertos] = useState<Set<IdSecao>>(new Set())
  const [imprimir, setImprimir] = useState(false)
  if (erro) return <ErroTela texto={erro} />
  if (!rel) return <Carregando />
  const x = TEXTO[pais]
  const v = (n: number) => `${rel.moeda === 'BOB' ? 'Bs' : rel.moeda} ${valorContabil(n, pais)}`
  const irAnexo = (id: string) => {
    setAbertos((s) => new Set([...s, id as IdSecao]))
    setTimeout(() => document.getElementById(`anexo-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const confere = rel.conferencia.every((c) => c.ok)
  return (
    <div className="space-y-4">
      {/* o padrão e a impressão */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-max"><Escolha<'BO' | 'BR'> rotulo="Padrão" valor={pais} onChange={setPadrao} opcoes={[{ id: 'BO', nome: 'Bolivia' }, { id: 'BR', nome: 'Brasil' }]} /></div>
        <button type="button" onClick={() => ir('configSecao', { id: 'fiscal' })} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">⚙️ {t('Fiscal e relatórios')}</button>
        <Botao className="ml-auto" onClick={() => setImprimir(true)}>🖨 {t('Vista previa e imprimir')}</Botao>
      </div>

      {/* o cabeçalho de estado financeiro */}
      <header className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-center shadow-sm">
        <p className="text-lg font-black uppercase tracking-wide">{rel.empresa.nome}</p>
        <p className="text-xs text-[var(--suave)]">{[rel.empresa.nit && `${x.nit} ${rel.empresa.nit}`, rel.empresa.atividade, rel.empresa.endereco].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 text-base font-bold">{rel.titulo}</p>
        <p className="text-sm">{x.periodo.replace('{de}', dataBR(rel.de)).replace('{ate}', dataBR(rel.ate))} · {x.expresado(rel.moeda)}</p>
        <p className="mt-1 text-xs text-[var(--suave)]">{x.regime}: {rel.regimeNome}</p>
        {!rel.empresa.nit && <p className="nao-imprimir mt-2 text-xs text-[var(--alerta)]">⚠ {t('Sem NIT no cabeçalho: ponha em Configurações › Fiscal e relatórios.')}</p>}
      </header>

      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo={pais === 'BO' ? 'Ventas' : 'Receita'} icone="💰" cor="var(--marca)" valor={v(rel.numeros.receita)} selos={[{ texto: t('{n} venda(s)', { n: rel.numeros.vendas }) }]} />
        <NumeroGrande rotulo={pais === 'BO' ? 'Utilidad bruta' : 'Lucro bruto'} icone="📈" cor="var(--bom)" valor={v(rel.numeros.lucroBruto)} />
        <NumeroGrande rotulo={pais === 'BO' ? 'Impuestos' : 'Impostos'} icone="🧾" cor="var(--alerta)" valor={v(rel.numeros.impostos)} />
        <NumeroGrande rotulo={pais === 'BO' ? 'Utilidad neta' : 'Lucro líquido'} icone="🏁" cor={rel.numeros.resultado < 0 ? 'var(--ruim)' : 'var(--bom)'} colorirValor valor={v(rel.numeros.resultado)} selos={[{ texto: confere ? `✓ ${x.conferencia}` : `⚠ ${x.conferencia}`, tom: confere ? 'bom' : 'ruim' }]} />
      </GrupoNumeros>

      {/* o resumo: resultado e balanço lado a lado; impostos e conferência embaixo */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(['resultado', 'balanco', 'impostos', 'conferencia'] as const).map((id) => (
          <Cartao key={id} titulo={`${SECOES.find((s) => s.id === id)!.icone} ${tituloSecao(id, rel)}`}>
            <ConteudoSecao id={id} rel={rel} onAnexo={irAnexo} />
          </Cartao>
        ))}
      </div>

      {/* os anexos: cada centavo */}
      <section aria-label={x.anexos}>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--suave)]">{x.anexos}</h2>
        <div className="space-y-2">
          {SECOES.filter((s) => s.anexo).map((s) => {
            const aberto = abertos.has(s.id)
            return (
              <div key={s.id} id={`anexo-${s.id}`} className="scroll-mt-4 overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
                <button type="button" aria-expanded={aberto} onClick={() => setAbertos((a) => { const n = new Set(a); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })} className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-semibold hover:bg-[var(--fundo)]">
                  <span aria-hidden>{s.icone}</span><span className="flex-1">{tituloSecao(s.id, rel)}</span>
                  <span aria-hidden className={cx('text-[var(--suave)] transition-transform', aberto && 'rotate-90')}>›</span>
                </button>
                {aberto && <div className="border-t border-[var(--borda)] p-3"><ConteudoSecao id={s.id} rel={rel} /></div>}
              </div>
            )
          })}
        </div>
      </section>

      {imprimir && <Impressao rel={rel} onFechar={() => setImprimir(false)} />}
    </div>
  )
}
