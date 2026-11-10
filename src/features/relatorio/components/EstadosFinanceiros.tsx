// ESTADOS FINANCIEROS (tela) — "simples por fora, completo por dentro", em camadas (o padrão de components/resumo):
//   1 EM RESUMO     a frase do período: quanto vendeu, quanto sobrou (ou faltou) e o que mais pesou
//   2 OS NÚMEROS    ventas · utilidad bruta · impuestos · utilidad neta (com a conferência)
//   3 A CASCATA     "para onde foi o dinheiro": das vendas ao resultado; cada grupo abre com as contas e "ver ›"
//   4 O CONTÁBIL    Estado de Resultados (formato contábil), Balance, Impuestos e Conferencia — cada um abre no lugar
//                   e já diz o principal no título; depois os ANEXOS (cada centavo)
//   🖨 Vista previa → a impressão em A4 (Impressao.tsx), com tudo aberto. Padrão 🇧🇴 (motor) ou 🇧🇷.
import { useState } from 'react'
import { Botao, Carregando, Escolha, ErroTela, dataBR } from '../../../shared/ui/base'
import { useApp, useConsulta, useParamTela } from '../../../shared/ui/contexto'
import { useT } from '../../../shared/ui/i18n'
import { NotaTela } from '../../../shared/ui/notaTela'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { maioresSaidas, montarCascata } from '../model/cascata'
import { ConteudoSecao, type IdSecao, SECOES, tituloSecao } from './conteudo'
import { Impressao } from './Impressao'
import { TEXTO, valorContabil } from './pecas'
import { BlocoRelatorio, CascataResultado, EmResumo } from './resumo'

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
  const alternar = (id: IdSecao) => setAbertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const irAnexo = (id: string) => {
    setAbertos((s) => new Set([...s, id as IdSecao]))
    setTimeout(() => document.getElementById(`anexo-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const confere = rel.conferencia.every((c) => c.ok)
  const n = rel.numeros
  const cascata = montarCascata(rel.resultados)
  const pesou = cascata ? maioresSaidas(cascata) : []
  const sobrou = n.resultado >= 0

  // camada 1: o período EM LISTA, para leigos — o que vendeu, o que saiu, o que sobrou e o que mais pesou
  const saiu = n.receita - n.resultado
  const semVenda = !n.vendas && !n.receita
  const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const nAnexos = SECOES.filter((y) => y.anexo).length

  // camada 4: cada parte contábil já diz o principal no título
  const resumoDe: Partial<Record<IdSecao, string>> = {
    resultado: `${x.periodo.replace('{de}', dataBR(rel.de)).replace('{ate}', dataBR(rel.ate))} · ${v(n.resultado)}`,
    balanco: `${x.totalActivo} ${v(rel.balanco.totalAtivo)} · ${x.totalPasivo} ${v(rel.balanco.totalPassivo)}`,
    impostos: `${x.carga} ${v(rel.resumoImpostos.total)}`,
    conferencia: confere ? `✓ ${x.ok}` : `⚠ ${rel.conferencia.filter((c) => !c.ok).length} ${x.dif}`,
  }
  const blocoSecao = (id: IdSecao, prefixo = '') => {
    const s = SECOES.find((y) => y.id === id)!
    return (
      <BlocoRelatorio key={id} id={`${prefixo}${id}`} icone={s.icone} titulo={tituloSecao(id, rel)} resumo={resumoDe[id]} aberto={abertos.has(id)} onAlternar={() => alternar(id)}>
        <ConteudoSecao id={id} rel={rel} onAnexo={irAnexo} />
      </BlocoRelatorio>
    )
  }
  return (
    <div className="space-y-4">
      {/* o padrão e a impressão */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-max"><Escolha<'BO' | 'BR'> rotulo="Padrão" valor={pais} onChange={setPadrao} opcoes={[{ id: 'BO', nome: 'Bolivia' }, { id: 'BR', nome: 'Brasil' }]} /></div>
        <button type="button" onClick={() => ir('configSecao', { id: 'fiscal' })} className="min-h-10 toque:min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">⚙️ {t('Fiscal e relatórios')}</button>
        <Botao className="ml-auto" onClick={() => setImprimir(true)}>🖨 {t('Vista previa e imprimir')}</Botao>
      </div>

      {/* a identidade do documento, numa linha (completa na impressão) */}
      <p className="text-center text-xs text-[var(--suave)]">
        <b className="text-[var(--texto)]">{rel.empresa.nome}</b>{rel.empresa.nit ? ` · ${x.nit} ${rel.empresa.nit}` : ''} · {rel.titulo} · {x.expresado(rel.moeda)} · {x.regime}: {rel.regimeNome}
        {!rel.empresa.nit && <span className="nao-imprimir mt-0.5 block text-[var(--alerta)]">⚠ {t('Sem NIT no cabeçalho: ponha em Configurações › Fiscal e relatórios.')}</span>}
      </p>

      <EmResumo tom={n.resultado < 0 ? 'ruim' : 'bom'}
        itens={[
          { icone: '📅', texto: t('De {de} a {ate}', { de: dataBR(rel.de), ate: dataBR(rel.ate) }), sub: t('o período escolhido') },
          { icone: '💰', texto: t('Você vendeu'), sub: semVenda ? t('nenhuma venda no período') : t('{n} venda(s)', { n: n.vendas }), valor: v(n.receita), tom: 'bom' },
          !semVenda && { icone: '📉', texto: t('Custos, despesas e impostos'), sub: t('tudo o que saiu para chegar no resultado'), valor: v(-saiu), tom: 'ruim' },
          !semVenda && { icone: '🏁', texto: t(sobrou ? 'Sobraram' : 'Faltaram'), sub: t(sobrou ? 'o lucro do período' : 'saiu mais do que entrou'), valor: v(Math.abs(n.resultado)), tom: sobrou ? 'bom' : 'ruim', destaque: true },
          pesou.length > 0 && { icone: '⚖️', texto: t('O que mais pesou'), barras: pesou.map((p) => ({ rotulo: t(p.rotulo), valor: v(-p.valor), pct: n.receita > 0 ? Math.min(100, Math.round((-p.valor / Math.max(n.receita, saiu)) * 100)) : 0 })) },
        ]}
        rodape={[confere ? `✓ ${x.conferencia}` : `⚠ ${x.conferencia}`, n.impostos ? `🧾 ${t(pais === 'BO' ? 'Impuestos' : 'Impostos')} ${v(n.impostos)}` : '']}
        mais={{ texto: t('Ver de onde veio cada centavo ({n} anexos)', { n: nAnexos }), onClick: () => irPara('cascata') }} />

      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo={pais === 'BO' ? 'Ventas' : 'Receita'} icone="💰" cor="var(--marca)" valor={v(n.receita)} selos={[{ texto: t('{n} venda(s)', { n: n.vendas }) }]} onClick={() => irAnexo('vendas')} />
        <NumeroGrande rotulo={pais === 'BO' ? 'Utilidad bruta' : 'Lucro bruto'} icone="📈" cor="var(--bom)" valor={v(n.lucroBruto)} ajuda="Vendas menos impostos sobre vendas, custo do que foi vendido, insumos e comissões." />
        <NumeroGrande rotulo={pais === 'BO' ? 'Impuestos' : 'Impostos'} icone="🧾" cor="var(--alerta)" valor={v(n.impostos)} onClick={() => alternar('impostos')} ativo={abertos.has('impostos')} />
        <NumeroGrande rotulo={pais === 'BO' ? 'Utilidad neta' : 'Lucro líquido'} icone="🏁" cor={n.resultado < 0 ? 'var(--ruim)' : 'var(--bom)'} colorirValor valor={v(n.resultado)} selos={[{ texto: confere ? `✓ ${x.conferencia}` : `⚠ ${x.conferencia}`, tom: confere ? 'bom' : 'ruim' }]} />
      </GrupoNumeros>

      {cascata && <div id="cascata" className="scroll-mt-4"><CascataResultado cascata={cascata} v={v} onAnexo={irAnexo} /></div>}

      {/* o contábil: cada parte abre no lugar */}
      <section aria-label={t('Formato contábil')} className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--suave)]">📑 {t('Formato contábil')}</h2>
        {pais === 'BO' && <NotaTela icone="🇧🇴">{t('Na ordem das normas bolivianas: o IVA sai das vendas (o preço já inclui IVA), o IT 3% é gasto e o IUE é 25% da utilidade. Para o SIN, o contador entrega por ano o Formulario 500 (IUE) e o 605 (estados financieros), até 120 dias depois do cierre — com o Balance, o Estado de Resultados e as notas.')}</NotaTela>}
        <NotaTela icone="🧾">{t('Impostos oficiais: IVA e IT (e o IUE, anual). As taxas e os impostos que você cadastrar vêm de Configurações › Fiscal › Impostos — os cadastrados aparecem com o selo “📝 cadastro”.')} <button type="button" onClick={() => ir('configSecao', { id: 'fiscal' })} className="alvo-amplo font-semibold text-[var(--marca)] underline-offset-2 hover:underline">{t('Ver impostos')} ›</button></NotaTela>
        {(['resultado', 'balanco', 'impostos', 'conferencia'] as const).map((id) => blocoSecao(id))}
      </section>

      {/* os anexos: cada centavo */}
      <section aria-label={x.anexos} className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--suave)]">📎 {x.anexos}</h2>
        {SECOES.filter((s) => s.anexo).map((s) => blocoSecao(s.id, 'anexo-'))}
      </section>

      {imprimir && <Impressao rel={rel} onFechar={() => setImprimir(false)} />}
    </div>
  )
}
