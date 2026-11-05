// RELATÓRIOS › IMPOSTO DE RENDA — o exercício fiscal boliviano inteiro numa tela (diagnóstico: IMPOSTO-RENDA.md).
// Em cima: o ano, a situação do exercício e a identificação (período, cierre, versão das regras, NIT/CAEB). Embaixo, em
// abas: Visão geral (cada número com a sua ORIGEM) · Impostos (cada obrigação abre os meses, o formulário, o prazo, a
// fonte e o registro do que foi declarado/pago) · Mês a mês (com o caminho até as operações) · Documentos (o respaldo de
// cada compra e gasto) · Validações. "📄 Documento anual" monta o demonstrativo para imprimir/PDF.
// Nada aqui é declaração oficial: o sistema não está ligado ao SIN; estimativa aparece como estimativa.
import { useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import { novoId } from '../../core/domain/ids'
import { CIERRE } from '../../core/dados/tributosBO'
import type { ResultadoConsulta } from '../../core/services'
import { Abas, Botao, Campo, Carregando, Entrada, Info, Janela, Pilula, Selecao, ValorInput, cx, dataBR } from '../../ui/base'
import { useApp, useComando, useConsulta, useParamTela } from '../../ui/contexto'
import { GrupoNumeros, NumeroGrande } from '../../ui/numeroGrande'
import { useT } from '../../ui/i18n'
import { DocumentoIR } from './DocumentoIR'

type IR = NonNullable<ResultadoConsulta<'impostoRenda'>>
type Obrig = IR['obrigacoes'][number]

/** a origem de cada número (a legenda está na visão geral) */
export const ORIGEM: Record<string, { nome: string; tom: 'bom' | 'marca' | 'alerta' | 'suave' | 'ruim'; dica: string }> = {
  calculado: { nome: 'Calculado', tom: 'marca', dica: 'Somado das operações registradas no sistema.' },
  estimado: { nome: 'Estimado', tom: 'alerta', dica: 'Imposto calculado pelo sistema com as regras do exercício — não é a declaração oficial.' },
  confirmado: { nome: 'Confirmado', tom: 'bom', dica: 'Declaração ou pagamento registrado (feito no SIAT).' },
  pendente: { nome: 'Pendente', tom: 'ruim', dica: 'Falta validar com o contador ou registrar.' },
  externo: { nome: 'Documento externo', tom: 'suave', dica: 'Vem de um documento de fora do sistema.' },
}
const SIT: Record<string, { nome: string; tom: 'bom' | 'marca' | 'alerta' | 'ruim' | 'suave' }> = {
  pago: { nome: 'Pago', tom: 'bom' }, declarado: { nome: 'Declarado', tom: 'marca' }, parcial: { nome: 'Pago em parte', tom: 'alerta' },
  vencido: { nome: 'Vencido', tom: 'ruim' }, aVencer: { nome: 'A vencer', tom: 'alerta' }, emCurso: { nome: 'Mês em curso', tom: 'suave' },
  semMovimento: { nome: 'Sem movimento', tom: 'suave' }, emDia: { nome: 'Em dia', tom: 'bom' }, exercicioAberto: { nome: 'Depois do cierre', tom: 'suave' },
}
const SITUACOES = [
  { id: 'aberto', nome: 'Em aberto' }, { id: 'preparacao', nome: 'Em preparação' }, { id: 'pendencias', nome: 'Com pendências' },
  { id: 'validacao', nome: 'Aguardando validação' }, { id: 'revisado', nome: 'Revisado' }, { id: 'fechado', nome: 'Fechado' },
]
const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotMes = (m: string) => `${NOME_MES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`

export function ImpostoRenda() {
  const t = useT()
  const { dados: anos } = useConsulta('exerciciosFiscais', {})
  const [anoTxt, setAno] = useParamTela('ano', '')
  const ano = Number(anoTxt) || anos?.[0] || new Date().getFullYear()
  const { dados: d, erro } = useConsulta('impostoRenda', { ano })
  const [aba, setAba] = useParamTela<'visao' | 'impostos' | 'meses' | 'documentos' | 'validacoes'>('ir', 'visao')
  const [doc, setDoc] = useState(false)
  if (erro) return <p className="rounded-xl bg-[var(--ruim)]/10 p-3 text-sm text-[var(--ruim)]">{erro}</p>
  if (!d) return <Carregando />
  const m = d.moeda
  const v = (n: number) => formatar(n, m)
  const criticos = d.alertas.filter((a) => a.nivel === 'critico').length
  return (
    <div className="space-y-4">
      {/* O EXERCÍCIO: ano · situação · identificação · documento */}
      <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--borda)] px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold">{t('Exercício')}
            <select aria-label={t('Exercício')} value={ano} onChange={(e) => setAno(e.target.value)} className="h-10 rounded-xl border border-[var(--borda)] bg-[var(--cartao)] px-3 text-base font-bold">
              {[...new Set([...(anos ?? []), ano])].sort((a, b) => b - a).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <SituacaoExercicio d={d} />
          <Botao className="ml-auto" onClick={() => setDoc(true)}>📄 {t('Documento anual')}</Botao>
        </div>
        <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-[var(--suave)]">{t('Período')}</dt><dd className="num font-semibold">{dataBR(d.exercicio.de)} – {dataBR(d.exercicio.ate)}</dd></div>
          <div><dt className="text-xs text-[var(--suave)]">{t('Cierre de gestión')}</dt><dd className="font-semibold">{t(d.exercicio.cierreNome)}{!d.exercicio.tipoConfirmado && <span className="ml-1 text-xs font-normal text-[var(--ruim)]">({t('a confirmar')})</span>}</dd></div>
          <div><dt className="text-xs text-[var(--suave)]">{t('IUE e estados financeiros vencem')}</dt><dd className="num font-semibold">{dataBR(d.exercicio.vencimentoAnual)}</dd></div>
          <div><dt className="flex items-center text-xs text-[var(--suave)]">{t('Regras usadas')}<Info texto={[`${d.regras.versao}: ${t('vigente desde')} ${dataBR(d.regras.vigenteDesde)}${d.regras.vigenteAte ? ` ${t('até')} ${dataBR(d.regras.vigenteAte)}` : ''}.`, ...d.regras.notas].join(' ')} /></dt><dd className="num font-semibold">{d.regras.versoesNoExercicio.join(' + ')}</dd></div>
          <div className="sm:col-span-2 lg:col-span-4"><dt className="sr-only">{t('Empresa')}</dt><dd className="text-xs text-[var(--suave)]">{d.empresa.razaoSocial} · NIT {d.empresa.nit || '—'} · CAEB {d.empresa.caeb || '—'} · {d.empresa.regime}{d.auditoria ? ` · ${t('vendas acima do limite: estados financeiros com parecer de auditoria')}` : ''}</dd></div>
        </dl>
        <p className="border-t border-[var(--borda)] bg-[var(--fundo)] px-4 py-2 text-xs text-[var(--suave)]">⚠️ {t('Demonstrativo interno de apoio tributário: não é declaração ao SIN nem substitui o contador. Impostos são ESTIMADOS com as regras do exercício.')}</p>
      </section>

      {d.alertas.some((a) => a.id === 'enquadramento') && <Enquadramento d={d} />}

      <Abas variante="sublinhado" atual={aba} onChange={(a) => setAba(a as typeof aba)} abas={[
        { id: 'visao', nome: 'Visão geral' },
        { id: 'impostos', nome: 'Impostos', extra: <span className="num text-xs opacity-70">{d.obrigacoes.length}</span> },
        { id: 'meses', nome: 'Mês a mês' },
        { id: 'documentos', nome: 'Documentos' },
        { id: 'validacoes', nome: 'Validações', extra: d.alertas.length ? <span className={cx('num rounded-full px-1.5 text-xs', criticos ? 'bg-[var(--ruim)] text-white' : 'opacity-70')}>{d.alertas.length}</span> : undefined },
      ]} />

      {aba === 'visao' && <Visao d={d} v={v} />}
      {aba === 'impostos' && <Impostos d={d} v={v} />}
      {aba === 'meses' && <Meses d={d} v={v} />}
      {aba === 'documentos' && <Documentos d={d} v={v} />}
      {aba === 'validacoes' && <Validacoes d={d} />}
      {doc && <DocumentoIR d={d} onFechar={() => setDoc(false)} />}
    </div>
  )
}

