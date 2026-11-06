// O CONTEÚDO DE CADA PARTE do relatório contábil — escrito uma vez, usado na tela (cartões) e na impressão (folhas A4).
import { dataBR, gramasTexto } from '../../../shared/ui/base'
import { type Relatorio, TEXTO, TabelaAnexo, TabelaResultado, valorContabil } from './pecas'

export type IdSecao = 'resultado' | 'impostos' | 'balanco' | 'conferencia' | 'diario' | 'vendas' | 'compras' | 'inventario' | 'gastos' | 'cuentas'

export const SECOES: { id: IdSecao; anexo?: boolean; icone: string }[] = [
  { id: 'resultado', icone: '📊' },
  { id: 'balanco', icone: '⚖️' },
  { id: 'impostos', icone: '🧾' },
  { id: 'conferencia', icone: '✅' },
  { id: 'diario', anexo: true, icone: '📒' },
  { id: 'vendas', anexo: true, icone: '💰' },
  { id: 'compras', anexo: true, icone: '🛒' },
  { id: 'gastos', anexo: true, icone: '⛽' },
  { id: 'inventario', anexo: true, icone: '📦' },
  { id: 'cuentas', anexo: true, icone: '🤝' },
]

export function tituloSecao(id: IdSecao, rel: Relatorio) {
  const x = TEXTO[rel.pais]
  return ({ resultado: rel.tituloResultado, balanco: rel.tituloBalanco, impostos: x.impostos, conferencia: x.conferencia, diario: x.diario, vendas: x.vendas, compras: x.compras, gastos: x.gastos, inventario: x.inventario, cuentas: x.cuentas } as const)[id]
}

