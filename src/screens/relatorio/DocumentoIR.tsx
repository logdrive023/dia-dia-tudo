// DOCUMENTO ANUAL DO IMPOSTO DE RENDA — o demonstrativo do exercício para imprimir/PDF, montado na hora a partir do
// exercício escolhido. A pessoa escolhe as seções e se vai o detalhe mês a mês; a prévia são folhas A4 (o que se vê é o
// que sai), com o mesmo jeito da impressão do relatório contábil (classes impressao-relatorio / folha-a4 e @page).
// Sempre diz: exercício, período, data de geração, versão e vigência das regras, situação dos dados e que é um
// DEMONSTRATIVO INTERNO (não é declaração ao SIN). Exercício FECHADO: mostra os números congelados do fechamento.
import { useEffect, useState } from 'react'
import { formatar } from '../../core/domain/dinheiro'
import type { ResultadoConsulta } from '../../core/services'
import { Botao, dataBR } from '../../ui/base'
import { useT } from '../../ui/i18n'

type IR = NonNullable<ResultadoConsulta<'impostoRenda'>>
const SECOES = [
  { id: 'resumo', nome: 'Resumo do exercício' },
  { id: 'resultado', nome: 'Resultado e base tributável' },
  { id: 'impostos', nome: 'Impostos e formulários' },
  { id: 'mensal', nome: 'Histórico mensal' },
  { id: 'declaracoes', nome: 'Declarações e pagamentos' },
  { id: 'pendencias', nome: 'Pendências e inconsistências' },
  { id: 'fontes', nome: 'Regras e fontes normativas' },
] as const
type IdSecao = (typeof SECOES)[number]['id']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function DocumentoIR({ d, onFechar }: { d: IR; onFechar(): void }) {
  const t = useT()
  const [marcadas, setMarcadas] = useState<Set<IdSecao>>(new Set(SECOES.map((s) => s.id)))
  const [detalheMensal, setDetalheMensal] = useState(true)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', k)
    document.body.classList.add('imprimindo-relatorio')
    return () => (document.removeEventListener('keydown', k), document.body.classList.remove('imprimindo-relatorio'))
  }, [onFechar])
  const v = (n: number) => formatar(n, d.moeda)
  const tem = (id: IdSecao) => marcadas.has(id)
  const alternar = (id: IdSecao) => setMarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const congelado = d.fechamento?.resumo
  const gerado = new Date().toLocaleString('es-BO')
  const cab = (
    <header className="mb-4 border-b-2 border-black pb-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-black uppercase">{d.empresa.razaoSocial}</p>
          <p className="text-[10px]">NIT {d.empresa.nit || '—'} · CAEB-SIN {d.empresa.caeb || '— (a confirmar)'} · {d.empresa.regime}{d.empresa.naturezaJuridica ? ` · ${d.empresa.naturezaJuridica}` : ''}</p>
          {d.empresa.endereco && <p className="text-[10px]">{d.empresa.endereco}</p>}
        </div>
        <div className="text-right text-[10px]">
          <p className="text-[12px] font-bold">Gestión {d.exercicio.ano}</p>
          <p>{dataBR(d.exercicio.de)} – {dataBR(d.exercicio.ate)}</p>
          <p>Cierre: {d.exercicio.cierreNome}</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[13px] font-bold uppercase tracking-wide">Demostrativo tributario anual (uso interno)</p>
      <p className="text-center text-[9px]">No es una declaración jurada ante el SIN ni reemplaza al contador · Reglas {d.regras.versao} (vigentes desde {dataBR(d.regras.vigenteDesde)}) · Generado {gerado}</p>
    </header>
  )
  const rodape = <p className="mt-6 border-t border-black/30 pt-1 text-[8px] text-black/60">Situación del ejercicio: {d.situacao}{d.fechamento ? ` · cerrado el ${dataBR(d.fechamento.em)} por ${d.fechamento.porNome} con las reglas ${d.fechamento.versaoRegras}` : ''} · Valores en {d.moeda}. Impuestos ESTIMADOS por el sistema; los declarados y pagados son los registrados del SIAT.</p>
  const h2 = (s: string) => <h2 className="mb-2 mt-4 border-b border-black/40 pb-0.5 text-[12px] font-bold uppercase tracking-wide">{s}</h2>
  const fila = (a: string, b: string, forte?: boolean) => <tr className={forte ? 'font-bold' : ''}><td className="py-0.5 pr-2">{a}</td><td className="num py-0.5 text-right">{b}</td></tr>

  return (
    <div className="impressao-relatorio fixed inset-0 z-50 overflow-y-auto bg-[#525659] print:static print:overflow-visible print:bg-white">
      <div className="nao-imprimir sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-black/20 bg-[var(--cartao)] px-3 py-2 shadow">
        <b className="mr-auto">📄 {t('Documento anual')} · {d.exercicio.ano}</b>
        <div className="order-last flex basis-full flex-wrap gap-1">
          {SECOES.map((s) => (
            <button key={s.id} type="button" aria-pressed={tem(s.id)} onClick={() => alternar(s.id)} className={`min-h-9 rounded-full px-2.5 text-xs font-semibold ring-1 ${tem(s.id) ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)]'}`}>{tem(s.id) ? '✓ ' : ''}{t(s.nome)}</button>
          ))}
          <button type="button" aria-pressed={detalheMensal} onClick={() => setDetalheMensal(!detalheMensal)} className={`min-h-9 rounded-full px-2.5 text-xs font-semibold ring-1 ${detalheMensal ? 'bg-[var(--marca)] text-white ring-[var(--marca)]' : 'bg-[var(--cartao)] text-[var(--suave)] ring-[var(--borda)]'}`}>{detalheMensal ? '✓ ' : ''}{t('Detalhe mês a mês')}</button>
        </div>
        <Botao variante="secundario" onClick={onFechar}>{t('Fechar')}</Botao>
        <Botao disabled={!marcadas.size} onClick={() => window.print()}>🖨 {t('Imprimir / salvar PDF')}</Botao>
      </div>

      <div className="mx-auto flex flex-col items-center gap-6 py-6 print:block print:p-0">
        <article className="folha-a4 text-[11px]">
          {cab}
          {tem('resumo') && <>
            {h2('1. Resumen del ejercicio')}
            <table className="w-full"><tbody>
              {fila('Ingresos brutos (facturado)', v(d.visao.receitaBruta.valor))}
              {fila('Ventas (cantidad)', String(d.visao.nVendas.valor))}
              {fila('Compras del ejercicio', v(d.visao.compras.valor))}
              {fila('Inventario inicial / final (al costo)', `${v(d.visao.estoqueInicial.valor)} / ${v(d.visao.estoqueFinal.valor)}`)}
              {fila('Costo de ventas (identificación específica por lote)', v(d.visao.cmv.valor))}
              {fila('Gastos operativos', v(d.visao.despesas.valor))}
              {fila('Impuestos determinados (estimado)', v(d.visao.impostosApurados.valor), true)}
              {fila('Impuestos pagados (registrados)', v(d.visao.impostosPagos.valor))}
              {fila('Pendientes', v(d.visao.impostosPendentes.valor), true)}
            </tbody></table>
          </>}
          {tem('resultado') && <>
            {h2('2. Resultado contable y base imponible del IUE')}
            <table className="w-full"><tbody>
              {d.resultado.linhas.filter((l) => l.id !== 'iue' && l.id !== 'neta').map((l) => <tr key={l.id} className={l.tipo !== 'conta' ? 'font-bold' : ''}><td className="py-0.5 pr-2">{l.rotulo}</td><td className="num py-0.5 text-right">{v(l.valor)}</td></tr>)}
              {d.resultado.ajustes.map((a) => fila('(+) Gastos sin respaldo o no deducibles (DS 24051 art. 8)', v(a.valor)))}
              {fila('Utilidad imponible (estimada)', v(d.resultado.lucroTributavel), true)}
              {fila('IUE 25% (estimado) · Formulario 500', v(d.resultado.iue), true)}
              {fila('Pérdidas de gestiones anteriores', 'a informar por el contador')}
            </tbody></table>
            {congelado && <p className="mt-1 text-[9px]">Valores congelados al cierre: utilidad contable {v(congelado.lucroContabil)} · imponible {v(congelado.lucroTributavel)} · IUE {v(congelado.iue)}.</p>}
          </>}
          {tem('impostos') && <>
            {h2('3. Impuestos y formularios')}
            <table className="w-full border-collapse text-[10px]">
              <thead><tr className="border-y border-black text-left"><th className="py-1">Obligación</th><th>Formulario</th><th>Periodicidad</th><th className="text-right">Determinado</th><th className="text-right">Pagado</th><th className="text-right">Pendiente</th><th>Vence</th></tr></thead>
              <tbody>
                {d.obrigacoes.map((o) => (
                  <tr key={o.id} className="border-b border-black/20 align-top">
                    <td className="py-1 pr-1"><b>{o.sigla}</b> {o.es}</td><td>{o.formulario}</td><td>{o.periodicidade === 'mensal' ? 'mensual' : 'anual'}</td>
                    <td className="num text-right">{o.calcula ? v(o.apurado) : 'contador'}</td><td className="num text-right">{v(o.pago)}</td><td className="num text-right">{o.calcula ? v(o.pendente) : '—'}</td>
                    <td className="text-[9px]">{o.periodicidade === 'anual' ? dataBR(d.exercicio.vencimentoAnual) : 'día 13–22 (NIT)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>}
          {tem('mensal') && detalheMensal && <>
            {h2('4. Historial mensual (estimado)')}
            <table className="w-full border-collapse text-[9px]">
              <thead><tr className="border-y border-black text-right"><th className="py-1 text-left">Mes</th><th>Ingresos</th><th>Compras</th><th>Gastos</th><th>Débito IVA</th><th>Crédito IVA</th><th>IVA</th><th>IT</th><th>Retenc.</th><th>Vence</th></tr></thead>
              <tbody>
                {d.meses.filter((m) => !m.futuro).map((m) => (
                  <tr key={m.mes} className="num border-b border-black/15 text-right">
                    <td className="py-0.5 text-left">{MES[Number(m.mes.slice(5)) - 1]}/{m.mes.slice(2, 4)}</td><td>{v(m.receita)}</td><td>{v(m.compras)}</td><td>{v(m.despesas)}</td><td>{v(m.debitoIva)}</td><td>{v(m.creditoIva)}</td><td>{v(m.iva)}</td><td>{v(m.it)}</td><td>{v(m.retIue + m.retIt)}</td><td>{dataBR(m.vencimento).slice(0, 5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>}
          {tem('declaracoes') && <>
            {h2('5. Declaraciones y pagos registrados')}
            {d.obrigacoes.flatMap((o) => o.registros).length ? (
              <ul className="space-y-0.5">{d.obrigacoes.flatMap((o) => o.registros.map((r) => <li key={r.id}>{o.sigla} {r.periodo} · {r.formulario}{r.numeroOrden ? ` Nº ${r.numeroOrden}` : ''}{r.declaradoEm ? ` · declarado ${dataBR(r.declaradoEm)}` : ''}{r.valorPago !== undefined ? ` · pagado ${v(r.valorPago)}${r.pagoEm ? ` el ${dataBR(r.pagoEm)}` : ''}` : ''}</li>))}</ul>
            ) : <p>Ningún registro de declaración o pago en el sistema.</p>}
          </>}
          {tem('pendencias') && <>
            {h2('6. Pendientes e inconsistencias')}
            {d.alertas.length ? <ul className="list-disc space-y-0.5 pl-4">{d.alertas.map((a) => <li key={a.id}><b>{a.titulo}</b> — {a.detalhe} <i>Revisar: {a.revisar}</i></li>)}</ul> : <p>Sin pendientes.</p>}
          </>}
          {tem('fontes') && <>
            {h2('7. Reglas y fuentes normativas')}
            <p>Versión de reglas: <b>{d.regras.versao}</b> (vigente desde {dataBR(d.regras.vigenteDesde)}{d.regras.vigenteAte ? ` hasta ${dataBR(d.regras.vigenteAte)}` : ''}). Cierre de gestión: DS 24051 art. 39. Vencimientos mensuales: DS 25619 (último dígito del NIT).</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{d.obrigacoes.map((o) => <li key={o.id}>{o.sigla}: {o.fonte}{o.certeza !== 'O' ? ' (fuente secundaria — confirmar)' : ''}</li>)}</ul>
            {d.regras.notas.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4">{d.regras.notas.map((n) => <li key={n}>{n}</li>)}</ul>}
            <p className="mt-2 text-[9px]">Reservas: impuestos estimados a partir de las operaciones registradas; el sistema no está conectado al SIN; el encuadramiento (CAEB, tipo de actividad) y las pérdidas de gestiones anteriores deben ser confirmados por el contador.</p>
          </>}
          <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[10px]">
            <div><div className="mx-auto mb-1 w-44 border-t border-black" />{d.empresa.contador || '…'}<br /><b>Contador</b></div>
            <div><div className="mx-auto mb-1 w-44 border-t border-black" />{d.empresa.representante || '…'}<br /><b>Representante legal</b></div>
          </div>
          {rodape}
        </article>
      </div>
    </div>
  )
}