/** a situação do exercício e a troca (fechar congela; reabrir pede motivo) */
function SituacaoExercicio({ d }: { d: IR }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [para, setPara] = useState<string>()
  const [motivo, setMotivo] = useState('')
  const tom = d.situacao === 'fechado' ? 'bom' : d.situacao === 'pendencias' ? 'ruim' : d.situacao === 'revisado' ? 'marca' : 'alerta'
  return (
    <>
      <button type="button" onClick={() => setPara(d.situacao)} className="min-h-10 rounded-xl px-1 text-left" title={t('Mudar a situação do exercício')}>
        <Pilula tom={tom}>{t(SITUACOES.find((s) => s.id === d.situacao)?.nome ?? d.situacao)} ▾</Pilula>
      </button>
      {para !== undefined && (
        <Janela aberta titulo={t('Situação do exercício {a}', { a: d.exercicio.ano })} onFechar={() => setPara(undefined)} rodape={
          <Botao grande className="w-full" disabled={ocupado || para === d.situacao || (d.situacao === 'fechado' && !motivo.trim())} onClick={async () => { if (await executar('mudarSituacaoExercicio', { ano: d.exercicio.ano, para: para as never, motivo: motivo || undefined }, t('Situação mudada.'))) setPara(undefined) }}>{t('Salvar')}</Botao>
        }>
          <div className="space-y-3">
            <Selecao valor={para} onChange={setPara} opcoes={SITUACOES} />
            <p className="text-xs text-[var(--suave)]">{t('Fechar congela os números e a versão das regras usadas (o documento do fechamento não muda depois). Correções continuam possíveis e ficam no histórico.')}</p>
            {d.situacao === 'fechado' && <Campo rotulo="Motivo da reabertura (obrigatório)"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>}
            {d.historico.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-[var(--fundo)] p-2 text-xs">
                {d.historico.map((h, k) => <li key={k}>{dataBR(h.em)} · <b>{h.porNome}</b>: {t(SITUACOES.find((s) => s.id === h.de)?.nome ?? h.de)} → {t(SITUACOES.find((s) => s.id === h.para)?.nome ?? h.para)}{h.motivo ? ` · ${h.motivo}` : ''}</li>)}
              </ul>
            )}
          </div>
        </Janela>
      )}
    </>
  )
}

