// RELATÓRIOS › DIVISÃO ENTRE SÓCIAS e SERVIÇOS: RECEITA × INSUMOS — o mesmo padrão das outras telas:
// números grandes em cima (GrupoNumeros), o detalhe embaixo no jeito de demonstrativo (valor contábil, % da receita,
// subtotais com linha) e a planilha no "Baixar planilha". Os números saem das MESMAS consultas do relatório contábil
// (dre, servicosReceitaInsumos): o resultado aqui é o mesmo dos Estados financeiros do período.
import { useState } from 'react'
import { formatar } from '../../../core/domain/dinheiro'
import type { ResultadoConsulta } from '../../../core/services'
import { Botao, Carregando, Escolha, Info, Vazio, cx } from '../../../shared/ui/base'
import { baixarCSV } from '../../../shared/ui/csv'
import { useConsulta } from '../../../shared/ui/contexto'
import { GrupoNumeros, NumeroGrande } from '../../../shared/ui/numeroGrande'
import { TabelaDados } from '../../../shared/ui/tabelaDados'
import { useT } from '../../../shared/ui/i18n'
import { maioresSaidas, montarCascata } from '../model/cascata'
import { CascataResultado, EmResumo } from './resumo'

const contabil = (n: number, m: string) => (n < 0 ? `(${formatar(-n, m)})` : formatar(n, m))
const pctTexto = (v: number, base: number) => (base ? `${(Math.round((v * 1000) / base) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—')

/** cartão de seção com título, ⓘ e a ação à direita (o mesmo desenho do estado de resultado da venda) */
function Secao({ titulo, sub, ajuda, acao, children }: { titulo: string; sub?: string; ajuda?: string; acao?: React.ReactNode; children: React.ReactNode }) {
  const t = useT()
  return (
    <section aria-label={t(titulo)} className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--borda)] px-4 py-3">
        <b>{t(titulo)}</b>{sub && <span className="text-xs text-[var(--suave)]">{t(sub)}</span>}{ajuda && <Info texto={ajuda} />}
        {acao && <span className="ml-auto">{acao}</span>}
      </div>
      {children}
    </section>
  )
}

export function DivisaoSocias({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados: d } = useConsulta('dre', { de, ate })
  if (!d) return <Carregando />
  const m = d.moeda
  const retirado = d.socios.reduce((s, x) => s + x.retirou, 0)
  const falta = d.socios.reduce((s, x) => s + x.falta, 0)
  const cascata = montarCascata(d.linhas.map((l, k) => ({ id: `l${k}`, rotulo: l.conta, valor: l.valor, tipo: k > 0 && l.nivel === 0 ? (k === d.linhas.length - 1 ? 'total' : 'subtotal') : 'conta', ajuda: l.ajuda })))
  const pesou = cascata ? maioresSaidas(cascata, 2) : []
  return (
    <div className="space-y-4">
      <EmResumo tom={d.resultado < 0 ? 'ruim' : 'bom'}
        frase={<>{t(d.resultado < 0 ? 'O período fechou no negativo:' : 'O resultado do período foi')} <b className="num">{contabil(d.resultado, m)}</b>.{d.socios.length > 0 && <> {d.socios.map((x, k) => <span key={x.id}>{k ? ' · ' : ''}<b>{x.nome}</b> {x.falta < 0 ? t('retirou a mais') : t('tem a receber')} <span className="num">{formatar(Math.abs(x.falta), m)}</span></span>)}.</>}</>}
        fatos={pesou.map((x) => `${t('Pesou')}: ${t(x.rotulo)} ${formatar(-x.valor, m)}`)} />
      <GrupoNumeros colunas={3}>
        <NumeroGrande rotulo="Resultado do período" icone="📈" valor={contabil(d.resultado, m)} tom={d.resultado < 0 ? 'ruim' : 'bom'} selos={[{ texto: t('{n} venda(s)', { n: d.vendas }) }, { texto: `${t('margem')} ${(d.margem / 100).toLocaleString()}%` }]} ajuda="O mesmo resultado dos Estados financeiros: lucro bruto − gastos do período." />
        <NumeroGrande rotulo="Já retirado pelas sócias" icone="👛" valor={formatar(retirado, m)} ajuda="Retiradas registradas no caixa (tipo retirada de sócia) no período." />
        <NumeroGrande rotulo="Falta acertar" icone="⚖️" valor={contabil(falta, m)} tom={falta < 0 ? 'ruim' : falta > 0 ? 'alerta' : undefined} ajuda="Parte de cada uma no resultado − o que já retirou. Negativo: retiraram mais do que o resultado." />
      </GrupoNumeros>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* O RESULTADO em cascata: do faturado ao resultado (o demonstrativo, conta por conta, abre em cada grupo) */}
        <div className="space-y-2">
          {cascata && <CascataResultado cascata={cascata} v={(n) => contabil(n, m)} titulo="Do faturado ao resultado" />}
          <Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV('resultado', d.linhas.map((l) => ({ conta: l.conta, valor: l.valor / 100 })))}>📥 {t('Baixar planilha')}</Botao>
        </div>

        {/* CADA SÓCIA: a parte, o que retirou (barra) e o que falta acertar */}
        <Secao titulo="Divisão entre sócias" sub="parte × retirado" ajuda="Resultado × parte de cada uma − o que já retirou = quanto falta acertar (o “÷ 2” do caderno). As partes vêm de Configurações › Sócias.">
          {!d.socios.length ? <div className="p-4"><Vazio texto="Cadastre as sócias em Configurações." /></div> : (
            <ul className="divide-y divide-[var(--borda)]">
              {d.socios.map((s) => {
                const usado = s.parte > 0 ? Math.min(100, Math.max(0, (s.retirou / s.parte) * 100)) : s.retirou > 0 ? 100 : 0
                return (
                  <li key={s.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <b>{s.nome} <span className="text-xs font-semibold text-[var(--suave)]">· {(s.parteBp / 100).toLocaleString()}%</span></b>
                      <span className={cx('num text-base font-black', s.falta < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{s.falta < 0 ? `${t('retirou a mais')} ${formatar(-s.falta, m)}` : `${t('a receber')} ${formatar(s.falta, m)}`}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--fundo)]" role="img" aria-label={`${t('retirado')} ${Math.round(usado)}%`}>
                      <div className={cx('h-full rounded-full', s.retirou > s.parte ? 'bg-[var(--ruim)]' : 'bg-[var(--marca)]')} style={{ width: `${usado}%` }} />
                    </div>
                    <dl className="num grid grid-cols-2 gap-x-4 text-xs text-[var(--suave)]">
                      <div className="flex justify-between gap-2"><dt>{t('Parte no resultado')}</dt><dd className="font-semibold text-[var(--texto)]">{contabil(s.parte, m)}</dd></div>
                      <div className="flex justify-between gap-2"><dt>{t('Já retirou')}</dt><dd className="font-semibold text-[var(--texto)]">{formatar(s.retirou, m)}</dd></div>
                    </dl>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  )
}

type Servicos = NonNullable<ResultadoConsulta<'servicosReceitaInsumos'>>
type LinhaServ = Servicos['porServico'][number]

export function ServicosInsumos({ de, ate }: { de: string; ate: string }) {
  const t = useT()
  const { dados } = useConsulta('servicosReceitaInsumos', { de, ate })
  const [por, setPor] = useState<'tipo' | 'servico'>('tipo')
  if (!dados) return <Carregando />
  const m = dados.moeda
  const tot = dados.total
  const linhas = por === 'tipo' ? dados.porCategoria : dados.porServico
  const v = (n: number) => formatar(n, m)
  const melhor = [...dados.porCategoria].sort((a, b) => b.margem - a.margem)[0]
  return (
    <div className="space-y-4">
      <EmResumo tom={tot.margem < 0 ? 'ruim' : 'bom'}
        frase={!tot.n ? t('Nenhum serviço feito no período.') : <>{t('Os serviços renderam')} <b className="num">{v(tot.receita)}</b> ({t('{n} feito(s)', { n: tot.n })}). {t('Insumos levaram {a} e comissões {b}; ficou para o salão', { a: pctTexto(tot.insumos, tot.receita), b: pctTexto(tot.comissao, tot.receita) })} <b className={cx('num', tot.margem < 0 ? 'text-[var(--ruim)]' : 'text-[var(--bom)]')}>{contabil(tot.margem, m)}</b> ({pctTexto(tot.margem, tot.receita)}).</>}
        fatos={melhor && tot.n ? [`🏆 ${t('Mais rendeu')}: ${t(melhor.nome)} ${contabil(melhor.margem, m)}`] : undefined} />
      <GrupoNumeros colunas={4}>
        <NumeroGrande rotulo="Receita dos serviços" icone="✂️" valor={v(tot.receita)} selos={[{ texto: t('{n} feito(s)', { n: tot.n }) }]} />
        <NumeroGrande rotulo="Insumos" icone="🧴" valor={contabil(-tot.insumos, m)} ajuda="Tinta, água oxigenada e o que o serviço gasta: custo do salão, sai ANTES da comissão." selos={[{ texto: pctTexto(tot.insumos, tot.receita) }]} />
        <NumeroGrande rotulo="Comissões" icone="🤝" valor={contabil(-tot.comissao, m)} ajuda="A parte das profissionais (sobre a receita menos os insumos)." selos={[{ texto: pctTexto(tot.comissao, tot.receita) }]} />
        <NumeroGrande rotulo="Margem do salão" icone="🏠" valor={contabil(tot.margem, m)} tom={tot.margem < 0 ? 'ruim' : 'bom'} ajuda="Receita − insumos − comissão: o que fica para o salão." selos={[{ texto: pctTexto(tot.margem, tot.receita), tom: 'bom' }]} />
      </GrupoNumeros>

      <Secao titulo={por === 'tipo' ? 'Por tipo de serviço' : 'Por serviço'} ajuda="Insumos (tinta, água oxigenada…) são custo do salão e saem antes da comissão. Margem do salão = receita − insumos − comissão."
        acao={<span className="flex flex-wrap items-center gap-2">
          <span className="[&_button]:whitespace-nowrap"><Escolha rotulo="Agrupar por" valor={por} onChange={(x) => setPor(x as typeof por)} opcoes={[{ id: 'tipo', nome: 'Tipo' }, { id: 'servico', nome: 'Serviço' }]} /></span>
          <Botao variante="leve" className="nao-imprimir" onClick={() => baixarCSV(por === 'tipo' ? 'servicos-por-tipo' : 'servicos-receita-insumos', linhas.map((l) => ({ nome: l.nome, tipo: l.categoria, feitos: l.n, receita: l.receita / 100, insumos: l.insumos / 100, comissao: l.comissao / 100, margem_salao: l.margem / 100 })))}>📥 {t('Baixar planilha')}</Botao>
        </span>}>
        {!linhas.length ? <div className="p-4"><Vazio texto="Nenhum serviço no período." /></div> : (
          <div className="p-2 sm:p-3">
            <TabelaDados<LinhaServ>
              linhas={[...linhas]}
              chave={(l) => `${l.categoria}|${l.nome}`}
              colunas={[
                { id: 'nome', titulo: por === 'tipo' ? 'Tipo' : 'Serviço', classe: 'w-full', celula: (l) => <span className="font-semibold">{t(l.nome)}{por === 'servico' && l.categoria ? <span className="block text-xs font-normal text-[var(--suave)]">{t(l.categoria)}</span> : null}</span> },
                { id: 'n', titulo: 'Feitos', direita: true, celula: (l) => l.n },
                { id: 'receita', titulo: 'Receita', direita: true, classe: 'whitespace-nowrap', celula: (l) => v(l.receita) },
                { id: 'insumos', titulo: 'Insumos', direita: true, classe: 'whitespace-nowrap text-[var(--suave)]', celula: (l) => (l.insumos ? contabil(-l.insumos, m) : '—') },
                { id: 'comissao', titulo: 'Comissão', direita: true, classe: 'whitespace-nowrap text-[var(--suave)]', celula: (l) => (l.comissao ? contabil(-l.comissao, m) : '—') },
                { id: 'margem', titulo: 'Margem do salão', direita: true, classe: 'whitespace-nowrap', celula: (l) => <span><b className={cx(l.margem < 0 && 'text-[var(--ruim)]')}>{contabil(l.margem, m)}</b><span className="block text-xs text-[var(--suave)]">{pctTexto(l.margem, l.receita)}</span></span> },
              ]}
              celular={{
                titulo: (l) => t(l.nome),
                valor: (l) => contabil(l.margem, m),
                valorSub: (l) => pctTexto(l.margem, l.receita),
                resumo: (l) => `${t('{n} feito(s)', { n: l.n })} · ${t('receita')} ${v(l.receita)}`,
                fatos: (l) => [`🧴 ${t('Insumos')} ${v(l.insumos)}`, `🤝 ${t('Comissão')} ${v(l.comissao)}`, ...(por === 'servico' && l.categoria ? [`🏷 ${t(l.categoria)}`] : [])],
              }}
            />
            <p className="num mt-2 flex flex-wrap justify-between gap-2 rounded-xl bg-[var(--fundo)] px-3 py-2 text-sm font-bold"><span>{t('Total')} · {t('{n} feito(s)', { n: tot.n })}</span><span>{t('Receita')} {v(tot.receita)} · {t('margem')} {contabil(tot.margem, m)} ({pctTexto(tot.margem, tot.receita)})</span></p>
          </div>
        )}
      </Secao>
    </div>
  )
}