/** o conteúdo de uma parte (sem moldura): a tela põe num cartão, a impressão numa folha */
export function ConteudoSecao({ id, rel, impressao, onAnexo }: { id: IdSecao; rel: Relatorio; impressao?: boolean; onAnexo?(a: string): void }) {
  const p = rel.pais
  const x = TEXTO[p]
  const v = (n: number) => valorContabil(n, p)
  const a = rel.anexos
  switch (id) {
    case 'resultado':
      return <TabelaResultado linhas={rel.resultados} pais={p} onAnexo={onAnexo} impressao={impressao} />
    case 'impostos':
      return (
        <div className="space-y-3">
          <p role="note" className="rounded-xl border border-[var(--alerta)]/40 bg-[var(--alerta)]/10 px-3 py-2 text-xs font-semibold text-[var(--alerta)] print:border-black print:bg-transparent print:text-black">⚠️ {x.estimativa}</p>
          <p className="text-xs text-[var(--suave)]">{x.regime}: <b className="text-[var(--texto)]">{rel.regimeNome}</b></p>
          {rel.resumoImpostos.itens.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
              {rel.resumoImpostos.itens.map((i) => (
                <div key={i.sigla} className="rounded-xl border border-[var(--borda)] bg-[var(--cartao)] p-2.5 print:border-black/40">
                  <b className="block text-xs">{i.sigla}</b>
                  <span className="num block text-base font-bold">{v(i.valor)}</span>
                  <span className="num block text-[11px] text-[var(--suave)]">{(i.pctBp / 100).toLocaleString(p === 'BO' ? 'es-BO' : 'pt-BR')}% {x.sobreVentas}</span>
                </div>
              ))}
              <div className="rounded-xl bg-[var(--alerta)]/12 p-2.5 print:border print:border-black print:bg-transparent">
                <b className="block text-xs">{x.carga}</b>
                <span className="num block text-base font-black">{v(rel.resumoImpostos.total)}</span>
                <span className="num block text-[11px]">{(rel.resumoImpostos.pctBp / 100).toLocaleString(p === 'BO' ? 'es-BO' : 'pt-BR')}% {x.sobreVentas}</span>
              </div>
            </div>
          )}
          <TabelaResultado linhas={rel.impostos} pais={p} impressao={impressao} />
          {rel.notas.length > 0 && (
            <div className="rounded-xl bg-[var(--fundo)] p-3 text-xs print:bg-transparent print:p-0">
              <b className="mb-1 block uppercase tracking-wide">{x.notas}</b>
              <ol className="list-decimal space-y-0.5 pl-4">{rel.notas.map((n) => <li key={n}>{n}</li>)}</ol>
            </div>
          )}
        </div>
      )
    case 'balanco': {
      const bloco = (titulo: string, linhas: typeof rel.balanco.ativo, total: number, rotuloTotal: string) => (
        <div>
          <p className="mb-1 text-xs font-bold tracking-wide">{titulo}</p>
          <TabelaResultado linhas={[...linhas, { id: `t-${titulo}`, rotulo: rotuloTotal, valor: total, tipo: 'subtotal' }]} pais={p} onAnexo={onAnexo} impressao={impressao} />
        </div>
      )
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            {bloco(x.activo, rel.balanco.ativo, rel.balanco.totalAtivo, x.totalActivo)}
            {bloco(x.pasivo, rel.balanco.passivo, rel.balanco.totalPassivo, x.totalPasivo)}
          </div>
          <TabelaResultado linhas={[{ id: 'pl', rotulo: x.patrimonioTotal, valor: rel.balanco.patrimonio, tipo: 'total' }]} pais={p} impressao={impressao} />
        </div>
      )
    }
    case 'conferencia':
      return (
        <ul className="space-y-1.5 text-sm">
          {rel.conferencia.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
              <span aria-hidden className={c.ok ? 'text-[var(--bom)]' : 'text-[var(--ruim)]'}>{c.ok ? '✓' : '⚠'}</span>
              <span className="linha-texto">{c.rotulo}</span>
              <span className="num ml-auto whitespace-nowrap font-semibold">{c.ok ? `${v(c.esperado)} · ${x.ok}` : `${x.dif} ${v(c.diferenca)}`}</span>
            </li>
          ))}
        </ul>
      )
    case 'diario':
      return (
        <div className="space-y-4">
          {a.diario.length === 0 && <p className="text-sm text-[var(--suave)]">—</p>}
          {a.diario.map((d) => (
            <div key={d.moeda} className="print:break-inside-auto">
              <p className="num mb-1 flex flex-wrap justify-between gap-2 text-xs font-semibold"><span>{d.moeda} · {x.saldoInicial} {valorContabil(d.inicial, p)}</span><span>{x.saldoFinal} {valorContabil(d.final, p)}</span></p>
              <TabelaAnexo pais={p} vazio="—" linhas={d.linhas} colunas={[
                { titulo: x.col.data, celula: (l) => dataBR(l.data) },
                { titulo: x.col.descricao, celula: (l) => l.descricao },
                { titulo: x.col.forma, celula: (l) => l.forma },
                { titulo: x.col.entrada, direita: true, celula: (l) => (l.entrada ? valorContabil(l.entrada, p) : ''), total: d.entradas },
                { titulo: x.col.saida, direita: true, celula: (l) => (l.saida ? valorContabil(l.saida, p) : ''), total: d.saidas },
                { titulo: x.col.saldo, direita: true, celula: (l) => valorContabil(l.saldo, p) },
              ]} />
            </div>
          ))}
        </div>
      )
    case 'vendas':
      return <TabelaAnexo pais={p} vazio="—" linhas={a.vendas} colunas={[
        { titulo: x.col.data, celula: (l) => dataBR(l.data) },
        { titulo: x.col.cliente, celula: (l) => l.cliente || '—' },
        { titulo: x.col.item, celula: (l) => `${l.lote ? `${l.lote} · ` : ''}${l.descricao}` },
        { titulo: x.col.qtd, direita: true, celula: (l) => (l.quantidade > 1 && l.quantidade < 100000 && !l.lote ? l.quantidade : l.lote ? gramasTexto(l.quantidade) : l.quantidade) },
        { titulo: x.col.venda, direita: true, celula: (l) => v(l.totalPrincipal), total: a.vendas.reduce((s, l) => s + l.totalPrincipal, 0) },
        { titulo: x.col.custo, direita: true, celula: (l) => v(l.custo + l.insumos + l.comissao), total: a.vendas.reduce((s, l) => s + l.custo + l.insumos + l.comissao, 0) },
        { titulo: x.col.lucro, direita: true, celula: (l) => v(l.lucro), total: a.vendas.reduce((s, l) => s + l.lucro, 0) },
      ]} />
    case 'compras':
      return <TabelaAnexo pais={p} vazio="—" linhas={a.compras} colunas={[
        { titulo: x.col.data, celula: (l) => dataBR(l.data) },
        { titulo: x.col.fornecedor, celula: (l) => l.fornecedor || '—' },
        { titulo: x.col.item, celula: (l) => l.descricao },
        { titulo: x.col.qtd, direita: true, celula: (l) => gramasTexto(l.quantidade) },
        { titulo: x.col.etapa, celula: (l) => l.etapa },
        { titulo: x.col.valor, direita: true, celula: (l) => v(l.totalPrincipal), total: a.compras.reduce((s, l) => s + l.totalPrincipal, 0) },
      ]} />
    case 'gastos':
      return <TabelaAnexo pais={p} vazio="—" linhas={a.gastos} colunas={[
        { titulo: x.col.categoria, celula: (l) => l.categoria },
        { titulo: x.col.valor, direita: true, celula: (l) => v(l.valor), total: a.gastos.reduce((s, l) => s + l.valor, 0) },
      ]} />
    case 'inventario':
      return <TabelaAnexo pais={p} vazio="—" linhas={a.inventario.linhas} colunas={[
        { titulo: x.col.codigo, celula: (l) => l.codigo || '—' },
        { titulo: x.col.item, celula: (l) => l.nome },
        { titulo: x.col.qtd, direita: true, celula: (l) => (l.unidade === 'grama' ? gramasTexto(l.quantidade) : l.quantidade) },
        { titulo: x.col.custo, direita: true, celula: (l) => v(l.valorCusto), total: a.inventario.valor },
      ]} />
    case 'cuentas':
      return (
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-bold">{x.cobrar}</p>
            <TabelaAnexo pais={p} vazio="—" linhas={a.devedores} colunas={[{ titulo: x.col.pessoa, celula: (l) => l.nome }, { titulo: x.col.valor, direita: true, celula: (l) => v(l.saldo), total: a.devedores.reduce((s, l) => s + l.saldo, 0) }]} />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold">{x.pagar}</p>
            <TabelaAnexo pais={p} vazio="—" linhas={a.credores} colunas={[{ titulo: x.col.pessoa, celula: (l) => l.nome }, { titulo: x.col.valor, direita: true, celula: (l) => v(-l.saldo), total: a.credores.reduce((s, l) => s - l.saldo, 0) }]} />
          </div>
        </div>
      )
  }
}