/** o que o contador precisa confirmar: tipo de atividade (cierre) e CAEB — dá para preencher aqui mesmo */
function Enquadramento({ d }: { d: IR }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const [tipo, setTipo] = useState<string>('')
  const [caeb, setCaeb] = useState(d.empresa.caeb)
  return (
    <section className="rounded-2xl border border-[var(--ruim)]/40 bg-[var(--ruim)]/5 p-4">
      <p className="font-bold">⚖️ {t('Enquadramento a confirmar com o contador')}</p>
      <p className="mt-1 text-sm text-[var(--suave)]">{t('Não existe código CAEB-SIN que diga "cabelo humano". Os mais próximos: 4649400 (venda por atacado de produtos de beleza), 4772200 (varejo de cosméticos) e 9602100 (salão). Só classificar e revender é atividade comercial (cierre 31/12); se o NIT estiver como industrial, o cierre é 31/03.')}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
        <Campo rotulo="Tipo de atividade (no NIT)"><Selecao valor={tipo} onChange={setTipo} vazio="Escolha" opcoes={Object.entries(CIERRE).map(([id, c]) => ({ id, nome: `${c.nome} (cierre ${String(c.dia).padStart(2, '0')}/${String(c.mes).padStart(2, '0')})` }))} /></Campo>
        <Campo rotulo="Código CAEB-SIN"><Entrada inputMode="numeric" placeholder="4649400" value={caeb} onChange={(e) => setCaeb(e.target.value)} /></Campo>
        <Botao disabled={ocupado || (!tipo && !caeb.trim())} onClick={() => executar('salvarConfig', { fiscal: { ...(tipo ? { tipoAtividade: tipo } : {}), caeb: caeb.trim() } as never }, t('Salvo.'))}>{t('Salvar')}</Botao>
      </div>
    </section>
  )
}

function Visao({ d, v }: { d: IR; v(n: number): string }) {
  const t = useT()
  const x = d.visao
  const n = (rot: string, k: keyof IR['visao'], ajuda?: string, tom?: 'bom' | 'ruim' | 'alerta') => {
    const o = ORIGEM[x[k].origem]
    return <NumeroGrande rotulo={rot} ajuda={ajuda} valor={k === 'nVendas' ? String(x[k].valor) : v(x[k].valor)} tom={tom} selos={[{ texto: t(o.nome), tom: o.tom === 'suave' ? undefined : o.tom === 'ruim' ? 'ruim' : o.tom }]} />
  }
  return (
    <div className="space-y-4">
      <section aria-label={t('Movimento')} className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Quanto movimentou')}</p>
        <GrupoNumeros colunas={4}>
          {n('Receita bruta (faturado)', 'receitaBruta', 'A soma das vendas concluídas do exercício (sem as canceladas). É a base do IT.')}
          {n('Vendas', 'nVendas')}
          {n('Compras do exercício', 'compras', 'O que foi comprado no exercício — não é o custo do que foi vendido.')}
          {n('Custo do que foi vendido (CMV)', 'cmv', 'O custo dos lotes que SAÍRAM nas vendas (identificação específica de cada lote, por grama).')}
        </GrupoNumeros>
      </section>
      <section aria-label={t('Resultado')} className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Resultado')}</p>
        <GrupoNumeros colunas={3}>
          {n('Gastos operacionais', 'despesas', 'Gastos do caixa (sem as comissões, que já estão no custo de cada venda).')}
          {n('Lucro contábil (antes do IUE)', 'lucroContabil', 'O mesmo do Estado de Resultados: vendas líquidas − custo − gastos − IT.', x.lucroContabil.valor < 0 ? 'ruim' : undefined)}
          {n('Lucro tributável', 'lucroTributavel', 'Lucro contábil + os gastos que não abatem o IUE (sem documento ou não dedutíveis). Perdas de anos anteriores: com o contador.')}
        </GrupoNumeros>
      </section>
      <section aria-label={t('Impostos')} className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--suave)]">{t('Impostos do exercício')}</p>
        <GrupoNumeros colunas={4}>
          {n('Impostos apurados', 'impostosApurados', 'IVA + IT + retenções (mês a mês) + IUE (anual), estimados.')}
          {n('Impostos pagos', 'impostosPagos', 'O que foi registrado como pago (do SIAT).', 'bom')}
          {n('Pendentes', 'impostosPendentes', 'Apurado − pago.', x.impostosPendentes.valor ? 'alerta' : undefined)}
          {n('Crédito de IVA a favor', 'creditoIva', 'Crédito fiscal (compras com factura) que sobrou no fim do exercício e passa para o próximo mês.')}
        </GrupoNumeros>
      </section>
      {/* a legenda das origens: ninguém precisa adivinhar o que é estimado e o que é confirmado */}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--suave)]">
        {Object.values(ORIGEM).map((o) => <span key={o.nome} title={t(o.dica)} className="inline-flex items-center gap-1.5"><Pilula pequena tom={o.tom === 'suave' ? 'suave' : o.tom}>{t(o.nome)}</Pilula>{t(o.dica)}</span>)}
      </p>
      {/* o estado de resultados do exercício e os ajustes tributários */}
      <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <p className="border-b border-[var(--borda)] px-4 py-3 font-bold">{t('Do lucro contábil ao IUE')} <span className="text-xs font-normal text-[var(--suave)]">{t('estado de resultados (padrão boliviano) + ajustes')}</span></p>
        <ul className="num divide-y divide-[var(--borda)] text-sm">
          {d.resultado.linhas.filter((l) => l.id !== 'iue' && l.id !== 'neta').map((l) => <li key={l.id} className={cx('flex justify-between gap-3 px-4 py-1.5', l.tipo !== 'conta' && 'font-bold')}><span>{l.rotulo}</span><span className="whitespace-nowrap">{v(l.valor)}</span></li>)}
          {d.resultado.ajustes.map((a) => <li key={a.id} className="flex justify-between gap-3 px-4 py-1.5 text-[var(--alerta)]"><span>{t(a.rotulo)}</span><span className="whitespace-nowrap">{v(a.valor)}</span></li>)}
          <li className="flex justify-between gap-3 px-4 py-2 font-bold"><span>{t('Lucro tributável (estimado)')}</span><span>{v(d.resultado.lucroTributavel)}</span></li>
          <li className="flex justify-between gap-3 bg-[var(--fundo)] px-4 py-2 font-black"><span>{t('IUE 25% (estimado)')}</span><span>{v(d.resultado.iue)}</span></li>
        </ul>
      </section>
    </div>
  )
}

function Impostos({ d, v }: { d: IR; v(n: number): string }) {
  const [aberto, setAberto] = useState<string>()
  return (
    <ul className="space-y-2">
      {d.obrigacoes.map((o) => <LinhaObrigacao key={o.id} d={d} o={o} v={v} aberta={aberto === o.id} onAlternar={() => setAberto(aberto === o.id ? undefined : o.id)} />)}
    </ul>
  )
}

function LinhaObrigacao({ d, o, v, aberta, onAlternar }: { d: IR; o: Obrig; v(n: number): string; aberta: boolean; onAlternar(): void }) {
  const t = useT()
  const [registrar, setRegistrar] = useState<string>()
  const s = SIT[o.situacao] ?? { nome: o.situacao, tom: 'suave' as const }
  const certeza = o.certeza === 'O' ? 'texto oficial' : o.certeza === 'S' ? 'fonte secundária' : 'a confirmar'
  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
      <button type="button" aria-expanded={aberta} onClick={onAlternar} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-[var(--fundo)]">
        <span className="min-w-[12rem] flex-1">
          <span className="flex items-baseline gap-2"><b className="shrink-0 whitespace-nowrap font-mono text-[var(--marca)]">{o.sigla}</b><b className="min-w-0">{t(o.nome)}</b></span>
          <span className="block text-xs text-[var(--suave)]">{o.formulario} · {t(o.periodicidade === 'mensal' ? 'mensal' : 'anual')}{o.aliquotaBp ? ` · ${o.aliquotaBp / 100}%` : ''}{!o.calcula ? ` · ${t('só lembrete: o valor é com o contador')}` : ''}</span>
        </span>
        <span className="num grid grid-cols-3 gap-4 text-right text-xs">
          <span><span className="block text-[var(--suave)]">{t('Apurado')}</span><b className="text-sm">{o.calcula ? v(o.apurado) : '—'}</b></span>
          <span><span className="block text-[var(--suave)]">{t('Pago')}</span><b className="text-sm text-[var(--bom)]">{v(o.pago)}</b></span>
          <span><span className="block text-[var(--suave)]">{t('Pendente')}</span><b className={cx('text-sm', o.pendente > 0 && 'text-[var(--alerta)]')}>{o.calcula ? v(o.pendente) : '—'}</b></span>
        </span>
        <Pilula tom={s.tom}>{t(s.nome)}</Pilula>
        <span aria-hidden className={cx('text-[var(--suave)] transition-transform', aberta && 'rotate-90')}>›</span>
      </button>
      {aberta && (
        <div className="space-y-3 border-t border-[var(--borda)] px-4 py-3 text-sm">
          <p>{t(o.descricao)} <span lang="es" className="text-xs italic text-[var(--suave)]">({o.es})</span></p>
          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div><dt className="text-[var(--suave)]">{t('Base de cálculo')}</dt><dd>{t(o.base)}</dd></div>
            <div><dt className="text-[var(--suave)]">{t('Vencimento')}</dt><dd>{t(o.vencimento)}</dd></div>
            <div><dt className="text-[var(--suave)]">{t('Fonte')}</dt><dd>{o.fonte} · <i>{t(certeza)}</i></dd></div>
          </dl>
          {o.periodicidade === 'mensal' ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--borda)]">
              <table className="num w-full min-w-[36rem] text-xs">
                <thead className="bg-[var(--fundo)] text-left text-[var(--suave)]"><tr><th className="px-3 py-1.5">{t('Mês')}</th><th className="px-2 text-right">{t('Apurado')}</th><th className="px-2 text-right">{t('Declarado')}</th><th className="px-2 text-right">{t('Pago')}</th><th className="px-2">{t('Vence')}</th><th className="px-2">{t('Situação')}</th><th /></tr></thead>
                <tbody className="divide-y divide-[var(--borda)]">
                  {o.meses.map((x) => {
                    const sm = SIT[x.situacao] ?? { nome: x.situacao, tom: 'suave' as const }
                    return (
                      <tr key={x.mes}>
                        <td className="px-3 py-1.5 font-semibold">{rotMes(x.mes)}</td>
                        <td className="px-2 text-right">{o.calcula ? v(x.apurado) : '—'}</td>
                        <td className="px-2 text-right">{x.declarado ? v(x.declarado) : '—'}</td>
                        <td className="px-2 text-right">{x.pago ? v(x.pago) : '—'}</td>
                        <td className="px-2">{dataBR(x.vencimento)}</td>
                        <td className="px-2"><Pilula pequena tom={sm.tom}>{t(sm.nome)}</Pilula></td>
                        <td className="px-2 text-right"><button type="button" onClick={() => setRegistrar(x.mes)} className="min-h-8 rounded-lg px-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-suave)]">{t('Registrar')}</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--fundo)] px-3 py-2 text-xs">
              <span>{t('Exercício')} {d.exercicio.ano} · {t('vence')} <b className="num">{dataBR(o.proximoVencimento ?? d.exercicio.vencimentoAnual)}</b></span>
              {o.calcula && <span>{t('Apurado (estimado)')}: <b className="num">{v(o.apurado)}</b></span>}
              <Botao variante="secundario" className="ml-auto" onClick={() => setRegistrar(String(d.exercicio.ano))}>{t('Registrar declaração/pagamento')}</Botao>
            </div>
          )}
          {o.registros.length > 0 && (
            <ul className="space-y-1 text-xs">
              {o.registros.map((r) => <li key={r.id} className="rounded-lg bg-[var(--bom)]/8 px-3 py-1.5">✓ {r.periodo} · {r.formulario}{r.numeroOrden ? ` nº ${r.numeroOrden}` : ''}{r.declaradoEm ? ` · ${t('declarado')} ${dataBR(r.declaradoEm)}` : ''}{r.valorPago !== undefined ? ` · ${t('pago')} ${v(r.valorPago)}${r.pagoEm ? ` ${t('em')} ${dataBR(r.pagoEm)}` : ''}` : ''}{r.porNome ? ` · ${r.porNome}` : ''}</li>)}
            </ul>
          )}
        </div>
      )}
      {registrar && <RegistrarObrigacao d={d} o={o} periodo={registrar} onFechar={() => setRegistrar(undefined)} />}
    </li>
  )
}

/** registrar o que foi feito no SIAT (o sistema não declara nada sozinho) */
function RegistrarObrigacao({ d, o, periodo, onFechar }: { d: IR; o: Obrig; periodo: string; onFechar(): void }) {
  const t = useT()
  const { executar, ocupado } = useComando()
  const ex = o.registros.find((r) => r.periodo === periodo)
  const apurado = o.periodicidade === 'anual' ? o.apurado : o.meses.find((x) => x.mes === periodo)?.apurado
  const [f, setF] = useState({ numeroOrden: ex?.numeroOrden ?? '', declaradoEm: ex?.declaradoEm ?? '', valorDeclarado: ex?.valorDeclarado ?? apurado, pagoEm: ex?.pagoEm ?? '', valorPago: ex?.valorPago, obs: ex?.obs ?? '' })
  return (
    <Janela aberta titulo={`${o.sigla} · ${periodo} · ${o.formulario}`} onFechar={onFechar} rodape={
      <Botao grande className="w-full" disabled={ocupado || (!f.declaradoEm && !f.pagoEm)} onClick={async () => {
        if (await executar('registrarObrigacaoFiscal', { id: ex?.id ?? novoId(), ano: d.exercicio.ano, periodo, obrigacao: o.id, formulario: o.formulario, numeroOrden: f.numeroOrden || undefined, declaradoEm: f.declaradoEm || undefined, valorDeclarado: f.valorDeclarado, pagoEm: f.pagoEm || undefined, valorPago: f.valorPago, obs: f.obs || undefined }, t('Registrado.'))) onFechar()
      }}>{t('Salvar registro')}</Botao>
    }>
      <div className="space-y-3">
        <p className="text-xs text-[var(--suave)]">{t('Copie do comprovante do SIAT. O apurado pelo sistema é estimativa: declare o que o contador conferiu.')}{apurado !== undefined && o.calcula ? ` ${t('Apurado (estimado)')}: ${formatar(apurado, d.moeda)}.` : ''}</p>
        <Campo rotulo="Nº de orden (do SIAT)"><Entrada value={f.numeroOrden} onChange={(e) => setF({ ...f, numeroOrden: e.target.value })} /></Campo>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Declarado em"><Entrada type="date" value={f.declaradoEm} onChange={(e) => setF({ ...f, declaradoEm: e.target.value })} /></Campo>
          <Campo rotulo="Valor declarado"><ValorInput moeda={d.moeda} valor={f.valorDeclarado} onChange={(x) => setF({ ...f, valorDeclarado: x })} /></Campo>
          <Campo rotulo="Pago em"><Entrada type="date" value={f.pagoEm} onChange={(e) => setF({ ...f, pagoEm: e.target.value })} /></Campo>
          <Campo rotulo="Valor pago"><ValorInput moeda={d.moeda} valor={f.valorPago} onChange={(x) => setF({ ...f, valorPago: x })} /></Campo>
        </div>
        <Campo rotulo="Observação"><Entrada value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Campo>
      </div>
    </Janela>
  )
}

function Meses({ d, v }: { d: IR; v(n: number): string }) {
  const t = useT()
  const { ir } = useApp()
  const [mes, setMes] = useState<string>()
  const x = d.meses.find((y) => y.mes === mes)
  const cols: [string, (y: IR['meses'][number]) => number][] = [['Receita', (y) => y.receita], ['Compras', (y) => y.compras], ['Gastos', (y) => y.despesas], ['Débito IVA', (y) => y.debitoIva], ['Crédito IVA', (y) => y.creditoIva], ['IVA', (y) => y.iva], ['IT', (y) => y.it], ['Retenções', (y) => y.retIue + y.retIt]]
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <table className="num w-full min-w-[46rem] text-sm">
          <thead className="bg-[var(--fundo)] text-left text-[11px] uppercase tracking-wide text-[var(--suave)]"><tr><th className="px-4 py-2">{t('Mês')}</th>{cols.map(([c]) => <th key={c} className="px-2 py-2 text-right">{t(c)}</th>)}</tr></thead>
          <tbody className="divide-y divide-[var(--borda)]">
            {d.meses.map((y) => (
              <tr key={y.mes} onClick={() => !y.futuro && setMes(mes === y.mes ? undefined : y.mes)} className={cx(y.futuro ? 'text-[var(--suave)] opacity-50' : 'cursor-pointer hover:bg-[var(--marca-suave)]/40', mes === y.mes && 'bg-[var(--marca-suave)]')}>
                <td className="px-4 py-2 font-semibold">{rotMes(y.mes)}{y.itCompensadoIue ? <span title={t('IT compensado com o IUE do ano anterior')} className="ml-1 text-xs text-[var(--bom)]">↺</span> : null}</td>
                {cols.map(([c, f]) => <td key={c} className="whitespace-nowrap px-2 py-2 text-right">{f(y) ? v(f(y)) : '—'}</td>)}
              </tr>
            ))}
            <tr className="bg-[var(--fundo)] font-bold"><td className="px-4 py-2">{t('Exercício')}</td>{cols.map(([c, f]) => <td key={c} className="whitespace-nowrap px-2 py-2 text-right">{v(d.meses.reduce((s, y) => s + f(y), 0))}</td>)}</tr>
          </tbody>
        </table>
      </div>
      {x && (
        <section className="rounded-2xl border border-[var(--marca)]/40 bg-[var(--cartao)] p-4 text-sm">
          <p className="font-bold">{rotMes(x.mes)} · {t('regras')} {x.versao} · {t('vence')} {dataBR(x.vencimento)}</p>
          <p className="mt-1 text-xs text-[var(--suave)]">{t('{v} venda(s) · {c} compra(s) · base das retenções (compras sem factura) {b}{s}', { v: x.nVendas, c: x.nCompras, b: v(x.baseRetencao), s: x.saldoIvaFavor ? ` · ${t('crédito de IVA a favor')} ${v(x.saldoIvaFavor)}` : '' })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => ir('vendas', { de: `${x.mes}-01`, ate: `${x.mes}-31` })}>🧾 {t('Ver as vendas')}</Botao>
            <Botao variante="secundario" onClick={() => ir('comprar', { de: `${x.mes}-01`, ate: `${x.mes}-31`, aba: 'todas' })}>🛒 {t('Ver as compras')}</Botao>
            <Botao variante="secundario" onClick={() => ir('caixa', { de: `${x.mes}-01`, ate: `${x.mes}-31` })}>💵 {t('Ver o caixa')}</Botao>
          </div>
        </section>
      )}
    </div>
  )
}

/** o RESPALDO de cada compra e gasto: factura (crédito de IVA) · recibo (com retenção) · sem; gasto: dedutível ou não */
function Documentos({ d, v }: { d: IR; v(n: number): string }) {
  const t = useT()
  const { executar } = useComando()
  const { ir } = useApp()
  const [mais, setMais] = useState(false)
  const DOC = [{ id: 'factura', nome: 'Factura' }, { id: 'recibo', nome: 'Recibo (com retenção)' }, { id: 'sem', nome: 'Sem documento' }]
  const compras = mais ? d.documentos.compras : d.documentos.compras.slice(0, 30)
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--suave)]">{t('Compra com factura dá crédito de IVA. Compra de pessoa sem factura exige a retenção de 8% (F-570 + F-410) e o CI do vendedor para ser custo no IUE. Gasto sem documento não abate o IUE.')}</p>
      <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <p className="border-b border-[var(--borda)] px-4 py-3 font-bold">🛒 {t('Compras')} <span className="text-xs font-normal text-[var(--suave)]">· {d.documentos.compras.length}</span></p>
        <ul className="divide-y divide-[var(--borda)]">
          {compras.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
              <button type="button" onClick={() => ir('pedido', { id: c.id })} className="font-mono font-semibold text-[var(--marca)] hover:underline">{c.codigo ?? '—'}</button>
              <span className="min-w-0 flex-1 truncate text-[var(--suave)]">{dataBR(c.data)} · {c.fornecedor || t('sem fornecedor')}{c.comprovante ? ' · 📎' : ''}</span>
              <b className="num whitespace-nowrap">{v(c.valor)}</b>
              <div className="w-48"><Selecao valor={c.documento} onChange={(x) => executar('classificarDocumentoFiscal', { alvo: 'compra', id: c.id, documento: x as never }, t('Documento marcado.'))} opcoes={DOC} /></div>
            </li>
          ))}
        </ul>
        {d.documentos.compras.length > 30 && <button type="button" onClick={() => setMais(!mais)} className="min-h-10 w-full text-sm font-semibold text-[var(--marca)]">{t(mais ? 'Mostrar menos' : 'Ver todas')}</button>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] shadow-sm">
        <p className="border-b border-[var(--borda)] px-4 py-3 font-bold">💵 {t('Gastos')} <span className="text-xs font-normal text-[var(--suave)]">· {d.documentos.despesas.length}</span></p>
        <ul className="divide-y divide-[var(--borda)]">
          {d.documentos.despesas.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{x.descricao} <span className="text-[var(--suave)]">· {dataBR(x.data)}{x.categoria ? ` · ${t(x.categoria)}` : ''}</span></span>
              <b className="num whitespace-nowrap">{v(x.valor)}</b>
              <div className="w-48"><Selecao valor={x.documento} onChange={(doc) => executar('classificarDocumentoFiscal', { alvo: 'despesa', id: x.id, documento: doc as never, dedutivel: x.dedutivel || doc !== 'sem' }, t('Documento marcado.'))} opcoes={DOC} /></div>
              <label className={cx('flex min-h-10 items-center gap-1.5 text-xs', x.documento === 'sem' && 'opacity-50')}>
                <input type="checkbox" className="h-4 w-4" disabled={x.documento === 'sem'} checked={x.dedutivel} onChange={(e) => executar('classificarDocumentoFiscal', { alvo: 'despesa', id: x.id, documento: x.documento as never, dedutivel: e.target.checked })} />{t('dedutível')}
              </label>
            </li>
          ))}
          {!d.documentos.despesas.length && <li className="px-4 py-3 text-sm text-[var(--suave)]">{t('Nenhum gasto no exercício.')}</li>}
        </ul>
      </section>
    </div>
  )
}

function Validacoes({ d }: { d: IR }) {
  const t = useT()
  const { ir } = useApp()
  const COR = { critico: 'var(--ruim)', atencao: 'var(--alerta)', info: 'var(--suave)' } as const
  const NOME = { critico: 'Crítico', atencao: 'Atenção', info: 'Para conferir' } as const
  if (!d.alertas.length) return <p className="rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] p-4 text-sm text-[var(--bom)]">✓ {t('Nada para revisar neste exercício.')}</p>
  return (
    <ul className="space-y-2">
      {d.alertas.map((a) => (
        <li key={a.id} className="relative overflow-hidden rounded-2xl border border-[var(--borda)] bg-[var(--cartao)] py-3 pl-5 pr-4 shadow-sm">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: COR[a.nivel] }} />
          <p className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: COR[a.nivel] }}>{t(NOME[a.nivel])}</span><b>{t(a.titulo)}</b></p>
          <p className="mt-1 text-sm">{t(a.detalhe)}</p>
          <dl className="mt-1.5 grid gap-x-6 text-xs sm:grid-cols-2">
            <div><dt className="inline font-semibold">{t('Impacto')}: </dt><dd className="inline text-[var(--suave)]">{t(a.impacto)}</dd></div>
            <div><dt className="inline font-semibold">{t('O que revisar')}: </dt><dd className="inline text-[var(--suave)]">{t(a.revisar)}</dd></div>
          </dl>
          {a.registros.length > 0 && <p className="mt-2 flex flex-wrap gap-1">{a.registros.map((r) => <button key={r.id} type="button" onClick={() => ir(r.tela, { id: r.id })} className="rounded-md bg-[var(--marca-suave)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[var(--marca)] hover:underline">{r.codigo ?? r.id.slice(-5)}</button>)}</p>}
        </li>
      ))}
    </ul>
  )
}
